// Amazon Pilot — Parser ERP universel
// v3.6.6 — parseFileERP + downloadERPTemplate + handleERPImport + getStockERP

// ── Normalisation : insensible casse, accents, NBSP, underscore ─────────
function erpNorm(str) {
  if (str == null) return '';
  return String(str)
    .toLowerCase()
    .replace(/°/g, 'o')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[  ]/g, ' ')
    .replace(/[''"’`´]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Dictionnaire synonymes (valeurs déjà normalisées via erpNorm) ────────
var ERP_COL_SYNONYMS = {
  SKU:                     ['sku','code sku','no','numero','code article','reference','ref','article'],
  EAN:                     ['ean','ean13','code ean','code barres','barcode','gtin'],
  Designation:             ['designation','libelle','libelle produit','nom produit','description','nom'],
  Code_Vie:                ['code vie','cycle de vie','statut','vie produit'],
  Stock_libre:             ['stock libre','stock dispo','stock disponible','disponible','libre'],
  Stock_Amazon:            ['stock amazon','reserve amazon','amazon stock'],
  Stock_disponible_Amazon: ['stock disponible amazon','stock physique non reserve','stock physique','dispo amazon','stock unique'],
  Date_prochain_arrivage:  ['date prochain arrivage','date arrivage','prochain arrivage','date po','date livraison','proch arrivage'],
  Qte_prochain_arrivage:   ['qte prochain arrivage','qt prochain arrivage','quantite arrivage','qte arrivage','qte po','qte livraison']
};

function erpMapColumn(headerNorm) {
  for (var field in ERP_COL_SYNONYMS) {
    var syns = ERP_COL_SYNONYMS[field];
    for (var i = 0; i < syns.length; i++) {
      if (headerNorm === syns[i]) return field;
    }
  }
  return null;
}

function erpParseNumber(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return val;
  var s = String(val).replace(/[  ]/g, '').replace(',', '.').trim();
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function erpParseDate(val) {
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number' && val > 0) {
    var jsDate = new Date(Date.UTC(1899, 11, 30) + val * 86400000);
    return isNaN(jsDate.getTime()) ? null : jsDate.toISOString().slice(0, 10);
  }
  var s = String(val).trim();
  if (!s) return null;
  var d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

// ── Parser principal ─────────────────────────────────────────────────────
function parseFileERP(file) {
  return new Promise(function(resolve) {
    var reader = new FileReader();
    reader.onerror = function() {
      resolve({ ok: false, rows: [], errors: ['Erreur lecture fichier'], warnings: [], config: null });
    };
    reader.onload = function(e) {
      try {
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, { type: 'array', cellDates: false });

        // 1. Feuille : Stock_Amazon_Pilot en priorité, sinon active (index 0)
        var sheetName = null;
        for (var si = 0; si < wb.SheetNames.length; si++) {
          if (wb.SheetNames[si] === 'Stock_Amazon_Pilot') { sheetName = wb.SheetNames[si]; break; }
        }
        if (!sheetName) sheetName = wb.SheetNames[0];
        var ws = wb.Sheets[sheetName];
        if (!ws) return resolve({ ok: false, rows: [], errors: ['Aucune feuille trouvée'], warnings: [], config: null });

        // 2. Tableau brut
        var rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
        if (!rawRows.length) return resolve({ ok: false, rows: [], errors: ['Fichier vide'], warnings: [], config: null });

        // 3. Détecter ligne header (parmi les 5 premières non vides)
        var headerRowIdx = -1;
        for (var ri = 0; ri < Math.min(5, rawRows.length); ri++) {
          var nonNull = rawRows[ri].filter(function(v) { return v != null && String(v).trim() !== ''; }).length;
          if (nonNull < 2) continue;
          var hasKnown = rawRows[ri].some(function(v) { return erpMapColumn(erpNorm(v)) !== null; });
          if (hasKnown) { headerRowIdx = ri; break; }
        }
        if (headerRowIdx === -1) {
          return resolve({ ok: false, rows: [], errors: ["Impossible de détecter la ligne d'en-tête (aucune colonne reconnue dans les 5 premières lignes)"], warnings: [], config: null });
        }

        // 4. Mapper colonnes index → field
        var headers = rawRows[headerRowIdx];
        var colMap = {};
        for (var ci = 0; ci < headers.length; ci++) {
          var field = erpMapColumn(erpNorm(headers[ci]));
          if (field && !(field in colMap)) colMap[field] = ci;
        }

        // 5. Détecter configuration stock
        var hasSep = ('Stock_libre' in colMap) && ('Stock_Amazon' in colMap);
        var hasCum = 'Stock_disponible_Amazon' in colMap;
        var warnings = [], errors = [], config = null;

        if (!hasSep && !hasCum) {
          return resolve({ ok: false, rows: [], errors: ["Le fichier doit contenir au moins l'une de ces colonnes : Stock_libre + Stock_Amazon (séparés) OU Stock_disponible_Amazon (cumulé)"], warnings: [], config: null });
        }
        if (hasCum && hasSep) {
          config = 'cumulated';
          warnings.push('Plusieurs configurations stock détectées — la colonne cumulée (Stock_disponible_Amazon) a été utilisée');
        } else {
          config = hasCum ? 'cumulated' : 'separated';
        }

        // 6. Parser lignes de données
        var dataRows = rawRows.slice(headerRowIdx + 1);
        var rows = [], validCount = 0;
        for (var di = 0; di < dataRows.length; di++) {
          var raw = dataRows[di];
          var skuRaw = (colMap.SKU != null) ? raw[colMap.SKU] : null;
          if (skuRaw == null || String(skuRaw).trim() === '') continue;
          var sku = String(skuRaw).trim();

          var row = {
            sku: sku,
            ean:         (colMap.EAN != null && raw[colMap.EAN] != null)         ? String(raw[colMap.EAN]).trim()         : null,
            designation: (colMap.Designation != null && raw[colMap.Designation] != null) ? String(raw[colMap.Designation]).trim() : null,
            code_vie:    (colMap.Code_Vie != null && raw[colMap.Code_Vie] != null)    ? String(raw[colMap.Code_Vie]).trim()    : null,
            date_prochain_arrivage: (colMap.Date_prochain_arrivage != null) ? erpParseDate(raw[colMap.Date_prochain_arrivage])   : null,
            qte_prochain_arrivage:  (colMap.Qte_prochain_arrivage != null)  ? erpParseNumber(raw[colMap.Qte_prochain_arrivage])  : null
          };

          if (config === 'cumulated') {
            var s = erpParseNumber(raw[colMap.Stock_disponible_Amazon]);
            row.stock_disponible_amazon = (s != null) ? Math.max(0, s) : 0;
            row.stock_libre = null; row.stock_amazon = null;
          } else {
            var sl = erpParseNumber(raw[colMap.Stock_libre]);
            var sa = erpParseNumber(raw[colMap.Stock_Amazon]);
            row.stock_libre  = (sl != null) ? Math.max(0, sl) : 0;
            row.stock_amazon = (sa != null) ? Math.max(0, sa) : 0;
            row.stock_disponible_amazon = row.stock_libre + row.stock_amazon;
          }

          if (row.stock_disponible_amazon >= 0) validCount++;
          rows.push(row);
        }

        // 7. Sanity check >= 80 % lignes avec stock cohérent
        if (!rows.length) return resolve({ ok: false, rows: [], errors: ['Aucune ligne de données valide trouvée'], warnings: warnings, config: config });
        var pct = validCount / rows.length;
        if (pct < 0.8) {
          return resolve({ ok: false, rows: rows, errors: ['Seulement ' + Math.round(pct * 100) + ' % des lignes ont un stock cohérent (minimum requis : 80 %). Vérifiez le format du fichier.'], warnings: warnings, config: config });
        }

        resolve({ ok: true, rows: rows, errors: [], warnings: warnings, config: config });
      } catch (err) {
        resolve({ ok: false, rows: [], errors: ['Erreur parsing : ' + (err.message || String(err))], warnings: [], config: null });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ── Modèle Excel téléchargeable ──────────────────────────────────────────
function downloadERPTemplate() {
  var wb = XLSX.utils.book_new();
  var hdr = ['SKU','EAN','Designation','Code_Vie','Stock_libre','Stock_Amazon','Stock_disponible_Amazon','Date_prochain_arrivage','Qte_prochain_arrivage'];
  var ex1 = ['REF-001','3367304009366','Produit A — config (a) stocks séparés','PERM',150,50,'','2026-09-01',500];
  var ex2 = ['REF-002','3367304009373','Produit B — config (b) stock cumulé',  'PERM','','',320,'',0];
  var ws1 = XLSX.utils.aoa_to_sheet([hdr, ex1, ex2]);
  XLSX.utils.book_append_sheet(wb, ws1, 'Stock_Amazon_Pilot');
  var aide = [
    ['AIDE — Modèle Stock Amazon Pilot'],[''],
    ['COLONNES OBLIGATOIRES'],
    ['SKU','Référence interne ERP (ex : 141431). Obligatoire.'],
    ['Code_Vie','Statut cycle de vie : PERM, PERM-FIN, NEG, ARRD-NEG, ESSAI-FERM…'],[''],
    ['STOCK — choisissez UNE des deux configurations'],
    ['Config (a) stocks séparés','Remplir Stock_libre ET Stock_Amazon. Le parser calcule le total.'],
    ['Config (b) stock cumulé','Remplir uniquement Stock_disponible_Amazon.'],[''],
    ['COLONNES OPTIONNELLES'],
    ['EAN','Code-barres EAN-13.'],['Designation','Libellé produit.'],
    ['Date_prochain_arrivage','Format AAAA-MM-JJ ou date Excel native.'],
    ['Qte_prochain_arrivage','Quantité du prochain réapprovisionnement.'],[''],
    ['SYNONYMES ACCEPTÉS','N° → SKU | Stock Physique non réservé → Stock_disponible_Amazon | Qt prochain arrivage → Qte_prochain_arrivage | Désignation → Designation | Code Vie → Code_Vie']
  ];
  var ws2 = XLSX.utils.aoa_to_sheet(aide);
  XLSX.utils.book_append_sheet(wb, ws2, 'Aide');
  XLSX.writeFile(wb, 'modele_stock_amazon_pilot.xlsx');
  showToast('Modèle téléchargé', 'alr-g');
}

// ── Handler import fichier → prévisualisation ────────────────────────────
function handleERPImport(files) {
  var c = cl();
  if (!c || !files || !files[0]) return;
  var prev = document.getElementById('erp-import-preview');
  if (prev) prev.innerHTML = '<div style="padding:12px;color:var(--tx3);font-size:12px">Analyse en cours…</div>';
  parseFileERP(files[0]).then(function(result) {
    if (!prev) return;
    if (!result.ok) {
      prev.innerHTML = '<div style="padding:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;font-size:12px;color:#b91c1c"><strong>Erreur :</strong> '
        + result.errors.map(function(e){ return esc(e); }).join('<br>') + '</div>';
      return;
    }
    var warnHtml = result.warnings.length
      ? '<div style="padding:8px 12px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#92400e;margin-bottom:8px">⚠ '
        + result.warnings.map(function(w){ return esc(w); }).join('<br>') + '</div>'
      : '';
    var cfgLabel = result.config === 'cumulated' ? 'Stock cumulé (b)' : 'Stocks séparés (a)';
    var withDate = result.rows.filter(function(r){ return r.date_prochain_arrivage; }).length;
    prev.innerHTML = warnHtml
      + '<div style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:12px">'
      + '<div style="font-weight:700;color:#15803d;margin-bottom:6px">✓ Fichier valide — ' + result.rows.length + ' références</div>'
      + '<div style="color:var(--tx2);line-height:1.8">Configuration : <strong>' + cfgLabel + '</strong><br>'
      + 'Avec date arrivage : <strong>' + withDate + ' références</strong></div>'
      + '<button class="btn btn-p" style="margin-top:10px" onclick="confirmERPImport()">'
      + '✓ Valider l\'import (' + result.rows.length + ' références)</button>'
      + '</div>';
    window._erpPendingResult = { clientId: c.id, result: result };
  });
}

function confirmERPImport() {
  var pending = window._erpPendingResult;
  if (!pending) return;
  var clientId = pending.clientId, result = pending.result;
  var now = new Date().toISOString();
  openDB().then(function(db) {
    var tx = db.transaction('erp_stock', 'readwrite');
    var store = tx.objectStore('erp_stock');
    result.rows.forEach(function(row) {
      var rec = Object.assign({}, row, { client_id: clientId, imported_at: now, _key: clientId + ':' + row.sku });
      store.put(rec);
    });
    tx.oncomplete = function() {
      window._erpPendingResult = null;
      var c = cl();
      if (c && c.id === clientId) { c.erpStockCount = result.rows.length; c.erpStockImportedAt = now; save(); }
      var prev = document.getElementById('erp-import-preview');
      if (prev) prev.innerHTML = '<div style="padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:12px;color:#15803d;font-weight:600">'
        + '✓ Import terminé — ' + result.rows.length + ' références chargées (IndexedDB erp_stock)</div>';
      showToast(result.rows.length + ' références ERP importées', 'alr-g');
      render();
    };
  });
}

// ── Lecture stock ERP depuis IndexedDB ───────────────────────────────────
async function getStockERP(clientId, sku) {
  try {
    var db = await openDB();
    var key = clientId + ':' + String(sku);
    return await new Promise(function(resolve) {
      var tx = db.transaction('erp_stock', 'readonly');
      var req = tx.objectStore('erp_stock').get(key);
      req.onsuccess = function() { resolve(req.result || null); };
      req.onerror   = function() { resolve(null); };
    });
  } catch(e) { return null; }
}
