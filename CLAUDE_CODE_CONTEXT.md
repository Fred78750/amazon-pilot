# CLAUDE_CODE_CONTEXT.md
**Fichier vivant — mis à jour à chaque fin de session**
**Dernière mise à jour :** 29 mai 2026 (v3.6.8.8 PREPROD — YoY Étape 3a Enquête ASINs + parser_po + pattern retour + 9 fixes onclick JSON.stringify)

---

# ⛔ RÈGLES ANTI-RÉGRESSION — PRIORITÉ ABSOLUE

Ces règles s'appliquent à CHAQUE commit, sans exception, même pour un patch d'une ligne.

## 1. CHECKLIST OBLIGATOIRE AVANT TOUT PUSH

Claude Code doit exécuter CE CHECKLIST dans l'ordre avant chaque `git push` :

### Validation code
- [ ] `node --check src/seo.js` → doit retourner OK
- [ ] `node --check src/core.js` → doit retourner OK
- [ ] `python build.py` → vérifier taille JS (écart max ±10% vs version précédente)
- [ ] `node --check amazon-pilot-vX.Y.Z.html` → doit retourner OK

### Test smoke sur preprod (OBLIGATOIRE après chaque déploiement)
Claude Code ouvre preprod avec Claude in Chrome et vérifie :
- [ ] Un ASIN avec fiche déjà générée s'affiche correctement (titre non vide, bullets présents)
- [ ] La synthèse stratégique est visible (POSITIONNEMENT, LEVIERS, ERREURS, OPPORTUNITÉ)
- [ ] Console DevTools → zéro erreur JS rouge
- [ ] Le bouton "Générer la fiche" fonctionne sur un nouvel ASIN

Si UN SEUL point échoue → REVERT IMMÉDIAT + rapport à Fred + STOP.

## 2. RÈGLE PATCH DE DEBUG

Tout patch contenant des `console.log` de debug :
- NE JAMAIS commiter directement dans staging
- Créer une branche `debug/xxx` séparée
- Supprimer TOUS les console.log avant le push final vers staging
- Re-valider le checklist complet après suppression

## 3. RÈGLE REVERT IMMÉDIAT

En cas de régression constatée (rendu cassé, erreur JS, données vides) :
1. `git revert HEAD --no-edit` immédiatement
2. Redéployer la version stable sur staging ET preprod
3. Rapport détaillé à Fred
4. STOP — ne pas tenter de corriger par-dessus un bug

```bash
# Commande revert standard
git revert HEAD --no-edit
git push origin staging
python build.py --version [version-stable]
aws s3 cp amazon-pilot-v[version-stable].html s3://amazon-pilot-recette/index.html \
  --cache-control "no-cache,no-store,must-revalidate"
aws s3 cp amazon-pilot-v[version-stable].html s3://amazon-pilot-preprod/index.html \
  --cache-control "no-cache,no-store,must-revalidate"
aws cloudfront create-invalidation --distribution-id EVQ30COFUNGA7 --paths "/*"
aws cloudfront create-invalidation --distribution-id E3CODYJ437XKU5 --paths "/*"
```

## 4. RÈGLE PATCH CIBLÉ

Tout patch doit être minimal et ciblé :
- Un patch = une correction = un commit
- Ne jamais grouper plusieurs corrections non liées dans un même commit
- Si le patch touche `drawSEOContent` ou `parseSEOResponse` → test smoke obligatoire
  sur un ASIN avec fiche déjà générée ET sur une nouvelle génération

## 6. RÈGLE SSOT FRAÎCHEUR (gravée v3.6.8.9 — 29 mai 2026)

**Avant tout code touchant la fraîcheur/import, appeler `getEnrichedFreshness` ou `getDataFreshness`. Jamais recalculer depuis `c.pos`, `c.forecastData`, `c.ppmData` ou `c.ytdData` directement dans une fonction de rendu.**

- Source de vérité : `getDataFreshness(c)` pour ventes/trafic/stock (hebdo)
- Source enrichie : `getEnrichedFreshness(c)` pour tous types (POs, FC, PPM, YTD, Appros)
- Symptôme à éviter : deux écrans du même client affichant des dates divergentes au même instant

## 7. RÈGLE FACTORISATION GÉNÉRALE (gravée v3.6.8.9 — 29 mai 2026)

**Toute logique métier (calcul, format, normalisation, parsing, construction URL) DOIT être extraite en utilitaire partagé dès qu'elle apparaît à plus de 1 endroit. Avant ajout d'une 2e implémentation, extraction obligatoire.**

- Helper existants : `daysSinceDate(isoDate)`, `getISOWeek(date)`, `yoyFmtEur(v)`, `esc(s)`, etc.
- Critère de revue automatique avant commit : chercher `Math.floor.*86400000` (daysSince), `JSON.stringify.*onclick` (pattern cassé), `c\.pos\.\|c\.forecastData\.\|c\.ppmData\.` dans les render functions

## 8. RÈGLES MÉTIER CAPITALISÉES

| Règle | Valeur | Décision |
|---|---|---|
| Prévisions Amazon (Forecast) — tolérance fraîcheur | **Bimensuel (2 semaines OK)** — Amazon édite les forecasts tous les 15j, pas chaque semaine | Fred, 29 mai 2026 |
| POs (Bons de commande) — fraîcheur | **Libre (ok < 90j, stale < 180j)** — import ad-hoc selon arrivée BdC, pas hebdomadaire | Fred, 29 mai 2026 |
| `JSON.stringify(string)` dans `onclick="..."` | **TOUJOURS cassé** — utiliser `'\'' + str + '\''` ou `.replace(/"/g,'&quot;')` | Règle technique v3.6.8.8 |

## 5. VERSIONS STABLES DE RÉFÉRENCE

| Version | Statut | Hash git |
|---------|--------|----------|
| v3.4.27 | ✅ Stable | d9738ca |
| v3.4.28 | ✅ Stable | d747085 |
| v3.4.29 | ✅ Stable | 201fadc |
| v3.4.30 | ✅ Stable | 6a37a60 |
| v3.4.31 | ✅ Stable | d127eae |
| v3.4.32 | ⛔ Annulé (bug données) | 3a2f3ad |
| v3.4.29 (wizard) | ✅ Stable | 393b553 |
| v3.4.30 (wizard) | ✅ Stable | 8845fb0 |
| v3.4.31 (wizard) | ✅ Stable | b7a668b |
| v3.4.41 | ✅ Stable | cd3e709 |
| v3.5.1 | ✅ Stable | — |
| v3.5.2 | ✅ Stable | — |
| v3.5.3 | ✅ Stable | 56e8dcc |
| v3.5.4 | ✅ Stable | e4ee36e |
| v3.5.5 | ✅ Stable | 8f0e5b4 |
| v3.5.6 | ✅ Stable | bca06c2 |
| v3.5.7 | ✅ Stable | 61f0725 |
| v3.5.8 | ✅ Stable | 6d63e15 |
| v3.5.9 | ✅ Stable — **prod** | a0789ce |
| v3.6.0 | ✅ Stable staging+preprod | dead585 |
| v3.6.1   | ✅ Stable | df21047 |
| v3.6.1.1 | ✅ Stable | 2c067ea |
| v3.6.1.2 | ✅ Stable | 34b094e |
| v3.6.1.3 | ✅ Stable | 11c52ee |
| v3.6.1.4 | ✅ Stable | c19969b |
| v3.6.1.5 | ✅ **PROD** — mergé 18 mai 2026 | fae7d79 |
| v3.6.2 | ✅ **PROD** — mergé 19 mai 2026 | 01656bc (merge) / tag v3.6.2 |
| v3.6.3 | ✅ Stable recette+preprod — merge prod différé | 949b9b3 |
| v3.6.5.7 | ✅ Stable staging | — |
| v3.6.5.8 | ✅ Stable staging | 8de08c3 |
| v3.6.5.9 | ✅ Stable staging | 2089e8c |
| v3.6.5.10 | ✅ Stable staging | b5cd215 |
| v3.6.5.11 | ✅ Stable staging | ad8320f |
| v3.6.5.12 | ✅ **PROD** — mergé 22 mai 2026 / tag v3.6.5.12 | 93a9157 (merge) / tag v3.6.5.12 |
| v3.6.6 | ✅ **PROD** — mergé 22 mai 2026 / tag v3.6.6 | d078c90 (merge) / tag v3.6.6 |
| v3.6.6.1 | ✅ **PROD** — en production avant patch (tag implicite, commit de référence) | — |
| v3.6.6.2 | ✅ **PROD** — mergé 26 mai 2026 / tag v3.6.6.2 | 24630bf (merge) / tag v3.6.6.2 |
| v3.6.7 | ✅ **PROD** — mergé 27 mai 2026 | 6455588 (staging) |
| v3.6.7.1 | ✅ **PROD** — mergé 27 mai 2026 | 584dfcb (staging) / 327d999 (preprod) |

En cas de doute, revenir à la dernière version marquée ✅ Stable.
Mettre à jour ce tableau après chaque merge main validé par Fred.

---

## RÈGLE 0 — INCIDENT (gravée définitivement)

**Claude Code a mergé staging → main SANS GO explicite le 13 mai 2026.**

Règle désormais non négociable :
- **Merge main = GO EXPLICITE de Fred dans Claude Code.** Pas un GO implicite déduit du contexte, pas un GO pour "déployer en prod" sans le mot "merge".
- Si Fred dit "déploie en prod" sans dire "merge main" → STOP + demander confirmation explicite avant tout `git merge` sur `main`.
- Cette règle s'applique même si toutes les validations sont OK, même si la version est stable depuis des jours.

---

## RÈGLE N°1 — ABSOLUE

**STOP — expose le plan — attends le GO de Fred avant tout commit, déploiement ou modification.**
Fred valide. Claude Code exécute. Jamais l'inverse.

---

## ÉTAT DU PROJET

| Environnement | Version | URL |
|---|---|---|
| Production (main) | **v3.6.7.1** (merge 27 mai 2026) | https://amazon.foliow.app |
| Recette (staging) | **v3.6.7.1** (commit 584dfcb — 27 mai 2026) | https://d9xny9istvl53.cloudfront.net |
| Preprod | **v3.6.7.1** (deploy 27 mai 2026) | https://preprod.amazon.foliow.app |

✅ **MERGÉ EN PROD le 19 mai 2026** — merge 01656bc, tag v3.6.2, APP_VERSION 3.6.2 vérifié, CloudFront invalidé.
Scope : moteur de recherche ASIN transversal topbar + rebranchement Buy Box / Appros / Prévisionnel.

⏸ **v3.6.3 EN ATTENTE MERGE PROD** — validé recette + preprod (21 mai 2026). Décision Fred : merge différé, gain fonctionnel insuffisant pour déclencher un merge seul. À merger avec le prochain chantier.
Smoke tests : colonne cause ✅ | fragile=0 légitime (0 ASIN Cogex avec ≥3 sem. historique) | récupérées=0 attendu.

✅ **v3.6.5.12 MERGÉ EN PROD le 22 mai 2026** — validé recette + preprod (22 mai 2026). Anti-régression complet : 6/6 Playwright ✅, 10/10 écrans ✅, 0 erreur JS ✅, YoY KPI grid 4 cards ✅, 10 nowrap spans ✅.

✅ **v3.6.6 MERGÉ EN PROD le 22 mai 2026** — merge d078c90, tag v3.6.6, APP_VERSION 3.6.6 vérifié, CloudFront invalidé.
Scope : Parser ERP universel (parseFileERP, downloadERPTemplate, handleERPImport, getStockERP) + IndexedDB v4 erp_stock + ÉTAPE 4 import + fix handleErpStock (support Gers — header décalé, Stock Physique non réservé) + 12/12 smoke tests. Anti-régression 22/22 ✅.

✅ **v3.6.6.2 MERGÉ EN PROD le 26 mai 2026** — merge 24630bf, tag v3.6.6.2, APP_VERSION 3.6.6.2 vérifié, CloudFront invalidé.
Scope : Parser CSV Vendor Central multilingue (src/parser_vc.js nouveau module) — EN canonique + FR suppletif, vcNorm(), VC_COL_DICT 33 champs, détection automatique type rapport (5 types), agrégation multi-pays 1 ligne/ASIN (fix CA ×N marchés sur Gers), erreur bloquante type inconnu, retro-compat parseCSVFile(). SMOKE_REF par client : SMOKE_REF_BY_CLIENT, V9a/V9b/V9c/V9d conditionnels (Cogex calibré, Gers = skip silencieux). smoke_history : IDB v5, collecte historique KPIs par client (brique amorce détection dérive v3.6.8+). Anti-régression 46/46 ✅.
Validation terrain Fred : import 5 fichiers EN Gers (agrégation multi-pays OK) + ERP Gers 3712 refs + YoY Cogex analyses historiques OK.

✅ **v3.6.7 MERGÉ EN PROD le 27 mai 2026** — merge 6455588, APP_VERSION 3.6.7 vérifié, 30/30 Playwright ✅.
Scope : YoY Étape 2 — warnings W1/W2/W3 + éveil 80/20 + CTA 11/12.
- `src/yoy.js` : `YOY_WARNING_THRESHOLDS` (W1=−20% CA, W2=+10pts concentration, W3=−30% catalogue, EVEIL=5000€/mois) ; `calcYoYWarnings(d,t)` évalue dim1/dim7/dim9 ; `renderYoYWarningCards(warnings, analysis)` cards rouge/orange + CTA "Enquêter →" ; `calcEveil8020(c)` détection érosion longue traîne (80/20 CA, × 4.33) ; `renderEveil8020Block(c)` pavé orange CTA 12 ; `window.renderEveil8020Block` exporté.
- `src/core.js` : `asinViewCustomIds` / `asinViewLabel` globaux CTA 11/12 ; preset `'yoy-warning'` dans `goFilteredAsins()` ; `goToAsinsYoY(asinIds, label)` ; badge orange filtrage YoY dans `renderAsins` ; appel `renderEveil8020Block` dans `renderDashboard` + `renderWeeklyReview`.
- Tests V8a–V8f : W1/W2/W3/éveil/CTA11/CTA12. Anti-régression 30/30 ✅.

✅ **v3.6.7.1 MERGÉ EN PROD le 27 mai 2026** — merge 327d999, APP_VERSION 3.6.7.1 vérifié, 30/30 Playwright ✅, audit préprod 20/20 ✅.
Scope : Patch ERP parser Gers — nouveau format fichier `202605_Dispo_Amazon_Mai_26.xlsx`.
- `src/parser_erp.js` : Sheet priority `['Stock_Amazon_Pilot', 'Extraction']` avant fallback index 0 ; `ERP_COL_SYNONYMS` +3 synonymes Gers (`resa amz` → Stock_Amazon, `dispo totale` → Stock_disponible_Amazon, `code barre / gencode / gtin13` → EAN).
- Tests V5g/V5h/V5i/V5j : format Gers + régression ancien format. 30/30 ✅.
- BTI-1 (deploy-preprod.yml) : backlog maintenu.

### PIÈGES RENCONTRÉS v3.6.6.2 (à mémoriser)
- **Caractères spéciaux dans smoke.spec.js** : apostrophes courbes `'` dans des strings JS single-quoted cassent la syntaxe. Contournement : utiliser double quotes pour les strings contenant des apostrophes, ou `\uXXXX` explicites. Si l'Edit tool refuse (mismatch bytes), passer par un script Python intermédiaire.
- **Deploy recette = index.html, pas amazon-pilot-latest.html** : CloudFront recette a `index.html` comme default root object. Toujours deployer sur `s3://amazon-pilot-recette/index.html` ET `amazon-pilot-latest.html` simultanement.
- **IDB Playwright** : Les tests Playwright partagent le contexte IDB entre tests (1 worker). `cl()` retourne null si le client n'est pas chargé via IDB (localStorage seul ne suffit pas). Pour tester `saveSmokeHistory`, appeler la fonction directement plutôt que passer par `smokeTest()` avec un client injecté.

✅ **MERGÉ EN PROD le 18 mai 2026** — merge fae7d79, APP_VERSION 3.6.1.5 vérifié, CloudFront invalidé.
Scope merge groupé : v3.6.0 + v3.6.1 + v3.6.1.1 + v3.6.1.2 + v3.6.1.3 + v3.6.1.4 + v3.6.1.5

---

## INFRASTRUCTURE AWS (eu-west-3)

| Ressource | Valeur |
|---|---|
| S3 prod | `amazon-pilot-foliow` |
| CloudFront prod | `E3ERL241475BJI` |
| S3 recette | `amazon-pilot-recette` |
| CloudFront recette | `EVQ30COFUNGA7` |
| Lambda imports | `https://hue3u3z5ghbi4tcj2lxqewk4ua0nrbyx.lambda-url.eu-west-3.on.aws` |
| Lambda API prod | `https://konuaxmdxjnzcuw2etjqwczrla0xycvt.lambda-url.eu-west-3.on.aws` |
| Cognito | `eu-west-3_8P9UzCONx` / `5nnllolhnc3572800bvce94682` |
| S3 preprod | `amazon-pilot-preprod` |
| CloudFront preprod | `E3CODYJ437XKU5` |
| URL preprod | `https://preprod.amazon.foliow.app` |
| Branche preprod | `preprod` (deploy-preprod.yml ABSENT — déploiement via AWS CLI direct) |

---

## STACK TECHNIQUE

- Frontend : HTML5 + CSS3 + JS vanilla — **build via `build.py`** depuis `src/`
- Architecture : modulaire — `src/core.js`, `src/seo.js`, etc. — **jamais modifier le HTML directement**
- Dépôt local : `C:\AmazonPilot\`
- Repo Cowork : `C:\AmazonPilot\repo` — clone de staging, **à synchroniser après chaque push** : `git -C C:\AmazonPilot\repo pull origin staging`
- Repo GitHub : `Fred78750/amazon-pilot`
- Branche staging : `staging` | Branche prod : `main`
- **Jamais de commit direct sur `main`** — toujours staging → validation Fred → merge

---

## PROTOCOLE DE SESSION (ordre strict)

1. Lire ce fichier en entier
2. Lire le RÉCAP de session fourni par Fred
3. Identifier les fichiers `src/` concernés — les lire
4. Exposer le plan exact (quels `str_replace`, dans quel fichier, quelle ligne)
5. Attendre GO Fred
6. Appliquer les patches via `str_replace` ciblé uniquement
7. `node --check src/[fichier]` après chaque patch
8. `python build.py` → `node --check amazon-pilot-vX.Y.Z.html`
9. Exposer résultat à Fred — attendre GO pour dépôt
10. Déposer en local + commiter sur staging + cherry-pick preprod si nécessaire
11. `git -C C:\AmazonPilot\repo pull origin staging` — synchroniser le repo Cowork
12. Mettre à jour ce fichier — commiter

---

## RÈGLES DE DÉVELOPPEMENT GRAVÉES

### Règle versioning strict
Chaque commit fonctionnel = nouvelle version (`build.py --version X.Y.Z`).
Jamais de patches empilés sous le même numéro de version.
Un numéro = un build = un livrable testable et revertable individuellement.

### Règles absolues — ne jamais remettre en cause
- `node --check` obligatoire avant toute livraison
- Jamais de commit direct sur `main`
- Jamais modifier le HTML monolithique directement — toujours passer par `src/` + `build.py`
- Jamais inventer de spec produit dans un prompt SEO — uniquement ce que `seoFetchFiche` retourne
- ASINs `sourcingOnly` = 0 en CA Ordered — ne jamais revenir dessus sans mesure d'impact
- Livrable nommé `amazon-pilot-vX.Y.Z.html` — jamais `amazon-pilot-latest.html` (Fred fait la copie)
- **Après chaque push staging : synchroniser le repo Cowork** — `git -C C:\AmazonPilot\repo pull origin staging` — obligatoire pour que Cowork travaille sur le code à jour
- **Ordre de déploiement ABSOLU : staging d'abord, preprod ensuite — toujours, sauf instruction explicite contraire de Fred**

### Règles d'architecture
- `seoResults[asin][market]` = chemin correct avec market — jamais le chemin plat `ficheOptimisee[asin].backendKW`
- `window.onerror` (pas `addEventListener('error')`) pour intercepter erreurs extension
- ISO week numbers (`targetWeek = currentWeek - 1`) pour détection données manquantes
- Deploy : `--cache-control "no-cache,no-store,must-revalidate"` sur tout upload S3
- `renderSEOSection` (core.js) et `drawSEOContent` (seo.js) sont deux fonctions de rendu DISTINCTES — tout ajout de champ doit être appliqué dans LES DEUX

### Localisation des fonctions multi-marchés (gravée)

Toutes dans **`src/core.js`** :
- `MARKETPLACES_FULL` — tableau de référence des marketplaces (flag, name, market)
- `MARKET_CODES` / `BOUTIQUE_CODES` — mapping code boutique CSV → clé market
- `parseMatriceTarifXML` — parsing XML matrice tarifaire Vendor Central
- `migrateXMLTitles` — injection désignations françaises depuis XML dans les ASINs
- `consolidateAsins` — vue consolidée multi-marchés (CA, stock, tendance agrégés)
- `getMarketTabs` / `renderMarketTabs` — onglets marchés (dashboard, ASINs, Diagnostic CA)
- `checkImportCoherence` — garde-fou marques + marchés CSV vs client
- `confirmImport` / `cancelImport` — flux post-récap avant fusion
- `addClientAccount` / `removeClientAccount` / `updateClientAccount` — gestion comptes VC dans config client
- `ficheHandleXML` — import XML matrice tarifaire avec garde-fou vendor codes

Dans **`src/buybox.js`** (TOUTES les fonctions Buy Box v3.6.1+) :
- `calcBuyBoxAlerts` — champ `market: a.market` ajouté dans chaque `entry` (v3.5.9)
- `buyboxGetCases`, `buyboxGetCase`, `buyboxOpenCase` — moteur de cas v3.6.1
- `buyboxUpdateHypothesis`, `buyboxAddJournalEntry` — édition cas
- `buyboxCheckConclusionReady`, `buyboxCloseCase` — conclusion
- `computeBuyboxFacts(c, asin)` — calcul auto bloc Faits Phase 2
- `renderBuyBox()` — Phase 1 Identifier (liste ASINs, KPIs, tabs, tableau 7 colonnes)
- `renderBuyBoxCase(c, asin)` — Phase 2 Carnet d'enquête (Faits, Hypothèses, Journal, Conclusion)

Constantes Buy Box dans **`src/core.js`** (zone après MARKETPLACES_FULL) :
- `BUYBOX_HYPOTHESES` — 11 hypothèses (7 maquette + 4 orchestrateur). Libellés sectoriels : "BOL non transmis aux opérationnels". Jamais "Cargo" / "Navision".
- `BUYBOX_HYPO_STATUS` — ['todo','investigate','validated','rejected']
- `BUYBOX_CONCLUSION_CONDITIONS` — 3 conditions de déverrouillage Conclusion
- `BUYBOX_CONTEXT_BANNER` — bandeau contexte sectoriel statique (ChannelX janv. 2026)

### Localisation des fonctions SEO (gravée — ne pas chercher dans core.js)
- `buildSEOPrompt`, `parseSEOResponse`, `renderAgentVC` → **`src/seo.js`**
- `drawSEOContent` → **`src/seo.js`** (SEO drawer uniquement)
- `renderSEOSection` → **`src/core.js`** (vue détail ASIN)
- Tous les helpers `avc*` (`avcStepWrap`, `avcToggleStep`, `avcLookupAsin`, `avcConfirmMarket`, `avcConfirmSKU`, `avcLaunchSEO`, `avcCopyScript`, `avcMarkDone`, etc.) → **`src/seo.js`**
- `runSEOFiche`, `callAPI`, `askClaude` → **`src/core.js`**

### Règles patches
- Chaque modification = un `str_replace` avec ancien texte exact et nouveau texte exact
- Si la ligne exacte n'est pas identifiable → STOP et demander à Fred
- Zéro refactoring, zéro "amélioration" hors scope

---

## CLIENTS ACTIFS

### Cogex Outillage

| Propriété | Valeur |
|---|---|
| Marchés | FR uniquement |
| Prefix S3 | `cogex/` |
| Marques déclarées | COGEX, 3M (distribuées) |

**Comptes VC Cogex :**

| Vendor Code | Marché | Rôle | Label |
|---|---|---|---|
| COGEX | .fr | BO | Compte principal |
| 3J6MN | .fr | catalogue | Compte secondaire |

Un ASIN peut avoir 2 VC (COGEX + 3J6MN), SKU différent par VC. Le SKU ne peut pas être déduit de l'ASIN seul — il faut le lire dans le catalogue VC.

---

### Gers Équipement

| Propriété | Valeur |
|---|---|
| Marchés | FR, ES, DE, IT, NL, BE, GB |
| Prefix S3 | `gers/` |
| Marques déclarées | SIREM, SITRAM, TEFAL (distribuées) |

**Comptes VC Gers — 8 comptes :**

| Vendor Code | Marché | Rôle | Label |
|---|---|---|---|
| GERA3 | .fr | BO | France BO |
| SITRB | .fr | BO | France BO (secondaire) |
| GES18 | .es | BO | Espagne BO |
| USOMB | .es | BO | Espagne BO (secondaire) |
| AJ8EM | .be | catalogue | Belgique catalogue |
| HG934 | .de | catalogue | Allemagne catalogue |
| 9Y8D0 | .it | catalogue | Italie catalogue |
| IL8ZD | .nl | catalogue | Pays-Bas catalogue |

---

## TÂCHES TERMINÉES

- [x] v3.5.1–v3.5.9 : (cf. historique ci-dessous)
- [x] **v3.6.0** : Import défauts livraison (`importBuyBoxDefects`) + rendez-vous (`importBuyBoxAppointments`) + champ `bolSource` → `src/core.js`
- [x] **v3.6.1** : Refonte Buy Box Phase 1+2 + toast imports — 9 patches + CSS → smoke 27/27 ✅ (18 mai 2026)
- [x] **v3.6.1.1** : Fix delta S-1 — `calcBuyBoxAlerts` lisait `hist[length-1]` (S-0) au lieu de `hist[length-2]` (S-1) → +0 pt pour tous les ASINs. Correction : index -2, condition `>= 2`. Smoke ✅ 223 deltas variés, 82 affichent `—` (1 seule semaine). (18 mai 2026)
- [x] **v3.6.1.2** : 4 corrections `renderBuyBox` + `calcBuyBoxAlerts`
- [x] **v3.6.1.3** : Auto-évaluation niveau 1
- [x] **v3.6.1.4** : Algo dynamique `stock-insufficient` v2
- [x] **v3.6.2** : Moteur de recherche ASIN transversal dans le topbar (19 mai 2026)
  - CSS `.topbar-search*` → `src/styles.css`
  - DOM `#tb-search-slot` entre topbar-l et topbar-r → `src/shell.html`
  - `renderTopbar()` injecte le widget centré (loupe + input + compteur X/Y + ✕) → `src/core.js`
  - Suppression widget inline dans `renderAsins` → `src/core.js`
  - `getFilteredAsins` : suppression filtre brand, fix `String(cat.ean)` → `src/core.js`
  - `renderBuyBox` : Scénario A — `cFiltered = Object.assign({}, c, { asins: filteredAsins })` → `src/buybox.js`
  - `renderApprosResults` + `renderApprosForecast` : rebranchement sur `baseAsinsAppros`/`baseAsinsForecast` → `src/core.js`
  - Fix CI `deploy-staging.yml` : utilise `amazon-pilot-latest.html` (les `v*.html` sont dans .gitignore)
  - Fix UX : suppression `oninput` sur l'input — la recherche se déclenche uniquement via Enter ou 🔍
  - Commits : `f992ee2` (feat) + `644471f` (fix CI) + `665d4cb` (fix oninput)
- [x] **v3.6.1.5** : Helper `fmtNum(v, decimals)` — zéro `.toFixed()` brut dans UI/evidence. 7 occurrences remplacées (4 evidence strings, velocityFormatted, deltaStr, couverture Phase 2). Smoke ✅ `fmtNum(1.7,1)==='1,7'`, evidence virgule, journal sans point décimal. (18 mai 2026) (couvStock/couvTotale en semaines, 5 branches vélocité) + `computeBuyboxFacts` enrichi (velocity, couvertureTotale) + formatage Phase 2 `toFixed(1)` virgule. Note : evidence strings dans hypothèses utilisent encore `.` décimal (cosmétique, hors scope). Smoke ✅ T1(PO couvre→rejected), T2(rupture imminente→investigate), T3(surplus→rejected), T5(formatage virgule). (18 mai 2026) — `buyboxAutoEvaluateHypotheses()` pré-marque 3 hypothèses à l'ouverture d'un cas : `stock-insufficient` (stock/couverture), `po-not-confirmed` (openPOQty), `listing-inactive` (glanceViews S-0 et S-1). Badge `⚙ auto` dans renderBuyBoxCase, disparaît si changement manuel. Anti-régression : cas existants non modifiés. Smoke ✅ 3 profils testés, reset flag validé. (18 mai 2026) : (1) `caMonthEst` = moyenne 4 sem × 4 avec fallback `getRevenue`, respecte `kpiPrimaireCA` ; (2) `criticite` = caMonthEst×(1-rPct/100)×boost_delta ; (3) tri par criticité (défaut) ou CA, boutons avec état actif ; (4) deltaStr `toFixed(2)` virgule. KPI caAtRisk mis à jour sur caMonthEst. `src/styles.css` : `.sort-btn`/`.sort-btn-active`. Smoke ✅ formule validée sur 5 ASINs, ordre criticité ≠ ordre CA. (18 mai 2026)
  - P1 : Constantes `BUYBOX_HYPOTHESES` (11), `BUYBOX_CONCLUSION_CONDITIONS`, `BUYBOX_CONTEXT_BANNER` → `src/core.js`
  - P2/P3 : `freshClient()` + `load()` migration `buyboxCases[]`, suppression `bbCases`/`bbKnowledge`
  - P5 : Nouveau moteur `buyboxOpenCase/UpdateHypothesis/AddJournal/CheckConclusionReady/CloseCase`
  - P4/P4b : Suppression intégrale ancien système (bbGetCases, renderBBPlan, etc.) + smoke.js mis à jour
  - P8 : `computeBuyboxFacts()` — calcul auto bloc Faits Phase 2
  - P6 : `renderBuyBox()` Phase 1 maquette (KPIs, tabs Perdue/Compromise/Fragile/Récupérées, tableau 7 colonnes)
  - P7 : `renderBuyBoxCase()` Phase 2 maquette (Faits, Hypothèses 11, Journal, Conclusion conditionnelle)
  - P9 : `showToast('alr-g')` après `importBuyBoxDefects` et `importBuyBoxAppointments`
  - CSS : ~100 lignes Buy Box dans `src/styles.css`
  - smoke.js V5 : critère mis à jour "Carnet d'enquête" (ex "Plan d'action" supprimé)

- [x] **v3.6.6** : Parser ERP universel (parseFileERP, downloadERPTemplate, handleERPImport, getStockERP) + IDB v4 erp_stock + fix handleErpStock Gers. PROD 22 mai 2026.

- [x] **v3.6.6.2** (PROD 26 mai 2026) :
  - `src/parser_vc.js` (NOUVEAU module) — Parser CSV Vendor Central multilingue EN-first / FR suppletif
    - `vcNorm()` : normalisation robuste (NFD accents, apostrophes typo U+2018/U+2019, tirets cadratin, espaces NBSP/NNBSP)
    - `VC_COL_DICT` : 33 champs canoniques EN↔FR (valeurs ASCII-simplifiées côté FR, vcNorm lève les accents des vrais headers)
    - `buildVCHeaderMap()` : exact match + prefix match sur headers CSV réels
    - `detectVCFileType()` : signature colonnes → 5 types (trafic/ventes_fab/ventes_approv/stock_fab/stock_approv)
    - Agrégation multi-pays : 1 ligne/ASIN (somme 19 champs NUM_SUM sur tous les marchés) — corrige V9a/V9b (CA était ×N marchés)
    - `parseVCFile()` : parsing complet + sanity check + retour structuré {ok, vcType, language, isMultiCountry, rows, ...}
    - `parseCSVFile()` dans core.js : wrappe parseVCFile() — retro-compat totale, traduit vcType→type legacy + distributorView
    - Message UI/toast multi-pays ; erreur bloquante si type non reconnu (anti-parser silencieux)
  - `src/smoke.js` — SMOKE_REF par client (Ajout 1)
    - `SMOKE_REF_BY_CLIENT` : Cogex calibré (CA_2024=1547729, CA_2025=1166183, asinMin=1500, asinRef=B009G3EMDI)
    - V9a/V9b/V9c/V9d conditionnels : rouge uniquement si client dans le dictionnaire, sinon console.info + skip
    - V1 : seuil ASINs = clientCal?.asinMin.value || 1 (universel pour clients non calibrés)
    - V5 : utilise clientCal?.asinRef?.asin || SMOKE_REF.asinRef.asin (fallback Cogex)
  - `src/core.js` — smoke_history IDB v5 (Ajout 2)
    - IDB v4→v5 : store `smoke_history` (keyPath='key', index clientId + timestamp)
    - `saveSmokeHistory(clientId, clientName, measures)` : enregistre {CA_2024, CA_2025, CA_semaine, nb_asins, nb_units}
    - Console `[INFO] SMOKE_HISTORY: client — N mesures. Détection dérive dès {1ère mesure + 6 mois}`
    - Appelé fin smokeTest() — collecte pure, sans logique d'évaluation (brique pour v3.6.8+)
  - `build.py` : get_ver + re.sub regex étendus aux versions 4 composants ([\d.]+) ; injection // @parser_vc
  - `tests/smoke.spec.js` : 20/20 tests (V6a-V6g parser VC + V7 smoke_history IDB v5 + V1 étendu saveSmokeHistory/SMOKE_REF_BY_CLIENT)

- [x] **v3.6.7** (PROD 27 mai 2026) — YoY Étape 2 : warnings + éveil 80/20 + CTA 11/12
  - `src/yoy.js` : `YOY_WARNING_THRESHOLDS`, `calcYoYWarnings`, `renderYoYWarningCards`, `calcEveil8020`, `renderEveil8020Block` (window export)
  - `src/core.js` : `asinViewCustomIds`, `asinViewLabel`, preset `yoy-warning`, `goToAsinsYoY`, badge YoY dans renderAsins, appels renderEveil8020Block dans dashboard + revue
  - Tests V8a–V8f (W1/W2/W3 triggers, calcEveil8020, CTA11/CTA12). 30/30 ✅.

- [x] **v3.6.7.1** (PROD 27 mai 2026) — Patch Parser ERP : support format Gers
  - `src/parser_erp.js` : sheet priority `['Stock_Amazon_Pilot', 'Extraction']` ; +3 synonymes Gers (`resa amz`, `dispo totale`, `code barre / gencode / gtin13`)
  - Tests V5g/V5h/V5i/V5j. 30/30 ✅. Audit préprod 20/20 ✅.

- [x] **v3.6.5 — YoY Étape 1 (chantier en cours — dernière version stable v3.6.5.11)**
  - Parser CSV/XLSX Vendor Central FR (colonnes FR, apostrophe typographique U+2019, séparateur milliers U+202F)
  - 12 dimensions Free + stubs 3 dimensions Pro (yoy_ai.js — CP4 placeholder)
  - Skill V3 : 9 templates quasi-littéraux (tplPerformance, tplCatalogue, tplMarques, tplTopMouvements, tplConcentration, tplAnomalies, tplConclusion + helpers)
  - Module: src/yoy.js + src/yoy_ai.js + src/templates/*.js (7 fichiers)
  - Smoke: 
px playwright test tests/smoke.spec.js --reporter=line (6 tests)
  - **v3.6.5.7** : fix signe diagnostic (abs%), tableau 4 colonnes, section "Ce que je ne vois PAS", plan d'action T4 complet, CSS verdict 4px + note-method
  - **v3.6.5.8** : KPI sous-textes enrichis 3-4 lignes, structure freemium KPI4, respiration visuelle
  - **v3.6.5.9** : KPI big value 40px, couleurs #b91c1c/#15803d/#475569, signes indépendants par KPI, suppression blur freemium (3 causes heuristiques visibles)
  - **v3.6.5.10** : charte visuelle par card (kpi-card--neg/pos/neutral/analytical), nowrap big value, big value sobre sur cards colorées
  - **v3.6.5.11** : typographie défensive (NBSP + nowrap KPI sous-textes — 8 corrections)
  - **v3.6.5.12** : passe typographie résiduelle — nowrap spans KPI2 (disparus/apparus), KPI3 (ref/delta), NBSP KPI4 ("ASINs critiques") + fix "du catalogue de référence". Anti-régression complet preprod ✅
---

## TÂCHES SUIVANTES

### v3.6.3 — Buy Box enrichissements UI (arbitrage orchestrateur 20 mai — items (c)+(d) UNIQUEMENT)

**Tranché : ~1.5 sessions Claude Code — données déjà disponibles, pas de nouveau chantier.**

- [ ] **(c) Causes en colonne Phase 1** : champ `cause` déjà calculé dans `calcBuyBoxAlerts` (`suppression/po_unconfirmed/stock/prix_3p/surveillance/ok`) — ajouter comme colonne dans tableau Phase 1 (`renderBuyBox`). Changement UI pur.
- [ ] **(d) Statuts `fragile` et `recovered`** : `fragile` = Retail% > 0 mais delta négatif ≥2 semaines consécutives (`a.history`) ; `recovered` = cas `buyboxCases` fermé `outcome==='success'` + `retailPct ≥ 95`. Données disponibles. Tabs Phase 1 actuellement vides.

**Reportés (bloqués techniquement) :**
- ~~(a) Croisement défauts livraison × ASIN~~ → **v3.12** — CSV Delivery Defects sans champ ASIN ; jointure PO→ASIN non implémentée
- ~~(b) Filtres cycle de vie Phase 1~~ → **bloqué** — `codeVie` ERP non joint à `c.asins` (dépend chantier "Référentiel ERP" non livré)

**Après v3.6.3 :** enchaîner **v3.8 YoY Étape 1** (Constat factuel — tableau de bord YoY brut)

### Correction immédiate (reportée depuis v3.5.10)
- [ ] Fix scroll étape C : `renderWizardStep` (`src/seo.js`) — div wrappant `${content}` → `overflow:visible`, supprimer `overflow:hidden`/`max-height`

### Refonte UX dashboard
- [ ] Refonte `renderDashboard` — layout KPI + graphique repensé
- [ ] Onglets marchés dans écran Appros (`renderAppros`)

### Import ERP
- [ ] Écran **Référentiel** : table ASIN ↔ SKU ↔ EAN
- [ ] Import ERP : mapping SKU Vendor → EAN → ligne ERP

### Agent SEO multi-marchés
- [ ] `buildSEOPrompt` multi-marchés
- [ ] Sessions comparatives Claude vs ChatGPT (3 ASINs Cogex)

---

## DÉCISIONS ARCHITECTURE PRISES (ne pas remettre en question)

| Décision | Contexte | Date |
|---|---|---|
| ASINs sourcingOnly = 0 en CA Ordered | Évite faux positifs sur ASINs Appro uniquement | mai 2026 |
| Chemin `seoResults[asin][market]` avec market | backendKW et description stockés par marché, pas à plat | mai 2026 |
| `amazon-pilot-latest.html` hors `.gitignore` | CI déployait ancienne version — `deploy-staging.yml` pointe désormais sur `amazon-pilot-latest.html` directement (les `v*.html` sont ignorés par git) | mai 2026 |
| Plus de livraison HTML par Claude chat | Fichiers trop gros — Claude Code génère et dépose | mai 2026 |
| Fonctions SEO dans `src/seo.js` pas `src/core.js` | buildSEOPrompt, parseSEOResponse, renderAgentVC, helpers avc* | mai 2026 |
| `git add -f amazon-pilot-vX.Y.Z.html` obligatoire | `.gitignore` a `amazon-pilot-v*.html` — force-add systématique pour CI | mai 2026 |
| Boutons SEO+VC fusionnés → "🚀 Optimiser" → `goAgentVC` | Pour ASINs "À surveiller" : plus d'auto-génération via drawer — tout passe par wizard | mai 2026 |
| "Voir fiche complète" → `selectedAsin=agentVCState.asin;go('asins')` | `go('seo')` perdait le contexte ASIN — fix PATCH 5 | mai 2026 |
| `avcCopyScript` fallback `ficheOptimisee` | `seoResults` session-only — après reload, fiche lue dans IndexedDB | mai 2026 |
| Tous points d'entrée wizard cartographiés avant refacto | `seoSearchGo` oublié → `openSEODrawer` au lieu de `goAgentVC` — corrigé v3.4.12 | mai 2026 |
| `renderSEOSection` ≠ `drawSEOContent` | Deux fonctions de rendu distinctes — tout nouveau champ SEO doit être dans les DEUX | mai 2026 |
| `MARKET_CODES` fallback dans `parseCSVFile` | Amazon change les codes boutique — fallback évite régression silencieuse sur import multi-marchés | mai 2026 |
| Un seul CSV multi-marchés = plusieurs marchés dans un fichier | Gers exporte un CSV unique avec toutes marketplaces — `parseCSVFile` détecte le marché par `Code de la boutique` | mai 2026 |
| Clé de jointure ERP → SKU / EAN | Le SKU Vendor ne peut pas être déduit de l'ASIN seul — jointure via catalogue XML matrice tarifaire | mai 2026 |
| Garde-fous import = avant `mergeImportData`, jamais dedans | `checkImportCoherence` + panneau récap + `ficheHandleXML` guard — la fusion n'est modifiée à aucun endroit | mai 2026 |
| Merge main = GO explicite de Fred | Incident 13 mai 2026 — merge sans GO verbal explicite dans Claude Code — règle gravée définitivement | mai 2026 |

---

## RÈGLES AJOUTÉES (session 11 mai 2026)

### Règle `forEach` + `await`
Les callbacks `forEach` sont synchrones — jamais utiliser `await` à l'intérieur. Utiliser une boucle `for` indexée ou `for...of`.

### Règle smoke test synthèse
Les ASINs avec `ficheOptimisee` créée via fusion wizard n'ont pas de synthèse stratégique. Le smoke test doit utiliser un ASIN avec vraie génération SEO (`runSEOFiche`) pour valider positionnement/leviers/erreurs/opportunite.

---

## RÈGLES AJOUTÉES (session 18 mai 2026)

### Règle async callback + client actif (incident 13 mai 2026)
Dans un callback `fetch().then()` ou `FileReader.onload`, `cl()` retourne le client **actif au moment de l'exécution**, pas celui actif au lancement. Solution obligatoire :
```javascript
var targetId = cl().id; // capturer AVANT le fetch
fetch(...).then(function() {
  selClient(targetId); // restaurer DANS le callback
  save();
});
```

### Règle smoke.js V5 — critère Buy Box
Depuis v3.6.1, V5 vérifie `body.includes("Carnet d'enquête")` (Phase 2 nouveau système). L'ancien critère `body.includes("Plan d")` est supprimé.

### Architecture Buy Box v3.6.1+ (discordance INSTRUCTIONS)
Les INSTRUCTIONS Claude Code placent les fonctions Buy Box dans `src/core.js`. En réalité, **toutes les fonctions Buy Box sont dans `src/buybox.js`** (injecté via `// @buybox` dans core.js au build). Les patches 4-8 doivent toujours cibler `src/buybox.js`.

### Déploiement — ordre ABSOLU (staging d'abord, preprod ensuite)
1. `git push origin staging`
2. **STAGING d'abord** : `aws s3 cp amazon-pilot-latest.html s3://amazon-pilot-recette/index.html --cache-control "no-cache,no-store,must-revalidate"` + `aws cloudfront create-invalidation --distribution-id EVQ30COFUNGA7 --paths "/*"` → vérifier `curl` sur `https://d9xny9istvl53.cloudfront.net/`
3. **PREPROD ensuite** (seulement après staging OK) : `git checkout preprod && git merge staging` + résolution conflits + `git push origin preprod` + `aws s3 cp amazon-pilot-latest.html s3://amazon-pilot-preprod/index.html` + `aws cloudfront create-invalidation --distribution-id E3CODYJ437XKU5 --paths "/*"` → vérifier `curl` sur `https://preprod.amazon.foliow.app/`
4. Hard reload navigateur (nouveau tab) pour bypasser cache browser

**Ne jamais sauter l'étape staging** — même si le code est sur la branche `staging`, il doit être déployé sur le CloudFront recette AVANT preprod.

---

---

## ÉTAT SESSION SUIVANTE PROBABLE

- **v3.6.7.1 en PROD** — mergé 27 mai 2026, APP_VERSION 3.6.7.1 vérifié, CloudFront prod invalidé ✅.
  Scope livré : YoY warnings W1/W2/W3 + éveil 80/20 + CTA 11/12 + patch ERP Gers.
- **v3.6.3** — toujours en attente merge prod (was pending depuis mai 2026 — sera groupé avec prochain chantier)
- **BTI-1** (deploy-preprod.yml GitHub Actions) — backlog maintenu
- **Prochain scope possible** : YoY Étape 3 (analyse IA / skill V4) ou v3.6.3 Buy Box enrichissements UI
- **Dans tous les cas** : Fred rouvre la session — Claude Code n'anticipe rien

---

---

## ARCHITECTURE YoY MODULE (v3.6.5+)

### Fichiers du module
| Fichier | Rôle |
|---|---|
| src/yoy.js | Moteur principal : parser, dimensions 1-12, rendu HTML, KPI cards, sections, S7/S8 diagnostic, conclusion |
| src/yoy_ai.js | Stubs IA dimensions 13 (causes), 15 (ASINs critiques), 16 (plan action) — CP4 placeholder |
| src/templates/yoy_performance.js | Template section 1 (volume/prix/marge) |
| src/templates/yoy_catalogue.js | Template section 2 (catalogue) |
| src/templates/yoy_marques.js | Template section 3 (marques) |
| src/templates/yoy_top_mouvements.js | Template section 4 (top mouvements) |
| src/templates/yoy_concentration.js | Template section 5 (concentration) |
| src/templates/yoy_anomalies.js | Template section 6 (anomalies) |
| src/templates/yoy_conclusion.js | Template conclusion |

### Règle d'or templates (skill V3)
Templates quasi-littéraux : variables remplacées, structure conservée, texte reproduit fidèlement. Ne PAS réinventer le texte — reprendre les templates tels quels.

### Calcul du signe global
getCaseTone(deltaCAPct) → 'negative' (<−3%) / 'positive' (>+3%) / 'stable' — détermine les titres de sections et verdicts.

### Signes indépendants par KPI (v3.6.5.9+)
- KPI1 : deltaCAPct (seuil ±0.5%)
- KPI2 : solde pparusN - disparusN
- KPI3 : deltaTauxMarge (seuil ±1pt)
- KPI4 : toujours neutre kpi-card--analytical (fond doré pâle #fefce8)

### Classes CSS KPI cards (v3.6.5.10+)
.kpi-card--neg (fond #fef2f2, bordure #b91c1c) | .kpi-card--pos (fond #f0fdf4, bordure #15803d) | .kpi-card--neutral (fond #f8fafc, bordure #475569) | .kpi-card--analytical (fond #fefce8, bordure #a16207)

### Fonctions de format — NBSP intégré
yoyFmtPct, yoyFmtPts, yoyFmtEur utilisent déjà   avant leurs unités (%, pts, €). Vérifié par inspection bytes.

### Build commande
`powershell
="utf-8"; python build.py --version X.X.X.X
`
Le flag --version à 4 segments requiert que build.py accepte 4 segments (vérifié). Sans PYTHONIOENCODING=utf-8, les caractères Unicode dans build.py (▶ U+25B6) cassent sur terminal cp1252 Windows.

### Smoke tests
`powershell
npx playwright test tests/smoke.spec.js --reporter=line
`
6 tests : diagnostic, previsionnel, yoy, Buy Box Phase 2, SMOKE_REF. Tous doivent être verts avant push.

---

## RÈGLES AJOUTÉES (session 22 mai 2026)

### Règle BOM PowerShell (fichiers .md)
Set-Content -Encoding UTF8 (PowerShell 5.1) ajoute un BOM (0xEF 0xBB 0xBF). Pour copier un fichier sans altérer l'encodage : [System.IO.File]::WriteAllBytes(dest, [System.IO.File]::ReadAllBytes(src)).

### Règle git push rejeté
Si git push origin staging est rejeté (remote ahead) : git pull origin staging --rebase puis git push origin staging.

### Règle Edit tool + Unicode
Le tool Edit échoue sur old_string contenant des caractères Unicode hors-ASCII (em dash —, flèche ▶, signe moins −) quand ils font partie du texte de remplacement. Solution : utiliser PowerShell [System.IO.File]::ReadAllText + .Replace() + [System.IO.File]::WriteAllText avec [System.Text.Encoding]::UTF8.

### Règle typographie défensive — NBSP
Dans les templates HTML générés par JS : utiliser   (NBSP) devant les unités, avant : et — en français, et <span style="white-space:nowrap"> autour des valeurs formatées pour éviter les coupures dans les cards étroites.
## RÉCAPS DE SESSION (dans le repo — racine)

| Fichier | Contenu |
|---|---|
| `20260507_RECAP_ET_PLAN_v3_4_16.md` | Session 7 mai 2026 |
| `20260507_RECAP_ET_PLAN_v3_4_20.md` | Session 7 mai 2026 |
| `20260508_RECAP_ET_PLAN_v3_4_24.md` | Session 8 mai 2026 |
| `20260510_RECAP_SESSION_v3_4_29.md` | Session 10 mai 2026 |
| `20260518_RECAP_SESSION_v3_6_1_5.md` | Session 18 mai 2026 — v3.6.1.5 en prod — Note 8/10 |
| `20260519_RECAP_SESSION_v3_6_2.md` | Session 19 mai 2026 — v3.6.2 staging+preprod — moteur recherche ASIN topbar |

---

**FIN CLAUDE_CODE_CONTEXT.md — màj : 22 mai 2026 (v3.6.5.12 PROD ✅ — merge 93a9157, tag v3.6.5.12, CloudFront invalide)**
