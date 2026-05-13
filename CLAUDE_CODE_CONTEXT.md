# CLAUDE_CODE_CONTEXT.md
**Fichier vivant — mis à jour à chaque fin de session**
**Dernière mise à jour :** 13 mai 2026 (v3.5.9 prod)

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
| v3.4.41 | ✅ Stable — **prod** | cd3e709 |
| v3.5.1 | ✅ Stable staging | — |
| v3.5.2 | ✅ Stable staging | — |
| v3.5.3 | ✅ Stable staging | 56e8dcc |
| v3.5.4 | ✅ Stable staging | e4ee36e |
| v3.5.5 | ✅ Stable staging | 8f0e5b4 |
| v3.5.6 | ✅ Stable staging | bca06c2 |
| v3.5.7 | ✅ Stable | 61f0725 |
| v3.5.8 | ✅ Stable | 6d63e15 |
| v3.5.9 | ✅ Stable staging+preprod | fadbc7a |

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
| Production (main) | v3.4.41 | https://amazon.foliow.app |
| Recette (staging) | v3.5.9 | https://d9xny9istvl53.cloudfront.net |
| Preprod | v3.5.9 | https://preprod.amazon.foliow.app |

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
| Branche preprod | `preprod` → `deploy-preprod.yml` |

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

Dans **`src/buybox.js`** :
- `calcBuyBoxAlerts` — champ `market: a.market` ajouté dans chaque `entry` (v3.5.9) pour permettre le filtrage par marché dans `renderBuyBox`

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
| Marchés | FR, ES, NL, DE, BE, IT |
| Prefix S3 | `gers/` |
| Marques déclarées | SIREM, SITRAM, TEFAL (distribuées) |

**Comptes VC Gers — 8 comptes :** *(à compléter par Fred avec les vendor codes exacts par marché)*

| Vendor Code | Marché | Rôle | Label |
|---|---|---|---|
| GERA3 | .fr | BO | France BO |
| SITRB | .fr | catalogue | France catalogue |
| *(à renseigner)* | .es | BO | Espagne |
| *(à renseigner)* | .de | BO | Allemagne |
| *(à renseigner)* | .it | BO | Italie |
| *(à renseigner)* | .nl | BO | Pays-Bas |
| *(à renseigner)* | .be | BO | Belgique |
| *(à renseigner)* | — | catalogue | Compte catalogue multi-marchés |

> ⚠️ Fred doit compléter ce tableau avec les vendor codes réels. Le garde-fou `ficheHandleXML` utilise `c.accounts[].vendorCode` pour valider l'import XML.

---

## TÂCHES EN COURS (session v3.5.x — toutes terminées)

- [x] v3.5.1 : Désignations françaises (`migrateXMLTitles`) + Vue consolidée multi-marchés (`consolidateAsins`) → `src/core.js`
- [x] v3.5.2 : Fix bug critique CSV market collision — `MARKET_CODES` fallback dans `parseCSVFile()` → `src/core.js`
- [x] v3.5.3 : Suppression doublon section 1.5 Purchase Orders dans `renderImport()` → `src/core.js`
- [x] v3.5.4 : Fix smoke test I4 — sélecteur `po-section-3` (remplace `po-drop-zone` supprimé en v3.5.3) → `src/smoke.js`
- [x] v3.5.5 : Onglets marchés avec drapeaux et CA — `getMarketTabs` + `renderMarketTabs` dans `renderDashboard` et `renderAsins` → `src/core.js`
- [x] v3.5.6 : Garde-fous import CSV — `checkImportCoherence` (marques + marchés), panneau récap pré-fusion, bandeau client visible → `src/core.js`
- [x] v3.5.7 : Garde-fou import XML matrice tarifaire — `ficheHandleXML` vérifie vendor codes XML vs `c.accounts[].vendorCode` → `src/core.js`
- [x] v3.5.8 : Fix smoke test V3 + V8 — noms d'écrans incorrects (`go('revue')` → `go('weekly')`, `go('agentseo')` → `go('seo')`) → `src/smoke.js`
- [x] v3.5.9 : Onglets marchés dans Diagnostic CA (`renderPompier`) et Buy Box (`renderBuyBox`) — filtrage marché + `renderMarketTabs` → `src/core.js` + `src/buybox.js`

---

## TÂCHES SUIVANTES

### Correction immédiate
- [ ] **v3.5.10** — Fix scroll étape C : `renderWizardStep` (`src/seo.js`) — div wrappant `${content}` → `overflow:visible`, supprimer `overflow:hidden`/`max-height`
- [ ] Fred complète les 8 comptes VC Gers dans la fiche client (vendor codes ES, DE, IT, NL, BE)

### Refonte UX dashboard
- [ ] Refonte `renderDashboard` — layout KPI + graphique repensé, zone synthèse IA plus visible
- [ ] Onglets marchés dans écran Appros (`renderAppros`) — même principe que v3.5.9

### Import ERP
- [ ] Écran **Référentiel** : table ASIN ↔ SKU ↔ EAN — jointure ERP via catalogue XML matrice tarifaire
- [ ] Import ERP : mapping SKU Vendor → EAN → ligne ERP (stock, désignation, prix achat)

### Agent SEO multi-marchés
- [ ] `buildSEOPrompt` multi-marchés — adapter le prompt pour prendre en compte `market` dans la génération
- [ ] `seoFetchFiche` — vérifier lecture fiche Amazon réelle par marché → `src/seo.js`
- [ ] Sessions comparatives Claude vs ChatGPT (3 ASINs Cogex) → alimenter `EXEMPLES_GPT_REFERENCE.md`

---

## DÉCISIONS ARCHITECTURE PRISES (ne pas remettre en question)

| Décision | Contexte | Date |
|---|---|---|
| ASINs sourcingOnly = 0 en CA Ordered | Évite faux positifs sur ASINs Appro uniquement | mai 2026 |
| Chemin `seoResults[asin][market]` avec market | backendKW et description stockés par marché, pas à plat | mai 2026 |
| `amazon-pilot-latest.html` hors `.gitignore` | CI déployait ancienne version — fix `ls amazon-pilot-v*.html | sort -V | tail -1` dans deploy.yml | mai 2026 |
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

**FIN CLAUDE_CODE_CONTEXT.md — màj : 13 mai 2026 (v3.5.9 prod — roadmap v3.5.10+)**
