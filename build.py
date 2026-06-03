#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Amazon Pilot — Build Script
Usage :
    python3 build.py                       # bump patch auto
    python3 build.py --version 3.1.64      # version explicite
    python3 build.py --check               # validation seulement
"""
import os, re, sys, subprocess, shutil, glob
from datetime import datetime

SRC_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')
BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT    = os.path.join(BUILD_DIR, 'amazon-pilot-latest.html')

def r(f):
    with open(os.path.join(SRC_DIR, f), 'rb') as fp:
        data = fp.read()
    if data[:3] == b'\xef\xbb\xbf': data = data[3:]  # strip UTF-8 BOM
    return data.decode('utf-8').replace('\r\n', '\n')

def w(path, c):
    with open(path, 'wb') as fp: fp.write(c.encode('utf-8'))

def log(m, l=''):
    icons = {'OK':'✅','ERR':'❌','WARN':'⚠️ ','STEP':'▶ '}
    print(f"{icons.get(l,'  ')} {m}")

def strip_header(code):
    lines = code.split('\n')
    while lines and (lines[0].startswith('// Amazon Pilot') or
                     lines[0].startswith('// Extrait') or
                     lines[0].startswith('// Régénéré') or lines[0]==''):
        lines.pop(0)
    return '\n'.join(lines)

def get_ver(js):
    m = re.search(r"APP_VERSION = '([\d.]+)'", js)
    return m.group(1) if m else '0.0.0'

def bump(v):
    p=v.split('.'); p[-1]=str(int(p[-1])+1); return '.'.join(p)

def build(ver=None, check=False):
    log("Lecture sources", 'STEP')
    shell  = r('shell.html')
    css    = r('styles.css')
    core   = strip_header(r('core.js'))
    buybox = strip_header(r('buybox.js'))
    seo    = strip_header(r('seo.js'))
    smoke  = strip_header(r('smoke.js'))
    guide      = strip_header(r('guide_asn.js'))
    parser_erp = strip_header(r('parser_erp.js'))
    parser_vc  = strip_header(r('parser_vc.js'))
    yoy         = strip_header(r('yoy.js'))
    yoy_ai      = strip_header(r('yoy_ai.js'))
    yoy_enquete    = strip_header(r('yoy_enquete.js'))   # v3.6.8 — VC_AVAILABILITY_CODES + algo classification
    parser_po      = strip_header(r('parser_po.js'))     # v3.6.8 — parser POItemExport (après yoy_enquete)
    ai_diagnostic  = strip_header(r('ai_diagnostic.js')) # v3.6.9 — narrative IA Cause la plus probable + cache
    word_export    = strip_header(r('word_export.js'))    # v3.6.9 — export Word CTA 13 (lazy-load docx)
    # Templates Free — tous les fichiers src/templates/yoy_*.js (ordre alphabétique stable)
    tpl_dir = os.path.join(SRC_DIR, 'templates')
    tpl_files = sorted(glob.glob(os.path.join(tpl_dir, 'yoy_*.js')))
    yoy_templates = '\n'.join(strip_header(open(f, 'rb').read().decode('utf-8').replace('\r\n', '\n')) for f in tpl_files)
    # Ordre injection : yoy_enquete → parser_po → ai_diagnostic → yoy → templates → yoy_ai → word_export
    yoy_full = yoy_enquete + '\n' + parser_po + '\n' + ai_diagnostic + '\n' + yoy + '\n' + yoy_templates + '\n' + yoy_ai + '\n' + word_export

    # runSmokeTestManual : dans smoke.js mais injecté a @smoke_manual dans core
    rsm_line = 'function runSmokeTestManual() { smokeTest(false); }'
    smoke_manual = rsm_line if rsm_line in smoke else ''
    smoke_main   = smoke.replace('\n' + rsm_line, '') if smoke_manual else smoke

    for name, content in [('core.js',core),('buybox.js',buybox),('seo.js',seo),
                           ('smoke.js',smoke),('guide_asn.js',guide),
                           ('parser_erp.js',parser_erp),('parser_vc.js',parser_vc),
                           ('ai_diagnostic.js',ai_diagnostic),('word_export.js',word_export),
                           ('yoy_enquete.js',yoy_enquete),('parser_po.js',parser_po),
                           ('yoy.js',yoy),('yoy_ai.js',yoy_ai),('templates/*',yoy_templates)]:
        log(f"{name:<20} {len(content)//1024} Ko")

    cur = get_ver(core)
    new_ver = ver or bump(cur)
    log(f"Version : {cur} → {new_ver}", 'STEP')

    log("Assemblage JS", 'STEP')
    js = core
    # Injection avec \n pour éviter collision @smoke vs @smoke_manual
    js = js.replace('// @guide\n',        guide + '\n')
    js = js.replace('// @parser_erp\n',  parser_erp + '\n')
    js = js.replace('// @parser_vc\n',   parser_vc + '\n')
    js = js.replace('// @smoke\n',        smoke_main + '\n')
    js = js.replace('// @buybox\n',       buybox + '\n')
    js = js.replace('// @seo\n',          seo + '\n')
    js = js.replace('// @yoy\n',          yoy_full + '\n')
    js = js.replace('// @smoke_manual\n', smoke_manual + '\n')
    js = re.sub(r"APP_VERSION = '[\d.]+'", f"APP_VERSION = '{new_ver}'", js, count=1)
    log(f"JS : {len(js)//1024} Ko")

    log("Injection HTML", 'STEP')
    html = shell
    html = html.replace('\n/* @styles */\n', '\n' + css + '\n')
    ph = '\n// @guide\n// @smoke\n// @core\n// @buybox\n// @seo\n// @yoy\n// @smoke_manual\n'
    html = html.replace(ph, '\n' + js + '\n')

    log("Validation JS", 'STEP')
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
    main_js = max(scripts, key=len) if scripts else ''
    tmp = '/tmp/ap_check.js'
    with open(tmp,'w',encoding='utf-8') as f: f.write(main_js)
    res = subprocess.run(['node','--check',tmp], capture_output=True, text=True)
    if res.returncode != 0:
        log(f"JS invalide !\n{res.stderr[:400]}", 'ERR'); sys.exit(1)
    log(f"JS valide ({len(main_js)//1024} Ko)", 'OK')

    if check:
        log("Mode --check : pas d'écriture"); return new_ver

    log("Écriture", 'STEP')
    w(OUTPUT, html)
    log(f"amazon-pilot-latest.html ({os.path.getsize(OUTPUT)//1024} Ko)", 'OK')
    versioned = os.path.join(BUILD_DIR, f'amazon-pilot-v{new_ver}.html')
    shutil.copy(OUTPUT, versioned)
    log(f"amazon-pilot-v{new_ver}.html", 'OK')
    return new_ver

if __name__ == '__main__':
    ver_arg, check_only = None, False
    args = sys.argv[1:]; i = 0
    while i < len(args):
        if args[i]=='--check': check_only=True
        elif args[i]=='--version' and i+1<len(args): ver_arg=args[i+1]; i+=1
        elif args[i].startswith('--version='): ver_arg=args[i].split('=',1)[1]
        i+=1
    print(f"\n{'='*50}\n  Amazon Pilot — Build  {datetime.now():%Y-%m-%d %H:%M:%S}\n{'='*50}\n")
    v = build(ver=ver_arg, check=check_only)
    print(f"\n{'='*50}\n  ✅  Build v{v} terminé\n{'='*50}\n")
