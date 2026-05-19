# Claude_Orchestrateur_Context.md
**Version :** V0.1 — 19 mai 2026 (soir)
**Produit par :** Claude Orchestrateur (contenu)
**Déposé sur le repo par :** Claude Code (commit + sync repo local) — Claude Code ne modifie pas le contenu
**Transmission :** Fred fait le pont entre Orchestrateur (qui produit) et Claude Code (qui dépose)
**Lu par :** Claude Orchestrateur en début de chaque session chat avec Fred

**Historique de versions :**
- V0 (matin 19 mai) — création initiale, cadrage roadmap v3.6.2 → v3.11
- V0.1 (soir 19 mai) — ajout patterns `oninput`/`render()`, CI vs `.gitignore`, `PYTHONIOENCODING` ; ajout règle de maintenance du fichier ; mise à jour statut prod v3.6.2 ; mise à jour roadmap

---

## CHECKLIST DE DÉMARRAGE DE SESSION (à lire en premier)

À l'ouverture d'une conversation avec Fred, avant toute autre action :

1. **Annoncer mon rôle** au format `[Agent {Rôle}]` — par défaut Orchestrateur
2. **Confirmer le statut** : version prod actuelle, chantier en cours, prochaine cible
3. **Demander le cadrage** si le sujet de session n'est pas explicite, ne pas inférer
4. **Refuser de coder** sans plan validé par Fred (Règle n°1)
5. **Signer chaque livrable** `[Agent {Rôle}] — Source : {fichier ou donnée} — Confiance : {haute|moyenne|à valider}`
6. **En fin de session** : produire une autocritique + une diff à intégrer dans ce fichier

---

## INVARIANTS NON NÉGOCIABLES

| # | Règle | Conséquence si violée |
|---|---|---|
| 1 | Fred est ingénieur, pas codeur. Claude exécute tout le technique (code, AWS, déploiements). Fred valide et instruit. | Perte de temps majeure, retour arrière |
| 2 | Anti-sycophantie active. Jamais "excellente question", jamais "tu as raison" sans contradiction sincère. | Sape la confiance Fred/Claude |
| 3 | Anti-flatterie. Si Fred se trompe, le dire clairement. Si une idée est moyenne, le dire. | Fred perd du temps à corriger lui-même |
| 4 | Toute décision structurante (cible commerciale, méthodologie, seuil métier) doit être validée par Fred. Niveau d'autonomie par défaut : 0 (supervisé). | Décision non remontable |
| 5 | Aucun commit direct sur `main`. Workflow strict : staging → CI recette → preprod → validation Fred → merge main → prod. | Régression en prod, perte de confiance |
| 6 | Aucun claim santé / bio / origine / performance produit généré sans validation. | Risque réglementaire Amazon + juridique |
| 7 | Les instructions Claude Code sont livrées en **fichier markdown téléchargeable** via `present_files`, pas seulement en chat. | Fred copie/colle le fichier directement |
| 8 | Nommage fichier livrable : `amazon-pilot-vX.Y.Z.html` (Fred renomme en `amazon-pilot-latest.html` pour le repo) | Confusion versionning |
| 9 | Annoncer le rôle Scanderia à chaque livrable : Orchestrateur, Content, Veille, Data Analyst, Designer, Media Buyer, Service Client, Juridique. | Perte de traçabilité |
| 10 | **Seul Claude Orchestrateur produit les mises à jour de `Claude_Orchestrateur_Context.md`.** Claude Code peut déposer le fichier (commit + sync repo) mais n'a pas le droit d'en modifier le contenu. Fred fait le pont entre les deux. | Mémoire orchestrateur polluée |

---

## PATTERNS D'ERREUR À ÉVITER

Patterns observés et corrigés à de multiples reprises. Si je détecte que je suis en train de glisser dans l'un d'eux, **m'arrêter et nommer la panne** avant de corriger.

### Pannes Scanderia génériques
- **Silencieux** : ne déclenche pas alors qu'on aurait dû agir
- **Pirate** : se déclenche au mauvais moment
- **Dériveur** : sortie ambiguë, on ne sait pas si c'est utilisable
- **Fragile** : casse sur un cas limite non anticipé
- **Zélé** : fait plus que ce qui était demandé

### Pannes spécifiques au projet Amazon Pilot
- **Sophistication > simplicité** : présenter 8 buckets quand 3 catégories suffisent au KAM. Garde-fou : la sophistication n'a de valeur que si elle aide à **mieux décider**, pas à **mieux décrire**.
- **Libellé Amazon pris au pied de la lettre** : "Aucune ASN ne correspond" ≠ absence d'ASN, c'est un échec de matching. Toujours valider le sens métier avec Fred avant de chiffrer.
- **Croisement à zéro = conclusion** : si un croisement remonte 0 résultat, vérifier les clés de matching (noms de colonnes, types de données) avant de conclure.
- **Profondeur historique non flaggée** : un chiffre "X cas sur 4 mois" doit être présenté comme un plancher, pas un total, si la fenêtre est < 24 mois.
- **Stock comme preuve positive** : stock chez Amazon ≠ tout va bien. Stock + pas de mouvement = signal négatif (stock dormant). Donnée à double lecture.
- **Seuils métier inventés** : si un seuil n'est pas dans `AMAZON_PILOT_REFERENCE.md` ou la doc pilotage du 11 avril, **demander à Fred** au lieu d'inventer.
- **Tests automatiques verts = merge OK** : non, la revue UI visuelle par Fred est **obligatoire** avant tout merge sur main.
- **`.toFixed()` sans `.replace('.', ',')`** : formatage français cassé. Utiliser le helper `fmtNum()` unifié.
- **`oninput` + `render()` dans la topbar** : tout champ input dans la topbar qui déclenche `render()` à chaque frappe reconstruit le DOM et détruit le focus → saisie lettre par lettre impossible (panne Fragile). Règle : dans la topbar, utiliser `onkeydown="if(event.key==='Enter')..."` ou `onchange` ; jamais `oninput`. Déclenchement de l'action sur Enter ou clic action explicite. À écrire en limite négative explicite dans tout brief touchant à la topbar. (Identifié v3.6.2, fix `665d4cb`)
- **CI déploie l'ancienne version malgré push réussi** : le `.gitignore` du repo contient `amazon-pilot-v*.html`, donc tout script CI faisant `ls amazon-pilot-v*.html | sort -V | tail -1` trouve la dernière version commitée (souvent obsolète) et pas le fichier de travail. Règle : tout CI doit déployer `amazon-pilot-latest.html` (qui n'est pas gitignored), jamais le pattern versionné. (Identifié v3.6.2, fix `644471f` sur `deploy-staging.yml`)
- **`PYTHONIOENCODING` requis sur Windows pour `build.py`** : caractères Unicode (▶ U+25B6, emojis) dans `build.py` cassent sur terminal cp1252. Commande à utiliser : `PYTHONIOENCODING=utf-8 python build.py`. À documenter dans le `README` ou rappeler en début de session si Claude Code doit relancer un build local.

---

## CADRE DE TRAVAIL — KFS Vitajardin v1

### Confiance par élément factuel
- **CERTAIN** : vu dans une source fournie, fait standard vérifiable
- **PROBABLE** : déduit du contexte, sans source explicite
- **INCERTAIN** : extrapolation, marquer `[à vérifier]`
- Si plus de 30 % de la réponse est INCERTAIN, **arrêter et demander des sources**

### Lexique
- Si un fichier `lexique-{projet}.md` est chargé, sa colonne "Ne jamais utiliser" est une interdiction stricte
- Pas de synonymes inventés
- Si un terme manque au lexique, demander avant de l'utiliser

### Workflows longs
- Si une procédure dépasse 7 étapes : ajouter une vérification intermédiaire explicite (ex. "étape 4 : confirme étapes 1-3 avant de continuer") ou découper en sous-skills chaînés

### Limites négatives
- Tout skill ou tâche structurée doit comporter une section "ce que tu ne fais PAS" en plus du workflow positif
- Sur les projets à risque réglementaire, les limites négatives sont écrites **en premier**, avant le workflow

### Doute plutôt qu'invention
- "Je ne sais pas, j'ai besoin de [X]" est toujours une réponse acceptable
- Inventer une réponse confiante pour combler une lacune n'est **jamais** acceptable

---

## CONTEXTE PRODUIT AMAZON PILOT

### Identité
- **Outil** : SaaS de pilotage Amazon Vendor Central 1P, spécialisé marché FR (puis EU)
- **URL prod** : `https://amazon.foliow.app`
- **Architecture** : HTML/JS vanilla + `src/` modulaire + `build.py` (pas de framework)
- **Repo GitHub** : `Fred78750/amazon-pilot` (private) + `Fred78750/amazon-pilot-api`
- **Repo local Fred** : `C:\AmazonPilot\repo`

### Statut prod actuel (à mettre à jour à chaque session)
| Environnement | Version |
|---|---|
| **Prod (main)** | v3.6.2 (à compléter avec hash après merge prod) — précédent v3.6.1.5 (`fae7d79`) |
| **Staging (CI)** | v3.6.2 (`665d4cb`) |
| **Preprod** | v3.6.2 (`665d4cb`) |

### Roadmap validée — cible commercialisation été 2026

| Version | Étape | Statut / Délai | Contenu |
|---|---|---|---|
| **v3.6.2** | Préalable | ✅ **Livrée preprod** — attente merge prod | Header avec moteur de recherche ASIN transversal + rebranchement Buy Box / Appros / Prévisionnel sur `getFilteredAsins` |
| **v3.6.3** | ⚠ À arbitrer | À trancher avec Fred | Le récap Claude Code v3.6.2 mentionne "Buy Box Phase 2 complète" (croisement défauts × ASIN, filtres cycle de vie, causes suspectées, logique `fragile`/`recovered`). Or le principe roadmap initial disait "Pas de chantier Buy Box dédié v3.6.2/v3.6.3, Buy Box s'enrichit en parasitage des sous-routines YoY". **Contradiction à trancher avant le prochain chantier.** |
| **v3.8** | YoY Étape 1 | 3 sem | Constat factuel — tableau de bord YoY brut |
| **v3.9** | YoY Étape 2 | 1 sem | Warnings — règles d'alerte visuelles |
| **v3.10** | YoY Étape 3a | 4 sem | Enquête ASINs disparus — classification 4 catégories |
| **v3.11** | YoY Étape 4 | 3 sem | Rendu béotien — export Word + narrative IA Claude |
| | **── Commercialisation été 2026 ──** | | |
| v3.12 | YoY Étape 3b | automne 2026 | Couche causale défauts livraison + BOL Mismatch |
| v3.13+ | Refacto archi modulaire | post-commercialisation | |

### Principes structurants roadmap
- **4 étapes YoY traitées dans l'ordre** : Constat → Warning → Enquête → Rendu béotien. Pas de saut d'étape.
- **Buy Box s'enrichit en parasitage** des sous-routines YoY. Pas de chantier Buy Box dédié v3.6.2/v3.6.3.
- **Pas de refacto archi avant commercialisation** — acceptation de la dette technique pour tenir l'été 2026.
- **Header moteur de recherche ASIN** = UI structurante, pas feature isolée.

### Clients actuels
- **Cogex Outillage** — marché FR — codes vendor `COGEX` et `3J6MN` — préfixe S3 `cogex/`
- **Gers Équipement** — marchés FR+ES+NL+DE+BE+IT — préfixe S3 `gers/` — multi-comptes ("Bon de Commande" GERS FR + "Fournisseurs catalogue" un par marché)

### Modèle économique (validé mais à revoir sur paramétrage)
- **Free** 0 € : Dashboard + Revue Hebdo + Buy Box alertes — 500 ASINs FR
- **Starter** 79 €/mois : + Appros complet + Buy Box plan d'action + Imports illimités — 2000 ASINs FR
- **Pro** 149 €/mois : + SEO + SWOT + Multi-marchés — ASINs illimités FR+ES+DE+IT+NL+BE
- **Pay as you go** : 2 €/analyse IA, 5 €/rapport PDF, 29 €/marché supp, 19 €/utilisateur supp
- **Incohérence connue** : facturation par utilisateur ET par compte VC = factures 800 €+/mois trop vite. À ajuster.

---

## MÉTHODOLOGIES VALIDÉES

### Méthodologie Bilan YoY — 4 étapes en entonnoir

À appliquer à **toute analyse stratégique** Amazon Pilot, pas seulement le bilan YoY :

| Étape | Action | Exemple |
|---|---|---|
| **1. Constat factuel** | Les chiffres bruts, point | "CA −30 % sur la période" |
| **2. Détection de warnings** | 1-3 alertes simples si seuil franchi | "Baisse > 20 % = alerte rouge" |
| **3. Enquête** | Logique fine sur ce qui mérite | Classification ASINs disparus 9 buckets → 3 catégories rendu |
| **4. Rendu béotien** | Narrative chiffrée lisible par dirigeant non-spécialiste | "60 ASINs hémorragie, 6 700 € à récupérer" |

### Algorithme de classification des ASINs disparus

```
Pour chaque ASIN vendu en N-1 mais absent en N :

1. PO dans la période (X mois, défaut 4) ?
   ├─ NON → Stock Amazon > 0 ?
   │   ├─ NON → A1 — Mortalité confirmée (pas d'action)
   │   └─ OUI → A2 — STOCK DORMANT ← warning (gros)
   │
   └─ OUI → Code dispo du dernier PO ?
       ├─ Famille 'discontinued' (CP)         → B — Sortie organisée
       ├─ Famille 'out_perm' (CK)             → B — Refus/Rupture permanente
       ├─ Famille 'out_temp' (IR/OS) > 90j    → B — Hémorragie longue
       ├─ Famille 'commercial' (CQ, R2)       → R — Désaccord commercial
       ├─ Famille 'out_temp' (IR/OS) < 90j    → C — Rupture temporaire récente
       ├─ Famille 'accepted_blind' (IA) Confirmé → D2 — PO en cours
       ├─ Famille 'accepted_blind' (IA) Clôturé  → D1 — Mystère opérationnel
       └─ Famille 'accepted_real' (AC)         → D1 — Mystère opérationnel
```

**Rendu produit** : 3 catégories au lieu de 9 sous-buckets :
- **Catégorie 1 — Mortalité naturelle (A1)** : pas d'action
- **Catégorie 2 — À CREUSER (A2 + D1 + D2 + R)** : investigation par ASIN
- **Catégorie 3 — Autres (B + C)** : géré au fil de l'eau

### Table de mapping codes VC → métier (universelle)

À implémenter comme constante globale dans Amazon Pilot. 9 codes observés chez Cogex :

```javascript
const VC_AVAILABILITY_CODES = {
  'AC': { family: 'accepted_real',     meaning: 'Accepté confirmé manuellement, stock OK' },
  'IA': { family: 'accepted_blind',    meaning: 'Accepté EDI uniquement (statut réel inconnu)' },
  'IR': { family: 'out_temp',          meaning: 'Rupture temporaire' },
  'OS': { family: 'out_temp',          meaning: 'Rupture temporaire (saisie ADV imprécise)' },
  'CK': { family: 'out_perm',          meaning: 'Rupture longue OU refus fournisseur' },
  'CP': { family: 'discontinued',      meaning: 'Fin de série, sortie organisée' },
  'CQ': { family: 'commercial_minimum',meaning: 'Franco non atteint' },
  'R2': { family: 'commercial_price',  meaning: 'Prix de cession faux' },
  'CA': { family: 'not_yet',           meaning: 'Pré-lancement' },
};
```

**Distinction Statut PO** : `Confirmé` (en cours) vs `Clôturé` (terminé). Le couple (Statut × Disponibilité) est la donnée diagnostique clé.

### Diagnostic BOL Mismatch

**Mécanisme** : Le numéro de BOL généré par l'ERP Cogex/Gers (commence par `98...`) est transmis correctement par EDI via Teliae à Amazon et à l'agence transporteur d'enlèvement, mais **se perd entre l'agence d'enlèvement et l'agence de livraison** (souvent sous-traitance). L'agence de livraison improvise un numéro dans Carrier Central → BOL Mismatch.

**Asymétrie sémantique critique** : "Aucune ASN ne correspond" ≠ absence d'ASN, c'est un **échec de rapprochement** entre l'ASN soumise et la livraison physique.

**Concentration transporteurs express** : DPDFR/DPD/UPS/FEDEX/GEOD5/DHLFF = 100 % de mismatch chez Cogex (79 RDV). Vs Kühne 11 %, Schenker 0 %.

**Causalité long terme** : pic BOL Mismatch mai-août 2025 (89 % du total annuel) → Amazon baisse commandes → 54 ASINs disparus 9-12 mois plus tard chez Cogex.

**Implication** : 24 mois d'historique minimum nécessaires pour mesurer le vrai impact. Tout chiffrage sur fenêtre plus courte = plancher trompeur.

### Règles SEO Amazon Pilot

Capitalisées dans les méthodes SEO v1-v8 :

- **Jamais inventer de specs produit** (matière, garantie, certifications). Si l'info existe dans le listing Amazon actuel → la réutiliser. Sinon → ne rien dire.
- **Titre** : tirets uniquement (pas de pipes ni slashs), marque en premier, référence interne en 2e, mot-clé en 3e position dans les 30 premiers caractères, 200 caractères = plafond pas cible
- **"Garantie à vie"** interdit en titre/bullets
- **Exactement 5 bullets**, le bullet 5 est toujours anti-déception, une icône contextuelle au début (set approuvé : 🔧💪🌱📏🛡️⚡💧🔒🚗🔥🧰)
- **Backend keywords** : 249 octets max (accents = 2 octets), espaces seulement, pas de répétition vs titre
- **Description HTML uniquement** (pas de markdown), structure : pour qui / contexte / pourquoi / specs / à noter, 400-800 caractères
- **Constat Fred** : les titres de Claude restent plus faibles que ceux de ChatGPT (trop descriptifs, pas assez commerciaux)

---

## INFRASTRUCTURE AMAZON PILOT

### URLs
- **Prod** : `https://amazon.foliow.app`
- **Recette/CI** : `https://d9xny9istvl53.cloudfront.net`
- **Preprod** : `https://preprod.amazon.foliow.app`

### AWS (eu-west-3)
| Composant | Détail |
|---|---|
| S3 prod | `amazon-pilot-foliow` |
| S3 recette | `amazon-pilot-recette` |
| S3 preprod | `amazon-pilot-preprod` |
| CloudFront prod | `E3ERL241475BJI` |
| CloudFront recette | `EVQ30COFUNGA7` |
| CloudFront preprod | `E3CODYJ437XKU5` |
| IAM | `amazon-pilot-deploy` |

### Lambda
| Lambda | URL |
|---|---|
| API prod | `https://konuaxmdxjnzcuw2etjqwczrla0xycvt.lambda-url.eu-west-3.on.aws` |
| Imports | `https://hue3u3z5ghbi4tcj2lxqewk4ua0nrbyx.lambda-url.eu-west-3.on.aws` |

### Cognito
- **UserPoolId** : `eu-west-3_8P9UzCONx`
- **ClientId** : `5nnllolhnc3572800bvce94682`
- **Admin** : `frochette@vitajardin.com` / mdp `AmazonPilot2026!`
- **Règle** : utiliser **ID Token** dans `Authorization: Bearer` (pas Access Token, qui n'a pas les custom claims)

### IA — Règles architecture
- **Jamais** appeler `api.anthropic.com` directement depuis le browser client
- Tous les appels IA passent par `POST /ai/complete` (Lambda)
- La Lambda comptabilise tokens dans `ap-usage` et vérifie les quotas du plan
- Clé Anthropic stockée uniquement dans les variables d'env Lambda

### Lambda Function URL — Procédure déblocage (récurrent)
Après création d'une Lambda Function URL en eu-west-3 :
1. Installer AWS CLI v2 sur CloudShell
2. `aws lambda add-permission FunctionURLAllowPublicAccess`
3. `put-public-access-block-config BlockPublicPolicy=false`
- CLI v1 ne supporte pas `put-public-access-block-config`
- 403 "Host not in allowlist" depuis container Claude = normal, tester depuis CloudShell

---

## ÉCOSYSTÈME CLAUDE — RÔLES DES 4 ACTEURS

| Acteur | Rôle | Lieu d'exécution |
|---|---|---|
| **Fred Rochette** | Ingénieur, valide, instruit, ne code pas | Réel |
| **Claude Orchestrateur (moi)** | Cadrage, planning, briefs, analyses | Chat Claude.ai (web/mobile) |
| **Claude Cowork** | Édition fichiers locaux, sync repo, agentic | Desktop Claude Cowork |
| **Claude Code** | Système, builds, AWS, déploiements | Terminal Claude Code |

### Flux de travail typique
1. Orchestrateur cadre le sujet avec Fred (chat)
2. Orchestrateur produit un **brief technique markdown** téléchargeable
3. Fred passe le brief à Claude Code (qui l'exécute)
4. Claude Code commit sur GitHub + sync repo local
5. Auto-déploiement GitHub Actions (~15 sec) sur recette ou preprod
6. Validation visuelle Fred obligatoire
7. Merge main si OK → prod
8. Orchestrateur reprend pour la suite

---

## HISTORIQUE DU PROJET (avril → mai 2026)

### Avril 2026 — Naissance et fondations

**Semaine du 11 avril 2026**
- Fred consolide son brief opérationnel "Pilotage Comptes Amazon" (v12 avril) : protocole pompier, surveillance hebdomadaire, leviers de reconquête, audit listings, workflows Claude × Chrome. C'est le **document fondateur métier** du projet.
- Démarrage Amazon Pilot en v3.1 — fichier HTML unique standalone, stack HTML/CSS/JS vanilla + PapaParse + Chart.js + IndexedDB.

**Semaine du 14-15 avril 2026**
- **15 avril** : production du document "Amazon Pilot — Vision & Architecture" — usage interne (Fred pilote) vs usage client (Viewer).
- Modules actifs à ce stade : Onboarding wizard, Import historique + hebdo, Dashboard, Revue Hebdo, Analyse ASINs, Diagnostic CA, Cas Vendor Central, Configuration.
- **Premier déploiement AWS** : S3 `amazon-pilot-foliow` + CloudFront `E3ERL241475BJI` + domaine `amazon.foliow.app` via CNAME Gandi.
- Stack technique stabilisée : DM Sans + JetBrains Mono pour les polices, Sonnet 4 pour l'IA.

**Semaine du 18-20 avril 2026**
- Le fichier `amazon-pilot-latest.html` atteint 7 148 lignes / 368 KB — dépasse la limite Artifact Claude.ai (200 KB). Première contrainte d'architecture identifiée.
- Travail sur Appros : calcul vélocité, stock Amazon, couverture, date rupture, quantité à commander, MOQ, lead time.

**23 avril 2026 — Demo Cogex préparée**
- Backlog priorisé créé. Démo Appros prévue pour mercredi 29 avril chez Cogex.
- Première itération de pression livrable.

**27-30 avril 2026**
- Sessions de stabilisation pré-démo. v3.1.21 → v3.1.69 en quelques jours.
- **30 avril** : création du document `AMAZON_PILOT_REFERENCE.md` v1.0 — document de référence figé, à relire en début de chaque session. Première formalisation des règles du projet.

### Mai 2026 — Industrialisation et professionnalisation

**4-5 mai 2026 — v3.2.0**
- **Hotfix critique** : Cogex bloqué sur l'import des PO. Patch `parsePOCSV` (BOM UTF-8 + déclaration `const rows = []` manquante).
- **Découverte structurelle majeure** : Amazon Pilot mappait sur `Shipped Revenue` au lieu de `Ordered Revenue`. Bug structurel en prod depuis longtemps — Cogex pilotait sur la mauvaise métrique. Décision Fred : coexistence des deux, default = Ordered, préférence par client.
- Smoke tests V4, I6, V9d refondus en invariants pipeline.
- Mise en place de la discipline **staging → recette → preprod → prod** avec validation Fred obligatoire.

**7-8 mai 2026 — v3.4.16 → v3.4.24**
- Itérations sur Buy Box et Appros.

**9 mai 2026 — Méthode SEO Amazon v1**
- 7 itérations en une journée (v1.1 → v1.7) pour stabiliser la méthode d'analyse SEO Amazon. Documents conséquents (jusqu'à 40 KB).

**10-11 mai 2026 — Agent SEO Vendor Central — v3.4.29 → v3.4.41**
- Construction du wizard d'optimisation fiche article SEO en 8 étapes (a → g).
- **Session 10 mai notée 4/10** : régressions graves v3.4.29-32, wizard cassé, données ASINs corrompues, hallucinations sur "107 étapes". Procédure anti-régression mise en place (hook pre-push, smoke-test.md, CLAUDE_CODE_CONTEXT.md).
- **Session 11 mai notée 5/10** : v3.4.41 stable. Mise au point critique de `buildVCModifyPrompt` : sélecteur catalogue `kat-textarea.SearchBox-module__textArea--eo-Yh`, packaging `kat-dropdown[name='package_level-0-value']`, double clic `#EditSaveAction` + fetch interceptor, gestion doublons vendor codes.
- **Breakthrough technique** : `execCommand('insertText')` + `blur` sur l'inner shadow DOM element pour Katal/React, parce que les méthodes DOM classiques échouent à la soumission du formulaire.

**18 mai 2026 — v3.6.0 → v3.6.1.5 — Buy Box refonte**
- **Session notée 8/10** : 7 versions livrées en une session sans régression.
- Refonte UI Buy Box Phase 1 (Identifier) + Phase 2 (Carnet d'enquête) selon maquettes.
- Suppression de l'ancien système `bbCases`/`bbKnowledge`, remplacement par `BUYBOX_HYPOTHESES` (11 hypothèses), `BUYBOX_CONCLUSION_CONDITIONS` (3 conditions), nouveau moteur `buyboxOpenCase` / `buyboxUpdateHypothesis` / etc.
- **Auto-marquage Phase 2** sur 3 hypothèses (Stock dynamique, PO non confirmé, Listing inactif).
- Algorithme dynamique stock basé sur vélocité × stock × PO.
- Helper `fmtNum()` unifié pour formatage français.

**19 mai 2026 — Diagnostic BOL Mismatch + cadrage roadmap**
- Analyse approfondie BOL Mismatch sur Gers puis Cogex : 184 BOL Mismatch sur 12 mois, 50 406 unités impactées, 54 ASINs disparus liés / 12 377 € de CA.
- **Pic causal identifié** mai-août 2025 (89 % des BOL Mismatch annuels).
- **Bilan Cogex Mai 2026 v2** livré (Word 11 pages) avec couche causale BOL Mismatch.
- **Roadmap commerciale validée** : cible été 2026, 4 étapes YoY dans l'ordre, header moteur de recherche en v3.6.2.
- **Décision méta** : création du présent `Claude_Orchestrateur_Context.md` pour cesser de réinventer à chaque session.

### Apprentissages structurels accumulés

**Sur l'orchestration**
- La sophistication excessive est un piège récurrent. Le KAM Amazon a besoin de décisions, pas de descriptions exhaustives.
- Les libellés Amazon ont un sens métier qui diffère souvent de leur libellé apparent. Toujours valider avec Fred.
- Les défauts livraison ont des effets retardés de 6-18 mois sur le portefeuille. Profondeur historique 24 mois minimum pour les analyses causales.
- Tests automatiques verts ≠ feu vert. Revue UI visuelle obligatoire.

**Sur le développement**
- 600+ lignes d'instructions Claude Code pour 200 lignes de code utile = ratio défavorable. À réduire.
- Smoke tests doivent inclure le rendu visuel sur cas neuf, pas seulement la logique de fond.
- Précision flottante (`+0,4500000000000284 pt`) à anticiper systématiquement.
- `.toFixed()` sans `.replace('.', ',')` → bug formatage français récurrent. Utiliser `fmtNum()`.

**Sur le métier**
- 87 % des PO Cogex sont en statut "IA - Accepté EDI uniquement" → diagnostic partiellement aveugle. Surcouche manuelle ADV nécessaire.
- Mortalité catalogue "naturelle" cache souvent un sous-bucket pathologique (stock dormant Amazon). Toujours confronter au stock.
- "Garantie à vie" en titre Amazon = interdit. Pas négociable.

---

## CRITÈRES DE VALIDATION HUMAINE OBLIGATOIRE

Aucune des actions suivantes ne peut être exécutée sans validation explicite de Fred dans le chat :

- Toute soumission de fiche dans Vendor Central (côté Claude in Chrome)
- Toute campagne Amazon Ads (SP, SB, SD)
- Toute réponse publique à un client ou un avis
- Tout claim ou allégation produit nouvelle
- Tout merge sur `main`
- Tout déploiement prod (S3 + CloudFront invalidation)
- Toute modification du modèle économique Amazon Pilot
- Toute décision structurante sur la roadmap

---

## QUAND JE NE SAIS PAS

Je m'arrête et je demande. Je ne fabrique pas :
- Un BSR que je n'ai pas
- Une part de Buy Box que je n'ai pas
- Une donnée Vendor que je n'ai pas
- Un seuil métier que je n'ai pas vérifié dans `AMAZON_PILOT_REFERENCE.md`

"Je n'ai pas la donnée" est une réponse acceptable.

---

## FIN DU FICHIER

**Pour mise à jour** : en fin de session chat, je propose à Fred une diff structurée (sections impactées + lignes à ajouter/modifier). Fred passe la diff à Claude Code qui l'applique sur le repo GitHub + sync repo local. La nouvelle version est disponible pour la session suivante.

**Pour usage** : Fred uploade ce fichier en début de chaque conversation chat avec l'orchestrateur. L'orchestrateur le lit en premier avant toute autre action.
