// Amazon Pilot — YoY Template : Performance et marge (section 1)
// v3.6.5.6 — T1.A + T2.A (Skill YoY V3 — templates quasi litteraux)

function tplPerformance(dims, sign) {
  const d1 = dims.dim1 || {}, d2 = dims.dim2 || {}, d3 = dims.dim3 || {};
  const d4 = dims.dim4 || {}, d5 = dims.dim5 || {};

  const uDp   = d2.deltaUPct   != null ? yoyFmtPct(d2.deltaUPct,   true) : '—';
  const caDp  = d1.deltaCAPct  != null ? yoyFmtPct(d1.deltaCAPct,  true) : '—';
  const pmvDp = d3.deltaPMVPct != null ? yoyFmtPct(d3.deltaPMVPct, true) : '—';
  const margeA  = d4.tauxMargeA != null ? yoyFmtPct(d4.tauxMargeA) : '—';
  const margeDpt = d4.deltaTauxMarge;
  const retA  = d5.tauxRetA;
  const retRef = d5.tauxRetRef;

  let lecture = '';

  if (sign === 'negative') {
    let margePhrase;
    if (margeDpt == null) { margePhrase = `est à ${margeA}`; }
    else if (Math.abs(margeDpt) < 1) { margePhrase = `reste stable autour de ${margeA}`; }
    else if (margeDpt > 0) { margePhrase = `s'améliore de ${yoyFmtPts(margeDpt)} (${margeA})`; }
    else { margePhrase = `se dégrade de ${yoyFmtPts(Math.abs(margeDpt))} (${margeA})`; }

    const margeSignal = (margeDpt == null || margeDpt >= 0)
      ? `préserve son économie sur le compte — indirectement, c'est un signal d'absence de soutien promotionnel particulier`
      : `voit baisser son économie sur le compte — indirectement, c'est un signal de pression accrue sur la rentabilité Amazon`;
    const retPhrase = (retA == null || retRef == null) ? 'la stabilité'
      : retA < retRef ? 'la légère baisse'
      : retA > retRef ? 'la légère hausse'
      : 'la stabilité';

    lecture = `<p class="yoy-section-para">La baisse en volume (${uDp}) est plus marquée que la baisse en CA (${caDp}). Le prix moyen unitaire progresse de ${pmvDp} : l'assortiment qui vend en période A est plus cher mais bouge moins. La marge Amazon Retail ${margePhrase}, ce qui signifie qu'Amazon ${margeSignal}. Le ratio expédié/commandé proche de 100 % et ${retPhrase} du taux de retours excluent un décrochage logistique global ou un problème qualité diffus.</p>`;

  } else if (sign === 'positive') {
    const unitsVsCA = (d2.deltaUPct != null && d1.deltaCAPct != null && d2.deltaUPct > d1.deltaCAPct) ? 'dépasse' : 'suit';
    const pmvMix = (d3.deltaPMVPct != null && Math.abs(d3.deltaPMVPct) < 2)
      ? 'la croissance vient essentiellement des volumes vendus, pas du prix'
      : `d'un mix volume + prix`;
    const pmvDir = (d3.deltaPMVPct != null && d3.deltaPMVPct > 0) ? 'progresse légèrement' : 'reste stable';
    let margePhrase2;
    if (margeDpt == null) { margePhrase2 = `est à ${margeA}`; }
    else if (Math.abs(margeDpt) < 1) { margePhrase2 = `reste stable autour de ${margeA}`; }
    else if (margeDpt > 0) { margePhrase2 = `s'améliore de ${yoyFmtPts(margeDpt)}, à ${margeA}`; }
    else { margePhrase2 = `se dégrade de ${yoyFmtPts(Math.abs(margeDpt))}, à ${margeA}, signal de pression croissante sur la rentabilité Amazon`; }

    lecture = `<p class="yoy-section-para">La progression en volume (${uDp}) ${unitsVsCA} la progression en CA (${caDp}). Le prix moyen unitaire ${pmvDir} (${pmvDp}) : ${pmvMix}. La marge Amazon Retail ${margePhrase2}. Le ratio expédié/commandé proche de 100 % indique une chaîne logistique qui suit la cadence.</p>`;

  } else {
    const margeStable = margeDpt != null ? ` (${yoyFmtPts(margeDpt)} vs référence)` : '';
    lecture = `<p class="yoy-section-para">Performance globalement stable entre les deux périodes : CA à ${caDp}, volume à ${uDp}, prix moyen à ${pmvDp}. La marge Amazon Retail reste à ${margeA}${margeStable}. Pas de signal de rupture côté ratio expédié/commandé ni côté retours. Si une dynamique se cache derrière cette stabilité agrégée, elle est à chercher au niveau ASIN ou marque (cf. sections suivantes).</p>`;
  }

  const verdictText = sign === 'negative'
    ? `Le problème n'est pas le prix, ni la logistique, ni la qualité produit. Il faut donc chercher ailleurs : assortiment, disponibilité, commandes Amazon.`
    : sign === 'positive'
    ? `La croissance est saine et soutenue par les volumes, sans tension prix ni logistique. À sécuriser dans la durée plutôt qu'à pousser plus loin.`
    : `Pas de signal fort en agrégat. Si quelque chose bouge sur ce compte, c'est au niveau ASIN ou marque — pas dans les indicateurs globaux.`;
  const vClass = sign === 'negative' ? 'neg' : sign === 'positive' ? 'pos' : '';
  const verdict = `<div class="verdict-block ${vClass}"><em>${verdictText}</em></div>`;

  return { lecture, verdict };
}
