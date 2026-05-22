# BRIEF CLAUDE CODE — v3.6.6 Parser ERP universel

**Version cible** : v3.6.6
**Chantier** : Parser ERP universel + modèle Amazon Pilot
**Durée estimée** : 2-3 jours Claude Code
**Auteur brief** : Claude Orchestrateur (22 mai 2026 fin de soirée)
**Audience** : Claude Code (implémentation) + Fred (relecture)

---

## OBJECTIF

Permettre à n'importe quel fournisseur Amazon Pilot d'importer ses données ERP (stock + arrivages) via un format standardisé fourni par Amazon Pilot. Aujourd'hui, l'outil ne sait gérer que des formats spécifiques codés au cas par cas (Cogex avait son parser dédié). v3.6.6 introduit un parser ERP universel basé sur un **modèle Excel fourni par Amazon Pilot**.

**Pourquoi maintenant** : Gers (deuxième client actuel) a besoin que ses données stock/arrivages soient importables pour utiliser les modules Appros, Prévisionnel et Diagnostic CA. Le fichier ERP simplifié de Gers a été reçu le 22 mai 2026.

**Cas d'usage cible** :
1. Un nouveau client signe (NDA + onboarding)
2. Fred ou le KAM télécharge le **modèle Excel Amazon Pilot** depuis l'outil
3. Il ouvre son ERP, exporte ses données, et les colle/adapte dans le modèle aux bonnes colonnes
4. Il importe le fichier rempli dans Amazon Pilot via l'écran Import
5. Le parser valide, normalise, charge dans IndexedDB
6. Les modules Appros / Prévisionnel / Diagnostic CA utilisent ces données

---

## FORMAT DE FICHIER ATTENDU (règle 19 V0.6)

### Structure du modèle Amazon Pilot

**Format** : Excel `.xlsx` (pas `.csv`, le client doit pouvoir avoir plusieurs feuilles d'aide si besoin)

**Feuille active** : nommée `Stock_Amazon_Pilot` par convention. Si plusieurs feuilles, seule celle nommée `Stock_Amazon_Pilot` est lue.

**Header** : sur la **ligne 1** (pas ligne 2). Pas de lignes de métadonnées avant.

**Colonnes attendues (ordre indicatif, le parser cherche par nom de colonne)** :

| Colonne | Type | Obligatoire | Description |
|---|---|---|---|
| `SKU` | string | Oui | Référence interne fournisseur (ex. "141431" chez Gers, code SKU chez Cogex) |
| `EAN` | string | Non | Code-barres EAN (utile pour matching ASIN↔EAN ; absence non bloquante) |
| `Designation` | string | Non | Libellé produit (utile pour debug et affichage UI) |
| `Code_Vie` | string | Oui | Statut cycle de vie : `PERM`, `BEST`, `FIN_VIE`, etc. (à valider avec Fred si liste exhaustive nécessaire) |
| `Stock_libre` | number | Non* | Stock disponible non réservé (configuration (a) stocks séparés) |
| `Stock_Amazon` | number | Non* | Stock réservé pour Amazon (configuration (a) stocks séparés) |
| `Stock_disponible_Amazon` | number | Non* | Stock cumulé disponible pour Amazon (configuration (b) stock cumulé) |
| `Date_prochain_arrivage` | date | Non | Date du prochain réapprovisionnement (format Excel natif) |
| `Qte_prochain_arrivage` | number | Non | Quantité du prochain réapprovisionnement |

\* **Règle stock (rectification V0.6)** : au moins une des 3 colonnes stock doit être présente. Voir section "Logique de parsing stock" ci-dessous.

### Configurations stocks acceptées en parallèle

Le parser doit gérer **les deux cas terrain** observés, sans privilégier l'un :

**Configuration (a) — Stocks séparés** :
- `Stock_libre` ET `Stock_Amazon` remplis
- Le total `Stock_disponible_Amazon` = somme des deux (calculé par le parser)
- Fournisseur type : ERP qui ventile explicitement stock libre vs réservation Amazon

**Configuration (b) — Stock cumulé** :
- `Stock_disponible_Amazon` rempli, `Stock_libre` et `Stock_Amazon` absents ou vides
- Le total `Stock_disponible_Amazon` = valeur directe
- Fournisseur type : ERP qui agrège (cas Gers mai 2026 — colonne "Stock Physique non réservé")

**Erreur à signaler à l'utilisateur** :
- Aucune colonne stock présente → message clair "Le fichier doit contenir au moins l'une de ces colonnes : Stock_libre + Stock_Amazon (séparés) OU Stock_disponible_Amazon (cumulé)"
- Les 3 colonnes présentes simultanément avec valeurs → privilégier `Stock_disponible_Amazon` et signaler à l'utilisateur dans un toast "Plusieurs configurations stock détectées, la colonne cumulée a été utilisée"

### Tolérance synonymes des noms de colonnes

Le parser doit reconnaître les variantes courantes (casse-insensible, accents-tolérants) :

| Colonne cible | Synonymes acceptés |
|---|---|
| `SKU` | `sku`, `Code SKU`, `N°`, `Code article`, `Référence`, `Reference` |
| `EAN` | `ean`, `EAN13`, `Code EAN`, `Code-barres`, `Barcode` |
| `Designation` | `Désignation`, `designation`, `Libellé`, `Libelle`, `Nom produit`, `Description` |
| `Code_Vie` | `Code Vie`, `code_vie`, `Cycle de vie`, `Statut`, `Vie produit` |
| `Stock_libre` | `Stock libre`, `Stock dispo`, `Stock disponible`, `Disponible`, `Libre` |
| `Stock_Amazon` | `Stock Amazon`, `Réservé Amazon`, `Reserve Amazon`, `Amazon stock` |
| `Stock_disponible_Amazon` | `Stock disponible Amazon`, `Stock Physique non réservé`, `Stock physique`, `Dispo Amazon`, `Stock unique` |
| `Date_prochain_arrivage` | `Date prochain arrivage`, `Date arrivage`, `Prochain arrivage`, `Date PO`, `Date livraison` |
| `Qte_prochain_arrivage` | `Qt prochain arrivage`, `Qté arrivage`, `Quantité arrivage`, `Qte PO`, `Qte livraison` |

Cas concret Gers (mai 2026, à utiliser comme jeu de test) :
- `N°` → mappé à `SKU`
- `EAN` → `EAN` (exact)
- `Désignation` → `Designation`
- `Code Vie` → `Code_Vie`
- `Stock Physique non réservé` → `Stock_disponible_Amazon` (configuration b)
- `Date prochain arrivage` → `Date_prochain_arrivage`
- `Qt prochain arrivage` → `Qte_prochain_arrivage`

### Caractères pièges à neutraliser

- Espaces insécables étroits `\u202f` dans les nombres formatés Excel → remplacer par rien
- Espaces standard `\u00a0` insécables → idem
- Apostrophes typographiques `\u2019` dans les libellés de colonnes → tolérer (matching tolérant)
- Encodage UTF-8 systématique en lecture, BOM à neutraliser si présent

---

## TÂCHES À RÉALISER

### Tâche 1 — Créer le modèle Excel téléchargeable

Créer un fichier `static/templates/modele_stock_amazon_pilot.xlsx` qui contient :
- Feuille `Stock_Amazon_Pilot` avec ligne 1 = headers (toutes les colonnes obligatoires + optionnelles)
- Ligne 2 = exemple commenté pour 1 produit (montre les 2 configurations stock possibles dans une note)
- Une 2e feuille `Aide` avec instructions de remplissage en français

Ce fichier est téléchargeable depuis l'écran Import via un bouton "Télécharger le modèle".

### Tâche 2 — Développer le parser universel

Créer `src/parser_erp.js` qui expose une fonction `parseFileERP(file: File): Promise<{ok, rows, errors, warnings, config}>` où :
- `ok` : boolean — true si parsing réussi sans erreur bloquante
- `rows` : array d'objets normalisés (un objet par SKU avec tous les champs)
- `errors` : array de messages d'erreur bloquantes (ex. colonne stock manquante)
- `warnings` : array de messages d'alerte non bloquants (ex. 3 colonnes stock détectées, configuration cumulée utilisée)
- `config` : `"separated"` ou `"cumulated"` selon la configuration détectée

**Étapes internes du parser** :
1. Charger le `.xlsx` via SheetJS (déjà disponible dans le projet)
2. Identifier la feuille `Stock_Amazon_Pilot` (ou erreur si absente)
3. Détecter ligne header (ligne 1 par défaut, fallback ligne 2 si ligne 1 vide)
4. Mapper les colonnes via le dictionnaire de synonymes (insensible casse/accents)
5. Détecter la configuration stock (séparée vs cumulée vs erreur)
6. Parser ligne par ligne : normaliser types (string trim, number parse, date Excel→JS), gérer caractères pièges
7. Si configuration (a) séparée : calculer `Stock_disponible_Amazon = Stock_libre + Stock_Amazon`
8. Retourner le résultat structuré

**Sanity check obligatoire (règle skill V3)** :
- Vérifier qu'au moins 80 % des lignes ont un SKU et un stock cohérent (>= 0)
- Si <80 % cohérent, retourner une erreur bloquante avec message explicite

### Tâche 3 — Intégrer le parser dans l'écran Import

Sur l'écran Import (`src/import.js` ou équivalent), ajouter :
- Bouton "Importer données stock (ERP)" qui ouvre un sélecteur de fichier .xlsx
- À la sélection : appel à `parseFileERP()`
- Affichage d'un panneau de prévisualisation avec :
  - Nombre de lignes parsées
  - Configuration détectée (séparée / cumulée)
  - Liste des warnings éventuels
  - Bouton "Valider l'import" qui charge en IndexedDB
- Affichage des erreurs bloquantes en rouge si parsing échoue

### Tâche 4 — Stocker en IndexedDB

Créer une nouvelle store `erp_stock` dans IndexedDB :
- Clé : `{client_id}:{sku}`
- Valeurs : tous les champs du parser + timestamp d'import
- Versioning : migration propre si store n'existe pas (cf. règles IndexedDB du repo)

### Tâche 5 — Exposer les données aux modules consommateurs

Les modules Appros, Prévisionnel et Diagnostic CA doivent pouvoir lire ces données. Créer une fonction utilitaire :
- `getStockERP(client_id, sku) → { stock_total, stock_libre, stock_amazon, prochain_arrivage_date, prochain_arrivage_qte }`

Note : pour cette première version, on ne modifie PAS les modules consommateurs. On expose juste les données. Les intégrations dans Appros/Prévisionnel/Diagnostic CA feront l'objet de chantiers ultérieurs (probablement v3.6.7+).

### Tâche 6 — Tests Playwright

Smoke tests à ajouter :
- Test 1 : chargement du modèle Excel téléchargeable
- Test 2 : import d'un fichier exemple en configuration (a) stocks séparés → parsing OK, store IndexedDB peuplée
- Test 3 : import d'un fichier exemple en configuration (b) stock cumulé (utiliser le fichier Gers du 22 mai comme référence) → parsing OK
- Test 4 : import d'un fichier sans colonne stock → erreur bloquante affichée
- Test 5 : import d'un fichier avec synonymes inhabituels → parser mappe correctement
- Test 6 : import d'un fichier avec caractères pièges (`\u202f` dans les nombres) → parser nettoie correctement

---

## CRITÈRES DE VALIDATION

Avant push v3.6.6 sur recette :
- [ ] Modèle Excel téléchargeable depuis l'écran Import
- [ ] Parser fonctionne sur configuration (a) stocks séparés (test fictif Cogex)
- [ ] Parser fonctionne sur configuration (b) stock cumulé (test réel Gers, fichier `Dispo_Amazon_Mai_26_V1.xlsx`)
- [ ] Erreurs bloquantes claires si colonne stock manquante
- [ ] Warnings non bloquants si 3 colonnes stock simultanées
- [ ] Données stockées en IndexedDB sous `erp_stock`
- [ ] Fonction utilitaire `getStockERP()` exposée
- [ ] 6 smoke tests Playwright verts
- [ ] Audit anti-régression sur les modules non touchés (au minimum smoke tests existants)

---

## LIMITES NÉGATIVES — CE QUE TU NE FAIS PAS

- **Ne pas modifier les modules Appros, Prévisionnel, Diagnostic CA** dans ce chantier. On expose juste les données, on ne refait pas les calculs métier.
- **Ne pas créer d'UI de mapping colonnes par client.** Le modèle Excel est figé, le client adapte son export pour matcher.
- **Ne pas accepter des fichiers `.csv`** dans cette v3.6.6 (le modèle officiel est `.xlsx` pour permettre les feuilles d'aide et les commentaires en cellules).
- **Ne pas créer de prévisionnel basé sur l'ERP fournisseur.** La vélocité produit reste calculée sur les ventes réelles Amazon (cf. principe acté V0.4 — section "Champs explicitement EXCLUS").
- **Ne pas modifier les compteurs IA** (pas d'appel IA dans ce chantier, donc rien à compter).

---

## RESSOURCES EN ATTACHEMENT

- Fichier de référence test : `Dispo_Amazon_Mai_26_V1.xlsx` (Gers, mai 2026) — fourni par Fred en pièce jointe de la session, à utiliser comme cas réel pour la Tâche 6 test 3.
- Documentation modèle ERP : section "Stratégie format ERP" du `Claude_Orchestrateur_Context.md` V0.6 (rectification 2 configurations stocks).

---

## PROCÉDURE STANDARD

1. Tu lis ce brief en entier avant de coder
2. Tu confirmes à Fred que tu vas commencer
3. Tu développes les 6 tâches dans l'ordre
4. Tu pushes sur recette quand smoke tests verts
5. Tu envoies à Fred un récap avec :
   - Captures d'écran de l'écran Import avec le bouton modèle
   - Résultat du parsing sur le fichier Gers (nombre de lignes, configuration détectée, warnings éventuels)
   - 6/6 smoke tests passés
6. Validation Fred → push preprod
7. Audit anti-régression poussé sur preprod (cf. v3.6.5.12 comme référence de niveau)
8. Validation finale Fred → merge prod

---

**FIN DU BRIEF v3.6.6**

[Claude Orchestrateur — 22 mai 2026 fin de soirée]
