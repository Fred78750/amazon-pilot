// Amazon Pilot — YoY Template : Concentration du CA (section 3)
// v3.6.5.6 — T1.C + T2.C (Skill YoY V3 — templates quasi litteraux)

function tplConcentration(dims, sign) {
  const d9 = dims.dim9 || {};
  const concA   = d9.concA   || {};
  const concRef = d9.concRef || {};

  const top10A   = concA.top10   != null ? yoyFmtPct(concA.top10)   : '—';
  const top10Ref = concRef.top10 != null ? yoyFmtPct(concRef.top10) : '—';

  let lecture = '';

  if (sign === 'negative') {
    lecture = `<p class="yoy-section-para">Le Top 10 représentait <strong>${top10Ref}</strong> du CA en référence. Il pèse maintenant <strong>${top10A}</strong>. La queue longue, qui amortissait les variations, s'est érodée. La perte d'un seul ASIN du Top en période A impacte mécaniquement plus le CA total qu'en référence. C'est un signal de risque opérationnel direct : si un best-seller décroche pour rupture, Buy Box ou suppression, l'effet sera disproportionné.</p>`;
  } else if (sign === 'positive') {
    lecture = `<p class="yoy-section-para">Le Top 10 pèse maintenant <strong>${top10A}</strong> du CA contre <strong>${top10Ref}</strong> en référence. La croissance est tirée par quelques best-sellers qui dominent de plus en plus. Avantage : priorisation simple pour le pilotage opérationnel. Risque : exposition élevée en cas de rupture, perte Buy Box ou suppression de l'un de ces ASINs.</p>`;
  } else {
    lecture = `<p class="yoy-section-para">La concentration reste comparable : Top 10 à <strong>${top10A}</strong> (vs <strong>${top10Ref}</strong> en référence). La structure du portefeuille n'a pas changé fondamentalement.</p>`;
  }

  const verdictText = sign === 'negative'
    ? `La concentration est passée de ${top10Ref} à ${top10A} sur le Top 10. Sécuriser le Top 10 actuel devient une priorité opérationnelle.`
    : sign === 'positive'
    ? `Le Top 10 pèse ${top10A} du CA. Concentrer la vigilance pilotage sur ces 10 ASINs maximise le ROI temps/euro.`
    : `Structure de portefeuille stable. Top 10 à ${top10A} comme en référence — pas de surveillance nouvelle à mettre en place.`;
  const vClass = sign === 'negative' ? 'neg' : sign === 'positive' ? 'pos' : '';
  const verdict = `<div class="verdict-block ${vClass}"><em>${verdictText}</em></div>`;

  return { lecture, verdict };
}
