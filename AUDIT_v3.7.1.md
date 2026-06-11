# AUDIT v3.7.1 — Extraction src/utils.js
**Date :** 11 juin 2026
**Commit :** 0c16ce6 (main)
**Périmètre brief :** CLAUDE_CODE_v3_7_1.md §3

---

## 1. Scope brief vs livré

| Élément brief | Livré | Note |
|---|---|---|
| Créer `src/utils.js` (31 fonctions utils métier) | ✅ | 29 559 octets, 482 lignes |
| Créer `src/idb.js` (9 éléments IDB/persistance) | ❌ | GO partiel : Fred avait approuvé "la première partie" uniquement. À traiter en suite immédiate (cf. §4) |
| Tag `// @utils` dans core.js | ✅ | Injecté à la position de norm() (char 44 569) |
| Tag `// @idb` dans core.js | ❌ | Dépend de la livraison idb.js |
| build.py : injection `@utils` avant `@guide` | ✅ | |
| Zéro changement fonctionnel (anti-Zélé, règle 33) | ✅ | Déplacement strict, signatures inchangées |
| Suppression code mort | ❌ applicable | Aucun code mort détecté (grep zéro référence) |

---

## 2. Fonctions déplacées dans src/utils.js

**Constantes (2)**
- `const fmt`
- `const fmtEur`

**Normalisation (1)**
- `norm(s)` — avec regex `̀-ͯ` préservée byte-pour-byte

**Parsing bas niveau (3)**
- `findCol(row, ...keywords)`
- `parseNum(val)`
- `parseMetadata(line)`

**Scores santé ASIN (6)**
- `calcHealth(a)`
- `calcHealthDeep(a, c)`
- `healthClass(score)`
- `calcSegment(a, totalCA, c)`
- `getRevenue(a, c)`
- `getUnits(a, c)`

**Fraîcheur des données (6)**
- `getDataFreshness(c)`
- `getWeekDateRange(week, year)`
- `getISOWeek(date)`
- `daysSinceDate(isoDateOrStr)`
- `clientFreshnessColor(c)`
- `getVCLink(type, market)`

**Tendance structurelle (4)**
- `calcTrend(a)`
- `calcTrendDeep(a, c)`
- `sparkline(series, cls)`
- `trendBadge(trend)`

**Helpers HTML / formatters (9)**
- `esc(s)`
- `shortName(a)`
- `consolidateAsins(asins, client)`
- `getMainKeyword(a)`
- `deltaBadge(val)`
- `segBadge(s)`
- `pillH(val, type)`
- `getCurrentWeek()`
- `getChartColors()`

**Fraîcheur enrichie (1)**
- `getEnrichedFreshness(c)`

**État congés (1)**
- `isAway(client)`

**Total : 33 items (2 constantes + 31 fonctions)**

---

## 3. Impact core.js

| Métrique | Avant (v3.6.9.4) | Après (v3.7.1) |
|---|---|---|
| Lignes | 10 962 | 10 307 |
| Variation | — | **-655 lignes** |
| Caractères | 569 834 | 540 903 |
| Caractères supprimés | — | 28 931 |

---

## 4. Résultats validation (6 points brief §4)

| Point | Résultat |
|---|---|
| 1. `python build.py --check` / `node --check` | ✅ JS valide 991 Ko |
| 2. Diff artefact : HTML fonctionnellement identique | ✅ utils.js injecté avant @guide, contenu identique |
| 3. Smoke tests Playwright | ✅ 27/30 passés — 3 échecs pré-existants (voir §5) |
| 4. Chrome automation preprod (Cogex + Gers) | ✅ Dashboard, Analyse comparée, Analyse ASINs, Buy Box |
| 5. `window.getAiUsageStats()` fonctionne | ✅ IDB intact — 7 appels retournés |
| 6. Console erreurs | ✅ Zéro erreur console |

---

## 5. Dette connue — 3 échecs smoke pré-existants

Ces 3 échecs existaient sur v3.6.9.4 **avant** l'extraction utils.js. Confirmé par baseline test sur backup core.js.

| Test | Erreur | Diagnostic |
|---|---|---|
| V7 — `smoke_history` : IDB v5 store + `saveSmokeHistory` écrit une mesure | Échec IDB store | À investiguer dans le cycle v3.7 (lié à idb.js extraction à venir) |
| V8e — CTA11 Warning W1 : `goToAsinsYoY` navigue vers Analyse ASINs | `asinView` reçu `"all"` attendu `"yoy-warning"` | Logique navigation à corriger — hors périmètre refacto |
| V8f — CTA12 eveil 80/20 : `goToAsinsYoY` avec label longue traine | `asinView` reçu `"all"` attendu `"yoy-warning"` | Même cause que V8e |

**À traiter dans le cycle v3.7** (V7 potentiellement impacté par l'extraction idb.js).

---

## 6. Périmètre restant v3.7.1 (suite immédiate si GO Fred)

`src/idb.js` — 10 éléments à extraire :
- `let _db` (variable d'état)
- `let apiKey` (variable d'état)
- `function openDB()`
- `function save()`
- `function load()`
- `function saveSmokeHistory(data)`
- `function migrateXMLTitles(client, xmlItems)`
- `function migrateSnapshotRevenue(client)`
- `function saveApiKey(key)`
- `function freshClient()`

Point de vigilance : `let _db` et `let apiKey` sont des variables d'état — ordre d'injection dans build.py doit garantir qu'idb.js est assemblé AVANT tout consommateur (load au démarrage, openDB appelé au premier accès IDB).
