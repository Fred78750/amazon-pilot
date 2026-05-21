// Amazon Pilot — YoY Template : Performance et marge (section 1)
// Implémentation complète : CP3

/**
 * tplPerformance — Template interprétatif section "Performance et marge"
 * @param {object} dims  — Résultats dimensions 1-6
 * @param {string} sign  — 'negative' | 'positive' | 'stable'
 * @returns {string}     — Paragraphe HTML
 */
function tplPerformance(dims, sign) {
  // CP3 — placeholder
  const sens = sign === 'negative' ? 'recul' : sign === 'positive' ? 'progression' : 'stabilité';
  return `<p style="color:var(--tx2);font-style:italic">Analyse de performance en cours de rédaction (v3.6.5-CP3). Tendance : ${esc(sens)}.</p>`;
}
