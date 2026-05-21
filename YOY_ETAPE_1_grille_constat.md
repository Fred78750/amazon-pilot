# SKILL — YoY Étape 1 : Grille de constat factuel
**Type :** Skill méthodologique Scanderia
**Statut :** Figé V1 — 21 mai 2026
**Auteur :** Claude Orchestrateur (Fred Rochette / Vitajardin)
**Source :** Confrontation à l'aveugle Claude Opus 4.7 + ChatGPT 5.5 sur dataset Cogex avril-mai 2025/2026
**Audience :** Claude Orchestrateur (cadrage brief v3.6.5) + Claude Code (implémentation) + Fred (référence méthodo)

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

### Dimension 4 — Marge brute YoY
- CA expédié A-1 et A
- COGS expédié A-1 et A
- Marge brute A-1 et A
- Taux de marge brute A-1 et A (en %)
- Variation taux (en points de pourcentage)

**Interprétation** : la marge peut tenir même quand le CA chute (ex. mix produit favorable). C'est un signal qualitatif important pour le directeur.

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

## RÈGLES ANTI-RAIL MENTAL (règle 18 du contexte orchestrateur)

Au moment d'implémenter ce skill dans Amazon Pilot ou de l'appliquer à un nouveau dataset :

1. **Lister explicitement les colonnes disponibles** dans le CSV input AVANT toute analyse
2. **Justifier celles que la grille n'utilise pas** (si Amazon ajoute de nouvelles colonnes au format VC, les intégrer ou expliciter pourquoi non)
3. **Ne pas se limiter aux dimensions traditionnellement utilisées** (CA + Unités). Les 9 colonnes du format VC standard doivent être exploitées dans la grille (1 dimension par colonne minimum, plus les croisements)

---

## RÈGLES D'IMPLÉMENTATION POUR LE BRIEF v3.6.5

Quand le brief Claude Code v3.6.5 sera rédigé :

1. **Reprendre cette grille telle quelle** (12 dimensions Free figées, V1)
2. **Préciser le rendu UI** par dimension (où afficher, format tableau ou texte, exports possibles)
3. **Préciser les seuils** (±10 % pour stable, 100 €/5 € pour zombies, etc. — ces seuils sont indicatifs et peuvent être ajustés au moment du brief si justification métier)
4. **Préciser les tolérances** (que faire si une colonne manque du CSV, si une période est trop courte, etc.)
5. **Préciser le calibrage Free vs Pro dans l'UI** (que voit le Free, que voit le Pro)

---

## HISTORIQUE DE VERSION

| Version | Date | Évolution |
|---|---|---|
| V1 | 21 mai 2026 | Création — grille figée suite à confrontation Opus 4.7 + ChatGPT 5.5 sur dataset Cogex |

**Pour évolutions futures** : tout ajout/modification de dimension nécessite un retest sur dataset Cogex + Gers pour confirmer la pertinence métier. La grille V1 est figée pour v3.6.5 ; les évolutions iront en V2.

---

**FIN DU SKILL**

[Claude Orchestrateur — V1 figée 21 mai 2026]
