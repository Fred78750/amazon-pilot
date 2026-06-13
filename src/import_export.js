// Amazon Pilot — src/import_export.js
// Injecté via // @import_export dans core.js (build.py)
// v3.7.4 — déplacement strict depuis core.js (aucune modification fonctionnelle)

function mergeImportData(client, parsedFiles) {
  if (!client.annualData) client.annualData = {};
  if (!client.ytdData) client.ytdData = {};

  const asinMap = new Map();
  // Clé composite asin|market pour supporter le multi-marchés (Gers Équipement)
  for (const a of client.asins) asinMap.set(a.asin + '|' + (a.market || '.fr'), { ...a, history: a.history || [] });
  let periodType = 'weekly', periodLabel = '';
  let totalCA = 0, totalUnits = 0, totalGV = 0;

  // Set des marques fabricant — calculé UNE FOIS avant la boucle
  const clientFabBrands = new Set(
    (client.brands || [])
      .filter(b => b.role === 'fabricant')
      .map(b => norm(b.name))
  );

  for (const file of parsedFiles) {
    if (!file || file.error) continue;
    periodType = file.periodType || 'weekly';
    periodLabel = file.periodEnd || new Date().toISOString().slice(0, 10);

    // ── Routing selon le type de période ──────────────────────
    if (periodType === 'annual') {
      const year = file.periodEnd ? file.periodEnd.split('/')[2] : new Date().getFullYear().toString();
      if (!client.annualData[year]) client.annualData[year] = {};
      const fileDistViewAnn = file.distributorView || 'fab';
      // Fusion Fab/Appro pour les données annuelles
      if (fileDistViewAnn === 'appro' && file.type === 'ventes') {
        // Appro annuel : additionner les ASINs fabricant absents de la vue Fab
        const existingFab = client.annualData[year]['ventes'];
        if (!existingFab) { client.imports.push({ date: new Date().toISOString(), type: file.type, distributorView: 'appro', market: file.market, periodStart: file.periodStart, periodEnd: file.periodEnd, periodType: 'annual', year, filename: file.filename, rowCount: file.rowCount }); continue; }
        // Si re-import Appro sur slot déjà fusionné : repartir de la base Fab pure
        const fabBaseCA    = existingFab.fabOnlyCA    != null ? existingFab.fabOnlyCA    : existingFab.totalCA;
        const fabBaseUnits = existingFab.fabOnlyUnits != null ? existingFab.fabOnlyUnits : existingFab.totalUnits;
        // Purger les ASINs sourcingOnly précédents avant de re-merger
        for (const asin of Object.keys(existingFab.asins || {})) {
          if (existingFab.asins[asin].sourcingOnly) delete existingFab.asins[asin];
        }
        const fabASINs = existingFab.asins || {};
        let approExtra = 0, approExtraUnits = 0, approCount = 0;
        for (const row of file.data) {
          if (!row.asin) continue;
          const brand = norm(row.brand || '');
          const isFab = clientFabBrands.size === 0 || clientFabBrands.has(brand);
          if (!fabASINs[row.asin] && isFab) {
            // ASIN absent de Fab mais marque fabricant → à additionner
            existingFab.asins[row.asin] = { ...row, sourcingOnly: true };
            approExtra += row.revenue || 0;
            approExtraUnits += row.units || 0;
            approCount++;
          }
        }
        if (existingFab && approExtra > 0) {
          existingFab.fabOnlyCA    = fabBaseCA;
          existingFab.fabOnlyUnits = fabBaseUnits;
          existingFab.totalCA      = fabBaseCA + approExtra;
          existingFab.approOnlyCA  = approExtra;
          existingFab.approOnlyUnits = approExtraUnits;
          existingFab.approOnlyCount = approCount;
          existingFab.totalUnits   = fabBaseUnits + approExtraUnits;
          existingFab.asinCount += approCount;
          existingFab.hasApproData = true;
          log(`✓ Données annuelles ${year} Appro fusionnées: +${approCount} ASINs, +${approExtra.toFixed(0)}€`, 'ok');
        }
        client.imports.push({ date: new Date().toISOString(), type: file.type, distributorView: 'appro', market: file.market, periodStart: file.periodStart, periodEnd: file.periodEnd, periodType: 'annual', year, filename: file.filename, rowCount: file.rowCount });
        continue;
      }
      // Stock Appro : mettre à jour le stock existant avec les ASINs supplémentaires
      if (fileDistViewAnn === 'appro' && file.type === 'stock') {
        const existingStockFab = client.annualData[year]['stock'];
        if (existingStockFab) {
          // Purger les ASINs sourcingOnly précédents avant re-merge
          for (const asin of Object.keys(existingStockFab.asins || {})) {
            if (existingStockFab.asins[asin].sourcingOnly) delete existingStockFab.asins[asin];
          }
          const fabStockBaseCount = Object.keys(existingStockFab.asins).length;
          let stockApproCount = 0;
          for (const row of file.data) {
            if (!row.asin) continue;
            const brand = norm(row.brand || '');
            const isFab = clientFabBrands.size === 0 || clientFabBrands.has(brand);
            if (!existingStockFab.asins[row.asin] && isFab) {
              existingStockFab.asins[row.asin] = { ...row, sourcingOnly: true };
              stockApproCount++;
            }
          }
          if (stockApproCount > 0) {
            existingStockFab.asinCount = fabStockBaseCount + stockApproCount;
            existingStockFab.hasApproData = true;
            log(`✓ Stock annuel ${year} Appro fusionné: +${stockApproCount} ASINs`, 'ok');
          }
        }
        client.imports.push({ date: new Date().toISOString(), type: file.type, distributorView: 'appro', market: file.market, periodStart: file.periodStart, periodEnd: file.periodEnd, periodType: 'annual', year, filename: file.filename, rowCount: file.rowCount });
        continue;
      }

      // Fab (ou premier import) : créer/écraser la base
      const annualASINs = {};
      let annualCA = 0, annualGV = 0, annualUnits = 0;
      for (const row of file.data) {
        if (!row.asin) continue;
        annualASINs[row.asin] = { ...row };
        if (file.type === 'ventes') { annualCA += row.revenue || 0; annualUnits += row.units || 0; }
        if (file.type === 'trafic') annualGV += row.glanceViews || 0;
      }
      client.annualData[year][file.type] = {
        periodStart: file.periodStart, periodEnd: file.periodEnd,
        totalCA: file.type === 'ventes' ? annualCA : 0,
        fabOnlyCA: file.type === 'ventes' ? annualCA : 0,
        totalUnits: file.type === 'ventes' ? annualUnits : 0,
        fabOnlyUnits: file.type === 'ventes' ? annualUnits : 0,
        totalGV: file.type === 'trafic' ? annualGV : 0,
        asinCount: file.data.length,
        fabOnlyCount: file.data.length,
        asins: annualASINs,
        distributorView: fileDistViewAnn,
        importedAt: new Date().toISOString()
      };
      log(`✓ Données annuelles ${year} (${file.type}) vue=${fileDistViewAnn}: ${file.data.length} ASINs`, 'ok');
      client.imports.push({ date: new Date().toISOString(), type: file.type, distributorView: fileDistViewAnn, market: file.market, periodStart: file.periodStart, periodEnd: file.periodEnd, periodType: 'annual', year, filename: file.filename, rowCount: file.rowCount });
      continue;
    }

    if (periodType === 'ytd') {
      const fileDistViewYtd = file.distributorView || 'fab';
      // Fusion Fab/Appro pour YTD
      if (fileDistViewYtd === 'appro' && file.type === 'ventes') {
        const existingYtdFab = client.ytdData['ventes'];
        if (!existingYtdFab) { client.imports.push({ date: new Date().toISOString(), type: file.type, distributorView: 'appro', market: file.market, periodStart: file.periodStart, periodEnd: file.periodEnd, periodType: 'ytd', filename: file.filename, rowCount: file.rowCount }); continue; }
        // Si re-import Appro sur slot déjà fusionné : repartir de la base Fab pure
        const fabYtdBaseCA    = existingYtdFab.fabOnlyCA    != null ? existingYtdFab.fabOnlyCA    : existingYtdFab.totalCA;
        const fabYtdBaseUnits = existingYtdFab.fabOnlyUnits != null ? existingYtdFab.fabOnlyUnits : existingYtdFab.totalUnits;
        // Purger les ASINs sourcingOnly précédents avant de re-merger
        for (const asin of Object.keys(existingYtdFab.asins || {})) {
          if (existingYtdFab.asins[asin].sourcingOnly) delete existingYtdFab.asins[asin];
        }
        const fabYtdASINs = existingYtdFab.asins || {};
        let approYtdExtra = 0, approYtdUnits = 0, approYtdCount = 0;
        for (const row of file.data) {
          if (!row.asin) continue;
          const brand = norm(row.brand || '');
          const isFab = clientFabBrands.size === 0 || clientFabBrands.has(brand);
          if (!fabYtdASINs[row.asin] && isFab) {
            existingYtdFab.asins[row.asin] = { ...row, sourcingOnly: true };
            approYtdExtra += row.revenue || 0;
            approYtdUnits += row.units || 0;
            approYtdCount++;
          }
        }
        if (existingYtdFab && approYtdExtra > 0) {
          existingYtdFab.fabOnlyCA    = fabYtdBaseCA;
          existingYtdFab.fabOnlyUnits = fabYtdBaseUnits;
          existingYtdFab.totalCA      = fabYtdBaseCA + approYtdExtra;
          existingYtdFab.approOnlyCA  = approYtdExtra;
          existingYtdFab.approOnlyUnits = approYtdUnits;
          existingYtdFab.approOnlyCount = approYtdCount;
          existingYtdFab.totalUnits   = fabYtdBaseUnits + approYtdUnits;
          existingYtdFab.asinCount += approYtdCount;
          existingYtdFab.hasApproData = true;
          log(`✓ Données YTD Appro fusionnées: +${approYtdCount} ASINs, +${approYtdExtra.toFixed(0)}€`, 'ok');
        }
        client.imports.push({ date: new Date().toISOString(), type: file.type, distributorView: 'appro', market: file.market, periodStart: file.periodStart, periodEnd: file.periodEnd, periodType: 'ytd', filename: file.filename, rowCount: file.rowCount });
        continue;
      }
      // Stock Appro YTD
      if (fileDistViewYtd === 'appro' && file.type === 'stock') {
        const existingYtdStock = client.ytdData['stock'];
        if (existingYtdStock) {
          // Purger les ASINs sourcingOnly précédents avant re-merge
          for (const asin of Object.keys(existingYtdStock.asins || {})) {
            if (existingYtdStock.asins[asin].sourcingOnly) delete existingYtdStock.asins[asin];
          }
          const fabYtdStockBaseCount = Object.keys(existingYtdStock.asins).length;
          let ytdStockCount = 0;
          for (const row of file.data) {
            if (!row.asin) continue;
            const brand = norm(row.brand || '');
            const isFab = clientFabBrands.size === 0 || clientFabBrands.has(brand);
            if (!existingYtdStock.asins[row.asin] && isFab) {
              existingYtdStock.asins[row.asin] = { ...row, sourcingOnly: true };
              ytdStockCount++;
            }
          }
          if (ytdStockCount > 0) {
            existingYtdStock.asinCount += ytdStockCount;
            existingYtdStock.hasApproData = true;
            log(`✓ Stock YTD Appro fusionné: +${ytdStockCount} ASINs`, 'ok');
          }
        }
        client.imports.push({ date: new Date().toISOString(), type: file.type, distributorView: 'appro', market: file.market, periodStart: file.periodStart, periodEnd: file.periodEnd, periodType: 'ytd', filename: file.filename, rowCount: file.rowCount });
        continue;
      }

      // Fab : créer/écraser la base YTD
      const ytdASINs = {};
      let ytdCA = 0, ytdGV = 0, ytdUnits = 0;
      for (const row of file.data) {
        if (!row.asin) continue;
        ytdASINs[row.asin] = { ...row };
        if (file.type === 'ventes') { ytdCA += row.revenue || 0; ytdUnits += row.units || 0; }
        if (file.type === 'trafic') ytdGV += row.glanceViews || 0;
      }
      client.ytdData[file.type] = {
        periodStart: file.periodStart, periodEnd: file.periodEnd,
        totalCA: file.type === 'ventes' ? ytdCA : 0,
        fabOnlyCA: file.type === 'ventes' ? ytdCA : 0,
        totalUnits: file.type === 'ventes' ? ytdUnits : 0,
        fabOnlyUnits: file.type === 'ventes' ? ytdUnits : 0,
        totalGV: file.type === 'trafic' ? ytdGV : 0,
        asinCount: file.data.length,
        fabOnlyCount: file.data.length,
        asins: ytdASINs,
        distributorView: fileDistViewYtd,
        importedAt: new Date().toISOString()
      };
      log(`✓ Données YTD (${file.type}) vue=${fileDistViewYtd}: ${file.data.length} ASINs — ${file.periodStart} → ${file.periodEnd}`, 'ok');
      client.imports.push({ date: new Date().toISOString(), type: file.type, distributorView: fileDistViewYtd, market: file.market, periodStart: file.periodStart, periodEnd: file.periodEnd, periodType: 'ytd', filename: file.filename, rowCount: file.rowCount });
      continue;
    }

    // ── Hebdo / mensuel : archivage enrichi (avec support multi-semaines) ──
    // Calculer le nb de semaines couvertes par ce fichier
    let weeksCovered = 1;
    if (file.periodStart && file.periodEnd) {
      const pd = s => { const [d,m,y] = s.split('/').map(Number); return new Date(y,m-1,d); };
      const spanDays = Math.round((pd(file.periodEnd) - pd(file.periodStart)) / 86400000);
      weeksCovered = Math.max(1, Math.round(spanDays / 7));
    }
    const isMultiWeek = weeksCovered > 1;

    // Reset des champs du marché concerné avant chaque import
    // Évite les données "fantômes" des ASINs absents du nouveau CSV
    const fileMarket = file.market || '.fr';
    const fileDistView = file.distributorView || 'fab';
    // Reset uniquement pour la vue Fabrication (vue principale)
    // La vue Approvisionnement fusionne sans reset : elle complète, ne remplace pas
    if (fileDistView !== 'appro') {
      if (file.type === 'ventes') {
        for (const [key, ex] of asinMap.entries()) {
          if ((ex.market || '.fr') === fileMarket) {
            ex.revenue = 0; ex.units = 0;
            ex.revenueDelta = null; ex.revenueYoY = null;
            ex.unitsDelta = null;
            ex.shippedRevenue = 0; ex.shippedUnits = 0;
            ex.returns = 0;
          }
        }
      }
      if (file.type === 'trafic') {
        for (const [key, ex] of asinMap.entries()) {
          if ((ex.market || '.fr') === fileMarket) {
            ex.glanceViews = 0; ex.gvDelta = null; ex.gvYoY = null;
          }
        }
      }
      if (file.type === 'stock') {
        for (const [key, ex] of asinMap.entries()) {
          if ((ex.market || '.fr') === fileMarket) {
            ex.sellableUnits = null; ex.sellableStock = null;
            ex.unsellableUnits = null; ex.unhealthyStock = null; ex.unhealthyUnits = null;
            ex.openPOQty = null; ex.oosPct = null;
            ex.retailPct = null; ex.confirmPct = null;
          }
        }
      }
    }

    for (const row of file.data) {
      const asinKey = row.asin + '|' + (row.market || '.fr');
      // Logique Fab vs Appro :
      // Vue Fab  → toujours inclure
      // Vue Appro → inclure uniquement si l'ASIN est absent de Fab ET sa marque est fabricant du client
      //           → sinon stocker shippedRevenue sur l'ASIN Fab existant
      if (fileDistView === 'appro') {
        if (file.type !== 'ventes') {
          // Trafic/Stock Appro : mettre à jour les ASINs existants uniquement, jamais créer
          if (!asinMap.has(asinKey)) continue;
        } else {
          // Ventes Appro : logique de fusion avec marques fabricant
          const brand = norm(row.brand || '');
          const isFabBrand = clientFabBrands.size === 0 || clientFabBrands.has(norm(brand));
          if (asinMap.has(asinKey)) {
            const ex = asinMap.get(asinKey);
            if (ex.sourcingOnly) {
              // ASIN sourcingOnly (appro) → mettre à jour revenue + metadata
              ex.revenue = row.revenue || 0;
              ex.units = row.units || 0;
              ex.revenueDelta = row.revenueDelta || null;
              ex.brand = row.brand || ex.brand;
              ex.title = row.title || ex.title;
            }
            // ASIN Fab → mettre à jour shippedRevenue uniquement
            if (row.shippedRevenue != null) ex.shippedRevenue = row.shippedRevenue || ex.revenue;
            if (row.shippedUnits != null) ex.shippedUnits = row.shippedUnits;
            // v3.1.71 — propager orderedRevenue/orderedUnits uniquement si la colonne était présente (> 0)
            // parseNum retourne 0 quand la colonne est absente — != null ne suffit pas
            if (row.orderedRevenue > 0) ex.orderedRevenue = row.orderedRevenue;
            if (row.orderedUnits > 0) ex.orderedUnits = row.orderedUnits;
            continue;
          } else if (!isFabBrand) {
            // Marque inconnue/revendeur → ignorer
            continue;
          }
          // Marque fabricant absente de Fab → l'ajouter avec flag sourcingOnly
          row.sourcingOnly = true;
        }
      }
      if (asinMap.has(asinKey)) {
        const ex = asinMap.get(asinKey);
        if (file.type === 'ventes' && ex.revenue != null) {
          if (!ex.history) ex.history = [];

          if (isMultiWeek) {
            // Rattrapage congés : répartir le CA sur N semaines synthétiques
            const revenuePerWeek = Math.round((ex.revenue || 0) / weeksCovered);
            const unitsPerWeek   = Math.round((ex.units   || 0) / weeksCovered);
            const gvPerWeek      = Math.round((ex.glanceViews || 0) / weeksCovered);
            const pd = s => { const [d,m,y] = s.split('/').map(Number); return new Date(y,m-1,d); };
            const startD = pd(file.periodStart);
            for (let w = 0; w < weeksCovered; w++) {
              const weekEnd = new Date(startD.getTime() + (w + 1) * 7 * 86400000);
              const weekStart = new Date(startD.getTime() + w * 7 * 86400000);
              const wEnd = weekEnd.toLocaleDateString('fr-FR');
              const wStart = weekStart.toLocaleDateString('fr-FR');
              const already = ex.history.some(h => h.period === wEnd);
              if (!already) {
                ex.history.push({
                  period: wEnd, periodStart: wStart, periodType: 'weekly',
                  revenue: revenuePerWeek, units: unitsPerWeek,
                  glanceViews: gvPerWeek,
                  sellableUnits: ex.sellableUnits != null ? ex.sellableUnits : null,
                  retailPct: ex.retailPct || null, returns: 0,
                  revenueDelta: null, multiWeekImport: true
                });
                if (ex.history.length > 52) ex.history.shift();
              }
            }
          }
        }
        for (const [k, v] of Object.entries(row)) { if (v !== '' && v !== 0 && v != null) ex[k] = v; }
      } else {
        asinMap.set(asinKey, { ...row, history: [] });
      }
      if (file.type === 'ventes') { totalCA += row.revenue || 0; totalUnits += row.units || 0; }
      if (file.type === 'trafic') totalGV += row.glanceViews || 0;
    }
    client.imports.push({ date: new Date().toISOString(), type: file.type, market: file.market, distributorView: file.distributorView || 'fab', periodStart: file.periodStart, periodEnd: file.periodEnd, periodType: file.periodType, filename: file.filename, rowCount: file.rowCount });
  }

  // Snapshot hebdo sur état final fusionné (après toutes les fusions de fichiers)
  if (periodType === 'weekly' && periodLabel) {
    for (const [, ex] of asinMap.entries()) {
      if (!ex.asin) continue;
      if (!ex.history) ex.history = [];
      const snapshot = {
        period: periodLabel,
        periodStart: parsedFiles.find(f => f?.periodStart)?.periodStart || null,
        periodType: 'weekly',
        revenue: ex.revenue || 0,
        orderedRevenue: ex.orderedRevenue || 0,
        shippedRevenue: ex.shippedRevenue || ex.revenue || 0,
        units: ex.units || 0,
        glanceViews: ex.glanceViews || 0,
        sellableUnits: ex.sellableUnits != null ? ex.sellableUnits : null,
        retailPct: ex.retailPct || null,
        returns: ex.returns || 0,
        revenueDelta: ex.revenueDelta || null
      };
      log('📸 Snapshot ' + ex.asin + ' revenue=' + snapshot.revenue + ' ordered=' + snapshot.orderedRevenue, 'ok');
      const alreadyArchived = ex.history.some(h => h.period === snapshot.period);
      if (!alreadyArchived) {
        ex.history.push(snapshot);
        if (ex.history.length > 52) ex.history.shift();
      }
    }
  }

  client.asins = Array.from(asinMap.values());

  // ── v3.7.7 — Accumulation timeline foViews (Featured Offer Page Views) ──────
  // Traitement après client.asins fixé. foViews est accumulé (jamais resetté).
  // P3 : views=0 stocké comme 0 (distingue 0-mesuré vs ASIN absent de cette semaine).
  var trafficFiles = parsedFiles.filter(function(f) { return f && f.type === 'trafic' && f.weekKey && f.marketRows; });
  if (trafficFiles.length > 0) {
    // Index ASIN → objet (premier match — chaque ASIN est unique dans client.asins)
    var foAsinIndex = new Map();
    for (var fai = 0; fai < client.asins.length; fai++) {
      var fa = client.asins[fai];
      if (fa.asin && !foAsinIndex.has(fa.asin)) foAsinIndex.set(fa.asin, fa);
    }
    var totalFoUpdated = 0;
    for (var tfi = 0; tfi < trafficFiles.length; tfi++) {
      var tf = trafficFiles[tfi];
      var rows = tf.marketRows;
      for (var ri = 0; ri < rows.length; ri++) {
        var mr = rows[ri];
        var ex = foAsinIndex.get(mr.asin);
        if (!ex) continue; // ASIN absent du catalogue → skip
        if (!ex.foViews) ex.foViews = {};
        if (!ex.foViews[mr.market]) ex.foViews[mr.market] = {};
        ex.foViews[mr.market][tf.weekKey] = {
          views: mr.views,
          deltaPrevPct: mr.deltaPrevPct,
          deltaYoyPct: mr.deltaYoyPct
        };
        totalFoUpdated++;
      }
    }
    log('📡 foViews : ' + totalFoUpdated + ' entrées (marché×semaine) accumulées sur ' + foAsinIndex.size + ' ASINs', 'ok');
  }

  // ── Enrichissement titres depuis catalogueXML (désignations françaises) ──
  if (client.catalogueXML && client.catalogueXML.length > 0) {
    var xmlByAsin = {};
    for (var xi = 0; xi < client.catalogueXML.length; xi++) {
      var xItem = client.catalogueXML[xi];
      if (xItem.asin && !xmlByAsin[xItem.asin]) {
        xmlByAsin[xItem.asin] = xItem;
      }
    }
    for (var ai = 0; ai < client.asins.length; ai++) {
      var asinEntry = client.asins[ai];
      var xmlMatch = xmlByAsin[asinEntry.asin];
      if (xmlMatch && xmlMatch.description) {
        if (!asinEntry.titleOriginal && asinEntry.title) {
          asinEntry.titleOriginal = asinEntry.title;
        }
        asinEntry.title = xmlMatch.description;
        if (!asinEntry.ean && xmlMatch.ean) asinEntry.ean = xmlMatch.ean;
        if (!asinEntry.model && xmlMatch.model) asinEntry.model = xmlMatch.model;
      }
    }
    log('\u{1F1EB}\u{1F1F7} Titres enrichis depuis catalogueXML: ' + Object.keys(xmlByAsin).length + ' ASINs referencés', 'ok');
  }

  client.csvImported = client.asins.length > 0;
  if (!client.history) client.history = { weekly: [], monthly: [], yearly: [] };
  if (totalCA > 0 || totalGV > 0) {
    const entry = { period: periodLabel, date: new Date().toISOString(), totalCA, totalUnits, totalGV, asinCount: client.asins.length };
    const hArr = client.history[periodType === 'monthly' ? 'monthly' : 'weekly'];
    hArr.push(entry);
    if (hArr.length > 52) hArr.shift();
  }

  // ── Option C : snapshot mensuel par ASIN ──────────────────
  // Déterminer le mois/année de l'import courant
  if (periodType === 'weekly' && periodLabel) {
    const importDate = parsedFiles.find(f => f?.periodEnd)?.periodEnd;
    if (importDate) {
      const [dd, mm, yyyy] = importDate.split('/');
      const monthKey = yyyy + '-' + mm; // ex: "2026-04"
      // Pour chaque ASIN, créer/mettre à jour le snapshot mensuel
      for (const a of client.asins) {
        if (!a.historyMonthly) a.historyMonthly = [];
        // Chercher si ce mois existe déjà
        const existingIdx = a.historyMonthly.findIndex(m => m.monthKey === monthKey);
        const monthSnap = {
          monthKey,
          label: mm + '/' + yyyy,
          revenue: (existingIdx >= 0 ? a.historyMonthly[existingIdx].revenue : 0) + (getRevenue(a,client)||0),
          units: (existingIdx >= 0 ? a.historyMonthly[existingIdx].units : 0) + (getUnits(a,client)||0),
          glanceViews: (existingIdx >= 0 ? a.historyMonthly[existingIdx].glanceViews : 0) + (a.glanceViews || 0),
          weeks: (existingIdx >= 0 ? a.historyMonthly[existingIdx].weeks : 0) + 1,
          sellableUnitsLast: a.sellableUnits != null ? a.sellableUnits : (existingIdx >= 0 ? a.historyMonthly[existingIdx].sellableUnitsLast : null),
          updatedAt: new Date().toISOString()
        };
        if (existingIdx >= 0) {
          a.historyMonthly[existingIdx] = monthSnap;
        } else {
          a.historyMonthly.push(monthSnap);
          // Garder 24 mois max (2 ans)
          if (a.historyMonthly.length > 24) a.historyMonthly.shift();
        }
      }
    }
  }

  // Collecter les marchés depuis les items individuels (important pour CSV multi-boutiques)
  for (const f of parsedFiles) { if (f?.market && !client.markets.includes(f.market)) client.markets.push(f.market); }
  for (const a of client.asins) { if (a.market && !client.markets.includes(a.market)) client.markets.push(a.market); }
  client.markets.sort();
  // Régénérer le plan d'action après chaque import pour refléter les nouvelles données
  client.weeklyActions = generateWeeklyActions(client);
  log(`🔗 Merge terminé: ${client.asins.length} ASINs hebdo`, 'ok');
  return client;
}

function handleBannerCSV(input) {
  // Import rapide depuis la bannière — attend TOUS les fichiers avant de merger
  const files = Array.from(input.files);
  if (!files.length) return;
  debugLog = [];
  log(`📥 Import rapide: ${files.length} fichier(s)`);
  const localPending = { ventes: null, ventesAppro: null, trafic: null, stock: null, stockAppro: null };
  let done = 0;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const parsed = parseCSVFile(e.target.result, file.name);
      if (!parsed.error) {
        if (parsed.type === 'ventes' && parsed.distributorView === 'appro') localPending.ventesAppro = parsed;
        else if (parsed.type === 'stock'  && parsed.distributorView === 'appro') localPending.stockAppro  = parsed;
        else if (parsed.type === 'ventes') localPending.ventes = parsed;
        else if (parsed.type === 'trafic') localPending.trafic = parsed;
        else if (parsed.type === 'stock') localPending.stock = parsed;
        else log(`⚠ Type inconnu: ${file.name}`, 'warn');
      } else {
        log(`✗ ${file.name}: ${parsed.error}`, 'err');
      }
      done++;
      // Merger seulement quand TOUS les fichiers sont parsés
      if (done === files.length) {
        const c = cl();
        if (!c) return;
        const toProcess = [localPending.ventes, localPending.ventesAppro, localPending.trafic, localPending.stock, localPending.stockAppro].filter(Boolean);
        if (!toProcess.length) { render(); return; }
        mergeImportData(c, toProcess);
        c.weeklyActions = generateWeeklyActions(c);
        if (!c.weeklyActions?.length) c.weeklyActions = generateWeeklyActions(c);
        save();
        const asinCount = c.asins.length;
        log(`✓ Import terminé: ${asinCount} ASINs`, 'ok');
        render();
        // Toast avec CTA navigation
        showImportSuccess(asinCount);
      }
    };
    reader.readAsText(file, 'UTF-8');
  });
  input.value = '';
}

function handlePOImport(files) {
  const c = cl();
  if (!c) return;
  let done = 0;
  const results = [];
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target.result;
      const parsed = parsePOCSV(text, file.name);
      results.push(parsed);
      done++;
      if (done === files.length) {
        mergePOData(c, results);
        save();
        render();
        log('✓ Import PO terminé : ' + parsed.rows.length + ' lignes', 'ok');
      }
    };
    reader.readAsText(file, 'UTF-8');
  });
}

function parsePOCSV(text, filename) {
  // v3.1.70 — Strip BOM UTF-8 si présent (export Amazon Vendor Central)
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const lines = text.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/["\r]/g,''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Gestion des guillemets dans les valeurs CSV
    const cols = [];
    let inQ = false, cur = '';
    for (const ch of line + ',') {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    if (cols.length < 5) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
    if (row['ASIN']) rows.push(row);
  }
  return { filename, rows };
}

function mergePOData(c, parsedResults) {
  if (!c.poData) c.poData = {};
  // Effacer l'ancien jeu de données PO (ce fichier fait foi)
  c.poData = {};
  c.poImportDate = new Date().toISOString();

  const poByAsin = {};
  for (const { rows } of parsedResults) {
    for (const r of rows) {
      const asin = r['ASIN'];
      if (!asin || !asin.startsWith('B')) continue;
      if (!poByAsin[asin]) {
        poByAsin[asin] = {
          asin,
          title: r['Nom du produit'] || '',
          totalAsked: 0, totalAccepted: 0, totalCancelled: 0, totalRemaining: 0,
          refusCount: 0, lastCancelReason: '', lastCancelDate: '',
          isDiscontinued: false, isPermanentOOS: false, hasInfoError: false,
          orders: []
        };
      }
      const d = poByAsin[asin];
      const asked    = parseFloat(r['Quantité demandée']    || '0') || 0;
      const accepted = parseFloat(r['Quantité acceptée']   || '0') || 0;
      const cancelled= parseFloat(r['Quantité annulée']    || '0') || 0;
      const remaining= parseFloat(r['Quantité restante']  || '0') || 0;
      const dispo    = r['Disponibilité'] || '';
      const date     = r['Date de la commande'] || '';
      d.totalAsked     += asked;
      d.totalAccepted  += accepted;
      d.totalCancelled += cancelled;
      d.totalRemaining += remaining;
      if (accepted === 0 && asked > 0) {
        d.refusCount++;
        d.lastCancelReason = dispo;
        d.lastCancelDate   = date;
      }
      if (dispo.includes('CP')) d.isDiscontinued = true;
      if (dispo.includes('CK')) d.isPermanentOOS = true;
      if (dispo.includes('R2')) d.hasInfoError = true;
      d.orders.push({ bdc: r['BdC'] || '', date, statut: r['Statut'] || '', asked, accepted, remaining, dispo, cout: r['Coût'] || '' });
    }
  }

  for (const [asin, d] of Object.entries(poByAsin)) {
    d.fillRate = d.totalAsked > 0 ? Math.round((d.totalAccepted / d.totalAsked) * 100) : 100;
    c.poData[asin] = d;
  }

  const total = Object.keys(poByAsin).length;
  const lowFill = Object.values(poByAsin).filter(d => d.fillRate < 80).length;
  const discontinued = Object.values(poByAsin).filter(d => d.isDiscontinued).length;
  log('✓ PO importé : ' + total + ' ASINs | ' + lowFill + ' fill rate < 80% | ' + discontinued + ' fin de série', 'ok');
}

function handleHistCSVImport(input) {
  // Import historique depuis l'écran Import (client déjà créé)
  // IMPORTANT : attendre que TOUS les fichiers soient parsés avant de merger
  // (les fichiers Fab doivent être traités avant les fichiers Appro correspondants)
  const files = Array.from(input.files);
  if (!files.length) return;
  debugLog = [];
  log(`📥 ${files.length} fichier(s) historique(s)`);
  let done = 0;
  const parsedFiles = [];

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const parsed = parseCSVFile(e.target.result, file.name);
      if (parsed.error) {
        log(`✗ ${file.name}: ${parsed.error}`, 'err');
      } else if (parsed.periodType === 'annual' || parsed.periodType === 'ytd') {
        parsedFiles.push(parsed);
      } else {
        log(`⚠ Fichier hebdo ignoré ici — utilisez la zone "Données hebdomadaires"`, 'warn');
      }
      done++;
      if (done === files.length) {
        // Trier : Fab en premier, Appro en second — pour garantir l'ordre de fusion
        parsedFiles.sort((a, b) => {
          if (a.distributorView === 'fab' && b.distributorView === 'appro') return -1;
          if (a.distributorView === 'appro' && b.distributorView === 'fab') return 1;
          return 0;
        });
        const c = cl();
        if (c && parsedFiles.length) {
          mergeImportData(c, parsedFiles);
          save();
          parsedFiles.forEach(p => {
            log(`✓ ${p.periodType === 'ytd' ? 'YTD' : 'Annuel ' + (p.periodEnd?.split('/')[2]||'?')} (${p.type} ${p.distributorView}): ${p.rowCount} ASINs`, 'ok');
          });
        }
        render();
      }
    };
    reader.readAsText(file, 'UTF-8');
  });
  input.value = '';
}

function handleHistCSV(input) {
  // Import pendant l'onboarding — fusionne dans newClient
  const files = Array.from(input.files);
  if (!files.length) return;
  debugLog = [];
  log(`📥 ${files.length} fichier(s) historique(s)`);
  if (!newClient.annualData) newClient.annualData = {};
  if (!newClient.ytdData)    newClient.ytdData = {};

  let done = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const parsed = parseCSVFile(e.target.result, file.name);
      if (parsed.error) { log(`✗ ${file.name}: ${parsed.error}`, 'err'); done++; if (done===files.length) render(); return; }

      if (parsed.periodType === 'annual') {
        const year = parsed.periodEnd ? parsed.periodEnd.split('/')[2] : String(new Date().getFullYear()-1);
        if (!newClient.annualData[year]) newClient.annualData[year] = {};
        const annASINs = {};
        let annCA = 0, annGV = 0, annUnits = 0;
        for (const row of parsed.data) {
          if (!row.asin) continue;
          annASINs[row.asin] = { ...row };
          if (parsed.type === 'ventes') { annCA += row.revenue||0; annUnits += row.units||0; }
          if (parsed.type === 'trafic') annGV += row.glanceViews||0;
        }
        newClient.annualData[year][parsed.type] = {
          periodStart: parsed.periodStart, periodEnd: parsed.periodEnd,
          totalCA: parsed.type==='ventes'?annCA:0, totalUnits: parsed.type==='ventes'?annUnits:0,
          totalGV: parsed.type==='trafic'?annGV:0,
          asinCount: parsed.data.length, asins: annASINs, importedAt: new Date().toISOString()
        };
        log(`✓ ${year} annuel (${parsed.type}): ${parsed.data.length} ASINs`, 'ok');
      } else if (parsed.periodType === 'ytd') {
        const ytdASINs = {};
        let ytdCA = 0, ytdGV = 0, ytdUnits = 0;
        for (const row of parsed.data) {
          if (!row.asin) continue;
          ytdASINs[row.asin] = { ...row };
          if (parsed.type === 'ventes') { ytdCA += row.revenue||0; ytdUnits += row.units||0; }
          if (parsed.type === 'trafic') ytdGV += row.glanceViews||0;
        }
        newClient.ytdData[parsed.type] = {
          periodStart: parsed.periodStart, periodEnd: parsed.periodEnd,
          totalCA: parsed.type==='ventes'?ytdCA:0, totalUnits: parsed.type==='ventes'?ytdUnits:0,
          totalGV: parsed.type==='trafic'?ytdGV:0,
          asinCount: parsed.data.length, asins: ytdASINs, importedAt: new Date().toISOString()
        };
        log(`✓ YTD (${parsed.type}): ${parsed.data.length} ASINs — ${parsed.periodStart}→${parsed.periodEnd}`, 'ok');
      } else {
        log(`⚠ ${file.name}: fichier hebdomadaire ignoré ici (utilisez Import données)`, 'warn');
      }
      done++;
      if (done === files.length) render();
    };
    reader.readAsText(file, 'UTF-8');
  });
  input.value = '';
}

function handleMultiCSV(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  debugLog = [];
  log(`📥 ${files.length} fichier(s) sélectionné(s)`);
  let done = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const parsed = parseCSVFile(e.target.result, file.name);
      if (parsed.error) {
        log(`✗ ${file.name}: ${parsed.error}`, 'err');
      } else if (parsed.periodType === 'annual' || parsed.periodType === 'ytd') {
        // Fichiers historiques déposés dans la mauvaise zone — les traiter quand même
        const c = cl();
        if (c) {
          mergeImportData(c, [parsed]);
          save();
          log(`✓ ${parsed.periodType === 'ytd' ? 'YTD' : 'Annuel'} (${parsed.type}) intégré automatiquement`, 'ok');
        }
      } else {
        if (parsed.type === 'ventes' && parsed.distributorView === 'appro') pendingFiles.ventesAppro = parsed;
        else if (parsed.type === 'stock'  && parsed.distributorView === 'appro') pendingFiles.stockAppro  = parsed;
        else if (parsed.type === 'ventes') pendingFiles.ventes = parsed;
        else if (parsed.type === 'trafic') pendingFiles.trafic = parsed;
        else if (parsed.type === 'stock')  pendingFiles.stock  = parsed;
        else log(`⚠ Type non reconnu: ${file.name}`, 'warn');
      }
      done++;
      // Un seul render() quand tous les fichiers sont parsés
      if (done === files.length) render();
    };
    reader.readAsText(file, 'UTF-8');
  });
  input.value = '';
}

function clearPending() { pendingFiles = { ventes: null, ventesAppro: null, trafic: null, stock: null, stockAppro: null }; debugLog = []; render(); }

function checkImportCoherence(client, parsedFiles) {
  var warnings = [];
  var clientBrands = (client.brands || []).map(function(b) { return b.name.trim().toUpperCase(); });

  if (clientBrands.length === 0) {
    warnings.push({ level: 'info', msg: 'Aucune marque déclarée dans la fiche client — impossible de vérifier la cohérence des données.' });
    return warnings;
  }

  var csvBrands = {};
  var totalRows = 0;
  var unknownRows = 0;

  for (var fi = 0; fi < parsedFiles.length; fi++) {
    var pf = parsedFiles[fi];
    if (!pf || !pf.data) continue;
    for (var ri = 0; ri < pf.data.length; ri++) {
      var row = pf.data[ri];
      var brand = (row.brand || row.Marque || row.marque || '').trim().toUpperCase();
      if (!brand) continue;
      totalRows++;
      if (!csvBrands[brand]) csvBrands[brand] = 0;
      csvBrands[brand]++;
      if (clientBrands.indexOf(brand) === -1) unknownRows++;
    }
  }

  var unknownBrands = [];
  for (var b in csvBrands) {
    if (csvBrands.hasOwnProperty(b) && clientBrands.indexOf(b) === -1) {
      unknownBrands.push({ name: b, count: csvBrands[b] });
    }
  }
  unknownBrands.sort(function(a, b) { return b.count - a.count; });

  if (unknownRows > 0 && totalRows > 0) {
    var pct = Math.round(unknownRows / totalRows * 100);
    var brandList = unknownBrands.slice(0, 5).map(function(b) { return b.name + ' (' + b.count + ' lignes)'; }).join(', ');
    if (pct > 50) {
      warnings.push({ level: 'critical', msg: '⛔ ATTENTION — ' + pct + '% des lignes CSV contiennent des marques inconnues de ce client !\nMarques trouvées : ' + brandList + '\nMarques du client : ' + clientBrands.join(', ') + '\nVérifiez que vous importez dans le bon client.' });
    } else if (pct > 10) {
      warnings.push({ level: 'warning', msg: '⚠️ ' + pct + '% des lignes ont des marques inconnues : ' + brandList });
    }
  }

  var csvMarkets = {};
  for (var fi2 = 0; fi2 < parsedFiles.length; fi2++) {
    var pf2 = parsedFiles[fi2];
    if (!pf2 || !pf2.data) continue;
    for (var ri2 = 0; ri2 < pf2.data.length; ri2++) {
      var row2 = pf2.data[ri2];
      var boutique = (row2['Code de la boutique'] || row2.code_boutique || row2.store_id || '').trim().toUpperCase();
      var mkt = MARKET_CODES[boutique] || BOUTIQUE_CODES[boutique] || null;
      if (mkt) csvMarkets[mkt] = (csvMarkets[mkt] || 0) + 1;
    }
  }

  var clientMarkets = client.markets || ['.fr'];
  var unknownMarkets = [];
  for (var m in csvMarkets) {
    if (csvMarkets.hasOwnProperty(m) && clientMarkets.indexOf(m) === -1) unknownMarkets.push(m);
  }
  if (unknownMarkets.length > 0) {
    warnings.push({ level: 'warning', msg: '⚠️ Le CSV contient des données pour des marchés non déclarés dans ce client : ' + unknownMarkets.join(', ') + '. Marchés du client : ' + clientMarkets.join(', ') });
  }

  return warnings;
}

function processImport() {
  var c = cl();
  if (!c) return;
  var files = [pendingFiles.ventes, pendingFiles.ventesAppro, pendingFiles.trafic, pendingFiles.stock, pendingFiles.stockAppro].filter(Boolean);
  if (!files.length) { alert('Aucun fichier valide'); return; }

  // Garde-fou 1 — vérification cohérence marques / marchés
  var coherenceWarnings = checkImportCoherence(c, files);
  var hasCritical = coherenceWarnings.some(function(w) { return w.level === 'critical'; });

  if (hasCritical) {
    var msgs = coherenceWarnings.map(function(w) { return w.msg; }).join('\n\n');
    var proceed = confirm(msgs + '\n\n⛔ Voulez-vous VRAIMENT continuer l\'import dans "' + c.name + '" ?');
    if (!proceed) {
      log('⛔ Import annulé par l\'utilisateur (incohérence marques)', 'err');
      render();
      return;
    }
    log('⚠️ Import forcé malgré incohérence marques', 'warn');
  } else if (coherenceWarnings.length > 0) {
    var infoMsgs = coherenceWarnings.map(function(w) { return w.msg; }).join('\n');
    log(infoMsgs, 'warn');
  }

  // Garde-fou 3 — panneau récapitulatif pré-fusion
  var summaryHtml = '<div style="padding:16px;background:var(--bg);border:2px solid var(--bd);border-radius:var(--rdl);margin-top:10px">';
  summaryHtml += '<div style="font-size:14px;font-weight:700;margin-bottom:10px">📋 Récapitulatif avant import dans <strong>' + esc(c.name) + '</strong></div>';

  var fileLabels = { ventes: 'Ventes Fab', ventesAppro: 'Ventes Appro', trafic: 'Trafic', stock: 'Stock Fab', stockAppro: 'Stock Appro' };
  var fileKeys = ['ventes', 'ventesAppro', 'trafic', 'stock', 'stockAppro'];
  summaryHtml += '<table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:10px">';
  for (var fki = 0; fki < fileKeys.length; fki++) {
    var fk = fileKeys[fki];
    if (pendingFiles[fk]) {
      summaryHtml += '<tr><td style="padding:3px 8px;color:var(--tx2)">' + (fileLabels[fk] || fk) + '</td>';
      summaryHtml += '<td style="padding:3px 8px;font-weight:600">' + pendingFiles[fk].rowCount + ' lignes</td>';
      summaryHtml += '<td style="padding:3px 8px;color:var(--tx3);font-size:11px">' + (pendingFiles[fk].periodStart || '') + (pendingFiles[fk].periodEnd ? ' → ' + pendingFiles[fk].periodEnd : '') + '</td></tr>';
    }
  }
  summaryHtml += '</table>';

  var allBrands = {};
  for (var bfi = 0; bfi < files.length; bfi++) {
    var bfd = files[bfi].data;
    for (var bri = 0; bri < bfd.length; bri++) {
      var bn = (bfd[bri].brand || bfd[bri].Marque || '').trim();
      if (bn) allBrands[bn] = (allBrands[bn] || 0) + 1;
    }
  }
  var topBrands = [];
  for (var bnk in allBrands) { if (allBrands.hasOwnProperty(bnk)) topBrands.push([bnk, allBrands[bnk]]); }
  topBrands.sort(function(a, b) { return b[1] - a[1]; });
  topBrands = topBrands.slice(0, 8);
  if (topBrands.length > 0) {
    summaryHtml += '<div style="font-size:12px;margin-bottom:8px"><b>Marques CSV :</b> ' + topBrands.map(function(b) { return esc(b[0]); }).join(', ') + '</div>';
  }

  for (var wi = 0; wi < coherenceWarnings.length; wi++) {
    var w = coherenceWarnings[wi];
    var wbg = w.level === 'critical' ? 'var(--r-bg)' : w.level === 'warning' ? 'var(--a-bg)' : 'var(--s2)';
    var wbd = w.level === 'critical' ? 'var(--r-bd)' : w.level === 'warning' ? 'var(--a-bd)' : 'var(--bd)';
    summaryHtml += '<div style="padding:8px 12px;background:' + wbg + ';border:1px solid ' + wbd + ';border-radius:var(--rds);margin-bottom:6px;font-size:12px;white-space:pre-line">' + esc(w.msg) + '</div>';
  }

  summaryHtml += '<div style="display:flex;gap:8px;margin-top:12px">';
  summaryHtml += '<button class="btn btn-p" onclick="confirmImport()">✅ Confirmer l\'import</button>';
  summaryHtml += '<button class="btn" onclick="cancelImport()">❌ Annuler</button>';
  summaryHtml += '</div></div>';

  var zone = document.getElementById('importConfirmZone');
  if (zone) zone.innerHTML = summaryHtml;
  // NE PAS fusionner ici — attendre le clic "Confirmer"
}

function confirmImport() {
  var c = cl();
  if (!c) return;
  var files = [pendingFiles.ventes, pendingFiles.ventesAppro, pendingFiles.trafic, pendingFiles.stock, pendingFiles.stockAppro].filter(Boolean);
  if (!files.length) return;
  log('🔄 Fusion de ' + files.length + ' fichier(s)...');
  mergeImportData(c, files);
  if (!c.weeklyActions || !c.weeklyActions.length) { c.weeklyActions = generateWeeklyActions(c); }
  save();
  pendingFiles = { ventes: null, ventesAppro: null, trafic: null, stock: null, stockAppro: null };
  var asinCount = c.asins.length;
  log('✓ Import terminé: ' + asinCount + ' ASINs', 'ok');
  render();
  setTimeout(function() { showImportSuccess(asinCount); }, 100);
  setTimeout(function() { smokeTest(false); }, 1500);
}

function cancelImport() {
  var zone = document.getElementById('importConfirmZone');
  if (zone) zone.innerHTML = '';
  log('❌ Import annulé', 'warn');
}

function exportClient() {
  const c = cl();
  if (!c) return;
  const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${c.name.replace(/\s+/g,'_')}_export.json`; a.click();
  URL.revokeObjectURL(url);
}

function exportAllData(silent = false) {
  const now = new Date();
  const data = {
    _meta: {
      version: APP_VERSION,
      exportDate: now.toISOString(),
      exportDateHuman: now.toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }),
      clientCount: clients.length,
      totalAsins: clients.reduce((s,c) => s + (c.asins?.length||0), 0),
      totalCA: clients.reduce((s,c) => s + (c.asins?.reduce((ss,a) => ss + (getRevenue(a,c)||0), 0)||0), 0),
      clientsSummary: clients.map(c => ({
        id: c.id, name: c.name, brand: c.brand, markets: c.markets,
        asinCount: c.asins?.length || 0,
        // v3.6.8.9 SSOT : source correcte = dernier import ventes depuis c.imports (pas c.asins[0].periodEnd)
        lastImport: (c.imports||[]).filter(function(i){return i.type==='ventes'&&(i.periodType==='weekly'||!i.periodType);}).sort(function(a,b){return new Date(b.date)-new Date(a.date);})[0]?.date || null,
        hasHistorical: !!(c.annualData && Object.keys(c.annualData).length),
        hasAppros: !!(c.catalogue?.length),
      }))
    },
    clients,
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `amazon_pilot_backup_${now.toISOString().slice(0,10)}.json`;
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem('ap-last-export', now.toISOString());
  if (!silent) {
    log(`✓ Backup exporté — ${Math.round(json.length/1024)} KB`, 'ok');
    showToast('\u{1F4BE} Backup exporté', `${filename} — ${clients.length} client(s) · ${data._meta.totalAsins} ASINs`, 'ok');
  }
}

function importAllData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      // Compatibilité ancien format (sans _meta) et nouveau format
      const importedClients = data.clients || (Array.isArray(data) ? data : null);
      if (!importedClients || !importedClients.length) { alert('Fichier invalide ou vide'); return; }
      const meta = data._meta || {};
      const exportDate = meta.exportDate ? new Date(meta.exportDate).toLocaleDateString('fr-FR') : 'date inconnue';
      const msg = `Restaurer ${importedClients.length} client(s) depuis le backup du ${exportDate} ?\n\nCela remplacera toutes les données actuelles.`;
      if (!confirm(msg)) return;
      clients = importedClients;
      activeId = clients.length ? clients[0].id : null;
      save();
      localStorage.setItem('ap-last-export', data._meta?.exportDate || new Date().toISOString());
      screen = clients.length ? 'dashboard' : 'welcome';
      log(`✓ Backup restauré — ${clients.length} client(s) (export du ${exportDate})`, 'ok');
      showToast('✅ Backup restauré', `${clients.length} client(s) importés depuis le ${exportDate}`, 'ok');
      render();
    } catch(err) { alert('Fichier invalide: ' + err.message); }
  };
  reader.readAsText(file);
  input.value = '';
}