# INVENTAIRE_CODE_v3_6_9_4.md
**Version :** v3.6.9.4 — 9 juin 2026
**Produit par :** Claude Code
**Destinataire :** Claude Orchestrateur — brief refacto v3.7

---

## 1. ARBORESCENCE src/ — TAILLES ET LIGNES

| Fichier | Lignes | Octets |
|---|---|---|
| `src/core.js` | 10 962 | 594 840 |
| `src/yoy.js` | 2 506 | 133 510 |
| `src/seo.js` | 1 933 | 114 601 |
| `src/buybox.js` | 918 | 50 812 |
| `src/yoy_enquete.js` | 492 | 27 631 |
| `src/word_export.js` | 418 | 22 079 |
| `src/guide_asn.js` | 1 | 21 475 (binaire/généré) |
| `src/parser_vc.js` | 379 | 20 784 |
| `src/ai_diagnostic.js` | 374 | 16 929 |
| `src/smoke.js` | 298 | 18 029 |
| `src/parser_po.js` | 288 | 12 606 |
| `src/parser_erp.js` | 272 | 14 773 |
| `src/yoy_ai.js` | 63 | 3 206 |
| `src/shell.html` | 99 | — |
| `src/styles.css` | 644 | — |
| **templates/** | | |
| `src/templates/yoy_performance.js` | 63 | 4 700 |
| `src/templates/yoy_conclusion.js` | 54 | 4 561 |
| `src/templates/yoy_marques.js` | 57 | 3 974 |
| `src/templates/yoy_catalogue.js` | 43 | 3 412 |
| `src/templates/yoy_top_mouvements.js` | 40 | 2 925 |
| `src/templates/yoy_concentration.js` | 31 | 2 372 |
| `src/templates/yoy_anomalies.js` | 29 | 1 759 |

**Total src/ JS :** ~19 660 lignes source (hors CSS, HTML)

---

## 2. ARBORESCENCE RACINE — FICHIERS CLÉS

| Fichier | Lignes | Nature |
|---|---|---|
| `amazon-pilot-latest.html` | 19 944 | Build artifact (1,07 MB) — ne pas éditer directement |
| `tests/smoke.spec.js` | 887 | Playwright smoke tests |
| `build.py` | 138 | Script de build (assemblage) |
| `CLAUDE_CODE_CONTEXT.md` | 635 | Référence Claude Code |
| `Claude_Orchestrateur_Context.md` | 888 | Référence Orchestrateur |
| `AMAZON_PILOT_REFERENCE.md` | 376 | Référence produit |
| `SOP_HYPOTHESES_AMAZON_PILOT.md` | 1 481 | Fiches Enquête A2/D1/D2/R |
| `lambda/` | — | Lambda AWS (package-lock.json 1 588 L) |
| `.github/workflows/deploy.yml` | 34 | CI staging auto |
| `.github/workflows/deploy-staging.yml` | 34 | CI staging |
| `.github/workflows/deploy-preprod.yml` | 35 | CI preprod (BTI-1 — ABSENT côté deploy réel) |
| `amazon-pilot-v3.x.y.html` | 11k–20k | Archives versionnées (ne pas toucher) |

---

## 3. RÉSUMÉ build.py — ORDRE D'ASSEMBLAGE

`build.py` lit tous les fichiers `src/` et produit `amazon-pilot-latest.html` + `amazon-pilot-v{version}.html`.

### Ordre de lecture des modules

```
1. shell.html          ← structure HTML de base (contient les placeholders)
2. styles.css          ← injecté dans /* @styles */
3. core.js             ← racine JS — contient les placeholders // @xxx
4. buybox.js
5. seo.js
6. smoke.js
7. guide_asn.js
8. parser_erp.js
9. parser_vc.js
10. yoy_enquete.js     ← VC_AVAILABILITY_CODES + algo classification ASIN disparus
11. parser_po.js
12. ai_diagnostic.js   ← narrative IA Cause la plus probable + cache IDB
13. yoy.js
14. src/templates/yoy_*.js  ← triés alphabétiquement (7 fichiers)
15. yoy_ai.js
16. word_export.js     ← export Word CTA 13 (lazy-load OOXML)
```

### Ordre d'injection dans core.js (via `// @tag`)

```
// @guide        → guide_asn.js
// @parser_erp   → parser_erp.js
// @parser_vc    → parser_vc.js
// @smoke        → smoke.js (sans runSmokeTestManual)
// @buybox       → buybox.js
// @seo          → seo.js
// @yoy          → yoy_enquete + parser_po + ai_diagnostic + yoy + templates/* + yoy_ai + word_export
// @smoke_manual → runSmokeTestManual() seul
```

### Comportement

- `strip_header()` supprime les commentaires `// Amazon Pilot`, `// Extrait`, `// Régénéré` en tête de chaque fichier
- `APP_VERSION` dans `core.js` est patchée par regex lors du build
- Validation finale `node --check` sur le JS assemblé avant écriture
- `--check` : validation sans écriture ; `--version X.Y.Z` : version explicite

---

## 4. FONCTIONS GLOBALES — TOP 5 FICHIERS JS

### 4.1 core.js (10 962 L — 580 Ko)

Organisé en blocs fonctionnels :

**Init / globals**
```
window.onerror, window.addEventListener('unhandledrejection')
debouncedRender(), triggerSearch(), marketOptionsHTML()
```

**Parsers CSV/XML (internes)**
```
parseMatriceTarifXML()     ← XML → c.catalogueXML (titres)
parseMatriceTarif()        ← XML → c.catalogue (SKU/prix only — PAS de titres)
parseCSVBuyBox()
parseDeliveryDefectsCSV()
parseAppointmentsCSV()
parseCSVFile()             ← dispatcher principal (délègue à parser_vc.js)
_parseCSVFile_LEGACY_UNUSED()
```

**IDB / persistance**
```
openDB()                   ← IDB v6 (stores: clients, smoke_history, ai_usage_log)
save(), load()
saveSmokeHistory()         [async]
migrateXMLTitles()         ← enrichissement titres au démarrage depuis catalogueXML
migrateSnapshotRevenue()
saveApiKey()
freshClient()
```

**Utils métier**
```
norm(), findCol(), parseNum(), parseMetadata()
detectFileType(), detectPeriodType()
calcHealth(), calcHealthDeep(), healthClass()
calcSegment(), getRevenue(), getUnits()
getDataFreshness(), clientFreshnessColor()
getWeekDateRange(), getISOWeek(), daysSinceDate()
getVCLink()
calcTrend(), calcTrendDeep()
sparkline(), trendBadge(), deltaBadge(), segBadge(), pillH()
esc(), shortName(), consolidateAsins(), getMainKeyword()
getCurrentWeek(), getChartColors()
```

**IA / API**
```
callAPI()                  [async] ← appel Lambda (Authorization + messages[] + feature + model)
askClaude()                [async]
isAIError(), renderAIError()
buildAsinContext(), buildClientContext(), getSysPrompt()
runAsinAI()                [async]
renderMarkdown(), copyAI()
```

**Fiche Amazon / GPT / Challenge**
```
toggleFicheAmazon(), saveFicheAmazon(), saveFicheGPT(), saveFicheChallenge()
exportExemplesGPT(), runChallengeGPT() [async]
parseChallengeResponse()
updateFusionField(), copyFicheFusion(), clearAllFicheChallenge()
```

**Render principal**
```
render()                   ← dispatcher UI central
renderNav(), renderClients(), renderTopbar(), renderContent()
renderWelcome(), renderOnboarding(), renderImport()
renderDashboard(), renderWeeklyReview()
renderAsins(), renderPompier()
renderYTDComparison(), renderFreshnessBanner()
renderCaseModal()
renderMarkdown()
```

**Charts**
```
buildWeeklyConsolidated(), buildMonthlyConsolidated()
buildN1Series(), buildDashWeeklyChartConfig()
initDashWeeklyChart()
getMarketTabs(), renderMarketTabs()
```

**Actions / génération contenu**
```
generateWeeklyActions(), generateMonthlyActions()
buildCaseText()
buildAsinContext(), buildClientContext()
generateFullScript(), copyFullScript()
```

**Navigation / routing**
```
go(), goAgentVC()
goFilteredAsins()          ← preset 'yoy-warning' + filtres ASIN custom
goToAsinsYoY()
yoyGoBack()
window.addEventListener('popstate')
```

**Gestion clients**
```
selClient(), startOnboarding()
wizGo(), wizNext(), wizBack(), finishOnboarding()
wizAddBrand(), wizSetBrandRole(), wizRemoveBrand()
wizAddAccount(), wizRemoveAccount()
wizHandleXML()             ← wizard only → c.catalogueXML
ficheHandleXML()           ← fiche client → c.catalogueXML + re-enrichissement titres
ncSet(), updClient(), deleteClient()
setFilter(), resetFilters(), setKpiPrimaire()
selectAsin(), analyzeAsin()
toggleMarket(), toggleClientMarket()
addClientAccount(), removeClientAccount(), updateClientAccount()
```

**Import / export**
```
mergeImportData()          ← pivot central d'intégration (VC + ERP + PO + historique)
processImport(), confirmImport(), cancelImport()
handleBannerCSV(), handlePOImport(), parsePOCSV(), mergePOData()
handleHistCSVImport(), handleHistCSV(), handleMultiCSV()
checkImportCoherence()
exportClient(), exportAllData(), importAllData()
clearPending()
```

**S3 / polling**
```
getS3Config(), saveS3Config()
getS3Key(), getS3PresignedUrl() [async]
activateS3Poll(), startS3Poll(), stopS3Poll(), pollS3Imports() [async]
```

**Misc**
```
log(), showToast(), showImportSuccess()
toggleTheme(), updateThemeIcon()
toggleAction(), toggleMonthlyAction()
addManualAction(), regenerateActions()
setAway(), clearAway(), isAway()
deleteAnnualData(), deleteYTDData()
saveApiKeyFromInput(), clearApiKey()
initDragDrop()
getAmazonProductUrl(), openAmazonProduct(), openAmazonSearch(), openAmazonBestSellers()
launchChromeAnalysis()
copyPrompt(), copyText()
publishVC()
wizardNextStep(), wizardRunSEO(), wizardRunChallenge()
wizardSave(), wizardSaveAndChoose(), wizardSaveAndPublish()
updateWizardField()
fgEl(), fgSel(), recRow()
calcAppro()                ← algo appro (PO + ERP + VC)
getEnrichedFreshness()
init()                     [async] ← point d'entrée app
```

---

### 4.2 yoy.js (2 506 L — 130 Ko)

```
renderYoY()                    ← dispatcher YoY
renderYoYNoClient()
renderYoYImport()
renderYoYProgress()
renderYoYResult()              ← rendu principal analyse complète
renderYoYToggle()
renderYoYWarningCards()        ← cards W1/W2/W3 rouge/orange
renderAnalyseFamille()         ← tableau Pro analyse par famille (v3.6.9)
calcYoYWarnings()              ← évalue dim1/dim7/dim9 → W1/W2/W3
calcEveil8020()                ← détection érosion longue traîne
renderEveil8020Block()         [window.] ← pavé orange CTA 12
yoyLaunchAnalysis()            [async] ← lance calcul + IA narrative
yoyComputeTotals()
yoyComputeDimensions()         ← 9 dimensions principales
yoyFusionnerMarques()
yoyCasVCFusion()
yoyAddAliasPrompt()
yoyDeleteAlias()
toggleYoYViewMode()
yoyBandeauPro()
yoyClearZone()
yoyHandleDrop()
parseYoYFile(), parseYoYCSV(), parseYoYXLSX()
detectYoYPeriodFromFilename(), detectYoYPeriodFromContent()
yoyNormalizeRow(), yoyNormalizeHeader(), yoyBuildHeaderMap()
yoyValidateHeaders(), yoyFilterRows(), yoyComputeMeta()
yoyFormatPeriodLabel()
yoySanityCheck(), yoyUpdateSanityRecap()
yoyBack(), yoyLoadFromHistory()
yoySave()                      [async]
yoyLoadAll()                   [async]
yoyLoadOne()                   [async]
yoyUUID(), yoySleep()
yoyFmtEur(), yoyFmtPct(), yoyFmtPts(), yoyFmtEurSigned(), yoyFmtNum()
yoyGetSign(), yoyDeltaClass(), yoySignColor()
yoyLevenshtein(), yoySimilarity()
```

---

### 4.3 seo.js (1 933 L — 112 Ko)

```
seoGetPendingVerifications()
seoGetStatus(), seoStatusLabel()
seoRecordAction()
buildVCModifyPrompt()          ← prompt VC Modify (gros prompt structuré)
seoGetScriptVerify()
seoLaunchModify(), seoLaunchCreate(), seoLaunchVerify()
seoOpenCase()
copySEOField()
calcSEODefaillance()
openSEODrawer(), closeSEODrawer(), renderSEODrawer()
renderSEOScreen()
seoSearchInput(), seoSearchGo()
seoLaunchNewRef()
renderAgentVC()               ← Agent VC (optimisation wizard multi-étapes)
avcToggleStep()
avcLookupAsin(), avcToggleNewForm(), avcCheckNew()
avcConfirmNew(), avcConfirmMarket(), avcConfirmSKU()
avcLaunchSEO(), avcCopyScript(), avcMarkDone()
avcStepWrap()
refreshSEODrawer()
drawSEOContent()
copySEOTitreMkt(), copySEODescMkt(), copySEOBkwMkt()
renderChallengeGPT()
seoSetInternalRef()
seoMarkVerified(), seoMarkVCDone()
buildDonneesMarche()
buildSEOPrompt()               ← prompt SEO optimisation (gros prompt)
seoSetMotcle(), seoResetMotcle()
extractSearchKeyword()
seoFetchDefinition()           [async]
seoFetchFiche()                [async]
extractMotsTitreBullets()
parseSEOResponse()
renderOptimisationWizard()     ← wizard SEO multi-étapes
renderWizardStep()
cleanFusionValue()
renderFicheEditable()
sleep()
```

---

### 4.4 buybox.js (918 L — 50 Ko)

```
fmtNum()
calcBuyBoxAlerts()             ← évalue ASINs suspects (BB-1 à BB-12)
buyboxGenId()
buyboxGetCases(), buyboxGetCase()
buyboxOpenCase()
buyboxUpdateHypothesis()
buyboxAddJournalEntry()
buyboxCheckConclusionReady()
buyboxCloseCase()
buyboxAutoEvaluateHypotheses() ← auto-éval BB-1..BB-12 depuis données IDB
computeBuyboxFacts()           ← extrait 20+ facts ASIN depuis c
buyboxCauseLabel()
renderBuyBox()                 ← écran Buy Box principal
renderBuyBoxCase()             ← vue détail cas
```

---

### 4.5 yoy_enquete.js (492 L — 27 Ko)

Exports `window.*` explicites :

```
normalizeBrand()               [window.]
resolveBrandAlias()            [window.]
calcBrandAggs()                [window.]
classifyMissingASINs()         [window.] ← algo 9 codes → 3 catégories (Arrêt/Problème/Transition)
renderEnqueteSection()         [window.] ← section Enquête dans YoY
toggleEnqueteRow()             [window.]
_enquetePosHash()              ← interne (hash cache position)
VC_AVAILABILITY_CODES          [window.] ← table codes dispo VC (définitive)
```

---

## 5. MODULES SECONDAIRES — SYNOPSIS

| Fichier | Rôle principal |
|---|---|
| `parser_vc.js` | Parse CSV Vendor Central multi-pays (EN canonique + FR supplétif, 5 types, agrégation 1 ligne/ASIN, priorité FR titre v3.6.9.4) |
| `parser_erp.js` | Parse XLSX ERP (sheets priority, ERP_COL_SYNONYMS, support Gers header décalé) |
| `parser_po.js` | Parse POItemExport Amazon (32 colonnes FR+EN, BOM UTF-8, dates DD-MonAbbr-YYYY) |
| `ai_diagnostic.js` | Narrative IA "Cause la plus probable" (cache IDB ai_cache.diagnosticV1, hash 9 champs, logging ai_usage_log) |
| `word_export.js` | Export Word CTA 13 (OOXML self-contained, ZIP encoder intégré, pas de CDN) |
| `smoke.js` | Smoke tests in-app (runSmokeTest, saveSmokeHistory, SMOKE_REF_BY_CLIENT, IDB v5 collecte historique) |
| `yoy_ai.js` | Wrapper appel IA pour narratif YoY (63 L) |
| `guide_asn.js` | Guide ASN (1 L — contenu injecté au build) |
| `templates/yoy_*.js` | 7 templates HTML Free des sections YoY (performance, marques, catalogue, concentration, top_mouvements, anomalies, conclusion) |
