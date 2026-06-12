# Status Report Claude Code — v3.7.1
**Date :** 11 juin 2026
**Produit par :** Claude Code
**Destinataire :** Claude Orchestrateur

---

## RÉSUMÉ EXÉCUTIF

v3.7.1 livrée en **production** le 11 juin 2026.
Scope : Refacto archi — extraction `src/utils.js` + `src/idb.js` depuis core.js. Zéro changement fonctionnel.
Commits main : `0c16ce6` (utils) + `238f302` (idb + AUDIT) + `5d814f1` (context) | Tag : `v3.7.1` | CloudFront prod invalidation : Completed ✅

---

## CHANGEMENTS TECHNIQUES

### Nouveaux modules extraits de core.js

**`src/utils.js`** — 33 items (2 constantes + 31 fonctions pures/quasi-pures)
- Formateurs : `fmt`, `fmtEur`
- Normalisation : `norm`
- Parsing : `findCol`, `parseNum`, `parseMetadata`
- Scores santé ASIN : `calcHealth`, `calcHealthDeep`, `healthClass`, `calcSegment`, `getRevenue`, `getUnits`
- Fraîcheur : `getDataFreshness`, `getWeekDateRange`, `getISOWeek`, `daysSinceDate`, `clientFreshnessColor`, `getVCLink`
- Tendance : `calcTrend`, `calcTrendDeep`, `sparkline`, `trendBadge`
- Helpers HTML : `esc`, `shortName`, `consolidateAsins`, `getMainKeyword`, `deltaBadge`, `segBadge`, `pillH`, `getCurrentWeek`, `getChartColors`
- Fraîcheur enrichie : `getEnrichedFreshness`
- État congés : `isAway`

**`src/idb.js`** — 10 items (variables d'état + fonctions IDB)
- Variables : `let apiKey`, `let _db`
- Fonctions : `freshClient`, `openDB`, `async save`, `async load`, `async saveSmokeHistory`, `migrateXMLTitles`, `migrateSnapshotRevenue`, `saveApiKey`

### Impact core.js
| Métrique | v3.6.9.4 | v3.7.1 |
|---|---|---|
| Lignes | 10 962 | 10 019 |
| Variation | — | **-943 lignes (-8,6 %)** |

### build.py
- Lecture + injection `// @idb` (avant `// @utils`, avant `// @guide`)
- Artefact final : 991 Ko JS valide

---

## VALIDATION

| Point | Résultat |
|---|---|
| `node --check` | ✅ 991 Ko |
| Smoke Playwright | ✅ 27/30 — 3 échecs pré-existants (V7 smoke_history, V8e/V8f goToAsinsYoY) |
| Chrome automation preprod | ✅ Dashboard, Analyse comparée, ASINs, Buy Box, IDB (`getAiUsageStats`) |
| Console erreurs | ✅ Zéro |

---

## INVESTIGATION COMPLÉMENTAIRE (4 questions Fred — session même journée)

### Q1 — Lambda /ai/complete
- Lambda `amazon-pilot-api-prod` active, route `POST /ai/complete` opérationnelle
- `callAPI()` : try-Lambda (si idToken) → fallback direct browser (admin sans token)
- **Conclusion Phase 1** : centralisation déjà faite, pas de chantier préalable. Supprimer le fallback direct en prod = simple.

### Q2 — DynamoDB ap-usage-prod
- Schema : PK=`clientId`, SK=`usage#YYYY-MM` (PAY_PER_REQUEST)
- Payload actuel Lambda : `{ tokensIn, tokensOut, costEur, calls, byFeature: { [feature]: {...} } }`
- **Manque vs règle v3.6.9** : modèle par appel, périmètre ASIN/market, `inputHash`
- Table actuellement **vide** (ItemCount=0) — vérifier que `saveUsage().catch()` ne masque pas des erreurs silencieuses en prod
- **Conclusion** : structure absorbe le volume sans re-design ; Phase 1 = enrichir le payload existant

### Q3 — Structure callAPI
- Signature : `callAPI(sys, usr, feature, tools, maxTokens)` → `string`
- Arguments explicites, retour explicite ✅
- Side-effects : `aiUsage.record()` (écriture IDB local, dans idb.js depuis v3.7.1), lecture de `apiKey`/`API_BASE_URL`/`AI_MODELS` (globals lecture seule)
- **Conclusion** : préparation cache Phase 1 = triviale. Ajouter paramètre `inputHash` optionnel, passer au body Lambda. Attention : désactiver `aiUsage.record()` sur les hits cache (sinon double-comptage tokens fictifs).

### Q4 — Cognito + multi-users + plans
- Custom attributes existants : `custom:role`, `custom:modules`, `custom:clientId` (schéma présent mais non renseigné sur l'utilisateur actuel)
- **Absent** : `custom:plan` — n'existe pas dans le schéma Cognito
- 1 seul utilisateur (frochette@vitajardin.com, role=admin, modules=*, sans clientId)
- La Lambda a déjà `PLAN_QUOTAS` et `PLAN_FEATURES` codés, mais `user.plan` est toujours `undefined` → retombe sur `free` (ou `admin` si isAdmin)
- **Chantier Phase 1 complet** :
  1. Ajouter `custom:plan` au schéma Cognito
  2. Renseigner `custom:clientId` sur les users existants
  3. Valider que `saveUsage()` persiste effectivement (table vide = suspect)
  4. Seats : modèle le plus simple = 1 user Cognito par seat, même `custom:clientId`

---

## DETTE CONNUE (à traiter v3.7.x)

| Test | Diagnostic |
|---|---|
| V7 — `saveSmokeHistory` IDB v5 | Lié à IDB store ; potentiellement corrigé par extraction idb.js si le problème était d'ordre |
| V8e/V8f — `goToAsinsYoY` (CTA11/CTA12) | Logique navigation `asinView` — hors périmètre refacto |

---

## ÉTAT FINAL

| Environnement | Version | Commit | CloudFront |
|---|---|---|---|
| Production (main) | v3.7.1 | 238f302 | Invalidation Completed ✅ |
| Preprod | v3.7.1 | — | Invalidation Completed ✅ |
| Recette (staging) | v3.6.9.4 (inchangé) | — | — |
