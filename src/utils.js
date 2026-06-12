// Amazon Pilot — src/utils.js
// Fonctions utilitaires extraites de core.js (v3.7.1)
// Injecté via // @utils dans core.js (build.py)

// ── Formateurs globaux ─────────────────────────────────────────
const fmt = n => (n || 0).toLocaleString('fr-FR');
const fmtEur = n => fmt(Math.round(n || 0)) + ' €';

// ── Normalisation texte ────────────────────────────────────────
function norm(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[''\u0027\u0060\u00B4]/g, "'")
    .replace(/[\u2013—\u2212]/g, '-')
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .trim();
}

function findCol(row, ...keywords) {
  const keys = Object.keys(row);
  for (const kw of keywords) {
    const kwN = norm(kw);
    for (const key of keys) {
      if (norm(key).includes(kwN)) return row[key];
    }
  }
  return null;
}

function parseNum(val) {
  if (val == null || val === '') return 0;
  let s = String(val).replace(/[€$£%]/g, '').replace(/[\s\u00a0\u202f\u2009]+/g, '');
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseMetadata(line) {
  const meta = {};
  const matches = line.matchAll(/([^,=\[\]]+)=\[([^\]]*)\]/g);
  for (const m of matches) meta[norm(m[1])] = m[2].trim();
  return meta;
}

// ── Helpers HTML ───────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function shortName(a) {
  if (!a.title) return a.asin;
  let t = a.title;
  if (a.brand && t.toUpperCase().startsWith(a.brand.toUpperCase())) t = t.slice(a.brand.length).replace(/^[\s\-–—:]+/, '');
  const dash = t.indexOf(' - ');
  if (dash > 10 && dash < 50) t = t.slice(0, dash);
  return t.slice(0, 45) + (t.length > 45 ? '…' : '');
}

function consolidateAsins(asins, client) {
  // Consolide les entrées multi-marchés en une seule ligne par ASIN physique
  // Utilisé uniquement pour l'affichage quand filtre marché = "Tous"
  // NE MODIFIE PAS client.asins — retourne une vue temporaire
  var byAsin = {};
  for (var i = 0; i < asins.length; i++) {
    var a = asins[i];
    if (!a.asin) continue;
    if (!byAsin[a.asin]) {
      byAsin[a.asin] = {
        asin: a.asin,
        title: a.title || '',
        titleOriginal: a.titleOriginal || '',
        brand: a.brand || '',
        ean: a.ean || '',
        model: a.model || '',
        revenue: 0,
        orderedRevenue: 0,
        shippedRevenue: 0,
        units: 0,
        orderedUnits: 0,
        shippedUnits: 0,
        glanceViews: 0,
        sellableUnits: 0,
        returns: 0,
        markets: [],
        marketDetails: {},
        market: '.all',
        history: [],
        historyMonthly: [],
        revenueDelta: null,
        retailPct: null,
        segment: null,
        _consolidated: true
      };
    }
    var co = byAsin[a.asin];
    var mkt = a.market || '.fr';

    // Accumuler les numériques
    co.revenue += (a.revenue || 0);
    co.orderedRevenue += (a.orderedRevenue || 0);
    co.shippedRevenue += (a.shippedRevenue || 0);
    co.units += (a.units || 0);
    co.orderedUnits += (a.orderedUnits || 0);
    co.shippedUnits += (a.shippedUnits || 0);
    co.glanceViews += (a.glanceViews || 0);
    co.sellableUnits += (a.sellableUnits || 0);
    co.returns += (a.returns || 0);

    // Tracker les marchés
    if (co.markets.indexOf(mkt) === -1) co.markets.push(mkt);

    // Détail par marché
    co.marketDetails[mkt] = {
      revenue: a.revenue || 0,
      orderedRevenue: a.orderedRevenue || 0,
      shippedRevenue: a.shippedRevenue || 0,
      units: a.units || 0,
      glanceViews: a.glanceViews || 0,
      sellableUnits: a.sellableUnits || 0,
      returns: a.returns || 0,
      revenueDelta: a.revenueDelta || null,
      retailPct: a.retailPct || null
    };

    // Préférer le titre FR
    if (mkt === '.fr' && a.title) co.title = a.title;

    // Agréger les deltas (moyenne pondérée)
    if (a.revenueDelta != null && a.revenue > 0) {
      if (co.revenueDelta == null) co.revenueDelta = 0;
      co.revenueDelta += a.revenueDelta * (a.revenue / (co.revenue || 1));
    }
  }

  var result = [];
  for (var asin in byAsin) {
    if (byAsin.hasOwnProperty(asin)) result.push(byAsin[asin]);
  }
  return result;
}

function getMainKeyword(a) {
  if (!a.title) return a.brand || '';
  let t = a.title.split(' - ')[0].split(',')[0];
  if (a.brand && t.toUpperCase().startsWith(a.brand.toUpperCase())) t = t.slice(a.brand.length).trim();
  return t.split(' ').slice(0, 5).join(' ');
}

function deltaBadge(val) {
  if (!val) return `<span style="color:var(--tx3)">—</span>`;
  const n = parseNum(val);
  if (n > 5) return `<span class="kpi-d up">▲ ${esc(String(val).trim())}</span>`;
  if (n < -5) return `<span class="kpi-d down">▼ ${esc(String(val).trim())}</span>`;
  return `<span class="kpi-d" style="color:var(--tx3)">${esc(String(val).trim())}</span>`;
}

function segBadge(s) { return `<span class="seg-${s.toLowerCase()}">${s}</span>`; }

function pillH(val, type) { return `<span class="pill pill-${type}">${esc(String(val))}</span>`; }

function getCurrentWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return `S${week} — ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
}

function getChartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    text: isDark ? '#56567A' : '#AAAAC0',
  };
}

// ── Scores santé ASIN ──────────────────────────────────────────────────
function calcHealth(a) {
  let s = 50;
  const rd = parseNum(a.revenueDelta);
  if (rd > 20) s += 30; else if (rd > 0) s += 15 + rd * 0.75; else if (rd > -20) s += rd * 1.5; else s -= 30;
  if (a.sellableUnits > 100) s += 25; else if (a.sellableUnits > 50) s += 15; else if (a.sellableUnits > 20) s += 5; else if (a.sellableUnits > 0) s -= 10; else if (a.sellableUnits === 0 && a.revenue > 0) s -= 25;
  const gd = parseNum(a.gvDelta);
  if (gd > 20) s += 20; else if (gd > 0) s += 10 + gd * 0.5; else if (gd > -20) s += gd; else s -= 20;
  const rp = parseNum(a.retailPct);
  if (rp > 90) s += 15; else if (rp > 70) s += 10; else if (rp > 50) s += 5; else if (rp > 0) s -= 5;
  if (a.returns > 10) s -= 10; else if (a.returns > 5) s -= 5;
  return Math.max(0, Math.min(100, Math.round(s)));
}

function calcHealthDeep(a, c) {
  // Health score enrichi tenant compte de la tendance longue
  let score = calcHealth(a); // base : health court terme
  const deep = calcTrendDeep(a, c);
  if (!deep.hasLongData) return score; // pas de données longues = pas de bonus/malus

  // Bonus/malus selon signal composite
  if (deep.signalCls === 'trend-up')        score = Math.min(100, score + 12);
  else if (deep.signalCls === 'trend-up-soft')   score = Math.min(100, score + 5);
  else if (deep.signalCls === 'trend-down')      score = Math.max(0,   score - 15);
  else if (deep.signalCls === 'trend-down-soft') score = Math.max(0,   score - 8);
  // "Creux ponctuel sur fond haussier" : ne pas pénaliser
  if (deep.signal.includes('fond haussier')) score = Math.max(score, 45);

  return Math.round(score);
}

function healthClass(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
}

function calcSegment(a, totalCA, c) {
  const rev = getRevenue(a, c);
  if (!totalCA || !(rev > 0)) return 'C';
  const pct = (rev / totalCA) * 100;
  if (pct > 2) return 'A';
  if (pct > 0.5) return 'B';
  return 'C';
}

function getRevenue(a, c) {
  const pref = c?.kpiPrimaireCA || 'ordered';
  if (pref === 'shipped') return a.shippedRevenue ?? a.revenue ?? 0;
  if (a.sourcingOnly) return 0; // Appro-only : pas de données Ordered
  return a.orderedRevenue ?? a.revenue ?? 0;
}

function getUnits(a, c) {
  const pref = c?.kpiPrimaireCA || 'ordered';
  if (pref === 'shipped') return a.shippedUnits ?? a.units ?? 0;
  if (a.sourcingOnly) return 0; // Appro-only : pas de données Ordered
  return a.orderedUnits ?? a.units ?? 0;
}

// ── Fraîcheur des données ─────────────────────────────────────────────────
function getDataFreshness(c) {
  if (!c?.imports?.length) {
    return {
      ventes: { missing: true, status: 'missing', daysSince: null },
      trafic: { missing: true, status: 'missing', daysSince: null },
      stock:  { missing: true, status: 'missing', daysSince: null }
    };
  }
  const now = new Date();
  const currentWeek = getISOWeek(now);
  const currentYear = now.getFullYear();

  // Logique Amazon : les données de la semaine S-1 sont disponibles depuis le lundi de S.
  // Mais le consultant doit les importer ce lundi — donc si on est lundi et que
  // le dernier import date d'avant aujourd'hui, il faut renouveler.
  // Règle : targetWeek = semaine courante SI on est lundi ET import < aujourd'hui
  //         targetWeek = semaine précédente sinon
  // La semaine cible est TOUJOURS la semaine précédente (S-1)
  // Le lundi S17, Amazon publie les données de S16 → targetWeek = S16
  // Le mercredi S17, les données de S16 sont toujours les dernières → targetWeek = S16
  const targetWeek = currentWeek - 1 > 0 ? currentWeek - 1 : 52;
  const targetYear = currentWeek - 1 > 0 ? currentYear : currentYear - 1;

  const result = {};
  ['ventes', 'trafic', 'stock'].forEach(type => {
    const last = c.imports
      .filter(i => i.type === type && (i.periodType === 'weekly' || !i.periodType))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!last) {
      result[type] = { missing: true, status: 'missing', daysSince: null, lastDate: null };
      return;
    }

    const lastDate = new Date(last.date);
    const daysSince = Math.floor((now - lastDate) / 86400000);

    // Utiliser periodEnd (fin de période couverte) plutôt que la date d'import
    // Ex: import fait le jeudi 16 avril (S16) mais qui couvre la semaine S15 (5-11 avril)
    // periodEnd = '11/04/2026' → semaine couverte = S15, pas S16
    const coverDate = last.periodEnd
      ? (() => {
          // periodEnd peut être 'dd/mm/yyyy' ou 'yyyy-mm-dd'
          const parts = last.periodEnd.includes('/') ? last.periodEnd.split('/') : null;
          return parts
            ? new Date(parts[2], parts[1]-1, parts[0])  // dd/mm/yyyy
            : new Date(last.periodEnd);                   // yyyy-mm-dd
        })()
      : lastDate;

    const lastWeek = getISOWeek(coverDate);
    const lastYear = coverDate.getFullYear();

    // Calculer le retard en semaines par rapport à la semaine cible
    // targetWeek = S16 si on est S17 (lundi)
    const weeksBehind = (targetYear - lastYear) * 52 + (targetWeek - lastWeek);

    // Statut basé sur les semaines de retard (logique métier Amazon)
    // weeksBehind <= 0 : données couvrent la semaine cible ou plus récent → à jour
    // weeksBehind == 1 : semaine cible non couverte → à renouveler
    // weeksBehind >= 2 : 2+ semaines de retard → manquant
    let status;
    if (weeksBehind <= 0) {
      status = 'ok';
    } else if (weeksBehind === 1) {
      status = 'stale';
    } else {
      status = 'missing';
    }

    result[type] = {
      missing: false,
      daysSince,
      weeksBehind,
      targetWeek,
      targetYear,
      lastWeek,
      lastYear,
      coverDate: coverDate.toLocaleDateString('fr-FR'),
      lastDate: lastDate.toLocaleDateString('fr-FR'),
      periodEnd: last.periodEnd || null,
      market: last.market || c.mainMarket || '.fr',
      status
    };
  });
  return result;
}

function getWeekDateRange(week, year) {
  // Trouver le lundi de cette semaine ISO
  const jan4 = new Date(year, 0, 4); // 4 jan est toujours en S1
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = d => d.getDate() + ' ' + d.toLocaleDateString('fr-FR', {month:'short'});
  return fmt(monday) + ' – ' + fmt(sunday);
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * daysSinceDate(isoDateOrStr)
 * v3.6.8.9 — Helper partagé SSOT pour le calcul "jours depuis un import".
 * Remplace les 3+ implémentations ad hoc de Math.floor((Date.now() - new Date(x)) / 86400000).
 * @param {string|Date|null} isoDateOrStr — date ISO string ou objet Date
 * @returns {number|null} — entier >= 0, ou null si date invalide/absente
 */
function daysSinceDate(isoDateOrStr) {
  if (!isoDateOrStr) return null;
  const d = new Date(isoDateOrStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function clientFreshnessColor(c) {
  if (!c.csvImported) return 'var(--a)'; // orange = pas de données
  if (isAway(c)) return '#3B82F6';       // bleu = en congés
  const f = getDataFreshness(c);
  const statuses = [f.ventes.status, f.trafic.status, f.stock.status];
  if (statuses.every(s => s === 'ok')) return 'var(--g)';      // vert
  if (statuses.some(s => s === 'missing')) return 'var(--r)';  // rouge
  return 'var(--a)';                                            // orange
}

function getVCLink(type, market) {
  const mktCode = {
    '.fr': 'vendorcentral.amazon.fr',
    '.de': 'vendorcentral.amazon.de',
    '.it': 'vendorcentral.amazon.it',
    '.es': 'vendorcentral.amazon.es',
    '.co.uk': 'vendorcentral.amazon.co.uk',
    '.nl': 'vendorcentral.amazon.nl',
    '.be': 'vendorcentral.amazon.com.be',
    '.se': 'vendorcentral.amazon.se',
    '.pl': 'vendorcentral.amazon.pl',
  };
  const domain = mktCode[market] || 'vendorcentral.amazon.fr';
  const paths = {
    ventes:       '/retail-analytics/dashboard/sales?compare-prior=true&compare-yoy=true&distributorView=manufacturing&submit=true&time-period=weekly',
    ventesAppro:  '/retail-analytics/dashboard/sales?compare-prior=true&compare-yoy=true&distributorView=sourcing&submit=true&time-period=weekly',
    trafic:       '/retail-analytics/dashboard/traffic',
    stock:        '/retail-analytics/dashboard/inventory?compare-prior=true&compare-yoy=true&distributorView=manufacturing&submit=true&time-period=weekly',
    stockAppro:   '/retail-analytics/dashboard/inventory?compare-prior=true&compare-yoy=true&distributorView=sourcing&submit=true&time-period=weekly',
    pos:          '/po/vendor/members/po-mgmt/managepos?tabId=confirmed',
  };
  return `https://${domain}${paths[type] || '/analytics/dashboard'}`;
}

// ── Tendance structurelle ────────────────────────────────────────────
// Tendance structurelle sur l'historique (régression linéaire)
// Retourne : { slope, label, cls, sparkPoints, periods }
function calcTrend(a) {
  // Reconstituer la série : historique + valeur actuelle
  const hist = (a.history || []).slice(-5); // max 5 périodes passées
  if (!hist.length) return null;

  const series = [...hist.map(h => h.revenue || 0), a.revenue || 0];
  const n = series.length;
  if (n < 2) return null;

  // Régression linéaire simple y = mx + b
  const sumX = n*(n-1)/2;
  const sumX2 = n*(n-1)*(2*n-1)/6;
  const sumY = series.reduce((s,v) => s+v, 0);
  const sumXY = series.reduce((s,v,i) => s+i*v, 0);
  const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);

  // Normaliser la pente par rapport à la moyenne
  const mean = sumY / n;
  const slopePct = mean > 0 ? (slope / mean) * 100 : 0;

  // Classification
  let label, cls, icon;
  if (slopePct > 8) {
    label = 'Croissance'; cls = 'trend-up'; icon = '↗';
  } else if (slopePct > 2) {
    label = 'Hausse'; cls = 'trend-up-soft'; icon = '↗';
  } else if (slopePct < -8) {
    label = 'Déclin'; cls = 'trend-down'; icon = '↘';
  } else if (slopePct < -2) {
    label = 'Baisse'; cls = 'trend-down-soft'; icon = '↘';
  } else {
    label = 'Stable'; cls = 'trend-stable'; icon = '→';
  }

  return { slope: slopePct, label, cls, icon, series, n };
}

// Mini sparkline SVG inline (40x20px)
function sparkline(series, cls) {
  if (!series || series.length < 2) return '';
  const w = 44, h = 18, pad = 2;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad*2);
    const y = h - pad - ((v - min) / range) * (h - pad*2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const color = cls === 'trend-up' ? '#16A34A'
    : cls === 'trend-up-soft' ? '#65A30D'
    : cls === 'trend-down' ? '#DC2626'
    : cls === 'trend-down-soft' ? '#EA580C'
    : '#9AA0AE';
  return `<svg width="${w}" height="${h}" style="display:block;flex-shrink:0" viewBox="0 0 ${w} ${h}">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${pts.split(' ').pop().split(',')[0]}" cy="${pts.split(' ').pop().split(',')[1]}" r="2.5" fill="${color}"/>
  </svg>`;
}

// Badge tendance compact
function trendBadge(trend) {
  if (!trend) return `<span style="color:var(--tx3);font-size:10px">—</span>`;
  const colors = {
    'trend-up':        { bg:'rgba(22,163,74,0.1)',  color:'#16A34A', border:'rgba(22,163,74,0.25)' },
    'trend-up-soft':   { bg:'rgba(101,163,13,0.1)', color:'#65A30D', border:'rgba(101,163,13,0.25)' },
    'trend-down':      { bg:'rgba(220,38,38,0.1)',  color:'#DC2626', border:'rgba(220,38,38,0.25)' },
    'trend-down-soft': { bg:'rgba(234,88,12,0.1)',  color:'#EA580C', border:'rgba(234,88,12,0.25)' },
    'trend-stable':    { bg:'rgba(154,160,174,0.1)',color:'#9AA0AE', border:'rgba(154,160,174,0.25)' },
  };
  const c = colors[trend.cls] || colors['trend-stable'];
  return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:600;background:${c.bg};color:${c.color};border:1px solid ${c.border};white-space:nowrap">${trend.icon} ${trend.label}</span>`;
}

// Tendance structurelle enrichie — croise 4 sources de données
function calcTrendDeep(a, c) {
  const curYear = new Date().getFullYear().toString();
  const prevYear = (parseInt(curYear) - 1).toString();
  const prev2Year = (parseInt(curYear) - 2).toString();

  // Récupérer les valeurs ASIN dans les données annuelles
  const ann2 = c.annualData?.[prev2Year]?.ventes?.asins?.[a.asin];
  const ann1 = c.annualData?.[prevYear]?.ventes?.asins?.[a.asin];
  const ytdA = c.ytdData?.ventes?.asins?.[a.asin];

  const ca2  = ann2 ? parseNum(ann2.revenue) : null;
  const ca1  = ann1 ? parseNum(ann1.revenue) : null;
  const caYTD = ytdA ? parseNum(ytdA.revenue) : null;
  const caNow = getRevenue(a,c)||0;

  // YoY Amazon-fourni (plus fiable si pas de données annuelles)
  const yoyAmazon = a.revenueYoY ? parseNum(a.revenueYoY) : null;

  // Construire la série longue (annuel → hebdo récent)
  const longSeries = [];
  if (ca2 !== null) longSeries.push({ label: prev2Year, value: ca2, type: 'annual' });
  if (ca1 !== null) longSeries.push({ label: prevYear, value: ca1, type: 'annual' });

  // Extrapoler le YTD en annuel si disponible
  if (caYTD !== null && c.ytdData?.ventes?.periodStart && c.ytdData?.ventes?.periodEnd) {
    const [ds,ms,ys] = (c.ytdData.ventes.periodStart).split('/').map(Number);
    const [de,me,ye] = (c.ytdData.ventes.periodEnd).split('/').map(Number);
    const daysYTD = Math.round((new Date(ye,me-1,de) - new Date(ys,ms-1,ds)) / 86400000);
    if (daysYTD > 0) {
      const extrapolated = Math.round(caYTD * 365 / daysYTD);
      longSeries.push({ label: curYear + ' (extrap.)', value: extrapolated, type: 'ytd_extrap', ytdActual: caYTD, daysYTD });
    }
  }

  // Tendance court terme (historique hebdo)
  const shortTrend = calcTrend(a);

  // Calculs de croissance longue
  let longGrowth = null, longGrowthLabel = '';
  if (ca1 !== null && ca2 !== null && ca2 > 0) {
    longGrowth = ((ca1 - ca2) / ca2 * 100).toFixed(1);
    longGrowthLabel = `${prev2Year}→${prevYear}: ${parseFloat(longGrowth) >= 0 ? '+' : ''}${longGrowth}%`;
  }
  let ytdVsN1 = null;
  if (yoyAmazon !== null) {
    ytdVsN1 = yoyAmazon;
  } else if (caYTD !== null && ca1 !== null && ca1 > 0 && c.ytdData?.ventes?.periodEnd) {
    const [ds,ms,ys] = (c.ytdData.ventes.periodStart||'01/01/'+curYear).split('/').map(Number);
    const [de,me,ye] = (c.ytdData.ventes.periodEnd).split('/').map(Number);
    const daysYTD = Math.round((new Date(ye,me-1,de) - new Date(ys,ms-1,ds)) / 86400000);
    const prorata = ca1 * (daysYTD / 365);
    if (prorata > 0) ytdVsN1 = parseFloat(((caYTD - prorata) / prorata * 100).toFixed(1));
  }

  // Signal composite : court terme vs long terme
  let signal = 'Données insuffisantes';
  let signalCls = 'trend-stable';
  const shortSlope = shortTrend?.slope || null;

  if (longSeries.length >= 2 && shortSlope !== null) {
    const longUp = (ca1 !== null && ca2 !== null && ca1 > ca2) || ytdVsN1 > 10;
    const longDown = (ca1 !== null && ca2 !== null && ca1 < ca2) || ytdVsN1 < -10;
    const shortUp = shortSlope > 2;
    const shortDown = shortSlope < -2;

    if (longUp && shortUp)   { signal = 'Croissance confirmée';      signalCls = 'trend-up'; }
    else if (longUp && shortDown) { signal = 'Creux ponctuel — fond haussier'; signalCls = 'trend-up-soft'; }
    else if (longDown && shortDown) { signal = 'Déclin structurel';          signalCls = 'trend-down'; }
    else if (longDown && shortUp)  { signal = 'Rebond sur fond baissier';    signalCls = 'trend-down-soft'; }
    else if (longUp)   { signal = 'Tendance haussière — court terme stable'; signalCls = 'trend-up-soft'; }
    else if (longDown) { signal = 'Tendance baissière — surveiller';          signalCls = 'trend-down-soft'; }
    else { signal = 'Stable'; signalCls = 'trend-stable'; }
  } else if (shortTrend) {
    signal = shortTrend.label + ' (court terme uniquement)';
    signalCls = shortTrend.cls;
  }

  return {
    longSeries, ca2, ca1, caYTD, caNow,
    longGrowth, longGrowthLabel,
    ytdVsN1, yoyAmazon,
    shortTrend, signal, signalCls,
    hasLongData: longSeries.length >= 2,
    prevYear, prev2Year, curYear
  };
}

// ── Fraîcheur enrichie ───────────────────────────────────────────────
// ── Calcul fraîcheur globale d'un rapport enrichi ───────────────
function getEnrichedFreshness(c) {
  const nowMs  = Date.now();
  const nowDate= new Date();
  const f = c.csvImported ? getDataFreshness(c) : null;

  // ── Helpers semaine / mois ISO ─────────────────────────────────
  const currentWeek = getISOWeek(nowDate);
  const currentYear = nowDate.getFullYear();
  const currentMonth= nowDate.getMonth(); // 0-based
  const targetWeekHebdo = currentWeek - 1 > 0 ? currentWeek - 1 : 52;
  const targetYearHebdo = currentWeek - 1 > 0 ? currentYear : currentYear - 1;

  function weeksBehindFromDate(importedAt) {
    if (!importedAt) return null;
    const d = new Date(importedAt);
    const w = getISOWeek(d);
    const y = d.getFullYear();
    return (targetYearHebdo - y) * 52 + (targetWeekHebdo - w);
  }

  function weekStatus(weeksBehind) {
    if (weeksBehind === null) return 'missing';
    if (weeksBehind <= 0) return 'ok';
    if (weeksBehind === 1) return 'stale';
    return 'missing';
  }

  // ── POs : logique LIBRE (pas hebdomadaire — import ad-hoc selon arrivée des BdC) ──
  // Règle : ok < 90j, stale < 180j, missing sinon. Pas de weeksBehind pour les POs.
  function posStatus(days) {
    if (days === null) return 'missing';
    if (days <= 90)  return 'ok';    // 3 mois : fraîcheur normale pour BdC
    if (days <= 180) return 'stale'; // 6 mois : à renouveler
    return 'missing';
  }
  const lastPO  = (c.pos||[]).slice().sort((a,b)=>(b.importedAt||'').localeCompare(a.importedAt||''))[0];
  const posDays = daysSinceDate(lastPO?.importedAt);

  // ── Prévisions : bimensuel — OK si importé dans les 2 dernières semaines ISO ──
  const fcDates  = Object.values(c.forecastData||{}).map(p=>p.importedAt).filter(Boolean).sort().reverse();
  const fcDays   = daysSinceDate(fcDates[0]);
  const fcWB     = fcDates.length ? weeksBehindFromDate(fcDates[0]) : null;
  // Tolérance bimensuelle intentionnelle : Amazon édite les prévisions tous les 15 jours,
  // pas chaque semaine. Ne pas aligner sur la règle hebdo des autres données.
  // Décision Fred validée le 29 mai 2026 (post v3.6.8.8).
  function fcStatus(wb) {
    if (wb === null) return 'missing';
    if (wb <= 0) return 'ok';
    if (wb <= 2) return 'ok';   // 2 semaines OK — cadence réelle Amazon Forecast
    if (wb <= 4) return 'stale';
    return 'missing';
  }

  // ── PPM nette : mensuel — OK si importé le mois en cours ou le mois précédent ──
  const ppmDates = Object.values(c.ppmData||{}).map(p=>p.importedAt).filter(Boolean).sort().reverse();
  const ppmDays  = daysSinceDate(ppmDates[0]);
  function ppmStatus(days) {
    if (days === null) return 'missing';
    // Mois courant ou mois précédent (tolérance jusqu'au 28e jour)
    if (days <= 28) return 'ok';
    if (days <= 45) return 'stale';
    return 'missing';
  }

  // ── Historique annuel — OK si annualData contient l'année N-1 ──
  const lastYear = currentYear - 1;
  const hasAnnualN1 = !!(c.annualData && c.annualData[String(lastYear)]);
  const hasAnnualN2 = !!(c.annualData && c.annualData[String(lastYear - 1)]);

  // ── YTD — même logique que hebdo (doit être de la semaine précédente) ──
  const ytdImport = (c.imports||[])
    .filter(i => i.periodType === 'ytd' && i.type === 'ventes')
    .sort((a,b) => new Date(b.date) - new Date(a.date))[0];
  const ytdWB   = ytdImport ? weeksBehindFromDate(ytdImport.date) : null;
  const ytdDays = daysSinceDate(ytdImport?.date);

  // Fraîcheur ventes/stock Approvisionnement (imports avec distributorView='appro')
  const lastVentesAppro = (c.imports||[]).filter(i=>i.type==='ventes'&&i.distributorView==='appro'&&i.periodType==='weekly').sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  const lastStockAppro  = (c.imports||[]).filter(i=>i.type==='stock' &&i.distributorView==='appro'&&i.periodType==='weekly').sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  const vaWB = lastVentesAppro ? weeksBehindFromDate(lastVentesAppro.date) : null;
  const saWB = lastStockAppro  ? weeksBehindFromDate(lastStockAppro.date)  : null;
  // Si le client n'a pas de marques fabricant définies, ventesAppro/stockAppro sont optionnels
  const hasFabBrands = (c.brands||[]).some(b=>b.role==='fabricant');

  return {
    // ── Données hebdo (ventes/trafic/stock) — lastWeek propagé depuis getDataFreshness ──
    ventes:      { days: f?.ventes.daysSince ?? null,   status: f?.ventes.status   ?? 'missing', freq: 7,
                   weeksBehind: f?.ventes.weeksBehind ?? null, targetWeek: targetWeekHebdo,
                   lastWeek: f?.ventes.lastWeek ?? null },
    ventesAppro: { days: daysSinceDate(lastVentesAppro?.date),
                   status: hasFabBrands ? weekStatus(vaWB) : 'ok', weeksBehind: vaWB, freq: 7,
                   targetWeek: targetWeekHebdo, optional: !hasFabBrands },
    trafic:      { days: f?.trafic.daysSince ?? null,   status: f?.trafic.status   ?? 'missing', freq: 7,
                   weeksBehind: f?.trafic.weeksBehind ?? null, targetWeek: targetWeekHebdo,
                   lastWeek: f?.trafic.lastWeek ?? null },
    stock:       { days: f?.stock.daysSince  ?? null,   status: f?.stock.status    ?? 'missing', freq: 7,
                   weeksBehind: f?.stock.weeksBehind ?? null,  targetWeek: targetWeekHebdo,
                   lastWeek: f?.stock.lastWeek ?? null },
    stockAppro:  { days: daysSinceDate(lastStockAppro?.date),
                   status: hasFabBrands ? weekStatus(saWB) : 'ok', weeksBehind: saWB, freq: 7,
                   targetWeek: targetWeekHebdo, optional: !hasFabBrands },
    // ── POs : fréquence libre, sans sémantique semaine ──
    pos:         { days: posDays, weeksBehind: null, status: posStatus(posDays), freq: 0 },
    // ── Prévisions : bimensuel, avec lastWeek calculé ──
    previsions:  { days: fcDays, weeksBehind: fcWB, status: fcStatus(fcWB), freq: 14,
                   targetWeek: targetWeekHebdo,
                   lastWeek: fcDates.length ? getISOWeek(new Date(fcDates[0])) : null,
                   lastDate: fcDates[0] || null },
    // ── PPM : mensuel, avec lastDate pour affichage ──
    ppm:         { days: ppmDays, status: ppmStatus(ppmDays), freq: 30,
                   lastDate: ppmDates[0] || null },
    annuel:      { hasN1: hasAnnualN1, hasN2: hasAnnualN2,
                   status: hasAnnualN1 ? 'ok' : 'missing',
                   detail: hasAnnualN1 ? (hasAnnualN2 ? 'N-1 + N-2 présents' : 'N-1 présent, N-2 manquant') : 'Historique annuel absent' },
    // ── YTD : intégré ici pour éviter le doublon dans renderFreshnessBanner ──
    ytd:         { days: ytdDays, weeksBehind: ytdWB, status: weekStatus(ytdWB) },
  };
}

// ── État congés ──────────────────────────────────────────────────────────────
function isAway(client) {
  if (!client?.awayUntil) return false;
  return new Date(client.awayUntil) > new Date();
}
