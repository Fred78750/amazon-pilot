# SPEC — Tag « suspect » Buy Box (fondation Agent BB, v3.8)

**Date:** June 12, 2026
**Version:** Spec v1 (conception — à valider Fred)
**Statut:** prérequis n°1 au code v3.8. Structure proposée par l'Orchestrateur ; les **seuils numériques sont [À VALIDER]** (expérience KAM ou calibration empirique).
**Sources:** méthodo GPT V3 (ratio d'exposition, 6 portes), données ingérées v3.7.7 (foViews) + v3.7.8 (deliveryDefects) + glanceViews existant.

---

## 0. PRÉREQUIS DONNÉE — à vérifier AVANT de coder (point bloquant potentiel)

Le signal central est un **ratio** : `Featured Offer Page Views / Glance Views`. Pour le calculer **en timeline** (par semaine × marché), il faut les **deux** numérateur et dénominateur à cette granularité. Or, état réel de l'ingestion :

| Métrique | Granularité actuelle | Source |
|---|---|---|
| Featured Offer Page Views (numérateur) | **hebdo × marché** ✅ | `a.foViews[marché][semaine]` (rapport Traffic, v3.7.7) |
| Glance Views (dénominateur) | **scalaire FR courant** ⚠️ | `a.glanceViews` (parser VC, agrégé — pas de timeline) |

**Le dénominateur manque à la bonne granularité.** Trois hypothèses à trancher avec Claude Code / un export réel :
1. Le rapport **Retail Analytics → Traffic complet** contient peut-être une colonne « Vues de la page produit / Glance Views » que l'échantillon Cogex (6 colonnes : ASIN, Nom, Marque, FO views, Δ%, ΔYoY%) **ne contenait pas** — Fred exporte peut-être un sous-ensemble. → vérifier sur un export Traffic complet.
2. Les Glance Views viennent d'un **autre rapport** Retail Analytics (à ingérer en timeline, mini-chantier type v3.7.7).
3. À défaut, fallback dégradé : utiliser `glanceViews` scalaire courant comme dénominateur **approché** (ratio courant seulement, pas de tendance) — moins bon, à éviter si possible.

**Action préalable [FERME] :** confirmer la disponibilité des Glance Views hebdo × marché avant de coder le ratio en timeline. Si indisponible, le tag suspect v1 démarre en mode dégradé (cf. §10) et on ouvre un mini-chantier d'ingestion Glance Views timeline.

---

## 1. Objectif et place dans v3.8

Le tag suspect répond à **« quels ASINs regarder »** (niveau 1 : dashboard + Analyse ASINs). Il **ne diagnostique pas** — le *pourquoi* (6 portes + BB-1→12) est le travail de l'**Agent BB** (niveau 2). Séparation nette : **détection du symptôme** (tag) vs **diagnostic de la cause** (agent).

## 2. Signal central — taux d'exposition

```
tauxExposition(asin, marché, semaine) = foViews[marché][semaine] / glanceViews[marché][semaine]
```
Interprétation : part des vues produit où l'offre vedette était exposée. **Sain** = élevé (Amazon Retail détient et expose la Featured Offer). **Suspect** = bas (le produit est vu, mais jamais en offre vedette — perte d'exposition). **Rupture** = FO views = 0 alors que Glance Views > 0.

C'est le **taux**, pas la valeur absolue de FO views (un produit à faible trafic peut avoir peu de FO views tout en étant sainement exposé ; un best-seller peut avoir beaucoup de FO views tout en perdant du terrain). [Conforme méthodo V3.]

## 3. Données d'entrée
- `foViews[marché][semaine]` (numérateur) — v3.7.7
- Glance Views (dénominateur) — cf. §0
- `deliveryDefects[semaine][type]` — v3.7.8 (signal de renforcement)
- stock dormant / vendable, BB détenteur (capture manuelle) — signaux d'orientation
- CA 12 mois — priorisation, pas classification

## 4. Algorithme (structure [FERME], paramètres [À VALIDER])

Par ASIN × marché opéré :
1. **Filtre plancher d'activité** : ignorer si Glance Views < `SEUIL_ACTIVITE` sur la fenêtre (un ASIN quasi sans trafic n'est pas « suspect », il est inactif — évite le bruit, cohérent avec le filtre `getRevenue>0` de l'audit perf). `SEUIL_ACTIVITE` [À VALIDER] : ~20 glance views/semaine.
2. **Calcul du taux** sur la fenêtre d'observation `FENETRE` [À VALIDER] : 8 dernières semaines.
3. **Tendance** : pente du taux sur la fenêtre (hausse / stable / baisse) + valeur courante.
4. **Classification** (§5).
5. **Renforcement** : présence de défauts livraison récurrents (BOL Mismatch ≥ `N` semaines) ou stock dormant élevé → monte la sévérité d'un cran et oriente les hypothèses BB candidates.

## 5. Mapping vers sévérité — SEUILS [À VALIDER]

| Sévérité | Sens | Règle proposée (à calibrer) |
|---|---|---|
| **Critique** | défensif | taux = 0 (FO views=0, Glance>0) sur ≥ 2 semaines, **ou** taux < `T_CRIT` (~10 %) + défaut livraison récurrent |
| **À surveiller** | défensif | taux en baisse soutenue ≥ 3 semaines sans rebond, **ou** taux entre `T_CRIT` et `T_WARN` (~10–40 %) |
| **Sain** | — | taux > `T_SAIN` (~60 %) stable — non taggé |
| **Opportunité** | offensif | taux **et** FO views en hausse marquée (≥ `T_HAUSSE` ~ +50 % sur 3 sem) sur un marché — candidat à investir |

**Méthode de calibration recommandée [À VALIDER → mesurable maintenant]** : plutôt que des seuils a priori, **mesurer la distribution réelle du taux d'exposition sur Cogex + Gers** (on a les données : 279 ASINs Cogex à 0 FO, 51 % Gers FR à 0) et placer les seuils sur les **ruptures naturelles** de la distribution. C'est un mini-script d'analyse (pas de code produit) que Claude Code peut produire — il transformerait les seuils proposés ci-dessus en seuils fondés. Doctrine « mesurer avant ».

## 6. Articulation avec les 6 portes de triage (méthodo V3)
Le tag suspect alimente surtout la lecture de la **porte 5** (« Amazon fait-il confiance au stock / l'expose-t-il ? »). Mais un taux bas peut venir de n'importe quelle porte amont (prix non compétitif = porte 3, non rentable = porte 4, etc.). Donc : **le tag détecte, les portes + l'Agent BB orientent**. Le tag ne présume pas la porte — il déclenche l'investigation. Les signaux de renforcement (défauts, stock, BB 3P) pré-orientent les hypothèses BB candidates affichées, sans conclure.

## 7. Sortie — structure du tag par ASIN
```
a.suspectTag = {
  severity: 'crit' | 'warn' | 'opp' | null,
  direction: 'defensif' | 'offensif' | null,
  marketWorst: '<marché le plus dégradé>',
  tauxCurrent: <float>, trend: 'up'|'flat'|'down',
  reinforcers: ['BOL Mismatch x3', 'stock dormant', 'BB 3P'],  // signaux secondaires détectés
  bbCandidates: ['BB-10','BB-8',...],   // hypothèses pré-orientées, NON conclusives
  caExposed: <float>,                    // pour priorisation, pas classification
  computedAt: <semaine>
}
```

## 8. Double usage [FERME]
Le tag porte un `direction` : **défensif** (chute → récupérer, alimente l'Agent BB → case Amazon) ou **offensif** (réveil → investir, alimente la recommandation d'investissement). Le même calcul détecte les deux sens (pente positive vs négative). Réservé visuellement : teal = offensif, ambre/rouge = défensif (cohérent maquettes).

## 9. Performance [FERME — leçon v3.7.6]
Calcul sur ~12k ASINs × ~14 marchés × fenêtre. Mesurer avant/après ; pré-calculer le tag à l'import (pas à chaque render — c'est l'erreur G1 corrigée). Stocker `a.suspectTag` calculé, recalculé à chaque nouvel import Traffic, pas en live.

## 10. Cas limites / mode dégradé [FERME]
- **Glance Views indisponible en timeline** (§0) : mode dégradé v1 = taux courant seulement (foViews courant / glanceViews scalaire), sans tendance fiable → tag « critique » limité au cas FO=0 ; « à surveiller » et calibration de tendance attendent l'ingestion Glance Views timeline. À afficher honnêtement comme limite, pas masquer.
- **Glance Views = 0** : pas de ratio (division) → ASIN inactif, non taggé (filtre §4.1).
- **ASIN nouveau** (< FENETRE semaines d'historique) : pas de tendance → tag « données insuffisantes », non classé suspect.
- **Marché mineur** (GB/TR/SA…) : stocké mais hors scope d'affichage par défaut (décision marchés opérés).

## 11. Ce que le tag suspect NE fait PAS [limites négatives]
- ❌ Ne diagnostique pas la cause (c'est l'Agent BB).
- ❌ Ne conclut pas une hypothèse BB (il en pré-oriente, sans trancher).
- ❌ Ne se calcule pas en live au render (pré-calculé à l'import).
- ❌ N'invente pas de taux quand le dénominateur manque (mode dégradé explicite).
- ❌ Ne tagge pas les ASINs sous le plancher d'activité (anti-bruit).

## 12. Récap des [À VALIDER]
1. **Disponibilité Glance Views hebdo × marché** (§0) — bloquant, à vérifier en premier.
2. Seuils `T_CRIT` / `T_WARN` / `T_SAIN` / `T_HAUSSE` / `SEUIL_ACTIVITE` / `FENETRE` / `N` défauts (§4-5) — **reco : calibrer sur distribution réelle Cogex+Gers** plutôt qu'a priori.
3. Pondération exacte des renforçateurs (défauts/stock/BB 3P) dans la montée de sévérité.
4. Liste des marchés « opérés » affichés par défaut.

---
*Prochaine étape proposée : (1) Claude Code vérifie le prérequis Glance Views (§0) + produit la distribution réelle du taux d'exposition pour calibrer les seuils (§5). (2) Fred valide structure + seuils calibrés. (3) Le tag suspect entre alors dans le premier brief de CODE v3.8.*
