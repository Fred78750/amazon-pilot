// Amazon Pilot — Parser CSV Vendor Central multilingue (v3.6.6.1)
// EN canonique + FR suppletif — agregation multi-pays par ASIN
// Injection via marker // @parser_vc dans core.js

// ─────────────────────────────────────────────────────────────────
// vcNorm : normalisation robuste des headers Vendor Central
// Etend norm() : apostrophes typo ‘’, tirets –—,
// espaces irreguliers    ​
// ─────────────────────────────────────────────────────────────────
function vcNorm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[‘’´`]/g, "'")
    .replace(/[–—−―]/g, '-')
    .replace(/[   ​﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────
// VC_COL_DICT : 33 champs canoniques EN <-> FR
// Valeurs EN : chaines originales Amazon
// Valeurs FR : chaines simplifiees ASCII (vcNorm leve les accents/typo)
// ─────────────────────────────────────────────────────────────────
var VC_COL_DICT = {
  asin:                            { en: ['ASIN'],                                              fr: ['ASIN'] },
  titre:                           { en: ['Product title'],                                     fr: ['Nom du produit'] },
  marque:                          { en: ['Brand'],                                             fr: ['Marque'] },
  marche:                          { en: ['Store code'],                                        fr: ['Code de la boutique'] },

  // Stock commun (Approv + Fab)
  vendor_confirmation_pct:         { en: ['Vendor confirmation %'],                             fr: ['% de confirmation fournisseur'] },
  net_received_amount:             { en: ['Net Received'],                                      fr: ['Quantite nette recue'] },
  net_received_units:              { en: ['Net Received Units'],                                fr: ["Nombre net d'unites recues"] },
  open_po_qty:                     { en: ['Open Purchase Order Quantity'],                      fr: ['Quantite de bons de commande ouverts', 'Quantite de commande en cours'] },
  receive_fill_pct:                { en: ['Receive fill %'],                                    fr: ['% de reception'] },
  vendor_lead_time_days:           { en: ['Overall Vendor Lead Time (days)'],                   fr: ['Delai de livraison global du fournisseur (jours)', "Delai d'approvisionnement global du fournisseur (jours)"] },
  aged_90_sellable_inventory:      { en: ['Aged 90+ Days Sellable Inventory'],                  fr: ['Stock vendable datant de plus de 90 jours'] },
  aged_90_sellable_units:          { en: ['Aged 90+ Days Sellable Units'],                      fr: ['Unites vendables datant de plus de 90 jours'] },
  sellable_on_hand_inventory:      { en: ['Sellable On Hand Inventory'],                        fr: ['Stock disponible a la vente', 'Stock disponible vendable'] },
  sellable_on_hand_units:          { en: ['Sellable On Hand Units'],                            fr: ['Unites vendables en stock'] },
  unsellable_on_hand_inventory:    { en: ['Unsellable On Hand Inventory'],                      fr: ['Stock disponible invendable'] },
  unsellable_on_hand_units:        { en: ['Unsellable On Hand Units'],                          fr: ['Unites invendables en stock'] },
  sell_through_pct:                { en: ['Sell-through %'],                                    fr: ['% de vente au detail'] },
  unhealthy_inventory:             { en: ['Unhealthy Inventory'],                               fr: ['Stock malsain', 'Stock en mauvaise sante'] },
  unhealthy_units:                 { en: ['Unhealthy Units'],                                   fr: ['Unites malsaines', 'Unites en mauvaise sante'] },

  // Stock_Fab uniquement
  sourceable_oos_pct:              { en: ['Sourceable product OOS %'],                          fr: ['Produits en rupture avec approvisionnement possible', '% des produits en rupture avec approvisionnement possible'] },
  unfilled_customer_ordered_units: { en: ['Unfilled Customer Ordered Units'],                   fr: ['Unites commandees par les clients non traitees'] },

  // Trafic
  glance_views:                    { en: ['Featured offer page views'],                         fr: ["Vues de la page de l'offre vedette"] },

  // Ventes commun (Approv + Fab)
  dispatched_revenue:              { en: ['Dispatched revenue'],                                fr: ["Chiffre d'affaires base sur les expeditions", 'Revenus bases sur les expeditions'] },
  dispatched_cogs:                 { en: ['Dispatched COGS'],                                   fr: ['COGS expedie'] },
  dispatched_units:                { en: ['Dispatched units'],                                  fr: ['Unites expediees'] },
  customer_returns:                { en: ['Customer returns'],                                  fr: ['Retours client', 'Retours du client'] },

  // Ventes_Fab uniquement
  ordered_revenue:                 { en: ['Ordered revenue'],                                   fr: ["Chiffre d'affaires base sur les commandes", 'Revenus bases sur les commandes'] },
  ordered_units:                   { en: ['Ordered units'],                                     fr: ['Unites commandees'] },
};

// ─────────────────────────────────────────────────────────────────
// buildVCHeaderMap : construit header CSV reel -> fieldKey
// ─────────────────────────────────────────────────────────────────
function buildVCHeaderMap(headers) {
  // Etape 1 : normKey -> fieldKey depuis le dictionnaire (EN + FR)
  var normToField = {};
  for (var fk0 in VC_COL_DICT) {
    var syn0 = VC_COL_DICT[fk0];
    ['en', 'fr'].forEach(function(lang) {
      (syn0[lang] || []).forEach(function(term) {
        var n = vcNorm(term);
        if (!normToField[n]) normToField[n] = fk0;
      });
    });
  }
  // Etape 2 : mapper les headers CSV reels -> fieldKey
  var fieldToHeader = {};
  headers.forEach(function(h) {
    var hn = vcNorm(h);
    var fk = normToField[hn];
    // Prefix match : "Sellable On Hand Inventory - Prior Period (%)" -> "sellable_on_hand_inventory"
    if (!fk) {
      for (var nk in normToField) {
        if (hn === nk || hn.startsWith(nk + ' ') || hn.startsWith(nk + '-')) {
          fk = normToField[nk]; break;
        }
      }
    }
    if (fk && !fieldToHeader[fk]) fieldToHeader[fk] = h;
  });
  return fieldToHeader; // { fieldKey: nomHeaderReel }
}

// ─────────────────────────────────────────────────────────────────
// detectVCFileType : signature de colonnes -> type de rapport
// ─────────────────────────────────────────────────────────────────
function detectVCFileType(headers) {
  var hnSet = {};
  headers.forEach(function(h) { hnSet[vcNorm(h)] = true; });

  function hasVCField(fieldKey) {
    var synset = VC_COL_DICT[fieldKey];
    if (!synset) return false;
    return ['en', 'fr'].some(function(lang) {
      return (synset[lang] || []).some(function(term) { return !!hnSet[vcNorm(term)]; });
    });
  }

  var hasOrderedRevenue = hasVCField('ordered_revenue');
  var hasDispatchedRev  = hasVCField('dispatched_revenue');
  var hasGlanceViews    = hasVCField('glance_views');
  var hasSourceableOOS  = hasVCField('sourceable_oos_pct');
  var hasVendorConfirm  = hasVCField('vendor_confirmation_pct');
  var hasSellable       = hasVCField('sellable_on_hand_inventory');

  if (hasGlanceViews)                          return 'trafic';
  if (hasOrderedRevenue)                       return 'ventes_fab';
  if (hasDispatchedRev)                        return 'ventes_approv';
  if (hasSellable && hasSourceableOOS)         return 'stock_fab';
  if (hasSellable && hasVendorConfirm)         return 'stock_approv';
  return null;
}

// ─────────────────────────────────────────────────────────────────
// parseVCFileMeta : parse la ligne 1 metadata VC (EN + FR)
// Utilise parseMetadata() de core.js (disponible dans scope - hoiste)
// ─────────────────────────────────────────────────────────────────
function parseVCFileMeta(firstLine) {
  var meta = parseMetadata(firstLine); // core.js

  // Locale : EN -> meta['locale'], FR -> meta['local']
  var localeRaw = meta['locale'] || meta['local'] || '';
  var language = null;
  if (localeRaw.toLowerCase().startsWith('en')) language = 'en';
  else if (localeRaw.toLowerCase().startsWith('fr')) language = 'fr';

  // Pays : EN -> meta['countries'], FR -> meta['pays']
  var countriesRaw = meta['countries'] || meta['pays'] || '';
  var countries = countriesRaw
    ? countriesRaw.split(';').map(function(c) { return c.trim(); }).filter(Boolean)
    : [];

  // Vue distributeur
  var apercu = meta['distributor view'] || meta['apercu du distributeur.']
    || meta['apercu du distributeur'] || meta['distributor view.'] || '';
  var distributorView = (
    apercu.toLowerCase().includes('sourcing') ||
    apercu.toLowerCase().includes('approvisionnement')
  ) ? 'appro' : 'fab';

  // Periode
  var viewRange = meta['viewing range'] || meta['champ de vision.'] || meta['champ de vision'] || '';
  var periodStart = null, periodEnd = null;
  var pmatch = viewRange.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
  if (pmatch) { periodStart = pmatch[1]; periodEnd = pmatch[2]; }

  // Intervalle
  var intervalMeta = meta['reporting range'] || meta['intervalle des rapports'] || meta['intervalle'] || '';

  // Entreprise
  var company = meta['businesses'] || meta['entreprises'] || '';

  return {
    language: language, countries: countries, distributorView: distributorView,
    periodStart: periodStart, periodEnd: periodEnd,
    intervalMeta: intervalMeta, company: company
  };
}

// ─────────────────────────────────────────────────────────────────
// parseVCFile : parser principal CSV Vendor Central
// ─────────────────────────────────────────────────────────────────
function parseVCFile(text, filename) {
  var errors = [], warnings = [];

  // Strip BOM UTF-8 (﻿)
  if (text && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  var lines = (text || '').split('\n');
  if (lines.length < 2) {
    return { ok: false, errors: ['Fichier vide ou trop court'], warnings: [] };
  }

  // ── Metadata ligne 1 ──────────────────────────────────────────
  var meta = parseVCFileMeta(lines[0]);
  var language = meta.language;

  // ── Headers ligne 2 : detection format encapsule ──────────────
  // Encapsule (vieux exports FR multi-pays) : ligne 2 = "ASIN,""Nom du produit"",..."
  // Standard (EN + nouveaux exports)        : ligne 2 = ASIN,"Product title",...
  var rawLines = lines.slice(1);
  var headerLine = rawLines[0] ? rawLines[0].trim() : '';
  var isEncapsulated = headerLine.startsWith('"ASIN,') || headerLine.startsWith('"asin,');

  var csvText, papaConfig;
  if (isEncapsulated) {
    var unescaped = rawLines
      .filter(function(l) { return l.trim(); })
      .map(function(l) {
        var s = l.trim();
        if (s.startsWith('"')) s = s.slice(1);
        s = s.replace(/"[;]*$/, '');
        s = s.replace(/""/g, '"');
        return s;
      })
      .join('\n');
    csvText = unescaped;
    papaConfig = { header: true, skipEmptyLines: true, delimiter: ',' };
    log('Format multi-pays encapsule detecte — desencapsulation activee');
  } else {
    csvText = rawLines.join('\n');
    papaConfig = { header: true, skipEmptyLines: true };
  }

  var res = Papa.parse(csvText, papaConfig);
  if (!res || !res.data || !res.data.length) {
    return { ok: false, errors: ['Aucune donnee parsee (fichier vide ou mal forme)'], warnings: warnings };
  }

  var headers = res.meta.fields || [];

  // ── Detection langue par heuristique sur headers (fallback) ───
  if (!language) {
    var hasProductTitle = headers.some(function(h) { return vcNorm(h) === 'product title'; });
    var hasNomProduit   = headers.some(function(h) { return vcNorm(h) === 'nom du produit'; });
    if (hasProductTitle)    language = 'en';
    else if (hasNomProduit) language = 'fr';
    else                    language = 'en';
    warnings.push('Locale absent des metadonnees — langue detectee : ' + language);
  }

  // ── Detection type de rapport ─────────────────────────────────
  var vcType = detectVCFileType(headers);
  if (!vcType) {
    return {
      ok: false,
      errors: ["Format non reconnu — verifier qu'il s'agit d'un export Vendor Central hebdomadaire (Ventes, Trafic ou Stock ASIN)."],
      warnings: warnings
    };
  }

  // ── Construction fieldMap header -> fieldKey ──────────────────
  var fieldMap = buildVCHeaderMap(headers);

  // ── Detection multi-pays ──────────────────────────────────────
  var marcheHeader = fieldMap['marche'];
  var isMultiCountry = !!marcheHeader;

  var countriesDetected = meta.countries.length > 0 ? meta.countries.slice() : [];
  if (isMultiCountry && countriesDetected.length === 0) {
    var marcheSet = {};
    res.data.forEach(function(row) {
      var v = (row[marcheHeader] || '').trim();
      if (v) marcheSet[v] = true;
    });
    countriesDetected = Object.keys(marcheSet);
  }

  // ── Periodes ──────────────────────────────────────────────────
  var periodStart = meta.periodStart;
  var periodEnd   = meta.periodEnd;

  if (!periodEnd && filename) {
    var fn = filename.normalize('NFD').replace(/[̀-ͯ]/g, '');
    var fdm1 = fn.match(/[Dd]atedefin[_\s]+(\d{2}-\d{2}-\d{4})[_\s]+(\d{2}-\d{2}-\d{4})/i);
    var fdm2 = !fdm1 ? fn.match(/(\d{2}-\d{2}-\d{4})[_\s]+(\d{2}-\d{2}-\d{4})/) : null;
    var fdmM = fdm1 || fdm2;
    if (fdmM) {
      periodStart = fdmM[1].replace(/-/g, '/');
      periodEnd   = fdmM[2].replace(/-/g, '/');
    }
  }

  var periodType = detectPeriodType(periodStart, periodEnd, meta.intervalMeta);

  // ── Champs numeriques a sommer lors de l'agregation ───────────
  var NUM_SUM = [
    'net_received_amount', 'net_received_units', 'open_po_qty',
    'aged_90_sellable_inventory', 'aged_90_sellable_units',
    'sellable_on_hand_inventory', 'sellable_on_hand_units',
    'unsellable_on_hand_inventory', 'unsellable_on_hand_units',
    'unhealthy_inventory', 'unhealthy_units', 'unfilled_customer_ordered_units',
    'glance_views',
    'dispatched_revenue', 'dispatched_cogs', 'dispatched_units', 'customer_returns',
    'ordered_revenue', 'ordered_units'
  ];

  // ── Parsing + agregation par ASIN ─────────────────────────────
  var asinMap = {};

  res.data.forEach(function(row) {
    var asinH = fieldMap['asin'] || 'ASIN';
    var asin  = (row[asinH] || row['ASIN'] || '').trim();
    if (!asin || asin.length < 5) return;

    var existing = asinMap[asin];
    if (!existing) {
      var entry = { asin: asin };
      entry.titre  = fieldMap['titre']  ? (row[fieldMap['titre']]  || '') : '';
      entry.marque = fieldMap['marque'] ? (row[fieldMap['marque']] || '') : '';
      NUM_SUM.forEach(function(fk) {
        entry[fk] = fieldMap[fk] ? parseNum(row[fieldMap[fk]]) : 0;
      });
      // Champs ratio/texte : premier marche uniquement
      entry.vendor_confirmation_pct = fieldMap['vendor_confirmation_pct'] ? (row[fieldMap['vendor_confirmation_pct']] || '') : '';
      entry.receive_fill_pct        = fieldMap['receive_fill_pct']        ? (row[fieldMap['receive_fill_pct']]        || '') : '';
      entry.vendor_lead_time_days   = fieldMap['vendor_lead_time_days']   ? (row[fieldMap['vendor_lead_time_days']]   || '') : '';
      entry.sell_through_pct        = fieldMap['sell_through_pct']        ? (row[fieldMap['sell_through_pct']]        || '') : '';
      entry.sourceable_oos_pct      = fieldMap['sourceable_oos_pct']      ? (row[fieldMap['sourceable_oos_pct']]      || '') : '';
      asinMap[asin] = entry;
    } else if (isMultiCountry) {
      // Accumulation multi-pays : sommer les valeurs numeriques
      NUM_SUM.forEach(function(fk) {
        if (fieldMap[fk]) existing[fk] = (existing[fk] || 0) + parseNum(row[fieldMap[fk]]);
      });
    }
  });

  var rows = Object.keys(asinMap).map(function(k) { return asinMap[k]; });

  // ── Sanity check ─────────────────────────────────────────────
  if (rows.length === 0) {
    return { ok: false, errors: ['Aucun ASIN valide trouve dans le fichier'], warnings: warnings };
  }

  var validASINs = rows.filter(function(r) { return /^B0[A-Z0-9]{8}$/i.test(r.asin); }).length;
  if (validASINs / rows.length < 0.8) {
    warnings.push('Moins de 80% ASINs au format Amazon standard : ' + validASINs + '/' + rows.length);
  }

  // Seuil minimal KPI : >= 5% de lignes avec valeur > 0
  var kpiFieldMap = {
    trafic: 'glance_views', ventes_approv: 'dispatched_revenue',
    ventes_fab: 'ordered_revenue', stock_approv: 'sellable_on_hand_inventory',
    stock_fab: 'sellable_on_hand_inventory'
  };
  var kpiField = kpiFieldMap[vcType];
  if (kpiField && rows.length > 5) {
    var kpiCount = rows.filter(function(r) { return (r[kpiField] || 0) > 0; }).length;
    if (kpiCount / rows.length < 0.05) {
      errors.push('Format non reconnu ou fichier corrompu : ' + kpiCount + '/' + rows.length + ' lignes avec ' + kpiField + ' > 0.');
      return { ok: false, errors: errors, warnings: warnings };
    }
  }

  // ── Market legacy ─────────────────────────────────────────────
  var mktCodes = (typeof MARKET_CODES !== 'undefined') ? MARKET_CODES : {};
  var market = meta.countries.length === 1 ? (mktCodes[meta.countries[0]] || '.fr') : '.fr';

  return {
    ok: true,
    vcType: vcType,
    language: language,
    isMultiCountry: isMultiCountry,
    rows: rows,
    countriesDetected: countriesDetected,
    aggregationApplied: isMultiCountry,
    errors: errors,
    warnings: warnings,
    periodStart: periodStart,
    periodEnd:   periodEnd,
    periodType:  periodType,
    distributorView: meta.distributorView,
    company:     meta.company,
    market:      market
  };
}
