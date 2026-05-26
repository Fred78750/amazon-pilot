# Claude_Orchestrateur_Context.md
**Version :** V0.7 — 26 mai 2026
**Produit par :** Claude Orchestrateur (contenu)
**Déposé sur le repo par :** Claude Code (commit + sync repo local) — Claude Code ne modifie pas le contenu
**Transmission :** Fred fait le pont entre Orchestrateur (qui produit) et Claude Code (qui dépose)
**Lu par :** Claude Orchestrateur en début de chaque session chat avec Fred

**Historique de versions :**
- V0 (matin 19 mai) — création initiale, cadrage roadmap v3.6.2 → v3.11
- V0.1 (soir 19 mai) — patterns `oninput`/`render()`, CI vs `.gitignore`, `PYTHONIOENCODING` ; règle de maintenance ; statut prod v3.6.2 ; mise à jour roadmap
- V0.2 (20 mai) — sections **Personas et circuit d'achat**, **Démo commerciale cible**, **Cartographie fonctionnelle 80/20** ; arbitrage v3.6.3 tranché ; règles 11-13 ; patterns d'erreur enrichis
- V0.3 (21 mai matin) — **scénario commercial réel** (onboarding dissimulé) ; **segmentation marché 3 strates** ; **contrainte SEPA ETI** ; **modèle économique freemium structuré** ; **compteur IA page Configuration** ; règles 14-15 ; v3.6.3 fenêtre `recovered` arrêtée à 90j
- V0.4 (21 mai fin de journée) — **refonte numérotation versions** (v3.6.x.y, v3.7 réservé archi) ; **merge prod opportuniste** ; **stratégie format ERP** (modèle fourni) ; **v3.6.4 = Parser ERP universel** (en attente Gers) ; **méthodologie YoY Étape 1** (grille 12 Free + 4 Pro, formalisée en skill séparé) ; **3 patterns d'erreur supplémentaires** identifiés en session 21 mai ; correction roadmap (suppression v3.8 → v3.13)
- V0.5 (22 mai matin) — 7 patterns d'erreur identifiés sur session brief v3.6.5 + livraisons Claude Code ; règle 18 (skill autoporteur) ; règle 19 (format de fichier explicite dans tout brief parsing) ; règle 20 (standard qualité subjectif → extraits littéraux obligatoires) ; règle 21 (séquentialité réelle = arrêter le message à la fin de Q1) ; mise à jour statut v3.6.5 en développement ; skill `YOY_ETAPE_1_grille_constat.md` passé V2 → V3. **Note : V0.5 produite mais jamais déposée sur le repo — remplacée directement par V0.6.**
- V0.6 (22 mai fin de soirée) — v3.6.5.12 + v3.6.3 livrées prod groupées (règle 17), rectification roadmap Parser ERP = v3.6.6, modèle format ERP rectifié, règles 23-26 ajoutées, 8 nouveaux patterns d'erreur, précision règle 16, statut prod v3.6.5.12, règle 27 (tag git groupé), backlog technique infrastructure créé.
- **V0.7 (26 mai 2026) — Apports majeurs : (1) v3.6.6 Parser ERP universel livré prod 22 mai + v3.6.6.2 Parser CSV VC multilingue EN-first + SMOKE_REF par client + collecte historique livré prod 22 mai soirée, (2) règles 28-30 ajoutées (audit 4 blocs systématique, scan project_knowledge début session, anti-tartines), (3) 7 nouveaux patterns d'erreur identifiés sur session 26 mai (tartines, sur-cadrage répété, rationalisation post-hoc, oubli project_knowledge, question pour info déjà fournie, comparaison écrans sans vérifier client actif, numérotation extrapolée), (4) **inversion stratégique EN-first / FR supplétif** documentée (parser VC), (5) **approche smoke test continuité statistique** (vs valeur figée) actée avec collecte historique amorcée, (6) **document YOY_DELTA_MAQUETTE_VS_PROD.md** produit le 26 mai pour tracer le delta maquette V3 vs prod itération par itération, (7) **mapping CTA maquette V3 par version** (v3.6.7 → v3.6.10) formalisé, (8) statut prod mis à jour v3.6.6.2 avec roadmap v3.6.7 → v3.6.10 confirmée.**

---

## CHECKLIST DE DÉMARRAGE DE SESSION (à lire en premier)

À l'ouverture d'une conversation avec Fred, avant toute autre action :

1. **Scanner project_knowledge** (règle 29 V0.7) — 2-3 requêtes ciblées : (a) contexte orchestrateur courant V0.x, (b) dernière session récap, (c) roadmap chantier suivant + tout sujet nommé dans le premier message Fred
2. **Annoncer mon rôle** au format `[Agent {Rôle}]` — par défaut Orchestrateur
3. **Confirmer le statut** : version prod actuelle, chantier en cours, prochaine cible (issu du scan)
4. **Demander le cadrage** si le sujet de session n'est pas explicite, ne pas inférer
5. **Refuser de coder** sans plan validé par Fred (Règle n°1)
6. **Signer chaque livrable** `[Agent {Rôle}] — Source : {fichier ou donnée} — Confiance : {haute|moyenne|à valider}`
7. **Pas de tartines** (règle 30) — réponse = question reçue
8. **En fin de session** : produire une autocritique + une diff à intégrer dans ce fichier

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
| 11 | **Avant tout cadrage de chantier**, vérifier 4 ancrages : (a) qui paie, (b) qui utilise, (c) sur quelle démo on signe, (d) quel est le livrable vendable. Si un manque, demander avant de proposer. | Cadrage en aveugle, révisions multiples en cours de session |
| 12 | **Avant toute proposition de nouvelle fonctionnalité**, auditer l'existant (tris/filtres/exports/alertes/vues prédéfinies déjà disponibles). Le réflexe est d'inventer ; le bon réflexe est de vérifier. | Panne Zélé — fonctionnalité dupliquée |
| 13 | **Fichier parallèle `CLAUDE_CODE_CONTEXT.md`** existe à la racine du repo, maintenu par Claude Code. Il contient TODOs hérités, checklists push, hashes versions stables, décisions archi. **Il peut diverger silencieusement** de cette mémoire orchestrateur. À chaque cadrage, vérifier si une priorité Claude Code héritée pourrait entrer en conflit avec un principe roadmap. Ne pas absorber son contenu ici. | Conflits roadmap silencieux |
| 14 | **À la réception d'un livrable Claude Code**, vérifier l'exhaustivité contre le brief avant de considérer le livrable comme intégrable. Si une section demandée manque ou est traitée superficiellement, demander complément avant de capitaliser dans la mémoire orchestrateur. | Mémoire orchestrateur figée sur trous (cf. audit 20 mai : page Configuration et compteur IA oubliés) |
| 15 | **Toute mécanique de paiement** doit être compatible **mandat SEPA / virement** (cycle 30 j fin de mois), pas carte bancaire. Les ETI cibles n'ont pas ou peu de cartes corporate disponibles ; leur service comptable refuse les engagements à plafond non défini. Forfaits prévisibles ≫ PAYG instantané. | Friction commerciale, échec d'acquisition sur la cible principale |
| 16 | **Numérotation versions** : `v3.6.x` = chantier fonctionnel majeur (x croissant), `v3.6.x.y` = patch/correction sur le chantier x (y croissant à partir de 1), `v3.7` réservé à la refacto archi modulaire. Pas de ripage : si bug en v3.6.7, le fix est v3.6.7.1, pas v3.6.8. **La numérotation suit l'ordre chronologique de production, pas l'ordre de planification** (précision V0.6) : si un chantier planifié à un slot N est sauté chronologiquement (un autre chantier prend N+1, N+2), le chantier sauté ne garde PAS son slot d'origine — il prend le prochain slot disponible quand il reprend. Exemple V0.6 : v3.6.4 planifié pour Parser ERP en V0.4, sauté car le fichier Gers est arrivé après v3.6.5. Quand le Parser ERP reprend en V0.6, il devient v3.6.6, pas v3.6.4. | Confusion roadmap commerciale, perte de traçabilité chantier ↔ version |
| 17 | **Merge prod opportuniste** : un chantier validé en preprod n'est pas mergé en prod automatiquement. Le merge prod se déclenche quand (a) le chantier seul justifie la friction (impact client, bug critique), ou (b) le chantier est groupé avec un chantier suivant qui justifie la friction. Pour les enrichissements mineurs, accumuler en preprod et merger en lot. À chaque cadrage de chantier, vérifier ce qui est "en attente preprod". | Friction inutile (invalidations CloudFront, communications), accumulation de risque résiduel non maîtrisée |
| 18 | **Skill autoporteur** : tout skill méthodologique produit doit contenir à la fois la méthode (le quoi/pourquoi) ET les templates littéraux opérationnels (le texte exact à reproduire). Un skill qui ne contient que du méta sans exemples concrets est un demi-skill — il ne suffit pas à Claude Code pour produire du rendu de qualité. Apprentissage v3.6.5 : skill V2 décrivait les 15 patterns ChatGPT sans donner les textes → patterns 5, 6, 7, 8 ratés dans la livraison. V3 corrige avec bibliothèque de templates littéraux. | Livraisons Claude Code à 35-40 % de la cible qualité, allers-retours de refonte |
| 19 | **Format de fichier explicite dans tout brief parsing** : tout brief Claude Code mentionnant un parser sur un format spécifique (export VC, ERP, CSV/XLSX client) doit inclure un bloc "Format de fichier" qui détaille : (a) structure (lignes de métadonnées en tête, ligne header réelle), (b) noms exacts des colonnes attendues, (c) encodage et caractères pièges (`\u202f`, apostrophe typographique `\u2019`, etc.), (d) mapping FR → noms internes. Apprentissage v3.6.5 (bug parser du 22 mai) : j'avais supposé que Claude Code déduirait le format VC FR du skill et de la maquette — erreur, ni l'un ni l'autre ne contient les noms exacts. | Bug parser bloquant en recette, refonte plusieurs jours |
| 20 | **Standard de qualité subjectif → extraits littéraux obligatoires** : quand un brief impose un standard de qualité (rédaction, design, ton, "soigné", "professionnel"), inclure dans le brief des extraits littéraux de la cible plutôt que des descriptions abstraites. "Vigilance qualité" n'est pas une consigne actionnable, un exemple l'est. Test mental : *"un développeur qui n'a jamais vu la cible doit pouvoir produire le résultat juste en suivant le brief"*. Si ce n'est pas tenable, le brief est sous-spécifié. | Claude Code livre du fonctionnel mais pas du qualitatif (cas v3.6.5.5 : MVP fonctionnel à 35-40 % de la cible) |
| 21 | **Séquentialité réelle = arrêter le message** : numéroter Q1/Q2/Q3 dans un même message ne crée pas une séquence — ça crée un bloc avec des étiquettes. La vraie séquence : poser Q1, **finir le message**, attendre la réponse, puis poser Q2 dans un nouveau message. Si plusieurs questions sont vraiment indépendantes et peuvent être répondues en bloc, l'assumer comme bloc et ne pas faire semblant de séquencer. | Fred répond à un sous-ensemble, l'orchestrateur croit avoir un cadrage complet, dérives en aval |
| 22 | **Avant toute analyse de dataset** (CSV/Excel/JSON), lister explicitement toutes les colonnes disponibles ET justifier celles que je n'utilise pas. Sinon je présume que je sais où va l'analyse et je laisse les colonnes inutilisées invisibles. Anti-rail mental. (Identifié 21 mai par test à l'aveugle confronté à Opus 4.7 + ChatGPT 5.5) | Analyse appauvrie, dimensions ignorées par paresse, valeur perçue dégradée |
| 23 | **Pas de sur-cadrage sur les sujets où Claude Code est l'expert.** Quand une décision technique relève de Claude Code (qualité du code, charge réelle d'un audit, choix d'implémentation, format d'un livrable technique), ne pas pré-arbitrer côté Orchestrateur entre des options abstraites (α/β/γ). Laisser Fred poser la question ouverte à Claude Code, qui répondra avec sa connaissance réelle du code et de sa charge. L'Orchestrateur sur-cadre uniquement quand il a une vue d'ensemble qui justifie son arbitrage. (Identifié 22 mai sur demande d'audit anti-régression où Fred m'a coupé pour interroger Claude Code directement) | Décision Orchestrateur en aveugle, friction inutile, perte de temps |
| 24 | **Sobriété analytique ≠ discrétion visuelle.** Le registre d'écriture (factuel, sans marketing) est indépendant du poids typographique (gros chiffre vs petit chiffre). On peut être très sobre rédactionnellement ET très impactant visuellement. Pour un hero block / KPI executive summary, l'impact visuel est même un objectif explicite (saisir le directeur d'ETI en 5 secondes). Le mode "sobre et analytique" s'applique aux sections détaillées (Lecture, Diagnostic, Plan d'action), pas au hero block. (Identifié 22 mai sur arbitrage "accroche plus sexy" v3.6.5.8) | Modules à fort enjeu commercial avec rendu visuel sous-calibré, prospect qui décroche avant les sections analytiques |
| 25 | **Sur un tableau de bord à plusieurs KPI, chaque KPI a sa propre logique de signe.** Pas de tonalité globale uniforme (tout rouge si compte en chute, tout vert si compte en croissance). On peut afficher 2 cards rouges + 2 vertes simultanément si les indicateurs racontent des choses opposées. Le traitement visuel (fond, bordure, couleur valeur) s'applique card par card, calculé dynamiquement selon la valeur de la card, pas selon une tonalité de compte. (Identifié 22 mai sur charte visuelle KPI v3.6.5.10) | Tableau de bord visuellement faux ou trompeur, masque les signaux importants |
| 26 | **Avant de pointer un écart de chiffres comme un bug, vérifier que les écrans portent sur les mêmes données.** Si deux écrans affichent des chiffres différents, vérifier d'abord les périodes/filtres/datasets affichés en sous-titre AVANT de conclure à un bug. L'information est généralement à l'écran, juste pas dans la zone d'attention immédiate. C'est l'équivalent visuel du sanity check parsing. (Identifié 22 mai sur fausse alerte chiffres maquette V3 vs v3.6.5.7) | Fausses alertes bug, perte de temps en diagnostic erroné, perte de crédibilité Orchestrateur |
| 27 | **Convention de tag git pour merges prod groupés (règle 17 conséquence).** 1 merge prod = 1 tag git. Si plusieurs chantiers sont groupés dans un seul merge (cf. règle 17), le tag porte le numéro du chantier le plus récent ; les chantiers groupés sont mentionnés dans le message de merge ET dans `CLAUDE_CODE_CONTEXT.md` pour traçabilité. **Pas de tag séparé** pour les chantiers intermédiaires d'un merge groupé. Exemple : merge 22 mai a regroupé v3.6.3 + v3.6.5 → 1 seul tag `v3.6.5.12`, pas de tag `v3.6.3` séparé. (Identifié 22 mai après merge prod et question Claude Code sur la convention) | Multiplication artificielle des tags git, confusion sur ce qui est livré quand |
| 28 | **Audit anti-régression en 4 blocs systématique avant tout merge prod.** Format établi comme standard depuis v3.6.5.12 puis v3.6.6 puis v3.6.6.2 : (Bloc 1) Validation code — `node --check`, APP_VERSION alignée, taille bundle ; (Bloc 2) Playwright smoke tests — tous existants verts + nouveaux tests spécifiques au chantier ; (Bloc 3) Navigation 10 écrans — 0 erreur JS console ; (Bloc 4) Tests fonctionnels ciblés — selon scope du chantier, vérifier explicitement les zones à risque. L'Orchestrateur précise dans le brief Claude Code les points fonctionnels prioritaires du Bloc 4. Verdict attendu : X/X checks OK avant GO prod. **3 itérations qualifient le standard** (v3.6.5.12 / v3.6.6 / v3.6.6.2). | Régression non détectée en prod, perte de confiance Cogex/Gers |
| 29 | **Scanner project_knowledge en début de chaque session.** Via 2-3 requêtes ciblées : (a) "contexte orchestrateur courant V0.x" pour la version active du contexte, (b) "dernière session récap" pour les apprentissages récents, (c) "roadmap chantier suivant" pour le statut courant. Si la session porte sur un chantier nommé (Buy Box, YoY, Parser, BOL Mismatch), ajouter une requête spécifique. Anti-pattern à éviter : démarrer une session en aveugle et redécouvrir ce qui est déjà décidé par moi-même (Orchestrateur). Pattern Fred explicite : "tu as déjà décidé" ou "tu te moques de moi". (Identifié 26 mai sur reprise post-compaction où j'ai oublié BRIEF_BUYBOX_v1.md, mapping CTA maquette V3, roadmap V0.6 v3.6.7=YoY Étape 2) | Question pour info déjà fournie, perte de temps Fred, perte de crédibilité Orchestrateur |
| 30 | **Pas de tartines.** Réponse = question reçue. Pas de récap automatique, pas de 3 hypothèses, pas d'options à arbitrer si la question n'en demande pas. Si Fred pose une question simple, répondre simplement. La tendance Orchestrateur à dérouler 3 lectures + 3 options + recommandation est à combattre. Test de tartine : si la réponse fait plus de 3 paragraphes pour une question simple, je tartine. Pattern Fred explicite et nommé 3 fois en session 26 mai : "tu me mets une tartine", "arrête de m'écrire des tartines", "tu te moques de moi". (Règle née de répétitions trop nombreuses) | Friction lecture Fred, signal Orchestrateur surchargé, perte d'efficacité opérationnelle |

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
- **`forEach` + `await` synchrone** : les callbacks `forEach` sont synchrones, jamais utiliser `await` à l'intérieur. Utiliser une boucle `for` indexée ou `for...of`. (Règle Claude Code session 11 mai 2026)
- **`cl()` dans async callback** : dans un callback `fetch().then()` ou `FileReader.onload`, `cl()` retourne le client actif **au moment de l'exécution**, pas au lancement. Solution obligatoire : capturer `var targetId = cl().id;` AVANT le fetch, puis `selClient(targetId); save();` DANS le callback. (Règle gravée — incident 13 mai 2026)
- **Localisation fonctions Buy Box** : toutes les fonctions Buy Box sont dans `src/buybox.js`, **pas** dans `src/core.js` malgré ce que disent certaines INSTRUCTIONS Claude Code. Tout brief touchant Buy Box doit pointer `src/buybox.js`. (Discordance documentée v3.6.1+)
- **Optimisation locale sur question globale** : quand Fred pose ce qui semble être un arbitrage binaire mais qui repose sur des fondations non discutées (acheteur, personas, démo cible), **remonter aux fondations avant d'arbitrer**. Pattern observé en session du 20 mai sur arbitrage v3.6.3 → 4 révisions au lieu d'une seule décision propre. (Panne Dériveur prolongée)
- **Production en aveugle pour "avancer dans la session"** : envie de rédiger un brief, une roadmap, un livrable parce que la session avance sans production concrète. Symptôme : commencer à écrire avant d'avoir l'info nécessaire. Garde-fou : si je suis sur le point d'écrire un livrable sans avoir lu un fichier que Fred vient de m'envoyer, ou en interpolant des fonctionnalités existantes, **m'arrêter**. (Identifié 20 mai)
- **Métaphore métier prise au pied de la lettre** : Fred utilise une métaphore ("démo live", "outil tournant") pour décrire un mécanisme commercial → je cadre l'outil produit sur la métaphore, sans questionner le scénario commercial complet. **Remède** : à chaque fois qu'un mot-clé métier apparaît (démo, présentation, onboarding, conversion, etc.), reformuler le scénario en 5 actes "qui fait quoi, où, quand" avant de cadrer. (Identifié 21 mai — V0.2 avait inversé démo et onboarding dissimulé).
- **Audit de livrable Claude Code non vérifié contre brief** : à la réception d'un livrable Claude Code, je dois confronter les sections présentes vs sections demandées dans mon brief initial. Sinon je capitalise sur des trous (cf. audit fonctionnel 20 mai — page Configuration et compteur IA absents). C'est la règle 14 formalisée. (Identifié 21 mai)
- **Bloc de questions au lieu de séquence** : je propose plusieurs questions en parallèle quand Fred peut traiter une par une. Coût : ergonomie de la réponse + cadrage en aveugle si Fred répond globalement. **Remède** : 1 question à la fois quand Fred est en mode "deepdive" ou quand le sujet est dense. Plusieurs questions OK uniquement pour des arbitrages mineurs et clairement séparés. (Identifié 21 mai — répété 2 fois dans la même session)
- **Roadmap V0.x reconstruite sans relire les récaps de session antérieurs** : à chaque nouvelle version du contexte, **balayer les récaps antérieurs** dans `/mnt/project/` pour ne pas perdre les décisions actées hors V0.x. Cas concret : v3.7 archi cadré dans le récap du 18 mai, manqué dans V0.3, ressorti par Fred en session 21 mai. (Identifié 21 mai — pattern Silencieux)
- **Rail mental dans analyse de données** : quand je crois savoir où l'analyse va atterrir, je me concentre sur les colonnes qui servent l'hypothèse et j'ignore les autres. Garde-fou : règle 22 (lister toutes colonnes, justifier celles non utilisées). Cas concret : analyse Cogex 21 mai, j'ai utilisé 2 colonnes sur 9 dans 3 itérations successives ; Opus 4.7 et ChatGPT 5.5 en aveugle ont balayé les 9 colonnes spontanément. (Identifié 21 mai)
- **Demander à Fred d'arbitrer sur des hypothèses orchestrateur** : si je ne sais pas ce qu'une proposition Claude Code veut dire ou si une donnée technique me manque, ne pas extrapoler et demander à Fred. **La bonne escalade est de rédiger des questions à Claude Code et Fred fait le pont**. Fred n'est pas là pour combler mes trous d'info techniques. (Identifié sessions précédentes, ressorti 20 mai sur arbitrage v3.6.3)
- **Parser silencieux qui retourne 0 ou des chiffres faux sans alerter** : un parser CSV/XLSX/ERP qui ne traite pas un caractère pige (typiquement `\u202f` espace insécable étroit utilisé par Amazon dans les exports FR) peut retourner des totaux faux par facteur ~2,7 sans aucun message d'erreur. **Garde-fous** : (a) liste explicite des caractères à neutraliser en commentaire du code, (b) sanity check obligatoire sur 1 ligne calibrée avant tout calcul agrégé (ex. Cogex : COGS B009G3EMDI / Unités = 1,92 €), (c) afficher les totaux au KAM avant analyse pour validation visuelle. Cas concret : bug session 21 mai, 3 itérations de maquette Cogex avec chiffres faux jusqu'à ce que Fred pose une question de vérification. (Identifié 21 mai)
- **Question intermédiaire qui ramène à un cadrage déjà tranché** : pattern Dériveur de dilution de responsabilité. Quand l'objectif initial est clair (ex. "enrichir le skill avec ces exemples"), ne pas poser de question intermédiaire qui demande à Fred de re-valider la suite. **Le déclenchement est déjà donné**. Reposer la question = forme déguisée de production en aveugle. Cas concret : session 21 mai, après avoir reçu les 3 analyses ChatGPT, j'ai présenté un tableau d'inventaire et reposé une question A/B/C/D au lieu de produire le skill V2 directement. (Identifié 21 mai)
- **Court-circuiter la procédure de dépôt repo en demandant à Fred de déposer** : même pour un fichier .md (skill, contexte, brief), c'est **Claude Code qui dépose** sur le repo, pas Fred. Fred est le pont, pas l'opérateur git. La règle ne fait pas d'exception pour les docs vs le code. Cas concret : sessions 21 et 22 mai, j'ai dit 2 fois "tu déposes sur le repo" avant que Fred me corrige. (Identifié 22 mai — répété 2 fois sans verbalisation explicite)
- **Supposer que les conventions de format de fichier client sont évidentes** : je rédige un brief Claude Code qui demande de parser un export Vendor Central FR, mais sans expliciter (a) la structure (ligne 1 = métadonnées, ligne 2 = en-têtes), (b) les noms exacts des colonnes FR, (c) l'apostrophe typographique `\u2019` dans "Chiffre d'affaires", (d) le mapping FR → noms internes. Résultat : Claude Code livre un parser qui ne marche pas et l'erreur n'apparaît qu'en recette. **Remède** : règle 19 (bloc "Format de fichier" obligatoire dans tout brief parsing). (Identifié 22 mai)
- **Standard de qualité subjectif sans modèle littéral à reproduire** : écrire "templates soignés", "vigilance qualité", "rendu professionnel" dans un brief ≠ donner les templates littéraux à reproduire. Conséquence prévisible : Claude Code livre du fonctionnel mais pas du qualitatif. **Remède** : règle 20 (extraits littéraux obligatoires pour tout standard de qualité subjectif). Cas concret : brief v3.6.5 §6.2 disait "vigilance qualité" sur les templates → livraison v3.6.5.5 à 35-40 % de la cible. Corrigé par production skill V3 avec bibliothèque de templates littéraux. (Identifié 22 mai)
- **Skill méthodologique sans templates opérationnels = demi-skill** : un skill qui ne contient que les principes (le quoi/pourquoi) sans les textes littéraux (le texte exact à reproduire) ne suffit pas à Claude Code. Apprentissage v3.6.5 : skill V2 décrivait les 15 patterns ChatGPT mais ne donnait pas les textes → patterns 5, 6, 7, 8 ratés dans la livraison. **Remède** : règle 18 (skill autoporteur). Tout futur skill produit doit contenir à la fois la méthode ET la bibliothèque de templates littéraux. (Identifié 22 mai)
- **Affirmer un fait technique sur le code Amazon Pilot sans citer la source** : tendance à répondre de mémoire sur l'état du code (ex. "la fonction X est dans tel fichier ligne Y"). Pattern positif observé chez Claude Code : il cite systématiquement la ligne du fichier source pour étayer ses affirmations techniques. À reproduire côté Orchestrateur. **Remède** : quand j'affirme quelque chose de technique, citer la ligne/fichier ou dire "à vérifier" plutôt que d'inventer. (Pattern positif Claude Code identifié 22 mai, à transposer)
- **Sur-cadrage par création d'options abstraites** : quand un sujet technique relève de l'expertise Claude Code (audit, charge, format), créer des options α/β/γ côté Orchestrateur AVANT de laisser Fred poser la question directe. Conséquence : Fred doit arbitrer en aveugle entre des options qui ne reflètent pas la réalité technique. **Remède** : règle 23. Quand le sujet relève de l'expertise Claude Code, formuler à Fred "demande directement à Claude Code, il saura mieux que moi" plutôt que d'imposer une grille d'arbitrage. (Identifié 22 mai sur demande d'audit anti-régression — Fred m'a explicitement coupé pour interroger Claude Code directement)
- **Confondre sobriété analytique et discrétion visuelle** : raisonner que "l'audience est experte donc le rendu doit être discret visuellement". Faux. Sobriété = registre d'écriture sans marketing, ≠ discrétion = poids typographique réduit. Un diagnostic médical n'est pas neutre visuellement, il nomme la chose en taille lisible. **Remède** : règle 24. Distinguer toujours les 2 dimensions. Pour un hero block / accroche, l'impact visuel est un objectif. (Identifié 22 mai sur arbitrage v3.6.5.8 quand Fred a tranché "clairement A" — plus impactant émotionnellement)
- **Raisonner en tonalité globale sur un tableau de bord** : appliquer un traitement visuel uniforme à tous les KPI d'un dashboard selon le signe dominant du compte (tout rouge si Cogex, tout vert si Gers). Faux : chaque KPI a sa propre logique de signe, et un même dashboard peut afficher 2 rouges + 2 verts. **Remède** : règle 25. Calculer le signe au niveau du KPI individuel, jamais au niveau du compte/dashboard. (Identifié 22 mai sur conception charte visuelle v3.6.5.10)
- **Comparer 2 écrans sans vérifier les périodes/datasets affichés** : voir 2 chiffres différents sur 2 écrans et conclure à un bug, sans regarder d'abord si les datasets sont les mêmes. **Remède** : règle 26. Avant tout diagnostic d'écart, vérifier sous-titres / filtres / dates. L'information est généralement à l'écran. (Identifié 22 mai sur fausse alerte −180 648 € vs −247 366 € entre v3.6.5.7 et maquette V3 — datasets différents volontaires)
- **Mode de communication non adapté à l'interlocuteur** : utiliser un ton consultatif (options + diagnostic) avec Claude Code qui a besoin de directif (corrections numérotées, ordre verrouillé, critère de validation strict). Et inversement, ton directif inutile avec Fred qui veut arbitrer. **Remède** : adapter le ton selon le récepteur. Avec Fred → consultatif. Avec Claude Code → directif. La même information se formate différemment. (Identifié 22 mai sur retour Claude Code v3.6.5.7 — Fred a explicitement demandé "tu peux être plus directif ?")
- **Test mental auto-évaluable > comparaison à un artefact externe** : dans un brief Claude Code visant un standard de qualité, donner un test mental auto-évaluable plutôt qu'une comparaison à un artefact externe. Exemple : "le directeur d'ETI doit comprendre en 1 minute en regardant le hero block" plutôt que "compare à la maquette V3". Le test mental est portable et reste applicable même quand l'artefact de référence n'est pas chargé en contexte Claude Code. (Pattern positif identifié 22 mai sur brief v3.6.5.8)
- **Généralisation prématurée à partir d'1 cas observé** : observer 1 cas concret (ex. Gers ne distingue pas Stock libre vs Stock Amazon) et en déduire que le modèle théorique est faux. Erreur classique : le cas observé est UN cas, pas LE cas. Le modèle doit accepter la diversité des configurations terrain, pas choisir la dernière vue. **Garde-fou** : si une observation suggère de modifier un standard, vérifier qu'on a au moins 2-3 cas convergents avant de modifier. Sinon, ajouter le cas observé comme variante acceptée, pas comme nouvelle norme. (Identifié 22 mai sur arbitrage stock cumulé/séparé pour Parser ERP — Fred a explicitement corrigé : "tu auras des cas de figure où les deux stocks sont séparés et d'autres où ils seront cumulés")
- **Pattern Zélé en cascade méthodologique** : quand je détecte que ma production précédente était sous-optimale, ma tendance est de surcompenser en sur-investissant la production suivante. Garde-fou : si Fred ne demande pas explicitement plus de profondeur, ne pas en ajouter de ma propre initiative. Le mieux est l'ennemi du bien. (Identifié 22 mai sur proposition de plan de travail 400 lignes après v3.6.5.6 — Fred a coupé "je t'arrête là, on voit ce qui est produit et on adapte")
- **Numéro de version cible extrapolé au lieu de demandé** : rédiger un brouillon en supposant que la prochaine version est v3.6.5.N+1 alors que Claude Code peut sauter des numéros ou suivre une autre logique. **Remède** : demander à Fred / Claude Code le numéro réel cible avant d'écrire un brouillon de retour. (Identifié 22 mai sur écart v3.6.5.8 → v3.6.5.9 dans mes brouillons)
- **Court-circuiter la procédure de dépôt repo en demandant à Fred de déposer** : même pour un fichier .md (skill, contexte, brief), c'est Claude Code qui dépose sur le repo, pas Fred. Fred est le pont, pas l'opérateur git. La règle ne fait pas d'exception pour les docs vs le code. Cas concret : sessions 21 et 22 mai, j'ai dit 2 fois "tu déposes sur le repo" avant que Fred me corrige. **Pattern à inscrire en réflexe** : tout fichier produit par Orchestrateur passe par Claude Code pour dépôt. (Identifié 22 mai — répété 2 fois, gravé en V0.6)
- **Tartines récurrentes** : tendance à dérouler 3 hypothèses + 3 lectures + recommandation au lieu de répondre à la question simple posée. Test de tartine : si la réponse fait plus de 3 paragraphes pour une question simple, je tartine. Fred l'a explicitement nommé 3 fois en session 26 mai. **Remède** : règle 30 (anti-tartines). Réponse = question reçue. Pas de récap automatique. Si Fred pose une question simple, répondre simplement. (Identifié 26 mai — pattern lourd nécessitant vigilance permanente)
- **Sur-cadrage répété malgré règle 23** : reproduire le sur-cadrage avec options α/β/γ même après que la règle 23 ait été gravée. Cas concret : session 26 mai, sur-cadrage sur calibration SMOKE_REF moins d'1h après avoir appliqué la règle 23 sur une autre décision. **Remède** : règle 23 nécessite vigilance permanente, pas une lecture unique. À chaque décision technique, vérifier explicitement : "est-ce que je sur-cadre ?". (Identifié 26 mai — pattern récurrent malgré règle existante)
- **Rationalisation post-hoc des dérives Claude Code** : quand Claude Code livre quelque chose qui dévie du cadrage initial, tendance à inventer une justification ("le scope a grossi", "c'est cohérent règle X", "pragmatique de garder") au lieu de demander une correction. Cas concret : session 26 mai, Claude Code livre `v3.6.7` au lieu de `v3.6.6.2`, je propose d'accepter la requalification au lieu de demander correction. Fred me redresse : "il peut revenir en arrière si tu lui demandes". **Remède** : avant de rationaliser, vérifier que la solution simple n'est pas "demander à Claude Code de corriger". (Identifié 26 mai)
- **Oubli project_knowledge avant questions** : poser une question à Fred sur un sujet déjà décidé dans mes propres documents (BRIEF_BUYBOX_v1.md, récap session, V0.x du contexte). Cas concret session 26 mai : demande "d'où vient l'info BOL Mismatch" alors que BRIEF_BUYBOX_v1.md §2.7 décrit la méthode et les 81 ASINs Cogex. Fred a dû me dire "tu trouveras tes propres décisions sur ces CTA". **Remède** : règle 29 (scan project_knowledge début session) + à chaque question structurante, vérifier via `project_knowledge_search` si je n'ai pas déjà décidé. (Identifié 26 mai — répété 2 fois en session)
- **Question pour info déjà fournie** : demander à Fred une donnée qu'il a uploadée 30 min plus tôt. Cas concret session 26 mai : demande "tu as les valeurs Gers de référence ?" alors qu'il avait uploadé le fichier `Ventes_ASIN_Fabrication_..._Personnalisé_01-01-2025_30-06-2025.xlsx` permettant de les calculer. Fred répond "tu te moques de moi ?". **Remède** : avant chaque question demandant une donnée, scanner les uploads de la session. Si la donnée peut être calculée à partir d'un fichier déjà fourni, la calculer. (Identifié 26 mai — pattern lourd, signal de fatigue Orchestrateur)
- **Comparaison écrans sans vérifier client actif** : voir un chiffre rouge / faux positif sur une capture et sauter à une hypothèse sans vérifier d'abord quel client est actif. Cas concret session 26 mai : voir V9a/V9b rouges sur recette et penser "bug Cogex" alors que le client actif sur la capture était Gers (V9 = test calibré Cogex, applique à Gers = faux positif). Re-violation directe de règle 26. **Remède** : règle 26 reformulée — avant d'investiguer un "bug" visible à l'écran, regarder en premier le client actif, la période et les filtres. Le contexte de la capture précède l'interprétation des chiffres. (Identifié 26 mai — règle 26 gravée mais pas en réflexe automatique)
- **Numérotation version extrapolée** : écrire un brouillon avec un numéro de version inventé (ex. v3.6.6.1 ou v3.6.7) au lieu de demander à Fred / Claude Code le bon numéro. Cas concret session 26 mai : appel "v3.6.6.1" puis Fred corrige "v3.6.6.2 car v3.6.6.1 existe déjà". **Remède** : avant tout brouillon mentionnant une version, demander confirmation du numéro exact. Le numéro de version est une donnée externe, pas une déduction Orchestrateur. (Identifié 26 mai)
- **Manquement formalisation delta visuel** : produire une maquette commerciale cible (ex. `maquette_yoy_cogex_v3.html`) et ne pas formaliser nulle part le delta entre cette cible et la prod actuelle. Conséquence : à chaque itération v3.6.x, je redécouvre ce qui manque au lieu de tracer l'avancement. **Remède** : tout chantier UI majeur produit aussi un document `XX_DELTA_MAQUETTE_VS_PROD.md` (créé 26 mai sous le nom `YOY_DELTA_MAQUETTE_VS_PROD.md`) qui liste section par section : présent en maquette / présent en prod / chantier futur. À mettre à jour à chaque livraison. (Identifié 26 mai sur question Fred — manquement reconnu)

---

## PERSONAS, CIBLE ET SCÉNARIO COMMERCIAL (V0.3 — refonte)

**Cette section est la boussole stratégique. La relire à chaque session de cadrage produit/roadmap/pricing.**

### Persona 1 — Le Directeur (cible commerciale, acheteur)
- **Rôle** : Directeur Commercial / COO / CEO chez la marque vendeuse Amazon
- **Comportement** : Veut comprendre la **santé globale du compte**. Lit un rapport, valide, signe.
- **Ce qui le convainc** : Un rapport en 4 étapes (Constat → Warning → Enquête → Rendu béotien) qui donne un diagnostic santé sans drill-down.
- **Ce qu'il achète** : **Le rapport YoY 4 étapes** + la preuve que son KAM a un outil opérationnel pour traiter ce que le rapport pointe.

### Persona 2 — Le KAM (utilisateur quotidien, pas l'acheteur)
- **Rôle** : Key Account Manager Vendor Central (interne marque ou consultant comme Fred)
- **Comportement** : Connaît son 20/80 par cœur. Pilote au quotidien sur ses gros ASINs. **Survole le bruit** (longue traîne) parce qu'il n'a pas le temps.
- **Ce qui lui manque** : Un mécanisme d'éveil aux dérives silencieuses du 80/20 (érosion lente sur la longue traîne, invisible à grande échelle).
- **Ce qu'il utilise** : Buy Box opérationnelle (cas Phase 2), Appros, Analyse ASINs, Revue Hebdo.

### Segmentation marché — 3 strates (V0.3)

| Strate | CA VC | Organisation | Account Manager Amazon | Cible Amazon Pilot |
|---|---|---|---|---|
| **Top tier** | > 10 M€ (ex. SEB) | Équipes web/marketing dédiées | Dédié | ❌ Hors cible — Amazon Pilot vient en frontal avec leur organisation interne |
| **Mid tier** | 2,5 → 10 M€ | AM Amazon partagé (norme : 40 comptes/AM), pas d'expertise interne | Partagé | ✅ **Cible principale** — "ils pataugent" |
| **Bas du milieu** | < 2,5 M€ | Aucun AM Amazon (seuil minimum 2,5 M€) | Aucun | ✅ **Cible secondaire** — les plus paniqués |

**Levier de conversion clé** : la **panique du directeur** + l'**incapacité à exploiter un constat sans expertise VC ou outil opérationnel**. Vendor Central est complexe : il faut des années pour maîtriser les arcanes (Suppression, Buy Box, défauts livraison, BOL Mismatch, etc.).

**Verrou anti-concurrence cabinet conseil** : Amazon Pilot ne livre pas qu'un diagnostic (n'importe quel cabinet le fait à 5 k€ la prestation). Il livre **l'outil opérationnel récurrent post-diagnostic** (Buy Box, Appros, Revue Hebdo). C'est ce qui justifie l'abonnement mensuel.

### Scénario commercial réel — onboarding dissimulé (V0.3 — correction V0.2)

**⚠ V0.2 avait mal cadré ce scénario en "démo live"**. La vraie mécanique est : **le travail facturable et la démo sont la même chose**. La frontière "vente vs prestation" est volontairement floue.

Scénario en 5 actes :

| Acte | Action | Lieu |
|---|---|---|
| 1 | Prospect contacte Fred : *"je perds du CA, je ne comprends pas pourquoi"* | Téléphone/visio |
| 2 | **NDA signé**. Fred récupère les CSV YoY du prospect (2 mois A-1 vs 2 mois A) | Mail/Drive |
| 3 | Fred importe les données dans Amazon Pilot (compte dédié au prospect) | Amazon Pilot — Import |
| 4 | Amazon Pilot **crache l'analyse brute YoY Étape 1** : tableau de constat factuel | Amazon Pilot — rubrique YoY (à construire) |
| 5 | Pour aller plus loin (Étapes 2, 3, 4), il manque des données → Amazon Pilot **propose d'injecter ce qui manque** = onboarding dissimulé. Bascule prospect → client. | Amazon Pilot — interface |

**Conséquences design** :
- Amazon Pilot doit **fonctionner en mode "données partielles"** dès le premier import
- Les imports complémentaires doivent être **proposés de manière fluide** au fil de l'analyse, pas centralisés dans un onboarding monolithique
- Le prospect **ne réalise pas** qu'il est en train de devenir client — il remplit des trous dans son diagnostic
- **L'anonymiseur Cogex / mode démo n'est pas nécessaire** — toutes les démos se font sur les données réelles du prospect sous NDA (sort de la roadmap, ne pas y revenir)

### Implications confidentialité

- Fred ne diffuse **jamais** les données réelles d'un client à un autre (Cogex en démo Gers, Gers en démo prospect, etc.)
- Chaque prospect/client a son **compte isolé** dans Amazon Pilot (déjà le cas via le multi-clients)
- Pour une démo "salon/conférence" sans NDA préalable : utiliser un compte Vitajardin/Fred propre ou un compte test générique. Cas marginal — pas de chantier dédié à ce jour.

### Stratégie YoY ↔ Buy Box
YoY et Buy Box ne sont pas concurrents — **ils servent des personas différents et se complètent** :

| Persona | Outil | Vue |
|---|---|---|
| Directeur | YoY (Étapes 1 à 4) | Macro / agrégat / diagnostic |
| KAM | Buy Box (Phase 1 + Phase 2) | Micro / opérationnel / traitement |

**Le mécanisme d'éveil au 80/20** est le pont entre les deux : c'est ce qui force le KAM à regarder ce qu'il ignore par défaut, parce que le rapport l'a remonté au directeur. À cadrer en v3.9 ou v3.10.

---

## MODÈLE ÉCONOMIQUE FREEMIUM (V0.3 — structuré)

### Vue d'ensemble

| Plan | Tarif mensuel | Contenu IA | Compatible mandat SEPA |
|---|---|---|---|
| **Free** | 0 € | Sonnet 4.6 — 2-3 analyses IA/mois max (rate-limit strict) | N/A |
| **Starter** | 79 € | Sonnet 4.6 — quota raisonnable (à calibrer empiriquement, ~50-100 analyses/mois) | ✅ |
| **Pro** | 149 € | Sonnet 4.6 — illimité raisonnable | ✅ |
| **Add-on Opus S** | +19 €/mois | 50 analyses Opus 4.7 / mois | ✅ |
| **Add-on Opus L** | +49 €/mois | 200 analyses Opus 4.7 / mois | ✅ |
| Marché supplémentaire | +29 €/mois | (existant V0.2) | ✅ |
| Utilisateur supplémentaire | +19 €/mois | À revoir (incohérence connue V0.2) | ✅ |

**Tous les chiffres ci-dessus sont à confirmer empiriquement** après mesure réelle des coûts IA via le compteur Configuration (voir section ci-dessous).

### Module Free YoY Étape 1 — calibrage validé (V0.3)

| Élément Étape 1 | Free | Pro |
|---|---|---|
| Chiffre choc agrégé (X € perdus, Y ASINs touchés, % du CA) | ✅ | ✅ |
| Liste ASINs avec CA, delta, marché | ✅ | ✅ |
| Ventilation par segment (A/B/C) | ✅ | ✅ |
| Ventilation par marché | ✅ | ✅ |
| **Cause par ASIN** (Suppression, Buy Box, etc.) | ❌ | ✅ |
| **Plan d'action priorisé** | ❌ | ✅ |
| **Rendu béotien (rapport Word)** | ❌ | ✅ |
| **Enquête détaillée (classification 4 catégories)** | ❌ | ✅ |

**Logique** : le constat sans la suite n'est pas exploitable par la cible (mid-tier qui pataugent + bas-du-milieu paniqués). Le Free crée la conviction "j'ai un problème" ; le Pro donne "voici quoi faire".

### Pricing Opus 4.7 — Piste "forfaits mensuels" validée (V0.3)

**Pourquoi forfaits mensuels et pas PAYG instantané** :
- Cible ETI = paiement par mandat SEPA, pas carte bancaire
- Service comptable refuse les "ardoises illimitées" auto-rechargeables
- Cycle de facturation prévisible = montant fixe mensuel = comptable client serein
- Pas de gestion "solde de crédits" côté Amazon Pilot (simplification UI)

**Avantage business** : la sous-utilisation génère de la marge (forfait payé même si non consommé).

**Inconvénient** : moins flexible qu'un PAYG pur. Accepté en l'état.

### Garde-fous coûts IA (V0.3)

- **Free** : rate-limit strict (2-3 analyses/mois) + modèle **Sonnet 4.6 imposé** (jamais Opus 4.7 en Free)
- **Starter/Pro** : Sonnet 4.6 illimité raisonnable, Opus uniquement via add-on payant
- **Mesure réelle** : compteur IA présent page **Configuration** d'Amazon Pilot (voir section Compteur IA)

### Pièges freemium analysés et bouclés (V0.3)

| Piège | État | Mitigation |
|---|---|---|
| Free trop puissant mange le payant | ✅ Non bloquant | Calibrage : constat ✅ Free, causes/plan/enquête ❌ Pro |
| Coût IA Free incontrôlable | ✅ Non bloquant | Rate-limit + Sonnet imposé. Coût mesuré ~0,03 €/appel. Sur 100 prospects Free/mois ≈ 5-20 € de coût IA total. |
| Rétention Free → Payant fragile | ✅ Non bloquant | Couvert par Piège 1 : la cible pataugue, ne peut pas exploiter le constat seul |

### Reste à arbitrer (V0.3 — backlog modèle économique)

- Quotas exacts Starter/Pro (à calibrer après mesure réelle)
- Mécanique facture pro-forma / Chorus Pro pour clients publics éventuels
- Incohérence connue V0.2 sur "facturation par utilisateur ET par compte VC = factures 800 €+/mois trop vite" → à reprendre dans un cadrage modèle économique dédié

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
| **Prod (main)** | **v3.6.6.2** — mergée 22 mai 2026 fin de soirée. **Inclut Parser ERP universel (v3.6.6) + Parser CSV VC multilingue EN-first + SMOKE_REF par client + collecte historique smoke_history (v3.6.6.2).** Tag git `v3.6.6.2`. |
| **Staging (CI)** | Aligné prod + commits docs post-merge (V0.7, brief v3.6.7, document YOY_DELTA_MAQUETTE_VS_PROD). |
| **Preprod** | Aligné prod. Préprod ready pour audit chantier v3.6.7 quand brief sera transmis à Claude Code. |

**Note convention branches (V0.6)** : les commits docs (mise à jour `CLAUDE_CODE_CONTEXT.md`, dépôt `Claude_Orchestrateur_Context.md`, dépôt briefs `CLAUDE_CODE_v*.md`) restent sur staging entre 2 merges prod. Ils ne sont dans main qu'au prochain merge groupé. C'est normal et n'empêche pas leur lecture par Claude Code qui travaille sur staging.

**Apprentissages V0.7 sur le Parser CSV VC (v3.6.6.2)** : 
- **Inversion stratégique EN-first / FR supplétif actée** : Vendor Central est par défaut en EN sur les marchés internationaux. Le profil cible commercial (ETI multi-pays) télécharge en EN. FR = cas particulier historique Cogex. Dictionnaire `VC_COL_DICT` construit EN canonique avec FR en synonymes.
- **4 incohérences typographiques FR Amazon Vendor Central documentées** dans le dictionnaire : (1) `Stock malsain` vs `Stock en mauvaise santé` (même fichier), (2) `Quantité de bons de commande ouverts` vs `Quantité de commande en cours`, (3) `Délai de livraison global du fournisseur` vs `Délai d'approvisionnement global du fournisseur`, (4) variation espaces autour des tirets cadratin et apostrophes typographiques `\u2019`.
- **Multi-pays agrégé par défaut** (somme par ASIN tous marchés confondus) — décision Fred. Stockage par couple (ASIN, Store_code) reporté en Portée 2 si besoin client.
- **Approche smoke test continuité statistique amorcée** : SMOKE_REF par client (Cogex calibré seul, autres clients en skip silencieux). Collecte historique des mesures via store IndexedDB `smoke_history` pour permettre détection de dérive statistique dans ~6-12 mois. Refonte évaluation par seuils statistiques = chantier futur quand l'historique sera assez riche.

### Roadmap validée — cible commercialisation été 2026 (refonte V0.4, RECTIFIÉE V0.6)

**Convention de numérotation (règle 16)** : `v3.6.x` = chantiers fonctionnels jusqu'à la commercialisation ; `v3.6.x.y` = patches ; `v3.7` réservé refacto archi modulaire post-commercialisation. **Précision V0.6** : la numérotation suit l'ordre chronologique de production, pas l'ordre de planification.

**Rectification V0.6** : v3.6.4 avait été planifié pour le Parser ERP en V0.4, mais le fichier ERP Gers est arrivé après v3.6.5. Donc :
- v3.6.4 = slot **sauté** (jamais ouvert techniquement, ne sera pas repris)
- Parser ERP = **v3.6.6** (prochain slot chronologique disponible)
- Roadmap restante glisse d'une unité

| Version | Libellé sémantique | Statut / Délai | Contenu |
|---|---|---|---|
| **v3.6.2** | Header + moteur de recherche ASIN transversal | ✅ **Livrée prod** 19 mai | Header avec moteur de recherche ASIN + rebranchement Buy Box / Appros / Prévisionnel sur `getFilteredAsins` |
| **v3.6.3** | Buy Box causes + statuts fragile/recovered | ✅ **Livrée prod** 22 mai (groupée avec v3.6.5.12, règle 17) | (c) Causes en colonne Phase 1 Buy Box + (d) statuts `fragile`/`recovered` avec fenêtre 90 j. Items (a) croisement défauts × ASIN et (b) filtres cycle de vie reportés v3.6.10 |
| ~~v3.6.4~~ | ~~Parser ERP universel~~ | ❌ **Slot sauté** | Planifié en V0.4, sauté chronologiquement. Repris en v3.6.6 |
| **v3.6.5** | YoY Étape 1 — Analyse comparée + module hameçon freemium | ✅ **Livrée prod** 22 mai (v3.6.5.12 finale) | Module "Analyse comparée". Suit le skill `YOY_ETAPE_1_grille_constat.md` V3. Module hameçon offert à 0 €. |
| **v3.6.6** | Parser ERP universel + modèle Amazon Pilot | ✅ **Livrée prod** 22 mai | Parser agnostique au format ERP. Stratégie : modèle Excel avec colonnes nommées. 2 configurations stocks acceptées (séparé/cumulé). Validation terrain Fred OK sur Gers (3 712 références). |
| **v3.6.6.1** | (patch antérieur) | ✅ **Livrée prod** | Patch correctif antérieur |
| **v3.6.6.2** | **Parser CSV VC multilingue EN-first + SMOKE_REF par client + smoke_history** | ✅ **Livrée prod** 22 mai soirée | Internationalisation parser CSV Vendor Central : EN canonique + FR supplétif. Dictionnaire `VC_COL_DICT` ~33 champs. Multi-pays agrégé par défaut. SMOKE_REF `SMOKE_REF_BY_CLIENT` (Cogex calibré, autres clients en skip info). Store IndexedDB `smoke_history` (v5) amorce collecte historique pour future détection de dérive statistique. Audit anti-régression 46/46 OK. |
| **v3.6.7** | **YoY Étape 2 — Warnings + éveil 80/20** | 🎯 **PROCHAIN CHANTIER** | Règles d'alerte visuelles 1-3 simples (CA -20%, Concentration +10pts, Catalogue -30%) + refonte visuelle KPI hero block + mécanisme éveil 80/20 longue traîne sur Dashboard + Revue Hebdo. CTA "Enquêter →" (générique). Brief produit 26 mai (`CLAUDE_CODE_v3_6_7.md`). ~1 sem |
| **v3.6.8** | YoY Étape 3a — Enquête ASINs disparus | À cadrer | Classification 9 codes VC → 3 catégories (À CREUSER / Mortalité / Autres). Table `VC_AVAILABILITY_CODES` (AC, IA, IR, OS, CP, CK, CQ, R2, R). Sections Marques + Anomalies. 6 CTA livrés (1, 2, 3, 6, 7, 8 maquette V3). ~4 sem |
| **v3.6.9** | YoY Étape 4 — Rendu béotien + export Word + Pro | À cadrer | Narrative IA Claude + export Word + toggle Vue Free/Vue Pro + plan d'action 5 priorités. Plan B documenté : sections fixes pré-rédigées si narrative IA non prête. ~3 sem |
| | **── Commercialisation été 2026 ──** | | |
| v3.6.10 | YoY Étape 3b — Couche causale défauts livraison + BOL Mismatch | Automne 2026 | Croisement défauts livraison 24 mois × ASINs. Liste native 73 ASINs Cogex purchase hold (vs CSV statique hors-process produit 26 mai). 4 CTA (4, 5, 9, 10 maquette V3). |
| **v3.7** | Refacto archi modulaire | Post-commercialisation | 3 décisions tranchées : (1) `python build.py` conservé, (2) JS vanilla maintenu, (3) découpage progressif par domaine. Slot réservé. |

### Principes structurants roadmap (mis à jour V0.4)
- **4 étapes YoY traitées dans l'ordre** : Constat (v3.6.5) → Warning (v3.6.6) → Enquête (v3.6.7) → Rendu béotien (v3.6.8). Pas de saut d'étape.
- **YoY et Buy Box sont complémentaires, pas concurrents** : YoY sert le directeur (macro/diagnostic), Buy Box sert le KAM (micro/opérationnel). Le scénario commercial est l'**onboarding dissimulé via YoY Étape 1**, pas une "démo live" combinée.
- **Buy Box s'enrichit principalement en parasitage YoY** (item a "croisement défauts × ASIN" sortira en v3.6.9 quand on aura la couche causale). Exception : enrichissements UI à coût marginal (~1,5 j) avec données déjà disponibles peuvent vivre en v3.6.x intercalaire, comme v3.6.3.
- **Pas de refacto archi avant commercialisation** — acceptation de la dette technique pour tenir l'été 2026. v3.7 attend.
- **v3.6.4 (Parser ERP) avant v3.6.5 (YoY Étape 1)** — ordre logique : on débloque Gers d'abord, on enchaîne YoY ensuite.
- **Tout chantier se mesure à la conversion commerciale Free → Pro** : ce qui n'avance pas le rapport 4 étapes ou la pédagogie 80/20 du KAM est secondaire.
- **Merge prod opportuniste (règle 17)** : v3.6.3 + v3.6.4 + v3.6.5 peuvent être groupés en un merge prod unique quand v3.6.5 sera prête, sauf urgence intercalaire.

### Méthodologie YoY Étape 1 — référence skill

La grille des 12 dimensions du constat YoY Étape 1 (figées suite à confrontation Opus 4.7 + ChatGPT 5.5 en session 21 mai) est formalisée dans un skill séparé pour réutilisation :

**Skill** : `YOY_ETAPE_1_grille_constat.md` (déposé dans le repo, déposé par Claude Code)

**Statut actuel : V3** (22 mai) — apport central = bibliothèque de templates littéraux (Templates 1 à 7) qui contient les textes exacts à reproduire pour chaque paragraphe interprétatif, verdict, diagnostic, plan d'action, conclusion. La V3 corrige le constat que les V1+V2 ne suffisaient pas à Claude Code pour produire un rendu de qualité ChatGPT (apprentissage v3.6.5.5 : patterns 5, 6, 7, 8 ratés faute de modèle littéral).

Ce skill est lu par :
- Claude Orchestrateur lors du cadrage du brief v3.6.5
- Claude Code lors de l'implémentation du module Analyse comparée
- Toute future session impliquant une analyse YoY (Cogex, Gers, prospect)

**Principe** : ne pas re-découvrir ces dimensions à chaque chantier. Le skill fige le minimum à produire ET les textes littéraux à reproduire. Le brief v3.6.5 reprend la grille telle quelle et précise le rendu UI, les seuils, les tolérances.

**Règle d'or pour Claude Code** : reprendre les templates littéraux QUASI TELS QUELS. Variables à remplacer, structure à conserver, ton à reproduire. Ne pas réinventer le texte.

### Stratégie format ERP (V0.4, RECTIFIÉE V0.6)

**Principe acté** : chaque client Amazon Pilot a son propre format ERP (Cogex, Gers, futurs clients = formats différents, souvent multi-feuilles, headers décalés, colonnes nommées différemment).

**Solution retenue** : Amazon Pilot **fournit un modèle Excel** avec les colonnes nommées attendues. Le client adapte son export ERP à ce modèle. Cohérent avec la philosophie d'onboarding dissimulé (l'effort retombe sur le client, pas sur Fred ni sur Amazon Pilot).

**Champs minimum attendus dans le modèle** :
- **SKU** (référence article ERP — c'est le champ N° chez Gers, code SKU chez Cogex)
- **Code Vie** (PERM, BEST, fin de vie, etc.)
- **Date prochain arrivage**
- **Qté prochain arrivage**

**Champs stock — 2 configurations acceptées en parallèle (rectification V0.6)** :

Le modèle Amazon Pilot expose 2 colonnes stock distinctes, et le parser tolère qu'un fournisseur en remplisse **une ou les deux** :

| Configuration | Champs remplis | Fournisseur type |
|---|---|---|
| **(a) Stocks séparés** | `Stock libre` (dispo non réservé) + `Stock Amazon` (réservé pour Amazon) | Fournisseur dont l'ERP ventile explicitement les 2 catégories |
| **(b) Stock cumulé** | `Stock disponible Amazon` (agrège réservation Amazon + libre allouable) | Gers (mai 2026) — colonne unique `Stock Physique non réservé` qui regroupe les 2 |

**Règle parser** : si le fournisseur ne remplit qu'une colonne stock, considérer cette valeur comme le "stock disponible pour Amazon" agrégé. Si les 2 colonnes existent, utiliser la distinction.

**Important (apprentissage V0.6)** : on ne choisit PAS l'une des 2 configurations comme norme. Les deux existent dans le terrain. Le parser doit accepter la diversité, pas imposer un format unique. Pattern d'erreur typique évité : généralisation prématurée à partir d'1 cas observé (cf. patterns d'erreur).

**Champs explicitement EXCLUS** :
- ❌ **Prévisionnel mensuel ERP** : la vélocité doit venir des **ventes réelles Amazon**, pas des prévisions fournisseur (politique commerciale fournisseur biaise les prévisions, optimisme structurel)
- ❌ **Configuration par client (mapping colonnes en UI)** : trop de friction à l'onboarding, le KAM ne connaît pas son format au moment de s'inscrire

**Tolérance côté parser** :
- Casse / accents
- Synonymes courants (ex. "Stock libre" / "Stock dispo" / "Disponible" / "Stock Physique non réservé")
- Première ligne header sur ligne 1 ou ligne 2 (selon export ERP)
- Une seule feuille active (le client doit nommer celle qu'il utilise selon le modèle)
- 1 OU 2 colonnes stock (selon configuration fournisseur)

**Mini-chantier dédié** : **v3.6.6** (cf. roadmap rectifiée V0.6). Le fichier ERP simplifié de Gers est arrivé le 22 mai (mono-feuille, 3675 lignes, format conforme à la configuration (b) stock cumulé).

### Cartographie fonctionnelle Amazon Pilot v3.6.2 (audit 20 mai)

Cette cartographie évite le piège **Zélé** (proposer un mécanisme nouveau alors que l'existant suffit). Référence avant tout brief de chantier UI/fonctionnel.

**12 pages auditées** : Dashboard, Revue Hebdo, Analyse ASINs, Diagnostic CA (Pompier), Buy Box Phase 1, Buy Box Phase 2, Appros, Prévisionnel, Agent SEO/VC, Fiche Client, Import, Potentiel.

#### Fonctionnalités 80/20 déjà disponibles
- **Analyse ASINs** : vue Segment C (= 5 derniers % du CA, définition exacte longue traîne) + compteur + export dédié. Tris "CA croissant", "Health Score bas", "Stock critique en premier", "Plus fortes baisses". Vues prédéfinies Ruptures / Baisses / Croissance / A / B / C avec compteurs et bordures rouges/oranges. **Page la plus complète sur le 80/20.**
- **Diagnostic CA (Pompier)** : tri "CA actuel croissant" et "CA perdu croissant" — remontent les petits ASINs en baisse.
- **Module Potentiel** : scoring 5 signaux (prévisions Amazon, tendance, PPM, stock, conversion) peut identifier des petits ASINs à fort potentiel **indépendamment** de leur CA absolu. Sert l'upside, pas le downside.
- **Dashboard** : filtre Segment C accessible via dropdown segment. **Mais aucun tri longue traîne** dans le tableau (tri CA décroissant en dur).

#### Trous identifiés (matière pour v3.9 / v3.10 sur le mécanisme d'éveil 80/20)
- **Aucune alerte cumulative longue traîne** nulle part (Dashboard, Revue Hebdo, Diagnostic CA, Buy Box, Appros, Prévisionnel).
- **Aucun KPI agrégé** type "X ASINs longue traîne en érosion = Y €/mois cumulé".
- **Buy Box Phase 1** : pas de filtre/alerte segment C. Tri criticité favorise les gros ASINs. Connection YoY ↔ Buy Box sur la longue traîne impossible en l'état.
- **Appros / Prévisionnel** : pas de filtre segment, pas de compteur "ruptures cumulées longue traîne".
- **Toutes les alertes sont "criticité absolue"** (CA en baisse > 10 %, stock < 30 u) — pas "cumul longue traîne".

#### Outils opérationnels KAM méconnus (utiles pour la démo)
- **Module Cas Vendor Central** dans Analyse ASINs (8 types de textes pré-remplis : stock, buybox, suppress, content, catalogue, detail_page, pricing, returns) — outil opérationnel KAM directement copiable dans VC.
- **Mode congés** dans Revue Hebdo qui suspend les alertes (argument démo : continuité KAM/intérim).
- **Analyse IA** disponible sur : Revue Hebdo (Diagnostic / Opportunités / Risques), Diagnostic CA (`runAI('decline')`), Appros, fiche détail ASIN.
- **Script VC publication** dans Agent SEO/VC — prompt prêt à coller dans Claude in Chrome.

#### Page Configuration — compteur IA (V0.3 — découvert par capture Fred)
**Distinct de "Fiche client"** dans la sidebar. Audit du 20 mai l'avait sauté (audit optionnel non livré). Contenu vu :
- **Sélecteur de modèle IA** : Sonnet 4.6 (Standard ~0,01 €/appel) ou Opus 4.7 (Premium ~0,08 €/appel)
- **Consommation session en cours** : appels, tokens in/out, coût €
- **Détail par feature** : Revue, SEO, SEO enrich, etc. (toutes les features IA consommées)
- **Historique cumulé (N derniers appels)** : tokens cumulés, coût total
- **Smoke test** : 8/8 vitaux + 7/7 importants (validation santé app)
- **Bouton "Lancer" smoke test**

**Données mesurées Cogex (capture 21 mai)** : 90 appels cumulés = 2,93 € total. Coût moyen ~0,033 €/appel toutes features confondues. **Référence empirique fiable** pour calibrer le modèle économique.

#### Bugs/incohérences UI repérés à l'audit (à creuser)
- **Buy Box Phase 1** : filtre cycle de vie "Best / Permanent / Fin de vie" **visuellement présent mais sans effet fonctionnel** en v3.6.2 (`codeVie` non joint à `c.asins`).
- **Tabs Buy Box Phase 1** : "Fragile" et "Récupérées" toujours vides en v3.6.2 — résolus par v3.6.3 (item d).

#### Conséquences pour les briefs futurs
- Avant d'inventer un module 80/20 nouveau : vérifier si Analyse ASINs / Diagnostic CA peuvent déjà servir (souvent oui).
- Le **mécanisme d'éveil au 80/20** = 3-4 KPIs agrégés + alertes cumulatives posés au bon endroit (Dashboard, Revue Hebdo). Pas un chantier majeur — à cadrer en **v3.9 ou v3.10**, pas v3.6.3.

### Clients actuels
- **Cogex Outillage** — marché FR — codes vendor `COGEX` et `3J6MN` — préfixe S3 `cogex/`
- **Gers Équipement** — marchés FR+ES+NL+DE+BE+IT — préfixe S3 `gers/` — multi-comptes ("Bon de Commande" GERS FR + "Fournisseurs catalogue" un par marché)

### Modèle économique
**Voir section "MODÈLE ÉCONOMIQUE FREEMIUM (V0.3)" plus haut** pour la structure complète : Free / Starter / Pro + add-ons Opus + contraintes paiement SEPA.

Repères courts : Free 0 € (Sonnet rate-limit), Starter 79 €/mois, Pro 149 €/mois, Add-ons Opus 19 € ou 49 €/mois. Tous chiffres à confirmer empiriquement via le compteur IA Configuration.

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

## BACKLOG TECHNIQUE INFRASTRUCTURE (V0.6)

Items non bloquants mais à traiter à un moment opportun. Ne déclenchent pas de chantier dédié — à intégrer comme tâche annexe d'un chantier qui a un peu de marge.

| # | Item | Priorité | Contexte | Quand le traiter |
|---|---|---|---|---|
| BTI-1 | **Workflow `deploy-preprod.yml` absent** | Moyenne | La branche preprod existe sur GitHub mais aucun workflow ne la déploie automatiquement. Le déploiement preprod actuel se fait via AWS CLI direct (cf. merge prod 22 mai). Identifié par Claude Code dans rapport post-merge. Pertinent dès qu'on utilise preprod plus systématiquement (audit anti-régression routine v3.6.6+). | Quand un chantier a 30 min de marge en fin (probablement v3.6.7 ou v3.6.8). À demander en parallèle, pas en chantier dédié. |
| | | | | |

**Ajout d'items** : quand Claude Code signale un point de dette infrastructure dans un rapport post-merge ou post-livraison, l'inscrire ici avec contexte + quand le traiter. Ne pas le perdre.

**Suppression d'items** : quand l'item est traité, le supprimer de la table (ne pas garder de trace dans une section "DONE", la traçabilité est dans l'historique git).

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
