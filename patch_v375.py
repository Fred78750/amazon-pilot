#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_v375.py — Extraction render_shell.js + render_screens.js + charts.js depuis core.js
v3.7.5 — déplacement strict, aucune modification fonctionnelle
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
    print(f'  Ecrit : {path} ({len(content)} chars)')

# ── Extracteur de bloc fonction (bracket-matching, state machine complet) ────
# Copié de patch_v374.py — gère strings, template literals, regex, commentaires.
def find_func(src, marker, start_from=0):
    pos = src.find(marker, start_from)
    if pos < 0:
        raise ValueError(f'Marqueur non trouve : {marker!r}')
    line_start = src.rfind('\n', 0, pos) + 1
    brace_open = src.find('{', pos)

    depth = 0
    i = brace_open
    stk = []
    last_nonws = ''

    while i < len(src):
        ch = src[i]
        top = stk[-1] if stk else None

        if top in (('str', "'"), ('str', '"'), ('tmpl_text',)) and ch == '\\':
            i += 2; continue
        if top == ('str', "'"):
            if ch == "'": stk.pop()
            i += 1; continue
        if top == ('str', '"'):
            if ch == '"': stk.pop()
            i += 1; continue
        if top == ('tmpl_text',):
            if ch == '`':
                stk.pop()
            elif ch == '$' and src[i+1:i+2] == '{':
                stk.pop()
                stk.append(('tmpl_expr', depth))
                depth += 1
                i += 2; continue
            i += 1; continue

        in_code = (top is None) or (top[0] == 'tmpl_expr')

        if in_code:
            if ch == '/' and src[i+1:i+2] == '/':
                end = src.find('\n', i)
                i = (end + 1) if end >= 0 else len(src); continue
            if ch == '/' and src[i+1:i+2] == '*':
                end = src.find('*/', i + 2)
                i = (end + 2) if end >= 0 else len(src); continue
            if ch == '/':
                is_division = (last_nonws in (')', ']') or
                               last_nonws.isalpha() or last_nonws.isdigit() or last_nonws == '_')
                if not is_division:
                    i += 1
                    while i < len(src):
                        rc = src[i]
                        if rc == '\\': i += 2; continue
                        if rc == '[':
                            i += 1
                            while i < len(src):
                                cc = src[i]
                                if cc == '\\': i += 2; continue
                                if cc == ']': i += 1; break
                                i += 1
                            continue
                        if rc == '/':
                            i += 1
                            while i < len(src) and src[i].isalpha(): i += 1
                            break
                        if rc == '\n': break
                        i += 1
                    last_nonws = '/'
                    continue
                last_nonws = ch; i += 1; continue
            if ch in ('"', "'"):
                stk.append(('str', ch)); last_nonws = ch; i += 1; continue
            if ch == '`':
                stk.append(('tmpl_text',)); last_nonws = ch; i += 1; continue

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

    raise ValueError(f'Accolade fermante non trouvee pour {marker!r}')


def extract_with_comments(src, marker, start_from=0):
    """
    Extrait une fonction. Inclut les lignes // qui precedent immediatement.
    Retourne (start_incl_comments, end_after_closing_brace).
    """
    line_start, func_end = find_func(src, marker, start_from)

    # Remonter sur les lignes de commentaires precedentes
    pos = line_start - 1
    while pos > 0:
        prev_end   = pos
        prev_start = src.rfind('\n', 0, prev_end) + 1
        prev_line  = src[prev_start:prev_end].strip()
        if prev_line.startswith('//'):
            line_start = prev_start
            pos = prev_start - 1
        else:
            break

    return line_start, func_end


# ── Lecture core.js ──────────────────────────────────────────────────────────
print(f'\n{"="*60}')
print(f'  patch_v375.py — Extraction render/nav/charts')
print(f'{"="*60}\n')

src = read(CORE)
original_lines = len(src.splitlines())
print(f'  core.js : {original_lines} L\n')

# Garde-fous : unicite des marqueurs critiques
for uniq_marker in ['function render() {', 'function go(s)', 'function yoyGoBack()']:
    count = src.count(uniq_marker)
    if count != 1:
        print(f'  ERREUR : {uniq_marker!r} trouve {count} fois (attendu 1)')
        sys.exit(1)

# ════════════════════════════════════════════════════════════════════════════
# 1. EXTRACTION charts.js (7 fonctions)
# ════════════════════════════════════════════════════════════════════════════
print('── Charts ──')

charts_markers = [
    'function buildWeeklyConsolidated(',
    'function buildMonthlyConsolidated(',
    'function buildN1Series(',
    'function buildDashWeeklyChartConfig(',
    'function initDashWeeklyChart(',
    'function getMarketTabs(',
    'function renderMarketTabs(',
]

charts_pieces  = []
charts_ranges  = []

for marker in charts_markers:
    s, e = extract_with_comments(src, marker)
    charts_pieces.append(src[s:e])
    charts_ranges.append((s, e))
    fname = marker.replace('function ', '').split('(')[0]
    print(f'    OK {fname} ({e - s} chars)')

charts_content = '\n\n'.join(p.strip('\n') for p in charts_pieces)
print(f'  Total charts : {len(charts_content)} chars, {len(charts_content.splitlines())} L')

# ════════════════════════════════════════════════════════════════════════════
# 2. EXTRACTION render_screens.js (10 fonctions, non-contigues)
# ════════════════════════════════════════════════════════════════════════════
print('\n── Render screens ──')

screens_markers = [
    'function renderYTDComparison(',
    'function renderFreshnessBanner(',
    'function renderWelcome(',
    'function renderOnboarding(',
    'function renderImport(',
    'function renderWeeklyReview(',
    'function renderDashboard(',
    'function renderCaseModal(',
    'function renderAsins(',
    'function renderPompier(',
]

screens_pieces  = []
screens_ranges  = []

for marker in screens_markers:
    s, e = extract_with_comments(src, marker)
    screens_pieces.append(src[s:e])
    screens_ranges.append((s, e))
    fname = marker.replace('function ', '').split('(')[0]
    print(f'    OK {fname} ({e - s} chars)')

screens_content = '\n\n'.join(p.strip('\n') for p in screens_pieces)
print(f'  Total render_screens : {len(screens_content)} chars, {len(screens_content.splitlines())} L')

# ════════════════════════════════════════════════════════════════════════════
# 3. EXTRACTION render_shell.js (5 render + 5 nav + popstate)
# ════════════════════════════════════════════════════════════════════════════
print('\n── Render shell ──')

shell_markers = [
    'function render() {',
    'function renderNav()',
    'function renderClients()',
    'function renderTopbar()',
    'function renderContent()',
    'function go(s)',
    'function goAgentVC(',
    'function goFilteredAsins(',
    'function goToAsinsYoY(',
    'function yoyGoBack()',
]

shell_pieces = []
shell_ranges = []

for marker in shell_markers:
    s, e = extract_with_comments(src, marker)
    shell_pieces.append(src[s:e])
    shell_ranges.append((s, e))
    fname = marker.replace('function ', '').split('(')[0].strip()
    print(f'    OK {fname} ({e - s} chars)')

# Popstate listener — top-level code, extraction speciale
popstate_comment = "// v3.6.8 γ : handler popstate"
pc_pos = src.find(popstate_comment)
assert pc_pos >= 0, f'Commentaire popstate introuvable : {popstate_comment!r}'
ps_block_start = src.rfind('\n', 0, pc_pos) + 1

# find_func sur function(e) { depuis la position du commentaire
_, ps_func_end = find_func(src, "function(e) {", pc_pos)
# ps_func_end pointe apres le } fermant du corps de la fonction inline
# Les 2 chars suivants doivent etre ');'
tail = src[ps_func_end:ps_func_end + 4]
assert src[ps_func_end:ps_func_end+2] == ');', \
    f'Inattendu apres corps popstate (attendu ");" ) : {tail!r}'
ps_block_end = ps_func_end + 2  # ')' + ';'
if src[ps_block_end:ps_block_end+1] == '\n':
    ps_block_end += 1

popstate_block = src[ps_block_start:ps_block_end]
print(f'    OK popstate listener ({ps_block_end - ps_block_start} chars)')
shell_ranges.append((ps_block_start, ps_block_end))
shell_pieces.append(popstate_block)

shell_content = '\n\n'.join(p.strip('\n') for p in shell_pieces)
print(f'  Total render_shell : {len(shell_content)} chars, {len(shell_content.splitlines())} L')

# ════════════════════════════════════════════════════════════════════════════
# 4. MODIFICATION core.js
# ════════════════════════════════════════════════════════════════════════════
print('\n── Patch core.js ──')

# Localiser // @yoy (derniere ligne de core.js apres extraction)
yoy_tag_marker = '// @yoy\n'
yoy_tag_pos = src.find(yoy_tag_marker)
assert yoy_tag_pos >= 0, '// @yoy introuvable dans core.js'
yoy_tag_end = yoy_tag_pos + len(yoy_tag_marker)

# Verifier que toutes les suppressions sont avant // @yoy
all_ranges = charts_ranges + screens_ranges + shell_ranges
for s, e in all_ranges:
    assert e <= yoy_tag_pos, \
        f'Plage [{s},{e}] depasse // @yoy a {yoy_tag_pos} — incoherence !'

# Trier toutes les suppressions par position decroissante
all_deletions = [(s, e) for (s, e) in all_ranges]
all_deletions.sort(key=lambda x: x[0], reverse=True)

patched = src

# Etape 1 : inserer les 3 nouveaux tags apres // @yoy (position > toutes les suppressions)
new_tags = '// @render_shell\n// @render_screens\n// @charts\n'
patched = patched[:yoy_tag_end] + new_tags + patched[yoy_tag_end:]
# L'insertion est apres tous les op_start → les positions de suppression inchangees

# Etape 2 : supprimer les fonctions extraites (fin → debut)
for op_start, op_end in all_deletions:
    # Absorber la ligne vide precedente si presente (evite double-saut de ligne)
    chunk_before = patched[:op_start]
    if chunk_before.endswith('\n\n'):
        actual_start = op_start - 1
    else:
        actual_start = op_start
    snippet = src[op_start:min(op_start + 50, op_end)].split('\n')[0]
    patched = patched[:actual_start] + patched[op_end:]
    print(f'  supprime [{op_start},{op_end}) : {snippet!r}')

new_lines = len(patched.splitlines())
print(f'\n  core.js : {original_lines} L → {new_lines} L (−{original_lines - new_lines} L)')
assert new_lines < original_lines, 'core.js na pas ete reduit !'

# ── Verifications negatives : fonctions extraites absentes de core.js ──
neg_funcs = [
    'function render() {',
    'function renderNav()',      'function renderClients()',
    'function renderTopbar()',   'function renderContent()',
    'function go(s)',            'function goAgentVC(',
    'function goFilteredAsins(', 'function goToAsinsYoY(',
    'function yoyGoBack()',
    'function renderWelcome(',   'function renderOnboarding(',
    'function renderImport(',    'function renderDashboard(',
    'function renderWeeklyReview(', 'function renderAsins(',
    'function renderPompier(',   'function renderCaseModal(',
    'function renderYTDComparison(', 'function renderFreshnessBanner(',
    'function buildWeeklyConsolidated(', 'function buildMonthlyConsolidated(',
    'function buildN1Series(',   'function buildDashWeeklyChartConfig(',
    'function initDashWeeklyChart(', 'function getMarketTabs(',
    'function renderMarketTabs(',
]
for f in neg_funcs:
    if f in patched:
        print(f'  ERREUR : {f!r} toujours present dans core.js !')
        sys.exit(1)
    print(f'  OK absent : {f}')

# ── Verifications positives : elements maintenus ──
pos_checks = [
    '// @render_shell', '// @render_screens', '// @charts',
    '// @yoy', '// @s3_poll', '// @import_export',
    'function selClient(',    'function showToast(',
    'function startOnboarding(', 'function publishVC(',
    'APP_VERSION',
]
for f in pos_checks:
    if f not in patched:
        print(f'  ERREUR : {f!r} manquant dans core.js !')
        sys.exit(1)
    print(f'  OK present : {f}')

# ════════════════════════════════════════════════════════════════════════════
# 5. ECRITURE DES FICHIERS
# ════════════════════════════════════════════════════════════════════════════
print('\n── Ecriture ──')

rs_header  = ('// Amazon Pilot — src/render_shell.js\n'
              '// Injecte via // @render_shell dans core.js (build.py)\n'
              '// v3.7.5 — deplacement strict depuis core.js (aucune modification fonctionnelle)\n\n')
rsc_header = ('// Amazon Pilot — src/render_screens.js\n'
              '// Injecte via // @render_screens dans core.js (build.py)\n'
              '// v3.7.5 — deplacement strict depuis core.js (aucune modification fonctionnelle)\n\n')
ch_header  = ('// Amazon Pilot — src/charts.js\n'
              '// Injecte via // @charts dans core.js (build.py)\n'
              '// v3.7.5 — deplacement strict depuis core.js (aucune modification fonctionnelle)\n\n')

write(os.path.join(REPO, 'src', 'render_shell.js'),   rs_header + shell_content)
write(os.path.join(REPO, 'src', 'render_screens.js'), rsc_header + screens_content)
write(os.path.join(REPO, 'src', 'charts.js'),         ch_header + charts_content)
write(CORE, patched)

print(f'\n{"="*60}')
print(f'  patch_v375.py termine')
print(f'  src/render_shell.js   : {len(shell_pieces)} blocs ({shell_content.count(chr(10))} L)')
print(f'  src/render_screens.js : {len(screens_pieces)} fonctions ({screens_content.count(chr(10))} L)')
print(f'  src/charts.js         : {len(charts_pieces)} fonctions ({charts_content.count(chr(10))} L)')
print(f'  core.js               : {original_lines} L -> {new_lines} L (-{original_lines - new_lines} L)')
print(f'{"="*60}\n')
