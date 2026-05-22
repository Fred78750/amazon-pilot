# SKILL — YoY Étape 1 : Grille de constat factuel
**Type :** Skill méthodologique + opérationnel Scanderia
**Statut :** V3 — 22 mai 2026
**Auteur :** Claude Orchestrateur (Fred Rochette / Vitajardin)
**Source :** Confrontation à l'aveugle Claude Opus 4.7 + ChatGPT 5.5 sur dataset Cogex, puis enrichissement style à partir de 3 analyses ChatGPT supplémentaires (Cogex 2024 vs 2025, Cogex janv-fév vs mars-avril 2026, Gers S1 2025 vs Gers 2026 partiel), puis ajout de la bibliothèque de templates littéraux suite au constat que la V2 ne suffisait pas à Claude Code pour produire un rendu de qualité ChatGPT
**Audience :** Claude Orchestrateur (cadrage brief v3.6.5) + Claude Code (implémentation) + Fred (référence méthodo)

**Historique :**
- V1 (21 mai matin) — création, grille 12 dimensions Free + 4 Pro
- V2 (21 mai fin de journée) — ajout section "Style rédactionnel attendu" (15 patterns extraits de ChatGPT), précisions sur sanity checks parsing, clarification "Marge Amazon Retail" (pas marge industrielle)
- V3 (22 mai) — ajout de la BIBLIOTHÈQUE DE TEMPLATES LITTÉRAUX (apport central). Le skill devient autoporteur : un développeur peut produire un rendu de qualité ChatGPT en reprenant les templates quasi tels quels, sans devoir inventer le texte.

**Apprentissage de session ayant motivé V3** : la V2 décrivait le résultat attendu (15 patterns) mais ne donnait pas le texte littéral à produire. Résultat sur la livraison Claude Code v3.6.5.5 : pattern 4 implémenté (titres = enseignement) mais patterns 5, 6, 7, 8 ratés faute de modèle littéral. Le skill V3 corrige cette dette.

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

## BIBLIOTHÈQUE DE TEMPLATES LITTÉRAUX (V3 — apport central)

**Cette section est la BIBLIOTHÈQUE OPÉRATIONNELLE.** Elle contient les templates littéraux à reproduire dans le code, pas à inventer. Le but : qu'un développeur (humain ou Claude Code) puisse copier-coller la structure, remplacer les variables `{xxx}`, et obtenir un rendu de qualité ChatGPT.

**Convention de variables** :
- `{var}` = variable simple à remplacer (ex. `{ca_a}` = "142 585 €")
- `{var:fmt}` = avec format (ex. `{delta_pct:signed}` = "−16,2 %", `{ca:eur}` = "142 585 €")
- `{IF condition}...{ENDIF}` = bloc conditionnel
- `[choisir 1 selon contexte]` = pool de variantes au choix selon les critères donnés

**Convention de cas** :
- `NEG` = delta négatif (delta_pct_proj < -3 %)
- `POS` = delta positif (delta_pct_proj > +3 %)
- `STABLE` = delta entre -3 % et +3 %

---

### TEMPLATE 1 — Paragraphes "Lecture" sous chaque tableau

#### 1.A — Section Performance et marge

**Variables disponibles** : `{units_delta_pct}`, `{ca_delta_pct}`, `{pmv_delta_pct}`, `{marge_taux_a}`, `{marge_taux_a1}`, `{marge_delta_pt}`, `{taux_retour_a}`, `{taux_retour_a1}`, `{ratio_exp_cmd}`

**Cas NEG** (cas Cogex) :
> La baisse en volume ({units_delta_pct:signed}) est plus marquée que la baisse en CA ({ca_delta_pct:signed}). Le prix moyen unitaire progresse de {pmv_delta_pct:signed} : l'assortiment qui vend en période A est plus cher mais bouge moins. La marge Amazon Retail {IF abs(marge_delta_pt) < 1}reste stable autour de {marge_taux_a}{ELSE}{IF marge_delta_pt > 0}s'améliore de {marge_delta_pt:pt} ({marge_taux_a}){ELSE}se dégrade de {marge_delta_pt:abs:pt} ({marge_taux_a}){ENDIF}{ENDIF}, ce qui signifie qu'Amazon {IF marge_delta_pt >= 0}préserve{ELSE}voit baisser{ENDIF} son économie sur le compte — indirectement, c'est un signal {IF marge_delta_pt >= 0}d'absence de soutien promotionnel particulier{ELSE}de pression accrue sur la rentabilité Amazon{ENDIF}. Le ratio expédié/commandé proche de 100 % et {IF taux_retour_a < taux_retour_a1}la légère baisse{ELSE}{IF taux_retour_a > taux_retour_a1}la légère hausse{ELSE}la stabilité{ENDIF}{ENDIF} du taux de retours excluent un décrochage logistique global ou un problème qualité diffus.

**Cas POS** (cas Gers) :
> La progression en volume ({units_delta_pct:signed}) {IF units_delta_pct > ca_delta_pct}dépasse{ELSE}suit{ENDIF} la progression en CA ({ca_delta_pct:signed}). Le prix moyen unitaire {IF pmv_delta_pct > 0}progresse légèrement{ELSE}reste stable{ENDIF} ({pmv_delta_pct:signed}) : la croissance vient {IF abs(pmv_delta_pct) < 2}essentiellement des volumes vendus, pas du prix{ELSE}d'un mix volume + prix{ENDIF}. La marge Amazon Retail {IF abs(marge_delta_pt) < 1}reste stable autour de {marge_taux_a}{ELSE}{IF marge_delta_pt > 0}s'améliore de {marge_delta_pt:pt}, à {marge_taux_a}{ELSE}se dégrade de {marge_delta_pt:abs:pt}, à {marge_taux_a}, signal de pression croissante sur la rentabilité Amazon{ENDIF}{ENDIF}. Le ratio expédié/commandé proche de 100 % indique une chaîne logistique qui suit la cadence.

**Cas STABLE** :
> Performance globalement stable entre les deux périodes : CA à {ca_delta_pct:signed}, volume à {units_delta_pct:signed}, prix moyen à {pmv_delta_pct:signed}. La marge Amazon Retail reste à {marge_taux_a} ({marge_delta_pt:pt} vs référence). Pas de signal de rupture côté ratio expédié/commandé ni côté retours. Si une dynamique se cache derrière cette stabilité agrégée, elle est à chercher au niveau ASIN ou marque (cf. sections suivantes).

**Exemple rendu Cogex (cas NEG, chiffres réels)** :
> La baisse en volume (−18,9 %) est plus marquée que la baisse en CA (−16,2 %). Le prix moyen unitaire progresse de +3,4 % : l'assortiment qui vend en période A est plus cher mais bouge moins. La marge Amazon Retail se dégrade de 2,5 pt (45,4 %), ce qui signifie qu'Amazon voit baisser son économie sur le compte — indirectement, c'est un signal de pression accrue sur la rentabilité Amazon. Le ratio expédié/commandé proche de 100 % et la légère baisse du taux de retours excluent un décrochage logistique global ou un problème qualité diffus.

#### 1.B — Section Mouvement du catalogue

**Variables** : `{n_disparus}`, `{n_apparus}`, `{n_stables}`, `{n_baissiers}`, `{n_hausse}`, `{pct_disparus_catalogue}`, `{impact_disparus_annuel}`, `{impact_apparus_annuel}`

**Cas NEG (perte de catalogue dominante)** :
> Sur les {n_a1_total} ASINs actifs en référence, {n_disparus} ne vendent plus rien en période A — soit {pct_disparus_catalogue} du catalogue effacé. Cette catégorie pèse à elle seule {impact_disparus_annuel} de CA annualisé. Les {n_apparus} ASINs apparus ne compensent que partiellement. Les ASINs encore actifs sont relativement stables en valeur agrégée — ce n'est pas la performance par ASIN qui décroche, c'est la largeur du catalogue.

**Cas POS (croissance par catalogue existant)** :
> Sur les {n_a1_total} ASINs actifs en référence, {n_communs} restent actifs en période A et accélèrent en valeur agrégée. Les {n_apparus} ASINs apparus apportent {impact_apparus_annuel} supplémentaires. Les {n_disparus} disparus ne pèsent que {impact_disparus_annuel:abs} sur la balance. La progression est portée principalement par {IF impact_apparus > abs(impact_disparus)}les ASINs déjà présents qui montent en cadence{ELSE}une combinaison de nouveaux ASINs et de meilleure tenue des ASINs existants{ENDIF}.

**Cas STABLE (rotation neutre)** :
> Sur les {n_a1_total} ASINs actifs en référence, on note {n_disparus} disparitions et {n_apparus} apparitions — soit une rotation de {pct_disparus_catalogue} du catalogue. Le bilan net est {ca_net_rotation:signed:eur}/an. Le catalogue est en mouvement mais à somme nulle.

**Exemple rendu Cogex (cas NEG)** :
> Sur les 651 ASINs actifs en référence, 313 ne vendent plus rien en période A — soit 48,1 % du catalogue effacé. Cette catégorie pèse à elle seule −168 425 € de CA annualisé. Les 102 ASINs apparus ne compensent que partiellement. Les ASINs encore actifs sont relativement stables en valeur agrégée — ce n'est pas la performance par ASIN qui décroche, c'est la largeur du catalogue.

#### 1.C — Section Concentration

**Variables** : `{top10_a}`, `{top10_a1}`, `{top10_evol_pt}`, `{top20_a}`, `{top50_a}`

**Cas NEG (concentration accrue par appauvrissement)** :
> Le Top 10 représentait {top10_a1} du CA en référence. Il pèse maintenant {top10_a}. La queue longue, qui amortissait les variations, s'est érodée. La perte d'un seul ASIN du Top en période A impacte mécaniquement plus le CA total qu'en référence. C'est un signal de risque opérationnel direct : si un best-seller A décroche pour rupture, Buy Box ou suppression, l'effet sera disproportionné.

**Cas POS (concentration accrue par succès best-sellers)** :
> Le Top 10 pèse maintenant {top10_a} du CA contre {top10_a1} en référence. La croissance est tirée par quelques best-sellers qui dominent de plus en plus. Avantage : priorisation simple pour le pilotage opérationnel. Risque : exposition élevée en cas de rupture, perte Buy Box ou suppression de l'un de ces ASINs.

**Cas STABLE** :
> La concentration reste comparable : Top 10 à {top10_a} (vs {top10_a1} en référence). La structure du portefeuille n'a pas changé fondamentalement.

**Exemple rendu Cogex (cas NEG)** :
> Le Top 10 représentait 24,2 % du CA en référence. Il pèse maintenant 37,6 %. La queue longue, qui amortissait les variations, s'est érodée. La perte d'un seul ASIN du Top en période A impacte mécaniquement plus le CA total qu'en référence. C'est un signal de risque opérationnel direct : si un best-seller A décroche pour rupture, Buy Box ou suppression, l'effet sera disproportionné.

#### 1.D — Section Marques

**Variables** : top 3 marques perdantes `{m1_perd.name}` `{m1_perd.delta_j}`, idem `{m2_perd}` `{m3_perd}`, marque top gagnante `{m1_gain.name}` `{m1_gain.delta_j}`

**Cas NEG (recul multi-marques)** :
> Le recul est concentré sur quelques familles. **{m1_perd.name}** ({m1_perd.delta_j:signed:eur}/jour), **{m2_perd.name}** ({m2_perd.delta_j:signed:eur}/jour) et **{m3_perd.name}** ({m3_perd.delta_j:signed:eur}/jour) sont les 3 marques qui décrochent le plus en valeur quotidienne. À l'inverse, **{m1_gain.name}** reste un point d'ancrage ({m1_gain.delta_j:signed:eur}/jour). La question opérationnelle : ces reculs sont-ils dus à un retrait Amazon (PO non renouvelées) ou à une perte de disponibilité (rupture, suppression) ?

**Cas POS (progression multi-marques)** :
> La croissance est portée principalement par **{m1_gain.name}** (+{m1_gain.delta_j:eur}/jour), **{m2_gain.name}** (+{m2_gain.delta_j:eur}/jour) et **{m3_gain.name}** (+{m3_gain.delta_j:eur}/jour). À l'inverse, **{m1_perd.name}** est la principale marque en recul ({m1_perd.delta_j:signed:eur}/jour) — à vérifier s'il s'agit d'une fin de cycle produit, d'une cannibalisation interne ou d'un problème de disponibilité.

**Cas STABLE** :
> Pas de marque qui sort fortement du lot, ni positivement ni négativement. La performance marque par marque est globalement parallèle à la référence. La marque dominante reste **{m_dominante.name}** ({m_dominante.pct_a} du CA).

**Exemple rendu Cogex (cas NEG)** :
> Le recul est concentré sur quelques familles. **COGEX** (−194 €/jour), **RUECAB** (−113 €/jour) et **Expert Line** (−145 €/jour) sont les 3 marques qui décrochent le plus en valeur quotidienne. À l'inverse, **OROK** reste un point d'ancrage (+33 €/jour). La question opérationnelle : ces reculs sont-ils dus à un retrait Amazon (PO non renouvelées) ou à une perte de disponibilité (rupture, suppression) ?

#### 1.E — Section Top mouvements ASIN

**Variables** : `{top10_perdants_total_jour}`, `{top10_gagnants_total_jour}`, `{nb_perdants_a_zero}` (ASINs passés à 0)

**Cas NEG** :
> Les 10 plus gros perdants pèsent {top10_perdants_total_jour:abs:eur}/jour (soit {top10_perdants_total_an:eur}/an). Les 10 plus gros gagnants pèsent {top10_gagnants_total_jour:eur}/jour. Le solde est franchement déséquilibré côté perte. Le pattern dominant côté perdants : ASINs passés à 0 € (suppression/rupture), beaucoup sur {familles_dominantes_perdants}. Côté gagnants, on note l'émergence de quelques ASINs sur {familles_dominantes_gagnants}.

**Cas POS** :
> Les 10 plus gros gagnants pèsent +{top10_gagnants_total_jour:eur}/jour. Les 10 plus gros perdants pèsent {top10_perdants_total_jour:abs:eur}/jour. Le solde est nettement positif. La croissance se construit ASIN par ASIN, avec une diversification visible sur {familles_dominantes_gagnants}. À surveiller toutefois : {familles_dominantes_perdants} montre des décrochages qui méritent une vérification individuelle.

**Cas STABLE** :
> Les 10 plus gros gagnants pèsent +{top10_gagnants_total_jour:eur}/jour, les 10 plus gros perdants {top10_perdants_total_jour:eur}/jour. Le solde des extrêmes est globalement équilibré — pas de mouvement structurant côté ASINs individuels.

**Exemple rendu Cogex (cas NEG)** :
> Les 10 plus gros perdants pèsent 540 €/jour (soit −197 100 €/an). Les 10 plus gros gagnants pèsent 285 €/jour. Le solde est franchement déséquilibré côté perte. Le pattern dominant côté perdants : ASINs passés à 0 € (suppression/rupture), beaucoup sur cadenas, multiprises, BBQ et signalisation. Côté gagnants, on note l'émergence de quelques ASINs ITENSE et la résistance de bâches/cadenas COGEX clés.

#### 1.F — Section Anomalies catalogue

**Variables** : `{n_anomalies}`, `{anomalie_max_ca}` (la paire qui pèse le plus en CA cumulé)

**Variante unique (le contexte change peu selon le signe)** :
> {n_anomalies} paires de marques avec orthographe quasi-identique repérées par fuzzy matching. Effet probable : fragmentation du SEO Amazon (chaque variante est indexée séparément) et fragmentation du reporting marque interne. {IF n_anomalies > 0}À traiter via la fonction Cas Vendor Central pour demande de fusion catalogue. La paire la plus impactante en CA cumulé est **{anomalie_max_ca.m1}** / **{anomalie_max_ca.m2}** ({anomalie_max_ca.ca_cumul:eur}).{ENDIF}

**Variante "aucune anomalie"** :
> Aucune anomalie orthographique détectée par fuzzy matching sur les noms de marque. Le catalogue est propre sur ce critère.

---

### TEMPLATE 2 — Verdicts en bloc citation

**Règle stricte** : pas de label "Conclusion section :" ou équivalent. Juste le texte du verdict, en italique, dans un encadré bordé à gauche (style `blockquote.verdict-block`).

**Caractéristiques attendues d'un verdict** :
- 1 ou 2 phrases maximum
- Actionnable : finit par une orientation (priorité, question rhétorique, recommandation)
- Reprend un chiffre clé de la section
- Pas de paraphrase du tableau — interprétation

#### 2.A — Verdict Section Performance

**Cas NEG** :
> Le problème n'est pas le prix, ni la logistique, ni la qualité produit. Il faut donc chercher ailleurs : assortiment, disponibilité, commandes Amazon.

**Cas POS** :
> La croissance est saine et soutenue par les volumes, sans tension prix ni logistique. À sécuriser dans la durée plutôt qu'à pousser plus loin.

**Cas STABLE** :
> Pas de signal fort en agrégat. Si quelque chose bouge sur ce compte, c'est au niveau ASIN ou marque — pas dans les indicateurs globaux.

#### 2.B — Verdict Section Catalogue

**Cas NEG** :
> {n_disparus} ASINs disparus en un an. C'est le vrai sujet : Amazon a cessé de commander, ou les fiches sont devenues invisibles. À distinguer ASIN par ASIN — c'est l'objet du plan d'action.

**Cas POS** :
> La croissance vient principalement du portefeuille existant qui accélère. Bonne nouvelle : c'est une dynamique sur des ASINs déjà installés, donc protégeable.

**Cas STABLE** :
> Catalogue actif globalement stable en volume. Rotation neutre. Continuer la surveillance, sans urgence opérationnelle.

#### 2.C — Verdict Section Concentration

**Cas NEG** :
> La concentration est passée de {top10_a1} à {top10_a} sur le Top 10. Sécuriser le Top 10 actuel devient une priorité opérationnelle.

**Cas POS** :
> Le Top 10 pèse {top10_a} du CA. Concentrer la vigilance pilotage sur ces 10 ASINs maximise le ROI temps/euro.

**Cas STABLE** :
> Structure de portefeuille stable. Top 10 à {top10_a} comme en référence — pas de surveillance nouvelle à mettre en place.

#### 2.D — Verdict Section Marques

**Cas NEG** :
> {m1_perd.name}, {m2_perd.name}, {m3_perd.name} : 3 familles à auditer en priorité — recul normal ou anomalie évitable ?

**Cas POS** :
> {m1_gain.name} et {m2_gain.name} : 2 marques à sécuriser comme actifs stratégiques de la croissance actuelle.

**Cas STABLE** :
> Pas de marque qui s'extrait du peloton. Si on cherche un effet levier, c'est à construire, pas à protéger.

#### 2.E — Verdict Section Top mouvements

**Cas NEG** :
> Les 10 ASINs les plus en chute concentrent {top10_perdants_total_jour:abs:eur}/jour de perte. C'est sur eux que doit porter l'audit prioritaire.

**Cas POS** :
> Les 10 ASINs les plus en progression apportent +{top10_gagnants_total_jour:eur}/jour. Disponibilité, stock et Buy Box sur ces 10 références = priorité opérationnelle.

**Cas STABLE** :
> Pas de mouvement individuel structurant. Les variations ASIN se compensent.

#### 2.F — Verdict Section Anomalies

**Si n_anomalies > 0** :
> {n_anomalies} doublons orthographiques à fusionner. Action rapide à fort effet de levier : un seul cas VC pour consolider le reporting marque et le SEO.

**Si n_anomalies = 0** :
> Catalogue propre sur le critère orthographique. Pas d'action nécessaire.

---

### TEMPLATE 3 — Section "Mon diagnostic"

**Structure stricte** : 2 sous-titres `## Ce que les chiffres disent` et `## Ce que je ne vois PAS dans les chiffres`. PAS une liste à puces — des paragraphes rédigés.

#### 3.A — "Ce que les chiffres disent"

**Cas NEG** :
> Le recul de {delta_annuel:abs:eur}/an n'est pas une baisse homogène de la demande, mais une **contraction du catalogue actif**. Trois constats convergent :
>
> 1. **{n_disparus} ASINs disparus** ({pct_disparus} du catalogue de référence) qui pesaient {impact_disparus_annuel:abs:eur}/an
> 2. **Concentration accrue** du Top 10 ({top10_a1} → {top10_a}) qui fragilise le compte
> 3. **Multi-marques en baisse** ({m1_perd.name}, {m2_perd.name}, {m3_perd.name} principalement)

**Cas POS** :
> La progression de {delta_annuel:eur}/an se construit sur une base saine. Trois constats convergent :
>
> 1. **{n_communs} ASINs déjà présents** qui accélèrent en valeur agrégée
> 2. **{n_apparus} nouveaux ASINs** qui apportent {impact_apparus_annuel:eur}/an additionnels
> 3. **Croissance multi-marques** portée principalement par {m1_gain.name}, {m2_gain.name} et {m3_gain.name}

**Cas STABLE** :
> Le CA évolue de {delta_annuel:signed:eur}/an, soit {delta_pct_proj:signed} : performance proche de la référence. Mais cette stabilité agrégée peut masquer des mouvements internes — {n_disparus} disparitions compensées par {n_apparus} apparitions, et des rotations marque par marque visibles dans les sections précédentes.

#### 3.B — "Ce que je ne vois PAS dans les chiffres"

**Cas NEG** :
> Je ne vois pas de baisse du prix moyen (PMV en hausse de {pmv_delta_pct}). Je ne vois pas de problème logistique global (ratio expédié/commandé proche de 100 %). Je ne vois pas de dégradation qualité (taux de retours {IF taux_retour_a <= taux_retour_a1}en baisse{ELSE}stable{ENDIF}). Je ne chercherais donc pas en priorité du côté du prix, de l'entrepôt ou des avis clients.
>
> La cause la plus probable se situe en amont de la demande consommateur : **commandes Amazon (PO) qui se sont raréfiées, perte de référencement actif, ruptures structurelles sur ASINs clés, suppressions de listings**. C'est l'objet du plan d'action.

**Cas POS** :
> Je ne vois pas de hausse de prix qui expliquerait mécaniquement la progression. Je ne vois pas non plus de saisonnalité particulière qui exploserait sur cette période. Je ne vois pas de signal de tension côté retours.
>
> La progression vient probablement d'une combinaison : **meilleure disponibilité côté Amazon (PO plus régulières), montée de référencement organique, ou effort commercial spécifique de la marque sur quelques ASINs clés**. Le plan d'action se focalise sur la sécurisation de cette dynamique.

**Cas STABLE** :
> Je ne vois pas de signal de risque imminent. Je ne vois pas non plus de moteur de croissance évident à activer.
>
> Le plan d'action porte sur les opportunités identifiées au niveau ASIN ou marque (cf. sections précédentes), pas sur un sujet global.

---

### TEMPLATE 4 — Section "Ce que je ferais maintenant — plan d'action priorisé"

**Structure stricte** : 3 priorités numérotées. Chaque priorité contient :
1. Un **titre = enseignement** (1 ligne)
2. Un **paragraphe descriptif** (2-3 lignes) qui justifie la priorité
3. Une **liste d'ASINs ou de marques précis** à traiter (3 à 8 entrées max)
4. Une **grille de contrôles** sous forme de tableau (Contrôle | Question opérationnelle)

#### 4.A — Plan d'action cas NEG (Cogex-like)

**Priorité 1 — Auditer les ASINs disparus de poids significatif**

> Les {n_disparus} ASINs disparus pèsent {impact_disparus_annuel:abs:eur}/an de CA non récupéré. Tous ne sont pas récupérables, mais la majorité l'est probablement. Commencer par les plus gros contributeurs CA en référence.

**ASINs à auditer en priorité** (Top 8 disparus par CA référence) :
{LIST top8_disparus AS asin}
- `{asin.asin}` — {asin.titre} ({asin.marque}) — {asin.ca_a1:eur} en référence
{ENDLIST}

**Grille de contrôles à appliquer ASIN par ASIN** :

| Contrôle | Question opérationnelle |
|---|---|
| Disponibilité Amazon.fr | L'article est-il achetable par un client final ? |
| Stock Amazon Retail | Amazon a-t-il du stock ? |
| Buy Box | Amazon détient-il la Buy Box, ou un 3P ? |
| PO Vendor | Amazon a-t-il cessé d'émettre des commandes ? Depuis quand ? |
| Variation / fiche | Variation cassée, suppression de listing, conformité contenu ? |
| Prix retail / CRaP | Le prix est-il devenu non compétitif pour Amazon (CRaP risk) ? |

CTA contextuels : `→ Démarrer l'audit dans Analyse ASINs filtré sur disparus` `→ Ouvrir un cas VC depuis Buy Box`

**Priorité 2 — Sécuriser les best-sellers actuels (Top 10 période A)**

> Le Top 10 pèse {top10_a} du CA. Une perte sur l'un d'eux impacterait significativement le compte. C'est la défense la plus rentable du portefeuille.

**ASINs à sécuriser** (Top 5 contributeurs CA en période A) :
{LIST top5_a AS asin}
- `{asin.asin}` — {asin.titre} ({asin.marque}) — {asin.ca_a:eur} ({asin.part_pct} du CA)
{ENDLIST}

**Grille de contrôles** :

| Contrôle | Question |
|---|---|
| Stock Amazon | Combien de jours de couverture stock restent ? |
| Buy Box | Amazon a-t-il toujours la Buy Box à 100 % ? |
| Prix retail | Le prix est-il stable depuis 30 jours ? Pas de yo-yo ? |
| Fiche produit | Images, titre, bullets sont-ils complets et conformes ? |
| Avis clients | Note globale stable ? Pas de vague d'avis négatifs récents ? |

CTA contextuels : `→ Surveillance Buy Box des best-sellers` `→ Voir les fiches dans Analyse ASINs`

**Priorité 3 — Reconstituer les familles en recul**

> Trois marques décrochent en valeur quotidienne : {m1_perd.name}, {m2_perd.name}, {m3_perd.name}. Pour chacune, distinguer recul normal (cannibalisation, saisonnalité) vs anomalie évitable (rupture, suppression).

**Analyse par famille — actions recommandées** :

| Famille | Action recommandée |
|---|---|
| {m1_perd.name} | Audit disponibilité + relance PO + révision fiches |
| {m2_perd.name} | Analyse cannibalisation / stratégie nouvelle gamme |
| {m3_perd.name} | Vérification stock saisonnier + timing des PO |

CTA contextuels : `→ Explorer les marques en chute dans Analyse ASINs` `→ Ouvrir un cas VC pour relance PO`

#### 4.B — Plan d'action cas POS

**Priorité 1 — Sécuriser les accélérateurs**

> Les ASINs en plus forte progression représentent {top10_gagnants_an:eur}/an de gain. Ils sont moteurs de la dynamique actuelle — à protéger en priorité.

**ASINs à sécuriser** (Top 5 gagnants par delta CA quotidien) :
{LIST top5_gagnants AS asin}
- `{asin.asin}` — {asin.titre} ({asin.marque}) — {asin.delta_j:signed:eur}/jour
{ENDLIST}

**Grille de contrôles** :

| Contrôle | Question |
|---|---|
| Stock Amazon | Couverture stock suffisante pour soutenir la cadence ? |
| PO Vendor | Les commandes Amazon suivent-elles le rythme accéléré ? |
| Prix retail | Le prix reste-t-il cohérent ? Pas de dérapage à la baisse ? |
| Buy Box | Amazon garde-t-il 100 % de la Buy Box ? |

CTA contextuels : `→ Surveillance Buy Box des accélérateurs` `→ Vérifier stock dans Appros`

**Priorité 2 — Investiguer les marques ou ASINs qui décrochent malgré la croissance globale**

> Bien que la dynamique globale soit positive, {m1_perd.name} et certains ASINs reculent. Comprendre pourquoi évite de laisser filer un potentiel de récupération.

**ASINs à investiguer** (Top 5 perdants par delta CA quotidien) :
{LIST top5_perdants AS asin}
- `{asin.asin}` — {asin.titre} ({asin.marque}) — {asin.delta_j:signed:eur}/jour
{ENDLIST}

**Grille de contrôles** : (identique à la grille NEG Priorité 1)

CTA contextuels : `→ Filtrer les ASINs en baisse dans Analyse ASINs`

**Priorité 3 — Pousser les nouveaux ASINs prometteurs**

> Les {n_apparus} ASINs apparus en période A apportent déjà {impact_apparus_annuel:eur}/an. Certains pourraient devenir des best-sellers durables avec un peu de soutien commercial ou contenu.

**ASINs à pousser** (Top 5 apparus par CA quotidien en A) :
{LIST top5_apparus AS asin}
- `{asin.asin}` — {asin.titre} ({asin.marque}) — {asin.ca_j_a:eur}/jour
{ENDLIST}

**Grille de contrôles** :

| Contrôle | Question |
|---|---|
| Contenu fiche | Titre, bullets, images A+ complets ? |
| Variations | Toutes les variantes (taille, couleur) sont-elles listées ? |
| Mots-clés | Backend keywords renseignés ? Recherche organique ? |
| Reviews | Premiers avis collectés ? Vine activé ? |

#### 4.C — Plan d'action cas STABLE

> En cas de performance stable, le plan d'action porte sur les opportunités identifiées au niveau ASIN ou marque. Reprendre les Top mouvements et identifier 3-5 actions ciblées plutôt qu'un plan global.

(Structure libre, à adapter aux données, mais toujours 3 priorités max avec ASINs précis et grille de contrôles)

---

### TEMPLATE 5 — Conclusion générale

**Structure stricte** : 2 paragraphes courts + 1 verdict en bloc citation + 1 phrase finale qui ouvre vers les outils.

#### 5.A — Cas NEG

> Le compte {client_name} perd {delta_annuel:abs:eur}/an en projection annualisée par rapport à la période de référence. La baisse n'est pas due à un effondrement de la demande ou à un problème de prix, mais à **une contraction de {pct_disparus} du catalogue actif**, concentrée sur quelques marques et un nombre limité d'ASINs.
>
> > Le potentiel de récupération n'est pas négligeable, car la baisse est très concentrée. Si les ASINs les plus touchés sont récupérables — stock, Buy Box, disponibilité, PO, fiche — il y a probablement un levier significatif de regagne CA.
>
> L'enjeu opérationnel est dans l'audit ASIN par ASIN. C'est l'objet des outils de pilotage Amazon Pilot (Analyse ASINs, Buy Box, Diagnostic CA).

#### 5.B — Cas POS

> Le compte {client_name} progresse de {delta_annuel:eur}/an en projection annualisée par rapport à la période de référence. La progression est saine : portée par les volumes, soutenue par {n_apparus} nouveaux ASINs, et tirée par {m1_gain.name} et {m2_gain.name} principalement.
>
> > Le sujet n'est pas de pousser plus loin, mais de sécuriser la dynamique. Un best-seller qui décroche pour rupture ou perte de Buy Box impacterait significativement la trajectoire.
>
> L'enjeu opérationnel est dans la surveillance des Top 10 ASINs et dans la consolidation des marques motrices. Les outils Buy Box et Appros sont calibrés pour ce pilotage défensif.

#### 5.C — Cas STABLE

> Le compte {client_name} évolue de {delta_annuel:signed:eur}/an, soit {delta_pct_proj:signed}. Performance globalement stable, sans signal de risque imminent ni moteur de croissance évident à activer en agrégat.
>
> > Sous une stabilité apparente, il y a presque toujours des dynamiques internes. Le travail utile se fait au niveau ASIN et marque, pas au niveau du compte.
>
> L'enjeu opérationnel est de garder une cadence de surveillance régulière via la Revue Hebdo et de saisir les opportunités identifiées dans les sections précédentes.

---

### TEMPLATE 6 — Logique de choix entre cas NEG / POS / STABLE

**Critère unique** : `delta_pct_proj` (variation projetée du CA sur période normalisée)

```javascript
function getCaseTone(delta_pct_proj) {
  if (delta_pct_proj < -3) return 'NEG';
  if (delta_pct_proj > +3) return 'POS';
  return 'STABLE';
}
```

**Application en cascade** :
- Tous les paragraphes "Lecture" → choisir la variante selon `getCaseTone(delta_pct_proj)`
- Tous les verdicts → idem
- Section Diagnostic → idem
- Plan d'action → idem
- Conclusion → idem

**Cohérence** : sur une analyse donnée, **TOUS** les paragraphes utilisent le même cas. Pas de mélange NEG dans Performance et POS dans Conclusion.

---

### TEMPLATE 7 — Couleurs et icônes adaptatives au cas

| Cas | Couleur valeur principale | Icône optionnelle | Mot-clé titre |
|---|---|---|---|
| NEG | Rouge brique (#b8420d) | (aucune ou ⚠ en discret) | "recul", "baisse", "perte", "fragile" |
| POS | Vert sourd (#2a6e3f) | (aucune ou ✓ en discret) | "progression", "accélération", "moteur", "à protéger" |
| STABLE | Gris (#757575) | — | "stable", "tient", "préservé", "à surveiller" |

**Pas d'émoji décoratif** type 🚨 ou 🎉. Le rendu reste sobre.

---

## RÈGLE D'OR DE LA BIBLIOTHÈQUE

**Pour Claude Code** : reprends ces templates **quasi tels quels**. Variables à remplacer, structures à conserver, ton à reproduire.

Si tu hésites entre "écrire ton propre texte" et "reprendre le template", **reprends le template**. Le but n'est pas la créativité, c'est la cohérence avec le standard ChatGPT 5.5 atteint sur les 3 analyses de référence.

Le seul moment où il est légitime de t'éloigner d'un template : quand le contexte de l'analyse a une particularité non couverte par les variantes NEG/POS/STABLE (exemple : une période très atypique, un dataset partiel, une anomalie de format). Dans ce cas, signale-le à Fred avant de coder une variante maison.

---



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

Quand le brief Claude Code v3.6.5 sera rédigé (ou mis à jour) :

1. **Reprendre cette grille telle quelle** (12 dimensions Free figées en V2)
2. **Préciser le rendu UI** par dimension (où afficher, format tableau ou texte, exports possibles)
3. **Préciser les seuils** (±10 % pour stable, 100 €/5 € pour zombies, etc. — ces seuils sont indicatifs et peuvent être ajustés au moment du brief si justification métier)
4. **Préciser les tolérances** (que faire si une colonne manque du CSV, si une période est trop courte, etc.)
5. **Préciser le calibrage Free vs Pro dans l'UI** (que voit le Free, que voit le Pro)
6. **Imposer le sanity check parsing** (règle C) comme garde-fou obligatoire en production
7. **NOUVEAU V3 — Imposer l'usage des templates littéraux** de la bibliothèque (Templates 1 à 7). Claude Code reprend les textes quasi tels quels, ne les invente pas. Le test mental simple : un développeur qui n'a jamais vu une analyse ChatGPT doit pouvoir produire un rendu de qualité ChatGPT juste en suivant les templates de cette bibliothèque.
8. **NOUVEAU V3 — Format de fichier VC FR explicite** (apprentissage bug du 22 mai). Tout brief Claude Code parlant de parser un export Vendor Central doit inclure :
   - Structure des fichiers : ligne 1 = métadonnées Amazon (`Programme=[Retail]`, `Champ de vision.=[01/01/2025 - 18/05/2025]`, etc.), ligne 2 = en-têtes, lignes 3+ = données
   - Noms exacts des colonnes FR Amazon avec leur encodage (`Chiffre d'affaires basé sur les commandes` avec apostrophe typographique `\u2019`, pas ASCII)
   - Mapping FR → noms internes (`ASIN` → `asin`, `Nom du produit` → `titre`, etc.)
   - Caractères pièges à neutraliser explicitement (`\u202f` notamment)

---

## HISTORIQUE DE VERSION

| Version | Date | Évolution |
|---|---|---|
| V1 | 21 mai 2026 matin | Création — grille figée 12 Free + 4 Pro suite confrontation Opus 4.7 + ChatGPT 5.5 |
| V2 | 21 mai 2026 fin de journée | Ajout section **Style rédactionnel attendu** (15 patterns ChatGPT) + correction Dim 4 (Marge Amazon Retail, pas marge industrielle) + règles **Sanity check parsing** (apprentissage bug `\u202f`) |
| V3 | 22 mai 2026 | Ajout **BIBLIOTHÈQUE DE TEMPLATES LITTÉRAUX** (apport central). Le skill devient autoporteur : templates 1-7 avec texte littéral à reproduire, variables paramétrables, exemples rendus réels. Motivation : V2 décrivait les patterns mais ne donnait pas les textes — résultat sur livraison v3.6.5.5 = patterns mal implémentés faute de modèle littéral. |

**Pour évolutions futures** : tout ajout/modification de dimension nécessite un retest sur dataset Cogex + Gers pour confirmer la pertinence métier. Les patterns rédactionnels et les templates littéraux peuvent évoluer en fonction des retours qualité des livrables produits avec ce skill.

---

**FIN DU SKILL**

[Claude Orchestrateur — V3 — 22 mai 2026]
