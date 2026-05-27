// @ts-check
/**
 * Amazon Pilot — Smoke Test Playwright (Happy Path)
 *
 * PÉRIMÈTRE : tests sans données (navigateur headless vierge, pas de localStorage)
 * Les tests avec données réelles (CA, ASINs, cohérence chiffres) sont dans
 * le smoke test intégré : Config > Smoke Test > Lancer
 *
 * Exécuter avant chaque git push staging :
 *   npx playwright test tests/smoke.spec.js
 *
 * NOTE TECHNIQUE : cl() est une const arrow function, pas dans window.
 * Tous les accès se font via page.evaluate() sans window.xxx
 */

const { test, expect } = require('@playwright/test');
const RECETTE_URL = 'https://d9xny9istvl53.cloudfront.net';

// V0 — App charge et version valide
test('V0 — App charge et affiche une version valide', async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', e => { if (!e.message.includes('extension')) jsErrors.push(e.message); });

  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const version = await page.evaluate(() => document.body.innerText.match(/v(\d+\.\d+\.\d+)/)?.[0]);
  console.log('  Version :', version);
  expect(version, 'Version non trouvée dans le DOM').toBeTruthy();
  expect(version, 'Format version incorrect').toMatch(/v3\.\d+\.\d+/);
  expect(jsErrors, 'Erreurs JS au chargement : ' + jsErrors.join(' | ')).toHaveLength(0);
});

// V0b — Titre onglet dynamique (bug historique figé à v3.1.27)
test('V0b — Titre onglet non figé a v3.1.27', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.evaluate(() => { if (typeof renderNav === 'function') renderNav(); });
  await page.waitForTimeout(300);
  const title = await page.title();
  console.log('  Titre :', title);
  expect(title, 'Titre toujours figé à v3.1.27').not.toContain('v3.1.27');
  expect(title, 'Version absente du titre').toMatch(/v\d+\.\d+\.\d+/);
});

// V1 — Fonctions critiques présentes
// Note : cl est une const arrow function (pas dans window) — testé via typeof dans evaluate
test('V1 — Fonctions critiques presentes', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const missing = await page.evaluate(() => {
    // Fonctions window.xxx (déclarées avec function)
    const windowFns = [
      // Core
      'go','save','render','renderNav','generateWeeklyActions',
      'handlePOImport','mergePOData','getPOData',
      'mergeImportData','detectFileType',
      // Buy Box (renommés v3.1.x : bb* → buybox*)
      'calcBuyBoxAlerts','renderBuyBox','buyboxGetCase','buyboxOpenCase',
      // Smoke
      'smokeTest','renderSmokeResult',
      // YoY (v3.6.5)
      'renderYoY','yoyLaunchAnalysis',
      // ERP Parser (v3.6.6)
      'parseFileERP','downloadERPTemplate','handleERPImport','getStockERP',
      // VC Parser (v3.6.6.1)
      'parseVCFile','vcNorm','buildVCHeaderMap','detectVCFileType',
      // Smoke history (v3.6.6.1)
      'saveSmokeHistory',
    ];
    const missing = windowFns.filter(f => typeof window[f] !== 'function');

    // VC_COL_DICT est une var globale (object), pas une function
    if (typeof window.VC_COL_DICT !== 'object' || window.VC_COL_DICT === null)
      missing.push('VC_COL_DICT (object attendu)');
    if (!window.VC_COL_DICT || !window.VC_COL_DICT.asin || !window.VC_COL_DICT.ordered_revenue)
      missing.push('VC_COL_DICT.asin / VC_COL_DICT.ordered_revenue manquants');

    // SMOKE_REF_BY_CLIENT est une const (non dans window) — vérifier via eval
    try {
      const hasByClient = eval('typeof SMOKE_REF_BY_CLIENT') !== 'undefined'
                       && eval('typeof SMOKE_REF_BY_CLIENT') === 'object'
                       && eval('"cogex" in SMOKE_REF_BY_CLIENT');
      if (!hasByClient) missing.push('SMOKE_REF_BY_CLIENT (cogex entry manquant)');
    } catch(e) { missing.push('SMOKE_REF_BY_CLIENT (eval error: ' + e.message + ')'); }

    // cl est une const arrow function — non dans window, tester via eval
    try {
      const clType = eval('typeof cl');
      if (clType !== 'function') missing.push('cl (const arrow, type=' + clType + ')');
    } catch(e) { missing.push('cl (eval error: ' + e.message + ')'); }

    return missing;
  });

  if (missing.length) console.error('  Manquantes :', missing);
  else console.log('  Toutes les fonctions critiques presentes');
  expect(missing, 'Fonctions manquantes : ' + missing.join(', ')).toHaveLength(0);
});

// V2 — Navigation sans crash JS
test('V2 — Navigation tous ecrans sans crash JS', async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', e => { if (!e.message.includes('extension')) jsErrors.push(e.message); });
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const screens = ['dashboard','revue','buybox','import','appros','agentseo','asins','diagnostic','previsionnel','yoy'];
  for (const s of screens) {
    await page.evaluate((id) => { if (typeof go === 'function') go(id); }, s);
    await page.waitForTimeout(300);
    if (jsErrors.length) throw new Error('Crash sur "' + s + '" : ' + jsErrors.slice(-1)[0]);
    console.log('  OK', s);
  }
});

// V3 — Buy Box Phase 2 sans erreur asinData (regression v3.1.58)
test('V3 — Buy Box Phase 2 sans erreur asinData', async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', e => { if (!e.message.includes('extension')) jsErrors.push(e.message); });
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  // Injecter un client minimal pour tester le rendu sans données réelles
  await page.evaluate(() => {
    const fake = {
      id:'smoketest', name:'SMOKE TEST', asins:[{
        asin:'B009G3EMDI', title:'Test ASIN', revenue:1637, units:518,
        retailPct:'75 %', sellableUnits:104, history:[], openPOQty:0, confirmPct:'100 %'
      }],
      weeklyActions:[], bbCases:{}, threeP:false, btr:'Interdit', bbKnowledge:[]
    };
    localStorage.setItem('ap-data', JSON.stringify({ clients:{ smoketest:fake }, currentClientId:'smoketest' }));
    if (typeof render === 'function') render();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof go === 'function') go('buybox'); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    // cl est une const — accès direct dans le scope page
    const c = cl();
    if (typeof buyboxOpenCase === 'function' && c) buyboxOpenCase(c, 'B009G3EMDI');
  });
  await page.waitForTimeout(400);

  const asinErr = jsErrors.find(e => e.includes('asinData'));
  expect(asinErr, 'Bug asinData is not defined reapparu').toBeUndefined();
  const hasPlan = await page.evaluate(() => document.body.innerHTML.includes('Plan d'));
  expect(hasPlan, "Plan d'action non visible").toBe(true);
  console.log('  OK Buy Box Phase 2 sans crash');

  // Nettoyer
  await page.evaluate(() => localStorage.removeItem('ap-data'));
});

// V4 — SMOKE_REF valeurs et dates expiration
test('V4 — SMOKE_REF valeurs et dates expiration correctes', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  const ref = await page.evaluate(() => {
    if (typeof SMOKE_REF === 'undefined') return null;
    return {
      ca2024: SMOKE_REF.ca2024?.val,
      ca2024exp: SMOKE_REF.ca2024?.expiry,
      ca2025: SMOKE_REF.ca2025?.val,
      ca2025exp: SMOKE_REF.ca2025?.expiry,
      asinMin: SMOKE_REF.asinMin?.val,
      asinRef: SMOKE_REF.asinRef?.asin,
    };
  });
  expect(ref, 'SMOKE_REF non défini').not.toBeNull();
  expect(ref.ca2024).toBe(1547729);   // recalibré 2026-05-18
  expect(ref.ca2024exp).toBe('2026-12-31');
  expect(ref.ca2025).toBe(1166183);   // recalibré 2026-05-18
  expect(ref.ca2025exp).toBe('2027-12-31');
  expect(ref.asinMin).toBeGreaterThanOrEqual(1500);
  expect(ref.asinRef).toBe('B009G3EMDI');
  console.log('  OK SMOKE_REF CA2024=' + ref.ca2024 + ' CA2025=' + ref.ca2025);
});

// ─────────────────────────────────────────────────────────────────────────
// V5 — Parser ERP universel (v3.6.6)
// Helper : créer un File XLSX en mémoire depuis un tableau de tableaux
// ─────────────────────────────────────────────────────────────────────────

// V5a — Template + config (b) stock cumulé (Gers-like)
test('V5a — ERP parser : template + config (b) stock cumule', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    // Créer un XLSX en mémoire : config (b) stock cumulé, synonymes Gers
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['N°', 'EAN', 'Désignation', 'Code Vie', 'Stock Physique non réservé', 'Date prochain arrivage', 'Qt prochain arrivage'],
      [141431, '3367304009366', 'PRODUIT A', 'PERM', 60, '2026-08-03', 1368],
      [141432, '3367304009373', 'PRODUIT B', 'PERM', 0, '', 0],
      [141433, '3367304009380', 'PRODUIT C', 'NEG', 36, '2026-07-06', 1920],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Références avec prevs amazon');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'test_gers.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    return parseFileERP(file);
  });

  expect(result.ok, 'Parser config (b) doit retourner ok=true : ' + JSON.stringify(result.errors)).toBe(true);
  expect(result.config).toBe('cumulated');
  expect(result.rows.length).toBe(3);
  expect(result.rows[0].sku).toBe('141431');
  expect(result.rows[0].stock_disponible_amazon).toBe(60);
  expect(result.rows[1].stock_disponible_amazon).toBe(0);
  expect(result.rows[0].date_prochain_arrivage).toBe('2026-08-03');
  expect(result.warnings.length).toBe(0);
  console.log('  OK ERP config (b) — ' + result.rows.length + ' lignes, config=' + result.config);
});

// V5b — Config (a) stocks séparés
test('V5b — ERP parser : config (a) stocks separes', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['SKU', 'EAN', 'Designation', 'Code_Vie', 'Stock_libre', 'Stock_Amazon', 'Date_prochain_arrivage', 'Qte_prochain_arrivage'],
      ['REF-001', '1234567890123', 'Produit Test', 'PERM', 150, 50, '2026-09-01', 500],
      ['REF-002', '9876543210987', 'Produit Test 2', 'PERM-FIN', 0, 0, '', 0],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Stock_Amazon_Pilot');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'test_sep.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return parseFileERP(file);
  });

  expect(result.ok, 'Parser config (a) doit retourner ok=true').toBe(true);
  expect(result.config).toBe('separated');
  expect(result.rows.length).toBe(2);
  expect(result.rows[0].stock_libre).toBe(150);
  expect(result.rows[0].stock_amazon).toBe(50);
  expect(result.rows[0].stock_disponible_amazon).toBe(200);
  console.log('  OK ERP config (a) — stocks separes, total=' + result.rows[0].stock_disponible_amazon);
});

// V5c — Pas de colonne stock → erreur bloquante
test('V5c — ERP parser : absence colonne stock -> erreur bloquante', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['SKU', 'EAN', 'Designation', 'Code_Vie'],
      ['REF-001', '1234567890123', 'Produit Test', 'PERM'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Stock_Amazon_Pilot');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'test_nostock.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return parseFileERP(file);
  });

  expect(result.ok).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors[0]).toContain('Stock_libre');
  console.log('  OK ERP erreur attendue : ' + result.errors[0].substring(0, 60));
});

// V5d — Synonymes inhabituels mappés correctement
test('V5d — ERP parser : synonymes inhabituels', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    const wb = XLSX.utils.book_new();
    // Synonymes : "Code article" → SKU, "Dispo Amazon" → Stock_disponible_Amazon, "Code Vie" → Code_Vie
    const ws = XLSX.utils.aoa_to_sheet([
      ['Code article', 'Dispo Amazon', 'Code Vie', 'Qt prochain arrivage'],
      ['ART-001', 99, 'PERM', 200],
      ['ART-002', 0,  'FIN_VIE', 0],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'MonExport');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'test_syn.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return parseFileERP(file);
  });

  expect(result.ok, 'Parser synonymes doit retourner ok=true : ' + JSON.stringify(result.errors)).toBe(true);
  expect(result.rows.length).toBe(2);
  expect(result.rows[0].sku).toBe('ART-001');
  expect(result.rows[0].stock_disponible_amazon).toBe(99);
  expect(result.rows[0].qte_prochain_arrivage).toBe(200);
  console.log('  OK ERP synonymes — ' + result.rows.length + ' lignes mappées');
});

// V5e — Caractères pièges (NBSP   dans nombres)
test('V5e — ERP parser : caracteres pieges NBSP dans nombres', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    const wb = XLSX.utils.book_new();
    // Stock avec séparateur milliers espace insécable étroit ( )
    const ws = XLSX.utils.aoa_to_sheet([
      ['SKU', 'Stock_disponible_Amazon', 'Code_Vie'],
      ['REF-X', '1 234', 'PERM'],
      ['REF-Y', '56 789', 'PERM'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Stock_Amazon_Pilot');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'test_nbsp.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return parseFileERP(file);
  });

  expect(result.ok, 'Parser NBSP doit retourner ok=true : ' + JSON.stringify(result.errors)).toBe(true);
  expect(result.rows[0].stock_disponible_amazon).toBe(1234);
  expect(result.rows[1].stock_disponible_amazon).toBe(56789);
  console.log('  OK ERP NBSP strip — 1234 et 56789 parsés correctement');
});

// V5f — getStockERP retourne null pour clé inexistante
test('V5f — getStockERP retourne null pour cle inexistante', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    return getStockERP('client-inexistant', 'SKU-INEXISTANT');
  });

  expect(result).toBeNull();
  console.log('  OK getStockERP null pour cle inexistante');
});

// ─────────────────────────────────────────────────────────────────────────
// V5g — ERP parser : format Gers nouveau (feuille Extraction, colonnes Gers)
// v3.6.7.1 — SKU/Code Barre.../Stock dispo/Résa Amz/Dispo totale
// ─────────────────────────────────────────────────────────────────────────
test('V5g — ERP parser Gers nouveau format : feuille Extraction + colonnes Gers', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    // Reproduire exactement le format du fichier 202605_Dispo_Amazon_Mai_26.xlsx
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      // Header en ligne 0 (index 0) — pas de ligne metadata
      ['SKU', 'Code Barre / gencode / GTIN13', 'Désignation', 'Code vie', 'Code univers',
       'Stock dispo', 'Résa Amz', 'Dispo totale', 'Quantité prochain arrivage', 'Date prochain arrivage'],
      [140467, 3367301404676, 'EGOUTT PIN FIL MET PEINT 40X24', 'PERM', null,  538,  0, 538, 0,    null],
      [141393, 3367304008987, 'UST SPATUL RACLETTE X6 HET',      'PERM', null,    0,  0,   0, 0,    null],
      [141431, 3367304009366, 'CVLE ANTI GRAS INOX D16/18/20',   'PERM', null,    0, 60,  60, 1368, 46237],
      [141432, 3367304009373, 'CVLE ANTI GRAS INOX D22/24/26',   'PERM', null,    0, 324, 324, 1728, 46296],
      [141433, 3367304009380, 'CVLE ANTI GRAS INOX D28/30/32',   'PERM', null,  580,  36, 616, 1920, 46203],
    ]);
    // Feuille nommée "Extraction" (nom réel du fichier Gers)
    XLSX.utils.book_append_sheet(wb, ws, 'Extraction');
    const buf  = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], '202605_Dispo_Amazon_Mai_26.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return parseFileERP(file);
  });

  expect(result.ok,     'Parser format Gers doit retourner ok=true : ' + JSON.stringify(result.errors)).toBe(true);
  expect(result.config, 'Config doit etre cumulated (Dispo totale present)').toBe('cumulated');
  expect(result.rows.length, 'Doit charger 5 lignes').toBe(5);
  // SKU en nombre → converti en string
  expect(result.rows[0].sku,  'SKU ligne 1').toBe('140467');
  expect(result.rows[0].stock_disponible_amazon, 'Dispo totale ligne 1 = 538').toBe(538);
  expect(result.rows[2].sku,  'SKU ligne 3').toBe('141431');
  expect(result.rows[2].stock_disponible_amazon, 'Dispo totale ligne 3 = 60').toBe(60);
  // EAN mappé
  expect(result.rows[0].ean, 'EAN ligne 1').toBe('3367301404676');
  console.log('  OK V5g ERP Gers nouveau — ' + result.rows.length + ' lignes, config=' + result.config);
});

// ─────────────────────────────────────────────────────────────────────────
// V5h — ERP parser : header en ligne 1 (index 0) détecté correctement
// ─────────────────────────────────────────────────────────────────────────
test('V5h — ERP parser : header index 0 detecte (pas de ligne metadata)', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    const wb = XLSX.utils.book_new();
    // Header directement en ligne 0, pas de ligne vide ou metadata avant
    const ws = XLSX.utils.aoa_to_sheet([
      ['SKU', 'Stock dispo', 'Résa Amz', 'Dispo totale'],
      ['REF-001', 100, 20, 120],
      ['REF-002', 50,  10,  60],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Extraction');
    const buf  = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'test_header_idx0.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return parseFileERP(file);
  });

  expect(result.ok,            'Header index 0 doit etre detecte').toBe(true);
  expect(result.rows.length,   '2 lignes data attendues').toBe(2);
  expect(result.rows[0].sku,   'SKU ligne 1').toBe('REF-001');
  expect(result.rows[0].stock_disponible_amazon, 'Dispo totale = 120').toBe(120);
  console.log('  OK V5h — header index 0 detecte, ' + result.rows.length + ' lignes');
});

// ─────────────────────────────────────────────────────────────────────────
// V5i — ERP parser : mapping "Dispo totale" → stock_total (config cumulated)
// Vérifier que c'est la valeur de "Dispo totale" qui est utilisée, pas Stock dispo + Résa Amz
// ─────────────────────────────────────────────────────────────────────────
test('V5i — ERP parser : Dispo totale -> stock_disponible_amazon (config cumulated)', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    const wb = XLSX.utils.book_new();
    // Cas réel : Stock dispo=580, Résa Amz=36, Dispo totale=616 (≠ 580+36=616 ici, mais on vérifie la source)
    // Cas avec différence volontaire pour confirmer que c'est Dispo totale qui est utilisée
    const ws = XLSX.utils.aoa_to_sheet([
      ['SKU', 'Stock dispo', 'Résa Amz', 'Dispo totale'],
      ['141433', 580, 36, 999],  // Dispo totale = 999 ≠ 580+36=616 → doit retourner 999
      ['141434', 100,  0, 100],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Extraction');
    const buf  = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'test_dispo_totale.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return parseFileERP(file);
  });

  expect(result.ok,            '"Dispo totale" doit etre acceptee').toBe(true);
  expect(result.config,        'Config doit etre cumulated').toBe('cumulated');
  // Valeur issue de Dispo totale (999), PAS de Stock dispo + Résa Amz (616)
  expect(result.rows[0].stock_disponible_amazon, 'stock_disponible_amazon doit venir de Dispo totale (999)').toBe(999);
  console.log('  OK V5i — Dispo totale utilisee: stock=' + result.rows[0].stock_disponible_amazon + ' (config=' + result.config + ')');
});

// ─────────────────────────────────────────────────────────────────────────
// V5j — ERP parser régression : ancien format "Stock_disponible_Amazon" toujours OK
// ─────────────────────────────────────────────────────────────────────────
test('V5j — ERP parser regression : ancien format Stock_disponible_Amazon toujours OK', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    const wb = XLSX.utils.book_new();
    // Ancien format avec nom de colonne standard "Stock_disponible_Amazon"
    const ws = XLSX.utils.aoa_to_sheet([
      ['SKU', 'EAN', 'Designation', 'Code_Vie', 'Stock_disponible_Amazon', 'Date_prochain_arrivage'],
      ['REF-001', '3367304009366', 'PRODUIT A', 'PERM', 60, '2026-08-03'],
      ['REF-002', '3367304009373', 'PRODUIT B', 'PERM',  0, ''],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Stock_Amazon_Pilot');
    const buf  = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'test_ancien_format.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return parseFileERP(file);
  });

  expect(result.ok,             'Ancien format doit toujours fonctionner').toBe(true);
  expect(result.config,         'Ancien format config cumulated').toBe('cumulated');
  expect(result.rows.length,    '2 lignes attendues').toBe(2);
  expect(result.rows[0].sku,    'SKU').toBe('REF-001');
  expect(result.rows[0].stock_disponible_amazon, 'Stock ancien = 60').toBe(60);
  console.log('  OK V5j — ancien format OK, ' + result.rows.length + ' lignes, config=' + result.config);
});

// ─────────────────────────────────────────────────────────────────────────
// V6 — Parser VC multilingue (v3.6.6.1)
// CSV inline : ligne 0 vide (metadata absente) → heuristique headers
// ─────────────────────────────────────────────────────────────────────────

// V6a — parseVCFile EN ventes_fab : detect type, mapping, 3 ASINs
test('V6a — VC parser EN ventes_fab : type + champs corrects', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(() => {
    // Ligne 0 vide → metadata absente → heuristique langue par headers
    const csv = [
      '',
      'ASIN,Product title,Brand,Ordered revenue,Ordered units,Dispatched revenue,Dispatched units,Customer returns',
      'B012345678,"Product A","Brand X",12345.67,100,11000.00,90,5',
      'B098765432,"Product B","Brand X",6789.00,50,6000.00,45,2',
      'B0AABBCCDD,"Product C","Brand Y",500.00,10,450.00,9,0',
    ].join('\n');
    return parseVCFile(csv, 'test_ventes_fab.csv');
  });

  expect(result.ok, 'EN ventes_fab ok=true attendu : ' + JSON.stringify(result.errors)).toBe(true);
  expect(result.vcType).toBe('ventes_fab');
  expect(result.language).toBe('en');
  expect(result.isMultiCountry).toBe(false);
  expect(result.rows.length).toBe(3);
  const r0 = result.rows.find(r => r.asin === 'B012345678');
  expect(r0, 'ASIN B012345678 absent').toBeTruthy();
  expect(r0.ordered_revenue).toBeCloseTo(12345.67, 1);
  expect(r0.ordered_units).toBe(100);
  expect(r0.dispatched_revenue).toBeCloseTo(11000, 1);
  expect(r0.customer_returns).toBe(5);
  console.log('  OK V6a ventes_fab EN — ' + result.rows.length + ' ASINs, vcType=' + result.vcType);
});

// V6b — parseVCFile multi-pays aggregation : 2 marchés × 2 ASINs → 2 lignes sommées
test('V6b — VC parser multi-pays : agregation ordered_revenue + ordered_units', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(() => {
    // Store code column → isMultiCountry=true, aggregation active
    const csv = [
      'locale=[en_GB];countries=[FR;DE];distributor view=[Manufacturing View]',
      'ASIN,Product title,Brand,Store code,Ordered revenue,Ordered units',
      'B012345678,"Product A","Brand X",FR,1000.00,10',
      'B012345678,"Product A","Brand X",DE,2000.00,20',
      'B098765432,"Product B","Brand Y",FR,500.00,5',
      'B098765432,"Product B","Brand Y",DE,750.00,8',
    ].join('\n');
    return parseVCFile(csv, 'test_multi.csv');
  });

  expect(result.ok, 'multi-pays ok=true attendu : ' + JSON.stringify(result.errors)).toBe(true);
  expect(result.isMultiCountry).toBe(true);
  expect(result.aggregationApplied).toBe(true);
  expect(result.rows.length).toBe(2);   // 1 ligne / ASIN après agrégation
  const rA = result.rows.find(r => r.asin === 'B012345678');
  const rB = result.rows.find(r => r.asin === 'B098765432');
  expect(rA, 'B012345678 absent').toBeTruthy();
  expect(rA.ordered_revenue).toBeCloseTo(3000, 1);   // 1000 + 2000
  expect(rA.ordered_units).toBe(30);                  // 10 + 20
  expect(rB.ordered_revenue).toBeCloseTo(1250, 1);   // 500 + 750
  expect(rB.ordered_units).toBe(13);                  // 5 + 8
  console.log('  OK V6b multi-pays — ' + result.rows.length + ' ASINs agrégés, FR+DE sommés');
});

// V6c — parseVCFile type non reconnu → erreur bloquante (anti-parser silencieux)
test('V6c — VC parser type inconnu : erreur bloquante ok=false', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(() => {
    const csv = [
      '',
      'SKU,EAN,Designation,Code Vie',
      'REF-001,1234567890123,Produit Test,PERM',
      'REF-002,9876543210987,Produit Test 2,NEG',
    ].join('\n');
    return parseVCFile(csv, 'erp_export.csv');
  });

  expect(result.ok).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors[0].toLowerCase()).toMatch(/vendor central|format non reconnu/i);
  console.log('  OK V6c type inconnu bloqué : ' + result.errors[0].substring(0, 70));
});

// V6d — parseVCFile FR headers (accents natifs Amazon → vcNorm → match dict ASCII)
test('V6d — VC parser FR headers accentes : mapping correct', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(() => {
    // Headers FR avec accents natifs Amazon Vendor Central
    const csv = [
      "locale=[fr_FR];distributor view=[Vue de fabrication]",
      "ASIN,Nom du produit,Marque,Chiffre d’affaires basé sur les commandes,Unités commandées,Chiffre d’affaires basé sur les expéditions,Unités expédiées",
      'B012345678,"Produit A","Marque X",9999.99,80,8800.00,72',
      'B098765432,"Produit B","Marque Y",4321.00,35,4000.00,30',
    ].join('\n');
    return parseVCFile(csv, 'ventes_fr.csv');
  });

  expect(result.ok, 'FR headers ok=true attendu : ' + JSON.stringify(result.errors)).toBe(true);
  expect(result.vcType).toBe('ventes_fab');
  expect(result.language).toBe('fr');
  expect(result.rows.length).toBe(2);
  const r0 = result.rows.find(r => r.asin === 'B012345678');
  expect(r0, 'B012345678 absent').toBeTruthy();
  expect(r0.ordered_revenue).toBeCloseTo(9999.99, 1);
  expect(r0.ordered_units).toBe(80);
  console.log('  OK V6d FR headers — vcNorm accentués → match dict ASCII, vcType=' + result.vcType);
});

// V6e — detectVCFileType unit : trafic, ventes_fab, stock_fab, null
test('V6e — detectVCFileType : signature colonnes -> type correct', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const results = await page.evaluate(() => {
    return {
      trafic:      detectVCFileType(['ASIN','Product title','Featured offer page views','Ordered units']),
      ventes_fab:  detectVCFileType(['ASIN','Product title','Ordered revenue','Ordered units','Dispatched revenue']),
      ventes_app:  detectVCFileType(['ASIN','Product title','Dispatched revenue','Dispatched units']),
      stock_fab:   detectVCFileType(['ASIN','Sellable On Hand Inventory','Sellable On Hand Units','Sourceable product OOS %']),
      stock_app:   detectVCFileType(['ASIN','Sellable On Hand Inventory','Vendor confirmation %']),
      inconnu:     detectVCFileType(['SKU','EAN','Designation']),
    };
  });

  expect(results.trafic).toBe('trafic');
  expect(results.ventes_fab).toBe('ventes_fab');
  expect(results.ventes_app).toBe('ventes_approv');
  expect(results.stock_fab).toBe('stock_fab');
  expect(results.stock_app).toBe('stock_approv');
  expect(results.inconnu).toBeNull();
  console.log('  OK V6e detectVCFileType — 5 types + null correct');
});

// V6f — vcNorm : accents, apostrophes typo, espaces irréguliers
test('V6f — vcNorm : normalisation accents + apostrophes + espaces', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const results = await page.evaluate(() => {
    // apostrophe courbe \u2019, accents \u00e9/\u00e0, tiret cadatin \u2013, NBSP \u00a0
    return {
      accent:    vcNorm("Chiffre d\u2019affaires bas\u00e9 sur les commandes"),
      nbsp:      vcNorm("Vues de la page\u00a0"),
      tiret:     vcNorm("Sell\u2013through %"),
      majuscule: vcNorm("ORDERED REVENUE"),
      combined:  vcNorm("  Unit\u00e9s command\u00e9es  "),
    };
  });

  // \u2019 apostrophe courbe -> ASCII '  +  accents NFD supprim\u00e9s
  expect(results.accent).toBe("chiffre d'affaires base sur les commandes");
  // \u00a0 NBSP -> espace simple
  expect(results.nbsp).toBe('vues de la page');
  // \u2013 tiret cadratin -> -
  expect(results.tiret).toBe('sell-through %');
  expect(results.majuscule).toBe('ordered revenue');
  expect(results.combined).toBe('unites commandees');
  console.log('  OK V6f vcNorm -- accents/apostrophes/espaces normalises');
});

// V6g — parseVCFile EN stock_fab : sellable + OOS détectés
test('V6g — VC parser EN stock_fab : sellable_on_hand + sourceable_oos', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(() => {
    const csv = [
      '',
      'ASIN,Product title,Brand,Sellable On Hand Inventory,Sellable On Hand Units,Unsellable On Hand Units,Sourceable product OOS %,Unhealthy Inventory',
      'B012345678,"Product A","Brand X",25000.00,500,10,"12 %",3000.00',
      'B098765432,"Product B","Brand Y",0,0,5,"85 %",0',
      'B0AABBCCDD,"Product C","Brand Z",8500.00,120,2,"0 %",500.00',
    ].join('\n');
    return parseVCFile(csv, 'stock_fab.csv');
  });

  expect(result.ok, 'EN stock_fab ok=true : ' + JSON.stringify(result.errors)).toBe(true);
  expect(result.vcType).toBe('stock_fab');
  expect(result.rows.length).toBe(3);
  const r0 = result.rows.find(r => r.asin === 'B012345678');
  expect(r0.sellable_on_hand_inventory).toBeCloseTo(25000, 0);
  expect(r0.sellable_on_hand_units).toBe(500);
  expect(r0.unhealthy_inventory).toBeCloseTo(3000, 0);
  expect(r0.sourceable_oos_pct).toBe('12 %');  // ratio : premier marché
  console.log('  OK V6g stock_fab — vcType=stock_fab, sellable+OOS mappés');
});

// ─────────────────────────────────────────────────────────────────────────
// V7 — smoke_history : IDB v5 store présent + 1 mesure enregistrée
// Valide AJOUT 2 : collecte historique smoke par client
// ─────────────────────────────────────────────────────────────────────────
test('V7 — smoke_history : IDB v5 store + saveSmokeHistory ecrit une mesure', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    // ── Partie A : vérifier le store IDB v5 ────────────────────────────
    const storeCheck = await new Promise((resolve) => {
      const req = indexedDB.open('AmazonPilot', 5);
      req.onsuccess = () => {
        const db = req.result;
        resolve({
          dbVersion: db.version,
          hasStore: db.objectStoreNames.contains('smoke_history'),
          allStores: Array.from(db.objectStoreNames),
        });
      };
      req.onerror = () => resolve({ dbVersion: -1, hasStore: false, error: 'open failed' });
    });
    if (!storeCheck.hasStore) return { ...storeCheck, count: 0, writeOk: false };

    // ── Partie B : appel direct saveSmokeHistory (unit test) ───────────
    // Appel sans passer par smokeTest — teste uniquement la brique IDB
    if (typeof saveSmokeHistory !== 'function') {
      return { ...storeCheck, count: 0, writeOk: false, error: 'saveSmokeHistory undefined' };
    }
    await saveSmokeHistory('smoketest_v7', 'SMOKE TEST V7', {
      CA_2024: 0, CA_2025: 0, CA_semaine: 500, nb_asins: 1, nb_units: 5
    });
    await new Promise(r => setTimeout(r, 300));

    // ── Partie C : compter les entrées ────────────────────────────────
    const count = await new Promise((resolve) => {
      const req2 = indexedDB.open('AmazonPilot', 5);
      req2.onsuccess = () => {
        const db2 = req2.result;
        const tx = db2.transaction(['smoke_history'], 'readonly');
        const cr = tx.objectStore('smoke_history').count();
        cr.onsuccess = () => resolve(cr.result);
        cr.onerror   = () => resolve(-1);
      };
      req2.onerror = () => resolve(-1);
    });

    return { ...storeCheck, count, writeOk: count >= 1 };
  });

  expect(result.hasStore,  'Store smoke_history absent (IDB v5 migration échouée)').toBe(true);
  expect(result.dbVersion, 'IDB version attendue 5').toBe(5);
  expect(result.writeOk,   'saveSmokeHistory n\'a pas écrit de mesure (count=' + result.count + ')').toBe(true);
  console.log('  OK V7 smoke_history — IDB v' + result.dbVersion + ', stores=' + result.allStores.join(',') + ', count=' + result.count);
});

// ─────────────────────────────────────────────────────────────────────────
// V8a — Warning W1 : CA baisse > 20 %
// ─────────────────────────────────────────────────────────────────────────
test('V8a — Warning W1 declenche si CA -25%', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(() => {
    if (typeof calcYoYWarnings !== 'function') return { ok: false, error: 'calcYoYWarnings undefined' };
    const d = {
      dim1: { deltaCAPct: -25, caA: 75000, caRef: 100000, deltaCAAnnu: -25000 },
      dim7: { stables: [], enBaisse: [{ asin: 'B001TEST', titre: 'Test', caAPerDay: 100, caRefPerDay: 150, deltaPct: -33 }],
              enHausse: [], disparus: [], apparus: [] },
      dim9: { concA: { top10: 28 }, concRef: { top10: 25 } }
    };
    const warnings = calcYoYWarnings(d, {});
    const w1 = warnings.find(function(w){ return w.id === 'W1'; });
    return {
      ok: !!w1,
      level: w1 ? w1.level : null,
      nbWarnings: warnings.length,
      hasCta: w1 ? !!w1.ctaLabel : false
    };
  });

  expect(result.ok,      'W1 non declenche avec CA -25%').toBe(true);
  expect(result.level,   'W1 doit etre critique').toBe('critique');
  expect(result.hasCta,  'W1 doit avoir un ctaLabel').toBe(true);
  console.log('  OK V8a — W1 declenche, level=' + result.level + ', nb warnings=' + result.nbWarnings);
});

// ─────────────────────────────────────────────────────────────────────────
// V8b — Warning W2 : concentration Top10 +20 pts
// ─────────────────────────────────────────────────────────────────────────
test('V8b — Warning W2 declenche si concentration Top10 +20pts', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(() => {
    if (typeof calcYoYWarnings !== 'function') return { ok: false, error: 'calcYoYWarnings undefined' };
    const d = {
      dim1: { deltaCAPct: -5 },
      dim7: { stables: [{ asin: 'B002', caAPerDay: 500, caRefPerDay: 500 }],
              enBaisse: [], enHausse: [], disparus: [], apparus: [] },
      dim9: { concA: { top10: 50 }, concRef: { top10: 28 } }
    };
    const warnings = calcYoYWarnings(d, {});
    const w2 = warnings.find(function(w){ return w.id === 'W2'; });
    return {
      ok: !!w2,
      level: w2 ? w2.level : null,
      deltaPts: 50 - 28,
      noW1: !warnings.find(function(w){ return w.id === 'W1'; })
    };
  });

  expect(result.ok,    'W2 non declenche avec +22 pts concentration').toBe(true);
  expect(result.level, 'W2 doit etre attention').toBe('attention');
  expect(result.noW1,  'W1 ne doit pas se declencher avec -5%').toBe(true);
  console.log('  OK V8b — W2 declenche, delta=' + result.deltaPts + 'pts, level=' + result.level);
});

// ─────────────────────────────────────────────────────────────────────────
// V8c — Warning W3 : catalogue contracte > 30 %
// ─────────────────────────────────────────────────────────────────────────
test('V8c — Warning W3 declenche si catalogue -53%', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(() => {
    if (typeof calcYoYWarnings !== 'function') return { ok: false, error: 'calcYoYWarnings undefined' };
    // nbRef = 8 disparus + 5 stables + 2 enBaisse = 15 ; nbA = 0 apparus + 5 stables + 2 enBaisse = 7 → baisse 53%
    const mockDisparus = [{ asin: 'BD001', caAPerDay: 0, caRefPerDay: 80 }, { asin: 'BD002', caAPerDay: 0, caRefPerDay: 60 },
      { asin: 'BD003', caAPerDay: 0, caRefPerDay: 50 }, { asin: 'BD004', caAPerDay: 0, caRefPerDay: 40 },
      { asin: 'BD005', caAPerDay: 0, caRefPerDay: 35 }, { asin: 'BD006', caAPerDay: 0, caRefPerDay: 30 },
      { asin: 'BD007', caAPerDay: 0, caRefPerDay: 25 }, { asin: 'BD008', caAPerDay: 0, caRefPerDay: 20 }];
    const mockStables  = [{ asin: 'BS001', caAPerDay: 100, caRefPerDay: 100 }, { asin: 'BS002', caAPerDay: 90, caRefPerDay: 90 },
      { asin: 'BS003', caAPerDay: 80, caRefPerDay: 80 }, { asin: 'BS004', caAPerDay: 70, caRefPerDay: 70 },
      { asin: 'BS005', caAPerDay: 60, caRefPerDay: 60 }];
    const mockBaisse   = [{ asin: 'BB001', caAPerDay: 40, caRefPerDay: 80 }, { asin: 'BB002', caAPerDay: 30, caRefPerDay: 70 }];
    const d = {
      dim1: { deltaCAPct: -10 },
      dim7: { stables: mockStables, enBaisse: mockBaisse, enHausse: [], disparus: mockDisparus, apparus: [] },
      dim9: { concA: { top10: 30 }, concRef: { top10: 28 } }
    };
    const warnings = calcYoYWarnings(d, {});
    const w3 = warnings.find(function(w){ return w.id === 'W3'; });
    return {
      ok: !!w3,
      level: w3 ? w3.level : null,
      nbAsinIds: w3 ? w3.asinIds.length : 0
    };
  });

  expect(result.ok,      'W3 non declenche avec catalogue -53%').toBe(true);
  expect(result.level,   'W3 doit etre critique').toBe('critique');
  expect(result.nbAsinIds, 'W3 doit avoir 8 ASIN IDs').toBe(8);
  console.log('  OK V8c — W3 declenche, level=' + result.level + ', asinIds=' + result.nbAsinIds);
});

// ─────────────────────────────────────────────────────────────────────────
// V8d — Pavé éveil 80/20 : calcEveil8020 visible si erosion > seuil
// ─────────────────────────────────────────────────────────────────────────
test('V8d — calcEveil8020 retourne un resultat si erosion > 5000 EUR/mois', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(() => {
    if (typeof calcEveil8020 !== 'function') return { ok: false, error: 'calcEveil8020 undefined' };

    // 5 ASINs "top 80%" avec CA élevé (pas en érosion)
    // + 20 ASINs "longue traîne" chacun CA=500, revenueDelta=-30% → erosion = 500*30/100=150/sem*20=3000/sem*4.33=12990/mois > 5000
    const topAsins = Array.from({ length: 5 }, function(_, i) {
      return { asin: 'BTOP00' + i, orderedRevenue: 50000, revenueDelta: '5' };
    });
    const tailAsins = Array.from({ length: 20 }, function(_, i) {
      return { asin: 'BTAIL0' + i, orderedRevenue: 500, revenueDelta: '-30' };
    });
    const mockClient = { asins: topAsins.concat(tailAsins) };

    const data = calcEveil8020(mockClient);
    const blockHtml = typeof renderEveil8020Block === 'function' ? renderEveil8020Block(mockClient) : '';
    return {
      ok: data !== null,
      nbAsins: data ? data.nbAsins : 0,
      montant: data ? data.montant : 0,
      hasBlock: blockHtml.length > 50,            // HTML non vide (le mot contient un accent é)
      hasCtaBtn: blockHtml.includes('goToAsinsYoY')
    };
  });

  expect(result.ok,      'calcEveil8020 doit retourner un resultat avec 20 ASINs en erosion > 5000/mois').toBe(true);
  expect(result.nbAsins, 'doit trouver 20 ASINs en erosion').toBe(20);
  expect(result.hasBlock,'renderEveil8020Block doit produire du HTML').toBe(true);
  expect(result.hasCtaBtn,'renderEveil8020Block doit contenir goToAsinsYoY').toBe(true);
  console.log('  OK V8d — calcEveil8020: nbAsins=' + result.nbAsins + ', montant=' + result.montant + ' EUR/mois');
});

// ─────────────────────────────────────────────────────────────────────────
// V8e — CTA 11 : "Enqueter" depuis warning W1 → Analyse ASINs + badge filtre
// ─────────────────────────────────────────────────────────────────────────
test('V8e — CTA11 Warning W1 : goToAsinsYoY navigue vers Analyse ASINs', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    if (typeof goToAsinsYoY !== 'function')  return { ok: false, error: 'goToAsinsYoY undefined' };
    if (typeof asinViewLabel === 'undefined') return { ok: false, error: 'asinViewLabel undefined' };

    // Appel direct du CTA 11
    goToAsinsYoY(['B001TEST', 'B002TEST'], 'W1 — ASINs CA en baisse');
    await new Promise(function(r){ setTimeout(r, 200); });

    return {
      ok: true,
      screen: typeof screen !== 'undefined' ? screen : 'unknown',
      asinView: typeof asinView !== 'undefined' ? asinView : 'unknown',
      labelSet: typeof asinViewLabel !== 'undefined' ? asinViewLabel : '',
      customIdsLen: Array.isArray(asinViewCustomIds) ? asinViewCustomIds.length : -1
    };
  });

  expect(result.ok,           'goToAsinsYoY doit etre definie').toBe(true);
  expect(result.screen,       'screen doit etre asins apres CTA11').toBe('asins');
  expect(result.asinView,     'asinView doit etre yoy-warning').toBe('yoy-warning');
  expect(result.labelSet,     'asinViewLabel doit contenir W1').toContain('W1');
  expect(result.customIdsLen, 'asinViewCustomIds doit avoir 2 IDs').toBe(2);
  console.log('  OK V8e — CTA11: screen=' + result.screen + ', view=' + result.asinView + ', label=' + result.labelSet);
});

// ─────────────────────────────────────────────────────────────────────────
// V8f — CTA 12 : "Voir les ASINs en erosion" → Analyse ASINs + badge longue traine
// ─────────────────────────────────────────────────────────────────────────
test('V8f — CTA12 eveil 80/20 : goToAsinsYoY avec label longue traine', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const result = await page.evaluate(async () => {
    if (typeof goToAsinsYoY !== 'function') return { ok: false, error: 'goToAsinsYoY undefined' };

    // Simuler le clic du CTA 12 (pavé éveil 80/20)
    const mockAsinIds = Array.from({ length: 15 }, function(_, i){ return 'BTAIL' + String(i).padStart(3, '0'); });
    goToAsinsYoY(mockAsinIds, 'Longue traine en erosion');
    await new Promise(function(r){ setTimeout(r, 200); });

    return {
      ok: true,
      screen: typeof screen !== 'undefined' ? screen : 'unknown',
      asinView: typeof asinView !== 'undefined' ? asinView : 'unknown',
      labelSet: typeof asinViewLabel !== 'undefined' ? asinViewLabel : '',
      customIdsLen: Array.isArray(asinViewCustomIds) ? asinViewCustomIds.length : -1
    };
  });

  expect(result.ok,           'goToAsinsYoY doit etre definie').toBe(true);
  expect(result.screen,       'screen doit etre asins apres CTA12').toBe('asins');
  expect(result.asinView,     'asinView doit etre yoy-warning').toBe('yoy-warning');
  expect(result.labelSet,     'asinViewLabel doit contenir longue traine').toContain('traine');
  expect(result.customIdsLen, 'asinViewCustomIds doit avoir 15 IDs').toBe(15);
  console.log('  OK V8f — CTA12: screen=' + result.screen + ', label=' + result.labelSet + ', ids=' + result.customIdsLen);
});
