# SKILL — YoY Étape 1 : Grille de constat factuel
**Type :** Skill méthodologique Scanderia
**Statut :** V2 — 21 mai 2026
**Auteur :** Claude Orchestrateur (Fred Rochette / Vitajardin)
**Source :** Confrontation à l'aveugle Claude Opus 4.7 + ChatGPT 5.5 sur dataset Cogex, puis enrichissement style à partir de 3 analyses ChatGPT supplémentaires (Cogex 2024 vs 2025, Cogex janv-fév vs mars-avril 2026, Gers S1 2025 vs Gers 2026 partiel)
**Audience :** Claude Orchestrateur (cadrage brief v3.6.5) + Claude Code (implémentation) + Fred (référence méthodo)

**Historique :**
- V1 (21 mai matin) — création, grille 12 dimensions Free + 4 Pro
- V2 (21 mai fin de journée) — ajout section "Style rédactionnel attendu" (15 patterns extraits de ChatGPT), précisions sur sanity checks parsing, clarification "Marge Amazon Retail" (pas marge industrielle)

---

## OBJET DU SKILL

Ce skill fige la grille minimale du **constat YoY Étape 1** dans Amazon Pilot. Il sert deux objectifs :

1. **Évite de re-découvrir ces dimensions** à chaque chantier ou à chaque session orchestrateur
2. **Garantit un niveau de richesse analytique** au moins équivalent à celui produit en aveugle par Claude Opus 4.7 et ChatGPT 5.5

Le skill encadre **ce qu'Amazon Pilot doit produire systématiquement** sur un CSV de ventes VC mis en regard d'une période A-1 équivalente.

---

## CONTEXTE D'EMPLOI

### Input attendu
2 fichiers CSV "Ventes par ASIN" exportés depuis Vendor Central pour des périodes A-1 et A. Chaque CSV doit contenir au minimum les colonnes suivantes (format standard VC France) :

- ASIN
- Nom du produit
- Marque
- Chiffre d'affaires basé sur les commandes
- Unités commandées
- Chiffre d'affaires basé sur les expéditions
- COGS expédié
- Unités expédiées
- Retours client

### Output attendu
Un **constat factuel structuré en 12 dimensions** (Free + minimum vital) + **4 dimensions stratégiques** (Pro, narratif IA).

### Calibrage Free / Pro
Cette répartition est figée par le modèle économique V0.3 :

| Niveau | Dimensions | Logique |
|---|---|---|
| **Free** | 1 à 12 | Constat factuel riche, données brutes lisibles — donne au prospect le diagnostic |
| **Pro** | 13 à 16 | Narratif IA, interprétation, plan d'action — débloque l'action |

---

## RÈGLES DE CALCUL PRÉALABLES (toutes dimensions)

### R1 — Précautions méthodo à poser d'emblée dans le rendu
- Les deux fenêtres peuvent être de durées différentes (ex. 61 j vs 48 j). **Toujours normaliser en €/jour et u/jour** pour la comparaison.
- Si la période A est incomplète, **projeter à période équivalente A-1** par extrapolation linéaire (CA_A × jours_A1/jours_A).
- Vendor Central 1P : "Unités commandées" = ce qu'Amazon a acheté à la marque via PO, pas la demande consommateur. C'est un point important pour interpréter les baisses.
- Les exports A-1 absorbent les retours et ajustements rétroactifs survenus depuis. Présence possible de décimales sur "Unités expédiées".

### R2 — Définitions normalisées
- **Pace** = valeur normalisée par jour (CA, unités, etc.)
- **Like-for-like** = restriction aux ASINs présents dans A-1 ET A
- **ASIN disparu** = CA > 0 en A-1 ET CA = 0 en A
- **ASIN apparu** = CA = 0 en A-1 ET CA > 0 en A
- **ASIN zombie** = CA > 100 € en A-1 ET CA < 5 € en A (présent mais effondré)
- **Prix moyen unitaire (PMV)** = CA commandes / Unités commandées
- **Marge brute** = CA expédié − COGS expédié
- **Taux de marge brute** = Marge brute / CA expédié
- **Taux de retours** = Retours / Unités commandées
- **Ratio expéditions/commandes** = CA expédié / CA commandes (signal logistique global)

---

## GRILLE FREE — 12 dimensions à produire systématiquement

### Dimension 1 — CA YoY (4 valeurs)
- CA brut période A-1 (avec durée en jours)
- CA brut période A (avec durée en jours)
- **CA A projeté à période équivalente A-1**
- **Variation €** : (CA_A_projeté − CA_A-1) en valeur absolue, signe inclus
- **Variation %** : pourcentage à période équivalente
- **Projection annualisée** : CA_A/jour × 365 vs CA_A-1/jour × 365 → écart en € sur 12 mois

**Justification du chiffre annualisé** : le directeur Co/COO/CEO raisonne en €/exercice, pas en €/jour. La projection annualisée est le chiffre choc qui paralyse.

### Dimension 2 — Unités YoY
Idem dimension 1 (brut, normalisé, projeté A-1, variation, projection annualisée).

**Lecture combinée Dim 1 + Dim 2** : si Δ unités est plus profond que Δ CA, le PMV monte (cf. Dim 3) — signal de mix ou de retrait des SKUs les moins chers.

### Dimension 3 — Prix moyen unitaire (PMV)
- PMV A-1
- PMV A
- Variation absolue (€) et relative (%)

**Interprétation** : PMV stable → baisse pure de volume. PMV en hausse → mix prix favorable (ou retrait des SKUs bas de gamme). PMV en baisse → guerre des prix ou mix dégradé.

### Dimension 4 — Marge Amazon Retail YoY (PAS la marge industrielle de la marque)
- CA expédié A-1 et A
- COGS expédié A-1 et A (= prix d'achat brut payé par Amazon à la marque × unités expédiées)
- Marge Amazon Retail A-1 et A (= CA expédié − COGS expédié)
- Taux de marge Amazon Retail A-1 et A (en %)
- Variation taux (en points de pourcentage)

**⚠ Précision méthodo critique (à afficher systématiquement dans le rendu)** : cette marge est la rentabilité **d'Amazon Retail sur le compte**, PAS la marge industrielle de la marque. La marge industrielle de la marque = (prix d'achat brut Amazon − coût industriel), donnée que la marque connaît seule (non disponible dans les exports VC). Confusion fréquente : ne pas écrire "marge brute" sans qualification.

**Sanity check obligatoire** : sur 1 ligne du dataset (typiquement le top contributeur CA), vérifier que `COGS expédié / Unités expédiées` = prix d'achat brut connu. Exemple Cogex : COGS de la bâche B009G3EMDI / 3 651 unités = 1,92 € (prix d'achat brut Cogex → Amazon vérifié). Si le calcul ne tombe pas juste, le parser est cassé.

**Interprétation** :
- Marge stable → Amazon conserve son économie. Lecture indirecte : Amazon n'a pas promu agressivement le compte (pas de signal commercial Amazon positif sur le compte).
- Marge en baisse → l'économie Amazon se dégrade sur le compte. Signal de risque : Amazon peut devenir plus sensible à la rentabilité, dégrader les PO, refacturer des CRaP.
- Marge en hausse → mix produit favorable côté Amazon, ou meilleure tenue des prix retail.

### Dimension 5 — Taux de retours YoY
- Retours A-1 et A
- Taux de retours A-1 et A (en %)
- Variation (en points de pourcentage)

**Interprétation** : retours en hausse = signal qualité dégradée ou produit inadapté. Retours en baisse = soit amélioration qualité, soit retrait des familles à retours élevés (mix).

### Dimension 6 — Ratio expéditions / commandes
- CA expédié / CA commandes en % (A-1 et A)
- Unités expédiées / Unités commandées en % (A-1 et A)

**Interprétation** : un ratio < 95 % en A vs ~100 % en A-1 = signal de décrochage logistique global (ruptures massives, refus Amazon). Un ratio normal (~100 %) **n'exclut pas** des problèmes ASIN par ASIN, mais ferme la piste d'un problème logistique systémique.

### Dimension 7 — Croisement ASIN (5 buckets)
Tableau avec 5 segments + comptes + CA/j A-1 + CA/j A + impact :

| Bucket | Critère | Nb ASINs | CA/j A-1 | CA/j A | Impact CA/j |
|---|---|---|---|---|---|
| Stables | présents A-1 et A, ±10 % | … | … | … | … |
| En baisse > 10 % | présents A-1 et A, delta_pct < −10 % | … | … | … | … |
| En hausse > 10 % | présents A-1 et A, delta_pct > +10 % | … | … | … | … |
| **Disparus** | CA > 0 en A-1, CA = 0 en A | … | … | 0 | … |
| Apparus | CA = 0 en A-1, CA > 0 en A | … | 0 | … | … |

**Lecture clé** : si la perte vient majoritairement des **disparus**, c'est une crise de catalogue (problème structurel). Si elle vient des **en baisse**, c'est un problème de performance par ASIN.

### Dimension 8 — Sous-segment "ASIN zombies"
ASINs présents dans les deux périodes mais effondrés (CA A-1 > 100 €, CA A < 5 €).

- Nombre total
- CA total perdu sur ce segment
- Liste des 20 premiers (ASIN, titre, marque, CA A-1, CA A)

**Justification** : segment particulièrement révélateur. Un ASIN qui passe de "vendeur" à "quasi mort" sans disparaître complètement = signal très probable de problème spécifique (Buy Box perdue, prix décalé, fiche cassée). Mérite une investigation cas par cas.

### Dimension 9 — Concentration top N
- Part dans le CA des Top 10, Top 20, Top 50, Top 100 ASINs en A-1 vs A.

**Interprétation** : concentration en forte hausse = perte de la queue longue, fragilité accrue (la perte d'un seul ASIN du top devient catastrophique).

### Dimension 10 — Ventilation par marque
Pour chaque marque présente dans le dataset :
- Part dans le CA A-1 et A (en %)
- CA/jour A-1 et A
- Évolution (+/− en €/jour)

Limité au Top 10 marques en CA A-1.

**Interprétation** : repère les marques qui décrochent (problème spécifique fournisseur ou catégorie) vs celles qui résistent ou progressent.

### Dimension 11 — Top gagnants / Top perdants
- **Top 15 perdants** en €/jour perdus (ASIN, titre, marque, CA/j A-1, CA/j A, delta €/j, delta %)
- **Top 15 gagnants** en €/jour gagnés (idem structure)

**Affichage Free** : on peut limiter au Top 10 si contrainte UI. Les listes complètes étant des exports CSV/XLSX téléchargeables.

### Dimension 12 — Détection anomalies catalogue
Fuzzy matching sur les noms de marques pour détecter les doublons orthographiques (ex. GREENGERS vs GREENGEERS) qui fragmentent artificiellement le reporting.

**Sortie** : liste des paires suspectes avec niveau de similarité et CA cumulé sur chaque variante.

**Justification** : signal métier important. Sans cette détection, un compte avec 5 % de doublons orthographiques voit son analyse marque biaisée. C'est aussi un proxy de la qualité des fiches Vendor Central.

---

## GRILLE PRO — 4 dimensions stratégiques (narratif IA + plan d'action)

### Dimension 13 — Hypothèses causales hiérarchisées
Narratif Claude Sonnet 4.6 (ou Opus 4.7 si add-on) basé sur les patterns observés dans les Dim 1-12.

Hiérarchisation typique (à adapter selon contexte client) :
1. **Décision Amazon** (réduction PO sur ASINs jugés à faible rotation/marge)
2. **Politique de prix / négociations annuelles** (cost basis trop élevé → Amazon source ailleurs)
3. **Ruptures / fiabilité d'approvisionnement** (PO non confirmés, scoring fournisseur dégradé)
4. **Suppressions listings** (problème conformité, image, contenu)
5. **Buy Box perdues à 100 %** (concurrence 3P)

### Dimension 14 — Grille de contrôle ASIN par ASIN
Squelette généré automatiquement, à compléter manuellement ou via d'autres modules :

| Contrôle | Question | Source de vérification |
|---|---|---|
| Disponibilité Amazon.fr | L'ASIN est-il achetable ? | Scraping fiche ou Vendor Performance |
| Stock Amazon | Amazon a-t-il du stock Retail ? | Rapport stock VC |
| Buy Box | Amazon détient-il la Buy Box ? | Module Buy Box Amazon Pilot |
| Contribution Vendor | Article actif côté Vendor ? | Catalog Manager VC |
| PO | Amazon a-t-il cessé d'émettre des commandes ? | Historique PO |
| Réception | Problèmes ASN/BOL ? | Delivery Defects |
| Fiche | Titre/variation/conformité ? | Listing Quality |
| Prix | Trop haut / CRaP / marge insuffisante ? | Pricing dashboard |

### Dimension 15 — Identification ASINs critiques à sécuriser
Top 5 contributeurs CA de la période A (les "best-sellers actuels"). Si un seul tombe, l'impact est massif.

**Format de sortie** : liste avec CA actuel, % du CA total, hypothèse de fragilité.

### Dimension 16 — Plan d'action priorisé
Narratif Claude Sonnet (ou Opus) basé sur l'ensemble des dimensions 1-15.

Format type :
- **Priorité 1** : Audit des N ASINs disparus de poids significatif
- **Priorité 2** : Sécuriser les best-sellers (Dim 15)
- **Priorité 3** : Reconstituer les familles en recul (Dim 10)
- **Priorité 4** : Résoudre les ASINs zombies (Dim 8)
- **Priorité 5** : Corriger doublons catalogue (Dim 12)

---

## STYLE RÉDACTIONNEL ATTENDU (V2 — apport central)

**Cette section a été produite à partir de l'analyse de 3 livrables ChatGPT 5.5 sur datasets variés (Cogex 2024/2025, Cogex janv-fév vs mars-avril 2026, Gers S1 2025 vs 2026 partiel). Elle fige les patterns d'écriture qui distinguent un rapport analytique d'un dashboard sec.**

### Principe central
Le constat YoY Étape 1 doit se lire comme **un rapport analytique d'expert**, pas comme un dashboard de chiffres. Ta cible (directeur Co/COO/CEO mid-tier sans expertise VC) ne sait pas lire un tableau de bord seul — elle a besoin de **phrases qui guident la lecture**, de **verdicts en sortie de chaque section**, et d'un **plan d'action opérationnel précis**.

### Pattern 1 — Précaution méthodo en ouverture (si périodes inégales)
Si les durées des deux périodes diffèrent, **ouvrir le rapport par une section "Point de vigilance"** qui :
- Affiche un tableau des durées
- Explique que la comparaison brute est biaisée
- Annonce la double lecture (brut + normalisé)

Si les durées sont identiques (cas Y/Y annuel complet), sauter cette précaution et ouvrir directement sur la synthèse.

### Pattern 2 — Section "Synthèse immédiate" en ouverture
Toujours en premier (après la précaution méthodo si elle existe). Composée de :
- **Tableau de synthèse** : ligne par indicateur (CA commandes, Unités, CA expédié, COGS, Unités exp, Retours), colonne par période + écart + variation %
- **Chiffres en gras** dans le tableau
- **Phrase verdict** en 1-2 lignes qui résume le sujet stratégique

### Pattern 3 — Double lecture brut + normalisé (si périodes inégales)
Quand les durées diffèrent : **deux tableaux successifs** :
- Tableau 1 : valeurs brutes (peut être trompeur)
- Tableau 2 : valeurs par jour (lecture juste)
- Suivi d'une **projection à durée comparable** ("Si le rythme se prolongeait jusqu'à...")

### Pattern 4 — Sections numérotées 1 à 12 max, titres = enseignement
**Les titres de section disent l'enseignement, pas l'indicateur** :
- ❌ "Dimension 3 — PMV" → trop technique, jargonneux
- ❌ "Analyse du prix moyen" → descriptif neutre
- ✅ **"Le prix moyen est stable : la baisse est surtout volume / assortiment"** → enseignement direct

Autres exemples de bons titres :
- "Le recul est essentiellement un recul volume"
- "La baisse vient surtout du périmètre ASIN, pas des ASIN actifs"
- "Le business 2026 est plus concentré"
- "COGS / CA : amélioration de l'économie Amazon"

### Pattern 5 — Structure systématique de chaque section
1. **Tableau dense** avec chiffres en gras
2. Sous-titre **"### Lecture"** ou **"### Interprétation"** systématique après le tableau
3. **Paragraphe court (2-4 lignes)** qui donne le verdict de la section
4. Optionnel : citation en bloc `>` pour les idées force

### Pattern 6 — Citation en bloc `>` pour les verdicts forts
Quand le verdict est central, l'isoler en bloc citation pour qu'il sorte du scroll :

> **Exemple** : "moins d'unités vendues, moins d'ASIN actifs, et surtout un décrochage de plusieurs familles fortes."

> **Exemple** : "2026 est en avance de +27 % en rythme quotidien par rapport au premier semestre 2025."

Maximum 1 citation en bloc par section, sinon perte d'impact.

### Pattern 7 — Section "Mon diagnostic" en fin de rapport
Composée de 2 sous-sections systématiques :
- **"Ce que les chiffres disent"** — verdict factuel hiérarchisé en 3 à 5 points
- **"Ce que je ne vois PAS dans les chiffres"** — exclusion d'hypothèses, ce qui rassure le lecteur (ex. *"Je ne vois pas de problème massif de commandes non expédiées. Je ne vois pas non plus de baisse du prix moyen."*)

Le second point est **autant aussi important que le premier** : il guide le lecteur vers où chercher en éliminant les fausses pistes.

### Pattern 8 — Section "Ce que je ferais maintenant"
Plan d'action priorisé en 3 à 5 priorités numérotées. Sous chaque priorité, **du contenu opérationnel** :
- Liste d'ASINs précis à auditer (avec leurs codes)
- Tableau de contrôles (Contrôle | Question)
- Familles à traiter en priorité

Format type :
```
## Priorité 1 — Audit des 30 ASIN qui expliquent 96 % de la baisse

[Liste des ASINs B009G3EQ70, B009G3E6CU, ...]

Pour chacun :
| Contrôle | Question |
|---|---|
| Disponibilité Amazon.fr | L'article est-il achetable ? |
| Stock Amazon | Amazon a-t-il du stock retail ? |
| Buy Box | Amazon détient-il la Buy Box ? |
...
```

### Pattern 9 — Conclusion finale courte
Section "## Conclusion" en 2-3 paragraphes max, **avec une citation en bloc qui résume**.

### Pattern 10 — Hiérarchisation des ASINs gagnants / perdants
Toujours **deux tableaux successifs** :
- Top 8-12 gagnants en €/jour gagnés
- Top 8-12 perdants en €/jour perdus

Avec **colonne "Lecture"** sur chaque ligne (1 phrase courte qui interprète) :
- "Bâche 2x3m bleue, très gros moteur 2026"
- "Présent en 2025, 0 en 2026"
- "Cadenas laiton 25 mm, 0 en 2026"

Et un **paragraphe de sortie** qui qualifie l'ensemble :
- *"Les pertes sont beaucoup moins fortes que les gains. Les 10 plus gros gagnants pèsent +47,9 k€, alors que les 10 plus gros perdants pèsent -15,4 k€. Donc la croissance est robuste."*

### Pattern 11 — Conclusion par marque/univers en 1 phrase
Pour chaque marque du Top 10, **une narration en 1-2 phrases** qui dit ce qu'elle représente dans la lecture :
- *"Sitram reste ultra-dominant"*
- *"Crealys est le relais de croissance le plus visible"*
- *"UPFIT baisse logiquement après un début d'année plus fort"*

### Pattern 12 — Ratio COGS/CA toujours nuancé
Section dédiée systématique. **Toujours avec disclaimer** :
- *"À manier prudemment : dans Vendor Central, ce n'est pas une marge fournisseur directe, mais plutôt une lecture économique Retail côté Amazon."*
- Jamais "marge brute" sans qualification — toujours "Marge Amazon Retail" ou "Rentabilité Amazon Retail"

### Pattern 13 — Questions rhétoriques pour orienter l'action
Mettre les questions du lecteur dans le texte :
- *"Question clé : S'agit-il d'un recul normal par cannibalisation, ou d'une perte évitable de disponibilité ?"*
- *"Est-ce une baisse normale liée à la fin de saison, ou une anomalie ?"*

Cela transforme un constat passif en orientation active.

### Pattern 14 — Vocabulaire opérationnel précis
Mots à privilégier (vocabulaire VC) :
- vélocité, disponibilité, Buy Box, PO (purchase order)
- CRaP risk, ASN, BOL, Variation, Browse node
- réception, refus, sourcing share, lost Buy Box
- rentabilité Amazon, mix produit, cannibalisation

Mots à éviter :
- "Le compte va mal" → préférer "Le compte perd X € en projection annualisée sur Y ASINs"
- "Catastrophe" / "hémorragie" → préférer "recul concentré sur N familles"
- Adjectifs émotionnels gratuits (terrible, excellent, dramatique...)

### Pattern 15 — Tableau "Top ASINs à sécuriser/auditer" en clôture
Toujours en fin de plan d'action, un tableau avec colonnes :
- Rang
- ASIN
- Marque
- CA période A
- CA / jour
- Unités

Pour montrer ce qui pèse vraiment dans le CA actuel et doit être protégé.

---

## RÈGLES D'ÉCRITURE COMPLÉMENTAIRES (V2)

### Adaptation au signe du delta
Le ton du rapport doit refléter la réalité du compte :
- **Compte en chute** (Cogex 2024 vs 2025) → mots-clés "recul", "baisse", "perte", "concentré sur quelques ASINs"
- **Compte en croissance** (Gers, ou Cogex janv-fév vs mars-avril) → mots-clés "accélération", "reprise", "vélocité", "moteur"
- **Compte stable** → mots-clés "tient", "stable", "préservé", "à surveiller"

**Pas de biais structurel négatif** dans le design. La maquette doit fonctionner aussi bien sur un compte en croissance que sur un compte en chute.

### Adaptation au type de comparaison
- **Y/Y annuel complet** (365j vs 365j) : analyse de tendance longue, pas de normalisation
- **Période vs période successive** (ex. janv-fév vs mars-avril) : analyse de dynamique, importance des saisonnalités
- **Périodes inégales** (ex. S1 2025 vs janv→18 mai 2026) : précaution méthodo en ouverture, double lecture brut + normalisé

### Longueur cible
- Rapport complet (sections 1 à 12 + diagnostic + plan d'action) : **2500 à 3500 mots**
- Si plus court → manque d'interprétation
- Si plus long → noie le lecteur



## RÈGLES ANTI-RAIL MENTAL (règle 18 du contexte orchestrateur)

Au moment d'implémenter ce skill dans Amazon Pilot ou de l'appliquer à un nouveau dataset :

1. **Lister explicitement les colonnes disponibles** dans le CSV/XLSX input AVANT toute analyse
2. **Justifier celles que la grille n'utilise pas** (si Amazon ajoute de nouvelles colonnes au format VC, les intégrer ou expliciter pourquoi non)
3. **Ne pas se limiter aux dimensions traditionnellement utilisées** (CA + Unités). Les 9 colonnes du format VC standard doivent être exploitées dans la grille (1 dimension par colonne minimum, plus les croisements)

---

## RÈGLES DE SANITY CHECK PARSING (V2 — apport critique session 21 mai)

**Apprentissage** : un bug parser silencieux sur l'espace insécable `\u202f` a produit des chiffres faux par facteur ~2,7 pendant 3 itérations consécutives de la maquette. Le bug n'a été détecté que parce que Fred a posé une question de vérification sur 1 ligne précise.

**Règles pour tout parsing CSV/XLSX en entrée du module YoY** :

### Règle A — Caractères à neutraliser explicitement dans un parser CSV
Liste minimale **à coder explicitement et à lister en commentaire** :
- Espace standard ` `
- `\xa0` (NO-BREAK SPACE)
- `\u202f` (NARROW NO-BREAK SPACE) ← celui qui a piégé en session 21 mai
- `\u2009` (THIN SPACE)
- `\u2007` (FIGURE SPACE)
- Séparateurs décimaux `,` et `.`
- Signes `€`, `$`, etc.

Si le code parser ne liste pas explicitement ces caractères, **ne pas faire confiance** aux totaux.

### Règle B — Préférer XLSX natif quand disponible
Format XLSX → pandas lit en `float64` natif, pas de parsing maison nécessaire.
Format CSV → parsing maison obligatoire, risque résiduel.

**Stratégie produit Amazon Pilot v3.6.5** : accepter les deux formats à l'import, **détecter le format**, basculer sur XLSX prioritairement si les deux sont disponibles.

### Règle C — Sanity check obligatoire sur 1 ligne vérifiée
Avant tout calcul agrégé sur le dataset, **comparer 1 valeur calculée à une donnée externe vérifiée** :
- Sur Cogex : `COGS B009G3EMDI / Unités expédiées B009G3EMDI = 1,92 €` (prix d'achat brut Cogex → Amazon connu)
- Pour un nouveau client : choisir 1 ASIN dont la marque connaît son prix d'achat brut, vérifier que le COGS divisé par les unités donne bien ce prix

**Si le sanity check échoue, arrêter et alerter**. Ne pas continuer avec des chiffres potentiellement faux.

### Règle D — Comparer les totaux à une source externe quand disponible
Si une analyse antérieure existe (ChatGPT, autre Claude, analyse manuelle), **comparer les totaux** avant de produire le rapport final. Une divergence > 5 % = signal d'alerte sur le parsing.

### Règle E — Afficher les totaux au KAM/prospect avant analyse
Dans l'UI Amazon Pilot, **afficher une étape intermédiaire** :
- "X lignes lues du fichier"
- "Total CA commandé : Y €"
- "Total unités : Z"
- Bouton "Valider et lancer l'analyse" / "Recommencer l'import"

Cette étape permet au KAM de détecter visuellement une anomalie de parsing avant que l'analyse ne soit produite. Équivalent humain du sanity check.

---

## RÈGLES D'IMPLÉMENTATION POUR LE BRIEF v3.6.5

Quand le brief Claude Code v3.6.5 sera rédigé :

1. **Reprendre cette grille telle quelle** (12 dimensions Free figées en V2)
2. **Préciser le rendu UI** par dimension (où afficher, format tableau ou texte, exports possibles)
3. **Préciser les seuils** (±10 % pour stable, 100 €/5 € pour zombies, etc. — ces seuils sont indicatifs et peuvent être ajustés au moment du brief si justification métier)
4. **Préciser les tolérances** (que faire si une colonne manque du CSV, si une période est trop courte, etc.)
5. **Préciser le calibrage Free vs Pro dans l'UI** (que voit le Free, que voit le Pro)
6. **Imposer le sanity check parsing** (règle C) comme garde-fou obligatoire en production
7. **Encoder le style rédactionnel attendu** dans le prompt système Claude (Sonnet 4.6 ou Opus 4.7) qui génèrera les paragraphes interprétatifs Free et le narratif Pro :
   - Titres = enseignement, pas indicateur (Pattern 4)
   - Verdict en bloc citation `>` quand idée force (Pattern 6)
   - Section "Ce que je ne vois PAS dans les chiffres" en diagnostic (Pattern 7)
   - Plan d'action avec contrôles précis par ASIN (Pattern 8)
   - Vocabulaire opérationnel VC (Pattern 14)

---

## HISTORIQUE DE VERSION

| Version | Date | Évolution |
|---|---|---|
| V1 | 21 mai 2026 matin | Création — grille figée 12 Free + 4 Pro suite confrontation Opus 4.7 + ChatGPT 5.5 |
| V2 | 21 mai 2026 fin de journée | Ajout section **Style rédactionnel attendu** (15 patterns ChatGPT) + correction Dim 4 (Marge Amazon Retail, pas marge industrielle) + règles **Sanity check parsing** (apprentissage bug `\u202f`) |

**Pour évolutions futures** : tout ajout/modification de dimension nécessite un retest sur dataset Cogex + Gers pour confirmer la pertinence métier. Les patterns rédactionnels peuvent évoluer en fonction des retours qualité des livrables produits avec ce skill.

---

**FIN DU SKILL**

[Claude Orchestrateur — V2 — 21 mai 2026]
