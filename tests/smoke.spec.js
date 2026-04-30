// @ts-check
/**
 * Amazon Pilot — Smoke Test Playwright (Happy Path)
 *
 * PÉRIMÈTRE : tests sans données (navigateur headless vierge, pas de localStorage)
 * Les tests avec données réelles (CA 2024/2025, ASINs, cohérence chiffres)
 * sont dans le smoke test intégré de l'app : Config > Smoke Test > Lancer
 *
 * Exécuter avant chaque git push staging :
 *   npx playwright test tests/smoke.spec.js
 *
 * Prérequis (une seule fois) :
 *   npm install --save-dev @playwright/test
 *   npx playwright install chromium
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
test('V0b — Titre onglet dynamique (non figé a v3.1.27)', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.evaluate(() => { if (typeof renderNav === 'function') renderNav(); });
  await page.waitForTimeout(300);
  const title = await page.title();
  console.log('  Titre :', title);
  expect(title, 'Titre toujours fige a v3.1.27').not.toContain('v3.1.27');
  expect(title, 'Version absente du titre').toMatch(/v\d+\.\d+\.\d+/);
});

// V1 — Fonctions critiques présentes
test('V1 — Toutes les fonctions critiques sont presentes', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });
  const missing = await page.evaluate(() => {
    const fns = [
      'cl','go','save','render','renderNav',
      'calcBuyBoxAlerts','renderBBPlan','bbGetCase','bbOpenCase',
      'analyseBuyBoxLive','generateWeeklyActions',
      'handlePOImport','mergePOData','getPOData',
      'smokeTest','renderSmokeResult','downloadGuideASN',
      'mergeImportData','detectFileType',
    ];
    return fns.filter(f => typeof window[f] !== 'function');
  });
  if (missing.length) console.error('  Manquantes :', missing);
  else console.log('  Toutes les fonctions presentes');
  expect(missing, 'Fonctions manquantes : ' + missing.join(', ')).toHaveLength(0);
});

// V2 — Navigation sans crash (sans données)
test('V2 — Navigation tous ecrans sans crash JS', async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', e => { if (!e.message.includes('extension')) jsErrors.push(e.message); });
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const screens = ['dashboard','revue','buybox','import','appros','agentseo','asins','diagnostic','previsionnel'];
  for (const s of screens) {
    await page.evaluate((id) => { if (typeof go === 'function') go(id); }, s);
    await page.waitForTimeout(300);
    if (jsErrors.length) throw new Error('Crash sur "' + s + '" : ' + jsErrors.slice(-1)[0]);
    console.log('  OK', s);
  }
});

// V3 — Buy Box Phase 2 sans erreur asinData (bug corrige en v3.1.58)
test('V3 — Buy Box Phase 2 sans erreur asinData', async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', e => { if (!e.message.includes('extension')) jsErrors.push(e.message); });
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  // Injecter un client minimal pour tester le rendu
  await page.evaluate(() => {
    const fake = {
      id:'test', name:'TEST', asins:[{
        asin:'B009G3EMDI', title:'Test', revenue:1637, units:518,
        retailPct:'75 %', sellableUnits:104, history:[], openPOQty:0, confirmPct:'100 %'
      }],
      weeklyActions:[], bbCases:{}, threeP:false, btr:'Interdit', bbKnowledge:[]
    };
    localStorage.setItem('ap-data', JSON.stringify({ clients:{ test:fake }, currentClientId:'test' }));
    if (typeof render === 'function') render();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof go === 'function') go('buybox'); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const c = typeof cl === 'function' ? cl() : null;
    if (typeof bbOpenCase === 'function' && c) bbOpenCase(c, 'B009G3EMDI');
  });
  await page.waitForTimeout(400);

  const asinErr = jsErrors.find(e => e.includes('asinData'));
  expect(asinErr, 'Bug asinData is not defined reapparu').toBeUndefined();
  const hasPlan = await page.evaluate(() => document.body.innerHTML.includes('Plan d'));
  expect(hasPlan, 'Plan d action non visible').toBe(true);
  console.log('  OK Buy Box Phase 2');

  await page.evaluate(() => localStorage.removeItem('ap-data'));
});

// V4 — SMOKE_REF correctement défini avec les bonnes valeurs et dates d'expiration
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
  expect(ref, 'SMOKE_REF non defini').not.toBeNull();
  expect(ref.ca2024).toBe(1703110);
  expect(ref.ca2024exp).toBe('2026-12-31');
  expect(ref.ca2025).toBe(1297621);
  expect(ref.ca2025exp).toBe('2027-12-31');
  expect(ref.asinMin).toBeGreaterThanOrEqual(1500);
  expect(ref.asinRef).toBe('B009G3EMDI');
  console.log('  OK SMOKE_REF : CA2024=' + ref.ca2024 + ' CA2025=' + ref.ca2025);
});
