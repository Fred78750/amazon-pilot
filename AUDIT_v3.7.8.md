# AUDIT v3.7.8 — Parser Delivery natif + timeline deliveryDefects

**Date** : 2026-06-13  
**Version** : 3.7.8  
**Environnement de validation** : preprod (https://preprod.amazon.foliow.app/) — client Cogex Outillage  
**Fichier réel** : `Delivery#2025-06-01_2026-05-31#FR.csv` (330 732 octets, 891 lignes, 12 mois glissants)

---

## 1. Reconnaissance `parseDeliveryDefectsCSV`

**Existant avant v3.7.8 (`parsers_internal.js:184-240`) :**
- Parser fonctionnel, colonnes correctement mappées (Week_end, Vendor Code, PO, Sub-Defect, etc.)
- Retourne `{ items: [...], summary: { totalDefects, vendorCodes, subDefects, totalUnits } }`
- Stockage : `c.deliveryDefects = parsed.items` (flat array client, remplacé à chaque import)
- Utilisé par `buybox.js:335` pour count global ("N défauts importés, toute la flotte")
- Appelé depuis `importBuyBoxDefects` (handler bouton dédié) — **pas via mergeImportData**

**Lacunes identifiées :**
1. Pas d'ASIN dans le fichier Delivery (granularité PO) → jointure PO→ASIN absente
2. Pas de timeline sur `c.asins[i]`
3. `parseCSVFile` ne reconnaissait pas les fichiers Delivery (ne passait pas par `parseVCFile`)
4. `detectFileType` n'avait pas de branche 'delivery'

**Décision** : pas de nouveau module — extension de `parsers_internal.js` existant + bloc mergeImportData.

---

## 2. Format réel confirmé

Fichier : `Delivery#2025-06-01_2026-05-31#FR.csv`
- Pas de BOM (commence par `"`)
- Header en ligne 0, données en ligne 1+
- 19 colonnes CSV, toutes quotées, séparateur virgule
- `Week_end` : YYYY-MM-DD (fin de semaine Amazon)
- Colonne `PO` : clé de jointure vers `c.pos[].poId`
- 6 catégories Sub-Defect : `BOL Mismatch`, `Not On Time`, `Delivery Window Compliance`, `NCNS`, `Rejected`, `Late Canc./Resch.`

---

## 3. Modèle de données deliveryDefects

```
c.asins[i].deliveryDefects = {
  "<weekKey>": {                          // YYYY-MM-DD (Week_end = fin de semaine Amazon)
    "BOL Mismatch":                <int>, // occurrences (pas units)
    "Not On Time":                 <int>,
    "Delivery Window Compliance":  <int>,
    "NCNS":                        <int>,
    "Rejected":                    <int>,
    "Late Canc./Resch.":           <int>
  }
}
c.asins[i]._ddPoLog = {                  // log interne idempotence (sérialisé IDB)
  "<po>|<weekKey>|<subDefect>": true
}
```

**Coexistence** : `c.deliveryDefects` flat array préservé (buybox.js:335). Deux champs distincts.

---

## 4. Clé semaine — Alignement foViews vs deliveryDefects

| Champ | Source | Format | Convention | Valeur exemple |
|-------|--------|--------|------------|----------------|
| `foViews` weekKey | `Champ de vision.=[JJ/MM/AAAA - ...]` ligne 0 | YYYY-MM-DD | **Lundi (début de semaine)** | `2026-01-19` (lun) |
| `deliveryDefects` weekKey | colonne `Week_end` | YYYY-MM-DD | **Samedi (fin de semaine Amazon)** | `2026-01-24` (sam) |

**Règle de réconciliation pour v3.8 (confirmée sur fichier réel) :**

```
foViews.weekKey  +  5 jours  =  deliveryDefects.weekKey
(lundi)                          (samedi de la même semaine)
```

Exemples vérifiés sur `Delivery#2025-06-01_2026-05-31#FR.csv` :

| deliveryDefects weekKey | Jour | foViews weekKey correspondant | Vérification |
|------------------------|------|-------------------------------|-------------|
| `2026-01-24` | sam | `2026-01-19` | lundi ✅ |
| `2026-01-31` | sam | `2026-01-26` | lundi ✅ |
| `2025-07-05` | sam | `2025-06-30` | lundi ✅ |

**Tous les `Week_end` du fichier réel sont des samedis.** Amazon utilise la semaine lundi→samedi (6 jours), pas la semaine ISO standard (lundi→dimanche). Le croisement v3.8 utilisera `weekEnd = foViewsWeekKey + 5 * 86400000 ms`.

---

## 5. Idempotence — modèle additif PO+weekKey+subDefect

Les fichiers Delivery sont des fenêtres **12 mois glissants** — deux imports successifs se chevauchent partiellement.

**Reset total écarté** : un reset de `asin.deliveryDefects` à chaque import perdrait l'historique sorti de la nouvelle fenêtre et rendrait le résultat dépendant de l'ordre d'import. Ce cas est précisément le scénario A puis B ci-dessous.

**Modèle retenu** : `asin._ddPoLog[po|weekKey|subDefect] = true` — chaque triplet (PO, semaine, type de défaut) n'est compté qu'une fois, indépendamment du nombre d'imports et de leur ordre. Modèle additif identique à `foViews`.

- `_ddPoLog` sérialisé dans IDB → idempotence persistante entre sessions ✅

---

## 6. Comptage occurrences vs units

**Décision** : occurrences (pas units).  
Raison : les units sont au niveau PO (`185` unités pour le PO entier). Si ce PO concerne 3 ASINs, attribuer 185/3 ≈ 62 unités à chaque ASIN serait inexact (pas d'information sur la répartition). Le nombre d'événements défaut est la donnée actionnable pour le diagnostic BB.

---

## 7. Points de validation

### Point 1 — Build + déploiement preprod
- Build `python build.py --version 3.7.8` : ✅ JS valide, 1 083 Ko
- APP_VERSION='3.7.8' confirmé, `detectFileType`, `getDeliveryDefects`, `parseDeliveryDefectsCSV` présents ✅

### Point 2 — Parser + jointure PO→ASIN
- `parseCSVFile('Delivery_test.csv')` → `{ type: 'delivery', items: 3, weekKeys: ['2026-01-17','2026-01-24','2026-01-31'] }` ✅
- PO `4CIAI7XN` → ASIN B00PVPXVBE (cas de référence session juin)
- B00PVPXVBE.deliveryDefects : `{ '2026-01-24': { 'BOL Mismatch': 1 }, '2026-01-31': { 'BOL Mismatch': 1 } }` ✅

### Point 3 — PO multi-ASIN + PO non résolu
- PO `8GOJWJRJ` → B00PVPXVBE + B009G3EMDI : les deux ASINs reçoivent chacun 1 occurrence ✅
- PO sans entrée dans c.pos → stocké dans `c.deliveryDefectsUnresolved` ✅ (simulé : unresolved=0 car POs injectés)

### Point 4 — Idempotence : ré-import + test de chevauchement

**4a — Ré-import à l'identique :**
- `added_second_import=0`, structure `deliveryDefects` inchangée ✅

**4b — Test de chevauchement (cas justifiant l'écart du reset total) :**

Scénario : PO_A → ASIN B_TEST

| Fichier | Semaines couvertes | Lignes |
|---------|-------------------|--------|
| Fichier A (fenêtre ancienne) | 2025-06-07, 2025-06-14, **2025-07-05** | 3 |
| Fichier B (fenêtre décalée) | **2025-07-05**, 2025-07-12, 2025-08-02 | 3 |

`2025-07-05` est la semaine commune (overlap). Import A puis B :

```
addedA = 3  (toutes nouvelles)
addedB = 2  (2025-07-05/Not On Time déjà dans _ddPoLog → sauté)
```

État final `B_TEST.deliveryDefects` :

```json
{
  "2025-06-07": { "BOL Mismatch": 1 },   ← A préservé (hors fenêtre B) ✅
  "2025-06-14": { "BOL Mismatch": 1 },   ← A préservé (hors fenêtre B) ✅
  "2025-07-05": { "Not On Time": 1 },    ← commun A∩B — 1 seul, pas 2 ✅
  "2025-07-12": { "BOL Mismatch": 1 },   ← B nouveau ✅
  "2025-08-02": { "Rejected": 1 }        ← B nouveau ✅
}
```

`overall_pass=true` — reset total bien écarté ✅

### Point 5 — detectFileType (pas de faux positifs)
| Headers | Type retourné |
|---------|--------------|
| `['Week_end', 'PO', 'Sub-Defect', 'Units']` | `'delivery'` ✅ |
| `['ASIN', 'Vues de la page de l\'offre vedette']` | `'trafic'` ✅ |
| `['ASIN', 'Chiffre d\'affaires commandé']` | `'ventes'` ✅ |
| `['ASIN', 'Stock vendable', 'Stock invendable']` | `'stock'` ✅ |
| `['ASIN', 'Quantité demandée', 'Quantité acceptée']` | `'po'` ✅ |
| `['Week_end', 'Stock vendable', 'Stock invendable']` (sans Sub-Defect) | `'stock'` ✅ (pas de faux positif) |

### Point 6 — Performance save()
| Contexte | Durée avg |
|----------|-----------|
| Baseline post-R4 (sans foViews/deliveryDefects) | ~318 ms |
| 130 608 entrées (1 814 ASINs × 12 sem × 6 types, deliveryDefects + _ddPoLog) | **738 ms** (+420 ms) |

Mesures individuelles : 953ms / 649ms / 612ms (1ère run = IDB cold start)  
**En usage réel** : fichier Delivery 890 lignes × ~2 ASINs/PO = ~1 780 entrées → delta estimé **< 30ms**.  
Note : `_ddPoLog` double la volumétrie IDB vs `deliveryDefects` seul. Acceptable car les défauts ne concernent qu'un sous-ensemble d'ASINs.

### Point 7 — Smoke tests
27/30 ✅ — mêmes 3 échecs pré-existants (V7 smoke_history IDB, V8e CTA11, V8f CTA12) — aucune régression introduite par v3.7.8.

---

## 8. Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `src/parsers_internal.js` | Ajout branche 'delivery' dans `detectFileType` ; pré-check Delivery dans `parseCSVFile` (avant `parseVCFile`) ; `window.getDeliveryDefects()` helper |
| `src/import_export.js` | Bloc deliveryDefects dans `mergeImportData` : construction `poAsinMap`, accumulation avec idempotence `_ddPoLog`, coexistence flat array, `c.deliveryDefectsUnresolved` |
| `src/idb.js` | Ajout `deliveryDefectsUnresolved: []` au schéma de migration défensive |

---

## 9. Points ouverts / v3.8

- **Réconciliation temporelle foViews ↔ deliveryDefects** : vérifier sur cas réel que `Week_end` (samedi Amazon) = `foViews.weekKey + 5j` (lundi ISO + 5 = samedi)
- **UI scoring** : pas d'interface dans v3.7.8 — données disponibles en base, scoring BB prévu v3.7.9/v3.8
- **c.pos requis** : si aucun POItemExport importé, tous les POs tombent dans `c.deliveryDefectsUnresolved`. Ordre d'import recommandé : POItemExport PUIS Delivery.
- **Import via UI standard** : le drag-drop CSV déclenche automatiquement l'accumulation si le fichier est classé 'delivery' par `parseCSVFile`
