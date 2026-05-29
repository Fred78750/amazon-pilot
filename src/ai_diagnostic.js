// Amazon Pilot — Narrative IA Analyse comparée (v3.6.9)
// Module : narrative IA semi-IA pour le sous-bloc "Cause la plus probable"
// Décision F2 : IA uniquement pour sign='negative'. positive/stable = fallback pré-rédigé.
// Architecture : jamais appeler api.anthropic.com directement — via Lambda /ai/complete.

// ═══════════════════════════════════════════════════════════════
// HASH DATA SOURCE (C1 : inclut enquetePeriodMonths + anomalyThreshold)
// ═══════════════════════════════════════════════════════════════

/**
 * computeDiagnosticHash(c, dims)
 * Hash djb2-like des KPIs structurants + paramètres utilisateur.
 * Inclut c.enquetePeriodMonths et c.anomalyThreshold (correction C1).
 * Collision ~1/milliard — suffisant pour cache invalidation, pas crypto.
 * @returns {string} e.g. 'v1_a3f2c1b8'
 */
function computeDiagnosticHash(c, dims) {
  var d1  = (dims && dims.dim1)  || {};
  var d7  = (dims && dims.dim7)  || {};
  var d9  = (dims && dims.dim9)  || {};
  var d10 = (dims && dims.dim10) || {};

  var top3str = (d10.topBrands || []).slice(0, 3)
    .map(function(b) { return (b.marque || '') + ':' + Math.round((b.delta || 0) * 100); })
    .join('|');

  var sources = [
    c ? (c.name || '') : '',
    Math.round(d1.deltaCAAnnu || 0),
    (d7.disparus || []).length,
    d1.deltaCAPct != null ? Math.round(d1.deltaCAPct * 10) : 0,
    d9.concA && d9.concA.top10 != null ? Math.round(d9.concA.top10) : 0,
    d9.concRef && d9.concRef.top10 != null ? Math.round(d9.concRef.top10) : 0,
    top3str,
    // C1 — paramètres utilisateur modifiant la sortie algorithme Enquête
    c ? (c.enquetePeriodMonths || 4) : 4,
    c ? (c.anomalyThreshold || 80) : 80
  ].join('::');

  // djb2
  var h = 5381;
  for (var i = 0; i < sources.length; i++) {
    h = ((h << 5) + h) ^ sources.charCodeAt(i);
    h = h & 0x7fffffff; // keep positive
  }
  return 'v1_' + h.toString(16);
}

// ═══════════════════════════════════════════════════════════════
// CACHE IDB (sur c.aiCache.diagnosticV1)
// ═══════════════════════════════════════════════════════════════

function getCachedDiagnostic(c, hash) {
  if (!c || !c.aiCache || !c.aiCache.diagnosticV1) return null;
  var cached = c.aiCache.diagnosticV1;
  if (cached.hash !== hash) return null; // hash mismatch → stale
  return cached.content || null;
}

function setCachedDiagnostic(c, hash, content, sign) {
  if (!c) return;
  if (!c.aiCache) c.aiCache = {};
  c.aiCache.diagnosticV1 = {
    hash:        hash,
    generatedAt: new Date().toISOString(),
    content:     content,
    sign:        sign
  };
}

// ═══════════════════════════════════════════════════════════════
// PROMPT SONNET — "Cause la plus probable" (F1 : validé Fred 29 mai 2026)
// ═══════════════════════════════════════════════════════════════

function buildDiagnosticPrompt(c, dims, dRef, sign) {
  var d1  = (dims && dims.dim1)  || {};
  var d7  = (dims && dims.dim7)  || {};
  var d9  = (dims && dims.dim9)  || {};
  var d10 = (dims && dims.dim10) || {};

  var clientName    = c ? (c.name || '?') : '?';
  var deltaCAFmt    = d1.deltaCAAnnu != null ? yoyFmtEurSigned(d1.deltaCAAnnu) + '/an' : '?';
  var deltaPctFmt   = d1.deltaCAPct  != null ? yoyFmtPct(d1.deltaCAPct, true)           : '?';
  var disparusCount = (d7.disparus || []).length;
  var totalRef      = disparusCount + (d7.stables||[]).length + (d7.enBaisse||[]).length + (d7.enHausse||[]).length;
  var disparusPct   = totalRef > 0 ? yoyFmtPct(disparusCount / totalRef * 100) : '?';

  var top3Chute = (d10.topBrands || [])
    .filter(function(b) { return (b.delta || 0) < 0; })
    .sort(function(a, b) { return (a.delta || 0) - (b.delta || 0); })
    .slice(0, 3)
    .map(function(b) { return esc(b.marque || '?') + ' (' + yoyFmtEurSigned(b.delta || 0) + '/j)'; })
    .join(', ') || 'N/A';

  // catégories Enquête si disponibles
  var cat1 = 0, cat2 = 0, cat3 = 0;
  if (typeof classifyMissingASINs === 'function' && c && (c.pos || []).length > 0 && disparusCount > 0) {
    // estimation rapide depuis cache si disponible
    if (c.aiCache && c.aiCache._enqueteSnap) {
      cat1 = c.aiCache._enqueteSnap.cat1 || 0;
      cat2 = c.aiCache._enqueteSnap.cat2 || 0;
      cat3 = c.aiCache._enqueteSnap.cat3 || 0;
    }
  }

  var concRefPct = d9.concRef && d9.concRef.top10 != null ? yoyFmtPct(d9.concRef.top10) : '?';
  var concAPct   = d9.concA   && d9.concA.top10   != null ? yoyFmtPct(d9.concA.top10)   : '?';
  var concDelta  = (d9.concA && d9.concA.top10 != null && d9.concRef && d9.concRef.top10 != null)
    ? yoyFmtPts(d9.concA.top10 - d9.concRef.top10) : '?';

  return 'Tu es consultant senior Amazon Vendor Central.\n'
    + 'Produis UN seul paragraphe continu (80-120 mots) répondant à :\n'
    + '"Quelle est la cause la plus probable du recul de ce compte ?"\n\n'
    + '=== DONNÉES ===\n'
    + 'Client : ' + clientName + '\n'
    + 'Δ CA annualisé : ' + deltaCAFmt + ' (' + deltaPctFmt + ')\n'
    + 'ASINs disparus : ' + disparusCount + ' (' + disparusPct + ' du catalogue réf.)\n'
    + 'Top 3 marques en chute €/j : ' + top3Chute + '\n'
    + (cat1 + cat2 + cat3 > 0
      ? 'Répartition disparus : ' + cat1 + ' mortalité / ' + cat2 + ' à creuser / ' + cat3 + ' autres\n' : '')
    + 'Concentration Top 10 : ' + concRefPct + ' → ' + concAPct + ' (' + concDelta + ')\n\n'
    + '=== CONSIGNE ===\n'
    + '1. Nommer UNE cause dominante (contraction catalogue / ruptures BdC /\n'
    + '   problème pricing / logistique / baisse structurelle marché)\n'
    + '2. Citer 2-3 chiffres précis pour étayer\n'
    + '3. Terminer par : "La piste à creuser en priorité est [X]."\n\n'
    + 'Règles : texte brut, pas de markdown, pas de bullets, pas de titre.\n'
    + 'Jamais "il semblerait", jamais "potentiellement". Ton : rapport consultant.';
}

// ═══════════════════════════════════════════════════════════════
// APPEL LAMBDA + DOM PATCH
// ═══════════════════════════════════════════════════════════════

var _AI_LAMBDA_URL = 'https://konuaxmdxjnzcuw2etjqwczrla0xycvt.lambda-url.eu-west-3.on.aws';

/**
 * initAIDiagnostic(c, dims, dRef, sign, placeholderId, clientIdAtLaunch)
 * Lance la génération IA async et patche le div placeholder une fois terminé.
 * C2 gardes :
 *   - Vérifie que c.id === clientIdAtLaunch avant patch (switch client pendant génération)
 *   - Gère div === null silencieusement (toggle Free/Pro pendant génération)
 */
function initAIDiagnostic(c, dims, dRef, sign, placeholderId, clientIdAtLaunch) {
  if (!c || sign !== 'negative') return; // F2 : IA uniquement pour sign='negative'

  var hash = computeDiagnosticHash(c, dims);

  // Cache hit → patch immédiat
  var cached = getCachedDiagnostic(c, hash);
  if (cached) {
    _patchDiagnosticDiv(placeholderId, cached, clientIdAtLaunch, false);
    return;
  }

  // Cache miss → appel Lambda
  var prompt = buildDiagnosticPrompt(c, dims, dRef, sign);

  fetch(_AI_LAMBDA_URL + '/ai/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt, model: 'claude-sonnet-4-5', maxTokens: 300 })
  })
  .then(function(resp) {
    if (!resp.ok) throw new Error('Lambda ' + resp.status);
    return resp.json();
  })
  .then(function(data) {
    var text = (data && data.content && data.content[0] && data.content[0].text)
      ? data.content[0].text.trim()
      : null;
    if (!text) throw new Error('Réponse Lambda vide');

    // Stocker en cache + save IDB
    var cNow = cl();
    if (cNow && cNow.id === clientIdAtLaunch) {
      setCachedDiagnostic(cNow, hash, text, sign);
      save();
    }
    _patchDiagnosticDiv(placeholderId, text, clientIdAtLaunch, false);
  })
  .catch(function(err) {
    console.warn('[ai_diagnostic] Lambda KO, fallback pré-rédigé :', err.message);
    _patchDiagnosticDiv(placeholderId, null, clientIdAtLaunch, true); // fallback
  });
}

/**
 * _patchDiagnosticDiv(placeholderId, content, clientIdAtLaunch, isFallback)
 * Patche le div id=placeholderId avec le contenu narratif.
 * C2 gardes :
 *   - Guard 1 : vérifier c.id === clientIdAtLaunch avant tout accès DOM
 *     (évite d'écrire la narrative client A sur l'écran client B après un switch)
 *   - Guard 2 : div === null → silencieux (toggle Free/Pro a supprimé le placeholder)
 */
function _patchDiagnosticDiv(placeholderId, content, clientIdAtLaunch, isFallback) {
  // Guard 1 — sécurité switch client
  var cCurrent = cl();
  if (!cCurrent || cCurrent.id !== clientIdAtLaunch) return;

  // Guard 2 — placeholder supprimé (toggle Free/Pro pendant génération)
  var div = document.getElementById(placeholderId);
  if (!div) return;

  if (content) {
    div.innerHTML = '<p class="yoy-section-para">' + esc(content) + '</p>'
      + (isFallback ? '' : '<div style="font-size:10px;color:var(--tx3);margin-top:6px">Généré par IA le '
        + new Date().toLocaleDateString('fr-FR') + ' · <button class="btn btn-xs" '
        + 'onclick="regenerateAIDiagnostic()" style="font-size:10px">↻ Régénérer</button></div>');
  } else {
    // Fallback (plan B 9.2) : narrative pré-rédigée en dur depuis renderYoYResult
    div.innerHTML = '<p class="yoy-section-para" style="color:var(--tx3);font-style:italic">'
      + 'Analyse causale non disponible (erreur réseau). Consultez les sections ci-dessus.</p>';
  }
}

/**
 * regenerateAIDiagnostic()
 * Bouton "Régénérer" — force régénération même si cache valide.
 */
function regenerateAIDiagnostic() {
  var c = cl(); if (!c) return;
  if (c.aiCache) c.aiCache.diagnosticV1 = null;
  save(); render();
}

// Exposer sur window
window.initAIDiagnostic = initAIDiagnostic;
window.regenerateAIDiagnostic = regenerateAIDiagnostic;
window.computeDiagnosticHash = computeDiagnosticHash;
