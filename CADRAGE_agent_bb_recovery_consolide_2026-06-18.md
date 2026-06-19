# Cadrage Agent BB Recovery — CONSOLIDÉ (6 arbitrages tranchés)

**Date:** June 18, 2026
**De:** Orchestrateur produit Amazon Pilot
**Statut:** document de référence FIGÉ du niveau 2 (Diagnostiquer). Remplace le cadrage initial. Précède le brief de code.
**Source méthodo:** maquette `Agent_BB_Recovery` validée + table GPT signaux→BB (autorité, intégrée telle quelle — voir `SPEC_pre_scoring_bb_recovery`).

---

## 0. CE QUE L'AGENT NE FAIT PAS
- ❌ Ne conclut pas seul (faisceau proposé ; conclusion d'un dossier gated = validation Fred).
- ❌ Ne scrape pas (capture = collage manuel).
- ❌ N'envoie rien à Amazon (préparer ≠ envoyer ; l'envoi = Agent Communication v3.9).
- ❌ N'invente aucune donnée ni aucune cause (un signal absent reste absent).
- ❌ Ne re-détecte pas (reçoit un ASIN détecté au niveau 1).
- ❌ Ne traite pas le réveil offensif (= `ASINs Potentiel`, défensif pur ici).

---

## 1. Position
Reçoit un ASIN depuis Détecter (« Lancer l'Agent BB ») + son contexte. Produit diagnostic + dossier + case prêt-à-partir. Maillons : Stock → Buy Box.

---

## 2. LES 6 ARBITRAGES — TRANCHÉS

**Arb.1 — Pré-diagnostic avant capture, affiné par capture.** Calculs **masqués** à l'import (champ `bbCandidates`, invisible au niveau Détecter), exploités instantanément à l'ouverture de l'agent. La capture lève la porte 1 (détenteur BB) + confirme portes 2/3.

**Arb.2 — IA minimale.** Le faisceau est **100 % déterministe** (règles sur signaux + capture parsée). L'IA fait deux choses seulement : **parser la capture** (`parseBuyBoxCapture`) + **rédiger la narration** (`explicationCourte`). Elle ne décide pas la hiérarchie des causes.

**Arb.3 — Par marché ; entrée = marché principal.** Diagnostic par marché (la Buy Box, les FO views et la capture sont par marché). Entrée = **marché principal = marché au plus gros CA YTD** pour l'ASIN (donne la tendance) ; bascule possible vers les autres marchés concernés.

**Arb.4 — Mapping signaux→BB = table GPT, intégrée telle quelle.** Triage séquentiel par porte (1ʳᵉ porte bloquante = cause dominante), 5 principes de pondération, schéma de sortie `bbCandidates`. Détail figé dans `SPEC_pre_scoring_bb_recovery_2026-06-18.md`. Non simplifiable sans repasser par GPT.

**Arb.5 — Frontière = ENVOI. Recovery prépare, Communication envoie.** Recovery va jusqu'au **case rédigé** ; Communication (v3.9) valide/édite/envoie/suit. **3 garde-fous OBLIGATOIRES** (sinon brouillon orphelin) :
1. Tout le diagnostic **persisté dans le dossier** `buyboxCases` (faisceau, signaux, needsPaste confirmés, chaîne, timeline, capture, journal) — pas que le brouillon.
2. Case **structuré, lié au faisceau** : chaque question fermée rattachée à la cause qu'elle teste (« fiabilité stock ← BB-10 »). Jamais un bloc plat.
3. Communication **ré-ouvre le dossier complet**, pas le seul brouillon.
+ La frontière envoi reste **infranchissable côté Recovery** (action irréversible → validation KAM).

**Arb.6 — Réveil offensif HORS Agent BB.** Détection/traitement = `ASINs Potentiel` (existant, inchangé). Rendu visuel **maintenant** = dans la **lentille Exposition** du Détecter (catégorie Opportunités, signature réveil teal) + renvoi vers `ASINs Potentiel`. Agent BB = **défensif pur**. Backlog : refonte UX `ASINs Potentiel` (chantier séparé, plus tard).

---

## 3. Flux cible
1. Pré-diagnostic masqué (données ingérées) → faisceau partiel à l'ouverture.
2. Capture page (2 collages guidés : bloc d'achat obligatoire + éditoriale complément ; parse IA).
3. Reconstruction chaîne de confiance + timeline (où ça casse, quand).
4. Faisceau BB-1→12 / familles A→P (déterministe, table GPT).
5. Dossier (plomberie Phase 2 réutilisée : 7 fonctions/11 ; réécrire `buyboxAutoEvaluateHypotheses` + `renderBuyBoxCase`).
6. Case structuré lié au faisceau → relais Agent Communication (v3.9).

---

## 4. Prérequis données — LEVÉS / LÉGERS (plus de blocage)
- **CA YTD par ASIN×marché** (`marketPrincipal`) = **import Ventes mode « Personnaliser »** 1ᵉʳ janv → aujourd'hui (flux existant, comme les annuels 2024/2025 ; ventilation marché via la structure des comptes). À faire une fois. Trivial pour Cogex mono-FR ; utile pour Gers multi-marché.
- **9 signaux [D]** par ASIN×marché : déjà ingérés (foViews, aged90, sellableUnits, pos, deliveryDefects, ASN/CARP) — confirmé par audit.
- **Définitions de seuils à figer** : chute « persistante », fenêtre proximité inbound↔chute (principe 4), durée N du zéro « durable » → réutiliser les seuils du tag suspect (`SUSPECT_CONFIG`).

---

## 5. Ce qui reste avant le brief de code
1. Faire **valider la spec de pré-scoring par GPT** (c'est sa méthodo — confirmation, pas re-production).
2. Figer les définitions de seuils (§4).
3. Puis **brief de code** : `computeBbCandidates` (pré-scoring à l'import → `bbCandidates`) + `parseBuyBoxCapture` (IA) + réécriture `buyboxAutoEvaluateHypotheses` / `renderBuyBoxCase` (UI 6 portes / familles / capture / case structuré) + extension schéma `buyboxCases` pour porter le contexte (garde-fou Arb.5).

---

## 6. Annexes
- `SPEC_pre_scoring_bb_recovery_2026-06-18.md` — table GPT + règles logiques + schéma sortie (référence du pré-scoring).
- `CADRAGE_architecture_module_buybox_2026-06-18.md` — architecture du module 3 agents.
- Maquette `Agent_BB_Recovery` — expérience cible validée.

---

[Agent Orchestrateur] — Source : 6 arbitrages tranchés session 18/06 + table GPT + maquette validée — Confiance : haute ; §5.1 (validation GPT) + §4 (seuils) à lever avant le brief de code ; fond VC = autorité GPT
