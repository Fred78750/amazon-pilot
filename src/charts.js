// Amazon Pilot — src/charts.js
// Injecte via // @charts dans core.js (build.py)
// v3.7.5 — deplacement strict depuis core.js (aucune modification fonctionnelle)

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