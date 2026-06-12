// Amazon Pilot — src/render_shell.js
// Injecte via // @render_shell dans core.js (build.py)
// v3.7.5 — deplacement strict depuis core.js (aucune modification fonctionnelle)

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
  // Badge backup sur Config si pas de backup depuis >7 jours
  const lastExportISO = localStorage.getItem('ap-last-export');
  const backupDays = lastExportISO ? Math.floor((Date.now() - new Date(lastExportISO)) / 86400000) : 999;
  const needsBackup = backupDays > 7;
  const _navClient = cl();
  document.title = 'Amazon Pilot v' + APP_VERSION + ' — ' + (cl() && cl().name ? cl().name : 'Vendor Central');
  document.getElementById('nav-list').innerHTML = NAV.map(n => {
    const badge = n.badge && alertCount > 0 ? `<span class="badge">${alertCount}</span>` : '';
    const backupBadge = n.id === 'config' && needsBackup ? `<span class="badge" style="background:var(--or)" title="Backup requis">!</span>` : '';
    const fnBadgeCount = n.badgeFn ? (n.id === 'buybox' ? _bbAlerts.critical.length : n.badgeFn(_navClient)) : 0;
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

function go(s) {
  _yoyReturnCtx = null;  // toute navigation via go() = manuelle → efface le contexte retour YoY
  screen = s;
  aiResult = '';
  if (s !== 'asins') { selectedAsin = null; asinView = 'all'; asinViewAsins = null; }
  render();
}

function goAgentVC(asin) { agentVCParam = asin; go('agentvc'); }

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