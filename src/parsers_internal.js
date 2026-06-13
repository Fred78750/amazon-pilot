// Amazon Pilot — src/parsers_internal.js
// Parsers CSV/XML internes extraits de core.js (v3.7.2)
// Injecté via // @parsers_internal dans core.js (build.py)

function detectFileType(headers) {
  const h = headers.map(x => norm(x)).join(' ');
  if ((h.includes('chiffre') && h.includes('affaires')) || h.includes('ordered revenue') || h.includes('revenus')) return 'ventes';
  if (h.includes('vues') || h.includes('glance') || h.includes('offre vedette')) return 'trafic';
  // v3.7.8 — Delivery Defects : Week_end + Sub-Defect (header ligne 0, sans métadonnées)
  if (h.includes('sub-defect') && h.includes('week_end')) return 'delivery';
  if (h.includes('stock') || h.includes('rupture') || h.includes('vendable') || h.includes('invendable')
    || h.includes('sellable') || h.includes('unsellable') || h.includes('inventory') || h.includes('fill rate') || h.includes('purchase order')) return 'stock';
  if (h.includes('bdc') || h.includes('quantite demandee') || h.includes('quantite acceptee') || h.includes('purchase order number') || h.includes('code fournisseur')) return 'po';
  return 'unknown';
}

function detectPeriodType(startDate, endDate, intervalMeta) {
  // Lire d'abord l'intervalle explicite dans les métadonnées VC
  if (intervalMeta) {
    const iv = norm(intervalMeta).trim(); // norm() pour neutraliser les accents
    if (iv.includes('annee en cours') || iv.includes('year to date') || iv.includes('ytd')) return 'ytd';
    if (iv === 'an' || iv === 'year' || iv === 'annual' || iv.includes('chaque annee') || iv.includes('chaque an') || iv.includes('each year') || iv.includes('annually')) return 'annual';
    if (iv.includes('semaine') || iv === 'week' || iv.includes('weekly')) return 'weekly';
    if (iv.includes('mois') || iv === 'month' || iv.includes('monthly')) return 'monthly';
  }
  // Fallback sur le nombre de jours
  if (!startDate || !endDate) return 'weekly';
  const pd = s => { const [d,m,y] = s.split('/').map(Number); return new Date(y,m-1,d); };
  const days = Math.round((pd(endDate) - pd(startDate)) / 86400000);
  if (days <= 14) return 'weekly';
  if (days <= 45) return 'monthly';
  if (days >= 300 && days <= 366) return 'annual';
  if (days > 60 && days < 300) return 'ytd';
  return 'yearly'; // legacy
}

function parseCSVFile(text, filename) {
  // v3.7.8 — Pré-check Delivery Defects (header en ligne 0, pas de ligne de métadonnées)
  // Détection avant parseVCFile : "Week_end" + "Sub-Defect" dans les 512 premiers chars
  var _precheck = (text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text).slice(0, 512).toLowerCase();
  if (_precheck.includes('week_end') && _precheck.includes('sub-defect')) {
    var _dd = parseDeliveryDefectsCSV(text);
    if (_dd.error) {
      log('✗ ' + (filename || '') + ' [Delivery defects] : ' + _dd.error, 'err');
      return { error: _dd.error };
    }
    var _wkSeen = {}, _weekKeys = [];
    _dd.items.forEach(function(it) { if (it.weekEnd && !_wkSeen[it.weekEnd]) { _wkSeen[it.weekEnd] = true; _weekKeys.push(it.weekEnd); } });
    _weekKeys.sort();
    log('📦 ' + (filename || '') + ' [Delivery defects] : ' + _dd.items.length + ' défauts, ' + _weekKeys.length + ' semaines (' + _weekKeys.slice(0, 3).join(', ') + (_weekKeys.length > 3 ? '…' : '') + ')', 'ok');
    return { type: 'delivery', items: _dd.items, weekKeys: _weekKeys };
  }

  // v3.6.6.1 — Délégation au parser universel multilingue parseVCFile()
  // Maintient la structure de retour legacy pour tous les appelants existants
  var result = parseVCFile(text, filename);

  if (!result.ok) {
    log('✗ ' + (filename || '') + ' : ' + (result.errors[0] || 'Format non reconnu'), 'err');
    return { error: result.errors[0] || 'Format non reconnu' };
  }

  // Traduction vcType -> type legacy + distributorView
  var type, distributorView;
  var vcType = result.vcType;
  if      (vcType === 'stock_approv')  { type = 'stock';  distributorView = 'appro'; }
  else if (vcType === 'stock_fab')     { type = 'stock';  distributorView = 'fab';   }
  else if (vcType === 'ventes_approv') { type = 'ventes'; distributorView = 'appro'; }
  else if (vcType === 'ventes_fab')    { type = 'ventes'; distributorView = 'fab';   }
  else if (vcType === 'trafic')        { type = 'trafic'; distributorView = 'fab';   }
  else { return { error: 'Type non reconnu : ' + vcType }; }

  // v3.7.7 — Enrichissement Traffic : timeline foViews par marché/semaine
  // P2 : échec weekKey = erreur explicite, skip fichier complet
  var weekKey = null, marketRows = null, unknownMarketCodes = [];
  if (type === 'trafic') {
    var tf = parseTrafficFile(text, filename);
    if (tf.error) {
      log('✗ ' + (filename || '') + ' [Traffic timeline] : ' + tf.error, 'err');
      return { error: tf.error };
    }
    weekKey         = tf.weekKey;
    marketRows      = tf.marketRows;
    unknownMarketCodes = tf.unknownMarketCodes || [];
    log('📡 Traffic timeline : weekKey=' + weekKey + ', variante=' + tf.variant + ', ' + tf.marketRows.length + ' lignes, marchés : ' + tf.marketsSeen.join('/'), 'ok');
  }

  // Log type + langue detectes
  var typeLabels = {
    trafic: 'Trafic ASIN', ventes_approv: 'Ventes ASIN Approvisionnement',
    ventes_fab: 'Ventes ASIN Fabrication', stock_approv: 'Stock ASIN Approvisionnement',
    stock_fab: 'Stock ASIN Fabrication'
  };
  var langLabel = result.language === 'en' ? 'Anglais (en_GB)' : 'Français (fr_FR)';
  log('📋 ' + (typeLabels[vcType] || vcType) + ' • ' + langLabel
    + ' • ' + result.rows.length + ' ASINs'
    + (result.isMultiCountry ? ' (agrégé ' + result.countriesDetected.length + ' marchés)' : ''), 'ok');

  // Message UI + console multi-pays (v3.6.6.1)
  if (result.isMultiCountry) {
    var ctMsg = '🌍 Multi-pays détecté (' + result.countriesDetected.length
      + ' marchés : ' + result.countriesDetected.join(', ')
      + '). Agrégation tous marchés effectuée. Stock et CA affichés = somme Europe.';
    log(ctMsg, 'ok');
    if (typeof showToast === 'function') {
      setTimeout(function() { showToast(ctMsg, 'alr-b'); }, 150);
    }
  }

  // Traduction rows -> data format legacy
  var data = result.rows.map(function(row) {
    var item = {
      asin:            row.asin,
      title:           row.titre  || '',
      brand:           row.marque || '',
      market:          result.market,
      periodStart:     result.periodStart,
      periodEnd:       result.periodEnd,
      periodType:      result.periodType,
      distributorView: distributorView
    };
    if (type === 'ventes') {
      item.orderedRevenue = row.ordered_revenue    || 0;
      item.shippedRevenue = row.dispatched_revenue || 0;
      // revenue : Fab -> expedie, Appro -> commande si dispo sinon expedie (compat v3.1.72)
      item.revenue = distributorView === 'fab'
        ? item.shippedRevenue
        : (item.orderedRevenue > 0 ? item.orderedRevenue : item.shippedRevenue);
      item.orderedUnits = row.ordered_units    || 0;
      item.shippedUnits = row.dispatched_units || 0;
      item.units = distributorView === 'fab'
        ? item.orderedUnits
        : (item.orderedUnits > 0 ? item.orderedUnits : item.shippedUnits);
      item.returns      = row.customer_returns || 0;
      item.revenueDelta = '';
      item.revenueYoY   = '';
      item.unitsDelta   = '';
    }
    if (type === 'trafic') {
      item.glanceViews = row.glance_views || 0;
      item.gvDelta     = '';
      item.gvYoY       = '';
    }
    if (type === 'stock') {
      item.sellableStock   = row.sellable_on_hand_inventory   || 0;
      item.sellableUnits   = row.sellable_on_hand_units       || 0;
      item.unsellableUnits = row.unsellable_on_hand_units     || 0;
      item.unhealthyStock  = row.unhealthy_inventory          || 0;
      item.unhealthyUnits  = row.unhealthy_units              || 0;
      item.openPOQty       = row.open_po_qty                  || 0;
      item.oosPct          = row.sourceable_oos_pct           || '';
      item.confirmPct      = row.vendor_confirmation_pct      || '';
      item.retailPct       = row.sell_through_pct             || '';
    }
    return item;
  });

  return {
    type:              type,
    market:            result.market,
    distributorView:   distributorView,
    periodStart:       result.periodStart,
    periodEnd:         result.periodEnd,
    periodType:        result.periodType,
    company:           result.company,
    rowCount:          data.length,
    data:              data,
    filename:          filename,
    // Champs enrichis v3.6.6.1
    language:          result.language,
    isMultiCountry:    result.isMultiCountry,
    countriesDetected: result.countriesDetected,
    vcType:            vcType,
    // v3.7.7 — foViews timeline (trafic uniquement)
    weekKey:            weekKey,
    marketRows:         marketRows,
    unknownMarketCodes: unknownMarketCodes
  };
}

function parseCSVBuyBox(text) {
  // Strip BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  if (typeof Papa === 'undefined') {
    return { error: 'PapaParse non disponible' };
  }

  var result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: function(h) { return h.trim(); }
  });

  if (result.errors && result.errors.length > 0) {
    console.warn('Papa parse warnings:', result.errors.slice(0, 3));
  }

  return { data: result.data || [], fields: result.meta.fields || [] };
}

function parseDeliveryDefectsCSV(text) {
  var parsed = parseCSVBuyBox(text);
  if (parsed.error) return { error: parsed.error };

  var required = ['Week_end', 'Vendor Code', 'PO', 'Sub-Defect'];
  for (var i = 0; i < required.length; i++) {
    if (parsed.fields.indexOf(required[i]) === -1) {
      return { error: 'Colonne attendue manquante : ' + required[i] };
    }
  }

  var defects = [];
  for (var r = 0; r < parsed.data.length; r++) {
    var row = parsed.data[r];
    defects.push({
      weekEnd:                           (row['Week_end'] || '').trim(),
      vendorCode:                        (row['Vendor Code'] || '').trim().toUpperCase(),
      vendorCodeCountry:                 (row['Vendor Code Country'] || '').trim(),
      supplyChainProgram:                (row['Supply Chain Program'] || '').trim(),
      fc:                                (row['FC'] || '').trim(),
      fcCountry:                         (row['FC Country'] || '').trim(),
      po:                                (row['PO'] || '').trim(),
      isa:                               (row['ISA'] || '').trim(),
      carrier:                           (row['Carrier Name'] || '').trim(),
      deliveryWindowStart:               (row['Delivery Window Start'] || '').trim(),
      deliveryWindowEnd:                 (row['Delivery Window End'] || '').trim(),
      carrierFirstRequestedDeliveryDate: (row['Carrier First Requested Delivery Date'] || '').trim(),
      delayLength:                       (row['Delay Length'] || '').trim(),
      delayCategory:                     (row['Delay Category'] || '').trim(),
      subDefect:                         (row['Sub-Defect'] || '').trim(),
      subDefectExplanation:              (row['Sub-Defect-Explanation'] || '').trim(),
      defectDate:                        (row['Defect Date'] || '').trim(),
      receiveDate:                       (row['Receive Date'] || '').trim(),
      units:                             parseInt(row['Units'], 10) || 0
    });
  }

  var vcCounts = {};
  var subDefectCounts = {};
  var totalUnits = 0;
  for (var d = 0; d < defects.length; d++) {
    var def = defects[d];
    if (def.vendorCode) vcCounts[def.vendorCode] = (vcCounts[def.vendorCode] || 0) + 1;
    if (def.subDefect) subDefectCounts[def.subDefect] = (subDefectCounts[def.subDefect] || 0) + 1;
    totalUnits += def.units;
  }

  return {
    items: defects,
    summary: {
      totalDefects: defects.length,
      vendorCodes: vcCounts,
      subDefects: subDefectCounts,
      totalUnits: totalUnits
    }
  };
}

function parseAppointmentsCSV(text) {
  var parsed = parseCSVBuyBox(text);
  if (parsed.error) return { error: parsed.error };

  var fields = parsed.fields;
  var isFR = fields.indexOf('BdC') !== -1;
  var isEN = fields.indexOf('PO') !== -1 && fields.indexOf('Issue') !== -1;

  if (!isFR && !isEN) {
    return { error: 'Langue du fichier non reconnue (ni BdC ni PO+Issue détectés)' };
  }

  var map = isFR ? {
    isa: 'ISA', arn: 'ARN', asn: 'ASN', vBol: 'V-BOL', cBol: 'C-BOL',
    vPro: 'V-PRO', cPro: 'C-PRO', isd: 'ISD', po: 'BdC',
    asnQty: 'Quantité d’ASN',
    initialReceivedQty: 'Quantité initiale reçue',
    issue: 'Problème',
    appointmentCreationDate: 'Date de création du rendez-vous',
    fcStatus: 'État du rendez-vous au centre de distribution',
    scheduledArrival: 'Date d’arrivée prévue',
    actualArrival: 'Date d’arrivée effective',
    firstCarrierRequestedDeliveryDate: 'Première date de livraison souhaitée par le transporteur',
    carrierRequestedDeliveryDate: 'Date de livraison souhaitée par le transporteur',
    windowStart: 'Début de la fenêtre', windowEnd: 'Fin de la fenêtre',
    carrier: 'Transporteur', mode: 'Mode', shipTo: 'Adresse de livraison',
    lastUpdated: 'Date de la dernière mise à jour'
  } : {
    isa: 'ISA', arn: 'ARN', asn: 'ASN', vBol: 'V-BOL', cBol: 'C-BOL',
    vPro: 'V-PRO', cPro: 'C-PRO', isd: 'ISD', po: 'PO',
    asnQty: 'ASN quantity',
    initialReceivedQty: 'Initial received quantity',
    issue: 'Issue',
    appointmentCreationDate: 'Appointment creation date',
    fcStatus: 'FC appointment status',
    scheduledArrival: 'Scheduled arrival date',
    actualArrival: 'Actual arrival date',
    firstCarrierRequestedDeliveryDate: 'First carrier requested delivery date',
    carrierRequestedDeliveryDate: 'Carrier requested delivery date',
    windowStart: 'Window start', windowEnd: 'Window end',
    carrier: 'Carrier', mode: 'Mode', shipTo: 'Ship to',
    lastUpdated: 'Last updated'
  };

  var sourceLanguage = isFR ? 'fr' : 'en';

  var appts = [];
  for (var r2 = 0; r2 < parsed.data.length; r2++) {
    var row2 = parsed.data[r2];
    var rawIssue = (row2[map.issue] || '').trim();
    var issues = rawIssue ? rawIssue.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];

    appts.push({
      isa:                               (row2[map.isa] || '').trim(),
      arn:                               (row2[map.arn] || '').trim(),
      asn:                               (row2[map.asn] || '').trim(),
      vBol:                              (row2[map.vBol] || '').trim(),
      cBol:                              (row2[map.cBol] || '').trim(),
      vPro:                              (row2[map.vPro] || '').trim(),
      cPro:                              (row2[map.cPro] || '').trim(),
      isd:                               (row2[map.isd] || '').trim(),
      po:                                (row2[map.po] || '').trim(),
      asnQty:                            (row2[map.asnQty] || '').toString().trim(),
      initialReceivedQty:                (row2[map.initialReceivedQty] || '').toString().trim(),
      issues:                            issues,
      appointmentCreationDate:           (row2[map.appointmentCreationDate] || '').trim(),
      fcStatus:                          (row2[map.fcStatus] || '').trim(),
      scheduledArrival:                  (row2[map.scheduledArrival] || '').trim(),
      actualArrival:                     (row2[map.actualArrival] || '').trim(),
      firstCarrierRequestedDeliveryDate: (row2[map.firstCarrierRequestedDeliveryDate] || '').trim(),
      carrierRequestedDeliveryDate:      (row2[map.carrierRequestedDeliveryDate] || '').trim(),
      windowStart:                       (row2[map.windowStart] || '').trim(),
      windowEnd:                         (row2[map.windowEnd] || '').trim(),
      carrier:                           (row2[map.carrier] || '').trim(),
      mode:                              (row2[map.mode] || '').trim(),
      shipTo:                            (row2[map.shipTo] || '').trim(),
      lastUpdated:                       (row2[map.lastUpdated] || '').trim(),
      sourceLanguage:                    sourceLanguage
    });
  }

  var issueCounts = {};
  var shipToCounts = {};
  var vBolPrefixes = {};
  for (var a = 0; a < appts.length; a++) {
    var ap = appts[a];
    for (var ii = 0; ii < ap.issues.length; ii++) {
      issueCounts[ap.issues[ii]] = (issueCounts[ap.issues[ii]] || 0) + 1;
    }
    if (ap.shipTo) shipToCounts[ap.shipTo] = (shipToCounts[ap.shipTo] || 0) + 1;
    if (ap.vBol) {
      var pref = ap.vBol.substring(0, 3);
      vBolPrefixes[pref] = (vBolPrefixes[pref] || 0) + 1;
    }
  }

  return {
    items: appts,
    summary: {
      totalAppointments: appts.length,
      sourceLanguage: sourceLanguage,
      issues: issueCounts,
      shipTo: shipToCounts,
      vBolPrefixes: vBolPrefixes
    }
  };
}

function parseMatriceTarifXML(xmlText) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(xmlText, 'text/xml');
  var ns = 'urn:schemas-microsoft-com:office:spreadsheet';

  var worksheets = doc.getElementsByTagNameNS(ns, 'Worksheet');
  var costSheet = null;
  for (var i = 0; i < worksheets.length; i++) {
    if (worksheets[i].getAttribute('ss:Name') === 'Cost') {
      costSheet = worksheets[i]; break;
    }
  }
  if (!costSheet) return { error: 'Onglet "Cost" non trouvé dans le XML' };

  var table = costSheet.getElementsByTagNameNS(ns, 'Table')[0];
  var rows = table.getElementsByTagNameNS(ns, 'Row');

  var results = [];
  var vcCounts = {};
  var statusCounts = {};

  // Les 6 premières lignes sont header/meta — données à partir de l'index 6
  for (var r = 6; r < rows.length; r++) {
    var cells = rows[r].getElementsByTagNameNS(ns, 'Cell');
    var vals = {};
    var colIdx = 0;
    for (var c = 0; c < cells.length; c++) {
      var idxAttr = cells[c].getAttribute('ss:Index');
      if (idxAttr) colIdx = parseInt(idxAttr) - 1;
      var dataEl = cells[c].getElementsByTagNameNS(ns, 'Data')[0];
      vals[colIdx] = dataEl ? dataEl.textContent : '';
      colIdx++;
    }

    var asin = (vals[2] || '').trim();
    if (!asin.startsWith('B')) continue;

    var vc = (vals[1] || '').trim();
    var status = (vals[6] || '').trim();

    if (vc && vc !== 'None') vcCounts[vc] = (vcCounts[vc] || 0) + 1;
    if (status && status !== 'None') statusCounts[status] = (statusCounts[status] || 0) + 1;

    results.push({
      asin: asin,
      ean: (vals[3] || '').trim(),
      model: (vals[4] || '').trim(),
      description: (vals[5] || '').trim(),
      vendorCode: vc,
      status: status,
      cost: parseFloat((vals[8] || '0').replace(',', '.')) || 0
    });
  }

  return {
    items: results,
    summary: {
      totalASINs: new Set(results.map(function(r) { return r.asin; })).size,
      totalLines: results.length,
      vendorCodes: vcCounts,
      statuses: statusCounts
    }
  };
}

function parseMatriceTarif(xmlText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const ns = 'urn:schemas-microsoft-com:office:spreadsheet';

    // Trouver la feuille "Cost"
    const sheets = doc.getElementsByTagNameNS(ns, 'Worksheet');
    let costSheet = null;
    for (const sheet of sheets) {
      const name = sheet.getAttribute('ss:Name') || '';
      if (name === 'Cost') { costSheet = sheet; break; }
    }
    if (!costSheet) return { error: 'Feuille "Cost" introuvable. Vérifiez que le fichier est bien la matrice tarif VC.' };

    const rows = Array.from(costSheet.getElementsByTagNameNS(ns, 'Row'));

    // Fonction helper : extraire les valeurs d'une ligne avec gestion ss:Index
    function getRowVals(row) {
      const cells = Array.from(row.getElementsByTagNameNS(ns, 'Cell'));
      const vals = {};
      let colIdx = 1;
      for (const cell of cells) {
        const idxAttr = cell.getAttributeNS(ns, 'Index');
        if (idxAttr) colIdx = parseInt(idxAttr);
        const data = cell.getElementsByTagNameNS(ns, 'Data')[0];
        vals[colIdx] = data ? (data.textContent || '').trim() : '';
        colIdx++;
      }
      return vals;
    }

    // Ligne 2 contient les clés internes : vendorCode_1, asin_2, externalId_3, model_4, description_5, currentCostPrice_17
    // On lit cette ligne pour construire le colMap
    if (rows.length < 2) return { error: 'Fichier trop court.' };
    const keyRow = getRowVals(rows[1]);
    const colMap = {};
    for (const [colPos, val] of Object.entries(keyRow)) {
      const vl = val.toLowerCase();
      if (vl.startsWith('asin'))              colMap.asin   = parseInt(colPos);
      else if (vl.startsWith('model'))        colMap.sku    = parseInt(colPos);
      else if (vl.startsWith('externalid'))   colMap.ean    = parseInt(colPos);
      else if (vl.startsWith('description'))  colMap.desc   = parseInt(colPos);
      else if (vl.startsWith('currentcostprice') && !vl.includes('currency')) colMap.prix = parseInt(colPos);
      else if (vl.startsWith('vendorcode'))   colMap.vendor = parseInt(colPos);
    }

    if (!colMap.asin) return { error: 'Colonne ASIN non trouvée. Format de fichier inattendu.' };

    // Les données commencent après les lignes de header/instructions (générale. ligne 8+)
    // On détecte le début en cherchant la première ligne où la colonne ASIN ressemble à un ASIN (10 chars alphanum)
    const catalogue = [];
    const seen = new Set();

    for (let i = 4; i < rows.length; i++) {
      const vals = getRowVals(rows[i]);
      const asin = vals[colMap.asin] || '';
      if (!asin || asin.length < 8 || !/^[A-Z0-9]+$/.test(asin)) continue;

      const sku         = colMap.sku    ? (vals[colMap.sku]    || '') : '';
      const ean         = colMap.ean    ? (vals[colMap.ean]    || '') : '';
      const description = colMap.desc   ? (vals[colMap.desc]   || '') : '';
      const prixRaw     = colMap.prix   ? (vals[colMap.prix]   || '') : '';
      const vendorCode  = colMap.vendor ? (vals[colMap.vendor] || '') : '';
      const prix        = parseFloat(prixRaw.replace(',', '.')) || 0;

      // Dédoublonnage par ASIN uniquement — un ASIN peut avoir plusieurs vendorCodes mais c'est le même produit
      if (!seen.has(asin)) {
        seen.add(asin);
        catalogue.push({ asin, sku, ean, description, prixAchat: prix, vendorCode });
      }
    }

    if (catalogue.length === 0) return { error: 'Aucun ASIN extrait. Vérifiez que le fichier contient bien des données produits.' };
    return { catalogue, count: catalogue.length };

  } catch(e) {
    return { error: 'Erreur de parsing : ' + e.message };
  }
}

// ── Helper debug — v3.7.8 ─────────────────────────────────────────────────────
// Accès console : getDeliveryDefects('B00PVPXVBE')
window.getDeliveryDefects = function(asin) {
  var c = (typeof cl === 'function') ? cl() : (window.clients && window.clients[0]);
  if (!c) return null;
  var a = (c.asins || []).find(function(x) { return x.asin === asin; });
  return a ? (a.deliveryDefects || null) : null;
};
