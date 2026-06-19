# Spec — Pré-scoring des causes BB (Agent BB Recovery, socle déterministe)

**Date:** June 18, 2026
**De:** Orchestrateur produit Amazon Pilot
**Source méthodo:** table signaux→BB produite par GPT (autorité VC) — **intégrée telle quelle**, non réinterprétée.
**Intègre les arbitrages de session :** calculs masqués (arb.1), IA minimale/déterministe (arb.2), par marché (arb.3), mapping GPT (arb.4).
**Statut:** spec de référence pour le brief de code du pré-scoring + champ `bbCandidates`.

---

## 0. CE QUE CETTE SPEC N'EST PAS
- ❌ Pas un brief de code (vient après).
- ❌ Pas une réinterprétation de la méthodo : la table GPT (§4) fait foi ; en cas de doute, on retourne à GPT, on ne tranche pas.
- ❌ Le pré-scoring ne **conclut pas** : il oriente. La conclusion d'un dossier reste gated (validation Fred).

---

## 1. Principe (décisions de session intégrées)

Le pré-scoring est **déterministe** (arb.2 = IA minimale : l'IA ne fait que parser la capture + rédiger la narration ; elle ne décide pas le faisceau). Il est calculé en **coulisses à l'import** (arb.1 = calculs masqués), stocké dans `a.suspectTag.bbCandidates` (le champ laissé `[]` jusqu'ici), **invisible au niveau Détecter**, exploité **instantanément** à l'ouverture de l'Agent BB. Calcul **par marché** (arb.3) ; entrée = **marché principal** = marché au plus gros **CA YTD** (année en cours) pour l'ASIN.

---

## 2. Deux temps de calcul

| Temps | Signaux | Quand |
|---|---|---|
| **Pré-score (masqué)** | déterministes **[D]** : `FO_views_zero`, `FO_views_chute`, `FO_views_hausse`, `stock_dormant`, `sellable_zero`, `defauts_BOL`, `PO_recent`, `PO_absent`, `ASN_CARP_anomalie` | à l'import, sans capture |
| **Affinage** | `needsPaste` **[NP]** : `detenteur_BB` (1P / 3P-FBA / 3P-dropship), `prix_concurrent`, `indisponible` | après collage page (parse IA) |

Le pré-score oriente immédiatement ; la capture lève la porte 1 (détenteur BB) et confirme portes 2/3.

---

## 3. Triage séquentiel — première porte bloquante dominante

Le moteur **ne somme pas aveuglément** : il cherche la **première porte qui bloque** (1·Présent → 2·Buyable → 3·Compétitif → 4·Rentable → 5·Fiable → 6·Éligible), qui donne la **cause dominante** ; les autres deviennent secondaires.

- **Porte 2 prime** sur concurrence/profitabilité/éligibilité : une offre non buyable ne concourt pas. `sellable_zero` → **BB-1 dominant** même si un 3P/prix concurrent existe (BB-5 secondaire).
- **Sans capture**, portes 3 (compétitif) et 1 (détenteur) ne donnent qu'un **pré-score de suspicion**.

---

## 4. Table signaux → causes BB (source GPT, intégrée telle quelle)

| BB | Libellé | Porte | Familles A→P | Détectable sans capture ? |
|---|---|---|---|---|
| BB-1 | Rupture / stock insuffisant | 2 | D | Oui si `sellable_zero` |
| BB-2 | Stock présent non sellable | 2 | E | Pré-score seul (NP `indisponible`) |
| BB-3 | Stock dormant / aged | 5 | E·F·O | Oui (`stock_dormant`) |
| BB-4 | Inbound ASN/BOL/CARP | 5 | G·P | Oui |
| BB-5 | Concurrence 3P / pricing | 3 | A·B·(H) | **Non concluant sans capture** |
| BB-6 | Catalogue / conformité | 6 | J·(L) | **Non** → `needsAdditionalData` |
| BB-7 | Promesse / géo | 3 | H·I | **Non** → `needsDeliveryPromise` |
| BB-8 | Profitabilité / CRaP | 4 | C·(D·O·P) | **Non déterministe** (jamais fort sans confirm. Amazon) |
| BB-9 | Cas mixte | porte la + basse | selon combinaison | étiquette de synthèse, conserve les sous-causes |
| BB-10 | Stock non trusted | 5 | F·G·P·(E) | Oui si inbound+stock+commercial |
| BB-11 | Sous-exposition durable | 1 | L·A·B·O·(C) | Forme, pas cause racine |
| BB-12 | FO par variation | 6 | K·(J) | **Non** → `needsVariationData` |

**Règles logiques** (extraites GPT, à transcrire) — résumé des seuils de niveau :
- **BB-1** : `sellable_zero` → modéré ; + (`indisponible` ou 3P) → fort.
- **BB-3** : `stock_dormant` seul → à confirmer ; +1 signal → modéré ; +2 → fort. `FO_views_hausse` persistante → −1 niveau (réveil).
- **BB-4** : 1 signal inbound + 1 conséquence → modéré ; BOL **et** ASN/CARP + conséquence → fort.
- **BB-10** : `countInbound ≥1` ET `countStock ≥1` ET `countCommercial ≥1` → fort ; 2/3 → modéré.
- **BB-5** : 3P → modéré ; 3P + `prix_concurrent` → fort ; FO seule → à confirmer.
- **BB-8** : `PO_absent`+`stock_dormant`+FO dégradées → modéré ; **jamais fort** sans confirmation rentabilité Amazon.
- **BB-9** : ≥2 causes de portes différentes ≥ modéré → fort, **conserver les sous-causes**.
- **BB-11** : chute persistante → modéré ; `FO_views_zero` persistant (ou chute+dormant) → fort.
- **BB-6/7/12** : posent un flag de donnée manquante (`needsAdditionalData` / `needsDeliveryPromise` / `needsVariationData`), pas une conclusion.

*(Le détail complet des règles GPT — conditions exactes par BB — est la référence ; ne pas le simplifier au-delà de ce résumé sans repasser par GPT.)*

---

## 5. Les 5 principes de pondération (GPT — à graver dans le moteur)

1. **Première porte bloquante = cause dominante** (ne pas présenter la concurrence prix comme initiale si la rupture suffit).
2. **Distinguer cause / facteur aggravant / conséquence** (ex. BB-10 cause, BB-4 facteur, BB-5 conséquence, BB-3 état, BB-11 forme).
3. **Ne pas surpondérer les symptômes FO** : `FO_views_*` sont des signaux **aval**, jamais suffisants seuls pour la cause racine.
4. **Anomalie inbound ≠ causalité** : faisceau fort seulement si proche temporellement + anomalie stock/PO + conséquence FO/ventes.
5. **Le réveil n'efface pas l'historique** : `FO_views_hausse` → `recoveryState='réveil'`, baisse d'un niveau l'état **actuel**, pas la cause historique.

---

## 6. Schéma de sortie (par ASIN × marché) — `bbCandidates`

```json
{
  "porteDominante": 5,
  "causeDominante": "BB-10",
  "causesSecondaires": ["BB-4","BB-3","BB-11"],
  "niveauFaisceau": "fort",
  "signauxSupport": ["stock_dormant","defauts_BOL","ASN_CARP_anomalie","FO_views_zero"],
  "signauxManquants": [],
  "needsPaste": ["detenteur_BB","prix_concurrent","indisponible"],
  "needsAdditionalData": [],
  "recoveryState": "aucun réveil",
  "explicationCourte": "..."
}
```
`explicationCourte` = **narration IA** (seule part IA du diagnostic, arb.2) ; tout le reste est déterministe. Calculé par marché ; `marketPrincipal` = CA YTD max.

---

## 7. Prérequis données à lever (Claude Code) avant le brief de code

1. **CA YTD par marché et par ASIN** pour dériver `marketPrincipal` — `ytdData['2026']` était signalé ABSENT dans l'audit moteur. Si non ingéré → prérequis d'ingestion.
2. Disponibilité par ASIN×marché des 9 signaux [D] (la plupart confirmés ingérés : `foViews`, `aged90`, `sellableUnits`, `pos`, `deliveryDefects`, ASN/CARP).
3. Définitions opérationnelles exactes à figer : seuils de `FO_views_chute` « persistante », fenêtre de proximité temporelle inbound↔chute (principe 4), durée N de `FO_views_zero` « durable ».

---

## 8. Ce qui reste avant le brief de code

- Lever §7 (surtout CA YTD).
- Trancher arbitrages **5** (frontière Recovery/Communication) et **6** (double usage offensif) — non couverts par cette spec.
- Puis brief de code : pré-scoring `computeBbCandidates` (à l'import, alimente `bbCandidates`) + `parseBuyBoxCapture` (IA) + réécriture `buyboxAutoEvaluateHypotheses`/`renderBuyBoxCase`.

---

[Agent Orchestrateur] — Source : table GPT (autorité VC, intégrée telle quelle) + arbitrages session 1-4 — Confiance : haute ; §4/§5 = méthodo GPT non simplifiable sans GPT ; §7 = prérequis données à lever
