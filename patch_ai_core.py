# -*- coding: utf-8 -*-
"""
patch_ai_core.py — Extrait ai_core.js depuis core.js (v3.7.3)
Périmètre A : callAPI, askClaude, isAIError, renderAIError,
              buildAsinContext, buildClientContext, getSysPrompt, runAsinAI
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

with open('src/core.js', 'r', encoding='utf-8') as f:
    core = f.read()

# ── Extracteur safe (v3 — regex-aware, identique patch_parsers.py) ─────────

def extract_block(text, start_pos):
    brace_pos = text.index('{', start_pos)
    depth = 0; i = brace_pos
    in_string = None; in_line_cmt = False; in_block_cmt = False
    in_regex = False; prev_non_ws = ''
    REGEX_STARTERS = set('=(:,[!&|?{};~^%')
    while i < len(text):
        c = text[i]
        if in_line_cmt:
            if c == '\n': in_line_cmt = False
        elif in_block_cmt:
            if c == '*' and i+1 < len(text) and text[i+1] == '/':
                in_block_cmt = False; i += 1
        elif in_regex:
            if c == '\\': i += 1
            elif c == '[':
                i += 1
                while i < len(text) and text[i] != ']':
                    if text[i] == '\\': i += 1
                    i += 1
            elif c == '/': in_regex = False
        elif in_string:
            if c == '\\': i += 1
            elif c == in_string: in_string = None
        else:
            if c == '/' and i+1 < len(text):
                if text[i+1] == '/': in_line_cmt = True; i += 1
                elif text[i+1] == '*': in_block_cmt = True; i += 1
                elif prev_non_ws in REGEX_STARTERS or prev_non_ws == 'return':
                    in_regex = True
            elif c in ('"', "'", '`'): in_string = c
            elif c == '{': depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0: return text[start_pos:i+1], i+1
            if c not in (' ', '\t', '\n', '\r'):
                prev_non_ws = c
        i += 1
    raise ValueError('No matching brace at ' + str(start_pos))

def find_block(text, marker):
    pos = text.find(marker)
    if pos == -1: raise ValueError('Not found: ' + repr(marker))
    if pos >= 6 and text[pos-6:pos] == 'async ':
        pos -= 6
    body, end = extract_block(text, pos)
    return pos, end, body

# ── Bloc 1 : callAPI..getSysPrompt (L1395–L1695, contigus) ────────────────

# On extrait callAPI (début bloc) et getSysPrompt (fin bloc) séparément
# pour calculer le range exact du bloc contigu

s_callAPI,    _, _    = find_block(core, 'async function callAPI(')
s_askClaude,  _, _    = find_block(core, 'async function askClaude(')
s_isAIError,  _, _    = find_block(core, 'function isAIError(')
s_renderAIErr,_, _    = find_block(core, 'function renderAIError(')
s_buildAsin,  _, _    = find_block(core, 'function buildAsinContext(')
s_buildClient,_, _    = find_block(core, 'function buildClientContext(')
s_getSys,     e_getSys, body_getSys = find_block(core, 'function getSysPrompt(')

# Le bloc contigu va de callAPI jusqu'à la fin de getSysPrompt
bloc1_start = s_callAPI
bloc1_end   = e_getSys
bloc1_body  = core[bloc1_start:bloc1_end]

print(f'Bloc 1 : L{core[:bloc1_start].count(chr(10))+1} [{bloc1_start}-{bloc1_end}] callAPI..getSysPrompt')
print(f'  → {len(bloc1_body)} chars')

# Vérifier qu'aucun autre marqueur inattendu n'est dans le bloc
assert 'function callAPI' in bloc1_body   or 'callAPI' in bloc1_body
assert 'function getSysPrompt' in bloc1_body

# ── Bloc 2 : runAsinAI (L8145) ────────────────────────────────────────────

s_runAsin, e_runAsin, body_runAsin = find_block(core, 'async function runAsinAI(')
print(f'Bloc 2 : L{core[:s_runAsin].count(chr(10))+1} [{s_runAsin}-{e_runAsin}] runAsinAI')
print(f'  → {len(body_runAsin)} chars')

# ── Construire src/ai_core.js ──────────────────────────────────────────────

header = """// Amazon Pilot — src/ai_core.js
// Bloc IA/API extrait de core.js (v3.7.3)
// Injecté via // @ai_core dans core.js (build.py)

"""

ai_core_content = header + bloc1_body + '\n\n' + body_runAsin + '\n'

with open('src/ai_core.js', 'w', encoding='utf-8') as f:
    f.write(ai_core_content)
print(f'\nsrc/ai_core.js : {len(ai_core_content)} chars / {ai_core_content.count(chr(10))} lignes')

# ── Modifier core.js ──────────────────────────────────────────────────────

# Supprimer les deux blocs ; remplacer le premier par // @ai_core
all_ranges = sorted([
    (bloc1_start, bloc1_end,  'bloc1_callAPI-getSysPrompt'),
    (s_runAsin,   e_runAsin,  'runAsinAI'),
], key=lambda x: x[0])

print(f'\nRanges à supprimer : {len(all_ranges)}')
for r in all_ranges:
    print(f'  [{r[0]:7d}-{r[1]:7d}] {r[2]}')

result = []; prev = 0
for i, (s, e, name) in enumerate(all_ranges):
    result.append(core[prev:s])
    if i == 0: result.append('// @ai_core\n')
    prev = e
result.append(core[prev:])
new_core = ''.join(result)

print(f'\ncore.js original : {len(core)} chars / {core.count(chr(10))} lignes')
print(f'core.js nouveau  : {len(new_core)} chars / {new_core.count(chr(10))} lignes')
print(f'Supprimé : {len(core) - len(new_core)} chars')

# ── Assertions ────────────────────────────────────────────────────────────

assert '// @ai_core' in new_core,           'Tag @ai_core manquant!'
assert '// @idb'    in new_core,            'Tag @idb perdu!'
assert '// @utils'  in new_core,            'Tag @utils perdu!'
assert '// @parsers_internal' in new_core,  'Tag @parsers_internal perdu!'
assert 'async function callAPI(' not in new_core,    'callAPI non supprimé!'
assert 'async function runAsinAI(' not in new_core,  'runAsinAI non supprimé!'
assert 'function getSysPrompt(' not in new_core,     'getSysPrompt non supprimé!'
# Fonctions qui DOIVENT rester
assert 'function renderMarkdown(' in new_core, 'LOST renderMarkdown!'
assert 'function copyAI(' in new_core,         'LOST copyAI!'
assert 'function render()' in new_core,        'LOST render()!'
assert 'function save()' not in new_core,       'save() doit être dans idb.js'
assert 'const cl = ' in new_core,             'LOST cl()!'
print('Toutes assertions passées!')

with open('src/core.js', 'w', encoding='utf-8') as f:
    f.write(new_core)
print('src/core.js écrit.')
