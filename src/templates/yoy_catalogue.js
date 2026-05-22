// Amazon Pilot — YoY Template : Mouvement du catalogue (section 2)
// v3.6.5.6 — T1.B + T2.B (Skill YoY V3 — templates quasi litteraux)

function tplCatalogue(dims, sign) {
  const d7 = dims.dim7 || {};
  const d1 = dims.dim1 || {};

  const nDisparus = (d7.disparus || []).length;
  const nApparus  = (d7.apparus  || []).length;
  const nStables  = (d7.stables  || []).length;
  const nBaisse   = (d7.enBaisse || []).length;
  const nHausse   = (d7.enHausse || []).length;
  const nCommuns  = nStables + nBaisse + nHausse;
  const nA1Total  = nDisparus + nCommuns;

  const pctDisparus = nA1Total > 0 ? (Math.round(nDisparus / nA1Total * 1000) / 10) : 0;
  const impactDisparusAnn = (d7.sumDisparusRef || 0) * 365;
  const impactApparusAnn  = (d7.sumApparusA   || 0) * 365;

  let lecture = '';

  if (sign === 'negative') {
    lecture = `<p class="yoy-section-para">Sur les ${nA1Total} ASINs actifs en référence, <strong>${nDisparus}</strong> ne vendent plus rien en période A — soit <strong>${pctDisparus} %</strong> du catalogue effacé. Cette catégorie pèse à elle seule <strong>${yoyFmtEur(impactDisparusAnn)}</strong> de CA annualisé. Les ${nApparus} ASINs apparus ne compensent que partiellement. Les ASINs encore actifs sont relativement stables en valeur agrégée — ce n'est pas la performance par ASIN qui décroche, c'est la largeur du catalogue.</p>`;
  } else if (sign === 'positive') {
    const moteur = impactApparusAnn > Math.abs(impactDisparusAnn)
      ? `les ASINs déjà présents qui montent en cadence`
      : `une combinaison de nouveaux ASINs et de meilleure tenue des ASINs existants`;
    lecture = `<p class="yoy-section-para">Sur les ${nA1Total} ASINs actifs en référence, <strong>${nCommuns}</strong> restent actifs en période A et accélèrent en valeur agrégée. Les <strong>${nApparus}</strong> ASINs apparus apportent <strong>${yoyFmtEur(impactApparusAnn)}</strong> supplémentaires. Les ${nDisparus} disparus ne pèsent que <strong>${yoyFmtEur(Math.abs(impactDisparusAnn))}</strong> sur la balance. La progression est portée principalement par ${moteur}.</p>`;
  } else {
    const netRotation = impactApparusAnn - impactDisparusAnn;
    lecture = `<p class="yoy-section-para">Sur les ${nA1Total} ASINs actifs en référence, on note <strong>${nDisparus}</strong> disparitions et <strong>${nApparus}</strong> apparitions — soit une rotation de <strong>${pctDisparus} %</strong> du catalogue. Le bilan net est <strong>${yoyFmtEurSigned(netRotation)}/an</strong>. Le catalogue est en mouvement mais à somme quasi nulle.</p>`;
  }

  const verdictText = sign === 'negative'
    ? `${nDisparus} ASINs disparus en un an. C'est le vrai sujet : Amazon a cessé de commander, ou les fiches sont devenues invisibles. À distinguer ASIN par ASIN — c'est l'objet du plan d'action.`
    : sign === 'positive'
    ? `La croissance vient principalement du portefeuille existant qui accélère. Bonne nouvelle : c'est une dynamique sur des ASINs déjà installés, donc protégeable.`
    : `Catalogue actif globalement stable en volume. Rotation neutre. Continuer la surveillance, sans urgence opérationnelle.`;
  const vClass = sign === 'negative' ? 'neg' : sign === 'positive' ? 'pos' : '';
  const verdict = `<div class="verdict-block ${vClass}"><em>${verdictText}</em></div>`;

  return { lecture, verdict };
}
