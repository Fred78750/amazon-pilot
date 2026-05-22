// Amazon Pilot — YoY Template : Conclusion generale (section finale)
// v3.6.5.6 — T5 (Skill YoY V3 — templates quasi litteraux)

/**
 * tplConclusion — HTML du corps de la section conclusion (T5)
 * @param {object} dims        — Résultat yoyComputeDimensions()
 * @param {string} sign        — 'negative' | 'positive' | 'stable'
 * @param {string} clientName  — Nom du client
 * @returns {string}           — HTML interne (sans le wrapper yoy-section)
 */
function tplConclusion(dims, sign, clientName) {
  const d1  = dims.dim1  || {};
  const d7  = dims.dim7  || {};
  const d10 = dims.dim10 || {};

  const name = clientName || 'Ce compte';

  const nDisparus  = (d7.disparus || []).length;
  const nCommuns   = (d7.stables  || []).length + (d7.enBaisse || []).length + (d7.enHausse || []).length;
  const nA1Total   = nDisparus + nCommuns;
  const pctDisparus = nA1Total > 0 ? (Math.round(nDisparus / nA1Total * 10) / 10) : 0;
  const nApparus   = (d7.apparus || []).length;

  // Top 2 marques gagnantes (pour cas POS)
  const getDp = b => b.deltaPct != null ? b.deltaPct
    : (b.caRefPerDay > 0 ? (b.caAPerDay / b.caRefPerDay - 1) * 100 : 0);
  const gainBrands = (d10.topBrands || [])
    .map(b => ({ name: b.marque, dp: getDp(b) }))
    .filter(b => b.dp > 0)
    .sort((a, b) => b.dp - a.dp);
  const m1Gain = gainBrands[0] ? gainBrands[0].name : null;
  const m2Gain = gainBrands[1] ? gainBrands[1].name : null;

  const deltaAnn       = d1.deltaCAAnnu;
  const deltaAnnFmt    = deltaAnn != null ? yoyFmtEur(Math.abs(deltaAnn)) : '—';
  const deltaSignedFmt = deltaAnn != null ? yoyFmtEurSigned(deltaAnn)     : '—';
  const deltaPctFmt    = d1.deltaCAPct != null ? yoyFmtPct(d1.deltaCAPct, true) : '—';
  const vClass = sign === 'negative' ? 'neg' : sign === 'positive' ? 'pos' : '';

  if (sign === 'negative') {
    return `<p class="yoy-section-para">Le compte <strong>${esc(name)}</strong> perd <strong>${deltaAnnFmt}/an</strong> en projection annualisée par rapport à la période de référence. La baisse n'est pas due à un effondrement de la demande ou à un problème de prix, mais à <strong>une contraction de ${pctDisparus} % du catalogue actif</strong>, concentrée sur quelques marques et un nombre limité d'ASINs.</p>
<div class="verdict-block ${vClass}"><em>Le potentiel de récupération n'est pas négligeable, car la baisse est très concentrée. Si les ASINs les plus touchés sont récupérables — stock, Buy Box, disponibilité, PO, fiche — il y a probablement un levier significatif de regagne CA.</em></div>
<p class="yoy-section-para" style="margin-top:12px">L'enjeu opérationnel est dans l'audit ASIN par ASIN. C'est l'objet des outils de pilotage Amazon Pilot : Analyse ASINs, Buy Box, Diagnostic CA.</p>`;
  } else if (sign === 'positive') {
    const gardenOf = (m1Gain && m2Gain) ? ` tirée par ${esc(m1Gain)} et ${esc(m2Gain)} principalement` : m1Gain ? ` tirée par ${esc(m1Gain)} principalement` : '';
    return `<p class="yoy-section-para">Le compte <strong>${esc(name)}</strong> progresse de <strong>${deltaAnnFmt}/an</strong> en projection annualisée par rapport à la période de référence. La progression est saine : portée par les volumes, soutenue par ${nApparus} nouveaux ASINs${gardenOf}.</p>
<div class="verdict-block ${vClass}"><em>Le sujet n'est pas de pousser plus loin, mais de sécuriser la dynamique. Un best-seller qui décroche pour rupture ou perte de Buy Box impacterait significativement la trajectoire.</em></div>
<p class="yoy-section-para" style="margin-top:12px">L'enjeu opérationnel est dans la surveillance des Top 10 ASINs et dans la consolidation des marques motrices. Les outils Buy Box et Appros sont calibrés pour ce pilotage défensif.</p>`;
  } else {
    return `<p class="yoy-section-para">Le compte <strong>${esc(name)}</strong> évolue de <strong>${deltaSignedFmt}/an</strong>, soit <strong>${deltaPctFmt}</strong>. Performance globalement stable, sans signal de risque imminent ni moteur de croissance évident à activer en agrégat.</p>
<div class="verdict-block ${vClass}"><em>Sous une stabilité apparente, il y a presque toujours des dynamiques internes. Le travail utile se fait au niveau ASIN et marque, pas au niveau du compte.</em></div>
<p class="yoy-section-para" style="margin-top:12px">L'enjeu opérationnel est de garder une cadence de surveillance régulière via la Revue Hebdo et de saisir les opportunités identifiées dans les sections précédentes.</p>`;
  }
}
