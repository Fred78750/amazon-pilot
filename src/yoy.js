// Amazon Pilot — Module YoY Étape 1 : Analyse comparée
// v3.6.5 — CP1 : Fondations techniques (routing, import, parser, sanity check, IndexedDB)
// CP2 : Calculs 12 dimensions + KPI cards
// CP3 : Templates Free + rendu complet 6 sections
// CP4 : Dimensions Pro IA + finitions print

// ═══════════════════════════════════════════════════════════════
// CONSTANTES & CONFIG
// ═══════════════════════════════════════════════════════════════

const userTier = 'pro'; // v3.6.5 : hardcodé 'pro' pour Fred. v3.6.6+ : config utilisateur.

// Séparateurs à neutraliser dans les chiffres CSV Amazon France
// Bug du 21 mai :   (NARROW NO-BREAK SPACE) utilisé comme séparateur de milliers
const YOY_SEPS_TO_STRIP    = [' ', ' ', ' ', ' ', ' '];
const YOY_CURRENCIES_TO_STRIP = ['€', '$', '£'];

// Seuils sanity check COGS/unités (en euros)
const YOY_SANITY_MIN = 0.10;
const YOY_SANITY_MAX = 1000;

// Seuil durée minimale des périodes (en jours)
const YOY_MIN_DAYS = 60;

// Seuils adaptatifs (titre + couleur selon delta)
const YOY_THRESHOLD_PCT = 3; // ±3% → stable

// Colonnes CSV Vendor Central attendues (mapping noms → clé interne)
// Vendor Central France exporte avec ces intitulés exacts
const YOY_COL_MAP = {
  // ASIN
  'ASIN': 'asin',
  // Titre produit
  'Nom du produit': 'titre',
  'Product Name': 'titre',
  // Marque
  'Marque': 'marque',
  'Brand': 'marque',
  // CA commandé
  "Chiffre d'affaires basé sur les commandes": 'ca_cmd',
  'Ordered Revenue': 'ca_cmd',
  'Ordered Product Sales': 'ca_cmd',
  // Unités commandées
  'Unités commandées': 'u_cmd',
  'Units Ordered': 'u_cmd',
  'Ordered Units': 'u_cmd',
  // CA expédié
  "Chiffre d'affaires basé sur les expéditions": 'ca_exp',
  'Shipped Revenue': 'ca_exp',
  'Shipped Product Sales': 'ca_exp',
  // COGS expédié
  'COGS expédié': 'cogs',
  'Shipped COGS': 'cogs',
  'Shipped Cost of Goods': 'cogs',
  // Unités expédiées
  'Unités expédiées': 'u_exp',
  'Units Shipped': 'u_exp',
  'Shipped Units': 'u_exp',
  // Retours client
  'Retours client': 'retours',
  'Customer Returns': 'retours',
  'Returned Units': 'retours',
};

// ═══════════════════════════════════════════════════════════════
// ÉTAT LOCAL DU MODULE
// ═══════════════════════════════════════════════════════════════

var yoyState = {
  screen: 'import',          // 'import' | 'progress' | 'result'
  periodA:   { file: null, rows: null, meta: null, error: null },   // période à analyser
  periodRef: { file: null, rows: null, meta: null, error: null },   // période de référence
  analyses: [],              // historique IndexedDB (chargé au go('yoy'))
  currentAnalysis: null,     // analyse affichée
  progress: { phase: '', pct: 0 },
};

// ═══════════════════════════════════════════════════════════════
// ROUTEUR PRINCIPAL
// ═══════════════════════════════════════════════════════════════

function renderYoY() {
  const c = cl();
  if (!c) return renderYoYNoClient();

  // Charger l'historique au premier affichage du module
  if (!yoyState._histLoaded) {
    yoyLoadAll(c.id).then(function(list) {
      yoyState.analyses = list || [];
      yoyState._histLoaded = true;
      // Si historique non vide et qu'on vient juste d'arriver, basculer sur la dernière analyse
      if (list && list.length > 0 && yoyState.screen === 'import') {
        yoyState.screen = 'result';
        yoyState.currentAnalysis = list[list.length - 1];
      }
      render();
    }).catch(function() {
      yoyState._histLoaded = true;
    });
    // Afficher l'écran d'import pendant le chargement async
    return renderYoYImport();
  }

  switch (yoyState.screen) {
    case 'import':   return renderYoYImport();
    case 'progress': return renderYoYProgress();
    case 'result':   return renderYoYResult();
    default:         return renderYoYImport();
  }
}

function renderYoYNoClient() {
  return `<div style="padding:40px;text-align:center;color:var(--tx2)">
    <div style="font-size:40px;margin-bottom:12px">📈</div>
    <div style="font-size:16px;font-weight:600;color:var(--tx);margin-bottom:8px">Analyse comparée</div>
    <div>Sélectionnez un client dans la barre latérale pour commencer.</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// ÉCRAN D'IMPORT
// ═══════════════════════════════════════════════════════════════

function renderYoYImport() {
  const c = cl();
  const pA   = yoyState.periodA;
  const pRef = yoyState.periodRef;

  // Bannière historique (si analyses passées)
  let histBanner = '';
  if (yoyState.analyses && yoyState.analyses.length > 0) {
    const opts = yoyState.analyses.slice().reverse().map(function(a) {
      const d = new Date(a.createdAt);
      const label = (d.getDate()+'').padStart(2,'0')+'/'+(d.getMonth()+1+'').padStart(2,'0')+'/'+d.getFullYear();
      const pLabel = (a.periodA && a.periodA.label) ? a.periodA.label + ' vs ' + (a.periodRef && a.periodRef.label ? a.periodRef.label : '?') : 'Analyse';
      return `<option value="${esc(a.id)}">${esc(label)} — ${esc(pLabel)}</option>`;
    }).join('');
    histBanner = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding:10px 14px;background:var(--s2);border-radius:var(--rd);border:0.5px solid var(--bd2)">
      <span style="font-size:12px;color:var(--tx2)">Analyses passées :</span>
      <select onchange="yoyLoadFromHistory(this.value)" style="background:var(--s3);color:var(--tx);border:0.5px solid var(--bd2);border-radius:4px;padding:3px 8px;font-size:12px">
        <option value="">— Sélectionner —</option>
        ${opts}
      </select>
    </div>`;
  }

  // Carte zone drop
  function dropZone(zone, p, label) {
    const loaded = p.meta !== null;
    const hasErr = p.error !== null;
    let inner = '';
    if (loaded && !hasErr) {
      const m = p.meta;
      inner = `<div style="text-align:center">
        <div style="font-size:22px;margin-bottom:6px">✅</div>
        <div style="font-weight:600;color:var(--tx);margin-bottom:4px">${esc(m.label || '?')}</div>
        <div style="font-size:12px;color:var(--tx2)">${m.days} jours · ${m.asinCount} ASINs · ${yoyFmtEur(m.caTotal)}</div>
        <div style="font-size:11px;color:var(--tx3);margin-top:4px">${esc(p.file ? p.file.name : '')}</div>
        <button class="btn btn-sm" style="margin-top:10px;font-size:11px" onclick="yoyClearZone('${zone}')">✕ Changer</button>
      </div>`;
    } else if (hasErr) {
      inner = `<div style="text-align:center">
        <div style="font-size:22px;margin-bottom:6px">❌</div>
        <div style="font-size:12px;color:var(--r);margin-bottom:8px">${esc(p.error)}</div>
        <button class="btn btn-sm btn-r" style="font-size:11px" onclick="yoyClearZone('${zone}')">Recommencer</button>
      </div>`;
    } else {
      inner = `<div style="text-align:center;pointer-events:none">
        <div style="font-size:28px;margin-bottom:8px">📂</div>
        <div style="font-weight:600;color:var(--tx);margin-bottom:6px">${esc(label)}</div>
        <div style="font-size:12px;color:var(--tx2);margin-bottom:10px">Glissez un fichier ou cliquez pour sélectionner</div>
        <div style="font-size:11px;color:var(--tx3)">Minimum 2 mois — formats CSV ou XLSX</div>
      </div>`;
    }

    const borderColor = loaded && !hasErr ? 'var(--g-bd)' : hasErr ? 'var(--r-bd)' : 'var(--bd2)';
    const bg = loaded && !hasErr ? 'var(--g-bg)' : hasErr ? 'var(--r-bg)' : 'var(--s2)';

    return `<div class="yoy-drop-zone" id="yoy-drop-${zone}"
      style="flex:1;min-height:160px;border:1.5px dashed ${borderColor};border-radius:var(--rd);background:${bg};padding:24px 20px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .15s"
      ondragover="event.preventDefault();this.style.borderColor='var(--or)'"
      ondragleave="this.style.borderColor='${borderColor}'"
      ondrop="event.preventDefault();yoyHandleDrop('${zone}',event.dataTransfer.files[0])"
      onclick="document.getElementById('yoy-file-${zone}').click()">
      ${inner}
      <input id="yoy-file-${zone}" type="file" accept=".csv,.xlsx,.xls" style="display:none"
        onchange="yoyHandleDrop('${zone}',this.files[0])">
    </div>`;
  }

  // Bouton CTA
  const canLaunch = pA.meta && !pA.error && pRef.meta && !pRef.error;
  const ctaDisabled = !canLaunch;
  const ctaStyle = canLaunch
    ? 'background:var(--or);color:#000;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;border:none;cursor:pointer;width:100%;margin-top:20px'
    : 'background:var(--s3);color:var(--tx3);font-size:15px;padding:12px 28px;border-radius:8px;border:none;cursor:default;width:100%;margin-top:20px';

  return `<div style="max-width:820px;margin:0 auto;padding:24px 20px">
    ${histBanner}

    <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">📈 Analyse comparée — Vendor Central</h2>
    <p style="color:var(--tx2);font-size:13px;margin-bottom:22px;line-height:1.6">
      Importez deux fenêtres de votre rapport Vendor Central pour comparer leur performance.
      La période à analyser peut être par exemple les 2 derniers mois ; la période de référence
      peut être les mêmes mois de l'année précédente, ou la période immédiatement antérieure.
    </p>

    <div style="display:flex;gap:16px;margin-bottom:16px">
      <div style="flex:1">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:8px;font-weight:600">PÉRIODE À ANALYSER</div>
        ${dropZone('a', pA, 'Période à analyser')}
      </div>
      <div style="flex:1">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);margin-bottom:8px;font-weight:600">PÉRIODE DE RÉFÉRENCE</div>
        ${dropZone('ref', pRef, 'Période de référence')}
      </div>
    </div>

    <div style="border-left:3px solid var(--b,#007AFF);padding:10px 14px;background:var(--s2);border-radius:0 6px 6px 0;font-size:12px;color:var(--tx2);margin-bottom:18px;line-height:1.6">
      <strong style="color:var(--tx)">Où trouver ces fichiers ?</strong><br>
      Vendor Central → Rapports → Ventes par ASIN — Fabrication → sélectionnez la période → Exportez en CSV ou XLSX.
    </div>

    ${canLaunch ? `<div id="yoy-sanity-recap" style="margin-bottom:16px"></div>` : ''}

    <button style="${ctaStyle}" onclick="${canLaunch ? 'yoyLaunchAnalysis()' : 'void 0'}">
      ${ctaDisabled ? '⬆ Importez les deux fichiers pour continuer' : 'Lancer l\'analyse comparée →'}
    </button>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// ÉCRAN DE PROGRESSION
// ═══════════════════════════════════════════════════════════════

function renderYoYProgress() {
  const { phase, pct } = yoyState.progress;
  return `<div style="max-width:500px;margin:80px auto;text-align:center;padding:24px">
    <div style="font-size:36px;margin-bottom:16px">⚙️</div>
    <h3 style="font-size:16px;font-weight:600;margin-bottom:20px">Analyse en cours…</h3>
    <div style="background:var(--s2);border-radius:8px;height:8px;overflow:hidden;margin-bottom:12px">
      <div style="background:var(--or);height:100%;width:${pct}%;transition:width .3s ease;border-radius:8px"></div>
    </div>
    <div style="font-size:13px;color:var(--tx2)">${esc(phase)}</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// ÉCRAN DE RÉSULTAT (placeholder CP1 — contenu CP2+)
// ═══════════════════════════════════════════════════════════════

function renderYoYResult() {
  const a = yoyState.currentAnalysis;
  if (!a) { yoyState.screen = 'import'; return renderYoYImport(); }

  const pALabel   = a.periodA   && a.periodA.label   ? a.periodA.label   : '?';
  const pRefLabel = a.periodRef && a.periodRef.label ? a.periodRef.label : '?';
  const c = cl();
  const clientName = c ? c.name : '—';

  return `<div style="max-width:900px;margin:0 auto;padding:24px 20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:8px">
      <div>
        <h2 style="font-size:19px;font-weight:700;margin-bottom:4px">Analyse comparée — ${esc(clientName)}</h2>
        <div style="font-size:12px;color:var(--tx2)">${esc(pALabel)} <span style="color:var(--tx3)">vs</span> ${esc(pRefLabel)}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm" onclick="yoyBack()">← Modifier les imports</button>
        <button class="btn btn-sm" onclick="window.print()">🖨 Imprimer</button>
      </div>
    </div>

    <div style="background:var(--s2);border:0.5px solid var(--bd2);border-radius:var(--rd);padding:32px;text-align:center">
      <div style="font-size:28px;margin-bottom:12px">✅</div>
      <div style="font-size:16px;font-weight:600;margin-bottom:8px">Analyse sauvegardée</div>
      <div style="font-size:13px;color:var(--tx2);margin-bottom:20px">
        Checkpoint 1 validé — parsing OK, sanity check OK, IndexedDB OK.<br>
        Les 12 dimensions + sections analytiques arrivent en CP2/CP3.
      </div>
      <div style="display:inline-block;text-align:left;background:var(--s3);border-radius:8px;padding:16px 20px;font-size:12px;color:var(--tx2);font-family:monospace;line-height:1.8">
        <div><strong style="color:var(--tx)">Période A :</strong> ${esc(pALabel)} · ${a.periodA ? a.periodA.days : '?'} j · ${a.periodA ? a.periodA.asinCount : '?'} ASINs · ${a.totals ? yoyFmtEur(a.totals.caA || 0) : '—'}</div>
        <div><strong style="color:var(--tx)">Période Réf :</strong> ${esc(pRefLabel)} · ${a.periodRef ? a.periodRef.days : '?'} j · ${a.periodRef ? a.periodRef.asinCount : '?'} ASINs · ${a.totals ? yoyFmtEur(a.totals.caRef || 0) : '—'}</div>
        <div><strong style="color:var(--tx)">Sanity check :</strong> ${a.metadata && a.metadata.sanityCheckOk ? '✅ OK' : '❌ KO'}</div>
        <div><strong style="color:var(--tx)">Parser :</strong> ${a.metadata ? esc(a.metadata.parserVersion) : '—'}</div>
        <div><strong style="color:var(--tx)">Analyse ID :</strong> ${esc(a.id)}</div>
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// GESTION DRAG & DROP / SÉLECTION FICHIER
// ═══════════════════════════════════════════════════════════════

function yoyClearZone(zone) {
  if (zone === 'a') {
    yoyState.periodA = { file: null, rows: null, meta: null, error: null };
  } else {
    yoyState.periodRef = { file: null, rows: null, meta: null, error: null };
  }
  render();
}

function yoyHandleDrop(zone, file) {
  if (!file) return;
  const p = zone === 'a' ? yoyState.periodA : yoyState.periodRef;
  p.file  = file;
  p.rows  = null;
  p.meta  = null;
  p.error = null;

  // Réinitialiser l'input file pour permettre de recharger le même fichier
  const input = document.getElementById('yoy-file-' + zone);
  if (input) input.value = '';

  parseYoYFile(file).then(function(result) {
    p.rows = result.rows;
    p.meta = result.meta;
    p.error = null;
    render();
    yoyUpdateSanityRecap();
  }).catch(function(err) {
    p.error = err.message || 'Erreur de parsing';
    render();
  });
}

// ═══════════════════════════════════════════════════════════════
// PARSER FICHIER (CSV + XLSX)
// ═══════════════════════════════════════════════════════════════

/**
 * parseYoYFile — Parse un fichier CSV ou XLSX Vendor Central
 * @param {File} file
 * @returns {Promise<{rows: Array, meta: object}>}
 *   rows : tableau d'objets normalisés avec clés internes (asin, titre, marque, ca_cmd, ...)
 *   meta : { label, from, to, days, asinCount, caTotal }
 */
function parseYoYFile(file) {
  const name = file.name || '';
  const ext  = name.split('.').pop().toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    return parseYoYXLSX(file);
  } else {
    return parseYoYCSV(file);
  }
}

/**
 * Neutralise les séparateurs de milliers et symboles monétaires dans une chaîne CSV
 * Règle CRITIQUE : traite notamment   (NARROW NO-BREAK SPACE) Amazon France
 */
function yoyCleanNum(str) {
  if (typeof str !== 'string') return str;
  var s = str.trim();
  for (var i = 0; i < YOY_SEPS_TO_STRIP.length; i++) {
    s = s.split(YOY_SEPS_TO_STRIP[i]).join('');
  }
  for (var j = 0; j < YOY_CURRENCIES_TO_STRIP.length; j++) {
    s = s.split(YOY_CURRENCIES_TO_STRIP[j]).join('');
  }
  // Remplacer virgule décimale FR par point
  s = s.replace(',', '.');
  return s;
}

/**
 * Convertit une valeur brute CSV/XLSX en nombre flottant
 */
function yoyToNum(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return 0;
  var s = yoyCleanNum(String(v));
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Normalise une ligne de données brutes (CSV ou XLSX) vers les clés internes
 * en utilisant YOY_COL_MAP
 */
function yoyNormalizeRow(rawRow, headerMap) {
  var out = {};
  for (var rawCol in headerMap) {
    var internalKey = headerMap[rawCol];
    var val = rawRow[rawCol];
    if (val === undefined) continue;
    // Colonnes numériques
    if (['ca_cmd','u_cmd','ca_exp','cogs','u_exp','retours'].indexOf(internalKey) >= 0) {
      out[internalKey] = yoyToNum(val);
    } else {
      out[internalKey] = (typeof val === 'string') ? val.trim() : (val !== null && val !== undefined ? String(val).trim() : '');
    }
  }
  return out;
}

/**
 * Normalise un en-tête CSV/XLSX avant comparaison
 * - Trim whitespace
 * - Apostrophe typographique ’ (') → ASCII ' (')
 *   → "Chiffre d'affaires" (VC France) est exporté avec ’, pas '
 * - Idem ‘ (guillemet apostrophe gauche)
 */
function yoyNormalizeHeader(h) {
  if (!h) return '';
  return String(h).trim()
    .replace(/’/g, "'")   // RIGHT SINGLE QUOTATION MARK → apostrophe ASCII
    .replace(/‘/g, "'");  // LEFT SINGLE QUOTATION MARK → apostrophe ASCII
}

/**
 * Construit un headerMap { nomColonneNormalisé → cléInterne } depuis les en-têtes détectés
 * Les headers entrants sont préalablement normalisés (via yoyNormalizeHeader dans les parsers)
 * afin que la comparaison avec YOY_COL_MAP soit insensible aux apostrophes typographiques
 */
function yoyBuildHeaderMap(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var h = yoyNormalizeHeader(headers[i]);
    if (h && YOY_COL_MAP[h]) {
      map[h] = YOY_COL_MAP[h];
    }
  }
  return map;
}

/**
 * Valide que le headerMap contient les colonnes obligatoires
 */
function yoyValidateHeaders(headerMap) {
  var required = ['asin', 'ca_cmd', 'u_cmd', 'ca_exp', 'cogs', 'u_exp'];
  var found = Object.values(headerMap);
  var missing = required.filter(function(k) { return found.indexOf(k) < 0; });
  if (missing.length > 0) {
    throw new Error('Colonnes manquantes dans le fichier : ' + missing.join(', ') + '. Vérifiez que c\'est bien un export "Ventes par ASIN" Vendor Central.');
  }
}

/**
 * Filtre les lignes vides / totaux (ASIN vide ou = "Total")
 */
function yoyFilterRows(rows) {
  return rows.filter(function(r) {
    return r.asin && r.asin.trim() !== '' && r.asin.trim().toUpperCase() !== 'TOTAL' && r.asin.trim().toUpperCase() !== 'ASIN';
  });
}

/**
 * Calcule les métadonnées de synthèse depuis les lignes parsées
 */
function yoyComputeMeta(rows, filename, fromDate, toDate) {
  var caTotal = rows.reduce(function(s, r) { return s + (r.ca_cmd || 0); }, 0);
  var days = 0;
  if (fromDate && toDate) {
    days = Math.round((toDate - fromDate) / 86400000) + 1;
  }
  var label = yoyFormatPeriodLabel(fromDate, toDate);
  return {
    label: label,
    from: fromDate ? fromDate.toISOString() : null,
    to: toDate ? toDate.toISOString() : null,
    days: days,
    asinCount: rows.length,
    caTotal: caTotal,
    filename: filename,
  };
}

/**
 * Formate un libellé lisible de période (ex: "Avril-mai 2025")
 */
function yoyFormatPeriodLabel(from, to) {
  if (!from || !to) return 'Période inconnue';
  var MONTHS_FR = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  var mFrom = MONTHS_FR[from.getMonth()];
  var mTo   = MONTHS_FR[to.getMonth()];
  var yFrom = from.getFullYear();
  var yTo   = to.getFullYear();
  if (yFrom === yTo && from.getMonth() === to.getMonth()) {
    return mFrom + ' ' + yFrom;
  } else if (yFrom === yTo) {
    return mFrom + '–' + mTo + ' ' + yFrom;
  } else {
    return mFrom + ' ' + yFrom + ' – ' + mTo + ' ' + yTo;
  }
}

/**
 * Tente de détecter la période depuis le nom du fichier
 * Pattern: _DD-MM-YYYY_DD-MM-YYYY ou _YYYY-MM-DD_YYYY-MM-DD
 */
function detectYoYPeriodFromFilename(filename) {
  // Pattern Amazon VC : _DD-MM-YYYY_DD-MM-YYYY
  var m = filename.match(/(\d{2}-\d{2}-\d{4})_(\d{2}-\d{2}-\d{4})/);
  if (m) {
    var p1 = m[1].split('-'); // [DD, MM, YYYY]
    var p2 = m[2].split('-');
    var d1 = new Date(+p1[2], +p1[1]-1, +p1[0]);
    var d2 = new Date(+p2[2], +p2[1]-1, +p2[0]);
    if (!isNaN(d1) && !isNaN(d2)) return { from: d1, to: d2 };
  }
  // Pattern alternatif : _YYYY-MM-DD_YYYY-MM-DD
  var m2 = filename.match(/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})/);
  if (m2) {
    var d3 = new Date(m2[1]);
    var d4 = new Date(m2[2]);
    if (!isNaN(d3) && !isNaN(d4)) return { from: d3, to: d4 };
  }
  return null;
}

/**
 * Tente de détecter la période depuis le contenu du fichier
 * (ex: lignes d'en-tête VC "Rapports Ventes ASIN [DD/MM/YYYY - DD/MM/YYYY]")
 */
function detectYoYPeriodFromContent(rawText) {
  // Format VC: "DD/MM/YYYY - DD/MM/YYYY" ou "DD/MM/YYYY–DD/MM/YYYY"
  var m = rawText.match(/(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/);
  if (m) {
    var p1 = m[1].split('/'); // [DD, MM, YYYY]
    var p2 = m[2].split('/');
    var d1 = new Date(+p1[2], +p1[1]-1, +p1[0]);
    var d2 = new Date(+p2[2], +p2[1]-1, +p2[0]);
    if (!isNaN(d1) && !isNaN(d2)) return { from: d1, to: d2 };
  }
  return null;
}

/**
 * parseYoYCSV — Parse CSV via PapaParse avec neutralisation des séparateurs
 */
function parseYoYCSV(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var text = e.target.result || '';

      // Détection période
      var period = detectYoYPeriodFromFilename(file.name);
      if (!period) period = detectYoYPeriodFromContent(text);

      // Validation durée minimale
      if (period) {
        var days = Math.round((period.to - period.from) / 86400000) + 1;
        if (days < YOY_MIN_DAYS) {
          return reject(new Error('La période fait ' + days + ' jours, minimum ' + YOY_MIN_DAYS + ' jours requis.'));
        }
      }

      // Parse CSV avec PapaParse
      var parsed;
      try {
        parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          delimiter: '', // auto-detect (virgule, point-virgule ou tab)
          transformHeader: function(h) { return yoyNormalizeHeader(h); },
        });
      } catch(err) {
        return reject(new Error('Erreur PapaParse : ' + err.message));
      }

      if (!parsed || !parsed.data || parsed.data.length === 0) {
        return reject(new Error('Le fichier CSV est vide ou illisible.'));
      }

      var headers = Object.keys(parsed.data[0] || {});
      var headerMap = yoyBuildHeaderMap(headers);
      try { yoyValidateHeaders(headerMap); } catch(e) { return reject(e); }

      var rows = yoyFilterRows(parsed.data.map(function(r) { return yoyNormalizeRow(r, headerMap); }));
      if (rows.length === 0) {
        return reject(new Error('Aucune ligne ASIN valide trouvée dans le fichier.'));
      }

      // Sanity check parsing
      var sc;
      try { sc = yoySanityCheck(rows); }
      catch(e) { return reject(e); }

      var meta = yoyComputeMeta(rows, file.name, period ? period.from : null, period ? period.to : null);
      meta.sanityCheckOk = true;
      meta.sanityCheckDetail = sc;

      resolve({ rows: rows, meta: meta });
    };
    reader.onerror = function() { reject(new Error('Impossible de lire le fichier.')); };
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * parseYoYXLSX — Parse XLSX via SheetJS (lecture native float64, pas de parsing maison)
 */
function parseYoYXLSX(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var data = e.target.result;
      var wb;
      try {
        wb = XLSX.read(data, { type: 'array', cellDates: false });
      } catch(err) {
        return reject(new Error('Fichier XLSX illisible : ' + err.message));
      }

      var sheetName = wb.SheetNames[0];
      var ws = wb.Sheets[sheetName];

      // Détecter la période depuis le nom du fichier d'abord
      var period = detectYoYPeriodFromFilename(file.name);

      // Convertir en JSON : header:1 pour avoir les lignes brutes, puis chercher la ligne d'en-tête
      var raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
      if (!raw || raw.length < 2) {
        return reject(new Error('Le fichier XLSX est vide ou ne contient pas de données.'));
      }

      // Si pas de période depuis le nom, chercher dans les premières lignes
      if (!period) {
        for (var li = 0; li < Math.min(5, raw.length); li++) {
          var lineStr = raw[li].join(' ');
          var p = detectYoYPeriodFromContent(lineStr);
          if (p) { period = p; break; }
        }
      }

      // Validation durée
      if (period) {
        var days = Math.round((period.to - period.from) / 86400000) + 1;
        if (days < YOY_MIN_DAYS) {
          return reject(new Error('La période fait ' + days + ' jours, minimum ' + YOY_MIN_DAYS + ' jours requis.'));
        }
      }

      // Trouver la ligne d'en-tête (première ligne qui contient 'ASIN')
      var headerRowIdx = -1;
      for (var i = 0; i < Math.min(10, raw.length); i++) {
        var rowStr = raw[i].join('|');
        if (rowStr.indexOf('ASIN') >= 0) { headerRowIdx = i; break; }
      }
      if (headerRowIdx < 0) {
        return reject(new Error('Colonne ASIN introuvable dans le fichier XLSX. Vérifiez que c\'est un export "Ventes par ASIN" VC.'));
      }

      var headers = raw[headerRowIdx].map(function(h) { return yoyNormalizeHeader(String(h || '')); });
      var headerMap = yoyBuildHeaderMap(headers);
      try { yoyValidateHeaders(headerMap); } catch(e) { return reject(e); }

      // Convertir les lignes de données
      var dataRows = [];
      for (var j = headerRowIdx + 1; j < raw.length; j++) {
        var rowObj = {};
        for (var k = 0; k < headers.length; k++) {
          rowObj[headers[k]] = raw[j][k];
        }
        dataRows.push(yoyNormalizeRow(rowObj, headerMap));
      }

      var rows = yoyFilterRows(dataRows);
      if (rows.length === 0) {
        return reject(new Error('Aucune ligne ASIN valide trouvée dans le fichier XLSX.'));
      }

      var sc;
      try { sc = yoySanityCheck(rows); }
      catch(e) { return reject(e); }

      var meta = yoyComputeMeta(rows, file.name, period ? period.from : null, period ? period.to : null);
      meta.sanityCheckOk = true;
      meta.sanityCheckDetail = sc;

      resolve({ rows: rows, meta: meta });
    };
    reader.onerror = function() { reject(new Error('Impossible de lire le fichier XLSX.')); };
    reader.readAsArrayBuffer(file);
  });
}

// ═══════════════════════════════════════════════════════════════
// SANITY CHECK PARSING (RÈGLE C du skill V2 — BLOQUANT)
// ═══════════════════════════════════════════════════════════════

/**
 * yoySanityCheck — Vérifie que le parser produit des chiffres cohérents
 * Sur le top ASIN (CA commandé le plus élevé) : COGS / u_exp doit être entre 0,10 € et 1 000 €
 * Plage : vérification que les totaux unités sont plausibles (>100, <10M)
 * @throws {Error} si le check échoue
 * @returns {object} { asin, ratio, totalUnits, totalCA }
 */
function yoySanityCheck(rows) {
  if (!rows || rows.length === 0) throw new Error('Dataset vide, sanity check impossible.');

  // Trouver le top ASIN par CA commandé
  var topRow = rows.reduce(function(best, r) {
    return (r.ca_cmd || 0) > (best.ca_cmd || 0) ? r : best;
  }, rows[0]);

  var ratio = (topRow.u_exp > 0) ? topRow.cogs / topRow.u_exp : NaN;

  if (isNaN(ratio) || ratio < YOY_SANITY_MIN || ratio > YOY_SANITY_MAX) {
    var detail = isNaN(ratio)
      ? 'COGS=' + topRow.cogs + ', u_exp=' + topRow.u_exp + ' → ratio NaN'
      : 'ratio = ' + ratio.toFixed(4) + ' € hors plage [' + YOY_SANITY_MIN + '–' + YOY_SANITY_MAX + ']';
    throw new Error(
      'Sanity check ÉCHOUÉ sur ' + (topRow.asin || '?') + ' : ' + detail + '. ' +
      'Vérifiez le format du fichier — le parser a peut-être mal traité les séparateurs de milliers.'
    );
  }

  // Vérification totaux plausibles
  var totalUnits = rows.reduce(function(s, r) { return s + (r.u_cmd || 0); }, 0);
  var totalCA    = rows.reduce(function(s, r) { return s + (r.ca_cmd || 0); }, 0);
  if (totalUnits < 100 || totalUnits > 10000000) {
    throw new Error(
      'Sanity check : total unités commandées = ' + Math.round(totalUnits) + ' — valeur hors plage plausible [100 – 10 000 000]. ' +
      'Vérifiez que le fichier correspond bien à une période de ≥ 2 mois.'
    );
  }

  return {
    asin: topRow.asin,
    ratio: ratio,
    cogsRaw: topRow.cogs,
    uExpRaw: topRow.u_exp,
    totalUnits: totalUnits,
    totalCA: totalCA,
  };
}

/**
 * yoyUpdateSanityRecap — Met à jour le bloc de confirmation après import
 * Affiche le récap "Période A : X ASINs · Y € · sanity check ✓"
 */
function yoyUpdateSanityRecap() {
  var el = document.getElementById('yoy-sanity-recap');
  if (!el) return;
  var pA   = yoyState.periodA;
  var pRef = yoyState.periodRef;
  if (!pA.meta || !pRef.meta) return;

  var sc = pA.meta.sanityCheckDetail;
  var scHtml = sc
    ? `Sanity check ✅ : ASIN <strong>${esc(sc.asin)}</strong> = ${sc.cogsRaw.toFixed(2)} COGS / ${sc.uExpRaw.toFixed(0)} u exp = <strong>${sc.ratio.toFixed(2)} €/u</strong>`
    : '—';

  el.innerHTML = `<div style="background:var(--s2);border:0.5px solid var(--g-bd);border-radius:var(--rd);padding:14px 16px;font-size:12px;color:var(--tx2);line-height:1.8">
    <div><strong style="color:var(--tx)">Période A :</strong> ${pA.meta.asinCount} ASINs · ${yoyFmtEur(pA.meta.caTotal)} de CA commandé total · ${pA.meta.days} jours</div>
    <div><strong style="color:var(--tx)">Période Réf :</strong> ${pRef.meta.asinCount} ASINs · ${yoyFmtEur(pRef.meta.caTotal)} de CA commandé total · ${pRef.meta.days} jours</div>
    <div style="margin-top:6px">${scHtml}</div>
    <div style="margin-top:8px;padding-top:8px;border-top:0.5px solid var(--bd)">
      <strong style="color:var(--g)">✓ Prêt à lancer l'analyse</strong>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// LANCEMENT DE L'ANALYSE
// ═══════════════════════════════════════════════════════════════

async function yoyLaunchAnalysis() {
  const pA   = yoyState.periodA;
  const pRef = yoyState.periodRef;
  const c    = cl();

  // Validations finales
  if (!pA.meta || pA.error)   { alert('Erreur sur la période A.');            return; }
  if (!pRef.meta || pRef.error) { alert('Erreur sur la période de référence.'); return; }
  if (!c) { alert('Aucun client sélectionné.'); return; }

  // Basculer sur l'écran de progression
  yoyState.screen = 'progress';
  yoyState.progress = { phase: 'Parsing des données…', pct: 10 };
  render();

  await yoySleep(200);

  try {
    // Étape 1 : calcul des totaux de base (CP1 — minimal)
    yoyState.progress = { phase: 'Calcul des indicateurs…', pct: 40 };
    render();
    await yoySleep(200);

    const totals = yoyComputeTotals(pA.rows, pRef.rows, pA.meta, pRef.meta);

    // Étape 2 : CP2+ calculera les 12 dimensions — placeholder pour l'instant
    yoyState.progress = { phase: 'Calcul des 12 dimensions…', pct: 65 };
    render();
    await yoySleep(300);

    const dimensions = {}; // CP2

    // Étape 3 : Sauvegarde IndexedDB
    yoyState.progress = { phase: 'Sauvegarde de l\'analyse…', pct: 85 };
    render();
    await yoySleep(200);

    const analysis = {
      id: yoyUUID(),
      clientId: c.id,
      createdAt: new Date().toISOString(),
      periodA: {
        from: pA.meta.from,
        to:   pA.meta.to,
        label: pA.meta.label,
        days:  pA.meta.days,
        asinCount: pA.meta.asinCount,
      },
      periodRef: {
        from: pRef.meta.from,
        to:   pRef.meta.to,
        label: pRef.meta.label,
        days:  pRef.meta.days,
        asinCount: pRef.meta.asinCount,
      },
      totals: totals,
      dimensions: dimensions,
      metadata: {
        sanityCheckOk: pA.meta.sanityCheckOk && pRef.meta.sanityCheckOk,
        sanityCheckDetail: pA.meta.sanityCheckDetail,
        parserVersion: 'yoy-v3.6.5-cp1',
      },
    };

    await yoySave(analysis);

    // Ajouter à l'historique local
    yoyState.analyses.push(analysis);
    yoyState.currentAnalysis = analysis;

    yoyState.progress = { phase: 'Analyse terminée !', pct: 100 };
    render();
    await yoySleep(400);

    yoyState.screen = 'result';
    render();

  } catch(err) {
    yoyState.screen = 'import';
    yoyState.periodA.error   = err.message;
    render();
  }
}

/**
 * yoyComputeTotals — Calcule les totaux de base pour les deux périodes (CP1 minimal)
 * CP2 complétera avec les 12 dimensions
 */
function yoyComputeTotals(rowsA, rowsRef, metaA, metaRef) {
  var sum = function(rows, key) { return rows.reduce(function(s,r) { return s + (r[key]||0); }, 0); };

  var caA   = sum(rowsA,   'ca_cmd');
  var caRef = sum(rowsRef, 'ca_cmd');
  var uA    = sum(rowsA,   'u_cmd');
  var uRef  = sum(rowsRef, 'u_cmd');

  var daysA   = metaA.days   || 1;
  var daysRef = metaRef.days || 1;

  // Normalisation : projeter la période A à la durée de la période de référence
  var caAProj   = caA   * (daysRef / daysA);
  var uAProj    = uA    * (daysRef / daysA);
  var deltaCA   = caAProj - caRef;
  var deltaCAPct = caRef > 0 ? deltaCA / caRef * 100 : 0;

  return {
    caA: caA,
    caRef: caRef,
    caAProj: caAProj,
    uA: uA,
    uRef: uRef,
    uAProj: uAProj,
    deltaCA: deltaCA,
    deltaCAPct: deltaCAPct,
    // Annualisé
    caAPerDay:   caA   / daysA,
    caRefPerDay: caRef / daysRef,
    deltaCAAnnu: (caA / daysA - caRef / daysRef) * 365,
  };
}

// ═══════════════════════════════════════════════════════════════
// NAVIGATION BACK / HISTORIQUE
// ═══════════════════════════════════════════════════════════════

function yoyBack() {
  yoyState.screen = 'import';
  yoyState.periodA   = { file: null, rows: null, meta: null, error: null };
  yoyState.periodRef = { file: null, rows: null, meta: null, error: null };
  render();
}

function yoyLoadFromHistory(id) {
  if (!id) return;
  var a = yoyState.analyses.find(function(x) { return x.id === id; });
  if (a) {
    yoyState.currentAnalysis = a;
    yoyState.screen = 'result';
    render();
  }
}

// ═══════════════════════════════════════════════════════════════
// INDEXEDDB — Persistance des analyses
// ═══════════════════════════════════════════════════════════════

/**
 * yoySave — Sauvegarde une analyse dans IndexedDB (store yoy_analyses)
 */
async function yoySave(analysis) {
  const db = await openDB();
  return new Promise(function(resolve, reject) {
    const tx    = db.transaction('yoy_analyses', 'readwrite');
    const store = tx.objectStore('yoy_analyses');
    // Ne pas stocker les lignes brutes (trop volumineux) — stocker les métadonnées et résultats
    const toStore = Object.assign({}, analysis);
    const req = store.put(toStore);
    tx.oncomplete = function() { resolve(); };
    tx.onerror    = function() { reject(tx.error); };
  });
}

/**
 * yoyLoadAll — Charge toutes les analyses d'un client depuis IndexedDB
 */
async function yoyLoadAll(clientId) {
  try {
    const db = await openDB();
    return new Promise(function(resolve, reject) {
      const tx    = db.transaction('yoy_analyses', 'readonly');
      const store = tx.objectStore('yoy_analyses');
      const idx   = store.index('clientId');
      const req   = idx.getAll(clientId);
      req.onsuccess = function() {
        var results = req.result || [];
        // Trier par date croissante
        results.sort(function(a, b) { return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1; });
        resolve(results);
      };
      req.onerror = function() { reject(req.error); };
    });
  } catch(e) {
    return [];
  }
}

/**
 * yoyLoadOne — Charge une analyse spécifique depuis IndexedDB
 */
async function yoyLoadOne(id) {
  const db = await openDB();
  return new Promise(function(resolve, reject) {
    const tx    = db.transaction('yoy_analyses', 'readonly');
    const store = tx.objectStore('yoy_analyses');
    const req   = store.get(id);
    req.onsuccess = function() { resolve(req.result || null); };
    req.onerror   = function() { reject(req.error); };
  });
}

// ═══════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════

function yoyUUID() {
  return 'yoy-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

function yoySleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

function yoyFmtEur(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  var abs = Math.abs(v);
  var sign = v < 0 ? '−' : '';
  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1).replace('.', ',') + ' M€';
  if (abs >= 1000)    return sign + Math.round(abs).toLocaleString('fr-FR') + ' €';
  return sign + abs.toFixed(2).replace('.', ',') + ' €';
}

// ═══════════════════════════════════════════════════════════════
// RESET D'ÉTAT (appelé à chaque go('yoy'))
// ═══════════════════════════════════════════════════════════════
// Note : yoyState._histLoaded est conservé pour ne pas recharger
// l'historique à chaque re-render. Il est réinitialisé si on change de client.
(function() {
  var _lastClientId = null;
  var _origGo = typeof go === 'function' ? go : null;
  // Patch go() pour détecter les changements de client et reset l'état YoY
  // On ne peut pas patcher go() directement ici car il est défini plus bas dans core.js
  // → on utilise un hook dans renderYoY() qui vérifie le clientId
  var _checkReset = function() {
    var c = cl();
    var cid = c ? c.id : null;
    if (cid !== _lastClientId) {
      _lastClientId = cid;
      yoyState._histLoaded = false;
      yoyState.analyses = [];
      yoyState.screen = 'import';
      yoyState.periodA   = { file: null, rows: null, meta: null, error: null };
      yoyState.periodRef = { file: null, rows: null, meta: null, error: null };
      yoyState.currentAnalysis = null;
    }
  };
  // Exécution à chaque appel de renderYoY
  var _origRenderYoY = renderYoY;
  renderYoY = function() {
    _checkReset();
    return _origRenderYoY();
  };
})();
