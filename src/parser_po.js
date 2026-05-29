// Amazon Pilot — Parser POItemExport (Vendor Central)
// v3.6.8 — FR (BdC,...) + EN (PO,...) · BOM UTF-8 · date DD-MonAbbr-YYYY
// Injection via // @yoy (après yoy_enquete.js dans build.py)

// ═══════════════════════════════════════════════════════════════
// MAPPINGS COLONNES — FR et EN
// ═══════════════════════════════════════════════════════════════

var PO_COL_MAP_FR = {
  poId:         'BdC',
  vendorCode:   'Code fournisseur',
  orderDate:    'Date de la commande',
  status:       'Statut',
  title:        'Nom du produit',
  asin:         'ASIN',
  availability: 'Disponibilité',
  qtyRequested: 'Quantité demandée',
  qtyAccepted:  'Quantité acceptée',
  costAccepted: 'Coût total accepté',
  shipTo:       'Lieu de livraison'
};

var PO_COL_MAP_EN = {
  poId:         'PO',
  vendorCode:   'Vendor code',
  orderDate:    'Order date',
  status:       'Status',
  title:        'Product name',
  asin:         'ASIN',
  availability: 'Availability',
  qtyRequested: 'Requested quantity',
  qtyAccepted:  'Accepted quantity',
  costAccepted: 'Total accepted cost',
  shipTo:       'Ship-to location'
};

// Normalisation statut → interne
var PO_STATUS_MAP = {
  // FR
  'Confirmé':      'confirmed',
  'Clôturé':       'closed',
  'Non confirmé':  'unconfirmed',
  // EN
  'Confirmed':     'confirmed',
  'Closed':        'closed',
  'Not confirmed': 'unconfirmed'
};

// Mois anglais (invariants même en variante FR — convention VC export)
var PO_MONTH_ABBR = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
};

// ═══════════════════════════════════════════════════════════════
// DÉTECTION LANGUE
// ═══════════════════════════════════════════════════════════════

function detectPOLang(csvText) {
  var firstLine = csvText.replace(/^﻿/, '').split('\n')[0];
  if (firstLine.startsWith('BdC,') || firstLine.startsWith('"BdC",')) return 'fr';
  if (firstLine.startsWith('PO,') || firstLine.startsWith('"PO",')) return 'en';
  return null;
}

// ═══════════════════════════════════════════════════════════════
// CONVERSION DATE  "27-May-2026" → "2026-05-27"
// Mois toujours en anglais dans l'export VC (même variante FR)
// ═══════════════════════════════════════════════════════════════

function parsePoDate(rawDate) {
  if (!rawDate) return '';
  var parts = rawDate.trim().split('-');
  if (parts.length !== 3) return rawDate;
  var day = parts[0], mon = parts[1], year = parts[2];
  var m = PO_MONTH_ABBR[mon];
  if (!m) return rawDate;  // abbr inconnue → retour brut
  return year + '-' + (m < 10 ? '0' : '') + m + '-' + (parseInt(day) < 10 ? '0' : '') + parseInt(day);
}

// ═══════════════════════════════════════════════════════════════
// EXTRACTION CODE DISPONIBILITÉ  "IA - Accepté : EDI..." → "IA"
// ═══════════════════════════════════════════════════════════════

function extractAvailabilityCode(raw) {
  if (!raw) return '';
  var idx = raw.indexOf(' - ');
  var code = (idx > -1 ? raw.slice(0, idx) : raw).trim().toUpperCase();
  // Valider : 1-3 chars alphanum
  return /^[A-Z0-9]{1,3}$/.test(code) ? code : '';
}

// ═══════════════════════════════════════════════════════════════
// PARSER PRINCIPAL
// ═══════════════════════════════════════════════════════════════

/**
 * parsePOItemExport(csvText)
 * @returns {{ items: Array, lang: string|null, count: number, error?: string }}
 */
function parsePOItemExport(csvText) {
  // 1. Supprimer BOM
  var text = csvText.replace(/^﻿/, '');

  // 2. Détecter langue
  var lang = detectPOLang(text);
  if (!lang) {
    console.warn('[parser_po] Langue non détectée. Début:', text.slice(0, 80));
    return { items: [], lang: null, count: 0, error: 'lang_undetected' };
  }

  var colMap = lang === 'fr' ? PO_COL_MAP_FR : PO_COL_MAP_EN;

  // 3. Papa.parse — déjà dans le bundle
  var parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  var presentHeaders = {};
  (parsed.meta.fields || []).forEach(function(h) { presentHeaders[h] = true; });

  // 4. Vérifier colonnes attendues
  Object.keys(colMap).forEach(function(field) {
    if (!presentHeaders[colMap[field]]) {
      console.warn('[parser_po] Colonne manquante: "' + colMap[field] + '" (champ: ' + field + ', lang: ' + lang + ')');
    }
  });

  // 5. Parser chaque ligne
  var items = [];
  var data = parsed.data || [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var asin = (row[colMap.asin] || '').trim();
    var poId = (row[colMap.poId] || '').trim();
    if (!asin || !poId) continue; // ignorer lignes vides

    var availRaw  = row[colMap.availability] || '';
    var availCode = extractAvailabilityCode(availRaw);
    // VC_AVAILABILITY_CODES défini dans yoy_enquete.js (injecté avant)
    var availFamily = (VC_AVAILABILITY_CODES[availCode] || {}).family || 'unknown';
    var rawStatus = (row[colMap.status] || '').trim();

    items.push({
      poId:               poId,
      vendorCode:         (row[colMap.vendorCode] || '').trim(),
      orderDate:          parsePoDate(row[colMap.orderDate] || ''),
      status:             rawStatus,
      poStatus:           PO_STATUS_MAP[rawStatus] || 'unknown',
      title:              (row[colMap.title] || '').trim(),
      asin:               asin,
      availabilityRaw:    availRaw,
      availabilityCode:   availCode,
      availabilityFamily: availFamily,
      qtyRequested:       parseInt(row[colMap.qtyRequested] || '0', 10) || 0,
      qtyAccepted:        parseInt(row[colMap.qtyAccepted]  || '0', 10) || 0,
      costAccepted:       parseFloat(row[colMap.costAccepted] || '0') || 0,  // point décimal confirmé
      shipTo:             (row[colMap.shipTo] || '').trim(),
      // shipTo ≠ marketplace de vente (point d'attention 9.3) — parsé non affiché
      importedAt:         new Date().toISOString(),
      source:             'POItemExport'
    });
  }

  return { items: items, lang: lang, count: items.length };
}

// ═══════════════════════════════════════════════════════════════
// MERGE DANS c.pos — dédoublonnage par (poId, asin)
// ═══════════════════════════════════════════════════════════════

/**
 * mergePOItemsIntoClient(client, newItems)
 * @returns {{ added: number, updated: number, total: number }}
 */
function mergePOItemsIntoClient(client, newItems) {
  if (!client.pos) client.pos = [];

  // Construire index existant
  var idx = {};
  for (var i = 0; i < client.pos.length; i++) {
    var p = client.pos[i];
    idx[p.poId + '|' + p.asin] = i;
  }

  var added = 0, updated = 0;
  for (var j = 0; j < newItems.length; j++) {
    var item = newItems[j];
    var key = item.poId + '|' + item.asin;
    if (idx[key] != null) {
      // Enrichir le PO existant avec les nouveaux champs sans écraser poId/asin
      var existing = client.pos[idx[key]];
      Object.keys(item).forEach(function(k) { existing[k] = item[k]; });
      updated++;
    } else {
      idx[key] = client.pos.length;
      client.pos.push(item);
      added++;
    }
  }

  // Auto-détecter les vendorCodes pour c.accounts
  autoDetectVendorCodes(client, newItems);

  return { added: added, updated: updated, total: client.pos.length };
}

// ═══════════════════════════════════════════════════════════════
// AUTO-DÉTECTION vendorCodes → c.accounts
// ═══════════════════════════════════════════════════════════════

/**
 * autoDetectVendorCodes(client, items)
 * Crée une entrée role='BO' dans c.accounts pour chaque vendorCode
 * présent dans les items mais absent de c.accounts.
 */
function autoDetectVendorCodes(client, items) {
  if (!client.accounts) client.accounts = [];
  var known = {};
  client.accounts.forEach(function(a) { known[a.vendorCode] = true; });
  var seen = {};
  items.forEach(function(i) { if (i.vendorCode) seen[i.vendorCode] = true; });
  Object.keys(seen).forEach(function(vc) {
    if (!known[vc]) {
      client.accounts.push({
        id: 'vc_auto_' + vc + '_' + Date.now(),
        market: '',
        vendorCode: vc,
        role: 'BO',  // auto : a des POs → Bon de Commande
        label: vc
      });
      known[vc] = true;
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// HANDLER UI — appelé depuis la fiche client
// ═══════════════════════════════════════════════════════════════

function handlePOItemExportFile(input) {
  var files = Array.from(input.files);
  if (!files.length) return;
  var c = cl(); if (!c) return;

  var totalAdded = 0, totalUpdated = 0, totalRaw = 0, errors = [];

  var pending = files.length;
  files.forEach(function(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var result = parsePOItemExport(e.target.result);
        if (result.error) {
          errors.push(file.name + ': ' + result.error);
        } else {
          totalRaw += result.count;  // cumul lignes brutes avant déduplication
          var stats = mergePOItemsIntoClient(c, result.items);
          totalAdded   += stats.added;
          totalUpdated += stats.updated;
          // Invalider le cache enquête
          _enqueteCache.posHash = null;
          console.info('[parser_po] ' + file.name + ' · ' + result.count + ' lignes · lang=' + result.lang
            + ' · VC: ' + [...new Set(result.items.map(function(i){return i.vendorCode;}))].join(', '));
        }
      } catch(err) {
        errors.push(file.name + ': ' + err.message);
      }
      pending--;
      if (pending === 0) {
        // Stocker les lignes brutes du batch (remplace la valeur précédente — représente le dernier import)
        c.poItemExportRawLines = totalRaw;
        save(); render();
        if (errors.length) {
          showToast('⚠ ' + errors[0], 'alr-a', 5000);
        } else {
          var msg = '✅ POItemExport : +' + totalAdded + ' POs ajoutés';
          if (totalUpdated > 0) msg += ', ' + totalUpdated + ' mis à jour';
          showToast(msg, 'alr-g', 5000);
        }
      }
    };
    reader.readAsText(file, 'UTF-8');
  });
}

// Exposer sur window
window.parsePOItemExport = parsePOItemExport;
window.mergePOItemsIntoClient = mergePOItemsIntoClient;
window.handlePOItemExportFile = handlePOItemExportFile;
window.autoDetectVendorCodes = autoDetectVendorCodes;
