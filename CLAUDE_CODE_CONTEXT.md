# CLAUDE_CODE_CONTEXT.md
**Fichier vivant — mis à jour à chaque fin de session**
**Dernière mise à jour :** 5 mai 2026

---

## RÈGLE N°1 — ABSOLUE

**STOP — expose le plan — attends le GO de Fred avant tout commit, déploiement ou modification.**
Fred valide. Claude Code exécute. Jamais l'inverse.

---

## ÉTAT DU PROJET

| Environnement | Version | URL |
|---|---|---|
| Production (main) | v3.2.24 | https://amazon.foliow.app |
| Recette (staging) | v3.4.3 | https://d9xny9istvl53.cloudfront.net |

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

---

## STACK TECHNIQUE

- Frontend : HTML5 + CSS3 + JS vanilla — **build via `build.py`** depuis `src/`
- Architecture : modulaire — `src/core.js`, `src/seo.js`, etc. — **jamais modifier le HTML directement**
- Dépôt local : `C:\AmazonPilot\`
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
10. Déposer en local + commiter sur staging
11. Mettre à jour ce fichier — commiter

---

## RÈGLES DE DÉVELOPPEMENT GRAVÉES

### Règles absolues — ne jamais remettre en cause
- `node --check` obligatoire avant toute livraison
- Jamais de commit direct sur `main`
- Jamais modifier le HTML monolithique directement — toujours passer par `src/` + `build.py`
- Jamais inventer de spec produit dans un prompt SEO — uniquement ce que `seoFetchFiche` retourne
- ASINs `sourcingOnly` = 0 en CA Ordered — ne jamais revenir dessus sans mesure d'impact
- Livrable nommé `amazon-pilot-vX.Y.Z.html` — jamais `amazon-pilot-latest.html` (Fred fait la copie)

### Règles d'architecture
- `seoResults[asin][market]` = chemin correct avec market — jamais le chemin plat `ficheOptimisee[asin].backendKW`
- `window.onerror` (pas `addEventListener('error')`) pour intercepter erreurs extension
- ISO week numbers (`targetWeek = currentWeek - 1`) pour détection données manquantes
- Deploy : `--cache-control "no-cache,no-store,must-revalidate"` sur tout upload S3

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

## TÂCHES EN COURS (session v3.4.3)

- [x] Bug URL `buildVCModifyPrompt` → CORRIGÉ dans v3.4.1
- [x] Bug chemins `backendKW`/`description` → CORRIGÉ dans v3.4.1
- [x] Fix `parseSEOResponse` : `.replace(/\*\*/g, '')` sur `result.description` → `src/seo.js` (pas core.js)
- [x] Fix `buildSEOPrompt` : directive DESCRIPTION HTML structurée (5 blocs) → `src/seo.js`
- [x] Fix `buildSEOPrompt` : directive BACKEND_KEYWORDS 5 blocs + liste INTERDIT → `src/seo.js`
- [x] Fix bloc INTERDIT : ajout termes "incassable", "homologué", "certifié", "compatible tous modèles" → `src/seo.js`

**Note architecture :** les fonctions SEO (`buildSEOPrompt` ×2 + bloc INTERDIT + `parseSEOResponse`) sont dans `src/seo.js`, pas `src/core.js`.

---

## TÂCHES SUIVANTES (ne pas toucher avant GO Fred)

- Accordéon étapes validées (clic déplier/replier sur étapes ✓) → `src/seo.js`
- SKU obligatoire étape 3 (bouton Suivant bloqué si vide) → `src/seo.js`
- Multi-vendor codes étape 5 (un script par VC, SKU éditable par VC) → `src/seo.js`

---

## DÉCISIONS ARCHITECTURE PRISES (ne pas remettre en question)

| Décision | Contexte | Date |
|---|---|---|
| ASINs sourcingOnly = 0 en CA Ordered | Évite faux positifs sur ASINs Appro uniquement | mai 2026 |
| Chemin `seoResults[asin][market]` avec market | backendKW et description stockés par marché, pas à plat | mai 2026 |
| `amazon-pilot-latest.html` hors `.gitignore` | CI déployait ancienne version — fix `ls amazon-pilot-v*.html | sort -V | tail -1` dans deploy.yml | mai 2026 |
| Plus de livraison HTML par Claude chat | Fichiers trop gros — Claude Code génère et dépose | mai 2026 |

---

## TESTS À FAIRE AVANT MERGE MAIN (v3.4.3)

- [ ] Générer fiche SEO sur B07DPCH7XC → vérifier description = HTML structuré (`<p>`, `<strong>`, `<ul><li>`) sans `**`
- [ ] Vérifier backend KW présents dans le script VC généré
- [ ] Tester URL VC : COGEX + SKU `B07DPCH7XC` → URL correcte
- [ ] Tester URL VC : 3J6MN + SKU `643416` → URL correcte

---

**FIN CLAUDE_CODE_CONTEXT.md — màj : 5 mai 2026 (v3.4.3)**
