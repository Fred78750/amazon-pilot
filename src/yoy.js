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

  const d  = a.dimensions || {};
  const t  = a.totals     || {};
  const pALabel   = a.periodA   && a.periodA.label   ? a.periodA.label   : '?';
  const pRefLabel = a.periodRef && a.periodRef.label ? a.periodRef.label : '?';
  const c = cl();
  const clientName = c ? c.name : '—';

  // ── Détermination du signe global (dim1.deltaCAPct)
  const deltaCAPct = d.dim1 ? d.dim1.deltaCAPct : null;
  const sign = yoyGetSign(deltaCAPct);
  const signColor = yoySignColor(sign);
  const vClass = sign === 'negative' ? 'neg' : sign === 'positive' ? 'pos' : '';

  // ── Point de vigilance : durées différentes
  const dA   = a.periodA   ? a.periodA.days   : null;
  const dRef = a.periodRef ? a.periodRef.days : null;
  const vigilanceBlock = (dA && dRef && Math.abs(dA - dRef) > 3)
    ? `<div class="yoy-vigilance">
        ⚠️ <strong>Vigilance :</strong> les deux périodes ont des durées différentes
        (${dA} j vs ${dRef} j). L'analyse utilise les valeurs par jour pour comparer.
       </div>`
    : '';

  // ── KPI 1 : CA delta annualisé
  const dim1 = d.dim1 || {};
  const deltaCAAnnu  = dim1.deltaCAAnnu  != null ? yoyFmtEurSigned(dim1.deltaCAAnnu)  : '—';
  const deltaCAPctFmt = dim1.deltaCAPct  != null ? yoyFmtPct(dim1.deltaCAPct, true)   : '—';
  const kpi1Class = dim1.deltaCAPct != null ? yoyDeltaClass(dim1.deltaCAPct) : 'muted';

  // ── KPI 2 : Catalogue (disparus / apparus)
  const dim7 = d.dim7 || {};
  const disparusN = dim7.disparus ? dim7.disparus.length : 0;
  const apparusN  = dim7.apparus  ? dim7.apparus.length  : 0;
  const kpi2Val   = disparusN > 0 || apparusN > 0
    ? `<span style="color:var(--r)">-${disparusN}</span> / <span style="color:var(--g)">+${apparusN}</span>`
    : '—';

  // ── KPI 3 : Marge Amazon Retail
  const dim4 = d.dim4 || {};
  const deltaTauxMarge = dim4.deltaTauxMarge != null ? yoyFmtPts(dim4.deltaTauxMarge) : '—';
  const kpi3Class = dim4.deltaTauxMarge != null ? yoyDeltaClass(dim4.deltaTauxMarge) : 'muted';

  // ── KPI 4 : Pro stub
  const kpi4 = `<span style="opacity:.45;font-size:11px">disponible en mode Pro</span>`;

  // ── Section 1 : Performance volume / prix (dim1-3)
  const dim2 = d.dim2 || {};
  const dim3 = d.dim3 || {};
  const s1Title = YOY_TITLES.s1[sign];
  const s1Table = `<table class="yoy-table">
    <thead><tr><th>Indicateur</th><th>Période A</th><th>Réf</th><th>Variation</th></tr></thead>
    <tbody>
      <tr><td>CA cmd (annualisé)</td>
          <td class="num">${dim1.caAProj != null ? yoyFmtEur(dim1.caAProj) : '—'}</td>
          <td class="num">${dim1.caRef   != null ? yoyFmtEur(dim1.caRef * (365 / (dRef||365))) : '—'}</td>
          <td class="num ${kpi1Class}">${deltaCAPctFmt}</td></tr>
      <tr><td>Unités cmd (annualisées)</td>
          <td class="num">${dim2.uAProj != null ? yoyFmtNum(dim2.uAProj) : '—'}</td>
          <td class="num">${dim2.uRef   != null ? yoyFmtNum(dim2.uRef * (365 / (dRef||365))) : '—'}</td>
          <td class="num ${dim2.deltaUPct != null ? yoyDeltaClass(dim2.deltaUPct) : 'muted'}">${dim2.deltaUPct != null ? yoyFmtPct(dim2.deltaUPct, true) : '—'}</td></tr>
      <tr><td>Prix moyen de vente</td>
          <td class="num">${dim3.pmvA   != null ? yoyFmtEur(dim3.pmvA)   : '—'}</td>
          <td class="num">${dim3.pmvRef != null ? yoyFmtEur(dim3.pmvRef) : '—'}</td>
          <td class="num ${dim3.deltaPMVPct != null ? yoyDeltaClass(dim3.deltaPMVPct) : 'muted'}">${dim3.deltaPMVPct != null ? yoyFmtPct(dim3.deltaPMVPct, true) : '—'}</td></tr>
    </tbody>
  </table>`;
  const s1Lecture = `<div class="yoy-section-lecture">Lecture</div>${tplPerformance(d, sign)}`;
  const s1Verdict = `<div class="verdict-block ${vClass}">
    <strong>Conclusion section :</strong>
    ${dim1.deltaCAPct != null
      ? (sign === 'negative'
          ? `Le chiffre d'affaires recule de <strong>${yoyFmtPct(dim1.deltaCAPct, true)}</strong> en rythme annualisé (${deltaCAAnnu}/an).`
          : sign === 'positive'
          ? `Le chiffre d'affaires progresse de <strong>${yoyFmtPct(dim1.deltaCAPct, true)}</strong> en rythme annualisé (${deltaCAAnnu}/an).`
          : `Le chiffre d'affaires est stable sur la période (${yoyFmtPct(dim1.deltaCAPct, true)}).`)
      : 'Données insuffisantes.'}
  </div>`;

  // ── Section 2 : Dynamique catalogue / buckets ASIN (dim7 + dim8)
  const dim8 = d.dim8 || {};
  const s2Title = YOY_TITLES.s2[sign];
  const buckets = [
    { label: 'Stables (±20%)',  n: dim7.stables  != null ? dim7.stables  : '—', cls: 'muted' },
    { label: 'En hausse (>+20%)', n: dim7.enHausse != null ? dim7.enHausse : '—', cls: 'pos'  },
    { label: 'En baisse (<-20%)', n: dim7.enBaisse != null ? dim7.enBaisse : '—', cls: 'neg'  },
    { label: 'Apparus',          n: apparusN,  cls: 'pos'  },
    { label: 'Disparus',         n: disparusN, cls: 'neg'  },
  ];
  const zombiesN = dim8.zombies ? dim8.zombies.length : 0;
  const s2Table = `<table class="yoy-table">
    <thead><tr><th>Bucket</th><th class="num">ASINs</th><th class="num">CA Réf / j</th></tr></thead>
    <tbody>
      ${buckets.map(b => `<tr><td>${b.label}</td><td class="num ${b.cls}">${typeof b.n === 'number' ? b.n : b.n}</td><td class="num muted">—</td></tr>`).join('')}
      <tr style="border-top:1px solid var(--bd2)"><td>🧟 Zombies (1–3 ventes/an)</td><td class="num neg">${zombiesN}</td><td class="num neg">${dim8.caPerduTotal != null ? yoyFmtEur(dim8.caPerduTotal / Math.max(dRef||1,1)) : '—'}</td></tr>
    </tbody>
  </table>`;
  const s2Lecture = `<div class="yoy-section-lecture">Lecture</div>${tplCatalogue(d, sign)}`;
  const s2Verdict = `<div class="verdict-block ${vClass}">
    <strong>Conclusion section :</strong>
    ${disparusN > 0
      ? `<strong>${disparusN} ASIN(s)</strong> présents en période Réf ont disparu en période A${dim8.caPerduTotal != null ? ', représentant ' + yoyFmtEur(dim8.caPerduTotal) + ' de CA Réf perdu' : ''}.`
      : `Aucun ASIN disparu entre les deux périodes.`}
  </div>`;

  // ── Section 3 : Concentration portefeuille (dim9)
  const dim9 = d.dim9 || {};
  const s3Title = YOY_TITLES.s3[sign];
  const concRows = [10, 20, 50, 100].map(n => {
    const vA   = dim9.concA   && dim9.concA['top'+n]   != null ? yoyFmtPct(dim9.concA['top'+n])   : '—';
    const vRef = dim9.concRef && dim9.concRef['top'+n] != null ? yoyFmtPct(dim9.concRef['top'+n]) : '—';
    const delta = dim9.concA && dim9.concRef && dim9.concA['top'+n] != null && dim9.concRef['top'+n] != null
      ? yoyFmtPts(dim9.concA['top'+n] - dim9.concRef['top'+n]) : '—';
    const deltaClass = dim9.concA && dim9.concRef && dim9.concA['top'+n] != null
      ? yoyDeltaClass(dim9.concA['top'+n] - dim9.concRef['top'+n]) : 'muted';
    return `<tr><td>Top ${n} ASINs</td><td class="num">${vA}</td><td class="num">${vRef}</td><td class="num ${deltaClass}">${delta}</td></tr>`;
  }).join('');
  const s3Table = `<table class="yoy-table">
    <thead><tr><th>Concentration</th><th>Période A</th><th>Réf</th><th>Évolution</th></tr></thead>
    <tbody>${concRows}</tbody>
  </table>`;
  const s3Lecture = `<div class="yoy-section-lecture">Lecture</div>${tplConcentration(d, sign)}`;
  const s3Verdict = `<div class="verdict-block ${vClass}">
    <strong>Conclusion section :</strong>
    ${dim9.concA && dim9.concRef && dim9.concA.top10 != null
      ? `Les 10 premiers ASINs représentent <strong>${yoyFmtPct(dim9.concA.top10)}</strong> du CA en période A vs ${yoyFmtPct(dim9.concRef.top10)} en Réf.`
      : 'Données insuffisantes.'}
  </div>`;

  // ── Section 4 : Dynamique marques (dim10)
  const dim10 = d.dim10 || {};
  const s4Title = YOY_TITLES.s4[sign];
  const topBrands = dim10.topBrands || [];
  const s4Rows = topBrands.slice(0, 10).map(b => {
    const dClass = yoyDeltaClass(b.delta || 0);
    return `<tr><td>${esc(b.marque || '—')}</td>
      <td class="num">${b.caAPerDay != null ? yoyFmtEur(b.caAPerDay) : '—'}</td>
      <td class="num">${b.caRefPerDay != null ? yoyFmtEur(b.caRefPerDay) : '—'}</td>
      <td class="num ${dClass}">${b.delta != null ? yoyFmtPct(b.delta, true) : '—'}</td></tr>`;
  }).join('') || `<tr><td colspan="4" class="muted" style="text-align:center">Données insuffisantes</td></tr>`;
  const s4Table = `<table class="yoy-table">
    <thead><tr><th>Marque</th><th>CA/j Période A</th><th>CA/j Réf</th><th>Δ</th></tr></thead>
    <tbody>${s4Rows}</tbody>
  </table>`;
  const s4Lecture = `<div class="yoy-section-lecture">Lecture</div>${tplMarques(d, sign)}`;
  const s4Verdict = `<div class="verdict-block ${vClass}">
    <strong>Conclusion section :</strong>
    ${topBrands.length > 0
      ? `${topBrands.length} marque(s) analysée(s). La marque la plus importante est <strong>${esc(topBrands[0].marque || '—')}</strong>.`
      : 'Données insuffisantes.'}
  </div>`;

  // ── Section 5 : Top mouvements ASIN (dim11)
  const dim11 = d.dim11 || {};
  const s5Title = YOY_TITLES.s5[sign];
  const perdants  = dim11.perdants  || [];
  const gagnants  = dim11.gagnants  || [];
  const buildMvtRows = (list, cls) => list.slice(0, 8).map(r =>
    `<tr><td style="font-family:monospace;font-size:11px">${esc(r.asin||'—')}</td>
      <td style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.titre||'—')}</td>
      <td class="num">${r.caRefPerDay != null ? yoyFmtEur(r.caRefPerDay) : '—'}</td>
      <td class="num">${r.caAPerDay  != null ? yoyFmtEur(r.caAPerDay)  : '—'}</td>
      <td class="num ${cls}">${r.deltaCA != null ? yoyFmtEurSigned(r.deltaCA) : '—'}</td></tr>`
  ).join('') || `<tr><td colspan="5" class="muted" style="text-align:center">—</td></tr>`;
  const s5Table = `
    <div style="font-size:11px;font-weight:600;color:var(--r);margin-bottom:4px">▼ Principaux perdants</div>
    <table class="yoy-table" style="margin-bottom:16px">
      <thead><tr><th>ASIN</th><th>Produit</th><th>CA Réf/j</th><th>CA A/j</th><th>Δ CA annualisé</th></tr></thead>
      <tbody>${buildMvtRows(perdants, 'neg')}</tbody>
    </table>
    <div style="font-size:11px;font-weight:600;color:var(--g);margin-bottom:4px">▲ Principaux gagnants</div>
    <table class="yoy-table">
      <thead><tr><th>ASIN</th><th>Produit</th><th>CA Réf/j</th><th>CA A/j</th><th>Δ CA annualisé</th></tr></thead>
      <tbody>${buildMvtRows(gagnants, 'pos')}</tbody>
    </table>`;
  const s5Lecture = `<div class="yoy-section-lecture">Lecture</div>${tplTopMouvements(d, sign)}`;
  const s5Verdict = `<div class="verdict-block ${vClass}">
    <strong>Conclusion section :</strong>
    ${perdants.length > 0
      ? `Les <strong>${Math.min(perdants.length, 15)}</strong> principaux perdants concentrent l'essentiel de la variation négative.`
      : 'Pas de perdants significatifs identifiés.'}
  </div>`;

  // ── Section 6 : Anomalies catalogue (dim12)
  const dim12 = d.dim12 || {};
  const s6Title = YOY_TITLES.s6[sign];
  const anomPairs = dim12.anomPairs || [];
  const s6Rows = anomPairs.slice(0, 10).map(p =>
    `<tr><td>${esc(p.marque1||'—')}</td><td>${esc(p.marque2||'—')}</td>
      <td class="num">${p.similarity != null ? yoyFmtPct(p.similarity * 100) : '—'}</td>
      <td class="num muted">${p.caTot != null ? yoyFmtEur(p.caTot) : '—'}</td></tr>`
  ).join('') || `<tr><td colspan="4" class="muted" style="text-align:center">Aucune anomalie détectée</td></tr>`;
  const s6Table = `<table class="yoy-table">
    <thead><tr><th>Marque 1</th><th>Marque 2</th><th>Similarité</th><th>CA combiné</th></tr></thead>
    <tbody>${s6Rows}</tbody>
  </table>`;
  const s6Lecture = `<div class="yoy-section-lecture">Lecture</div>${tplAnomalies(d, sign)}`;
  const s6Verdict = `<div class="verdict-block ${vClass}">
    <strong>Conclusion section :</strong>
    ${anomPairs.length > 0
      ? `<strong>${anomPairs.length}</strong> doublon(s) orthographique(s) potentiel(s) détecté(s) dans le catalogue.`
      : 'Aucun doublon orthographique détecté dans le catalogue.'}
  </div>`;

  // ── Helper : build section HTML
  function sec(id, title, tableHtml, lectureHtml, verdictHtml) {
    return `<div class="yoy-section" id="yoy-sec-${id}">
      <div class="yoy-section-header">
        <h3 class="yoy-section-title">${title}</h3>
      </div>
      ${tableHtml}
      ${lectureHtml}
      ${verdictHtml}
    </div>`;
  }

  // ── Conclusion
  const concluHtml = `<div class="yoy-section" id="yoy-sec-conclusion" style="margin-top:8px">
    <div class="yoy-section-header">
      <h3 class="yoy-section-title">Conclusion générale</h3>
    </div>
    ${tplConclusion(d, sign)}
  </div>`;

  return `<div style="max-width:960px;margin:0 auto;padding:24px 20px" class="yoy-result-root">

    <!-- En-tête -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div>
        <h2 style="font-size:19px;font-weight:700;margin-bottom:4px">Analyse comparée — ${esc(clientName)}</h2>
        <div style="font-size:12px;color:var(--tx2)">${esc(pALabel)} <span style="color:var(--tx3)">vs</span> ${esc(pRefLabel)}</div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        <button class="btn btn-sm" onclick="yoyBack()">← Modifier les imports</button>
        <button class="btn btn-sm" onclick="window.print()">🖨 Imprimer</button>
      </div>
    </div>

    ${vigilanceBlock}

    <!-- 4 KPI cards -->
    <div class="yoy-kpi-grid" style="margin-bottom:24px">
      <div class="yoy-kpi-card">
        <div class="yoy-kpi-label">CA annualisé</div>
        <div class="yoy-kpi-value ${kpi1Class}">${deltaCAPctFmt}</div>
        <div class="yoy-kpi-sub">${deltaCAAnnu} / an</div>
      </div>
      <div class="yoy-kpi-card">
        <div class="yoy-kpi-label">Mouvement catalogue</div>
        <div class="yoy-kpi-value">${kpi2Val}</div>
        <div class="yoy-kpi-sub">disparus / apparus</div>
      </div>
      <div class="yoy-kpi-card">
        <div class="yoy-kpi-label">Marge Amazon Retail</div>
        <div class="yoy-kpi-value ${kpi3Class}">${deltaTauxMarge}</div>
        <div class="yoy-kpi-sub">Δ taux marge</div>
      </div>
      <div class="yoy-kpi-card pro-only-pending">
        <div class="yoy-kpi-label">Diagnostic IA</div>
        <div class="yoy-kpi-value" style="font-size:13px">${kpi4}</div>
        <div class="yoy-kpi-sub">cause principale</div>
      </div>
    </div>

    <!-- 6 sections analytiques -->
    ${sec('s1', s1Title, s1Table, s1Lecture, s1Verdict)}
    ${sec('s2', s2Title, s2Table, s2Lecture, s2Verdict)}
    ${sec('s3', s3Title, s3Table, s3Lecture, s3Verdict)}
    ${sec('s4', s4Title, s4Table, s4Lecture, s4Verdict)}
    ${sec('s5', s5Title, s5Table, s5Lecture, s5Verdict)}
    ${sec('s6', s6Title, s6Table, s6Lecture, s6Verdict)}

    ${concluHtml}

    <!-- Footer print -->
    <div class="yoy-print-footer">
      Analyse générée par Amazon Pilot · ${esc(clientName)} · ${esc(pALabel)} vs ${esc(pRefLabel)}
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
 * En cas d'échec, expose les en-têtes détectés pour faciliter le debug
 */
function yoyValidateHeaders(headerMap, rawHeadersForDebug) {
  var required = ['asin', 'ca_cmd', 'u_cmd', 'ca_exp', 'cogs', 'u_exp'];
  var found = Object.values(headerMap);
  var missing = required.filter(function(k) { return found.indexOf(k) < 0; });
  if (missing.length > 0) {
    var detectedKeys = (rawHeadersForDebug || []).filter(Boolean).slice(0, 8).join(' | ') || '(aucune)';
    throw new Error(
      'Colonnes manquantes : ' + missing.join(', ') + '. ' +
      'En-têtes détectés dans le fichier : ' + detectedKeys
    );
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

      // ── Détection ligne d'en-tête ──────────────────────────────────────────
      // Stratégie : trouver la ligne avec le plus grand nombre de colonnes
      // reconnues dans YOY_COL_MAP (robuste aux métadonnées, lignes vides, merges)
      var headerRowIdx = -1;
      var headerRowScore = 0;

      // Pré-calculer une version normalisée de YOY_COL_MAP pour le scoring
      var _colMapNorm = {};
      for (var _k in YOY_COL_MAP) { _colMapNorm[yoyNormalizeHeader(_k)] = true; }

      for (var i = 0; i < Math.min(10, raw.length); i++) {
        var rowCells = raw[i] || [];
        var score = 0;
        for (var ci = 0; ci < rowCells.length; ci++) {
          var cell = yoyNormalizeHeader(String(rowCells[ci] || ''));
          if (_colMapNorm[cell]) score++;
        }
        if (score > headerRowScore) {
          headerRowScore = score;
          headerRowIdx = i;
        }
      }

      // Debug : logger les 3 premières lignes brutes pour aide au diagnostic
      console.log('[YoY XLSX] headerRowIdx=' + headerRowIdx + ' score=' + headerRowScore);
      for (var di = 0; di < Math.min(3, raw.length); di++) {
        console.log('[YoY XLSX] row[' + di + '] :', JSON.stringify((raw[di]||[]).slice(0,6)));
      }

      if (headerRowIdx < 0 || headerRowScore === 0) {
        return reject(new Error(
          'Aucune colonne Vendor Central reconnue dans le fichier XLSX. ' +
          'Vérifiez que c\'est bien un export "Ventes par ASIN — Fabrication". ' +
          'Première ligne lue : ' + JSON.stringify((raw[0]||[]).slice(0,5))
        ));
      }

      var rawHeaders = raw[headerRowIdx].map(function(h) { return String(h || '').trim(); });
      var headers    = rawHeaders.map(function(h) { return yoyNormalizeHeader(h); });
      console.log('[YoY XLSX] headers normalisés :', JSON.stringify(headers.slice(0, 12)));

      var headerMap = yoyBuildHeaderMap(headers);
      console.log('[YoY XLSX] headerMap :', JSON.stringify(headerMap));
      try { yoyValidateHeaders(headerMap, rawHeaders); } catch(e) { return reject(e); }

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

    // Étape 2 : Calcul des 12 dimensions
    yoyState.progress = { phase: 'Calcul des 12 dimensions…', pct: 65 };
    render();
    await yoySleep(300);

    const dimensions = yoyComputeDimensions(pA.rows, pRef.rows, pA.meta, pRef.meta);

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
        parserVersion: 'yoy-v3.6.5-cp2',
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
// CP2 — HELPERS FORMAT / SIGNE
// ═══════════════════════════════════════════════════════════════

function yoyGetSign(deltaPct) {
  if (deltaPct < -YOY_THRESHOLD_PCT) return 'negative';
  if (deltaPct > +YOY_THRESHOLD_PCT) return 'positive';
  return 'stable';
}

function yoyFmtPct(v, forceSign) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  var s = Math.abs(v).toFixed(1).replace('.', ',') + ' %';
  if (forceSign || v !== 0) s = (v >= 0 ? '+' : '−') + s;
  return s;
}

function yoyFmtPts(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  var s = Math.abs(v).toFixed(1).replace('.', ',') + ' pts';
  return (v >= 0 ? '+' : '−') + s;
}

function yoyFmtEurSigned(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return (v >= 0 ? '+' : '−') + yoyFmtEur(Math.abs(v));
}

function yoyFmtNum(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Math.round(Math.abs(v)).toLocaleString('fr-FR');
}

function yoyDeltaClass(v) { return v > 0.5 ? 'pos' : v < -0.5 ? 'neg' : 'muted'; }

function yoySignColor(sign) {
  return sign === 'negative' ? 'var(--r)' : sign === 'positive' ? 'var(--g)' : 'var(--tx2)';
}

// ─── Levenshtein pour dim 12 ────────────────────────────────────
function yoyLevenshtein(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a === b) return 0;
  var m = a.length, n = b.length;
  if (m === 0) return n; if (n === 0) return m;
  var prev = [], cur = [];
  for (var j = 0; j <= n; j++) prev[j] = j;
  for (var i = 1; i <= m; i++) {
    cur[0] = i;
    for (var j2 = 1; j2 <= n; j2++) {
      cur[j2] = a[i-1] === b[j2-1] ? prev[j2-1] : 1 + Math.min(prev[j2], cur[j2-1], prev[j2-1]);
    }
    prev = cur.slice();
  }
  return prev[n];
}
function yoySimilarity(a, b) {
  var mx = Math.max(a.length, b.length);
  return mx === 0 ? 1 : 1 - yoyLevenshtein(a, b) / mx;
}

// ═══════════════════════════════════════════════════════════════
// CP2 — CALCUL 12 DIMENSIONS
// ═══════════════════════════════════════════════════════════════

function yoyComputeDimensions(rowsA, rowsRef, metaA, metaRef) {
  var dA   = metaA.days  || 1;
  var dRef = metaRef.days || 1;
  var sum  = function(rows, key) { return rows.reduce(function(s,r) { return s + (r[key]||0); }, 0); };

  // Maps ASIN → row
  var mapA = {}, mapRef = {};
  rowsA.forEach(function(r)   { if (r.asin) mapA[r.asin]   = r; });
  rowsRef.forEach(function(r) { if (r.asin) mapRef[r.asin] = r; });
  var allAsins = Object.keys(Object.assign({}, mapA, mapRef));

  // ── Dim 1 — CA YoY ──────────────────────────────────────────
  var caA         = sum(rowsA,   'ca_cmd');
  var caRef       = sum(rowsRef, 'ca_cmd');
  var caAPerDay   = caA   / dA;
  var caRefPerDay = caRef / dRef;
  var caAProj     = caAPerDay * dRef;
  var deltaCA     = caAProj - caRef;
  var deltaCAPct  = caRef > 0 ? deltaCA / caRef * 100 : 0;
  var deltaCAAnnu = (caAPerDay - caRefPerDay) * 365;

  // ── Dim 2 — Unités YoY ──────────────────────────────────────
  var uA         = sum(rowsA,   'u_cmd');
  var uRef       = sum(rowsRef, 'u_cmd');
  var uAPerDay   = uA   / dA;
  var uRefPerDay = uRef / dRef;
  var uAProj     = uAPerDay * dRef;
  var deltaU     = uAProj - uRef;
  var deltaUPct  = uRef > 0 ? deltaU / uRef * 100 : 0;
  var deltaUAnnu = (uAPerDay - uRefPerDay) * 365;

  // ── Dim 3 — PMV ─────────────────────────────────────────────
  var pmvA       = uA   > 0 ? caA   / uA   : 0;
  var pmvRef     = uRef > 0 ? caRef / uRef : 0;
  var deltaPMV   = pmvA - pmvRef;
  var deltaPMVPct = pmvRef > 0 ? deltaPMV / pmvRef * 100 : 0;

  // ── Dim 4 — Marge Amazon Retail ─────────────────────────────
  var caExpA      = sum(rowsA,   'ca_exp');
  var caExpRef    = sum(rowsRef, 'ca_exp');
  var cogsA       = sum(rowsA,   'cogs');
  var cogsRef     = sum(rowsRef, 'cogs');
  var margeA      = caExpA   - cogsA;
  var margeRef    = caExpRef - cogsRef;
  var tauxMargeA  = caExpA   > 0 ? margeA   / caExpA   * 100 : 0;
  var tauxMargeRef = caExpRef > 0 ? margeRef / caExpRef * 100 : 0;
  var deltaTauxMarge = tauxMargeA - tauxMargeRef;

  // ── Dim 5 — Taux retours ────────────────────────────────────
  var retoursA    = sum(rowsA,   'retours');
  var retoursRef  = sum(rowsRef, 'retours');
  var tauxRetA    = uA   > 0 ? retoursA   / uA   * 100 : 0;
  var tauxRetRef  = uRef > 0 ? retoursRef / uRef * 100 : 0;
  var deltaTauxRet = tauxRetA - tauxRetRef;

  // ── Dim 6 — Ratio exp/cmd ───────────────────────────────────
  var uExpA       = sum(rowsA,   'u_exp');
  var uExpRef     = sum(rowsRef, 'u_exp');
  var ratioCAA    = caA   > 0 ? caExpA   / caA   * 100 : 0;
  var ratioCARef  = caRef > 0 ? caExpRef / caRef * 100 : 0;
  var ratioUA     = uA   > 0 ? uExpA   / uA   * 100 : 0;
  var ratioURef   = uRef > 0 ? uExpRef / uRef * 100 : 0;

  // ── Dim 7 — Croisement ASIN (5 buckets) ─────────────────────
  var bStables = [], bBaisse = [], bHausse = [], bDisparus = [], bApparus = [];
  allAsins.forEach(function(asin) {
    var rA   = mapA[asin];
    var rRef = mapRef[asin];
    var caAd   = rA   ? (rA.ca_cmd   || 0) / dA   : 0;
    var caRefd = rRef ? (rRef.ca_cmd || 0) / dRef : 0;
    var inA    = rA   && (rA.ca_cmd   || 0) > 0;
    var inRef  = rRef && (rRef.ca_cmd || 0) > 0;
    var titre  = (rA || rRef || {}).titre  || '';
    var marque = (rA || rRef || {}).marque || '';
    var item = { asin: asin, titre: titre, marque: marque, caAPerDay: caAd, caRefPerDay: caRefd };
    if (!inRef && inA)       { bApparus.push(item); }
    else if (inRef && !inA)  { bDisparus.push(item); }
    else if (inRef && inA)   {
      var pct = caRefd > 0 ? (caAd - caRefd) / caRefd * 100 : 0;
      item.deltaPct = pct;
      if (pct < -10) bBaisse.push(item);
      else if (pct > +10) bHausse.push(item);
      else bStables.push(item);
    }
  });
  var sumCARef = function(b) { return b.reduce(function(s,r){ return s+r.caRefPerDay; },0); };
  var sumCAA   = function(b) { return b.reduce(function(s,r){ return s+r.caAPerDay;  },0); };
  bDisparus.sort(function(a,b){ return b.caRefPerDay - a.caRefPerDay; });
  bApparus.sort(function(a,b){  return b.caAPerDay   - a.caAPerDay;   });

  // ── Dim 8 — Zombies ─────────────────────────────────────────
  var zombies = allAsins.reduce(function(acc, asin) {
    var rA = mapA[asin], rRef = mapRef[asin];
    if (!rA || !rRef) return acc;
    if ((rRef.ca_cmd||0) > 100 && (rA.ca_cmd||0) < 5)
      acc.push({ asin: asin, titre: rRef.titre || '', marque: rRef.marque || '', caRef: rRef.ca_cmd||0, caA: rA.ca_cmd||0 });
    return acc;
  }, []);
  zombies.sort(function(a,b){ return b.caRef - a.caRef; });

  // ── Dim 9 — Concentration ────────────────────────────────────
  var sortedA   = rowsA.slice().sort(function(a,b){ return (b.ca_cmd||0)-(a.ca_cmd||0); });
  var sortedRef = rowsRef.slice().sort(function(a,b){ return (b.ca_cmd||0)-(a.ca_cmd||0); });
  var topShare = function(sorted, n, total) {
    if (total <= 0) return 0;
    return sorted.slice(0,n).reduce(function(s,r){ return s+(r.ca_cmd||0); },0) / total * 100;
  };

  // ── Dim 10 — Marques ─────────────────────────────────────────
  var bMapRef = {}, bMapA = {};
  rowsRef.forEach(function(r){ var m=(r.marque||'Inconnue').trim(); bMapRef[m]=(bMapRef[m]||0)+(r.ca_cmd||0)/dRef; });
  rowsA.forEach(function(r){   var m=(r.marque||'Inconnue').trim(); bMapA[m]  =(bMapA[m]  ||0)+(r.ca_cmd||0)/dA;  });
  var topBrands = Object.keys(bMapRef)
    .sort(function(a,b){ return bMapRef[b]-bMapRef[a]; }).slice(0,10)
    .map(function(m){ return { marque:m, caRefPerDay:bMapRef[m]||0, caAPerDay:bMapA[m]||0, shareRef:caRefPerDay>0?bMapRef[m]/caRefPerDay*100:0, shareA:caAPerDay>0?(bMapA[m]||0)/caAPerDay*100:0, delta:(bMapA[m]||0)-(bMapRef[m]||0) }; });

  // ── Dim 11 — Top gagnants / perdants ─────────────────────────
  var llList = allAsins.filter(function(a){ return mapA[a]&&mapRef[a]&&(mapA[a].ca_cmd||0)>0&&(mapRef[a].ca_cmd||0)>0; })
    .map(function(asin){
      var rA=mapA[asin],rRef=mapRef[asin];
      var caAd=(rA.ca_cmd||0)/dA, caRefd=(rRef.ca_cmd||0)/dRef;
      var delta=caAd-caRefd, pct=caRefd>0?delta/caRefd*100:0;
      return { asin:asin, titre:rA.titre||rRef.titre||'', marque:rRef.marque||'', caAPerDay:caAd, caRefPerDay:caRefd, deltaPerDay:delta, deltaPct:pct };
    });
  var perdants = llList.slice().sort(function(a,b){ return a.deltaPerDay-b.deltaPerDay; }).slice(0,15);
  var gagnants = llList.slice().sort(function(a,b){ return b.deltaPerDay-a.deltaPerDay; }).slice(0,15);

  // ── Dim 12 — Anomalies catalogue ─────────────────────────────
  var allBrandNames = Object.keys(Object.assign({},bMapRef,bMapA)).filter(function(m){ return m&&m!=='Inconnue'; });
  var anomPairs = [];
  for (var bi=0; bi<allBrandNames.length; bi++) {
    for (var bj=bi+1; bj<allBrandNames.length; bj++) {
      var ma=allBrandNames[bi], mb=allBrandNames[bj];
      if (Math.abs(ma.length-mb.length)>6) continue;
      var sim=yoySimilarity(ma,mb);
      if (sim>0.75&&sim<1) anomPairs.push({ marque1:ma, marque2:mb, similarity:sim, caTot:(bMapRef[ma]||0)+(bMapRef[mb]||0)+(bMapA[ma]||0)+(bMapA[mb]||0) });
    }
  }
  anomPairs.sort(function(a,b){ return b.similarity-a.similarity; });

  return {
    dim1:  { caA, caRef, caAPerDay, caRefPerDay, caAProj, deltaCA, deltaCAPct, deltaCAAnnu, dA, dRef },
    dim2:  { uA, uRef, uAPerDay, uRefPerDay, uAProj, deltaU, deltaUPct, deltaUAnnu },
    dim3:  { pmvA, pmvRef, deltaPMV, deltaPMVPct },
    dim4:  { caExpA, caExpRef, cogsA, cogsRef, margeA, margeRef, tauxMargeA, tauxMargeRef, deltaTauxMarge },
    dim5:  { retoursA, retoursRef, tauxRetA, tauxRetRef, deltaTauxRet },
    dim6:  { ratioCAA, ratioCARef, ratioUA, ratioURef },
    dim7:  { stables:bStables, enBaisse:bBaisse, enHausse:bHausse, disparus:bDisparus, apparus:bApparus,
             sumStablesRef:sumCARef(bStables), sumStablesA:sumCAA(bStables),
             sumBaisseRef:sumCARef(bBaisse),   sumBaisseA:sumCAA(bBaisse),
             sumHausseRef:sumCARef(bHausse),   sumHausseA:sumCAA(bHausse),
             sumDisparusRef:sumCARef(bDisparus), sumApparusA:sumCAA(bApparus) },
    dim8:  { zombies, count:zombies.length, caPerduTotal:zombies.reduce(function(s,z){return s+z.caRef;},0) },
    dim9:  { concA:{ top10:topShare(sortedA,10,caA), top20:topShare(sortedA,20,caA), top50:topShare(sortedA,50,caA), top100:topShare(sortedA,100,caA) },
             concRef:{ top10:topShare(sortedRef,10,caRef), top20:topShare(sortedRef,20,caRef), top50:topShare(sortedRef,50,caRef), top100:topShare(sortedRef,100,caRef) } },
    dim10: { topBrands },
    dim11: { perdants, gagnants },
    dim12: { anomPairs },
  };
}

// ═══════════════════════════════════════════════════════════════
// CP2 — TITRES ADAPTATIFS (§6.3)
// ═══════════════════════════════════════════════════════════════

var YOY_TITLES = {
  s1: { negative:'Le recul est essentiellement un recul de volume, pas de prix', positive:'La progression vient surtout du volume, avec un prix moyen stable', stable:'Performance stable, mix prix légèrement modifié' },
  s2: { negative:'La baisse vient du périmètre ASIN, pas des ASINs encore actifs', positive:'La progression est portée par les ASINs déjà présents qui accélèrent', stable:'Catalogue actif stable en volume et profondeur' },
  s3: { negative:'Le portefeuille devient plus fragile : la concentration s\'accentue', positive:'La progression renforce la dépendance aux best-sellers', stable:'Concentration stable, queue longue préservée' },
  s4: { negative:'Le recul est multi-marques, avec quelques exceptions à protéger', positive:'Plusieurs marques tirent la croissance', stable:'Mix marques équilibré, à surveiller marque par marque' },
  s5: { negative:'Top mouvements ASIN — qui pèse vraiment dans la variation', positive:'Top mouvements ASIN — qui pèse vraiment dans la variation', stable:'Top mouvements ASIN — qui pèse vraiment dans la variation' },
  s6: { negative:'Doublons orthographiques détectés dans le catalogue', positive:'Doublons orthographiques détectés dans le catalogue', stable:'Vérification des doublons orthographiques du catalogue' },
};

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
