# AUDIT_v3.7.5 — Extraction render_shell.js + render_screens.js + charts.js

**Date :** 12 juin 2026
**Version :** v3.7.5 (staging → preprod validé)
**Méthode :** déplacement strict, aucune modification fonctionnelle
**Testeur :** Claude Code + preprod `https://preprod.amazon.foliow.app`

---

## 1. Scope livré

| Artefact | Contenu | Taille |
|---|---|---|
| `src/render_shell.js` | 10 fonctions + 1 listener top-level | 261 L / 11 978 chars |
| `src/render_screens.js` | 10 fonctions écrans | 2 161 L / 140 616 chars |
| `src/charts.js` | 7 fonctions graphiques | 219 L / 10 638 chars |
| `src/core.js` (patché) | 7 975 L → 5 368 L | −2 607 L |
| `amazon-pilot-latest.html` (build) | artefact final | 985 Ko |

### Fonctions déplacées vers `render_shell.js`
`render`, `renderNav`, `renderClients`, `renderTopbar`, `renderContent`,
`go`, `goAgentVC`, `goFilteredAsins`, `goToAsinsYoY`, `yoyGoBack`
+ listener top-level `window.addEventListener('popstate', ...)`

### Fonctions déplacées vers `render_screens.js`
`renderYTDComparison`, `renderFreshnessBanner`, `renderWelcome`, `renderOnboarding`,
`renderImport`, `renderWeeklyReview`, `renderDashboard`, `renderCaseModal`,
`renderAsins`, `renderPompier`

### Fonctions déplacées vers `charts.js`
`buildWeeklyConsolidated`, `buildMonthlyConsolidated`, `buildN1Series`,
`buildDashWeeklyChartConfig`, `initDashWeeklyChart`, `getMarketTabs`, `renderMarketTabs`

### Tags d'injection build.py
```python
js = js.replace('// @render_shell\n',   render_shell + '\n')
js = js.replace('// @render_screens\n', render_screens + '\n')
js = js.replace('// @charts\n',         charts + '\n')
```
Ordre : après `@s3_poll`, avant `@guide` — les 3 modules render/charts consomment
tous les blocs précédents (utils, idb, parsers, ai_core, import_export, s3_poll).

---

## 2. Décisions de périmètre

### `yoyGoBack` — verdict : indépendante, globale
`yoyGoBack` est une fonction top-level indépendante (L7578–L7583 dans core.js avant patch),
NON imbriquée dans `goToAsinsYoY`. Elle est invoquée par onclick inline
`onclick="yoyGoBack()"` depuis le bandeau "← Analyse comparée" généré dans `renderAsins`.
Mécanisme d'exposition : déclaration `function yoyGoBack()` → hoisting global → pas de
`window.yoyGoBack =` nécessaire. Comportement préservé à l'identique après déplacement.

### `renderMarkdown` — verdict : reste dans core.js
4 appels dans le code, tous sur `aiResult` IA :
- `renderWeeklyReview` L2433 (désormais render_screens.js)
- `renderAsins` L3726, L3786
- `renderPompier` L3876

Usage exclusivement IA/texte → conforme à la décision v3.7.3 "usage partagé IA+render → core".
`renderMarkdown` accédée cross-module via hoisting global, sans modification.

### `window.addEventListener('popstate', ...)` — listener top-level
Code top-level déplacé en fin de `render_shell.js`. Il s'exécute une seule fois à l'injection
du bundle (ordre garanti après toutes les fonctions dont il dépend : `go`, `goFilteredAsins`).
Aucun risque de double-enregistrement (la ligne est retirée de core.js).

### `renderMarketTabs` — point d'appel
Appelée depuis `renderAsins` (lignes 1312, 1557 dans render_screens.js) et depuis
`renderWeeklyReview` (L2047). Non appelée depuis `renderDashboard`.
Validation preprod Gers (9 marchés) : onglets présents dans l'écran Analyse ASINs,
`getMarketTabs` retourne les 9 marchés triés par CA. ✓

---

## 3. Variables et listeners top-level déplacés

| Élément | Origine (core.js) | Destination | Nature |
|---|---|---|---|
| `window.addEventListener('popstate', ...)` | L7586–L7603 | `render_shell.js` (fin) | Listener top-level |

Variables de navigation référencées dans render_shell.js, maintenues dans core.js (globals) :
`_yoyReturnCtx`, `asinViewCustomIds`, `asinViewLabel`, `agentVCParam`

---

## 4. Validation — 8 points

### §2.1 Build + syntaxe JS
```
python build.py --version 3.7.5  →  JS valide (985 Ko)
node --check /tmp/ap_check.js    →  OK
```
✓

### §2.2 Artefact fonctionnellement identique
Diff structurel : 27 fonctions retirées de core.js, 3 nouveaux modules injectés.
Build v3.7.4 = 985 Ko, v3.7.5 = 985 Ko — delta nul (déplacement pur, pas d'ajout de code).
✓

### §2.3 Smoke Playwright
27/30 — V7, V8e, V8f : dettes pré-existantes non régressées (score identique v3.7.4).
✓

### §2.4 Parcours complet Chrome preprod — Cogex (9 marchés, 1 814 ASINs)
- Welcome → Dashboard : canvas rendu, `initDashWeeklyChart` appelé ✓
- Revue Hebdo : `renderWeeklyReview` ✓
- Analyse ASINs : `renderAsins`, sélection ASIN B009G3EMDI, détail rendu ✓
- Analyse comparée (YoY) : `go('yoy')`, contenu présent ✓
- Buy Box : `renderBuyBox` ✓
- Agent SEO : `renderSEOScreen` ✓
- Configuration : `renderConfig` ✓
✓

### §2.5 Parcours Gers — Dashboard → Analyse ASINs → Buy Box
- 4 729 ASINs, 9 marchés (.fr/.es/.de/.it/.nl/.be/.co.uk/.pl/.se)
- Titres FR intacts : `firstAsinTitle = "Sitram Batterie"` ✓
- Dashboard + canvas ✓, Analyse ASINs ✓, Buy Box ✓
✓

### §2.6 Navigation goFilteredAsins → yoyGoBack → popstate × 3
| Transition | Action | Résultat |
|---|---|---|
| 1 | `goToAsinsYoY(['B001TEST','B002TEST','B003TEST'], 'W1')` | screen=asins, asinView=yoy-warning, customIds=3 ✓ |
| 2 | `history.back()` (popstate `_yoyPage`) | screen=yoy, _yoyReturnCtx=null ✓ |
| 3 | `history.forward()` (popstate `_asinsFromYoy`) | screen=asins, asinView=yoy-warning, customIds=3, label restauré ✓ |
| 4 | `history.back()` #2 | screen=yoy ✓ |

`noScreenBlank: true`, `noStateCorruption: true`. Aucune perte d'état, aucun écran blanc.
✓

### §2.7 Theme toggle + renderMarketTabs
- `renderMarketTabs(gersClient, 'all')` : output 3 341 chars, onglets "Tous" + ".fr" + 8 autres ✓
- `getMarketTabs(gersClient)` : 9 tabs triés par CA, totalRev calculé ✓
- `toggleTheme` : présent dans global scope ✓
✓

### §2.8 Console zéro erreur
0 erreur, 0 warning capturés sur :
- Cogex : dashboard, revue hebdo, analyse ASINs, config
- Gers : dashboard (4 729 ASINs), analyse ASINs
✓

---

## 5. Bilan de cycle — contenu résiduel core.js

**État final : 5 368 L, 140 fonctions** (après extraction des 4 sprints v3.7.1–v3.7.5)

### Blocs identifiés restants

| Bloc | Fonctions représentatives | ~Lignes |
|---|---|---|
| Globals + variables d'état | `APP_VERSION`, `clients`, `screen`, `activeId`, `filters`, `_yoyReturnCtx`, `pendingFiles`, `debugLog`... | ~100 L |
| Init + helpers UI | `init`, `debouncedRender`, `triggerSearch`, `selClient`, `log`, `showToast`, `showImportSuccess`, `toggleTheme`, `updateThemeIcon` | ~250 L |
| Wizard / Clients | `startOnboarding`, `finishOnboarding`, `wizGo`, `wizNext`, `wizAddBrand`, `wizHandleXML`, `openWizard`, `closeWizard`, `addClientAccount`, `removeClientAccount`, `updClient`, 15+ fonctions wizard VC | ~700 L |
| Fiche Amazon / GPT / Challenge | `renderFiche`, `saveFicheAmazon`, `saveFicheChallenge`, `analyzeAsin`, `parseChallengeResponse`, `runChallengeGPT`, `buildCaseText`, `ficheHandleXML`, `copyAI`, `generateFullScript` | ~800 L |
| Appros / Forecast / Actions | `renderAppros`, `renderApprosForecast`, `renderApprosResults`, `calcAppro`, `generateWeeklyActions`, `generateMonthlyActions`, `renderPotentiel`, `calcPotential`, `toggleAction`, `runApprosIA`, `handleForecastFile`, `parseForecastFile` | ~900 L |
| PO management | `getPOData`, `getPOsForAsin`, `parsePOFile`, `handlePOFile`, `findPOCol`, `deletePOs`, `recRow` | ~300 L |
| Export divers | `exportAsinsCsv`, `exportApprosCsv`, `exportViewCsv`, `exportXLSX`, `exportPOsXlsx`, `exportPompierCsv`, 8+ fonctions | ~400 L |
| Charts intégrés (BuyBox + History) | `initChart`, `initSegChart`, `initHistoryChart` | ~300 L |
| Agent VC + SEO helpers | `renderAgent`, `renderSEOSection`, `publishVC`, `launchChromeAnalysis` | ~200 L |
| Config / Settings | `renderConfig`, `clearApiKey`, `saveApiKeyFromInput` | ~120 L |
| Misc (ASIN / marketplace) | `selectAsin`, `setFilter`, `resetFilters`, `getFilteredAsins`, `setHistoryView`, `openAmazonProduct`, `openAmazonSearch`, `marketOptionsHTML`, `parseDateFlex` | ~300 L |

### Candidats naturels pour un sprint futur

- **`src/wizard.js`** — Wizard/Clients : 30+ fonctions, bloc cohérent, faible couplage externe
- **`src/appros.js`** — Appros/Forecast + renderAppros : bloc le plus volumineux (~900 L), render + logique métier propre
- **`src/fiche_amazon.js`** — Fiche Amazon/GPT/Challenge : 10+ fonctions, périmètre délimité

### Verdict cycle

Le **bloc 1 (refacto incrémentale)** est clos avec v3.7.5 : core.js est passé de
**9 832 L** (v3.7.0, avant cycle) à **5 368 L** (v3.7.5) — **−4 464 L (−45 %)**.
Un v3.7.5.b ciblé sur wizard/clients (~700 L) est réalisable en 1 sprint sans risque
(fonctions peu couplées aux renders). Appros (~900 L) et Fiche Amazon (~800 L) sont
des sprints plus lourds, adaptés au bloc 2 après v3.7.6 (audit performance).

---

## 6. Incidents de développement

| Incident | Correction |
|---|---|
| Console cp1252 Python (caractères Unicode dans print) | `PYTHONIOENCODING=utf-8` |
| Preprod encore sur v3.7.4 après invalidation | `location.reload(true)` forçant hard refresh |
| Timeout CDP sur tour multi-écrans Gers 4 729 ASINs | Split en blocs courts (<5 écrans, délais 300 ms) |
| renderMarketTabs non détecté dans dashboard | Présent dans renderAsins (pas renderDashboard) — vérifié par appel direct |

---

## 7. Conclusion

Déplacement strict réussi. Les 27 fonctions render/navigation/charts sont opérationnelles
dans leurs 3 nouveaux modules. `core.js` réduit de 2 607 L.
Point dur §2.6 validé : chaîne goToAsinsYoY → history.back/forward × 3 transitions,
aucune perte d'état. Prêt pour GO Fred → merge main → prod → tag v3.7.5.
