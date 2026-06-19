# Spec — Pré-scoring des causes BB (Agent BB Recovery) · v2

**Date:** June 18, 2026
**De:** Orchestrateur produit Amazon Pilot
**Statut:** v2 — **intègre l'audit contradictoire GPT** (10 corrections + 9 définitions opérationnelles). Supersede la v1.
**Source méthodo:** table GPT signaux→BB (autorité VC). Corrections d'audit appliquées telles que recommandées par GPT.

---

## 0. CE QUE CETTE SPEC N'EST PAS
- ❌ Pas un brief de code (vient après). ❌ Pas une réinterprétation de la méthodo. ❌ Le pré-scoring n'est pas une conclusion (conclusion gated = validation Fred).

---

## 1. Principe (arbitrages session)
Pré-scoring **déterministe** (IA = parse capture + narration uniquement), calculé **masqué à l'import** → `bbCandidates`, invisible au niveau Détecter, exploité instantanément par l'Agent BB. **Calcul PAR MARCHÉ** (voir §1bis).

## 1bis. Multi-marché — règle figée [CORRECTION audit, contradiction §1/§6 levée]
- `bbCandidates` calculé **pour chaque ASIN × marché** disposant des données.
- `marketPrincipal` (= marché au plus gros **CA YTD**) calculé **séparément**, sert de **marché affiché par défaut** — **sans supprimer** les scores des autres marchés. (Une perte FR ne doit pas être masquée parce que DE est le marché principal.)

---

## 2. Deux temps : pré-score [D] / affinage [NP]
- **[D] (avant capture, à l'import)** : `FO_views_zero`, `FO_views_chute`, `FO_views_hausse`, `stock_dormant`, `sellable_zero`, `defauts_BOL`, `PO_recent`, `PO_absent`, `ASN_CARP_anomalie`.
- **[NP] (après capture, parse IA)** : `detenteur_BB` (1P / 3P_FBA / 3P_dropship), `prix_concurrent`, `indisponible`.

---

## 3. Triage séquentiel — première porte bloquante = dominante

Ordre **1→2→3→4→5→6** ; la première porte **confirmée bloquée** donne la cause dominante.

**[CORRECTION BLOQUANTE — Porte 1] `detenteur_BB` ne prouve pas la présence Retail :**
```
IF detenteur_BB = "1P_Amazon"      → porte1 = franchie
IF detenteur_BB IN (3P_FBA,3P_dropship) → porte1 = NON RÉSOLUE
   AND needsAdditionalData += "presence_Retail_autres_offres"
```
Ne jamais conclure « Retail absent » sur une BB 3P → seulement « Amazon ne détient pas la Featured Offer ».

**[CORRECTION BLOQUANTE — départage portes] Une porte non renseignée ≠ porte bloquée.** Si une porte antérieure est non résolue (donnée absente) → `pending/needsData`, ne pas sauter à une porte ultérieure comme dominante.

**Priorités gravées :**
- Porte 2 : `sellable_zero` → BB-1 ; `indisponible` + `sellable_zero=false` → BB-2. **Porte 2 prime sur 3/4/6.**
- Porte 3 : `3P + prix_concurrent` → BB-5 ; `3P_FBA + prix non inférieur` → BB-7 à confirmer.
- Porte 5 : inbound+stock+conséquence → BB-10 ; inbound+conséquence sans anomalie stock → BB-4 ; dormant sans inbound → BB-3.

---

## 4. Règles de niveau par BB (corrigées audit — listes FERMÉES)

**BB-1** : `sellable_zero` → modéré ; + (`indisponible` OU `detenteur_BB=3P`) → fort.

**BB-2** [AJOUT — règle manquante] : `sellable_zero=false` requis.
```
fort : indisponible AND count(FO_views_zero,PO_recent,ASN_CARP_anomalie,defauts_BOL) >= 2
modéré : (FO_views_zero+PO_recent) OU (indisponible + >=1 anomalie inbound)
à confirmer : indisponible seul
+ needsAdditionalData += "statut_detaille_stock"
```

**BB-3** [liste fermée] renforçateurs = {`FO_views_chute`,`FO_views_zero`,`PO_absent`,`detenteur_BB=3P`} **uniquement**.
```
dormant + 0 renf → à confirmer ; +1 → modéré ; >=2 → fort
FO_views_hausse n'est JAMAIS renforçateur (→ réveil, baisse niveau actuel)
```

**BB-4** [listes fermées] inbound={`defauts_BOL`,`ASN_CARP_anomalie`} ; conséquences={`PO_recent`,`FO_views_zero`,`FO_views_chute`,`stock_dormant`}.
```
modéré : >=1 inbound + >=1 conséquence
fort : defauts_BOL ET ASN_CARP_anomalie + >=1 conséquence (proximité temporelle obligatoire pour fort)
```

**BB-5** : `3P` → modéré ; `3P + prix_concurrent` → fort ; FO seule → à confirmer.

**BB-6** : jamais fort ; `FO dégradé` inexpliqué après portes 1-5 → à confirmer + `needsAdditionalData`.

**BB-7** [AJOUT pré-faisceau] : `3P_FBA + prix_concurrent=false` → modéré + `needsDeliveryPromise` ; sinon à confirmer. **Jamais fort** avec les signaux actuels.

**BB-8** : `PO_absent + stock_dormant + (FO_views_zero OU chute)` → modéré ; **jamais fort** sans confirmation rentabilité Amazon.

**BB-9** [CORRECTION BLOQUANTE] : pas de porte propre. `porteDominante` = **première porte bloquante (ordre 1→6) parmi ses sous-causes**. Ex. BB-1(p2)+BB-5(p3) → porteDominante=2. Conserve les sous-causes.

**BB-10** [CORRECTION collision BB-1] :
```
countInbound={defauts_BOL|ASN_CARP_anomalie} ; countStock={stock_dormant|sellable_zero*} ; countCommercial={FO_views_zero|FO_views_chute|detenteur_BB=3P}
fort : >=1 dans chaque catégorie
* sellable_zero admissible dans countStock UNIQUEMENT si stock antérieur positif/dormant ou reclassification établie
IF sellable_zero AND stock_dormant=false AND pas de preuve stock antérieur → BB-1 domine, BB-10 <= à confirmer
```

**BB-11** [garde-fou dominance] : chute persistante → modéré ; `FO_views_zero` persistant (ou chute+dormant) → fort.
```
IF une cause BB-1..10 ou BB-12 >= modéré → BB-11 NE PEUT PAS être causeDominante
BB-11 dominante uniquement en "formeDominante" provisoire + causeRacine="non déterminée" → déclenche recherche cause
```

**BB-12** : jamais auto ; → à confirmer + `needsVariationData`.

---

## 5. Les 5 principes de pondération (GPT — gravés)
1. Première porte bloquante = dominante. 2. Cause / aggravant / conséquence distincts. 3. FO = symptômes aval, jamais suffisants seuls. 4. Inbound ≠ causalité sans proximité temporelle + conséquence. 5. Réveil n'efface pas l'historique (→ §6 niveau actuel vs historique).

---

## 6. Schéma de sortie `bbCandidates` (corrigé audit)
```json
{
  "marche": "FR",
  "porteDominante": 5,
  "causeDominante": "BB-10",
  "formeDominante": null,
  "causesSecondaires": ["BB-4","BB-3","BB-11"],
  "niveauFaisceauHistorique": "fort",
  "niveauFaisceauActuel": "modéré",
  "recoveryState": "aucun réveil",
  "signauxSupport": ["stock_dormant","defauts_BOL","ASN_CARP_anomalie","FO_views_zero"],
  "signauxContradictoires": [],
  "signauxManquants": [],
  "needsPaste": ["detenteur_BB","prix_concurrent","indisponible"],
  "needsAdditionalData": [],
  "explicationCourte": "…"
}
```
**Ajouts audit** : `signauxContradictoires[]` (signaux qui affaiblissent l'hypothèse — ex. dormant mais FO_hausse) ; `niveauFaisceauHistorique` vs `niveauFaisceauActuel` (le réveil baisse l'actuel, pas l'historique) ; `formeDominante` (BB-11 provisoire). `explicationCourte` = seule part IA.

---

## 7. Définitions opérationnelles FIGÉES (recommandations GPT, paramétrables sauf mention)
| Paramètre | Valeur par défaut | Param. |
|---|---|---|
| `FO_views_chute` significative | baisse ≥ 30 % vs moyenne 3 mois ; pas de niveau fort si base < 20 vues/mois | oui |
| Chute persistante | 2 mois consécutifs (ou 4 sem.) | oui |
| `FO_views_zero` durable | N ≥ 4 sem. consécutives (ou 1 mois civil) | oui |
| Proximité inbound↔chute | −8 sem. à +2 sem. autour du début de chute | oui |
| `PO_recent` | PO < 8 semaines | oui |
| PO non transformé | aucune vente 14 j après réception (ou 28 j après livraison attendue) | oui |
| Récence `defauts_BOL` | scoring 12 sem. ; causale forte 8 sem. autour de la chute | oui |
| `FO_views_hausse` = réveil | >0 sur 2 sem. consécutives + hausse (ou +25 % sur 2 périodes) | oui |
| Départage portes | ordre 1→6 fixe ; porte non renseignée ≠ bloquée | ordre: non / conditions: oui |

*(Cohérent avec les seuils du tag suspect `SUSPECT_CONFIG` — à harmoniser : T_CHUTE −30/−50, fenêtre 8 sem.)*

---

## 8. Reste avant le brief de code
- Cette v2 est **validée GPT par construction** (intègre ses corrections) — un dernier aller-retour de confirmation possible mais non bloquant.
- Harmoniser les seuils §7 avec `SUSPECT_CONFIG` (Fred + moi).
- Puis brief de code : `computeBbCandidates` + `parseBuyBoxCapture` + réécriture `buyboxAutoEvaluateHypotheses`/`renderBuyBoxCase` + extension schéma `buyboxCases`.

---

[Agent Orchestrateur] — Source : table GPT + audit contradictoire GPT (10 corrections + 9 définitions) intégrés — Confiance : haute ; corrections appliquées telles que recommandées ; seuils §7 à harmoniser avec le tag suspect
