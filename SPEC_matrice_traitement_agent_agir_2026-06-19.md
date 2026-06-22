# Spec — Matrice de traitement à la racine (Agent Agir 03) · synthèse

**Date:** June 19, 2026
**De:** Orchestrateur produit Amazon Pilot
**Source:** matrice GPT « Matrice de traitement à la racine BB-1→12 » (autorité méthodo VC) — **adoptée telle quelle**, normative. Ce document en est la synthèse exploitable ; le détail par cause = la matrice GPT, non simplifiable sans GPT.
**Statut:** base de conception de l'Agent Agir (03). **N'est PAS un brief de code** — l'Agir ne s'implémente qu'après validation prod du diagnostic (v3.8.6).

---

## 0. PRINCIPES NORMATIFS (gravés)
- **Investiguer ≠ Traiter.** Investiguer = obtenir la donnée manquante / faire confirmer la cause. Traiter = supprimer/réduire effectivement la cause. Un case Amazon n'est pas automatiquement un traitement.
- **Validation humaine obligatoire** sur TOUTE action à effet (envoi de case, prix de cession, ASN, rebooking, catalogue, promo, escalade KAM). L'outil produit une **proposition**, jamais une exécution. `humanApprovalRequired: true` câblé dans le modèle.
- **Honnêteté sur le non-traitable** : si aucun levier économiquement/opérationnellement raisonnable n'existe, le dire explicitement (ex. 3P légitime moins cher).
- **Routes Vendor Central** affichées avec `routeUiStatus = "à confirmer dans l'interface"` par défaut, sauf observation directe dans le compte. Libellés = PROBABLE sauf mention CERTAIN.

## 1. Routes opérationnelles (référentiel)
`ROUTE-RAV` (Retail Availability) · `ROUTE-COST` (prix de cession, CERTAIN pour Items→Edit Item Costs) · `ROUTE-ASN` (ASN/DESADV) · `ROUTE-CARP` (RDV/Carrier Central) · `ROUTE-CATALOG` (catalogue/conformité) · `ROUTE-KAM` (escalade, INCERTAIN car dépend du compte). Détail FR/EN dans la matrice GPT §1.

## 2. Structure par cause (matrice GPT §3-14)
Chaque BB porte : **Pré-requis** (agir directement vs investiguer d'abord) · **Investigation** (objectif + route + questions fermées) · **Traitement interne/Vendor** · **Traitement Amazon** · **Traitement transporteur** (BB-4) · **Séquence** · **Causes peu/non traitables** · **Mesure de succès** · **Délai de re-mesure**.

Synthèse des leviers dominants :
- **BB-1** rupture : réappro + ASN propre → RAV si non-retour. Re-mesure 48-72h puis J+7.
- **BB-2** stock non sellable : investigation obligatoire (sous-statut), preuves Vendor, réconciliation Amazon (interne). 3-10 j.
- **BB-3** dormant : chercher d'abord *pourquoi* (BB-5/8/10/6) puis levier commercial (coût/funding/promo). 7-30 j.
- **BB-4** inbound : sécuriser flux ASN/BOL/CARP + transporteur. Immédiat (futur) / 3-15 j (réconciliation).
- **BB-5** concurrence/prix : prouver le détenteur d'abord. Leviers limités (coût/funding) ; **accepter la perte si 3P légitime moins cher**. 24-72h.
- **BB-6** catalogue : donnée obligatoire (ROUTE-CATALOG), corriger le motif exact. 2-7 j (catalogue) / semaines (compliance).
- **BB-7** promesse : collecter délais/CP/Prime ; repositionnement = interne Amazon. 3-14 j.
- **BB-8** rentabilité : **jamais agir sans confirmation Amazon OU analyse économique** ; simuler baisse coût → validation humaine → soumettre. Non garanti. 3-10 j+.
- **BB-10** stock non trusted : arrêter la répétition d'anomalies, preuves, réconciliation, réceptions propres. 1-4 sem.
- **BB-12** variation : auditer **enfant par enfant**, ne jamais généraliser. 2-7 j.

## 3. Cas spéciaux
- **BB-11** (forme, pas cause) : **aucun traitement direct.** Ouvrir une investigation pour reclasser le phénomène (BB-1/2/3/5/6/7/8/10/12). Aucune probabilité autonome ; KPI = celui de la cause trouvée.
- **BB-9** (mixte) : ne jamais effacer les sous-causes. Ordre : (1) première porte bloquante 1→6, (2) dépendance causale, (3) risque opérationnel critique corrigé tout de suite, (4) à porte égale = la plus prouvée/réversible/impactante. Chaque sous-cause a son KPI.
- **`featured_unknown_holder`** : `treatmentPlanStatus = suspended`, **re-capture ciblée d'abord**. Interdits tant que détenteur non prouvé : pas de BB-5 modéré/fort, pas de « Retail absent », pas de « 3P détient », pas de baisse de prix comme traitement principal, pas de case concurrence. Exception : une autre cause déjà confirmée (ex. BB-8 sur retour Amazon) peut être traitée indépendamment.

## 4. Gabarit de sortie de l'Agent Agir (matrice GPT §16, normatif)
```json
{
  "bbCause": "BB-8", "diagnosticLevel": "fort",
  "actionReadiness": "ready_after_human_validation",
  "investigationRequired": true,
  "investigation": { "objective": "...", "routeCode": "ROUTE-COST", "routeFr": [...], "routeEn": [...], "confidence": "PROBABLE" },
  "rootTreatment": [ { "actor": "Vendor|Amazon|Carrier", "action": "...", "confidence": "CERTAIN|PROBABLE|INCERTAIN", "humanApprovalRequired": true } ],
  "sequence": [...], "successMetrics": [...], "remeasureAfter": "3-10 jours",
  "limitations": [...]
}
```

## 5. Règle finale (matrice GPT §17)
Cause non établie → proposer investigation ciblée. Établie → proposer traitement racine. Dépend d'Amazon → distinguer action Vendor / décision Amazon. Aucun levier raisonnable → le dire. BB-11 → chercher la cause sous-jacente. BB-9 → ordre causal+séquentiel. `featured_unknown_holder` → résoudre l'identité avant tout.

---

## 6. Implications produit (séquençage — décisions à prendre)
- **L'Agir produit deux types de sortie** : `actionType: investigation` (obtenir la donnée) vs `treatment` (proposer une action). Cohérent avec la frontière Recovery/Communication (arb.5) : Recovery prépare, l'humain valide, Communication envoie.
- **La mesure de succès + délai de re-mesure** par cause = la base de la **boucle de suivi** (capture → action → re-capture → delta) et du **dashboard ROI**. Câbler `successMetrics` + `remeasureAfter` dès la conception de l'Agir.
- **`routeUiStatus`** : prévoir que Fred confirme/observe les libellés réels dans le compte → passage PROBABLE→CERTAIN au fil de l'usage.

## 7. CE QUI RESTE AVANT TOUT CODE DE L'AGIR
1. **Valider le diagnostic en prod** (v3.8.6 terrain + merge groupé) — l'Agir se construit sur le diagnostic ; pas de socle non validé.
2. Cadrer l'Agent Agir (arbitrages produit : où vit la proposition, comment l'humain valide, lien avec Communication v3.9).
3. Puis brief de code.

---

[Agent Orchestrateur] — Source : matrice GPT (autorité, adoptée telle quelle) — Confiance : haute ; détail par cause = matrice GPT non simplifiable ; routes Vendor Central = PROBABLE à confirmer en compte ; conception, pas code — l'Agir attend la validation prod du diagnostic
