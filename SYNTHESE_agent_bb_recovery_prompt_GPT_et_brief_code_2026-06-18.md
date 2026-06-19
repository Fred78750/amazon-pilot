# Synthèse Agent BB Recovery — Prompt GPT de validation + Brief de code

**Date:** June 18, 2026
**De:** Orchestrateur produit Amazon Pilot
**Objet:** pack de transmission pour la phase d'implémentation de l'Agent BB Recovery (niveau 2 · Diagnostiquer). Regroupe (A) le prompt de validation GPT réutilisable, (B) le brief de code Claude Code.
**Prérequis figés (déposés):** `CADRAGE_agent_bb_recovery_consolide` (6 arbitrages) · `SPEC_pre_scoring_bb_recovery_v2` (règles auditées + 9 définitions). Principe d'harmonisation acté : **l'Agent BB consomme les signaux du tag suspect, ne les recalcule jamais.**

---

# PARTIE A — Prompt GPT de validation (réutilisable)

> À réutiliser si la spec de pré-scoring est modifiée (nouvelle règle, nouveau signal) : on re-soumet à GPT pour vérifier qu'aucune dérive méthodo n'est introduite. Joindre la spec à auditer.

**Mission :** vérifier que la transcription (spec) ne déforme/omet/simplifie aucune règle méthodo. Ne pas réécrire la méthodo ; signaler uniquement les écarts.
**Gravité :** BLOQUANT (change porte/cause/résultat) · SIGNIFICATIF (change niveau/cause secondaire/flag) · MINEUR (formulation).
**Points de contrôle obligatoires :** (1) seuils de faisceau par BB (conditions nécessaires/suffisantes, nb et catégories de signaux, exceptions, interdits « fort ») ; (2) triage séquentiel (1ʳᵉ porte bloquante dominante ; cas `sellable_zero`+3P+prix → BB-1 dom / BB-5 sec) ; (3) flags de données manquantes (BB-6/7/12 + BB-8 jamais fort sans confirmation) ; (4) les 5 principes de pondération (Conforme/Partiel/Absent/Ambigu) ; (5) classification [D]/[NP] ; (6) schéma de sortie (porteDominante, causeDominante, causesSecondaires[], niveauFaisceau, signauxSupport[], signauxContradictoires[], signauxManquants[], needsPaste[], needsAdditionalData[], recoveryState, explicationCourte).
**Format réponse :** verdict global, puis par écart : `[GRAVITÉ] §X — BB-Y` / Spec / Méthodo source / Impact / Correction transcriptible. « Conforme » si rien. Ne pas inventer d'écart.
**Définitions à figer :** seuil chute significative, durée persistance, durée N zéro durable, fenêtre proximité inbound↔chute, `PO_recent`, délai non-transformation PO, récence `defauts_BOL`, durée réveil, départage 2 portes bloquées — pour chacune : définition / valeur défaut / paramétrable / justification. Séparer corrections de fidélité vs recommandations nouvelles. Ne jamais valider une règle ambiguë par défaut.

> **Statut :** ce prompt a été exécuté le 18/06 → verdict « corrections significatives nécessaires » → 10 corrections + 9 définitions intégrées dans `SPEC_pre_scoring_bb_recovery_v2`. La v2 est donc déjà validée par construction.

---

# PARTIE B — Brief de code Claude Code · Agent BB Recovery

**Cible:** v3.8.4 *[tag à confirmer Fred]*. Implémente le niveau 2. **Mergé prod groupé avec Détecter v3.8.3** (le module Buy Box part d'un bloc : Détecter + Diagnostiquer).

## 0. CE QUE TU NE FAIS PAS (limites négatives — lire en premier)
- ❌ **Ne recalcule AUCUN signal du tag suspect.** `FO_views_chute`, `FO_views_zero`, `stock_dormant` se **lisent** dans `a.suspectTag` (une seule définition de « chute » dans l'app). Factorisation.
- ❌ **IA = parser la capture + rédiger `explicationCourte` UNIQUEMENT.** Le faisceau (causes, niveaux) est **100 % déterministe**. L'IA ne décide pas la hiérarchie.
- ❌ **Ne conclut pas seul** : gate de conclusion conservé (validation Fred).
- ❌ **N'envoie rien à Amazon** : prépare le case, ne le dispatche pas (frontière = envoi, Communication v3.9).
- ❌ **`detenteur_BB = 3P` ne prouve PAS « Retail absent »** → porte 1 non résolue + flag (correction bloquante audit).
- ❌ **Ne traite pas le réveil offensif** (= `ASINs Potentiel`).
- ❌ Pas de scraping. Pas de merge sans GO Fred. IA via Lambda (jamais clé client-side) + instrumentation coût (model/tokens/scope, règle 29/05).

## Référence normative
Toute la logique de scoring suit **`SPEC_pre_scoring_bb_recovery_v2` §3-§7** (triage portes, règles par BB à listes fermées, schéma de sortie corrigé, 9 définitions). Ne pas réinterpréter — en cas de doute, retour à la spec/GPT.

---

## PHASE A — Moteur de pré-scoring `computeBbCandidates(client)` [déterministe]

1. Fonction pure, appelée dans `mergeImportData` **après** `computeSuspectTags` (dépend de `a.suspectTag`).
2. **Par marché** ; `marketPrincipal` = marché au plus gros **CA YTD** (calculé séparément, sert d'affichage par défaut, ne supprime pas les autres marchés — spec §1bis).
3. **Signaux [D] consommés** : chute/zéro/dormant **lus depuis `a.suspectTag`** ; dérivés depuis les données : `sellable_zero` (`sellableUnits=0`), `defauts_BOL` (`deliveryDefects` selon récence spec §7), `PO_recent`/`PO_absent` (`c.pos`, <8 sem), `ASN_CARP_anomalie` (`parseAppointmentsCSV`).
4. Applique **triage portes** (spec §3, dont porte 1 : pas de capture → porte 1 `needsPaste`) + **règles de niveau par BB** (spec §4, listes fermées).
5. Sortie → `a.suspectTag.bbCandidates` par marché, **schéma spec §6** (avec `signauxContradictoires`, `niveauFaisceauHistorique`/`Actuel`, `formeDominante`). `needsPaste[]` rempli (les [NP] absents tant que pas de capture).
6. **STOP** → rapport : nb ASINs par `causeDominante`, par `niveauFaisceauActuel`, nb avec `needsPaste`/`needsAdditionalData`. Confronté à la cohérence métier (Cogex). Validation avant Phase B.

## PHASE B — Capture `parseBuyBoxCapture(text, lang)` [pattern IA]

1. **2 zones de collage guidées** : copie 2 (bloc d'achat) **obligatoire** + copie 1 (éditoriale) complément. UI guide explicitement la copie du bon bloc (le test a montré qu'une copie pleine page rate le bloc d'achat).
2. Pattern IA (textarea → prompt → réponse structurée parsée), **pas de regex**. Via Lambda. Extrait : `detenteur_BB` (parser **« Vendu par » ET « Expédié par » séparément** → 1P / 3P_FBA / 3P_dropship), `prix_concurrent`, `indisponible`.
3. Réinjecte les [NP] → **recalcul du faisceau** avec les signaux capture (porte 1 résolue si 1P ; sinon flag présence Retail).
4. **STOP** → test sur ASIN réel (le cadenas B00PVPXVBE et un cas 3P). Validation avant Phase C.

## PHASE C — UI + dossier `renderBuyBoxCase` [réécriture complète]

1. **Réécriture complète** (pas patch) de `renderBuyBoxCase` : fil 3 agents (Diagnostiquer actif), capture 2 copies, **chaîne de confiance + point de rupture**, **timeline** (à quel maillon, quand), faisceau (cause dominante + secondaires + niveau historique/actuel + `signauxContradictoires`), **case structuré lié au faisceau** (chaque question fermée ↔ cause testée — garde-fou Arb.5).
2. **Réécriture `buyboxAutoEvaluateHypotheses`** : logique BB-1→12 (remplace les 3 IDs en dur).
3. **Réutilise la plomberie Phase 2** (7 fonctions/11 telles quelles : CRUD, journal, gate conclusion ≥3 entrées, close).
4. **Étend le schéma `buyboxCases`** pour porter tout le contexte (faisceau, signaux, chaîne, timeline, capture, case structuré) — garde-fou Arb.5 : Communication ré-ouvrira le dossier complet.
5. Bouton « préparer le case » → case structuré ; **PAS d'envoi**. Le routage utilisateur depuis Détecter (« Lancer l'Agent BB ») pointe désormais vers ce vrai écran (fin du stub).
6. **STOP** → validation visuelle Fred (narration : l'écran raconte-t-il le diagnostic ?).

## Process
Pipeline staging → preprod, **STOP à chaque phase**. Anti-régression 4 blocs. Pré-push : scope livré vs brief (anti-Zélé). Merge prod **groupé Détecter + Diagnostiquer** sur GO Fred.

---

# Références (déposées)
`CADRAGE_agent_bb_recovery_consolide_2026-06-18` · `SPEC_pre_scoring_bb_recovery_v2_2026-06-18` · `CADRAGE_architecture_module_buybox_2026-06-18` · maquette `Agent_BB_Recovery`.

---

[Agent Orchestrateur] — Source : cadrage consolidé + spec v2 auditée + arbitrages session — Confiance : haute ; brief découpé en 3 phases STOP pour livraison incrémentale ; scoring = spec v2 normative, non réinterprétable
