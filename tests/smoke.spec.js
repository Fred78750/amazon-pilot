// @ts-check
/**
 * Amazon Pilot — Smoke Test (Happy Path)
 * Exécuter avant chaque git push staging :
 *   npx playwright test tests/smoke.spec.js
 *
 * Prérequis : npx playwright install chromium
 */

const { test, expect } = require('@playwright/test');

const RECETTE_URL = 'https://d9xny9istvl53.cloudfront.net';
const TIMEOUT_NAV = 8000;   // 8s par écran
const TIMEOUT_FN  = 3000;   // 3s pour les fonctions JS

// Valeurs de référence figées
const SMOKE_REF = {
  ca2024: { val: 1703110, tol: 0.01, expiry: '2026-12-31' },
  ca2025: { val: 1297621, tol: 0.01, expiry: '2027-12-31' },
  asinMin: 1500,
  asinRef: { asin: 'B009G3EMDI', revMin: 1554, revMax: 1720 },
};

function refExpired(expiryStr) {
  return new Date(expiryStr) < new Date();
}

// ─── Helper : évaluer smokeTest() dans le navigateur ─────────────────────────
async function runAppSmokeTest(page) {
  // Attendre que l'app soit chargée
  await page.waitForFunction(() => typeof cl === 'function' && typeof smokeTest === 'function', { timeout: 10000 });
  // Exécuter le smoke test intégré (silent = true, pas de bandeau)
  const results = await page.evaluate(async () => {
    return await smokeTest(true);
  });
  return results;
}

// ════════════════════════════════════════════════════════════════
// TEST 1 — Chargement de l'app
// ════════════════════════════════════════════════════════════════
test('V0 — App charge et affiche la bonne version', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  // Version affichée
  const version = await page.textContent('.version, [class*="version"]').catch(() => null)
    || await page.evaluate(() => document.body.innerText.match(/v\d+\.\d+\.\d+/)?.[0]);
  console.log('Version détectée :', version);
  expect(version).toBeTruthy();
  expect(version).toMatch(/v3\.\d+\.\d+/);

  // Pas d'erreur critique au chargement
  const errorBanner = page.locator('.alr-r');
  const errorCount = await errorBanner.count();
  if (errorCount > 0) {
    const errorText = await errorBanner.first().textContent();
    expect(errorText).not.toContain('Erreur');
  }
});

// ════════════════════════════════════════════════════════════════
// TEST 2 — Smoke test intégré (délègue à smokeTest() de l'app)
// ════════════════════════════════════════════════════════════════
test('Smoke test intégré — tous les tests vitaux passent', async ({ page }) => {
  test.setTimeout(60000); // 60s pour parcourir tous les écrans

  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const results = await runAppSmokeTest(page);
  console.log('\n=== RÉSULTATS SMOKE TEST ===');
  console.log('Status :', results.summary.status);
  console.log('Vitaux  :', results.summary.vitalOk + '/' + results.summary.vitalTotal);
  console.log('Importants :', results.summary.importantOk + '/' + results.summary.importantTotal);

  // Afficher les échecs
  const allTests = [...(results.vital || []), ...(results.important || [])];
  allTests.filter(t => !t.ok).forEach(t => {
    console.log(`  ❌ ${t.id} ${t.label}${t.msg ? ' → ' + t.msg : ''}`);
  });
  allTests.filter(t => t.ok).forEach(t => {
    console.log(`  ✅ ${t.id} ${t.label}`);
  });

  // Critère de blocage : 0 test vital en échec
  expect(results.summary.vitalFails,
    `${results.summary.vitalFails} test(s) vital(aux) en échec — NE PAS LIVRER`
  ).toBe(0);

  // Warning sur les importants (non bloquant)
  if (results.summary.importantFails > 0) {
    console.warn(`\n⚠️  ${results.summary.importantFails} test(s) important(s) en échec — à corriger à la prochaine livraison`);
  }
});

// ════════════════════════════════════════════════════════════════
// TEST 3 — Navigation écrans principaux (Playwright natif)
// ════════════════════════════════════════════════════════════════
test('V2/V3/V4 — Écrans principaux accessibles sans erreur JS', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  // Collecter les erreurs JS
  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));

  const screens = [
    { id: 'dashboard', label: 'Tableau de bord' },
    { id: 'revue',     label: 'Revue Hebdo' },
    { id: 'buybox',    label: 'Buy Box' },
    { id: 'import',    label: 'Import données' },
    { id: 'appros',    label: 'Appros' },
  ];

  for (const s of screens) {
    await page.evaluate((screenId) => {
      if (typeof go === 'function') go(screenId);
    }, s.id);
    await page.waitForTimeout(500);

    // Vérifier absence d'erreur
    const errBanner = page.locator('.alr-r');
    const count = await errBanner.count();
    if (count > 0) {
      const txt = await errBanner.first().textContent();
      if (txt.includes('Erreur')) {
        throw new Error(`${s.label} : erreur affichée → "${txt.slice(0, 100)}"`);
      }
    }
    console.log(`  ✅ ${s.label}`);
  }

  // Aucune erreur JS collectée (hors erreurs d'extensions Chrome)
  const criticalErrors = jsErrors.filter(e =>
    !e.includes('extension') && !e.includes('chrome-extension')
  );
  if (criticalErrors.length > 0) {
    console.error('Erreurs JS détectées :', criticalErrors);
  }
  expect(criticalErrors.length, 'Erreurs JS critiques : ' + criticalErrors.join(' | ')).toBe(0);
});

// ════════════════════════════════════════════════════════════════
// TEST 4 — Buy Box Phase 2 (test du bug corrigé)
// ════════════════════════════════════════════════════════════════
test('V5 — Buy Box Phase 2 ouvre sans crash', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));

  // Naviguer vers Buy Box et ouvrir un dossier
  await page.evaluate(() => { if (typeof go === 'function') go('buybox'); });
  await page.waitForTimeout(500);

  // Cliquer sur le premier bouton "Ouvrir le dossier"
  const btn = page.locator('button', { hasText: 'Ouvrir le dossier' }).first();
  const btnCount = await btn.count();
  if (btnCount > 0) {
    await btn.click();
    await page.waitForTimeout(500);
    // Vérifier que "Plan d'action" est visible
    const planVisible = await page.evaluate(() =>
      document.body.innerHTML.includes('Plan d')
    );
    expect(planVisible, 'Plan d\'action non visible après ouverture du dossier').toBe(true);
  }

  // Aucune erreur "asinData is not defined"
  const asinDataError = jsErrors.find(e => e.includes('asinData'));
  expect(asinDataError, 'Bug asinData is not defined réapparu').toBeUndefined();
  console.log('  ✅ Buy Box Phase 2 ouvert sans crash');
});

// ════════════════════════════════════════════════════════════════
// TEST 5 — Cohérence des valeurs de référence
// ════════════════════════════════════════════════════════════════
test('V9 — Cohérence des valeurs de référence', async ({ page }) => {
  await page.goto(RECETTE_URL, { waitUntil: 'networkidle', timeout: 15000 });

  const data = await page.evaluate(() => {
    const c = typeof cl === 'function' ? cl() : null;
    return {
      asinCount: c?.asins?.length || 0,
      ca2024: Math.round(c?.annualData?.['2024']?.ventes?.totalCA || 0),
      ca2025: Math.round(c?.annualData?.['2025']?.ventes?.totalCA || 0),
      refAsinRev: Math.round(c?.asins?.find(a => a.asin === 'B009G3EMDI')?.revenue || 0),
    };
  });

  console.log('  ASINs :', data.asinCount, '(min', SMOKE_REF.asinMin + ')');
  console.log('  CA 2024 :', data.ca2024.toLocaleString('fr-FR'), 'EUR');
  console.log('  CA 2025 :', data.ca2025.toLocaleString('fr-FR'), 'EUR');
  console.log('  ASIN B009G3EMDI :', data.refAsinRev, 'EUR');

  // ASINs catalogue
  expect(data.asinCount, 'Catalogue ASINs < minimum').toBeGreaterThanOrEqual(SMOKE_REF.asinMin);

  // CA 2024 (si pas expiré et si importé)
  if (!refExpired(SMOKE_REF.ca2024.expiry) && data.ca2024 > 0) {
    const tol = SMOKE_REF.ca2024.val * SMOKE_REF.ca2024.tol;
    expect(data.ca2024, `CA 2024 dévié (attendu ~${SMOKE_REF.ca2024.val.toLocaleString()})`)
      .toBeGreaterThanOrEqual(SMOKE_REF.ca2024.val - tol);
    expect(data.ca2024).toBeLessThanOrEqual(SMOKE_REF.ca2024.val + tol);
  }

  // CA 2025 (si pas expiré et si importé)
  if (!refExpired(SMOKE_REF.ca2025.expiry) && data.ca2025 > 0) {
    const tol = SMOKE_REF.ca2025.val * SMOKE_REF.ca2025.tol;
    expect(data.ca2025, `CA 2025 dévié (attendu ~${SMOKE_REF.ca2025.val.toLocaleString()})`)
      .toBeGreaterThanOrEqual(SMOKE_REF.ca2025.val - tol);
    expect(data.ca2025).toBeLessThanOrEqual(SMOKE_REF.ca2025.val + tol);
  }

  // ASIN de référence (si des ventes cette semaine)
  if (data.refAsinRev > 0) {
    expect(data.refAsinRev, 'ASIN B009G3EMDI revenue hors tolérance')
      .toBeGreaterThanOrEqual(SMOKE_REF.asinRef.revMin);
    expect(data.refAsinRev).toBeLessThanOrEqual(SMOKE_REF.asinRef.revMax);
  }
});
