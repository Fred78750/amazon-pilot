#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_v374.py — Extraction import_export.js + s3_poll.js depuis core.js
v3.7.4 — déplacement strict, aucune modification fonctionnelle
"""
import os, re, sys

REPO = os.path.dirname(os.path.abspath(__file__))
CORE = os.path.join(REPO, 'src', 'core.js')

def read(path):
    with open(path, 'rb') as f: data = f.read()
    if data[:3] == b'\xef\xbb\xbf': data = data[3:]
    return data.decode('utf-8').replace('\r\n', '\n')

def write(path, content):
    with open(path, 'wb') as f: f.write(content.encode('utf-8'))
    print(f'  Écrit : {path} ({len(content)} chars)')

# ── Extracteur de bloc fonction (bracket-matching, state machine complet) ────
# Gère : strings simples/doubles, template literals avec ${...} imbriqués,
# regex literals (y compris /["...]/ avec guillemets dans character classes),
# commentaires //, /* */, backslash escape.
# Retourne (line_start_of_func, idx_after_closing_brace).
def find_func(src, marker, start_from=0):
    pos = src.find(marker, start_from)
    if pos < 0:
        raise ValueError(f'Marqueur non trouvé : {marker!r}')
    line_start = src.rfind('\n', 0, pos) + 1
    brace_open = src.find('{', pos)

    depth = 0
    i = brace_open
    # stk entries: ('str', q) | ('tmpl_text',) | ('tmpl_expr', entry_depth)
    stk = []
    last_nonws = ''  # dernier char non-whitespace en contexte code

    while i < len(src):
        ch = src[i]
        top = stk[-1] if stk else None

        # Backslash escape inside strings and template text
        if top in (('str', "'"), ('str', '"'), ('tmpl_text',)) and ch == '\\':
            i += 2; continue

        # Inside single-quoted string
        if top == ('str', "'"):
            if ch == "'": stk.pop()
            i += 1; continue

        # Inside double-quoted string
        if top == ('str', '"'):
            if ch == '"': stk.pop()
            i += 1; continue

        # Inside template literal TEXT (between ${} blocks)
        if top == ('tmpl_text',):
            if ch == '`':
                stk.pop()
            elif ch == '$' and src[i+1:i+2] == '{':
                stk.pop()
                stk.append(('tmpl_expr', depth))
                depth += 1
                i += 2; continue
            i += 1; continue

        # Code context (base or inside tmpl_expr)
        in_code = (top is None) or (top[0] == 'tmpl_expr')

        if in_code:
            # Line comments
            if ch == '/' and src[i+1:i+2] == '/':
                end = src.find('\n', i)
                i = (end + 1) if end >= 0 else len(src); continue
            # Block comments
            if ch == '/' and src[i+1:i+2] == '*':
                end = src.find('*/', i + 2)
                i = (end + 2) if end >= 0 else len(src); continue
            # Regex literal — heuristique : / après opérateur = regex, après ) ] alphanum = division
            if ch == '/':
                is_division = (last_nonws in (')', ']') or
                               last_nonws.isalpha() or last_nonws.isdigit() or last_nonws == '_')
                if not is_division:
                    # Scanner le regex jusqu'au / fermant (gère [character class] et \ escapes)
                    i += 1
                    while i < len(src):
                        rc = src[i]
                        if rc == '\\': i += 2; continue
                        if rc == '[':            # character class : " et ' sont littéraux
                            i += 1
                            while i < len(src):
                                cc = src[i]
                                if cc == '\\': i += 2; continue
                                if cc == ']': i += 1; break
                                i += 1
                            continue
                        if rc == '/':            # fin du regex, sauter les flags
                            i += 1
                            while i < len(src) and src[i].isalpha(): i += 1
                            break
                        if rc == '\n': break     # regex invalide, abandonner
                        i += 1
                    last_nonws = '/'
                    continue
                # Sinon opérateur de division — tomber en bas du loop
                last_nonws = ch; i += 1; continue
            # Open string
            if ch in ('"', "'"):
                stk.append(('str', ch)); last_nonws = ch; i += 1; continue
            # Open template literal
            if ch == '`':
                stk.append(('tmpl_text',)); last_nonws = ch; i += 1; continue

        # Brace counting
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if top and top[0] == 'tmpl_expr' and depth == top[1]:
                stk.pop()
                stk.append(('tmpl_text',))
            elif depth == 0 and not stk:
                return (line_start, i + 1)

        if ch not in (' ', '\t', '\n', '\r'): last_nonws = ch
        i += 1

    raise ValueError(f'Accolade fermante non trouvée pour {marker!r}')

def extract_block_with_comment(src, comment_marker, func_marker, start_from=0):
    """
    Retourne (start, end) englobant le commentaire + la fonction.
    start = début de la ligne commentaire, end = après } de la fonction.
    """
    cpos = src.find(comment_marker, start_from)
    func_start_line, func_end = find_func(src, func_marker, start_from)

    if cpos >= 0 and cpos < func_start_line:
        # Remonter au début de la ligne du commentaire
        line_start = src.rfind('\n', 0, cpos) + 1
        return (line_start, func_end)
    return (func_start_line, func_end)

# ── Lecture core.js ──────────────────────────────────────────────────────────
print(f'\n{"="*60}')
print(f'  patch_v374.py — core.js {len(read(CORE).splitlines())} L')
print(f'{"="*60}\n')

src = read(CORE)
original_lines = len(src.splitlines())

# ════════════════════════════════════════════════════════════════════════════
# 1. EXTRACTION s3_poll.js  (bloc contigu L4576-L4730)
# ════════════════════════════════════════════════════════════════════════════
print('── S3 poll ──')

# Start : commentaire "// ── Configuration S3 imports"
s3_comment = '// ── Configuration S3 imports'
s3_pos = src.find(s3_comment)
assert s3_pos >= 0, 'Commentaire S3 introuvable'
s3_start = src.rfind('\n', 0, s3_pos) + 1

# End : fin de pollS3Imports
_, s3_end = find_func(src, 'async function pollS3Imports(')

# Inclure les 2 let vars et le commentaire poll qui sont entre getS3PresignedUrl et activateS3Poll
s3_content = src[s3_start:s3_end]
print(f'  Extrait s3_poll ({s3_end - s3_start} chars, {len(s3_content.splitlines())} L)')

# Vérifications
for fname in ['getS3Config', 'saveS3Config', 'getS3Key', 'getS3PresignedUrl',
              'activateS3Poll', 'startS3Poll', 'stopS3Poll', 'pollS3Imports',
              '_s3PollHandle', '_s3KnownKeys']:
    assert fname in s3_content, f'MANQUANT dans s3_poll : {fname}'
    print(f'    ✓ {fname}')

# ════════════════════════════════════════════════════════════════════════════
# 2. EXTRACTION import_export.js (non-contigu)
# ════════════════════════════════════════════════════════════════════════════
print('\n── Import/export ──')

funcs_to_extract = [
    # (marker_func, async)
    ('function mergeImportData(',    False),
    ('function handleBannerCSV(',    False),
    ('function handlePOImport(',     False),
    ('function parsePOCSV(',         False),
    ('function mergePOData(',        False),
    ('function handleHistCSVImport(',False),
    ('function handleHistCSV(',      False),
    ('function handleMultiCSV(',     False),
    ('function clearPending()',      False),  # single-line
    ('function checkImportCoherence(', False),
    ('function processImport(',      False),
    ('function confirmImport(',      False),
    ('function cancelImport(',       False),
    ('function exportClient(',       False),
    ('function exportAllData(',      False),
    ('function importAllData(',      False),
]

ie_pieces = []
extraction_ranges = []  # (start, end) dans src original

for (marker, _) in funcs_to_extract:
    start_from = 0
    start, end = find_func(src, marker, start_from)
    ie_pieces.append(src[start:end])
    extraction_ranges.append((start, end))
    fname = marker.split('(')[0].replace('function ', '').replace('async ', '').strip()
    print(f'    ✓ {fname} ({end - start} chars)')

# Vérifier qu'on a bien 16 fonctions
assert len(ie_pieces) == 16, f'Attendu 16 fonctions, trouvé {len(ie_pieces)}'

# Assembler import_export.js
ie_content = '\n\n'.join(piece.strip('\n') for piece in ie_pieces)
print(f'  Total import_export : {len(ie_content)} chars, {len(ie_content.splitlines())} L')

# ════════════════════════════════════════════════════════════════════════════
# 3. MODIFICATION core.js
# ════════════════════════════════════════════════════════════════════════════
print('\n── Patch core.js ──')

# Opérations à effectuer sur le src (on travaille de la FIN vers le DÉBUT pour
# ne pas invalider les positions des blocs précédents)

# Bloc 1 — mergeImportData + legacy comment
# On remplace depuis le commentaire _parseCSVFile_LEGACY jusqu'à la fin de mergeImportData
legacy_marker = '// _parseCSVFile_LEGACY'
legacy_pos = src.find(legacy_marker)
assert legacy_pos >= 0, '_parseCSVFile_LEGACY introuvable'
legacy_line_start = src.rfind('\n', 0, legacy_pos) + 1
_, merge_end = find_func(src, 'function mergeImportData(')
import_export_tag_start = legacy_line_start
import_export_tag_end   = merge_end

# Bloc 2 — s3_poll (déjà calculé)
# s3_start, s3_end

# Blocs 3-16 — les 15 autres fonctions import/export (tout sauf mergeImportData)
other_ranges = extraction_ranges[1:]  # indexes 1..15

# Trier tous les blocs par position décroissante pour patcher de la fin vers le début
all_ops = [
    ('tag_import_export', import_export_tag_start, import_export_tag_end),
    ('tag_s3_poll',       s3_start, s3_end),
]
for i, (start, end) in enumerate(other_ranges):
    all_ops.append((f'delete_{i}', start, end))

# Trier de la fin vers le début
all_ops.sort(key=lambda x: x[1], reverse=True)

patched = src
fmt_pos = src.find('function formatFillRate(')
print(f'  [debug] formatFillRate in src at pos={fmt_pos}')

for op_name, op_start, op_end in all_ops:
    if fmt_pos >= op_start and fmt_pos < op_end:
        print(f'  [debug] *** formatFillRate WITHIN range of {op_name}: [{op_start},{op_end})')
    if op_name == 'tag_import_export':
        patched = patched[:op_start] + '// @import_export\n' + patched[op_end:]
        print(f'  ✓ @import_export injecté (remplacement {op_end - op_start} chars)')
    elif op_name == 'tag_s3_poll':
        patched = patched[:op_start] + '// @s3_poll\n' + patched[op_end:]
        print(f'  ✓ @s3_poll injecté (remplacement {op_end - op_start} chars)')
    else:
        # Supprimer la fonction + la ligne vide qui la précède éventuellement
        # Chercher une ligne vide juste avant
        chunk_before = patched[:op_start]
        if chunk_before.endswith('\n\n'):
            actual_start = op_start - 1  # absorber un \n supplémentaire
        else:
            actual_start = op_start
        deleted_snippet = patched[actual_start:min(actual_start+60, op_end)]
        after_snippet   = patched[op_end:op_end+60]
        print(f'  ✓ supprimé bloc {op_name} [{actual_start},{op_end})')
        print(f'    del:   {deleted_snippet!r}')
        print(f'    after: {after_snippet!r}')
        patched = patched[:actual_start] + patched[op_end:]

new_lines = len(patched.splitlines())
print(f'\n  core.js : {original_lines} L → {new_lines} L (−{original_lines - new_lines} L)')
assert new_lines < original_lines, 'core.js na pas été réduit!'

# DEBUG: context around getPOData in patched
gp = patched.find('function getPOData(')
if gp >= 0:
    print(f'  [debug] getPOData at pos={gp}, snippet after: {patched[gp:gp+120]!r}')
else:
    print('  [debug] getPOData NOT FOUND')

# Vérifications negatives (fonctions extraites absentes de core.js)
for fname in ['mergeImportData', 'handleBannerCSV', 'handlePOImport', 'parsePOCSV',
              'mergePOData', 'handleHistCSVImport', 'handleMultiCSV', 'clearPending',
              'checkImportCoherence', 'processImport', 'confirmImport', 'cancelImport',
              'exportClient', 'exportAllData', 'importAllData',
              'getS3Config', 'saveS3Config', 'getS3Key', 'getS3PresignedUrl',
              'activateS3Poll', 'startS3Poll', 'stopS3Poll', 'pollS3Imports']:
    pattern = rf'(?:async\s+)?function\s+{fname}\s*\('
    if re.search(pattern, patched):
        print(f'  ❌ ERREUR : {fname} toujours présent dans core.js après patch!')
        sys.exit(1)

# Vérifications positives (fonctions maintenues dans core.js)
for fname in ['getPOData', 'formatFillRate', 'showToast', 'showImportSuccess',
              '// @import_export', '// @s3_poll']:
    assert fname in patched, f'Manquant dans core.js après patch : {fname!r}'
    print(f'  ✓ core.js contient toujours : {fname}')

# ════════════════════════════════════════════════════════════════════════════
# 4. ÉCRITURE DES FICHIERS
# ════════════════════════════════════════════════════════════════════════════
print('\n── Écriture ──')

ie_header = '// Amazon Pilot — src/import_export.js\n// Injecté via // @import_export dans core.js (build.py)\n// v3.7.4 — déplacement strict depuis core.js (aucune modification fonctionnelle)\n\n'
s3_header = '// Amazon Pilot — src/s3_poll.js\n// Injecté via // @s3_poll dans core.js (build.py)\n// v3.7.4 — déplacement strict depuis core.js (aucune modification fonctionnelle)\n\n'

write(os.path.join(REPO, 'src', 'import_export.js'), ie_header + ie_content)
write(os.path.join(REPO, 'src', 's3_poll.js'),       s3_header + s3_content)
write(CORE, patched)

print(f'\n{"="*60}')
print(f'  ✅ patch_v374.py terminé')
print(f'  src/import_export.js : 16 fonctions')
print(f'  src/s3_poll.js       : 8 fonctions + 2 vars d\'état')
print(f'  core.js              : {original_lines} L → {new_lines} L')
print(f'{"="*60}\n')
