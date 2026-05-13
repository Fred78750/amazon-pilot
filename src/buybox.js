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
    const prevRetail = hist.length >= 1 ? parseNum(hist[hist.length - 1].retailPct) : null;
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

    const entry = { asin: a.asin, title: a.title, brand: a.brand, market: a.market, rPct, prevRetail, delta, cause, zeroWeeks, revenue: getRevenue(a,c), segment: calcSegment(a, c.asins.reduce((s,x)=>s+(getRevenue(x,c)||0),0), c), sellableUnits: a.sellableUnits, couvertureSem, joursAvantLimite, stockUrgent };

    if (isSuppressed)                          suppressed.push(entry);
    else if (isCritical)                       critical.push(entry);
    else if (isDown || (rPct > 0 && rPct < 100)) warning.push(entry);
  }

  // Trier par impact CA décroissant
  const byCA = (a, b) => (getRevenue(b,c)||0) - (getRevenue(a,c)||0);
  critical.sort(byCA); warning.sort(byCA); suppressed.sort(byCA);
  return { critical, warning, suppressed };
}

// ══════════════════════════════════════════════════════════════════
// BUY BOX — Cycle complet 4 phases
// ══════════════════════════════════════════════════════════════════

// ── Initialisation bbCases et bbKnowledge ─────────────────────────
function bbGetCases(c) {
  if (!c.bbCases) c.bbCases = [];
  return c.bbCases;
}
function bbGetKnowledge(c) {
  if (!c.bbKnowledge) c.bbKnowledge = [];
  return c.bbKnowledge;
}
function bbGetCase(c, asin) {
  return bbGetCases(c).find(x => x.asin === asin && x.status !== 'closed') || null;
}
function bbOpenCase(c, asin, cause) {
  const existing = bbGetCase(c, asin);
  if (existing) return existing;
  const week = getISOWeek(new Date());
  const cas = { asin, cause, action: null, note: '', status: 'open',
    weeks: [{ week, rPct: null, event: 'Détection', ts: new Date().toISOString() }],
    openedAt: new Date().toISOString(), resolvedAt: null, success: null };
  bbGetCases(c).push(cas);
  save();
  return cas;
}
function bbCloseCase(c, asin, success) {
  const cas = bbGetCase(c, asin);
  if (!cas) return;
  cas.status = 'closed';
  cas.resolvedAt = new Date().toISOString();
  cas.success = success;
  // Ajouter à la base de connaissance
  if (cas.action && cas.cause) {
    const weeks = cas.weeks.length;
    bbGetKnowledge(c).push({ cause: cas.cause, action: cas.action, weeks, success, ts: new Date().toISOString() });
    // Limiter à 50 cas
    if (c.bbKnowledge.length > 50) c.bbKnowledge = c.bbKnowledge.slice(-50);
  }
  save();
}
function bbKnowledgeSuggestion(c, cause) {
  const kb = bbGetKnowledge(c).filter(k => k.cause === cause);
  if (kb.length < 2) return null;
  // Compter succès par action
  const byAction = {};
  for (const k of kb) {
    if (!byAction[k.action]) byAction[k.action] = { ok: 0, total: 0, weeks: [] };
    byAction[k.action].total++;
    if (k.success) byAction[k.action].ok++;
    byAction[k.action].weeks.push(k.weeks);
  }
  // Trouver la meilleure action
  let best = null, bestScore = -1;
  for (const [action, stats] of Object.entries(byAction)) {
    const score = stats.ok / stats.total;
    if (score > bestScore) { bestScore = score; best = { action, ...stats }; }
  }
  if (!best) return null;
  const avgWeeks = Math.round(best.weeks.reduce((a,b)=>a+b,0) / best.weeks.length);
  return { action: best.action, successRate: Math.round(bestScore * 100), avgWeeks, total: kb.length };
}

function renderBuyBox() {
  const c = cl();
  if (!c) return renderWelcome();
  if (!c.asins?.length) return `<div class="alr alr-a">Importez d'abord des données CSV.</div>`;

  const { critical: critRaw, warning: warnRaw, suppressed: suppRaw } = calcBuyBoxAlerts(c);
  const mktFilt = e => filters.market === 'all' || e.market === filters.market;
  const critical = critRaw.filter(mktFilt);
  const warning = warnRaw.filter(mktFilt);
  const suppressed = suppRaw.filter(mktFilt);
  const allProblems = [...suppressed, ...critical, ...warning];
  const phase = window._bbPhase || 'list';
  const selectedAsin = window._bbSelectedAsin || null;

  let h = `<div style="max-width:960px">`;
  h += renderMarketTabs(c, filters.market);

  if (phase === 'list') {
    // ── PHASE 1 : Vue d'ensemble ─────────────────────────────────

    // Cartes urgence
    const openCases = bbGetCases(c).filter(x => x.status !== 'closed');
    h += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div>
        <h2 style="font-size:18px;font-weight:700;margin:0">🏆 Surveillance Buy Box</h2>
        <p style="color:var(--tx2);font-size:12px;margin:4px 0 0">Mise à jour à chaque import CSV · ${allProblems.length} ASIN${allProblems.length>1?'s':''} avec Featured Offer dégradée</p>
      </div>
      ${openCases.length ? `<span style="font-size:12px;padding:5px 12px;background:var(--b-l,#e6f1fb);color:var(--b,#185fa5);border-radius:20px;font-weight:500">${openCases.length} dossier${openCases.length>1?'s':''} en cours</span>` : ''}
    </div>`;

    // 3 cartes urgence
    h += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">`;
    h += `<div style="padding:14px 16px;border-radius:var(--rd);border:0.5px solid #f09595;background:#fcebeb;cursor:pointer" onclick="window._bbFilter='critical';render()">
      <div style="font-size:26px;font-weight:700;color:#a32d2d">${critical.length}</div>
      <div style="font-size:12px;font-weight:500;color:#a32d2d;margin-top:2px">ASINs à traiter<br>cette semaine</div>
      <div style="font-size:11px;color:#993c1d;margin-top:6px">Featured Offer &lt; 80%<br>CA combiné : ${fmtEur(critical.reduce((s,e)=>s+(e.revenue||0),0))}</div>
    </div>`;
    h += `<div style="padding:14px 16px;border-radius:var(--rd);border:0.5px solid #fac775;background:#faeeda;cursor:pointer" onclick="window._bbFilter='warning';render()">
      <div style="font-size:26px;font-weight:700;color:#854f0b">${warning.length}</div>
      <div style="font-size:12px;font-weight:500;color:#854f0b;margin-top:2px">ASINs en recul<br>à surveiller</div>
      <div style="font-size:11px;color:#854f0b;opacity:.8;margin-top:6px">Featured Offer en baisse<br>vs semaine précédente</div>
    </div>`;
    h += `<div style="padding:14px 16px;border-radius:var(--rd);border:0.5px solid var(--bd);background:var(--s2)">
      <div style="font-size:26px;font-weight:700;color:var(--tx2)">${suppressed.length}</div>
      <div style="font-size:12px;font-weight:500;color:var(--tx2);margin-top:2px">Fiches à vérifier<br>en urgence</div>
      <div style="font-size:11px;color:var(--tx3);margin-top:6px">Featured Offer à 0%<br>depuis ≥2 semaines</div>
    </div>`;
    h += `</div>`;

    // Tableau simplifié
    const bbFilter = window._bbFilter || 'all';
    const toShow = bbFilter === 'critical' ? critical : bbFilter === 'warning' ? warning : bbFilter === 'suppressed' ? suppressed : [...suppressed, ...critical, ...warning];
    const mkt = c.mainMarket || '.fr';

    h += `<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      ${[['all','Tous',allProblems.length,'var(--tx2)'],['critical','À traiter',critical.length,'#a32d2d'],['warning','À surveiller',warning.length,'#854f0b'],['suppressed','Fiches à vérifier',suppressed.length,'var(--tx2)']].map(([v,l,n,col]) =>
        `<button class="btn btn-sm${bbFilter===v?' btn-p':''}" onclick="window._bbFilter='${v}';render()" style="${bbFilter===v?'':'color:'+col}">${l} (${n})</button>`
      ).join('')}
    </div>`;

    h += `<div class="cd" style="padding:0;overflow:hidden">`;
    for (const e of toShow) {
      const existingCase = bbGetCase(c, e.asin);
      const statusLabel = existingCase ? `<span style="font-size:10px;padding:2px 7px;background:var(--b-l,#e6f1fb);color:var(--b,#185fa5);border-radius:10px">Dossier ouvert</span>` : '';
      const isSuppressed = suppressed.includes(e);
      const isCritical = critical.includes(e);
      const dotColor = isSuppressed ? '#888' : isCritical ? '#e24b4a' : '#ef9f27';

      // Bouton d'action contextuel selon cause
      let actionBtn = '';
      if (e.cause === 'stock' || e.stockUrgent)
        actionBtn = `<button class="btn btn-sm" style="background:#ef9f27;color:#fff;border-color:#ef9f27" onclick="event.stopPropagation();window._approsAsin='${e.asin}';go('appros')">Voir Appros →</button>`;
      else if (e.cause === 'suppression')
        actionBtn = `<button class="btn btn-sm" style="background:#888;color:#fff;border-color:#888" onclick="event.stopPropagation();window._bbPhase='action';window._bbSelectedAsin='${esc(e.asin)}';render()">Ouvrir le dossier</button>`;
      else
        actionBtn = `<button class="btn btn-sm" style="background:#e24b4a;color:#fff;border-color:#e24b4a" onclick="event.stopPropagation();window._bbPhase='action';window._bbSelectedAsin='${esc(e.asin)}';bbOpenCase(cl(),'${esc(e.asin)}','${e.cause}');render()">Traiter →</button>`;

      const shortTitle = esc((e.title || e.asin).slice(0, 42)) + ((e.title||'').length > 42 ? '…' : '');
      const deltaStr = e.delta !== null ? (e.delta > 0 ? '+' : '') + e.delta.toFixed(0) + 'pts' : '—';
      const stockStr = e.couvertureSem !== null && e.couvertureSem !== '—'
        ? `<span style="font-size:10px;padding:2px 6px;border-radius:8px;background:${e.stockUrgent?'#fcebeb':'#eaf3de'};color:${e.stockUrgent?'#a32d2d':'#3b6d11'}">${Number(e.couvertureSem).toFixed(1)}sem</span>`
        : '';

      h += `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:0.5px solid var(--bd);cursor:pointer" onclick="window._bbPhase='action';window._bbSelectedAsin='${esc(e.asin)}';bbOpenCase(cl(),'${esc(e.asin)}','${e.cause}');render()">
        <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${shortTitle}</div>
          <div style="font-size:11px;color:var(--tx2);margin-top:1px">${e.asin} · ${e.cause==='prix_3p'?'Vendeur 3P concurrent':e.cause==='stock'?'Stock faible':e.cause==='suppression'?'Éligibilité perdue':e.cause==='po_unconfirmed'?'PO non confirmé':'En surveillance'} ${stockStr}</div>
        </div>
        ${statusLabel}
        <div style="text-align:center;flex-shrink:0;width:52px">
          <div style="font-size:13px;font-weight:700;color:${isCritical||isSuppressed?'#a32d2d':'#854f0b'}">${e.rPct.toFixed(0)}%</div>
          <div style="font-size:10px;color:${e.delta!==null&&e.delta<0?'#a32d2d':e.delta>0?'#3b6d11':'var(--tx3)'}">${deltaStr}</div>
        </div>
        <div style="font-size:12px;font-weight:500;flex-shrink:0;width:70px;text-align:right">${fmtEur(e.revenue||0)}</div>
        ${actionBtn}
      </div>`;
    }
    h += `</div>`;

  } else if (phase === 'action' && selectedAsin) {
    // ── PHASES 2-4 : Dossier ASIN ────────────────────────────────
    h += renderBuyBoxCase(c, selectedAsin);
  }

  h += `</div>`;
  return h;
}

function renderBuyBoxCase(c, asin) {
  const a = c.asins.find(x => x.asin === asin);
  const { critical, warning, suppressed } = calcBuyBoxAlerts(c);
  const allE = [...suppressed, ...critical, ...warning];
  const e = allE.find(x => x.asin === asin);
  if (!a || !e) return `<div class="alr alr-a">ASIN introuvable.</div>`;

  let cas = bbGetCase(c, asin);
  if (!cas) { cas = bbOpenCase(c, asin, e.cause); }

  const subPhase = window._bbSubPhase || 'plan';
  const mkt = c.mainMarket || '.fr';

  // Navigation retour + onglets phases
  let h = `<button class="btn btn-sm" onclick="window._bbPhase='list';window._bbSubPhase='plan';render()" style="margin-bottom:14px">← Retour</button>`;

  // En-tête ASIN
  h += `<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;padding:14px;background:var(--s2);border-radius:var(--rd)">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700;margin-bottom:3px">${esc((a.title||asin).slice(0,60))}${(a.title||'').length>60?'…':''}</div>
      <div style="font-size:11px;color:var(--tx2)">${asin} · Featured Offer actuelle : <strong style="color:${e.rPct<80?'#a32d2d':'#854f0b'}">${e.rPct.toFixed(0)}%</strong>${e.delta!==null?` (${(e.delta>0?'+':'')+e.delta.toFixed(0)}pts vs S-1)`:''}</div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0">
      <button class="btn btn-sm" onclick="openAmazonProduct('${asin}','${mkt}')">Voir sur Amazon</button>
      <button class="btn btn-sm" onclick="copyBuyBoxChromePrompt('${asin}','${mkt}')">Prompt IA</button>
    </div>
  </div>`;

  // Onglets 2-3-4
  const tabs = [['plan','2 — Plan d\u2019action'],['suivi','3 — Suivi'],['bilan','4 — Bilan']];
  h += `<div style="display:flex;gap:0;border-bottom:0.5px solid var(--bd);margin-bottom:16px">`;
  for (const [id, label] of tabs) {
    const on = subPhase === id;
    h += `<button onclick="window._bbSubPhase='${id}';render()" style="padding:8px 16px;font-size:12px;font-weight:${on?'600':'400'};border:none;background:none;cursor:pointer;color:${on?'var(--tx)':'var(--tx2)'};border-bottom:2px solid ${on?'var(--b,#378add)':'transparent'}">${label}</button>`;
  }
  h += `</div>`;

  if (subPhase === 'plan') {
    h += renderBBPlan(c, cas, e, asin, mkt);
  } else if (subPhase === 'suivi') {
    h += renderBBSuivi(c, cas, e, asin);
  } else if (subPhase === 'bilan') {
    h += renderBBBilan(c, cas, e, asin);
  }

  return h;
}

function renderBBPlan(c, cas, e, asin, mkt) {
  const a = c.asins.find(x => x.asin === asin) || {};

  // ── Sparkline ─────────────────────────────────────────────────
  const hist = (a.history || []).slice(-10).filter(h => parseNum(h.retailPct) > 0 || (h.revenue||0) > 0);
  const svgW = 300, svgH = 50, pad = 4;
  const pts = hist.map((d,i) => {
    const x = hist.length > 1 ? pad + i*(svgW-2*pad)/(hist.length-1) : svgW/2;
    const y = svgH - pad - (Math.min(parseNum(d.retailPct)||0,100)/100)*(svgH-2*pad);
    return `${x},${y}`;
  }).join(' ');
  const sparkline = hist.length >= 2
    ? `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;height:44px;display:block">
        <line x1="0" y1="${svgH-pad-(95/100)*(svgH-2*pad)}" x2="${svgW}" y2="${svgH-pad-(95/100)*(svgH-2*pad)}" stroke="#3b6d11" stroke-width="1" stroke-dasharray="3,3" opacity=".4"/>
        <polyline points="${pts}" fill="none" stroke="#378add" stroke-width="1.5" stroke-linejoin="round"/>
        ${hist.map((d,i)=>{const x=hist.length>1?pad+i*(svgW-2*pad)/(hist.length-1):svgW/2;const rp=parseNum(d.retailPct)||0;const y=svgH-pad-(Math.min(rp,100)/100)*(svgH-2*pad);return `<circle cx="${x}" cy="${y}" r="3" fill="${rp<80?'#e24b4a':rp<95?'#ef9f27':'#639922'}"/>`;}).join('')}
      </svg>`
    : `<p style="font-size:11px;color:var(--tx3);margin:0">Pas encore d\u2019historique — visible après plusieurs imports hebdomadaires</p>`;

  // ── Corrélation CA/retailPct ───────────────────────────────────
  const histFull = hist.filter(h => parseNum(h.retailPct) > 0 && (h.revenue||0) > 0);
  let corrBlock = '';
  if (histFull.length >= 4) {
    const n = histFull.length, sumX = histFull.reduce((s,h)=>s+parseNum(h.retailPct),0),
      sumY = histFull.reduce((s,h)=>s+(h.revenue||0),0),
      sumXY = histFull.reduce((s,h)=>s+parseNum(h.retailPct)*(h.revenue||0),0),
      sumX2 = histFull.reduce((s,h)=>s+Math.pow(parseNum(h.retailPct),2),0),
      denom = n*sumX2 - sumX*sumX;
    if (denom !== 0) {
      const slope = Math.round((n*sumXY - sumX*sumY)/denom);
      if (slope > 0) corrBlock = `<div style="font-size:11px;color:var(--tx2);margin-top:6px;padding:6px 8px;background:var(--b-l,#e6f1fb);border-radius:var(--rd)">Chaque point de Featured Offer perdu ≈ <strong>${fmtEur(Math.abs(slope))}</strong>/semaine (${n} sem.)</div>`;
    }
  }

  // ── Suggestion bbKnowledge ─────────────────────────────────────
  const suggestion = bbKnowledgeSuggestion(c, e.cause);
  const suggBlock = suggestion
    ? `<div style="padding:8px 12px;background:#eaf3de;border-left:3px solid #639922;border-radius:0 var(--rd) var(--rd) 0;font-size:12px;margin-bottom:12px">
        Sur ${suggestion.total} cas similaires, "<em>${suggestion.action}</em>" a réussi ${suggestion.successRate}% du temps (~${suggestion.avgWeeks} sem.)
      </div>` : '';

  // ── Alerte double urgence stock ────────────────────────────────
  const stockAlert = (e.cause === 'stock' || e.stockUrgent)
    ? `<div class="alr alr-r" style="margin-bottom:10px;font-size:12px">
        🔗 <strong>Double urgence</strong> — Buy Box + stock critique : ${e.couvertureSem !== null ? `<strong>${Number(e.couvertureSem).toFixed(1)} semaines</strong>` : 'couverture inconnue'}
        <button class="btn btn-sm" style="background:#e24b4a;color:#fff;border-color:#e24b4a;margin-left:8px" onclick="window._approsAsin='${asin}';go('appros')">Voir Appros →</button>
      </div>` : '';

  // ── Résultat IA éventuel déjà stocké ──────────────────────────
  const iaResult = cas.iaResult || null;
  const currentNote = (cas.note || '').replace(/"/g, '&quot;');
  const currentAction = cas.action || '';
  const actions = ['Coupon temporaire (recommandé — sans baisser le catalogue)','Baisse de prix catalogue','Signalement Brand Registry','Email Vendor Central','Commande réappro urgente','Autre'];

  // ── Liens Vendor Central directs ──────────────────────────────
  const vcBase = 'https://vendor.amazon.fr';
  const vcLinks = {
    pricing:  vcBase + '/pricing/health',
    catalog:  vcBase + '/catalog',
    coupons:  vcBase + '/promotions/coupons',
    registry: 'https://brandregistry.amazon.fr',
    support:  vcBase + '/support',
    orders:   vcBase + '/orders/purchaseOrders',
  };
  const amazonUrl = `https://www.amazon${mkt||'.fr'}/dp/${asin}`;

  // ── Définition des steps ACTIONNABLES ─────────────────────────
  // Structure : {id, t, d, ctas:[{label,url?,onclick?,primary?}], iaField?}
  const stepsMap = {
    prix_3p: [
      { id:0,
        t: 'Qui a pris ma Featured Offer ?',
        d: 'L\u2019IA analyse la fiche Amazon en direct et vous dit immédiatement qui détient la Buy Box et à quel prix.',
        ctas: [
          { label: cas.iaLoading ? 'Analyse...' : (cas.iaResult ? 'Relancer' : 'Analyser avec l’IA'), onclick: "analyseBuyBoxLive('" + asin + "','" + (mkt||'.fr') + "',cl())", primary: true },
          { label: 'Voir la fiche Amazon', url: amazonUrl },
        ],
        iaField: 'concurrent',
      },
      { id:1,
        t: 'Quel est l\u2019écart de prix ?',
        d: iaResult?.prixConcurrent
          ? `Concurrent : <strong>${esc(iaResult.prixConcurrent)}</strong> · Votre prix : <strong>${fmtEur(parseNum(a.price||0)||0)}</strong>`
          : 'Rempli automatiquement après l\u2019analyse IA — ou saisissez manuellement.',
        ctas: [],
        iaField: 'prixConcurrent',
        input: true,
        inputPlaceholder: 'Ex: concurrent à 11,90 €, votre prix 14,50 €…',
        inputKey: 'prixConcurrent',
      },
      { id:2,
        t: 'Vérifier Pricing Health dans Vendor Central',
        d: 'Amazon signale ici les ASINs avec un prix jugé non compétitif (Competitive External Price).',
        ctas: [
          { label: 'Ouvrir Pricing Health VC', url: vcLinks.pricing, primary: true },
        ],
      },
      { id:3,
        t: 'Ajuster le prix ou lancer un coupon',
        d: 'Commencez par un coupon temporaire — vous testez l\u2019impact sans baisser définitivement votre prix catalogue.',
        ctas: [
          { label: 'Créer un coupon dans VC', url: vcLinks.coupons, primary: true },
          { label: 'Gérer les prix VC', url: vcLinks.pricing },
        ],
      },
      { id:4,
        t: 'Le 3P est-il un distributeur non autorisé ?',
        d: 'Si le vendeur tiers n\u2019est pas agréé pour distribuer votre marque, vous pouvez le signaler via Brand Registry.',
        ctas: [
          { label: 'Ouvrir Brand Registry', url: vcLinks.registry },
        ],
      },
    ],
    stock: [
      { id:0,
        t: 'Passer une commande de réappro en urgence',
        d: 'Le stock est insuffisant — Amazon retire la Featured Offer des produits à risque de rupture.',
        ctas: [
          { label: 'Voir mes Appros pour cet ASIN', onclick: `window._approsAsin='${asin}';go('appros')`, primary: true },
          { label: 'POs en cours dans VC', url: vcLinks.orders },
        ],
      },
      { id:1, t: 'Vérifier les POs en attente de confirmation', d: 'Un PO non confirmé bloque le réappro sans alerte visible.',
        ctas: [{ label: 'POs en attente VC', url: vcLinks.orders, primary: true }] },
      { id:2, t: 'Activer le stock de sécurité si disponible', d: 'Éviter le stock à zéro en FBA pendant l\u2019attente du réappro.',
        ctas: [] },
      { id:3, t: 'Surveiller la Buy Box après réappro', d: 'La Featured Offer revient généralement sous 48-72h après reconstitution du stock.',
        ctas: [] },
    ],
    suppression: [
      { id:0, t: 'Vérifier que la fiche est encore visible sur Amazon', d: 'Si le produit n\u2019apparaît plus, c\u2019est une suppression active.',
        ctas: [{ label: 'Ouvrir la fiche Amazon', url: amazonUrl, primary: true }] },
      { id:1, t: 'Contrôler le catalogue dans VC', d: 'Statut de la fiche, variations, suppressions partielles.',
        ctas: [{ label: 'Catalogue VC', url: vcLinks.catalog, primary: true }] },
      { id:2, t: 'Vérifier Pricing Health et Account Health', d: 'Prix trop haut ou trop bas peut suspendre l\u2019éligibilité.',
        ctas: [{ label: 'Pricing Health VC', url: vcLinks.pricing, primary: true }] },
      { id:3, t: 'Ouvrir un cas Vendor Support en urgence', d: 'Si tout est conforme et la fiche reste invisible.',
        ctas: [{ label: 'Ouvrir un cas Support VC', url: vcLinks.support, primary: true }] },
    ],
    po_unconfirmed: [
      { id:0,
        t: 'Confirmer le PO en urgence dans Vendor Central',
        d: 'Amazon a émis une commande — taux de confirmation = 0%. Sans confirmation, Amazon réduit ses futures commandes.',
        ctas: [{ label: 'Ouvrir les POs dans VC', url: 'https://vendor.amazon.fr/orders/purchaseOrders', primary: true }]
      },
      { id:1,
        t: 'Identifier pourquoi la confirmation est à 0%',
        d: 'Problème EDI ? Délai trop court ? Rupture chez le fournisseur ? Identifier la cause avant de confirmer.',
        ctas: []
      },
      { id:2,
        t: 'Contacter votre Account Manager Amazon',
        d: 'Si le PO est bloqué administrativement, votre AM peut débloquer rapidement.',
        ctas: [{ label: 'Support Vendor Central', url: 'https://vendor.amazon.fr/support' }]
      },
      { id:3,
        t: 'Surveiller la Buy Box après confirmation',
        d: 'Dès le stock Amazon reconstitué, la Featured Offer revient sous 48-72h.',
        ctas: []
      },
    ],
    surveillance: [
      { id:0, t: 'Ouvrir la fiche Amazon et observer', d: 'Y a-t-il un nouveau vendeur tiers ? Le prix est-il toujours compétitif ?',
        ctas: [{ label: 'Voir la fiche Amazon', url: amazonUrl, primary: true }] },
      { id:1, t: 'Contrôler le stock disponible', d: 'Un stock bas peut déclencher une perte progressive de Featured Offer.',
        ctas: [{ label: 'Voir mes Appros', onclick: `window._approsAsin='${asin}';go('appros')` }] },
      { id:2, t: 'Attendre l\u2019import de la semaine prochaine', d: 'Si c\u2019est une baisse ponctuelle, elle peut se corriger seule.',
        ctas: [] },
    ],
  };

  const steps = stepsMap[e.cause] || stepsMap['surveillance'];

  // ── RENDU ─────────────────────────────────────────────────────
  let h = `<div style="display:grid;grid-template-columns:1fr 1.3fr;gap:16px;align-items:start">`;

  // ── Colonne gauche : sparkline + note ─────────────────────────
  h += `<div>
    <div class="cd" style="margin-bottom:12px">
      <div class="cd-t">Évolution Featured Offer</div>
      <div style="padding:8px 0">${sparkline}${corrBlock}</div>
    </div>`;

  // Données PO réelles (CSV PO importé)
  const poD = getPOData(c, asin);
  const guideAsnBtn = '<div style="margin-bottom:10px;padding:8px 12px;background:var(--b-l,#e6f1fb);border-radius:var(--rd);display:flex;align-items:center;gap:8px;font-size:11px">' + '<span>&#128203;</span>' + '<span style="flex:1;color:var(--tx2)">Probl\u00e8me d\'\u00e9cart ASN/r\u00e9ception ?</span>' + '<button class="btn btn-sm" onclick="downloadGuideASN()" style="font-size:10px;padding:4px 8px">Guide ASN/BOL &#8595;</button>' + '</div>';
  // Alerte PO non confirme
  const openPOdisp = parseNum((a && a.openPOQty) || 0);
  const cpctDisp = parseNum(String((a && a.confirmPct) || '0').replace(',','.').replace(/[^0-9.]/g,''));
  const poAlert = poD && (poD.fillRate < 80 || poD.isPermanentOOS || poD.isDiscontinued)
    ? '<div class="alr ' + (poD.isPermanentOOS || poD.isDiscontinued ? 'alr-r' : 'alr-a') + '" style="margin-bottom:10px;font-size:12px">'
      + (poD.isDiscontinued ? '<strong>Fin de série (CP)</strong> — ' : poD.isPermanentOOS ? '<strong>Rupture permanente (CK)</strong> — ' : '<strong>Fill rate faible</strong> — ')
      + 'Fill rate : <strong>' + poD.fillRate + '%</strong>'
      + ' · ' + poD.totalAccepted + '/' + poD.totalAsked + ' unités acceptées'
      + (poD.refusCount > 0 ? ' · ' + poD.refusCount + ' refus | Dernier : ' + poD.lastCancelReason.slice(0,40) : '')
      + '<br><a href="https://vendor.amazon.fr/orders/purchaseOrders" target="_blank" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:500;padding:4px 10px;border-radius:var(--rd);background:#e24b4a;color:#fff;text-decoration:none">Voir POs dans VC →</a>'
      + '</div>'
    : (e.cause === 'po_unconfirmed' || (openPOdisp > 0 && cpctDisp < 50))
    ? '<div class="alr alr-r" style="margin-bottom:10px;font-size:12px">'
      + '<strong>PO non confirmé</strong> — Amazon a commandé <strong>' + openPOdisp + ' unités</strong>'
      + ' · Confirmation : <strong>' + cpctDisp.toFixed(0) + '%</strong><br>'
      + 'Confirmer dans Vendor Central.'
      + '<a href="https://vendor.amazon.fr/orders/purchaseOrders" target="_blank" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:500;padding:4px 10px;border-radius:var(--rd);background:#e24b4a;color:#fff;text-decoration:none">POs VC →</a>'
      + '</div>'
    : '';

  if (suggBlock) h += suggBlock;
  if (poAlert) { h += poAlert; h += guideAsnBtn; }
  if (stockAlert) h += stockAlert;

  // Resultat IA
  if (cas.iaLoading) {
    h += '<div class="alr alr-b" style="font-size:12px;margin-bottom:10px">Analyse IA en cours…</div>';
  } else if (cas.iaResult) {
    const r = cas.iaResult;
    h += '<div class="cd" style="margin-bottom:12px;border-left:3px solid #e24b4a;border-radius:0 var(--rd) var(--rd) 0">'
      + '<div class="cd-t">Résultat analyse IA</div>'
      + '<div style="font-size:12px;padding:6px 0;line-height:1.7">'
      + (r.vendeurBB ? '<div><strong>Featured Offer :</strong> ' + esc(r.vendeurBB) + (r.isPrime ? ' · Prime' : '') + '</div>' : '')
      + (r.prixBB ? '<div><strong>Prix Buy Box :</strong> ' + esc(r.prixBB) + '</div>' : '')
      + (r.ecartPrix ? '<div><strong>Écart vs fournisseur :</strong> ' + esc(r.ecartPrix) + '</div>' : '')
      + (r.autresOffres ? '<div style="color:var(--tx2);margin-top:2px">' + esc(r.autresOffres) + '</div>' : '')
      + (r.causeProb ? '<div style="margin-top:6px;padding:6px 8px;background:var(--or-bg,#fff8ee);border-radius:var(--rd);"><strong>Cause :</strong> ' + esc(r.causeProb) + '</div>' : '')
      + (r.actionReco ? '<div style="margin-top:4px;padding:6px 8px;background:#eaf3de;border-radius:var(--rd);color:#3b6d11"><strong>Action :</strong> ' + esc(r.actionReco) + '</div>' : '')
      + '</div></div>';
  }

  // Résultat IA si disponible
  if (iaResult) {
    h += `<div class="cd" style="margin-bottom:12px;border-left:3px solid #e24b4a;border-radius:0 var(--rd) var(--rd) 0">
      <div class="cd-t">Résultat analyse IA</div>
      <div style="font-size:12px;line-height:1.6;padding:6px 0">
        ${iaResult.concurrent ? `<div><strong>Featured Offer :</strong> ${esc(iaResult.concurrent)}</div>` : ''}
        ${iaResult.prixConcurrent ? `<div><strong>Prix concurrent :</strong> ${esc(iaResult.prixConcurrent)}</div>` : ''}
        ${iaResult.diagnostic ? `<div style="margin-top:4px;color:var(--tx2)">${esc(iaResult.diagnostic)}</div>` : ''}
      </div>
    </div>`;
  }

  // Action choisie + note
  h += `<div class="cd">
    <div class="cd-t">Votre décision</div>
    <div style="margin-bottom:10px">
      <div style="font-size:11px;color:var(--tx2);margin-bottom:5px">Action choisie</div>
      <select onchange="bbGetCase(cl(),'${asin}').action=this.value;save()" style="width:100%;font-size:12px;padding:7px 8px;border-radius:var(--rd);border:0.5px solid var(--bd);background:var(--bg);color:var(--tx)">
        <option value="">— Sélectionner une action —</option>
        ${actions.map(act=>`<option value="${esc(act)}"${currentAction===act?' selected':''}>${esc(act)}</option>`).join('')}
      </select>
    </div>
    <div>
      <div style="font-size:11px;color:var(--tx2);margin-bottom:5px">Note (concurrent identifié, prix cible…)</div>
      <textarea onchange="bbGetCase(cl(),'${asin}').note=this.value;save()" placeholder="Ex: Pièces Auto Discount à 11,90 €, prix cible 12,50 €" style="width:100%;font-size:12px;padding:7px 8px;border-radius:var(--rd);border:0.5px solid var(--bd);background:var(--bg);color:var(--tx);resize:vertical;min-height:56px">${currentNote}</textarea>
    </div>
    <button class="btn btn-p" style="width:100%;margin-top:10px;font-size:12px" onclick="window._bbSubPhase='suivi';render()">Valider → passer au suivi</button>
  </div>`;

  h += `</div>`;

  // ── Colonne droite : steps actionnables ───────────────────────
  h += `<div class="cd">
    <div class="cd-t">Que faire maintenant — étape par étape</div>`;

  for (const s of steps) {
    const done = cas.steps && cas.steps[s.id];
    const hasCtas = s.ctas && s.ctas.length > 0;
    h += `<div style="padding:12px 0;border-bottom:0.5px solid var(--bd)">
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:${hasCtas?'8':'0'}px">
        <input type="checkbox" ${done?'checked':''} style="margin-top:2px;flex-shrink:0;width:15px;height:15px;cursor:pointer"
          onchange="if(!bbGetCase(cl(),'${asin}').steps)bbGetCase(cl(),'${asin}').steps={};bbGetCase(cl(),'${asin}').steps[${s.id}]=this.checked;save()">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;${done?'text-decoration:line-through;color:var(--tx3)':''}">${esc(s.t)}</div>
          <div style="font-size:11px;color:var(--tx2);margin-top:2px;line-height:1.4">${s.d}</div>
          ${s.input ? `<input type="text" placeholder="${esc(s.inputPlaceholder||'')}"
            value="${esc((cas[s.inputKey]||'').replace(/"/g,'&quot;'))}"
            onchange="bbGetCase(cl(),'${asin}')['${s.inputKey||'note'}']=this.value;save()"
            style="width:100%;margin-top:6px;font-size:11px;padding:5px 8px;border-radius:var(--rd);border:0.5px solid var(--bd);background:var(--bg);color:var(--tx)">` : ''}
        </div>
      </div>`;

    if (hasCtas) {
      h += `<div style="display:flex;gap:6px;flex-wrap:wrap;padding-left:25px">`;
      for (const cta of s.ctas) {
        if (cta.url) {
          h += `<a href="${cta.url}" target="_blank"
            onclick="if(!bbGetCase(cl(),'${asin}').steps)bbGetCase(cl(),'${asin}').steps={};bbGetCase(cl(),'${asin}').steps[${s.id}]=true;save();render()"
            style="display:inline-block;font-size:11px;font-weight:500;padding:5px 12px;border-radius:var(--rd);text-decoration:none;
            ${cta.primary?'background:#e24b4a;color:#fff;border:0.5px solid #e24b4a':'background:var(--s2);color:var(--tx);border:0.5px solid var(--bd)'}">${esc(cta.label)} →</a>`;
        } else if (cta.onclick) {
          h += `<button onclick="${cta.onclick};if(!bbGetCase(cl(),'${asin}').steps)bbGetCase(cl(),'${asin}').steps={};bbGetCase(cl(),'${asin}').steps[${s.id}]=true;save();render()"
            style="font-size:11px;font-weight:500;padding:5px 12px;border-radius:var(--rd);cursor:pointer;
            ${cta.primary?'background:#e24b4a;color:#fff;border:0.5px solid #e24b4a':'background:var(--s2);color:var(--tx);border:0.5px solid var(--bd)'}">${esc(cta.label)} →</button>`;
        }
      }
      h += `</div>`;
    }

    h += `</div>`;
  }

  h += `</div></div>`;
  return h;
}

function renderBBSuivi(c, cas, e, asin) {
  const weeks = cas.weeks || [];
  // Mettre à jour la semaine courante avec le retailPct actuel
  const currentWeek = getISOWeek(new Date());

  let h = `<div class="cd" style="margin-bottom:14px">
    <div class="cd-t space">
      <span>Timeline du dossier</span>
      <button class="btn btn-sm" onclick="
        const cas=bbGetCase(cl(),'${asin}');
        const w=getISOWeek(new Date());
        const rp=${e.rPct.toFixed(1)};
        if(!cas.weeks.find(x=>x.week===w)){cas.weeks.push({week:w,rPct:rp,event:'Import S'+w,ts:new Date().toISOString()});}
        save();render()">+ Enregistrer la semaine courante (S${currentWeek} · ${e.rPct.toFixed(0)}%)</button>
    </div>`;

  if (weeks.length === 0) {
    h += `<div style="padding:16px;text-align:center;color:var(--tx3);font-size:12px">Aucune entrée — cliquez sur le bouton pour enregistrer la semaine courante</div>`;
  } else {
    h += `<div style="padding:8px 0">`;
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i];
      const isLast = i === weeks.length - 1;
      const rp = w.rPct !== null ? parseFloat(w.rPct) : null;
      const dotColor = rp === null ? 'var(--tx3)' : rp >= 95 ? '#639922' : rp >= 80 ? '#ef9f27' : '#e24b4a';
      const prev = i > 0 && weeks[i-1].rPct !== null ? parseFloat(weeks[i-1].rPct) : null;
      const delta = rp !== null && prev !== null ? (rp - prev).toFixed(0) : null;
      h += `<div style="display:flex;gap:12px;padding:10px 0;${!isLast?'border-bottom:0.5px solid var(--bd)':''}">
        <div style="display:flex;flex-direction:column;align-items:center;width:40px;flex-shrink:0">
          <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};flex-shrink:0"></div>
          ${!isLast?`<div style="width:1px;flex:1;background:var(--bd);margin-top:3px"></div>`:''}
        </div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:500">S${w.week} — ${w.event}</div>
          <div style="font-size:11px;color:var(--tx2);margin-top:2px">
            ${rp!==null?`Featured Offer : <strong>${rp.toFixed(0)}%</strong>`:'Pas de données Retail%'}
            ${delta!==null?`<span style="color:${delta>0?'#3b6d11':delta<0?'#a32d2d':'var(--tx3)'};margin-left:6px">${delta>0?'+':''}${delta}pts</span>`:''}
          </div>
          ${w.note?`<div style="font-size:11px;color:var(--tx3);margin-top:2px">${esc(w.note)}</div>`:''}
        </div>
      </div>`;
    }
    h += `</div>`;
  }
  h += `</div>`;

  h += `<div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn btn-sm" style="background:#639922;color:#fff;border-color:#639922" onclick="window._bbSubPhase='bilan';render()">Featured Offer récupérée → Clôturer</button>
    <button class="btn btn-sm" onclick="window._bbPhase='list';window._bbSubPhase='plan';render()">Retour au tableau</button>
  </div>`;

  return h;
}

function renderBBBilan(c, cas, e, asin) {
  const isClosed = cas.status === 'closed';
  const durée = cas.weeks.length;

  let h = '';

  if (!isClosed) {
    h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <button class="btn" style="padding:14px;font-size:12px;text-align:center;background:#eaf3de;border-color:#c0dd97;color:#3b6d11" onclick="bbCloseCase(cl(),'${asin}',true);render()">
        <div style="font-size:20px;margin-bottom:4px">✅</div>
        <div style="font-weight:500">Résolu — ça a fonctionné</div>
        <div style="font-size:11px;opacity:.8;margin-top:2px">Featured Offer récupérée</div>
      </button>
      <button class="btn" style="padding:14px;font-size:12px;text-align:center;background:#fcebeb;border-color:#f09595;color:#a32d2d" onclick="bbCloseCase(cl(),'${asin}',false);render()">
        <div style="font-size:20px;margin-bottom:4px">❌</div>
        <div style="font-weight:500">Résolu — ça n\u2019a pas fonctionné</div>
        <div style="font-size:11px;opacity:.8;margin-top:2px">Action inefficace — à documenter</div>
      </button>
    </div>`;
  }

  if (isClosed) {
    const success = cas.success;
    h += `<div style="padding:12px 14px;border-radius:var(--rd);border:0.5px solid ${success?'#c0dd97':'#f09595'};background:${success?'#eaf3de':'#fcebeb'};margin-bottom:14px;font-size:12px">
      <strong>${success ? '✅ Dossier clôturé — résolution confirmée' : '❌ Dossier clôturé — action inefficace'}</strong><br>
      Action utilisée : <em>${esc(cas.action || '—')}</em> · Durée : ${durée} semaine${durée>1?'s':''}
      ${cas.note?`<br>Note : ${esc(cas.note)}`:''}
    </div>`;

    // Règle apprise
    const suggestion = bbKnowledgeSuggestion(c, e.cause);
    if (suggestion) {
      h += `<div style="padding:10px 12px;background:var(--g-bg,#eaf3de);border-left:3px solid #639922;border-radius:0 var(--rd) var(--rd) 0;font-size:12px;margin-bottom:14px">
        <strong>Règle apprise (${suggestion.total} cas) :</strong><br>
        Sur ce profil (${e.cause==='prix_3p'?'3P concurrent':e.cause==='stock'?'stock faible':'autre'}), l'action "<em>${suggestion.action}</em>" fonctionne dans ${suggestion.successRate}% des cas en ~${suggestion.avgWeeks} semaines.
        Cette règle sera suggérée automatiquement pour les cas similaires.
      </div>`;
    }
  }

  // KPIs globaux
  const allClosed = bbGetCases(c).filter(x => x.status === 'closed');
  const resolved = allClosed.filter(x => x.success);
  const avgWeeks = allClosed.length ? Math.round(allClosed.reduce((s,x)=>s+x.weeks.length,0)/allClosed.length) : 0;

  h += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
    <div style="background:var(--s2);border-radius:var(--rd);padding:12px;text-align:center">
      <div style="font-size:22px;font-weight:500;color:${resolved.length>0?'#3b6d11':'var(--tx2)'}">${allClosed.length ? Math.round(resolved.length/allClosed.length*100) : '—'}${allClosed.length?'%':''}</div>
      <div style="font-size:10px;color:var(--tx2);margin-top:3px">Taux de résolution</div>
    </div>
    <div style="background:var(--s2);border-radius:var(--rd);padding:12px;text-align:center">
      <div style="font-size:22px;font-weight:500;color:var(--b,#185fa5)">${avgWeeks || '—'}${avgWeeks?'sem':''}</div>
      <div style="font-size:10px;color:var(--tx2);margin-top:3px">Durée moy. résolution</div>
    </div>
    <div style="background:var(--s2);border-radius:var(--rd);padding:12px;text-align:center">
      <div style="font-size:22px;font-weight:500;color:#3b6d11">${allClosed.length}</div>
      <div style="font-size:10px;color:var(--tx2);margin-top:3px">Cas clôturés</div>
    </div>
  </div>`;

  if (isClosed) {
    h += `<button class="btn btn-sm" style="margin-top:14px" onclick="window._bbPhase='list';window._bbSubPhase='plan';render()">← Retour au tableau</button>`;
  }

  return h;
}

function analyseBuyBoxLive(asin, market, c) {
  const asinData = c && c.asins ? c.asins.find(a => a.asin === asin) : null;
  const units = (asinData && (asinData.units || asinData.shippedUnits)) || 0;
  const revenue = (asinData && (asinData.revenue || asinData.shippedRevenue)) || 0;
  const prixHTCogex = units > 0 ? Math.round((revenue / units / 1.2) * 100) / 100 : null;
  const openPOQ = parseNum((asinData && asinData.openPOQty) || 0);
  const cpct = parseNum(String((asinData && asinData.confirmPct) || '0').replace(',', '.').replace(/[^0-9.]/g, ''));
  const cas = bbGetCase(c, asin);
  if (cas) { cas.iaLoading = true; save(); render(); }
  const amazonUrl = 'https://www.amazon' + (market || '.fr') + '/dp/' + asin;
  const prixCtx = prixHTCogex
    ? ' Prix de vente moyen HT fournisseur = ' + prixHTCogex.toFixed(2) + ' EUR (' + units + ' unites a ' + (revenue/units).toFixed(2) + ' EUR TTC).'
    : '';
  const poCtx = openPOQ > 0 && cpct < 50
    ? ' PO ouvert de ' + openPOQ + ' unites avec confirmation = ' + cpct + '% : cela explique probablement la perte de Buy Box.'
    : '';
  const _bbModelKey = aiUsage.getModel('buybox');
  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      model: AI_MODELS[_bbModelKey].id,
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content:
        'Analyse cette fiche Amazon et réponds en JSON uniquement sans markdown : ' + amazonUrl +
        prixCtx + poCtx +
        ' Contexte important : ce produit appartient à un fournisseur Amazon Vendor (1P). Normalement Amazon détient la Buy Box. Si un vendeur tiers la détient, c\'est anormal et prioritaire.'
        + ' Analyse : 1) qui détient la Featured Offer, 2) est-ce Amazon ou un 3P, 3) si 3P : son prix vs prix fournisseur, 4) cause probable REELLE (stock vide ? 3P moins cher ? éligibilité ?)'
        + ' JSON avec ces champs : {"vendeurBB":"nom vendeur Featured Offer (Amazon ou nom 3P)","prixBB":"prix TTC affiché","isPrime":true/false,"estAmazon":true/false,"autresOffres":"autres vendeurs et prix","stockStatus":"En stock / Stock limité / Rupture","ecartPrix":"si fournisseur connu : écart % entre prix BB et prix fournisseur","causeProb":"cause réelle perte Buy Box en 1 phrase précise","actionReco":"action concrète recommandée en 1 phrase","urgence":"critique/moderee/faible"}'
      }]
    })
  })
  .then(r => r.json())
  .then(data => {
    const _bbTokIn = data.usage?.input_tokens || 0;
    const _bbTokOut = data.usage?.output_tokens || 0;
    if (typeof aiUsage !== 'undefined') aiUsage.record('buybox', _bbModelKey, _bbTokIn, _bbTokOut);
    const c2 = cl(); const cas2 = bbGetCase(c2, asin);
    if (!cas2) return;
    cas2.iaLoading = false;
    const tb = data.content && data.content.find(b => b.type === 'text');
    if (tb && tb.text) {
      try {
        const clean = tb.text.replace(/```json|```/g, '').trim();
        cas2.iaResult = JSON.parse(clean);
      } catch(e) {
        cas2.iaResult = { causeProb: tb.text.slice(0, 300), actionReco: 'Voir note' };
      }
    } else {
      cas2.iaResult = { causeProb: 'Analyse indisponible', actionReco: 'Verifier la connexion' };
    }
    save(); render();
    showToast('Analyse terminée', 'alr-g');
  })
  .catch(err => {
    const c2 = cl(); const cas2 = bbGetCase(c2, asin);
    if (cas2) { cas2.iaLoading = false; save(); render(); }
    showToast('Erreur IA : ' + err.message, 'alr-r');
  });
}

function downloadGuideASN() {
  if (typeof GUIDE_ASN_BOL_B64 === 'undefined' || !GUIDE_ASN_BOL_B64) {
    showToast('Guide non disponible', 'alr-r'); return;
  }
  const byteChars = atob(GUIDE_ASN_BOL_B64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  const blob = new Blob([byteArr], {type: 'application/pdf'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Guide_ASN_BOL_Amazon.pdf';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Guide téléchargé', 'alr-g');
}

function copyBuyBoxChromePrompt(asin, market) {
  const prompt = `Tu es un expert Amazon Vendor Central. Analyse la fiche produit ASIN ${asin} sur amazon${market||'.fr'} (https://www.amazon${market||'.fr'}/dp/${asin}).

Réponds précisément :
1. Qui détient la Featured Offer (Buy Box) ? Amazon ou un vendeur tiers ?
2. Si vendeur tiers : nom, prix total livré (produit + port), badge Prime ?
3. Autres offres visibles ("Voir toutes les offres") : combien, fourchette de prix ?
4. Le produit est-il "Expédié et vendu par Amazon" ?
5. Signes de rupture de stock (délai anormal, "En stock le...") ?
6. Y a-t-il des promotions ou coupons actifs sur la fiche ?

Synthèse : cause principale probable de la perte de Featured Offer, et action recommandée en 1 phrase.`;

  navigator.clipboard.writeText(prompt).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = prompt; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  });
  showToast('Prompt copié — ouvrez Amazon puis collez dans Claude in Chrome', 'alr-g');
}