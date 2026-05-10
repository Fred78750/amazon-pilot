# CLAUDE_CODE_CONTEXT.md
**Fichier vivant — mis à jour à chaque fin de session**
**Dernière mise à jour :** 10 mai 2026 (v3.4.28 prod)

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
| v3.4.28 | ✅ Stable — **prod** | d747085 |

En cas de doute, revenir à la dernière version marquée ✅ Stable.
Mettre à jour ce tableau après chaque merge main validé par Fred.

---

## RÈGLE N°1 — ABSOLUE

**STOP — expose le plan — attends le GO de Fred avant tout commit, déploiement ou modification.**
Fred valide. Claude Code exécute. Jamais l'inverse.

---

## ÉTAT DU PROJET

| Environnement | Version | URL |
|---|---|---|
| Production (main) | v3.4.28 | https://amazon.foliow.app |
| Recette (staging) | v3.4.28 | https://d9xny9istvl53.cloudfront.net |
| Preprod | v3.4.28 | https://preprod.amazon.foliow.app |

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

| Client | Marchés | Prefix S3 | Vendor Codes |
|---|---|---|---|
| Cogex Outillage | FR uniquement | `cogex/` | COGEX (principal), 3J6MN (secondaire) |
| Gers Équipement | FR, ES, NL, DE, BE, IT | `gers/` | GERA3, SITRB |

**Multi-vendor codes Cogex :** un ASIN peut avoir 2 VC (COGEX + 3J6MN), SKU différent par VC. Le SKU ne peut pas être déduit de l'ASIN seul — il faut le lire dans le catalogue VC.

---

## TÂCHES EN COURS (session v3.4.28 — toutes terminées)

- [x] v3.4.25 : `buildSEOPrompt` v2 — Phase 0, ficheAmazon, ALERTES_FRED, POINT_IMPORTANT → `src/seo.js`
- [x] v3.4.25 : `parseSEOResponse` — ajout `pointImportant` + `alertesFred` → `src/seo.js`
- [x] v3.4.25 : `drawSEOContent` — affichage ALERTES_FRED + POINT_IMPORTANT → `src/seo.js`
- [x] v3.4.26 : ficheAmazon "Enrichissement produit" — carte complète vue détail + wizard étape 4 → `src/core.js` + `src/seo.js`
- [x] v3.4.26 : bug SKU wizard — `render()` supprimé de `oninput`, `onblur="render()"` → `src/seo.js`
- [x] v3.4.27 : `drawSEOContent` — `display:none` conditionnel ALERTES_FRED + POINT_IMPORTANT → `src/seo.js`
- [x] v3.4.27 : `isBackendKW` — 4 nouvelles directives strictes → `src/seo.js`
- [x] v3.4.28 : `renderSEOSection` (core.js) — ajout ALERTES_FRED + POINT_IMPORTANT manquants → `src/core.js`

---

## TÂCHES SUIVANTES

- [x] Merge staging → main (v3.4.25 à v3.4.28) — ✅ prod déployée
- [ ] Smoke test complet avant merge (voir `smoke-test.md`)
- [ ] Qualité prompt SEO — comparaison ChatGPT + refonte `buildSEOPrompt` → `src/seo.js`
- [ ] Enrichissement web `seoFetchFiche` — vérifier lecture fiche Amazon réelle → `src/seo.js`
- [ ] Gestion erreurs Amazon (2-3 messages courants) dans le script VC → `buildVCModifyPrompt` `src/seo.js`
- [ ] Double clic "Enregistrer et terminer" si premier clic ignoré → `save()` dans `buildVCModifyPrompt` `src/seo.js`

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

---

**FIN CLAUDE_CODE_CONTEXT.md — màj : 10 mai 2026 (v3.4.28)**
