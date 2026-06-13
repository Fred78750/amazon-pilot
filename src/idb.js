// Amazon Pilot — src/idb.js
// IDB / Persistance extrait de core.js (v3.7.1)
// Injecté via // @idb dans core.js (build.py)

let apiKey = '';
let _db = null;

function freshClient() {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    name: '', brand: '', sector: '', contactOp: '', reason: '',
    brands: [],  // [{ name: 'COGEX', role: 'fabricant' }] role: 'fabricant'|'revendeur'
    model: '1P (Vendor Central)', vendorCode: '', accounts: [],  // [{ id, market, vendorCode, role: 'BO'|'catalogue', label }]
    markets: ['.fr'], mainMarket: '.fr',
    fulfillment: 'Amazon (Vendor Direct)',
    stockDeporte: false, btr: 'Autorisé', btrNote: '', threeP: true,
    budget: '', pricingPolicy: 'Prix libre',
    imports: [], asins: [],
    history: { weekly: [], monthly: [], yearly: [] },
    weeklyActions: [],
    monthlyActions: [],
    awayUntil: null, // Date ISO de retour de congés
    csvImported: false,
    // Données contextuelles longue période
    annualData: {},  // { '2025': { ventes: {...}, trafic: {...}, stock: {...} } }
    ytdData: {},     // { ventes: {...}, trafic: {...}, stock: {...} } — écrasé à chaque import YTD
    // ── Paramètres appros ──
    leadTime: 20,        // semaines (fabrication + transport)
    stockTarget: 8,      // semaines de couverture cible sur Amazon
    moq: 0,              // quantité minimale de commande (0 = pas de contrainte)
    // ── Catalogue ASIN ↔ SKU fournisseur ──
    catalogue: [],       // [{ asin, sku, ean, description, prixAchat, vendorCode }]
    catalogueXML: [],    // [{ asin, ean, model, description, vendorCode, status, cost }] — source: matrice tarifaire XML
    pos: [],             // [{ poId, asin, sku, title, vendorCode, qty, qtyAccepted,
    ficheOptimisee: {},  // asin => marche => {titre,bullets,description,nomType,backendKW,generatedAt} + actions[]
    // ── Données enrichies ──
    ppmData: {},         // { asin: { ppm: float, ppmDeltaBps: int, importedAt: ISO } }
    forecastData: {},    // { asin: { weeks: [float x48], importedAt: ISO, weekLabels: [str x48] } }
    // ── Buy Box v3.6.0 — Données défauts livraison + rendez-vous ──
    deliveryDefects: [],         // [{ weekEnd, vendorCode, vendorCodeCountry, fc, fcCountry, po, isa, carrier, deliveryWindowStart, deliveryWindowEnd, carrierFirstRequestedDeliveryDate, delayLength, delayCategory, subDefect, subDefectExplanation, defectDate, receiveDate, units }]
    deliveryDefectsDate: '',     // ISO date du dernier import
    deliveryAppointments: [],    // [{ isa, arn, asn, vBol, cBol, vPro, cPro, isd, po, asnQty, initialReceivedQty, issues: [], appointmentCreationDate, fcStatus, scheduledArrival, actualArrival, firstCarrierRequestedDeliveryDate, carrierRequestedDeliveryDate, windowStart, windowEnd, carrier, mode, shipTo, lastUpdated, sourceLanguage }]
    deliveryAppointmentsDate: '', // ISO date du dernier import
    bolSource: '',               // 'ERP' | 'CMS' | 'OMS' | 'TRANSPORTEUR' | 'INCONNU' | ''
    bolSourceDetail: '',         // texte libre : 'Navision', 'SAP', 'Shopify Plus', etc.
    // ── Buy Box v3.6.1 — Cas d'enquête ──
    buyboxCases: [], // [{ id, asin, status, openedAt, closedAt, facts: {snapshot, computedAt}, hypotheses: [{id, status, evidence, updatedAt}], journal: [{ts, type, content, author}], conclusion: {state, proposedAction, outcome, closedAt} }]
    // ── YoY Enquête v3.6.8 ──
    brandAliases:         [],   // [{ canonical: string, variants: string[] }] — alias marques pour Section Marques
    enquetePeriodMonths:  4,    // fenêtre PO pour algo classification (slider 1-12, défaut 4)
    anomalyThreshold:     80,   // seuil similarité Levenshtein anomalies (50-100%, défaut 80%)
    poItemExportRawLines: 0,    // total lignes brutes du dernier import POItemExport (avant déduplication)
    // ── Analyse comparée v3.6.9 ──
    viewMode: 'free',           // 'free' | 'pro' — toggle Free/Pro UI-only, persisté IDB
    aiCache:  {}                // cache narratives IA { diagnosticV1: { hash, generatedAt, content, sign } }
  };
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open('AmazonPilot', 6);  // v6 : ajout ai_usage_log (règle 35)
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('clients')) {
        db.createObjectStore('clients', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta');
      }
      if (!db.objectStoreNames.contains('yoy_analyses')) {
        const yoyStore = db.createObjectStore('yoy_analyses', { keyPath: 'id' });
        yoyStore.createIndex('clientId', 'clientId', { unique: false });
        yoyStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('erp_stock')) {
        db.createObjectStore('erp_stock', { keyPath: '_key' });
      }
      // v5 — historique mesures smoke par client (brique amorce détection dérive)
      if (!db.objectStoreNames.contains('smoke_history')) {
        const sh = db.createObjectStore('smoke_history', { keyPath: 'key' });
        sh.createIndex('clientId',  'clientId',  { unique: false });
        sh.createIndex('timestamp', 'timestamp', { unique: false });
      }
      // v6 — logging coûts IA (règle 35 Orchestrateur V0.9)
      if (!db.objectStoreNames.contains('ai_usage_log')) {
        const al = db.createObjectStore('ai_usage_log', { keyPath: 'id' });
        al.createIndex('by_timestamp', 'timestamp', { unique: false });
        al.createIndex('by_client_id', 'client_id', { unique: false });
        al.createIndex('by_feature',   'feature',   { unique: false });
        al.createIndex('by_model',     'model',     { unique: false });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

async function saveSmokeHistory(clientId, clientName, measures) {
  try {
    const db = await openDB();
    const ts  = new Date().toISOString();
    const key = (clientId || 'unknown') + ':' + ts;
    await new Promise(function(res, rej) {
      const tx = db.transaction(['smoke_history'], 'readwrite');
      tx.objectStore('smoke_history').put({
        key:        key,
        clientId:   clientId   || 'unknown',
        clientName: clientName || clientId || 'unknown',
        timestamp:  ts,
        measures:   measures || {}
      });
      tx.oncomplete = res;
      tx.onerror = function() { rej(tx.error); };
    });
    // Compter les mesures accumulées pour ce client (via index)
    const clientEntries = await new Promise(function(res) {
      const tx2 = db.transaction(['smoke_history'], 'readonly');
      const req2 = tx2.objectStore('smoke_history').index('clientId').getAll(clientId || 'unknown');
      req2.onsuccess = function() { res(req2.result || []); };
      req2.onerror  = function() { res([]); };
    });
    const nbMesures = clientEntries.length;
    // Date cible = 1ère mesure + 6 mois
    const sorted   = clientEntries.slice().sort(function(a, b) { return a.timestamp < b.timestamp ? -1 : 1; });
    const firstTs  = sorted.length > 0 ? sorted[0].timestamp : ts;
    const dateCible = new Date(firstTs);
    dateCible.setMonth(dateCible.getMonth() + 6);
    const dateCibleStr = dateCible.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    console.info('[INFO] SMOKE_HISTORY: ' + (clientName || clientId) + ' — ' + nbMesures + ' mesures accumulées. Détection de dérive activée dès ' + dateCibleStr + '.');
  } catch(err) {
    console.warn('[WARN] saveSmokeHistory:', err);
  }
}

function migrateXMLTitles(clients) {
  // Migration silencieuse : enrichit les titres existants depuis catalogueXML (désignations FR)
  // S'applique une fois par ASIN (skip si titleOriginal déjà présent)
  clients.forEach(function(c) {
    if (!c.catalogueXML || c.catalogueXML.length === 0) return;
    if (!c.asins || c.asins.length === 0) return;
    var xmlByAsin = {};
    for (var xi = 0; xi < c.catalogueXML.length; xi++) {
      var xItem = c.catalogueXML[xi];
      if (xItem.asin && !xmlByAsin[xItem.asin]) xmlByAsin[xItem.asin] = xItem;
    }
    for (var ai = 0; ai < c.asins.length; ai++) {
      var a = c.asins[ai];
      var xmlMatch = xmlByAsin[a.asin];
      if (xmlMatch && xmlMatch.description) {
        if (a.title && !a.titleOriginal) a.titleOriginal = a.title; // conserver VC original une seule fois
        a.title = xmlMatch.description; // toujours mettre à jour depuis XML (source authoritative FR)
        if (!a.ean && xmlMatch.ean) a.ean = xmlMatch.ean;
        if (!a.model && xmlMatch.model) a.model = xmlMatch.model;
      }
    }
  });
  return clients;
}

function migrateSnapshotRevenue(clients) {
  clients.forEach(function(c) {
    (c.asins || []).forEach(function(a) {
      if (!a.history || !a.history.length) return;
      const lastSnap = a.history[a.history.length - 1];
      if (lastSnap && Math.abs(lastSnap.revenue - getRevenue(a, c)) > 100 && getRevenue(a, c) > 0) {
        lastSnap.revenue = getRevenue(a, c) || a.revenue || 0;
        lastSnap.orderedRevenue = a.orderedRevenue || 0;
        lastSnap.shippedRevenue = a.shippedRevenue || a.revenue || 0;
        lastSnap.units = getUnits(a, c) || a.units || lastSnap.units || 0;
      }
    });
  });
  return clients;
}

async function save() {
  try {
    const db = await openDB();
    const tx = db.transaction('clients', 'readwrite');
    const store = tx.objectStore('clients');
    // Vider et réécrire tous les clients
    await new Promise(r => { store.clear().onsuccess = r; });
    for (const c of clients) {
      store.put({ ...c, imports: (c.imports||[]).slice(-50) });
    }
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    log('💾 Sauvegardé — IndexedDB', 'ok');
  } catch(e) {
    log('Save error: ' + e.message, 'err');
    // Fallback localStorage (limité mais mieux que rien)
    try {
      const slim = clients.map(c => ({ ...c, asins: (c.asins||[]).slice(0,200).map(a => ({...a,history:a.history?.slice(-8)||[],historyMonthly:a.historyMonthly?.slice(-6)||[]})), imports:(c.imports||[]).slice(-5) }));
      localStorage.setItem('ap-v31-fallback', JSON.stringify(slim));
      log('⚠ Fallback localStorage (200 ASINs max)', 'warn');
    } catch(e2) { log('Save fatal: ' + e2.message, 'err'); }
  }
}

function saveApiKey(key) {
  apiKey = key;
  localStorage.setItem('ap-api-key', key);
  log('✓ Clé API sauvegardée', 'ok');
}

async function load() {
  try {
    const db = await openDB();
    const tx = db.transaction('clients', 'readonly');
    const store = tx.objectStore('clients');
    const data = await new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    if (data && data.length) {
      // Merger avec freshClient() pour garantir la présence de tous les champs
      clients = data.map(c => ({ ...freshClient(), ...c,
        weeklyActions:  c.weeklyActions  || [],
        monthlyActions: c.monthlyActions || [],
        awayUntil:      c.awayUntil      || null,
        leadTime:       c.leadTime       ?? 20,
        stockTarget:    c.stockTarget    ?? 8,
        moq:            c.moq            ?? 0,
        catalogue:      c.catalogue      || [],
        catalogueXML:   c.catalogueXML   || [],
        accounts:       c.accounts       || [],
        pos:            c.pos            || [],
        ficheOptimisee: c.ficheOptimisee || {},
        ppmData:        c.ppmData        || {},
        forecastData:   c.forecastData   || {},
        // v3.6.0 — migration défensive : champs Buy Box défauts & rendez-vous
        deliveryDefects:            c.deliveryDefects            || [],
        deliveryDefectsDate:        c.deliveryDefectsDate        || '',
        deliveryDefectsUnresolved:  c.deliveryDefectsUnresolved  || [], // v3.7.8 — POs sans ASIN résolu
        deliveryAppointments:       c.deliveryAppointments       || [],
        deliveryAppointmentsDate:   c.deliveryAppointmentsDate   || '',
        bolSource:                c.bolSource                || '',
        bolSourceDetail:          c.bolSourceDetail          || '',
        // v3.1.71 — migration silencieuse : default KPI primaire = ordered
        kpiPrimaireCA:  c.kpiPrimaireCA  || 'ordered',
        // v3.6.1 — nouveau champ cas d'enquête
        buyboxCases: c.buyboxCases || [],
        // v3.6.1 — suppression silencieuse de l'ancien système (Fred confirme : pas de cas actifs)
        // L'écrasement DOIT venir après ...c pour ne pas être réintroduit par le spread
        bbCases:     undefined,
        bbKnowledge: undefined,
      }));
      activeId = clients[0].id;
      screen = 'dashboard';
      log(`✓ IndexedDB: ${clients.length} client(s), ${clients.reduce((s,c)=>s+(c.asins?.length||0),0)} ASINs`, 'ok');
      migrateXMLTitles(clients);
      migrateSnapshotRevenue(clients);
      await save();
    } else {
      // Migration depuis localStorage v3.1 ou v3.0
      const lsNew = localStorage.getItem('ap-v31');
      const lsOld = localStorage.getItem('ap-clients-v30');
      const raw = lsNew || lsOld;
      if (raw) {
        try {
          let d = JSON.parse(raw);
          d = d.map(c => ({ ...freshClient(), ...c,
            history: c.history || { weekly:[], monthly:[], yearly:[] },
            weeklyActions: c.weeklyActions || [],
            monthlyActions: c.monthlyActions || [],
            awayUntil: c.awayUntil || null
          }));
          clients = d;
          activeId = d[0]?.id || null;
          screen = d.length ? 'dashboard' : 'welcome';
          await save(); // migrer vers IndexedDB
          localStorage.removeItem('ap-v31');
          localStorage.removeItem('ap-clients-v30');
          log(`✓ Migration localStorage → IndexedDB: ${d.length} client(s)`, 'ok');
        } catch(e) { log('Migration error: ' + e.message, 'err'); }
      }
    }
    apiKey = localStorage.getItem('ap-api-key') || '';
    const theme = localStorage.getItem('ap-theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
  } catch(e) {
    log('Load error: ' + e.message + ' — Tentative localStorage', 'err');
    // Fallback total localStorage
    try {
      const raw = localStorage.getItem('ap-v31') || localStorage.getItem('ap-v31-fallback');
      if (raw) { clients = JSON.parse(raw); activeId = clients[0]?.id; screen = 'dashboard'; }
    } catch(e2) {}
    apiKey = localStorage.getItem('ap-api-key') || '';
  }
}
