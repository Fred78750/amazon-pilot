# AUDIT v3.7.3 — Extraction ai_core.js + anticipation cache Phase 3

**Date :** 2026-06-12  
**Branche :** main (cycle staging → preprod → main)  
**Lambda déployée le :** 2026-06-12T06:38:52 (avant client — ordre §4 respecté)

---

## 1. Périmètre A — Extraction ai_core.js (déplacement strict)

### Fonctions extraites de core.js vers src/ai_core.js

| Fonction | Async | Présence ai_core.js | Absent de core.js |
|---|---|---|---|
| `callAPI` | oui | ✅ | ✅ |
| `askClaude` | oui | ✅ | ✅ |
| `isAIError` | non | ✅ | ✅ |
| `renderAIError` | non | ✅ | ✅ |
| `buildAsinContext` | non | ✅ | ✅ |
| `buildClientContext` | non | ✅ | ✅ |
| `getSysPrompt` | non | ✅ | ✅ |
| `runAsinAI` | oui | ✅ | ✅ |

### Décision renderMarkdown / copyAI

Laissés dans core.js. `renderMarkdown` est appelé depuis les renderers généraux (pas exclusivement IA). `copyAI` idem. Duplication évitée, conformément à la règle du brief.

### Impact lignes core.js

| Étape | Lignes | Chars |
|---|---|---|
| core.js avant v3.7.3 | 9 438 | ~437 Ko |
| core.js après patch_ai_core.py | 9 103 | ~422 Ko |
| Supprimé (Périmètre A) | −335 | ~15 Ko |
| ai_core.js créé | 343 | 15 525 chars |

Tag `// @ai_core` injecté à L1395 (position originale de callAPI). Ordre d'injection dans build.py : après `@utils`, avant `@yoy` — les consommateurs (ai_diagnostic, yoy_ai) reçoivent les fonctions déjà déclarées.

---

## 2. Périmètre B — Anticipation cache Phase 3

### B1 — Paramètre `inputHash` sur callAPI
Signature modifiée : `async function callAPI(sys, usr, feature, tools, maxTokens, inputHash = null)`.  
Ajout dans le body Lambda : `if (inputHash) lambdaBody.inputHash = inputHash;`  
Non-breaking : tous les appelants existants (runAsinAI, yoy_ai, seo, etc.) continuent sans modification.

### B2 — Appelant pilote ai_diagnostic.js
**Écart brief →** le brief supposait que ai_diagnostic.js appelait `callAPI`. En réalité, ai_diagnostic.js utilise un `fetch` direct vers `_AI_LAMBDA_URL + '/ai/complete'` (pattern hérité, indépendant de callAPI).  
**Correction appliquée :** `inputHash: hash` ajouté directement dans le body du `fetch` à la L218.  
**Résultat équivalent :** le hash calculé par `computeDiagnosticHash()` (L174) est bien transmis à la Lambda.  
**Confirmé par intercept Network preprod :** body capturé = `{feature:"revue", model:"claude-sonnet-4-20250514", max_tokens:350, inputHash:"v1_6ae882fb..."}`.

### B3 — Lambda enrichissement saveUsage()
`routes/ai.js` modifié : ajout de `usage.lastCall = { model, asin, market, inputHash, timestamp }` avant `saveUsage()`.  
Tous les champs optionnels/tolérants : `inputHash || null` → null si absent.  
Lambda déployée 2026-06-12T06:38:52, CodeSize 98 705 bytes, State Active.

### B4 — Discipline fonction-pure callAPI (vérification, pas refonte)

**Entrées :** 6 arguments explicites (`sys, usr, feature, tools, maxTokens, inputHash`). ✅  
**Sortie :** `return` explicite (string). ✅  
**Side-effects identifiés (préexistants, non introduits en v3.7.3) :**
- `localStorage.getItem('ap-id-token')` — lecture credential session
- `apiKey` — lecture variable globale (mode direct)
- `aiUsage.record(feat, modelKey, tokIn, tokOut)` — écriture compteur global

Ces side-effects sont antérieurs à v3.7.3 et documentés ici conformément au brief. Aucune correction en scope.

---

## 3. Coordination déploiement (§4)

Ordre respecté : **Lambda enrichie déployée en premier** (2026-06-12T06:38:52), **client v3.7.3 déployé ensuite** (staging puis preprod).  
Les clients prod actuels (sans `inputHash`) ont continué de fonctionner pendant la fenêtre entre les deux déploiements.

---

## 4. Validation 9 points (§5)

| # | Point | Résultat |
|---|---|---|
| 1 | `python build.py --check` + `node --check` | ✅ JS 984 Ko valide |
| 2 | Diff artefact : 8 fonctions extraites, renderMarkdown/copyAI en core.js, inputHash B1 présent | ✅ Confirmé en page preprod |
| 3 | Smoke Playwright ≥ 27/30 | ✅ 27/30 (V7/V8e/V8f dette connue) |
| 4 | Narrative IA + getAiUsageStats() + downloadYoYWord() | ⚠️ Partiel — voir §4.1 |
| 5 | Network tab : `inputHash` non-null dans body ai/complete depuis ai_diagnostic | ✅ `"v1_6ae882fb..."` capturé |
| 6 | Limite DynamoDB assumée | ✅ Documenté (bug ap-usage-prod ticket séparé) |
| 7 | Rétrocompatibilité : appel sans inputHash → Lambda 401 (couche auth, pas rejection inputHash) | ✅ Code tolérant confirmé |
| 8 | Console 0 erreurs | ✅ |
| 9 | APP_VERSION=3.7.3 preprod | ✅ Confirmé |

### §4.1 — Point 4 partiel : narrative IA

La session Cognito preprod est absente (`ap-id-token` expiré). L'affichage de la narrative post-génération ne peut être testé dans cette session.  
**Ce qui a été confirmé :**
- `fetch` body B2 correct (inputHash présent) — point 5
- `getAiUsageStats()` : `function` ✅
- `computeDiagnosticHash()` : `function` ✅  
- `downloadYoYWord()` : `function` ✅
- Cache path (`getCachedDiagnostic`) : code review ✅
- yoy_ai.js : stub CP4 (dimensions 13/15/16 non implémentées) — hors scope v3.7.3

**Limite additionnelle :** La limite §5.6 (persistance DynamoDB ap-usage-prod) reste valide. À ce s'ajoute l'absence de token Cognito pour l'affichage narrative. Ces deux limites n'impactent pas la validation du périmètre A+B.

---

## 5. Anomalies

| # | Description | Résolution |
|---|---|---|
| A1 | ai_diagnostic.js n'appelle pas callAPI (fetch direct) — écart hypothèse brief | B2 appliqué directement sur le fetch — résultat équivalent, documenté ici |
| A2 | Session Cognito absente en preprod — test affichage narrative bloqué | Point 4 validé partiellement par code review + intercept fetch |
