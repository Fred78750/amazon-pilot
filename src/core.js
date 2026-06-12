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




// @import_export



// ── Fraîcheur des données ────────────────────────────────────────
// Retourne un objet par type : { ventes, trafic, stock }
// Chaque entrée : { lastDate, daysSince, weeksBehind, missing, status }
// status : 'ok' (semaine précédente couverte) | 'stale' (1 sem. derrière) | 'missing' (2+ sem. ou absent)
// Logique métier : les données de la semaine S-1 sont disponibles le lundi de la semaine S.
// On vérifie donc que le dernier import couvre bien la semaine ISO précédente, pas juste l'ancienneté.



// Retourne la plage de dates d'une semaine ISO (ex: "14-20 avr.")


// Couleur du point sidebar selon fraîcheur globale





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
// @ai_core

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



// ══════════════════════════════════════════════════════════════════
// MODULE BUY BOX — Surveillance & Plan d'action
// ══════════════════════════════════════════════════════════════════

// @buybox


function _dwParseDate(s) {
  if (!s) return 0;
  if (s.indexOf('/') > -1) { const p = s.split('/'); return new Date(p[2], p[1]-1, p[0]); }
  return new Date(s);
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

// @s3_poll


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


// ═══════════════════════════════════════════════════════════════
// IMPORT CSV PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════




function getPOData(c, asin) {
  return c && c.poData && c.poData[asin] ? c.poData[asin] : null;
}

function formatFillRate(fillRate) {
  if (fillRate === null || fillRate === undefined) return null;
  if (fillRate >= 90) return { label: fillRate + '%', cls: 'g' };
  if (fillRate >= 70) return { label: fillRate + '%', cls: 'a' };
  return { label: fillRate + '%', cls: 'r' };
}





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
// @render_shell
// @render_screens
// @charts

document.addEventListener('DOMContentLoaded', init);
