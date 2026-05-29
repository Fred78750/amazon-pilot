// Amazon Pilot — YoY Étape 3a : Enquête ASINs disparus
// v3.6.8 — Classification algorithme + Section Marques alias + Section Anomalies + Fiche détail À CREUSER
// Module injecté via // @yoy (avant parser_po.js dans build.py)

// ═══════════════════════════════════════════════════════════════
// CONSTANTE — 9 codes disponibilité Vendor Central
// ═══════════════════════════════════════════════════════════════

var VC_AVAILABILITY_CODES = {
  'AC': { family: 'accepted_real',       meaning: 'Accepté confirmé manuellement, stock OK' },
  'IA': { family: 'accepted_blind',      meaning: 'Accepté EDI uniquement (statut réel inconnu)' },
  'IR': { family: 'out_temp',            meaning: 'Rupture temporaire' },
  'OS': { family: 'out_temp',            meaning: 'Rupture temporaire (saisie ADV imprécise)' },
  'CK': { family: 'out_perm',            meaning: 'Rupture longue / refus fournisseur' },
  'CP': { family: 'discontinued',        meaning: 'Fin de série / sortie organisée' },
  'CQ': { family: 'commercial_minimum',  meaning: 'Franco non atteint' },
  'R2': { family: 'commercial_price',    meaning: 'Prix de cession refusé' },
  'CA': { family: 'not_yet',             meaning: 'Pré-lancement, pas encore commandable' }
};

// ═══════════════════════════════════════════════════════════════
// NORMALISATION MARQUES — conservatrice (brief §9.5)
// ═══════════════════════════════════════════════════════════════

function normalizeBrand(brand) {
  if (!brand) return '';
  return brand
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // suppression accents
    .replace(/\s+/g, ' ')                               // espaces multiples → 1
    .trim();
}

/**
 * Résoudre les alias : si normalizedBrand figure dans variants[] d'un alias,
 * retourner son canonical normalisé ; sinon retourner normalizedBrand tel quel.
 */
function resolveBrandAlias(normalizedBrand, brandAliases) {
  if (!brandAliases || !brandAliases.length) return normalizedBrand;
  for (var i = 0; i < brandAliases.length; i++) {
    var al = brandAliases[i];
    var variants = al.variants || [];
    for (var j = 0; j < variants.length; j++) {
      if (normalizeBrand(variants[j]) === normalizedBrand) {
        return normalizeBrand(al.canonical);
      }
    }
  }
  return normalizedBrand;
}

// ═══════════════════════════════════════════════════════════════
// CACHE ENQUÊTE (mémoire session uniquement — pas en IDB)
// ═══════════════════════════════════════════════════════════════

var _enqueteCache = {
  clientId: null,
  posHash: null,  // hash léger : c.pos.length + dernier importedAt
  result: null
};

function _enquetePosHash(client) {
  var pos = client.pos || [];
  var last = pos.length > 0 ? (pos[pos.length - 1].importedAt || '') : '';
  return pos.length + '|' + last;
}

// ═══════════════════════════════════════════════════════════════
// ALGORITHME PRINCIPAL — classification ASINs disparus (Q1=c)
// ═══════════════════════════════════════════════════════════════

/**
 * classifyMissingASINs(client, disparus, dRef)
 *
 * @param {Object} client      — objet client complet (c.pos, c.accounts, c.asins, ...)
 * @param {Array}  disparus    — dim7.disparus : [{ asin, titre, marque, caRefPerDay, caAPerDay }]
 * @param {number} dRef        — durée période de référence en jours (pour info seulement)
 * @returns {Object}           — { cat1_mortality, cat2_investigate, cat3_others, raw, meta }
 */
function classifyMissingASINs(client, disparus, dRef) {
  var months = (client.enquetePeriodMonths != null ? client.enquetePeriodMonths : 4);
  var today = new Date();
  var windowStart = new Date(today);
  windowStart.setMonth(windowStart.getMonth() - months);

  // ── Identifier les vendorCodes "Bon de Commande" ──
  var accounts = client.accounts || [];
  var boVendorCodes = new Set(
    accounts.filter(function(a) { return a.role === 'BO'; }).map(function(a) { return a.vendorCode; })
  );
  // Fallback : si c.accounts vide, tous les VCs dans c.pos sont considérés BO
  if (boVendorCodes.size === 0 && (client.pos || []).length > 0) {
    (client.pos).forEach(function(p) { if (p.vendorCode) boVendorCodes.add(p.vendorCode); });
  }

  // ── Index POs (O(n)) — uniquement POItemExport + BO + dans la fenêtre ──
  var posByAsin = {};
  var legacyPOsCount = 0;
  var allPos = client.pos || [];
  for (var pi = 0; pi < allPos.length; pi++) {
    var po = allPos[pi];
    if (po.source !== 'POItemExport') { legacyPOsCount++; continue; }
    if (!boVendorCodes.has(po.vendorCode)) continue;
    var d = new Date(po.orderDate);
    if (isNaN(d) || d < windowStart || d > today) continue;
    var akey = po.asin;
    if (!posByAsin[akey]) posByAsin[akey] = [];
    posByAsin[akey].push(po);
  }

  // ── Index stock Amazon Retail (sellableUnits depuis c.asins) ──
  // Correction critique #1 : utiliser c.asins[i].sellableUnits (Stock_ASIN_Fabrication)
  var stockByAsin = {};
  var clientAsins = client.asins || [];
  for (var si = 0; si < clientAsins.length; si++) {
    var a = clientAsins[si];
    if (a.asin) stockByAsin[a.asin] = a.sellableUnits != null ? a.sellableUnits : 0;
  }

  // ── Classification ──
  var results = { A1: [], A2: [], B: [], C: [], D1: [], D2: [], R: [] };

  for (var di = 0; di < disparus.length; di++) {
    var row = disparus[di];
    var asin = row.asin;
    var pos = posByAsin[asin] || [];

    if (pos.length === 0) {
      // Aucun PO BO POItemExport dans la fenêtre
      var stock = stockByAsin[asin] != null ? stockByAsin[asin] : 0;
      if (stock === 0) {
        results.A1.push({ asin: asin, reason: 'Mortalité confirmée', caRefPerDay: row.caRefPerDay, titre: row.titre, marque: row.marque });
      } else {
        results.A2.push({ asin: asin, subcat: 'A2', reason: 'Stock dormant', stock: stock, caRefPerDay: row.caRefPerDay, titre: row.titre, marque: row.marque });
      }
    } else {
      // Trouver le DERNIER PO par orderDate (secondaire : poId asc — correction #3)
      var lastPO = pos.reduce(function(best, p) {
        var dB = new Date(best.orderDate), dP = new Date(p.orderDate);
        if (dP > dB) return p;
        if (dP < dB) return best;
        return (p.poId || '') < (best.poId || '') ? p : best;  // poId asc comme tiebreak
      });
      var code = lastPO.availabilityCode || 'UNKNOWN';
      var daysOld = Math.floor((today - new Date(lastPO.orderDate)) / 86400000);

      if (code === 'CP') {
        results.B.push({ asin: asin, code: code, subcat: 'B', reason: 'Sortie organisée', lastPO: lastPO, caRefPerDay: row.caRefPerDay, titre: row.titre, marque: row.marque });

      } else if (code === 'CK') {
        results.B.push({ asin: asin, code: code, subcat: 'B', reason: 'Refus / Rupture permanente', lastPO: lastPO, caRefPerDay: row.caRefPerDay, titre: row.titre, marque: row.marque });

      } else if ((code === 'IR' || code === 'OS') && daysOld > 90) {
        results.B.push({ asin: asin, code: code, subcat: 'B', reason: 'Hémorragie longue (>' + daysOld + 'j)', lastPO: lastPO, caRefPerDay: row.caRefPerDay, titre: row.titre, marque: row.marque });

      } else if (code === 'CQ' || code === 'R2') {
        results.R.push({ asin: asin, code: code, subcat: 'R', reason: 'Désaccord commercial', lastPO: lastPO, caRefPerDay: row.caRefPerDay, titre: row.titre, marque: row.marque });

      } else if ((code === 'IR' || code === 'OS') && daysOld <= 90) {
        results.C.push({ asin: asin, code: code, subcat: 'C', reason: 'Rupture temporaire récente (' + daysOld + 'j)', lastPO: lastPO, caRefPerDay: row.caRefPerDay, titre: row.titre, marque: row.marque });

      } else if (code === 'IA' && lastPO.poStatus === 'confirmed') {
        results.D2.push({ asin: asin, code: code, subcat: 'D2', reason: 'PO en cours', lastPO: lastPO, caRefPerDay: row.caRefPerDay, titre: row.titre, marque: row.marque });

      } else if (code === 'IA' && lastPO.poStatus === 'closed') {
        results.D1.push({ asin: asin, code: code, subcat: 'D1', reason: 'Mystère (IA clôturé)', lastPO: lastPO, caRefPerDay: row.caRefPerDay, titre: row.titre, marque: row.marque });

      } else if (code === 'AC') {
        results.D1.push({ asin: asin, code: code, subcat: 'D1', reason: 'Mystère (AC en stock mais absent)', lastPO: lastPO, caRefPerDay: row.caRefPerDay, titre: row.titre, marque: row.marque });

      } else {
        // CA, UNKNOWN, IA sans poStatus résolu → D1 conservateur
        results.D1.push({ asin: asin, code: code, subcat: 'D1', reason: 'Mystère (code: ' + code + ')', lastPO: lastPO, caRefPerDay: row.caRefPerDay, titre: row.titre, marque: row.marque });
      }
    }
  }

  // Trier cat2 par caRefPerDay décroissant (ASINs à plus fort enjeu en premier)
  var cat2 = [].concat(results.A2, results.D1, results.D2, results.R)
    .sort(function(a, b) { return (b.caRefPerDay || 0) - (a.caRefPerDay || 0); });

  return {
    cat1_mortality:    results.A1.sort(function(a, b) { return (b.caRefPerDay || 0) - (a.caRefPerDay || 0); }),
    cat2_investigate:  cat2,
    cat3_others:       [].concat(results.B, results.C).sort(function(a, b) { return (b.caRefPerDay || 0) - (a.caRefPerDay || 0); }),
    raw: results,
    meta: {
      computed: new Date().toISOString(),
      periodMonths: months,
      totalMissing: disparus.length,
      hasLegacyPOs: legacyPOsCount > 0,
      legacyPOsCount: legacyPOsCount
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// CALCUL DIM10 AVEC ALIAS (intégré dans yoy.js calc section)
// Fonction utilitaire appelée depuis la zone dim10 de calcYoYDims
// ═══════════════════════════════════════════════════════════════

/**
 * calcBrandAggs(rowsRef, rowsA, dRef, dA, brandAliases)
 * Calcule les agrégats de CA par marque avec normalisation + alias.
 * Retourne { bMapRef, bMapA } — maps marque_canonique → CA/j
 */
function calcBrandAggs(rowsRef, rowsA, dRef, dA, brandAliases) {
  var aliases = brandAliases || [];

  function getBrand(row) {
    var raw = (row.marque || 'Inconnue').trim();
    var normalized = normalizeBrand(raw);
    var resolved = resolveBrandAlias(normalized, aliases);
    return resolved || 'INCONNUE';
  }

  var bMapRef = {}, bMapA = {};
  rowsRef.forEach(function(r) {
    var m = getBrand(r);
    bMapRef[m] = (bMapRef[m] || 0) + (r.ca_cmd || 0) / dRef;
  });
  rowsA.forEach(function(r) {
    var m = getBrand(r);
    bMapA[m] = (bMapA[m] || 0) + (r.ca_cmd || 0) / dA;
  });
  return { bMapRef: bMapRef, bMapA: bMapA };
}

// ═══════════════════════════════════════════════════════════════
// RENDU HTML — SECTION ENQUÊTE (insérée après s6 dans renderYoYResult)
// ═══════════════════════════════════════════════════════════════

/**
 * renderEnqueteSection(client, dims, dRef)
 * @returns {string} HTML complet de la section Enquête
 */
function renderEnqueteSection(client, dims, dRef) {
  var d7 = dims.dim7 || {};
  var disparus = d7.disparus || [];

  // Vérifier si POs POItemExport présents
  var posItemExport = (client.pos || []).filter(function(p) { return p.source === 'POItemExport'; });
  var hasPOItemExport = posItemExport.length > 0;

  // Warning si pas de POs (Q3) ou POs legacy (Q4)
  var warningHtml = '';
  if (!hasPOItemExport) {
    warningHtml = '<div style="padding:10px 14px;background:var(--a-bg,#fff8e1);border:1px solid var(--a-bd,#f0c040);border-radius:var(--rdl);margin-bottom:14px;font-size:12px">'
      + '⚠️ <strong>Classification partielle</strong> — aucun Bon de Commande (POItemExport) importé. '
      + 'Les résultats ci-dessous sont basés sur le stock uniquement (catégories A1/A2). '
      + '<button class="btn btn-xs" onclick="go(\'clients\')" style="margin-left:8px">Importer les POs →</button>'
      + '</div>';
  } else {
    var legacyCount = (client.pos || []).filter(function(p) { return p.source !== 'POItemExport'; }).length;
    if (legacyCount > 0) {
      warningHtml = '<div style="padding:8px 12px;background:var(--b-bg,#e8f0fb);border:1px solid var(--b-bd,#b0c8f0);border-radius:var(--rdl);margin-bottom:12px;font-size:11px;color:var(--tx2)">'
        + 'ℹ️ ' + legacyCount + ' PO(s) au format ancien détecté(s) — ignorés pour la classification. Réimportez via POItemExport CSV pour une classification complète.'
        + '</div>';
    }
  }

  if (disparus.length === 0) {
    return '<div class="yoy-section" id="yoy-sec-enquete">'
      + '<h3 class="yoy-section-title">Enquête ASINs disparus</h3>'
      + '<p class="yoy-section-para" style="color:var(--tx3)">Aucun ASIN disparu à classifier sur cette période.</p>'
      + '</div>';
  }

  // Lancer la classification (avec cache Q1=c)
  var enquete = null;
  var cHash = _enquetePosHash(client);
  if (_enqueteCache.clientId === client.id && _enqueteCache.posHash === cHash && _enqueteCache.result) {
    enquete = _enqueteCache.result;
  } else {
    enquete = classifyMissingASINs(client, disparus, dRef);
    _enqueteCache.clientId = client.id;
    _enqueteCache.posHash = cHash;
    _enqueteCache.result = enquete;
  }

  var cat1 = enquete.cat1_mortality;
  var cat2 = enquete.cat2_investigate;
  var cat3 = enquete.cat3_others;
  var meta = enquete.meta;

  var computedStr = meta.computed ? new Date(meta.computed).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

  var html = '<div class="yoy-section" id="yoy-sec-enquete">';
  html += '<div class="yoy-section-header"><h3 class="yoy-section-title">Enquête ASINs disparus — ' + disparus.length + ' classifiés</h3>'
    + '<span style="font-size:10px;color:var(--tx3);margin-left:8px">Calculé le ' + computedStr + ' · Fenêtre PO : ' + meta.periodMonths + ' mois</span></div>';

  html += warningHtml;

  // ── Résumé 3 catégories ──
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px">';
  var cats = [
    { label: 'Mortalité naturelle', count: cat1.length, color: '#94a3b8', bg: '#f1f5f9', desc: 'Pas d\'action', code: 'A1' },
    { label: 'À CREUSER', count: cat2.length, color: '#d97706', bg: '#fff8e1', desc: 'Investigation requise', code: 'A2+D' },
    { label: 'Autres', count: cat3.length, color: '#475569', bg: 'var(--b-bg,#f0f4f8)', desc: 'Géré au fil de l\'eau', code: 'B+C' }
  ];
  cats.forEach(function(cat) {
    html += '<div style="padding:12px 14px;background:' + cat.bg + ';border:1px solid ' + cat.color + '33;border-radius:var(--rdl);text-align:center">'
      + '<div style="font-size:22px;font-weight:800;color:' + cat.color + '">' + cat.count + '</div>'
      + '<div style="font-size:12px;font-weight:600;color:' + cat.color + ';margin-bottom:2px">' + esc(cat.label) + '</div>'
      + '<div style="font-size:10px;color:var(--tx3)">' + esc(cat.desc) + '</div>'
      + '</div>';
  });
  html += '</div>';

  // ── Index stock Amazon Retail (sellableUnits) — reconstruit localement pour le rendu ──
  var stockByAsin = {};
  (client.asins || []).forEach(function(a) {
    if (a.asin) stockByAsin[a.asin] = a.sellableUnits != null ? a.sellableUnits : 0;
  });

  // Couleurs sous-catégories — hoistées avant les deux blocs qui les utilisent
  var subcatColors = { A2: '#0ea5e9', D1: '#8b5cf6', D2: '#16a34a', R: '#dc2626' };
  var subcatLabels = { A2: 'A2 Stock dormant', D1: 'D1 Mystère', D2: 'D2 PO en cours', R: 'R Désaccord' };

  // ── Catégorie 2 : À CREUSER (table expandable — option α) ──
  html += '<div style="margin-bottom:20px">';
  html += '<div style="font-size:13px;font-weight:700;color:#d97706;margin-bottom:8px">🔍 À CREUSER (' + cat2.length + ' ASINs) — investigation par ASIN</div>';

  if (cat2.length === 0) {
    html += '<p class="yoy-section-para" style="color:var(--tx3)">Aucun ASIN dans cette catégorie.</p>';
  } else {
    html += '<table class="yoy-table" style="font-size:12px">'
      + '<thead><tr>'
      + '<th style="width:60px">Cat.</th>'
      + '<th style="width:110px">ASIN</th>'
      + '<th>Titre</th>'
      + '<th style="width:80px">Code</th>'
      + '<th style="width:90px">Dernier PO</th>'
      + '<th class="num" style="width:70px">CA réf./j</th>'
      + '<th style="width:20px"></th>'
      + '</tr></thead><tbody>';

    cat2.forEach(function(item) {
      var sc = item.subcat || 'D1';
      var color = subcatColors[sc] || '#475569';
      var lastPODateStr = item.lastPO && item.lastPO.orderDate ? item.lastPO.orderDate.slice(0, 10) : '—';
      var codeStr = item.code ? ('<span title="' + esc((VC_AVAILABILITY_CODES[item.code] || {}).meaning || '') + '">' + esc(item.code) + '</span>') : (sc === 'A2' ? '—' : '?');
      var caFmt = item.caRefPerDay != null ? yoyFmtEur(item.caRefPerDay) : '—';
      var titleShort = (item.titre || '').slice(0, 55) + ((item.titre || '').length > 55 ? '…' : '');

      html += '<tr class="enquete-row" data-asin="' + esc(item.asin) + '" data-expanded="false" onclick="toggleEnqueteRow(this)" style="cursor:pointer">'
        + '<td><span style="font-size:10px;font-weight:600;color:' + color + ';padding:2px 5px;border:1px solid ' + color + '44;border-radius:3px">' + esc(sc) + '</span></td>'
        + '<td style="font-family:monospace;font-size:11px">' + esc(item.asin) + '</td>'
        + '<td title="' + esc(item.titre || '') + '">' + esc(titleShort) + '</td>'
        + '<td>' + codeStr + '</td>'
        + '<td>' + lastPODateStr + '</td>'
        + '<td class="num">' + caFmt + '</td>'
        + '<td style="text-align:center;color:var(--tx3);font-size:10px">▶</td>'
        + '</tr>';

      // Ligne détail (cachée par défaut)
      var stockStr = (item.asin && typeof stockByAsin !== 'undefined' && stockByAsin[item.asin] != null)
        ? stockByAsin[item.asin] + ' unités'
        : '—';
      // Lien VC : utiliser le market du sous-compte du dernier PO si disponible
      var vcMarket = '.fr';
      if (item.lastPO && item.lastPO.vendorCode) {
        var accts = client.accounts || [];
        var matchAcct = accts.find(function(a) { return a.vendorCode === item.lastPO.vendorCode; });
        if (matchAcct && matchAcct.market) vcMarket = matchAcct.market;
      }
      var vcUrl = 'https://vendorcentral.amazon' + vcMarket + '/abis/listing/edit/product_details?asin=' + encodeURIComponent(item.asin)
        + (item.lastPO && item.lastPO.vendorCode ? '&vendorCode=' + encodeURIComponent(item.lastPO.vendorCode) : '');
      var subcatFullLabel = subcatLabels[sc] || sc;
      var poDetail = item.lastPO
        ? 'PO <strong>' + esc(item.lastPO.poId || '—') + '</strong> · '
          + 'Dispo : <strong>' + esc(item.code || '—') + '</strong> · '
          + 'Statut : <strong>' + esc(item.lastPO.status || '—') + '</strong>'
        : 'Aucun PO dans la fenêtre de ' + meta.periodMonths + ' mois';

      html += '<tr class="enquete-detail-row" data-asin="' + esc(item.asin) + '" style="display:none;background:var(--b-bg,#f0f4f8)">'
        + '<td colspan="7" style="padding:10px 14px">'
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:12px">'
        + '<div><div style="font-weight:600;color:var(--tx2);margin-bottom:2px">Sous-catégorie</div><div>' + esc(subcatFullLabel) + '</div>'
        + '<div style="color:var(--tx3);margin-top:2px">' + esc(item.reason || '') + '</div></div>'
        + '<div><div style="font-weight:600;color:var(--tx2);margin-bottom:2px">Dernier PO</div><div>' + poDetail + '</div></div>'
        + '<div><div style="font-weight:600;color:var(--tx2);margin-bottom:2px">Stock Amazon actuel</div><div>' + esc(stockStr) + '</div></div>'
        + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'
        + '<a href="' + esc(vcUrl) + '" target="_blank" class="btn btn-xs" style="text-decoration:none">↗ Fiche VC</a>'
        // Fix v3.6.8e : JSON.stringify(asin) → '"B01..."' terminait l'attribut — utiliser single-quote
        + '<button class="btn btn-xs" onclick="event.stopPropagation();goToAsinsYoY([\'' + item.asin + '\'],\'Enquête: ' + esc(item.asin) + '\')">🔍 Analyse ASINs →</button>'
        + '</div>'
        + '</td></tr>';
    });

    html += '</tbody></table>';
  }
  html += '</div>';

  // ── Catégorie 3 : Autres (liste compacte) ──
  if (cat3.length > 0) {
    html += '<div style="margin-bottom:16px">';
    html += '<div style="font-size:13px;font-weight:600;color:var(--tx2);margin-bottom:6px">Autres (' + cat3.length + ' ASINs) — géré au fil de l\'eau</div>';
    html += '<table class="yoy-table" style="font-size:11px">'
      + '<thead><tr><th style="width:60px">Cat.</th><th style="width:110px">ASIN</th><th>Titre</th><th>Code</th><th>Raison</th><th class="num">CA réf./j</th></tr></thead><tbody>';
    var subcatColorsB = { B: '#64748b', C: '#0891b2' };
    cat3.forEach(function(item) {
      var sc = item.subcat || 'B';
      var color = subcatColorsB[sc] || '#64748b';
      var caFmt = item.caRefPerDay != null ? yoyFmtEur(item.caRefPerDay) : '—';
      html += '<tr>'
        + '<td><span style="font-size:10px;font-weight:600;color:' + color + '">' + esc(sc) + '</span></td>'
        + '<td style="font-family:monospace;font-size:11px">' + esc(item.asin) + '</td>'
        + '<td title="' + esc(item.titre || '') + '">' + esc((item.titre || '').slice(0, 45)) + '</td>'
        + '<td>' + esc(item.code || '—') + '</td>'
        + '<td style="color:var(--tx2)">' + esc(item.reason || '—') + '</td>'
        + '<td class="num">' + caFmt + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }

  // ── Catégorie 1 : Mortalité (compacte) ──
  if (cat1.length > 0) {
    html += '<details style="margin-bottom:8px">';
    html += '<summary style="font-size:12px;color:var(--tx3);cursor:pointer">Mortalité naturelle (' + cat1.length + ' ASINs, sans action)</summary>';
    html += '<table class="yoy-table" style="font-size:11px;margin-top:6px">'
      + '<thead><tr><th style="width:110px">ASIN</th><th>Titre</th><th class="num">CA réf./j</th></tr></thead><tbody>';
    cat1.forEach(function(item) {
      html += '<tr>'
        + '<td style="font-family:monospace;font-size:11px">' + esc(item.asin) + '</td>'
        + '<td title="' + esc(item.titre || '') + '">' + esc((item.titre || '').slice(0, 55)) + '</td>'
        + '<td class="num">' + yoyFmtEur(item.caRefPerDay || 0) + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></details>';
  }

  // ── Plan d'action P1 — CTA 8 (3 ASINs Free) ──
  var top3Cat2 = cat2.slice(0, 3);
  if (top3Cat2.length > 0) {
    html += '<div style="margin-top:18px;padding:14px;background:var(--g-bg);border:1px solid var(--g-bd);border-radius:var(--rdl)">';
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:8px">Plan d\'action P1 — Top ' + top3Cat2.length + ' ASINs prioritaires</div>';
    html += '<table class="yoy-table" style="font-size:12px;margin-bottom:10px">'
      + '<thead><tr><th>Cat.</th><th>ASIN</th><th>Titre</th><th class="num">CA réf./j</th></tr></thead><tbody>';
    top3Cat2.forEach(function(item) {
      var sc = item.subcat || 'D1';
      html += '<tr>'
        + '<td><span style="font-size:10px;font-weight:600;color:' + (subcatColors[sc] || '#475569') + '">' + esc(sc) + '</span></td>'
        + '<td style="font-family:monospace;font-size:11px">' + esc(item.asin) + '</td>'
        + '<td title="' + esc(item.titre || '') + '">' + esc((item.titre || '').slice(0, 50)) + '</td>'
        + '<td class="num">' + yoyFmtEur(item.caRefPerDay || 0) + '</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    var top3Ids = top3Cat2.map(function(i) { return i.asin; });
    html += '<button class="btn btn-p" onclick="goToAsinsYoY(' + JSON.stringify(top3Ids) + ', \'Enquête P1 — Top 3 ASINs\')">🚀 Démarrer l\'audit dans Analyse ASINs →</button>';
    html += '<span style="font-size:10px;color:var(--tx3);margin-left:12px">Vue Free — 3 ASINs prioritaires</span>';
    html += '</div>';
  }

  html += '</div>'; // .yoy-section
  return html;
}

// ═══════════════════════════════════════════════════════════════
// TOGGLE LIGNE EXPANDABLE (option α)
// ═══════════════════════════════════════════════════════════════

function toggleEnqueteRow(tr) {
  var asin = tr.getAttribute('data-asin');
  var expanded = tr.getAttribute('data-expanded') === 'true';
  var detailRow = tr.nextElementSibling;
  if (!detailRow || !detailRow.classList.contains('enquete-detail-row')) return;

  if (expanded) {
    tr.setAttribute('data-expanded', 'false');
    detailRow.style.display = 'none';
    var icon = tr.querySelector('td:last-child');
    if (icon) icon.textContent = '▶';
  } else {
    tr.setAttribute('data-expanded', 'true');
    detailRow.style.display = '';
    var icon = tr.querySelector('td:last-child');
    if (icon) icon.textContent = '▼';
  }
}

// Exposer sur window pour usage cross-module
window.renderEnqueteSection = renderEnqueteSection;
window.toggleEnqueteRow = toggleEnqueteRow;
window.classifyMissingASINs = classifyMissingASINs;
window.normalizeBrand = normalizeBrand;
window.resolveBrandAlias = resolveBrandAlias;
window.calcBrandAggs = calcBrandAggs;
window.VC_AVAILABILITY_CODES = VC_AVAILABILITY_CODES;
