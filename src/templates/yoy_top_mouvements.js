// Amazon Pilot — YoY Template : Top mouvements ASIN (section 5)
// v3.6.5.6 — T1.E + T2.E (Skill YoY V3 — templates quasi litteraux)

function tplTopMouvements(dims, sign) {
  const d11 = dims.dim11 || {};
  const perdants = d11.perdants || [];
  const gagnants = d11.gagnants || [];

  const top10Perd = perdants.slice(0, 10);
  const top10Gain = gagnants.slice(0, 10);

  const totalPerdJour = top10Perd.reduce((s, r) => s + (r.deltaPerDay || 0), 0);
  const totalGainJour = top10Gain.reduce((s, r) => s + (r.deltaPerDay || 0), 0);
  const absPerdAn = Math.abs(totalPerdJour) * 365;

  const passeAZero = top10Perd.filter(r => (r.caAPerDay || 0) < 0.01).length;

  let lecture = '';

  if (sign === 'negative') {
    const patternPerd = passeAZero > 0
      ? `${passeAZero} ASINs passés à 0 € (suppression/rupture)`
      : `recul de vélocité sur plusieurs familles`;
    lecture = `<p class="yoy-section-para">Les 10 plus gros perdants pèsent <strong>${yoyFmtEur(Math.abs(totalPerdJour))}/jour</strong> (soit <strong>${yoyFmtEur(absPerdAn)}/an</strong>). Les 10 plus gros gagnants pèsent <strong>${yoyFmtEur(totalGainJour)}/jour</strong>. Le solde est franchement déséquilibré côté perte. Le pattern dominant côté perdants : ${patternPerd}. Côté gagnants, on note des résistances ponctuelles sur quelques références.</p>`;
  } else if (sign === 'positive') {
    lecture = `<p class="yoy-section-para">Les 10 plus gros gagnants pèsent <strong>+${yoyFmtEur(totalGainJour)}/jour</strong>. Les 10 plus gros perdants pèsent <strong>${yoyFmtEur(Math.abs(totalPerdJour))}/jour</strong>. Le solde est nettement positif. La croissance se construit ASIN par ASIN, avec une diversification visible. À surveiller toutefois : les ASINs en déclin méritent une vérification individuelle (disponibilité, Buy Box, fiche).</p>`;
  } else {
    lecture = `<p class="yoy-section-para">Les 10 plus gros gagnants pèsent <strong>+${yoyFmtEur(totalGainJour)}/jour</strong>, les 10 plus gros perdants <strong>${yoyFmtEur(Math.abs(totalPerdJour))}/jour</strong>. Le solde des extrêmes est globalement équilibré — pas de mouvement structurant côté ASINs individuels.</p>`;
  }

  const verdictText = sign === 'negative'
    ? `Les 10 ASINs les plus en chute concentrent ${yoyFmtEur(Math.abs(totalPerdJour))}/jour de perte. C'est sur eux que doit porter l'audit prioritaire.`
    : sign === 'positive'
    ? `Les 10 ASINs les plus en progression apportent +${yoyFmtEur(totalGainJour)}/jour. Disponibilité, stock et Buy Box sur ces 10 références = priorité opérationnelle.`
    : `Pas de mouvement individuel structurant. Les variations ASIN se compensent.`;
  const vClass = sign === 'negative' ? 'neg' : sign === 'positive' ? 'pos' : '';
  const verdict = `<div class="verdict-block ${vClass}"><em>${verdictText}</em></div>`;

  return { lecture, verdict };
}
