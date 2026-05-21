# BRIEF CLAUDE CODE — v3.6.3

**Sujet :** Buy Box Phase 1 — Items (c) Causes en colonne + (d) Statuts `fragile`/`recovered`
**Version cible :** v3.6.3 (livrable `amazon-pilot-v3.6.3.html`)
**Base de travail :** v3.6.2 (commit `01656bc` sur `main`)
**Branche de travail :** `staging` → `recette` → `preprod` → `main`
**Estimation :** 1,5 session Claude Code (validée par Claude Code en clarif du 20 mai)
**Auteur du brief :** Claude Orchestrateur — 21 mai 2026

---

## 1. CE QUE TU NE FAIS PAS (limites négatives — à lire en premier)

- ❌ Pas d'item (a) "Croisement défauts livraison × ASIN" — reporté en v3.12 (bloqué : pas de champ ASIN dans CSV Delivery Defects)
- ❌ Pas d'item (b) "Filtres cycle de vie Phase 1" — bloqué tant que `codeVie` n'est pas joint à `c.asins` (chantier Référentiel ERP préalable, non programmé)
- ❌ Pas de modification de `calcBuyBoxAlerts` (la fonction calcule déjà tout ce qu'il faut, on s'y branche sans la toucher)
- ❌ Pas de modification de la structure des entrées retournées par `calcBuyBoxAlerts` (le champ `cause` est déjà présent, on l'affiche)
- ❌ Pas d'ajout de nouvelles causes au-delà des 5 existantes (`suppression`, `po_unconfirmed`, `stock`, `prix_3p`, `surveillance`, `ok`)
- ❌ Pas de scraping ou import de données externes (prix concurrent réel, etc.) — la cause `prix_3p` reste une inférence sur `retailPct < 80 && stock OK`
- ❌ Pas de touche au header v3.6.2 ni au moteur de recherche
- ❌ Pas de refacto archi (la dette technique est acceptée jusqu'à commercialisation)
- ❌ Pas de `oninput` dans la topbar (rappel pattern d'erreur identifié v3.6.2, fix `665d4cb`)
- ❌ Pas de modification du Phase 2 (`renderBuyBoxCase`) — seul Phase 1 (`renderBuyBox`) est concerné

---

## 2. CONTEXTE STRATÉGIQUE (pour comprendre l'enjeu de ce mini-chantier)

v3.6.3 est un **prérequis démo commerciale**, pas un chantier de valeur autonome. La démo cible Amazon Pilot est une convergence YoY ↔ Buy Box que le KAM joue devant un directeur Co/COO/CEO. Pendant que le rapport YoY déroule un constat, la rubrique Buy Box doit converger automatiquement vers les ASINs en difficulté **avec une lisibilité immédiate** :

- L'item (c) rend visible **pourquoi** un ASIN est en alerte (la cause) — sans clic supplémentaire
- L'item (d) rend visible **l'évolution dans le temps** (un ASIN passé de "perdue" à "recovered" = preuve d'efficacité du traitement)

Ce qui est demandé est strictement de l'affichage de données déjà calculées + 2 dérivations simples sur données disponibles. Pas de nouveau concept métier.

---

## 3. ÉTAT DU CODE (vérifié dans `amazon-pilot-v3.6.2.html`)

### 3.1 — Item (c) "Causes en colonne" — état actuel

**Le champ `cause` existe déjà dans `calcBuyBoxAlerts`** (`src/buybox.js` autour de la ligne 4776 dans le HTML buildé). Chaque entrée retournée a la structure suivante :

```javascript
{ asin, title, brand, market, rPct, prevRetail, delta, cause, zeroWeeks, revenue, caMonthEst, criticite, segment, sellableUnits, couvertureSem, joursAvantLimite, stockUrgent }
```

Le champ `cause` prend une des 5 valeurs suivantes (logique déjà codée) :
- `'suppression'` — `retailPct === 0` sur ≥ 2 semaines (historique)
- `'po_unconfirmed'` — `openPOQty > 0 && confirmPct < 50`
- `'stock'` — `sellableUnits < unités hebdo`
- `'prix_3p'` — `rPct < 80 && stock OK` (inférence, pas de prix concurrent réel)
- `'surveillance'` — `delta` négatif (warning sans criticité)
- `'ok'` — état nominal

**La colonne "Cause suspectée" existe DÉJÀ dans le tableau Phase 1** (ligne ~5285 du HTML buildé : en-tête présent, ligne ~5322 : cellule affichant un tiret statique). Il suffit de remplacer le tiret par `entry.cause` avec un mapping français + icône.

### 3.2 — Item (d) `fragile` / `recovered` — état actuel

Dans `renderBuyBox()` (`src/buybox.js` autour de la ligne 5144) :

```javascript
var fragile     = [];   // v3.6.1 : toujours vide (dérivation v3.6.2)
var recovered   = [];   // v3.6.1 : toujours vide (cas fermés success — dérivation v3.6.2)
```

Les tabs UI existent déjà (lignes ~5268-5269) avec `count: 0` en dur :

```javascript
{ id: 'fragile',     label: 'Fragile',      count: 0 },
{ id: 'recovered',   label: 'Récupérées',   count: 0 }
```

**Logique métier à implémenter** (validée par Claude Code en clarif du 20 mai) :

- **`fragile`** : ASIN avec `rPct > 0` (Buy Box non perdue) ET delta négatif sur ≥ 2 semaines consécutives dans l'historique. Données : `a.history` (déjà disponible).
- **`recovered`** : ASIN dont le cas `buyboxCases` est fermé avec `conclusion.outcome === 'success'` ET `rPct ≥ 95` actuel. Données : `buyboxCases` (IndexedDB) + `a.retailPct` du dernier import. Fenêtre temporelle : pas de fenêtre — tant que `rPct ≥ 95` et que le cas est fermé en success, l'ASIN reste affiché dans "Récupérées".

### 3.3 — Localisation des fonctions

**Toutes les modifications se font dans `src/buybox.js`**, pas `src/core.js` (rappel règle V0.2 patterns d'erreur — discordance documentée).

---

## 4. WORKFLOW DE MODIFICATION (6 étapes — vérification intermédiaire étape 3)

### Étape 1 — Préparation
1. Vérifier branche `staging` à jour avec `main`
2. Grep de confirmation : `grep -n "var fragile\|var recovered\|cause:" src/buybox.js`
3. Confirmer que le champ `cause` est bien produit pour TOUS les bucket (`critical`, `warning`, `suppressed`) — sinon il faudra l'ajouter aux entrées qui n'en ont pas

### Étape 2 — Item (c) Affichage de la cause
Modifier `renderBuyBox()` dans `src/buybox.js`, ligne où la cellule "Cause suspectée" affiche un tiret statique.

Créer un helper `causeLabel(cause)` qui retourne un label français + icône, **dans le fichier `src/buybox.js`** :

```javascript
function buyboxCauseLabel(cause) {
  switch (cause) {
    case 'suppression':     return { icon: '🚫', label: 'Suppression listing',    color: 'var(--r)' };
    case 'po_unconfirmed':  return { icon: '📦', label: 'PO non confirmé',         color: 'var(--or)' };
    case 'stock':           return { icon: '📉', label: 'Stock insuffisant',       color: 'var(--or)' };
    case 'prix_3p':         return { icon: '💰', label: 'Concurrent 3P probable',  color: 'var(--r)' };
    case 'surveillance':    return { icon: '👁️', label: 'À surveiller',            color: 'var(--tx3)' };
    case 'ok':              return { icon: '✓',  label: '—',                      color: 'var(--tx3)' };
    default:                return { icon: '?',  label: cause || '—',             color: 'var(--tx3)' };
  }
}
```

Remplacer la cellule cause statique (`<span style="color:var(--tx3);font-size:11px;">—</span>`) par :

```javascript
var cl_ = buyboxCauseLabel(entry.cause);
h += '<div><span style="color:' + cl_.color + ';font-size:11px;">' + cl_.icon + ' ' + cl_.label + '</span></div>';
```

⚠ **Attention au nommage `cl_`** : `cl` est déjà une fonction globale qui retourne le client actif. Ne pas écraser. Utiliser `cl_` avec underscore ou tout autre nom non conflictuel (`causeMeta` par exemple).

### Étape 3 — VÉRIFICATION INTERMÉDIAIRE

Avant de passer aux items (d), confirmer par output :
- ✓ La colonne "Cause suspectée" affiche bien une icône + un label français pour chaque ASIN du tableau
- ✓ Aucune cellule ne reste sur "—" sauf pour les ASINs où la cause est `ok`
- ✓ Aucune erreur console au render de `renderBuyBox`
- ✓ Le rendu s'affiche correctement dans les onglets Perdue ET Compromise (Cogex + Gers)
- ✓ Aucune régression sur les KPIs et tris (CA, criticité)

Si quelque chose casse à ce stade, **ne pas continuer**, documenter et attendre instruction.

### Étape 4 — Item (d.1) Dérivation `fragile`
Toujours dans `renderBuyBox()`, remplacer la ligne `var fragile = [];` par une dérivation calculée.

Logique :
- Itérer sur `c.asins` (ou utiliser la liste complète des alertes, à ton choix selon le plus simple)
- Pour chaque ASIN actif (CA > 0), avec `rPct > 0` (Buy Box non perdue), vérifier `a.history` :
  - Récupérer les 2 dernières semaines d'historique
  - Si les 2 ont un delta `rPct` négatif (entre `n-1` et `n`, et entre `n-2` et `n-1`), c'est un `fragile`
- Construire une entrée avec la même structure que les autres buckets (`asin, title, brand, market, rPct, prevRetail, delta, cause, revenue, caMonthEst, criticite, segment`) pour réutiliser le rendu existant

Mettre à jour le count du tab :
```javascript
{ id: 'fragile', label: 'Fragile', count: fragile.length },
```

Ajouter la cause `'fragile_trend'` au mapping `buyboxCauseLabel` :
```javascript
case 'fragile_trend': return { icon: '⚠️', label: 'Dégradation 2 sem.', color: 'var(--or)' };
```

### Étape 5 — Item (d.2) Dérivation `recovered`
Toujours dans `renderBuyBox()`, remplacer la ligne `var recovered = [];` par une dérivation :

- Lire `buyboxGetCases(c)` (fonction déjà disponible)
- Filtrer les cas avec `status === 'closed'` ET `conclusion.outcome === 'success'`
- **Filtrer également sur la fenêtre temporelle 90 jours** : `closedAt` ≥ aujourd'hui − 90 jours. Justification : cohérence avec le KPI tuile "Résolus 90 j" déjà affiché en haut de Phase 1 (un seul concept temporel sur la même page).
- Pour chaque cas filtré, retrouver l'ASIN dans `c.asins`
- Garder uniquement si l'ASIN a `rPct >= 95` au dernier import
- Construire l'entrée structure (même format que ci-dessus)

Code attendu :

```javascript
var NOW = Date.now();
var WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
var closedCases = buyboxGetCases(c).filter(function(cs) {
  if (cs.status !== 'closed') return false;
  if (!cs.conclusion || cs.conclusion.outcome !== 'success') return false;
  if (!cs.closedAt) return false;
  return (NOW - new Date(cs.closedAt).getTime()) <= WINDOW_MS;
});
var recovered = closedCases.map(function(cs) {
  var a = (c.asins || []).find(function(x) { return x.asin === cs.asin; });
  if (!a || (a.retailPct || 0) < 95) return null;
  // construction entrée — adapter selon structure exacte d'une entrée alert
  return {
    asin: a.asin,
    title: a.title,
    brand: a.brand,
    market: a.market,
    rPct: a.retailPct,
    delta: 0,
    cause: 'recovered',
    revenue: getRevenue(a, c),
    caMonthEst: (getRevenue(a, c) || 0) * 4.33,
    criticite: 0,
    segment: calcSegment(a, c.asins.reduce(function(s,x){return s+(getRevenue(x,c)||0);},0), c)
  };
}).filter(Boolean);
```

Mettre à jour le count du tab :
```javascript
{ id: 'recovered', label: 'Récupérées', count: recovered.length },
```

Ajouter la cause `'recovered'` au mapping `buyboxCauseLabel` :
```javascript
case 'recovered': return { icon: '✅', label: 'Récupérée', color: 'var(--g)' };
```

### Étape 6 — Build + smoke tests visuels
1. Build local : `PYTHONIOENCODING=utf-8 python build.py` (rappel pattern Windows)
2. Renommer en `amazon-pilot-v3.6.3.html`
3. Copier en `amazon-pilot-latest.html` pour le repo
4. Push staging → recette CI auto-deploy
5. Smoke tests visuels (voir §5)
6. Si OK → preprod → revue Fred → main

---

## 5. SMOKE TESTS VISUELS (obligatoires — pas seulement logique)

### Test 1 — Item (c) Causes affichées
- Aller sur Buy Box, client Cogex
- Tab "Perdue" : **VOIR** que chaque ligne a une icône + un label dans la colonne "Cause suspectée"
- Tab "Compromise" : idem
- Aucune ligne ne reste sur "—" (sauf cas `ok`, qui ne devrait pas apparaître dans ces tabs critiques)

### Test 2 — Diversité des causes
- Sur Cogex (1831 ASINs), vérifier qu'on trouve **au moins 3 causes différentes** dans les ASINs affichés (sinon le mapping est incomplet ou bug)
- Sur Gers, idem (multi-marchés)

### Test 3 — Tab "Fragile" non vide
- Aller sur Tab "Fragile" client Cogex
- **VOIR** que le compteur du tab affiche un nombre > 0 (sauf si Cogex est miraculeusement sain — peu probable sur 1831 ASINs)
- **VOIR** que la cellule "Cause suspectée" affiche "⚠️ Dégradation 2 sem."
- Vérifier sur 1-2 ASINs que `rPct` est bien > 0 (sinon ils devraient être dans "Perdue", pas "Fragile")

### Test 4 — Tab "Récupérées" (fenêtre 90 jours)
- **Pré-requis** : il faut au moins 1 cas Buy Box fermé avec succès (`outcome: 'success'`) dans les **90 derniers jours** ET un ASIN à `rPct ≥ 95` pour que le tab soit peuplé
- Si aucun cas ne remplit ces conditions : le tab affiche 0, vide — c'est attendu, **pas un bug**
- Si tu peux fabriquer un cas test en console (créer un cas fermé success avec `closedAt` récent sur un ASIN à `rPct = 100`), le faire pour valider que le rendu fonctionne
- **Cohérence visuelle** : le compteur du tab "Récupérées" doit suivre la même fenêtre temporelle (90 j) que le KPI tuile "Résolus 90 j" en haut de la page. Si les deux affichent des nombres différents, c'est qu'il y a un bug.

### Test 5 — Aucune régression Tab "Perdue" / "Compromise"
- Les comptes affichés sur les tabs Perdue et Compromise doivent rester **identiques** à v3.6.2 (la logique de bucket n'est pas modifiée)
- Si ces comptes changent, c'est qu'on a touché à `calcBuyBoxAlerts` par erreur

### Test 6 — Moteur de recherche header (anti-régression v3.6.2)
- Taper un ASIN dans le moteur de recherche header
- **VOIR** que le filtre s'applique aux 4 tabs Buy Box (le rebranchement `cFiltered` doit toujours fonctionner)
- Vider la recherche : tous les ASINs reviennent

### Test 7 — Console JS
- Aucune erreur ni warning rouge au load
- Aucune erreur en cliquant successivement sur les 4 tabs

### Test 8 — Test sur Gers (multi-marchés, multi-comptes)
- Reproduire Tests 1-5 sur Gers Équipement
- Vérifier qu'il n'y a pas de doublons d'ASIN dans les tabs (un même ASIN sur 2 marchés peut apparaître 2 fois — comportement attendu, mais à confirmer visuellement)

---

## 6. CRITÈRES DE VALIDATION MERGE PROD

| # | Critère | Validateur |
|---|---|---|
| 1 | Les 8 smoke tests passent visuellement | Claude Code en preprod |
| 2 | Aucune erreur console au load et pendant les tests | Claude Code |
| 3 | Comptes tabs Perdue/Compromise identiques à v3.6.2 (pas de régression bucket) | Claude Code |
| 4 | Validation visuelle Fred sur Cogex ET Gers | Fred |
| 5 | Pas de modification de `calcBuyBoxAlerts` (`git diff` doit être propre sur cette fonction) | Claude Code |
| 6 | `oninput` toujours absent de toute topbar | Claude Code |

---

## 7. ÉCHELONS DE DÉPLOIEMENT

1. **Staging** : commit + push branche `staging`
2. **Recette/CI** : auto-deploy GitHub Actions → tester sur `https://d9xny9istvl53.cloudfront.net`
3. **Validation Fred recette**
4. **Preprod** : merge `staging` → `preprod` → auto-deploy `https://preprod.amazon.foliow.app`
5. **Validation Fred preprod** sur Cogex + Gers
6. **Prod** : merge `preprod` → `main` → auto-deploy `https://amazon.foliow.app`
7. Tag git `v3.6.3` après merge

⚠ Aucun commit direct sur `main` (Règle 5 du contexte orchestrateur).

---

## 8. LIVRABLE FINAL

- Fichier : `amazon-pilot-v3.6.3.html` à la racine du repo (+ `amazon-pilot-latest.html`)
- Tag git : `v3.6.3` après merge sur `main`
- Commit message principal :
  ```
  v3.6.3 - Buy Box Phase 1 : causes en colonne + statuts fragile/recovered

  - Helper buyboxCauseLabel mapping 5 causes → icône + label français
  - Colonne "Cause suspectée" remplie (était statique en v3.6.2)
  - Dérivation fragile : ASINs avec rPct > 0 et delta négatif sur 2 sem.
  - Dérivation recovered : cas Phase 2 fermés success avec rPct ≥ 95
  - Tabs Fragile et Récupérées peuplés (comptes dynamiques)
  - Aucune modification de calcBuyBoxAlerts
  ```

---

## 9. EN CAS DE DOUTE

- Si une entrée de `calcBuyBoxAlerts` n'a pas le champ `cause` (cas que je n'ai pas vérifié exhaustivement) : **arrête-toi, signale-le**, et propose au choix : (1) ajouter le champ dans `calcBuyBoxAlerts` (modification minimale autorisée par exception), (2) filtrer côté affichage
- Si le tab Fragile reste vide sur Cogex et Gers (alors qu'on devrait s'attendre à des ASINs en dégradation) : vérifie la logique d'historique (`a.history`) — peut-être que le delta se calcule différemment de ce que j'imagine
- Si la cause `prix_3p` semble surreprésentée (ce serait normal car `rPct < 80 && stock OK` est une condition fréquente) : ne pas modifier la logique, c'est cohérent avec la réalité métier

Règle "doute plutôt qu'invention" — si tu hésites, demande à Fred avant de coder.

---

## 10. CHECKLIST FINALE AVANT MERGE

```
[ ] Étape 1 — Branche staging à jour + grep confirmation
[ ] Étape 2 — Item (c) : helper buyboxCauseLabel + cellule remplacée
[ ] Étape 3 — Vérification intermédiaire OK (colonne cause visible)
[ ] Étape 4 — Item (d.1) : dérivation fragile + count tab + label cause
[ ] Étape 5 — Item (d.2) : dérivation recovered + count tab + label cause
[ ] Étape 6 — Build + push staging
[ ] Smoke tests 1-8 passés
[ ] calcBuyBoxAlerts non modifiée (git diff propre)
[ ] Revue Fred recette OK
[ ] Revue Fred preprod OK (Cogex + Gers)
[ ] Tag v3.6.3 posé
```

---

**FIN DU BRIEF — v3.6.3** (révision 2 — 21 mai 2026, fenêtre `recovered` arrêtée à 90 jours)

[Agent Orchestrateur] — Source : `amazon-pilot-v3.6.2.html` (lignes 4776, 5144-5167, 5268-5285, 5322) + clarif Claude Code 20 mai + `Claude_Orchestrateur_Context.md` V0.2 + décision Fred 21 mai (fenêtre 90j pour cohérence avec KPI "Résolus 90 j") — Confiance : haute
