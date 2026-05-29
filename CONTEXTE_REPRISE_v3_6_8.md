# CONTEXTE REPRISE SESSION — v3.6.8 YoY Étape 3a

**Date production** : 27 mai 2026
**Statut session précédente** : v3.6.7.1 mergée prod 27 mai. GO v3.6.8 donné en fin de session. Cadrage des 3 points structurants effectué juste avant transition.
**Objet** : reprise du cadrage v3.6.8 sans friction.

---

## 1. RÈGLES DE SESSION (rappel court)

Lis-moi le contexte orchestrateur complet `Claude_Orchestrateur_Context_V0_7.md` avant tout. Règles critiques :

1. **Règle n°1** : Fred est ingénieur, pas codeur. Claude exécute tout le technique. Fred valide.
2. **Règle anti-sycophantie** : pas de flatterie, dire clairement quand quelque chose ne va pas.
3. **Règle 29** : scanner `project_knowledge` en début de session via 2-3 requêtes ciblées (contexte orchestrateur courant, dernière session récap, roadmap chantier suivant).
4. **Règle 30** : pas de tartines. Réponse = question reçue.
5. **Règle 28** : audit anti-régression 4 blocs systématique avant tout merge prod.
6. **Autonomie niveau 0** : jamais de code sans GO Fred.

---

## 2. STATUT PROD ACTUEL

| Environnement | Version |
|---|---|
| **Prod (main)** | **v3.6.7.1** — mergée 27 mai 2026 |
| **Staging** | Aligné prod |
| **Preprod** | Aligné prod |

**Livraisons récentes** :
- v3.6.6 — Parser ERP universel (22 mai)
- v3.6.6.2 — Parser CSV VC multilingue EN-first + SMOKE_REF par client + collecte historique (22 mai)
- v3.6.7 — YoY Étape 2 Warnings + éveil 80/20 (27 mai)
- v3.6.7.1 — Patch parser ERP nouveau format Gers "Extraction" (27 mai)

---

## 3. CHANTIER À CADRER — v3.6.8

**Slot v3.6.8** = **YoY Étape 3a — Enquête ASINs disparus** (~4 semaines, le chantier le plus dense de la roadmap pré-commercialisation).

### Matière déjà décidée (à NE PAS re-questionner)

L'algorithme de classification, la table VC_AVAILABILITY_CODES, les 3 catégories de rendu, et le cas terrain Cogex sont **complets** dans `Claude_Orchestrateur_Context_V0_7.md` section "Méthodologies validées" + dans les récap session du 18 mai. Inutile de les re-poser à Fred.

Résumé pour mémoire :

```
Pour chaque ASIN vendu en N-1 mais absent en N :

1. PO dans la période (X mois, défaut 4) ?
   ├─ NON → Stock Amazon > 0 ?
   │   ├─ NON → A1 — Mortalité confirmée (pas d'action)
   │   └─ OUI → A2 — STOCK DORMANT ← warning
   │
   └─ OUI → Code dispo du dernier PO ?
       ├─ CP            → B — Sortie organisée
       ├─ CK            → B — Refus/Rupture permanente
       ├─ IR/OS > 90j   → B — Hémorragie longue
       ├─ CQ, R2        → R — Désaccord commercial
       ├─ IR/OS < 90j   → C — Rupture temporaire récente
       ├─ IA Confirmé   → D2 — PO en cours
       ├─ IA Clôturé    → D1 — Mystère opérationnel
       └─ AC            → D1 — Mystère opérationnel

Rendu produit (3 catégories) :
- Catégorie 1 — Mortalité naturelle (A1)
- Catégorie 2 — À CREUSER (A2 + D1 + D2 + R)
- Catégorie 3 — Autres (B + C)

Table VC_AVAILABILITY_CODES :
- AC : accepted_real (Accepté confirmé manuellement)
- IA : accepted_blind (Accepté EDI uniquement)
- IR : out_temp (Rupture temporaire)
- OS : out_temp (Rupture temporaire, saisie ADV)
- CK : out_perm (Rupture longue / refus fournisseur)
- CP : discontinued (Fin de série, sortie organisée)
- CQ : commercial_minimum (Franco non atteint)
- R2 : commercial_price (Prix de cession faux)
- CA : not_yet (Pré-lancement)

Distinction Statut PO : Confirmé (en cours) vs Clôturé (terminé)
```

### Arbitrages tranchés en fin de session précédente (27 mai)

Les 3 questions structurantes que j'avais identifiées ont été tranchées par Fred :

#### Q1 — Sources de données et imports

**Décision** : il faut intégrer les POs dans Amazon Pilot, qui n'y sont pas encore proprement.

- Cogex : POs existent déjà (via POItemExport historique)
- Gers : architecture multi-comptes à exploiter — la fiche client doit permettre de **distinguer chaque sous-compte** entre "Bon de Commande" (= avec POs) et "Fournisseur de Catalogue" (= sans POs). Seuls les comptes Bon de Commande génèrent des POs à importer.
- Autres imports (ventes, stock, défauts livraison) existent déjà mais sont **éparpillés** — à consolider en cours de v3.6.8.

**Conséquence scope** : v3.6.8 doit inclure (a) parser POItemExport pour ingestion native + (b) refonte fiche client avec sélecteur sous-comptes "BdC vs Catalogue" + (c) consolidation des imports éparpillés.

#### Q2 — Section Marques : tolérance variabilité orthographique

**Décision** : tolérer la variabilité orthographique sur les marques.

Exemples concrets fournis par Fred :
- `SITRAM` et `Sitram` → même marque
- `Lethu` et `Geneviève Lethu` et `GENEVIEVE LETU` → même marque (3 graphies, dont une avec faute "LETU" sans H)

**Méthode probable** (à affiner avec Claude Code) :
- Normalisation : uppercase + trim + suppression accents + suppression espaces multiples
- Dictionnaire d'alias par client (`c.brandAliases[]`) : permet à Fred de regrouper manuellement les variantes
- Détection automatique de variantes probables via distance Levenshtein < N + proposition de regroupement à Fred ("Sitram et SITRAM sont probablement la même marque. Regrouper ?")

#### Q3 — Fiche détail enquête par ASIN : ergonomie

**Décision** : laisser Claude Code choisir selon best practice UX/UI. Pas d'imposition (α/β/γ).

3 options possibles à proposer dans le brief :
- (α) Ligne tableau compacte
- (β) Card dépliable
- (γ) Drawer/modal au clic

Demander à Claude Code de proposer dans son plan technique.

---

## 4. SCOPE DÉTAILLÉ v3.6.8 (à formaliser dans le brief)

### Inclus

- **Algorithme classification ASINs disparus** (9 codes → 3 catégories)
- **Table `VC_AVAILABILITY_CODES`** constante globale
- **Parser POItemExport** pour ingestion native (vs CSV statique hors-process)
- **Refonte fiche client** : sélecteur sous-comptes "Bon de Commande" vs "Fournisseur de Catalogue" pour Gers (déjà cadré sessions précédentes mais à compléter)
- **Section Marques** avec tolérance variabilité orthographique (normalisation + dictionnaire alias)
- **Section Anomalies** (détection cas atypiques type fusion catalogue, CA YoY > 1000% sur ASIN unique)
- **Fiche détail par ASIN** dans la catégorie À CREUSER (ergonomie à proposer par Claude Code)
- **6 CTA à livrer** : 1, 2, 3, 6, 7, 8 selon `YOY_DELTA_MAQUETTE_VS_PROD.md` table CTA

### Hors scope (limites négatives)

- Toggle Vue Free / Vue Pro (= v3.6.9)
- Plan d'action 5 priorités (= v3.6.9)
- Export Word + narrative IA (= v3.6.9)
- CTA Buy Box (4, 5, 9, 10) = v3.6.10
- Croisement défauts livraison (= v3.6.10)
- Refonte UX globale Buy Box

---

## 5. POINTS À VÉRIFIER EN DÉBUT DE SESSION

Au démarrage, l'Orchestrateur (toi) doit :

1. **Confirmer matière déjà décidée** : algorithme + table VC_AVAILABILITY_CODES + 3 catégories sont acquis. Ne pas re-questionner.
2. **Confirmer 3 arbitrages session 27 mai** : Q1 POs + Q2 marques + Q3 ergonomie (résumés ci-dessus).
3. **Ne PAS questionner Fred sur des points déjà tranchés**. Pattern d'erreur récurrent V0.7.
4. **Première production attendue** : brief `CLAUDE_CODE_v3_6_8.md` avec scope détaillé + 8 tâches + critères validation + audit 4 blocs.

---

## 6. SOURCES DE DONNÉES TERRAIN (déjà fournies en session précédente)

Tous les fichiers utiles ont été uploadés en session précédente, certains sont peut-être encore accessibles dans `/mnt/user-data/uploads/` :

| Fichier | Contenu | Statut |
|---|---|---|
| `POItemExport_2026-05-26__2_.csv` | Cogex : 10 272 lignes PO sur 12 mois, codes dispo, statuts | Disponible (mode γ devenant native v3.6.8) |
| `Delivery_2025-05-01_2026-04-30_FR__1_.csv` | Cogex : 979 défauts livraison 12 mois (dont 88 PO en BOL Mismatch) | Pour v3.6.10 mais référence utile |
| `Stock_ASIN_Fabrication_..._Personnalisé_24-05-2025_24-05-2026.csv` | Cogex : 1 520 ASINs Stock_Fab 12 mois | Pour validation algorithme |
| `Ventes_ASIN_Fabrication_..._Personnalisé_25-05-2025_24-05-2026.csv` | Cogex : 893 ASINs avec CA 12 mois | Pour validation algorithme |
| `cogex_asins_bol_mismatch_purchase_hold.csv` | Liste 73 ASINs Cogex purchase hold (hors-process) | Référence v3.6.10 |
| 10 fichiers Gers EN/FR multi-pays | 5 types CSV VC × 2 langues | Référence parser CSV VC v3.6.6.2 |

---

## 7. DOCUMENTS À LIRE EN PRIORITÉ DANS LE PROJECT KNOWLEDGE

À scanner via `project_knowledge_search` en début de session :

1. **`Claude_Orchestrateur_Context_V0_7.md`** — contexte orchestrateur courant
2. **`YOY_DELTA_MAQUETTE_VS_PROD.md`** — delta maquette vs prod, mapping CTA par version
3. **`maquette_yoy_cogex_v3.html`** — cible visuelle YoY (sections Marques, Anomalies, fiche détail ASIN À CREUSER)
4. **`20260518_RECAP_SESSION_v3_6_1_5_4.md`** — méthodologie YoY 4 étapes + algorithme classification complet
5. **`BRIEF_BUYBOX_v1.md`** — pour comprendre l'interaction Buy Box × YoY (parasitage)

Requêtes suggérées au démarrage :
- "v3.6.8 YoY Étape 3a Enquête ASINs disparus classification scope"
- "fiche client multi-comptes Gers Bon de Commande Fournisseur de Catalogue POs"
- "marques variabilité orthographique normalisation alias"

---

## 8. STRUCTURE ATTENDUE DU BRIEF v3.6.8

Quand Fred dira "GO production brief", produire `CLAUDE_CODE_v3_6_8.md` avec la structure suivante :

1. **Objectif** (3-5 lignes)
2. **Enjeux métier** (pourquoi maintenant, valeur livrée)
3. **Scope inclus** (8 sous-sections : algorithme, table VC_AVAILABILITY_CODES, parser POItemExport, refonte fiche client multi-comptes, normalisation marques, section Anomalies, fiche détail ASIN, CTA 1/2/3/6/7/8)
4. **Limites négatives** (10+ lignes — règle anti-scope creep)
5. **Critères de réception** (visuel + comportemental + validation Fred + régression)
6. **Audit anti-régression 4 blocs** (cf. règle 28)
7. **Ressources** (documents + données de test)
8. **Procédure** (plan technique avant code + GO + audit + merge prod)
9. **Points d'attention** (risques typiques, ex. scope creep marques/anomalies, dépendance POItemExport)

Cible : ~300 lignes (chantier dense, brief riche mais pas tartine).

---

## 9. AUTOCRITIQUE DE FIN DE SESSION (à intégrer V0.8 future)

**Patterns d'erreur Orchestrateur encore vivaces session 26-27 mai** :
- Tartines récurrentes (3 fois nommé par Fred)
- Question pour info déjà fournie (Cogex CSV envoyé 2 fois car oublié)
- Comparaison écrans sans vérifier client actif (re-violation règle 26 fraîchement gravée)
- Oubli project_knowledge avant questions (2 fois en session)
- Rationalisation post-hoc (numérotation v3.6.7 vs v3.6.6.2)

**Patterns positifs Claude Code à formaliser V0.8** :
- Plan technique exhaustif AVANT code (règle n°1 respectée systématiquement)
- Section "Choix non spécifiés dans le brief" en cours de plan
- Audit anti-régression 4 blocs systématique

**Méthode B parser ERP (chantier futur)** :
- Détection sémantique par sondage croisé SKU (idée Fred 26 mai)
- Au lieu de dictionnaire de synonymes fragile : (1) extraire 10 SKUs aléatoires du catalogue XML client, (2) scanner chaque colonne du fichier ERP, (3) la colonne avec le plus de matches = colonne SKU
- À cadrer dans une session post-commercialisation été 2026

---

## 10. MESSAGE D'OUVERTURE SUGGÉRÉ (à coller en premier message de la nouvelle conversation)

```
Bonjour Claude,

Nouvelle session Amazon Pilot. Le doc de transition complet est en 
pièce jointe (CONTEXTE_REPRISE_v3_6_8.md). Lis-le en premier, puis 
scanne le project_knowledge selon la règle 29 V0.7.

État prod : v3.6.7.1 mergée le 27 mai.

Objectif session : cadrer et rédiger le brief Claude Code v3.6.8 
YoY Étape 3a — Enquête ASINs disparus.

Les 3 questions structurantes ont déjà été tranchées en fin de 
session précédente (POs + marques + ergonomie). Tu trouveras les 
réponses dans le doc de transition section 3.

Quand tu as scanné project_knowledge et confirmé que tu as la 
matière, propose-moi un plan de session (pas de tartine, juste les 
étapes que tu envisages).
```

---

**FIN DOCUMENT TRANSITION**

[Claude Orchestrateur — 27 mai 2026]
