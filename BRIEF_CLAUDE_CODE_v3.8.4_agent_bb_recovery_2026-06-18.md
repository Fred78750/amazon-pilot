# BRIEF CLAUDE CODE — v3.8.4 · Agent BB Recovery (niveau 2 · Diagnostiquer)

**Date:** June 18, 2026
**De:** Orchestrateur produit Amazon Pilot
**Pour:** Claude Code (via Fred)
**Cible:** v3.8.4 *[tag à confirmer Fred]* — implémente le niveau 2. **Mergé prod groupé avec Détecter v3.8.3** (le module Buy Box part d'un bloc).
**Référence normative:** `SPEC_pre_scoring_bb_recovery_v2` (§3-§7) + `CADRAGE_agent_bb_recovery_consolide` (6 arbitrages). Le scoring suit la spec v2, non réinterprétable.

> **Vue d'ensemble d'abord.** Lis tout le brief avant de coder : le schéma `buyboxCases` (jalon 3) doit être anticipé dès le jalon 1, et le faisceau (jalon 1) doit être recalculable par la capture (jalon 2). Tu implémentes les 3 jalons d'un même chantier ; tu t'**arrêtes et fais un bilan à chaque jalon** (STOP), tu ne livres pas les 3 d'un bloc.

---

## 0. CE QUE TU NE FAIS PAS (limites négatives)

- ❌ **Ne recalcule AUCUN signal du tag suspect.** `FO_views_chute` / `FO_views_zero` / `stock_dormant` se **lisent** dans `a.suspectTag` (une seule définition de « chute » dans l'app — factorisation).
- ❌ **IA = parser la capture + rédiger `explicationCourte` UNIQUEMENT.** Le faisceau (causes, niveaux, hiérarchie) est **100 % déterministe**.
- ❌ **Ne conclut pas seul** : gate de conclusion conservé (validation Fred).
- ❌ **N'envoie rien à Amazon** : prépare le case, ne le dispatche pas (frontière = envoi → Communication v3.9).
- ❌ **`detenteur_BB = 3P` ne prouve PAS « Retail absent »** → porte 1 NON résolue + flag `presence_Retail_autres_offres`.
- ❌ **Ne traite pas le réveil offensif** (= `ASINs Potentiel`, hors scope).
- ❌ Pas de scraping. IA via Lambda (jamais clé client-side) + instrumentation coût (model/tokens/scope). Pas de merge sans GO Fred.

---

## JALON 1 — Moteur `computeBbCandidates(client)` [déterministe]

1. Fonction pure, appelée dans `mergeImportData` **après** `computeSuspectTags` (dépend de `a.suspectTag`).
2. **Par marché.** `marketPrincipal` = marché au plus gros **CA YTD** (calculé séparément ; affichage par défaut ; ne supprime pas les autres marchés — spec §1bis).
3. **Signaux [D]** : chute/zéro/dormant **lus de `a.suspectTag`** ; dérivés : `sellable_zero` (`sellableUnits=0`), `defauts_BOL` (`deliveryDefects`, récence spec §7), `PO_recent`/`PO_absent` (`c.pos`, <8 sem), `ASN_CARP_anomalie` (`parseAppointmentsCSV`).
4. **Triage portes (spec §3)** + **règles de niveau par BB (spec §4, listes fermées)**. Porte 1 sans capture = `needsPaste`.
5. Sortie → `a.suspectTag.bbCandidates` par marché, **schéma spec §6 complet** (`signauxContradictoires`, `niveauFaisceauHistorique`/`Actuel`, `formeDominante`, `needsPaste[]`, `needsAdditionalData[]`).
6. **STOP + BILAN** : rapport de comptage (nb par `causeDominante`, par `niveauFaisceauActuel`, nb `needsPaste`/`needsAdditionalData`), confronté à la cohérence métier Cogex. **Validation Fred/Orchestrateur avant jalon 2.**

---

## JALON 2 — Capture `parseBuyBoxCapture(text, lang)` [pattern IA]

1. **2 zones de collage guidées** : copie 2 (bloc d'achat) **obligatoire** + copie 1 (éditoriale) complément. L'UI **guide explicitement** la copie du bloc d'achat (un Ctrl+A pleine page le rate).
2. Pattern IA (textarea → prompt → réponse structurée parsée), **pas de regex**, via Lambda. Extrait : `detenteur_BB` (parser **« Vendu par » ET « Expédié par » séparément** → 1P / 3P_FBA / 3P_dropship), `prix_concurrent`, `indisponible`.
3. Réinjecte les [NP] → **recalcule le faisceau** (porte 1 résolue si 1P ; sinon flag présence Retail). Met à jour `bbCandidates`.
4. **STOP + BILAN** : test sur ASIN réel (le cadenas B00PVPXVBE + un cas 3P type LE DEPOT BAILLEUL). **Validation avant jalon 3.**

---

## JALON 3 — UI + dossier `renderBuyBoxCase` [réécriture complète]

1. **Réécriture complète** (pas patch) : fil 3 agents (Diagnostiquer actif), capture 2 copies, **chaîne de confiance + point de rupture**, **timeline** (à quel maillon, quand), faisceau (cause dominante + secondaires + niveau historique/actuel + `signauxContradictoires`), **case structuré lié au faisceau** (chaque question fermée ↔ cause testée — garde-fou Arb.5).
2. **Réécriture `buyboxAutoEvaluateHypotheses`** : logique BB-1→12 (remplace les 3 IDs en dur).
3. **Réutilise la plomberie Phase 2** (7 fonctions/11 : CRUD, journal, gate conclusion ≥3 entrées, close).
4. **Étend le schéma `buyboxCases`** pour porter tout le contexte (faisceau, signaux, chaîne, timeline, capture, case structuré) → Communication ré-ouvrira le dossier complet. *(À anticiper dès jalon 1.)*
5. Bouton « préparer le case » → case structuré ; **PAS d'envoi**. Le routage « Lancer l'Agent BB » (depuis Détecter) pointe vers ce vrai écran — **fin du stub**.
6. **STOP + BILAN** : validation visuelle Fred (l'écran raconte-t-il le diagnostic ?).

---

## Process
Pipeline staging → preprod. **STOP + bilan à chaque jalon** (1, 2, 3). Anti-régression 4 blocs. Pré-push : scope livré vs brief (anti-Zélé). Merge prod **groupé Détecter v3.8.3 + Diagnostiquer v3.8.4** sur GO Fred.

---

[Agent Orchestrateur] — Source : cadrage consolidé + spec v2 normative + principe d'harmonisation (consommer, pas recalculer) — Confiance : haute ; 1 chantier / 3 jalons STOP ; scoring = spec v2, non réinterprétable
