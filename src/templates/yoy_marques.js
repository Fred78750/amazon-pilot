// Amazon Pilot — YoY Template : Ventilation par marque (section 4)
// v3.6.5.6 — T1.D + T2.D (Skill YoY V3 — templates quasi litteraux)

function tplMarques(dims, sign) {
  const d10 = dims.dim10 || {};
  const brands = (d10.topBrands || []).slice(0, 10);

  // backward compat : deltaPct peut etre absent (v3.6.5.3 et avant)
  const getDp = b => b.deltaPct != null ? b.deltaPct
    : (b.caRefPerDay > 0 ? (b.caAPerDay / b.caRefPerDay - 1) * 100 : 0);
  const getDj = b => (b.caAPerDay || 0) - (b.caRefPerDay || 0);

  const sorted = brands.map(b => ({ marque: b.marque, dp: getDp(b), dj: getDj(b), caAPerDay: b.caAPerDay || 0, caAShare: b.caAShare }))
    .sort((a, b) => a.dp - b.dp);

  const perdBrands = sorted.filter(b => b.dp < 0).slice(0, 3);
  const gainBrands = sorted.filter(b => b.dp > 0).reverse();
  const domBrand   = brands.slice().sort((a, b) => (b.caAPerDay||0) - (a.caAPerDay||0))[0];

  let lecture = '';

  if (sign === 'negative' && perdBrands.length >= 2) {
    const m1 = perdBrands[0], m2 = perdBrands[1], m3 = perdBrands[2] || perdBrands[1];
    const mG  = gainBrands[0];
    const ancrage = mG
      ? ` À l'inverse, <strong>${esc(mG.marque)}</strong> reste un point d'ancrage (${yoyFmtEurSigned(mG.dj)}/j).`
      : '';
    lecture = `<p class="yoy-section-para">Le recul est concentré sur quelques familles. <strong>${esc(m1.marque)}</strong> (${yoyFmtEurSigned(m1.dj)}/j), <strong>${esc(m2.marque)}</strong> (${yoyFmtEurSigned(m2.dj)}/j) et <strong>${esc(m3.marque)}</strong> (${yoyFmtEurSigned(m3.dj)}/j) sont les 3 marques qui décrochent le plus en valeur quotidienne.${ancrage} La question opérationnelle : ces reculs sont-ils dus à un retrait Amazon (PO non renouvelées) ou à une perte de disponibilité (rupture, suppression) ?</p>`;
  } else if (sign === 'positive' && gainBrands.length >= 1) {
    const g1 = gainBrands[0], g2 = gainBrands[1], g3 = gainBrands[2];
    const mP = perdBrands[0];
    const recul = mP
      ? ` À l'inverse, <strong>${esc(mP.marque)}</strong> est la principale marque en recul (${yoyFmtEurSigned(mP.dj)}/j) — à vérifier s'il s'agit d'une fin de cycle produit, d'une cannibalisation interne ou d'un problème de disponibilité.`
      : '';
    const g2str = g2 ? `, <strong>${esc(g2.marque)}</strong> (+${yoyFmtEur(g2.dj)}/j)` : '';
    const g3str = g3 ? ` et <strong>${esc(g3.marque)}</strong> (+${yoyFmtEur(g3.dj)}/j)` : '';
    lecture = `<p class="yoy-section-para">La croissance est portée principalement par <strong>${esc(g1.marque)}</strong> (+${yoyFmtEur(g1.dj)}/j)${g2str}${g3str}.${recul}</p>`;
  } else {
    const pctA = domBrand && domBrand.caAShare != null ? yoyFmtPct(domBrand.caAShare * 100) : '—';
    lecture = `<p class="yoy-section-para">Pas de marque qui sort fortement du lot, ni positivement ni négativement. La performance marque par marque est globalement parallèle à la référence. La marque dominante reste <strong>${domBrand ? esc(domBrand.marque) : '—'}</strong> (${pctA} du CA).</p>`;
  }

  let verdictText = '';
  if (sign === 'negative' && perdBrands.length >= 2) {
    const names = perdBrands.map(b => b.marque).join(', ');
    verdictText = `${names} : ${perdBrands.length} familles à auditer en priorité — recul normal ou anomalie évitable ?`;
  } else if (sign === 'positive' && gainBrands.length >= 1) {
    const top2 = gainBrands.slice(0, 2).map(b => b.marque).join(' et ');
    verdictText = `${top2} : ${gainBrands.length >= 2 ? '2 marques' : '1 marque'} à sécuriser comme actif stratégique de la croissance actuelle.`;
  } else {
    verdictText = `Pas de marque qui s'extrait du peloton. Si on cherche un effet levier, c'est à construire, pas à protéger.`;
  }
  const vClass = sign === 'negative' ? 'neg' : sign === 'positive' ? 'pos' : '';
  const verdict = `<div class="verdict-block ${vClass}"><em>${verdictText}</em></div>`;

  return { lecture, verdict };
}
