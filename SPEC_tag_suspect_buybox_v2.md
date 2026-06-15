# SPEC — Tag « suspect » Buy Box (fondation Agent BB, v3.8) — v2

**Date:** June 12, 2026
**Version:** Spec v2 — révise v1 suite à la clarification GPT du 12 juin (Featured Offer Page Views ≈ Glance Views pour un 1P)
**Statut:** prérequis n°1 au code v3.8. Structure proposée par l'Orchestrateur ; **seuils [À VALIDER]** (calibration sur distribution réelle).

---

## 0. CHANGEMENT MAJEUR vs v1 — prérequis Glance Views LEVÉ

v1 posait le signal comme un **ratio** FO Page Views / Glance Views et signalait l'absence du dénominateur comme bloquant. **Clarification GPT (12 juin) :** pour un Vendor 1P, « Featured Offer Page Views » **est** l'équivalent moderne des Glance Views (différence négligeable, vocabulaire Amazon réuniformisé). Conséquences :
- Il n'existe pas de dénominateur distinct à ingérer — et un ratio FO/Glance serait ≈ 1, donc non discriminant.
- Le signal du tag suspect = **la dynamique des Featured Offer Page Views elles-mêmes** (niveau, passage à 0, variation, tendance).
- **Toutes les données nécessaires sont déjà disponibles** : `a.foViews[marché][semaine].views` (v3.7.7) + les variations natives du rapport (`deltaPrevPct`, `deltaYoyPct`). **Aucune ingestion supplémentaire. Spec codable.**

> **À répercuter sur le doc de référence** : la méthodo V3 GPT déposée définit encore « taux d'exposition = FO / Glance ». À faire reformuler par GPT pour cohérence (le signal est la dynamique des FO views, pas un ratio).

---

## 1. Objectif et place dans v3.8
Inchangé : le tag répond à **« quels ASINs regarder »** (niveau 1). Il **détecte le symptôme**, ne diagnostique pas la cause (Agent BB = niveau 2, applique 6 portes + BB-1→12).

## 2. Signal central — dynamique des Featured Offer Page Views
Par ASIN × marché, sur la fenêtre d'observation, on lit :
- **niveau courant** `foViews[marché][semaine].views`
- **passage à 0** (FO views = 0 alors que l'ASIN a une activité commerciale connue : ventes/PO récents)
- **variation période antérieure** `deltaPrevPct` (native dans le rapport)
- **variation YoY** `deltaYoyPct` (native)
- **tendance** = pente des `views` sur la fenêtre

**Interprétation** : FO views = exposition de l'offre Amazon. Chute / passage à 0 = perte d'exposition (défensif). Hausse soutenue = réveil (offensif). C'est la métrique d'exposition de référence (GPT ⭐⭐⭐⭐⭐).

## 3. Données d'entrée (toutes disponibles)
- `foViews[marché][semaine]` : `views`, `deltaPrevPct`, `deltaYoyPct` — v3.7.7 ✅
- `deliveryDefects[semaine][type]` — v3.7.8 (renforçateur) ✅
- ventes / unités / PO récents — pour qualifier « activité connue » (un FO=0 sur un ASIN sans aucune activité = inactif, pas suspect) ✅
- stock dormant/vendable, BB détenteur (capture manuelle) — orientation ✅
- CA 12 mois — priorisation ✅

## 4. Algorithme (structure [FERME], paramètres [À VALIDER])
Par ASIN × marché opéré :
1. **Filtre plancher d'activité** : ignorer si aucune activité commerciale sur la fenêtre (ni ventes ni vues significatives) → inactif, non taggé. Évite le bruit.
2. **Lecture** : niveau courant, série `views` sur `FENETRE` [À VALIDER ~8 sem], `deltaPrevPct`, `deltaYoyPct`, pente.
3. **Classification** (§5).
4. **Renforcement** : défauts livraison récurrents (BOL Mismatch ≥ N sem) ou stock dormant élevé → +1 cran de sévérité + pré-oriente les hypothèses BB candidates.

## 5. Mapping vers sévérité — SEUILS [À VALIDER]
| Sévérité | Sens | Règle proposée (à calibrer sur distribution réelle) |
|---|---|---|
| **Critique** | défensif | FO views = 0 sur ≥ 2 sem (avec activité commerciale connue), **ou** chute `deltaPrevPct` < `T_CHUTE` (~ −50 %) + défaut livraison récurrent |
| **À surveiller** | défensif | baisse soutenue (pente négative ≥ 3 sem, ou `deltaPrevPct` négatif répété) sans rebond |
| **Sain** | — | niveau stable / `deltaPrevPct` ≈ 0 ou positif — non taggé |
| **Opportunité** | offensif | hausse marquée (`deltaPrevPct` ≥ `T_HAUSSE` ~ +50 % sur ≥ 3 sem) sur un marché — candidat à investir |

**Calibration recommandée [mesurable maintenant]** : mesurer la **distribution réelle** des `views` et des `deltaPrevPct` sur Cogex + Gers (on a 279 ASINs Cogex à 0 FO, 51 % Gers FR à 0), placer les seuils sur les ruptures naturelles. Mini-script d'analyse, pas de code produit. Transforme les seuils proposés en seuils fondés.

## 6. Articulation 6 portes (méthodo V3)
Inchangé : le tag **détecte**, les 6 portes + l'Agent BB **orientent/diagnostiquent**. Le tag ne présume pas la porte ; les renforçateurs (défauts, stock, BB 3P) pré-orientent les hypothèses BB candidates sans conclure. **Nuance diagnostic (Agent BB, pas le tag)** : croiser FO views × ventes × conversion pour distinguer problème de **visibilité** (vues chutent) vs **conversion** (vues stables, ventes chutent).

## 7. Sortie — `a.suspectTag`
```
a.suspectTag = {
  severity: 'crit'|'warn'|'opp'|null,
  direction: 'defensif'|'offensif'|null,
  marketWorst: '<marché le plus dégradé>',
  foViewsCurrent: <int>, deltaPrevPct: <float>, trend: 'up'|'flat'|'down',
  reinforcers: ['BOL Mismatch x3','stock dormant','BB 3P'],
  bbCandidates: ['BB-10','BB-8',...],   // pré-orientation, NON conclusive
  caExposed: <float>,
  computedAt: <semaine>
}
```

## 8. Double usage [FERME]
`direction` défensif (chute → Agent BB → case Amazon) / offensif (réveil → recommandation d'investissement). Même calcul, pente positive/négative. Teal = offensif, ambre/rouge = défensif.

## 9. Performance [FERME — leçon v3.7.6]
Pré-calculé à l'import Traffic (pas au render). Stocker `a.suspectTag`, recalcul à chaque nouvel import. Mesurer sur Gers.

## 10. Cas limites [FERME]
- **FO views = 0 sans aucune activité** → inactif, non taggé (filtre §4.1).
- **ASIN neuf** (< FENETRE) → « données insuffisantes », non classé.
- **Marché mineur** (GB/TR/SA…) → stocké, hors affichage par défaut.
- **`deltaPrevPct` absent** (1ʳᵉ semaine d'un ASIN) → utiliser la pente interne dès ≥ 2 points.

## 11. Ce que le tag NE fait PAS [limites négatives]
- ❌ Ne diagnostique pas la cause (Agent BB).
- ❌ Ne conclut pas une hypothèse BB (pré-oriente seulement).
- ❌ Ne se calcule pas en live (pré-calcul import).
- ❌ Ne tagge pas les ASINs inactifs (anti-bruit).
- ❌ N'utilise PAS de ratio FO/Glance (caduc — cf. §0).

## 12. Récap [À VALIDER]
1. Seuils `T_CHUTE` / `T_HAUSSE` / `FENETRE` / `N` défauts / plancher activité → **calibrer sur distribution réelle Cogex+Gers**.
2. Pondération des renforçateurs.
3. Liste des marchés « opérés » affichés.
4. **Reformulation du doc méthodo V3** (« taux d'exposition » sans dénominateur) → à repasser à GPT.

---
*Prochaine étape : (1) Claude Code produit la distribution réelle des views + deltaPrevPct (Cogex+Gers) → seuils fondés. (2) Fred valide structure + seuils. (3) Tag suspect entre dans le 1ᵉʳ brief de CODE v3.8. Plus aucune dépendance données bloquante.*
