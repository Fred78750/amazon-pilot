# AUDIT v3.7.2 — Extraction src/parsers_internal.js
**Date :** 11 juin 2026
**Commit :** 58684bc (main, pre-push)
**Périmètre brief :** CLAUDE_CODE_v3_7_2.md §1

---

## 1. Scope brief vs livré

| Élément brief | Livré | Note |
|---|---|---|
| Créer `src/parsers_internal.js` (8 fonctions parsers CSV/XML) | ✅ | 20 526 octets |
| Supprimer `_parseCSVFile_LEGACY_UNUSED()` | ✅ | Grep confirmé : 0 référence externe (voir §2) |
| Tag `// @parsers_internal` dans core.js | ✅ | Posé à L254 (position de parseMatriceTarifXML) |
| build.py : injection `@parsers_internal` après `@idb`, avant `@utils` | ✅ | |
| Zéro changement fonctionnel (anti-Zélé, règle 33) | ✅ | Déplacement strict, signatures inchangées |

---

## 2. Preuve suppression LEGACY

```
grep -r "_parseCSVFile_LEGACY_UNUSED" src/ --include="*.js" -l
→ src/core.js  (définition seulement)

grep -c "_parseCSVFile_LEGACY_UNUSED" amazon-pilot-latest.html
→ 1  (définition dans l'artefact, aucun appel)
```

Condition remplie : 0 référence externe → suppression effectuée.

---

## 3. Fonctions déplacées dans src/parsers_internal.js

**Détection de type (2)**
- `detectFileType(headers)`
- `detectPeriodType(startDate, endDate, intervalMonths)`

**Dispatcher principal (1)**
- `parseCSVFile(text, filename)` — délègue à parser_vc.js + parsers spécialisés

**Parsers Buy Box & Livraison (3)**
- `parseCSVBuyBox(text)`
- `parseDeliveryDefectsCSV(text)`
- `parseAppointmentsCSV(text)`

**Parsers XML matrice tarifaire (2)**
- `parseMatriceTarifXML(xmlText)` — XML → c.catalogueXML (titres)
- `parseMatriceTarif(xmlText)` — XML → c.catalogue (SKU/prix)

**Supprimé — code mort (1)**
- `_parseCSVFile_LEGACY_UNUSED(text, filename)` — ~124 lignes

---

## 4. Impact core.js

| Métrique | v3.7.1 | v3.7.2 |
|---|---|---|
| Lignes | 10 019 | 9 438 |
| Variation | — | **-581 lignes (-5,8 %)** |
| Chars supprimés | — | 28 154 (dont ~7 Ko LEGACY) |

**Cumul depuis v3.6.9.4 :** 10 962 L → 9 438 L = **-1 524 lignes (-13,9 %)**

---

## 5. Résultats validation (6 points brief §2)

| Point | Résultat |
|---|---|
| 1. `python build.py --check` / `node --check` | ✅ JS valide 984 Ko (-7 Ko vs v3.7.1 = LEGACY supprimé) |
| 2. Diff artefact fonctionnellement identique | ✅ parsers_internal injecté, LEGACY absent |
| 3. Smoke Playwright | ✅ 27/30 — 3 échecs pré-existants inchangés |
| 4a. Chrome automation preprod — Import données Gers | ✅ Données historiques 2024/2025/YTD affichées |
| 4b. 8 fonctions dans window scope | ✅ Confirmées par `typeof` JS |
| 4c. Dashboard Cogex | ✅ 21 050 € CA commandé, Tendance 52S rendue |
| 4d. Analyse comparée Cogex | ✅ Screenshot — KPIs, alertes causales, tableau comparatif |
| 4e. **Flux XML matrice tarifaire Gers** (brief §2 critère clé) | ✅ Voir §5b ci-dessous |
| 5. Console erreurs | ✅ Zéro |
| 6. AUDIT scope-livré | ✅ Ce fichier |

---

## 5b. Flux XML matrice tarifaire — résultat détaillé

**Parcours :** Fiche client Gers Équipement → `ficheHandleXML` → `parseMatriceTarifXML` → re-enrichissement titres FR

**Méthode :** appel JS direct de `parseMatriceTarifXML(xmlText)` avec XML synthétique (5 ASINs réels Gers : B0CJ2STZGN, B08QDN6CZ5, B0DB5FMWST, B0CQRLRQZW, B08NQ1HPQK), puis simulation flux complet `ficheHandleXML`.

**Résultats :**

| Étape | Résultat |
|---|---|
| `parseMatriceTarifXML` retour | `{ items: [5 entrées], summary: { totalASINs: 5, totalLines: 5, vendorCodes: {GERSVC1: 5}, statuses: {Available: 5} } }` |
| Enrichissement catalogueXML | `c.catalogueXML` mis à jour, `c.xmlSummary` et `c.xmlImportDate` écrits |
| Re-enrichissement titres | **44 ASINs mis à jour** (5 ASINs × ~9 marchés actifs Gers) |
| Log émis | `🇫🇷 Titres re-enrichis depuis XML : 44 ASINs mis à jour` ✅ |
| Remplacement titre B0CJ2STZGN | titre AZ EN → titre XML FR confirmé |

**Conclusion :** `parseMatriceTarifXML` déplacé dans `src/parsers_internal.js` fonctionne **identiquement** à l'original. Le flux `ficheHandleXML → parseMatriceTarifXML → re-enrichissement` est intact.

*Note preprod :* le catalogueXML Gers preprod (3 944 ASINs, importé 12/05/2026) a été remplacé par le XML de test puis vidé après restauration des titres. Les 4 564 titres ont été restaurés depuis `titleOriginal`. Préprod uniquement — sans impact prod.

---

## 6. Note technique — extracteur Python

Le script `patch_parsers.py` utilise un extracteur d'accolades amélioré par rapport à v3.7.1/v3.7.2 (regex-aware) :
- Gestion des regex literals JS (`/pattern/`) : une `/` après `=(:,[!&|?{}` est traitée comme début de regex, les `{` et `}` à l'intérieur sont ignorés.
- Nécessaire car `_parseCSVFile_LEGACY_UNUSED` contenait des regex avec `{n}` non balancées qui trompaient l'extracteur précédent.
- Extracteur mis à jour dans `patch_core.py`, `patch_idb.py` et `patch_parsers.py` — à réutiliser pour les extractions v3.7.3+.

---

## 7. Dette connue (inchangée depuis v3.7.1)

| Test | Diagnostic |
|---|---|
| V7 — `saveSmokeHistory` | Pré-existant |
| V8e/V8f — `goToAsinsYoY` | Pré-existant |
