// Amazon Pilot — src/render_screens.js
// Injecte via // @render_screens dans core.js (build.py)
// v3.7.5 — deplacement strict depuis core.js (aucune modification fonctionnelle)

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

function renderWelcome() {
  return `<div class="welcome-wrap">
    <div class="welcome-icon">🛒</div>
    <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Amazon Pilot <span id="ap-ver-welcome"></span></h1>
    <p style="color:var(--tx2);margin-bottom:24px;max-width:400px;line-height:1.7">Pilotez vos comptes Vendor Central avec l'IA. Import multi-périodes, diagnostic CA, revue hebdomadaire.</p>
    <button class="btn btn-p" style="padding:11px 22px;font-size:14px" onclick="startOnboarding()">+ Créer un client</button>
  </div>`;
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