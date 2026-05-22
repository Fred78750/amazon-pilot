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
    ];
    const missing = windowFns.filter(f => typeof window[f] !== 'function');

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
