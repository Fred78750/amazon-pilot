# AUDIT v3.6.8.9 — Refactoring SSOT Fraîcheur

**Date** : 29 mai 2026  
**Branche** : staging → preprod → main  
**Scope décidé** : hotfix Sundefined + POs + refactoring SSOT fraîcheur  
**Commit a** : `aecd4e5` | **b** : `246b7f8` | **c** : `5733ec0` | **d** : `f38f5a6` | **e** : `59fc7ba` | **f** : `a4cbb3c`

---

## Mapping scope-livré vs scope-décidé

| Item décidé | Commit | Livré | Écart |
|---|---|---|---|
| (a) Hotfix Sundefined + POs day-based + label "Libre" | `aecd4e5` | ✅ | — |
| (b) renderDashboard/renderImport consomme getEnrichedFreshness | `246b7f8` | ✅ | — |
| (c) Fix export backup ligne 10756 (source date correcte) | `5733ec0` | ✅ | — |
| (d) Helper daysSinceDate partagé (5 impl → 1) | `f38f5a6` | ✅ | — |
| (e) YTD intégré dans getEnrichedFreshness (suppression doublon) | `59fc7ba` | ✅ | — |
| (f) Commentaire fcStatus intentionnel + règles SSOT | `a4cbb3c` + `fb7b278` | ✅ | — |

**Aucun débordement. Aucun sous-livré.**

---

## Détail technique des changements

### Commit a — Hotfix

**Problème** : `getEnrichedFreshness` retournait `pos: { weeksBehind: posWB }` avec `posWB = 4`
→ `weekStatus(4) = 'missing'` alors que 623 POs chargés depuis 31j.
Et `r.lastWeek` manquant dans tous les types → `'S' + undefined = 'Sundefined'` × 6.

**Fix** :
- `posStatus(days)` : ok < 90j, stale < 180j, missing sinon (sémantique libre)
- `pos` entry : `weeksBehind: null`, pas de `targetWeek`, pas de `lastWeek`
- `ventes/trafic/stock` : propagation `lastWeek: f?.ventes.lastWeek ?? null`
- `previsions` : `lastWeek: getISOWeek(new Date(fcDates[0]))`
- `renderAgent` : branches spécifiques pos/ppm + guard `|| '?'`

### Commit b — SSOT renderImport

`_efImport = getEnrichedFreshness(c)` appelé une fois dans la section fiche client.
`lastPPMStr` ← `ef.ppm.lastDate`, `lastFCStr` ← `ef.previsions.lastDate`.
Supprime les 2 `Object.values(...).sort(...)` redondants.

### Commit c — Export backup

Avant : `lastImport: c.asins?.[0]?.periodEnd` (source incorrecte — peut être null ou date ancienne).
Après : dernier import ventes depuis `c.imports[]` (même SSOT que `getDataFreshness`).

### Commit d — Helper daysSinceDate

Nouvelle fonction `daysSinceDate(isoDate)` près de `getISOWeek`. Remplace 5 implémentations ad hoc de `Math.floor((Date.now() - new Date(x)) / 86400000)`.
Dans `renderActionsPlanLundi` : `daysSinceImport` → `freshness.ventes.daysSince` (déjà calculé par `getDataFreshness`).

### Commit e — YTD SSOT

Avant : `renderFreshnessBanner` lisait `c.ytdData.ventes.importedAt` (objet data).
Après : `getEnrichedFreshness` retourne `ytd: { days, weeksBehind, status }` depuis `c.imports` (même SSOT).
Filtre corrigé : `periodType='ytd' AND type='ventes'` (était mal typé).

### Commit f — Règles métier

Commentaire dans `fcStatus` : tolérance bimensuelle intentionnelle (Amazon édite Forecast tous les 15j).
Règles inscrites dans `CLAUDE_CODE_CONTEXT.md` : SSOT FRAÎCHEUR, FACTORISATION GÉNÉRALE, Règles métier capitalisées.

---

## Anti-régression 4 blocs — OBLIGATOIRE avant merge main

### Bloc 1 — Smoke tests in-app

| Test | Attendu | Résultat |
|---|---|---|
| APP_VERSION = '3.6.8.9' | ✅ visible dans nav | ⬜ |
| `typeof getEnrichedFreshness === 'function'` | true | ⬜ |
| `typeof daysSinceDate === 'function'` | true | ⬜ |
| `daysSinceDate('2026-01-01') > 0` | entier positif | ⬜ |
| `getEnrichedFreshness(c).pos.weeksBehind === null` | null | ⬜ |
| `getEnrichedFreshness(c).pos.status` | 'ok' si < 90j | ⬜ |
| Console DevTools — zéro erreur JS rouge | 0 erreur | ⬜ |

### Bloc 2 — Comparaison visuelle écrans

| Écran | Ce qui doit apparaître | Résultat |
|---|---|---|
| **Agent Import** — Bons de commande | ✓ À jour · Importés il y a 31j (pas "Sundefined") | ⬜ |
| **Agent Import** — freq badge BdC | "Libre" (pas "Hebdo") | ⬜ |
| **Agent Import** — Ventes, Trafic, Stock | Semaine correcte (S? couverte — pas Sundefined) | ⬜ |
| **Import données** — fiche PPM | Dernier import : même date qu'Agent Import | ⬜ |
| **Import données** — fiche Prévisions | Idem | ⬜ |
| **Tableau de bord** — bandeau fraîcheur | Inchangé (ventes/trafic/stock seulement) | ⬜ |
| **Plan lundi** | Inchangé (actions correctes) | ⬜ |

### Bloc 3 — Tests parsers / imports

| Test | Attendu | Résultat |
|---|---|---|
| Import POItemExport CSV (Cogex) | Compteurs POs inchangés, badge ✓ Chargés | ⬜ |
| Section Enquête — 3 catégories présentes | A1/A2/CREUSER/Autres affichées | ⬜ |

### Bloc 4 — IDB backward compat

| Test | Attendu | Résultat |
|---|---|---|
| Rechargement page Cogex | Données chargées, aucun reset IDB | ⬜ |
| `c.pos.length` inchangé | 623 (ou valeur attendue) | ⬜ |
| `getEnrichedFreshness(c).ytd` | `{ days: null, status: 'missing' }` si pas YTD | ⬜ |

---

## Performance

| Métrique | Cible | Résultat |
|---|---|---|
| `getEnrichedFreshness` appels par render | ≤ 2 (renderFreshnessBanner + renderImport) | ⬜ |
| Temps chargement Analyse comparée Cogex | < 3s | ⬜ |

---

## Anomalies résiduelles connues

Aucune identifiée. Les 11 zones de fraîcheur auditées sont maintenant alignées sur 2 sources de vérité (`getDataFreshness` + `getEnrichedFreshness`).
