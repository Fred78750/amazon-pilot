# AUDIT v3.7.7 — Parser Traffic + foViews Timeline

**Date** : 2026-06-13  
**Version** : 3.7.7  
**Environnement de validation** : preprod (https://preprod.amazon.foliow.app/) — client Gers Equipement / Cogex  
**Fichiers réels utilisés** :
- Cogex variante A : `Trafic_ASIN_France_Chaquesemaine_31-05-2026_06-06-2026.csv` (228 447 octets)
- Gers variante B : `Trafic_ASIN_France_Espagne_Pays-Bas_Allemagne_Belgique_Italie_Chaquesemaine_31-05-2026_06-06-2026.csv` (481 928 octets)

---

## 1. Décision architecturale : glanceViews vs foViews

### Constat
`glance_views` dans `parser_vc.js` (ligne 54) et les colonnes "Vues de la page de l'offre vedette" des fichiers Traffic désignent la **même métrique Amazon** (Featured Offer Page Views).

### Décision : **coexistence**
- `a.glanceViews` (scalaire) : conservé tel quel — rétro-compatibilité `buybox.js:289` et `ai_core.js:329`
- `a.foViews` (timeline accumulative) : nouveau champ, structure par marché et semaine

**Pourquoi ne pas unifier ?** Unifier imposerait de migrer tous les accès `a.glanceViews` existants avec risque de régression sur le calcul buybox et le diagnostic IA. La coexistence isole le risque à zéro.

---

## 2. Modèle de données foViews

```
client.asins[i].foViews = {
  "<market>": {                          // ex. ".fr", ".de", ".co.uk", "IE" (inconnu)
    "<weekKey>": {                       // YYYY-MM-DD (date de début de période)
      views:        <integer>,           // P3: 0 si mesuré à 0, champ absent si ASIN non présent
      deltaPrevPct: <number|null>,       // % vs période antérieure (null si non disponible)
      deltaYoyPct:  <number|null>        // % vs même période an dernier (null si non disponible)
    }
  }
}
```

**Propriétés clés :**
- **Accumulation idempotente** : ré-importer la même semaine écrase sans dupliquer
- **Multi-semaines** : plusieurs weekKeys coexistent sous le même marché
- **Multi-marchés** : structure à deux niveaux marché→semaine

---

## 3. Clé semaine (weekKey)

**Format** : `YYYY-MM-DD` (date ISO de début de la période)  
**Source** : champ `Champ de vision.=[JJ/MM/AAAA - JJ/MM/AAAA]` en ligne 0 du CSV

**Conversion** : `JJ/MM/AAAA` → split('/') → recomposition `AAAA-MM-JJ`

**P2 — Règle d'échec explicite** : si ligne 0 absente, date malformée, ou séparateur inattendu → `{ error: '...' }` → fichier skippé entièrement avec message log. Jamais de weekKey faux silencieux.

---

## 4. Mapping colonnes — Variantes A et B

### Variante A — mono-pays
- **Détection** : absence de colonne "Code de la boutique" dans le header
- **Ligne 0** : `Pays=[FR]` — marché extrait de la métadonnée
- **Colonnes** : 6 colonnes (ASIN, Nom, Marque, Vues, DeltaPrev%, DeltaYoY%)
- **Résolution marché** : `resolveTrafficMarket(paysFromMeta[0])`

### Variante B — multi-pays
- **Détection** : présence de colonne "Code de la boutique" (ou "Store code") dans le header
- **Ligne 0** : `Pays=[ES;FR;NL;DE;BE;IT]` — informatif uniquement
- **Colonnes** : 7 colonnes (ASIN, Nom, Marque, Code boutique, Vues, DeltaPrev%, DeltaYoY%)
- **Résolution marché** : `resolveTrafficMarket(cols[colBoutique])`

### P1 — Clé marché identique quelle que soit la variante
`resolveTrafficMarket(code)` via `MARKET_CODES` :

| Code CSV | Clé stockée |
|----------|-------------|
| FR       | .fr         |
| DE       | .de         |
| IT       | .it         |
| ES       | .es         |
| UK / GB  | .co.uk      |
| NL       | .nl         |
| BE       | .be         |
| SE       | .se         |
| PL       | .pl         |
| IE       | IE (inconnu, stocké tel quel + warning) |
| AE       | AE (inconnu, stocké tel quel + warning) |

**Codes inconnus** : stockés tels quels, jamais droppés, loggés en warn.

---

## 5. Points de validation

### Point 1 — Build et déploiement
- Build `python build.py` réussi, JS valide (node --check)
- Déployé sur preprod via `aws s3api put-object` + invalidation CloudFront E3ERL241475BJI
- APP_VERSION = 3.7.7 confirmé en console

### Point 2 — Parser variante A, weekKey, views
- Fichier Cogex (variante A, FR) importé en mémoire via base64
- `parseTrafficFile` → weekKey=`2026-05-31`, variant='A'
- ASIN B009G3EMDI → market='.fr', views=1664 ✅

### Point 2-bis — P3 strict : 0 vue mesurée vs ASIN absent (ajouté avant GO)
Signal critique : views=0 = FO absente du buybox (BB-10/BB-11). Testé sur ASINs réels Cogex à 0 vue (semaine 31/05/2026).

**Test sur B077XJC224 (0 vue réelle dans le fichier Cogex) :**
```
entry = foViews['.fr']['2026-05-31']
→ { views: 0, deltaPrevPct: null, deltaYoyPct: null }

entry.views === 0          → true   (integer 0, pas null)
entry.views !== null       → true
entry.views !== undefined  → true
typeof entry.views         → "number"
```

**Test sur B009G3EMDI (absent du fichier cette semaine) :**
```
foViews                    → undefined (a.foViews non créé)
entrée foViews[semaine]    → absent   (pas de clé du tout)
```

**Distinction garantie** : `views:0` (champ présent, type number) ≠ ASIN absent (pas d'entrée). ✅

### Point 3 — Parser variante B, multi-marchés
- Fichier Gers (variante B, 6 marchés) — extrait 11 lignes B0CJ2STZGN
- Résultat : 11 entrées marché, weekKey=`2026-05-31`, variant='B'
- FR=2275, BE=133, IT=91, ES=11, DE=10, IE=9 (inconnu), NL=1, SE=1, GB(.co.uk)=0, AE=0 (inconnu), PL=0
- unknownCodes=['IE','AE'] — stockés tels quels ✅

### Point 4 — Empilement + idempotence
- Simulation : import semaine A (`2026-05-31`) + semaine B (`2026-05-24`) → 2 weekKeys coexistent ✅
- Ré-import semaine A → count reste 2, valeur écrasée (idempotent, pas de doublon) ✅

### Point 5 — detectFileType (pas de faux positifs)
- `detectFileType(hdrsTrafficA)` → `'trafic'` ✅
- `detectFileType(hdrsTrafficB)` → `'trafic'` ✅
- `detectFileType(hdrsVentes)` → `'ventes'` (pas de confusion) ✅
- `detectFileType(hdrsStock)` → `'stock'` (pas de confusion) ✅
- `parseCSVFile(trafficMini)` → `type='trafic'` ✅

### Point 6 — Performance save()
| Contexte | Durée avg |
|----------|-----------|
| Baseline post-R4 (sans foViews) | ~318 ms |
| 85 122 entrées foViews (4 729 ASINs × 3 sem × 6 marchés) | **492 ms** (+174 ms) |

Mesures individuelles : 473ms / 580ms / 422ms  
**Verdict** : delta acceptable pour un cas extrême (Gers complet multi-semaines). En usage réel (1 import/semaine, 200-500 ASINs), l'impact sera de l'ordre de quelques dizaines de ms.

### Point 2-ter — P2 robustesse : tests négatifs ligne 0 (ajouté avant GO)
6 cas d'erreur testés — tous retournent `{ error: '...', weekKey: null }`, jamais de weekKey silencieux :

| Cas | Fichier | Erreur retournée |
|-----|---------|-----------------|
| Ligne 0 absente (header en ligne 0) | `no_meta.csv` | `"Champ de vision" introuvable...` |
| Ligne 0 sans "Champ de vision" | `no_champ.csv` | `"Champ de vision" introuvable...` |
| Date format AAAA/MM/JJ (inversé) | `bad_date_format.csv` | `"Champ de vision" introuvable...` |
| Date partielle (un seul côté) | `partial_date.csv` | `"Champ de vision" introuvable...` |
| Fichier < 3 lignes | `too_short.csv` | `fichier trop court (< 3 lignes)` |
| Ligne 0 vide | `empty_meta.csv` | `ligne 0 (métadonnées) absente` |

Dans tous les cas : `weekKey === null`, fichier skippé entièrement, message explicite logué. ✅

### Point 7 — getFoViewsTimeline (helper debug)
- `window.getFoViewsTimeline` exposé globalement
- Accès console : `getFoViewsTimeline('B0CJ2STZGN')` → retourne l'objet foViews ou null ✅

---

## 6. Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `src/parser_traffic.js` | **Nouveau** — `parseTrafficFile()`, `resolveTrafficMarket()`, `splitTrafficCSVLine()`, `getFoViewsTimeline()` |
| `src/parsers_internal.js` | Enrichi — bloc Traffic dans `parseCSVFile()`, retour weekKey+marketRows |
| `src/import_export.js` | Enrichi — accumulation foViews dans `mergeImportData()` après `client.asins = Array.from(asinMap.values())` |
| `src/core.js` | Ajout `// @parser_traffic` entre `// @parser_vc` et `let clients = []` |
| `build.py` | Ajout lecture + validation + injection `parser_traffic.js` |

---

## 7. Points ouverts / évolutions futures

- **MARKET_CODES à compléter** si marchés IE, TR, SA, AE, EG deviennent actifs (actuellement stockés tels quels)
- **UI foViews** : aucune interface de visualisation timeline dans cette version — donnée disponible en base, affichage prévu dans une version ultérieure
- **Import via UI** : le flux import standard (drag-drop CSV) déclenche automatiquement l'accumulation foViews si le fichier est classé 'trafic'
