// Amazon Pilot — YoY Template : Anomalies catalogue (section 6)
// v3.6.5.6 — T1.F + T2.F (Skill YoY V3 — templates quasi litteraux)

function tplAnomalies(dims, sign) {
  const d12 = dims.dim12 || {};
  const anomPairs = d12.anomPairs || [];
  const n = anomPairs.length;

  const sorted = anomPairs.slice().sort((a, b) => (b.caTot || 0) - (a.caTot || 0));
  const top = sorted[0];

  let lecture = '';
  if (n === 0) {
    lecture = `<p class="yoy-section-para">Aucune anomalie orthographique détectée par fuzzy matching sur les noms de marque. Le catalogue est propre sur ce critère.</p>`;
  } else {
    const topPhrase = top
      ? ` La paire la plus impactante en CA cumulé est <strong>${esc(top.marque1)}</strong> / <strong>${esc(top.marque2)}</strong> (${yoyFmtEur(top.caTot || 0)}).`
      : '';
    lecture = `<p class="yoy-section-para"><strong>${n}</strong> paire${n > 1 ? 's' : ''} de marques avec orthographe quasi-identique repérée${n > 1 ? 's' : ''} par fuzzy matching. Effet probable : fragmentation du SEO Amazon (chaque variante est indexée séparément) et fragmentation du reporting marque interne. À traiter via la fonction Cas Vendor Central pour demande de fusion catalogue.${topPhrase}</p>`;
  }

  const verdictText = n === 0
    ? `Catalogue propre sur le critère orthographique. Pas d'action nécessaire.`
    : `${n} doublon${n > 1 ? 's' : ''} orthographique${n > 1 ? 's' : ''} à fusionner. Action rapide à fort effet de levier : un seul cas VC pour consolider le reporting marque et le SEO.`;
  const vClass = n > 0 ? (sign === 'negative' ? 'neg' : '') : '';
  const verdict = `<div class="verdict-block ${vClass}"><em>${verdictText}</em></div>`;

  return { lecture, verdict };
}
