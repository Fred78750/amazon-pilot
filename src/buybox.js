// Amazon Pilot — Module Buy Box
// Extrait automatiquement — ne pas éditer directement

function calcBuyBoxAlerts(c) {
  if (!c?.asins?.length) return { critical: [], warning: [], suppressed: [] };
  const critical   = []; // Retail% < 80%
  const warning    = []; // Retail% < 100% ou en baisse vs S-1
  const suppressed = []; // Retail% = 0% sur ≥2 semaines consécutives

  for (const a of c.asins) {
    if (!(getRevenue(a,c) > 0) && !(a.retailPct)) continue;
    const rPct = parseNum(String(a.retailPct||'').replace(',','.').replace(/[^0-9.]/g,''));
    if (!rPct && rPct !== 0) continue;
    if (rPct > 100) continue; // valeur incohérente (bug CSV) — ignorer

    // Vérifier historique pour détecter baisse vs S-1 et 0% chronique
    const hist = a.history || [];
    const prevRetail = hist.length >= 2 ? parseNum(hist[hist.length - 2].retailPct) : null;
    const zeroWeeks = hist.filter(h => parseNum(h.retailPct) === 0).length + (rPct === 0 ? 1 : 0);

    const delta = prevRetail !== null ? rPct - prevRetail : null;
    const isDown = delta !== null && delta < 0;
    const isCritical = rPct < 80 && rPct > 0;
    const isSuppressed = rPct === 0 && zeroWeeks >= 2;

    // Cause probable (arbre de décision)
    const stockOk = a.sellableUnits == null || a.sellableUnits >= (getUnits(a,c)||0);
    // PO non confirmé = cause racine si openPOQty > 0 et confirmPct < 50%
    const openPOv = parseNum(a.openPOQty) || 0;
    const cpctv = parseNum(String(a.confirmPct || '0').replace(',', '.').replace(/[^0-9.]/g, ''));
    const isPOUnconfirmed = openPOv > 0 && cpctv < 50;

    const cause = isSuppressed     ? 'suppression'
                : isPOUnconfirmed  ? 'po_unconfirmed'
                : !stockOk         ? 'stock'
                : isCritical       ? 'prix_3p'
                : isDown           ? 'surveillance'
                :                    'ok';

    // Couverture stock via calcAppro (NaN-safe)
    const _apro = calcAppro(a, c, null, null);
    const _cov = _apro?.couvertureAmazon;
    const couvertureSem = (_cov != null && !isNaN(Number(_cov))) ? Number(_cov) : null;
    const joursAvantLimite = _apro?.joursAvantLimite ?? null;
    const stockUrgent = couvertureSem !== null && couvertureSem < 3;

    // CA mensuel estimé = moyenne mobile 4 semaines × 4 (respecte kpiPrimaireCA)
    const pref    = (c && c.kpiPrimaireCA) || 'ordered';
    const revs    = (a.history || []).slice(-4).map(h =>
      pref === 'shipped'
        ? (parseNum(h.shippedRevenue) || parseNum(h.revenue) || 0)
        : (parseNum(h.orderedRevenue) || parseNum(h.revenue) || 0)
    ).filter(v => v > 0);
    const avgWeek    = revs.length > 0 ? revs.reduce((s, v) => s + v, 0) / revs.length : (getRevenue(a, c) || 0);
    const caMonthEst = Math.round(avgWeek * 4);
    // Criticité = CA à risque mensuel × boost delta négatif
    const deltaForCrit = delta !== null ? delta : 0;
    const caEstAtRisk  = caMonthEst * (1 - rPct / 100);
    const deltaBoost   = 1 + Math.max(0, -deltaForCrit) / 10;
    const criticite    = caEstAtRisk * deltaBoost;
    const entry = { asin: a.asin, title: a.title, brand: a.brand, market: a.market, rPct, prevRetail, delta, cause, zeroWeeks, revenue: getRevenue(a,c), caMonthEst, criticite, segment: calcSegment(a, c.asins.reduce((s,x)=>s+(getRevenue(x,c)||0),0), c), sellableUnits: a.sellableUnits, couvertureSem, joursAvantLimite, stockUrgent };

    if (isSuppressed)                          suppressed.push(entry);
    else if (isCritical)                       critical.push(entry);
    else if (isDown || (rPct > 0 && rPct < 100)) warning.push(entry);
  }

  // Trier par impact CA décroissant
  const byCA = (a, b) => (getRevenue(b,c)||0) - (getRevenue(a,c)||0);
  critical.sort(byCA); warning.sort(byCA); suppressed.sort(byCA);
  return { critical, warning, suppressed };
}

// ═══════════════════════════════════════════════════════════════════
// BUY BOX v3.6.1 — Moteur de cas
// ═══════════════════════════════════════════════════════════════════

function buyboxGenId() {
  return 'bc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function buyboxGetCases(c) {
  if (!c.buyboxCases) c.buyboxCases = [];
  return c.buyboxCases;
}

// Récupère le cas actif (status !== 'closed') pour un ASIN
function buyboxGetCase(c, asin) {
  return buyboxGetCases(c).find(function(x) { return x.asin === asin && x.status !== 'closed'; }) || null;
}

// Ouvre un nouveau cas pour un ASIN. Si déjà ouvert → retourne l'existant.
function buyboxOpenCase(c, asin) {
  var existing = buyboxGetCase(c, asin);
  if (existing) return existing;

  var nowISO = new Date().toISOString();
  var newCase = {
    id: buyboxGenId(),
    asin: asin,
    status: 'open',
    openedAt: nowISO,
    closedAt: null,
    facts: { snapshot: null, computedAt: null },
    hypotheses: BUYBOX_HYPOTHESES.map(function(h) {
      return { id: h.id, status: 'todo', evidence: '', updatedAt: null };
    }),
    journal: [
      { ts: nowISO, type: 'system', content: 'Dossier ouvert automatiquement', author: 'system' }
    ],
    conclusion: { state: 'locked', proposedAction: '', outcome: null, closedAt: null }
  };
  buyboxGetCases(c).push(newCase);
  save();
  return newCase;
}

function buyboxUpdateHypothesis(c, caseId, hypoId, fields) {
  var cs = buyboxGetCases(c).find(function(x) { return x.id === caseId; });
  if (!cs) return;
  var h = cs.hypotheses.find(function(x) { return x.id === hypoId; });
  if (!h) return;
  for (var k in fields) {
    if (Object.prototype.hasOwnProperty.call(fields, k)) h[k] = fields[k];
  }
  h.updatedAt = new Date().toISOString();
  // Auto-journal si validation/rejet
  if (fields.status === 'validated' || fields.status === 'rejected') {
    var hypoLabel = (BUYBOX_HYPOTHESES.find(function(x) { return x.id === hypoId; }) || {}).label || hypoId;
    cs.journal.push({
      ts: new Date().toISOString(),
      type: 'auto',
      content: 'Hypothèse "' + hypoLabel + '" ' + (fields.status === 'validated' ? 'validée' : 'écartée'),
      author: 'system'
    });
  }
  save();
}

function buyboxAddJournalEntry(c, caseId, content, type) {
  var cs = buyboxGetCases(c).find(function(x) { return x.id === caseId; });
  if (!cs) return;
  cs.journal.push({
    ts: new Date().toISOString(),
    type: type || 'manual',
    content: content,
    author: 'user'
  });
  save();
}

// Vérifie les 3 conditions de déverrouillage de la Conclusion
function buyboxCheckConclusionReady(c, caseId) {
  var cs = buyboxGetCases(c).find(function(x) { return x.id === caseId; });
  if (!cs) return { ready: false, conditions: [] };

  var conditions = [];
  var allMet = true;
  for (var i = 0; i < BUYBOX_CONCLUSION_CONDITIONS.length; i++) {
    var cd = BUYBOX_CONCLUSION_CONDITIONS[i];
    var met = cd.check(cs, c);
    if (!met) allMet = false;
    conditions.push({ id: cd.id, label: cd.label, met: met });
  }
  return { ready: allMet, conditions: conditions };
}

function buyboxCloseCase(c, caseId, outcome, proposedAction) {
  var cs = buyboxGetCases(c).find(function(x) { return x.id === caseId; });
  if (!cs) return;
  var nowISO = new Date().toISOString();
  cs.status = 'closed';
  cs.closedAt = nowISO;
  cs.conclusion.state = 'closed';
  cs.conclusion.outcome = outcome;
  cs.conclusion.proposedAction = proposedAction || '';
  cs.conclusion.closedAt = nowISO;
  cs.journal.push({
    ts: nowISO,
    type: 'system',
    content: 'Dossier clôturé — ' + (outcome === 'success' ? 'succès' : outcome === 'failure' ? 'échec' : 'inconclusif'),
    author: 'system'
  });
  save();
}

// ═══════════════════════════════════════════════════════════════════
// BUY BOX v3.6.1 — Calcul auto bloc Faits (Phase 2)
// ═══════════════════════════════════════════════════════════════════

function computeBuyboxFacts(c, asin) {
  var a = (c.asins || []).find(function(x) { return x.asin === asin; });
  if (!a) return null;

  var alerts = calcBuyBoxAlerts(c);
  var allEntries = alerts.suppressed.concat(alerts.critical, alerts.warning);
  var e = allEntries.find(function(x) { return x.asin === asin; });

  // Retail% actuel + comparaison S-9
  var rPctNow = e ? e.rPct : (parseNum(String(a.retailPct || '').replace(',', '.').replace(/[^0-9.]/g, '')) || 0);
  var hist = a.history || [];
  var rPct9w = hist.length >= 9 ? parseNum(String((hist[hist.length - 9].retailPct || '').toString()).replace(',', '.').replace(/[^0-9.]/g, '')) : null;

  // Stock Amazon + couverture
  var stockAmz = a.sellableUnits || 0;
  var couv = (e && e.couvertureSem !== null && e.couvertureSem !== undefined) ? e.couvertureSem : null;

  // PO ouvert
  var openPO = parseNum(a.openPOQty) || 0;
  var lastPOEvent = openPO > 0 ? 'PO ouvert (' + openPO + ' u.)' : 'aucun PO ouvert';

  // Défauts livraison (globaux en v3.6.1 — croisement ASIN en v3.6.2)
  var defectsRecent = (c.deliveryDefects || []).length;
  var defectsLabel  = defectsRecent > 0
    ? defectsRecent + ' défauts importés (toute la flotte)'
    : 'aucun défaut importé';

  // Prix actuel
  var priceNow = a.price || a.retailPrice || null;

  // Concurrent 3P : pas d'info en v3.6.1
  var competitor3P = 'non détecté (intégration v3.6.4)';

  // Dernière modif fiche
  var lastFicheUpdate = (a.ficheOptimisee && a.ficheOptimisee[c.mainMarket])
    ? 'fiche optimisée présente'
    : 'aucune optimisation enregistrée';

  // Code vie : v3.6.2
  var codeVie = '— (intégration v3.6.2)';

  // Saisonnalité : v3.6.4
  var seasonality = 'historique N-1 non analysé (v3.6.4)';

  return {
    retailPct:       { current: rPctNow, nineWeeksAgo: rPct9w },
    stockAmazon:     { units: stockAmz, couverture: couv },
    po:              { open: openPO, event: lastPOEvent },
    defects:         { count: defectsRecent, label: defectsLabel },
    price:           priceNow,
    competitor3P:    competitor3P,
    lastFicheUpdate: lastFicheUpdate,
    codeVie:         codeVie,
    seasonality:     seasonality,
    computedAt:      new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════════════
// BUY BOX v3.6.1 — renderBuyBox() Phase 1 : Identifier
// ═══════════════════════════════════════════════════════════════════

function renderBuyBox() {
  var c = cl();
  if (!c) return renderWelcome();
  if (!c.asins || !c.asins.length) return '<div class="alr alr-a">Importez d\'abord des données CSV.</div>';

  // Réinitialiser la vue si on arrive sur Phase 1
  if (!window._buyboxView || window._buyboxView === 'list') {
    window._buyboxView = 'list';
  } else if (window._buyboxView === 'case' && window._buyboxAsin) {
    return renderBuyBoxCase(c, window._buyboxAsin);
  }

  var alerts = calcBuyBoxAlerts(c);
  var lost        = alerts.critical;
  var compromised = alerts.warning;
  var fragile     = [];   // v3.6.1 : toujours vide (dérivation v3.6.2)
  var recovered   = [];   // v3.6.1 : toujours vide (cas fermés success — dérivation v3.6.2)

  // Filtrage marché
  var marketFilter = window._buyboxMarket || 'all';
  var byMarket = function(e) { return marketFilter === 'all' || e.market === marketFilter; };
  var lostF       = lost.filter(byMarket);
  var compromisedF= compromised.filter(byMarket);

  // Tab actif
  var activeTab = window._buyboxTab || 'lost';
  var sortBy = window._buyboxSort || 'criticite';
  var displayList = (activeTab === 'lost'        ? lostF
                   : activeTab === 'compromised' ? compromisedF
                   : activeTab === 'fragile'     ? fragile
                   : recovered).slice();
  displayList.sort(function(a, b) {
    if (sortBy === 'criticite') return (b.criticite || 0) - (a.criticite || 0);
    return (b.caMonthEst || 0) - (a.caMonthEst || 0);
  });

  // KPIs
  var asinsInTrouble = lostF.length + compromisedF.length;
  var totalActiveAsins = (c.asins || []).filter(function(a) { return getRevenue(a, c) > 0; }).length;
  var caAtRisk = lostF.reduce(function(s, e) { return s + (e.caMonthEst || 0); }, 0)
               + compromisedF.reduce(function(s, e) { return s + (e.caMonthEst || 0); }, 0);
  var openCasesCount = buyboxGetCases(c).filter(function(x) { return x.status !== 'closed'; }).length;
  var ninetyDaysAgo  = Date.now() - 90 * 24 * 3600 * 1000;
  var resolved90d    = buyboxGetCases(c).filter(function(x) {
    return x.status === 'closed' && x.closedAt && new Date(x.closedAt).getTime() >= ninetyDaysAgo && x.conclusion.outcome === 'success';
  }).length;

  // Formatage CA
  var fmtCA = function(v) {
    if (!v) return '—';
    if (v >= 1000) return Math.round(v / 1000) + ' k€';
    return Math.round(v) + ' €';
  };

  var h = '';

  // ── En-tête ──
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap;">';
  h += '<div>';
  h += '<div class="eyebrow" style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Phase 1 · Identifier</div>';
  h += '<div style="font-size:18px;font-weight:600;">Buy Box</div>';
  h += '</div>';
  h += '<div style="display:flex;gap:8px;align-items:center;">';
  h += '<select style="font-size:12px;padding:5px 8px;background:var(--s2);border:0.5px solid var(--bd2);border-radius:6px;color:var(--tx);cursor:pointer;" onchange="window._buyboxMarket=this.value;render()">';
  h += '<option value="all"' + (marketFilter === 'all' ? ' selected' : '') + '>Tous les marchés</option>';
  var mkts = Array.from(new Set((c.asins || []).map(function(a) { return a.market; }).filter(Boolean)));
  mkts.forEach(function(m) {
    h += '<option value="' + m + '"' + (marketFilter === m ? ' selected' : '') + '>amazon' + m + '</option>';
  });
  h += '</select>';
  h += '<button class="btn btn-sm" onclick="render()">Recalculer</button>';
  h += '</div>';
  h += '</div>';

  // ── Bandeau contexte sectoriel ──
  h += '<div class="context-banner" style="margin-bottom:14px;">';
  h += '<div class="context-title">' + BUYBOX_CONTEXT_BANNER.title + '</div>';
  h += BUYBOX_CONTEXT_BANNER.body + ' <cite style="color:var(--tx3);font-style:normal;">' + BUYBOX_CONTEXT_BANNER.cite + '</cite>';
  h += '</div>';

  // ── KPIs ──
  h += '<div class="kpis" style="margin-bottom:16px;">';
  h += '<div class="kpi"><div class="kpi-lb">ASINs en difficulté</div><div class="kpi-v' + (asinsInTrouble > 0 ? ' kpi-danger' : '') + '">' + asinsInTrouble + '</div><div class="kpi-d">sur ' + totalActiveAsins + ' actifs</div></div>';
  h += '<div class="kpi"><div class="kpi-lb">CA à risque / mois</div><div class="kpi-v' + (caAtRisk > 0 ? ' kpi-danger' : '') + '">' + fmtCA(caAtRisk) + '</div><div class="kpi-d">Perdue + Compromise</div></div>';
  h += '<div class="kpi"><div class="kpi-lb">Dossiers ouverts</div><div class="kpi-v">' + openCasesCount + '</div><div class="kpi-d">en cours d\'enquête</div></div>';
  h += '<div class="kpi"><div class="kpi-lb">Résolus (90 j)</div><div class="kpi-v good">' + resolved90d + '</div><div class="kpi-d">avec succès</div></div>';
  h += '</div>';

  // ── Filtres cycle de vie ──
  h += '<div class="lc-filters" style="margin-bottom:12px;">';
  h += '<span style="font-size:11px;color:var(--tx2);margin-right:4px;">Cycle de vie :</span>';
  var lcFilters = [
    { id: 'all',  label: 'Tous' },
    { id: 'best', label: 'Best' },
    { id: 'perm', label: 'Permanent' },
    { id: 'fin',  label: 'Fin de vie' }
  ];
  var curLc = window._buyboxLifecycle || 'all';
  lcFilters.forEach(function(f) {
    var active = curLc === f.id;
    h += '<button class="btn btn-sm' + (active ? ' btn-active' : '') + '" style="' + (active ? 'border-color:var(--b);color:var(--b);' : '') + '" onclick="window._buyboxLifecycle=\'' + f.id + '\';render()">' + f.label + '</button>';
  });
  h += '<span style="font-size:10px;color:var(--tx3);margin-left:6px;">(filtrage cycle de vie en v3.6.2)</span>';
  h += '</div>';

  // ── Tri ──
  h += '<div style="display:flex;gap:6px;align-items:center;font-size:12px;color:var(--tx2);margin-bottom:10px;">';
  h += '<span>Trier par :</span>';
  h += '<button class="btn btn-sm sort-btn' + (sortBy === 'criticite' ? ' sort-btn-active' : '') + '" onclick="window._buyboxSort=\'criticite\';render()">⚠ Criticité</button>';
  h += '<button class="btn btn-sm sort-btn' + (sortBy === 'ca' ? ' sort-btn-active' : '') + '" onclick="window._buyboxSort=\'ca\';render()">CA</button>';
  h += '</div>';

  // ── Tabs ──
  h += '<div class="tabs" style="margin-bottom:0;">';
  var tabs = [
    { id: 'lost',        label: 'Perdue',       count: lostF.length },
    { id: 'compromised', label: 'Compromise',   count: compromisedF.length },
    { id: 'fragile',     label: 'Fragile',      count: 0 },
    { id: 'recovered',   label: 'Récupérées',   count: 0 }
  ];
  tabs.forEach(function(t) {
    var isActive = activeTab === t.id;
    h += '<div class="tab' + (isActive ? ' active' : '') + '" style="padding:8px 14px;cursor:pointer;font-size:12px;border-bottom:2px solid ' + (isActive ? 'var(--r)' : 'transparent') + ';color:' + (isActive ? 'var(--r)' : 'var(--tx2)') + ';font-weight:' + (isActive ? '500' : '400') + ';display:flex;align-items:center;gap:6px;" onclick="window._buyboxTab=\'' + t.id + '\';render()">';
    h += t.label;
    h += '<span class="tab-badge">' + t.count + '</span>';
    h += '</div>';
  });
  h += '</div>';

  // ── Tableau ──
  h += '<div class="bb-table" style="border:0.5px solid var(--bd);border-radius:var(--rdl);overflow:hidden;margin-top:0;">';

  // En-tête tableau
  h += '<div class="bb-thead" style="display:grid;grid-template-columns:60px 1fr 70px 70px 1fr 80px 110px;padding:8px 14px;background:var(--s2);font-size:11px;color:var(--tx3);font-weight:500;border-bottom:0.5px solid var(--bd);">';
  h += '<div>Type</div><div>ASIN · Produit</div><div style="text-align:right;">Retail%</div><div style="text-align:right;">Δ S-1</div><div>Cause suspectée</div><div style="text-align:right;">CA / mois (est.)</div><div></div>';
  h += '</div>';

  if (displayList.length === 0) {
    h += '<div style="padding:24px;text-align:center;color:var(--tx3);font-size:12px;">Aucun ASIN dans cette catégorie.</div>';
  } else {
    var shown = displayList.slice(0, 50);
    shown.forEach(function(entry) {
      var asin = entry.asin;
      var title = (entry.title || asin).slice(0, 55);
      var rPct = entry.rPct !== null && entry.rPct !== undefined ? entry.rPct : null;
      var delta = entry.delta !== null && entry.delta !== undefined ? entry.delta : null;
      var rPctStr = rPct !== null ? rPct + ' %' : '—';
      var rPctDanger = rPct !== null && rPct < 80;
      var deltaStr = delta !== null
        ? (delta >= 0 ? '+' : '') + delta.toFixed(2).replace('.', ',') + ' pt'
        : '—';
      var deltaColor = delta !== null && delta < 0 ? 'var(--r)' : delta > 0 ? 'var(--g)' : 'var(--tx3)';
      var rev = entry.caMonthEst || entry.revenue || 0;
      var hasCase = buyboxGetCase(c, asin) !== null;

      h += '<div class="bb-trow" style="display:grid;grid-template-columns:60px 1fr 70px 70px 1fr 80px 110px;padding:12px 14px;border-bottom:0.5px solid var(--bd);align-items:center;font-size:12px;">';

      // Colonne badge (cycle de vie — v3.6.2)
      h += '<div><span style="font-size:10px;color:var(--tx3);">—</span></div>';

      // ASIN + produit
      h += '<div><div class="bb-product-name" style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + (entry.title || asin) + '">' + title + '</div>';
      h += '<div style="font-size:10px;color:var(--tx3);font-family:var(--fm);">' + asin + '</div></div>';

      // Retail%
      h += '<div style="text-align:right;font-weight:500;color:' + (rPctDanger ? 'var(--r)' : 'var(--tx)') + ';">' + rPctStr + '</div>';

      // Δ S-1
      h += '<div style="text-align:right;color:' + deltaColor + ';">' + deltaStr + '</div>';

      // Cause suspectée (v3.6.1 : statique)
      h += '<div><span style="color:var(--tx3);font-size:11px;">—</span></div>';

      // CA/mois
      h += '<div style="text-align:right;color:var(--tx2);">' + fmtCA(rev) + '</div>';

      // Action
      h += '<div style="text-align:right;">';
      h += '<button class="btn btn-sm" style="' + (hasCase ? 'border-color:var(--a);color:var(--a);' : '') + '" onclick="window._buyboxView=\'case\';window._buyboxAsin=\'' + asin + '\';buyboxOpenCase(cl(),\'' + asin + '\');render();">' + (hasCase ? '📂 Dossier' : 'Enquêter →') + '</button>';
      h += '</div>';

      h += '</div>';
    });

    if (displayList.length > 50) {
      h += '<div style="padding:10px 14px;font-size:11px;color:var(--tx3);text-align:center;">Affichage limité à 50 ASINs — ' + (displayList.length - 50) + ' supplémentaires non affichés.</div>';
    }
  }

  h += '</div>';

  return h;
}

// ═══════════════════════════════════════════════════════════════════
// BUY BOX v3.6.1 — renderBuyBoxCase() Phase 2 : Carnet d'enquête
// ═══════════════════════════════════════════════════════════════════

function renderBuyBoxCase(c, asin) {
  if (!c || !asin) { window._buyboxView = 'list'; return renderBuyBox(); }

  // Récupérer ou créer le cas
  var cs = buyboxGetCase(c, asin);
  if (!cs) {
    cs = buyboxOpenCase(c, asin);
    // Après save(), recharger depuis l'objet courant
    cs = buyboxGetCase(c, asin);
    if (!cs) { window._buyboxView = 'list'; return renderBuyBox(); }
  }

  var caseId = cs.id;
  var asinData = (c.asins || []).find(function(a) { return a.asin === asin; });
  var title = asinData ? (asinData.title || asin) : asin;

  // Bloc Faits
  var facts = computeBuyboxFacts(c, asin);

  // Statut Buy Box pour badge header
  var alerts = calcBuyBoxAlerts(c);
  var allAlerts = alerts.suppressed.concat(alerts.critical, alerts.warning);
  var alertEntry = allAlerts.find(function(e) { return e.asin === asin; });
  var bbStatus = alertEntry
    ? (alerts.suppressed.find(function(e) { return e.asin === asin; }) ? '⊘ Buy Box supprimée'
    : alerts.critical.find(function(e) { return e.asin === asin; })    ? '⊘ Buy Box perdue'
    : '⚠ Buy Box compromise')
    : '✓ Buy Box normale';
  var bbStatusColor = alertEntry
    ? (alerts.critical.find(function(e) { return e.asin === asin; }) || alerts.suppressed.find(function(e) { return e.asin === asin; }) ? 'var(--r)' : 'var(--a)')
    : 'var(--g)';

  // Date d'ouverture
  var openedDate = cs.openedAt ? new Date(cs.openedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '—';

  // Conditions conclusion
  var conclusionCheck = buyboxCheckConclusionReady(c, caseId);

  var h = '';

  // ── En-tête ──
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap;">';
  h += '<div style="display:flex;align-items:center;gap:10px;min-width:0;">';
  h += '<button class="btn btn-sm" onclick="window._buyboxView=\'list\';window._buyboxAsin=null;render();">← Retour liste</button>';
  h += '<div style="min-width:0;">';
  h += '<div class="eyebrow" style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.04em;">Phase 2 · Comprendre — Carnet d\'enquête</div>';
  h += '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">';
  h += '<span style="font-size:11px;color:var(--tx2);font-family:var(--fm);">' + asin + '</span>';
  h += '<span style="font-size:14px;font-weight:500;">' + title.slice(0, 60) + '</span>';
  h += '</div>';
  h += '</div>';
  h += '</div>';
  h += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">';
  h += '<span style="background:var(--r-bg);color:' + bbStatusColor + ';font-size:11px;padding:4px 10px;border-radius:4px;font-weight:500;">' + bbStatus + '</span>';
  h += '<span style="font-size:11px;padding:4px 10px;color:var(--tx2);background:var(--s2);border-radius:4px;">Dossier ouvert le ' + openedDate + '</span>';
  h += '</div>';
  h += '</div>';

  // ── Bandeau contexte sectoriel ──
  h += '<div class="context-banner" style="margin-bottom:14px;">';
  h += '<div class="context-title">' + BUYBOX_CONTEXT_BANNER.title + '</div>';
  h += BUYBOX_CONTEXT_BANNER.body + ' <cite style="color:var(--tx3);font-style:normal;">' + BUYBOX_CONTEXT_BANNER.cite + '</cite>';
  h += '</div>';

  // ── Grille 2 colonnes ──
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">';

  // ══ COLONNE GAUCHE ══
  h += '<div>';

  // ── Carte Faits ──
  h += '<div class="bb-card" style="background:var(--s1);border:0.5px solid var(--bd);border-radius:var(--rdl);padding:14px 16px;margin-bottom:14px;">';
  h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;padding-bottom:8px;border-bottom:0.5px solid var(--bd);">';
  h += '<span style="font-size:14px;">⚙</span>';
  h += '<span style="font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;">Faits</span>';
  h += '<span style="font-size:10px;color:var(--tx3);margin-left:auto;">Auto · calculé maintenant</span>';
  h += '</div>';
  if (facts) {
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;font-size:11px;">';
    var rPctNow = facts.retailPct.current;
    var rPct9w  = facts.retailPct.nineWeeksAgo;
    var rPctStr = rPctNow !== null && rPctNow !== undefined ? rPctNow + ' %' : '—';
    var rPct9Str = rPct9w !== null && rPct9w !== undefined ? '(était ' + rPct9w + '% S-9)' : '';
    h += '<div style="color:var(--tx2);">Retail% actuel</div>';
    h += '<div style="text-align:right;font-weight:500;color:' + (rPctNow < 80 ? 'var(--r)' : 'var(--tx)') + ';">' + rPctStr + ' <span style="color:var(--tx3);font-weight:400;font-size:10px;">' + rPct9Str + '</span></div>';
    h += '<div style="color:var(--tx2);">Stock Amazon</div>';
    var couvStr = facts.stockAmazon.couverture !== null ? ' · couv. ' + facts.stockAmazon.couverture + ' sem.' : '';
    h += '<div style="text-align:right;">' + facts.stockAmazon.units + ' u.' + couvStr + '</div>';
    h += '<div style="color:var(--tx2);">PO ouvert</div>';
    h += '<div style="text-align:right;">' + facts.po.event + '</div>';
    h += '<div style="color:var(--tx2);">Défauts livraison</div>';
    h += '<div style="text-align:right;color:' + (facts.defects.count > 0 ? 'var(--a)' : 'var(--tx)') + ';font-weight:' + (facts.defects.count > 0 ? '500' : '400') + ';">' + facts.defects.label + '</div>';
    h += '<div style="color:var(--tx2);">Prix actuel</div>';
    h += '<div style="text-align:right;">' + (facts.price ? facts.price + ' €' : '—') + '</div>';
    h += '<div style="color:var(--tx2);">Concurrent 3P</div>';
    h += '<div style="text-align:right;color:var(--tx3);">' + facts.competitor3P + '</div>';
    h += '<div style="color:var(--tx2);">Dernière modif fiche</div>';
    h += '<div style="text-align:right;color:var(--tx3);">' + facts.lastFicheUpdate + '</div>';
    h += '<div style="color:var(--tx2);">Cycle de vie ERP</div>';
    h += '<div style="text-align:right;color:var(--tx3);">' + facts.codeVie + '</div>';
    h += '<div style="color:var(--tx2);">Saisonnalité N-1</div>';
    h += '<div style="text-align:right;color:var(--tx3);">' + facts.seasonality + '</div>';
    h += '</div>';
    h += '<div style="display:flex;gap:6px;margin-top:10px;padding-top:8px;border-top:0.5px solid var(--bd);">';
    h += '<button class="btn btn-sm" onclick="openAmazonProduct(\'' + asin + '\',\'' + (c.mainMarket || '.fr') + '\')">↗ Voir dans Vendor Central</button>';
    h += '</div>';
  } else {
    h += '<div style="color:var(--tx3);font-size:11px;">ASIN introuvable dans les données importées.</div>';
  }
  h += '</div>';

  // ── Carte Hypothèses ──
  h += '<div class="bb-card" style="background:var(--s1);border:0.5px solid var(--bd);border-radius:var(--rdl);padding:14px 16px;margin-bottom:14px;">';
  h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;padding-bottom:8px;border-bottom:0.5px solid var(--bd);">';
  h += '<span style="font-size:14px;">⌕</span>';
  h += '<span style="font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;">Hypothèses</span>';
  var validatedCount  = (cs.hypotheses || []).filter(function(h2) { return h2.status === 'validated'; }).length;
  var investigateCount= (cs.hypotheses || []).filter(function(h2) { return h2.status === 'investigate'; }).length;
  var rejectedCount   = (cs.hypotheses || []).filter(function(h2) { return h2.status === 'rejected'; }).length;
  var testedCount = validatedCount + rejectedCount + investigateCount;
  h += '<span style="font-size:10px;color:var(--tx3);margin-left:auto;">' + testedCount + ' traitées · ' + (11 - testedCount) + ' ouvertes</span>';
  h += '</div>';

  // Statut options
  var statusOpts = [
    { val: 'todo',        label: 'À vérifier' },
    { val: 'investigate', label: 'À investiguer' },
    { val: 'validated',   label: 'Validée' },
    { val: 'rejected',    label: 'Écartée' }
  ];

  var hypoData = cs.hypotheses || [];
  hypoData.forEach(function(hypo) {
    var def = BUYBOX_HYPOTHESES.find(function(x) { return x.id === hypo.id; });
    if (!def) return;
    var isRejected  = hypo.status === 'rejected';
    var isValidated = hypo.status === 'validated';
    var iconHtml = isRejected  ? '<span style="color:var(--g);font-size:13px;">✓</span>'
                 : isValidated ? '<span style="color:var(--a);font-size:13px;">⚠</span>'
                 :               '<span style="color:var(--tx3);font-size:13px;">○</span>';
    var statusColor = hypo.status === 'todo'        ? 'background:var(--s2);color:var(--tx2);'
                    : hypo.status === 'investigate' ? 'background:var(--a-bg);color:var(--a);'
                    : hypo.status === 'validated'   ? 'background:var(--a-bg);color:var(--a);'
                    : 'background:var(--g-bg);color:var(--g);';
    var statusLabel = statusOpts.find(function(s) { return s.val === hypo.status; });
    var statusLabelStr = statusLabel ? statusLabel.label : hypo.status;
    var rowOpacity = isRejected ? 'opacity:0.6;' : '';

    h += '<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:0.5px solid var(--bd);font-size:11px;' + rowOpacity + '">';
    h += '<div style="width:16px;flex-shrink:0;text-align:center;margin-top:1px;">' + iconHtml + '</div>';
    h += '<div style="flex:1;min-width:0;">';
    h += '<div style="font-weight:500;margin-bottom:1px;' + (isRejected ? 'text-decoration:line-through;text-decoration-color:var(--tx3);' : '') + '">' + def.label + '</div>';
    h += '<div style="color:var(--tx3);font-size:10px;">' + def.hint + '</div>';
    // Select statut
    h += '<div style="margin-top:4px;display:flex;gap:4px;align-items:center;">';
    h += '<select style="font-size:10px;padding:2px 4px;background:var(--s2);border:0.5px solid var(--bd2);border-radius:4px;color:var(--tx);" onchange="buyboxUpdateHypothesis(cl(),\'' + caseId + '\',\'' + hypo.id + '\',{status:this.value});render();">';
    statusOpts.forEach(function(opt) {
      h += '<option value="' + opt.val + '"' + (hypo.status === opt.val ? ' selected' : '') + '>' + opt.label + '</option>';
    });
    h += '</select>';
    if (hypo.evidence) {
      h += '<span style="font-size:10px;color:var(--tx3);font-style:italic;">' + hypo.evidence.slice(0, 40) + (hypo.evidence.length > 40 ? '…' : '') + '</span>';
    }
    h += '</div>';
    h += '</div>';
    h += '<span style="font-size:9px;padding:2px 5px;border-radius:3px;font-weight:500;white-space:nowrap;' + statusColor + '">' + statusLabelStr + '</span>';
    h += '</div>';
  });

  // .ai-suggestion — présente mais masquée en v3.6.1 (réactivation v3.6.3)
  h += '<div style="display:none;" class="bb-ai-suggestion"><!-- AI suggestion v3.6.3 --></div>';
  h += '</div>';

  h += '</div>'; // fin col gauche

  // ══ COLONNE DROITE ══
  h += '<div>';

  // ── Carte Journal ──
  h += '<div class="bb-card" style="background:var(--s1);border:0.5px solid var(--bd);border-radius:var(--rdl);padding:14px 16px;margin-bottom:14px;">';
  h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;padding-bottom:8px;border-bottom:0.5px solid var(--bd);">';
  h += '<span style="font-size:14px;">📓</span>';
  h += '<span style="font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;">Journal</span>';
  h += '<button class="btn btn-sm" style="margin-left:auto;" onclick="var txt=prompt(\'Ajouter une entrée journal :\');if(txt&&txt.trim()){buyboxAddJournalEntry(cl(),\'' + caseId + '\',txt.trim(),\'manual\');render();}">+ Ajouter</button>';
  h += '</div>';

  var journal = cs.journal || [];
  if (journal.length === 0) {
    h += '<div style="color:var(--tx3);font-size:11px;">Aucune entrée. Cliquez "+ Ajouter" pour commencer.</div>';
  } else {
    journal.slice().reverse().forEach(function(entry) {
      var ts = entry.ts ? new Date(entry.ts) : null;
      var tsStr = ts ? ts.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' + ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
      var isSystem = entry.type === 'system' || entry.type === 'auto';
      var iconColor = isSystem ? 'color:var(--g);' : 'color:var(--a);';
      var iconChar  = isSystem ? '✓' : '◷';
      h += '<div style="display:flex;gap:8px;padding:7px 0;border-bottom:0.5px solid var(--bd);font-size:11px;">';
      h += '<div style="flex-shrink:0;width:75px;color:var(--tx3);font-size:10px;font-family:var(--fm);">' + tsStr + '</div>';
      h += '<div style="font-size:13px;flex-shrink:0;margin-top:1px;' + iconColor + '">' + iconChar + '</div>';
      h += '<div style="flex:1;min-width:0;">';
      h += entry.content;
      if (isSystem) {
        h += '<div style="color:var(--tx3);font-size:10px;margin-top:1px;">système</div>';
      }
      h += '</div>';
      h += '</div>';
    });
  }
  h += '</div>';

  // ── Carte Conclusion ──
  h += '<div style="background:var(--s2);border:0.5px dashed var(--bd2);border-radius:var(--rdl);padding:14px;">';
  h += '<div style="display:flex;align-items:center;gap:6px;padding-bottom:0;margin-bottom:10px;">';
  h += '<span style="font-size:14px;">🏁</span>';
  h += '<span style="font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;">Conclusion</span>';
  var conclusionState = cs.conclusion && cs.conclusion.state === 'closed' ? 'Finalisée' : 'Non finalisée';
  var conclusionStateColor = cs.conclusion && cs.conclusion.state === 'closed' ? 'background:var(--g-bg);color:var(--g);' : 'background:var(--s2);color:var(--tx3);';
  h += '<span style="font-size:9px;padding:2px 6px;border-radius:3px;font-weight:500;margin-left:auto;' + conclusionStateColor + '">' + conclusionState + '</span>';
  h += '</div>';

  if (cs.conclusion && cs.conclusion.state !== 'closed') {
    h += '<div style="font-size:11px;color:var(--tx2);margin-bottom:12px;line-height:1.5;">';
    h += '<span style="color:var(--tx3);">🔒</span> Cette section s\'activera quand le faisceau d\'éléments sera suffisant. Conditions actuelles :';
    h += '</div>';

    h += '<div style="font-size:11px;margin-bottom:12px;">';
    conclusionCheck.conditions.forEach(function(cond) {
      var iconCheck = cond.met ? '<span style="color:var(--g);font-size:13px;">✓</span>' : '<span style="color:var(--tx3);font-size:13px;">○</span>';
      // Calcul du statut
      var condStatusStr = '';
      if (cond.id === 'min-journal')       condStatusStr = journal.length + ' / 3';
      else if (cond.id === 'hypotheses-tested') condStatusStr = validatedCount + ' val. · ' + rejectedCount + ' écart.';
      else if (cond.id === 'bol-source-known')  condStatusStr = c.bolSource ? c.bolSource : 'en attente';
      h += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;">';
      h += iconCheck;
      h += '<span>' + cond.label + '</span>';
      h += '<span style="color:var(--tx3);margin-left:auto;font-family:var(--fm);font-size:10px;">' + condStatusStr + '</span>';
      h += '</div>';
    });
    h += '</div>';

    var btnDisabled = !conclusionCheck.ready;
    h += '<button class="btn" ' + (btnDisabled ? 'disabled' : '') + ' style="width:100%;padding:7px 14px;" onclick="showToast(\'Phase 3 disponible en v3.6.2\', \'alr-a\', 4000);">Passer en phase 3 — Proposer →</button>';
  } else if (cs.conclusion && cs.conclusion.state === 'closed') {
    h += '<div style="font-size:11px;color:var(--tx2);margin-bottom:8px;">Dossier clôturé — <strong>' + (cs.conclusion.outcome === 'success' ? 'succès' : cs.conclusion.outcome === 'failure' ? 'échec' : 'inconclusif') + '</strong></div>';
    if (cs.conclusion.proposedAction) {
      h += '<div style="font-size:11px;color:var(--tx3);">' + cs.conclusion.proposedAction + '</div>';
    }
  }

  h += '<div style="margin-top:10px;padding:9px 11px;background:var(--s1);border-radius:var(--rd);font-size:10px;color:var(--tx3);line-height:1.5;">';
  h += '🛡 L\'outil ne propose pas de conclusion automatique — c\'est à l\'utilisateur de trancher quand il juge le faisceau suffisant. L\'IA n\'a pas le droit de précipiter.';
  h += '</div>';
  h += '</div>'; // fin conclusion-card

  h += '</div>'; // fin col droite
  h += '</div>'; // fin grid

  return h;
}
