// Amazon Pilot — src/parser_traffic.js
// Parser Retail Analytics Traffic — timeline Featured Offer Page Views
// Injecté via // @parser_traffic dans core.js (build.py)
// v3.7.7 — nouveau module

// ── Résolution code marché → clé normalisée ──────────────────────────────────
// P1 : variante A (Pays=[FR]) et variante B (Code de la boutique=FR) → clé identique
// Code inconnu (IE, TR, SA, AE, EG...) → stocké tel quel, jamais droppé
function resolveTrafficMarket(code) {
  if (!code) return 'unknown';
  var c = code.trim().toUpperCase();
  return MARKET_CODES[c] || c;
}

// ── Splitter CSV robuste (gère guillemets) ────────────────────────────────────
function splitTrafficCSVLine(line) {
  var result = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

// ── Parser principal ──────────────────────────────────────────────────────────
// Retourne { weekKey, variant, periodStart, periodEnd, marketRows, marketsSeen, unknownMarketCodes }
// ou { error: '...' } — P2 : weekKey invalide = erreur explicite, jamais silencieux
function parseTrafficFile(text, filename) {
  // Strip BOM
  if (text && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  var lines = text.split(/\r?\n/);
  if (lines.length < 3) {
    return { error: 'Traffic "' + (filename || '?') + '" : fichier trop court (< 3 lignes)' };
  }

  // ── Ligne 0 : métadonnées ───────────────────────────────────────────────────
  // P2 : si absente ou date malformée → erreur explicite, jamais weekKey faux silencieux
  var meta0 = lines[0];
  if (!meta0 || meta0.trim() === '') {
    return { error: 'Traffic "' + (filename || '?') + '" : ligne 0 (métadonnées) absente' };
  }

  // "Champ de vision.=[JJ/MM/AAAA - JJ/MM/AAAA]" — tiret simple ou demi-cadratin
  var champMatch = meta0.match(/Champ de vision[^=]*=\[?(\d{2}\/\d{2}\/\d{4})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})\]?/i);
  if (!champMatch) {
    return { error: 'Traffic "' + (filename || '?') + '" : "Champ de vision" introuvable ou date malformée en ligne 0 — weekKey requis' };
  }
  var dateStart = champMatch[1]; // JJ/MM/AAAA
  var dateEnd   = champMatch[2];

  // Conversion JJ/MM/AAAA → YYYY-MM-DD (weekKey)
  var parts = dateStart.split('/');
  if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) {
    return { error: 'Traffic "' + (filename || '?') + '" : date début "' + dateStart + '" malformée (attendu JJ/MM/AAAA)' };
  }
  var weekKey = parts[2] + '-' + parts[1] + '-' + parts[0]; // YYYY-MM-DD

  // Extraire pays depuis "Pays=[FR]" ou "Pays=[ES;FR;NL;DE;BE;IT]"
  var paysMatch = meta0.match(/Pays=\[([^\]]+)\]/i);
  var paysFromMeta = paysMatch ? paysMatch[1].split(';').map(function(p) { return p.trim(); }).filter(Boolean) : [];

  // ── Ligne 1 : header ────────────────────────────────────────────────────────
  var headerLine = lines[1];
  if (!headerLine || headerLine.trim() === '') {
    return { error: 'Traffic "' + (filename || '?') + '" : ligne 1 (header) absente' };
  }
  var header = splitTrafficCSVLine(headerLine).map(function(h) { return h.replace(/^"|"$/g, '').trim(); });

  // Détection variante A (sans Code de la boutique) / B (avec)
  var colBoutique = -1;
  for (var hi = 0; hi < header.length; hi++) {
    var hn = norm(header[hi]);
    if ((hn.includes('code') && hn.includes('boutique')) || hn.includes('store code')) {
      colBoutique = hi; break;
    }
  }
  var variant = colBoutique >= 0 ? 'B' : 'A';

  // Variante A : vérifier pays unique
  if (variant === 'A' && paysFromMeta.length !== 1) {
    return { error: 'Traffic "' + (filename || '?') + '" variante A : Pays=[' + paysFromMeta.join(';') + '] ambigu (1 seul pays attendu sans colonne Code de la boutique)' };
  }

  // Indices colonnes clés
  var colAsin = -1, colViews = -1, colDeltaPrev = -1, colDeltaYoy = -1;
  for (var hi2 = 0; hi2 < header.length; hi2++) {
    if (hi2 === colBoutique) continue;
    var hn2 = norm(header[hi2]);
    if (hn2 === 'asin') { colAsin = hi2; continue; }
    if (hn2.includes('offre vedette') || hn2.includes('featured offer page view')) {
      if (hn2.includes('periode anterieure') || hn2.includes('previous period')) {
        colDeltaPrev = hi2;
      } else if (hn2.includes('annee derniere') || hn2.includes('last year') || hn2.includes('year ago') || hn2.includes('lly')) {
        colDeltaYoy = hi2;
      } else {
        colViews = hi2;
      }
    }
  }

  if (colAsin < 0) {
    return { error: 'Traffic "' + (filename || '?') + '" : colonne ASIN introuvable dans le header' };
  }
  if (colViews < 0) {
    return { error: 'Traffic "' + (filename || '?') + '" : colonne "Vues de la page de l\'offre vedette" introuvable dans le header' };
  }

  // ── Parse lignes data ────────────────────────────────────────────────────────
  var marketRows = [];
  var unknownCodes = {};

  for (var i = 2; i < lines.length; i++) {
    var line = lines[i];
    if (!line || line.trim() === '') continue;
    var cols = splitTrafficCSVLine(line);
    if (cols.length < Math.max(colAsin, colViews) + 1) continue;

    var asin = (cols[colAsin] || '').replace(/^"|"$/g, '').trim();
    if (!asin || asin.length !== 10) continue;

    // Résolution marché (P1 : même clé pour même marché quelle que soit la variante)
    var rawCode = variant === 'B'
      ? (cols[colBoutique] || '').replace(/^"|"$/g, '').trim()
      : paysFromMeta[0];
    var market = resolveTrafficMarket(rawCode);

    // Signaler codes inconnus (pas droppés — P1)
    if (rawCode && !MARKET_CODES[rawCode.toUpperCase()]) {
      if (!unknownCodes[rawCode]) unknownCodes[rawCode] = 0;
      unknownCodes[rawCode]++;
    }

    // P3 : views=0 stocké comme 0 (pas null/absent — distingue 0-mesuré vs ASIN absent)
    var rawViews = (cols[colViews] || '').replace(/^"|"$/g, '').trim();
    var views = parseNum(rawViews);
    if (views === null || views === undefined || isNaN(views)) views = 0;
    views = Math.round(views);

    var deltaPrev = null, deltaYoy = null;
    if (colDeltaPrev >= 0 && cols[colDeltaPrev] !== undefined) {
      var rawDp = (cols[colDeltaPrev] || '').replace(/^"|"$/g, '').trim();
      var parsed = parseNum(rawDp);
      deltaPrev = (rawDp === '' || rawDp === '-') ? null : parsed;
    }
    if (colDeltaYoy >= 0 && cols[colDeltaYoy] !== undefined) {
      var rawDy = (cols[colDeltaYoy] || '').replace(/^"|"$/g, '').trim();
      var parsedY = parseNum(rawDy);
      deltaYoy = (rawDy === '' || rawDy === '-') ? null : parsedY;
    }

    marketRows.push({
      asin: asin,
      market: market,
      views: views,
      deltaPrevPct: deltaPrev,
      deltaYoyPct: deltaYoy
    });
  }

  // Signal codes inconnus
  var unknownList = Object.keys(unknownCodes);
  if (unknownList.length > 0) {
    log('⚠ Traffic "' + (filename || '?') + '" : codes marché inconnus stockés tels quels : ' + unknownList.map(function(c) { return c + ' (' + unknownCodes[c] + ' lignes)'; }).join(', ') + ' — à ajouter dans MARKET_CODES si nécessaire', 'warn');
  }

  return {
    weekKey: weekKey,
    variant: variant,
    periodStart: dateStart,
    periodEnd: dateEnd,
    marketRows: marketRows,
    marketsSeen: (function() {
      var seen = {}, arr = [];
      marketRows.forEach(function(r) { if (!seen[r.market]) { seen[r.market] = true; arr.push(r.market); } });
      return arr;
    })(),
    unknownMarketCodes: unknownList
  };
}

// ── Helper debug ──────────────────────────────────────────────────────────────
// Accès console : getFoViewsTimeline('B0CJ2STZGN')
window.getFoViewsTimeline = function(asin) {
  var c = (typeof cl === 'function') ? cl() : (window.clients && window.clients[0]);
  if (!c) return null;
  var a = (c.asins || []).find(function(x) { return x.asin === asin; });
  return a ? (a.foViews || null) : null;
};
