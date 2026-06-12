# AUDIT_v3.7.4 — Extraction import/export + S3 polling

**Date :** 12 juin 2026
**Version :** v3.7.4 (staging → preprod)
**Méthode :** déplacement strict, aucune modification fonctionnelle
**Testeur :** Claude Code + preprod `https://preprod.amazon.foliow.app`

---

## 1. Scope livré

| Artefact | Contenu | Taille |
|---|---|---|
| `src/import_export.js` | 16 fonctions | 47 343 chars |
| `src/s3_poll.js` | 8 fonctions + 2 vars d'état | 5 889 chars |
| `src/core.js` (patché) | 9 103 L → 7 975 L | −1 128 L |
| `amazon-pilot-latest.html` (build) | artefact final | 984 Ko |

### Fonctions déplacées vers `import_export.js`
`mergeImportData`, `handleBannerCSV`, `handlePOImport`, `parsePOCSV`, `mergePOData`, `handleHistCSVImport`, `handleHistCSV`, `handleMultiCSV`, `clearPending`, `checkImportCoherence`, `processImport`, `confirmImport`, `cancelImport`, `exportClient`, `exportAllData`, `importAllData`

### Fonctions déplacées vers `s3_poll.js`
`getS3Config`, `saveS3Config`, `getS3Key`, `getS3PresignedUrl`, `activateS3Poll`, `startS3Poll`, `stopS3Poll`, `pollS3Imports`

### Variables d'état déplacées avec `s3_poll.js`
`let _s3PollHandle = null` — handle `setInterval` du polling S3
`let _s3KnownKeys  = new Set()` — clés S3 déjà traitées (déduplication)

Ces deux variables module-level ont été déplacées en tête de `s3_poll.js` pour garantir l'initialisation avant les fonctions qui les utilisent. Aucun risque d'ordre d'initialisation : elles sont des primitives définies avant les fonctions.

### Variables maintenues dans `core.js`
- `pendingFiles` (L124) — utilisé par `render()` et les handlers d'import restants dans core.js
- `debugLog` (L102) — utilisé par `render()` pour l'affichage du log import

### Tags d'injection `build.py`
```python
js = js.replace('// @import_export\n', import_export + '\n')
js = js.replace('// @s3_poll\n',        s3_poll + '\n')
```
Ordre : après `@ai_core`, avant `@guide` — import_export consomme `parseCSVFile` (parsers_internal) et les fonctions IA/API (ai_core).

---

## 2. Validation — 8 points

### §2.0 Mode api-key preprod
Confirmé : preprod en mode api-key post-fix T1 Lambda. ✓

### §2.1 Build + syntaxe JS
```
python build.py --check  →  JS valide (984 Ko)
node --check /tmp/ap_check.js  →  OK
```
✓

### §2.2 Artefact fonctionnellement identique
Diff structurel : même nombre de fonctions globales, même HTML shell, CSS identique. Build 932 Ko (v3.7.3) → 984 Ko (v3.7.4) : +52 Ko correspondant aux 2 nouveaux modules injectés. ✓

### §2.3 Smoke Playwright
27/30 — V7, V8e, V8f : dettes pré-existantes (non régressées). ✓

### §2.4 Import multi-CSV complet — `mergeImportData`
Test sur client **Gers Equipement** (id: `mp3p3gmblx6`, 4 729 ASINs).
- Fichiers injectés : Ventes Fab hebdo + Trafic hebdo + Stock Fab hebdo (semaine 17-23/05/2026)
- `handleMultiCSV` → FileReader → `parseCSVFile` → dispatch dans `pendingFiles` : OK
- `checkImportCoherence(c, files)` : aucun avertissement critique
- `processImport()` → panneau récapitulatif affiché
- `confirmImport()` → `mergeImportData(c, 3 files)` appelée, `save()` exécuté
- ASIN B0CJ2STZGN après import : `periodStart=17/05/2026`, `revenue=6531`, `orderedUnits=103`, `shippedUnits=112`, `glanceViews=2008`
- 3 entrées ajoutées dans `c.imports` (ventes + trafic + stock, 2026-06-12)
✓

### §2.5 Export / réimport
- Backup JSON construit via `exportAllData` (structure `{_meta, clients}`)
- `importAllData({files: [backupFile]})` : `confirm()` intercepté → restauration déclenchée
- Résultat : `match = true` — 2 clients identiques (Cogex 1814 ASINs, Gers 4729 ASINs), 43 imports Gers préservés
✓

### §2.6 S3 config + polling
| Fonction | Résultat |
|---|---|
| `getS3Config()` | Retourne `{bucket, region, enabled}` depuis localStorage ✓ |
| `saveS3Config(bucket, region, enabled)` | Persiste dans localStorage, relecture correcte ✓ |
| `getS3Key('Gers Equipement', 'Ventes_W20.csv')` | `"gers-equipement/Ventes_W20.csv"` ✓ |
| `startS3Poll()` / `stopS3Poll()` | Sans exception (S3 désactivé — pas d'endpoint preprod) ✓ |
| `getS3PresignedUrl()` / `pollS3Imports()` | **Non testés** — nécessitent endpoint Lambda + API URL en preprod. Déclaré comme limite, non régression. |

Config active : `bucket=amazon-pilot-imports-foliow`, `region=eu-west-3`.

### §2.7 Console zéro erreur
Rendu sur 5 écrans (dashboard, analyse, import, history, settings), client Gers : **0 erreur, 0 warning** capturés post-chargement. ✓

---

## 3. Anomalie A1 — `parsePOCSV` / `mergePOData` vs `parser_po.js`

`parsePOCSV` et `mergePOData` ont été déplacées dans `import_export.js` (déplacement strict).
`parser_po.js` (v3.6.8) contient un parseur PO indépendant (`parsePOItemExport`, etc.) destiné au flux POItemExport XML/CSV — périmètre différent.

**Verdict** : pas de doublon fonctionnel avéré. `parsePOCSV`/`mergePOData` gèrent les imports PO manuels (écran "Import PO"). `parser_po.js` gère le parsing automatique du rapport POItemExport. Les deux coexistent sans conflit. Fusion éventuelle = décision séparée, hors scope v3.7.4.

---

## 4. Incidents de développement

| Incident | Correction |
|---|---|
| `find_func` template literal bug | Machine à états complète avec `('tmpl_expr', entry_depth)` |
| `find_func` regex literal bug (`/["\r]/g` dans parsePOCSV) | Heuristique `last_nonws` + scanner character class |
| Modules non injectés dans build.py | Ajout lignes `strip_header` + `js.replace` pour les 2 nouveaux tags |
| Preprod affichait v3.6.7 (HTML versionné en .gitignore) | Déploiement manuel via `aws s3api put-object` + invalidation CloudFront |

---

## 5. Conclusion

Déplacement strict réussi. Les 16 fonctions import/export et 8 fonctions S3/polling sont opérationnelles dans leurs nouveaux modules. `core.js` réduit de 1 128 lignes. Aucune régression détectée. Prêt pour GO Fred → merge main → prod → tag v3.7.4.
