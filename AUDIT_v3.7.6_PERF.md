# AUDIT v3.7.6 — Performance sous charge
**Date :** 12 juin 2026  
**Baseline :** v3.7.5 (core.js 5 368 L, artefact ~1 093 Ko)  
**Environnement :** preprod.amazon.foliow.app — Chrome 136, Win11, machine dev (CPU natif)  
**Méthode :** Performance API (`performance.now()`) injectée via Claude in Chrome. Chaque mesure répétée 3× (médiane retenue sauf mention).  
**Données :** Cogex Outillage (1 814 ASINs), Gers Équipement — IDB preprod partiel = **4 729 ASINs**, Gers réel prod = **12 046 ASINs** (voir §7). Les mesures portent sur le dataset IDB disponible ; les extrapolations ciblent le cas de charge réel 12 046.

---

## 1. Tableau des mesures

### A1 — Démarrage app (warm cache, Gers)

| Composant | Valeur | Notes |
|---|---|---|
| Navigation réseau (warm cache) | **483 ms** | CloudFront → browser |
| Parse + exec artefact 1 Mo | **31 ms** | parse=25ms, exec=6ms |
| `openDB()` | **1 ms** | DB déjà initialisée → immédiat |
| `migrateXMLTitles(clients)` | **1 ms** | 0 catalogueXML Gers → no-op |
| Premier `render()` Gers | **1 955 ms** | dominé par calcBuyBoxAlerts ×2 |
| **Total perçu (warm cache)** | **~2 470 ms** | dont 1 955ms gel UI post-load |

### A2 — Parsing imports

Non mesuré : fichier CSV VC Gers multi-pays non disponible en session d'audit. À mesurer en session dédiée avec fichier réel.

### A3 — Render listes (Gers, warm JIT)

| Fonction | Médiane | Notes |
|---|---|---|
| `renderAsins(c)` — génération HTML | **~27 ms** | 50 lignes (pagination) — R2=41ms, R3=13ms |
| `renderContent(c)` | **~20 ms** | enveloppe renderAsins |
| `renderNav(c)` | **~1 931 ms** | dominé par calcBuyBoxAlerts ×2 |
| `render()` complet (Nav+Content) | **1 955 ms** | gel UI à chaque navigation |

### A4 — IDB

| Opération | Médiane | Notes |
|---|---|---|
| `load()` (IDB read all clients) | **20 ms** | 2 clients, ~23 MB |
| `JSON.stringify` Gers seul | **94 ms** | 13 816 Ko |
| `JSON.stringify` tous clients | **~100 ms** | 23 042 Ko |
| `save()` end-to-end (3 runs) | **405 ms** | R1=377, R2=415, R3=405 |

**Comportement `save()` :** clear + rewrite TOUS les clients à chaque appel (ligne 183-186 idb.js), même pour modifier un seul champ. Sérialise 23 MB. Appelle aussi `JSON.stringify(clients)` en fin (ligne 192) uniquement pour le log — redondant (~100ms).

### A5 — Conditions dégradées (estimation CPU 4×)

Throttling DevTools non activable depuis JS. Estimation basée sur mesures native :

| Opération | Native | ×4 CPU estimé |
|---|---|---|
| `calcBuyBoxAlerts` Gers (×2/render) | ~2 248 ms | **~9 000 ms** |
| `render()` complet Gers | ~1 955 ms | **~7 800 ms** |
| `save()` | 405 ms | **~1 600 ms** |
| Chargement artefact (Fast 3G ~1.5 Mbps) | — | **~5 900 ms** réseau seul |

### A6 — Mémoire (Gers chargé)

| Mesure | Valeur |
|---|---|
| Heap JS après chargement Gers | **33 MB** |
| Heap après 10 navigations simulées | **35 MB** |
| Delta (fuite ?) | **+2 MB** (non significatif) |
| Limite heap Chrome | 4 192 MB |
| Occupation | **< 1 %** |

Pas de fuite mémoire détectée sur 10 navigations.

### A7 — Courbe de scaling (calcBuyBoxAlerts)

| Client | ASINs | Source | `calcBuyBoxAlerts` ×1 | `render()` total (~×2 + overhead) |
|---|---|---|---|---|
| Cogex Outillage | 1 814 | **mesuré** | **124 ms** | ~270 ms |
| Gers IDB preprod | 4 729 | **mesuré** | **1 124 ms** | ~1 955 ms |
| **Gers réel** | **12 046** | **extrapolé** | **~8 000 ms** | **~16 000 ms** |
| Client 50k | 50 000 | extrapolé | ~196 000 ms | ~400 000 ms |

**Exposant empirique : n^2.34** — calculé sur les 2 points mesurés (124ms à 1 814 ASINs → 1 124ms à 4 729 ASINs).  
**Gers réel = 12 046 ASINs** (prod) ; IDB preprod = 4 729 (sous-ensemble). Toutes les mesures §2-G1/G2 portent sur 4 729 ASINs. L'extrapolation à 12 046 est le **cas de charge cible** pour la Phase C.

---

## 2. Top 4 goulots

### G1 — `calcBuyBoxAlerts` appelé 2× par `render()` — coût total ~2 004ms (4 729 ASINs mesurés)

**Origine :**  
`renderNav()` appelle `calcBuyBoxAlerts(c)` directement **ET** `NAV.find(n => n.id === 'buybox').badgeFn(c)` appelle `calcBuyBoxAlerts(c).critical.length` — même calcul, deux fois.

```js
// buybox.js — ligne ~30
{ id: 'buybox', badgeFn: (c) => calcBuyBoxAlerts(c).critical.length }
//              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// calcBuyBoxAlerts(c) déjà appelé juste avant dans renderNav()
```

**Mesures (IDB preprod, 4 729 ASINs) :**
- `calcBuyBoxAlerts` directe : 1 124ms médiane
- `buybox.badgeFn` : 880ms médiane
- Total par render : **~2 004ms**

**Courbe complète (×2 pour le double appel) :**

| ASINs | `calcBuyBoxAlerts` ×2 | Source |
|---|---|---|
| 1 814 (Cogex) | ~248 ms | mesuré |
| 4 729 (Gers IDB) | ~2 004 ms | mesuré |
| **12 046 (Gers réel)** | **~16 000 ms** | extrapolé |
| 50 000 | ~400 000 ms | extrapolé |

---

### G2 — O(n²·³) dans `calcBuyBoxAlerts` — boucle avec reduce interne

**Origine (buybox.js ligne 68) :**  
```js
const entry = {
  ...
  segment: calcSegment(a, c.asins.reduce((s,x) => s+(getRevenue(x,c)||0), 0), c),
  //                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                      O(n) exécuté pour CHAQUE ASIN → O(n²) global
  ...
};
```

Pour 4 729 ASINs : 4 729 réductions × ~4 729 itérations = **~22 millions d'opérations** juste pour le `totalRevenue` de `calcSegment`.

S'ajoute : `calcAppro(a, c, null, null)` (fonction non triviale, ~60 lignes) appelé per-ASIN.

**Impact :** Cogex 124ms, Gers IDB 1 124ms, exposant ~2.34. À 12k ASINs (Gers réel) : **~8 000ms par appel** (×2 = ~16 000ms par render).

---

### G3 — `save()` full-serialize tous les clients à chaque écriture — 405ms

**Origine (idb.js ligne 183-192) :**  
```js
store.clear();                          // efface TOUT
for (const c of clients) store.put(c); // réécrit TOUT
// puis...
const json = JSON.stringify(clients);  // JSON.stringify inutile (juste pour le log)
```

Chaque modification (import CSV, sauvegarde note, correction prix) déclenche un rewrite de 23 MB en IDB + un `JSON.stringify(clients)` redondant.

**Mesures :** 377ms / 415ms / 405ms → **médiane 405ms** (2 clients, 23 042 Ko).

---

### G4 — `render()` synchrone bloque le thread UI à chaque navigation

**Origine :** `render()` → `renderNav()` + `renderContent()` tout en synchrone. Pas d'invalidation partielle, pas de cache entre navigations. Chaque `go(s)` appelle `render()` → 1 955ms de gel UI sur Gers IDB (4 729 ASINs).

**Impact utilisateur :**
- Gers IDB preprod (4 729 ASINs) : ~2s de freeze complet à chaque clic
- Gers réel prod (12 046 ASINs, extrapolé) : **~16s de freeze complet à chaque clic**
- ×4 CPU (machine moyenne) : **~64s** de gel sur Gers réel

---

## 3. Recommandations (arbitrage Fred — Phase C)

Classement : **Impact mesuré / Effort estimé / Risque**

| # | Fix | Gain estimé | Effort | Risque |
|---|---|---|---|---|
| R1 | **Partager le résultat `calcBuyBoxAlerts` dans `render()`** — calculer 1× et passer le résultat à `renderNav()` + `badgeFn` | −1 124ms par render (−50% immédiat) | Trivial (2 lignes) | Nul |
| R2 | **Pre-compute `totalRevenue` avant la boucle** dans `calcBuyBoxAlerts` | ×2.6→×9 speedup (O(n²)→O(n)) — Gers 1 124ms → ~120ms estimé | Trivial (1 ligne hors boucle) | Nul |
| R3 | **`save()` dirty-flag** — ne sauvegarder que le client modifié, pas `clear`+rewrite tous | −300ms par action utilisateur | Moyen (refacto idb.js) | Faible |
| R4 | **Supprimer `JSON.stringify(clients)` ligne 192 `save()`** — redondant, juste pour le log | −~100ms par save() | Trivial | Nul |
| R5 | **Invalider `calcBuyBoxAlerts` sur changement de données** — cache client-level, invalider seulement à import/modif | −1 955ms sur navigations sans modif | Moyen | Faible |

**Gains cumulatifs R1+R2 :**

| Dataset | Avant (mesuré/extrapolé) | Après R1+R2 estimé | Gain |
|---|---|---|---|
| Cogex 1 814 | ~270 ms | ~30 ms | ×9 |
| Gers IDB 4 729 | ~1 955 ms | ~50 ms | ×39 |
| Gers réel 12 046 | **~16 000 ms** | **~130 ms** | **×123** |

R1 élimine l'appel double. R2 corrige l'O(n²) → O(n) — `calcBuyBoxAlerts` revient à un coût linéaire (~proportionnel à Cogex).

---

## 4. Protocole de reproductibilité

Pour rejouer les mesures à l'identique :

```
1. Ouvrir preprod.amazon.foliow.app avec Claude in Chrome connecté
2. Sélectionner client Gers Équipement (cl().name === 'Gers Équipement')
3. Exécuter les snippets JS via javascript_tool (voir session transcript)
4. Répéter 3× chaque mesure, retenir la médiane
5. Conditions : Chrome version 136+, onglet seul, pas de throttling DevTools
6. Baseline : APP_VERSION dans la page = v3.7.5
```

---

## 5. Garanties de l'audit

- ✅ Aucune modification du code prod
- ✅ Aucune pollution des données clients (save() mesuré sur données déjà en mémoire)
- ✅ Instrumentation temporaire (snippets JS injectés, non committés)
- ✅ Résultats reproductibles (protocole §4)

---

## 6. Bilan

| Axe | Statut | Goulot principal |
|---|---|---|
| A1 Démarrage | ✅ mesuré | render() post-load = 1 955ms |
| A2 Import CSV | ⚠ non mesuré | fichier Gers absent |
| A3 Render listes | ✅ mesuré | renderNav = 1 931ms (renderAsins = 27ms) |
| A4 IDB | ✅ mesuré | save() = 405ms (full-rewrite 23 MB) |
| A5 Throttled | ⚠ estimé ×4 | render ×4 = ~7 800ms |
| A6 Mémoire | ✅ mesuré | 33MB, pas de fuite |
| A7 Scaling | ✅ mesuré | exposant n^2.34 — Gers réel 12k → ~16s/render (extrapolé) |

---

## 7. Dataset IDB preprod — sous-ensemble

**Gers réel (prod) :** 12 046 ASINs  
**Gers IDB preprod :** `cl().asins.length === 4 729` (sous-ensemble chargé dans la DB de test)

Les mesures §1-§2 ont été réalisées sur 4 729 ASINs (le seul dataset disponible en preprod). Toutes les valeurs "12k" du rapport sont des extrapolations via la courbe n^2.34 calibrée sur les 2 points mesurés (1 814 et 4 729 ASINs). L'urgence des fixes R1+R2 est dimensionnée par ces extrapolations : **~16s de gel par navigation sur le client réel**.
