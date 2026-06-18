# SPEC — Tag « suspect » Buy Box (fondation Agent BB, v3.8) — v2.2

**Date:** June 18, 2026
**Version:** v2.2 — fige la **calibration sur distribution réelle Cogex FR** (8 sem, rapport distribution v2 du 18/06). Les seuils passent de `[À VALIDER]` à `[CALIBRÉS COGEX — PARAMÉTRABLES]`. Révise v2.1 (structure double composante) qui révisait v2.
**Statut:** prête pour le 1ᵉʳ brief de CODE v3.8. Structure [FERME], seuils [CALIBRÉS COGEX, à recalibrer sur compte sain].

> **Changelog v2.1 → v2.2 :** §4.1 filtre activité chiffré (définition « actif » + univers réel) ; §5 seuils calibrés avec **volumes mesurés** + nuance critique primaire/secondaire ; §5bis **caveat biais compte pathologique** (nouveau) ; §10 cas limite « apparitions » (+9999 %) ; §12 recalibrage compte sain = backlog + renvoi suspect dormant (2ᵉ famille).

---

## 0. Rappel — prérequis Glance Views LEVÉ (inchangé)

Pour un Vendor 1P, « Featured Offer Page Views » **est** l'équivalent moderne des Glance Views. Le signal = **la dynamique des FO views elles-mêmes** (niveau, passage à 0, variation, tendance), pas un ratio. Données disponibles : `a.foViews[marché][semaine]` (`views`, `deltaPrevPct`, `deltaYoyPct`). *(Reformulation « taux d'exposition » du doc méthodo V3 GPT → backlog.)*

---

## 1. Objectif et place dans v3.8 (inchangé)

Le tag répond à **« quels ASINs regarder »** (niveau 1). Détecte le **symptôme**, ne diagnostique pas la cause (Agent BB = niveau 2).

---

## 2. Signal central — double composante (inchangé v2.1)

- **Composante HEBDO (réactive) — passage à 0** : signal binaire urgent, maille hebdo native, sans lissage.
- **Composante MENSUELLE GLISSANTE (tendance) — chute / hausse** : cumul 4 sem glissantes comparé au bloc précédent, lisse le bruit hebdo.

Une maille unique forcerait un compromis perdant (bruit vs réactivité). La double composante traite chaque phénomène à sa bonne échelle. **Validé par les données** (rapport v2 §3.3) : la variation hebdo est trop dispersée (p5 −100 / p95 +250) pour porter un seuil de chute — elle ne sert qu'à détecter le 0 ; la chute en % se lit sur le mensuel.

---

## 3. Données d'entrée (toutes disponibles — enrichi)

- `foViews[marché][semaine]` : `views`, `deltaPrevPct`, `deltaYoyPct` — 8 sem hebdo + **3 annuels 2024/2025/2026** ✅
- `deliveryDefects[semaine][type]` (renforçateur) ✅
- ventes / unités / PO (`a.history[]`) — qualifie « actif » ✅
- **stock Amazon** = `sellableUnits` (493 ASINs Cogex) ; **stock ERP fournisseur** = `erp_stock` (255 réf, fix v3.7.13) — renforçateur stock dormant ✅
- CA 12 mois — priorisation ✅

---

## 4. Algorithme — maille double composante [structure FERME]

Par ASIN × marché opéré :
1. **Filtre plancher d'activité [CALIBRÉ — CRITIQUE].** Ignorer si non « actif ». **Définition « actif » (calibrée) :** `revenue > 0` **OU** `orderedRevenue > 0` **OU** `units > 0` **OU** `orderedUnits > 0` dans `a.history[]`. *Pourquoi critique :* sur Cogex FR, **66,5 % du catalogue est à 0 vue** ; sans ce filtre le tag noie le signal. **Univers réel ≈ 354 ASINs actifs avec FO data** (vs 1 913 catalogue). Le filtre n'est pas optionnel.
2. **Lecture hebdo (réactive)** : passage à 0 des FO views (actif).
3. **Lecture mensuelle glissante (tendance)** : cumul `views` bloc récent vs bloc ancien (2 blocs de 4 sem), variation + pente.
4. **Classification** (§5).
5. **Renforcement** : défaut livraison récurrent (BOL Mismatch ≥ N sem) ou stock dormant élevé (`sellableUnits`/`erp_stock`) → +1 cran + pré-oriente les hypothèses BB.

---

## 5. Mapping vers sévérité — SEUILS [CALIBRÉS COGEX FR — PARAMÉTRABLES]

| Sévérité | Sens | Règle calibrée (volume mesuré Cogex FR, ~351-354 actifs) |
|---|---|---|
| **Critique** | défensif | **FO views = 0 sur ≥ 3 sem consécutives** (actif) — *signal primaire, 53 ASINs / 15 % des actifs* — **OU** chute mensuelle glissante ≤ **T_CHUTE = −50 %** **avec renforçateur** (défaut livraison / stock dormant) — *≤ −50 % seul = 90 ASINs / 25,6 %, trop large sans renforçateur* |
| **À surveiller** | défensif | chute mensuelle entre **T_SURVEILLER = −30 %** et −50 % sans atteindre critique, **ou** passage à 0 sur 1–2 sem — *≤ −30 % cumulé = 141 ASINs / 40,1 %* |
| **Sain** | — | reste — non taggé |
| **Opportunité** | offensif | hausse mensuelle glissante ≥ **T_HAUSSE = +50 %** soutenue (hors « apparitions », §10) |

**Paramètres :** `T_CHUTE` = −50 %, `T_SURVEILLER` = −30 %, `T_HAUSSE` = +50 %, `FENETRE` = 8 sem (2 blocs de 4), critique-zéro = ≥ 3 sem consécutives. **Tous paramétrables** (pas de valeur en dur).

**Décision de design clé (calibrée) :** le **critique repose d'abord sur le passage à 0 prolongé** (≥ 3 sem), signal net et peu ambigu (53 ASINs). Le seuil de chute mensuelle ≤ −50 % n'est « critique » **qu'assorti d'un renforçateur** — seul, il capture 1 actif sur 4 (effet du compte en déclin, cf. §5bis).

---

## 5bis. CAVEAT — biais « compte pathologique » [NOUVEAU v2.2, déterminant]

Ces seuils sont calibrés sur **Cogex FR uniquement**, un compte en **déclin structurel** : médiane de variation mensuelle = **−18,2 %** (la moitié des actifs baissent de >18 %), toutes marques à −97/−99 %. **Conséquence :** une « rupture naturelle » de la distribution Cogex reflète *la pathologie de Cogex*, pas un seuil universel. Le seuil « à surveiller » à −30 % tague 40 % des actifs — alarmant sur un compte sain, normal ici.

**Donc :** seuils **provisoires, à recalibrer sur un compte sain** (point de comparaison manquant — Gers est synthétique, vraie donnée VC requise). Le code n'attend pas la perfection (seuils paramétrables), mais ces valeurs **ne sont pas la référence produit** tant qu'un compte sain n'a pas été mesuré.

---

## 6. Articulation 6 portes (méthodo V3 — inchangé)

Le tag **détecte**, l'Agent BB **diagnostique**. Renforçateurs pré-orientent les hypothèses BB sans conclure. Nuance Agent BB (pas le tag) : croiser FO views × ventes × conversion (visibilité vs conversion).

---

## 7. Sortie — `a.suspectTag` (inchangé v2.1)

```
a.suspectTag = {
  severity: 'crit'|'warn'|'opp'|null,
  direction: 'defensif'|'offensif'|null,
  trigger: 'zero_hebdo'|'chute_mensuelle'|'hausse_mensuelle'|null,
  marketWorst: '<marché>',
  foViewsCurrent: <int>,
  deltaMensuelPct: <float>,
  trend: 'up'|'flat'|'down',
  reinforcers: ['BOL Mismatch x3','stock dormant','BB 3P'],
  bbCandidates: ['BB-10','BB-8',...],   // pré-orientation NON conclusive
  caExposed: <float>,
  computedAt: <semaine>
}
```

---

## 8. Double usage [FERME — inchangé]
Défensif (chute/0 → Agent BB) / offensif (réveil → investir). Teal = offensif, ambre/rouge = défensif.

## 9. Performance [FERME — inchangé]
Pré-calculé à l'import Traffic, stocké dans `a.suspectTag`, recalcul à chaque import.

---

## 10. Cas limites [FERME — enrichi v2.2]

- FO views = 0 sans activité → inactif, non taggé (filtre §4.1).
- ASIN neuf (< FENETRE) → données insuffisantes ; mais passage à 0 hebdo détectable dès ≥ 2 sem.
- Marché mineur → stocké, hors affichage par défaut.
- `deltaPrevPct` absent (1ʳᵉ sem) → pente interne dès ≥ 2 points.
- Bloc mensuel incomplet (< 4 sem) → composante mensuelle « partielle », hebdo reste active.
- **« Apparitions » [NOUVEAU] :** cumul bloc A = 0 et bloc B > 0 → variation +∞ (codée +9999 % dans la mesure, 8 ASINs Cogex). **Ne pas classer « opportunité » mécaniquement** — c'est un ASIN qui démarre/réapparaît, pas un réveil de marché. Traiter à part (flag dédié ou exclusion du seuil hausse).

---

## 11. Ce que le tag NE fait PAS [limites négatives — inchangé]
- ❌ Ne diagnostique pas la cause (Agent BB). ❌ Ne conclut pas une hypothèse BB. ❌ Pas de calcul live (pré-calcul import). ❌ Ne tague pas les inactifs. ❌ Pas de ratio FO/Glance. ❌ Pas de seuil en dur. ❌ **Ne détecte pas le « suspect dormant »** (mort ancienne hors fenêtre 8 sem) → 2ᵉ famille, cf. §12.

---

## 12. Récap — ce qui reste

1. **[FIGÉ v2.2]** Seuils calibrés Cogex FR : filtre actifs obligatoire, critique = 0 sur ≥ 3 sem (primaire) ou −50 %+renforçateur, surveiller = −30 %, hausse = +50 %.
2. **[backlog — déterminant]** Recalibrage sur **compte sain** (vraie donnée VC requise — Gers actuellement synthétique). Les seuils Cogus ne sont pas la référence produit (§5bis).
3. **[à lister]** Marchés « opérés » affichés par défaut.
4. **[backlog]** Pondération des renforçateurs ; reformulation « taux d'exposition » méthodo V3 (GPT).
5. **[2ᵉ famille — à spécifier séparément]** **Suspect dormant** : ASIN avec trafic historique (annuel 2024/2025/2026 désormais dispo) + stock (Amazon `sellableUnits` / fournisseur `erp_stock`) + aucun mouvement, hors fenêtre glissante. Arbitrage métier ouvert : **nouveau tag** vs **enrichissement classification Enquête A2 (Stock dormant)** — décision Fred/GPT.

---

*Prochaine étape : 1ᵉʳ brief de CODE v3.8 (tag suspect dynamique : pré-calcul import, sortie `a.suspectTag`, seuils calibrés §5 paramétrables). Le suspect dormant (§12.5) se spécifie en parallèle une fois l'arbitrage métier tranché.*

---

[Agent Data Analyst + Orchestrateur] — Source : RAPPORT DISTRIBUTION v2 (8 sem Cogex FR) + SPEC v2.1 + audit données 18/06 — Confiance : CERTAIN sur les chiffres et volumes mesurés ; le biais compte pathologique est CERTAIN ; la portée universelle des seuils est INCERTAINE (recalibrage compte sain requis)
