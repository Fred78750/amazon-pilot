// test_regen.js — Playwright smoke test — amazon-pilot (mise à jour v3.2.14)
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const file = 'file://' + path.resolve(__dirname, 'amazon-pilot-v3.2.16.html').replace(/\\/g, '/');
  console.log('Opening:', file);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

  await page.goto(file);

  // 1. No JS syntax errors on load
  if (errors.length) {
    console.log('❌ JS errors on load:');
    errors.forEach(e => console.log('   ', e));
  } else {
    console.log('✅ No JS errors on load');
  }

  // 2. APP_VERSION accessible
  const version = await page.evaluate(() => typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'UNDEFINED');
  console.log('✅ APP_VERSION =', version);

  // 3. seoLoading starts as false
  const seoLoadingInit = await page.evaluate(() => typeof seoLoading !== 'undefined' ? seoLoading : 'UNDEFINED');
  console.log(seoLoadingInit === false ? '✅' : '❌', 'seoLoading initial =', seoLoadingInit);

  // 4. runSEOFiche is a function
  const hasFn = await page.evaluate(() => typeof runSEOFiche === 'function');
  console.log(hasFn ? '✅' : '❌', 'runSEOFiche is', hasFn ? 'a function' : 'MISSING');

  // 5. seoResults is an object
  const hasSeoResults = await page.evaluate(() => typeof seoResults === 'object' && seoResults !== null);
  console.log(hasSeoResults ? '✅' : '❌', 'seoResults is an object');

  // 6. refreshSEODrawer is a function
  const hasRefresh = await page.evaluate(() => typeof refreshSEODrawer === 'function');
  console.log(hasRefresh ? '✅' : '❌', 'refreshSEODrawer is', hasRefresh ? 'a function' : 'MISSING');

  // 7. seoFetchDefinition / seoFetchFiche present
  const hasDef = await page.evaluate(() => typeof seoFetchDefinition === 'function');
  const hasFiche = await page.evaluate(() => typeof seoFetchFiche === 'function');
  console.log(hasDef ? '✅' : '❌', 'seoFetchDefinition is', hasDef ? 'a function' : 'MISSING');
  console.log(hasFiche ? '✅' : '❌', 'seoFetchFiche is', hasFiche ? 'a function' : 'MISSING');

  // 8. sleep helper present
  const hasSleep = await page.evaluate(() => typeof sleep === 'function');
  console.log(hasSleep ? '✅' : '❌', 'sleep is', hasSleep ? 'a function' : 'MISSING');

  // 9. Simulate runSEOFiche guard: no client → returns early, seoLoading stays false
  const seoLoadingAfterNoClient = await page.evaluate(async () => {
    // ensure no client loaded
    if (typeof clients !== 'undefined') clients.length = 0;
    if (typeof currentClient !== 'undefined') window._savedCC = currentClient;
    // call with dummy asin
    try { await runSEOFiche('B000TEST01', '.fr', 'test keyword'); } catch(e) {}
    return seoLoading;
  });
  console.log(seoLoadingAfterNoClient === false ? '✅' : '❌',
    'seoLoading after no-client call =', seoLoadingAfterNoClient, '(expected false)');

  // 10. isAIError present
  const hasIsAIError = await page.evaluate(() => typeof isAIError === 'function');
  console.log(hasIsAIError ? '✅' : '❌', 'isAIError is', hasIsAIError ? 'a function' : 'MISSING');

  // --- Test complémentaire : bouton Régénérer avec fiche existante ---
  console.log('\n--- Test bouton Régénérer avec fiche existante ---');

  // Injecter directement dans les globals JS (l'app utilise IndexedDB, pas localStorage simple)
  await page.evaluate(() => {
    clients = [{
      id: 'cogex', name: 'Cogex', markets: ['.fr'], mainMarket: '.fr',
      asins: [{ asin: 'B08TWY9RGH', title: 'RHINO Tenaille', brand: 'RHINO', revenue: 100, units: 10 }],
      ficheOptimisee: {
        'B08TWY9RGH': {
          '.fr': { titre: 'Titre test', bullets: ['b1','b2','b3','b4','b5'], backendKW: 'kw1 kw2' }
        }
      }
    }];
    activeId = 'cogex';
    screen = 'dashboard';
  });

  // Ouvrir drawer
  await page.evaluate(() => openSEODrawer('B08TWY9RGH'));
  await page.waitForTimeout(500);

  // Diagnostiquer l'état interne
  const state = await page.evaluate(() => {
    var sr = (typeof seoResults !== 'undefined' ? seoResults : {});
    var asinEntry = sr['B08TWY9RGH'] || {};
    var mkt = (typeof seoActiveTab !== 'undefined' ? seoActiveTab : null) || '.fr';
    var clientObj = (typeof cl === 'function' ? cl() : null);
    return {
      seoLoading:    typeof seoLoading !== 'undefined' ? seoLoading : 'UNDEFINED',
      seoActiveTab:  typeof seoActiveTab !== 'undefined' ? seoActiveTab : 'UNDEFINED',
      seoDrawerAsin: typeof seoDrawerAsin !== 'undefined' ? seoDrawerAsin : 'UNDEFINED',
      resKeys:       Object.keys(asinEntry),
      activeMkt:     mkt,
      r:             JSON.stringify(asinEntry[mkt] || null),
      clientLoaded:  clientObj ? clientObj.id : 'null'
    };
  });
  console.log('[STATE]', JSON.stringify(state, null, 2));

  // Chercher le bouton
  const btns = await page.$$eval('button', bs =>
    bs.map(b => b.textContent.trim()).filter(t => t.includes('génér') || t.includes('Génér') || t.includes('Régén'))
  );
  console.log('[BUTTONS FOUND]', btns);

  // --- Test avec données réelles IndexedDB — ASIN B008CPD2SM ---
  console.log('\n--- Test B008CPD2SM (données réelles) ---');

  await page.goto(file);
  await page.waitForTimeout(2000);

  await page.evaluate(() => openSEODrawer('B008CPD2SM'));
  await page.waitForTimeout(500);

  const stateReal = await page.evaluate(() => {
    var res = (typeof seoResults !== 'undefined' ? seoResults['B008CPD2SM'] : null) || {};
    var activeMkt = (typeof seoActiveTab !== 'undefined' ? seoActiveTab : null)
      || (typeof cl === 'function' && cl() ? cl().mainMarket : null)
      || '.fr';
    var r = res[activeMkt];
    return {
      seoLoading:  typeof seoLoading !== 'undefined' ? seoLoading : 'UNDEFINED',
      activeMkt:   activeMkt,
      resKeys:     Object.keys(res),
      rError:      r ? r.error : undefined,
      rHasTitre:   !!(r && r.titre),
      rRaw:        JSON.stringify(r) ? JSON.stringify(r).slice(0, 200) : null
    };
  });
  console.log('[B008CPD2SM STATE]', JSON.stringify(stateReal, null, 2));

  const btnsReal = await page.$$eval('button', bs =>
    bs.map(b => b.textContent.trim()).filter(t => t.includes('énér'))
  );
  console.log('[BUTTONS]', btnsReal);

  // --- Test anti-régression mergeImportData (c is not defined — v3.2.14) ---
  console.log('\n--- Test mergeImportData : pas de ReferenceError sur c ---');

  const mergeErrors = [];
  page.on('pageerror', err => mergeErrors.push(err.message));

  const mergeResult = await page.evaluate(() => {
    // Injecter un client minimal avec un ASIN
    clients = [{
      id: 'test', name: 'Test', markets: ['.fr'], mainMarket: '.fr',
      asins: [{
        asin: 'B000TEST01', title: 'Produit Test', brand: 'TestBrand',
        revenue: 500, units: 10,
        orderedRevenue: 500, orderedUnits: 10,
        shippedRevenue: 480, shippedUnits: 9,
        glanceViews: 200, sellableUnits: 50,
        history: [], historyMonthly: []
      }],
      imports: [],
      ficheOptimisee: {}
    }];
    activeId = 'test';

    // Simuler le tableau parsedFiles tel que retourné par parseCSVFile
    // Structure : [{ type, market, distributorView, periodStart, periodEnd, periodType, data: [...asins] }]
    const parsedFiles = [{
      type: 'ventes',
      market: '.fr',
      distributorView: 'fab',
      periodStart: '2026-04-28',
      periodEnd: '2026-05-04',
      periodType: 'weekly',
      filename: 'test.csv',
      rowCount: 1,
      data: [{
        asin: 'B000TEST01',
        revenue: 500, units: 10,
        orderedRevenue: 500, orderedUnits: 10,
        shippedRevenue: 480, shippedUnits: 9,
        glanceViews: 200, sellableUnits: 50,
        revenueDelta: '5', unitsDelta: '3',
        periodStart: '2026-04-28', periodEnd: '2026-05-04',
        distributorView: 'fab', market: '.fr'
      }]
    }];

    var caught = null;
    try {
      var c = cl();
      mergeImportData(c, parsedFiles);
    } catch(e) {
      caught = e.message;
    }
    return { error: caught, historyMonthlyLen: cl()?.asins[0]?.historyMonthly?.length ?? -1 };
  });

  if (mergeResult.error) {
    console.log('❌ mergeImportData threw:', mergeResult.error);
  } else {
    console.log('✅ mergeImportData OK — pas de ReferenceError');
    console.log('   historyMonthly.length =', mergeResult.historyMonthlyLen);
  }
  if (mergeErrors.length) {
    console.log('❌ Page errors:', mergeErrors);
  }

  // --- Test structurel getRevenue/getUnits sourcingOnly (v3.2.16) ---
  console.log('\n--- Test getRevenue/getUnits sourcingOnly ---');

  const sourcing = await page.evaluate(() => {
    // ASIN FAB normal
    const fab = {
      asin: 'B000FAB001', sourcingOnly: false,
      orderedRevenue: 21339, orderedUnits: 85,
      shippedRevenue: 20800, shippedUnits: 83,
      revenue: 21339, units: 85
    };
    // ASIN Appro-only (sourcingOnly)
    const appro = {
      asin: 'B000APPRO01', sourcingOnly: true,
      orderedRevenue: 0, orderedUnits: 0,
      shippedRevenue: 4000, shippedUnits: 20,
      revenue: 4000, units: 20
    };
    const cOrdered  = { kpiPrimaireCA: 'ordered' };
    const cShipped  = { kpiPrimaireCA: 'shipped' };

    const r1 = getRevenue(appro, cOrdered);   // doit être 0
    const r2 = getRevenue(appro, cShipped);   // doit être 4000
    const r3 = getUnits(appro,   cOrdered);   // doit être 0
    const r4 = getUnits(appro,   cShipped);   // doit être 20
    const r5 = getRevenue(fab,   cOrdered);   // doit être 21339
    const r6 = getRevenue(fab,   cShipped);   // doit être 20800

    // CA total Ordered = FAB uniquement
    const asins = [fab, appro];
    const totalOrdered = asins.reduce((s, a) => s + (getRevenue(a, cOrdered) || 0), 0);

    return { r1, r2, r3, r4, r5, r6, totalOrdered };
  });

  const checks = [
    [sourcing.r1 === 0,     `getRevenue(appro, ordered) = ${sourcing.r1} (attendu 0)`],
    [sourcing.r2 === 4000,  `getRevenue(appro, shipped) = ${sourcing.r2} (attendu 4000)`],
    [sourcing.r3 === 0,     `getUnits(appro, ordered)   = ${sourcing.r3} (attendu 0)`],
    [sourcing.r4 === 20,    `getUnits(appro, shipped)   = ${sourcing.r4} (attendu 20)`],
    [sourcing.r5 === 21339, `getRevenue(fab, ordered)   = ${sourcing.r5} (attendu 21339)`],
    [sourcing.r6 === 20800, `getRevenue(fab, shipped)   = ${sourcing.r6} (attendu 20800)`],
    [sourcing.totalOrdered === 21339, `CA total Ordered (FAB only) = ${sourcing.totalOrdered} (attendu 21339)`],
  ];
  checks.forEach(([ok, label]) => console.log(ok ? '✅' : '❌', label));

  await browser.close();

  console.log('\n--- Errors captured:', errors.length, '---');
  if (errors.length) errors.forEach(e => console.log(' ', e));
})();
