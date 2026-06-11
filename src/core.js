// Amazon Pilot — Core (variables, utilitaires, rendu principal)
// Extrait automatiquement — ne pas éditer directement

window.onerror = function(msg, src, line, col) {
  if (line === 1 && col <= 20) return true;
  if (!src || src === '') return true;
  console.error('[AP] Erreur:', msg, src + ':' + line + ':' + col);
  return false;
};
window.addEventListener('unhandledrejection', function(e) {
  console.error('[AP] Unhandled promise rejection:', e.reason);
});
const APP_VERSION = '3.6.9.4';
const API_BASE_URL = 'https://konuaxmdxjnzcuw2etjqwczrla0xycvt.lambda-url.eu-west-3.on.aws';

// ═══════════════════════════════════════════════════════════════
// MODULE AI USAGE — Compteur tokens + sélecteur modèles
// ═══════════════════════════════════════════════════════════════

const AI_MODELS = {
  standard: {
    id: 'claude-sonnet-4-20250514',
    label: 'Sonnet 4.6 — Standard',
    priceIn:  3.00,   // $ / 1M tokens input
    priceOut: 15.00,  // $ / 1M tokens output
    eurUsd:   0.92,
  },
  premium: {
    id: 'claude-opus-4-7-20250514', // ⚠ À vérifier : peut être claude-opus-4-7 sans date
    label: 'Opus 4.7 — Premium',
    priceIn:  15.00,
    priceOut: 75.00,
    eurUsd:   0.92,
  }
};

const aiUsage = {
  session: {
    calls:0, tokensIn:0, tokensOut:0, costEur:0,
    byFeature: {
      revue:  {calls:0,tokensIn:0,tokensOut:0,costEur:0},
      buybox: {calls:0,tokensIn:0,tokensOut:0,costEur:0},
      seo:        {calls:0,tokensIn:0,tokensOut:0,costEur:0},
      seo_enrich: {calls:0,tokensIn:0,tokensOut:0,costEur:0},
      import: {calls:0,tokensIn:0,tokensOut:0,costEur:0},
      swot:   {calls:0,tokensIn:0,tokensOut:0,costEur:0},
      other:  {calls:0,tokensIn:0,tokensOut:0,costEur:0},
    }
  },
  record(feature, modelKey, tokensIn, tokensOut) {
    const model = AI_MODELS[modelKey] || AI_MODELS.standard;
    const costEur = (tokensIn * model.priceIn + tokensOut * model.priceOut) / 1_000_000 * model.eurUsd;
    this.session.calls++; this.session.tokensIn += tokensIn;
    this.session.tokensOut += tokensOut; this.session.costEur += costEur;
    const f = this.session.byFeature[feature] || this.session.byFeature.other;
    f.calls++; f.tokensIn += tokensIn; f.tokensOut += tokensOut; f.costEur += costEur;
    try {
      const hist = JSON.parse(localStorage.getItem('ap-ai-usage') || '[]');
      hist.push({ ts: new Date().toISOString(), feature, model: model.id,
        tokensIn, tokensOut, costEur: Math.round(costEur * 10000) / 10000 });
      if (hist.length > 500) hist.splice(0, hist.length - 500);
      localStorage.setItem('ap-ai-usage', JSON.stringify(hist));
    } catch(e) {}
    console.log('[AI] ' + feature + ' ' + model.id + ' in:' + tokensIn + ' out:' + tokensOut + ' → ' + costEur.toFixed(4) + '€');
  },
  getModel(feature) {
    const k = localStorage.getItem('ap-model-' + feature) || localStorage.getItem('ap-model') || 'standard';
    return AI_MODELS[k] ? k : 'standard';
  },
  getModelId(feature) { return AI_MODELS[this.getModel(feature)].id; },
  fmtCost(eur) {
    if (eur < 0.001) return '<0.001€';
    if (eur < 0.01)  return (eur * 100).toFixed(2) + '¢';
    return eur.toFixed(3) + '€';
  }
};


// @smoke

// @guide

// @parser_erp

// @parser_vc

let clients = [];
let forecastTab = 'calendar';  // 'calendar' | 'plan2027'
let activeId = null;
let screen = 'welcome';
let agentVCParam = null;
let wizStep = 0;
let newClient = freshClient();
let aiResult = '';
let aiLoading = false;
let selectedAsin = null;
let chartInst = null;
let historyChartInst = null;
let dashWeeklyChartInst = null;
let dashWeeklyActiveMkt = null;
let dashWeeklyView = 'semaines';
let debugLog = [];
let historyView = 'weekly';
let asinSort   = 'ca_desc';
let asinSortDir = 'desc'; // direction tri colonne
let asinLimit  = 50;
let asinView   = 'all';    // 'all' | 'lowstock' | 'declining' | 'growing' | 'seg-a' | 'seg-b' | 'seg-c'
let asinViewAsins = null;  // liste des ASINs filtrés par la vue active (null = pas de filtre)
let asinViewCustomIds = null; // v3.6.7 — liste ASIN IDs pour filtre YoY (CTA 11 / CTA 12)
let asinViewLabel = '';       // v3.6.7 — libellé du badge filtre YoY
var _yoyReturnCtx = null;     // v3.6.8 α+γ — contexte retour YoY { scrollY, label } — session only
let asinSearch = ''; // recherche texte ASIN/SKU/titre
let _searchTimer = null;
function debouncedRender() {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => render(), 300);
}
function triggerSearch() {
  const input = document.getElementById('asin-search-input');
  if (input) asinSearch = input.value;
  render();
}
let pompierThreshold = 10;
let pendingFiles = { ventes: null, ventesAppro: null, trafic: null, stock: null, stockAppro: null };
let filters = { market: 'all', brand: 'all', segment: 'all' };

const NAV = [
  { id: 'weekly',    icon: '🗓️', label: 'Revue Hebdo', badge: true },
  { id: 'dashboard', icon: '📊', label: 'Tableau de bord' },
  { id: 'yoy',       icon: '📈', label: 'Analyse comparée' },
  { id: 'import',    icon: '📥', label: 'Import données' },
  { id: 'agent',     icon: '🤖', label: 'Agent Import' },
  { id: 'asins',     icon: '📦', label: 'Analyse ASINs' },
  { id: 'pompier',   icon: '🚨', label: 'Diagnostic CA' },
  { id: 'buybox',    icon: '🏆', label: 'Buy Box', badgeFn: function(c) { return c ? calcBuyBoxAlerts(c).critical.length : 0; } },
  { id: 'potentiel', icon: '🚀', label: 'ASINs Potentiel' },
  { id: 'appros',    icon: '🚢', label: 'Appros' },
  { id: 'forecast',   icon: '📅', label: 'Prévisionnel' },
  { id: 'seo',       icon: '✍️', label: 'Agent SEO', badgeFn: function(c) { return c ? seoGetPendingVerifications().length : 0; } },
  { id: 'fiche',     icon: '📋', label: 'Fiche client' },
  { id: 'config',    icon: '⚙️', label: 'Configuration' },
];

const MARKETS = ['.fr', '.de', '.it', '.es', '.co.uk', '.nl', '.be', '.se', '.pl'];
const MARKET_CODES = { 'FR': '.fr', 'DE': '.de', 'IT': '.it', 'ES': '.es', 'UK': '.co.uk', 'GB': '.co.uk', 'NL': '.nl', 'BE': '.be', 'SE': '.se', 'PL': '.pl' };
const MARKET_DOMAINS = { '.fr': 'amazon.fr', '.de': 'amazon.de', '.it': 'amazon.it', '.es': 'amazon.es', '.co.uk': 'amazon.co.uk', '.nl': 'amazon.nl', '.be': 'amazon.com.be', '.se': 'amazon.se', '.pl': 'amazon.pl' };
// Codes boutique Amazon Vendor Central → marché (pour CSV multi-boutiques Gers Équipement et similaires)
const BOUTIQUE_CODES = {
  'A13V1IB3VIYZZH': '.fr', // France
  'A1RKKUPIHCS9HS': '.es', // Espagne
  'A1805IZSGTT6HS': '.nl', // Pays-Bas
  'A1PA6795UKMFR9': '.de', // Allemagne
  'APJ6JRA9NG5V4':  '.it', // Italie
  'A2NODRKZP88ZB9': '.be', // Belgique
  'A1F83G8C2ARO7P': '.co.uk', // UK
  'ATVPDKIKX0DER':  '.com',   // USA
  'A1VC38T7YXB528': '.jp',    // Japon
};
const WIZ_STEPS = ['Identité', 'Config Amazon', 'Comptes VC & Catalogue', 'Contraintes', 'Historique', 'Récapitulatif'];

const MARKETPLACES_FULL = [
  // Europe
  { market: '.fr',     flag: '🇫🇷', name: 'France',               region: 'Europe' },
  { market: '.de',     flag: '🇩🇪', name: 'Allemagne',             region: 'Europe' },
  { market: '.it',     flag: '🇮🇹', name: 'Italie',                region: 'Europe' },
  { market: '.es',     flag: '🇪🇸', name: 'Espagne',               region: 'Europe' },
  { market: '.nl',     flag: '🇳🇱', name: 'Pays-Bas',              region: 'Europe' },
  { market: '.be',     flag: '🇧🇪', name: 'Belgique',              region: 'Europe' },
  { market: '.co.uk',  flag: '🇬🇧', name: 'Royaume-Uni',           region: 'Europe' },
  { market: '.se',     flag: '🇸🇪', name: 'Suède',                 region: 'Europe' },
  { market: '.pl',     flag: '🇵🇱', name: 'Pologne',               region: 'Europe' },
  { market: '.com.tr', flag: '🇹🇷', name: 'Turquie',               region: 'Europe' },
  // Amérique du Nord
  { market: '.com',    flag: '🇺🇸', name: 'États-Unis',            region: 'Amérique du Nord' },
  { market: '.ca',     flag: '🇨🇦', name: 'Canada',                region: 'Amérique du Nord' },
  { market: '.com.mx', flag: '🇲🇽', name: 'Mexique',               region: 'Amérique du Nord' },
  // Amérique du Sud
  { market: '.com.br', flag: '🇧🇷', name: 'Brésil',                region: 'Amérique du Sud' },
  // Asie-Pacifique
  { market: '.co.jp',  flag: '🇯🇵', name: 'Japon',                 region: 'Asie-Pacifique' },
  { market: '.in',     flag: '🇮🇳', name: 'Inde',                  region: 'Asie-Pacifique' },
  { market: '.com.au', flag: '🇦🇺', name: 'Australie',             region: 'Asie-Pacifique' },
  { market: '.sg',     flag: '🇸🇬', name: 'Singapour',             region: 'Asie-Pacifique' },
  // Moyen-Orient & Afrique
  { market: '.ae',     flag: '🇦🇪', name: 'Émirats Arabes Unis',   region: 'Moyen-Orient & Afrique' },
  { market: '.sa',     flag: '🇸🇦', name: 'Arabie Saoudite',       region: 'Moyen-Orient & Afrique' },
  { market: '.eg',     flag: '🇪🇬', name: 'Égypte',                region: 'Moyen-Orient & Afrique' },
  { market: '.co.za',  flag: '🇿🇦', name: 'Afrique du Sud',        region: 'Moyen-Orient & Afrique' },
];

// ═══════════════════════════════════════════════════════════════════
// BUY BOX v3.6.1 — Constantes
// ═══════════════════════════════════════════════════════════════════

// 11 hypothèses de cause perte Buy Box (7 maquette + 4 ajouts orchestrateur)
var BUYBOX_HYPOTHESES = [
  { id: 'bol-not-transmitted',  label: 'BOL non transmis aux opérationnels',   hint: 'Le numéro de connaissement n\'arrive pas dans les ASN — défauts BOL Mismatch en cascade.' },
  { id: 'competitor-3p',        label: 'Concurrent 3P prix',                   hint: 'Un vendeur tiers propose un prix inférieur ou détient l\'offre Featured.' },
  { id: 'stock-insufficient',   label: 'Stock insuffisant',                    hint: 'Stock Amazon < seuil — disponibilité dégradée.' },
  { id: 'po-not-confirmed',     label: 'PO non confirmé',                      hint: 'PO ouvert mais taux de confirmation < 50 %.' },
  { id: 'compliance-removed',   label: 'Suppression éligibilité (compliance)', hint: 'Listing retiré pour non-conformité (sécurité, doc, marque).' },
  { id: 'vendor-auto-pricing',  label: 'Pricing automatique Vendor',           hint: 'Amazon ajuste le retail price en dehors de notre fourchette.' },
  { id: 'listing-inactive',     label: 'Listing inactif',                      hint: 'Fiche désactivée côté Amazon (statut, image manquante, etc.).' },
  // Ajouts orchestrateur
  { id: 'crap-designation',     label: 'CRaP désigné',                         hint: 'Can\'t Realize a Profit — Amazon bloque la Buy Box si la marge devient négative pour eux.' },
  { id: 'parent-child-shift',   label: 'Variation parent/enfant perdue',       hint: 'L\'enfant a basculé sur un parent qui prend la Featured Offer.' },
  { id: 'spec-mismatch',        label: 'Spécifications incohérentes',          hint: 'Poids ou dimensions du listing diffèrent du PO — blocage automatique.' },
  { id: 'market-restriction',   label: 'Restriction marché',                   hint: 'Produit conforme FR mais bloqué sur un autre marché actif.' }
];

// Statuts des hypothèses
// 'todo'        — non vérifiée
// 'investigate' — à investiguer (compatible avec les faits, à creuser)
// 'validated'   — confirmée comme cause
// 'rejected'    — écartée (faits contradictoires)
var BUYBOX_HYPO_STATUS = ['todo', 'investigate', 'validated', 'rejected'];

// Conditions de déverrouillage de la Conclusion (Phase 2)
var BUYBOX_CONCLUSION_CONDITIONS = [
  { id: 'min-journal',       label: 'Au moins 3 entrées dans le journal',                    check: function(cs) { return (cs.journal || []).length >= 3; } },
  { id: 'hypotheses-tested', label: 'Au moins 1 hypothèse validée OU 3 écartées avec faits', check: function(cs) {
      var hypos = cs.hypotheses || [];
      var validated = hypos.filter(function(h) { return h.status === 'validated'; }).length;
      var rejected  = hypos.filter(function(h) { return h.status === 'rejected' && (h.evidence || '').length > 0; }).length;
      return validated >= 1 || rejected >= 3;
    }
  },
  { id: 'bol-source-known',  label: 'Source du BOL renseignée (fiche client)',               check: function(cs, client) { return !!(client && client.bolSource); } }
];

// Bandeau contexte sectoriel — statique v3.6.1 (TODO v3.7 : zone admin éditable)
var BUYBOX_CONTEXT_BANNER = {
  title: 'Contexte sectoriel — Vendor on-time policy mise à jour Amazon',
  body:  'Depuis janvier 2026, Amazon mesure la conformité on-time via les ASN Vendor (et non plus via les signaux internes de réception) et a fusionné les catégories de défauts « PO not on time » et « PRO/BOL mismatch ». Seuil de conformité relevé de 90 % à 95 %. Phase d\'observation du 19 janvier au 24 février 2026, facturation effective depuis le 25 février à 3 % du purchase cost.',
  cite:  'Source : ChannelX, 19 janvier 2026.'
};

function marketOptionsHTML(selected) {
  var html = '';
  var lastRegion = '';
  for (var i = 0; i < MARKETPLACES_FULL.length; i++) {
    var m = MARKETPLACES_FULL[i];
    if (m.region !== lastRegion) {
      if (lastRegion) html += '</optgroup>';
      html += '<optgroup label="' + m.region + '">';
      lastRegion = m.region;
    }
    html += '<option value="' + m.market + '"' + (m.market === selected ? ' selected' : '') + '>' + m.flag + ' ' + m.name + '</option>';
  }
  if (lastRegion) html += '</optgroup>';
  return html;
}

// @parsers_internal


// ═══════════════════════════════════════════════════════════════════
// PARSERS BUY BOX v3.6.0 — défauts livraison & rendez-vous Amazon
// ═══════════════════════════════════════════════════════════════════

// Parser CSV générique — gère BOM UTF-8, guillemets, virgules dans les champs


// Parser défauts livraison — colonnes Amazon Vendor Central (export EN)


// Parser rendez-vous — bilingue FR/EN
// Détection langue : colonne "BdC" = FR, colonne "PO"+"Issue" = EN


// Garde-fou vendor code défauts — adapté de checkImportCoherence v3.5.6
function checkDefectsVendorCoherence(client, defects) {
  var clientVCs = [];
  if (client.accounts && client.accounts.length > 0) {
    for (var i = 0; i < client.accounts.length; i++) {
      var vc = (client.accounts[i].vendorCode || '').trim().toUpperCase();
      if (vc && clientVCs.indexOf(vc) === -1) clientVCs.push(vc);
    }
  }
  if (clientVCs.length === 0 && client.vendorCode) {
    clientVCs.push(client.vendorCode.trim().toUpperCase());
  }

  if (clientVCs.length === 0) {
    return { level: 'info', msg: 'Aucun vendor code déclaré dans la fiche client — vérification impossible.' };
  }

  var csvVCs = {};
  var total = 0;
  var unknown = 0;
  for (var d = 0; d < defects.length; d++) {
    var v = (defects[d].vendorCode || '').trim().toUpperCase();
    if (!v) continue;
    total++;
    csvVCs[v] = (csvVCs[v] || 0) + 1;
    if (clientVCs.indexOf(v) === -1) unknown++;
  }

  if (total === 0) {
    return { level: 'info', msg: 'Aucun vendor code dans le CSV.' };
  }

  var pct = Math.round(unknown / total * 100);
  if (pct > 50) {
    var unknownVCs = [];
    for (var k in csvVCs) {
      if (csvVCs.hasOwnProperty(k) && clientVCs.indexOf(k) === -1) {
        unknownVCs.push(k + ' (' + csvVCs[k] + ')');
      }
    }
    return {
      level: 'critical',
      msg: pct + '% des défauts ont un vendor code inconnu : ' + unknownVCs.join(', ')
        + '. VC du client : ' + clientVCs.join(', ')
        + '. Êtes-vous sûr d\'importer dans le bon client ?'
    };
  }
  if (pct > 10) {
    return { level: 'warning', msg: pct + '% des défauts ont un vendor code inconnu (toléré sous 50%).' };
  }
  return null;
}

// ── Import défauts livraison ──
function importBuyBoxDefects(file) {
  if (!file) return;
  var c = cl();
  if (!c) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    var parsed = parseDeliveryDefectsCSV(text);
    if (parsed.error) {
      alert('Erreur import défauts livraison : ' + parsed.error);
      log('✗ Import défauts livraison : ' + parsed.error, 'err');
      return;
    }

    var coherence = checkDefectsVendorCoherence(c, parsed.items);
    if (coherence && coherence.level === 'critical') {
      var proceed = confirm('⛔ ' + coherence.msg + '\n\nVoulez-vous VRAIMENT importer dans "' + c.name + '" ?');
      if (!proceed) {
        log('⛔ Import défauts annulé par utilisateur (incohérence VC)', 'err');
        return;
      }
      log('⚠️ Import défauts forcé malgré incohérence VC', 'warn');
    } else if (coherence && coherence.level === 'warning') {
      log('⚠️ ' + coherence.msg, 'warn');
    }

    // Écrasement complet (pas de fusion incrémentale en v3.6.0)
    c.deliveryDefects = parsed.items;
    c.deliveryDefectsDate = new Date().toISOString().slice(0, 10);
    save();

    var s = parsed.summary;
    var vcList = Object.keys(s.vendorCodes).map(function(k) { return k + ' (' + s.vendorCodes[k] + ')'; }).join(', ');
    var sdList = Object.keys(s.subDefects).map(function(k) { return k + ' : ' + s.subDefects[k]; }).join(' · ');
    // v3.6.1 — toast import défauts
    showToast('✓ ' + s.totalDefects + ' défauts livraison importés — ' + vcList, 'alr-g', 4000);
    log('✓ ' + s.totalDefects + ' défauts importés — VC : ' + vcList + ' · Sub-Defects : ' + sdList + ' · ' + s.totalUnits + ' unités impactées', 'ok');
    render();
  };
  reader.readAsText(file, 'utf-8');
}

// ── Import rendez-vous ──
function importBuyBoxAppointments(file) {
  if (!file) return;
  var c = cl();
  if (!c) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    var parsed = parseAppointmentsCSV(text);
    if (parsed.error) {
      alert('Erreur import rendez-vous : ' + parsed.error);
      log('✗ Import rendez-vous : ' + parsed.error, 'err');
      return;
    }

    c.deliveryAppointments = parsed.items;
    c.deliveryAppointmentsDate = new Date().toISOString().slice(0, 10);
    save();

    var s = parsed.summary;
    var prefList = Object.keys(s.vBolPrefixes).map(function(k) { return k + 'xxx (' + s.vBolPrefixes[k] + ')'; }).join(', ');
    var shipList = Object.keys(s.shipTo).map(function(k) { return k + ' (' + s.shipTo[k] + ')'; }).join(', ');
    // v3.6.1 — toast import rendez-vous
    showToast('✓ ' + s.totalAppointments + ' rendez-vous importés (' + s.sourceLanguage.toUpperCase() + ') — V-BOL : ' + (prefList || 'aucun'), 'alr-g', 4000);
    log('✓ ' + s.totalAppointments + ' rendez-vous importés (' + s.sourceLanguage.toUpperCase() + ') — V-BOL : ' + (prefList || 'aucun') + ' · FC : ' + (shipList || 'aucun'), 'ok');
    render();
  };
  reader.readAsText(file, 'utf-8');
}

// @idb


function log(msg, type = '') {
  const ts = new Date().toLocaleTimeString('fr-FR');
  debugLog.push({ ts, msg, type });
  if (debugLog.length > 80) debugLog.shift();
  console.log(`[${ts}] ${msg}`);
}


// ─────────────────────────────────────────────────────────────────────────
// saveSmokeHistory : enregistre un point de mesure dans IDB smoke_history
// Appelé à chaque fin de smokeTest(), quel que soit le client.
// Pas de logique d'évaluation ici — collecte uniquement (v3.6.6.1).
// ─────────────────────────────────────────────────────────────────────────


function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ap-theme', next);
  updateThemeIcon(next);
  // Re-init charts with new colors
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  if (historyChartInst) { historyChartInst.destroy(); historyChartInst = null; }
  if (dashWeeklyChartInst) { dashWeeklyChartInst.destroy(); dashWeeklyChartInst = null; }
  if (segChartInst) { segChartInst.destroy(); segChartInst = null; }
}

function updateThemeIcon(theme) {
  const el = document.getElementById('theme-icon');
  if (el) el.textContent = theme === 'dark' ? '☀️' : '🌙';
}
// @utils




// _parseCSVFile_LEGACY : corps original remplacé en v3.6.6.1 par le wrapper parseVCFile()
// Conservé ci-dessous jusqu'à validation complète — à supprimer en v3.6.7
/* eslint-disable */


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


// ── Fraîcheur des données ────────────────────────────────────────
// Retourne un objet par type : { ventes, trafic, stock }
// Chaque entrée : { lastDate, daysSince, weeksBehind, missing, status }
// status : 'ok' (semaine précédente couverte) | 'stale' (1 sem. derrière) | 'missing' (2+ sem. ou absent)
// Logique métier : les données de la semaine S-1 sont disponibles le lundi de la semaine S.
// On vérifie donc que le dernier import couvre bien la semaine ISO précédente, pas juste l'ancienneté.



// Retourne la plage de dates d'une semaine ISO (ex: "14-20 avr.")


// Couleur du point sidebar selon fraîcheur globale


// ── Bloc comparatif YTD N vs N-1 ─────────────────────────────
function renderYTDComparison(c) {
  const ytd = c.ytdData?.ventes;
  if (!ytd) return '';

  // Chercher N-1 dans annualData pour la même période
  const currentYear = new Date().getFullYear().toString();
  const prevYear = (parseInt(currentYear) - 1).toString();
  const annualPrev = c.annualData?.[prevYear]?.ventes;

  const ytdCA = ytd.totalCA || 0;
  const ytdUnits = ytd.totalUnits || 0;
  const ytdGV = c.ytdData?.trafic?.totalGV || 0;

  // Calcul YoY sur même période
  // Utiliser revenueYoY du fichier YTD si pas de données N-1 chargées
  // Sinon calculer depuis annualPrev (approximation : annuel × prorata jours)
  let ytdVsNm1 = null;
  if (annualPrev) {
    // Prorata : si YTD couvre X jours sur 365, on prend X/365 du CA annuel N-1
    const [ds, ms, ys] = (ytd.periodStart || '01/01/'+currentYear).split('/').map(Number);
    const [de, me, ye] = (ytd.periodEnd || '').split('/').map(Number);
    if (de && me && ye) {
      const startD = new Date(ys, ms-1, ds);
      const endD = new Date(ye, me-1, de);
      const daysYTD = Math.round((endD - startD) / 86400000);
      const annualPrevCA = annualPrev.totalCA || 0;
      const prorataPrev = annualPrevCA * (daysYTD / 365);
      if (prorataPrev > 0) ytdVsNm1 = ((ytdCA - prorataPrev) / prorataPrev * 100).toFixed(1);
    }
  }

  const annualYears = Object.keys(c.annualData || {}).sort().reverse();
  const hasAnnual = annualYears.length > 0;

  let h = `<div class="cd" style="margin-bottom:14px">`;
  h += `<div class="cd-t space"><span>📅 Vision Annuelle</span>`;
  if (!hasAnnual) h += `<button class="btn btn-sm" onclick="go('import')" style="border-color:var(--or-border);color:var(--or)">+ Charger historique N-1/N-2</button>`;
  h += `</div>`;

  // Grille : YTD en cours + années historiques
  h += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">`;

  // YTD courant
  const ytdLabel = `${ytd.periodStart?.slice(6,10) || currentYear} YTD (${ytd.periodStart?.slice(0,5) || '01/01'} → ${ytd.periodEnd?.slice(0,5) || '?'})`;
  h += `<div style="padding:14px 16px;background:var(--or-l);border:1px solid var(--or-border);border-radius:var(--rdl)">
    <div style="font-size:10px;font-weight:600;color:var(--or);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${ytdLabel}</div>
    <div style="font-size:22px;font-weight:700">${fmtEur(ytdCA)}</div>
    <div style="font-size:11px;color:var(--tx2);margin-top:4px">${fmt(ytdUnits)} unités${ytdGV ? ' · ' + fmt(ytdGV) + ' GV' : ''}</div>
    ${ytdVsNm1 !== null ? `<div style="font-size:12px;font-weight:600;margin-top:6px;color:${parseFloat(ytdVsNm1)>=0?'var(--g)':'var(--r)'}">
      ${parseFloat(ytdVsNm1)>=0?'▲':'▼'} ${Math.abs(ytdVsNm1)}% vs ${prevYear} même période
    </div>` : ''}
  </div>`;

  // Années historiques chargées
  annualYears.slice(0,3).forEach(year => {
    const ann = c.annualData[year];
    const annCA = ann.ventes?.totalCA || 0;
    const annUnits = ann.ventes?.totalUnits || 0;
    const annGV = ann.trafic?.totalGV || 0;
    const hasVentes = !!ann.ventes;
    const hasTrafic = !!ann.trafic;
    const hasStock = !!ann.stock;
    h += `<div style="padding:14px 16px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rdl)">
      <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
        ${year} — Annuel
        <span style="margin-left:6px">${hasVentes?'💰':''}${hasTrafic?'👁':''}${hasStock?'📦':''}</span>
      </div>
      ${annCA ? `<div style="font-size:22px;font-weight:700">${fmtEur(annCA)}</div>
      <div style="font-size:11px;color:var(--tx2);margin-top:4px">${fmt(annUnits)} unités${annGV?' · '+fmt(annGV)+' GV':''}</div>` : `<div style="font-size:12px;color:var(--tx3);padding:8px 0">Ventes non chargées</div>`}
    </div>`;
  });

  // Slot vide si pas d'historique
  if (!hasAnnual) {
    [prevYear, (parseInt(currentYear)-2).toString()].forEach(year => {
      h += `<div style="padding:14px 16px;background:var(--s2);border:1px dashed var(--bd3);border-radius:var(--rdl);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:90px;cursor:pointer" onclick="go('import')">
        <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase">${year} — Annuel</div>
        <div style="font-size:11px;color:var(--tx3)">+ Importer</div>
      </div>`;
    });
  }

  h += `</div></div>`;
  return h;
}

// Bannière données manquantes — utilisée dans Dashboard et Revue Hebdo
function renderFreshnessBanner(c) {
  if (!c) return '';
  if (isAway(c)) return ''; // Pas de bannière pendant les congés
  // v3.6.8.9 SSOT : getEnrichedFreshness inclut YTD (source : c.imports) — remplace doublon c.ytdData
  const ef_banner = getEnrichedFreshness(c);
  const f = ef_banner;
  const now = new Date();
  const currentWeek = getISOWeek(now);
  const year = now.getFullYear();

  const items = [
    { type: 'ventes', icon: '💰', label: 'Ventes' },
    { type: 'trafic', icon: '👁',  label: 'Trafic' },
    { type: 'stock',  icon: '📦', label: 'Stock'  },
  ];

  const problems = items.filter(i => f[i.type].status !== 'ok');
  if (!problems.length) return ''; // Tout est frais

  const market = c.mainMarket || (c.markets?.[0]) || '.fr';

  let h = `<div style="display:flex;align-items:flex-start;gap:12px;padding:14px 18px;background:var(--a-bg);border:1px solid var(--a-bd);border-radius:var(--rdl);margin-bottom:14px">`;
  h += `<span style="font-size:18px;flex-shrink:0">📡</span>`;
  h += `<div style="flex:1">`;
  const targetWeekBanner = currentWeek - 1 > 0 ? currentWeek - 1 : 52;
  const targetYearBanner  = currentWeek - 1 > 0 ? year : year - 1;
  h += `<div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--a)">Données à mettre à jour — S${targetWeekBanner} ${targetYearBanner} (semaine du ${getWeekDateRange(targetWeekBanner, targetYearBanner)})</div>`;
  h += `<div style="display:flex;gap:8px;flex-wrap:wrap">`;

  problems.forEach(({ type, icon, label }) => {
    const d = f[type];
    const vcLink = getVCLink(type, market);
    const desc = d.missing
      ? 'Jamais importé'
      : d.weeksBehind > 0
        ? 'S' + (d.lastWeek||'?') + ' couverte — S' + targetWeekBanner + ' manquante'
        : '✓ S' + targetWeekBanner + ' couverte';
    const urgency = d.status === 'missing' ? 'var(--r)' : 'var(--a)';
    h += `<div style="display:inline-flex;align-items:center;gap:7px;padding:8px 13px;background:var(--s1);border:1px solid ${urgency};border-radius:var(--rd)">
      <span style="font-size:15px">${icon}</span>
      <div>
        <div style="font-weight:600;font-size:12px;color:var(--tx)">${label} S${targetWeekBanner}</div>
        <div style="font-size:10px;color:${urgency}">${desc}</div>
      </div>
      <a href="${vcLink}" target="_blank" class="btn btn-xs" style="text-decoration:none;margin-left:4px;border-color:${urgency};color:${urgency}" title="Ouvrir dans Vendor Central">↗ VC</a>
      <label class="btn btn-xs" style="cursor:pointer;border-color:var(--bd2);color:var(--tx2)" title="Déposer le CSV ici">
        📥
        <input type="file" accept=".csv,.tsv,.txt" multiple onchange="handleBannerCSV(this)" style="display:none"/>
      </label>
    </div>`;
  });

  h += `</div>`;
  // Statut YTD via SSOT getEnrichedFreshness (source : c.imports, pas c.ytdData)
  const ytdEntry = ef_banner.ytd;
  if (ytdEntry && ytdEntry.days !== null) {
    const ytdDays  = ytdEntry.days;
    const ytdColor = ytdDays < 8 ? 'var(--g)' : ytdDays < 15 ? 'var(--a)' : 'var(--r)';
    h += `<div style="margin-top:8px;display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;color:var(--tx3)">📈 YTD ${new Date().getFullYear()} :</span>
      <span style="font-size:11px;font-weight:600;color:${ytdColor}">${ytdDays < 8 ? '✓ À jour' : ytdDays + 'j — à mettre à jour'}</span>
      ${ytdDays >= 8 ? '<a href="' + getVCLink('ventes', market) + '" target="_blank" class="btn btn-xs" style="text-decoration:none;border-color:var(--or-border);color:var(--or)">↗ VC</a>' : ''}
    </div>`;
  }
  h += `<div style="margin-top:8px;font-size:11px;color:var(--tx3)">Cliquez sur un rapport pour l'ouvrir dans Vendor Central, puis exportez le CSV et déposez-le dans <button onclick="go('import')" style="background:none;border:none;color:var(--or);cursor:pointer;font-size:11px;font-weight:600;padding:0;text-decoration:underline">Import données</button>.</div>`;
  h += `</div></div>`;
  return h;
}


function getFilteredAsins(client) {
  if (!client?.asins) return [];
  let asins = [...client.asins];
  // Filtre de vue prédéfinie (alertes, segments)
  if (asinViewAsins !== null) {
    const viewSet = new Set(asinViewAsins);
    asins = asins.filter(a => viewSet.has(a.asin));
  }
  if (filters.market !== 'all') asins = asins.filter(a => a.market === filters.market);
  if (filters.brand !== 'all') asins = asins.filter(a => a.brand && norm(a.brand) === norm(filters.brand));
  if (filters.segment !== 'all') {
    const tc = asins.reduce((s, a) => s + (getRevenue(a,client)||0), 0);
    asins = asins.filter(a => calcSegment(a, tc, client) === filters.segment);
  }
  // Recherche texte : ASIN, SKU (depuis catalogue), mot dans le titre
  if (asinSearch && asinSearch.trim()) {
    const q = asinSearch.trim().toLowerCase();
    // Construire un index SKU/EAN depuis le catalogue si disponible
    const catMap = {};
    (client.catalogue || []).forEach(e => { catMap[e.asin] = e; });
    asins = asins.filter(a => {
      const cat = catMap[a.asin];
      return (
        (a.asin  && a.asin.toLowerCase().includes(q)) ||
        (a.title && a.title.toLowerCase().includes(q)) ||
        (cat?.sku && cat.sku.toLowerCase().includes(q)) ||
        (cat?.ean && String(cat.ean).toLowerCase().includes(q))
      );
    });
  }
  return asins;
}
function generateWeeklyActions(client) {
  if (!client?.asins?.length) return [];
  const asins = client.asins;
  const activeAsins = asins.filter(a => (getRevenue(a,client)||0) > 0);
  const totalCA = asins.reduce((s, a) => s + (getRevenue(a,client)||0), 0);
  const actions = [];
  const ts = Date.now();

  // ── LUNDI — Import CSV (toujours en premier) ─────────────────
  // Utiliser la logique semaine ISO pour déterminer si l'import est à jour
  const freshness = getDataFreshness(client);
  const ventesStatus = freshness.ventes.status;
  const targetWeekAction = freshness.ventes.targetWeek || (getISOWeek(new Date()) - 1);
  const lastWeekCovered  = freshness.ventes.lastWeek;

  // v3.6.8.9 SSOT : daysSinceImport = freshness.ventes.daysSince (calculé par getDataFreshness)
  const lastImport = client.imports?.filter(i => i.periodType === 'weekly' || !i.periodType)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const daysSinceImport = freshness.ventes.daysSince ?? null;

  // Gestion congés
  const clientAway = isAway(client);
  const justReturned = !clientAway && client.awayUntil
    && Math.floor((Date.now() - new Date(client.awayUntil)) / 86400000) <= 7;
  const weeksMissed = justReturned && lastImport
    ? Math.round(daysSinceImport / 7)
    : 0;

  let importPriority, importTitle, importDesc;

  if (clientAway) {
    const retourDate = new Date(client.awayUntil).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    importPriority = 'low';
    importTitle = '🏖️ En congés — import suspendu';
    importDesc = 'Retour prévu le ' + retourDate + '. L\'import reprendra à votre retour.';
  } else if (justReturned && weeksMissed > 1) {
    importPriority = 'high';
    importTitle = '📥 Rattrapage au retour — ' + weeksMissed + ' semaine' + (weeksMissed > 1 ? 's' : '') + ' à importer';
    importDesc = 'Depuis VC : Analytiques → Tableau de bord → sélectionnez la période couvrant les ' + weeksMissed + ' semaines manquantes → Exporter CSV → Ventes + Trafic + Stock.';
  } else if (ventesStatus === 'ok') {
    // S-1 déjà couverte → pas d'action import nécessaire ce lundi
    importPriority = 'low';
    importTitle = '✅ Données S' + targetWeekAction + ' importées';
    importDesc = 'Les données de la semaine S' + targetWeekAction + ' (' + (freshness.ventes.coverDate || lastImport?.periodEnd || '') + ') sont à jour. Prochain import lundi S' + (targetWeekAction + 1) + '.';
  } else {
    // S-1 manquante → action urgente
    const weekLabel = getWeekDateRange ? getWeekDateRange(targetWeekAction, new Date().getFullYear()) : 'S' + targetWeekAction;
    importPriority = ventesStatus === 'missing' ? 'high' : 'medium';
    importTitle = '📥 Importer les données S' + targetWeekAction + ' (' + weekLabel + ')';
    importDesc = lastImport && lastWeekCovered
      ? 'En mémoire : S' + lastWeekCovered + '. À importer : S' + targetWeekAction + '. Depuis VC → Ventes + Trafic + Stock — Intervalle = Semaine précédente.'
      : 'Aucun import hebdo trouvé. Depuis VC → Analytiques → Tableau de bord → Intervalle = Semaine → Ventes + Trafic + Stock.';
  }

  actions.push({
    id: 'import-' + ts, type: 'import',
    priority: importPriority, day: 'Lundi',
    title: importTitle, description: importDesc,
    asins: [], done: false
  });

  // ── LUNDI — Urgences stock & buy box ──────────────────────────
  // Seuil : disponibilité < 90% OU stock < 30u sur ASIN actif
  const oosRisk = asins.filter(a => {
    const oos = parseNum(a.oosPct);
    const stock = a.sellableUnits;
    return (getRevenue(a,client)||0) > 50 && (
      (oos > 0 && oos < 90) ||  // disponibilité < 90%
      (stock != null && stock > 0 && stock < 30)
    );
  });
  if (oosRisk.length) {
    const stockCritical = oosRisk.filter(a => a.sellableUnits != null && a.sellableUnits < 15);
    actions.push({
      id: 'stock-' + ts, type: 'stock', priority: 'high', day: 'Lundi',
      title: `⚠️ Rupture imminente — ${oosRisk.length} ASIN(s) en danger`,
      description: `Disponibilité < 90% ou stock < 30u. ${stockCritical.length ? stockCritical.length + ' critiques < 15u : ' + stockCritical.slice(0,2).map(shortName).join(', ') : oosRisk.slice(0,3).map(shortName).join(', ')}`,
      asins: oosRisk.map(a => a.asin), done: false
    });
  }

  // ── Ruptures fournisseur via POs ──────────────────────────────
  const posRuptTotaux   = (client.pos||[]).filter(p => (p.qty||0)>0 && (p.qtyAccepted??p.qty)===0);
  const posRuptPartiels = (client.pos||[]).filter(p => { const q=p.qty||0,a=p.qtyAccepted??q; return q>0&&a>0&&a<q*0.8; });
  const asinsFournTotaux  = [...new Set(posRuptTotaux.map(p=>p.asin))];
  const asinsFournPartiels= [...new Set(posRuptPartiels.map(p=>p.asin))];
  if (asinsFournTotaux.length || asinsFournPartiels.length) {
    const total = asinsFournTotaux.length + asinsFournPartiels.length;
    actions.push({
      id: 'fourn-'+ts, type:'stock', priority:'high', day:'Lundi',
      title: '🚫 Rupture fournisseur — '+total+' ASIN(s) concerné(s)',
      description: asinsFournTotaux.length+' rupture(s) totale(s), '+asinsFournPartiels.length+' partielle(s). Amazon a commandé mais le fournisseur n\'a pas pu livrer. ASINs : '+[...asinsFournTotaux,...asinsFournPartiels].slice(0,3).join(', '),
      asins: [...asinsFournTotaux,...asinsFournPartiels], done:false
    });
  }

  // Buy // PO — fill rate faible ou fin de série (basé sur CSV PO importé)
  const poUnconfirmed = asins.filter(a => {
    const po = getPOData(client, a.asin);
    if (po) return (po.fillRate < 80 || po.isPermanentOOS || po.isDiscontinued) && (getRevenue(a,client)||0) > 0;
    const openPO = parseNum(a.openPOQty) || 0;
    const cpct = parseNum(String(a.confirmPct || '0').replace(',', '.').replace(/[^0-9.]/g, ''));
    return openPO > 0 && cpct < 50 && (getRevenue(a,client)||0) > 0;
  });
  if (poUnconfirmed.length) {
    actions.push({
      id: 'po-' + ts, type: 'buybox', priority: 'high', day: 'Lundi',
      title: 'PO non confirmé — ' + poUnconfirmed.length + ' ASIN(s) risque sortie programme 1P',
      description: 'Confirmation 0% sur commande ouverte. Amazon va réduire ses futures commandes. Confirmer dans Vendor Central : ' + poUnconfirmed.slice(0,3).map(a => (a.title||a.asin).slice(0,25)).join(', '),
      asins: poUnconfirmed.map(a => a.asin), done: false
    });
  }

  // Box à risque : Retail% < 95% sur ASIN actif
  const bbRisk = asins.filter(a => (getRevenue(a,client)||0) > 50 && a.retailPct && parseNum(a.retailPct) < 95 && parseNum(a.retailPct) > 0);
  if (bbRisk.length) {
    const canUse3P = client.threeP;
    const btrOk = client.btr === 'Autorisé';
    const levier = canUse3P ? 'Créer offre 3P de sécurisation' : (btrOk ? 'BTR disponible' : 'Signaler via Brand Registry + optimiser conditions Vendor');
    actions.push({
      id: 'buybox-' + ts, type: 'buybox', priority: 'high', day: 'Lundi',
      title: `🏆 Buy Box < 95% — ${bbRisk.length} ASIN(s) à risque`,
      description: `Levier recommandé : ${levier}. Top : ${bbRisk.slice(0,2).map(shortName).join(', ')}`,
      asins: bbRisk.map(a => a.asin), done: false
    });
  }

  // ── MARDI — Analyse des baisses ───────────────────────────────
  // GV en baisse > 15% vs S-1 (signal : perte de visibilité imminente)
  const gvDown = asins.filter(a => (getRevenue(a,client)||0) > 50 && parseNum(a.gvDelta) < -15);
  if (gvDown.length) {
    actions.push({
      id: 'gv-' + ts, type: 'seo', priority: 'high', day: 'Mardi',
      title: `👁 Trafic en chute — ${gvDown.length} ASIN(s) perdent de la visibilité`,
      description: `GV en baisse > 15% vs S-1 — prédit une perte de Buy Box. Actions : SEO, Sponsored Products, vérifier contenu. ${gvDown.slice(0,2).map(shortName).join(', ')}`,
      asins: gvDown.map(a => a.asin), done: false
    });
  }

  // CA en baisse structurelle (utilise calcTrendDeep si historique disponible)
  const caDown = asins.filter(a => (getRevenue(a,client)||0) > 50 && parseNum(a.revenueDelta) < -15);
  const caDownStructural = caDown.filter(a => {
    if (!a.history?.length) return false;
    const trend = calcTrend(a);
    return trend && trend.slope < -5;
  });
  if (caDown.length) {
    const structLabel = caDownStructural.length ? ` (${caDownStructural.length} structurel${caDownStructural.length>1?'s':''})` : '';
    actions.push({
      id: 'decline-' + ts, type: 'analysis', priority: 'high', day: 'Mardi',
      title: `📉 CA en baisse — ${caDown.length} ASIN(s)${structLabel}`,
      description: `Vérifier : prix, Buy Box, 3P parasites, contenu, concurrence. ${caDownStructural.length ? 'Baisses structurelles à traiter en priorité.' : 'Surveiller 2 semaines avant action lourde.'} Top : ${caDown.slice(0,2).map(shortName).join(', ')}`,
      asins: caDown.map(a => a.asin), done: false
    });
  }

  // Ordered Units en baisse > 20% vs N-1 (prédit réduction POs Amazon)
  // Approximation : utiliser revenueDelta comme proxy si pas de YoY direct
  const unitsRisk = asins.filter(a => (getRevenue(a,client)||0) > 100 && parseNum(a.revenueYoY) < -20);
  if (unitsRisk.length) {
    actions.push({
      id: 'pos-' + ts, type: 'analysis', priority: 'high', day: 'Mardi',
      title: `📦 Risque POs — ${unitsRisk.length} ASIN(s) en baisse YoY > 20%`,
      description: 'Amazon risque de réduire ses commandes. Anticiper : négocier avec le buyer, deal ou promotion pour relancer la vélocité.',
      asins: unitsRisk.map(a => a.asin), done: false
    });
  }

  // ── MERCREDI — Opportunités ────────────────────────────────────
  const growing = asins.filter(a => (getRevenue(a,client)||0) > 100 && parseNum(a.revenueDelta) > 25);
  const growingStructural = growing.filter(a => {
    const trend = calcTrend(a);
    return trend && trend.slope > 5;
  });
  if (growing.length) {
    const btrMsg = client.btr === 'Autorisé' ? 'BTR possible pour sécuriser le stock.' : client.btr === 'Conditionnel' ? 'BTR conditionnel — préparer dossier ROI.' : '';
    actions.push({
      id: 'growth-' + ts, type: 'opportunity', priority: 'medium', day: 'Mercredi',
      title: `🚀 ${growing.length} ASIN(s) en forte croissance à capitaliser`,
      description: `${growingStructural.length ? growingStructural.length + ' avec tendance structurelle haussière. ' : ''}Augmenter stock, Sponsored Products, A+. ${btrMsg} Top : ${growing.slice(0,2).map(shortName).join(', ')}`,
      asins: growing.map(a => a.asin), done: false
    });
  }

  // ── JEUDI — Contenu & SEO ─────────────────────────────────────
  // GV stable mais CA en baisse → problème de taux de conversion → contenu
  const contentIssue = asins.filter(a =>
    (getRevenue(a,client)||0) > 50 &&
    parseNum(a.revenueDelta) < -10 &&
    parseNum(a.gvDelta) > -10 // trafic OK mais ventes baissent
  );
  if (contentIssue.length) {
    actions.push({
      id: 'content-' + ts, type: 'content', priority: 'medium', day: 'Jeudi',
      title: `✏️ Optimisation contenu — ${contentIssue.length} ASIN(s) : trafic OK, conversion en baisse`,
      description: 'Titres, bullets, 7+ images, A+ Content, vidéo. Vérifier cohérence prix vs concurrents. ' + contentIssue.slice(0,2).map(shortName).join(', '),
      asins: contentIssue.map(a => a.asin), done: false
    });
  }

  // Audit listings (hebdo sur les Top 20 par CA)
  const top20 = [...asins].sort((a, b) => (getRevenue(b,client)||0) - (getRevenue(a,client)||0)).slice(0, 20);
  actions.push({
    id: 'audit-' + ts, type: 'audit', priority: 'low', day: 'Jeudi',
    title: '🔍 Vérifier les listings Top 20 ASINs (Claude × Chrome)',
    description: 'Prix, Buy Box %, avis, contenu, 3P parasites. Workflow Claude Chrome disponible.',
    asins: top20.map(a => a.asin), done: false
  });

  // ── VENDREDI — Rapport & suivi ────────────────────────────────
  const alertCount = oosRisk.length + bbRisk.length + caDown.length;
  actions.push({
    id: 'report-' + ts, type: 'report', priority: 'low', day: 'Vendredi',
    title: '📊 Préparer le rapport hebdomadaire client',
    description: `CA semaine : ${fmtEur(totalCA)} | ${activeAsins.length} ASINs actifs | ${alertCount} alerte${alertCount>1?'s':''} traitée${alertCount>1?'s':''} cette semaine`,
    asins: [], done: false
  });

  return actions;
}

// Génère les actions mensuelles (appelé en début de mois)
function generateMonthlyActions(client) {
  if (!client?.asins?.length) return [];
  const actions = [];
  const ts = Date.now() + 1000000; // éviter collision d'IDs avec hebdo
  const now = new Date();
  const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // Bilan mois précédent depuis historyMonthly
  const curMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const prevMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  })();

  // Récupérer les ASINs avec données du mois précédent
  const asinsWithPrevMonth = client.asins.filter(a =>
    a.historyMonthly?.some(m => m.monthKey === prevMonth)
  );

  // Bilan mois précédent
  if (asinsWithPrevMonth.length > 0) {
    const prevData = asinsWithPrevMonth.map(a => ({
      asin: a, snap: a.historyMonthly.find(m => m.monthKey === prevMonth)
    }));
    const totalPrevCA = prevData.reduce((s, d) => s + (d.snap.revenue || 0), 0);
    const topGainers = prevData.sort((a, b) => (b.snap.revenue || 0) - (a.snap.revenue || 0)).slice(0, 3);
    const prevMonthLabel = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('fr-FR', { month: 'long' });
    actions.push({
      id: 'monthly-bilan-' + ts, type: 'report', priority: 'high', day: 'Lundi',
      title: `📅 Bilan ${prevMonthLabel} — ${fmtEur(totalPrevCA)} CA réalisé`,
      description: `${asinsWithPrevMonth.length} ASINs actifs. Top : ${topGainers.map(d => shortName(d.asin)).join(', ')}. Préparer le compte-rendu mensuel client.`,
      asins: topGainers.map(d => d.asin.asin), done: false, monthly: true
    });
  }

  // Revue pricing mensuelle
  actions.push({
    id: 'monthly-pricing-' + ts, type: 'pricing', priority: 'medium', day: 'Lundi',
    title: '💰 Revue pricing mensuelle — Top 30 ASINs',
    description: 'Vérifier compétitivité des prix vs concurrents. Identifier écarts > 10%. Proposer ajustements si nécessaire.',
    asins: [], done: false, monthly: true
  });

  // Audit listings mensuel
  actions.push({
    id: 'monthly-audit-' + ts, type: 'audit', priority: 'medium', day: 'Mercredi',
    title: '🔍 Audit listings mensuel — Top 20 ASINs (grille complète)',
    description: 'Titre, bullets, images, A+, vidéo, backend keywords, avis, Buy Box. Score 0-3 par critère. Prioriser corrections.',
    asins: [], done: false, monthly: true
  });

  // Analyse concurrentielle
  actions.push({
    id: 'monthly-concurrence-' + ts, type: 'analysis', priority: 'low', day: 'Mercredi',
    title: '🕵️ Veille concurrentielle — Top 5 catégories',
    description: 'Identifier nouveaux entrants, évolutions prix concurrents, changements Buy Box. Utiliser workflow Claude × Chrome.',
    asins: [], done: false, monthly: true
  });

  // Rapport mensuel client
  actions.push({
    id: 'monthly-report-' + ts, type: 'report', priority: 'high', day: 'Vendredi',
    title: `📋 Rapport mensuel ${monthLabel} — à envoyer au client`,
    description: "Synthèse CA, tendances, alertes traitées, actions du mois prochain. Utiliser les données hebdo et mensuelles de l'app.",
    asins: [], done: false, monthly: true
  });

  return actions;
}
async function callAPI(sys, usr, feature, tools, maxTokens) {
  const modelKey = aiUsage.getModel(feature || 'revue');
  const modelId  = AI_MODELS[modelKey].id;
  const feat     = feature || 'revue';
  const tokLimit = maxTokens || 2500;

  // Tenter via Lambda (proxy IA avec comptabilité serveur)
  const idToken = localStorage.getItem('ap-id-token');
  if (idToken) {
    try {
      const lambdaBody = {
        model: modelId, max_tokens: tokLimit, system: sys,
        messages: [{ role: 'user', content: usr }], feature: feat,
      };
      if (tools) lambdaBody.tools = tools;
      const res = await fetch(API_BASE_URL + '/ai/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify(lambdaBody)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur Lambda');
      const tokIn  = data.usage?.input_tokens  || 0;
      const tokOut = data.usage?.output_tokens || 0;
      aiUsage.record(feat, modelKey, tokIn, tokOut);
      const textBlocks = (data.content || []).filter(b => b.type === 'text');
      return textBlocks.length ? textBlocks[textBlocks.length - 1].text : '';
    } catch(lambdaErr) {
      console.warn('[AI] Lambda fallback direct:', lambdaErr.message);
    }
  }

  // Mode direct (admin local sans token Cognito)
  const directBody = {
    model: modelId, max_tokens: tokLimit, system: sys,
    messages: [{ role: 'user', content: usr }]
  };
  if (tools) directBody.tools = tools;
  const directHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'
  };
  if (tools && tools.some(t => t.type && t.type.startsWith('web_search'))) {
    directHeaders['anthropic-beta'] = 'web-search-2025-03-05';
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: directHeaders,
    body: JSON.stringify(directBody)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Erreur API');
  const tokIn  = data.usage?.input_tokens  || 0;
  const tokOut = data.usage?.output_tokens || 0;
  aiUsage.record(feat, modelKey, tokIn, tokOut);
  const textBlocks = (data.content || []).filter(b => b.type === 'text');
  return textBlocks.length ? textBlocks[textBlocks.length - 1].text : '';
}

async function askClaude(sys, usr, feature) {
  if (!apiKey) return `__ERR_NOKEY__`;
  try {
    log('🤖 Appel Claude API...');
    const result = await callAPI(sys, usr, feature);
    log('✓ Réponse OK', 'ok');
    return result || 'Pas de réponse';
  } catch(e) {
    log('AI Error: ' + e.message, 'err');
    if (e.message.includes('Failed to fetch')) return `__ERR_CORS__`;
    if (e.message.includes('401')) return `__ERR_401__`;
    if (e.message.includes('403')) return `__ERR_403__`;
    if (e.message.includes('429')) return `__ERR_429__`;
    if (e.message.includes('529') || e.message.includes('503')) return `__ERR_529__`;
    return `__ERR_UNKNOWN__` + e.message;
  }
}

function isAIError(r) { return r && typeof r === 'string' && r.startsWith('__ERR_'); }

function renderAIError(code, retryFn) {
  const MSGS = {
    '__ERR_NOKEY__': { icon: '🔑', title: 'Clé API non configurée',
      body: 'Allez dans ⚙️ Configuration et entrez votre clé Anthropic (sk-ant-...).', retry: false },
    '__ERR_401__':   { icon: '🔑', title: 'Clé API invalide',
      body: 'Vérifiez votre clé dans ⚙️ Configuration.', retry: false },
    '__ERR_403__':   { icon: '🚫', title: 'Accès refusé (CORS)',
      body: "Utilisez l'app dans un Artifact Claude.ai.", retry: false },
    '__ERR_529__':   { icon: '⏱️', title: 'API momentanément surchargée',
      body: 'Les serveurs Anthropic sont très sollicités en ce moment. Un retry automatique a déjà été tenté. Réessayez dans quelques instants.', retry: true },
    '__ERR_429__':   { icon: '🔄', title: 'Limite de débit atteinte',
      body: 'Trop de requêtes consécutives. Attendez 30 secondes avant de réessayer.', retry: true },
    '__ERR_CORS__':  { icon: '🌐', title: 'Erreur de connexion',
      body: "Utilisez l'app dans un Artifact Claude.ai.", retry: false },
  };
  const key = Object.keys(MSGS).find(k => code.startsWith(k));
  const m = key ? MSGS[key] : { icon: '❌', title: 'Erreur inattendue',
    body: code.replace(/^__ERR_\d+__/, ''), retry: true };
  const btn = (m.retry && retryFn)
    ? `<button class="btn btn-sm" onclick="${retryFn}" style="flex-shrink:0;border-color:var(--r-bd);color:var(--r)">↻ Réessayer</button>`
    : '';
  return `<div style="display:flex;align-items:flex-start;gap:12px;padding:16px;background:var(--r-bg);border:1px solid var(--r-bd);border-radius:var(--rdl);margin-top:12px">
    <span style="font-size:22px;flex-shrink:0">${m.icon}</span>
    <div style="flex:1">
      <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:var(--r)">${m.title}</div>
      <div style="font-size:12px;color:var(--tx2);line-height:1.6">${m.body}</div>
    </div>
    ${btn}
  </div>`;
}



// Construit le bloc contexte historique injecté dans les prompts IA
function buildAsinContext(a, c) {
  const deep = calcTrendDeep(a, c);
  const lines = [];

  lines.push('📈 CONTEXTE HISTORIQUE:');

  if (deep.ca2 !== null) {
    lines.push(`- ${deep.prev2Year}: ${fmtEur(deep.ca2)}`);
  }
  if (deep.ca1 !== null) {
    const delta = deep.ca2 ? ` (${parseFloat(((deep.ca1-deep.ca2)/deep.ca2*100).toFixed(1))>=0?'+':''}${((deep.ca1-deep.ca2)/deep.ca2*100).toFixed(1)}% vs ${deep.prev2Year})` : '';
    lines.push(`- ${deep.prevYear}: ${fmtEur(deep.ca1)}${delta}`);
  }
  if (deep.caYTD !== null) {
    const ytdPeriod = c.ytdData?.ventes?.periodEnd ? `01/01/${deep.curYear}→${c.ytdData.ventes.periodEnd}` : `YTD ${deep.curYear}`;
    const ytdDelta = deep.ytdVsN1 !== null ? ` (${deep.ytdVsN1>=0?'+':''}${deep.ytdVsN1}% vs même période ${deep.prevYear})` : '';
    lines.push(`- ${ytdPeriod}: ${fmtEur(deep.caYTD)}${ytdDelta}`);
  } else if (a.revenueYoY) {
    lines.push(`- YoY (fourni par Amazon): ${a.revenueYoY}`);
  }

  if (deep.shortTrend) {
    lines.push(`- Tendance court terme (${deep.shortTrend.n} semaines): ${deep.shortTrend.label} (pente ${deep.shortTrend.slope > 0 ? '+' : ''}${deep.shortTrend.slope.toFixed(1)}%/sem.)`);
  }

  lines.push(`- ⚡ Signal composite: ${deep.signal}`);

  if (!deep.hasLongData && !deep.yoyAmazon) {
    lines.push('- ⚠ Pas de données annuelles chargées — analyse limitée au court terme');
  }

  // Ajouter les 8 dernières semaines si disponibles
  if (a.history?.length > 0) {
    lines.push('');
    lines.push('📊 HISTORIQUE HEBDO (8 dernières semaines, plus récent en premier):');
    const recent = a.history.slice(-8).reverse();
    recent.forEach(h => {
      const period = h.periodStart ? h.periodStart.slice(0,5)+'→'+h.period.slice(0,5) : (h.period||'?');
      const stock = h.sellableUnits != null ? ' | Stock: '+h.sellableUnits+'u' : '';
      const delta = h.revenueDelta ? ' | Δ '+h.revenueDelta : '';
      lines.push(`  ${period}: ${fmtEur(h.revenue||0)} (${fmt(h.units||0)}u | GV: ${fmt(h.glanceViews||0)}${stock}${delta})`);
    });
  }

  // Synthèses mensuelles si disponibles
  if (a.historyMonthly?.length > 0) {
    lines.push('');
    lines.push('📆 SYNTHÈSES MENSUELLES (6 derniers mois):');
    a.historyMonthly.slice(-6).reverse().forEach(m => {
      lines.push(`  ${m.label}: ${fmtEur(m.revenue||0)} (${fmt(m.units||0)}u | ${m.weeks} sem. | Stock fin: ${m.sellableUnitsLast!=null?m.sellableUnitsLast+'u':'N/A'})`);
    });
  }

  // PPM Nette
  const ppmEntry = (c.ppmData||{})[a.asin];
  if (ppmEntry?.ppm != null) {
    lines.push('');
    lines.push('💰 PPM NETTE : ' + ppmEntry.ppm.toFixed(1) + '%'
      + (ppmEntry.ppmDeltaBps ? ' (Δ vs N-1 : ' + (ppmEntry.ppmDeltaBps > 0 ? '+' : '') + (ppmEntry.ppmDeltaBps/100).toFixed(2) + '%)' : '')
      + (ppmEntry.ppm < 5 ? ' — ⚠️ FAIBLE : risque de déréférencement Amazon' : ppmEntry.ppm >= 20 ? ' — ✓ Bonne marge' : ''));
  }

  // Prévisions Amazon
  const fcEntry = (c.forecastData||{})[a.asin];
  if (fcEntry?.weeks?.length >= 4) {
    const s1 = Math.round(fcEntry.weeks[1]||0);
    const s4avg = Math.round(((fcEntry.weeks[1]||0)+(fcEntry.weeks[2]||0)+(fcEntry.weeks[3]||0)+(fcEntry.weeks[4]||0))/4);
    lines.push('');
    lines.push('📊 PRÉVISIONS AMAZON (prochaines semaines) :');
    lines.push('  S+1 : ' + s1 + 'u prévues | Moy. S+1→S+4 : ' + s4avg + 'u/sem.');
    const velocite = a.history?.length >= 2 ? Math.round(a.history.slice(-4).reduce((s,h)=>s+(h.units||0),0)/Math.min(a.history.length,4)) : (getUnits(a,c)||0);
    if (velocite > 0) {
      const ratio = Math.round(s4avg/velocite*100);
      lines.push('  Vs vélocité actuelle (' + velocite + 'u) : ' + ratio + '%' + (ratio > 110 ? ' — Amazon anticipe une hausse' : ratio < 90 ? ' — Amazon anticipe une baisse' : ' — stable'));
    }
  }

  // POs actifs et statut fournisseur
  const poInfo = getPOsForAsin(a.asin, c);
  if (poInfo) {
    lines.push('');
    lines.push('📦 BONS DE COMMANDE EN COURS:');
    if (poInfo.ruptureTotal) {
      lines.push('  🚫 RUPTURE TOTALE FOURNISSEUR — Amazon a commandé mais rien accepté.');
    } else if (poInfo.rupturePartielle) {
      lines.push('  ⚠️ Rupture partielle fournisseur — taux d\'acceptation : '+poInfo.tauxAcceptation+'%');
    }
    if (poInfo.qtyEnTransit > 0) {
      lines.push('  Quantité en transit : '+poInfo.qtyEnTransit+'u');
      if (poInfo.prochainelivraison) {
        lines.push('  Prochaine livraison estimée : '+poInfo.prochainelivraison.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}));
      }
    }
    poInfo.alertesFournisseur.forEach(function(al){ lines.push('  '+al); });
  }

  return lines.join('\n');
}

// Construit le contexte global du compte pour le system prompt
function buildClientContext(c) {
  const curYear = new Date().getFullYear().toString();
  const prevYear = (parseInt(curYear) - 1).toString();
  const prev2Year = (parseInt(curYear) - 2).toString();
  const lines = [];

  const ca2 = c.annualData?.[prev2Year]?.ventes?.totalCA;
  const ca1 = c.annualData?.[prevYear]?.ventes?.totalCA;
  const caYTD = c.ytdData?.ventes?.totalCA;
  const gv1 = c.annualData?.[prevYear]?.trafic?.totalGV;
  const gvYTD = c.ytdData?.trafic?.totalGV;

  if (ca2 || ca1 || caYTD) {
    lines.push('\n📅 CONTEXTE COMPTE (données historiques):');
    if (ca2) lines.push(`- CA ${prev2Year}: ${fmtEur(ca2)}`);
    if (ca1) {
      const d = ca2 ? ` (${ca2>0?(((ca1-ca2)/ca2*100)>=0?'+':'')+((ca1-ca2)/ca2*100).toFixed(1)+'% vs '+prev2Year:'N/A'})` : '';
      lines.push(`- CA ${prevYear}: ${fmtEur(ca1)}${d}`);
    }
    if (caYTD) {
      const ytdEnd = c.ytdData?.ventes?.periodEnd || "aujourd'hui";
      const d = ca1 && c.ytdData?.ventes?.periodStart && c.ytdData?.ventes?.periodEnd ? (() => {
        const [ds,ms,ys] = (c.ytdData.ventes.periodStart).split('/').map(Number);
        const [de,me,ye] = (c.ytdData.ventes.periodEnd).split('/').map(Number);
        const days = Math.round((new Date(ye,me-1,de)-new Date(ys,ms-1,ds))/86400000);
        const prorata = ca1 * days/365;
        return prorata > 0 ? ` (${((caYTD-prorata)/prorata*100)>=0?'+':''}${((caYTD-prorata)/prorata*100).toFixed(1)}% vs même période ${prevYear})` : '';
      })() : '';
      lines.push(`- CA YTD ${curYear} (01/01→${ytdEnd}): ${fmtEur(caYTD)}${d}`);
    }
    if (gv1) lines.push(`- GV ${prevYear}: ${fmt(gv1)}`);
    if (gvYTD) lines.push(`- GV YTD ${curYear}: ${fmt(gvYTD)}`);

    // Top catégories en croissance/déclin depuis les données annuelles
    if (ca1 && c.annualData?.[prevYear]?.ventes?.asins && c.asins?.length) {
      const annAsins = c.annualData[prevYear].ventes.asins;
      const currentAsins = c.asins.filter(a => (getRevenue(a,c)||0) > 0);
      const totalCur = currentAsins.reduce((s,a) => s+(getRevenue(a,c)||0), 0);
      // Comparer les marques
      const brandGrowth = {};
      currentAsins.forEach(a => {
        if (!a.brand) return;
        const annVal = annAsins[a.asin] ? parseNum(annAsins[a.asin].revenue) : 0;
        if (!brandGrowth[a.brand]) brandGrowth[a.brand] = { cur: 0, prev: 0 };
        brandGrowth[a.brand].cur += getRevenue(a,c)||0;
        brandGrowth[a.brand].prev += annVal;
      });
      const topBrands = Object.entries(brandGrowth)
        .filter(([,v]) => v.cur > 500 && v.prev > 0)
        .map(([b,v]) => ({ brand: b, pct: (v.cur-v.prev)/v.prev*100 }))
        .sort((a,b) => Math.abs(b.pct)-Math.abs(a.pct))
        .slice(0, 4);
      if (topBrands.length) {
        lines.push(`- Dynamique marques vs ${prevYear}: ` + topBrands.map(b => `${b.brand} ${b.pct>=0?'+':''}${b.pct.toFixed(0)}%`).join(', '));
      }
    }
  }

  return lines.join('\n');
}

function getSysPrompt(c) {
  const cs = [];
  if (!c.stockDeporte) cs.push('Stock déporté INTERDIT');
  if (c.btr === 'Conditionnel') cs.push('Born to Run CONDITIONNEL');
  if (c.btr === 'Interdit') cs.push('Born to Run INTERDIT');
  if (!c.threeP) cs.push('3P / Seller Central INTERDIT');

  const clientCtx = buildClientContext(c);

  return `Tu es un expert Amazon Vendor Central. Tu analyses les performances et formules des recommandations concrètes et actionnables.

CLIENT: ${c.name}
MODÈLE: ${c.model}
MARCHÉS: ${c.markets.join(', ')}
CONTRAINTES: ${cs.join(', ') || 'Aucune'}${clientCtx}

RÈGLES ABSOLUES:
- Ne recommande JAMAIS un levier interdit par les contraintes
- Priorise par impact CA potentiel
- Distingue toujours tendance court terme vs tendance structurelle longue
- Un creux ponctuel sur fond haussier n'est PAS une alarme — dis-le explicitement
- Un rebond court sur fond baissier structurel reste un risque — dis-le aussi
- Quand des données historiques sont disponibles, base tes recommandations dessus
- Réponds en français, structure avec des émojis, sois concis et actionnable`;
}
const cl = () => clients.find(c => c.id === activeId) || null;

function saveClientSafe(c) {
  if (!c || !c.asins || c.asins.length === 0) {
    console.error('[ABORT] saveClientSafe — asins vide ou corrompu, longueur:', c?.asins?.length);
    return false;
  }
  save();
  return true;
}

function toggleFicheAmazon(asin) {
  const el = document.getElementById('fiche-amazon-' + asin);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function saveFicheAmazon(asin, val) {
  const c = cl(); if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (a) { a.ficheAmazon = val; save(); }
}

function saveFicheGPT(asin, val) {
  const c = cl(); if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (a) { a.ficheGPT = val; save(); }
}

function saveFicheChallenge(asin, val) {
  const c = cl(); if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (a) { a.ficheChallenge = val; save(); }
}

function exportExemplesGPT(asin, market) {
  const c = cl(); if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (!a || !a.ficheChallenge) return;
  const ch = a.ficheChallenge[market];
  if (!ch) return;
  const date = new Date().toISOString().slice(0, 10);
  const md = [
    '# Exemple GPT Reference — ' + asin + ' (' + market + ')',
    '**Date :** ' + date,
    '**ASIN :** ' + asin,
    '',
    '## Titre retenu',
    ch.titreFusion || '',
    '',
    '## Bullets retenus',
    (ch.bulletsFusion || []).map((b, i) => '**B' + (i+1) + ':** ' + b).join('\n\n'),
    '',
    '## Verdict comparaison',
    ch.verdict || '',
    '',
    '## Autocritique Claude',
    ch.autocritique || '',
    '',
    '---',
  ].join('\n');
  const blob = new Blob([md], {type: 'text/markdown'});
  const url = URL.createObjectURL(blob);
  const a2 = document.createElement('a');
  a2.href = url;
  a2.download = 'exemple_gpt_' + asin + '_' + date + '.md';
  a2.click();
  URL.revokeObjectURL(url);
}

async function runChallengeGPT(asin, market) {
  const c = cl(); if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (!a) return;
  const seoR = seoResults[asin] && seoResults[asin][market];
  if (!seoR) { alert('Générez d\'abord la fiche SEO avant de challenger.'); return; }
  if (!a.ficheGPT) { alert('Collez la sortie GPT avant d\'analyser.'); return; }

  challengeLoading = asin;
  render();

  const prompt = 'Tu es un expert Amazon SEO. Compare objectivement ces deux fiches produit.\n\n'
    + '=== FICHE CLAUDE ===\n'
    + 'TITRE: ' + (seoR.titre || '') + '\n'
    + 'BULLET_1: ' + (seoR.bullets?.[0] || '') + '\n'
    + 'BULLET_2: ' + (seoR.bullets?.[1] || '') + '\n'
    + 'BULLET_3: ' + (seoR.bullets?.[2] || '') + '\n'
    + 'BULLET_4: ' + (seoR.bullets?.[3] || '') + '\n'
    + 'BULLET_5: ' + (seoR.bullets?.[4] || '') + '\n'
    + 'DESCRIPTION: ' + (seoR.description || '') + '\n'
    + 'BACKEND_KEYWORDS: ' + (seoR.backendKW || '') + '\n\n'
    + '=== FICHE GPT ===\n'
    + a.ficheGPT + '\n\n'
    + 'Pour chaque champ (titre, bullet 1-5, description, backend keywords), réponds EXACTEMENT dans ce format :\n\n'
    + 'VERDICT_TITRE: [Claude|GPT|Égalité] — [raison en une phrase]\n'
    + 'FUSION_TITRE: [meilleure version du titre]\n'
    + 'VERDICT_B1: [Claude|GPT|Égalité] — [raison]\n'
    + 'FUSION_B1: [meilleur bullet 1]\n'
    + 'VERDICT_B2: [Claude|GPT|Égalité] — [raison]\n'
    + 'FUSION_B2: [meilleur bullet 2]\n'
    + 'VERDICT_B3: [Claude|GPT|Égalité] — [raison]\n'
    + 'FUSION_B3: [meilleur bullet 3]\n'
    + 'VERDICT_B4: [Claude|GPT|Égalité] — [raison]\n'
    + 'FUSION_B4: [meilleur bullet 4]\n'
    + 'VERDICT_B5: [Claude|GPT|Égalité] — [raison]\n'
    + 'FUSION_B5: [meilleur bullet 5]\n'
    + 'VERDICT_DESC: [Claude|GPT|Égalité] — [raison]\n'
    + 'FUSION_DESC: [meilleure description HTML]\n'
    + 'VERDICT_BACKEND: [Claude|GPT|Égalité] — [raison]\n'
    + 'FUSION_BACKEND: [meilleurs backend keywords]\n'
    + 'AUTOCRITIQUE_CLAUDE: [ce que Claude doit améliorer — 2-3 points concrets]\n'
    + 'SCORE_CLAUDE: [X/10]\n'
    + 'SCORE_GPT: [X/10]';

  try {
    const result = await callAPI('', prompt);
    const ch = parseChallengeResponse(result);
    if (!a.ficheChallenge) a.ficheChallenge = {};
    a.ficheChallenge[market] = ch;
    save();
  } catch(e) {
    console.error('Challenge error:', e);
  }
  challengeLoading = null;
  render();
}

function parseChallengeResponse(text) {
  const lines = text.split('\n');
  const result = {};
  let currentKey = null;
  let currentVal = [];
  const KEYS = [
    'VERDICT_TITRE','FUSION_TITRE',
    'VERDICT_B1','FUSION_B1','VERDICT_B2','FUSION_B2',
    'VERDICT_B3','FUSION_B3','VERDICT_B4','FUSION_B4',
    'VERDICT_B5','FUSION_B5',
    'VERDICT_DESC','FUSION_DESC',
    'VERDICT_BACKEND','FUSION_BACKEND',
    'AUTOCRITIQUE_CLAUDE','SCORE_CLAUDE','SCORE_GPT'
  ];
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, ''); // strip CRLF résiduel
    const match = line.match(/^([A-Z_0-9]+):\s*(.*)/);
    if (match && KEYS.includes(match[1])) {
      if (currentKey) result[currentKey] = currentVal.join('\n').replace(/\*\*/g,'').trim();
      currentKey = match[1];
      currentVal = [match[2]];
    } else if (currentKey) {
      currentVal.push(line);
    }
  }
  if (currentKey) result[currentKey] = currentVal.join('\n').replace(/\*\*/g,'').trim();
  const g = (k) => result[k] || '';
  return {
    verdictTitre:   g('VERDICT_TITRE'),
    fusionTitre:    g('FUSION_TITRE'),
    verdictB1:      g('VERDICT_B1'),
    fusionB1:       g('FUSION_B1'),
    verdictB2:      g('VERDICT_B2'),
    fusionB2:       g('FUSION_B2'),
    verdictB3:      g('VERDICT_B3'),
    fusionB3:       g('FUSION_B3'),
    verdictB4:      g('VERDICT_B4'),
    fusionB4:       g('FUSION_B4'),
    verdictB5:      g('VERDICT_B5'),
    fusionB5:       g('FUSION_B5'),
    verdictDesc:    g('VERDICT_DESC'),
    fusionDesc:     g('FUSION_DESC'),
    verdictBackend: g('VERDICT_BACKEND'),
    fusionBackend:  g('FUSION_BACKEND'),
    autocritique:   g('AUTOCRITIQUE_CLAUDE'),
    scoreClaude:    g('SCORE_CLAUDE'),
    scoreGPT:       g('SCORE_GPT'),
    titreFusion:    g('FUSION_TITRE'),
    bulletsFusion:  [g('FUSION_B1'), g('FUSION_B2'), g('FUSION_B3'), g('FUSION_B4'), g('FUSION_B5')],
    verdict: [
      'Titre: '       + g('VERDICT_TITRE'),
      'B1: '          + g('VERDICT_B1'),
      'B2: '          + g('VERDICT_B2'),
      'B3: '          + g('VERDICT_B3'),
      'B4: '          + g('VERDICT_B4'),
      'B5: '          + g('VERDICT_B5'),
      'Description: ' + g('VERDICT_DESC'),
      'Backend: '     + g('VERDICT_BACKEND'),
    ].join('\n'),
  };
}

function updateFusionField(asin, market, key, val) {
  const c = cl(); if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (a && a.ficheChallenge && a.ficheChallenge[market]) {
    a.ficheChallenge[market][key] = val;
    save();
  }
}

function copyFicheFusion(asin, market) {
  const c = cl(); if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (!a || !a.ficheChallenge || !a.ficheChallenge[market]) return;
  const ch = a.ficheChallenge[market];
  const text = [
    'TITRE: ' + (ch.fusionTitre || ''),
    'BULLET_1: ' + (ch.fusionB1 || ''),
    'BULLET_2: ' + (ch.fusionB2 || ''),
    'BULLET_3: ' + (ch.fusionB3 || ''),
    'BULLET_4: ' + (ch.fusionB4 || ''),
    'BULLET_5: ' + (ch.fusionB5 || ''),
    'DESCRIPTION: ' + (ch.fusionDesc || ''),
    'BACKEND_KEYWORDS: ' + (ch.fusionBackend || ''),
  ].join('\n\n');
  navigator.clipboard.writeText(text).catch(() => {
    document.execCommand('copy');
  });
}

// applyFusionAndPublish supprimé — remplacé par wizardSaveAndPublish (v3.4.29)

// Utilitaire maintenance — purge les ficheChallenge corrompues (parsées avec l'ancien parser regex)
// Appeler UNE SEULE FOIS depuis la console preprod après déploiement v3.4.34
function clearAllFicheChallenge() {
  const c = cl(); if (!c) return;
  if (!c.asins || c.asins.length === 0) { console.error('[CLEAR] asins vide — abandon'); return; }
  let count = 0;
  c.asins.forEach(a => {
    if (a.ficheChallenge) { delete a.ficheChallenge; count++; }
  });
  saveClientSafe(c);
  console.log('[CLEAR] ficheChallenge supprimé sur', count, 'ASINs');
}


function render() {
  renderNav();
  renderClients();
  renderTopbar();
  renderContent();
}

function renderNav() {
  const c = cl();
  const alertCount = c ? c.asins?.filter(a => (getRevenue(a,c)||0) > 0 && parseNum(a.revenueDelta) < -15).length : 0;
  // Badge Buy Box : ASINs avec Retail% en baisse ou critique
  const _bbAlerts = c ? calcBuyBoxAlerts(c) : { critical: [], warning: [], suppressed: [] };
  const bbBadgeCount = _bbAlerts.critical.length + _bbAlerts.suppressed.length;
  // Badge backup sur Config si pas de backup depuis >7 jours
  const lastExportISO = localStorage.getItem('ap-last-export');
  const backupDays = lastExportISO ? Math.floor((Date.now() - new Date(lastExportISO)) / 86400000) : 999;
  const needsBackup = backupDays > 7;
  const _navClient = cl();
  document.title = 'Amazon Pilot v' + APP_VERSION + ' — ' + (cl() && cl().name ? cl().name : 'Vendor Central');
  document.getElementById('nav-list').innerHTML = NAV.map(n => {
    const badge = n.badge && alertCount > 0 ? `<span class="badge">${alertCount}</span>` : '';
    const backupBadge = n.id === 'config' && needsBackup ? `<span class="badge" style="background:var(--or)" title="Backup requis">!</span>` : '';
    const fnBadgeCount = n.badgeFn ? n.badgeFn(_navClient) : 0;
    const fnBadge = fnBadgeCount > 0 ? `<span class="badge" style="background:var(--or)" title="Vérifications en attente">${fnBadgeCount}</span>` : '';
    return `<button class="sb-it${screen === n.id ? ' on' : ''}" onclick="go('${n.id}')">
      <span class="sb-it-ic">${n.icon}</span><span>${n.label}</span>${badge}${backupBadge}${fnBadge}
    </button>`;
  }).join('');
}

function renderClients() {
  const h = clients.map(c => {
    const color = clientFreshnessColor(c);
    const f = c.csvImported ? getDataFreshness(c) : null;
    const hasStale = f && Object.values(f).some(v => v.status !== 'ok');
    const tip = hasStale ? 'title="Données à mettre à jour"' : '';
    return `<button class="sb-cl${activeId === c.id ? ' on' : ''}" onclick="selClient('${c.id}')" ${tip}>
      <span class="sb-dot" style="background:${color}"></span>
      <span>${esc(c.name || 'Sans nom')}</span>
    </button>`;
  }).join('');
  document.getElementById('client-list').innerHTML = h +
    `<button class="sb-add" onclick="startOnboarding()"><span>+ Nouveau client</span></button>`;
}

function renderTopbar() {
  const c = cl();
  document.getElementById('tb-name').textContent = c ? c.name : 'Amazon Pilot';
  let badges = '';
  if (c) {
    const mc = c.model.includes('1P') ? 'b' : c.model.includes('3P') ? 'g' : 'gr';
    badges = `<span class="pill pill-${mc}" style="margin-left:8px">${esc(c.model.split(' ')[0])}</span>`;
    c.markets.slice(0,4).forEach(m => {
      badges += `<span class="pill pill-gr" style="margin-left:4px">${m}</span>`;
    });
    if (c.asins?.length) {
      badges += `<span class="pill pill-gr" style="margin-left:4px">${c.asins.length} ASINs</span>`;
    }
  }
  document.getElementById('tb-badges').innerHTML = badges;
  // v3.6.2 — moteur de recherche ASIN transversal dans le topbar
  const slot = document.getElementById('tb-search-slot');
  if (slot) {
    if (c) {
      const filteredCount = (asinSearch && asinSearch.trim()) ? getFilteredAsins(c).length : null;
      const countHtml = filteredCount !== null
        ? `<span class="topbar-search-count">${filteredCount} / ${c.asins.length}</span>`
        : '';
      const clearHtml = (asinSearch && asinSearch.trim())
        ? `<button class="topbar-search-clear" onclick="asinSearch='';document.getElementById('asin-search-input').value='';render()">✕</button>`
        : '';
      slot.innerHTML = `<div class="topbar-search${asinSearch && asinSearch.trim() ? ' active' : ''}">
        <button class="topbar-search-btn" onclick="triggerSearch()">🔍</button>
        <input id="asin-search-input" class="topbar-search-input" type="text" value="${esc(asinSearch)}" placeholder="ASIN · SKU · EAN · titre" onkeydown="if(event.key==='Enter')triggerSearch()" />
        ${countHtml}${clearHtml}
      </div>`;
    } else {
      slot.innerHTML = '';
    }
  }
  let acts = '';
  if (c) {
    acts = `<button class="btn btn-sm" onclick="go('import')">📥 Import</button>`;
    if (c.csvImported) acts += `<button class="btn btn-p btn-sm" onclick="go('weekly')">🗓️ Revue Hebdo</button>`;
  }
  document.getElementById('tb-actions').innerHTML = acts;
}

function renderContent() {
  const el = document.getElementById('content');
  const map = {
    welcome: renderWelcome, onboarding: renderOnboarding, import: renderImport,
    dashboard: renderDashboard, fiche: renderFiche, asins: renderAsins,
    pompier: renderPompier, buybox: renderBuyBox, config: renderConfig, weekly: renderWeeklyReview,
    appros: renderAppros, forecast: renderApprosForecast, agent: renderAgent, potentiel: renderPotentiel,
    seo: renderSEOScreen,
    yoy: renderYoY,
    agentvc: renderAgentVC,
    optimisationWizard: renderOptimisationWizard
  };
  try {
    el.innerHTML = (map[screen] || renderWelcome)();
  } catch(e) {
    console.error('renderContent error [' + screen + ']:', e);
    console.error('renderContent stack:', e.stack);
    console.error('screen:', screen, 'selectedAsin:', selectedAsin, 'asinView:', asinView);
    el.innerHTML = "<div class='alr alr-r'>Erreur (" + screen + ") : " + esc(e.message) + "</div>";
  }
  if (screen === 'appros') {
    setTimeout(function() { try { renderApprosResults(); } catch(e) { console.error('[AP] renderApprosResults error:', e); } }, 50);
  }
  if (screen === 'dashboard' && cl()?.asins?.length) {
    setTimeout(() => { try { initChart(); } catch(e) { console.error('[AP] initChart error:', e); } }, 150);
    setTimeout(() => { try { initSegChart(); } catch(e) { console.error('[AP] initSegChart error:', e); } }, 150);
    setTimeout(() => { try { initDashWeeklyChart(); } catch(e) { console.error('[AP] initDashWeeklyChart error:', e); } }, 200);
  }
  if (screen === 'asins' && selectedAsin) setTimeout(() => { try { initHistoryChart(); } catch(e) { console.error('[AP] initHistoryChart error:', e); } }, 200);
  // Injecter la section SEO séparément pour éviter les conflits de guillemets dans innerHTML
  if (screen === 'asins' && selectedAsin) {
    setTimeout(function() {
      const seoContainer = document.getElementById('seo-section-container');
      if (seoContainer) {
        try {
          const c2 = cl();
          const a2 = c2?.asins?.find(x => x.asin === selectedAsin);
          if (a2 && c2) {
            const wrapper = document.createElement('div');
            wrapper.id = 'seo-section-wrapper';
            wrapper.innerHTML = renderSEOSection(a2, c2);
            seoContainer.replaceWith(wrapper);
          }
        } catch(seoErr) {
          console.error('SEO render error:', seoErr);
        }
      }
    }, 50);
  }
}
function renderWelcome() {
  return `<div class="welcome-wrap">
    <div class="welcome-icon">🛒</div>
    <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Amazon Pilot <span id="ap-ver-welcome"></span></h1>
    <p style="color:var(--tx2);margin-bottom:24px;max-width:400px;line-height:1.7">Pilotez vos comptes Vendor Central avec l'IA. Import multi-périodes, diagnostic CA, revue hebdomadaire.</p>
    <button class="btn btn-p" style="padding:11px 22px;font-size:14px" onclick="startOnboarding()">+ Créer un client</button>
  </div>`;
}
function fgEl(label, val, onchangeExpr, ph = '') {
  return `<div class="fg"><label class="fg-lb">${label}</label><input class="fg-in" value="${esc(val)}" placeholder="${ph}" onchange="${onchangeExpr}"/></div>`;
}
function fgSel(label, val, opts, onchangeExpr) {
  const o = opts.map(x => `<option value="${esc(x)}"${x === val ? ' selected' : ''}>${esc(x)}</option>`).join('');
  return `<div class="fg"><label class="fg-lb">${label}</label><select class="fg-in" onchange="${onchangeExpr}">${o}</select></div>`;
}
function recRow(label, val, warn = false) {
  return `<div class="rec${warn ? ' warn' : ''}"><div class="rec-lb">${label}</div><div class="rec-v">${esc(val)}</div></div>`;
}

function renderOnboarding() {
  const nc = newClient;
  let h = `<div style="max-width:680px;margin:0 auto">`;
  h += `<div class="wz-bar">`;
  WIZ_STEPS.forEach((s, i) => {
    const cls = i === wizStep ? 'on' : i < wizStep ? 'done' : '';
    h += `<div class="wz-s ${cls}" onclick="${i <= wizStep ? 'wizGo('+i+')' : ''}">
      <span class="wz-n">${i < wizStep ? '✓' : i + 1}</span><span class="wz-lb">${s}</span>
    </div>`;
  });
  h += `</div><div class="cd" style="padding:22px">`;

  if (wizStep === 0) {
    h += `<h3 style="font-size:15px;font-weight:700;margin-bottom:16px">Identité du client</h3><div class="fg2">`;
    h += fgEl('Nom du compte *', nc.name, "newClient.name=this.value", 'Ex: Cogex Outillage');
    h += fgEl('Marque(s)', nc.brand, "newClient.brand=this.value", 'COGEX, ITENSE…');
    h += fgEl('Secteur', nc.sector, "newClient.sector=this.value", 'Bricolage & Outillage');
    h += fgEl('Contact opérationnel', nc.contactOp, "newClient.contactOp=this.value", 'Nom + rôle');
    h += `</div>`;
  } else if (wizStep === 1) {
    h += `<h3 style="font-size:15px;font-weight:700;margin-bottom:16px">Configuration Amazon</h3><div class="fg2">`;
    h += fgSel('Modèle de vente', nc.model, ['1P (Vendor Central)', '3P (Seller Central)', 'Hybride 1P + 3P'], "newClient.model=this.value");
    h += fgEl('Vendor Code', nc.vendorCode, "newClient.vendorCode=this.value", 'Identifiant Vendor');
    h += fgSel('Marché principal', nc.mainMarket, MARKETS, "newClient.mainMarket=this.value");
    h += `<div class="fg"><label class="fg-lb">Marchés actifs</label><div class="mk-list">`;
    MARKETS.slice(0, 5).forEach(m => {
      h += `<label class="mk-cb"><input type="checkbox" ${nc.markets.includes(m) ? 'checked' : ''} onchange="toggleMarket('${m}',this.checked)"/>${m}</label>`;
    });
    h += `</div></div></div>`;
    // ── Section Marques (dans étape 1 Config Amazon) ──
    h += `<div style="margin-top:16px;border-top:1px solid var(--bd);padding-top:14px">`;
    h += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">`;
    h += `<div style="font-weight:600;font-size:13px">🏷️ Marques du client</div>`;
    h += `<button class="btn btn-sm" onclick="wizAddBrand()">+ Ajouter</button>`;
    h += `</div>`;
    var wizBrands = nc.brands || [];
    if (!wizBrands.length) {
      h += `<div style="font-size:12px;color:var(--tx3);padding:6px 0">Aucune marque — nécessaire pour la fusion Fab/Appro des imports CSV.</div>`;
    } else {
      for (var bi = 0; bi < wizBrands.length; bi++) {
        var wb = wizBrands[bi];
        var wbFab = wb.role === 'fabricant';
        h += `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--s2);border-radius:var(--rd);margin-bottom:4px">`;
        h += `<span style="flex:1;font-weight:500;font-size:13px">${esc(wb.name)}</span>`;
        h += `<button class="tog-b btn-sm ${wbFab ? 'sel-ok' : ''}" onclick="wizSetBrandRole(${bi},'fabricant')">🏭 Fabricant</button>`;
        h += `<button class="tog-b btn-sm ${!wbFab ? 'sel-no' : ''}" onclick="wizSetBrandRole(${bi},'revendeur')">🏪 Revendeur</button>`;
        h += `<button class="btn btn-sm btn-r" onclick="wizRemoveBrand(${bi})">✕</button>`;
        h += `</div>`;
      }
    }
    h += `</div>`;
  } else if (wizStep === 2) {
    // ── Étape 3 : Comptes VC & Catalogue ──
    h += `<h3 style="font-size:15px;font-weight:700;margin-bottom:14px">Comptes Vendor Central & Catalogue</h3>`;

    // ── Section A : CRUD Comptes VC ──
    h += `<div class="cd" style="margin-bottom:16px">`;
    h += `<div class="cd-t space"><span>Comptes Vendor Central</span>`;
    var totalAccts = nc.accounts ? nc.accounts.length : 0;
    var totalMkts  = nc.accounts ? new Set(nc.accounts.map(function(a){return a.market;})).size : 0;
    var totalBO    = nc.accounts ? nc.accounts.filter(function(a){return a.role==='BO';}).length : 0;
    var totalCat   = nc.accounts ? nc.accounts.filter(function(a){return a.role==='catalogue';}).length : 0;
    if (totalAccts > 0) h += `<span style="font-size:11px;color:var(--tx2)">${totalAccts} comptes · ${totalMkts} marchés · ${totalBO} BO · ${totalCat} catalogue</span>`;
    h += `</div>`;
    h += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:12px">`;
    h += `<div><label class="fg-lb">Marché</label><select id="newAcctMarket" class="fg-in">${marketOptionsHTML('.fr')}</select></div>`;
    h += `<div><label class="fg-lb">Vendor Code</label><input id="newAcctVC" class="fg-in" placeholder="Ex: GERA3" style="text-transform:uppercase"/></div>`;
    h += `<div><label class="fg-lb">Rôle</label><select id="newAcctRole" class="fg-in"><option value="BO">Bon de Commande</option><option value="catalogue">Fournisseur catalogue</option></select></div>`;
    h += `<div><label class="fg-lb">Label (optionnel)</label><input id="newAcctLabel" class="fg-in" placeholder="Ex: Principal FR"/></div>`;
    h += `<div><button class="btn btn-p" style="padding:6px 12px" onclick="wizAddAccount()">+ Ajouter</button></div>`;
    h += `</div>`;
    if (nc.accounts && nc.accounts.length > 0) {
      h += `<table style="width:100%;border-collapse:collapse;font-size:12px">`;
      h += `<thead><tr style="background:var(--s2)">`;
      h += `<th style="padding:6px 8px;text-align:left">Marché</th><th style="padding:6px 8px;text-align:left">Vendor Code</th>`;
      h += `<th style="padding:6px 8px;text-align:left">Rôle</th><th style="padding:6px 8px;text-align:left">Label</th><th></th>`;
      h += `</tr></thead><tbody>`;
      for (var ai = 0; ai < nc.accounts.length; ai++) {
        var acc = nc.accounts[ai];
        var mobj = MARKETPLACES_FULL.find(function(m){return m.market===acc.market;});
        var mLabel = mobj ? mobj.flag + ' ' + mobj.name : acc.market;
        h += `<tr style="border-bottom:1px solid var(--bd2)">`;
        h += `<td style="padding:6px 8px">${mLabel}</td>`;
        h += `<td style="padding:6px 8px;font-weight:600">${esc(acc.vendorCode)}</td>`;
        h += `<td style="padding:6px 8px"><span style="padding:2px 8px;border-radius:20px;font-size:11px;background:${acc.role==='BO'?'var(--b-bg)':'var(--s2)'};color:${acc.role==='BO'?'var(--b)':'var(--tx2)'}">${acc.role==='BO'?'Bon de Commande':'Catalogue'}</span></td>`;
        h += `<td style="padding:6px 8px;color:var(--tx2)">${esc(acc.label||'')}</td>`;
        h += `<td style="padding:6px 8px"><button class="btn" style="padding:3px 8px;font-size:11px" onclick="wizRemoveAccount('${esc(acc.id)}')">✕</button></td>`;
        h += `</tr>`;
      }
      h += `</tbody></table>`;
    }
    h += `</div>`;

    // ── Section B : Import Matrice Tarifaire XML ──
    h += `<div class="cd">`;
    h += `<div class="cd-t space"><span>Matrice Tarifaire XML <span style="font-size:11px;color:var(--r,#b42)">obligatoire</span></span>`;
    if (nc.catalogueXML && nc.catalogueXML.length > 0 && nc.xmlSummary) {
      h += `<span style="font-size:11px;color:var(--g,#3b6d11)">✓ ${nc.xmlSummary.totalASINs} ASINs importés</span>`;
    }
    h += `</div>`;
    if (!nc.catalogueXML || nc.catalogueXML.length === 0) {
      h += `<div class="import-zone" style="padding:20px;margin-bottom:10px" onclick="document.getElementById('wiz-xml-input').click()">`;
      h += `<div style="font-size:24px;margin-bottom:6px">📄</div>`;
      h += `<p style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:2px">Déposez la Matrice Tarifaire XML</p>`;
      h += `<p style="font-size:11px;color:var(--tx3)">Format XML Spreadsheet 2003 — onglet "Cost" requis</p>`;
      h += `<input type="file" id="wiz-xml-input" accept=".xml" style="display:none" onchange="wizHandleXML(this)"/>`;
      h += `</div>`;
    } else {
      var xs = nc.xmlSummary;
      h += `<div style="padding:10px 14px;background:var(--g-bg,#eaf6e0);border:1px solid var(--g-bd,#b7dfa0);border-radius:var(--rd);margin-bottom:10px">`;
      h += `<strong>${xs.totalASINs} ASINs</strong> · ${xs.totalLines} lignes`;
      if (xs.vendorCodes) {
        var vcKeys = Object.keys(xs.vendorCodes);
        if (vcKeys.length) h += ` · VC : ` + vcKeys.map(function(k){return k + ' (' + xs.vendorCodes[k] + ')';}).join(', ');
      }
      h += `</div>`;
      h += `<button class="btn" style="font-size:12px" onclick="document.getElementById('wiz-xml-reinput').click()">🔄 Réimporter</button>`;
      h += `<input type="file" id="wiz-xml-reinput" accept=".xml" style="display:none" onchange="wizHandleXML(this)"/>`;
    }
    h += `</div>`;

    // Message de validation
    var canNext2 = nc.accounts && nc.accounts.length > 0 && nc.catalogueXML && nc.catalogueXML.length > 0;
    if (!canNext2) {
      h += `<div id="wiz-step2-err" class="alr alr-a" style="margin-top:10px">`;
      if (!nc.accounts || nc.accounts.length === 0) h += `⚠️ Ajoutez au moins un compte Vendor Central.<br>`;
      if (!nc.catalogueXML || nc.catalogueXML.length === 0) h += `⚠️ Importez la matrice tarifaire XML.`;
      h += `</div>`;
    }

  } else if (wizStep === 3) {
    h += `<h3 style="font-size:15px;font-weight:700;margin-bottom:14px">Contraintes internes</h3>`;
    h += `<div class="alr alr-a" style="margin-bottom:16px">Ces contraintes filtrent les recommandations IA — un levier interdit ne sera jamais proposé.</div>`;
    h += `<div class="fg2">`;
    h += `<div class="fg"><label class="fg-lb">Stock déporté (FBA)</label><div class="tog">
      <button class="tog-b ${nc.stockDeporte ? 'sel-ok' : ''}" onclick="ncSet('stockDeporte',true)">Autorisé</button>
      <button class="tog-b ${!nc.stockDeporte ? 'sel-no' : ''}" onclick="ncSet('stockDeporte',false)">Interdit</button>
    </div></div>`;
    h += `<div class="fg"><label class="fg-lb">3P / Seller Central</label><div class="tog">
      <button class="tog-b ${nc.threeP ? 'sel-ok' : ''}" onclick="ncSet('threeP',true)">Autorisé</button>
      <button class="tog-b ${!nc.threeP ? 'sel-no' : ''}" onclick="ncSet('threeP',false)">Interdit</button>
    </div></div>`;
    h += fgSel('Born to Run', nc.btr, ['Autorisé', 'Conditionnel', 'Interdit'], "newClient.btr=this.value");
    h += fgEl('Budget Ads mensuel', nc.budget, "newClient.budget=this.value", '5 000 € ou 8% du CA');
    h += `</div>`;
  } else if (wizStep === 4) {
    // ── Étape Historique avec zone de dépôt intégrée ──
    const currentY = new Date().getFullYear();
    const prevY = currentY - 1;
    const prev2Y = currentY - 2;

    h += `<h3 style="font-size:15px;font-weight:700;margin-bottom:4px">Chargez l'historique du compte</h3>`;
    h += `<p style="font-size:12px;color:var(--tx2);margin-bottom:14px">Déposez les exports annuels Vendor Central — jusqu'à 9 fichiers en une fois (N-2 + N-1 + YTD × Ventes/Trafic/Stock). Étape optionnelle, faisable plus tard.</p>`;

    // ── Zone de dépôt ──
    h += `<div class="import-zone" style="padding:20px;margin-bottom:14px" onclick="document.getElementById('hist-files').click()">
      <div style="font-size:24px;margin-bottom:6px">📁</div>
      <p style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:2px">Déposez vos fichiers CSV historiques</p>
      <p style="font-size:11px;color:var(--tx3)">Annuels 2024 · Annuels 2025 · YTD 2026 — Ventes, Trafic et/ou Stock</p>
      <input type="file" id="hist-files" accept=".csv,.tsv,.txt" multiple onchange="handleHistCSV(this)" style="display:none"/>
    </div>`;

    // Zone PO
    const poImportDate = nc.poImportDate ? new Date(nc.poImportDate).toLocaleDateString('fr-FR') : null;
    const poCount = nc.poData ? Object.keys(nc.poData).length : 0;
    const poLowFill = nc.poData ? Object.values(nc.poData).filter(d => d.fillRate < 80).length : 0;
    const poDiscontinued = nc.poData ? Object.values(nc.poData).filter(d => d.isDiscontinued).length : 0;
    h += `<div class="cd" style="margin-top:12px">
      <div class="cd-t space">
        <span>1.5 — Purchase Orders <span style="font-size:11px;color:var(--tx3);font-weight:400">optionnel</span></span>
        ${poImportDate ? `<span style="font-size:11px;color:var(--g,#3b6d11)">✓ Importé le ${poImportDate} · ${poCount} ASINs · ${poLowFill} fill rate < 80%</span>` : ''}
      </div>
      <p style="font-size:12px;color:var(--tx2);margin-bottom:10px">Fichier POItemExport depuis VC → Commandes. Calcule le fill rate réel et détecte les fins de série.</p>
      <div id="po-drop-zone" class="drop-zone" style="cursor:pointer;padding:12px" onclick="document.getElementById('po-file-input').click()">
        <p style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:2px">${poImportDate ? 'Remplacer le fichier PO' : 'Déposez le fichier PO'}</p>
        <p style="font-size:11px;color:var(--tx3)">POItemExport_YYYY-MM-DD.csv — export Vendor Central</p>
        <input type="file" id="po-file-input" accept=".csv" style="display:none" onchange="handlePOImport(this.files)">
      </div>
    <div style="margin-top:10px;padding:8px 12px;background:var(--b-l,#e6f1fb);border-radius:var(--rd);display:flex;align-items:center;gap:10px">
      <span style="font-size:16px">&#128203;</span>
      <div style="flex:1;font-size:11px">
        <strong>Guide ASN / BOL / Carrier Central</strong><br>
        <span style="color:var(--tx2)">Comprendre les \u00e9carts de r\u00e9ception et piloter ton transporteur</span>
      </div>
      <button class="btn btn-p" style="font-size:11px;padding:5px 10px;flex-shrink:0" onclick="downloadGuideASN()">&#8595; T\u00e9l\u00e9charger PDF</button>
    </div>
    </div>`;

    
    // ── Statut des 3 périodes ──
    const slots = [
      { year: prev2Y, label: String(prev2Y) + ' — Annuel', type: 'annual' },
      { year: prevY,  label: String(prevY)  + ' — Annuel', type: 'annual' },
      { year: currentY, label: currentY + ' YTD', type: 'ytd' },
    ];

    h += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">`;
    slots.forEach(({ year, label, type }) => {
      const data    = type === 'ytd' ? nc.ytdData    : nc.annualData?.[year];
      const hasV    = type === 'ytd' ? !!nc.ytdData?.ventes  : !!data?.ventes;
      const hasT    = type === 'ytd' ? !!nc.ytdData?.trafic  : !!data?.trafic;
      const hasS    = type === 'ytd' ? !!nc.ytdData?.stock   : !!data?.stock;
      const totalCA = type === 'ytd' ? (nc.ytdData?.ventes?.totalCA || 0) : (data?.ventes?.totalCA || 0);
      const hasAny  = hasV || hasT || hasS;
      const allOk   = hasV && hasT && hasS;
      const isYTD   = type === 'ytd';
      const bg      = allOk ? 'var(--g-bg)' : hasAny ? 'var(--a-bg)' : 'var(--s2)';
      const bd      = allOk ? 'var(--g-bd)' : hasAny ? 'var(--a-bd)' : 'var(--bd2)';
      const badge   = allOk ? '✅' : hasAny ? '⚠️' : (isYTD ? '📈' : '📅');

      h += `<div style="padding:12px 14px;background:${bg};border:1px solid ${bd};border-radius:var(--rdl)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:16px">${badge}</span>
          <div style="font-weight:600;font-size:12px">${label}</div>
        </div>
        <div style="display:flex;gap:5px">
          <span style="font-size:10px;padding:2px 7px;border-radius:20px;background:${hasV?'var(--g-bg)':'var(--s3)'};color:${hasV?'var(--g)':'var(--tx3)'}">💰${hasV?' ✓':''}</span>
          <span style="font-size:10px;padding:2px 7px;border-radius:20px;background:${hasT?'var(--b-bg)':'var(--s3)'};color:${hasT?'var(--b)':'var(--tx3)'}">👁${hasT?' ✓':''}</span>
          <span style="font-size:10px;padding:2px 7px;border-radius:20px;background:${hasS?'var(--a-bg)':'var(--s3)'};color:${hasS?'var(--a)':'var(--tx3)'}">📦${hasS?' ✓':''}</span>
        </div>
        ${totalCA ? `<div style="font-size:13px;font-weight:700;margin-top:8px">${fmtEur(totalCA)}</div>` : ''}
      </div>`;
    });
    h += `</div>`;

    // Log si des fichiers viennent d'être parsés
    if (debugLog.length) {
      h += `<div class="debug-log" style="max-height:80px;margin-bottom:10px">`;
      debugLog.slice(-5).forEach(l => { h += `<div class="${l.type}">[${l.ts}] ${l.msg}</div>`; });
      h += `</div>`;
    }

    h += `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--b-bg);border:1px solid var(--b-bd);border-radius:var(--rd);font-size:11px;color:var(--b)">
      💡 <span>Dans Vendor Central : <strong>Analytiques → Tableau de bord</strong> → sélectionnez la période → Exporter CSV</span>
    </div>`;

  } else if (wizStep === 5) {
    // ── Récapitulatif ──
    h += `<h3 style="font-size:15px;font-weight:700;margin-bottom:14px">Récapitulatif — ${esc(nc.name)}</h3>`;
    h += `<div class="rec-grid">`;
    h += recRow('Modèle', nc.model);
    h += recRow('Marchés', nc.markets.join(', '));
    h += recRow('Stock déporté', nc.stockDeporte ? 'Autorisé' : 'Interdit', !nc.stockDeporte);
    h += recRow('Born to Run', nc.btr, nc.btr !== 'Autorisé');
    h += recRow('3P autorisé', nc.threeP ? 'Oui' : 'Non', !nc.threeP);
    h += recRow('Budget Ads', nc.budget || 'Non défini');
    h += `</div>`;
    h += `<div class="alr alr-b" style="margin-top:16px"><strong>Prochaine étape :</strong> Importer vos fichiers CSV hebdomadaires Vendor Central.</div>`;
  }

  h += `<div style="display:flex;justify-content:space-between;margin-top:20px">`;
  h += `<button class="btn" onclick="${wizStep > 0 ? 'wizGo('+(wizStep-1)+')' : 'go(clients.length?\'dashboard\':\'welcome\')'}"> ${wizStep > 0 ? '← Précédent' : 'Annuler'}</button>`;
  if (wizStep < 5) {
    var canProceed = !(wizStep === 2 && (!(nc.accounts && nc.accounts.length > 0) || !(nc.catalogueXML && nc.catalogueXML.length > 0)));
    h += `<button class="btn btn-p" onclick="wizNext()" ${canProceed ? '' : 'disabled style="opacity:0.45;cursor:not-allowed"'}>Suivant →</button>`;
  } else h += `<button class="btn btn-g" onclick="finishOnboarding()">Créer & importer →</button>`;
  h += `</div></div></div>`;
  return h;
}
function renderImport() {
  const c = cl();
  if (!c) return `<p>Sélectionnez un client</p>`;
  let h = `<div style="max-width:760px;margin:0 auto">`;
  h += `<h2 style="font-size:17px;font-weight:700;margin-bottom:16px">📥 Import — ${esc(c.name)}</h2>`;

  // ── Bandeau client actif (garde-fou visuel) ──────────────────────────────
  h += '<div style="padding:10px 16px;background:var(--accent-bg);border:2px solid var(--accent);border-radius:var(--rdl);margin-bottom:14px;display:flex;align-items:center;gap:10px">';
  h += '<span style="font-size:20px">📥</span>';
  h += '<div>';
  h += '<div style="font-size:14px;font-weight:700;color:var(--accent)">Import de données pour : ' + esc(c.name) + '</div>';
  if (c.brands && c.brands.length > 0) {
    h += '<div style="font-size:12px;color:var(--tx2)">Marques : ' + c.brands.map(function(b) { return esc(b.name); }).join(', ') + '</div>';
  }
  if (c.markets && c.markets.length > 1) {
    h += '<div style="font-size:12px;color:var(--tx2)">Marchés : ' + c.markets.map(function(m) {
      var mp = MARKETPLACES_FULL.find(function(x) { return x.market === m; });
      return mp ? mp.flag + ' ' + mp.name : m;
    }).join(', ') + '</div>';
  }
  h += '</div></div>';

  // ══════════════════════════════════════════════════════
  // ÉTAPE 1 — Données contextuelles (historique long terme)
  // ══════════════════════════════════════════════════════
  const curY = new Date().getFullYear();
  const prevY = curY - 1;
  const prev2Y = curY - 2;

  const annSlots = [
    { year: prev2Y, type: 'annual' },
    { year: prevY,  type: 'annual' },
    { year: curY,   type: 'ytd',   label: curY + ' YTD' },
  ];
  const allHistLoaded = annSlots.every(({ year, type }) =>
    type === 'ytd'
      ? !!(c.ytdData?.ventes && c.ytdData?.trafic && c.ytdData?.stock)
      : !!(c.annualData?.[year]?.ventes && c.annualData?.[year]?.trafic && c.annualData?.[year]?.stock)
  );
  const anyHistLoaded = annSlots.some(({ year, type }) =>
    type === 'ytd'
      ? !!(c.ytdData?.ventes || c.ytdData?.trafic || c.ytdData?.stock)
      : !!(c.annualData?.[year]?.ventes || c.annualData?.[year]?.trafic || c.annualData?.[year]?.stock)
  );

  h += `<div class="cd">`;
  h += `<div class="cd-t space">
    <span>1 — Données historiques <span style="font-size:10px;font-weight:400;color:var(--tx3)">(optionnel — une seule fois)</span></span>
    ${allHistLoaded ? '<span class="pill pill-g">✓ Complet</span>' : anyHistLoaded ? '<span class="pill pill-a">Partiel</span>' : '<span class="pill pill-gr">Non chargé</span>'}
  </div>`;
  const hasFabBrandsHist = (c.brands||[]).some(b=>b.role==='fabricant');
  h += `<p style="font-size:12px;color:var(--tx2);margin-bottom:12px">N-2, N-1, YTD — contextualisent le compte dans sa trajectoire longue. Déposez jusqu'à ${hasFabBrandsHist?'12 (Fab + Appro)':'9'} fichiers d'un coup.</p>`;
  if (hasFabBrandsHist) h += `<div style="font-size:11px;color:var(--a);background:var(--a-bg);border:1px solid var(--a-bd);border-radius:var(--rd);padding:6px 10px;margin-bottom:10px">⚡ Client avec marques fabricant — importer aussi les vues Approvisionnement Ventes + Stock pour chaque période</div>`;

  // Grille historique : 5 colonnes si marques fabricant, 3 sinon
  const histCols = hasFabBrandsHist
    ? ['ventesFab','ventesAppro','trafic','stockFab','stockAppro']
    : ['ventes','trafic','stock'];
  const histColCount = histCols.length;
  const histGridCols = `100px repeat(${histColCount},1fr)`;

  // En-têtes colonnes
  const histHeaders = hasFabBrandsHist ? [
    '<span>💰 Ventes</span><span style="font-size:9px;font-weight:600;color:var(--b);background:var(--b-bg);border-radius:3px;padding:1px 4px;margin-left:3px">Fab</span>',
    '<span>💰 Ventes</span><span style="font-size:9px;font-weight:600;color:var(--a);background:var(--a-bg);border-radius:3px;padding:1px 4px;margin-left:3px">Appro</span>',
    '👁 Trafic',
    '<span>📦 Stock</span><span style="font-size:9px;font-weight:600;color:var(--b);background:var(--b-bg);border-radius:3px;padding:1px 4px;margin-left:3px">Fab</span>',
    '<span>📦 Stock</span><span style="font-size:9px;font-weight:600;color:var(--a);background:var(--a-bg);border-radius:3px;padding:1px 4px;margin-left:3px">Appro</span>',
  ] : ['💰 Ventes','👁 Trafic','📦 Stock'];

  h += `<div style="display:grid;grid-template-columns:${histGridCols};gap:6px;margin-bottom:6px;padding:0 2px">
    <div></div>
    ${histHeaders.map(hh => `<div style="text-align:center;font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">${hh}</div>`).join('')}
  </div>`;

  // Lignes : 1 par période (3 périodes × 5 cols = 15 emplacements)
  h += `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">`;
  annSlots.forEach(({ year, type, label }) => {
    const isYTD = type === 'ytd';
    const slotLabel = label || String(year);
    h += `<div style="display:grid;grid-template-columns:${histGridCols};gap:6px;align-items:stretch">`;
    // Label période
    h += `<div style="display:flex;flex-direction:column;justify-content:center;padding:0 4px">
      <div style="font-weight:700;font-size:13px;color:var(--tx)">${slotLabel}</div>
      <div style="font-size:10px;color:${isYTD?'var(--or)':'var(--tx3)'};margin-top:2px">${isYTD?'Recommandé':'Optionnel'}</div>
    </div>`;

    // Colonnes selon le mode (3 ou 5)
    histCols.forEach(col => {
      // Déterminer type et vue
      const isFabCol   = col === 'ventesFab' || col === 'ventes';
      const isApproCol = col === 'ventesAppro' || col === 'stockAppro';
      const isTrafic   = col === 'trafic';
      const isStockFab = col === 'stockFab' || col === 'stock';
      const dataKey    = isTrafic ? 'trafic' : (isFabCol ? 'ventes' : (isStockFab ? 'stock' : (col === 'ventesAppro' ? 'ventes' : 'stock')));

      // Récupérer les données
      const data = isYTD ? c.ytdData?.[dataKey] : c.annualData?.[year]?.[dataKey];
      const hasFab   = !!data;
      const hasAppro = data?.hasApproData;

      // Pour les colonnes Appro : vide si Fab pas encore chargé, sinon montrer statut
      let ok = false, mainVal = '', subVal = '', cellBg, cellBd, cellIcon, cellLabel;

      if (isTrafic) {
        ok = hasFab;
        if (ok) {
          mainVal = fmt(data.totalGV || 0) + ' GV';
          subVal  = data.asinCount + ' ASINs';
          cellBg = 'var(--g-bg)'; cellBd = 'var(--g-bd)';
        } else {
          cellBg = 'var(--s2)'; cellBd = 'var(--bd)';
          cellIcon = '+'; cellLabel = 'À charger';
        }
      } else if (col === 'ventesFab' || col === 'ventes') {
        ok = hasFab;
        if (ok) {
          const displayCA = (data.fabOnlyCA != null) ? data.fabOnlyCA : data.totalCA;
          const displayUnits = (data.fabOnlyUnits != null) ? data.fabOnlyUnits : data.totalUnits;
          const displayCount = (data.fabOnlyCount != null) ? data.fabOnlyCount : data.asinCount;
          mainVal = fmtEur(displayCA || 0);
          subVal  = fmt(displayUnits || 0) + ' unités · ' + displayCount + ' ASINs';
          cellBg = 'var(--g-bg)'; cellBd = 'var(--g-bd)';
        } else {
          cellBg = 'var(--s2)'; cellBd = 'var(--bd)';
          cellIcon = '+'; cellLabel = 'À charger';
        }
      } else if (col === 'ventesAppro') {
        // Affiche uniquement le CA des ASINs Appro absents de la vue Fab (sourcingOnly)
        // = delta Brand Registry : ventes sur ASINs que Fab ne voit pas encore
        if (!hasFab) {
          // Fab pas encore chargé
          cellBg = 'var(--s2)'; cellBd = 'var(--bd2,#ddd)';
          cellIcon = '🔒'; cellLabel = 'Fab en 1er';
        } else if (hasAppro) {
          ok = true;
          mainVal = fmtEur(data.approOnlyCA || 0);
          subVal  = (data.approOnlyCount || 0) + ' ASINs excl.';
          cellBg = 'var(--a-bg)'; cellBd = 'var(--a-bd,var(--a))';
        } else {
          // Fab chargé, Appro manquant
          cellBg = 'var(--or-bg,#fff8ee)'; cellBd = 'var(--or,#e8a000)';
          cellIcon = '📤'; cellLabel = 'À charger';
        }
      } else if (col === 'stockFab' || col === 'stock') {
        ok = hasFab;
        if (ok) {
          mainVal = data.asinCount + ' ASINs';
          subVal  = data.periodStart ? data.periodStart + ' → ' + data.periodEnd : '';
          cellBg = 'var(--g-bg)'; cellBd = 'var(--g-bd)';
        } else {
          cellBg = 'var(--s2)'; cellBd = 'var(--bd)';
          cellIcon = '+'; cellLabel = 'À charger';
        }
      } else if (col === 'stockAppro') {
        if (!hasFab) {
          cellBg = 'var(--s2)'; cellBd = 'var(--bd2,#ddd)';
          cellIcon = '🔒'; cellLabel = 'Fab en 1er';
        } else if (hasAppro) {
          ok = true;
          mainVal = data.asinCount + ' ASINs';
          subVal  = '';
          cellBg = 'var(--a-bg)'; cellBd = 'var(--a-bd,var(--a))';
        } else {
          cellBg = 'var(--or-bg,#fff8ee)'; cellBd = 'var(--or,#e8a000)';
          cellIcon = '📤'; cellLabel = 'À charger';
        }
      }

      h += `<div style="padding:10px 12px;background:${cellBg};border:1px solid ${cellBd};border-radius:var(--rdl);text-align:center;min-height:60px;display:flex;flex-direction:column;justify-content:center">
        ${ok
          ? `<div style="font-weight:700;font-size:12px;color:var(--tx);line-height:1.3">${mainVal}</div>
             <div style="font-size:9px;color:var(--tx3);margin-top:3px">${subVal}</div>`
          : `<div style="font-size:16px;margin-bottom:2px">${cellIcon}</div>
             <div style="font-size:9px;color:var(--tx3);font-weight:600">${cellLabel}</div>`
        }
      </div>`;
    });
    h += `</div>`;
  });
  h += `</div>`;

  // Zone de dépôt historique
  h += `<div class="import-zone" style="padding:18px" onclick="document.getElementById('hist-files-import').click()">
    <div style="font-size:22px;margin-bottom:6px">📁</div>
    <p style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:2px">Déposez les fichiers annuels et YTD</p>
    <p style="font-size:10px;color:var(--tx3)">Annuels ${prev2Y} · ${prevY} · YTD ${curY} — Ventes + Trafic + Stock</p>
    <input type="file" id="hist-files-import" accept=".csv,.tsv,.txt" multiple onchange="handleHistCSVImport(this)" style="display:none"/>
  </div>`;

  // Boutons suppression
  if (anyHistLoaded) {
    h += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">`;
    Object.keys(c.annualData||{}).sort().forEach(yr => {
      h += `<button class="btn btn-xs" onclick="if(confirm('Supprimer ${yr} ?')){deleteAnnualData('${yr}')}" style="font-size:10px">🗑 ${yr}</button>`;
    });
    if (Object.keys(c.ytdData||{}).length > 0) {
      h += `<button class="btn btn-xs" onclick="if(confirm('Supprimer YTD ?')){deleteYTDData()}" style="font-size:10px">🗑 YTD ${curY}</button>`;
    }
    h += `</div>`;
  }
  h += `</div>`;

  // ══════════════════════════════════════════════════════
  // ÉTAPE 2 — Données hebdomadaires
  // ══════════════════════════════════════════════════════
  const hasV  = !!pendingFiles.ventes;
  const hasVA = !!pendingFiles.ventesAppro;
  const hasT  = !!pendingFiles.trafic;
  const hasS  = !!pendingFiles.stock;
  const hasSA = !!pendingFiles.stockAppro;
  const hasFabBrands = (cl()?.brands||[]).some(b=>b.role==='fabricant');
  // Si le client a des marques fabricant → 5 fichiers requis, sinon 3
  const requiredSlots = hasFabBrands ? [hasV,hasVA,hasT,hasS,hasSA] : [hasV,hasT,hasS];
  const hasAny   = hasV || hasVA || hasT || hasS || hasSA;
  const allReady = requiredSlots.every(Boolean);
  const readyCount = requiredSlots.filter(Boolean).length;
  const totalReq   = requiredSlots.length;

  h += `<div class="cd">`;
  h += `<div class="cd-t space">
    <span>2 — Données hebdomadaires <span style="font-size:10px;font-weight:400;color:var(--tx3)">(chaque semaine)</span></span>
    ${allReady ? `<span class="pill pill-g">${totalReq}/${totalReq} prêts</span>` : hasAny ? `<span class="pill pill-a">${readyCount}/${totalReq} chargés</span>` : '<span class="pill pill-gr">En attente</span>'}
  </div>`;
  h += `<p style="font-size:12px;color:var(--tx2);margin-bottom:12px">Ventes (Fab + Appro) + Trafic + Stock (Fab + Appro). Déposez les ${totalReq} fichiers ensemble puis cliquez Importer.</p>`;

  // Zone de dépôt hebdo
  h += `<div class="import-zone" id="drop-zone" onclick="document.getElementById('csv-files').click()" style="padding:18px;margin-bottom:12px">
    <div style="font-size:22px;margin-bottom:6px">📅</div>
    <p style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:2px">Déposez vos ${totalReq} fichiers CSV hebdo</p>
    <p style="font-size:10px;color:var(--tx3)">Ventes Fab · Ventes Appro · Trafic · Stock Fab · Stock Appro — Intervalle = Semaine</p>
    <input type="file" id="csv-files" accept=".csv,.tsv,.txt" multiple onchange="handleMultiCSV(this)" style="display:none"/>
  </div>`;

  // Statut des fichiers — 3 ou 5 selon configuration client
  const hebdoSlots = hasFabBrands ? [
    { key: 'ventes',      icon: '💰', label: 'Ventes (Fab)',   f: pendingFiles.ventes,      badge: 'Fabrication' },
    { key: 'ventesAppro', icon: '💰', label: 'Ventes (Appro)', f: pendingFiles.ventesAppro, badge: 'Approvisionnement' },
    { key: 'trafic',      icon: '👁',  label: 'Trafic',         f: pendingFiles.trafic,      badge: null },
    { key: 'stock',       icon: '📦', label: 'Stock (Fab)',    f: pendingFiles.stock,       badge: 'Fabrication' },
    { key: 'stockAppro',  icon: '📦', label: 'Stock (Appro)',  f: pendingFiles.stockAppro,  badge: 'Approvisionnement' },
  ] : [
    { key: 'ventes', icon: '💰', label: 'Ventes', f: pendingFiles.ventes,  badge: null },
    { key: 'trafic', icon: '👁',  label: 'Trafic', f: pendingFiles.trafic,  badge: null },
    { key: 'stock',  icon: '📦', label: 'Stock',  f: pendingFiles.stock,   badge: null },
  ];
  // Grille adaptative : 3 cols standard, 5 cols avec auto-fit pour mode Fab+Appro
  h += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(${hasFabBrands?'155px':'200px'},1fr));gap:8px;margin-bottom:12px">`;
  hebdoSlots.forEach(({ icon, label, f, badge }) => {
    const ok = !!f && !f.error;
    const err = f?.error;
    const bg  = err ? 'var(--r-bg)' : ok ? 'var(--g-bg)' : 'var(--s2)';
    const bd  = err ? 'var(--r-bd)' : ok ? 'var(--g-bd)' : 'var(--bd2)';
    const statusColor = err ? 'var(--r)' : ok ? 'var(--g)' : 'var(--tx3)';
    const statusText  = err ? '✕ Erreur' : ok ? '✓ Prêt' : 'En attente';
    const badgeHtml = badge ? `<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:${badge==='Fabrication'?'var(--b-bg)':'var(--a-bg)'};color:${badge==='Fabrication'?'var(--b)':'var(--a)'}">${badge==='Fabrication'?'Fab':'Appro'}</span>` : '';
    h += `<div style="padding:10px 12px;background:${bg};border:1px solid ${bd};border-radius:var(--rdl)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
        <span style="font-size:16px">${icon}</span>
        <span style="font-weight:600;font-size:12px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label.replace(' (Fab)','').replace(' (Appro)','')}</span>
        ${badgeHtml}
        <span style="font-size:10px;font-weight:700;color:${statusColor};white-space:nowrap">${statusText}</span>
      </div>
      <div style="font-size:10px;color:var(--tx3);line-height:1.4">
        ${ok ? `${f.rowCount} ASINs · ${f.periodStart||''}→${f.periodEnd||''}` : err ? f.error.slice(0,40) : 'Déposez le fichier ci-dessus'}
      </div>
    </div>`;
  });
  h += `</div>`;

  // Zone panneau récapitulatif (garde-fou 3 — injectée par processImport)
  h += `<div id="importConfirmZone"></div>`;

  // Bouton Importer — bien visible, centré, désactivé si rien
  if (allReady) {
    h += `<div style="background:var(--g-bg);border:1px solid var(--g-bd);border-radius:var(--rdl);padding:14px 16px;display:flex;align-items:center;gap:14px;margin-bottom:10px">
      <span style="font-size:20px">✅</span>
      <div style="flex:1">
        <div style="font-weight:700;font-size:13px;color:var(--g)">Les ${totalReq} fichiers sont prêts</div>
        <div style="font-size:11px;color:var(--tx3);margin-top:2px">Fab + Appro · Trafic détectés — cliquez pour intégrer</div>
      </div>
      <button class="btn btn-p" onclick="processImport()" style="font-size:13px;padding:10px 20px">✓ Importer</button>
    </div>`;
  } else if (hasAny) {
    const missingLabels = [...(!hasV?['Ventes Fab']:[]), ...(!hasVA&&hasFabBrands?['Ventes Appro']:[]), ...(!hasT?['Trafic']:[]), ...(!hasS?['Stock Fab']:[]), ...(!hasSA&&hasFabBrands?['Stock Appro']:[])];
    h += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <button class="btn btn-p" onclick="processImport()">✓ Importer (${readyCount} fichier${readyCount>1?'s':''})</button>
      <button class="btn" onclick="clearPending()">✕ Effacer</button>
      <span style="font-size:11px;color:var(--tx3)">Il manque : ${missingLabels.join(', ')}</span>
    </div>`;
  } else {
    h += `<button class="btn btn-p" disabled style="opacity:.4">✓ Importer</button>`;
  }

  // Debug log
  if (debugLog.length) {
    h += `<div class="debug-log" style="margin-top:10px;max-height:100px">`;
    debugLog.slice(-8).forEach(l => { h += `<div class="${l.type}">[${l.ts}] ${l.msg}</div>`; });
    h += `</div>`;
  }
  h += `</div>`;

  // ══════════════════════════════════════════════════════
  // ÉTAPE 3 — Bons de commande (POs confirmés)
  // ══════════════════════════════════════════════════════
  const posLoaded          = (c.pos||[]).length > 0;
  const posCount           = (c.pos||[]).length;
  const poAsins            = new Set((c.pos||[]).map(p=>p.asin)).size;
  const lastPO             = posLoaded ? (c.pos||[]).slice().sort((a,b)=>(b.importedAt||'').localeCompare(a.importedAt||''))[0] : null;
  const lastPODate         = lastPO?.importedAt ? new Date(lastPO.importedAt).toLocaleDateString('fr-FR') : null;
  const _poMkt             = c.mainMarket || '.fr';
  // Hoisted ici pour usage dans le bandeau BO + badge POItemExport plus bas
  const _poItemExportCount = (c.pos||[]).filter(function(p){ return p.source === 'POItemExport'; }).length;

  h += '<div class="cd" id="po-section-3">';
  h += '<div class="cd-t space"><span>3 — Bons de commande <span style="font-size:10px;font-weight:400;color:var(--tx3)">(confirmés — mise à jour libre)</span></span>' + (posLoaded ? '<span class="pill pill-g">✓ Chargés</span>' : '<span class="pill pill-gr">Non chargé</span>') + '</div>';
  h += '<p style="font-size:12px;color:var(--tx2);margin-bottom:12px">Export XLS/CSV depuis Vendor Central → Gérer les bons de commande → Confirmés.</p>';

  // ── Comptes BO attendus (si c.accounts renseigné) ──
  var boAccts = (c.accounts || []).filter(function(a) { return a.role === 'BO'; });
  if (boAccts.length > 0) {
    // Pays distincts = nombre de fichiers POItemExport attendus (1 fichier VC par marketplace)
    var _boMarketsSet = {}, _boMarkets = [];
    for (var bmi = 0; bmi < boAccts.length; bmi++) {
      var _mkt = boAccts[bmi].market || '';
      if (_mkt && !_boMarketsSet[_mkt]) { _boMarketsSet[_mkt] = true; _boMarkets.push(_mkt); }
    }
    var _boFilesN = _boMarkets.length || 1;
    var _boMarketsStr = _boMarkets.map(function(m) { return m.replace('.','').toUpperCase(); }).join(', ');

    // Sous-comptes BO couverts par au moins 1 PO POItemExport
    var _poItemExportVCs = {};
    (c.pos||[]).forEach(function(p) { if (p.source === 'POItemExport' && p.vendorCode) _poItemExportVCs[p.vendorCode] = true; });
    var _boVCCoveredCount = boAccts.filter(function(a) { return !!_poItemExportVCs[a.vendorCode]; }).length;
    var _boMarketsCoveredSet = {};
    boAccts.forEach(function(a) { if (_poItemExportVCs[a.vendorCode] && a.market) _boMarketsCoveredSet[a.market] = true; });
    var _boMarketsCoveredN = Object.keys(_boMarketsCoveredSet).length;

    h += '<div style="padding:10px 14px;background:var(--b-bg,#e8f0fb);border:1px solid var(--b-bd,#b0c8f0);border-radius:var(--rdl);margin-bottom:12px;font-size:12px">';
    if (_poItemExportCount > 0) {
      // Au moins 1 PO POItemExport chargé → afficher l'état réel
      h += '<div style="font-weight:600;margin-bottom:4px">📦 Pays détectés : ' + (_boMarketsStr||'—')
        + ' — <span style="font-weight:400;color:var(--g)">'
        + _boMarketsCoveredN + '/' + _boFilesN + ' fichier' + (_boFilesN > 1 ? 's' : '') + ' chargé' + (_boMarketsCoveredN > 1 ? 's' : '')
        + ' — ' + _boVCCoveredCount + '/' + boAccts.length + ' sous-compte' + (boAccts.length > 1 ? 's' : '') + ' couvert' + (_boVCCoveredCount > 1 ? 's' : '')
        + '</span></div>';
    } else {
      // Aucun POItemExport → invite au chargement
      h += '<div style="font-weight:600;margin-bottom:4px">📦 Pays détectés : ' + (_boMarketsStr||'—')
        + ' — <span style="font-weight:400">' + _boFilesN + ' fichier' + (_boFilesN > 1 ? 's' : '') + ' POItemExport attendu' + (_boFilesN > 1 ? 's' : '') + '</span></div>';
    }
    h += '<div style="color:var(--tx2);font-size:11px">';
    var boLabels = [];
    for (var bai = 0; bai < boAccts.length; bai++) {
      var ba = boAccts[bai];
      var bamp = MARKETPLACES_FULL.find(function(m) { return m.market === ba.market; });
      var baflag = bamp ? bamp.flag : '';
      var baMktCode = ba.market ? ba.market.replace('.','').toUpperCase() : '—';
      boLabels.push(baflag + ' ' + baMktCode + ' ' + ba.vendorCode);
    }
    h += 'Sous-comptes : ' + boLabels.join(' · ');
    h += '</div></div>';
  }

  if (posLoaded) {
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">';
    [{label:'POs chargés',val:posCount,icon:'📋'},{label:'ASINs concernés',val:poAsins,icon:'📦'},{label:'Dernier import',val:lastPODate||'—',icon:'📅'}].forEach(function({label,val,icon}){
      h += '<div style="padding:10px 12px;background:var(--g-bg);border:1px solid var(--g-bd);border-radius:var(--rdl);text-align:center">'
        + '<div style="font-size:18px;margin-bottom:4px">' + icon + '</div>'
        + '<div style="font-weight:700;font-size:16px">' + val + '</div>'
        + '<div style="font-size:10px;color:var(--tx3)">' + label + '</div>'
        + '</div>';
    });
    h += '</div>';
    // ── Bilan VCs trouvés vs attendus ──
    if (boAccts.length > 0) {
      var vcInPos = {};
      for (var pi = 0; pi < (c.pos||[]).length; pi++) {
        var pvc = (c.pos[pi].vendorCode || '').trim();
        if (pvc) vcInPos[pvc] = (vcInPos[pvc] || 0) + 1;
      }
      h += '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px">';
      for (var bci = 0; bci < boAccts.length; bci++) {
        var bca = boAccts[bci];
        var bcFound = !!vcInPos[bca.vendorCode];
        var bcLines = vcInPos[bca.vendorCode] || 0;
        var bcFlag = (MARKETPLACES_FULL.find(function(m){return m.market===bca.market;})||{}).flag||'';
        h += '<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 10px;background:' + (bcFound?'var(--g-bg)':'var(--a-bg,#fff8e1)') + ';border-radius:var(--rd);border:1px solid ' + (bcFound?'var(--g-bd)':'var(--a-bd,#f0c040)') + '">';
        h += (bcFound ? '✅' : '⚠️') + ' <strong>' + bcFlag + ' ' + bca.vendorCode + '</strong>';
        h += bcFound ? ' — ' + bcLines + ' lignes' : ' — non importé (fichier manquant ?)';
        h += '</div>';
      }
      h += '</div>';
    }
  }
  // v3.6.8 — Afficher les POs POItemExport déjà chargés (_poItemExportCount hoisted en haut de section)
  const _poItemExportDate  = _poItemExportCount > 0
    ? (c.pos||[]).filter(function(p){ return p.source === 'POItemExport'; })
        .sort(function(a,b){ return (b.importedAt||'').localeCompare(a.importedAt||''); })[0]?.importedAt
    : null;
  const _poItemExportDateStr = _poItemExportDate ? new Date(_poItemExportDate).toLocaleDateString('fr-FR') : null;
  // v3.6.8c — Lignes brutes vs uniques (disambiguation 5851 vs 5569)
  const _poRawLines    = c.poItemExportRawLines || 0;
  const _poDuplicates  = (_poRawLines > _poItemExportCount) ? (_poRawLines - _poItemExportCount) : 0;

  if (_poItemExportCount > 0) {
    var _poRawDetail = (_poRawLines > 0 && _poDuplicates > 0)
      ? '<span style="font-size:10px;color:var(--tx3);display:block;margin-top:2px">'
        + _poRawLines.toLocaleString('fr-FR') + ' lignes brutes — ' + _poDuplicates.toLocaleString('fr-FR') + ' doublons fusionnés</span>'
      : '';
    h += '<div style="padding:8px 12px;background:var(--g-bg);border:1px solid var(--g-bd);border-radius:var(--rd);margin-bottom:8px;font-size:12px">'
      + '✅ <strong>' + _poItemExportCount.toLocaleString('fr-FR') + ' POs uniques</strong> — dernier import : ' + (_poItemExportDateStr||'—')
      + _poRawDetail
      + '</div>';
  }

  h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
  h += '<label class="btn btn-sm" style="cursor:pointer">📁 ' + (posLoaded?'Recharger les POs (ancien format)':'Charger les POs (XLS/CSV)') + '<input type="file" accept=".xls,.xlsx,.csv,.txt" multiple onchange="handlePOFile(this)" style="display:none"/></label>';
  // v3.6.8 — Bouton import POItemExport CSV (nouveau format enrichi)
  h += '<label class="btn btn-sm btn-p" style="cursor:pointer" title="Import depuis VC → Commandes → Gestion des commandes → Export CSV">📥 POItemExport CSV<input type="file" accept=".csv,.txt" multiple onchange="handlePOItemExportFile(this)" style="display:none"/></label>';
  h += '<a href="' + getVCLink('pos',_poMkt) + '" target="_blank" class="btn btn-sm" style="text-decoration:none">↗ Ouvrir dans Vendor Central</a>'
  if (posLoaded) {
    h += '<button class="btn btn-xs" onclick="exportPOsXlsx()" style="margin-left:4px">⬇ XLSX</button>';
    h += '<button class="btn btn-xs" onclick="if(confirm(\'Supprimer tous les POs ?\')){deletePOs()}" style="margin-left:auto;color:var(--r);border-color:var(--r-bd)">🗑 Supprimer</button>';
  }
  h += '</div>';

  // v3.6.8 — Section Paramètres YoY (fenêtre PO + seuil anomalies)
  h += '<div style="margin-top:12px;padding:10px 12px;background:var(--b-bg,#e8f0fb);border:1px solid var(--b-bd,#b0c8f0);border-radius:var(--rd);font-size:12px">';
  h += '<div style="font-weight:600;margin-bottom:8px;color:var(--tx)">⚙ Paramètres YoY — Enquête</div>';
  h += '<div style="display:flex;gap:16px;flex-wrap:wrap">';
  h += '<div style="flex:1;min-width:160px"><label style="display:block;margin-bottom:3px;color:var(--tx2)">Fenêtre PO (mois)</label>'
    + '<input type="range" min="1" max="12" value="' + (c.enquetePeriodMonths||4) + '" '
    + 'oninput="this.nextElementSibling.textContent=this.value+\' mois\';updClient(\'enquetePeriodMonths\',+this.value)" style="width:100%">'
    + '<span style="font-size:11px;color:var(--tx3)">' + (c.enquetePeriodMonths||4) + ' mois</span></div>';
  h += '<div style="flex:1;min-width:160px"><label style="display:block;margin-bottom:3px;color:var(--tx2)">Seuil anomalies marques (%)</label>'
    + '<input type="range" min="50" max="100" value="' + (c.anomalyThreshold||80) + '" '
    + 'oninput="this.nextElementSibling.textContent=this.value+\'%\';updClient(\'anomalyThreshold\',+this.value)" style="width:100%">'
    + '<span style="font-size:11px;color:var(--tx3)">' + (c.anomalyThreshold||80) + '%</span></div>';
  h += '</div></div>';

  // v3.6.8 — Section Alias Marques
  var aliases = c.brandAliases || [];
  h += '<div style="margin-top:12px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
  h += '<span style="font-weight:600;font-size:12px">🏷 Alias Marques (' + aliases.length + ')</span>';
  h += '<button class="btn btn-xs" onclick="yoyAddAliasPrompt()">+ Alias</button>';
  h += '</div>';
  if (aliases.length > 0) {
    h += '<table class="yoy-table" style="font-size:11px"><thead><tr><th>Nom canonique</th><th>Variantes fusionnées</th><th></th></tr></thead><tbody>';
    aliases.forEach(function(al, idx) {
      h += '<tr><td><strong>' + esc(al.canonical||'') + '</strong></td>'
        + '<td style="color:var(--tx2)">' + esc((al.variants||[]).join(', ')) + '</td>'
        + '<td><button class="btn btn-xs" onclick="yoyDeleteAlias(' + idx + ')" style="color:var(--r)">✕</button></td></tr>';
    });
    h += '</tbody></table>';
  } else {
    h += '<div style="font-size:11px;color:var(--tx3);padding:6px 0">Aucun alias — les fusions de marques orthographiques seront proposées dans la Section Anomalies YoY.</div>';
  }
  h += '</div>';

  h += '</div>'; // ferme cd po-section-3

  // ══════════════════════════════════════════════════════
  // ÉTAPE 4 — PPM Nette
  // ══════════════════════════════════════════════════════
  const ppmCount  = Object.keys(c.ppmData || {}).length;
  const ppmLoaded = ppmCount > 0;
  // v3.6.8.9 SSOT : source de date unifiée via getEnrichedFreshness (même calcul que Agent Import)
  const _efImport  = getEnrichedFreshness(c);
  const lastPPMStr = _efImport.ppm.lastDate ? new Date(_efImport.ppm.lastDate).toLocaleDateString('fr-FR') : null;

  h += '<div class="cd">';
  h += '<div class="cd-t space"><span>4 — PPM Nette <span style="font-size:10px;font-weight:400;color:var(--tx3)">(optionnel — mise à jour mensuelle)</span></span>'
     + (ppmLoaded ? '<span class="pill pill-g">✓ Chargée</span>' : '<span class="pill pill-gr">Non chargée</span>') + '</div>';
  h += '<p style="font-size:12px;color:var(--tx2);margin-bottom:12px">Export depuis VC → Retail Analytics → PPM nette → Afficher par ASIN → CSV. Enrichit le score de potentiel et les appros.</p>';
  if (ppmLoaded) {
    h += '<div style="display:flex;gap:12px;margin-bottom:12px">';
    h += '<div style="padding:10px 14px;background:var(--g-bg);border:1px solid var(--g-bd);border-radius:var(--rdl);text-align:center;min-width:100px"><div style="font-size:18px">💰</div><div style="font-weight:700;font-size:15px">' + ppmCount + '</div><div style="font-size:10px;color:var(--tx3)">ASINs chargés</div></div>';
    h += '<div style="padding:10px 14px;background:var(--g-bg);border:1px solid var(--g-bd);border-radius:var(--rdl);text-align:center;min-width:100px"><div style="font-size:18px">📅</div><div style="font-weight:700;font-size:15px">' + (lastPPMStr||'—') + '</div><div style="font-size:10px;color:var(--tx3)">Dernier import</div></div>';
    h += '</div>';
  }
  h += '<div style="display:flex;gap:8px;align-items:center">';
  h += '<label class="btn btn-sm" style="cursor:pointer">📁 ' + (ppmLoaded ? 'Recharger la PPM' : 'Charger PPM Nette (CSV)') + '<input type="file" accept=".csv,.txt" onchange="handlePPMFile(this)" style="display:none"/></label>';
  h += '<a href="https://' + ({'':'',...{'.fr':'vendorcentral.amazon.fr','.de':'vendorcentral.amazon.de'}}[c.mainMarket||'.fr']||'vendorcentral.amazon.fr') + '/retail-analytics/dashboard/netppm" target="_blank" class="btn btn-sm" style="text-decoration:none">↗ Ouvrir dans VC</a>';
  if (ppmLoaded) h += '<button class="btn btn-xs" onclick="if(confirm(\'Supprimer la PPM ?\')){const c=cl();c.ppmData={};save();render()}" style="margin-left:auto;color:var(--r);border-color:var(--r-bd)">🗑</button>';
  h += '</div></div>';

  // ══════════════════════════════════════════════════════
  // ÉTAPE 5 — Prévisions Amazon
  // ══════════════════════════════════════════════════════
  const fcCount  = Object.keys(c.forecastData || {}).length;
  const fcLoaded = fcCount > 0;
  // v3.6.8.9 SSOT : source de date unifiée via getEnrichedFreshness (même calcul que Agent Import)
  const lastFCStr = _efImport.previsions.lastDate ? new Date(_efImport.previsions.lastDate).toLocaleDateString('fr-FR') : null;

  h += '<div class="cd">';
  h += '<div class="cd-t space"><span>5 — Prévisions Amazon <span style="font-size:10px;font-weight:400;color:var(--tx3)">(optionnel — 48 semaines glissantes)</span></span>'
     + (fcLoaded ? '<span class="pill pill-g">✓ Chargées</span>' : '<span class="pill pill-gr">Non chargées</span>') + '</div>';
  h += '<p style="font-size:12px;color:var(--tx2);margin-bottom:12px">Export depuis VC → Retail Analytics → Prévision → Afficher par ASIN → Tous ASINs → CSV. Améliore le calcul de réappro et le score de potentiel.</p>';
  if (fcLoaded) {
    h += '<div style="display:flex;gap:12px;margin-bottom:12px">';
    h += '<div style="padding:10px 14px;background:var(--g-bg);border:1px solid var(--g-bd);border-radius:var(--rdl);text-align:center;min-width:100px"><div style="font-size:18px">📊</div><div style="font-weight:700;font-size:15px">' + fcCount + '</div><div style="font-size:10px;color:var(--tx3)">ASINs chargés</div></div>';
    h += '<div style="padding:10px 14px;background:var(--g-bg);border:1px solid var(--g-bd);border-radius:var(--rdl);text-align:center;min-width:100px"><div style="font-size:18px">📅</div><div style="font-weight:700;font-size:15px">' + (lastFCStr||'—') + '</div><div style="font-size:10px;color:var(--tx3)">Dernier import</div></div>';
    h += '</div>';
  }
  h += '<div style="display:flex;gap:8px;align-items:center">';
  h += '<label class="btn btn-sm" style="cursor:pointer">📁 ' + (fcLoaded ? 'Recharger les prévisions' : 'Charger Prévisions (CSV)') + '<input type="file" accept=".csv,.txt" onchange="handleForecastFile(this)" style="display:none"/></label>';
  h += '<a href="https://' + ({'':'',...{'.fr':'vendorcentral.amazon.fr','.de':'vendorcentral.amazon.de'}}[c.mainMarket||'.fr']||'vendorcentral.amazon.fr') + '/retail-analytics/dashboard/forecast" target="_blank" class="btn btn-sm" style="text-decoration:none">↗ Ouvrir dans VC</a>';
  if (fcLoaded) h += '<button class="btn btn-xs" onclick="if(confirm(\'Supprimer les prévisions ?\')){const c=cl();c.forecastData={};save();render()}" style="margin-left:auto;color:var(--r);border-color:var(--r-bd)">🗑</button>';
  h += '</div></div>';

  // ── Historique des imports
  if (c.imports?.length) {
    h += `<div class="cd"><div class="cd-t">📋 Derniers imports</div>`;
    h += `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Période</th><th>Marché</th><th class="r">ASINs</th></tr></thead><tbody>`;
    c.imports.slice(-8).reverse().forEach(imp => {
      const tc = imp.type === 'ventes' ? 'g' : imp.type === 'trafic' ? 'b' : 'a';
      const ptLabel = imp.periodType === 'annual' ? 'annuel' : imp.periodType === 'ytd' ? 'YTD' : 'hebdo';
      h += `<tr><td>${new Date(imp.date).toLocaleDateString('fr-FR')}</td><td>${pillH(imp.type,tc)}</td><td style="font-size:10px">${pillH(ptLabel,'gr')} ${imp.periodStart||'—'} → ${imp.periodEnd||'—'}</td><td><strong>${imp.market}</strong></td><td class="r"><strong>${imp.rowCount}</strong></td></tr>`;
    });
    h += `</tbody></table></div></div>`;
  }

  if (c.csvImported && c.asins.length) {
    h += `<div class="alr alr-g" style="margin-top:4px">✓ <strong>${c.asins.length} ASINs</strong> en base · <button class="btn btn-p btn-sm" onclick="go('weekly')" style="margin-left:8px">🗓️ Revue Hebdo →</button></div>`;
  }

  // ══════════════════════════════════════════════════════════════════
  // SECTION BUY BOX — défauts livraison & rendez-vous (v3.6.0)
  // ══════════════════════════════════════════════════════════════════
  var ddCount = (c.deliveryDefects || []).length;
  var ddDate  = c.deliveryDefectsDate || '';
  var daCount = (c.deliveryAppointments || []).length;
  var daDate  = c.deliveryAppointmentsDate || '';

  h += '<div class="cd" style="margin-top:20px"><div class="cd-t">📦 Buy Box — défauts & rendez-vous</div>';
  h += '<div style="font-size:11px;color:var(--tx3);margin-bottom:10px;line-height:1.5">Imports liés au module Buy Box. Données réservées à l\'analyse interne (non affichées en dashboard pour l\'instant).</div>';

  // Sous-section A — Défauts livraison
  h += '<div style="margin-top:8px;padding:10px;background:var(--s2);border-radius:var(--rd)">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
  h += '<span style="font-size:13px;font-weight:600">⚠️ Défauts livraison</span>';
  if (ddCount > 0) {
    h += '<span style="font-size:11px;color:var(--tx2)">' + ddCount + ' défauts — MAJ ' + esc(ddDate) + '</span>';
  } else {
    h += '<span style="font-size:11px;color:var(--tx3)">Aucun import</span>';
  }
  h += '</div>';
  h += '<input type="file" id="bbDefectsFile" accept=".csv" style="display:none" onchange="importBuyBoxDefects(this.files[0])"/>';
  h += '<button class="btn btn-sm" onclick="document.getElementById(\'bbDefectsFile\').click()">📤 Importer un export "Delivery_*.csv"</button>';
  h += '<div style="font-size:10px;color:var(--tx3);margin-top:4px">Vendor Central → Performance → Delivery Defects → Export CSV (FR ou EN)</div>';
  h += '</div>';

  // Sous-section B — Rendez-vous
  h += '<div style="margin-top:8px;padding:10px;background:var(--s2);border-radius:var(--rd)">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
  h += '<span style="font-size:13px;font-weight:600">📅 Rendez-vous transporteur</span>';
  if (daCount > 0) {
    h += '<span style="font-size:11px;color:var(--tx2)">' + daCount + ' rendez-vous — MAJ ' + esc(daDate) + '</span>';
  } else {
    h += '<span style="font-size:11px;color:var(--tx3)">Aucun import</span>';
  }
  h += '</div>';
  h += '<input type="file" id="bbAppointmentsFile" accept=".csv" style="display:none" onchange="importBuyBoxAppointments(this.files[0])"/>';
  h += '<button class="btn btn-sm" onclick="document.getElementById(\'bbAppointmentsFile\').click()">📤 Importer un export "Rendez-vous_*.csv" ou "Appointment_*.csv"</button>';
  h += '<div style="font-size:10px;color:var(--tx3);margin-top:4px">Vendor Central → Logistique → Rendez-vous → Export CSV (FR : Rendez-vous_*.csv · EN : Appointment_*.csv)</div>';
  h += '</div>';

  h += '</div>';  // fin .cd Buy Box

  // ══════════════════════════════════════════════════════
  // ÉTAPE 4 — Données stock ERP (modèle Amazon Pilot)
  // ══════════════════════════════════════════════════════
  var erpCount = c.erpStockCount || 0;
  var erpLoaded = erpCount > 0;
  h += '<div class="cd">';
  h += '<div class="cd-t space">';
  h += '<span>4 — Données stock ERP <span style="font-size:10px;font-weight:400;color:var(--tx3)">(modèle Amazon Pilot)</span></span>';
  h += erpLoaded
    ? '<span class="pill pill-g">✓ ' + erpCount.toLocaleString('fr-FR') + ' références</span>'
    : '<span class="pill pill-gr">Non chargé</span>';
  h += '</div>';
  h += '<p style="font-size:12px;color:var(--tx2);margin-bottom:12px">Importez les stocks et arrivages ERP pour alimenter les modules Appros, Prévisionnel et Diagnostic CA. Téléchargez d\'abord le modèle, remplissez-le depuis votre ERP, puis importez-le ici.</p>';
  h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
  h += '<button class="btn btn-sm" onclick="downloadERPTemplate()">\u{1F4E5} Télécharger le modèle (.xlsx)</button>';
  h += '<label class="btn btn-sm" style="cursor:pointer">\u{1F4E4} ' + (erpLoaded ? 'Recharger les stocks ERP' : 'Importer les stocks ERP (.xlsx)') + '<input type="file" accept=".xlsx" style="display:none" onchange="handleERPImport(this.files)"/></label>';
  h += '</div>';
  h += '<div id="erp-import-preview" style="margin-top:10px"></div>';
  h += '</div>';

  h += `</div>`;
  return h;
}

// ══════════════════════════════════════════════════════════════════
// MODULE BUY BOX — Surveillance & Plan d'action
// ══════════════════════════════════════════════════════════════════

// @buybox


function renderWeeklyReview() {
  const c = cl();
  if (!c) return renderWelcome();
  if (!c.asins?.length) return `<div class="alr alr-a">Importez d'abord des données CSV pour lancer la revue hebdomadaire.</div>`;

  const asins = getFilteredAsins(c);
  const totalCA = asins.reduce((s, a) => s + (getRevenue(a,c)||0), 0);
  const totalUnits = asins.reduce((s, a) => s + (getUnits(a,c)||0), 0);
  const totalGV = asins.reduce((s, a) => s + (a.glanceViews || 0), 0);
  // Delta CA : comparer uniquement les ASINs Fabrication (sourcingOnly exclus) pour éviter
  // un faux delta lors de l'activation initiale de la fusion Approvisionnement
  const caFabOnly = asins.filter(a=>!a.sourcingOnly).reduce((s,a)=>s+(getRevenue(a,c)||0),0);
  const prevH = c.history?.weekly?.slice(-2)?.[0];
  const caDelta = prevH && prevH.totalCA ? ((caFabOnly - prevH.totalCA) / prevH.totalCA * 100).toFixed(1) : null;
  const declining = asins.filter(a => (getRevenue(a,c)||0) > 0 && parseNum(a.revenueDelta) < -10);
  const lowStock = asins.filter(a => a.sellableUnits > 0 && a.sellableUnits < 30 && (getRevenue(a,c)||0) > 50);
  const growing = asins.filter(a => (getRevenue(a,c)||0) > 50 && parseNum(a.revenueDelta) > 20);

  // ── Section Buy Box dans la Revue Hebdo ──────────────────────
  const { critical: bbCritical, warning: bbWarning, suppressed: bbSuppressed } = calcBuyBoxAlerts(c);
  const bbTotal = bbCritical.length + bbWarning.length + bbSuppressed.length;

  if (!c.weeklyActions?.length) { c.weeklyActions = generateWeeklyActions(c); save(); }

  // Période couverte par les données
  const weeklyImport = c.imports?.filter(i=>i.type==='ventes'&&(i.periodType==='weekly'||!i.periodType)).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  const weeklyPeriodStr = weeklyImport ? weeklyImport.periodStart + ' → ' + weeklyImport.periodEnd : null;

  const away = isAway(c);
  const awayUntilDate = c.awayUntil ? new Date(c.awayUntil) : null;
  const awayLabel = awayUntilDate ? awayUntilDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';

  let h = '';
  h += `<div class="week-header">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <h2>🗓️ Revue Hebdomadaire — ${esc(c.name)}</h2>
        <p style="display:flex;align-items:center;gap:12px">
          <span>${getCurrentWeek()}</span>
          ${weeklyPeriodStr ? `<span style="opacity:.7;font-size:11px;background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:20px">📅 Données : ${weeklyPeriodStr}</span>` : ''}
          ${away ? `<span style="font-size:11px;background:rgba(59,130,246,0.25);color:#93C5FD;padding:2px 10px;border-radius:20px">🏖️ Congés jusqu'au ${awayLabel}</span>` : ''}
        </p>
      </div>
      ${away
        ? `<button onclick="clearAway()" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:8px;padding:6px 12px;font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0">✓ Retour de congés</button>`
        : `<button onclick="setAway()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);border-radius:8px;padding:6px 12px;font-size:11px;cursor:pointer;white-space:nowrap;flex-shrink:0">🏖️ Partir en congés</button>`
      }
    </div>
    <div class="week-kpis">
      <div class="week-kpi">
        <div class="week-kpi-label">CA Commandé</div>
        <div class="week-kpi-value">${fmtEur(totalCA)}</div>
        ${caDelta ? `<div class="week-kpi-delta ${parseFloat(caDelta)>=0?'up':'down'}">${parseFloat(caDelta)>=0?'▲':'▼'} ${caDelta}% vs sem. préc.</div>` : ''}
      </div>
      <div class="week-kpi"><div class="week-kpi-label">Unités</div><div class="week-kpi-value">${fmt(totalUnits)}</div></div>
      <div class="week-kpi"><div class="week-kpi-label">Glance Views</div><div class="week-kpi-value">${fmt(totalGV)}</div></div>
      <div class="week-kpi"><div class="week-kpi-label">ASINs Actifs</div><div class="week-kpi-value">${asins.filter(a=>(getRevenue(a,c)||0)>0).length}</div></div>
    </div>
  </div>`;

  // v3.6.7 — Pavé éveil 80/20 longue traîne (CTA 12)
  h += typeof renderEveil8020Block === 'function' ? renderEveil8020Block(c) : '';

  // ── Bannière congés active ──
  if (away) {
    const retourDate = awayUntilDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    h += `<div style="display:flex;align-items:center;gap:14px;padding:16px 20px;background:linear-gradient(135deg,#1e3a5f,#1B2235);border:1px solid rgba(59,130,246,0.3);border-radius:var(--rdl);margin-bottom:14px">
      <span style="font-size:28px">🏖️</span>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px;color:#93C5FD">En congés — alertes suspendues</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:3px">Retour prévu le ${retourDate}. Les données et l'historique restent disponibles.</div>
      </div>
      <button onclick="clearAway()" style="background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.4);color:#93C5FD;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;white-space:nowrap">✓ Je suis de retour</button>
    </div>`;
  }

  h += `<div class="cd">`;
  h += `<div class="cd-t space"><span>🚨 Alertes Critiques</span><span style="font-size:11px;font-weight:400;color:var(--tx3)">${away ? 'Suspendues pendant les congés' : 'Cliquez pour voir les ASINs concernés'}</span></div>`;
  if (away) {
    h += `<div class="alr alr-b" style="margin-bottom:0">Les alertes reprennent automatiquement à votre retour. L'historique continue à se construire normalement.</div>`;
  } else if (!declining.length && !lowStock.length && !growing.length) {
    h += `<div class="alr alr-g" style="margin-bottom:0">✓ Aucune alerte critique cette semaine. Bonne continuation !</div>`;
  } else {
    h += `<div style="display:flex;flex-direction:column;gap:8px">`;
    if (lowStock.length) {
      h += `<button class="alert-row chip-r" onclick="goFilteredAsins('lowstock')">
        <div style="display:flex;align-items:center;gap:12px;flex:1">
          <span style="font-size:20px;flex-shrink:0">🔴</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">${lowStock.length} rupture${lowStock.length>1?'s':''} imminente${lowStock.length>1?'s':''}</div>
            <div style="font-size:11px;opacity:.8;margin-top:2px">Stock &lt; 30 unités sur des produits actifs</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:11px;font-weight:600">Voir les ASINs →</div>
            <div style="font-size:10px;opacity:.7;margin-top:2px">${lowStock.slice(0,3).map(a=>shortName(a).slice(0,18)).join(', ')}${lowStock.length>3?' +'+( lowStock.length-3):''}</div>
          </div>
        </div>
      </button>`;
    }
    if (declining.length) {
      const topDecline = declining.sort((a,b) => parseNum(a.revenueDelta)-parseNum(b.revenueDelta));
      const totalLost = topDecline.reduce((s,a) => s + Math.abs(parseNum(a.revenueDelta)/100*(getRevenue(a,c)||0)), 0);
      h += `<button class="alert-row chip-a" onclick="goFilteredAsins('declining')">
        <div style="display:flex;align-items:center;gap:12px;flex:1">
          <span style="font-size:20px;flex-shrink:0">🟡</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">${declining.length} ASIN${declining.length>1?'s':''} en baisse</div>
            <div style="font-size:11px;opacity:.8;margin-top:2px">CA en recul de plus de 10% · Impact estimé : -${fmtEur(totalLost)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:11px;font-weight:600">Voir les ASINs →</div>
            <div style="font-size:10px;opacity:.7;margin-top:2px">${topDecline.slice(0,3).map(a=>shortName(a).slice(0,18)).join(', ')}${declining.length>3?' +'+( declining.length-3):''}</div>
          </div>
        </div>
      </button>`;
    }
    if (growing.length) {
      const topGrow = growing.sort((a,b) => parseNum(b.revenueDelta)-parseNum(a.revenueDelta));
      const totalGain = topGrow.reduce((s,a) => s + Math.abs(parseNum(a.revenueDelta)/100*(getRevenue(a,c)||0)), 0);
      h += `<button class="alert-row chip-g" onclick="goFilteredAsins('growing')">
        <div style="display:flex;align-items:center;gap:12px;flex:1">
          <span style="font-size:20px;flex-shrink:0">🟢</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">${growing.length} opportunité${growing.length>1?'s':''} en croissance</div>
            <div style="font-size:11px;opacity:.8;margin-top:2px">ASINs en hausse &gt;20% · Gain potentiel : +${fmtEur(totalGain)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:11px;font-weight:600">Voir les ASINs →</div>
            <div style="font-size:10px;opacity:.7;margin-top:2px">${topGrow.slice(0,3).map(a=>shortName(a).slice(0,18)).join(', ')}${growing.length>3?' +'+( growing.length-3):''}</div>
          </div>
        </div>
      </button>`;
    }
    h += `</div>`;
  }
  h += `</div>`;

  // ── Routine mensuelle — affichée en début de mois (semaine 1-7) ──
  const todayDay = new Date().getDate();
  const isFirstWeekOfMonth = todayDay <= 7;
  if (isFirstWeekOfMonth) {
    if (!c.monthlyActions?.length) {
      c.monthlyActions = generateMonthlyActions(c);
      save();
    }
    const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    h += `<div class="cd" style="border:1px solid var(--or-border);background:var(--or-l)">`;
    h += `<div class="cd-t space">
      <span>📅 Routine Mensuelle — ${monthLabel}</span>
      <button class="btn btn-sm" onclick="c_monthlyActions=generateMonthlyActions(cl());save();render()">🔄</button>
    </div>`;
    // ── Section Buy Box dans la Revue Hebdo ─────────────────────────────────
  if (bbTotal > 0) {
    h += `<div class="cd" style="margin-bottom:16px;border-left:3px solid ${bbSuppressed.length ? 'var(--r)' : bbCritical.length ? 'var(--r)' : 'var(--or)'}">
      <div class="cd-t space">
        <span>🏆 Buy Box — ${bbTotal} ASIN${bbTotal>1?'s':''} à surveiller</span>
        <button class="btn btn-sm btn-p" onclick="go('buybox')">Voir le détail →</button>
      </div>`;
    if (bbSuppressed.length) {
      h += `<div class="alr alr-r" style="margin-bottom:8px;font-size:12px">
        💀 <b>${bbSuppressed.length} fiche${bbSuppressed.length>1?'s':''} à risque de suppression</b> (Retail% = 0% depuis ≥2 semaines) :
        ${bbSuppressed.slice(0,3).map(e => `<b>${e.asin}</b>`).join(', ')}${bbSuppressed.length>3?' …':''}
      </div>`;
    }
    if (bbCritical.length) {
      const critWithStockUrgent = bbCritical.filter(e => e.stockUrgent);
      h += `<div class="alr alr-r" style="margin-bottom:8px;font-size:12px">
        🔴 <b>${bbCritical.length} Buy Box critique${bbCritical.length>1?'s':''}</b> (Retail% &lt; 80%) :
        ${bbCritical.slice(0,3).map(e => `${esc((e.title||e.asin).slice(0,30))} → <b>${e.rPct.toFixed(0)}%</b>`).join(' · ')}${bbCritical.length>3?' …':''}
        ${critWithStockUrgent.length ? `<br>⚠️ <b>${critWithStockUrgent.length} ASIN${critWithStockUrgent.length>1?'s':''} avec Buy Box perdue ET stock critique</b> — double urgence Appros + Buy Box` : ''}
      </div>`;
    }
    if (bbWarning.length) {
      h += `<div class="alr alr-a" style="font-size:12px">
        🟡 <b>${bbWarning.length} ASIN${bbWarning.length>1?'s':''} en baisse</b> (Retail% en recul vs S-1) :
        ${bbWarning.slice(0,3).map(e => `${esc((e.title||e.asin).slice(0,25))} (${e.delta!==null?(e.delta>0?'+':'')+e.delta.toFixed(0)+'pts':'—'})`).join(' · ')}${bbWarning.length>3?' …':''}
      </div>`;
    }
    h += `</div>`;
  }

  h += `<div class="action-list">`;
    ['Lundi', 'Mercredi', 'Vendredi'].forEach(day => {
      const dayActs = c.monthlyActions.filter(a => a.day === day);
      if (dayActs.length) {
        h += `<div class="action-day-label" style="color:var(--or)">${day}</div>`;
        dayActs.forEach(act => {
          h += `<div class="action-item${act.done?' done':''}" style="border-color:var(--or-border)">
            <div class="action-check${act.done?' checked':''}" onclick="toggleMonthlyAction('${act.id}')">${act.done?'✓':''}</div>
            <div class="action-content">
              <div class="action-title">${esc(act.title)}</div>
              <div class="action-meta">${esc(act.description)}</div>
            </div>
            <span class="action-priority ${act.priority}">${act.priority==='high'?'🔴 Urgent':act.priority==='medium'?'🟡 Moyen':'🟢 Normal'}</span>
          </div>`;
        });
      }
    });
    h += `</div></div>`;
  }

  // ── Routine Hebdomadaire ───────────────────────────────────────
  h += `<div class="cd"><div class="cd-t space"><span>📋 Plan d'Action Semaine</span>
    <div style="display:flex;gap:6px">
      <button class="btn btn-sm" onclick="addManualAction()" title="Ajouter une action">+ Action</button>
      <button class="btn btn-sm" onclick="regenerateActions()">🔄 Régénérer</button>
    </div>
  </div>`;
  h += `<div class="action-list">`;
  ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].forEach(day => {
    const dayActs = c.weeklyActions.filter(a => a.day === day);
    if (dayActs.length) {
      h += `<div class="action-day-label">${day}</div>`;
      dayActs.forEach(act => {
        const typeColors = {
          stock:'var(--r)', buybox:'var(--r)', analysis:'var(--a)',
          seo:'var(--b)', opportunity:'var(--g)', content:'var(--b)',
          audit:'var(--tx2)', report:'var(--tx3)'
        };
        const typeColor = typeColors[act.type] || 'var(--tx3)';
        h += `<div class="action-item${act.done ? ' done' : ''}">
          <div class="action-check${act.done ? ' checked' : ''}" onclick="toggleAction('${act.id}')">${act.done ? '✓' : ''}</div>
          <div class="action-content">
            <div class="action-title">${esc(act.title)}</div>
            <div class="action-meta">${esc(act.description)}</div>
          </div>
          <span class="action-priority ${act.priority}">${act.priority==='high'?'🔴 Urgent':act.priority==='medium'?'🟡 Moyen':'🟢 Normal'}</span>
        </div>`;
      });
    }
  });
  h += `</div></div>`;

  h += `<div class="cd"><div class="cd-t">🤖 Analyse IA</div>`;
  h += `<div style="display:flex;gap:8px;flex-wrap:wrap">`;
  h += `<button class="btn btn-p" onclick="runAI('weekly')" ${aiLoading?'disabled':''}>${aiLoading?'<span class="spin">⏳</span> Analyse...':'▶ Diagnostic complet'}</button>`;
  h += `<button class="btn btn-b" onclick="runAI('opportunities')">💡 Opportunités</button>`;
  h += `<button class="btn btn-r" onclick="runAI('risks')">⚠️ Risques</button>`;
  h += `</div>`;
  if (aiResult) {
    if (isAIError(aiResult)) {
      h += renderAIError(aiResult, "runAI('weekly')");
    } else {
      h += `<div class="ai-out">${renderMarkdown(aiResult)}</div><button class="btn" style="margin-top:10px" onclick="copyAI()">📋 Copier</button>`;
    }
  }
  h += `</div>`;
  return h;
}
function _dwParseDate(s) {
  if (!s) return 0;
  if (s.indexOf('/') > -1) { const p = s.split('/'); return new Date(p[2], p[1]-1, p[0]); }
  return new Date(s);
}

function buildWeeklyConsolidated(asins, c, nbWeeks, market) {
  const pref = c?.kpiPrimaireCA || 'ordered';
  const mkt = market || c?.mainMarket || '.fr';
  const byWeek = {};
  asins.forEach(function(a) {
    if ((a.market || '.fr') !== mkt) return;
    (a.history || []).forEach(function(h) {
      const key = h.periodStart || h.period;
      if (!key) return;
      if (!byWeek[key]) byWeek[key] = { key: key, ca: 0, units: 0, gv: 0, stock: 0, n: 0 };
      byWeek[key].ca    += a.sourcingOnly ? 0 : (h.revenue || 0);
      byWeek[key].units += a.sourcingOnly ? 0 : (h.units || 0);
      byWeek[key].gv    += h.glanceViews || 0;
      byWeek[key].stock += h.sellableUnits || 0;
      byWeek[key].n++;
    });
  });
  return Object.values(byWeek).sort(function(a,b){ return _dwParseDate(a.key)-_dwParseDate(b.key); }).slice(-nbWeeks);
}

function buildMonthlyConsolidated(asins, c, nbMonths, market) {
  const weeks = buildWeeklyConsolidated(asins, c, 260, market);
  const byMonth = {};
  weeks.forEach(function(w) {
    const d = _dwParseDate(w.key);
    if (!d || isNaN(d)) return;
    const mKey = ('0'+(d.getMonth()+1)).slice(-2) + '/' + d.getFullYear();
    if (!byMonth[mKey]) byMonth[mKey] = { key: mKey, ca: 0, units: 0, gv: 0, stock: 0, n: 0 };
    byMonth[mKey].ca    += w.ca;
    byMonth[mKey].units += w.units;
    byMonth[mKey].gv    += w.gv;
    byMonth[mKey].stock  = Math.max(byMonth[mKey].stock, w.stock);
    byMonth[mKey].n++;
  });
  return Object.values(byMonth).sort(function(a,b){
    const pa = a.key.split('/'); const pb = b.key.split('/');
    return (new Date(pa[1],pa[0]-1) - new Date(pb[1],pb[0]-1));
  }).slice(-nbMonths);
}

function buildN1Series(c, weeks, market) {
  const n1Year = String(new Date().getFullYear() - 1);
  const mkt = market || c?.mainMarket || '.fr';
  const n1Map = {};
  (c.asins || []).forEach(function(a) {
    if ((a.market || '.fr') !== mkt) return;
    (a.history || []).forEach(function(h) {
      const key = h.periodStart || h.period;
      if (!key) return;
      let year;
      if (key.indexOf('/') > -1) { year = key.split('/')[2]; }
      else if (key.length >= 4) { year = key.slice(0, 4); }
      if (year !== n1Year) return;
      if (!n1Map[key]) n1Map[key] = 0;
      n1Map[key] += (h.orderedRevenue || h.revenue || 0);
    });
  });
  if (Object.keys(n1Map).length < 4) return null;
  return weeks.map(function(w) {
    const d = (w.key || '').split('/');
    if (d.length < 3) return null;
    const n1Key = d[0] + '/' + d[1] + '/' + n1Year;
    return n1Map[n1Key] || null;
  });
}

function buildDashWeeklyChartConfig(periods, c, isMonthly) {
  const n1 = isMonthly ? null : buildN1Series(c, periods, dashWeeklyActiveMkt || c?.mainMarket || '.fr');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const tickColor = isDark ? '#aaa' : '#666';
  const datasets = [
    {
      type: 'bar',
      label: c?.kpiPrimaireCA === 'shipped' ? 'CA Expédié (€)' : 'CA Commandé (€)',
      data: periods.map(function(w) { return w.ca; }),
      backgroundColor: 'rgba(255,153,0,0.7)',
      yAxisID: 'yCA', order: 3
    },
    {
      type: 'line', label: 'Glance Views',
      data: periods.map(function(w) { return w.gv; }),
      borderColor: '#3b82f6', backgroundColor: 'transparent',
      tension: 0.3, pointRadius: 2, yAxisID: 'yGV', order: 1
    },
    {
      type: 'line', label: 'Stock (unités)',
      data: periods.map(function(w) { return w.stock; }),
      borderColor: '#10b981', backgroundColor: 'transparent',
      tension: 0.3, pointRadius: 2, yAxisID: 'yGV', order: 2
    }
  ];
  if (n1) {
    datasets.push({
      type: 'line', label: 'CA N-1',
      data: n1,
      borderColor: 'rgba(150,150,150,0.5)', borderDash: [4,4],
      backgroundColor: 'transparent', pointRadius: 0, yAxisID: 'yCA', order: 4
    });
  }
  return {
    type: 'bar',
    data: {
      labels: periods.map(function(w) { return (w.key||'').slice(0,5); }),
      datasets: datasets
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        yCA: { type:'linear', position:'left',  grid:{color:'rgba(128,128,128,0.1)'}, ticks:{color:tickColor, callback:function(v){return Math.round(v/1000)+'k€';}} },
        yGV: { type:'linear', position:'right', grid:{drawOnChartArea:false}, ticks:{color:'#888', callback:function(v){return Math.round(v/1000)+'k';}} },
        x:   { ticks:{color:tickColor, maxTicksLimit:14}, grid:{color:'rgba(128,128,128,0.1)'} }
      },
      plugins: {
        legend: { position:'top', labels:{font:{size:11},color:tickColor} },
        tooltip: { callbacks: { label: function(ctx) {
          if (ctx.dataset.yAxisID==='yCA') return ctx.dataset.label+': '+fmtEur(ctx.parsed.y);
          return ctx.dataset.label+': '+fmt(ctx.parsed.y);
        }}}
      }
    }
  };
}

function initDashWeeklyChart() {
  const canvas = document.getElementById('dash-weekly-chart');
  if (!canvas) return;
  const c = cl();
  if (!c) return;
  if (!dashWeeklyActiveMkt) dashWeeklyActiveMkt = c.mainMarket || '.fr';
  const isMonthly = dashWeeklyView === 'mois';
  const allAsins = getFilteredAsins(c);
  const periods = isMonthly
    ? buildMonthlyConsolidated(allAsins, c, 24, dashWeeklyActiveMkt)
    : buildWeeklyConsolidated(allAsins, c, 52, dashWeeklyActiveMkt);
  if (periods.length < 2) return;
  const chartH = dashWeeklyView === 'semaines'
    ? Math.min(260, Math.max(120, periods.length * 6))
    : Math.min(260, Math.max(120, periods.length * 22));
  if (canvas.parentElement) canvas.parentElement.style.height = chartH + 'px';
  if (dashWeeklyChartInst) { dashWeeklyChartInst.destroy(); dashWeeklyChartInst = null; }
  dashWeeklyChartInst = new Chart(canvas.getContext('2d'), buildDashWeeklyChartConfig(periods, c, isMonthly));

  // KPIs synthétiques
  const kpiEl = document.getElementById('dash-weekly-kpis');
  if (!kpiEl) return;
  const total = periods.reduce(function(s,w){ return s+w.ca; }, 0);
  const avg = Math.round(total / periods.length);
  const half = Math.floor(periods.length / 2);
  const s1avg = half > 0 ? periods.slice(0, half).reduce(function(s,w){return s+w.ca;},0)/half : 0;
  const s2avg = half > 0 ? periods.slice(half).reduce(function(s,w){return s+w.ca;},0)/(periods.length-half) : 0;
  const trend = s1avg > 0 ? Math.round((s2avg-s1avg)/s1avg*100) : 0;
  const trendStr = trend > 0 ? '+'+trend+'%' : trend+'%';
  const trendColor = trend > 0 ? 'var(--g)' : trend < 0 ? 'var(--a-r)' : 'var(--tx3)';
  const n1arr = isMonthly ? null : buildN1Series(c, periods, dashWeeklyActiveMkt);
  const n1total = n1arr ? n1arr.reduce(function(s,v){return s+(v||0);},0) : 0;
  const n1pct = n1total > 0 ? Math.round((total-n1total)/n1total*100) : null;
  const n1str = n1pct !== null ? (n1pct>0?'+':'')+n1pct+'% vs N-1' : 'N-1 indisponible';
  const n1color = n1pct !== null ? (n1pct>0?'var(--g)':n1pct<0?'var(--a-r)':'var(--tx3)') : 'var(--tx3)';
  kpiEl.innerHTML = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;font-size:11px;">'
    +'<span style="background:var(--s2);border-radius:6px;padding:4px 10px"><b>Moy. '+( isMonthly?'mensuelle':'hebdo' )+'</b> '+fmtEur(avg)+'</span>'
    +'<span style="background:var(--s2);border-radius:6px;padding:4px 10px"><b>Tendance</b> <span style="color:'+trendColor+'">'+trendStr+'</span></span>'
    +'<span style="background:var(--s2);border-radius:6px;padding:4px 10px"><b>Périodes</b> '+periods.length+'</span>'
    +'<span style="background:var(--s2);border-radius:6px;padding:4px 10px;color:'+n1color+'">'+n1str+'</span>'
    +'</div>';
}

// ── Onglets marchés ─────────────────────────────────────────────────────────
function getMarketTabs(c) {
  var tabs = {};
  for (var i = 0; i < c.asins.length; i++) {
    var a = c.asins[i];
    var m = a.market || '.fr';
    if (!tabs[m]) tabs[m] = { market: m, revenue: 0, count: 0 };
    tabs[m].revenue += (a.orderedRevenue || a.revenue || 0);
    tabs[m].count++;
  }
  var totalRev = 0, totalCount = 0;
  for (var k in tabs) { if (tabs.hasOwnProperty(k)) { totalRev += tabs[k].revenue; totalCount += tabs[k].count; } }
  var sorted = [];
  for (var k2 in tabs) { if (tabs.hasOwnProperty(k2)) sorted.push(tabs[k2]); }
  sorted.sort(function(a, b) { return b.revenue - a.revenue; });
  return { tabs: sorted, totalRev: totalRev, totalCount: totalCount };
}

function renderMarketTabs(c, activeMarket) {
  var data = getMarketTabs(c);
  if (data.tabs.length <= 1) return '';
  var h = '<div style="display:flex;gap:0;border-bottom:2px solid var(--bd);margin-bottom:12px;overflow-x:auto">';
  // Onglet "Tous"
  var isAll = (activeMarket === 'all');
  h += '<div onclick="setFilter(\'market\',\'all\')" style="padding:8px 14px;text-align:center;min-width:80px;cursor:pointer;'
    + (isAll ? 'border-bottom:2.5px solid var(--accent);margin-bottom:-2px' : 'margin-bottom:-2px') + '">';
  h += '<div style="font-size:12px;font-weight:600;color:' + (isAll ? 'var(--accent)' : 'var(--tx2)') + '">Tous</div>';
  h += '<div style="font-size:15px;font-weight:600;color:' + (isAll ? 'var(--accent)' : 'var(--tx)') + '">' + fmtEur(data.totalRev) + '</div>';
  h += '<div style="font-size:10px;color:var(--tx3)">' + data.totalCount + ' ASINs</div>';
  h += '</div>';
  // Onglets par marché
  for (var ti = 0; ti < data.tabs.length; ti++) {
    var t = data.tabs[ti];
    var mp = null;
    for (var mi = 0; mi < MARKETPLACES_FULL.length; mi++) {
      if (MARKETPLACES_FULL[mi].market === t.market) { mp = MARKETPLACES_FULL[mi]; break; }
    }
    var flag = mp ? mp.flag : t.market;
    var isActive = (activeMarket === t.market);
    var isSmall = (data.totalRev > 0 && t.revenue < data.totalRev * 0.01);
    h += '<div onclick="setFilter(\'market\',\'' + t.market + '\')" style="padding:8px 14px;text-align:center;min-width:70px;cursor:pointer;'
      + (isActive ? 'border-bottom:2.5px solid var(--accent);margin-bottom:-2px;' : 'margin-bottom:-2px;')
      + (isSmall && !isActive ? 'opacity:0.5;' : '') + '">';
    h += '<div style="font-size:16px">' + flag + '</div>';
    h += '<div style="font-size:13px;font-weight:600;color:' + (isActive ? 'var(--accent)' : 'var(--tx)') + '">' + fmtEur(t.revenue) + '</div>';
    h += '<div style="font-size:10px;color:var(--tx3)">' + t.count + ' ASINs</div>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function renderDashboard() {
  const c = cl();
  if (!c) return renderWelcome();
  let h = '';

  // Bannière données manquantes
  h += renderFreshnessBanner(c);

  // Bandeau avertissement mode Commandé + données Appro uniquement
  const lastVentesImport = c.imports?.filter(i => i.type === 'ventes' && (i.periodType === 'weekly' || !i.periodType)).sort((a,b) => new Date(b.date) - new Date(a.date))[0];
  const hasOrderedData = c.asins?.some(a => (a.orderedRevenue || 0) > 0);
  if ((c.kpiPrimaireCA || 'ordered') === 'ordered' && lastVentesImport?.distributorView === 'appro' && !hasOrderedData) {
    h += `<div class="alr alr-a">⚠ <strong>Données Commandé indisponibles :</strong> le dernier import ventes est en vue Appro — les colonnes "Commandé" ne sont pas renseignées. Passez en mode <button class="btn btn-sm" onclick="setKpiPrimaire('shipped')" style="margin-left:6px">Expédié</button> pour voir les revenus réels.</div>`;
  }

  if (!c.stockDeporte || c.btr !== 'Autorisé' || !c.threeP) {
    const csts = [];
    if (!c.stockDeporte) csts.push('Stock déporté interdit');
    if (c.btr === 'Conditionnel') csts.push('BTR conditionnel');
    if (c.btr === 'Interdit') csts.push('BTR interdit');
    if (!c.threeP) csts.push('3P interdit');
    h += `<div class="alr alr-a"><strong>Contraintes ${esc(c.name)} :</strong> ${csts.join(' · ')}</div>`;
  }

  if (!c.asins?.length) {
    return h + `<div class="cd" style="padding:48px;text-align:center">
      <div style="font-size:32px;margin-bottom:10px">📥</div>
      <p style="font-size:14px;font-weight:600;margin-bottom:4px">Pas encore de données</p>
      <p style="font-size:12px;color:var(--tx3);margin-bottom:16px">Importez vos fichiers CSV Vendor Central</p>
      <button class="btn btn-p" onclick="go('import')">Importer des données</button>
    </div>`;
  }

  const brands = [...new Set(c.asins.map(a => a.brand).filter(Boolean))].sort();
  const markets = [...new Set(c.asins.map(a => a.market).filter(Boolean))].sort();

  h += renderMarketTabs(c, filters.market);
  h += `<div class="filters">`;
  if (brands.length > 1) {
    h += `<div style="display:flex;align-items:center;gap:6px"><span class="filter-label">Marque</span>
      <select class="filter-select" onchange="setFilter('brand',this.value)">
        <option value="all"${filters.brand==='all'?' selected':''}>Toutes</option>
        ${brands.map(b => `<option value="${b}"${filters.brand===b?' selected':''}>${esc(b)}</option>`).join('')}
      </select></div>`;
  }
  h += `<div style="display:flex;align-items:center;gap:6px"><span class="filter-label">Segment</span>
    <select class="filter-select" onchange="setFilter('segment',this.value)">
      <option value="all"${filters.segment==='all'?' selected':''}>Tous</option>
      <option value="A"${filters.segment==='A'?' selected':''}>🥇 A</option>
      <option value="B"${filters.segment==='B'?' selected':''}>🥈 B</option>
      <option value="C"${filters.segment==='C'?' selected':''}>🥉 C</option>
    </select></div>`;
  if (filters.market !== 'all' || filters.brand !== 'all' || filters.segment !== 'all') {
    h += `<button class="btn btn-sm" onclick="resetFilters()">✕ Reset</button>`;
  }
  const kpiMode = c.kpiPrimaireCA || 'ordered';
  h += `<div style="display:flex;align-items:center;gap:6px;margin-left:auto">
    <span class="filter-label">CA</span>
    <button class="btn btn-sm${kpiMode !== 'shipped' ? ' btn-p' : ''}" onclick="setKpiPrimaire('ordered')">Commandé</button>
    <button class="btn btn-sm${kpiMode === 'shipped' ? ' btn-p' : ''}" onclick="setKpiPrimaire('shipped')">Expédié</button>
  </div>`;
  h += `</div>`;

  const asins = getFilteredAsins(c);
  // Consolidation multi-marchés quand filtre = "Tous"
  var dashAsins = (filters.market === 'all' && c.markets && c.markets.length > 1) ? consolidateAsins(asins, c) : asins;

  const totalCA = dashAsins.reduce((s, a) => s + (getRevenue(a,c)||0), 0);
  const totalUnits = dashAsins.reduce((s, a) => s + (getUnits(a,c)||0), 0);
  const totalGV = dashAsins.reduce((s, a) => s + (a.glanceViews || 0), 0);
  const totalStock = dashAsins.reduce((s, a) => s + (a.sellableUnits || 0), 0);
  const lowStockN = dashAsins.filter(a => a.sellableUnits > 0 && a.sellableUnits < 50 && (getRevenue(a,c)||0) > 50).length;
  const declineN = dashAsins.filter(a => (getRevenue(a,c)||0) > 0 && parseNum(a.revenueDelta) < -10).length;

  // Période des données courantes
  const dashImport = c.imports?.filter(i=>i.type==='ventes'&&(i.periodType==='weekly'||!i.periodType)).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  const dashPeriod = dashImport ? dashImport.periodStart + ' → ' + dashImport.periodEnd : null;
  const dashPeriodTag = dashPeriod ? `<span style="font-size:10px;color:var(--or);font-weight:600;margin-top:3px;display:block">${dashPeriod}</span>` : '';

  h += `<div class="kpi-g">`;
  h += `<div class="kpi"><div class="kpi-lb">CA ${kpiMode === 'shipped' ? 'Expédié' : 'Commandé'}</div><div class="kpi-v">${fmtEur(totalCA)}</div>${dashPeriodTag}</div>`;
  h += `<div class="kpi"><div class="kpi-lb">Unités</div><div class="kpi-v">${fmt(totalUnits)}</div>${dashPeriodTag}</div>`;
  h += `<div class="kpi"><div class="kpi-lb">Glance Views</div><div class="kpi-v">${fmt(totalGV)}</div>${dashPeriodTag}</div>`;
  h += `<div class="kpi"><div class="kpi-lb">ASINs</div><div class="kpi-v">${dashAsins.length}</div></div>`;
  h += `<div class="kpi"><div class="kpi-lb">Stock</div><div class="kpi-v">${fmt(totalStock)}u</div>${dashPeriodTag}</div>`;
  h += `<div class="kpi${declineN>0?' al':''}"><div class="kpi-lb">CA en baisse</div><div class="kpi-v">${declineN}</div>${dashPeriodTag}</div>`;
  h += `<div class="kpi${lowStockN>0?' warn':''}"><div class="kpi-lb">Stock faible</div><div class="kpi-v">${lowStockN}</div></div>`;
  h += `</div>`;

  // v3.6.7 — Pavé éveil 80/20 longue traîne (CTA 12)
  h += typeof renderEveil8020Block === 'function' ? renderEveil8020Block(c) : '';

  if (!dashWeeklyActiveMkt) dashWeeklyActiveMkt = c.mainMarket || '.fr';
  const _dwMkts = c.markets && c.markets.length ? c.markets : [c.mainMarket || '.fr'];
  const _dwTestData = buildWeeklyConsolidated(asins, c, 52, dashWeeklyActiveMkt);
  if (_dwTestData.length >= 2) {
    const _dwLabel = dashWeeklyView === 'mois' ? '24 mois' : '52 semaines';
    h += `<div class="cd" style="margin-bottom:16px">
      <div class="cd-t space" style="flex-wrap:wrap;gap:8px">
        <span>📈 Tendance ${_dwLabel}</span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">`;
    if (_dwMkts.length > 1) {
      _dwMkts.forEach(function(mkt) {
        const ml = typeof MARKET_LANG !== 'undefined' && MARKET_LANG[mkt];
        const flag = ml ? ml.flag : mkt;
        const active = mkt === dashWeeklyActiveMkt;
        h += `<button class="btn btn-sm${active?' btn-p':''}" onclick="dashWeeklyActiveMkt='${mkt}';initDashWeeklyChart()" style="font-size:11px">${flag} ${mkt}</button>`;
      });
    }
    h += `<button class="btn btn-sm${dashWeeklyView==='semaines'?' btn-p':''}" onclick="dashWeeklyView='semaines';initDashWeeklyChart()" style="font-size:11px">Semaines</button>`;
    h += `<button class="btn btn-sm${dashWeeklyView==='mois'?' btn-p':''}" onclick="dashWeeklyView='mois';initDashWeeklyChart()" style="font-size:11px">Mois</button>`;
    h += `</div></div>
      <div style="position:relative;height:220px">
        <canvas id="dash-weekly-chart"></canvas>
      </div>
      <div id="dash-weekly-kpis"></div>
    </div>`;
  }

  h += `<div class="charts-grid">
    <div class="cd" style="margin-bottom:0"><div class="cd-t">📊 Top 10 par CA</div><div class="chart-container"><canvas id="top-chart"></canvas></div></div>
    <div class="cd" style="margin-bottom:0"><div class="cd-t">🥧 Répartition Segments</div><div class="chart-container"><canvas id="seg-chart"></canvas></div></div>
  </div>`;

  const searchActive = asinSearch && asinSearch.trim();
  const exportLabel = searchActive
    ? `⬇ Export (${dashAsins.length} sélectionnés)`
    : `⬇ Export CSV`;
  h += `<div class="cd"><div class="cd-t space">
    <span>📦 ASINs ${searchActive ? '<span style="color:var(--or);font-size:11px">— ' + dashAsins.length + ' résultat' + (dashAsins.length>1?'s':'') + ' pour \"' + esc(asinSearch) + '\"</span>' : '(' + dashAsins.length + ')'}</span>
    <button class="btn btn-sm" onclick="exportAsinsCsv()">${exportLabel} CSV</button><button class="btn btn-sm" onclick="exportAsinsXlsx()" style="margin-left:4px">⬇ XLSX</button>
  </div>`;
  // Période courante détectée
  const latestImport = c.imports?.filter(i=>i.periodType==='weekly'||!i.periodType).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  const periodInfo = latestImport ? `${latestImport.periodStart||''} → ${latestImport.periodEnd||''}` : null;

  h += `<div class="tbl-wrap"><table class="tbl"><thead><tr>
    <th style="width:44px">Score</th>
    <th>Produit ${periodInfo ? '<span style="font-weight:400;color:var(--tx3);font-size:9px;margin-left:6px">'+periodInfo+'</span>' : ''}</th>
    <th>Seg.</th>
    <th class="r">CA</th><th class="r">Δ</th><th>Tendance</th><th class="r">GV</th><th class="r">Stock</th><th></th>
  </tr></thead><tbody>`;

  dashAsins.sort((a,b) => (getRevenue(b,c)||0)-(getRevenue(a,c)||0)).slice(0, 50).forEach(a => {
    const health = calcHealth(a);
    const hCls = healthClass(health);
    const seg = calcSegment(a, totalCA, c);
    const isLow = a.sellableUnits > 0 && a.sellableUnits < 50;
    const isDec = (getRevenue(a,c)||0) > 0 && parseNum(a.revenueDelta) < -10;
    const rc = isDec ? 'al-row' : isLow ? 'warn-row' : '';
    var marketsFlags = '';
    if (a._consolidated && a.markets && a.markets.length > 1) {
      marketsFlags = ' <span style="font-size:10px;opacity:0.7">';
      for (var mi = 0; mi < a.markets.length; mi++) {
        var mpf = MARKETPLACES_FULL.find(function(x) { return x.market === a.markets[mi]; });
        if (mpf) marketsFlags += mpf.flag;
      }
      marketsFlags += '</span>';
    }
    h += `<tr class="${rc}">
      <td><div class="hs hs-sm ${hCls}">${health}</div></td>
      <td style="max-width:220px">
        <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(a.title)}">${esc(shortName(a))}${marketsFlags}</div>
        <div class="mono" style="font-size:10px;color:var(--tx3)">${a.asin}</div>
      </td>
      <td>${segBadge(seg)}</td>
      <td class="r" style="font-weight:600">${fmtEur(getRevenue(a,c)||0)}</td>
      <td class="r">${deltaBadge(a.revenueDelta)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:5px">
          ${(() => { const t = calcTrend(a); return sparkline(t?.series, t?.cls) + trendBadge(t); })()}
        </div>
      </td>
      <td class="r">${fmt(a.glanceViews||0)}</td>
      <td class="r">${a.sellableUnits ? fmt(a.sellableUnits)+'u' : '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-xs" onclick="analyzeAsin('${esc(a.asin)}')" title="Analyser">📊</button>
        <button class="btn btn-xs btn-amazon" onclick="openAmazonProduct('${esc(a.asin)}','${a.market||'.fr'}')" title="Amazon">🔗</button>
      </td>
    </tr>`;
  });
  h += `</tbody></table></div>`;
  if (dashAsins.length > 50) h += `<p style="font-size:10px;color:var(--tx3);margin-top:6px">50 premiers sur ${dashAsins.length}</p>`;
  h += `</div>`;
  return h;
}

const CASE_TYPES = [
  { id: 'stock',      icon: '📦', label: 'Réapprovisionnement urgent',        color: 'var(--r)' },
  { id: 'buybox',     icon: '🏆', label: 'Perte Buy Box',                     color: 'var(--a)' },
  { id: 'suppress',   icon: '🚫', label: 'Suppression / Désactivation',       color: 'var(--r)' },
  { id: 'content',    icon: '✏️',  label: 'Correction fiche produit',          color: 'var(--b)' },
  { id: 'catalogue',  icon: '📝', label: "Modifier les détails de l'article", color: 'var(--b)' },
  { id: 'detail_page',icon: '🛒', label: "Problèmes page détaillée",           color: 'var(--p)' },
  { id: 'pricing',    icon: '💰', label: 'Problème tarifaire',                 color: 'var(--p)' },
  { id: 'returns',    icon: '↩️',  label: 'Taux de retours anormal',           color: 'var(--a)' },
];

function buildCaseText(typeId, a, c) {
  const domain = ({ '.fr':'amazon.fr', '.de':'amazon.de', '.it':'amazon.it', '.es':'amazon.es', '.co.uk':'amazon.co.uk', '.nl':'amazon.nl' })[a.market||'.fr'] || 'amazon.fr';
  const productUrl = `https://www.${domain}/dp/${a.asin}`;
  const name = shortName(a);
  const brand = c.brand || c.name || '';
  const date = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

  const tpls = {
    stock: {
      where: 'Vendor Central > Aide > Contacter Amazon > Gestion des stocks / Approvisionnement',
      subject: `Réapprovisionnement urgent — ${a.asin} — ${name}`,
      body: `Bonjour,

Je vous contacte au sujet d'un problème de réapprovisionnement urgent pour le produit suivant :

• ASIN : ${a.asin}
• Produit : ${name}
• Marque : ${brand}
• Marché : ${domain}
• Lien produit : ${productUrl}

Situation actuelle :
- Stock vendable actuel : ${a.sellableUnits != null ? a.sellableUnits + ' unité(s)' : 'non renseigné'}
- Retail % : ${a.retailPct || 'non renseigné'}
- CA sur la période : ${getRevenue(a,c) ? Math.round(getRevenue(a,c)) + ' €' : 'non renseigné'}

Ce produit génère un CA significatif et le stock actuel ne couvre pas la demande prévisionnelle des prochains jours. Une rupture imminente entraînerait une perte de Buy Box et une dégradation du classement organique difficile à récupérer.

Demande :
Pouvez-vous accélérer le traitement de notre bon de commande en attente et confirmer la date de livraison prévue en entrepôt Amazon ?

Merci de votre retour rapide.

Cordialement,
${c.contactOp || c.name}`
    },

    buybox: {
      where: 'Vendor Central > Aide > Contacter Amazon > Tarification / Buy Box',
      subject: `Perte Buy Box — ${a.asin} — ${name}`,
      body: `Bonjour,

Je vous contacte concernant une perte de Buy Box constatée sur le produit suivant :

• ASIN : ${a.asin}
• Produit : ${name}
• Marque : ${brand}
• Marché : ${domain}
• Lien produit : ${productUrl}

Situation observée :
- Retail % actuel : ${a.retailPct || 'faible / non renseigné'}
- Évolution CA : ${a.revenueDelta || 'en baisse'}
- Glance Views : ${a.glanceViews ? fmt(a.glanceViews) : 'non renseigné'} (${a.gvDelta || 'variation non renseignée'})

Nous constatons que la Buy Box n'est plus détenue par Amazon sur ce produit, ce qui impacte directement nos ventes et notre visibilité.

Demande :
1. Pouvez-vous identifier la cause de la perte de Buy Box sur cet ASIN ?
2. Y a-t-il des vendeurs tiers proposant ce produit à un prix inférieur ?
3. Quelles actions pouvons-nous mettre en place pour récupérer la Buy Box ?

Merci pour votre aide.

Cordialement,
${c.contactOp || c.name}`
    },

    suppress: {
      where: 'Vendor Central > Aide > Contacter Amazon > Catalogue / Suppression de produit',
      subject: `Suppression produit à corriger — ${a.asin} — ${name}`,
      body: `Bonjour,

Je vous contacte de toute urgence car le produit suivant semble avoir été supprimé ou désactivé sur la marketplace :

• ASIN : ${a.asin}
• Produit : ${name}
• Marque : ${brand}
• Marché : ${domain}
• Lien produit : ${productUrl}

Problème constaté le : ${date}

Symptômes observés :
- Le produit n'apparaît plus dans les résultats de recherche
- CA en chute brutale : ${a.revenueDelta || '-100%'}
- Glance Views effondrées : ${a.glanceViews ? fmt(a.glanceViews) : '0'}

Ce produit est une référence active de notre catalogue avec un historique de ventes établi. Il ne fait l'objet d'aucune non-conformité à notre connaissance.

Demande :
1. Pouvez-vous identifier la raison de cette suppression/désactivation ?
2. Quelle est la procédure pour réactiver ce produit dans les meilleurs délais ?
3. Y a-t-il une action requise de notre part ?

Ce produit représente un CA important pour notre activité et chaque jour d'indisponibilité nous cause un préjudice significatif.

Merci de traiter ce cas en priorité.

Cordialement,
${c.contactOp || c.name}`
    },

    content: {
      where: 'Vendor Central > Aide > Contacter Amazon > Catalogue / Mise à jour du contenu',
      subject: `Correction fiche produit — ${a.asin} — ${name}`,
      body: `Bonjour,

Je souhaite mettre à jour le contenu de la fiche produit suivante :

• ASIN : ${a.asin}
• Produit : ${name}
• Marque : ${brand}
• Marché : ${domain}
• Lien produit : ${productUrl}

[DÉCRIVEZ ICI LES MODIFICATIONS SOUHAITÉES]
Exemple :
- Titre actuel : [XXX] → Titre proposé : [YYY]
- Bullet point 1 à corriger : [XXX] → Correction : [YYY]
- Image principale à remplacer / Ajout d'images secondaires
- Description / A+ Content à mettre à jour

Justification :
Ces modifications visent à améliorer la pertinence du contenu, augmenter le taux de conversion et mieux répondre aux attentes des clients.

Fichiers joints : [LISTEZ LES FICHIERS SI APPLICABLE]

Merci de bien vouloir traiter cette demande.

Cordialement,
${c.contactOp || c.name}`
    },

    pricing: {
      where: 'Vendor Central > Aide > Contacter Amazon > Tarification',
      subject: `Problème tarifaire — ${a.asin} — ${name}`,
      body: `Bonjour,

Je vous contacte concernant un problème de tarification sur le produit suivant :

• ASIN : ${a.asin}
• Produit : ${name}
• Marque : ${brand}
• Marché : ${domain}
• Lien produit : ${productUrl}

Situation actuelle :
- Prix de vente constaté sur Amazon : [INDIQUER LE PRIX OBSERVÉ]
- Notre prix Net Facturé (NF) : [INDIQUER VOTRE PRIX NF]
- Retail % actuel : ${a.retailPct || 'non renseigné'}

[CHOISIR LA SITUATION APPLICABLE]

Option A — Prix trop bas (pression sur marges) :
Le prix affiché est inférieur à notre politique tarifaire et à notre Prix Net Facturé. Nous demandons un réalignement tarifaire pour préserver nos marges et la cohérence de notre distribution.

Option B — Blocage du compte / Fair Pricing Policy :
Notre compte est impacté par la Fair Pricing Policy. Nous souhaitons comprendre les conditions exactes de déblocage et les actions correctives à mettre en place.

Demande :
Pouvez-vous analyser la situation tarifaire de cet ASIN et nous indiquer la marche à suivre ?

Cordialement,
${c.contactOp || c.name}`
    },

    catalogue: {
      where: "Vendor Central > Gestion du Catalogue > Modifier les détails de l'article",
      subject: `Modification détails article — ${a.asin} — ${name}`,
      body: `Bonjour,

Je souhaite modifier les détails de l'article suivant via la Gestion du Catalogue :

• ASIN : ${a.asin}
• Produit : ${name}
• Marque : ${brand}
• Marché : ${domain}
• Lien produit : ${productUrl}

Modifications demandées :

[TITRE]
- Actuel : [COPIER LE TITRE ACTUEL]
- Proposé : [INDIQUER LE NOUVEAU TITRE]

[DESCRIPTION / BULLET POINTS]
- Point 1 actuel : [XXX] → Proposé : [YYY]
- Point 2 actuel : [XXX] → Proposé : [YYY]
- Point 3 actuel : [XXX] → Proposé : [YYY]

[ATTRIBUTS TECHNIQUES]
- Attribut : [NOM] → Valeur actuelle : [XXX] → Valeur proposée : [YYY]

[IMAGES]
- [DÉCRIRE LES CHANGEMENTS D'IMAGES SOUHAITÉS]

Justification des modifications :
Ces modifications visent à [PRÉCISER : améliorer la conversion / corriger une erreur / mettre à jour les caractéristiques produit / respecter les guidelines Amazon].

Si ces modifications ne peuvent pas être effectuées directement via l'interface Vendor Central, merci de m'indiquer la procédure à suivre ou de traiter cette demande depuis votre côté.

Cordialement,
${c.contactOp || c.name}`
    },

    detail_page: {
      where: "Vendor Central > Gestion du Catalogue > Problèmes relatifs à la page détaillée (boîte d'achat, commentaires client)",
      subject: `Problème page détaillée — ${a.asin} — ${name}`,
      body: `Bonjour,

Je vous contacte concernant un problème sur la page détaillée du produit suivant :

• ASIN : ${a.asin}
• Produit : ${name}
• Marque : ${brand}
• Marché : ${domain}
• Lien produit : ${productUrl}

[SÉLECTIONNEZ ET COMPLÉTEZ LE PROBLÈME APPLICABLE]

OPTION A — Problème de Boîte d'Achat (Buy Box)
Problème constaté : La boîte d'achat n'est pas attribuée à Amazon sur cette page.

Données observées :
- Retail % actuel : ${a.retailPct || '[NON RENSEIGNÉ]'}
- Notre Prix Net Facturé : [INDIQUER LE PRIX NF]
- Prix constaté sur la page : [INDIQUER LE PRIX AFFICHÉ]

La perte de Buy Box impacte directement nos ventes :
- Évolution CA : ${a.revenueDelta || '[NON RENSEIGNÉ]'}
- Glance Views : ${a.glanceViews ? fmt(a.glanceViews) : '[NON RENSEIGNÉ]'}

Demande : Pouvez-vous identifier la cause de la perte de Buy Box et les conditions de récupération ?

OPTION B — Problème de Commentaires Clients
Problème constaté :
[ ] Commentaires frauduleux / non vérifiés à signaler
[ ] Commentaires hors sujet ou sans lien avec le produit
[ ] Note globale anormalement impactée

ASINs concernés : ${a.asin}
Nombre d'avis problématiques identifiés : [INDIQUER LE NOMBRE]
Liens vers les avis à signaler : [INDIQUER LES LIENS]

Justification du signalement :
[DÉCRIRE PRÉCISÉMENT LE PROBLÈME : contenu trompeur, produit différent, avis croisés avec un autre ASIN, etc.]

OPTION C — Contenu de la page incorrect / fusionné
Problème constaté : La page détaillée affiche des informations erronées ou a été fusionnée avec un autre ASIN.

Description du problème : [DÉCRIRE LE PROBLÈME]
ASIN avec lequel la page a été fusionnée (si applicable) : [ASIN]


Demande globale :
Merci d'analyser ce cas et de me confirmer les actions correctives possibles et les délais de traitement.

Cordialement,
${c.contactOp || c.name}`
    },

    returns: {
      where: 'Vendor Central > Aide > Contacter Amazon > Retours clients / Qualité',
      subject: `Taux de retours anormal — ${a.asin} — ${name}`,
      body: `Bonjour,

Je vous contacte au sujet d'un taux de retours anormalement élevé constaté sur le produit suivant :

• ASIN : ${a.asin}
• Produit : ${name}
• Marque : ${brand}
• Marché : ${domain}
• Lien produit : ${productUrl}

Données observées :
- Nombre de retours sur la période : ${a.returns ? fmt(a.returns) : '[À PRÉCISER]'}
- CA sur la période : ${getRevenue(a,c) ? Math.round(getRevenue(a,c)) + ' €' : 'non renseigné'}
- Taux de retours estimé : [CALCULER : retours / unités vendues × 100]%

Analyse préliminaire :
[INDIQUER LA CAUSE SUSPECTÉE]
- Problème de conformité produit / packaging
- Description produit inexacte générant des attentes incorrectes
- Problème de transport / livraison
- Retours abusifs

Demande :
1. Pouvez-vous nous fournir les motifs détaillés des retours clients pour cet ASIN ?
2. Y a-t-il un risque de suspension de l'ASIN lié à ce taux de retours ?
3. Quelles actions Amazon recommande-t-elle pour réduire ce taux ?

Cordialement,
${c.contactOp || c.name}`
    }
  };

  return tpls[typeId] || null;
}

let activeCaseType = null;

function renderCaseModal(asin) {
  const c = cl();
  if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (!a) return;

  // Supprimer modal existante
  document.getElementById('case-modal')?.remove();

  const tpl = activeCaseType ? buildCaseText(activeCaseType, a, c) : null;

  const modal = document.createElement('div');
  modal.id = 'case-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--s1);border-radius:var(--rdxl);width:100%;max-width:700px;max-height:90vh;display:flex;flex-direction:column;box-shadow:var(--sh-lg);border:1px solid var(--bd2)">
      <div style="padding:18px 20px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between">
        <div>
          <h3 style="font-size:15px;font-weight:700">📋 Ouvrir un cas Vendor Central</h3>
          <p style="font-size:11px;color:var(--tx3);margin-top:2px">${esc(shortName(a))} — ${a.asin}</p>
        </div>
        <button onclick="document.getElementById('case-modal').remove()" style="background:var(--s3);border:none;border-radius:var(--rd);width:30px;height:30px;cursor:pointer;font-size:16px;color:var(--tx2)">×</button>
      </div>

      <div style="padding:14px 20px;border-bottom:1px solid var(--bd)">
        <p style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Type de cas</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${CASE_TYPES.map(ct => `
            <button onclick="activeCaseType='${ct.id}';renderCaseModal('${esc(asin)}')"
              style="display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:var(--rd);border:1px solid ${activeCaseType===ct.id?ct.color:'var(--bd2)'};background:${activeCaseType===ct.id?'rgba(0,0,0,0.04)':'var(--s2)'};cursor:pointer;font-size:12px;font-weight:${activeCaseType===ct.id?'600':'400'};color:${activeCaseType===ct.id?ct.color:'var(--tx2)'};transition:all .15s">
              ${ct.icon} ${ct.label}
            </button>`).join('')}
        </div>
      </div>

      <div style="flex:1;overflow-y:auto;padding:16px 20px">
        ${tpl ? `
          <div style="margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase">Où soumettre</span>
            </div>
            <div style="background:var(--a-bg);border:1px solid var(--a-bd);border-radius:var(--rd);padding:10px 14px;font-size:12px;color:var(--a);font-weight:500">
              📍 ${esc(tpl.where)}
            </div>
          </div>
          <div style="margin-bottom:10px">
            <span style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Objet</span>
            <div style="margin-top:6px;display:flex;align-items:center;gap:8px">
              <div style="flex:1;background:var(--s2);border:1px solid var(--bd2);border-radius:var(--rd);padding:9px 12px;font-size:12px;font-weight:600">${esc(tpl.subject)}</div>
              <button onclick="copyText('${esc(tpl.subject)}')" class="btn btn-sm">📋</button>
            </div>
          </div>
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Corps du message</span>
              <button onclick="copyText(document.getElementById('case-body').value)" class="btn btn-sm btn-p">📋 Copier le texte</button>
            </div>
            <textarea id="case-body" style="width:100%;height:320px;font-family:var(--fn);font-size:12px;line-height:1.7;padding:12px;border:1px solid var(--bd2);border-radius:var(--rd);background:var(--s2);color:var(--tx);resize:vertical">${esc(tpl.body)}</textarea>
            <p style="font-size:10px;color:var(--tx3);margin-top:6px">💡 Les zones [EN MAJUSCULES] sont à compléter avant envoi.</p>
          </div>
        ` : `
          <div style="text-align:center;padding:40px 20px;color:var(--tx3)">
            <div style="font-size:32px;margin-bottom:12px">👆</div>
            <p style="font-size:13px">Sélectionnez un type de cas ci-dessus<br>pour générer le texte prêt à copier.</p>
          </div>
        `}
      </div>
    </div>`;

  document.body.appendChild(modal);
  // Fermer en cliquant sur le fond
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function copyText(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  });
  // Feedback visuel sur le bouton cliqué
  const btn = event.target;
  const orig = btn.textContent;
  btn.textContent = '✓ Copié !';
  btn.style.background = 'var(--g-bg)';
  btn.style.color = 'var(--g)';
  setTimeout(() => { btn.textContent = orig; btn.style.background=''; btn.style.color=''; }, 1800);
}
function renderAsins() {
  const c = cl();
  if (!c?.asins?.length) return `<div class="alr alr-a">Importez d'abord des données CSV.</div>`;
  const asins = getFilteredAsins(c);
  // Consolidation multi-marchés quand filtre = "Tous"
  var displayAsins = (filters.market === 'all' && c.markets && c.markets.length > 1) ? consolidateAsins(asins, c) : asins;
  const totalCA = displayAsins.reduce((s, a) => s + (getRevenue(a,c)||0), 0);
  const withRevenue = displayAsins.filter(a => (getRevenue(a,c)||0) > 0);
  let h = '';

  // v3.6.8 α — Bandeau retour YoY (affiché seulement si arrivé via goToAsinsYoY)
  if (!selectedAsin && _yoyReturnCtx) {
    h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;background:var(--b-bg,#e8f0fb);border:1px solid var(--b-bd,#b0c8f0);border-radius:var(--rd);margin-bottom:12px">'
      + '<button class="btn btn-sm" onclick="yoyGoBack()" style="flex-shrink:0;gap:4px">← Analyse comparée</button>'
      + '<span style="font-size:12px;color:var(--tx2)">Filtré par : <strong>' + esc(asinViewLabel || 'YoY') + '</strong></span>'
      + '<span style="font-size:10px;color:var(--tx3);margin-left:auto">ou utilisez le bouton ← du navigateur</span>'
      + '</div>';
  }

  if (!selectedAsin) {
    h += renderMarketTabs(c, filters.market);
    // ── Calcul des vues disponibles ──────────────────────────────
    // v3.6.8.8 : si filtre YoY actif, compter dans le pool filtré (pas tout le catalogue)
    const allAsinsForViews = (asinView === 'yoy-warning') ? displayAsins : c.asins;
    const totalCAAll = allAsinsForViews.reduce((s,a) => s+(getRevenue(a,c)||0), 0);
    const countLowStock = allAsinsForViews.filter(a => {
      const oos = parseNum(a.oosPct);
      return (getRevenue(a,c)||0) > 50 && ((oos > 0 && oos < 90) || (a.sellableUnits != null && a.sellableUnits >= 0 && a.sellableUnits < 30));
    }).length;
    const countDeclining = allAsinsForViews.filter(a => (getRevenue(a,c)||0)>0 && parseNum(a.revenueDelta) <= -10).length;
    const countGrowing   = allAsinsForViews.filter(a => (getRevenue(a,c)||0)>0 && parseNum(a.revenueDelta) >= 20).length;
    const countA = allAsinsForViews.filter(a => calcSegment(a, totalCAAll, c) === 'A').length;
    const countB = allAsinsForViews.filter(a => calcSegment(a, totalCAAll, c) === 'B').length;
    const countC = allAsinsForViews.filter(a => calcSegment(a, totalCAAll, c) === 'C').length;
    const countAll = allAsinsForViews.filter(a => (getRevenue(a,c)||0)>0).length;

    // ── Vues prédéfinies ─────────────────────────────────────────
    const views = [
      { id:'all',       icon:'📦', label:'Tous',       count: countAll,      color:'gr' },
      { id:'lowstock',  icon:'🔴', label:'Ruptures',   count: countLowStock, color:'r'  },
      { id:'declining', icon:'📉', label:'Baisses',    count: countDeclining,color:'a'  },
      { id:'growing',   icon:'🚀', label:'Croissance', count: countGrowing,  color:'g'  },
      { id:'seg-a',     icon:'🥇', label:'Segment A',  count: countA,        color:'b'  },
      { id:'seg-b',     icon:'🥈', label:'Segment B',  count: countB,        color:'b'  },
      { id:'seg-c',     icon:'🥉', label:'Segment C',  count: countC,        color:'gr' },
    ];

    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">';
    views.forEach(v => {
      const isActive = asinView === v.id;
      const hasAlert = (v.id === 'lowstock' && v.count > 0) || (v.id === 'declining' && v.count > 0);
      // Fix v3.6.8.8 : JSON.stringify(v.id) produisait "lowstock" avec guillemets → onclick cassé
      h += '<button class="btn btn-sm' + (isActive ? ' btn-p' : '') + '" style="position:relative;' + (hasAlert && !isActive ? 'border-color:var(--' + v.color + ');color:var(--' + v.color + ')' : '') + '" onclick="goFilteredAsins(\'' + v.id + '\')">';
      h += v.icon + ' ' + v.label;
      if (v.count > 0) h += ' <span style="font-size:10px;font-weight:700;margin-left:3px;padding:1px 5px;background:var(--s2);border-radius:8px">' + v.count + '</span>';
      h += '</button>';
    });
    // Bouton réinitialiser si vue active
    if (asinView !== 'all') {
      h += '<button class="btn btn-xs" style="margin-left:auto;color:var(--tx3)" onclick="asinView=\'all\';asinViewAsins=null;asinSort=\'ca_desc\';render()">✕ Réinitialiser</button>';
    }
    h += '</div>';

    // ── Bandeau contextuel selon la vue ─────────────────────────
    const viewMeta = {
      lowstock:  { color:'r', label:'🔴 Vue : Ruptures imminentes', desc:'Stock < 30u ou disponibilité < 90% sur produits actifs' },
      declining: { color:'a', label:'📉 Vue : ASINs en baisse', desc:'CA en recul de plus de 10% vs semaine précédente' },
      growing:   { color:'g', label:'🚀 Vue : ASINs en croissance', desc:'CA en hausse de plus de 20% vs semaine précédente' },
      'seg-a':   { color:'b', label:'🥇 Vue : Segment A — Top sellers', desc:'ASINs représentant 80% du CA total' },
      'seg-b':   { color:'b', label:'🥈 Vue : Segment B — Développement', desc:'ASINs représentant 15% du CA total' },
      'seg-c':   { color:'gr', label:'🥉 Vue : Segment C — Long tail', desc:'ASINs représentant 5% du CA total' },
    };
    if (asinView !== 'all' && viewMeta[asinView]) {
      const vm = viewMeta[asinView];
      h += '<div style="padding:10px 14px;background:var(--' + vm.color + '-bg);border:1px solid var(--' + vm.color + '-bd);border-radius:var(--rdl);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px">';
      h += '<div><div style="font-weight:600;font-size:13px;color:var(--' + vm.color + ')">' + vm.label + ' (' + (asinViewAsins?.length || 0) + ' ASINs)</div>';
      h += '<div style="font-size:11px;color:var(--tx3);margin-top:2px">' + vm.desc + '</div></div>';
      h += '<div style="display:flex;gap:6px">';
      h += '<button class="btn btn-sm" onclick="exportViewXlsx()">⬇ XLSX (' + (asinViewAsins?.length || 0) + ')</button>';
      h += '<button class="btn btn-sm" onclick="exportViewCsv()">⬇ CSV</button>';
      h += '</div></div>';
    }
    // v3.6.7 — Badge filtre YoY (CTA 11 / CTA 12)
    if (asinView === 'yoy-warning' && asinViewLabel) {
      const nbYoY = asinViewAsins ? asinViewAsins.length : 0;
      const labelNote = nbYoY === 0
        ? ' — <em style="color:var(--tx3)">Ces ASINs ne figurent pas dans le catalogue actif</em>'
        : '';
      h += '<div style="padding:10px 14px;background:rgba(217,119,6,0.08);border:1px solid #d97706;border-radius:var(--rdl);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">';
      h += '<div style="flex:1"><div style="font-weight:600;font-size:13px;color:#d97706">🔍 Filtré par : ' + esc(asinViewLabel) + ' (' + nbYoY + ' ASINs)' + labelNote + '</div></div>';
      h += '<button class="btn btn-xs" style="color:var(--tx3)" onclick="asinView=\'all\';asinViewAsins=null;asinViewCustomIds=null;asinViewLabel=\'\';asinSort=\'ca_desc\';render()">✕ Retirer le filtre</button>';
      h += '</div>';
    }

    // ── Filtres enrichis ──────────────────────────────────────────

    const asinSortOpts = [
      { v: 'ca_desc',    l: '💰 CA décroissant' },
      { v: 'ca_asc',     l: '💰 CA croissant' },
      { v: 'hausse',     l: '📈 Meilleures hausses' },
      { v: 'baisse',     l: '📉 Plus fortes baisses' },
      { v: 'stock_asc',  l: '📦 Stock critique en premier' },
      { v: 'health_asc', l: '🩺 Health Score bas en premier' },
      { v: 'gv_desc',    l: '👁 Glance Views décroissant' },
      { v: 'trend_asc',  l: '📉 Déclin structurel en premier' },
      { v: 'trend_desc', l: '📈 Croissance structurelle en premier' },
    ];
    const asinLimitOpts = [
      { v: 25,  l: 'Top 25' },
      { v: 50,  l: 'Top 50' },
      { v: 100, l: 'Top 100' },
      { v: 9999,l: 'Tous' },
    ];

    h += `<div class="filters" style="gap:12px">
      <div style="display:flex;align-items:center;gap:6px">
        <span class="filter-label">Trier par</span>
        <select class="filter-select" onchange="asinSort=this.value;render()">
          ${asinSortOpts.map(o => `<option value="${o.v}"${asinSort===o.v?' selected':''}>${o.l}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="filter-label">Afficher</span>
        <select class="filter-select" onchange="asinLimit=+this.value;render()">
          ${asinLimitOpts.map(o => `<option value="${o.v}"${asinLimit===o.v?' selected':''}>${o.l}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="filter-label">Segment</span>
        <select class="filter-select" onchange="setFilter('segment',this.value)">
          <option value="all">Tous</option>
          <option value="A"${filters.segment==='A'?' selected':''}>🥇 A</option>
          <option value="B"${filters.segment==='B'?' selected':''}>🥈 B</option>
          <option value="C"${filters.segment==='C'?' selected':''}>🥉 C</option>
        </select>
      </div>
      <span style="color:var(--tx3);font-size:11px;margin-left:auto">${withRevenue.length} ASINs avec CA / ${displayAsins.length} total</span>
      <button class="btn btn-sm" onclick="exportAsinsCsv()">⬇ CSV</button><button class="btn btn-sm" onclick="exportAsinsXlsx()" style="margin-left:4px">⬇ XLSX</button>
    </div>`;

    // ── Tri ──────────────────────────────────────────────────────
    let sorted = [...withRevenue];
    if (asinSort === 'ca_desc')         sorted.sort((a,b) => (getRevenue(b,c)||0)-(getRevenue(a,c)||0));
    else if (asinSort === 'ca_asc')     sorted.sort((a,b) => (getRevenue(a,c)||0)-(getRevenue(b,c)||0));
    else if (asinSort === 'hausse')     sorted.sort((a,b) => parseNum(b.revenueDelta)-parseNum(a.revenueDelta));
    else if (asinSort === 'hausse_baisse_desc') sorted.sort((a,b) => parseNum(b.revenueDelta)-parseNum(a.revenueDelta));
    else if (asinSort === 'hausse_baisse_asc')  sorted.sort((a,b) => parseNum(a.revenueDelta)-parseNum(b.revenueDelta));
    else if (asinSort === 'baisse')     sorted.sort((a,b) => parseNum(a.revenueDelta)-parseNum(b.revenueDelta));
    else if (asinSort === 'stock_asc')  sorted.sort((a,b) => (a.sellableUnits||9999)-(b.sellableUnits||9999));
    else if (asinSort === 'stock_desc') sorted.sort((a,b) => (b.sellableUnits||9999)-(a.sellableUnits||9999));
    else if (asinSort === 'health_asc') sorted.sort((a,b) => calcHealth(a)-calcHealth(b));
    else if (asinSort === 'health_desc')sorted.sort((a,b) => calcHealth(b)-calcHealth(a));
    else if (asinSort === 'gv_desc')    sorted.sort((a,b) => (b.glanceViews||0)-(a.glanceViews||0));
    else if (asinSort === 'gv_asc')     sorted.sort((a,b) => (a.glanceViews||0)-(b.glanceViews||0));
    else if (asinSort === 'potential_desc') sorted.sort((a,b) => calcPotential(b,c).score-calcPotential(a,c).score);
    else if (asinSort === 'potential_asc')  sorted.sort((a,b) => calcPotential(a,c).score-calcPotential(b,c).score);
    else if (asinSort === 'ppm_desc')   sorted.sort((a,b) => ((c.ppmData||{})[b.asin]?.ppm||0)-((c.ppmData||{})[a.asin]?.ppm||0));
    else if (asinSort === 'ppm_asc')    sorted.sort((a,b) => ((c.ppmData||{})[a.asin]?.ppm||0)-((c.ppmData||{})[b.asin]?.ppm||0));
    else if (asinSort === 'trend_asc')  sorted.sort((a,b) => (calcTrend(a)?.slope||0)-(calcTrend(b)?.slope||0));
    else if (asinSort === 'trend_desc') sorted.sort((a,b) => (calcTrend(b)?.slope||0)-(calcTrend(a)?.slope||0));

    const visible = sorted.slice(0, asinLimit);

    // ── Tableau ──────────────────────────────────────────────────
    // Fonction helper pour en-tête triable
    const thSort = (label, sortKey, align='r') => {
      const isActive = asinSort === sortKey + '_desc' || asinSort === sortKey + '_asc';
      const isDesc = asinSort === sortKey + '_desc';
      const arrow = isActive ? (isDesc ? ' ▼' : ' ▲') : ' ⇅';
      const newSort = isActive && isDesc ? sortKey + '_asc' : sortKey + '_desc';
      return '<th class="' + align + '" style="cursor:pointer;user-select:none;white-space:nowrap;' + (isActive ? 'color:var(--accent)' : '') + '" onclick="asinSort=\'' + newSort + '\';render()">' + label + '<span style="font-size:9px;opacity:.6">' + arrow + '</span></th>';
    };

    h += `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th style="width:28px;text-align:center">#</th>
      <th style="width:36px">Score</th>
      <th>Produit / ASIN</th>
      <th style="width:44px">Seg.</th>
      ${thSort('CA', 'ca')}
      ${thSort('Δ CA', 'hausse_baisse')}
      <th>Tendance</th>
      ${thSort('GV', 'gv')}
      <th class="r">Δ GV</th>
      ${thSort('Stock', 'stock')}
      <th class="r">Retail%</th>
      ${thSort('🚀', 'potential')}
      ${thSort('PPM', 'ppm')}
      <th></th>
    </tr></thead><tbody>`;

    visible.forEach(a => {
      const health = calcHealth(a);
      const seg = calcSegment(a, totalCA, c);
      const delta = parseNum(a.revenueDelta);
      const isLow = a.sellableUnits >= 0 && a.sellableUnits < 30 && (getRevenue(a,c)||0) > 50;
      const isDec = delta < -10;
      const rc = isDec ? 'al-row' : isLow ? 'warn-row' : '';
      const rank = visible.indexOf(a) + 1;
      var asinRowFlags = '';
      if (a._consolidated && a.markets && a.markets.length > 1) {
        asinRowFlags = ' <span style="font-size:10px;opacity:0.7">';
        for (var rfi = 0; rfi < a.markets.length; rfi++) {
          var rfmp = MARKETPLACES_FULL.find(function(x) { return x.market === a.markets[rfi]; });
          if (rfmp) asinRowFlags += rfmp.flag;
        }
        asinRowFlags += '</span>';
      }
      h += `<tr class="${rc}" style="cursor:pointer" onclick="selectAsin('${esc(a.asin)}')">
        <td style="text-align:center;font-size:11px;font-weight:700;color:var(--tx3)">${rank}</td>
        <td><div class="hs hs-sm ${healthClass(health)}">${health}</div></td>
        <td>
          <div style="font-weight:500;font-size:12px;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(a.title)}">${esc(shortName(a))}${asinRowFlags}</div>
          <div style="font-size:10px;color:var(--tx3);font-family:var(--fm)">${a.asin} <span style="margin-left:4px;opacity:.6">${a._consolidated ? '🌍' : (a.market||'.fr')}</span>${a.sourcingOnly ? '<span style="margin-left:4px;font-size:9px;font-weight:700;color:var(--a);background:var(--a-bg);border-radius:3px;padding:1px 4px">Appro</span>' : ''}</div>
        </td>
        <td>${segBadge(seg)}</td>
        <td class="r" style="font-weight:600">${fmtEur(getRevenue(a,c)||0)}</td>
        <td class="r">${deltaBadge(a.revenueDelta)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            ${(() => { const t = calcTrend(a); return sparkline(t?.series, t?.cls) + trendBadge(t); })()}
          </div>
        </td>
        <td class="r">${fmt(a.glanceViews||0)}</td>
        <td class="r">${deltaBadge(a.gvDelta)}</td>
        <td class="r ${isLow?'':''}">
          ${a.sellableUnits != null ? `<span style="font-weight:600;color:${isLow?'var(--r)':'inherit'}">${fmt(a.sellableUnits)}u</span>` : '—'}
        </td>
        <td class="r">${a.retailPct||'—'}</td>
        <td class="r">${(() => { const p = calcPotential(a,c); return p.score >= 45 ? '<span style="font-size:11px;font-weight:700;color:' + (p.score>=70?'var(--g)':'var(--a)') + '">' + p.score + '</span>' : '<span style="color:var(--tx3);font-size:10px">—</span>'; })()}</td>
        <td class="r">${(() => { const pm = (c.ppmData||{})[a.asin]; return pm?.ppm != null ? '<span style="font-size:11px;font-weight:600;color:' + (pm.ppm>=15?'var(--g)':pm.ppm<5?'var(--r)':'var(--a)') + '">' + pm.ppm.toFixed(1) + '%</span>' : '<span style="color:var(--tx3);font-size:10px">—</span>'; })()}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-xs btn-amazon" onclick="event.stopPropagation();openAmazonProduct('${esc(a.asin)}','${a.market||'.fr'}')" title="Amazon">🔗</button>
        </td>
      </tr>`;
    });
    h += `</tbody></table></div>`;
    if (sorted.length > asinLimit) h += `<p style="font-size:10px;color:var(--tx3);margin-top:8px;padding:0 4px">${asinLimit} affichés sur ${sorted.length} — changez le filtre "Afficher" pour voir plus</p>`;
  } else {
    const a = asins.find(x => x.asin === selectedAsin);
    if (!a) { selectedAsin = null; return renderAsins(); }
    const health = calcHealthDeep(a, c);
    const deep = calcTrendDeep(a, c);
    const seg = calcSegment(a, totalCA, c);
    const keyword = getMainKeyword(a);

    h += `<button class="btn btn-sm" onclick="selectedAsin=null;render()" style="margin-bottom:14px">← Retour</button>`;

    // ── Encadré récapitulatif multi-marchés ──────────────────────────
    var allEntries = c.asins.filter(function(x) { return x.asin === selectedAsin; });
    if (allEntries.length > 1) {
      var totalRevMkt = 0, totalUnitsMkt = 0;
      var mktHtml = '';
      for (var ei = 0; ei < allEntries.length; ei++) {
        var e = allEntries[ei];
        var mkt = e.market || '.fr';
        var mp = MARKETPLACES_FULL.find(function(x) { return x.market === mkt; });
        var flag = mp ? mp.flag : '';
        var rev = getRevenue(e, c) || 0;
        var units = getUnits(e, c) || 0;
        totalRevMkt += rev;
        totalUnitsMkt += units;
        mktHtml += '<span style="margin-right:12px">' + flag + ' ' + mkt.replace('.','').toUpperCase() + ': <b>' + rev.toLocaleString('fr-FR') + '€</b> · ' + units + 'u</span>';
      }
      h += '<div style="padding:12px 14px;background:var(--accent-bg);border:1px solid var(--accent-bd);border-radius:var(--rdl);margin-bottom:12px;font-size:12px">';
      h += '<div style="font-weight:600;margin-bottom:6px">\u{1F30D} Cet ASIN est vendu dans ' + allEntries.length + ' marchés</div>';
      h += '<div style="margin-bottom:4px;flex-wrap:wrap;display:flex;gap:4px">' + mktHtml + '</div>';
      h += '<div style="font-weight:600;color:var(--accent)">Total consolidé : ' + totalRevMkt.toLocaleString('fr-FR') + '€ · ' + totalUnitsMkt + ' unités</div>';
      h += '</div>';
    }

    h += `<div class="cd" style="display:flex;gap:18px;align-items:flex-start">`;
    h += `<div class="hs hs-lg ${healthClass(health)}">${health}</div>`;
    h += `<div style="flex:1">
      <h2 style="font-size:15px;margin-bottom:6px">${esc(shortName(a))}</h2>
      <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
        <span class="mono" style="font-size:10px;color:var(--tx3)">${a.asin}</span>
        ${segBadge(seg)}
        <span class="pill pill-gr">${a.market||'.fr'}</span>${a.sourcingOnly ? '<span class="pill" style="background:var(--a-bg);color:var(--a);border:1px solid var(--a-bd)">Approvisionnement</span>' : ''}
        ${a.brand ? `<span class="pill pill-b">${esc(a.brand)}</span>` : ''}
      </div>
      <p style="font-size:11px;color:var(--tx3);max-width:500px">${esc(a.title||'')}</p>
    </div>`;
    h += `<div style="display:flex;flex-direction:column;gap:6px">
      <button class="btn btn-amazon btn-sm" onclick="openAmazonProduct('${esc(a.asin)}','${a.market||'.fr'}')">🔗 Amazon</button>
      <button class="btn btn-purple btn-sm" onclick="openAmazonSearch('${esc(keyword)}','${a.market||'.fr'}')">🔍 Concurrence</button>
      <button class="btn btn-b btn-sm" onclick="launchChromeAnalysis('${esc(a.asin)}','${a.market||'.fr'}')">🌐 Chrome</button>
      <button class="btn btn-sm" onclick="activeCaseType=null;renderCaseModal('${esc(a.asin)}')" style="border-color:var(--or-border);color:var(--or)">📋 Cas Vendor</button>
    </div>`;
    h += `</div>`;

    // ── Bandeau tendance structurelle narratif ──
    {
      const sigColors = {
        'trend-up':'var(--g)', 'trend-up-soft':'#65A30D',
        'trend-down':'var(--r)', 'trend-down-soft':'var(--a)', 'trend-stable':'var(--tx3)'
      };
      const sigColor = sigColors[deep.signalCls] || 'var(--tx2)';
      const hasDeeep = deep.ca1 || deep.ca2 || deep.caYTD;

      h += `<div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--rdl);padding:14px 16px;margin-bottom:12px">`;
      h += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:${hasDeeep?'10':'0'}px;flex-wrap:wrap">`;
      h += `<span style="font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Tendance structurelle</span>`;
      h += trendBadge(deep.shortTrend);
      if (deep.signal && deep.signal !== 'Données insuffisantes') {
        h += `<span style="font-size:12px;font-weight:700;color:${sigColor}">⚡ ${deep.signal}</span>`;
      } else if (!deep.shortTrend) {
        h += `<span style="font-size:11px;color:var(--tx3)">— Importez plusieurs semaines pour voir la tendance hebdo</span>`;
      }
      h += `</div>`;

      if (hasDeeep) {
        // Tableau comparatif clair N-2 / N-1 / YTD / Semaine actuelle
        h += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">`;

        if (deep.ca2) {
          const d2to1 = deep.ca1 ? ((deep.ca1-deep.ca2)/deep.ca2*100).toFixed(0) : null;
          h += `<div style="background:var(--s1);border:1px solid var(--bd);border-radius:var(--rd);padding:10px 12px;text-align:center">
            <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;margin-bottom:4px">${deep.prev2Year}</div>
            <div style="font-size:15px;font-weight:700">${fmtEur(deep.ca2)}</div>
            <div style="font-size:10px;color:var(--tx3);margin-top:2px">Annuel complet</div>
          </div>`;
        }
        if (deep.ca1) {
          const d2to1 = deep.ca2 ? ((deep.ca1-deep.ca2)/deep.ca2*100).toFixed(0) : null;
          const dColor = d2to1 ? (parseFloat(d2to1)>=0?'var(--g)':'var(--r)') : 'var(--tx3)';
          h += `<div style="background:var(--s1);border:1px solid var(--bd);border-radius:var(--rd);padding:10px 12px;text-align:center">
            <div style="font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;margin-bottom:4px">${deep.prevYear}</div>
            <div style="font-size:15px;font-weight:700">${fmtEur(deep.ca1)}</div>
            <div style="font-size:10px;color:${dColor};margin-top:2px">${d2to1 ? (parseFloat(d2to1)>=0?'▲ +':'▼ ')+d2to1+'% vs '+deep.prev2Year : 'Annuel complet'}</div>
          </div>`;
        }
        if (deep.caYTD) {
          const ytdEnd = c.ytdData?.ventes?.periodEnd || '';
          const ytdLabel = ytdEnd ? '01/01→' + ytdEnd.slice(0,5) : 'YTD ' + deep.curYear;
          const dColor = deep.ytdVsN1 !== null ? (deep.ytdVsN1>=0?'var(--g)':'var(--r)') : 'var(--tx3)';
          h += `<div style="background:var(--or-l);border:1px solid var(--or-border);border-radius:var(--rd);padding:10px 12px;text-align:center">
            <div style="font-size:10px;font-weight:600;color:var(--or);text-transform:uppercase;margin-bottom:4px">${ytdLabel}</div>
            <div style="font-size:15px;font-weight:700">${fmtEur(deep.caYTD)}</div>
            <div style="font-size:10px;color:${dColor};margin-top:2px">${deep.ytdVsN1 !== null ? (deep.ytdVsN1>=0?'▲ +':'▼ ')+Math.abs(deep.ytdVsN1).toFixed(1)+'% vs même période '+deep.prevYear : 'vs N-1 non calculable'}</div>
          </div>`;
        }
        // Semaine actuelle pour comparaison
        if (getRevenue(a,c) && a.periodEnd) {
          h += `<div style="background:var(--b-bg);border:1px solid var(--b-bd);border-radius:var(--rd);padding:10px 12px;text-align:center">
            <div style="font-size:10px;font-weight:600;color:var(--b);text-transform:uppercase;margin-bottom:4px">Semaine ${a.periodEnd.slice(0,5)}</div>
            <div style="font-size:15px;font-weight:700">${fmtEur(getRevenue(a,c))}</div>
            <div style="font-size:10px;color:var(--tx3);margin-top:2px">${a.periodStart ? a.periodStart.slice(0,5)+'→'+a.periodEnd.slice(0,5) : 'Période courante'}</div>
          </div>`;
        }
        h += `</div>`;

        if (!deep.shortTrend) {
          h += `<div style="margin-top:8px;font-size:10px;color:var(--tx3)">💡 Importez plusieurs semaines successives pour voir la tendance hebdo se construire.</div>`;
        }
      } else {
        h += `<div style="font-size:11px;color:var(--tx3);margin-top:4px">Chargez les données annuelles (N-2, N-1, YTD) depuis <button onclick="go('import')" style="background:none;border:none;color:var(--or);cursor:pointer;font-size:11px;font-weight:600;padding:0;text-decoration:underline">Import données</button> pour voir la trajectoire longue.</div>`;
      }
      h += `</div>`;
    }

    // Période de l'import courant
    const periodLabel = a.periodStart && a.periodEnd
      ? a.periodStart + ' → ' + a.periodEnd
      : a.periodEnd || 'Période inconnue';
    const periodBadge = `<div style="font-size:10px;color:var(--or);font-weight:600;margin-top:3px">${periodLabel}</div>`;

    h += `<div class="kpi-g">`;
    h += `<div class="kpi"><div class="kpi-lb">CA Commandé</div><div class="kpi-v">${fmtEur(getRevenue(a,c)||0)}</div><div>${deltaBadge(a.revenueDelta)}</div>${periodBadge}</div>`;
    h += `<div class="kpi"><div class="kpi-lb">Unités</div><div class="kpi-v">${fmt(getUnits(a,c)||0)}</div><div>${deltaBadge(a.unitsDelta)}</div>${periodBadge}</div>`;
    h += `<div class="kpi"><div class="kpi-lb">Glance Views</div><div class="kpi-v">${fmt(a.glanceViews||0)}</div><div>${deltaBadge(a.gvDelta)}</div>${periodBadge}</div>`;
    h += `<div class="kpi"><div class="kpi-lb">Stock Vendable</div><div class="kpi-v">${a.sellableUnits ? fmt(a.sellableUnits)+'u' : '—'}</div>${periodBadge}</div>`;
    h += `<div class="kpi"><div class="kpi-lb">Retail %</div><div class="kpi-v">${(()=>{const v=parseNum(String(a.retailPct||'').replace(',','.').replace(/[^0-9.]/g,''));return v>0&&v<=100?v.toFixed(1)+'%':'—';})()}</div>${periodBadge}</div>`;
    h += `<div class="kpi"><div class="kpi-lb">Retours</div><div class="kpi-v">${a.returns ? fmt(a.returns) : '—'}</div>${periodBadge}</div>`;
    h += `</div>`;

    const hasWeekly  = a.history?.length > 0;
    const hasMonthly = a.historyMonthly?.length > 0;

    if (hasWeekly || hasMonthly) {
      h += `<div class="cd">`;
      h += `<div class="cd-t space">
        <span>📈 Historique Performance</span>
        <span style="font-size:10px;font-weight:400;color:var(--tx3)">
          ${hasWeekly ? a.history.length + ' sem.' : ''}
          ${hasWeekly && hasMonthly ? ' · ' : ''}
          ${hasMonthly ? a.historyMonthly.length + ' mois' : ''}
        </span>
      </div>`;

      // Onglets
      h += `<div class="htabs" style="margin-bottom:12px">`;
      h += `<button class="htab${historyView==='weekly'?' active':''}" onclick="setHistoryView('weekly')" ${!hasWeekly?'disabled':''}>📅 Semaines</button>`;
      h += `<button class="htab${historyView==='monthly'?' active':''}" onclick="setHistoryView('monthly')" ${!hasMonthly?'disabled':''}>📆 Mois</button>`;
      h += `<button class="htab${historyView==='table'?' active':''}" onclick="setHistoryView('table')">📋 Tableau</button>`;
      h += `</div>`;

      if (historyView === 'table') {
        // ── Vue tableau détaillé ──
        const tableData = hasWeekly ? a.history.slice(-16).reverse() : [];
        h += `<div class="tbl-wrap"><table class="tbl" style="font-size:11px"><thead><tr>
          <th>Période</th>
          <th class="r">CA</th>
          <th class="r">Δ</th>
          <th class="r">Unités</th>
          <th class="r">GV</th>
          <th class="r">Stock</th>
          <th class="r">Retail%</th>
          <th class="r">Retours</th>
        </tr></thead><tbody>`;
        tableData.forEach((h2, i) => {
          const period = h2.periodStart ? h2.periodStart.slice(0,5)+'→'+h2.period.slice(0,5) : (h2.period || '?');
          const delta = h2.revenueDelta ? deltaBadge(h2.revenueDelta) : '—';
          const stockVal = h2.sellableUnits != null ? h2.sellableUnits + 'u' : '—';
          const stockColor = h2.sellableUnits != null && h2.sellableUnits < 30 ? 'color:var(--r);font-weight:700' : '';
          h += `<tr>
            <td style="font-size:10px;color:var(--tx3)">${period}</td>
            <td class="r"><strong>${fmtEur(h2.revenue||0)}</strong></td>
            <td class="r">${delta}</td>
            <td class="r">${fmt(h2.units||0)}</td>
            <td class="r">${fmt(h2.glanceViews||0)}</td>
            <td class="r" style="${stockColor}">${stockVal}</td>
            <td class="r">${h2.retailPct||'—'}</td>
            <td class="r">${h2.returns||'—'}</td>
          </tr>`;
        });
        // Ajouter données mensuelles si disponibles
        if (hasMonthly) {
          h += `<tr><td colspan="8" style="background:var(--s2);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--tx3);padding:8px 12px">Synthèses mensuelles (${a.historyMonthly.length} mois)</td></tr>`;
          a.historyMonthly.slice(-12).reverse().forEach(m => {
            h += `<tr style="background:var(--s1)">
              <td style="font-size:10px;color:var(--or);font-weight:600">${m.label}</td>
              <td class="r"><strong>${fmtEur(m.revenue||0)}</strong></td>
              <td class="r" style="color:var(--tx3);font-size:10px">${m.weeks} sem.</td>
              <td class="r">${fmt(m.units||0)}</td>
              <td class="r">${fmt(m.glanceViews||0)}</td>
              <td class="r">${m.sellableUnitsLast != null ? m.sellableUnitsLast+'u' : '—'}</td>
              <td class="r">—</td>
              <td class="r">—</td>
            </tr>`;
          });
        }
        h += `</tbody></table></div>`;
      } else {
        // ── Vue graphique ──
        h += `<div class="chart-container chart-sm"><canvas id="history-chart"></canvas></div>`;
        // Légende couleurs
        h += `<div style="display:flex;gap:14px;margin-top:8px;flex-wrap:wrap">`;
        h += `<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--tx3)"><span style="width:16px;height:3px;background:#FF9900;display:inline-block;border-radius:2px"></span> CA (€)</div>`;
        if ((historyView==='weekly'?a.history:a.historyMonthly||[]).some(h=>h.glanceViews>0)) {
          h += `<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--tx3)"><span style="width:16px;height:2px;background:#3B82F6;display:inline-block;border-radius:2px;border-top:1px dashed #3B82F6"></span> Glance Views</div>`;
        }
        h += `</div>`;
      }

      h += `</div>`;
    } else if (getRevenue(a,c)) {
      h += `<div style="font-size:11px;color:var(--tx3);padding:12px 16px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rdl);margin-bottom:14px">
        💡 <strong>Première semaine importée.</strong> À chaque nouvel import hebdo, les données de la semaine précédente s'archiveront automatiquement ici — construisant la courbe hebdo et les synthèses mensuelles.
      </div>`;
    }

    h += `<div class="cd"><div class="cd-t">🎯 Analyse Concurrentielle</div>`;
    h += `<div class="comp-grid">`;
    h += `<div class="comp-card"><div style="font-weight:600;margin-bottom:6px">📦 Page Produit</div><p style="font-size:11px;color:var(--tx3);margin-bottom:10px">Prix, Buy Box, avis, A+</p><button class="btn btn-amazon btn-sm" onclick="openAmazonProduct('${esc(a.asin)}','${a.market||'.fr'}')">Ouvrir</button></div>`;
    h += `<div class="comp-card"><div style="font-weight:600;margin-bottom:6px">🔍 Résultats Recherche</div><p style="font-size:11px;color:var(--tx3);margin-bottom:10px">Position, concurrents directs</p><button class="btn btn-sm" onclick="openAmazonSearch('${esc(keyword)}','${a.market||'.fr'}')">Rechercher</button></div>`;
    h += `<div class="comp-card"><div style="font-weight:600;margin-bottom:6px">📊 Best Sellers</div><p style="font-size:11px;color:var(--tx3);margin-bottom:10px">Top ventes de la catégorie</p><button class="btn btn-sm" onclick="openAmazonBestSellers('${a.market||'.fr'}')">Explorer</button></div>`;
    h += `</div></div>`;

    // Section SEO injectée séparément pour éviter les conflits de guillemets
    h += '<div id="seo-section-container"></div>';

    h += `<div class="cd"><div class="cd-t">🤖 Analyse IA</div>`;
    h += `<button class="btn btn-p" onclick="runAsinAI('${esc(a.asin)}')" ${aiLoading?'disabled':''}>${aiLoading?'<span class="spin">⏳</span> Analyse...':'▶ Lancer l\'analyse IA'}</button>`;
    if (aiResult && selectedAsin === a.asin) { if (isAIError(aiResult)) { h += renderAIError(aiResult, `runAsinAI('${esc(a.asin)}')`); } else { h += `<div class="ai-out">${renderMarkdown(aiResult)}</div><button class="btn" style="margin-top:10px" onclick="copyAI()">📋 Copier</button>`; } }
    h += `</div>`;

    h += `<div class="cd"><div class="cd-t">📋 Ouvrir un cas Vendor Central</div>`;
    h += `<p style="font-size:12px;color:var(--tx2);margin-bottom:12px">Textes prêts à copier-coller pour contacter le support Amazon Vendor. Sélectionnez le type de problème.</p>`;
    h += `<div style="display:flex;gap:8px;flex-wrap:wrap">`;
    CASE_TYPES.forEach(ct => {
      h += `<button onclick="activeCaseType='${ct.id}';renderCaseModal('${esc(a.asin)}')"
        style="display:flex;align-items:center;gap:6px;padding:8px 13px;border-radius:var(--rd);border:1px solid var(--bd2);background:var(--s2);cursor:pointer;font-size:12px;color:var(--tx2);transition:all .15s"
        onmouseover="this.style.borderColor='${ct.color}';this.style.color='${ct.color}'"
        onmouseout="this.style.borderColor='var(--bd2)';this.style.color='var(--tx2)'">
        ${ct.icon} ${ct.label}
      </button>`;
    });
    h += `</div></div>`;
  }
  return h;
}
function renderPompier() {
  const c = cl();
  if (!c) return renderWelcome();
  if (!c.asins?.length) return `<div class="alr alr-a">Importez d'abord des données pour lancer le diagnostic.</div>`;
  const asins = getFilteredAsins(c);
  const totalCA = asins.reduce((s, a) => s + (getRevenue(a,c)||0), 0);

  // Seuil configurable via le filtre pompier
  const threshold = pompierThreshold;
  const declining = asins.filter(a => (getRevenue(a,c)||0) > 0 && parseNum(a.revenueDelta) < -threshold)
    .sort((a, b) => parseNum(a.revenueDelta) - parseNum(b.revenueDelta));

  const totalLost = declining.reduce((s,a) => s + Math.abs(parseNum(a.revenueDelta)/100*(getRevenue(a,c)||0)), 0);

  const pompPeriodImport = c.imports?.filter(i=>i.periodType==='weekly'||!i.periodType).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  const pompPeriodLabel = pompPeriodImport ? pompPeriodImport.periodStart + ' → ' + pompPeriodImport.periodEnd : null;

  let h = '';
  h += renderMarketTabs(c, filters.market);

  // ── Header avec stats clés ──
  h += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
    <div>
      <h2 style="font-size:17px;font-weight:700">🚨 Diagnostic CA — ASINs en baisse</h2>
      ${pompPeriodLabel ? `<div style="font-size:12px;color:var(--tx3);margin-top:2px">Période analysée : ${pompPeriodLabel}</div>` : ''}
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <span class="filter-label">Seuil de baisse</span>
      <select class="filter-select" onchange="pompierThreshold=+this.value;render()">
        <option value="5"${threshold===5?' selected':''}>› 5%</option>
        <option value="10"${threshold===10?' selected':''}>› 10%</option>
        <option value="20"${threshold===20?' selected':''}>› 20%</option>
        <option value="30"${threshold===30?' selected':''}>› 30%</option>
        <option value="50"${threshold===50?' selected':''}>› 50%</option>
      </select>
      <button class="btn btn-p btn-sm" onclick="runAI('decline')" ${aiLoading?'disabled':''}>${aiLoading?'<span class="spin">⏳</span>':'🤖'} Diagnostic IA</button>
      <button class="btn btn-sm" onclick="exportPompierCsv()">⬇ CSV</button><button class="btn btn-sm" onclick="exportPompierXlsx()" style="margin-left:4px">⬇ XLSX</button>
    </div>
  </div>`;

  if (!declining.length) {
    h += `<div class="alr alr-g">✓ Aucun ASIN en baisse de plus de ${threshold}%. Bonne nouvelle !</div>`;
    if (aiResult) { h += `<div class="cd"><div class="cd-t space"><span>🤖 Analyse IA</span>${isAIError(aiResult)?'':`<button class="btn btn-sm" onclick="copyAI()">📋 Copier</button>`}</div>`; h += isAIError(aiResult) ? renderAIError(aiResult, "runAI('decline')") : `<div class="ai-out">${renderMarkdown(aiResult)}</div>`; h += `</div>`; }
    return h;
  }

  // ── KPIs résumé ──
  h += `<div class="kpi-g" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
    <div class="kpi al"><div class="kpi-lb">ASINs en baisse</div><div class="kpi-v">${declining.length}</div></div>
    <div class="kpi al"><div class="kpi-lb">CA perdu estimé</div><div class="kpi-v" style="font-size:16px">-${fmtEur(totalLost)}</div></div>
    <div class="kpi"><div class="kpi-lb">CA total base</div><div class="kpi-v" style="font-size:16px">${fmtEur(totalCA)}</div></div>
    <div class="kpi"><div class="kpi-lb">Impact / CA</div><div class="kpi-v">${totalCA>0?Math.round(totalLost/totalCA*100):0}%</div></div>
  </div>`;

  // ── Tri Diagnostic CA ──
  let pompierSort = typeof window._pompierSort !== 'undefined' ? window._pompierSort : 'delta_asc';
  const thP = (label, key, align='r') => {
    const isA = pompierSort === key + '_desc' || pompierSort === key + '_asc';
    const isD = pompierSort === key + '_desc';
    const arr = isA ? (isD ? ' ▼' : ' ▲') : ' ⇅';
    const ns = isA && isD ? key + '_asc' : key + '_desc';
    return '<th class="' + align + '" style="cursor:pointer;user-select:none;white-space:nowrap;' + (isA?'color:var(--accent)':'') + '" onclick="window._pompierSort=\'' + ns + '\';render()">' + label + '<span style="font-size:9px;opacity:.6">' + arr + '</span></th>';
  };

  let decliningSorted = [...declining];
  if (pompierSort === 'delta_asc')     decliningSorted.sort((a,b) => parseNum(a.revenueDelta)-parseNum(b.revenueDelta));
  else if (pompierSort === 'delta_desc')    decliningSorted.sort((a,b) => parseNum(b.revenueDelta)-parseNum(a.revenueDelta));
  else if (pompierSort === 'ca_desc')       decliningSorted.sort((a,b) => (getRevenue(b,c)||0)-(getRevenue(a,c)||0));
  else if (pompierSort === 'ca_asc')        decliningSorted.sort((a,b) => (getRevenue(a,c)||0)-(getRevenue(b,c)||0));
  else if (pompierSort === 'lost_desc')     decliningSorted.sort((a,b) => Math.abs(parseNum(b.revenueDelta)/100*(getRevenue(b,c)||0))-Math.abs(parseNum(a.revenueDelta)/100*(getRevenue(a,c)||0)));
  else if (pompierSort === 'lost_asc')      decliningSorted.sort((a,b) => Math.abs(parseNum(a.revenueDelta)/100*(getRevenue(a,c)||0))-Math.abs(parseNum(b.revenueDelta)/100*(getRevenue(b,c)||0)));
  else if (pompierSort === 'stock_asc')     decliningSorted.sort((a,b) => (a.sellableUnits||9999)-(b.sellableUnits||9999));
  else if (pompierSort === 'stock_desc')    decliningSorted.sort((a,b) => (b.sellableUnits||9999)-(a.sellableUnits||9999));

  // ── Note explicative tendance ──
  h += '<div style="font-size:11px;color:var(--tx3);margin-bottom:10px;padding:8px 12px;background:var(--s2);border-radius:var(--rd);border-left:3px solid var(--bd2)">';
  h += '<b>💡 Tendance vs Δ CA :</b> La colonne <b>Δ CA</b> mesure la variation semaine en cours vs semaine précédente. ';
  h += 'La <b>Tendance</b> (sparkline) reflète la trajectoire structurelle sur les dernières semaines. ';
  h += 'Un ASIN peut afficher "Croissance" structurelle et -100% hebdo si cette semaine est une semaine sans commande (Amazon ne commande pas chaque semaine).';
  h += '</div>';

  // ── Tableau ──
  h += `<div class="tbl-wrap"><table class="tbl"><thead><tr>
    <th style="width:36px">Score</th>
    <th>Produit / ASIN</th>
    <th style="width:44px">Seg.</th>
    ${thP('CA actuel', 'ca')}
    ${thP('Δ CA', 'delta')}
    <th>Tendance <span style="font-size:9px;font-weight:400;color:var(--tx3)">(structurelle)</span></th>
    ${thP('CA perdu', 'lost')}
    ${thP('Stock', 'stock')}
    <th class="r">Retail%</th>
    <th></th>
  </tr></thead><tbody>`;

  decliningSorted.forEach(a => {
    const health = calcHealth(a);
    const seg = calcSegment(a, totalCA, c);
    const delta = parseNum(a.revenueDelta);
    const lost = Math.abs(delta / 100 * (getRevenue(a,c)||0));
    const isNoStock = (a.sellableUnits || 0) === 0;
    const trend = calcTrend(a);
    // Indiquer explicitement si croissance structurelle malgré baisse hebdo
    const isTrendContradiction = trend && trend.cls === 'trend-up' && delta <= -50;
    h += `<tr class="al-row" style="cursor:pointer" onclick="analyzeAsin('${esc(a.asin)}')">
      <td><div class="hs hs-sm ${healthClass(health)}">${health}</div></td>
      <td>
        <div style="font-weight:500;font-size:12px;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(a.title)}">${esc(shortName(a))}</div>
        <div style="font-size:10px;color:var(--tx3);font-family:var(--fm)">${a.asin} <span style="opacity:.6">${a.market||'.fr'}</span>${a.sourcingOnly ? '<span style="margin-left:4px;font-size:9px;font-weight:700;color:var(--a);background:var(--a-bg);border-radius:3px;padding:1px 4px">Appro</span>' : ''}</div>
      </td>
      <td>${segBadge(seg)}</td>
      <td class="r" style="font-weight:600">${fmtEur(getRevenue(a,c)||0)}</td>
      <td class="r"><span style="font-weight:700;color:var(--r)">▼ ${a.revenueDelta||'?'}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          ${sparkline(trend?.series, trend?.cls) + trendBadge(trend)}
          ${isTrendContradiction ? '<span title="Baisse hebdomadaire isolée sur tendance structurelle haussière" style="font-size:9px;color:var(--or);cursor:help">⚡ ponctuel</span>' : ''}
        </div>
      </td>
      <td class="r" style="color:var(--r);font-weight:600">-${fmtEur(lost)}</td>
      <td class="r"><span style="color:${isNoStock?'var(--r)':'inherit'};font-weight:${isNoStock?'700':'400'}">${isNoStock?'⚠ 0u':a.sellableUnits!=null?fmt(a.sellableUnits)+'u':'—'}</span></td>
      <td class="r">${a.retailPct||'—'}</td>
      <td>
        <button class="btn btn-xs btn-amazon" onclick="event.stopPropagation();openAmazonProduct('${esc(a.asin)}','${a.market||'.fr'}')" title="Amazon">🔗</button>
      </td>
    </tr>`;
  });
  h += `</tbody></table></div>`;

  // ── Résultat IA ──
  if (aiResult) {
    h += `<div class="cd" style="margin-top:14px"><div class="cd-t space"><span>🤖 Analyse IA</span><button class="btn btn-sm" onclick="copyAI()">📋 Copier</button></div>`;
    h += `<div class="ai-out">${renderMarkdown(aiResult)}</div></div>`;
  }

  return h;
}

// Parser la matrice tarif XML Vendor Central
// Structure réelle : ligne 2 = clés internes (asin_2, model_4...), données à partir ligne 8


// Calculer le plan de réappro pour un ASIN
function calcAppro(a, client, catalogueEntry, erpEntry) {
  const now = new Date();
  const leadTime    = client.leadTime    || 20;
  const stockTarget = client.stockTarget || 8;
  const moq         = client.moq         || 0;

  // ── 1. VÉLOCITÉ DE BASE (moyenne pondérée récente) ─────────────
  let velociteBase = 0;
  let velociteSource = 'hebdo';
  let velociteWarning = false;
  let nbPeriodes = 0;

  if (a.history?.length >= 2) {
    // Pondération décroissante : semaine la plus récente pèse 2× la plus ancienne
    const recent = a.history.slice(-8); // jusqu'à 8 semaines
    nbPeriodes = recent.length;
    // Poids : 1, 1.2, 1.4 ... 2× (linéaire)
    let sumW = 0, sumWV = 0;
    // Calculer le prix unitaire moyen pour fallback revenue→units
    const allRevs = recent.filter(h => (h.revenue||0) > 0);
    const allUnits = recent.filter(h => (h.units||0) > 0);
    const prixMoyen = (allRevs.length && allUnits.length)
      ? allRevs.reduce((s,h)=>s+(h.revenue||0),0) / allUnits.reduce((s,h)=>s+(h.units||0),0)
      : (getRevenue(a,client) && getUnits(a,client)) ? getRevenue(a,client) / getUnits(a,client) : 0;

    recent.forEach(function(h, i) {
      const w = 1 + (i / Math.max(nbPeriodes - 1, 1));
      sumW  += w;
      // Priorité : units réelles, fallback : revenue / prix moyen
      const u = (h.units || 0) > 0
        ? h.units
        : (prixMoyen > 0 && (h.revenue||0) > 0) ? Math.round(h.revenue / prixMoyen) : 0;
      sumWV += w * u;
    });
    velociteBase = sumWV / sumW;
    velociteSource = nbPeriodes + ' sem.';
    if (velociteBase <= 0 && prixMoyen > 0 && (getRevenue(a,client)||0) > 0) {
      // Dernier recours : vélocité depuis le revenue total de l'ASIN / prix
      velociteBase = getRevenue(a,client) / prixMoyen / Math.max(nbPeriodes, 1);
      velociteSource = 'est. rev. ⚠';
      velociteWarning = true;
    }
  } else if ((getUnits(a,client)||0) > 0) {
    velociteBase = getUnits(a,client);
    velociteWarning = true;
    velociteSource = '1 sem. ⚠';
    nbPeriodes = 1;
  } else if ((getRevenue(a,client)||0) > 0) {
    // Fallback : estimer depuis le revenue de la semaine courante
    const prixEst = (a.sellableUnits > 0 && getRevenue(a,client) > 0) ? getRevenue(a,client) / Math.max(getUnits(a,client)||1, 1) : 0;
    if (prixEst > 0) {
      velociteBase = getRevenue(a,client) / prixEst;
      velociteWarning = true;
      velociteSource = 'est. rev. ⚠';
      nbPeriodes = 1;
    }
  }
  if (velociteBase <= 0) return null;

  // ── 2. CORRECTION INTELLIGENTE PAR LA TENDANCE ─────────────────
  // Le principe : si la vélocité est en forte tendance, la moyenne historique
  // sous-estime (hausse) ou surestime (baisse) la réalité future.
  // On projette la tendance sur la moitié du lead time pour corriger.
  const trend = calcTrend(a);
  let velociteCorrigee = velociteBase;
  let correctionTendance = 0;
  let correctionNote = '';
  let confiance = 'moyenne'; // faible / moyenne / bonne / forte

  if (trend && nbPeriodes >= 3) {
    const slopePct = trend.slope; // % par semaine
    // Projection : vélocité dans (leadTime/2) semaines selon la tendance
    const facteurProjection = Math.min(leadTime / 2, 12); // cap à 12 semaines
    const velociteFuture = velociteBase * (1 + slopePct / 100 * facteurProjection);
    // Mélange 60% future / 40% base pour ne pas sur-réagir
    velociteCorrigee = Math.max(0.1, velociteBase * 0.4 + velociteFuture * 0.6);
    correctionTendance = Math.round((velociteCorrigee - velociteBase) * 10) / 10;

    if (slopePct > 15) {
      correctionNote = '⬆️ Tendance forte (+' + Math.round(slopePct) + '%/sem) — vélocité projetée majorée';
      confiance = nbPeriodes >= 6 ? 'bonne' : 'moyenne';
    } else if (slopePct > 5) {
      correctionNote = '↗️ Tendance haussière (+' + Math.round(slopePct) + '%/sem)';
      confiance = 'bonne';
    } else if (slopePct < -15) {
      correctionNote = '⬇️ Tendance forte (' + Math.round(slopePct) + '%/sem) — vélocité projetée réduite';
      confiance = nbPeriodes >= 6 ? 'bonne' : 'moyenne';
    } else if (slopePct < -5) {
      correctionNote = '↘️ Tendance baissière (' + Math.round(slopePct) + '%/sem)';
      confiance = 'bonne';
    } else {
      confiance = nbPeriodes >= 6 ? 'forte' : 'bonne';
    }
  } else if (nbPeriodes < 3) {
    confiance = nbPeriodes === 1 ? 'faible' : 'faible';
  }

  // ── 3. STOCK AMAZON + POs ──────────────────────────────────────
  const stockRenseigne = a.sellableUnits != null && a.sellableUnits !== undefined;
  const stockAmazon    = stockRenseigne ? (a.sellableUnits || 0) : null;
  const poData             = getPOsForAsin(a.asin, client);
  const openPO             = poData ? poData.qtyEnTransit : (a.openPOQty || 0);
  const rupturesFournisseur= poData ? poData.alertesFournisseur : [];
  const ruptureTotal       = poData ? poData.ruptureTotal : false;
  const rupturePartielle   = poData ? poData.rupturePartielle : false;
  const tauxAcceptation    = poData ? poData.tauxAcceptation : 100;
  const prochainelivraison = poData ? poData.prochainelivraison : null;
  const stockManquant      = !stockRenseigne;
  const prixAchat          = catalogueEntry?.prixAchat || 0;

  // ── 4. SIGNAL ERP — ARRIVÉES PLANIFIÉES ───────────────────────
  // L'ERP donne les horizons +15j, +1m, +3m — si le stock monte,
  // c'est qu'une livraison fournisseur est déjà planifiée.
  let erpArriveeEnCours = false;
  let erpArriveeQte    = 0;
  let erpNote          = '';
  let erpAlert         = false;
  const erp = erpEntry || null;
  if (erp) {
    const delta15j = (erp.s15 || 0) - (erp.s0 || 0);
    const delta1m  = (erp.s1m || 0) - (erp.s0 || 0);
    const delta3m  = (erp.s3m || 0) - (erp.s0 || 0);
    if (delta1m > 50) {
      erpArriveeEnCours = true;
      erpArriveeQte = Math.round(delta1m);
      erpNote = '📦 Arrivée ERP +1m : +' + erpArriveeQte + ' u planifiés';
    } else if (delta15j > 50) {
      erpArriveeEnCours = true;
      erpArriveeQte = Math.round(delta15j);
      erpNote = '📦 Arrivée ERP +15j : +' + erpArriveeQte + ' u planifiés';
    }
    // Alerte si stock ERP global insuffisant vs besoin calculé
    erpAlert = erp.s0 < velociteCorrigee * leadTime * 0.5;
  }

  // ── 5. CALCUL COUVERTURE & DATES ──────────────────────────────
  const couvertureAmazon = (stockAmazon !== null && velociteCorrigee > 0) ? stockAmazon / velociteCorrigee : null;
  const couvertureTotale = (stockAmazon !== null && velociteCorrigee > 0) ? (stockAmazon + openPO) / velociteCorrigee : null;

  const ruptureAmazonDate = couvertureAmazon !== null
    ? new Date(now.getTime() + couvertureAmazon * 7 * 86400000) : null;
  const dateLimiteCommande = ruptureAmazonDate
    ? new Date(ruptureAmazonDate.getTime() - leadTime * 7 * 86400000) : null;
  const joursAvantLimite    = dateLimiteCommande ? Math.round((dateLimiteCommande - now) / 86400000) : null;
  const semainesAvantLimite = joursAvantLimite !== null ? Math.round(joursAvantLimite / 7) : null;

  // ── 6. QUANTITÉ À COMMANDER ────────────────────────────────────
  const stockPourCalc   = stockAmazon !== null ? stockAmazon : 0;
  const stockNecessaire = velociteCorrigee * (leadTime + stockTarget);
  // Si arrivée ERP planifiée : déduire une partie (on reste prudent — 60% de l'arrivée)
  const deductionERP = erpArriveeEnCours ? Math.round(erpArriveeQte * 0.6) : 0;
  let qteACommander = Math.max(0, Math.round(stockNecessaire - stockPourCalc - openPO - deductionERP));
  if (moq > 0 && qteACommander > 0) {
    qteACommander = Math.ceil(qteACommander / moq) * moq;
  }

  // ── 7. NIVEAU DE CONFIANCE GLOBAL ────────────────────────────
  // Dégradé si : 1 seule semaine, pas de stock Amazon renseigné, pas de catalogue
  let confianceScore = confiance === 'forte' ? 4 : confiance === 'bonne' ? 3 : confiance === 'moyenne' ? 2 : 1;
  if (stockManquant) confianceScore = Math.min(confianceScore, 2);
  if (!catalogueEntry?.sku) confianceScore = Math.min(confianceScore, 2);
  const confianceLabel = ['', 'Faible', 'Moyenne', 'Bonne', 'Forte'][confianceScore];
  const confianceCls   = ['', 'var(--r)', 'var(--a)', 'var(--b)', 'var(--g)'][confianceScore];

  // ── 8. URGENCE ────────────────────────────────────────────────
  let urgence, urgenceCls, urgenceIcon;
  if (stockManquant) {
    urgence = 'Stock non renseigné'; urgenceCls = 'gr'; urgenceIcon = '⚪';
  } else if (semainesAvantLimite !== null && semainesAvantLimite <= 0) {
    urgence = 'Commander maintenant'; urgenceCls = 'r'; urgenceIcon = '🔴';
  } else if (semainesAvantLimite !== null && semainesAvantLimite <= 4) {
    urgence = 'Commander dans ' + semainesAvantLimite + ' sem.'; urgenceCls = 'a'; urgenceIcon = '🟡';
  } else if (semainesAvantLimite !== null && semainesAvantLimite <= 8) {
    urgence = 'Fenêtre dans ' + semainesAvantLimite + ' sem.'; urgenceCls = 'b'; urgenceIcon = '🔵';
  } else if (semainesAvantLimite !== null) {
    urgence = 'OK — ' + Math.round(couvertureTotale) + ' sem. de stock'; urgenceCls = 'g'; urgenceIcon = '🟢';
  } else {
    urgence = 'Calcul impossible'; urgenceCls = 'gr'; urgenceIcon = '⚪';
  }

  return {
    velocite:          Math.round(velociteBase * 10) / 10,
    velociteCorrigee:  Math.round(velociteCorrigee * 10) / 10,
    velociteSource, velociteWarning, correctionTendance, correctionNote,
    confianceScore, confianceLabel, confianceCls,
    stockAmazon: stockAmazon !== null ? stockAmazon : '—',
    stockManquant, openPO,
    couvertureAmazon, couvertureTotale,
    ruptureAmazonDate, dateLimiteCommande,
    semainesAvantLimite, joursAvantLimite,
    qteACommander:  stockManquant ? null : qteACommander,
    deductionERP,
    prixAchat,
    valeurCommande: (stockManquant || !qteACommander) ? 0 : qteACommander * prixAchat,
    urgence, urgenceCls, urgenceIcon,
    tendanceNote: correctionNote, // rétrocompatibilité exports
    sku:  catalogueEntry?.sku  || '',
    ean:  catalogueEntry?.ean  || '',
    description: catalogueEntry?.description || a.title || '',
    rupturesFournisseur, ruptureTotal, rupturePartielle,
    tauxAcceptation, prochainelivraison,
    hasPOData: !!poData,
    erpNote, erpAlert, erpArriveeEnCours, erpArriveeQte,
    erp
  };
}

// ── Domaines VC par marché ──────────────────────────────────────
const VC_DOMAINS = {
  '.fr':'vendorcentral.amazon.fr', '.de':'vendorcentral.amazon.de',
  '.it':'vendorcentral.amazon.it', '.es':'vendorcentral.amazon.es',
  '.co.uk':'vendorcentral.amazon.co.uk', '.nl':'vendorcentral.amazon.nl',
  '.be':'vendorcentral.amazon.com.be', '.se':'vendorcentral.amazon.se', '.pl':'vendorcentral.amazon.pl'
};

const MARKET_LANG = {
  '.fr':    { lang:'fr', label:'Français',     flag:'🇫🇷' },
  '.de':    { lang:'de', label:'Allemand',     flag:'🇩🇪' },
  '.it':    { lang:'it', label:'Italien',      flag:'🇮🇹' },
  '.es':    { lang:'es', label:'Espagnol',     flag:'🇪🇸' },
  '.co.uk': { lang:'en', label:'Anglais',      flag:'🇬🇧' },
  '.nl':    { lang:'nl', label:'Néerlandais',  flag:'🇳🇱' },
  '.be':    { lang:'fr', label:'Français (BE)',flag:'🇧🇪' },
  '.se':    { lang:'sv', label:'Suédois',      flag:'🇸🇪' },
  '.pl':    { lang:'pl', label:'Polonais',     flag:'🇵🇱' },
};



// ── Génère le script complet pour un client (tous rapports obsolètes) ──

// ── Configuration S3 imports ────────────────────────
function getS3Config() {
  return {
    bucket:  localStorage.getItem('ap-s3-bucket')  || 'amazon-pilot-imports-foliow',
    region:  localStorage.getItem('ap-s3-region')  || 'eu-west-3',
    enabled: localStorage.getItem('ap-s3-enabled') === '1',
  };
}

function saveS3Config(bucket, region, enabled) {
  localStorage.setItem('ap-s3-bucket',  bucket);
  localStorage.setItem('ap-s3-region',  region);
  localStorage.setItem('ap-s3-enabled', enabled ? '1' : '0');
  showToast('Configuration S3 sauvegardée', 'alr-g');
  render();
}

// ── Clé S3 pour un fichier client ───────────────────
// Ex: cogex/Ventes_ASIN_..._S16.csv
function getS3Key(clientName, filename) {
  const slug = clientName.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  return slug + '/' + filename;
}

// ── Générer URL pré-signée S3 PUT via API Gateway ───
// Nécessite un endpoint Lambda qui génère les URLs pré-signées
async function getS3PresignedUrl(clientName, filename) {
  const cfg = getS3Config();
  if (!cfg.enabled) return null;
  const apiUrl = localStorage.getItem('ap-s3-api-url');
  if (!apiUrl) return null;
  try {
    const key = getS3Key(clientName, filename);
    const resp = await fetch(apiUrl + '/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: cfg.bucket, key, region: cfg.region })
    });
    if (!resp.ok) return null;
    const { url } = await resp.json();
    return url;
  } catch(e) {
    return null;
  }
}

// ── Poll S3 pour détecter nouveaux fichiers ──────────
let _s3PollHandle = null;
let _s3KnownKeys  = new Set();


function activateS3Poll() {
  const u = document.getElementById('s3-api-url');
  const b = document.getElementById('s3-bucket');
  if (!u || !b) { showToast('Champs introuvables', 'alr-a'); return; }
  const url = u.value.trim(), bkt = b.value.trim();
  if (!url || !bkt) { showToast('Remplissez URL et bucket', 'alr-a'); return; }
  localStorage.setItem('ap-s3-api-url', url);
  saveS3Config(bkt, 'eu-west-3', true);
  startS3Poll();
}

function startS3Poll() {
  stopS3Poll();
  const cfg = getS3Config();
  if (!cfg.enabled) return;
  const c = cl();
  if (!c) return;

  // Charger les clés déjà traitées depuis localStorage
  const stored = localStorage.getItem('ap-s3-known-' + c.id);
  if (stored) { try { JSON.parse(stored).forEach(k => _s3KnownKeys.add(k)); } catch(e) {} }

  _s3PollHandle = setInterval(function() {
    pollS3Imports().catch(function(e) { console.warn('[AP] pollS3 error:', e.message); });
  }, 10000);

  // Première vérification immédiate
  pollS3Imports().catch(function(e) { console.warn('[AP] pollS3 error:', e.message); });
}

function stopS3Poll() {
  if (_s3PollHandle) { clearInterval(_s3PollHandle); _s3PollHandle = null; }
}

async function pollS3Imports() {
  const cfg = getS3Config();
  if (!cfg.enabled) return;
  const c = cl();
  if (!c) return;

  const apiUrl = localStorage.getItem('ap-s3-api-url');
  if (!apiUrl) return;

  try {
    const slug = c.name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');

    const resp = await fetch(apiUrl + '/list?prefix=' + slug + '/');
    if (!resp.ok) return;
    let _parsedList;
    try {
      _parsedList = await resp.json();
    } catch(jsonErr) {
      console.warn('[AP] pollS3 JSON parse error:', jsonErr.message);
      return;
    }
    const { files } = _parsedList || {};

    const newFiles = (files || []).filter(f => !_s3KnownKeys.has(f.key) && f.size > 0);
    if (!newFiles.length) return;

    for (const file of newFiles) {
      try {
        // Télécharger le fichier depuis S3
        const dlResp = await fetch(apiUrl + '/download?key=' + encodeURIComponent(file.key));
        if (!dlResp.ok) continue;
        const text = await dlResp.text();

        // Router vers le bon parser
        const lower = file.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        let imported = false;

        if (lower.includes('vente') || lower.includes('sales')) {
          const parsed = parseCSVFile(text, file.name);
          if (!parsed.error) { mergeImportData(c, [parsed]); imported = true; }
        } else if (lower.includes('trafic') || lower.includes('traffic')) {
          const parsed = parseCSVFile(text, file.name);
          if (!parsed.error) { mergeImportData(c, [parsed]); imported = true; }
        } else if (lower.includes('stock') || lower.includes('inventory')) {
          const parsed = parseCSVFile(text, file.name);
          if (!parsed.error) { mergeImportData(c, [parsed]); imported = true; }
        } else if (lower.includes('prevision') || lower.includes('forecast')) {
          const res = parseForecastFile(text, file.name);
          if (!res.error) { c.forecastData = Object.assign(c.forecastData||{}, res.forecastData); imported = true; }
        } else if (lower.includes('ppm') || lower.includes('netppm')) {
          const res = parsePPMFile(text, file.name);
          if (!res.error) { c.ppmData = Object.assign(c.ppmData||{}, res.ppmData); imported = true; }
        }

        if (imported) {
          _s3KnownKeys.add(file.key);
          // Persister les clés traitées
          localStorage.setItem('ap-s3-known-' + c.id, JSON.stringify([..._s3KnownKeys]));
          save();
          render();
          showToast('✅ ' + file.name + ' importé automatiquement depuis S3', 'alr-g', 6000);
        }
      } catch(e) { /* fichier inaccessible */ }
    }
  } catch(e) { /* poll silencieux */ }
}

function generateFullScript(c) {
  const ef = getEnrichedFreshness(c);
  const markets = c.markets && c.markets.length ? c.markets : [c.mainMarket || '.fr'];
  const mainMkt = c.mainMarket || markets[0];
  const now = new Date();
  const todayStr = now.toLocaleDateString('fr-FR');
  const timeStr  = now.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
  const profileName = c.name || 'ce client';
  const rapports = [];

  // ── Collecter les rapports à télécharger ──────────────
  const hebdoTypes = [
    { key:'ventes',      icon:'💰', label:'Ventes (Fabrication)',       path:'/retail-analytics/dashboard/sales?compare-prior=true&compare-yoy=true&distributorView=manufacturing&submit=true&time-period=weekly' },
    { key:'ventesAppro', icon:'💰', label:'Ventes (Approvisionnement)', path:'/retail-analytics/dashboard/sales?compare-prior=true&compare-yoy=true&distributorView=sourcing&submit=true&time-period=weekly' },
    { key:'trafic',      icon:'👁', label:'Trafic',                     path:'/retail-analytics/dashboard/traffic' },
    { key:'stock',       icon:'📦', label:'Stock (Fabrication)',        path:'/retail-analytics/dashboard/inventory?compare-prior=true&compare-yoy=true&distributorView=manufacturing&submit=true&time-period=weekly' },
    { key:'stockAppro',  icon:'📦', label:'Stock (Approvisionnement)',  path:'/retail-analytics/dashboard/inventory?compare-prior=true&compare-yoy=true&distributorView=sourcing&submit=true&time-period=weekly' },
  ];
  const hasFabBrandsAgent = (c.brands||[]).some(b=>b.role==='fabricant');
  hebdoTypes.forEach(function(t) {
    // ventesAppro et stockAppro : uniquement si le client a des marques fabricant
    if ((t.key === 'ventesAppro' || t.key === 'stockAppro') && !hasFabBrandsAgent) return;
    if (!ef[t.key] || ef[t.key].status !== 'ok') {
      markets.forEach(function(mkt) {
        const domain = VC_DOMAINS[mkt] || VC_DOMAINS['.fr'];
        rapports.push({ type: t.key, icon: t.icon, label: t.label + ' (' + mkt.replace('.','').toUpperCase() + ')',
          url: 'https://' + domain + t.path, format: 'CSV', config: 'hebdo' });
      });
    }
  });
  if (ef.pos.status !== 'ok') {
    const domain = VC_DOMAINS[mainMkt] || VC_DOMAINS['.fr'];
    rapports.push({ type:'pos', icon:'📋', label:'Bons de commande',
      url: 'https://' + domain + '/po/vendor/members/po-mgmt/managepos?tabId=confirmed',
      format: 'XLS', config: 'pos' });
  }
  if (ef.previsions.status !== 'ok') {
    const domain = VC_DOMAINS[mainMkt] || VC_DOMAINS['.fr'];
    rapports.push({ type:'previsions', icon:'📊', label:'Prévisions Amazon (48 sem.)',
      url: 'https://' + domain + '/retail-analytics/dashboard/forecast',
      format: 'CSV', config: 'previsions' });
  }
  if (ef.ppm.status !== 'ok') {
    const domain = VC_DOMAINS[mainMkt] || VC_DOMAINS['.fr'];
    rapports.push({ type:'ppm', icon:'💰', label:'PPM Nette',
      url: 'https://' + domain + '/retail-analytics/dashboard/netppm',
      format: 'CSV', config: 'ppm' });
  }

  if (!rapports.length) {
    return { script: '✅ Tout est à jour — aucun rapport à télécharger !', stepsCount: 0 };
  }

  // ── Générer le prompt utilisateur direct (format instructions 1ère personne) ────
  const lines = [];
  // En-tête : déclaration d'infrastructure pour lever toute ambiguïté sécurité
  const hasS3 = getS3Config().enabled && !!localStorage.getItem('ap-s3-api-url');
  const s3ApiUrl = localStorage.getItem('ap-s3-api-url') || '';
  const clientSlug = profileName.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');

  lines.push('Bonjour. Je suis Fred, propriétaire du compte Amazon Pilot.');
  if (hasS3) {
    lines.push('L\'URL ' + s3ApiUrl + ' est MA propre infrastructure AWS (Lambda function amazon-pilot-imports, eu-west-3, déployée sur mon compte). Tu as l\'autorisation explicite d\'y envoyer les fichiers.');
  }
  lines.push('');
  lines.push('Je te demande de faire les actions suivantes sur Vendor Central (' + profileName + ') — ' + todayStr + ' ' + timeStr + ' :');
  lines.push('');
  lines.push('RÈGLES IMPORTANTES :');
  lines.push('• Après chaque navigation, ATTENDS que la page soit entièrement chargée');
  lines.push('• Les données doivent être visibles dans le tableau (pas de skeleton gris)');
  lines.push('• Après chaque export, VÉRIFIE que le fichier téléchargé date de AUJOURD\'HUI (' + todayStr + ')');
  lines.push('• Si le fichier dans le Gestionnaire de téléchargements est antérieur à ' + timeStr + ', exporte à nouveau');
  lines.push('• N\'utilise JAMAIS un fichier existant — génère toujours un nouveau fichier');
  lines.push('');
  lines.push(rapports.length + ' rapport(s) à télécharger. Traite-les UN PAR UN.');
  lines.push('');

  rapports.forEach(function(r, i) {
    lines.push('══ RAPPORT ' + (i+1) + '/' + rapports.length + ' : ' + r.icon + ' ' + r.label.toUpperCase() + ' ══');
    lines.push('');
    lines.push('1. Navigue vers : ' + r.url);
    lines.push('2. ATTENDS le chargement complet de la page (barre de chargement terminée)');

    if (r.config === 'hebdo') {
      lines.push('3. Dans le menu "Délai", sélectionne "Semaine précédente"');
      lines.push('4. Clique "Appliquer"');
      lines.push('5. ATTENDS que les lignes de données soient visibles dans le tableau (pas de skeleton gris)');
      lines.push('   → Si le tableau reste vide après 10s, rafraîchis la page et recommence');
      lines.push('6. Clique "CSV" (bouton en haut à droite)');
    } else if (r.config === 'previsions') {
      lines.push('3. Vérifie que "Afficher par" = "ASIN"');
      lines.push('4. IMPORTANT : si le champ "Rechercher des ASIN" contient un ASIN, clique sur la croix pour l\'effacer');
      lines.push('   → Le champ doit être vide pour exporter TOUS les ASINs');
      lines.push('5. Statistique de prévision = "Moyenne"');
      lines.push('6. Clique "Appliquer"');
      lines.push('7. ATTENDS que le tableau affiche des données réelles (lignes avec des nombres)');
      lines.push('   → Si skeleton gris après 15s, rafraîchis et recommence');
      lines.push('8. Clique "CSV"');
    } else if (r.config === 'ppm') {
      lines.push('3. Vérifie que "Afficher par" = "ASIN"');
      lines.push('4. Période = "Année en cours"');
      lines.push('5. Clique "Appliquer"');
      lines.push('6. ATTENDS les données dans le tableau');
      lines.push('7. Clique "CSV"');
    } else if (r.config === 'pos') {
      lines.push('3. Vérifie que l\'onglet "Confirmé" est actif');
      lines.push('4. Date début = 01/01/' + now.getFullYear() + ' | Date fin = aujourd\'hui');
      lines.push('5. Clique "Trier et filtrer" pour appliquer');
      lines.push('6. Clique le menu déroulant "Exporter le bon de commande vers Excel"');
      lines.push('7. Sélectionne "Exporter les articles du bon de commande vers Excel"');
    }

    lines.push('');
    lines.push('✅ VÉRIFICATION OBLIGATOIRE :');
    lines.push('   Ouvre le Gestionnaire de téléchargements (Ctrl+J)');
    lines.push('   Le fichier le plus récent doit dater de ' + todayStr + ' après ' + timeStr);
    lines.push('   Si ce n\'est pas le cas, recommence l\'export depuis l\'étape 3');
    lines.push('');

    // Upload S3 immédiat si configuré
    const s3CfgCheck = getS3Config();
    const s3ApiUrlCheck = localStorage.getItem('ap-s3-api-url');
    if (s3CfgCheck.enabled && s3ApiUrlCheck) {
      const clientSlugCheck = profileName.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
      lines.push('📤 UPLOAD S3 IMMÉDIAT :');
      lines.push('   Dans le Gestionnaire de téléchargements (Ctrl+J),');
      lines.push('   clique droit sur le fichier → "Afficher dans le dossier"');
      lines.push('   Puis dans la console (F12) exécute :');
      lines.push('');
      lines.push('   fetch("' + s3ApiUrlCheck + '/presign", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:"' + clientSlugCheck + '/" + document.querySelector("cr-download-item")?.shadowRoot?.querySelector(".file-name")?.textContent?.trim()?.replace(/\s/g,"_") || "rapport-' + new Date().toISOString().slice(0,10) + '.csv"})}).then(r=>r.json()).then(d=>console.log("Clé S3:",d.key,"URL:",d.url?"OK":"ERREUR"))');
      lines.push('');
      lines.push('   Amazon Pilot importera le fichier automatiquement dans les 10s.');
      lines.push('');
    }

    // Bloc PowerShell supprimé — remplacé par instruction directe dans le prompt utilisateur
    // L'upload est déjà couvert par le bloc "upload S3 immédiat" ci-dessus
    if (i < rapports.length - 1) {
      lines.push('→ Rapport ' + (i+1) + '/' + rapports.length + ' terminé. Passe au rapport suivant.');
      lines.push('');
    }
  });

  lines.push('══════════════════════════════════════════');
  lines.push('✅ Tous les rapports sont téléchargés et uploadés.');
  if (hasS3) {
    lines.push('Amazon Pilot détecte les fichiers automatiquement via S3 (poll toutes les 10s).');
    lines.push('Confirme-moi quand tous les uploads sont terminés en indiquant les noms de fichiers uploadés.');
  } else {
    lines.push('Retourne dans Amazon Pilot → Import données');
    lines.push('Dépose les ' + rapports.length + ' fichier(s) dans les zones correspondantes.');
    lines.push('');
    lines.push('💡 Pour automatiser l\'import : configure le poll S3 dans Agent Import → Configuration S3');
  }

  return { script: lines.join('\n'), stepsCount: rapports.length };
}

function copyFullScript(clientId) {
  const c = clients.find(x => x.id === clientId);
  if (!c) return;
  const { script, stepsCount } = generateFullScript(c);
  navigator.clipboard.writeText(script).then(function() {
    showToast(stepsCount === 0 ? '✅ Tout est à jour !' : '📋 Script copié — ' + stepsCount + ' étape(s) à exécuter dans Claude in Chrome', 'alr-g', 6000);
  }).catch(function() {
    showToast('Copie impossible — vérifiez les permissions', 'alr-a');
  });
}

// ── File System Access API — surveillance dossier Téléchargements ──
let _fsWatchHandle = null;
let _fsDir = null;
let _fsKnownFiles = new Set();

async function requestDownloadsAccess() {
  if (!window.showDirectoryPicker) {
    showToast('File System Access non supporté dans ce navigateur', 'alr-r');
    return false;
  }
  try {
    _fsDir = await window.showDirectoryPicker({ mode: 'read', startIn: 'downloads' });
    localStorage.setItem('ap-fs-granted', '1');
    showToast('✅ Accès au dossier autorisé — surveillance active', 'alr-g');
    startFileWatch();
    render();
    return true;
  } catch(e) {
    if (e.name !== 'AbortError') showToast('Accès refusé : ' + e.message, 'alr-r');
    return false;
  }
}

function stopFileWatch() {
  if (_fsWatchHandle) { clearInterval(_fsWatchHandle); _fsWatchHandle = null; }
}

function startFileWatch() {
  stopFileWatch();
  if (!_fsDir) return;
  _fsWatchHandle = setInterval(async function() {
    try {
      const newFiles = [];
      for await (const [name, handle] of _fsDir.entries()) {
        if (handle.kind !== 'file') continue;
        if (_fsKnownFiles.has(name)) continue;
        const lower = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // Détecter les exports Amazon par nom de fichier
        if (lower.includes('ventes') || lower.includes('vente') || lower.includes('sales') ||
            lower.includes('trafic') || lower.includes('traffic') ||
            lower.includes('stock') || lower.includes('inventory') ||
            lower.includes('prevision') || lower.includes('prévision') || lower.includes('forecast') ||
            lower.includes('ppm') || lower.includes('netppm') ||
            lower.includes('bons_de_commande') || lower.includes('bonsdecommande') || lower.includes('purchase_order') ||
            lower.includes('retail_analytics') || lower.includes('vendor')) {
          _fsKnownFiles.add(name);
          newFiles.push({ name, handle });
        }
      }
      if (newFiles.length) autoImportFiles(newFiles);
    } catch(e) { /* dossier inaccessible */ }
  }, 3000); // vérifie toutes les 3 secondes
}

async function autoImportFiles(newFiles) {
  const c = cl();
  if (!c) return;
  let imported = 0;
  for (const { name, handle } of newFiles) {
    try {
      const file = await handle.getFile();
      // Attendre que le fichier soit stable (fini de télécharger)
      await new Promise(r => setTimeout(r, 1500));
      const file2 = await handle.getFile();
      if (file2.size !== file.size) { _fsKnownFiles.delete(name); continue; } // encore en cours

      const text = await file2.text();
      // Normaliser le nom : supprimer accents + minuscules pour la détection
      const lower = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

      // Router vers le bon parser
      if (lower.includes('vente') || lower.includes('sales')) {
        const parsed = parseCSVFile(text, name);
        if (!parsed.error) { mergeImportData(c, [parsed]); imported++; }
      } else if (lower.includes('trafic') || lower.includes('traffic')) {
        const parsed = parseCSVFile(text, name);
        if (!parsed.error) { mergeImportData(c, [parsed]); imported++; }
      } else if (lower.includes('stock') || lower.includes('inventory')) {
        const parsed = parseCSVFile(text, name);
        if (!parsed.error) { mergeImportData(c, [parsed]); imported++; }
      } else if (lower.includes('prevision') || lower.includes('prévision') || lower.includes('forecast')) {
        const res = parseForecastFile(text, name);
        if (!res.error) { c.forecastData = Object.assign(c.forecastData||{}, res.forecastData); imported++; }
      } else if (lower.includes('ppm') || lower.includes('netppm')) {
        const res = parsePPMFile(text, name);
        if (!res.error) { c.ppmData = Object.assign(c.ppmData||{}, res.ppmData); imported++; }
      } else if (lower.includes('bons') || lower.includes('purchase') || lower.includes('po')) {
        // XLS — lire en ArrayBuffer
        const buf = await file2.arrayBuffer();
        const blob = new Blob([buf]);
        const fakeFile = new File([blob], name);
        parsePOFile(fakeFile).then(function(res) {
          if (!res.error) {
            const existing = c.pos || [];
            c.pos = existing.filter(p=>!res.pos.some(n=>n.poId===p.poId&&n.asin===p.asin)).concat(res.pos);
            save(); render();
            showToast('📋 ' + res.count + ' POs importés automatiquement', 'alr-g');
          }
        });
        continue;
      }
    } catch(e) { /* fichier inaccessible */ }
  }
  if (imported > 0) {
    save(); render();
    showToast('✅ ' + imported + ' rapport(s) importé(s) automatiquement', 'alr-g', 6000);
  }
}

// ── renderAgent — refonte complète ─────────────────────────────
function renderAgent() {
  const c = cl();
  if (!c) return renderWelcome();

  const now  = new Date();
  const week = getISOWeek(now);
  const year = now.getFullYear();
  const ef   = getEnrichedFreshness(c);
  const markets = c.markets && c.markets.length ? c.markets : [c.mainMarket || '.fr'];
  const fsGranted = !!localStorage.getItem('ap-fs-granted');
  const fsActive  = !!_fsDir;

  // Score global fraîcheur
  const allStatus = Object.values(ef).map(r => r.status);
  const allOk     = allStatus.every(s => s === 'ok');
  const hasMissing= allStatus.some(s => s === 'missing');

  const { stepsCount } = generateFullScript(c);

  let h = '<div style="max-width:860px;margin:0 auto">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">';
  h += '<div><h2 style="font-size:17px;font-weight:700;margin-bottom:2px">🤖 Agent Import — ' + esc(c.name) + '</h2>';
  h += '<p style="font-size:12px;color:var(--tx3)">S' + week + ' ' + year + ' · Profil Chrome : <strong>' + esc(c.name) + '</strong> · Marchés : ' + markets.join(', ') + '</p></div>';

  // Bouton principal
  const btnLabel = stepsCount === 0 ? '✅ Tout est à jour' : '🚀 Tout mettre à jour (' + stepsCount + ' rapport' + (stepsCount>1?'s':'') + ')';
  const btnCls   = stepsCount === 0 ? 'btn-g' : hasMissing ? 'btn-r' : 'btn-p';
  h += '<button class="btn ' + btnCls + '" style="font-size:14px;padding:10px 20px" onclick="copyFullScript(\'' + c.id + '\')">' + btnLabel + '</button>';
  h += '</div>';

  // ── Import automatique — S3 (priorité) + File System (fallback) ──
  const s3Cfg    = getS3Config();
  const s3ApiUrl = localStorage.getItem('ap-s3-api-url') || '';
  const s3Active = s3Cfg.enabled && !!s3ApiUrl && !!_s3PollHandle;
  const s3Ready  = s3Cfg.enabled && !!s3ApiUrl;

  h += '<div class="cd">';
  h += '<div class="cd-t space"><span>📂 Import automatique</span>';
  const importBadge = s3Active ? 'pill-g' : s3Ready ? 'pill-a' : fsActive ? 'pill-g' : 'pill-gr';
  const importLabel = s3Active ? '✓ S3 Actif' : s3Ready ? '⚠ S3 Prêt' : fsActive ? '✓ Dossier local' : 'Inactif';
  h += '<span class="pill ' + importBadge + '">' + importLabel + '</span></div>';

  if (s3Active) {
    h += '<p style="font-size:12px;color:var(--g);margin-bottom:8px">✓ Poll S3 actif — fichiers uploadés détectés et importés automatiquement toutes les 10s.</p>';
    h += '<div style="display:flex;gap:8px">';
    h += '<button class="btn btn-sm" onclick="stopS3Poll();render()">⏹ Arrêter le poll</button>';
    h += '</div>';
  } else if (s3Ready) {
    h += '<p style="font-size:12px;color:var(--a);margin-bottom:8px">S3 configuré — poll inactif. Démarrez la surveillance.</p>';
    h += '<button class="btn btn-p" onclick="startS3Poll();render()">▶ Démarrer le poll S3</button>';
  } else {
    h += '<div style="margin-bottom:10px">';
    h += '<p style="font-size:12px;color:var(--tx2);margin-bottom:8px">Configurez le poll S3 pour importer automatiquement les fichiers téléchargés par l\'agent. N&eacute;cessite une Lambda /list /download.</p>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
    h += '<div><label style="font-size:10px;color:var(--tx3);display:block;margin-bottom:2px">URL API Lambda</label>';
    h += '<input id="s3-api-url" class="inp" placeholder="https://api.foliow.app" value="' + esc(s3ApiUrl) + '" style="font-size:11px"/></div>';
    h += '<div><label style="font-size:10px;color:var(--tx3);display:block;margin-bottom:2px">Bucket S3</label>';
    h += '<input id="s3-bucket" class="inp" placeholder="amazon-pilot-imports-foliow" value="' + esc(s3Cfg.bucket) + '" style="font-size:11px"/></div>';
    h += '</div>';
        h += '<button class="btn btn-sm btn-p" onclick="activateS3Poll()">✓ Activer</button>';
    h += '</div>';
    // Fallback File System si S3 non configuré
    h += '<hr style="border:none;border-top:1px solid var(--bd);margin:10px 0"/>';
    h += '<p style="font-size:11px;color:var(--tx3);margin-bottom:6px">Fallback : accès dossier local (limité sur OneDrive)</p>';
    if (fsActive) {
      h += '<p style="font-size:11px;color:var(--g)">✓ Surveillance dossier active</p>';
      h += '<button class="btn btn-xs" onclick="stopFileWatch();_fsDir=null;localStorage.removeItem(\'ap-fs-granted\');render()">⏹ Arrêter</button>';
    } else {
      h += '<button class="btn btn-xs" onclick="requestDownloadsAccess()">📂 Autoriser l\'acc&egrave;s au dossier</button>';
      if (fsGranted) h += ' <span style="font-size:10px;color:var(--tx3)">Révoqué — cliquer pour réautoriser</span>';
    }
  }
  h += '</div>';

  // Statut détaillé par rapport
  h += '<div class="cd"><div class="cd-t space"><span>📡 Statut fraîcheur</span>';
  h += '<span style="font-size:11px;color:var(--tx3)">' + (allOk ? '✓ Tout à jour' : stepsCount + ' rapport(s) à mettre à jour') + '</span></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">';

  const reportDefs = [
    { key:'ventes',     icon:'💰', label:'Ventes',          freq:'Hebdo' },
    { key:'trafic',     icon:'👁',  label:'Trafic',          freq:'Hebdo' },
    { key:'stock',      icon:'📦', label:'Stock',           freq:'Hebdo' },
    { key:'pos',        icon:'📋', label:'Bons de commande', freq:'Libre' },
    { key:'previsions', icon:'📊', label:'Prévisions',      freq:'Bimensuel' },
    { key:'ppm',        icon:'💰', label:'PPM Nette',        freq:'Mensuel' },
    { key:'annuel',     icon:'📅', label:'Historique annuel',freq:'Annuel' },
  ];

  reportDefs.forEach(function(d) {
    const r = ef[d.key];
    const color = r.status==='ok'?'var(--g)':r.status==='stale'?'var(--a)':'var(--r)';
    const bg    = r.status==='ok'?'var(--g-bg)':r.status==='stale'?'var(--a-bg)':'var(--r-bg)';
    const bd    = r.status==='ok'?'var(--g-bd)':r.status==='stale'?'var(--a-bd)':'var(--r-bd)';
    const lbl   = r.status==='ok'?'✓ À jour':r.status==='stale'?'⚠ Renouveler':'✕ Manquant';
    // Affichage enrichi selon le type de rapport
    let detail;
    if (d.key === 'annuel') {
      detail = r.detail || 'Historique annuel';
    } else if (r.days === null) {
      detail = 'Jamais importé';
    } else if (d.key === 'pos') {
      // BdC : fréquence libre, pas de sémantique semaine — affichage en jours uniquement
      detail = 'Importés il y a ' + r.days + 'j';
    } else if (d.key === 'ppm') {
      // PPM : mensuel, pas de sémantique semaine
      detail = 'Importée il y a ' + r.days + 'j';
    } else if (r.weeksBehind != null && r.weeksBehind > 0) {
      // Données hebdo en retard — garde '?' si lastWeek indisponible
      detail = 'S' + r.targetWeek + ' manquante — dernier import S' + (r.lastWeek || '?') + ' (il y a ' + r.days + 'j)';
    } else if (r.days != null) {
      // Données hebdo à jour
      detail = 'S' + (r.lastWeek || '?') + ' couverte — importé il y a ' + r.days + 'j';
    } else {
      detail = '—';
    }

    h += '<div style="padding:10px 12px;background:' + bg + ';border:1px solid ' + bd + ';border-radius:var(--rdl)">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
    h += '<span style="font-size:16px">' + d.icon + '</span>';
    h += '<span style="font-weight:600;font-size:12px;flex:1">' + d.label + '</span>';
    h += '<span style="font-size:9px;color:var(--tx3);background:var(--s2);padding:2px 6px;border-radius:8px">' + d.freq + '</span>';
    h += '</div>';
    h += '<div style="font-size:11px;font-weight:700;color:' + color + '">' + lbl + '</div>';
    h += '<div style="font-size:10px;color:var(--tx3);margin-top:2px">' + detail + '</div>';
    h += '</div>';
  });
  h += '</div></div>';

  // Script complet
  const { script } = generateFullScript(c);
  h += '<div class="cd"><div class="cd-t space"><span>📋 Script Claude in Chrome</span>';
  h += '<button class="btn btn-xs btn-p" onclick="copyFullScript(\'' + c.id + '\')">📋 Copier tout</button></div>';
  if (stepsCount === 0) {
    h += '<div class="alr alr-g">✅ Tous les rapports sont à jour — aucun script à exécuter.</div>';
  } else {
    h += '<p style="font-size:12px;color:var(--tx2);margin-bottom:10px">Copiez ce script et collez-le dans Claude in Chrome ouvert sur Vendor Central (profil <strong>' + esc(c.name) + '</strong>).</p>';
    h += '<pre style="background:var(--s1);border:1px solid var(--bd);border-radius:var(--rd);padding:14px;font-size:10px;line-height:1.8;color:var(--tx2);white-space:pre-wrap;overflow-x:auto;max-height:400px;overflow-y:auto">' + esc(script) + '</pre>';
  }
  h += '</div>';

  // Rappel auto
  const autoEnabled = localStorage.getItem('ap-agent-auto') !== 'off';
  h += '<div class="cd"><div class="cd-t space"><span>🔔 Rappel automatique</span>';
  h += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:400">';
  h += '<input type="checkbox" ' + (autoEnabled?'checked':'') + ' onchange="localStorage.setItem(\'ap-agent-auto\',this.checked?\'on\':\'off\');showToast(this.checked?\'Rappel activé\':\'Rappel désactivé\',\'alr-g\')"/> Bannière si données > 7 jours</label>';
  h += '</div><p style="font-size:12px;color:var(--tx3)">Apparaît dans Dashboard et Revue Hebdo dès qu\'un rapport est obsolète.</p></div>';

  h += '</div>';
  return h;
}
function renderPotentiel() {
  const c = cl();
  if (!c) return renderWelcome();
  if (!c.csvImported || !c.asins.length) {
    return '<div class="alr alr-a">Importez d\'abord des données CSV pour accéder au module Potentiel.</div>';
  }

  const hasPPM      = Object.keys(c.ppmData || {}).length > 0;
  const hasForecast = Object.keys(c.forecastData || {}).length > 0;

  let h = '<div style="max-width:1000px;margin:0 auto">';
  h += '<h2 style="font-size:17px;font-weight:700;margin-bottom:4px">🚀 ASINs à Potentiel — ' + esc(c.name) + '</h2>';
  h += '<p style="font-size:12px;color:var(--tx3);margin-bottom:16px">Score 0-100 basé sur 5 signaux : prévisions Amazon, tendance, PPM, stock, conversion. Les candidats BTR sont signalés automatiquement.</p>';

  // Bannière données manquantes
  if (!hasPPM || !hasForecast) {
    h += '<div style="padding:12px 16px;background:var(--a-bg);border:1px solid var(--a-bd);border-radius:var(--rdl);margin-bottom:14px;display:flex;align-items:center;gap:10px">';
    h += '<span style="font-size:20px">⚠️</span><div style="flex:1"><div style="font-weight:600;font-size:13px;color:var(--a)">Score partiel — données manquantes</div>';
    h += '<div style="font-size:11px;color:var(--tx2);margin-top:2px">';
    if (!hasPPM)      h += '💰 PPM nette non chargée (–20 pts max) ';
    if (!hasForecast) h += '📊 Prévisions non chargées (–25 pts max)';
    h += '</div></div>';
    h += '<button class="btn btn-sm" onclick="go(\'import\')" style="flex-shrink:0">📥 Charger</button>';
    h += '</div>';
  }

  // Calculer le score pour tous les ASINs actifs
  const activeAsins = c.asins.filter(a => (getRevenue(a,c)||0) > 50);
  const scored = activeAsins
    .map(a => ({ a, p: calcPotential(a, c) }))
    .sort((x, y) => y.p.score - x.p.score);

  const forts   = scored.filter(({p}) => p.level === 'fort');
  const moyens  = scored.filter(({p}) => p.level === 'moyen');
  const btrCandidats = scored.filter(({p}) => p.btrCandidat);

  // KPIs résumé
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">';
  [
    { label: 'Fort potentiel',   val: forts.length,        icon: '🚀', cls: 'g' },
    { label: 'Potentiel moyen',  val: moyens.length,       icon: '⭐', cls: 'a' },
    { label: 'Candidats BTR',    val: btrCandidats.length, icon: '🎯', cls: 'b' },
    { label: 'ASINs analysés',   val: activeAsins.length,  icon: '📦', cls: 'gr' },
  ].forEach(({ label, val, icon, cls }) => {
    h += '<div class="kpi" style="background:var(--s2)">';
    h += '<div class="kpi-lb">' + icon + ' ' + label + '</div>';
    h += '<div class="kpi-v" style="color:var(--' + cls + ')">' + val + '</div>';
    h += '</div>';
  });
  h += '</div>';

  // Filtre
  const filterStates = ['fort', 'moyen', 'tous', 'btr'];
  const potFilter = window._potFilter || 'fort';

  h += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">';
  h += '<button class="btn btn-sm" onclick="exportPotentielXlsx()" style="margin-left:auto">⬇ XLSX</button>';
  h += '</div><div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">';
  [
    { v:'fort',  l:'🚀 Fort potentiel ('  + forts.length  + ')' },
    { v:'moyen', l:'⭐ Moyen ('           + moyens.length  + ')' },
    { v:'btr',   l:'🎯 Candidats BTR ('   + btrCandidats.length + ')' },
    { v:'tous',  l:'Tous (' + scored.length + ')' },
  ].forEach(opt => {
    h += '<button class="btn btn-sm' + (potFilter === opt.v ? ' btn-p' : '') + '" onclick="window._potFilter=\'' + opt.v + '\';render()">' + opt.l + '</button>';
  });
  h += '</div>';

  // Liste filtrée
  const displayed = potFilter === 'fort'  ? forts
                  : potFilter === 'moyen' ? moyens
                  : potFilter === 'btr'   ? btrCandidats
                  : scored;

  if (!displayed.length) {
    h += '<div class="alr alr-a">Aucun ASIN dans cette catégorie avec les données actuelles.</div>';
    h += '</div>';
    return h;
  }

  // Tableau
  h += '<div class="tbl-wrap"><table class="tbl"><thead><tr>';
  h += '<th>ASIN</th><th class="r">Score</th><th>Niveau</th><th>Signaux clés</th>';
  if (hasForecast) h += '<th class="r">Prévision S+4</th>';
  if (hasPPM)      h += '<th class="r">PPM</th>';
  h += '<th class="r">CA sem.</th><th class="r">Stock</th><th></th>';
  h += '</tr></thead><tbody>';

  displayed.slice(0, 60).forEach(({ a, p }) => {
    const scoreColor = p.score >= 70 ? 'var(--g)' : p.score >= 45 ? 'var(--a)' : 'var(--tx3)';
    const signalsTop = p.signals.slice(0, 3);

    h += '<tr>';
    h += '<td><div style="font-weight:600;font-size:11px">' + a.asin + '</div><div style="font-size:10px;color:var(--tx3)">' + esc(shortName(a).slice(0,45)) + '</div>' + (p.btrCandidat ? '<span class="pill pill-b" style="font-size:9px">🎯 BTR</span>' : '') + '</td>';
    h += '<td class="r"><div style="font-size:20px;font-weight:800;color:' + scoreColor + '">' + p.score + '</div></td>';
    h += '<td><span class="pill pill-' + p.levelCls + '" style="font-size:10px">' + p.levelLabel + '</span></td>';
    h += '<td><div style="display:flex;flex-direction:column;gap:2px">';
    signalsTop.forEach(s => {
      h += '<div style="font-size:10px;color:var(--' + s.cls + ')">' + s.icon + ' ' + esc(s.label) + '</div>';
    });
    h += '</div></td>';

    if (hasForecast) {
      const fc = (c.forecastData || {})[a.asin];
      const s4 = fc ? Math.round((fc.weeks[1]+fc.weeks[2]+fc.weeks[3]+(fc.weeks[4]||0))/4) : null;
      const vel = getUnits(a,c)||0;
      const fcColor = s4 !== null && s4 > vel * 1.1 ? 'var(--g)' : s4 !== null && s4 < vel * 0.9 ? 'var(--r)' : 'var(--tx)';
      h += '<td class="r">' + (s4 !== null ? '<span style="font-weight:600;color:' + fcColor + '">' + s4 + 'u</span>' : '<span style="color:var(--tx3)">—</span>') + '</td>';
    }
    if (hasPPM) {
      const ppm = (c.ppmData || {})[a.asin];
      const ppmColor = ppm?.ppm >= 15 ? 'var(--g)' : ppm?.ppm < 5 ? 'var(--r)' : 'var(--a)';
      h += '<td class="r">' + (ppm?.ppm != null ? '<span style="font-weight:600;color:' + ppmColor + '">' + ppm.ppm.toFixed(1) + '%</span>' : '<span style="color:var(--tx3)">—</span>') + '</td>';
    }

    h += '<td class="r"><strong>' + fmtEur(getRevenue(a,c)||0) + '</strong></td>';
    h += '<td class="r">' + (a.sellableUnits != null ? fmt(a.sellableUnits) + 'u' : '<span style="color:var(--tx3)">—</span>') + '</td>';
    h += '<td><button class="btn btn-xs" onclick="selectedAsin=\'' + a.asin + '\';go(\'asins\')">→</button></td>';
    h += '</tr>';
  });

  h += '</tbody></table></div>';

  if (displayed.length > 60) {
    h += '<p style="font-size:11px;color:var(--tx3);margin-top:8px;text-align:center">' + (displayed.length - 60) + ' ASINs supplémentaires non affichés — affinez avec les filtres.</p>';
  }

  h += '</div>';
  return h;
}

let approsThreshold = 'all'; // 'urgent' | 'action' | 'all'

function renderAppros() {
  const c = cl();
  if (!c) return renderWelcome();
  if (!c.csvImported) return `<div class="alr alr-a">Importez d'abord des données CSV pour accéder au module appros.</div>`;

  let h = `<div style="max-width:960px;margin:0 auto">`;
  h += `<h2 style="font-size:17px;font-weight:700;margin-bottom:16px">🚢 Approvisionnements — ${esc(c.name)}</h2>`;

  // ── CHECKLIST INTÉGRATIONS ────────────────────────────────────
  const catCount  = c.catalogue?.length || 0;
  const erpCount  = c.erpStock ? Object.keys(c.erpStock).length : 0;
  const freshness = getDataFreshness(c);
  const stockAge  = freshness.stock?.daysSince;
  const ventesAge = freshness.ventes?.daysSince;

  // Évaluer chaque étape
  const step1ok  = catCount > 0;
  const step2ok  = erpCount > 0;
  const step3ok  = freshness.ventes?.status === 'ok';
  const step3age = (ventesAge != null && !isNaN(ventesAge)) ? ventesAge + 'j' : '—';
  const step4ok  = freshness.stock?.status === 'ok';
  const step4age = (stockAge != null && !isNaN(stockAge)) ? stockAge + 'j' : '—';

  // Alertes obsolescence
  const erpObsolete  = erpCount > 0 && c.erpStockDate && Math.floor((Date.now() - new Date(c.erpStockDate)) / 86400000) > 30;
  const catObsolete  = false; // pas de date de MAJ pour le catalogue XML pour l'instant
  const allStepsOk   = step1ok && step2ok && step3ok && step4ok;

  h += `<div style="border:1px solid var(--bd);border-radius:var(--rdl);padding:14px 16px;margin-bottom:16px;background:var(--s1)">`;
  h += `<div style="font-size:12px;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Checklist données — ${allStepsOk ? '<span style="color:var(--g)">✓ Tout est à jour</span>' : '<span style="color:var(--a)">Compléter pour un calcul précis</span>'}</div>`;
  h += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px">`;

  // Étape 1 — Catalogue XML
  h += `<div style="padding:10px 12px;border-radius:var(--rd);border:1px solid ${step1ok?'var(--g-bd)':'var(--a-bd)'};background:${step1ok?'var(--g-bg)':'var(--a-bg)'}">`;
  h += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">`;
  h += `<span style="font-size:15px">${step1ok?'✅':'1️⃣'}</span><span style="font-weight:700;font-size:12px">Matrice tarif XML</span>`;
  h += `<label class="btn btn-xs" style="cursor:pointer;margin-left:auto">`;
  h += `${step1ok?'🔄':'📁'} ${step1ok?'Recharger':'Charger'}`;
  h += `<input type="file" accept=".xml" onchange="handleMatriceTarif(this)" style="display:none"/></label></div>`;
  h += `<div style="font-size:10px;color:var(--tx3)">${step1ok ? catCount + ' ASINs · XML VC «Télécharger tous les coûts»' : '⚠ Requis pour les SKUs et prix achat'}</div></div>`;

  // Étape 2 — Stock ERP
  const erpDateStr = c.erpStockDate || '';
  h += `<div style="padding:10px 12px;border-radius:var(--rd);border:1px solid ${step2ok&&!erpObsolete?'var(--g-bd)':step2ok?'var(--a-bd)':'var(--a-bd)'};background:${step2ok&&!erpObsolete?'var(--g-bg)':'var(--a-bg)'}">`;
  h += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">`;
  h += `<span style="font-size:15px">${step2ok&&!erpObsolete?'✅':step2ok?'⚠️':'2️⃣'}</span><span style="font-weight:700;font-size:12px">Stock ERP fournisseur</span>`;
  h += `<label class="btn btn-xs" style="cursor:pointer;margin-left:auto">`;
  h += `${step2ok?'🔄':'📦'} ${step2ok?'Recharger':'Importer'}`;
  h += `<input type="file" accept=".xlsx,.xls" onchange="handleErpStock(this)" style="display:none"/></label></div>`;
  h += `<div style="font-size:10px;color:var(--tx3)">${step2ok ? erpCount + ' réf. · MAJ ' + erpDateStr + (erpObsolete?' · <span style="color:var(--r)">⚠ > 30j — à rafraîchir</span>':'') : '⚠ Recommandé — arrivées planifiées fournisseur'}</div></div>`;

  // Étape 3 — Ventes Amazon
  h += `<div style="padding:10px 12px;border-radius:var(--rd);border:1px solid ${step3ok?'var(--g-bd)':'var(--a-bd)'};background:${step3ok?'var(--g-bg)':'var(--a-bg)'}">`;
  h += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">`;
  h += `<span style="font-size:15px">${step3ok?'✅':'⚠️'}</span><span style="font-weight:700;font-size:12px">Ventes hebdo Amazon</span></div>`;
  h += `<div style="font-size:10px;color:var(--tx3)">${step3ok ? 'S' + (freshness.ventes?.lastWeek||'?') + ' · ' + step3age + ' · ' + (freshness.ventes?.coverDate||'') : 'S' + (freshness.ventes?.lastWeek||'?') + ' · <span style="color:var(--r)">S' + (freshness.ventes?.targetWeek||'?') + ' manquante</span>'}</div></div>`;

  // Étape 4 — Stock Amazon
  h += `<div style="padding:10px 12px;border-radius:var(--rd);border:1px solid ${step4ok?'var(--g-bd)':'var(--a-bd)'};background:${step4ok?'var(--g-bg)':'var(--a-bg)'}">`;
  h += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">`;
  h += `<span style="font-size:15px">${step4ok?'✅':'⚠️'}</span><span style="font-weight:700;font-size:12px">Stock Amazon</span></div>`;
  h += `<div style="font-size:10px;color:var(--tx3)">${step4ok ? 'S' + (freshness.stock?.lastWeek||'?') + ' · ' + step4age : 'Stock hebdo non importé cette semaine'}</div></div>`;

  h += `</div></div>`;

  // ── Paramètres appros ──────────────────────────────────────────
  h += `<div class="cd">`;
  h += `<div class="cd-t space"><span>⚙️ Paramètres</span></div>`;
  h += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:8px">`;

  h += `<div class="fg"><label class="fg-lb">Lead time fournisseur (sem.)</label>
    <input type="number" class="fg-in" value="${c.leadTime||20}" min="1" max="52"
      onchange="updClient('leadTime',+this.value);renderApprosResults()" style="width:100%"/>
    <div style="font-size:10px;color:var(--tx3);margin-top:3px">Fabrication + transport</div>
  </div>`;

  h += `<div class="fg"><label class="fg-lb">Stock cible Amazon (sem.)</label>
    <input type="number" class="fg-in" value="${c.stockTarget||8}" min="1" max="26"
      onchange="updClient('stockTarget',+this.value);renderApprosResults()" style="width:100%"/>
    <div style="font-size:10px;color:var(--tx3);margin-top:3px">Couverture souhaitée</div>
  </div>`;

  h += `<div class="fg"><label class="fg-lb">MOQ / Taille min. commande</label>
    <input type="number" class="fg-in" value="${c.moq||0}" min="0"
      onchange="updClient('moq',+this.value);renderApprosResults()" style="width:100%"/>
    <div style="font-size:10px;color:var(--tx3);margin-top:3px">0 = pas de contrainte</div>
  </div>`;

  h += `<div class="fg"><label class="fg-lb">Catalogue ASIN ↔ SKU</label>
    <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
      <span style="font-size:13px;font-weight:600;color:${catCount>0?'var(--g)':'var(--tx3)'}">${catCount > 0 ? catCount + ' ASINs' : 'Non chargé'}</span>
      <label class="btn btn-sm" style="cursor:pointer">
        📁 ${catCount > 0 ? 'Recharger' : 'Charger matrice tarif'}
        <input type="file" accept=".xml" onchange="handleMatriceTarif(this)" style="display:none"/>
      </label>
    </div>
    <div style="font-size:10px;color:var(--tx3);margin-top:3px">XML "Télécharger tous les coûts" depuis VC</div>
  </div>`;

  h += `<div class="fg"><label class="fg-lb">Stock ERP fournisseur</label>
    <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
      <span style="font-size:13px;font-weight:600;color:${erpCount>0?'var(--g)':'var(--tx3)'}">${erpCount > 0 ? erpCount + ' réf.' : 'Non chargé'}</span>
      <label class="btn btn-sm" style="cursor:pointer">
        📦 ${erpCount > 0 ? 'Recharger' : 'Importer Excel ERP'}
        <input type="file" accept=".xlsx,.xls" onchange="handleErpStock(this)" style="display:none"/>
      </label>
    </div>
    <div style="font-size:10px;color:var(--tx3);margin-top:3px">${erpCount > 0 ? 'MAJ ' + (c.erpStockDate||'') + ' — stock global tous canaux' : 'Export ERP onglet "Stock dispo réel"'}</div>
  </div>`;

  h += `</div></div>`;

  // Zone dynamique (re-rendue sans recréer les inputs)
  h += `<div id="appros-results"></div>`;
  h += `</div>`;
  return h;
}

// Re-render partiel du tableau Appros (sans toucher aux inputs paramètres)
function renderApprosResults() {
  const el = document.getElementById('appros-results');
  if (!el) {
    // Le div n'est pas encore dans le DOM — réessayer dans 100ms
    if (screen === 'appros') setTimeout(renderApprosResults, 100);
    return;
  }
  const c = cl();
  if (!c) return;
  let h = '';
  const allPosList   = c.pos || [];
  const posRuptTotal = allPosList.filter(p=>(p.qty||0)>0&&(p.qtyAccepted??p.qty)===0);
  const posRuptPart  = allPosList.filter(p=>{const q=p.qty||0,a=p.qtyAccepted??q;return q>0&&a>0&&a<q*0.8;});
  const ainsTotaux   = [...new Set(posRuptTotal.map(p=>p.asin))];
  const ainsPartiels = [...new Set(posRuptPart.map(p=>p.asin))];
  if (ainsTotaux.length || ainsPartiels.length) {
    h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">';
    if (ainsTotaux.length) h += `<div style="flex:1;min-width:200px;padding:12px 16px;background:var(--r-bg);border:1px solid var(--r-bd);border-radius:var(--rdl);display:flex;align-items:center;gap:10px"><span style="font-size:22px">🚫</span><div><div style="font-weight:700;font-size:13px;color:var(--r)">Rupture totale fournisseur</div><div style="font-size:11px;color:var(--tx2);margin-top:2px">${ainsTotaux.length} ASIN(s) — rien livré</div></div></div>`;
    if (ainsPartiels.length) h += `<div style="flex:1;min-width:200px;padding:12px 16px;background:var(--a-bg);border:1px solid var(--a-bd);border-radius:var(--rdl);display:flex;align-items:center;gap:10px"><span style="font-size:22px">⚠️</span><div><div style="font-weight:700;font-size:13px;color:var(--a)">Rupture partielle fournisseur</div><div style="font-size:11px;color:var(--tx2);margin-top:2px">${ainsPartiels.length} ASIN(s) — livraison incomplète</div></div></div>`;
    h += '</div>';
  } else if (allPosList.length > 0) {
    h += `<div style="padding:10px 14px;background:var(--g-bg);border:1px solid var(--g-bd);border-radius:var(--rdl);margin-bottom:12px;font-size:12px;color:var(--g);font-weight:600">✓ Fournisseur OK — ${allPosList.length} PO(s) chargé(s), aucune rupture détectée</div>`;
  }

  // ── Filtre affichage ──────────────────────────────────────────
  h += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">`;
  [
    { v: 'urgent', l: '🔴 Commande urgente', cls: 'r' },
    { v: 'action', l: '🟡 Action < 4 sem.',  cls: 'a' },
    { v: 'all',    l: 'Tous les ASINs actifs', cls: 'gr' },
  ].forEach(opt => {
    h += `<button class="btn btn-sm${approsThreshold===opt.v?' btn-'+opt.cls:''}" onclick="approsThreshold='${opt.v}';render()">${opt.l}</button>`;
  });
  h += `<button class="btn btn-sm" onclick="exportApprosCsv()" style="margin-left:auto">⬇ CSV</button><button class="btn btn-sm" onclick="exportApprosXlsx()" style="margin-left:4px">⬇ XLSX</button>`;
  h += `</div>`;

  // ── Calcul et affichage du tableau ────────────────────────────
  // v3.6.2 : appliquer le filtre de recherche transversal
  const baseAsinsAppros = (asinSearch && asinSearch.trim()) ? getFilteredAsins(c) : c.asins;
  const activeAsins = baseAsinsAppros.filter(a => (getRevenue(a,c)||0) > 0);
  const catMap = {};
  (c.catalogue || []).forEach(e => { catMap[e.asin] = e; });

  // ERP stock map : ASIN → stock ERP via SKU (N° Article)
  const erpMap = {};
  if (c.erpStock && c.catalogue?.length) {
    c.catalogue.forEach(function(e) {
      if (e.sku && c.erpStock[e.sku]) erpMap[e.asin] = c.erpStock[e.sku];
      // Fallback EAN si SKU ne matche pas
      else if (e.ean && c.erpStock) {
        const byEan = Object.values(c.erpStock).find(function(s) { return s.ean === String(e.ean); });
        if (byEan) erpMap[e.asin] = byEan;
      }
    });
  }

  // Calculer pour tous les ASINs actifs
  const appros = activeAsins
    .map(a => ({ a, r: calcAppro(a, c, catMap[a.asin], erpMap[a.asin]) }))
    .filter(({ r }) => r !== null);

  // Filtrer selon seuil
  const filtered = appros.filter(({ r }) => {
    if (approsThreshold === 'urgent') return r.urgenceCls === 'r';
    if (approsThreshold === 'action') return r.urgenceCls === 'r' || r.urgenceCls === 'a';
    return true;
  });

  // Trier par urgence (rouge → orange → bleu → vert)
  const urgenceOrder = { r: 0, a: 1, b: 2, g: 3 };
  filtered.sort((x, y) => {
    const od = urgenceOrder[x.r.urgenceCls] - urgenceOrder[y.r.urgenceCls];
    if (od !== 0) return od;
    return x.r.semainesAvantLimite - y.r.semainesAvantLimite;
  });

  if (!filtered.length) {
    h += `<div class="alr alr-g">✓ Aucun ASIN nécessitant une action avec les paramètres actuels.</div>`;
  } else {
    // KPIs résumé
    const urgent    = filtered.filter(({r}) => r.urgenceCls === 'r').length;
    const action    = filtered.filter(({r}) => r.urgenceCls === 'a').length;
    const manquant  = filtered.filter(({r}) => r.stockManquant).length;
    const valTotale = filtered.reduce((s, {r}) => s + (r.valeurCommande || 0), 0);
    const qteTotale = filtered.reduce((s, {r}) => s + (r.qteACommander || 0), 0);
    const erpInsuf  = filtered.filter(({a, r}) => {
      return r.erpAlert;
    }).length;

    h += `<div class="kpi-g" style="margin-bottom:14px">`;
    h += `<div class="kpi${urgent>0?' al':''}"><div class="kpi-lb">🔴 Urgents</div><div class="kpi-v">${urgent}</div></div>`;
    h += `<div class="kpi${action>0?' warn':''}"><div class="kpi-lb">🟡 À planifier</div><div class="kpi-v">${action}</div></div>`;
    h += `<div class="kpi"><div class="kpi-lb">Qté totale à commander</div><div class="kpi-v">${fmt(qteTotale)}</div></div>`;
    h += valTotale > 0 ? `<div class="kpi"><div class="kpi-lb">Valeur commande estimée</div><div class="kpi-v">${fmtEur(valTotale)}</div></div>` : '';
    h += manquant > 0 ? `<div class="kpi warn"><div class="kpi-lb">⚪ Stock non renseigné</div><div class="kpi-v">${manquant}</div><div style="font-size:9px;color:var(--tx3)">Importer fichier Stock hebdo</div></div>` : '';
    h += erpInsuf > 0 ? `<div class="kpi al"><div class="kpi-lb">🏭 Stock ERP insuffisant</div><div class="kpi-v">${erpInsuf}</div><div style="font-size:9px;color:var(--tx3)">Stock global < qté à commander</div></div>` : '';
    h += `</div>`;

    // ── Bouton analyse IA + zone résultat ────────────────────────
    h += `<div id="appros-ia-zone" style="margin-bottom:12px">`;
    // Construire le résumé des données pour l'IA (calculé ici, passé au bouton)
    const iaData = {
      clientName: c.name,
      totalActifs: activeAsins.length,
      urgents: urgent, action,
      ok: filtered.filter(({r}) => r.urgenceCls === 'g').length,
      qteTotale: Math.round(qteTotale),
      valTotale: Math.round(valTotale),
      manquant, erpInsuf,
      leadTime: c.leadTime||20, stockTarget: c.stockTarget||8, moq: c.moq||0,
      top5urgents: filtered.filter(({r})=>r.urgenceCls==='r').slice(0,5).map(({a,r})=>({
        nom: shortName(a).slice(0,40), sku: r.sku||'', velocite: r.velociteCorrigee||r.velocite,
        stock: r.stockAmazon==='—'?0:r.stockAmazon, couverture: r.couvertureAmazon!=null?+r.couvertureAmazon.toFixed(1):null,
        qte: r.qteACommander||0, confiance: r.confianceLabel, note: r.correctionNote
      })),
      erpLoaded: Object.keys(erpMap).length > 0,
      catalogueLoaded: (c.catalogue||[]).length > 0
    };
    const iaDataJson = JSON.stringify(iaData).replace(/'/g,"&#39;").replace(/"/g,"&quot;");
    h += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">`;
    h += `<button class="btn btn-sm" style="background:linear-gradient(135deg,#7C3AED,#4F46E5);color:#fff;border:none;gap:6px;display:inline-flex;align-items:center" onclick="runApprosIA(this,'${iaDataJson}')">✨ Analyser avec l'IA</button>`;
    h += `<span style="font-size:10px;color:var(--tx3)">Mise en perspective des données par Claude</span>`;
    h += `</div>`;
    h += `<div id="appros-ia-result" style="margin-top:8px"></div>`;
    h += `</div>`;

    if (Object.keys(erpMap).length > 0) {
      h += `<div style="font-size:10px;color:var(--tx3);margin-bottom:10px;padding:6px 10px;background:var(--s2);border-radius:var(--rd);border:1px solid var(--bd)">🏭 <strong>Stock ERP</strong> : stock global tous canaux (non exclusif Amazon) — MAJ ${c.erpStockDate||'inconnue'}</div>`;
    }

    // Tableau
    h += `<div class="tbl-wrap" id="appros-tbl-wrap"><table class="tbl" style="font-size:11px">
      <thead><tr>
        <th><span class="ap-th-info">Urgence<span class="ap-tip" data-tip="Statut calculé à partir de la date limite de commande.&#10;🔴 Commander maintenant : délai dépassé&#10;🟡 Dans les 4 sem. : fenêtre critique&#10;🔵 Dans les 8 sem. : planifier&#10;🟢 OK : couverture suffisante&#10;&#10;Badge confiance : Forte / Bonne / Moyenne / Faible&#10;selon nb semaines de données et signaux disponibles.">i</span></span></th>
        <th>Produit</th>
        <th style="text-align:center">SKU</th>
        <th class="r"><span class="ap-th-info">Vélocité/sem<span class="ap-tip" data-tip="Ventes moyennes pondérées (semaines récentes > anciennes, jusqu'à 8 sem.).\nSi tendance significative, une vélocité corrigée est calculée par projection sur la 1ère moitié du lead time.\n\nBase = moyenne pondérée historique\nCorr. = vélocité projetée intégrant la tendance">i</span></span></th>
        <th class="r"><span class="ap-th-info">Stock Amazon<span class="ap-tip" data-tip="Unités vendables déclarées par Amazon dans le rapport Stock hebdo.\nLes POs en transit (commandes Amazon acceptées) sont affichés en dessous.">i</span></span></th>
        <th class="r"><span class="ap-th-info">Couverture<span class="ap-tip" data-tip="Nombre de semaines avant rupture estimée, calculé sur la vélocité corrigée.\n< 4 sem. = rouge  |  < 8 sem. = orange">i</span></span></th>
        <th class="r"><span class="ap-th-info">Rupture estimée<span class="ap-tip" data-tip="Date à laquelle le stock Amazon atteint zéro, basée sur la vélocité corrigée.">i</span></span></th>
        <th class="r"><span class="ap-th-info">Limite commande<span class="ap-tip" data-tip="Date limite pour passer commande = date de rupture – lead time fournisseur.\nPassé cette date : risque de rupture Amazon.">i</span></span></th>
        <th class="r"><span class="ap-th-info">Qté à commander<span class="ap-tip" data-tip="Formule : (Vélocité corrigée × (Lead time + Stock cible)) – Stock Amazon – POs en transit.\n\nSi arrivée ERP planifiée détectée : déduction partielle (60%) appliquée.\nArrondie au MOQ si configuré.\n\n⚠ Recommandation indicative — à valider selon contexte marché.">i</span></span></th>
        <th class="r"><span class="ap-th-info">Valeur achat<span class="ap-tip" data-tip="Qté à commander × Prix achat (depuis la matrice tarif XML).\nAffiché uniquement si le catalogue XML est chargé.">i</span></span></th>
        <th class="r"><span class="ap-th-info">Stock ERP 🏭<span class="ap-tip" data-tip="Stock global tous canaux issu de l'ERP fournisseur (onglet "Stock dispo réel").\nNon exclusif Amazon : inclut stock retail, export, etc.\n\n+1m / +3m : évolution planifiée (arrivées fournisseur).\n🔴 Insuf. = stock ERP < qté à commander.">i</span></span></th>
        <th>POs / Fournisseur</th>
      </tr></thead><tbody>`;

    filtered.forEach(({ a, r }) => {
      const ruptureStr = r.ruptureAmazonDate ? r.ruptureAmazonDate.toLocaleDateString('fr-FR', {day:'numeric',month:'short'}) : '—';
      const limiteStr  = r.dateLimiteCommande ? r.dateLimiteCommande.toLocaleDateString('fr-FR', {day:'numeric',month:'short'}) : '—';
      const limiteColor = r.urgenceCls === 'r' ? 'color:var(--r);font-weight:700' :
                          r.urgenceCls === 'a' ? 'color:var(--a);font-weight:600' : '';
      const couvColor = r.couvertureAmazon === null ? '' : r.couvertureAmazon < 4 ? 'color:var(--r);font-weight:700' :
                        r.couvertureAmazon < 8 ? 'color:var(--a)' : 'color:var(--g)';

      // ── ERP stock pour cette ligne ──
      const erp = r.erp || null;
      let erpCell = '<span style="font-size:10px;color:var(--tx3)">—</span>';
      if (erp) {
        const s0  = erp.s0  || 0;
        const s1m = erp.s1m || 0;
        const s3m = erp.s3m || 0;
        const qte = r.qteACommander || 0;
        const s0Color = r.erpAlert ? 'color:var(--r);font-weight:700' : qte > 0 && s0 >= qte ? 'color:var(--g);font-weight:600' : '';
        erpCell = [
          '<div style="' + s0Color + '">' + fmt(s0) + ' u</div>',
          s1m !== s0 ? '<div style="font-size:9px;color:var(--tx3)">+1m : ' + fmt(s1m) + ' u</div>' : '',
          s3m !== s1m ? '<div style="font-size:9px;color:var(--tx3)">+3m : ' + fmt(s3m) + ' u</div>' : '',
          r.erpAlert && qte > 0 ? '<div style="font-size:9px;color:var(--r);margin-top:2px">⚠ Insuf. vs ' + fmt(qte) + '</div>' : '',
          r.erpArriveeEnCours ? '<div style="font-size:9px;color:var(--b);margin-top:2px">📦 Arrivée +' + fmt(r.erpArriveeQte) + '</div>' : ''
        ].join('');
      }

      // Badge confiance
      const confianceBadge = `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${r.confianceCls}22;color:${r.confianceCls};font-weight:600">${r.confianceLabel}</span>`;
      // Afficher vélocité de base + corrigée si différentes
      const veloDisplay = Math.abs((r.velociteCorrigee || r.velocite) - r.velocite) > 0.2
        ? `<div style="font-size:10px;color:var(--tx3)">${r.velocite} base</div><div style="font-size:11px;font-weight:600;color:var(--b)">${r.velociteCorrigee} corr.</div>`
        : `${r.velocite} u/sem`;

      h += `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:5px">
            <span style="font-size:13px">${r.urgenceIcon}</span>
            <span style="font-size:10px;color:var(--tx3)">${r.urgence}</span>
          </div>
          <div style="margin-top:4px">${confianceBadge}</div>
        </td>
        <td>
          <div style="font-weight:600;font-size:11px">${shortName(a).slice(0,40)}</div>
          <div style="font-size:9px;color:var(--tx3)">${a.asin}</div>
          ${r.correctionNote ? `<div style="font-size:9px;color:var(--b);margin-top:2px">${r.correctionNote}</div>` : ''}
          ${r.erpNote ? `<div style="font-size:9px;color:var(--b);margin-top:1px">${r.erpNote}</div>` : ''}
        </td>
        <td style="text-align:center">
          <div style="font-weight:600;color:var(--b)">${r.sku || '—'}</div>
          <div style="font-size:9px;color:var(--tx3)">${r.ean || ''}</div>
        </td>
        <td class="r">${veloDisplay}</td>
        <td class="r" style="${couvColor}">
          ${r.stockManquant ? '<span style="color:var(--tx3);font-size:10px">N/A</span>' : fmt(r.stockAmazon)+'u'}
          ${r.openPO > 0 ? '<br><span style="font-size:9px;color:var(--b)">+'+fmt(r.openPO)+' en PO</span>' : ''}
        </td>
        <td class="r" style="${couvColor}">${r.couvertureAmazon !== null ? r.couvertureAmazon.toFixed(1)+' sem.' : '<span style="color:var(--tx3);font-size:10px">—</span>'}</td>
        <td class="r">${r.stockManquant ? '—' : ruptureStr}</td>
        <td class="r" style="${limiteColor}">${r.stockManquant ? '—' : limiteStr}</td>
        <td class="r">
          ${r.velociteWarning ? '<div style="font-size:9px;color:var(--a);margin-bottom:2px">⚠ 1 sem.</div>' : ''}
          <strong style="font-size:13px;color:${r.urgenceCls==='r'?'var(--r)':r.urgenceCls==='a'?'var(--a)':'var(--tx)'}">${r.qteACommander !== null && r.qteACommander > 0 ? fmt(r.qteACommander) : '—'}</strong>
          ${r.deductionERP > 0 ? '<div style="font-size:9px;color:var(--b)">(-'+fmt(r.deductionERP)+' ERP)</div>' : ''}
        </td>
        <td class="r">${r.valeurCommande > 0 ? fmtEur(r.valeurCommande) : '—'}</td>
        <td class="r" style="min-width:90px">${erpCell}</td>
        <td style="min-width:140px">
          ${!r.hasPOData
            ? '<span style="font-size:10px;color:var(--tx3)">—</span>'
            : r.ruptureTotal
              ? '<span style="font-size:11px;font-weight:700;color:var(--r)">🚫 Rupture totale</span>'
              : r.rupturePartielle
                ? '<span style="font-size:11px;font-weight:600;color:var(--a)">⚠️ Partielle (' + r.tauxAcceptation + '%)</span>'
                : '<div style="font-size:11px;color:var(--g);font-weight:600">✓ ' + fmt(r.openPO) + 'u en transit</div>'
                  + (r.prochainelivraison ? '<div style="font-size:9px;color:var(--tx3)">Livr. ' + r.prochainelivraison.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) + '</div>' : '')
          }
        </td>
      </tr>`;
    });

    h += `</tbody></table></div>`;
  }

  el.innerHTML = h;
}
function renderApprosForecast() {
  const c = cl();
  if (!c) return renderWelcome();
  if (!c.csvImported) return `<div class="alr alr-a">Importez d'abord des données CSV.</div>`;

  const now   = new Date();
  const leadTime    = c.leadTime    || 20;
  const stockTarget = c.stockTarget || 8;
  const moq         = c.moq         || 0;

  const catMap = {};
  (c.catalogue || []).forEach(e => { catMap[e.asin] = e; });
  const erpMap = {};
  if (c.erpStock && c.catalogue?.length) {
    c.catalogue.forEach(function(e) {
      if (e.sku && c.erpStock[e.sku]) erpMap[e.asin] = c.erpStock[e.sku];
      else if (e.ean && c.erpStock) {
        const byEan = Object.values(c.erpStock).find(s => s.ean === String(e.ean));
        if (byEan) erpMap[e.asin] = byEan;
      }
    });
  }

  // v3.6.2 : appliquer le filtre de recherche transversal
  const baseAsinsForecast = (asinSearch && asinSearch.trim()) ? getFilteredAsins(c) : c.asins;
  const activeAsins = baseAsinsForecast.filter(a => (getRevenue(a,c)||0) > 0);
  const appros = activeAsins
    .map(a => ({ a, r: calcAppro(a, c, catMap[a.asin], erpMap[a.asin]) }))
    .filter(({ r }) => r !== null && !r.stockManquant);

  // ── Horizon : 18 mois à partir d'aujourd'hui ────────────────
  const WEEKS = 78; // ~18 mois
  const MS_WEEK = 7 * 86400 * 1000;

  // Générer le calendrier de commandes pour un ASIN
  function buildOrderCalendar(a, r) {
    const entries = [];
    let stockCurrent = (r.stockAmazon === '—' ? 0 : (r.stockAmazon || 0)) + (r.openPO || 0);
    const vel = r.velociteCorrigee || r.velocite;
    if (vel <= 0) return entries;
    let weekOffset = 0;
    let ordersPlaced = 0;
    const maxOrders = 8;

    while (weekOffset < WEEKS && ordersPlaced < maxOrders) {
      // Semaines jusqu'à rupture depuis ce point
      const weeksToRupture = stockCurrent / vel;
      const ruptureWeek    = weekOffset + weeksToRupture;
      const orderWeek      = ruptureWeek - leadTime;

      if (orderWeek <= weekOffset) {
        // Doit commander maintenant (ou déjà en retard)
        const orderDate   = new Date(now.getTime() + weekOffset * MS_WEEK);
        const ruptureDate = new Date(now.getTime() + ruptureWeek * MS_WEEK);
        const arrivalDate = new Date(now.getTime() + (orderWeek + leadTime) * MS_WEEK);
        let qty = Math.max(0, Math.round(vel * (leadTime + stockTarget) - stockCurrent));
        if (moq > 0 && qty > 0) qty = Math.ceil(qty / moq) * moq;
        entries.push({
          orderDate, ruptureDate, arrivalDate,
          qty, vel, stock: Math.round(stockCurrent),
          urgentNow: orderWeek <= 0,
          weekOffset: Math.round(weekOffset)
        });
        stockCurrent += qty;
        weekOffset = orderWeek + leadTime + 1; // avancer après livraison
        ordersPlaced++;
      } else {
        // Commander dans orderWeek-weekOffset semaines
        const futureStock = stockCurrent - vel * (orderWeek - weekOffset);
        const orderDate   = new Date(now.getTime() + orderWeek * MS_WEEK);
        const ruptureDate = new Date(now.getTime() + ruptureWeek * MS_WEEK);
        const arrivalDate = new Date(now.getTime() + ruptureWeek * MS_WEEK);
        let qty = Math.max(0, Math.round(vel * (leadTime + stockTarget) - Math.max(0, futureStock)));
        if (moq > 0 && qty > 0) qty = Math.ceil(qty / moq) * moq;
        entries.push({
          orderDate, ruptureDate, arrivalDate,
          qty, vel, stock: Math.round(Math.max(0, futureStock)),
          urgentNow: false,
          weekOffset: Math.round(orderWeek)
        });
        stockCurrent = Math.max(0, futureStock) + qty;
        weekOffset = orderWeek + leadTime + 1;
        ordersPlaced++;
      }
    }
    return entries;
  }

  // ── Plan annuel 2027 ────────────────────────────────────────
  const y2027Start = new Date(2027, 0, 1);
  const y2027End   = new Date(2027, 11, 31);

  // Regrouper les commandes par trimestre 2027
  const quarters2027 = [{label:'T1 2027',start:new Date(2027,0,1),end:new Date(2027,2,31)},{label:'T2 2027',start:new Date(2027,3,1),end:new Date(2027,5,30)},{label:'T3 2027',start:new Date(2027,6,1),end:new Date(2027,8,30)},{label:'T4 2027',start:new Date(2027,9,1),end:new Date(2027,11,31)}];

  // Construire tous les calendriers
  const calendars = appros.map(({ a, r }) => ({
    a, r,
    orders: buildOrderCalendar(a, r)
  })).filter(x => x.orders.length > 0);

  // ── KPIs globaux ────────────────────────────────────────────
  const urgentNow = calendars.filter(x => x.orders[0]?.urgentNow).length;
  const next30d   = calendars.filter(x => {
    const first = x.orders[0];
    return first && !first.urgentNow && first.orderDate <= new Date(now.getTime() + 30 * 86400000);
  }).length;

  let h = `<div style="max-width:960px;margin:0 auto">`;
  h += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">`;
  h += `<h2 style="font-size:17px;font-weight:700;margin:0">📅 Prévisionnel Appros — ${esc(c.name)}</h2>`;
  h += `<button class="btn btn-sm" onclick="go('appros')">← Retour Appros</button>`;
  h += `</div>`;

  // KPIs
  h += `<div class="kpi-g" style="margin-bottom:20px">`;
  h += `<div class="kpi${urgentNow>0?' al':''}"><div class="kpi-lb">🔴 Commander maintenant</div><div class="kpi-v">${urgentNow}</div></div>`;
  h += `<div class="kpi${next30d>0?' warn':''}"><div class="kpi-lb">📆 Commandes < 30j</div><div class="kpi-v">${next30d}</div></div>`;
  h += `<div class="kpi"><div class="kpi-lb">ASINs planifiés</div><div class="kpi-v">${calendars.length}</div></div>`;
  const total2027val = calendars.reduce((s, x) => {
    return s + x.orders.filter(o => o.orderDate >= y2027Start && o.orderDate <= y2027End)
               .reduce((ss, o) => ss + o.qty * (catMap[x.a.asin]?.prixAchat || 0), 0);
  }, 0);
  h += total2027val > 0 ? `<div class="kpi"><div class="kpi-lb">Budget commandes 2027</div><div class="kpi-v">${fmtEur(total2027val)}</div></div>` : '';
  h += `</div>`;

  // ── Onglets : Calendrier | Plan 2027 ────────────────────────
  const fTab = typeof forecastTab === 'undefined' ? 'calendar' : forecastTab;

  h += `<div style="display:flex;gap:6px;margin-bottom:16px">`;
  h += `<button class="btn btn-sm${fTab==='calendar'?' btn-b':''}" onclick="forecastTab='calendar';renderContent()">📆 Calendrier 18 mois</button>`;
  h += `<button class="btn btn-sm${fTab==='plan2027'?' btn-b':''}" onclick="forecastTab='plan2027';renderContent()">📊 Plan annuel 2027</button>`;
  h += `</div>`;

  if (fTab === 'plan2027') {
    // ── Vue Plan 2027 ──────────────────────────────────────────
    h += `<div class="cd"><div class="cd-t">Plan de commandes 2027 — par trimestre</div>`;

    quarters2027.forEach(q => {
      const qOrders = [];
      calendars.forEach(({ a, r, orders }) => {
        orders.forEach(o => {
          if (o.orderDate >= q.start && o.orderDate <= q.end) {
            qOrders.push({ a, r, o });
          }
        });
      });
      const qQte = qOrders.reduce((s, x) => s + x.o.qty, 0);
      const qVal = qOrders.reduce((s, x) => s + x.o.qty * (catMap[x.a.asin]?.prixAchat || 0), 0);

      h += `<div style="border:1px solid var(--bd);border-radius:var(--rd);margin-bottom:12px;overflow:hidden">`;
      h += `<div style="padding:10px 14px;background:var(--s1);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bd)">`;
      h += `<span style="font-weight:700;font-size:13px">${q.label}</span>`;
      h += `<span style="font-size:12px;color:var(--tx2)">${qOrders.length} commande(s) · ${fmt(qQte)} u${qVal>0?' · '+fmtEur(qVal):''}</span>`;
      h += `</div>`;

      if (!qOrders.length) {
        h += `<div style="padding:10px 14px;font-size:11px;color:var(--tx3)">Aucune commande prévue ce trimestre.</div>`;
      } else {
        h += `<div class="tbl-wrap"><table class="tbl" style="font-size:11px"><thead><tr>`;
        h += `<th>Date commande</th><th>Produit</th><th style="text-align:center">SKU</th>`;
        h += `<th class="r">Vélocité</th><th class="r">Stock à date</th><th class="r">Qté à commander</th><th class="r">Valeur achat</th>`;
        h += `</tr></thead><tbody>`;
        qOrders.sort((a,b) => a.o.orderDate - b.o.orderDate).forEach(({ a, r, o }) => {
          const prixAchat = catMap[a.asin]?.prixAchat || 0;
          const val = o.qty * prixAchat;
          h += `<tr>`;
          h += `<td><strong>${o.orderDate.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}</strong></td>`;
          h += `<td><div style="font-weight:600;font-size:11px">${shortName(a).slice(0,40)}</div><div style="font-size:9px;color:var(--tx3)">${a.asin}</div></td>`;
          h += `<td style="text-align:center"><span style="color:var(--b);font-weight:600">${r.sku||'—'}</span></td>`;
          h += `<td class="r">${o.vel.toFixed(1)} u/sem</td>`;
          h += `<td class="r">${fmt(o.stock)} u</td>`;
          h += `<td class="r"><strong style="color:var(--b)">${fmt(o.qty)}</strong></td>`;
          h += `<td class="r">${val>0?fmtEur(val):'—'}</td>`;
          h += `</tr>`;
        });
        h += `</tbody></table></div>`;
      }
      h += `</div>`;
    });
    h += `</div>`;

  } else {
    // ── Vue Calendrier 18 mois ─────────────────────────────────
    // Trier : urgents en premier, puis par date de 1ère commande
    const sorted = [...calendars].sort((a, b) => {
      const ua = a.orders[0]?.urgentNow ? 0 : 1;
      const ub = b.orders[0]?.urgentNow ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return (a.orders[0]?.orderDate || 0) - (b.orders[0]?.orderDate || 0);
    });

    const fmtD = d => d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
    const fmtDY = d => d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'2-digit'});

    sorted.forEach(({ a, r, orders }) => {
      const first = orders[0];
      const urgCls = first?.urgentNow ? 'r' : first?.weekOffset <= 4 ? 'a' : 'b';
      const urgIcon = first?.urgentNow ? '🔴' : first?.weekOffset <= 4 ? '🟡' : '🔵';
      const prixAchat = catMap[a.asin]?.prixAchat || 0;

      h += `<div style="border:1px solid var(--bd);border-radius:var(--rdl);margin-bottom:10px;overflow:hidden">`;
      // Header ASIN
      h += `<div style="padding:10px 14px;background:var(--s1);border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:10px;flex-wrap:wrap">`;
      h += `<span style="font-size:14px">${urgIcon}</span>`;
      h += `<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:12px">${shortName(a).slice(0,50)}</div><div style="font-size:9px;color:var(--tx3)">${a.asin} · SKU <strong style="color:var(--b)">${r.sku||'—'}</strong> · ${r.velociteCorrigee||r.velocite} u/sem</div></div>`;
      h += `<div style="text-align:right"><div style="font-size:10px;color:var(--tx3)">Stock actuel</div><div style="font-size:13px;font-weight:700;color:${first?.urgentNow?'var(--r)':'var(--tx)'}">${fmt(r.stockAmazon==='—'?0:r.stockAmazon)} u</div></div>`;
      h += `</div>`;
      // Timeline des commandes
      h += `<div style="padding:10px 14px;display:flex;gap:8px;flex-wrap:wrap">`;
      orders.forEach((o, idx) => {
        const isNow = o.urgentNow;
        const inYear2027 = o.orderDate.getFullYear() === 2027;
        const bg = isNow ? 'var(--r-bg)' : inYear2027 ? 'var(--b-bg,#EFF6FF)' : 'var(--s2)';
        const bd = isNow ? 'var(--r-bd)' : inYear2027 ? 'var(--b)' : 'var(--bd)';
        const col = isNow ? 'var(--r)' : inYear2027 ? 'var(--b)' : 'var(--tx)';
        const val = o.qty * prixAchat;
        h += `<div style="border:1px solid ${bd};border-radius:var(--rd);padding:8px 10px;min-width:130px;background:${bg};flex:0 0 auto">`;
        h += `<div style="font-size:9px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:3px">${idx===0?'1ère commande':'Commande '+(idx+1)}</div>`;
        h += `<div style="font-size:12px;font-weight:700;color:${col}">📋 ${fmtDY(o.orderDate)}</div>`;
        h += `<div style="font-size:9px;color:var(--tx3);margin-top:3px">⚠ Rupture : ${fmtD(o.ruptureDate)}</div>`;
        h += `<div style="font-size:11px;font-weight:600;margin-top:4px;color:var(--tx)">${fmt(o.qty)} u</div>`;
        h += val > 0 ? `<div style="font-size:9px;color:var(--tx3)">${fmtEur(val)}</div>` : '';
        h += `</div>`;
      });
      h += `</div>`;
      h += `</div>`;
    });
  }

  h += `</div>`;
  return h;
}
function excelDateToISO(serial) {
  if (!serial || isNaN(serial)) return null;
  var d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}
function parseDateFlex(val) {
  if (!val) return null;
  var s = String(val).trim();
  if (/^\d{4,6}(\.\d+)?$/.test(s)) return excelDateToISO(parseFloat(s));
  var m = s.match(/^(\d{1,2})[\/-]([A-Za-z]{3})[\/-](\d{4})$/);
  if (m) {
    var months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    var mo = months[m[2].toLowerCase()];
    if (mo !== undefined) return new Date(+m[3], mo, +m[1]).toISOString().slice(0,10);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  var p = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (p) return new Date(+p[3], +p[2]-1, +p[1]).toISOString().slice(0,10);
  return null;
}
var PO_COL_MAP = {
  poId:             ['bon de commande','bdc','purchase order','po number','po id'],
  asin:             ['asin'],
  sku:              ['ugs','sku','external id','id externe'],
  title:            ['titre','title','nom du produit','product title'],
  vendorCode:       ['code fournisseur','vendor code','vendor'],
  qty:              ['quantite de la commande','quantite commandee','quantity ordered','ordered qty'],
  qtyAccepted:      ['quantite acceptee','quantity accepted','accepted qty'],
  qtyRemaining:     ['quantite restante','quantity remaining','remaining qty','open qty'],
  cost:             ['cout total','total cost','net cost'],
  warehouse:        ['entrepot','warehouse','fulfillment center','lieu de livraison'],
  orderDate:        ['date de la commande','order date','po date'],
  deliveryDeadline: ['date limite','deadline','window end','date de livraison'],
};
function findPOCol(headers, key) {
  var h = headers.map(function(x){ return (x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); });
  var candidates = PO_COL_MAP[key] || [key];
  for (var ci = 0; ci < candidates.length; ci++) {
    var idx = h.findIndex(function(x){ return x.includes(candidates[ci]); });
    if (idx >= 0) return headers[idx];
  }
  return null;
}
function parsePOFile(file) {
  return new Promise(function(resolve) {
    var reader = new FileReader();
    var ext = file.name.split('.').pop().toLowerCase();
    function processRows(rows) {
      if (!rows || rows.length < 2) return resolve({ error: 'Fichier PO vide.' });
      var headers = rows[0];
      var results = [];
      var seen = new Set();
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (!row || !row.length) continue;
        var get = function(key) {
          var col = findPOCol(headers, key);
          if (!col) return '';
          var idx = headers.indexOf(col);
          return idx >= 0 ? String(row[idx] || '').trim() : '';
        };
        var asin = get('asin');
        var poId = get('poId');
        if (!asin || asin.length < 8) continue;
        var uid = poId + '|' + asin;
        if (seen.has(uid)) continue;
        seen.add(uid);
        results.push({
          poId: poId, asin: asin,
          sku:              get('sku'),
          title:            get('title'),
          vendorCode:       get('vendorCode'),
          qty:              parseFloat((get('qty')||'0').replace(/[^\d.,]/g,'').replace(',','.')) || 0,
          qtyAccepted:      parseFloat((get('qtyAccepted')||'0').replace(/[^\d.,]/g,'').replace(',','.')) || 0,
          qtyRemaining:     parseFloat((get('qtyRemaining')||'0').replace(/[^\d.,]/g,'').replace(',','.')) || 0,
          cost:             parseFloat((get('cost')||'0').replace(/[^\d.,]/g,'').replace(',','.')) || 0,
          warehouse:        get('warehouse'),
          orderDate:        parseDateFlex(get('orderDate')),
          deliveryDeadline: parseDateFlex(get('deliveryDeadline')),
          status: 'confirmed', importedAt: new Date().toISOString()
        });
      }
      if (!results.length) return resolve({ error: 'Aucun PO extrait.' });
      resolve({ pos: results, count: results.length, filename: file.name });
    }
    if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
      reader.onload = function(e) {
        var text = e.target.result;
        var parsed = Papa.parse(text, { header: false, skipEmptyLines: true, delimiter: text.includes(';') ? ';' : ',' });
        processRows(parsed.data);
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.onload = function(e) {
        try {
          var wb = XLSX.read(e.target.result, { type: 'array', cellDates: false });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          processRows(raw);
        } catch(err) { resolve({ error: 'Erreur XLS : ' + err.message }); }
      };
      reader.readAsArrayBuffer(file);
    }
  });
}
function handlePOFile(input) {
  var files = Array.from(input.files);
  if (!files.length) return;
  var c = cl(); if (!c) return;
  Promise.all(files.map(parsePOFile)).then(function(results) {
    var allPos = [], errors = [];
    results.forEach(function(r){ if (r.error) errors.push(r.error); else allPos.push.apply(allPos, r.pos); });
    if (!allPos.length) { showToast(errors[0] || 'Aucun PO chargé', 'alr-r'); return; }
    var existing = c.pos || [];
    c.pos = existing.filter(function(p){ return !allPos.some(function(n){ return n.poId===p.poId && n.asin===p.asin; }); }).concat(allPos);
    save(); render();
    showToast(allPos.length + ' POs confirmés importés' + (errors.length ? ' (' + errors.length + ' erreur(s))' : ''), 'alr-g');
  });
}
function deletePOs() {
  var c = cl(); if (!c) return;
  c.pos = []; save(); render();
  showToast('POs supprimés', 'alr-r');
}
function parsePPMFile(text, filename) {
  try {
    const lines = text.split(/\r?\n/);
    // Ligne 1 = métadonnées, ligne 2 = headers, ligne 3+ = données
    const headerLine = lines[1] || '';
    const delim = headerLine.includes(';') ? ';' : ',';
    const parsed = Papa.parse(text, {
      header: false, skipEmptyLines: true, delimiter: delim
    });
    const rows = parsed.data;
    if (rows.length < 3) return { error: 'Fichier PPM vide ou non reconnu.' };

    const headers = rows[1].map(h => (h||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim());
    const idxAsin = headers.findIndex(h => h === 'asin');
    const idxPPM  = headers.findIndex(h => h.includes('marge') && !h.includes('annee'));
    const idxDelta= headers.findIndex(h => h.includes('annee') || h.includes('derniere'));

    if (idxAsin < 0 || idxPPM < 0) return { error: 'Colonnes ASIN ou PPM introuvables.' };

    const result = {};
    const now = new Date().toISOString();
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const asin = (row[idxAsin] || '').trim();
      if (!asin || asin.length < 8) continue;
      // Parser le % : "87,55 %" → 87.55
      const ppmRaw = (row[idxPPM] || '').replace(/[^\d,.-]/g,'').replace(',','.');
      const ppm = parseFloat(ppmRaw) || null;
      // Delta en bps : "305" → 3.05% de différence
      const deltaRaw = (row[idxDelta] || '').replace(/[^\d,.-]/g,'').replace(',','.');
      const deltaBps = parseInt(deltaRaw) || 0;
      result[asin] = { ppm, ppmDeltaBps: deltaBps, importedAt: now };
    }
    const count = Object.keys(result).length;
    if (!count) return { error: 'Aucun ASIN PPM extrait.' };
    return { ppmData: result, count, filename };
  } catch(e) {
    return { error: 'Erreur PPM : ' + e.message };
  }
}

function handlePPMFile(input) {
  const file = input.files[0];
  if (!file) return;
  const c = cl(); if (!c) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const result = parsePPMFile(e.target.result, file.name);
    if (result.error) { showToast(result.error, 'alr-r'); return; }
    c.ppmData = Object.assign(c.ppmData || {}, result.ppmData);
    save(); render();
    showToast(result.count + ' ASINs PPM importés', 'alr-g');
  };
  reader.readAsText(file, 'UTF-8');
}
function parseForecastFile(text, filename) {
  try {
    const lines = text.split(/\r?\n/);
    const headerLine = lines[1] || '';
    const delim = headerLine.includes(';') ? ';' : ',';
    const parsed = Papa.parse(text, {
      header: false, skipEmptyLines: true, delimiter: delim
    });
    const rows = parsed.data;
    if (rows.length < 3) return { error: 'Fichier Prévisions vide.' };

    const headers = rows[1];
    const idxAsin  = headers.findIndex(h => (h||'').toUpperCase().trim() === 'ASIN');
    // Colonnes semaines : "Semaine 0", "Semaine 1", ...
    const weekCols = headers.reduce((acc, h, i) => {
      if ((h||'').toLowerCase().includes('semaine')) acc.push({ idx: i, label: h.trim() });
      return acc;
    }, []);
    if (idxAsin < 0 || !weekCols.length) return { error: 'Structure prévisions non reconnue.' };

    const result = {};
    const now = new Date().toISOString();
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const asin = (row[idxAsin] || '').trim();
      if (!asin || asin.length < 8) continue;
      const weeks = weekCols.map(wc => {
        const raw = (row[wc.idx] || '').replace(/[^\d,. ]/g,'').replace(/[ ]/g,'').replace(',','.');
        return parseFloat(raw) || 0;
      });
      const weekLabels = weekCols.map(wc => wc.label);
      result[asin] = { weeks, weekLabels, importedAt: now };
    }
    const count = Object.keys(result).length;
    if (!count) return { error: 'Aucun ASIN prévision extrait.' };
    return { forecastData: result, count, filename };
  } catch(e) {
    return { error: 'Erreur Prévisions : ' + e.message };
  }
}

function handleForecastFile(input) {
  const file = input.files[0];
  if (!file) return;
  const c = cl(); if (!c) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const result = parseForecastFile(e.target.result, file.name);
    if (result.error) { showToast(result.error, 'alr-r'); return; }
    c.forecastData = Object.assign(c.forecastData || {}, result.forecastData);
    save(); render();
    showToast(result.count + ' ASINs prévisions importés (48 semaines)', 'alr-g');
  };
  reader.readAsText(file, 'UTF-8');
}
function calcPotential(a, c) {
  let score = 0;
  const signals = [];

  // ── Signal 1 : Prévision Amazon en hausse (0-25 pts) ──
  const forecast = (c.forecastData || {})[a.asin];
  let forecastSignal = null;
  if (forecast && forecast.weeks.length >= 4) {
    const s0 = forecast.weeks[0] || 0;
    const s4avg = (forecast.weeks[1]+forecast.weeks[2]+forecast.weeks[3]+forecast.weeks[4]) / 4;
    const velocite = a.history && a.history.length >= 2
      ? a.history.slice(-4).reduce((s,h)=>s+(h.units||0),0) / Math.min(a.history.length, 4)
      : (getUnits(a,c)||0);
    if (velocite > 0 && s4avg > velocite * 1.1) {
      const gain = Math.min(25, Math.round((s4avg/velocite - 1) * 100));
      score += gain;
      signals.push({ icon:'📈', label:'Prévision Amazon +' + Math.round((s4avg/velocite-1)*100) + '% vs vélocité', cls:'g', pts: gain });
      forecastSignal = { s0, s4avg, velocite };
    } else if (s4avg > 0) {
      forecastSignal = { s0, s4avg, velocite };
    }
  }

  // ── Signal 2 : Tendance court terme positive (0-20 pts) ──
  const trend = typeof calcTrend === 'function' ? calcTrend(a) : null;
  if (trend && trend.slope > 5) {
    const pts = Math.min(20, Math.round(trend.slope));
    score += pts;
    signals.push({ icon:'⬆️', label:'Tendance haussière +' + trend.slope.toFixed(1) + '%/sem.', cls:'g', pts });
  } else if (trend && trend.slope < -5) {
    signals.push({ icon:'⬇️', label:'Tendance baissière', cls:'r', pts: 0 });
  }

  // ── Signal 3 : PPM nette correcte (0-20 pts) ──
  const ppmEntry = (c.ppmData || {})[a.asin];
  if (ppmEntry && ppmEntry.ppm !== null) {
    if (ppmEntry.ppm >= 15) {
      const pts = Math.min(20, Math.round(ppmEntry.ppm / 5));
      score += pts;
      signals.push({ icon:'💰', label:'PPM nette ' + ppmEntry.ppm.toFixed(1) + '%', cls:'g', pts });
    } else if (ppmEntry.ppm < 5) {
      signals.push({ icon:'⚠️', label:'PPM faible ' + ppmEntry.ppm.toFixed(1) + '%', cls:'r', pts: 0 });
    } else {
      signals.push({ icon:'💰', label:'PPM nette ' + ppmEntry.ppm.toFixed(1) + '%', cls:'a', pts: 0 });
    }
  }

  // ── Signal 4 : Buy Box (priorité sur stock — cause racine différente) ─────
  const retailPctNum = parseNum(a.retailPct);
  const hasBuyBoxLoss = a.retailPct && retailPctNum > 0 && retailPctNum < 95;
  if (hasBuyBoxLoss) {
    const severity = retailPctNum < 50 ? 'perdue' : 'partielle';
    signals.push({ icon:'🏆', label:'Buy Box ' + severity + ' — Retail% ' + retailPctNum.toFixed(0) + '% (vendeur 3P concurrent)', cls:'r', pts: 0 });
  } else if (a.retailPct && retailPctNum >= 95) {
    signals.push({ icon:'🏆', label:'Buy Box stable — Retail% ' + retailPctNum.toFixed(0) + '%', cls:'g', pts: 10 });
    score += 10;
  }

  // ── Signal 5 : Stock suffisant pour absorber la croissance (0-20 pts) ──
  // Note : si Buy Box perdue, le stock n'est PAS la cause racine à traiter
  const stockOk = !hasBuyBoxLoss && a.sellableUnits != null && a.sellableUnits > (getUnits(a,c)||0) * 3;
  if (stockOk) {
    score += 20;
    signals.push({ icon:'📦', label:'Stock suffisant (' + a.sellableUnits + 'u)', cls:'g', pts: 20 });
  } else if (!hasBuyBoxLoss && a.sellableUnits != null && a.sellableUnits < (getUnits(a,c)||0)) {
    signals.push({ icon:'📦', label:'Stock insuffisant — frein à la croissance', cls:'r', pts: 0 });
  } else if (hasBuyBoxLoss && a.sellableUnits != null && a.sellableUnits < (getUnits(a,c)||0)) {
    signals.push({ icon:'📦', label:'Stock faible — mais Buy Box à traiter en priorité', cls:'a', pts: 0 });
  }

  // ── Signal 5 : Conversion stable ou en hausse (0-15 pts) ──
  if (a.glanceViews > 0 && getRevenue(a,c) > 0) {
    const convRate = getRevenue(a,c) / a.glanceViews;
    // Comparer avec semaine précédente si dispo
    const prevH = a.history && a.history.length >= 2 ? a.history[a.history.length - 2] : null;
    if (prevH && prevH.glanceViews > 0 && prevH.revenue > 0) {
      const prevConv = prevH.revenue / prevH.glanceViews;
      if (convRate > prevConv * 1.05) {
        score += 15;
        signals.push({ icon:'🎯', label:'Conversion en hausse', cls:'g', pts: 15 });
      } else if (convRate > prevConv * 0.95) {
        score += 8;
        signals.push({ icon:'🎯', label:'Conversion stable', cls:'b', pts: 8 });
      } else {
        signals.push({ icon:'🎯', label:'Conversion en baisse', cls:'r', pts: 0 });
      }
    } else {
      score += 8;
      signals.push({ icon:'🎯', label:'Conversion : ' + (convRate * 100).toFixed(1) + '%', cls:'b', pts: 8 });
    }
  }

  // ── Normalisation du score selon données disponibles ──
  // Max possible = 25 (prévisions) + 20 (tendance) + 20 (PPM) + 20 (stock) + 15 (conversion)
  const maxScore = 80; // on laisse 80 comme base stable
  const hasForecastData = !!(forecast && forecast.weeks.length >= 4);
  const hasPPMData      = !!(ppmEntry && ppmEntry.ppm !== null);
  // Points manquants si données absentes (on ne pénalise pas, on ajuste les seuils)
  const missingPts = (!hasForecastData ? 25 : 0) + (!hasPPMData ? 20 : 0);
  const adjustedMax = maxScore - missingPts;
  // Score normalisé sur 100 selon le max atteignable
  const scoreNorm = adjustedMax > 0 ? Math.round(score / adjustedMax * 100) : 0;

  // Seuils sur le score normalisé
  const level = scoreNorm >= 70 ? 'fort' : scoreNorm >= 45 ? 'moyen' : 'faible';
  const levelCls = scoreNorm >= 70 ? 'g' : scoreNorm >= 45 ? 'a' : 'gr';
  const levelLabel = scoreNorm >= 70 ? '🚀 Fort potentiel' : scoreNorm >= 45 ? '⭐ Potentiel moyen' : '— Faible';

  // Candidat BTR si score normalisé >= 70 + PPM OK (si dispo) + stock OK
  const btrCandidat = scoreNorm >= 70 && stockOk && (c.btr !== 'Interdit')
    && (!hasPPMData || ppmEntry.ppm >= 15);

  return { score: scoreNorm, scoreRaw: score, signals, level, levelCls, levelLabel, btrCandidat, forecastSignal, ppmEntry };
}

// ── Analyse POs pour un ASIN ──────────────────────────────────────
function getPOsForAsin(asin, client) {
  var pos = (client.pos || []).filter(function(p){ return p.asin === asin; });
  if (!pos.length) return null;
  var qtyEnTransit = 0, rupturePartielle = false, ruptureTotal = false;
  var alertesFournisseur = [], prochainelivraison = null;
  pos.forEach(function(p) {
    var qty      = p.qty         || 0;
    var accepted = p.qtyAccepted != null ? p.qtyAccepted : qty;
    var remaining= p.qtyRemaining!= null ? p.qtyRemaining: accepted;
    qtyEnTransit += remaining;
    if (qty > 0 && accepted === 0) {
      ruptureTotal = true;
      alertesFournisseur.push('🚫 PO ' + p.poId + ' : rupture totale (' + qty + 'u commandées, 0 acceptées)');
    } else if (qty > 0 && accepted < qty * 0.8) {
      rupturePartielle = true;
      var taux = Math.round(accepted / qty * 100);
      alertesFournisseur.push('⚠️ PO ' + p.poId + ' : rupture partielle (' + taux + '% accepté)');
    }
    if (p.deliveryDeadline && remaining > 0) {
      var d = new Date(p.deliveryDeadline);
      if (!isNaN(d) && (!prochainelivraison || d < prochainelivraison)) prochainelivraison = d;
    }
  });
  var totalQty      = pos.reduce(function(s,p){ return s+(p.qty||0); }, 0);
  var totalAccepted = pos.reduce(function(s,p){ return s+(p.qtyAccepted!=null?p.qtyAccepted:(p.qty||0)); }, 0);
  var tauxAcceptation = totalQty > 0 ? Math.round(totalAccepted/totalQty*100) : 100;
  return { posActifs:pos, qtyEnTransit:Math.round(qtyEnTransit), rupturePartielle:rupturePartielle,
           ruptureTotal:ruptureTotal, tauxAcceptation:tauxAcceptation,
           prochainelivraison:prochainelivraison, alertesFournisseur:alertesFournisseur };
}

// Handler import matrice tarif XML
function handleMatriceTarif(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const result = parseMatriceTarif(e.target.result);
    if (result.error) {
      alert('Erreur : ' + result.error);
      log('✗ Matrice tarif : ' + result.error, 'err');
      return;
    }
    const c = cl();
    if (!c) return;
    c.catalogue = result.catalogue;
    save();
    log('✓ Catalogue chargé : ' + result.count + ' ASINs avec SKU', 'ok');
    render();
    // Toast
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:14px 18px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:999;display:flex;align-items:center;gap:12px';
    toast.innerHTML = '<span style="font-size:20px">✅</span><div><strong>' + result.count + ' ASINs</strong> chargés dans le catalogue<br><span style="font-size:11px;color:#6B7280">Table ASIN ↔ SKU disponible</span></div>';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  };
  reader.readAsText(file, 'UTF-8');
  input.value = '';
}

// ── Import stock ERP (xlsx Cogex / universel v3.6.6) ─────────
function handleErpStock(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  // 1. Parser universel (v3.6.6) : reconnaît N°, Stock Physique non réservé,
  //    header décalé, synonymes, config séparé/cumulé, etc.
  parseFileERP(file).then(function(result) {
    if (result.ok && result.rows.length > 0) {
      const c = cl();
      if (!c) return;
      const bysku = {};
      result.rows.forEach(function(row) {
        const sku = String(row.sku).padStart(6, '0');
        const s0  = row.stock_disponible_amazon || 0;
        bysku[sku] = {
          ean:           row.ean  || '',
          label:         row.designation || '',
          codeVie:       row.code_vie    || '',
          stockPhysique: s0,
          stock6m:       s0,
          s0:  s0,
          s1m: s0,
          s3m: s0,
          dateArrivage:  row.date_prochain_arrivage || null,
          qteArrivage:   row.qte_prochain_arrivage  || 0,
        };
      });
      c.erpStock = bysku;
      c.erpStockDate = new Date().toISOString().slice(0,10);
      c.erpStockFormat = result.config === 'cumulated' ? 'B' : 'A';
      save();
      const count = Object.keys(bysku).length;
      log('✓ Stock ERP importé : ' + count + ' références (parser universel)', 'ok');
      render();
      const toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:14px 18px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:999;display:flex;align-items:center;gap:12px';
      toast.innerHTML = '<span style="font-size:20px">📦</span><div><strong>' + count + ' références</strong> chargées (stock ERP)<br><span style="font-size:11px;color:#6B7280">MAJ ' + (c.erpStockDate||'') + '</span></div>';
      document.body.appendChild(toast);
      setTimeout(function() { toast.remove(); }, 4000);
      return;
    }

    // 2. Fallback : parser legacy Format A (colonnes "N° Article", horizons dispo)
    //    Conservé pour compatibilité ascendante avec anciens exports Cogex.
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sheetName = wb.SheetNames.find(function(n) {
          return n.toLowerCase().replace(/\s/g,'').includes('stockdispo');
        }) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
        if (!rows.length) { alert('Onglet introuvable ou vide.'); return; }

        const COL_SKU    = 'N° Article';
        const COL_EAN    = 'Art. Gencod Référence';
        const COL_LABEL  = 'Article';
        const COL_MARQUE = 'Art. Marque Commerciale';
        const COL_S0     = 'Stock dispo réel à date';
        const COL_S15    = 'Stock dispo réel à date +15 Jours';
        const COL_S1M    = 'Stock dispo réel à date +1 mois';
        const COL_S2M    = 'Stock dispo réel à date +2 mois';
        const COL_S3M    = 'Stock dispo réel à date +3 mois';

        const bysku = {};
        rows.forEach(function(row) {
          const sku = row[COL_SKU] != null ? String(row[COL_SKU]).trim() : null;
          if (!sku) return;
          const annee = row['Année'] || 0;
          if (!bysku[sku] || annee > bysku[sku]._annee) {
            bysku[sku] = {
              _annee:        annee,
              ean:           row[COL_EAN] != null ? String(row[COL_EAN]).trim() : '',
              label:         row[COL_LABEL] || '',
              marque:        row[COL_MARQUE] || '',
              stockPhysique: parseFloat(row[COL_S0])  || 0,
              stock6m:       parseFloat(row[COL_S3M]) || 0,
              s0:            parseFloat(row[COL_S0])  || 0,
              s15:           parseFloat(row[COL_S15]) || 0,
              s1m:           parseFloat(row[COL_S1M]) || 0,
              s2m:           parseFloat(row[COL_S2M]) || 0,
              s3m:           parseFloat(row[COL_S3M]) || 0,
            };
          }
        });
        Object.keys(bysku).forEach(function(k) { delete bysku[k]._annee; });

        const c = cl();
        if (!c) return;
        if (!Object.keys(bysku).length) {
          alert('Aucune référence reconnue dans ce fichier.\nVérifiez que la colonne SKU s\'appelle "N° Article" (Format A) ou une variante reconnue (N°, SKU, Code article…).');
          return;
        }
        c.erpStock = bysku;
        c.erpStockDate = new Date().toISOString().slice(0,10);
        c.erpStockFormat = 'A';
        save();
        const count = Object.keys(bysku).length;
        log('✓ Stock ERP importé : ' + count + ' références (Format A legacy)', 'ok');
        render();
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:14px 18px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:999;display:flex;align-items:center;gap:12px';
        toast.innerHTML = '<span style="font-size:20px">📦</span><div><strong>' + count + ' références</strong> chargées (stock ERP)<br><span style="font-size:11px;color:#6B7280">Format A legacy — MAJ ' + (c.erpStockDate||'') + '</span></div>';
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 4000);
      } catch(err) {
        alert('Erreur lecture fichier ERP : ' + err.message);
        log('✗ Import ERP : ' + err.message, 'err');
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// Export CSV plan de réappro
// ── Analyse IA des Appros ──────────────────────────────────────
async function runApprosIA(btn, dataAttr) {
  if (!apiKey) {
    alert('Clé API non configurée. Allez dans Configuration.');
    return;
  }
  const zone = document.getElementById('appros-ia-result');
  if (!zone) return;

  let data;
  try { data = JSON.parse(dataAttr.replace(/&quot;/g,'"').replace(/&#39;/g,"'")); }
  catch(e) { zone.innerHTML = '<div class="alr alr-r">Erreur données.</div>'; return; }

  // UI loading
  btn.disabled = true;
  btn.innerHTML = '<span style="opacity:.7">✨ Analyse en cours…</span>';
  zone.innerHTML = '<div style="padding:12px 14px;background:var(--s2);border-radius:var(--rd);border:1px solid var(--bd);font-size:12px;color:var(--tx3);display:flex;align-items:center;gap:8px"><span style="animation:spin 1s linear infinite;display:inline-block">⏳</span> Claude analyse vos données d\'approvisionnement…</div>';

  const pct = v => data.totalActifs > 0 ? Math.round(v/data.totalActifs*100) : 0;
  const top5lines = (data.top5urgents||[]).map(p =>
    `• ${p.nom} (SKU ${p.sku||'N/A'}) — vélocité ${p.velocite} u/sem, stock ${p.stock}u (${p.couverture!=null?p.couverture+' sem.':'—'}), à commander: ${p.qte} u${p.note?' | '+p.note:''}`
  ).join('\n');

  const prompt = [
    'Tu es consultant senior Amazon Vendor Central. Analyse ce plan d\'approvisionnement et fournis une mise en perspective opérationnelle.',
    '',
    '=== DONNÉES APPROS — ' + data.clientName + ' ===',
    'ASINs actifs : ' + data.totalActifs,
    'Statut urgence : 🔴 ' + data.urgents + ' urgents (' + pct(data.urgents) + '% du catalogue) | 🟡 ' + data.action + ' à planifier | 🟢 ' + data.ok + ' OK',
    'Qté totale à commander : ' + data.qteTotale + ' u' + (data.valTotale > 0 ? ' | Valeur estimée : ' + data.valTotale + ' €' : ''),
    'Stock non renseigné : ' + data.manquant + ' ASINs (' + pct(data.manquant) + '% du catalogue)',
    'Stock ERP insuffisant : ' + data.erpInsuf + ' ASINs',
    'Paramètres : Lead time ' + data.leadTime + ' sem. | Stock cible ' + data.stockTarget + ' sem. | MOQ ' + (data.moq||'non défini'),
    'Données disponibles : Catalogue XML ' + (data.catalogueLoaded?'✓':'✗') + ' | ERP stock ' + (data.erpLoaded?'✓':'✗'),
    '',
    'TOP 5 URGENCES :',
    top5lines,
    '',
    '=== DEMANDE ===',
    'Fournis une analyse en 3 parties :',
    '1. DIAGNOSTIC (2-3 phrases) : Que révèlent ces chiffres sur la gestion du stock ? Concentration du risque, sévérité globale.',
    '2. POINTS DE VIGILANCE (3 bullets max) : Signaux spécifiques à surveiller dans ces données (concentrations, anomalies, tendances).',
    '3. RECOMMANDATIONS IMMÉDIATES (3 bullets max) : Actions concrètes à prioriser cette semaine.',
    '',
    'Style : direct, orienté action, vocabulaire consultant supply chain. Pas de généralités. Appuie-toi sur les chiffres fournis.',
    'Format : texte structuré, sections titrées en gras, bullets courts. Pas de markdown avec #. Maximum 250 mots.'
  ].join('\n');

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 600,
        messages: [{ role: 'user', content: prompt }] })
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    const json = await resp.json();
    const text = (json.content||[]).map(b => b.text||'').join('');

    // Formatter la réponse
    const lines = text.split('\n');
    let html = '<div style="border:1px solid var(--bd);border-radius:var(--rdl);overflow:hidden;margin-top:4px">';
    html += '<div style="padding:8px 14px;background:linear-gradient(135deg,#7C3AED11,#4F46E511);border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:6px">';
    html += '<span style="font-size:14px">✨</span><span style="font-size:11px;font-weight:700;color:#5B21B6">Analyse IA — ' + data.clientName + '</span>';
    html += '<span style="margin-left:auto;font-size:9px;color:var(--tx3)">' + new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) + '</span></div>';
    html += '<div style="padding:12px 16px;font-size:12px;line-height:1.6;color:var(--tx)">';

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) { html += '<div style="height:6px"></div>'; return; }
      // Titres en gras (ex: **DIAGNOSTIC**)
      if (/^\*\*[^*]+\*\*/.test(trimmed)) {
        const title = trimmed.replace(/\*\*/g,'');
        html += '<div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--tx3);margin-top:10px;margin-bottom:4px">' + title + '</div>';
      } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('·')) {
        html += '<div style="display:flex;gap:6px;margin-bottom:4px"><span style="color:var(--b);flex-shrink:0">›</span><span>' + trimmed.replace(/^[•\-·]\s*/,'') + '</span></div>';
      } else {
        html += '<div style="margin-bottom:6px">' + trimmed + '</div>';
      }
    });

    html += '</div></div>';
    zone.innerHTML = html;

  } catch(err) {
    zone.innerHTML = '<div class="alr alr-r">Erreur IA : ' + err.message + '</div>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✨ Relancer l\'analyse';
  }
}


function exportApprosCsv() {
  const c = cl();
  if (!c?.asins?.length) return;
  const catMap = {};
  (c.catalogue || []).forEach(e => { catMap[e.asin] = e; });
  // Construire erpMap
  const erpMapExp = {};
  if (c.erpStock && c.catalogue?.length) {
    c.catalogue.forEach(function(e) {
      if (e.sku && c.erpStock[e.sku]) erpMapExp[e.asin] = c.erpStock[e.sku];
      else if (e.ean && c.erpStock) {
        const byEan = Object.values(c.erpStock).find(function(s) { return s.ean === String(e.ean); });
        if (byEan) erpMapExp[e.asin] = byEan;
      }
    });
  }
  const activeAsins = c.asins.filter(a => (getRevenue(a,c)||0) > 0);
  const appros = activeAsins
    .map(a => ({ a, r: calcAppro(a, c, catMap[a.asin], erpMapExp[a.asin]) }))
    .filter(({ r }) => r !== null && r.qteACommander > 0)
    .sort((x, y) => {
      const ord = { r:0, a:1, b:2, g:3 };
      return ord[x.r.urgenceCls] - ord[y.r.urgenceCls];
    });

  const headers = ['Urgence','ASIN','SKU Fournisseur','EAN','Description','Vélocité/sem','Stock Amazon','PO en cours','Couverture (sem)','Rupture estimée','Limite commande (sem)','Qté à commander','Prix achat','Valeur commande (€)','Stock ERP à date','Stock ERP +1 mois','Stock ERP +3 mois','Alerte ERP','Tendance'];
  const rows = appros.map(({ a, r }) => {
    const erp = erpMapExp[a.asin] || null;
    return [
      r.urgence,
      a.asin,
      r.sku,
      r.ean,
      '"' + (r.description||'').replace(/"/g,'""') + '"',
      r.velocite,
      r.stockAmazon,
      r.openPO,
      r.couvertureAmazon != null ? r.couvertureAmazon.toFixed(1) : '—',
      r.ruptureAmazonDate ? r.ruptureAmazonDate.toLocaleDateString('fr-FR') : '—',
      r.semainesAvantLimite,
      r.qteACommander,
      r.prixAchat,
      Math.round(r.valeurCommande),
      erp ? erp.s0 : '',
      erp ? erp.s1m : '',
      erp ? erp.s3m : '',
      erp && r.qteACommander > 0 && erp.s0 < r.qteACommander ? 'Stock ERP insuffisant' : '',
      r.tendanceNote
    ];
  });

  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (c.name||'export').replace(/\s+/g,'_') + '_Appros_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  log('✓ Export plan appros : ' + appros.length + ' ASINs', 'ok');
}

// ── Gestion des marques client ───────────────────────────────────
function addClientBrand() {
  const name = prompt('Nom de la marque :');
  if (!name || !name.trim()) return;
  const c = cl();
  if (!c.brands) c.brands = [];
  if (c.brands.some(b => norm(b.name) === norm(name.trim()))) {
    showToast('Marque déjà présente', 'alr-a'); return;
  }
  c.brands.push({ name: name.trim(), role: 'fabricant' });
  save(); render();
}

function setClientBrandRole(idx, role) {
  const c = cl();
  if (!c.brands || !c.brands[idx]) return;
  c.brands[idx].role = role;
  save(); render();
}

function removeClientBrand(idx) {
  const c = cl();
  if (!c.brands) return;
  c.brands.splice(idx, 1);
  save(); render();
}

function renderFiche() {
  const c = cl();
  if (!c) return renderWelcome();
  let h = `<div style="max-width:680px">`;
  h += `<h2 style="font-size:17px;font-weight:700;margin-bottom:16px">📋 Fiche Client — ${esc(c.name)}</h2>`;

  h += `<div class="cd"><div class="cd-t">Identité</div><div class="fg2">`;
  h += fgEl('Nom du compte', c.name, "updClient('name',this.value)");
  h += fgEl('Marque(s)', c.brand, "updClient('brand',this.value)");
  h += fgEl('Secteur', c.sector, "updClient('sector',this.value)");
  h += fgEl('Contact opérationnel', c.contactOp, "updClient('contactOp',this.value)");
  h += `</div></div>`;

  h += `<div class="cd"><div class="cd-t">Configuration Amazon</div><div class="fg2">`;
  h += fgSel('Modèle de vente', c.model, ['1P (Vendor Central)', '3P (Seller Central)', 'Hybride 1P + 3P'], "updClient('model',this.value)");
  h += fgEl('Vendor Code', c.vendorCode, "updClient('vendorCode',this.value)");
  h += `</div><div class="fg" style="margin-top:12px"><label class="fg-lb">Marchés actifs</label><div class="mk-list">`;
  MARKETS.forEach(m => {
    h += `<label class="mk-cb"><input type="checkbox" ${c.markets.includes(m)?'checked':''} onchange="toggleClientMarket('${m}',this.checked)"/>${m}</label>`;
  });
  h += `</div></div></div>`;

  // ── Section Source du BOL (Buy Box v3.6.0) ────────────────────────
  h += `<div class="cd"><div class="cd-t">📋 Source du numéro de connaissement (BOL)</div>`;
  h += `<div style="font-size:11px;color:var(--tx3);margin-bottom:10px;line-height:1.5">Information utilisée par le module Buy Box pour personnaliser les actions de diagnostic. Le BOL est le numéro de connaissement transmis dans les ASN Amazon.</div>`;
  h += `<div class="fg2">`;
  h += fgSel('Source principale du BOL', c.bolSource || '', ['', 'ERP', 'CMS', 'OMS', 'TRANSPORTEUR', 'INCONNU'], "updClient('bolSource',this.value)");
  h += fgEl('Préciser (ex: Navision, SAP, Shopify, Sterling, transporteur principal...)', c.bolSourceDetail || '', "updClient('bolSourceDetail',this.value)");
  h += `</div></div>`;

  // ── Section Comptes Vendor Central ────────────────────────────────
  var fAccts = c.accounts || [];
  var fTotalMkts = new Set(fAccts.map(function(a){return a.market;})).size;
  var fTotalBO   = fAccts.filter(function(a){return a.role==='BO';}).length;
  var fTotalCat  = fAccts.filter(function(a){return a.role==='catalogue';}).length;
  h += `<div class="cd"><div class="cd-t space">`;
  h += `<span>🏢 Comptes Vendor Central</span>`;
  if (fAccts.length > 0) h += `<span style="font-size:11px;color:var(--tx2)">${fAccts.length} comptes · ${fTotalMkts} marchés · ${fTotalBO} BO · ${fTotalCat} catalogue</span>`;
  h += `</div>`;
  h += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:12px">`;
  h += `<div><label class="fg-lb">Marché</label><select id="newAcctMarket" class="fg-in">${marketOptionsHTML('.fr')}</select></div>`;
  h += `<div><label class="fg-lb">Vendor Code</label><input id="newAcctVC" class="fg-in" placeholder="Ex: GERA3" style="text-transform:uppercase"/></div>`;
  h += `<div><label class="fg-lb">Rôle</label><select id="newAcctRole" class="fg-in"><option value="BO">Bon de Commande</option><option value="catalogue">Fournisseur catalogue</option></select></div>`;
  h += `<div><label class="fg-lb">Label (optionnel)</label><input id="newAcctLabel" class="fg-in" placeholder="Ex: Principal FR"/></div>`;
  h += `<div><button class="btn btn-p" style="padding:6px 12px" onclick="addClientAccount()">+ Ajouter</button></div>`;
  h += `</div>`;
  if (fAccts.length > 0) {
    h += `<table style="width:100%;border-collapse:collapse;font-size:12px">`;
    h += `<thead><tr style="background:var(--s2)">`;
    h += `<th style="padding:6px 8px;text-align:left">Marché</th><th style="padding:6px 8px;text-align:left">Vendor Code</th>`;
    h += `<th style="padding:6px 8px;text-align:left">Rôle</th><th style="padding:6px 8px;text-align:left">Label</th><th></th>`;
    h += `</tr></thead><tbody>`;
    for (var fai = 0; fai < fAccts.length; fai++) {
      var facc = fAccts[fai];
      var fmobj = MARKETPLACES_FULL.find(function(m){return m.market===facc.market;});
      var fmLabel = fmobj ? fmobj.flag + ' ' + fmobj.name : facc.market;
      h += `<tr style="border-bottom:1px solid var(--bd2)">`;
      h += `<td style="padding:6px 8px">${fmLabel}</td>`;
      h += `<td style="padding:6px 8px"><input class="fg-in" style="font-size:12px;padding:3px 6px;font-weight:600" value="${esc(facc.vendorCode)}" onchange="updateClientAccount('${esc(facc.id)}','vendorCode',this.value)"/></td>`;
      h += `<td style="padding:6px 8px"><select class="fg-in" style="font-size:12px;padding:3px 6px" onchange="updateClientAccount('${esc(facc.id)}','role',this.value)"><option value="BO"${facc.role==='BO'?' selected':''}>Bon de Commande</option><option value="catalogue"${facc.role==='catalogue'?' selected':''}>Catalogue</option></select></td>`;
      h += `<td style="padding:6px 8px"><input class="fg-in" style="font-size:12px;padding:3px 6px" value="${esc(facc.label||'')}" onchange="updateClientAccount('${esc(facc.id)}','label',this.value)"/></td>`;
      h += `<td style="padding:6px 8px"><button class="btn btn-sm btn-r" onclick="removeClientAccount('${esc(facc.id)}')">✕</button></td>`;
      h += `</tr>`;
    }
    h += `</tbody></table>`;
  } else {
    h += `<div style="font-size:12px;color:var(--tx3);padding:8px 0">Aucun compte VC — ajoutez-en un via le formulaire ci-dessus.</div>`;
  }
  h += `</div>`;

  // ── Section Catalogue (Matrice Tarifaire) ────────────────────────
  var catXML = c.catalogueXML || [];
  h += `<div class="cd"><div class="cd-t space">`;
  h += `<span>📦 Catalogue (Matrice Tarifaire)</span>`;
  if (catXML.length > 0) h += `<span style="font-size:11px;color:var(--g,#3b6d11)">✓ ${new Set(catXML.map(function(x){return x.asin;})).size} ASINs</span>`;
  h += `</div>`;
  if (catXML.length > 0) {
    var cxVC = {};
    var cxSt = {};
    for (var cxi = 0; cxi < catXML.length; cxi++) {
      var cxr = catXML[cxi];
      if (cxr.vendorCode && cxr.vendorCode !== 'None') cxVC[cxr.vendorCode] = (cxVC[cxr.vendorCode]||0)+1;
      if (cxr.status && cxr.status !== 'None') cxSt[cxr.status] = (cxSt[cxr.status]||0)+1;
    }
    h += `<div style="font-size:12px;margin-bottom:8px">`;
    h += `<strong>${new Set(catXML.map(function(x){return x.asin;})).size} ASINs</strong> · ${catXML.length} lignes`;
    var cxVCKeys = Object.keys(cxVC);
    if (cxVCKeys.length) h += ` · VC : ` + cxVCKeys.map(function(k){return k + ' (' + cxVC[k] + ')';}).join(', ');
    var cxStKeys = Object.keys(cxSt);
    if (cxStKeys.length) h += `<br>Statuts : ` + cxStKeys.map(function(k){return k + ' (' + cxSt[k] + ')';}).join(', ');
    if (c.xmlImportDate) h += `<br><span style="color:var(--tx3)">Importé le ${new Date(c.xmlImportDate).toLocaleDateString('fr-FR')}</span>`;
    h += `</div>`;
    h += `<button class="btn" style="font-size:12px" onclick="document.getElementById('fiche-xml-reimport').click()">🔄 Réimporter la matrice tarifaire</button>`;
    h += `<input type="file" id="fiche-xml-reimport" accept=".xml" style="display:none" onchange="ficheHandleXML(this)"/>`;
  } else {
    h += `<div style="font-size:12px;color:var(--tx3);margin-bottom:8px">Aucune matrice tarifaire importée.</div>`;
    h += `<button class="btn btn-p" style="font-size:12px" onclick="document.getElementById('fiche-xml-import').click()">📄 Importer la matrice tarifaire</button>`;
    h += `<input type="file" id="fiche-xml-import" accept=".xml" style="display:none" onchange="ficheHandleXML(this)"/>`;
  }
  h += `</div>`;

  // ── Section Marques du client ────────────────────────────────────
  h += `<div class="cd"><div class="cd-t space"><span>🏷️ Marques du client</span>
    <button class="btn btn-sm" onclick="addClientBrand()">+ Ajouter</button>
  </div>`;
  const brands = c.brands || [];
  if (!brands.length) {
    h += `<div style="font-size:12px;color:var(--tx3);padding:8px 0">Aucune marque définie — nécessaire pour la fusion Fabrication/Approvisionnement.</div>`;
  } else {
    h += `<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">`;
    brands.forEach(function(b, i) {
      const isFab = b.role === 'fabricant';
      h += `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--s2);border-radius:var(--rd)">
        <span style="flex:1;font-weight:500;font-size:13px">${esc(b.name)}</span>
        <button class="tog-b btn-sm ${isFab?'sel-ok':''}" onclick="setClientBrandRole(${i},'fabricant')" title="Fabricant — vue Fabrication prioritaire">🏭 Fabricant</button>
        <button class="tog-b btn-sm ${!isFab?'sel-no':''}" onclick="setClientBrandRole(${i},'revendeur')" title="Revendeur — vue Approvisionnement uniquement">🏪 Revendeur</button>
        <button class="btn btn-sm btn-r" onclick="removeClientBrand(${i})">✕</button>
      </div>`;
    });
    h += `</div>`;
    const fabCount = brands.filter(b=>b.role==='fabricant').length;
    const revCount  = brands.filter(b=>b.role==='revendeur').length;
    h += `<div style="font-size:11px;color:var(--tx3);margin-top:6px">${fabCount} fabricant(s) · ${revCount} revendeur(s) — les ASINs des marques fabricant absents de la vue Fabrication seront ajoutés depuis la vue Approvisionnement</div>`;
  }
  h += `</div>`;

  h += `<div class="cd"><div class="cd-t">Contraintes</div><div class="fg2">`;
  h += `<div class="fg"><label class="fg-lb">Stock déporté</label><div class="tog">
    <button class="tog-b ${c.stockDeporte?'sel-ok':''}" onclick="updClient('stockDeporte',true);render()">Autorisé</button>
    <button class="tog-b ${!c.stockDeporte?'sel-no':''}" onclick="updClient('stockDeporte',false);render()">Interdit</button>
  </div></div>`;
  h += `<div class="fg"><label class="fg-lb">3P autorisé</label><div class="tog">
    <button class="tog-b ${c.threeP?'sel-ok':''}" onclick="updClient('threeP',true);render()">Oui</button>
    <button class="tog-b ${!c.threeP?'sel-no':''}" onclick="updClient('threeP',false);render()">Non</button>
  </div></div>`;
  h += fgSel('Born to Run', c.btr, ['Autorisé', 'Conditionnel', 'Interdit'], "updClient('btr',this.value);render()");
  h += fgEl('Budget Ads mensuel', c.budget, "updClient('budget',this.value)");
  h += `</div></div>`;

  // Stats
  if (c.csvImported) {
    h += `<div class="cd"><div class="cd-t">📊 Statistiques</div><div class="kpi-g">`;
    h += `<div class="kpi"><div class="kpi-lb">ASINs en base</div><div class="kpi-v">${c.asins.length}</div></div>`;
    h += `<div class="kpi"><div class="kpi-lb">Imports réalisés</div><div class="kpi-v">${c.imports.length}</div></div>`;
    const ca = c.asins.reduce((s,a) => s+(getRevenue(a,c)||0), 0);
    h += `<div class="kpi"><div class="kpi-lb">CA Total Base</div><div class="kpi-v">${fmtEur(ca)}</div></div>`;
    h += `</div></div>`;
  }

  h += `<div style="display:flex;gap:8px;margin-top:16px">`;
  h += `<button class="btn btn-r" onclick="if(confirm('Supprimer ce client ?')){deleteClient('${c.id}')}">🗑 Supprimer</button>`;
  h += `<button class="btn" onclick="exportClient()">📤 Exporter JSON</button>`;
  h += `</div></div>`;
  return h;
}
// @smoke_manual

function renderConfig() {
  const maskedKey = apiKey ? '••••••••' + apiKey.slice(-8) : '';
  const currentModelKey = localStorage.getItem('ap-model') || 'standard';
  const currentModel = AI_MODELS[currentModelKey]?.id || AI_MODELS.standard.id;
  
  // Données usage session
  const _usage = aiUsage.session;
  const _hist = (() => { try { return JSON.parse(localStorage.getItem('ap-ai-usage') || '[]'); } catch(e) { return []; } })();
  const _histTotal = _hist.reduce((a,h) => ({
    calls: a.calls + 1,
    tokIn: a.tokIn + (h.tokensIn||0),
    tokOut: a.tokOut + (h.tokensOut||0),
    cost: a.cost + (h.costEur||0)
  }), {calls:0, tokIn:0, tokOut:0, cost:0});

  let h = `<div style="max-width:580px">`;
  h += `<h2 style="font-size:17px;font-weight:700;margin-bottom:16px">⚙️ Configuration</h2>`;

  h += `<div class="cd"><div class="cd-t">🔑 Clé API Anthropic</div>`;
  h += `<p style="font-size:12px;color:var(--tx2);margin-bottom:12px">Nécessaire pour l'analyse IA. Obtenez votre clé sur <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a></p>`;
  if (apiKey) {
    h += `<div class="alr alr-g" style="margin-bottom:10px">✓ Clé configurée : ${maskedKey}</div>`;
    h += `<button class="btn btn-r btn-sm" onclick="clearApiKey()">Supprimer la clé</button>`;
  } else {
    h += `<div class="fg" style="margin-bottom:10px"><label class="fg-lb">Clé API (sk-ant-...)</label><input type="password" class="fg-in" id="api-key-input" placeholder="sk-ant-api03-..."/></div>`;
    h += `<button class="btn btn-p" onclick="saveApiKeyFromInput()">Sauvegarder</button>`;
  }
  h += `</div>`;

  h += `<div class="cd"><div class="cd-t">🤖 Modèle IA</div>`;
  h += `<div class="fg"><label class="fg-lb">Modèle Claude</label>
    <select class="fg-in" onchange="localStorage.setItem('ap-model',this.value)">
      <option value="claude-sonnet-4-20250514" ${currentModel==='claude-sonnet-4-20250514'?'selected':''}>Claude Sonnet 4 (recommandé)</option>
      <option value="claude-haiku-4-5-20251001" ${currentModel==='claude-haiku-4-5-20251001'?'selected':''}>Claude Haiku 4.5 (rapide)</option>
    </select></div>`;
  h += `</div>`;

  h += `<div class="cd"><div class="cd-t">🌐 Claude in Chrome — Amazon</div>`;
  h += `<div class="alr alr-p">Installez l'extension Claude Chrome, ouvrez une page Amazon, cliquez sur l'icône Claude et demandez une analyse.</div>`;
  const PROMPTS = [
    { label: 'Analyse fiche produit', txt: "Analyse cette fiche produit Amazon : prix, avis, contenu, images. Recommandations d'optimisation." },
    { label: 'Analyse concurrentielle', txt: "Identifie les 5 principaux concurrents sur cette page, compare prix, notes et avis. Stratégie gagnante ?" },
    { label: 'Audit Buy Box', txt: "Qui détient la Buy Box ? Y a-t-il des vendeurs 3P ? Analyse le risque de perte de Buy Box." },
    { label: 'Analyse des avis', txt: "Analyse les avis clients. Points positifs récurrents ? Plaintes principales ? Suggestions d'amélioration produit." },
    { label: 'Agent SEO — Modifier fiche VC (Route B)', txt: "(Script généré depuis Agent SEO > bouton Modifier VC)" },
    { label: 'Agent SEO — Créer référence VC (Route A)', txt: "(Script généré depuis Agent SEO > bouton Créer VC)" },
    { label: 'Agent SEO — Vérifier conformité Amazon', txt: "(Script généré depuis Agent SEO > bouton Vérifier)" }
  ];
  PROMPTS.forEach((p, i) => {
    h += `<div style="display:flex;align-items:center;gap:10px;padding:9px;background:var(--s2);border-radius:var(--rd);margin-bottom:6px;border:1px solid var(--bd)">
      <div style="flex:1"><div style="font-weight:500;font-size:12px">${p.label}</div><div style="font-size:10px;color:var(--tx3);margin-top:1px">${p.txt.slice(0,55)}…</div></div>
      <button class="btn btn-sm" onclick="copyPrompt(${i})">📋 Copier</button>
    </div>`;
  });
  h += `</div>`;

  h += `<div class="cd"><div class="cd-t">💾 Données & Backup</div>`;
  const totalAsins = clients.reduce((s,c)=>s+(c.asins?.length||0),0);
  const estKB = Math.round(JSON.stringify(clients).length/1024);
  // Calcul fraîcheur du dernier backup
  const lastExportISO = localStorage.getItem('ap-last-export');
  const lastExportDays = lastExportISO ? Math.floor((Date.now() - new Date(lastExportISO)) / 86400000) : null;
  const backupColor = lastExportDays === null ? 'alr-r' : lastExportDays <= 7 ? 'alr-g' : lastExportDays <= 14 ? 'alr-y' : 'alr-r';
  const backupMsg = lastExportDays === null
    ? '⚠️ Aucun backup effectué — exportez vos données dès maintenant !'
    : lastExportDays === 0 ? "✓ Backup effectué aujourd'hui"
    : lastExportDays === 1 ? '✓ Backup effectué hier'
    : lastExportDays <= 7 ? `✓ Dernier backup il y a ${lastExportDays} jours`
    : `⚠️ Dernier backup il y a ${lastExportDays} jours — pensez à exporter !`;
  h += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">`;
  h += `<div style="font-size:12px;color:var(--tx2)">${clients.length} client(s) · ${totalAsins} ASINs · ~${estKB} KB en IndexedDB</div>`;
  h += `</div>`;
  h += `<div class="alr ${backupColor}" style="margin-bottom:12px;font-size:12px">${backupMsg}</div>`;
  h += `<div style="display:flex;gap:8px;flex-wrap:wrap">`;
  h += `<button class="btn btn-p" onclick="exportAllData()">💾 Exporter backup</button>`;
  h += `<button class="btn" onclick="document.getElementById('import-data').click()">📂 Restaurer backup</button>`;
  h += `<input type="file" id="import-data" accept=".json" style="display:none" onchange="importAllData(this)"/>`;
  h += `<button class="btn btn-r" onclick="if(confirm('Effacer TOUTES les données ?')){localStorage.clear();indexedDB.deleteDatabase(\'AmazonPilot\');location.reload()}">🗑 Reset complet</button>`;
  h += `</div>`;
  h += `<p style="font-size:11px;color:var(--tx3);margin-top:10px">💡 Le backup JSON contient toutes vos données (clients, ASINs, historique, appros). Conservez-le dans un endroit sûr — il vous permettra de restaurer l'outil sur n'importe quelle machine.</p>`;
  h += `</div>`;

  if (debugLog.length) {
    h += `<div class="cd"><div class="cd-t">🐛 Debug Log</div>`;
    h += `<div class="debug-log">`;
    debugLog.slice(-20).forEach(l => { h += `<div class="${l.type}">[${l.ts}] ${l.msg}</div>`; });
    h += `</div><button class="btn btn-sm" style="margin-top:8px" onclick="debugLog=[];render()">Effacer</button></div>`;
  }
  h += `</div>`;

  // Section IA — Compteur tokens + sélecteur modèle
  h += `<div style="margin-bottom:24px">
    <h3 style="font-size:14px;font-weight:700;margin-bottom:12px;color:var(--text)">🤖 Intelligence Artificielle</h3>
    
    <!-- Sélecteur modèle global -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:var(--text-light);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">Modèle par défaut</div>
      <div style="display:flex;gap:8px">
        <button onclick="localStorage.setItem('ap-model','standard');render()" 
          style="flex:1;padding:8px 12px;border-radius:8px;border:2px solid ${currentModelKey==='standard'?'var(--or)':'var(--border)'};background:${currentModelKey==='standard'?'rgba(255,153,0,.08)':'var(--bg)'};cursor:pointer;font-size:13px;font-weight:${currentModelKey==='standard'?'700':'400'}">
          ⚡ Sonnet 4.6<br><span style="font-size:11px;color:var(--text-light)">Standard · ~0.01€/appel</span>
        </button>
        <button onclick="localStorage.setItem('ap-model','premium');render()" 
          style="flex:1;padding:8px 12px;border-radius:8px;border:2px solid ${currentModelKey==='premium'?'var(--or)':'var(--border)'};background:${currentModelKey==='premium'?'rgba(255,153,0,.08)':'var(--bg)'};cursor:pointer;font-size:13px;font-weight:${currentModelKey==='premium'?'700':'400'}">
          🚀 Opus 4.7<br><span style="font-size:11px;color:var(--text-light)">Premium · ~0.08€/appel</span>
        </button>
      </div>
      <div style="font-size:11px;color:var(--text-light);margin-top:8px">Actif : <strong>${AI_MODELS[currentModelKey]?.label || currentModelKey}</strong></div>
    </div>

    <!-- Compteur session -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:var(--text-light);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">Consommation — Session en cours</div>
      ${_usage.calls === 0 ? '<div style="font-size:13px;color:var(--text-light);text-align:center;padding:8px">Aucun appel IA cette session</div>' : `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px">
          <div style="text-align:center"><div style="font-size:18px;font-weight:700;color:var(--or)">${_usage.calls}</div><div style="font-size:11px;color:var(--text-light)">Appels</div></div>
          <div style="text-align:center"><div style="font-size:18px;font-weight:700">${(_usage.tokensIn/1000).toFixed(1)}k</div><div style="font-size:11px;color:var(--text-light)">Tokens in</div></div>
          <div style="text-align:center"><div style="font-size:18px;font-weight:700">${(_usage.tokensOut/1000).toFixed(1)}k</div><div style="font-size:11px;color:var(--text-light)">Tokens out</div></div>
          <div style="text-align:center"><div style="font-size:18px;font-weight:700;color:#22c55e">${aiUsage.fmtCost(_usage.costEur)}</div><div style="font-size:11px;color:var(--text-light)">Coût session</div></div>
        </div>
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <thead><tr style="color:var(--text-light)"><th style="text-align:left;padding:3px 6px">Feature</th><th style="text-align:right;padding:3px 6px">Appels</th><th style="text-align:right;padding:3px 6px">Tokens</th><th style="text-align:right;padding:3px 6px">Coût</th></tr></thead>
          <tbody>
            ${Object.entries(_usage.byFeature).filter(([,v])=>v.calls>0).map(([k,v])=>`
              <tr style="border-top:1px solid var(--border)">
                <td style="padding:4px 6px;text-transform:capitalize">${k}</td>
                <td style="padding:4px 6px;text-align:right">${v.calls}</td>
                <td style="padding:4px 6px;text-align:right">${((v.tokensIn+v.tokensOut)/1000).toFixed(1)}k</td>
                <td style="padding:4px 6px;text-align:right;color:#22c55e">${aiUsage.fmtCost(v.costEur)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- Historique cumulé -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:12px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.5px">Historique cumulé (${_histTotal.calls} appels)</div>
        <button onclick="localStorage.removeItem('ap-ai-usage');render()" style="font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);cursor:pointer;color:var(--text-light)">Effacer</button>
      </div>
      ${_histTotal.calls === 0 ? '<div style="font-size:13px;color:var(--text-light);text-align:center;padding:4px">Aucun historique</div>' : `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div style="text-align:center"><div style="font-size:16px;font-weight:700">${(_histTotal.tokIn/1000).toFixed(0)}k</div><div style="font-size:11px;color:var(--text-light)">Tokens in</div></div>
          <div style="text-align:center"><div style="font-size:16px;font-weight:700">${(_histTotal.tokOut/1000).toFixed(0)}k</div><div style="font-size:11px;color:var(--text-light)">Tokens out</div></div>
          <div style="text-align:center"><div style="font-size:16px;font-weight:700;color:#22c55e">${aiUsage.fmtCost(_histTotal.cost)}</div><div style="font-size:11px;color:var(--text-light)">Coût total</div></div>
        </div>
      `}
    </div>
  </div>`;

  // Section Smoke Test
  const _st = (() => { try { return JSON.parse(localStorage.getItem('ap-smoketest-last')||'null'); } catch(e) { return null; } })();
  const _ss = _st?.summary;
  const _si = !_ss ? '' : _ss.status === 'OK' ? '[OK]' : _ss.status === 'WARNING' ? '[WARN]' : '[CRIT]';
  const _sl = !_ss ? 'Jamais exécuté'
    : _ss.status === 'OK' ? _ss.vitalOk+'/'+_ss.vitalTotal+' vitaux OK · '+_ss.importantOk+'/'+_ss.importantTotal+' importants'
    : _ss.status === 'WARNING' ? _ss.importantFails+' test(s) important(s) en échec'
    : _ss.vitalFails+' test(s) VITAL(AUX) EN ÉCHEC';
  const _sc = !_ss ? 'var(--s2)' : _ss.status === 'OK' ? '#e8f5e9' : _ss.status === 'WARNING' ? '#fff8e1' : '#ffebee';
  const _sfails = _st ? [...(_st.vital||[]),...(_st.important||[])].filter(t=>!t.ok) : [];
  h += `<div class="cd" style="margin-top:12px;background:${_sc}">`;
  h += `<div class="cd-t space"><span>Smoke Test</span><span style="font-size:10px;color:var(--tx3)">${_st?.ts ? new Date(_st.ts).toLocaleString('fr-FR') : ''}</span></div>`;
  h += `<div style="display:flex;align-items:center;gap:12px;padding:8px 0">`;
  h += `<div style="flex:1"><div style="font-size:12px;font-weight:600">${_si} ${_sl}</div>`;
  if (_sfails.length) h += `<div style="font-size:10px;color:var(--tx2);margin-top:3px">${_sfails.map(t=>t.id+' '+t.label).join(' · ')}</div>`;
  h += `</div><button class="btn btn-p" style="font-size:11px;padding:6px 12px" onclick="runSmokeTestManual()">Lancer</button></div></div>`;
  return h;
}
function initChart() {
  const c = cl();
  if (!c?.asins?.length) return;
  const canvas = document.getElementById('top-chart');
  if (!canvas) return;
  if (chartInst) chartInst.destroy();
  const asins = getFilteredAsins(c);
  const top10 = asins.filter(a => (getRevenue(a,c)||0) > 0).sort((a,b) => (getRevenue(b,c)||0)-(getRevenue(a,c)||0)).slice(0, 10);
  const colors = getChartColors();
  const deltas = top10.map(a => parseNum(a.revenueDelta));
  chartInst = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: top10.map(a => shortName(a).slice(0, 20)),
      datasets: [{ label: 'CA (€)', data: top10.map(a => getRevenue(a,c)||0), backgroundColor: deltas.map(d => d >= 0 ? '#22C55E' : '#EF4444'), borderRadius: 5 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: ctx => `Δ ${deltas[ctx.dataIndex]>=0?'+':''}${deltas[ctx.dataIndex]}%` } } },
      scales: {
        y: { beginAtZero: true, grid: { color: colors.grid }, ticks: { color: colors.text, callback: v => v>=1000 ? Math.round(v/1000)+'k€' : v+'€' } },
        x: { grid: { display: false }, ticks: { color: colors.text, font: { size: 10 }, maxRotation: 30 } }
      }
    }
  });
}

function initHistoryChart() {
  const c = cl();
  if (!c || !selectedAsin) return;
  const a = c.asins.find(x => x.asin === selectedAsin);
  const canvas = document.getElementById('history-chart');
  if (!canvas) return;
  if (historyChartInst) { historyChartInst.destroy(); historyChartInst = null; }

  const colors = getChartColors();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  // Choisir la source selon l'onglet actif
  let series, labels;
  if (historyView === 'monthly' && a.historyMonthly?.length) {
    series = a.historyMonthly.slice(-18);
    labels = series.map(m => m.label || m.monthKey || '?');
  } else if (a.history?.length) {
    series = a.history.slice(-16);
    labels = series.map(h => h.periodStart ? h.periodStart.slice(0,5) : (h.period || '?'));
  } else {
    return;
  }

  // Vérifier quelles métriques sont disponibles
  const hasGV    = series.some(h => (h.glanceViews||0) > 0);
  const hasStock = historyView !== 'monthly' && series.some(h => h.sellableUnits != null);

  // Datasets
  const datasets = [];

  // CA — axe gauche
  datasets.push({
    label: 'CA (€)',
    data: series.map(h => historyView === 'monthly' ? (h.revenue||0) : (h.revenue||0)),
    borderColor: '#FF9900',
    backgroundColor: 'rgba(255,153,0,0.08)',
    fill: true, tension: 0.3, pointBackgroundColor: '#FF9900',
    pointRadius: 3, borderWidth: 2,
    yAxisID: 'y'
  });

  // Glance Views — axe droite (si disponible)
  if (hasGV) {
    datasets.push({
      label: 'Glance Views',
      data: series.map(h => h.glanceViews||0),
      borderColor: '#3B82F6',
      backgroundColor: 'transparent',
      fill: false, tension: 0.3, pointBackgroundColor: '#3B82F6',
      pointRadius: 2, borderWidth: 1.5, borderDash: [4,3],
      yAxisID: 'y2'
    });
  }

  // Stock — axe droite si GV absent, sinon pas affiché (trop chargé)
  if (hasStock && !hasGV) {
    datasets.push({
      label: 'Stock vendable',
      data: series.map(h => h.sellableUnits != null ? h.sellableUnits : null),
      borderColor: '#10B981',
      backgroundColor: 'transparent',
      fill: false, tension: 0, pointBackgroundColor: '#10B981',
      pointRadius: 3, borderWidth: 1.5, spanGaps: true,
      yAxisID: 'y2'
    });
  }

  historyChartInst = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: 'top',
          labels: { color: colors.text, font: { size: 10 }, boxWidth: 10, padding: 10 }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              if (ctx.dataset.label === 'CA (€)') return ' CA : ' + fmtEur(v);
              if (ctx.dataset.label === 'Glance Views') return ' GV : ' + fmt(v);
              if (ctx.dataset.label === 'Stock vendable') return ' Stock : ' + fmt(v) + 'u';
              return v;
            }
          }
        }
      },
      scales: {
        y:  { beginAtZero: true, grid: { color: colors.grid }, ticks: { color: colors.text, callback: v => fmtEur(v) } },
        y2: datasets.length > 1 ? {
          position: 'right', beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { color: colors.text }
        } : undefined,
        x:  { grid: { display: false }, ticks: { color: colors.text, font: { size: 10 }, maxRotation: 30 } }
      }
    }
  });
}

let segChartInst = null;

function initSegChart() {
  const c = cl();
  if (!c?.asins?.length) return;
  const canvas = document.getElementById('seg-chart');
  if (!canvas) return;
  if (segChartInst) segChartInst.destroy();
  const asins = getFilteredAsins(c);
  const totalCA = asins.reduce((s, a) => s + (getRevenue(a,c)||0), 0);
  const segs = { A: 0, B: 0, C: 0 };
  const cnts = { A: 0, B: 0, C: 0 };
  for (const a of asins) {
    const s = calcSegment(a, totalCA, c);
    segs[s] += (getRevenue(a,c)||0);
    cnts[s]++;
  }
  const colors = getChartColors();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  segChartInst = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: [
        `A — ${cnts.A} ASINs`,
        `B — ${cnts.B} ASINs`,
        `C — ${cnts.C} ASINs`
      ],
      datasets: [{
        data: [segs.A, segs.B, segs.C],
        backgroundColor: ['#FF9900', '#3B82F6', isDark ? '#3A3A50' : '#E4E7EC'],
        borderColor: isDark ? '#14141C' : '#FFFFFF',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: colors.text, font: { size: 11 }, padding: 12, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${fmtEur(ctx.raw)} (${totalCA > 0 ? Math.round(ctx.raw/totalCA*100) : 0}%)` } }
      }
    }
  });
}

function exportPompierCsv() {
  const c = cl();
  if (!c?.asins?.length) return;
  const asins = getFilteredAsins(c);
  const totalCA = asins.reduce((s, a) => s + (getRevenue(a,c)||0), 0);
  const declining = asins.filter(a => (getRevenue(a,c)||0) > 0 && parseNum(a.revenueDelta) < -pompierThreshold)
    .sort((a, b) => parseNum(a.revenueDelta) - parseNum(b.revenueDelta));
  const headers = ['ASIN','Titre','Marque','Segment','CA actuel (€)','Δ CA','CA perdu estimé (€)','Glance Views','Δ GV','Stock','Retail%'];
  const rows = declining.map(a => {
    const seg = calcSegment(a, totalCA, c);
    const lost = Math.abs(parseNum(a.revenueDelta)/100*(getRevenue(a,c)||0));
    return [a.asin, '"'+(a.title||'').replace(/"/g,'""')+'"', a.brand||'', seg,
      Math.round(getRevenue(a,c)||0), a.revenueDelta||'', Math.round(lost),
      a.glanceViews||'', a.gvDelta||'', a.sellableUnits!=null?a.sellableUnits:'', a.retailPct||''];
  });
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob([''+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${(c.name||'export').replace(/\s+/g,'_')}_Diagnostic_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  log(`✓ Export Diagnostic: ${declining.length} ASINs`, 'ok');
}
function exportXLSX(headers, rows, filename, sheetName) {
  sheetName = sheetName || 'Export';
  const wsData = [headers, ...rows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Largeurs colonnes auto
  const colWidths = headers.map((h, ci) => {
    const max = Math.max(
      String(h).length,
      ...rows.map(r => String(r[ci] || '').length).slice(0, 50)
    );
    return { wch: Math.min(50, max + 2) };
  });
  ws['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename + '.xlsx');
}


// ── Export XLSX ASINs ──────────────────────────────────────────
function exportAsinsXlsx() {
  const c = cl();
  if (!c?.asins?.length) return;
  const allFiltered = getFilteredAsins(c);
  const totalCA = allFiltered.reduce((s, a) => s + (getRevenue(a,c)||0), 0);
  let asins = [...allFiltered];
  if (asinSort === 'ca_desc')    asins.sort((a,b) => (getRevenue(b,c)||0)-(getRevenue(a,c)||0));
  else if (asinSort === 'ca_asc')     asins.sort((a,b) => (getRevenue(a,c)||0)-(getRevenue(b,c)||0));
  else if (asinSort === 'hausse')     asins.sort((a,b) => parseNum(b.revenueDelta)-parseNum(a.revenueDelta));
  else if (asinSort === 'baisse')     asins.sort((a,b) => parseNum(a.revenueDelta)-parseNum(b.revenueDelta));
  else if (asinSort === 'stock_asc')  asins.sort((a,b) => (a.sellableUnits||9999)-(b.sellableUnits||9999));
  if (!asinSearch?.trim() && asinLimit < 9999) asins = asins.slice(0, asinLimit);
  const catMap = {};
  (c.catalogue || []).forEach(e => { catMap[e.asin] = e; });
  const headers = ['ASIN','SKU Fournisseur','EAN','Titre','Marque','Marché','Segment','Health','CA (€)','Δ CA','Unités','Glance Views','Δ GV','Stock','Retail%','Retours','Score Potentiel','PPM %'];
  const rows = asins.map(a => {
    const cat = catMap[a.asin];
    const pot = calcPotential(a, c);
    const ppm = (c.ppmData||{})[a.asin];
    return [
      a.asin, cat?.sku||'', cat?.ean||'',
      (a.title||'').slice(0,100), a.brand||'', a.market||'',
      calcSegment(a, totalCA, c), calcHealth(a),
      Math.round(getRevenue(a,c)||0), a.revenueDelta||'', getUnits(a,c)||'',
      a.glanceViews||'', a.gvDelta||'',
      a.sellableUnits!=null?a.sellableUnits:'', a.retailPct||'', a.returns||'',
      pot.score, ppm?.ppm!=null?ppm.ppm:''
    ];
  });
  const date = new Date().toISOString().slice(0,10);
  exportXLSX(headers, rows, c.name.replace(/\s+/g,'-') + '_ASINs_' + date, 'ASINs');
}

// ── Export XLSX Pompier ────────────────────────────────────────
function exportPompierXlsx() {
  const c = cl();
  if (!c?.asins?.length) return;
  const totalCA = c.asins.reduce((s,a)=>s+(getRevenue(a,c)||0),0);
  const threshold = pompierThreshold || 10;
  const declining = c.asins.filter(a => {
    if (!(getRevenue(a,c) > 0)) return false;
    const delta = parseNum(a.revenueDelta);
    return delta <= -threshold;
  }).sort((a,b) => parseNum(a.revenueDelta)-parseNum(b.revenueDelta));
  const headers = ['ASIN','Titre','Marque','Segment','CA (€)','Δ CA (%)','CA perdu est. (€)','Tendance','Stock','Retail%'];
  const rows = declining.map(a => {
    const trend = calcTrend(a);
    const caPerdu = Math.abs(Math.round((parseNum(a.revenueDelta)/100) * (getRevenue(a,c)||0)));
    return [
      a.asin, (a.title||'').slice(0,100), a.brand||'',
      calcSegment(a, totalCA, c),
      Math.round(getRevenue(a,c)||0), a.revenueDelta||'', caPerdu,
      trend?.label||'', a.sellableUnits!=null?a.sellableUnits:'', a.retailPct||''
    ];
  });
  const date = new Date().toISOString().slice(0,10);
  exportXLSX(headers, rows, c.name.replace(/\s+/g,'-') + '_Diagnostic-CA_' + date, 'Diagnostic CA');
}

// ── Export XLSX Appros ─────────────────────────────────────────
function exportApprosXlsx() {
  const c = cl();
  if (!c?.asins?.length) return;
  const catMap = {};
  (c.catalogue||[]).forEach(e => { catMap[e.asin] = e; });
  // erpMap
  const erpMapX = {};
  if (c.erpStock && c.catalogue?.length) {
    c.catalogue.forEach(function(e) {
      if (e.sku && c.erpStock[e.sku]) erpMapX[e.asin] = c.erpStock[e.sku];
      else if (e.ean && c.erpStock) {
        const byEan = Object.values(c.erpStock).find(function(s) { return s.ean === String(e.ean); });
        if (byEan) erpMapX[e.asin] = byEan;
      }
    });
  }
  const activeAsins = c.asins.filter(a => (getRevenue(a,c)||0) > 0);
  const appros = activeAsins
    .map(a => ({ a, r: calcAppro(a, c, catMap[a.asin], erpMapX[a.asin]) }))
    .filter(({r}) => r !== null)
    .sort((x,y) => {
      const order = {r:0,a:1,b:2,g:3,gr:4};
      return (order[x.r.urgenceCls]||4) - (order[y.r.urgenceCls]||4);
    });
  const headers = ['Urgence','ASIN','SKU','EAN','Description','Vélocité (u/sem)','Stock Amazon','En transit (PO)','Couverture (sem)','Rupture estimée','Limite commande','Sem. avant limite','Qté à commander','Prix achat (€)','Valeur commande (€)','Stock ERP à date','Stock ERP +1 mois','Stock ERP +3 mois','Alerte ERP','PPM %','Tendance','Fournisseur'];
  const rows = appros.map(({a, r}) => {
    const ppm = (c.ppmData||{})[a.asin];
    const erp = erpMapX[a.asin] || null;
    return [
      r.urgence, a.asin, r.sku||'', r.ean||'',
      (r.description||'').slice(0,80),
      r.velocite,
      r.stockAmazon!=='—'?r.stockAmazon:'',
      r.openPO||0,
      r.couvertureAmazon!=null?+r.couvertureAmazon.toFixed(1):'',
      r.ruptureAmazonDate?r.ruptureAmazonDate.toLocaleDateString('fr-FR'):'',
      r.dateLimiteCommande?r.dateLimiteCommande.toLocaleDateString('fr-FR'):'',
      r.semainesAvantLimite!=null?r.semainesAvantLimite:'',
      r.qteACommander!=null?r.qteACommander:'',
      r.prixAchat||'',
      r.valeurCommande||0,
      erp!=null?erp.s0:'',
      erp!=null?erp.s1m:'',
      erp!=null?erp.s3m:'',
      erp && (r.qteACommander||0) > 0 && erp.s0 < r.qteACommander ? 'Insuffisant' : (erp ? 'OK' : ''),
      ppm?.ppm!=null?ppm.ppm:'',
      r.tendanceNote||'',
      r.ruptureTotal?'Rupture totale':r.rupturePartielle?'Rupture partielle ('+r.tauxAcceptation+'%)':'OK'
    ];
  });
  const date = new Date().toISOString().slice(0,10);
  exportXLSX(headers, rows, c.name.replace(/\s+/g,'-') + '_Appros_' + date, 'Plan appros');
}

// ── Export XLSX Potentiel ──────────────────────────────────────
function exportPotentielXlsx() {
  const c = cl();
  if (!c?.asins?.length) return;
  const activeAsins = c.asins.filter(a => (getRevenue(a,c)||0) > 50);
  const scored = activeAsins
    .map(a => ({ a, p: calcPotential(a, c) }))
    .sort((x,y) => y.p.score - x.p.score);
  const headers = ['ASIN','Titre','Marque','Score (normalisé)','Niveau','BTR candidat','Signaux','Prévision S+4 (u)','PPM %','CA (€)','Stock (u)','Tendance'];
  const rows = scored.map(({a, p}) => {
    const fc = (c.forecastData||{})[a.asin];
    const s4 = fc ? Math.round(((fc.weeks[1]||0)+(fc.weeks[2]||0)+(fc.weeks[3]||0)+(fc.weeks[4]||0))/4) : '';
    const ppm = p.ppmEntry?.ppm!=null ? p.ppmEntry.ppm : '';
    const trend = calcTrend(a);
    return [
      a.asin, (a.title||'').slice(0,100), a.brand||'',
      p.score, p.levelLabel.replace(/[🚀⭐—]/g,'').trim(),
      p.btrCandidat ? 'Oui' : 'Non',
      p.signals.map(s=>s.label).join(' | '),
      s4, ppm,
      Math.round(getRevenue(a,c)||0),
      a.sellableUnits!=null?a.sellableUnits:'',
      trend?.label||''
    ];
  });
  const date = new Date().toISOString().slice(0,10);
  exportXLSX(headers, rows, c.name.replace(/\s+/g,'-') + '_Potentiel_' + date, 'Potentiel');
}

// ── Export XLSX POs ────────────────────────────────────────────
function exportPOsXlsx() {
  const c = cl();
  if (!(c?.pos?.length)) return;
  const headers = ['PO ID','ASIN','SKU','Titre','Vendeur','Qté commandée','Qté acceptée','Qté restante','Coût (€)','Entrepôt','Date commande','Date livraison','Statut fournisseur'];
  const rows = c.pos.map(p => {
    const qty = p.qty||0, acc = p.qtyAccepted!=null?p.qtyAccepted:qty;
    const statut = qty>0&&acc===0?'Rupture totale':qty>0&&acc<qty*0.8?'Rupture partielle ('+Math.round(acc/qty*100)+'%)':'OK';
    return [
      p.poId, p.asin, p.sku||'', (p.title||'').slice(0,80),
      p.vendorCode||'', qty, acc, p.qtyRemaining||0, p.cost||0,
      p.warehouse||'', p.orderDate||'', p.deliveryDeadline||'', statut
    ];
  });
  const date = new Date().toISOString().slice(0,10);
  exportXLSX(headers, rows, c.name.replace(/\s+/g,'-') + '_POs_' + date, 'Bons de commande');
}


// ── Export ciblé selon la vue active ──────────────────────────
function exportViewXlsx() {
  const c = cl();
  if (!c) return;
  const viewSet = asinViewAsins ? new Set(asinViewAsins) : null;
  const asins = viewSet ? c.asins.filter(a => viewSet.has(a.asin)) : c.asins.filter(a => (getRevenue(a,c)||0)>0);
  const totalCA = asins.reduce((s,a) => s+(getRevenue(a,c)||0), 0);
  const catMap = {};
  (c.catalogue||[]).forEach(e => { catMap[e.asin] = e; });

  const viewLabels = {
    lowstock: 'Ruptures', declining: 'Baisses', growing: 'Croissance',
    'seg-a': 'SegmentA', 'seg-b': 'SegmentB', 'seg-c': 'SegmentC', all: 'Tous'
  };

  // Colonnes adaptées selon la vue
  let headers, rows;
  if (asinView === 'lowstock') {
    headers = ['ASIN','SKU','Titre','Segment','CA (€)','Δ CA (%)','Stock (u)','Retail%','PPM%','Raison alerte'];
    rows = asins.map(a => {
      const cat = catMap[a.asin]; const ppm = (c.ppmData||{})[a.asin];
      const oos = parseNum(a.oosPct);
      const raison = a.sellableUnits < 15 ? 'Stock critique < 15u' : a.sellableUnits < 30 ? 'Stock faible < 30u' : 'Disponibilité < 90%';
      return [a.asin, cat?.sku||'', (a.title||'').slice(0,80), calcSegment(a, totalCA, c),
        Math.round(getRevenue(a,c)||0), a.revenueDelta||'', a.sellableUnits!=null?a.sellableUnits:'',
        a.retailPct||'', ppm?.ppm!=null?ppm.ppm:'', raison];
    });
  } else if (asinView === 'declining') {
    headers = ['ASIN','SKU','Titre','Segment','CA (€)','Δ CA (%)','CA perdu est. (€)','Tendance','GV','Δ GV','Stock','PPM%'];
    rows = asins.map(a => {
      const cat = catMap[a.asin]; const ppm = (c.ppmData||{})[a.asin];
      const caPerdu = Math.round(Math.abs(parseNum(a.revenueDelta)/100*(getRevenue(a,c)||0)));
      const trend = calcTrend(a);
      return [a.asin, cat?.sku||'', (a.title||'').slice(0,80), calcSegment(a, totalCA, c),
        Math.round(getRevenue(a,c)||0), a.revenueDelta||'', caPerdu,
        trend?.label||'', a.glanceViews||'', a.gvDelta||'',
        a.sellableUnits!=null?a.sellableUnits:'', ppm?.ppm!=null?ppm.ppm:''];
    });
  } else if (asinView === 'growing') {
    headers = ['ASIN','SKU','Titre','Segment','CA (€)','Δ CA (%)','Gain est. (€)','Tendance','GV','Δ GV','Stock','Score Potentiel','PPM%'];
    rows = asins.map(a => {
      const cat = catMap[a.asin]; const ppm = (c.ppmData||{})[a.asin];
      const gain = Math.round(Math.abs(parseNum(a.revenueDelta)/100*(getRevenue(a,c)||0)));
      const trend = calcTrend(a); const pot = calcPotential(a, c);
      return [a.asin, cat?.sku||'', (a.title||'').slice(0,80), calcSegment(a, totalCA, c),
        Math.round(getRevenue(a,c)||0), a.revenueDelta||'', gain,
        trend?.label||'', a.glanceViews||'', a.gvDelta||'',
        a.sellableUnits!=null?a.sellableUnits:'', pot.score, ppm?.ppm!=null?ppm.ppm:''];
    });
  } else {
    headers = ['ASIN','SKU','Titre','Segment','CA (€)','Δ CA (%)','Stock','Tendance','PPM%'];
    rows = asins.map(a => {
      const cat = catMap[a.asin]; const ppm = (c.ppmData||{})[a.asin];
      const trend = calcTrend(a);
      return [a.asin, cat?.sku||'', (a.title||'').slice(0,80), calcSegment(a, totalCA, c),
        Math.round(getRevenue(a,c)||0), a.revenueDelta||'',
        a.sellableUnits!=null?a.sellableUnits:'', trend?.label||'', ppm?.ppm!=null?ppm.ppm:''];
    });
  }
  const date = new Date().toISOString().slice(0,10);
  const label = viewLabels[asinView] || 'Export';
  exportXLSX(headers, rows, c.name.replace(/\s+/g,'-') + '_' + label + '_' + date, label);
}

function exportViewCsv() {
  // Pour la vue active, réutiliser exportAsinsCsv avec le filtre appliqué
  exportAsinsCsv();
}

function exportAsinsCsv() {
  const c = cl();
  if (!c?.asins?.length) return;
  // Exporter exactement ce qui est affiché — filtrée + triée + limitée + recherche
  const allFiltered = getFilteredAsins(c);
  const totalCA = allFiltered.reduce((s, a) => s + (getRevenue(a,c)||0), 0);
  // Appliquer le même tri que l'écran
  let asins = [...allFiltered];
  if (asinSort === 'ca_desc')    asins.sort((a,b) => (getRevenue(b,c)||0)-(getRevenue(a,c)||0));
  else if (asinSort === 'ca_asc')     asins.sort((a,b) => (getRevenue(a,c)||0)-(getRevenue(b,c)||0));
  else if (asinSort === 'hausse')     asins.sort((a,b) => parseNum(b.revenueDelta)-parseNum(a.revenueDelta));
  else if (asinSort === 'baisse')     asins.sort((a,b) => parseNum(a.revenueDelta)-parseNum(b.revenueDelta));
  else if (asinSort === 'stock_asc')  asins.sort((a,b) => (a.sellableUnits||9999)-(b.sellableUnits||9999));
  else if (asinSort === 'health_asc') asins.sort((a,b) => calcHealth(a)-calcHealth(b));
  // Appliquer la limite si pas de recherche active
  if (!asinSearch?.trim() && asinLimit < 9999) asins = asins.slice(0, asinLimit);
  const searchSuffix = asinSearch?.trim() ? '_recherche-' + asinSearch.trim().replace(/\s+/g,'-') : '';
  // Enrichir avec le catalogue SKU si disponible
  const catMapExport = {};
  (c.catalogue || []).forEach(e => { catMapExport[e.asin] = e; });
  const headers = ['ASIN','SKU Fournisseur','EAN','Titre','Marque','Marché','Segment','Health Score','CA (€)','Δ CA','Unités','Glance Views','Δ GV','Stock Vendable','Retail %','Retours'];
  const rows = asins.map(a => {
    const cat = catMapExport[a.asin];
    return [
      a.asin,
      cat?.sku || '',
      cat?.ean || '',
      '"' + (a.title||'').replace(/"/g,'""') + '"',
      a.brand || '',
      a.market || '',
      calcSegment(a, totalCA, c),
      calcHealth(a),
      Math.round(getRevenue(a,c)||0),
      a.revenueDelta || '',
      getUnits(a,c)||'',
      a.glanceViews || '',
      a.gvDelta || '',
      a.sellableUnits || '',
      a.retailPct || '',
      a.returns || ''
    ];
  });
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM pour Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(c.name||'export').replace(/\s+/g,'_')}_ASINs${searchSuffix}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  log(`✓ Export CSV: ${asins.length} ASINs`, 'ok');
}

function setHistoryView(v) { historyView = v; render(); if (v !== 'table') setTimeout(initHistoryChart, 100); }
async function runAI(type) {
  const c = cl();
  if (!c) return;
  aiLoading = true; aiResult = ''; render();
  const asins = getFilteredAsins(c);
  const totalCA = asins.reduce((s,a) => s+(getRevenue(a,c)||0), 0);
  let prompt = '';

  // Helper : résumé historique d'un ASIN en 1 ligne
  const asinLine = (a, withHistory = false) => {
    const deep = withHistory ? calcTrendDeep(a, c) : null;
    const hist = deep?.hasLongData
      ? ` | Trend: ${deep.signal}`
      : (a.revenueYoY ? ` | YoY: ${a.revenueYoY}` : '');
    return `- ${shortName(a)} (${a.asin}): ${fmtEur(getRevenue(a,c))} | Δ ${a.revenueDelta||'N/A'}${hist}`;
  };

  if (type === 'weekly') {
    const dec = asins.filter(a => (getRevenue(a,c)||0)>0 && parseNum(a.revenueDelta)<-10);
    const grow = asins.filter(a => (getRevenue(a,c)||0)>50 && parseNum(a.revenueDelta)>20);
    const low = asins.filter(a => a.sellableUnits>0 && a.sellableUnits<30 && (getRevenue(a,c)||0)>50);
    // Distinguer baisses structurelles vs ponctuelles
    const decStructural = dec.filter(a => { const d = calcTrendDeep(a,c); return d.hasLongData && d.signalCls === 'trend-down'; });
    const decPunctual   = dec.filter(a => { const d = calcTrendDeep(a,c); return d.hasLongData && d.signalCls !== 'trend-down'; });

    const nl = '\n';
    const decStructLines = decStructural.length
      ? '⚠️ Structurelles (' + decStructural.length + ') — action prioritaire:' + nl + decStructural.slice(0,3).map(a=>asinLine(a,true)).join(nl)
      : '';
    const decPunctLines = decPunctual.length
      ? '⏳ Ponctuelles sur fond haussier (' + decPunctual.length + ') — surveiller:' + nl + decPunctual.slice(0,3).map(a=>asinLine(a,true)).join(nl)
      : '';
    const decFallback = (!decStructural.length && !decPunctual.length) ? dec.slice(0,5).map(a=>asinLine(a,true)).join(nl) : '';
    prompt = [
      'REVUE HEBDOMADAIRE — ' + c.name,
      '',
      '📊 CA Semaine: ' + fmtEur(totalCA) + ' | ASINs actifs: ' + asins.filter(a=>(getRevenue(a,c)||0)>0).length + ' | Baisses: ' + dec.length + ' | Croissances: ' + grow.length + ' | Stock critique: ' + low.length,
      '',
      '🔴 BAISSES (' + dec.length + ' ASINs):',
      decStructLines,
      decPunctLines,
      decFallback,
      '',
      '🟢 TOP CROISSANCES:',
      grow.slice(0,5).map(a=>asinLine(a,true)).join(nl),
      '',
      '📦 STOCK CRITIQUE: ' + low.slice(0,5).map(a=>shortName(a)+': '+a.sellableUnits+'u').join(', '),
      '',
      'Structure réponse:',
      '1) Synthèse (2 lignes max, mentionner si les baisses sont structurelles ou ponctuelles)',
      '2) Actions urgentes (max 3, priorisées par impact CA)',
      '3) Opportunités à saisir (max 2)',
      '4) Vigilance'
    ].filter(x => x !== undefined && x !== null).join(nl);

  } else if (type === 'opportunities') {
    const grow = asins.filter(a => (getRevenue(a,c)||0)>50 && parseNum(a.revenueDelta)>10)
      .sort((a,b) => parseNum(b.revenueDelta)-parseNum(a.revenueDelta));
    // Qualifier chaque opportunité par sa tendance longue
    const oppLines = grow.slice(0,10).map(a => {
      const deep = calcTrendDeep(a, c);
      const qual = deep.hasLongData ? ' | Fond: ' + deep.signal : (a.revenueYoY ? ' | YoY: ' + a.revenueYoY : '');
      return '- ' + shortName(a) + ' (' + a.asin + '): ' + fmtEur(getRevenue(a,c)) + ' | Δ ' + (a.revenueDelta||'N/A') + ' | GV: ' + fmt(a.glanceViews||0) + ' | Stock: ' + (a.sellableUnits||'?') + 'u' + qual;
    }).join('\n');
    prompt = 'ANALYSE OPPORTUNITÉS — ' + c.name + '\n\n' + oppLines + '\n\nPour chaque opportunité : distingue les croissances sur fond structurel haussier (à capitaliser fort) des rebonds ponctuels (à surveiller).\nActions concrètes : Ads, stock, A+ Content, bundle, prix.';

  } else if (type === 'risks') {
    const dec = asins.filter(a => (getRevenue(a,c)||0)>0 && parseNum(a.revenueDelta)<-5);
    const low = asins.filter(a => a.sellableUnits>0 && a.sellableUnits<50 && (getRevenue(a,c)||0)>30);
    const riskDecLines = dec.slice(0,10).map(a => {
      const deep = calcTrendDeep(a, c);
      const qual = deep.hasLongData ? ' | Fond: ' + deep.signal : '';
      return '- ' + shortName(a) + ': ' + fmtEur(getRevenue(a,c)) + ' | Δ ' + (a.revenueDelta||'N/A') + qual;
    }).join('\n');
    const riskStockLines = low.slice(0,10).map(a => '- ' + shortName(a) + ': ' + a.sellableUnits + 'u | CA ' + fmtEur(getRevenue(a,c))).join('\n');
    prompt = 'ANALYSE RISQUES — ' + c.name + '\n\nASINs en baisse:\n' + riskDecLines + '\n\nStock faible:\n' + riskStockLines + '\n\nClasse les risques : critique (déclin structurel) / modéré (ponctuel sur fond stable) / faible (creux sur fond haussier).\nActions de mitigation par niveau de risque.';

  } else if (type === 'decline') {
    const dec = asins.filter(a => (getRevenue(a,c)||0)>0 && parseNum(a.revenueDelta)<-10)
      .sort((a,b) => parseNum(a.revenueDelta)-parseNum(b.revenueDelta));
    prompt = `DIAGNOSTIC BAISSES CA — ${c.name}

${dec.slice(0,12).map(a => {
  const deep = calcTrendDeep(a, c);
  const histLines = [];
  if (deep.ca2) histLines.push(`N-2: ${fmtEur(deep.ca2)}`);
  if (deep.ca1) histLines.push(`N-1: ${fmtEur(deep.ca1)}`);
  if (deep.caYTD) histLines.push(`YTD: ${fmtEur(deep.caYTD)}`);
  return `📉 ${shortName(a)}
   ASIN: ${a.asin} | ${a.market} | Δ: ${a.revenueDelta}
   Semaine: ${fmtEur(getRevenue(a,c))} | GV: ${fmt(a.glanceViews||0)} (Δ ${a.gvDelta||'N/A'}) | Stock: ${a.sellableUnits||'?'}u
   Historique: ${histLines.join(' / ') || 'non disponible'}
   Signal: ${deep.signal}`;
}).join('\n\n')}

1) Patterns communs (saisonnalité? concurrence? catégorie?)
2) Distingue déclin structurel vs creux ponctuel pour chaque ASIN
3) Actions correctives par priorité d'impact CA`;
  }

  aiResult = await askClaude(getSysPrompt(c), prompt);
  aiLoading = false; render();
}

// État SEO global
let seoLoading = false;
let challengeLoading = null; // asin en cours de challenge GPT

// ── Wizard Optimisation ──────────────────────────────────────────────────────
let wizardState = {
  asin: null, market: null, sku: null,
  step: 'a', ficheReady: false, challengeReady: false,
  progress: null, isRegen: false,
  collapsed: {}
};

function resetWizard() {
  wizardState = {
    asin: null, market: null, sku: null,
    step: 'a', ficheReady: false, challengeReady: false,
    progress: null, isRegen: false,
    collapsed: {}
  };
}

function toggleWizardStep(id) {
  // collapsed[id] !== false = pliée (défaut undefined ou true)
  // collapsed[id] === false = dépliée
  wizardState.collapsed[id] = (wizardState.collapsed[id] === false);
  render();
}

function openWizard(asin, market, isRegen) {
  resetWizard();
  wizardState.asin    = asin;
  wizardState.market  = market || '.fr';
  wizardState.isRegen = !!isRegen;
  go('optimisationWizard');
}

function closeWizard() {
  resetWizard();
  go('asins');
}
let seoResults = {}; // { asin: { '.fr': {...}, backendKW: '...', _progress: {...} } }
let seoActiveTab = null;
let seoDrawerAsin = null;
let seoMotcle = {}; // { asin: motcle } — mot-clé concurrence par ASIN

// ── seoGetPendingVerifications — déclarée tôt car utilisée par le badge nav ──
// @seo

async function runSEOFiche(asin, market, motcle) {
  const c = cl();
  if (!c) return;
  if (!apiKey) {
    if (!seoResults[asin]) seoResults[asin] = {};
    const mkt = market || (c.markets && c.markets.length ? c.markets[0] : (c.mainMarket || '.fr'));
    seoResults[asin][mkt] = { error: '__ERR_NOKEY__' };
    seoLoading = false;
    render();
    return;
  }
  const a = c.asins.find(x => x.asin === asin);
  if (!a) return;

  // Fallbacks si appelé sans arguments (ancien comportement ou CTA liste)
  const mkt = market || (c.markets && c.markets.length ? c.markets[0] : (c.mainMarket || '.fr'));
  const keyword = motcle || seoMotcle[asin] || extractSearchKeyword(asin, c);
  seoMotcle[asin] = keyword;
  const ml = MARKET_LANG[mkt];
  if (!ml) return;

  seoLoading = true;
  if (!seoResults[asin]) seoResults[asin] = {};
  seoResults[asin]._progress = { phase: '🔍 Enrichissement web…', pct: 5 };
  seoActiveTab = mkt;
  refreshSEODrawer();
  const sw = document.getElementById('seo-section-wrapper');
  if (sw) { const c2=cl(); const a2=c2&&c2.asins.find(x=>x.asin===asin); if(a2) sw.innerHTML=renderSEOSection(a2,c2); }

  const sys = getSysPrompt(c);

  try {
    // ── Étape 1 : définition produit via aperçu IA Google ──
    seoResults[asin]._progress = { phase: '🔍 Définition produit…', pct: 10 };
    refreshSEODrawer();
    const defResult = await seoFetchDefinition(keyword);
    await sleep(2000);

    // ── Étape 2 : fiche Amazon existante ──
    seoResults[asin]._progress = { phase: '🔍 Lecture fiche Amazon…', pct: 25 };
    refreshSEODrawer();
    const ficheResult = await seoFetchFiche(asin, mkt);
    if (!ficheResult.titre_actuel) {
      ficheResult.titre_actuel = a.title || '';
      ficheResult.warning_fiche = '⚠ Fiche Amazon non lue — données catalogue utilisées';
    }
    await sleep(2000);

    // ── Étape 3 : génération fiche ──
    seoResults[asin]._progress = { phase: '✍️ Génération fiche…', pct: 50 };
    refreshSEODrawer();
    const enrichies = Object.assign({}, defResult, ficheResult, { motcleUsed: keyword });

    let mainResult;
    try { mainResult = await callAPI(sys, buildSEOPrompt(a, c, ml.lang, false, enrichies), 'seo', null, 2500); }
    catch(e) { mainResult = '__ERR_UNKNOWN__' + e.message; }
    if (isAIError(mainResult)) {
      seoResults[asin][mkt] = { error: mainResult };
      return; // finally garantit seoLoading = false
    }
    const parsed = parseSEOResponse(mainResult, ml.lang);
    parsed.generatedAt = new Date().toISOString();
    seoResults[asin][mkt] = parsed;
    refreshSEODrawer();

    // ── Étape 4 : backend keywords ──
    seoResults[asin]._progress = { phase: '🏷 Backend keywords…', pct: 80 };
    refreshSEODrawer();
    await sleep(2000);

    const motsExclure = extractMotsTitreBullets(parsed.titre, parsed.bullets);
    let bkwResult;
    try { bkwResult = await callAPI(sys, buildSEOPrompt(a, c, ml.lang, true, enrichies, motsExclure), 'seo', null, 600); }
    catch(e) { bkwResult = ''; }
    if (bkwResult && !isAIError(bkwResult)) {
      seoResults[asin][mkt].backendKW = bkwResult.trim();
    }

  } catch(e) {
    if (!seoResults[asin][mkt]) seoResults[asin][mkt] = {};
    seoResults[asin][mkt].error = e.message;
  } finally {
    delete seoResults[asin]._progress;
    if (!c.ficheOptimisee) c.ficheOptimisee = {};
    c.ficheOptimisee[asin] = seoResults[asin];
    save();
    seoLoading = false;
    refreshSEODrawer();
    render();
    const swf = document.getElementById('seo-section-wrapper');
    if (swf) { const c2=cl(); const a2=c2&&c2.asins.find(x=>x.asin===asin); if(a2) swf.innerHTML=renderSEOSection(a2,c2); }
  }
}

function renderSEOSection(a, c) {
  const _asinJ = "'" + a.asin + "'";
  const markets = c.markets && c.markets.length ? c.markets : [c.mainMarket || '.fr'];
  const seenLangs = new Set();
  const marketsToProcess = markets.filter(function(mkt) {
    const ml = MARKET_LANG[mkt];
    if (!ml) return false;
    const key = ml.lang + (mkt === '.be' ? '-be' : '');
    if (seenLangs.has(key)) return false;
    seenLangs.add(key);
    return true;
  });

  const existing = seoResults[a.asin] || c.ficheOptimisee?.[a.asin];
  if (existing && !seoResults[a.asin]) seoResults[a.asin] = existing;

  let h = '<div class="cd"><div class="cd-t space"><span>✍️ Optimisation fiche produit</span>';
  if (existing && !seoLoading) {
    h += '<button class="btn btn-xs" onclick="runSEOFiche(' + _asinJ + ',seoActiveTab||(cl()&&(cl().mainMarket||\'.fr\')),seoMotcle[' + _asinJ + ']||extractSearchKeyword(' + _asinJ + ',cl()))">🔄 Regénérer</button>';
  }
  h += '</div>';

  if (seoLoading && seoResults[a.asin]) {
    const done = marketsToProcess.filter(function(m) { return !!seoResults[a.asin][m]; }).length;
    h += '<div style="margin-bottom:12px;font-size:12px;color:var(--tx3)"><span class="spin">⏳</span> Génération en cours... ' + done + '/' + marketsToProcess.length + ' langues</div>';
  }

  if (!existing && !seoLoading) {
    h += '<p style="font-size:12px;color:var(--tx2);margin-bottom:12px">Génère la fiche optimisée pour les ' + marketsToProcess.length + ' marché(s) : ';
    h += marketsToProcess.map(function(m) { return (MARKET_LANG[m]?.flag || '') + ' ' + (MARKET_LANG[m]?.label || m); }).join(', ');
    h += '.</p>';
    h += `<div class="cd" style="padding:1.25rem;margin-bottom:12px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
    <div style="width:22px;height:22px;border-radius:50%;background:#EEEDFE;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;color:#3C3489;flex-shrink:0">2</div>
    <span style="font-size:14px;font-weight:500">Enrichissement produit</span>
    <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#EEEDFE;color:#3C3489">optionnel · recommandé</span>
  </div>
  <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Coller la fiche Amazon pour une analyse plus précise — concurrents, avis, specs réelles</div>
  <textarea class="fg-in" id="fiche-amazon-${esc(a.asin)}"
    style="height:90px;font-size:12px;resize:vertical"
    placeholder="Collez ici le contenu de la page Amazon.fr (titre actuel, bullets, description, avis clients, produits associés)..."
    oninput="saveFicheAmazon('${esc(a.asin)}', this.value)"
  >${esc(a.ficheAmazon || '')}</textarea>
  <div style="font-size:11px;color:var(--muted2);margin-top:6px">Sauvegardée automatiquement. Alimente aussi l'Analyse IA et la Buy Box.</div>
  ${a.ficheAmazon ? `
  <button class="btn-sm" style="margin-top:8px;color:var(--danger)" onclick="saveFicheAmazon('${esc(a.asin)}','');document.getElementById('fiche-amazon-${esc(a.asin)}').value='';render()">
    Effacer
  </button>` : ''}
</div>`;
    if (a.ficheAmazon) {
      h += `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--ok-bg, #EAF3DE);border-radius:6px;margin-bottom:10px">
    <span style="font-size:12px;color:var(--ok)">✓ Fiche Amazon enrichie — analyse plus précise</span>
  </div>`;
    }
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    h += '<button class="btn btn-p" onclick="openWizard(' + _asinJ + ',(cl()&&(cl().mainMarket||\'.fr\')),false)" ' + (seoLoading ? 'disabled' : '') + '>✨ Optimiser la fiche Article</button>';
    h += '</div>';
    h += '</div>';
    return h;
  }

  const res = seoResults[a.asin] || {};

  // Onglets par marché
  if (marketsToProcess.length > 1) {
    const activeTab = seoActiveTab || marketsToProcess[0];
    h += '<div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">';
    marketsToProcess.forEach(function(mkt) {
      const ml = MARKET_LANG[mkt];
      const done = !!res[mkt] && !res[mkt].error;
      const isActive = activeTab === mkt;
      h += '<button class="btn btn-sm ' + (isActive ? 'btn-p' : '') + '" onclick="seoActiveTab=\'' + mkt + '\';render()">';
      h += (ml?.flag || '') + ' ' + (ml?.label || mkt);
      if (seoLoading && !res[mkt]) h += ' <span class="spin" style="font-size:10px">⏳</span>';
      else if (done) h += ' ✓';
      h += '</button>';
    });
    h += '</div>';
  }

  const activeMkt = seoActiveTab || marketsToProcess[0];
  const r = res[activeMkt];

  if (!r) {
    h += '<div style="font-size:12px;color:var(--tx3);padding:12px"><span class="spin">⏳</span> Génération en cours pour ce marché...</div>';
    h += '</div>';
    return h;
  }
  if (r.error) {
    h += '<div class="alr alr-r">Erreur : ' + esc(String(r.error)) + '</div></div>';
    return h;
  }

  const asinJson = JSON.stringify(a.asin);
  const mktJson  = JSON.stringify(activeMkt);

  // Nom type produit
  if (r.nomType) {
    h += '<div style="margin-bottom:10px;padding:8px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd)">';
    h += '<div style="font-size:10px;font-weight:700;color:var(--tx3);margin-bottom:2px">NOM TYPE PRODUIT</div>';
    h += '<div style="font-size:13px;font-weight:600">' + esc(r.nomType) + '</div>';
    h += '</div>';
  }

  // Titre
  const titrLen = r.titre?.length || 0;
  const titrColor = titrLen >= 180 && titrLen <= 200 ? 'var(--g)' : titrLen > 200 ? 'var(--r)' : 'var(--a)';
  h += '<div style="margin-bottom:12px">';
  h += '<div style="font-weight:600;font-size:12px;color:var(--tx3);margin-bottom:4px;display:flex;justify-content:space-between">';
  h += '<span>TITRE</span><span style="font-weight:700;color:' + titrColor + '">' + titrLen + ' car. ' + (titrLen >= 180 && titrLen <= 200 ? '✓' : titrLen > 200 ? '⚠ trop long' : '⚠ court') + '</span></div>';
  h += '<div style="padding:10px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd);font-size:13px;line-height:1.5">' + esc(r.titre || '') + '</div>';
  h += '<button class="btn btn-xs" style="margin-top:4px" onclick="copySEOField(' + asinJson + ',' + mktJson + ',\'titre\')">📋 Copier</button>';
  h += '</div>';

  // Bullets
  h += '<div style="margin-bottom:12px"><div style="font-weight:600;font-size:12px;color:var(--tx3);margin-bottom:6px">BULLET POINTS</div>';
  (r.bullets || []).forEach(function(b, i) {
    if (!b) return;
    const bulletField = 'bullet' + (i + 1);
    h += '<div style="margin-bottom:6px;padding:8px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd)">';
    h += '<div style="font-size:10px;font-weight:700;color:var(--or);margin-bottom:3px">• ' + (i + 1) + '</div>';
    h += '<div style="font-size:12px;line-height:1.5">' + esc(b) + '</div>';
    h += '<button class="btn btn-xs" style="margin-top:4px" onclick="copySEOField(' + asinJson + ',' + mktJson + ',\'' + bulletField + '\')">📋</button>';
    h += '</div>';
  });
  h += '</div>';

  // Description
  if (r.description) {
    h += '<div style="margin-bottom:12px"><div style="font-weight:600;font-size:12px;color:var(--tx3);margin-bottom:4px">DESCRIPTION HTML</div>';
    h += '<div style="padding:10px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd);font-size:11px;font-family:var(--fm);line-height:1.6;max-height:120px;overflow-y:auto">' + esc(r.description) + '</div>';
    h += '<button class="btn btn-xs" style="margin-top:4px" onclick="copySEOField(' + asinJson + ',' + mktJson + ',\'description\')">📋 Copier</button>';
    h += '</div>';
  }

  // Backend KW
  var _bkw = res.backendKW || (activeMkt && res[activeMkt] && res[activeMkt].backendKW) || '';
  if (_bkw) {
    h += '<div style="margin-bottom:12px"><div style="font-weight:600;font-size:12px;color:var(--tx3);margin-bottom:4px">BACKEND KEYWORDS (FR — commun à tous les marchés)</div>';
    h += '<div style="padding:8px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd);font-size:11px;color:var(--tx2);line-height:1.6">' + esc(_bkw) + '</div>';
    h += '<button class="btn btn-xs" style="margin-top:4px" onclick="copySEOField(' + asinJson + ',null,\'backendKW\')">📋 Copier</button>';
    h += '</div>';
  }

  // ALERTES_FRED
  h += `<div class="alr alr-w" style="margin-bottom:12px;${r.alertesFred ? '' : 'display:none'}">
    ⚠️ <strong>Points à vérifier avant publication :</strong><br>
    ${esc(r.alertesFred || '')}
  </div>`;

  // Synthèse stratégique
  if (r.positionnement || r.leviers || r.erreurs || r.opportunite) {
    h += '<div style="margin-bottom:12px;padding:10px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd)">';
    h += '<div style="font-weight:600;font-size:12px;color:var(--tx3);margin-bottom:8px">SYNTHÈSE STRATÉGIQUE</div>';
    if (r.positionnement) h += '<div style="margin-bottom:6px"><span style="font-size:10px;font-weight:700;color:var(--tx3)">POSITIONNEMENT</span><div style="font-size:12px">' + esc(r.positionnement) + '</div></div>';
    if (r.leviers) h += '<div style="margin-bottom:6px"><span style="font-size:10px;font-weight:700;color:var(--g)">LEVIERS RANKING</span><div style="font-size:12px">' + esc(r.leviers) + '</div></div>';
    if (r.erreurs) h += '<div style="margin-bottom:6px"><span style="font-size:10px;font-weight:700;color:var(--r)">ERREURS À ÉVITER</span><div style="font-size:12px">' + esc(r.erreurs) + '</div></div>';
    if (r.opportunite) h += '<div><span style="font-size:10px;font-weight:700;color:var(--b)">OPPORTUNITÉ SEO</span><div style="font-size:12px">' + esc(r.opportunite) + '</div></div>';
    h += '</div>';
  }

  // POINT_IMPORTANT
  h += `<div class="cd" style="padding:12px;margin-bottom:12px;border-left:3px solid var(--or);${r.pointImportant ? '' : 'display:none'}">
    🔥 <strong>Point clé :</strong> ${esc(r.pointImportant || '')}
  </div>`;

  // Tout copier
  h += '<button class="btn btn-sm btn-p" onclick="copySEOField(' + asinJson + ',' + mktJson + ',\'all\')">📋 Tout copier (' + (MARKET_LANG[activeMkt]?.label || activeMkt) + ')</button>';
  h += '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">';
  h += '<button class="btn btn-p" onclick="publishVC(' + _asinJ + ',' + mktJson + ')">📤 Publier dans VC</button>';
  h += '<button class="btn btn-or" onclick="openWizard(' + _asinJ + ',' + mktJson + ',true)">🔄 Régénérer</button>';
  h += '</div>';
  h += '</div>';
  return h;
}


async function runAsinAI(asin) {
  const c = cl();
  if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (!a) return;
  aiLoading = true; aiResult = ''; selectedAsin = asin; render();
  const totalCA = c.asins.reduce((s,x) => s+(getRevenue(x,c)||0), 0);
  const seg = calcSegment(a, totalCA, c);
  const health = calcHealth(a);
  const deep = calcTrendDeep(a, c);
  const histCtx = buildAsinContext(a, c);

  const prompt = `ANALYSE ASIN DÉTAILLÉE

📦 ${a.title||'N/A'}
ASIN: ${a.asin} | Marque: ${a.brand||'N/A'} | Marché: ${a.market||'.fr'}
Segment: ${seg} | Health Score: ${health}/100

📊 MÉTRIQUES PÉRIODE EN COURS:
- CA: ${fmtEur(getRevenue(a,c)||0)} (Δ période: ${a.revenueDelta||'N/A'})
- Unités: ${fmt(getUnits(a,c)||0)} (Δ ${a.unitsDelta||'N/A'})
- Glance Views: ${fmt(a.glanceViews||0)} (Δ GV: ${a.gvDelta||'N/A'})
- Stock vendable: ${a.sellableUnits!=null?a.sellableUnits+'u':'N/A'} | Malsain: ${a.unhealthyUnits||0}u
- Retail %: ${a.retailPct||'N/A'} | Confirm %: ${a.confirmPct||'N/A'}
- Retours: ${a.returns||0}

${histCtx}

🎯 ANALYSE DEMANDÉE:
1) Diagnostic santé en tenant compte de la trajectoire longue (pas seulement la période)
2) Signal principal : le mouvement actuel est-il structurel ou ponctuel ?
3) Recommandations (max 3) adaptées à la tendance de fond
4) Points de vigilance spécifiques à ce profil d'ASIN`;

  aiResult = await askClaude(getSysPrompt(c), prompt);
  aiLoading = false; render();
}

function renderMarkdown(text) {
  // Renderer minimal : bold, headers, listes — sans lib externe
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/^### (.+)$/gm,'<div style="font-size:13px;font-weight:700;margin:14px 0 6px;color:var(--tx)">$1</div>')
    .replace(/^## (.+)$/gm,'<div style="font-size:14px;font-weight:700;margin:16px 0 8px;color:var(--tx);border-bottom:1px solid var(--bd);padding-bottom:4px">$1</div>')
    .replace(/^# (.+)$/gm,'<div style="font-size:15px;font-weight:700;margin:16px 0 8px">$1</div>')
    .replace(/^- (.+)$/gm,'<div style="display:flex;gap:8px;margin:4px 0;padding-left:4px"><span style="color:var(--or);flex-shrink:0">•</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm,'<div style="margin:4px 0;padding-left:4px">$1</div>')
    .replace(/\n\n/g,'<div style="height:8px"></div>')
    .replace(/\n/g,'<br>');
}

function copyAI() {
  navigator.clipboard.writeText(aiResult).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = aiResult;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
  log('✓ Copié', 'ok');
}
function getAmazonProductUrl(asin, market = '.fr') {
  return `https://www.${MARKET_DOMAINS[market]||'amazon.fr'}/dp/${asin}`;
}
function openAmazonProduct(asin, market) { window.open(getAmazonProductUrl(asin, market), '_blank'); }
function openAmazonSearch(kw, market = '.fr') { window.open(`https://www.${MARKET_DOMAINS[market]||'amazon.fr'}/s?k=${encodeURIComponent(kw)}`, '_blank'); }
function openAmazonBestSellers(market = '.fr') { window.open(`https://www.${MARKET_DOMAINS[market]||'amazon.fr'}/gp/bestsellers/`, '_blank'); }
function launchChromeAnalysis(asin, market = '.fr') {
  localStorage.setItem('ap-chrome-context', JSON.stringify({ asin, market, timestamp: Date.now(), action: 'analyze_product' }));
  window.open(getAmazonProductUrl(asin, market), '_blank');
  setTimeout(() => alert(`Page Amazon ouverte.\n\nPour analyser avec Claude in Chrome :\n1. Cliquez sur l'icône Claude dans votre navigateur\n2. Demandez : "Analyse cette fiche produit Amazon"\n\nOu copiez un prompt depuis la Configuration.`), 500);
}

const CHROME_PROMPTS = [
  "Analyse cette fiche produit Amazon : prix, avis clients, points forts/faibles du contenu, qualité des images. Donne des recommandations d'optimisation.",
  "Sur cette page de résultats Amazon, identifie les 5 principaux concurrents, compare leurs prix, notes et nombre d'avis. Quelle est la stratégie gagnante ?",
  "Qui détient la Buy Box sur cette page ? Y a-t-il des vendeurs 3P ? Analyse le risque de perte de Buy Box.",
  "Analyse les avis clients de ce produit. Quels sont les points positifs récurrents ? Les plaintes principales ? Suggestions d'amélioration produit."
];

function copyPrompt(i) {
  navigator.clipboard.writeText(CHROME_PROMPTS[i]).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = CHROME_PROMPTS[i];
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  });
  log('✓ Prompt copié', 'ok');
  const el = event.target;
  el.textContent = '✓ Copié !';
  setTimeout(() => el.textContent = '📋 Copier', 1500);
}
function go(s) {
  _yoyReturnCtx = null;  // toute navigation via go() = manuelle → efface le contexte retour YoY
  screen = s;
  aiResult = '';
  if (s !== 'asins') { selectedAsin = null; asinView = 'all'; asinViewAsins = null; }
  render();
}
function goAgentVC(asin) { agentVCParam = asin; go('agentvc'); }

function publishVC(asin, market) {
  const c = cl(); if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (!a) return;
  const mkt = market || c.mainMarket || '.fr';
  const fiche = (seoResults[asin] && seoResults[asin][mkt])
    || (c.ficheOptimisee && c.ficheOptimisee[asin] && c.ficheOptimisee[asin][mkt]);
  if (!fiche) { alert('Aucune fiche optimisée disponible pour cet ASIN.'); return; }
  // Charger la fiche dans seoResults pour que le wizard VC la trouve
  if (!seoResults[asin]) seoResults[asin] = {};
  seoResults[asin][mkt] = fiche;
  // Navigation directe vers l'étape 4 (résultat fiche)
  if (typeof agentVCState !== 'undefined') {
    agentVCState.asin     = asin;
    agentVCState.market   = mkt;
    agentVCState.sku      = a.sku || asin;
    agentVCState.step     = 4;
    agentVCState.progress = null;
  }
  go('agentvc');
}

function wizardNextStep(step) {
  wizardState.step = step;
  render();
}

function wizardRunSEO() {
  const c = cl(); if (!c) return;
  wizardState.step = 'c';
  wizardState.progress = 'seo';
  render();
  const keyword = seoMotcle[wizardState.asin] || extractSearchKeyword(wizardState.asin, c);
  runSEOFiche(wizardState.asin, wizardState.market, keyword)
    .then(function() {
      wizardState.progress = null;
      wizardState.ficheReady = true;
      wizardState.step = 'd';
      render();
    })
    .catch(function(e) {
      wizardState.progress = null;
      console.error('SEO error:', e);
      render();
    });
}

function wizardRunChallenge() {
  wizardState.step = 'e';
  wizardState.progress = 'challenge';
  render();
  runChallengeGPT(wizardState.asin, wizardState.market)
    .then(function() {
      wizardState.progress = null;
      wizardState.challengeReady = true;
      wizardState.step = 'e';
      render();
    })
    .catch(function(e) {
      wizardState.progress = null;
      console.error('Challenge error:', e);
      render();
    });
}

function wizardSaveAndChoose() {
  wizardState.step = 'g';
  render();
}

function updateWizardField(asin, mkt, field, val) {
  const c = cl(); if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (!a) return;
  const ch = a.ficheChallenge && a.ficheChallenge[mkt];
  if (ch) {
    const map = {
      titre: 'fusionTitre', description: 'fusionDesc', backendKW: 'fusionBackend',
      bullet0: 'fusionB1', bullet1: 'fusionB2', bullet2: 'fusionB3',
      bullet3: 'fusionB4', bullet4: 'fusionB5'
    };
    if (map[field]) ch[map[field]] = val;
  } else if (seoResults[asin] && seoResults[asin][mkt]) {
    const r = seoResults[asin][mkt];
    if (field === 'titre') r.titre = val;
    else if (field === 'description') r.description = val;
    else if (field === 'backendKW') r.backendKW = val;
    else if (field.startsWith('bullet')) r.bullets[parseInt(field.replace('bullet',''))] = val;
  }
}

function wizardSave(asin, mkt) {
  const c = cl(); if (!c) return;
  if (!c.asins || c.asins.length === 0) {
    console.error('[ABORT] wizardSave — asins vide'); return;
  }
  const a = c.asins.find(x => x.asin === asin);
  if (!a) return;
  const ch = a.ficheChallenge && a.ficheChallenge[mkt];
  const seoR = seoResults[asin] && seoResults[asin][mkt];
  const fiche = {
    titre:          (ch && ch.fusionTitre)   || (seoR && seoR.titre)       || '',
    bullets:        ch
      ? [ch.fusionB1, ch.fusionB2, ch.fusionB3, ch.fusionB4, ch.fusionB5]
      : (seoR && seoR.bullets) || [],
    description:    (ch && ch.fusionDesc)    || (seoR && seoR.description) || '',
    backendKW:      (ch && ch.fusionBackend) || (seoR && seoR.backendKW)   || '',
    positionnement: (seoR && seoR.positionnement) || '',
    leviers:        (seoR && seoR.leviers)        || '',
    erreurs:        (seoR && seoR.erreurs)         || '',
    opportunite:    (seoR && seoR.opportunite)     || '',
    pointImportant: (seoR && seoR.pointImportant)  || '',
    alertesFred:    (seoR && seoR.alertesFred)     || '',
    generatedAt:    new Date().toISOString(),
  };
  if (!c.ficheOptimisee) c.ficheOptimisee = {};
  // COPIE PROFONDE — jamais de référence directe
  c.ficheOptimisee[asin] = {};
  c.ficheOptimisee[asin][mkt] = JSON.parse(JSON.stringify(fiche));
  // Réinjecter dans seoResults
  if (!seoResults[asin]) seoResults[asin] = {};
  seoResults[asin][mkt] = c.ficheOptimisee[asin][mkt];
  // Vérification défensive avant save
  if (!c.asins || c.asins.length === 0) {
    console.error('[ABORT] wizardSave post-assign — asins corrompu'); return;
  }
  saveClientSafe(c);
  closeWizard();
}

function wizardSaveAndPublish(asin, mkt) {
  const c = cl(); if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (!a) return;
  // Sauvegarder la fiche (sans closeWizard pour enchaîner la navigation)
  if (!c.asins || c.asins.length === 0) {
    console.error('[ABORT] wizardSaveAndPublish — asins vide'); return;
  }
  const ch = a.ficheChallenge && a.ficheChallenge[mkt];
  const seoR = seoResults[asin] && seoResults[asin][mkt];
  const fiche = {
    titre:          (ch && ch.fusionTitre)   || (seoR && seoR.titre)       || '',
    bullets:        ch
      ? [ch.fusionB1, ch.fusionB2, ch.fusionB3, ch.fusionB4, ch.fusionB5]
      : (seoR && seoR.bullets) || [],
    description:    (ch && ch.fusionDesc)    || (seoR && seoR.description) || '',
    backendKW:      (ch && ch.fusionBackend) || (seoR && seoR.backendKW)   || '',
    positionnement: (seoR && seoR.positionnement) || '',
    leviers:        (seoR && seoR.leviers)        || '',
    erreurs:        (seoR && seoR.erreurs)         || '',
    opportunite:    (seoR && seoR.opportunite)     || '',
    pointImportant: (seoR && seoR.pointImportant)  || '',
    alertesFred:    (seoR && seoR.alertesFred)     || '',
    generatedAt:    new Date().toISOString(),
  };
  if (!c.ficheOptimisee) c.ficheOptimisee = {};
  c.ficheOptimisee[asin] = {};
  c.ficheOptimisee[asin][mkt] = JSON.parse(JSON.stringify(fiche));
  if (!seoResults[asin]) seoResults[asin] = {};
  seoResults[asin][mkt] = c.ficheOptimisee[asin][mkt];
  saveClientSafe(c);
  // Naviguer vers Agent VC étape 4 — publication
  if (typeof agentVCState !== 'undefined') {
    agentVCState.asin     = asin;
    agentVCState.market   = mkt;
    agentVCState.sku      = wizardState.sku || a.sku || asin;
    agentVCState.step     = 4;
    agentVCState.progress = null;
  }
  resetWizard();
  go('agentvc');
}

// goAgentSEO + goAgentSEOPublish supprimés — remplacés par openWizard/publishVC (v3.4.29)

function deleteAnnualData(year) {
  const c = cl();
  if (!c) return;
  delete c.annualData[year];
  save(); render();
  log('🗑 Données annuelles ' + year + ' supprimées', 'ok');
}

function deleteYTDData() {
  const c = cl();
  if (!c) return;
  c.ytdData = {};
  save(); render();
  log('🗑 Données YTD supprimées', 'ok');
}

function goFilteredAsins(preset) {
  screen = 'asins';
  selectedAsin = null;
  aiResult = '';
  asinLimit = 9999;
  filters.segment = 'all';
  asinSearch = '';

  const c = cl();
  if (!c) { render(); return; }
  const allAsins = [...c.asins];

  // v3.6.8.8 — Si filtre YoY actif et sous-filtre demandé : travailler dans le pool YoY
  // (ne pas exploser vers tout le catalogue, préserver le contexte de navigation)
  const yoyActive = asinViewCustomIds && asinViewCustomIds.length > 0 && preset !== 'yoy-warning' && preset !== 'all';
  const pool = yoyActive
    ? allAsins.filter(function(a) { return asinViewCustomIds.indexOf(a.asin) > -1; })
    : allAsins;
  const totalCA = pool.reduce((s,a) => s+(getRevenue(a,c)||0), 0);

  // Garder 'yoy-warning' pour préserver le badge YoY si sous-filtre dans contexte YoY
  asinView = yoyActive ? 'yoy-warning' : preset;

  if (preset === 'lowstock') {
    asinSort = 'stock_asc';
    asinViewAsins = pool.filter(a => {
      const oos = parseNum(a.oosPct);
      return (getRevenue(a,c)||0) > 50 && (
        (oos > 0 && oos < 90) ||
        (a.sellableUnits != null && a.sellableUnits >= 0 && a.sellableUnits < 30)
      );
    }).map(a => a.asin);
  } else if (preset === 'declining') {
    asinSort = 'baisse';
    asinViewAsins = pool.filter(a => (getRevenue(a,c)||0) > 0 && parseNum(a.revenueDelta) <= -10)
      .map(a => a.asin);
  } else if (preset === 'growing') {
    asinSort = 'hausse';
    asinViewAsins = pool.filter(a => (getRevenue(a,c)||0) > 0 && parseNum(a.revenueDelta) >= 20)
      .map(a => a.asin);
  } else if (preset === 'seg-a') {
    asinSort = 'ca_desc';
    asinViewAsins = pool.filter(a => calcSegment(a, totalCA, c) === 'A').map(a => a.asin);
  } else if (preset === 'seg-b') {
    asinSort = 'ca_desc';
    asinViewAsins = pool.filter(a => calcSegment(a, totalCA, c) === 'B').map(a => a.asin);
  } else if (preset === 'seg-c') {
    asinSort = 'ca_desc';
    asinViewAsins = pool.filter(a => calcSegment(a, totalCA, c) === 'C').map(a => a.asin);
  } else if (preset === 'yoy-warning') {
    // v3.6.7 — CTA 11 / CTA 12 : filtre YoY par liste d'ASIN IDs
    asinSort = 'baisse';
    asinViewAsins = (asinViewCustomIds && asinViewCustomIds.length) ? asinViewCustomIds.slice() : [];
  } else if (preset === 'all') {
    asinSort = 'ca_desc';
    if (asinViewCustomIds && asinViewCustomIds.length) {
      // Dans contexte YoY, "Tous" = revenir à l'ensemble des ASINs YoY (pas tout le catalogue)
      asinViewAsins = asinViewCustomIds.slice();
    } else {
      asinViewAsins = null;
    }
  } else {
    asinSort = 'ca_desc';
    asinViewAsins = null;
  }
  render();
}
// v3.6.7 — CTA 11 / CTA 12 : navigation vers Analyse ASINs avec filtre YoY
// v3.6.8 α+γ : pushState pour Back navigateur + _yoyReturnCtx pour bandeau retour
function goToAsinsYoY(asinIds, label) {
  _yoyReturnCtx = { scrollY: window.scrollY, label: 'Analyse comparée' };
  try {
    // replaceState marque l'entrée COURANTE (page YoY) avec scrollY
    // pushState crée une nouvelle entrée vide pour la vue ASINs
    // → Back navigue de l'entrée ASINs à l'entrée YoY → popstate reçoit { _yoyPage:true }
    history.replaceState({ _yoyPage: true, scrollY: window.scrollY }, '');
    // Stocker asinIds + label dans l'entrée ASINs pour que Forward puisse restaurer le filtre
    history.pushState({ _asinsFromYoy: true, asinIds: (Array.isArray(asinIds) ? asinIds : []), label: (label || 'Filtré par YoY') }, '');
  } catch(e) {}
  asinViewCustomIds = Array.isArray(asinIds) && asinIds.length ? asinIds : [];
  asinViewLabel     = label || 'Filtré par YoY';
  goFilteredAsins('yoy-warning');
}

// v3.6.8 α+γ : retour YoY depuis bandeau "← Analyse comparée"
function yoyGoBack() {
  var ctx = _yoyReturnCtx;
  _yoyReturnCtx = null;
  go('yoy');
  if (ctx && ctx.scrollY) setTimeout(function() { try { window.scrollTo(0, ctx.scrollY); } catch(e) {} }, 80);
}

// v3.6.8 γ : handler popstate — Back (→ YoY) ET Forward (→ ASINs filtrés)
window.addEventListener('popstate', function(e) {
  if (!e.state) return;

  if (e.state._yoyPage) {
    // BACK : retour à la page YoY
    var sy = e.state.scrollY || 0;
    _yoyReturnCtx = null;
    go('yoy');
    if (sy) setTimeout(function() { try { window.scrollTo(0, sy); } catch(ex) {} }, 100);

  } else if (e.state._asinsFromYoy) {
    // FORWARD : retour vers la vue ASINs filtrée (après un Back)
    _yoyReturnCtx = { scrollY: 0, label: 'Analyse comparée' };
    asinViewCustomIds = Array.isArray(e.state.asinIds) ? e.state.asinIds : [];
    asinViewLabel     = e.state.label || 'Filtré par YoY';
    goFilteredAsins('yoy-warning');
  }
});

function selClient(id) { activeId = id; screen = 'dashboard'; selectedAsin = null; aiResult = ''; render(); }
function startOnboarding() { newClient = freshClient(); wizStep = 0; screen = 'onboarding'; render(); }
function wizGo(step) { wizStep = step; render(); }
function wizNext() {
  if (wizStep === 0 && !newClient.name.trim()) { alert('Nom du client requis'); return; }
  if (wizStep === 2) {
    if (!newClient.accounts || newClient.accounts.length === 0) { return; }
    if (!newClient.catalogueXML || newClient.catalogueXML.length === 0) { return; }
  }
  wizStep++; render();
}
function finishOnboarding() { clients.push(newClient); activeId = newClient.id; save(); screen = 'import'; render(); }
function wizAddBrand() {
  var name = prompt('Nom de la marque :');
  if (!name || !name.trim()) return;
  if (!newClient.brands) newClient.brands = [];
  if (newClient.brands.some(function(b) { return norm(b.name) === norm(name.trim()); })) {
    showToast('Marque déjà présente', '', 'warn'); return;
  }
  newClient.brands.push({ name: name.trim(), role: 'fabricant' });
  render();
}
function wizSetBrandRole(idx, role) {
  if (!newClient.brands || !newClient.brands[idx]) return;
  newClient.brands[idx].role = role;
  render();
}
function wizRemoveBrand(idx) {
  if (!newClient.brands) return;
  newClient.brands.splice(idx, 1);
  render();
}
function wizAddAccount() {
  var market = document.getElementById('newAcctMarket') ? document.getElementById('newAcctMarket').value : '.fr';
  var vc = document.getElementById('newAcctVC') ? document.getElementById('newAcctVC').value.trim().toUpperCase() : '';
  var role = document.getElementById('newAcctRole') ? document.getElementById('newAcctRole').value : 'BO';
  var label = document.getElementById('newAcctLabel') ? document.getElementById('newAcctLabel').value.trim() : '';
  if (!vc) { alert('Vendor Code obligatoire'); return; }
  if (!newClient.accounts) newClient.accounts = [];
  if (newClient.accounts.some(function(a) { return a.vendorCode === vc && a.market === market; })) {
    alert('Ce vendor code existe déjà sur ce marché'); return;
  }
  newClient.accounts.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    market: market, vendorCode: vc, role: role, label: label
  });
  render();
}
function wizRemoveAccount(accountId) {
  if (!newClient.accounts) return;
  newClient.accounts = newClient.accounts.filter(function(a) { return a.id !== accountId; });
  render();
}
function wizHandleXML(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var result = parseMatriceTarifXML(e.target.result);
    if (result.error) { alert('Erreur XML : ' + result.error); return; }
    newClient.catalogueXML = result.items;
    newClient.xmlSummary = result.summary;
    newClient.xmlImportDate = new Date().toISOString();
    render();
  };
  reader.readAsText(file);
}
function toggleMarket(m, checked) { if (checked && !newClient.markets.includes(m)) newClient.markets.push(m); if (!checked) newClient.markets = newClient.markets.filter(x => x !== m); render(); }
function toggleClientMarket(m, checked) { const c = cl(); if (!c) return; if (checked && !c.markets.includes(m)) c.markets.push(m); if (!checked) c.markets = c.markets.filter(x => x !== m); save(); render(); }

function addClientAccount() {
  var c = cl();
  if (!c) return;
  var market = document.getElementById('newAcctMarket') ? document.getElementById('newAcctMarket').value : '.fr';
  var vc = document.getElementById('newAcctVC') ? document.getElementById('newAcctVC').value.trim().toUpperCase() : '';
  var role = document.getElementById('newAcctRole') ? document.getElementById('newAcctRole').value : 'BO';
  var label = document.getElementById('newAcctLabel') ? document.getElementById('newAcctLabel').value.trim() : '';
  if (!vc) { showToast('⚠️ Vendor Code obligatoire', '', 'warn'); return; }
  if (!c.accounts) c.accounts = [];
  if (c.accounts.some(function(a) { return a.vendorCode === vc && a.market === market; })) {
    showToast('⚠️ Ce vendor code existe déjà sur ce marché', '', 'warn'); return;
  }
  c.accounts.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    market: market, vendorCode: vc, role: role, label: label
  });
  save(); render();
}

function removeClientAccount(accountId) {
  var c = cl();
  if (!c || !c.accounts) return;
  var acc = c.accounts.find(function(a) { return a.id === accountId; });
  if (!acc) return;
  if (!confirm('Supprimer ' + acc.vendorCode + ' ?')) return;
  c.accounts = c.accounts.filter(function(a) { return a.id !== accountId; });
  save(); render();
}

function updateClientAccount(accountId, field, value) {
  var c = cl();
  if (!c || !c.accounts) return;
  var acc = c.accounts.find(function(a) { return a.id === accountId; });
  if (!acc) return;
  if (field === 'vendorCode') value = value.toUpperCase();
  acc[field] = value;
  save();
  // Pas de render() complet pour éviter de perdre le focus sur les inline edits
}

function ficheHandleXML(input) {
  var c = cl();
  if (!c) return;
  var file = input.files && input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var result = parseMatriceTarifXML(e.target.result);
    if (result.error) { alert('Erreur XML : ' + result.error); return; }

    // Garde-fou : vérifier que les vendor codes du XML correspondent au client
    var clientVCs = (c.accounts || []).map(function(a) { return (a.vendorCode || '').trim().toUpperCase(); }).filter(Boolean);
    if (clientVCs.length > 0 && result.summary && result.summary.vendorCodes) {
      var xmlVCs = Object.keys(result.summary.vendorCodes).map(function(k) { return k.trim().toUpperCase(); });
      var matched = xmlVCs.filter(function(vc) { return clientVCs.indexOf(vc) !== -1; });
      if (matched.length === 0) {
        var xmlVCList = xmlVCs.join(', ');
        var clientVCList = clientVCs.join(', ');
        var proceed = confirm(
          '⛔ ATTENTION — Les vendor codes de ce XML ne correspondent pas au client !\n\n'
          + 'Vendor codes XML    : ' + xmlVCList + '\n'
          + 'Vendor codes client : ' + clientVCList + '\n\n'
          + 'Vous êtes sur le client "' + c.name + '".\n'
          + 'Vérifiez que vous importez la bonne matrice tarifaire.\n\n'
          + 'Voulez-vous VRAIMENT continuer ?'
        );
        if (!proceed) {
          log('⛔ Import XML annulé — vendor codes incompatibles (' + xmlVCList + ' ≠ ' + clientVCList + ')', 'err');
          return;
        }
        log('⚠️ Import XML forcé malgré vendor codes incompatibles', 'warn');
      }
    }

    c.catalogueXML = result.items;
    c.xmlSummary = result.summary;
    c.xmlImportDate = new Date().toISOString();
    // Re-enrichissement immédiat des titres depuis le XML mis à jour
    var xmlByAsinNew = {};
    result.items.forEach(function(xi) { if (xi.asin) xmlByAsinNew[xi.asin] = xi; });
    var reEnriched = 0;
    (c.asins || []).forEach(function(a) {
      var xmlM = xmlByAsinNew[a.asin];
      if (xmlM && xmlM.description) {
        if (a.title && !a.titleOriginal) a.titleOriginal = a.title;
        a.title = xmlM.description;
        reEnriched++;
      }
    });
    if (reEnriched > 0) log('🇫🇷 Titres re-enrichis depuis XML : ' + reEnriched + ' ASINs mis à jour', 'ok');
    save(); render();
  };
  reader.readAsText(file);
}

function ncSet(key, val) { newClient[key] = val; render(); }
function updClient(key, val) { const c = cl(); if (c) { c[key] = val; save(); } }
function deleteClient(id) { clients = clients.filter(c => c.id !== id); activeId = clients.length ? clients[0].id : null; screen = clients.length ? 'dashboard' : 'welcome'; save(); render(); }
function setFilter(k, v) { filters[k] = v; render(); }
function resetFilters() { filters = { market: 'all', brand: 'all', segment: 'all' }; render(); }
function setKpiPrimaire(mode) { const c = cl(); if (!c) return; c.kpiPrimaireCA = mode; save(); go('dashboard'); }
function selectAsin(asin) {
  selectedAsin = asin;
  aiResult = '';
  render();
}
function analyzeAsin(asin) { selectedAsin = asin; screen = 'asins'; aiResult = ''; render(); }
function setAway() {
  const c = cl();
  if (!c) return;
  const today = new Date();
  // Proposer une date par défaut = dans 2 semaines
  const defaultDate = new Date(today.getTime() + 14 * 86400000)
    .toISOString().slice(0, 10);
  const input = prompt('Date de retour (AAAA-MM-JJ) :', defaultDate);
  if (!input) return;
  const d = new Date(input);
  if (isNaN(d.getTime())) { alert('Date invalide.'); return; }
  if (d <= today) { alert('La date doit être dans le futur.'); return; }
  c.awayUntil = d.toISOString();
  save(); render();
  log('🏖️ Conges jusqu\'au ' + d.toLocaleDateString('fr-FR'), 'ok');
}

function clearAway() {
  const c = cl();
  if (!c) return;
  c.awayUntil = null;
  save(); render();
  log('✓ Retour de congés enregistré', 'ok');
}



function toggleAction(id) { const c = cl(); if (!c) return; const a = c.weeklyActions.find(x => x.id === id); if (a) { a.done = !a.done; save(); render(); } }
function toggleMonthlyAction(id) { const c = cl(); if (!c) return; const a = c.monthlyActions?.find(x => x.id === id); if (a) { a.done = !a.done; save(); render(); } }
function addManualAction() {
  const c = cl();
  if (!c) return;
  const title = prompt('Titre de l\'action :');
  if (!title) return;
  const day = prompt('Jour (Lundi/Mardi/Mercredi/Jeudi/Vendredi) :', 'Lundi');
  if (!day) return;
  if (!c.weeklyActions) c.weeklyActions = [];
  c.weeklyActions.push({
    id: 'manual-' + Date.now(), type: 'manual', priority: 'medium',
    title, description: '', asins: [], done: false, day, manual: true
  });
  save(); render();
}
function regenerateActions() { const c = cl(); if (!c) return; c.weeklyActions = generateWeeklyActions(c); save(); render(); }
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

// ═══════════════════════════════════════════════════════════════
// IMPORT CSV PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════
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

function getPOData(c, asin) {
  return c && c.poData && c.poData[asin] ? c.poData[asin] : null;
}

function formatFillRate(fillRate) {
  if (fillRate === null || fillRate === undefined) return null;
  if (fillRate >= 90) return { label: fillRate + '%', cls: 'g' };
  if (fillRate >= 70) return { label: fillRate + '%', cls: 'a' };
  return { label: fillRate + '%', cls: 'r' };
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

function showToast(msg, type, duration) {
  duration = duration || 4000;
  document.querySelectorAll('.ap-toast').forEach(function(t){ t.remove(); });
  var toast = document.createElement('div');
  toast.className = 'ap-toast';
  var bg  = type === 'alr-g' ? '#D1FAE5' : type === 'alr-r' ? '#FEE2E2' : type === 'alr-a' ? '#FEF3C7' : '#fff';
  var bd  = type === 'alr-g' ? '#6EE7B7' : type === 'alr-r' ? '#FCA5A5' : type === 'alr-a' ? '#FDE68A' : '#E5E7EB';
  var ic  = type === 'alr-g' ? '✅' : type === 'alr-r' ? '❌' : type === 'alr-a' ? '⚠️' : 'ℹ️';
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:' + bg + ';border:1px solid ' + bd + ';border-radius:12px;padding:12px 16px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:9999;display:flex;align-items:center;gap:10px;max-width:360px';
  toast.innerHTML = '<span style="font-size:18px">' + ic + '</span><span style="flex:1">' + esc(String(msg)) + '</span><button onclick="this.parentNode.remove()" style="background:none;border:none;cursor:pointer;color:#6B7280;font-size:16px;padding:0 2px">×</button>';
  document.body.appendChild(toast);
  setTimeout(function(){ if (toast.parentNode) toast.remove(); }, duration);
}

function showImportSuccess(asinCount) {
  // Toast de confirmation avec bouton CTA vers la Revue Hebdo
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:16px 18px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:999;display:flex;align-items:center;gap:14px;min-width:280px';
  toast.innerHTML = `
    <span style="font-size:22px">✅</span>
    <div style="flex:1">
      <div style="font-weight:700;color:#111">${asinCount.toLocaleString('fr-FR')} ASINs importés</div>
      <div style="font-size:11px;color:#6B7280;margin-top:2px">Données prêtes pour l'analyse</div>
    </div>
    <button onclick="go('weekly');this.closest('div').remove()" style="background:#FF9900;color:#000;border:none;border-radius:8px;padding:7px 13px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">🗓️ Revue Hebdo →</button>
    <button onclick="this.closest('div').remove()" style="background:none;border:none;color:#9CA3AF;cursor:pointer;font-size:16px;padding:0 4px">×</button>
  `;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 8000);
}

// ── Garde-fous import ────────────────────────────────────────────────────────
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

function saveApiKeyFromInput() {
  const input = document.getElementById('api-key-input');
  if (!input) return;
  const key = input.value.trim();
  if (!key.startsWith('sk-ant-')) { alert('La clé doit commencer par "sk-ant-"'); return; }
  saveApiKey(key); render();
}

function clearApiKey() {
  if (!confirm('Supprimer la clé API ?')) return;
  apiKey = ''; localStorage.removeItem('ap-api-key');
  log('✓ Clé supprimée', 'ok'); render();
}
function initDragDrop() {
  document.addEventListener('dragover', e => {
    e.preventDefault();
    document.getElementById('drop-zone')?.classList.add('dragover');
  });
  document.addEventListener('dragleave', e => {
    const z = document.getElementById('drop-zone');
    if (z && !z.contains(e.relatedTarget)) z.classList.remove('dragover');
  });
  document.addEventListener('drop', e => {
    e.preventDefault();
    document.getElementById('drop-zone')?.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(csv|tsv|txt)$/i.test(f.name));
    if (!files.length) return;
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    if (screen === 'onboarding' && wizStep === 4) {
      // Drop pendant l'étape Historique
      const input = document.getElementById('hist-files');
      if (input) { input.files = dt.files; handleHistCSV(input); }
    } else if (screen === 'import') {
      // Détecter si le drop est sur la zone historique ou hebdomadaire
      const dropTarget = e.target.closest('.import-zone');
      const histZone = document.getElementById('hist-files-import')?.closest('.import-zone') ||
                       document.querySelector('[onclick*="hist-files-import"]')?.closest('.import-zone');
      if (dropTarget && histZone && (dropTarget === histZone || histZone.contains(dropTarget))) {
        // Drop sur la zone historique
        const input = document.getElementById('hist-files-import');
        if (input) { input.files = dt.files; handleHistCSVImport(input); }
    } else if (screen === 'import' && e.target.closest('#po-drop-zone')) {
      const dt2 = new DataTransfer();
      files.forEach(f => dt2.items.add(f));
      const poInput = document.getElementById('po-file-input');
      if (poInput) { poInput.files = dt2.files; handlePOImport(poInput.files); }
    } else {
        // Drop sur la zone hebdomadaire (ou ailleurs dans l'écran)
        const input = document.getElementById('csv-files');
        if (input) { input.files = dt.files; handleMultiCSV(input); }
      }
    }
  });
}
async function init() {
  try {
    await load();
    // Réinjecter TOUTES les ficheOptimisee dans seoResults au démarrage
    clients.forEach(function(c) {
      if (!c.ficheOptimisee) return;
      Object.keys(c.ficheOptimisee).forEach(function(asin) {
        if (!seoResults[asin]) seoResults[asin] = c.ficheOptimisee[asin];
      });
    });
    initDragDrop();
    if (!clients.length) screen = 'welcome';
    try {
      render();
    } catch(renderErr) {
      console.error('RENDER ERROR:', renderErr);
      console.error('Stack:', renderErr.stack);
      console.error('screen:', screen, 'selectedAsin:', selectedAsin);
    }
    log('🚀 Amazon Pilot v' + APP_VERSION + ' initialisé', 'ok');
    // Injection version dans tous les spans DOM
    document.querySelectorAll('[id^="ap-ver-"]').forEach(function(el) { el.textContent = APP_VERSION; });
  } catch(initErr) {
    console.error('INIT ERROR:', initErr);
    console.error('Stack:', initErr.stack);
  }
}

// @yoy

document.addEventListener('DOMContentLoaded', init);
