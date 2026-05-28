# Audit Dériveur — Libellés d'état non résorbés v3.6.8

**Date** : 2026-05-28  
**Branche** : staging  
**Commit de référence** : 34c471f  
**Auteur** : Claude Code + Fred Rochette

---

## Contexte

Panne "Dériveur" constatée sur la fiche client section "Bons de commande" :  
après chargement réussi d'un POItemExport (3158 POs uniques, badge ✓ Chargés,  
sous-comptes verts), le bandeau continuait d'afficher `"1 fichier POItemExport attendu"`.

Demande : patch immédiat + audit transversal de tous les libellés du type  
`attendu / manquant / non chargé / À importer / En attente` sur l'ensemble du code source.

---

## Patterns scannés

```
attendu | manquant | Manquant | non import | fichier manquant |
non chargé | Non chargé | À importer | En attente | à charger | A charger
```

---

## Fichiers couverts — audit EXHAUSTIF (18/18)

| Fichier | Taille | Occurrences trouvées |
|---|---|---|
| `src/core.js` | 549 Ko | 8 (voir détail ci-dessous) |
| `src/yoy.js` | 109 Ko | 2 (hors périmètre UI état) |
| `src/yoy_enquete.js` | 24 Ko | 0 |
| `src/parser_po.js` | 9 Ko | 1 (console.warn) |
| `src/parser_erp.js` | 13 Ko | 0 |
| `src/parser_vc.js` | 17 Ko | 0 |
| `src/buybox.js` | 46 Ko | 0 |
| `src/seo.js` | 106 Ko | 3 (voir détail) |
| `src/guide_asn.js` | 20 Ko | 0 |
| `src/smoke.js` | 16 Ko | 3 (tests seulement) |
| `src/yoy_ai.js` | 2 Ko | 0 |
| `src/templates/yoy_anomalies.js` | — | 0 |
| `src/templates/yoy_catalogue.js` | — | 0 |
| `src/templates/yoy_concentration.js` | — | 0 |
| `src/templates/yoy_conclusion.js` | — | 0 |
| `src/templates/yoy_marques.js` | — | 0 |
| `src/templates/yoy_performance.js` | — | 0 |
| `src/templates/yoy_top_mouvements.js` | — | 0 |
| `src/shell.html` | — | 0 |

---

## Détail des occurrences

### core.js — 1 BUG DÉRIVEUR (corrigé) + 7 OK

| Ligne | Occurrence | Verdict | Action |
|---|---|---|---|
| ~3973 | `'N fichier(s) POItemExport attendu(s)'` affiché inconditionnellement | ❌ **BUG DÉRIVEUR** | ✅ **Corrigé** — conditionné sur `_poItemExportCount > 0` |
| ~3865 | Pill `'En attente'` section 2 hebdo | ✅ OK | Basé sur `pendingFiles` (session drop zone) — s'efface à chaque dépôt, pas un état persisté |
| ~3897 | `statusText = 'En attente'` grille fichiers hebdo | ✅ OK | Idem — session state uniquement |
| ~4012 | `'non importé (fichier manquant ?)'` bilan VCs | ✅ OK | Conditionné sur `vcInPos[vendorCode]` calculé depuis `c.pos` réel |
| ~2038 | `'S-N manquante'` freshness banner | ✅ OK | Conditionné sur `freshness.weeksBehind` calculé depuis données importées |
| ~1989 | `'Ventes non chargées'` carte client | ✅ OK | Conditionné sur `annCA === null` depuis données réelles |
| ~3785 | `'À charger'` grille hist Fab+Appro | ✅ OK | Conditionné sur présence/absence de données `c.brands` |
| ~6309 | `'N-2 manquant'` dans `getDataFreshness()` | ✅ OK | Calculé depuis `hasAnnualN2` sur données réelles |

### seo.js — 3 occurrences, aucun Dériveur

| Ligne | Occurrence | Verdict |
|---|---|---|
| ~304–314 | `'Titre attendu :'`, `'Bullet N attendu :'` | ✅ OK — Texte de prompt audit SEO (instructions lisibles pour audit manuel), pas un libellé UI d'état |
| ~678 | `'⏳ En attente'` scripts automation | ✅ OK — Conditionné sur `vcSt === 'success'` (état réel d'exécution) |

### smoke.js — 3 occurrences, aucun Dériveur

| Ligne | Occurrence | Verdict |
|---|---|---|
| ~106 | `'Sections manquantes'` | ✅ OK — Message de résultat smoke test, pas UI utilisateur |
| ~138 | `'CA 2024 : non importé (optionnel)'` | ✅ OK — Message de calibration smoke test |
| ~147 | `'CA 2025 : non importé (optionnel)'` | ✅ OK — Message de calibration smoke test |

### parser_po.js — 1 occurrence, aucun Dériveur

| Ligne | Occurrence | Verdict |
|---|---|---|
| ~122 | `console.warn('[parser_po] Colonne manquante: ...')` | ✅ OK — `console.warn()` uniquement, aucun rendu UI |

---

## Sections livrées en anticipation de v3.6.9

Les sections suivantes étaient explicitement reportées en v3.6.9 dans le brief (section 4 — limites négatives), mais ont été livrées en v3.6.8 lors de l'implémentation.

**Décision Fred (2026-05-28)** : on ne retire pas — le travail est bon, enregistré comme "anticipation v3.6.9 livrée en v3.6.8". Poursuite de la qualification v3.6.8 telle quelle.

| Section | Scope brief | Décision |
|---|---|---|
| Top mouvements ASIN (perdants + gagnants, dim11) | v3.6.9 | ✅ Anticipée en v3.6.8 — à biffer du brief v3.6.9 |
| Mon diagnostic (narrative pré-rédigée) | v3.6.9 | ✅ Anticipée en v3.6.8 — à biffer du brief v3.6.9 |
| Plan d'action 3 priorités complet (P2+P3 en plus de P1) | v3.6.9 (P1 partielle seulement) | ✅ Anticipée en v3.6.8 — à biffer du brief v3.6.9 |
| Conclusion générale narrative | v3.6.9 | ✅ Anticipée en v3.6.8 — à biffer du brief v3.6.9 |

**Note pour le brief v3.6.9** : aucun paywall back-end ni toggle Vue Free/Pro implémenté. Ces sections sont visibles en Vue Free. À recadrer dans v3.6.9 pour ne pas redoubler le travail et cibler uniquement les éléments réellement manquants (toggle freemium, export Word, narrative IA enrichie).

---

## Écart corrigé en v3.6.8d — Section Marques (sous-livré)

Le brief §3.5 prévoyait 6 colonnes pour la Section Marques. Livré initialement : 4 colonnes.

| Colonne | Brief §3.5 | Livré v3.6.8 (initial) | Livré v3.6.8d |
|---|---|---|---|
| Marque | ✅ | ✅ | ✅ |
| CA/j réf. | ✅ | ✅ (col 3) | ✅ (col 2) |
| Part réf. (%) | ✅ | ❌ manquante | ✅ ajoutée |
| CA/j A | ✅ | ✅ (col 2) | ✅ (col 4) |
| Part A (%) | ✅ | ❌ manquante | ✅ ajoutée |
| Variation €/j | ✅ (obligatoire) | ❌ livré en % seulement | ✅ `yoyFmtEurSigned` — % en secondaire |

Les `shareRef` et `shareA` étaient déjà calculés dans `dim10.topBrands` mais non rendus dans la table. Patch : ajout des 2 colonnes Part + rebasement Variation €/j comme colonne principale (% conservé en sous-texte 9px).

---

## Verdict final

**1 seul vrai Dériveur identifié et corrigé** (commit `34c471f`).

Tous les autres libellés du type `attendu / manquant / En attente` sont soit :
- Conditionnés sur l'absence effective de données depuis `c` (objet client persisté en IDB)
- Des messages de session (drop zone — s'effacent naturellement)
- Des messages de tests/console, non visibles en UI

**Risque résiduel** : nul sur le périmètre scanné. Audit exhaustif — 18/18 fichiers source couverts.

---

## Patch appliqué

**Fichier** : `src/core.js` — section 3 "Bons de commande"

```
Avant (toujours affiché) :
  "📦 Pays détectés : FR — 1 fichier POItemExport attendu"

Après (conditionnel) :
  Si _poItemExportCount > 0 :
    "📦 Pays détectés : FR — 1/1 fichier chargé — 2/2 sous-comptes couverts"  (vert)
  Si _poItemExportCount = 0 :
    "📦 Pays détectés : FR — 1 fichier POItemExport attendu"
```

Variables clés :
- `_poItemExportCount` — hoisted avant le bloc `boAccts`, calculé depuis `c.pos` persisté
- `_boVCCoveredCount` — sous-comptes BO avec ≥ 1 PO POItemExport
- `_boMarketsCoveredN` — marchés couverts (cohérent avec "1 fichier/marketplace")
