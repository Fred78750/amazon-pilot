// Amazon Pilot — Smoke Test (v3.6.6.1)
// V9 conditionnel par client + collecte historique smoke_history (IDB v5)

// ─────────────────────────────────────────────────────────────────────────
// SMOKE_REF : valeurs globales de référence (rétro-compatibilité tests V4)
// ─────────────────────────────────────────────────────────────────────────
const SMOKE_REF = {
  ca2024:  { val: 1547729, tol: 0.02, expiry: '2026-12-31', label: 'CA 2024' }, // recalibré 2026-05-18 après reimport Cogex
  ca2025:  { val: 1166183, tol: 0.02, expiry: '2027-12-31', label: 'CA 2025' }, // recalibré 2026-05-18 après reimport Cogex
  asinMin: { val: 1500,               expiry: null,          label: 'ASINs catalogue >= 1500' },
  asinRef: { asin: 'B009G3EMDI', label: 'ASIN B009G3EMDI cohérence pipeline' }
};

// ─────────────────────────────────────────────────────────────────────────
// SMOKE_REF_BY_CLIENT : calibration par client
// Clients absents → V9 silencieux (info console + skip, pas d'alerte rouge)
// Calibration future via accumulation historique smoke_history (~6 mois min)
// ─────────────────────────────────────────────────────────────────────────
const SMOKE_REF_BY_CLIENT = {
  'cogex': {
    CA_2024:  { value: 1547729, tolerance: 0.02, expiry: '2026-12-31', label: 'CA 2024' },
    CA_2025:  { value: 1166183, tolerance: 0.02, expiry: '2027-12-31', label: 'CA 2025' },
    asinMin:  { value: 1500,  label: 'ASINs catalogue >= 1500' },
    asinRef:  { asin: 'B009G3EMDI', label: 'ASIN réf. B009G3EMDI' },
  },
  // Gers, autres clients : calibration à venir après 6+ mois d'historique
};

async function smokeTest(silent) {
  const now = new Date();
  const results = { vital: [], important: [], ts: now.toISOString(), version: APP_VERSION };
  const pass = (lvl, id, lbl) => results[lvl].push({ id, label: lbl, ok: true });
  const fail = (lvl, id, lbl, msg) => results[lvl].push({ id, label: lbl, ok: false, msg });
  const refExpiredByDate = (expiry) => expiry && new Date(expiry) < now;
  const inTol = (v, ref, tol) => v >= ref * (1-tol) && v <= ref * (1+tol);
  const getErr = () => { const e = document.querySelector('.alr-r'); return e && e.textContent.includes('Erreur') ? e.textContent.slice(0,80) : null; };

  // V1 — Client actif
  const c = typeof cl === 'function' ? cl() : null;
  // Calibration client : lookup SMOKE_REF_BY_CLIENT par c.id (lowercase)
  const clientId  = c?.id ? String(c.id).toLowerCase().trim() : null;
  const clientCal = clientId ? (SMOKE_REF_BY_CLIENT[clientId] || null) : null;
  // Seuil ASINs : calibré si connu, sinon 1 ASIN minimum
  const asinMinReq = clientCal?.asinMin?.value || 1;
  if (c && c.name && c.asins && c.asins.length >= asinMinReq)
    pass('vital','V1', 'Client actif : ' + c.name + ' (' + c.asins.length + ' ASINs)');
  else fail('vital','V1','Client actif', !c ? 'Aucun client' : 'Seulement ' + (c?.asins?.length||0) + ' ASINs (min ' + asinMinReq + ')');

  // V2 — Tableau de bord
  try {
    if (typeof go === 'function') go('dashboard');
    await new Promise(r => setTimeout(r, 300));
    const e = getErr(); const ca = c?.asins?.reduce((s,a)=>s+(getRevenue(a,c)||0),0)||0;
    if (!e && ca > 0) pass('vital','V2','Tableau de bord (CA ' + Math.round(ca) + ' EUR)');
    else fail('vital','V2','Tableau de bord', e || 'CA semaine = 0');
  } catch(ex) { fail('vital','V2','Tableau de bord', ex.message); }

  // V3 — Revue Hebdo
  try {
    if (typeof go === 'function') go('weekly');
    await new Promise(r => setTimeout(r, 300));
    const e = getErr(); const acts = c?.weeklyActions||[];
    if (!e && acts.length > 0) pass('vital','V3','Revue Hebdo (' + acts.length + ' actions)');
    else fail('vital','V3','Revue Hebdo', e || 'Aucune action weeklyActions');
  } catch(ex) { fail('vital','V3','Revue Hebdo', ex.message); }

  // V4 — Buy Box liste + retailPct>100 exclu
  try {
    if (typeof go === 'function') go('buybox');
    await new Promise(r => setTimeout(r, 400));
    const e = getErr();
    // v3.1.70 — calcBuyBoxAlerts retourne {critical, warning, suppressed} (pas un tableau plat)
    let alertObj = { critical: [], warning: [], suppressed: [] };
    if (typeof calcBuyBoxAlerts === 'function' && c) alertObj = calcBuyBoxAlerts(c) || alertObj;
    const allAlerts = [...(alertObj.critical||[]), ...(alertObj.warning||[]), ...(alertObj.suppressed||[])];
    const corrupt = allAlerts.filter(a => parseNum(String(a.retailPct||'').replace(',','.').replace(/[^0-9.]/g,'')) > 100);
    if (!e && corrupt.length === 0)
      pass('vital','V4','Buy Box liste (' + allAlerts.length + ' : ' + alertObj.critical.length + ' crit + ' + alertObj.warning.length + ' warn + ' + alertObj.suppressed.length + ' supp)');
    else fail('vital','V4','Buy Box liste', e || corrupt.length + ' alertes retailPct>100');
  } catch(ex) { fail('vital','V4','Buy Box liste', ex.message); }

  // V5 — Buy Box Phase 2 (carnet d'enquête v3.6.1 — dossier sans crash)
  try {
    const refAsin = clientCal?.asinRef?.asin || SMOKE_REF.asinRef.asin;
    window._buyboxView = null; window._buyboxAsin = null; // reset état UI
    if (typeof buyboxOpenCase === 'function' && c) buyboxOpenCase(c, refAsin);
    window._buyboxView = 'case'; window._buyboxAsin = refAsin;
    if (typeof render === 'function') render();
    await new Promise(r => setTimeout(r, 400));
    const e = getErr();
    const hasCase = document.body.innerHTML.includes('Carnet d\'enquête') || document.body.innerHTML.includes('Hypothèses');
    if (!e && hasCase) pass('vital','V5','Buy Box Phase 2 ouvert (' + refAsin + ')');
    else fail('vital','V5','Buy Box Phase 2', e || 'DOM Carnet enquête absent');
    // Remettre sur vue liste avant de continuer
    window._buyboxView = 'list'; window._buyboxAsin = null;
    if (typeof go === 'function') { go('buybox'); await new Promise(r=>setTimeout(r,150)); }
  } catch(ex) { fail('vital','V5','Buy Box Phase 2', ex.message); }

  // V6 — Import données
  try {
    if (typeof go === 'function') go('import');
    await new Promise(r => setTimeout(r, 300));
    const e = getErr(); const txt = document.body.innerText;
    if (!e && txt.includes('historiques') && txt.includes('hebdomadaires'))
      pass('vital','V6','Import données (sections 1 et 2 visibles)');
    else fail('vital','V6','Import données', e || 'Sections manquantes');
  } catch(ex) { fail('vital','V6','Import données', ex.message); }

  // V7 — Appros
  try {
    if (typeof go === 'function') go('appros');
    await new Promise(r => setTimeout(r, 400));
    const e = getErr(); const txt = document.body.innerText;
    const hasData = txt.includes('ASINs') && (txt.includes('Ventes') || txt.includes('Stock') || txt.includes('Matrice'));
    if (!e && hasData) pass('vital','V7','Appros (données présentes)');
    else fail('vital','V7','Appros', e || 'Aucune source de données détectée');
  } catch(ex) { fail('vital','V7','Appros', ex.message); }

  // V8 — Agent SEO
  try {
    if (typeof go === 'function') go('seo');
    await new Promise(r => setTimeout(r, 300));
    const e = getErr(); const txt = document.body.innerText;
    const hasSEO = txt.includes('SEO') || txt.includes('titre') || txt.includes('bullet');
    if (!e && hasSEO) pass('vital','V8','Agent SEO (affiche contenu SEO)');
    else fail('vital','V8','Agent SEO', e || 'Contenu SEO absent');
  } catch(ex) { fail('vital','V8','Agent SEO', ex.message); }

  // ── V9 — Tests calibrés par client ────────────────────────────────────
  // Si client non calibré dans SMOKE_REF_BY_CLIENT → skip silencieux
  if (!clientCal) {
    console.info('[INFO] SMOKE_REF non calibré pour ce client (' + (c?.name || clientId || 'inconnu') +
      '). Test en phase d\'apprentissage — historique en cours de constitution.');
  } else {
    // V9a — CA 2024
    if (clientCal.CA_2024 && !refExpiredByDate(clientCal.CA_2024.expiry)) {
      const v = Math.round(c?.annualData?.['2024']?.ventes?.totalCA||0);
      if (v === 0) pass('vital','V9a','CA 2024 : non importé (optionnel)');
      else if (inTol(v, clientCal.CA_2024.value, clientCal.CA_2024.tolerance))
        pass('vital','V9a','CA 2024 stable : ' + v.toLocaleString('fr-FR') + ' EUR');
      else fail('vital','V9a','CA 2024 dévié','Attendu ~' + clientCal.CA_2024.value.toLocaleString('fr-FR') + ' ±2%, obtenu ' + v.toLocaleString('fr-FR'));
    }

    // V9b — CA 2025
    if (clientCal.CA_2025 && !refExpiredByDate(clientCal.CA_2025.expiry)) {
      const v = Math.round(c?.annualData?.['2025']?.ventes?.totalCA||0);
      if (v === 0) pass('vital','V9b','CA 2025 : non importé (optionnel)');
      else if (inTol(v, clientCal.CA_2025.value, clientCal.CA_2025.tolerance))
        pass('vital','V9b','CA 2025 stable : ' + v.toLocaleString('fr-FR') + ' EUR');
      else fail('vital','V9b','CA 2025 dévié','Attendu ~' + clientCal.CA_2025.value.toLocaleString('fr-FR') + ' ±2%, obtenu ' + v.toLocaleString('fr-FR'));
    }

    // V9c — ASINs catalogue
    if (clientCal.asinMin) {
      const asinCnt = c?.asins?.length||0;
      if (asinCnt >= clientCal.asinMin.value) pass('vital','V9c','Catalogue : ' + asinCnt + ' ASINs');
      else fail('vital','V9c','Catalogue ASINs', asinCnt + ' < minimum ' + clientCal.asinMin.value);
    }

    // V9d — ASIN de référence : invariants pipeline (PAS la santé business)
    // v3.1.70 — cohérence units/revenue, ratio prix, title/brand non vides
    if (clientCal.asinRef) {
      const refA = c?.asins?.find(a => a.asin === clientCal.asinRef.asin);
      if (!refA) {
        fail('vital','V9d','ASIN réf. ABSENT du catalogue après import', clientCal.asinRef.asin);
      } else {
        const rev   = Math.round(refA.revenue || 0);
        const units = refA.units || refA.orderedUnits || 0;
        const checks = [];
        if (units > 0 && rev === 0) checks.push('units=' + units + ' mais revenue=0 (parser CA cassé ?)');
        if (rev > 500 && units === 0) checks.push('revenue=' + rev + '€ mais units=0 (parser units cassé ?)');
        if (rev > 0 && units > 0) {
          const prixUnit = rev / units;
          if (prixUnit < 0.1) checks.push('prix unitaire ' + prixUnit.toFixed(2) + '€ anormalement bas');
          if (prixUnit > 1000) checks.push('prix unitaire ' + prixUnit.toFixed(2) + '€ anormalement haut');
        }
        if (!refA.title) checks.push('title vide');
        if (!refA.brand) checks.push('brand vide');
        if (checks.length === 0) {
          const detail = rev === 0 ? 'pas de vente cette semaine (OK)' : rev + '€ / ' + units + 'u (cohérent)';
          pass('vital','V9d','ASIN réf. ' + clientCal.asinRef.asin + ' : ' + detail);
        } else {
          fail('vital','V9d','ASIN réf. cohérence pipeline', checks.join(' | '));
        }
      }
    }
  }

  // I1 — Analyse ASINs
  try {
    if (typeof go === 'function') go('asins');
    await new Promise(r => setTimeout(r, 200));
    const e = getErr();
    if (!e) pass('important','I1','Analyse ASINs'); else fail('important','I1','Analyse ASINs',e);
  } catch(ex) { fail('important','I1','Analyse ASINs',ex.message); }

  // I2 — Diagnostic CA
  try {
    if (typeof go === 'function') go('diagnostic');
    await new Promise(r => setTimeout(r, 200));
    const e = getErr();
    if (!e) pass('important','I2','Diagnostic CA'); else fail('important','I2','Diagnostic CA',e);
  } catch(ex) { fail('important','I2','Diagnostic CA',ex.message); }

  // I3 — Prévisionnel
  try {
    if (typeof go === 'function') go('previsionnel');
    await new Promise(r => setTimeout(r, 200));
    const e = getErr();
    if (!e) pass('important','I3','Prévisionnel'); else fail('important','I3','Prévisionnel',e);
  } catch(ex) { fail('important','I3','Prévisionnel',ex.message); }

  // I4 — Zone PO Import
  try {
    if (typeof go === 'function') go('import');
    await new Promise(r => setTimeout(r, 200));
    const poZone = document.getElementById('po-section-3');
    if (poZone) pass('important','I4','Zone PO Import (présente)');
    else fail('important','I4','Zone PO Import','po-section-3 absent');
  } catch(ex) { fail('important','I4','Zone PO Import',ex.message); }

  // I5 — Guide ASN embarqué
  if (typeof GUIDE_ASN_BOL_B64 !== 'undefined' && GUIDE_ASN_BOL_B64.length > 1000)
    pass('important','I5','Guide ASN (' + GUIDE_ASN_BOL_B64.length + ' chars)');
  else fail('important','I5','Guide ASN','GUIDE_ASN_BOL_B64 absent ou vide');

  // I6 — retailPct>100 exclu
  if (typeof calcBuyBoxAlerts === 'function' && c) {
    try {
      // v3.1.70 — calcBuyBoxAlerts retourne {critical, warning, suppressed}
      const alertObj = calcBuyBoxAlerts(c) || {};
      const allAlerts = [...(alertObj.critical||[]), ...(alertObj.warning||[]), ...(alertObj.suppressed||[])];
      const corrupt = allAlerts.filter(a => parseNum(String(a.retailPct||'').replace(',','.').replace(/[^0-9.]/g,'')) > 100);
      if (corrupt.length === 0) pass('important','I6','retailPct>100 correctement exclu');
      else fail('important','I6','retailPct>100', corrupt.length + ' alertes avec valeur incohérente');
    } catch(ex) { fail('important','I6','retailPct>100',ex.message); }
  }

  // I7 — Titre de l'onglet dynamique
  const tabTitle = document.title;
  if (tabTitle && tabTitle.includes(APP_VERSION) && !tabTitle.includes('v3.1.27'))
    pass('important','I7','Titre onglet dynamique : ' + tabTitle);
  else fail('important','I7','Titre onglet',
    tabTitle.includes('v3.1.27') ? 'Titre figé à v3.1.27 (bug connu)' : 'Version absente du titre : ' + tabTitle);

  if (typeof go === 'function') go('dashboard');
  await new Promise(r => setTimeout(r, 100));

  // Score et résumé
  const vFails = results.vital.filter(t => !t.ok);
  const iFails = results.important.filter(t => !t.ok);
  results.summary = {
    vitalTotal: results.vital.length, vitalOk: results.vital.filter(t=>t.ok).length, vitalFails: vFails.length,
    importantTotal: results.important.length, importantOk: results.important.filter(t=>t.ok).length, importantFails: iFails.length,
    status: vFails.length > 0 ? 'CRITICAL' : iFails.length > 0 ? 'WARNING' : 'OK'
  };
  try { localStorage.setItem('ap-smoketest-last', JSON.stringify(results)); } catch(e) {}
  if (!silent) renderSmokeResult(results);

  // ── AJOUT 2 — Collecte historique smoke (IDB smoke_history) ──────────
  // Enregistrement systématique, quel que soit le client (calibré ou non)
  if (typeof saveSmokeHistory === 'function' && c && c.id) {
    const measures = {
      CA_2024:    Math.round(c?.annualData?.['2024']?.ventes?.totalCA || 0),
      CA_2025:    Math.round(c?.annualData?.['2025']?.ventes?.totalCA || 0),
      CA_semaine: Math.round((c?.asins || []).reduce(function(s, a) {
        return s + (typeof getRevenue === 'function' ? (getRevenue(a, c) || 0) : (a.revenue || 0));
      }, 0)),
      nb_asins:   (c?.asins || []).length,
      nb_units:   Math.round((c?.asins || []).reduce(function(s, a) { return s + (a.units || 0); }, 0)),
    };
    saveSmokeHistory(c.id, c.name || c.id, measures);
  }

  return results;
}

function renderSmokeResult(r) {
  const s = r.summary;
  const old = document.getElementById('smoke-banner');
  if (old) old.remove();
  const bg = s.status === 'CRITICAL' ? '#FFEBEE' : s.status === 'WARNING' ? '#FFF8E1' : '#E8F5E9';
  const bd = s.status === 'CRITICAL' ? '#e24b4a' : s.status === 'WARNING' ? '#EF6C00' : '#2E7D32';
  const icon = s.status === 'CRITICAL' ? '[CRITICAL]' : s.status === 'WARNING' ? '[WARNING]' : '[OK]';
  const lbl = s.status === 'CRITICAL' ? 'SMOKE TEST CRITIQUE — ' + s.vitalFails + ' test(s) vital(aux) échoué(s)'
    : s.status === 'WARNING' ? 'Smoke test — ' + s.importantFails + ' test(s) important(s) à corriger'
    : 'Smoke test OK — ' + s.vitalOk + '/' + s.vitalTotal + ' vitaux · ' + s.importantOk + '/' + s.importantTotal + ' importants';
  const fails = [...(r.vital||[]),...(r.important||[])].filter(t=>!t.ok);
  const detail = fails.map(t => '<span style="display:block;font-size:10px;margin-top:2px">&#8594; ' + t.id + ' ' + t.label + (t.msg?' : <em>'+t.msg+'</em>':'') + '</span>').join('');
  const div = document.createElement('div');
  div.id = 'smoke-banner';
  div.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;max-width:440px;padding:10px 14px;border-radius:8px;border-left:4px solid '+bd+';background:'+bg+';box-shadow:0 2px 8px rgba(0,0,0,0.12);font-size:12px;font-family:var(--font,sans-serif);cursor:default';
  div.innerHTML = '<strong>' + icon + ' ' + lbl + '</strong> <span style="color:#888;font-size:10px">' + APP_VERSION + ' · ' + new Date(r.ts).toLocaleTimeString('fr-FR') + '</span>' + detail
    + '<button onclick="this.parentElement.remove()" style="position:absolute;top:4px;right:6px;background:none;border:none;font-size:14px;cursor:pointer;color:#888">&#215;</button>';
  document.body.appendChild(div);
  if (s.status === 'OK') setTimeout(() => div.remove(), 8000);
}
function runSmokeTestManual() { smokeTest(false); }
