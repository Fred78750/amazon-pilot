# CLAUDE_CODE_CONTEXT.md
**Fichier vivant — mis à jour à chaque fin de session**
**Dernière mise à jour :** 7 mai 2026 (v3.4.9)

---

## RÈGLE N°1 — ABSOLUE

**STOP — expose le plan — attends le GO de Fred avant tout commit, déploiement ou modification.**
Fred valide. Claude Code exécute. Jamais l'inverse.

---

## ÉTAT DU PROJET

| Environnement | Version | URL |
|---|---|---|
| Production (main) | v3.2.24 | https://amazon.foliow.app |
| Recette (staging) | v3.4.9 | https://d9xny9istvl53.cloudfront.net |

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

### Règles d'architecture
- `seoResults[asin][market]` = chemin correct avec market — jamais le chemin plat `ficheOptimisee[asin].backendKW`
- `window.onerror` (pas `addEventListener('error')`) pour intercepter erreurs extension
- ISO week numbers (`targetWeek = currentWeek - 1`) pour détection données manquantes
- Deploy : `--cache-control "no-cache,no-store,must-revalidate"` sur tout upload S3

### Localisation des fonctions SEO (gravée — ne pas chercher dans core.js)
- `buildSEOPrompt`, `parseSEOResponse`, `renderAgentVC` → **`src/seo.js`**
- Tous les helpers `avc*` (`avcStepWrap`, `avcToggleStep`, `avcLookupAsin`, `avcConfirmMarket`, `avcConfirmSKU`, `avcLaunchSEO`, `avcCopyScript`, `avcMarkDone`, etc.) → **`src/seo.js`**
- `runSEOFiche`, `callAPI`, `askClaude` → **`src/core.js`**
- `buildSEOPrompt`, `parseSEOResponse` → **`src/seo.js`** (pas `core.js` — corrigé audit Cowork)

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

## TÂCHES EN COURS (session v3.4.9 — toutes terminées)

- [x] Fix `parseSEOResponse` : strip `**` sur description → `src/seo.js`
- [x] Fix `buildSEOPrompt` : directive DESCRIPTION HTML structurée 5 blocs → `src/seo.js`
- [x] Fix `buildSEOPrompt` : directive BACKEND_KEYWORDS 5 blocs + liste INTERDIT → `src/seo.js`
- [x] Fix bloc INTERDIT : ajout "incassable", "homologué", "certifié", "compatible tous modèles" → `src/seo.js`
- [x] Strip `**` sur 4 champs synthèse (`positionnement`, `leviers`, `erreurs`, `opportunite`) → `src/seo.js`
- [x] Guard `apiKey` dans `runSEOFiche` → `src/core.js`
- [x] Refonte `renderAgentVC` : wizard 5 étapes, `avcStepWrap`, accordéon, SKU obligatoire étape 3, multi-VC étape 5 → `src/seo.js`
- [x] Fix `renderOnboarding` : `c.` → `nc.` (wizStep 3, bloc PO) — `ReferenceError: c is not defined` → `src/core.js`
- [x] Fix wizard SKU : `oninput` → `onchange` (BUG1 — 1er char seulement) → `src/seo.js`
- [x] Fix wizard étape 5 : bouton "📤 Script VC →" dans branche ficheReady (BUG2 — étape 5 jamais atteinte) → `src/seo.js`
- [x] Fix `go('agentseo')` → `go('seo')` : écran vide sur "Voir fiche complète" et "← Retour" → `src/seo.js`
- [x] Fix R1 (Cowork) : `backendKW` per-market dans `showVCConfirmModal` → `src/seo.js`
- [x] Fix R2 (Cowork) : `seoLaunchModify` route vers `goAgentVC` si multi-VC → `src/seo.js`
- [x] PATCH 1–4 : wizard Agent VC complet (seoLaunchModify, _doVCCopy supprimé, showVCConfirmModal supprimé, bouton Optimiser+Publier VC dans renderSEOSection) → `src/seo.js` + `src/core.js`
- [x] PATCH 5 : "Voir fiche complète" → `selectedAsin=agentVCState.asin;go('asins')` (était `go('seo')`) → `src/seo.js`
- [x] PATCH 6 : Boutons "SEO"+"VC" fusionnés en "🚀 Optimiser" → `goAgentVC(asin)` pour ASINs "À surveiller" — suppression auto-génération drawer → `src/seo.js`

---

## TÂCHES SUIVANTES

_(aucune tâche en attente — en attente du prochain brief de Fred)_

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

---

## TESTS À FAIRE AVANT MERGE MAIN (v3.4.9)

- [ ] Générer fiche SEO sur B07DPCH7XC → vérifier description = HTML structuré (`<p>`, `<strong>`, `<ul><li>`) sans `**`
- [ ] Vérifier champs synthèse (positionnement, leviers, erreurs, opportunite) sans `**`
- [ ] Tester guard apiKey vide → message `__ERR_NOKEY__` (pas d'erreur 401 muette)
- [ ] Wizard Agent VC : étape 3 bouton Confirmer bloqué si SKU vide
- [ ] Wizard Agent VC : étape 5 multi-VC → un script par vendor code (COGEX + 3J6MN)
- [ ] Tester URL VC : COGEX + SKU `B07DPCH7XC` → URL correcte
- [ ] Tester URL VC : 3J6MN + SKU `643416` → URL correcte

---

**FIN CLAUDE_CODE_CONTEXT.md — màj : 7 mai 2026 (v3.4.9)**
