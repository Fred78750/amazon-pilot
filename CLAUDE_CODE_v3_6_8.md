# CLAUDE_CODE_v3_6_8.md
**Chantier** : v3.6.8 — YoY Étape 3a — Enquête ASINs disparus
**Date production brief** : 27 mai 2026
**Producteur** : Claude Orchestrateur
**Cible commerciale** : été 2026 — chantier le plus dense pré-commercialisation
**Durée estimée** : ~4 semaines
**Statut prod amont** : v3.6.7.1 mergée le 27 mai (YoY Étape 1 + 2 + patch parser ERP Gers "Extraction")

---

## 1. OBJECTIF

Livrer la couche **Enquête** du module YoY : transformer le constat factuel (Étape 1) et les warnings (Étape 2) en matière de décision actionnable pour le KAM. Concrètement, classifier les ASINs disparus en 3 catégories selon 9 codes VC, fournir une fiche détail par ASIN dans la catégorie À CREUSER, livrer les sections Marques et Anomalies, intégrer nativement les POs (parser POItemExport), refondre la fiche client pour gérer les sous-comptes multi-pays Gers. 6 CTA livrés (1, 2, 3, 6, 7, 8). Périmètre Free uniquement — vue Pro et export Word arrivent en v3.6.9.

---

## 2. ENJEUX MÉTIER

C'est le **cœur du module YoY**. Les Étapes 1 et 2 livrées en v3.6.6.2 / v3.6.7 produisent un tableau de bord descriptif : "X € perdus, Y ASINs disparus, alerte concentration". Sans Étape 3a, l'outil s'arrête au constat — le KAM voit le mal mais n'a pas de pile d'actions priorisées. Avec Étape 3a, l'outil dit : "sur les 313 ASINs disparus, voici les 47 à creuser, voici leur diagnostic, voici l'action à mener pour chacun".

C'est le passage du **produit data scientist** (décrire) au **produit KAM Amazon** (décider). C'est aussi ce qui justifie commercialement le passage de Free à Pro (la vue Pro complète arrive en v3.6.9, mais la matière fonctionnelle qui la rend désirable se construit ici).

Sans v3.6.8 mergé prod avant fin juin, la commercialisation été 2026 n'est pas tenable.

---

## 3. SCOPE INCLUS — 8 sous-sections

### 3.1 Algorithme de classification des ASINs disparus

Implémentation stricte de l'algorithme validé sur Cogex Mai 2025 → MtD Mai 2026. Pas de réinvention.

```
Pour chaque ASIN vendu en N-1 mais absent en N (CA_A = 0) :

1. PO dans la période d'observation (X mois, X paramétrable, défaut = 4) ?
   ├─ NON → Stock Amazon > 0 ?
   │   ├─ NON → A1 — Mortalité confirmée (pas d'action)
   │   └─ OUI → A2 — STOCK DORMANT ← warning fort
   │
   └─ OUI → Code dispo du DERNIER PO (par date) ?
       ├─ CP                    → B — Sortie organisée
       ├─ CK                    → B — Refus / Rupture permanente
       ├─ IR ou OS (>90j)       → B — Hémorragie longue
       ├─ CQ ou R2              → R — Désaccord commercial
       ├─ IR ou OS (<90j)       → C — Rupture temporaire récente
       ├─ IA (Statut Confirmé)  → D2 — PO en cours
       ├─ IA (Statut Clôturé)   → D1 — Mystère opérationnel
       └─ AC                    → D1 — Mystère opérationnel
```

**Sortie produit — 3 catégories pour le rendu UI** :
- **Catégorie 1 — Mortalité naturelle** (A1) : pas d'action, à afficher en masse compactée
- **Catégorie 2 — À CREUSER** (A2 + D1 + D2 + R) : investigation par ASIN, vraie matière business — c'est la catégorie principale du rendu, fiche détail obligatoire
- **Catégorie 3 — Autres** (B + C) : géré au fil de l'eau, à afficher en liste simple

**Définition "PO dans la période"** : prendre tous les POs dont `Date de la commande` est dans la fenêtre [today - X mois, today], avec X défaut = 4. Paramètre X exposé en fiche client (slider 1-12 mois).

**Définition "ancienneté du dernier PO IR/OS"** : différence entre `today` et la `Date de la commande` du PO le plus récent. Seuil 90 jours pour distinguer C (rupture récente) de B (hémorragie longue).

### 3.2 Table constante `VC_AVAILABILITY_CODES`

À implémenter comme constante globale en haut du fichier, avant tout code algorithme.

```javascript
const VC_AVAILABILITY_CODES = {
  'AC': { family: 'accepted_real',     meaning: 'Accepté confirmé manuellement, stock OK' },
  'IA': { family: 'accepted_blind',    meaning: 'Accepté EDI uniquement (statut réel inconnu)' },
  'IR': { family: 'out_temp',          meaning: 'Rupture temporaire' },
  'OS': { family: 'out_temp',          meaning: 'Rupture temporaire (saisie ADV imprécise)' },
  'CK': { family: 'out_perm',          meaning: 'Rupture longue / refus fournisseur' },
  'CP': { family: 'discontinued',      meaning: 'Fin de série / sortie organisée' },
  'CQ': { family: 'commercial_minimum', meaning: 'Franco non atteint' },
  'R2': { family: 'commercial_price',   meaning: 'Prix de cession refusé' },
  'CA': { family: 'not_yet',           meaning: 'Pré-lancement, pas encore commandable' }
};
```

**Extraction du code depuis la colonne `Disponibilité`** : la valeur est du type `IA - Accepté : EDI uniquement` (FR) ou `AC - Accepted: In stock` (EN). Extraire les caractères avant le premier ` - ` (espace-tiret-espace), trim, uppercase. Code inconnu → loguer + traiter comme `AC` par défaut (le moins agressif).

### 3.3 Parser POItemExport natif (ingestion native vs CSV statique hors-process)

**Bloc Format de fichier** (règle 19 — explicite avant tout code parser).

Le fichier `POItemExport.csv` se télécharge depuis Vendor Central > Commandes > Gestion. Existe en 2 variantes linguistiques selon la langue de l'interface VC du client :

**Variante FR** (Cogex + Gers FR — header commence par `BdC,Code fournisseur,`)
**Variante EN** (Gers ES + autres marchés EN-locale — header commence par `PO,Vendor code,`)

**32 colonnes identiques** dans les deux variantes (même ordre, libellés traduits). Mapping :

| Colonne FR | Colonne EN | Nom interne | Type | Usage v3.6.8 |
|---|---|---|---|---|
| `BdC` | `PO` | `poId` | string | clé PO |
| `Code fournisseur` | `Vendor code` | `vendorCode` | string | rattachement sous-compte |
| `Date de la commande` | `Order date` | `orderDate` | date | période d'observation |
| `Statut` | `Status` | `status` | enum | `Confirmé`/`Clôturé`/`Non confirmé` (FR) ou `Confirmed`/`Closed`/`Not confirmed` (EN) — utilisé pour IA Confirmé vs IA Clôturé |
| `Nom du produit` | `Product name` | `title` | string | affichage |
| `ASIN` | `ASIN` | `asin` | string | clé ASIN |
| `Disponibilité` | `Availability` | `availability` | string | extraction code 2-lettres → famille |
| `Quantité demandée` | `Requested quantity` | `qtyRequested` | int | hors scope v3.6.8 |
| `Quantité acceptée` | `Accepted quantity` | `qtyAccepted` | int | hors scope v3.6.8 |
| `Coût total accepté` | `Total accepted cost` | `costAccepted` | float | hors scope v3.6.8 |
| `Lieu de livraison` | `Ship-to location` | `shipTo` | string | **PAS la marketplace de vente** (cf. point d'attention 9.3) |

Autres colonnes (Référence externe, SKU vendeur, ASN Quantity, etc.) : parsées pour completeness mais non utilisées par l'algorithme v3.6.8.

**Spécificités techniques du parsing** :
- BOM UTF-8 en tête (`\uFEFF`) à supprimer avant parsing
- Délimiteur : virgule (`,`)
- Quotes : standard CSV (`"..."`) sur les valeurs contenant des virgules — Papa.parse gère nativement
- Encodage fichier : UTF-8
- Format date : `27-May-2026` (`DD-MonAbbr-YYYY` avec mois EN même dans la variante FR — c'est l'export VC qui force cette convention)
- Détection langue : 1ère ligne du fichier — si commence par `BdC,` (ou `\uFEFFBdC,`) → FR, si `PO,` → EN
- Délimiteur des coûts : point décimal (`1.55`), pas virgule

**Stockage en mémoire** : `c.pos[]` (tableau plat, déjà existant). Dédoublonner par `(poId, asin)` au moment de l'import. Persister via IndexedDB existant (store `clients`).

**Volumes attendus** : 2000 à 3500 lignes par fichier (validé sur les 3 fichiers fournis le 27 mai). Pas de pagination nécessaire en parsing.

### 3.4 Refonte fiche client — sélecteur sous-comptes multi-pays

**Contexte** : Gers Équipement opère plusieurs comptes Vendor Central, certains reçoivent les POs (sous-comptes "Bon de Commande"), d'autres ne servent qu'à pousser le catalogue produit (sous-comptes "Fournisseur de catalogue"). Cogex aussi a 2 vendor codes (COGEX et 3J6MN) — les deux reçoivent des POs.

**À implémenter** dans la fiche client :

Ajout d'une section "Sous-comptes Vendor" listant les `vendorCode` détectés (à partir des `c.pos[].vendorCode` après import) ou saisis manuellement. Pour chaque sous-compte, sélecteur :
- `Bon de Commande` (génère des POs — inclus dans l'algorithme classification)
- `Fournisseur de catalogue` (pas de PO attendu — exclu de l'algorithme classification)

Par défaut : tout sous-compte avec au moins 1 PO importé est marqué automatiquement "Bon de Commande". Tout sous-compte sans PO sur 12 mois est marqué "Fournisseur de catalogue" mais reste éditable par Fred.

**Conséquence algorithme** : l'algorithme classification ne tourne que sur les ASINs vendus en N-1 ET dont le `vendorCode` du dernier PO appartient à un sous-compte "Bon de Commande". Les ASINs vendus uniquement via un sous-compte "Fournisseur de catalogue" sont exclus du périmètre Enquête (ils sont visibles dans les KPIs YoY Étape 1 mais pas classifiés).

**Consolidation des imports éparpillés** : la fiche client actuelle a des imports répartis (Ventes, Stock, POs, Défauts livraison) à des endroits différents. À regrouper dans une section unique "Données importées" listant pour chaque type : dernier import, fraîcheur, action `Mettre à jour`. Ne pas réinventer la roue — auditer l'existant (règle 12), ne déplacer que ce qui sert l'expérience YoY.

### 3.5 Section Marques avec normalisation et alias

**Affichage** : tableau Top 10 marques en CA quotidien sur la période de référence, avec colonnes :
- Marque (nom affiché)
- CA/j réf.
- Part réf.
- CA/j A
- Part A
- Variation €/j (coloré neg/pos)

Tri par défaut : `CA/j réf.` décroissant. CTA en bas : `Explorer les marques en chute dans Analyse ASINs →` (CTA 6).

**Normalisation des marques** :
- Fonction `normalizeBrand(brand)` : uppercase + trim + suppression accents (NFD + diacritiques) + suppression espaces multiples
- Appliquée à chaque ASIN au moment du calcul des agrégats marque
- Exemple : `Sitram`, `SITRAM`, `sitram ` → tous normalisés vers `SITRAM`

**Dictionnaire d'alias par client `c.brandAliases`** :
- Structure : `{ canonical: 'GENEVIEVE LETHU', variants: ['LETHU', 'GENEVIEVE LETU'] }`, tableau de ces objets dans `c.brandAliases`
- Effet : avant le calcul des agrégats marque, toute marque normalisée présente dans un `variants[]` est remplacée par son `canonical`
- Édition : interface dans la fiche client (section dédiée) pour permettre à Fred d'ajouter / supprimer / fusionner des alias
- **Persistance** : `c.brandAliases` est stocké avec les autres données client (IndexedDB store `clients`)

**Recalcul après fusion** (point tranché 27 mai par Fred) : la Section Marques affiche les agrégats CALCULÉS APRÈS application des alias. La fusion n'est donc pas cosmétique — elle modifie le Top 10 affiché. Exemple Cogex : si Fred fusionne `COGEX` + `Cogex` via alias, la Section Marques montre 1 seule entrée `Cogex` avec CA cumulé, plus 2 entrées séparées.

### 3.6 Section Anomalies — détection des doublons orthographiques

**Affichage** : tableau des paires de marques détectées comme variantes probables, avec colonnes :
- Variante 1
- Variante 2
- Similarité (%)
- CA cumulé V1 (sur période réf.)
- CA cumulé V2 (sur période réf.)

Tri par défaut : `Similarité` décroissante, puis par `CA cumulé V1 + CA cumulé V2` décroissant. CTA : `Ouvrir un cas de fusion catalogue →` (CTA 7) — l'action ouvre le module Cas Vendor Central avec un template pré-rempli pour demande de fusion catalogue (réutiliser l'existant si disponible).

**Algorithme de détection** :
- Pour chaque paire de marques distinctes (post-normalisation, post-alias) du catalogue
- Calculer la distance de Levenshtein normalisée : `similarity = 1 - (levenshtein(b1, b2) / max(len(b1), len(b2)))`
- Seuil par défaut : ≥ 80% → considéré comme doublon probable
- Seuil paramétrable en fiche client (slider 50-100%, défaut 80)
- Cas particuliers à matcher : casse différente (déjà gérée par la normalisation), faute de frappe simple (1-2 caractères de différence), pluriel/singulier (`Greenger` vs `Greengers`)

**Bouton "Fusionner ces 2 marques"** sur chaque ligne : crée un alias dans `c.brandAliases` avec confirmation Fred avant action. Une fois fusionnées, les marques disparaissent de la liste Anomalies (puisque post-normalisation elles sont identiques).

**Filtrage** : exclure les paires dont la similarité = 100 % ET les CA cumulés sont totalement asymétriques (ex. l'une à 5 €, l'autre à 50 000 €) — probablement pas un vrai doublon mais un cas marginal. Seuil d'asymétrie : `min(CA1, CA2) / max(CA1, CA2) < 0.005` → exclu.

### 3.7 Fiche détail enquête par ASIN — catégorie À CREUSER

**Périmètre** : pour chaque ASIN dans la catégorie À CREUSER (A2 + D1 + D2 + R), permettre à Fred de consulter le diagnostic individuel et les données qui ont conduit à la classification.

**Données à afficher dans la fiche détail** :
- ASIN, Titre, Marque
- CA période réf. (jour + projeté)
- Sous-catégorie (A2 STOCK DORMANT / D1 Mystère / D2 PO en cours / R Désaccord commercial)
- Code dispo du dernier PO + libellé associé + date du PO
- Statut du dernier PO (Confirmé / Clôturé)
- Stock Amazon actuel (depuis l'import Stock le plus récent)
- Lien direct vers la fiche ASIN Vendor Central (URL `https://vendorcentral.amazon[market]/abis/listing/edit/product_details?sku=...&asin=...&vendorCode=...`)
- Lien vers l'écran Analyse ASINs filtré sur cet ASIN

**Ergonomie — Claude Code propose dans son plan technique** (cf. point Q3 tranché 27 mai : pas d'imposition). 3 options envisagées :
- (α) Ligne tableau compacte, expansion in-place au clic
- (β) Card dépliable
- (γ) Drawer / modal au clic

Critères d'arbitrage à appliquer par Claude Code :
- Cohérence avec l'UI existante (Analyse ASINs, Buy Box) — ne pas introduire un pattern UI tiers
- Densité d'information : 47+ ASINs à parcourir, donc compactage important
- Vitesse de scan : Fred doit pouvoir survoler 10 ASINs en moins d'une minute

Inclure dans le plan technique la justification du choix retenu (référence à 1 ou 2 patterns UX comparables dans le produit).

### 3.8 CTA à livrer — 6 boutons

Selon mapping `YOY_DELTA_MAQUETTE_VS_PROD.md` table CTA :

| # | Libellé | Localisation | Comportement |
|---|---|---|---|
| 1 | `Examiner les ASINs en baisse dans Analyse ASINs →` | KPI hero block | Navigue vers Analyse ASINs avec filtre "en baisse > 10%" sur la période A |
| 2 | `Voir le Diagnostic CA détaillé →` | KPI hero block | Navigue vers le module Diagnostic CA existant (déjà livré) |
| 3 | `Filtrer les 313 disparus dans Analyse ASINs →` | Section Catalogue | Navigue vers Analyse ASINs avec filtre "disparus en A" (CA A = 0, CA réf > 0) |
| 6 | `Explorer les marques en chute dans Analyse ASINs →` | Section Marques | Navigue vers Analyse ASINs filtré sur les 3 marques avec plus forte chute €/j |
| 7 | `Ouvrir un cas de fusion catalogue →` | Section Anomalies (par ligne) | Ouvre module Cas Vendor Central avec template pré-rempli |
| 8 | `Démarrer l'audit dans Analyse ASINs →` | Plan d'action P1 (Free) | Navigue vers Analyse ASINs filtré sur les 3 plus gros disparus visibles Free |

Pas de CTA 4, 5, 9, 10 (Buy Box) — c'est v3.6.10.

---

## 4. LIMITES NÉGATIVES — ce qui N'EST PAS dans le scope

Anti scope creep. Ces éléments sont attendus mais explicitement reportés.

- ❌ **Toggle Vue Free / Vue Pro** (CTA 14) — c'est v3.6.9
- ❌ **Plan d'action 5 priorités complet** (Priorités 1 à 5 en vue Pro) — c'est v3.6.9. En v3.6.8 on livre seulement la Priorité 1 partielle (visible Free, 3 ASINs sans la suite floutée)
- ❌ **Bandeau "Accès complet Pro" et logique freemium back-end** — c'est v3.6.9
- ❌ **Export Word automatisé** (CTA 13) — c'est v3.6.9
- ❌ **Narrative IA Claude** (synthèse exécutive générée par IA) — c'est v3.6.9
- ❌ **Section Top mouvements ASIN** (Top 10 perdants + Top 10 gagnants en CA quotidien) — visuellement présent dans la maquette V3, mais n'apporte pas de matière supplémentaire en v3.6.8 puisque les disparus sont déjà classifiés. À reporter v3.6.9
- ❌ **CTA 4 `Ouvrir des cas Vendor Central depuis Buy Box →`** — c'est v3.6.10
- ❌ **CTA 5 `Sécuriser les best-sellers via Buy Box →`** — c'est v3.6.10
- ❌ **CTA 9 `Surveillance Buy Box des best-sellers →`** — c'est v3.6.10
- ❌ **CTA 10 `ASINs purchase hold (BOL mismatch) →`** — c'est v3.6.10
- ❌ **Croisement défauts livraison × ASINs** — c'est v3.6.10
- ❌ **Refonte UX globale Buy Box** — pas dans la roadmap pré-commercialisation
- ❌ **Reconfiguration de la grille KPI hero block** (3 KPIs en gros vs 4 KPIs cartes) — c'est v3.6.7 déjà fait, pas re-toucher
- ❌ **Modification du parser CSV VC v3.6.6.2** — anti-régression stricte sur ce parser
- ❌ **Modification du parser ERP v3.6.6 / v3.6.7.1** — anti-régression stricte
- ❌ **Création d'un nouveau module** : Enquête doit vivre dans l'écran YoY existant, pas ouvrir un nouvel onglet de navigation
- ❌ **Refacto archi modulaire** — c'est v3.7 post-commercialisation

---

## 5. CRITÈRES DE RÉCEPTION

### 5.1 Critères visuels (à valider par Fred sur Cogex et Gers)
- Section Catalogue YoY enrichie de la classification 3 catégories avec ratios cohérents avec le terrain Cogex (sur 313 disparus, ratio À CREUSER vs Mortalité vs Autres doit être plausible)
- Section Marques affichant Top 10 marques avec colonnes complètes, tri par défaut sur `CA/j réf.` décroissant
- Section Anomalies affichant les paires de doublons détectés avec similarité ≥ 80 %
- Fiche détail ASIN À CREUSER opérationnelle pour au moins un ASIN test de chaque sous-catégorie (A2, D1, D2, R)
- Fiche client présentant la section Sous-comptes Vendor pour Gers, vide pour Cogex (1 seul code) — à valider que les 2 codes Cogex (COGEX + 3J6MN) sont bien détectés

### 5.2 Critères comportementaux
- 6 CTA livrés et fonctionnels (navigation correcte avec filtres pré-appliqués)
- Import POItemExport FR + EN sur les 3 fichiers fournis le 27 mai, sans erreur, avec count cohérent (2155, 3158, 3414 lignes après header)
- Algorithme classification déterministe (même input → même output) — vérifier sur 3 ASINs test
- Normalisation marques active : Cogex et COGEX fusionnés automatiquement (casse uniquement) avant ajout d'alias manuel
- Recalcul de la Section Marques après ajout d'un alias par Fred : effet visible en moins de 2 secondes
- Anomalies : la suppression d'une paire après fusion fonctionne

### 5.3 Critères de qualité non-régression
- Tous les écrans existants (Dashboard, Revue Hebdo, Analyse ASINs, Buy Box, Diagnostic CA, Appros, Fiche client, Agent SEO, Configuration) restent fonctionnels
- Parser CSV VC v3.6.6.2 inchangé
- Parser ERP v3.6.6 / v3.6.7.1 inchangé
- Aucun crash IndexedDB sur clients existants (Cogex + Gers chargés en preprod)
- SMOKE_REF Cogex passe inchangé

### 5.4 Validation Fred obligatoire avant merge prod
- Démo bout en bout sur Cogex (period réf. = 01/04/2025 → 31/05/2025, period A = 01/04/2026 → today)
- Démo bout en bout sur Gers FR (mêmes périodes)
- Validation chiffrée : ratio des 3 catégories doit être cohérent avec la connaissance terrain Fred

---

## 6. AUDIT ANTI-RÉGRESSION 4 BLOCS (règle 28)

À effectuer systématiquement avant tout merge prod, sans exception.

**Bloc 1 — Smoke tests fonctionnels existants** : passer la suite de smoke tests existante (count = N à confirmer côté Claude Code). Cible : 100% pass, 0 régression. Si un test ne passe pas, ne pas merger — corriger d'abord.

**Bloc 2 — Comparaison rendu visuel avant / après** : capture preprod actuelle vs build candidat sur les écrans clés (Dashboard, Revue Hebdo, Analyse ASINs, Buy Box, Diagnostic CA, YoY, Fiche client, Appros, Agent SEO, Configuration). Tout écart non intentionnel sur un écran hors scope = régression à corriger.

**Bloc 3 — Smoke tests parser** : reparser les 6 fichiers de référence Cogex + Gers actuellement utilisés par v3.6.7.1 (CSV VC + ERP). Cible : counts identiques à v3.6.7.1 (validation de non-régression sur les parsers existants).

**Bloc 4 — Validation IndexedDB compatible** : charger un export client v3.6.7.1 (JSON backup) dans le build v3.6.8 candidat. Cible : pas d'erreur, données rechargées, structure préservée. Si nouveau champ ajouté (ex. `c.brandAliases`, `c.subVendors`), il doit avoir une valeur par défaut compatible (tableau vide).

Documenter l'audit en console de l'application (lignes loguées au démarrage) ET en fichier audit séparé livré avec le build.

---

## 7. RESSOURCES

### 7.1 Documents de référence (project_knowledge)
- `Claude_Orchestrateur_Context.md` V0.7 — contexte orchestrateur courant, règles 1 à 30
- `YOY_DELTA_MAQUETTE_VS_PROD.md` — delta maquette V3 vs prod, table CTA par version
- `maquette_yoy_cogex_v3.html` — cible visuelle YoY (sections Marques, Anomalies, fiche détail ASIN À CREUSER)
- `20260518_RECAP_SESSION_v3_6_1_5_4.md` — méthodologie YoY 4 étapes + algorithme classification complet
- `CONTEXTE_REPRISE_v3_6_8.md` — doc de transition session précédente avec arbitrages Q1/Q2/Q3

### 7.2 Données de test (uploadées en session 27 mai)
- `POItemExport_2026-05-27.csv` — Cogex (FR), 3158 lignes, vendor codes COGEX + 3J6MN
- `POItemExport_2026-05-27__1_.csv` — Gers FR, 3414 lignes, vendor codes GERA3 + autres
- `POItemExport_2026-05-27__2_.csv` — Gers ES (EN-locale), 2155 lignes, vendor code USOMB
- `Ventes_ASIN_Fabrication_..._24-05-2025_24-05-2026.csv` — Cogex, 893 ASINs avec CA 12 mois (validation algorithme)
- `Stock_ASIN_Fabrication_..._24-05-2025_24-05-2026.csv` — Cogex, 1520 ASINs Stock_Fab 12 mois (validation algorithme)

### 7.3 Environnements
- **Local** : `C:\AmazonPilot\` (Fred), PowerShell, séparation de commandes (no `&&`)
- **Staging → recette** : `d9xny9istvl53.cloudfront.net`, S3 `amazon-pilot-recette`, CloudFront `EVQ30COFUNGA7`
- **Preprod** : `preprod.amazon.foliow.app`, S3 `amazon-pilot-preprod`, CloudFront `E3CODYJ437XKU5`
- **Prod** : `amazon.foliow.app`, S3 `amazon-pilot-foliow`, CloudFront `E3ERL241475BJI`

---

## 8. PROCÉDURE

1. **Lecture des ressources** — Claude Code lit les 5 documents 7.1 + ouvre les 3 POItemExport pour confirmer la structure parsée
2. **Plan technique exhaustif** — Claude Code produit un plan détaillé AVANT toute écriture de code (règle n°1), incluant :
   - Architecture des nouveaux modules / fonctions
   - Choix de structure de données (`c.brandAliases`, `c.subVendors`, `c.pos` enrichi)
   - Choix UX pour la fiche détail enquête (option α/β/γ + justification)
   - Section "Choix non spécifiés dans le brief" listant les points d'arbitrage rencontrés
3. **GO Fred** sur le plan technique — si arbitrages à trancher, Fred répond, Claude Code intègre puis attend GO final
4. **Implémentation par étapes** — découper en commits logiques, push staging à chaque étape
5. **Audit anti-régression 4 blocs** sur build candidat preprod
6. **Validation Fred bout en bout** sur Cogex + Gers FR
7. **Merge main → prod** après validation explicite Fred (jamais sans)
8. **Mise à jour `YOY_DELTA_MAQUETTE_VS_PROD.md`** — cocher les lignes livrées
9. **Commit `Claude_Orchestrateur_Context.md` V0.8** — déposé par Claude Code après production par Orchestrateur

Pas de raccourci sur l'ordre. Pas de commit direct sur main (règle 5).

---

## 9. POINTS D'ATTENTION

### 9.1 Risque scope creep entre Marques et Anomalies
La frontière est nette en théorie : Marques = vue Top 10 brut post-fusion, Anomalies = détection de fusions à proposer. En pratique, il y aura tentation de mélanger (afficher des suggestions de fusion directement dans la Section Marques, etc.). Ne pas le faire. Garder les 2 sections distinctes.

### 9.2 Dépendance POItemExport — format potentiellement instable
Amazon Vendor Central peut faire évoluer la structure du CSV sans préavis. Implémenter le parser avec :
- Détection automatique de la langue (header)
- Mapping par nom de colonne (pas par index)
- Loguer une alerte si une colonne attendue manque
- Ne pas planter sur colonnes additionnelles inattendues

### 9.3 Lieu de livraison ≠ marketplace de vente (multi-pays Gers) — CRITIQUE
Sur les comptes multi-pays type Gers "Bon de Commande", la colonne `Lieu de livraison` (CDG7, ZAZ1, BCN1...) indique l'entrepôt physique de réception du PO, pas la marketplace de revente. Amazon redistribue ensuite invisiblement le stock sur les marketplaces FR/ES/NL/DE/BE/IT. **Conséquence pour l'algorithme** :
- L'algorithme classification ne fait PAS de répartition par marketplace de vente à partir du `Lieu de livraison`
- L'algorithme tourne au niveau du compte vendor (sous-compte Bon de Commande)
- Tenter de répartir les POs sur les marketplaces de vente serait une fausse précision et une régression méthodologique

### 9.4 Distinction IA Confirmé vs IA Clôturé — point fin de l'algorithme
La distinction joue dans l'algorithme : `IA Confirmé` (Statut = Confirmé) → D2 (PO en cours, normal), `IA Clôturé` (Statut = Clôturé) → D1 (mystère, le PO est terminé sans avoir vendu). Bien lire la colonne `Statut` (FR) / `Status` (EN), pas la colonne `Disponibilité`. Ne pas confondre.

### 9.5 Normalisation marques — équilibre conservateur vs agressif
La normalisation `uppercase + trim + suppression accents + suppression espaces multiples` est conservatrice (ne fusionne que les variantes purement orthographiques). Les vraies variantes (`Lethu` vs `Geneviève Lethu`) nécessitent des alias manuels. Ne pas pousser la normalisation au-delà (ex. suppression des mots courts comme "et", "de", suppression de la ponctuation) — risque de faux positifs majeur. La détection des cas non triviaux passe par la Section Anomalies, pas par la normalisation.

### 9.6 Section "Choix non spécifiés dans le brief" attendue dans le plan Claude Code
Le brief ne peut pas tout couvrir. En cours d'élaboration du plan technique, Claude Code rencontrera des choix non explicités. Pattern positif identifié dans les sessions précédentes : produire une section "Choix non spécifiés dans le brief" dans le plan, et soumettre ces choix à Fred avant le GO final. Ne pas trancher unilatéralement.

### 9.7 Volumétrie — ne pas saturer le browser
Volumes potentiels : Gers a probablement 5000+ ASINs, 10 000+ POs sur 12 mois cumulés sur ses sous-comptes. L'algorithme classification doit être indexé (Map par ASIN, Map par vendorCode), pas en double boucle naïve. Cible : exécution complète < 3 secondes sur Gers.

---

## 10. SIGNATURE LIVRABLE

[Agent Orchestrateur] — Source : `CONTEXTE_REPRISE_v3_6_8.md` + maquette V3 + POItemExport ×3 + Orchestrateur V0.7 — Confiance : haute sur l'algorithme et la table VC, moyenne sur l'ergonomie fiche détail (Claude Code propose), à valider sur le périmètre exact de la consolidation des imports éparpillés (Claude Code audite l'existant et propose).

**FIN DU BRIEF**
