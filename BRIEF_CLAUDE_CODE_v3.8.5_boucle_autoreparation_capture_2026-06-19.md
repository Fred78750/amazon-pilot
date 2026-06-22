# BRIEF CLAUDE CODE — v3.8.5 · Boucle d'auto-réparation du parse de capture

**Date:** June 19, 2026
**De:** Orchestrateur produit Amazon Pilot
**Pour:** Claude Code (via Fred)
**Cible:** v3.8.5 *[tag à confirmer]* — corrige `parseBuyBoxCapture` (Jalon 2). Cause : le parse a affirmé un détenteur Buy Box (« 3P FBA LE DEPOT BAILLEUL 8,99 € ») non prouvé par la page réelle.
**Référence NORMATIVE:** `SPEC_boucle_autoreparation_capture` (GPT, autorité méthodo) — à déposer. **Les RF-01→18, les signatures, les 8 cas de test = la spec, non réinterprétables.** Ce brief organise l'implémentation, il ne réécrit pas les règles.

---

## 0. CE QUE TU NE FAIS PAS (limites négatives)

- ❌ **Aucune affirmation sans citation exacte** ancrée dans le texte collé (`evidence.quote` retrouvable dans `rawText`). Une valeur non citée est invalide.
- ❌ **Une offre du panneau « Toutes les offres » n'est JAMAIS promue en Featured Offer** par défaut.
- ❌ **Un prix précédé de « à partir de » n'est JAMAIS `featuredPrice`** → `lowestListedOfferPrice`.
- ❌ **L'IA ne contourne JAMAIS une règle bloquante.** Le validateur déterministe est l'autorité finale (hiérarchie spec §5.9 : texte source > citations > validateur > parse IA > narration IA).
- ❌ **Max 2 appels IA par capture** (1 parse + 1 ré-essai critique). Pas de 3ᵉ tentative. Instrumentation coût (feature `bb_capture`).
- ❌ Ne touche pas au scoring déterministe du tag suspect. Pas de merge sans GO Fred.

---

## BLOC A — Segmentation en zones (spec §2)
Avant extraction, segmenter `rawText` en zones : `productHeader / selectedVariant / mainBuyBox / allOffersPanel / alternativeSellers / recommendations / otherVariants / unknown`. Marqueurs d'entrée en zone « offres listées » = liste fermée spec §2.2. **Aucun détenteur Featured extrait depuis `allOffersPanel` & co.** Qualification `mainBuyBox` = règle spec §2.3 (≥2 catégories dont action d'achat). Fenêtre de proximité 500 car. / 12 lignes (§2.4, paramétrable).

## BLOC B — Schéma de sortie enrichi (spec §0, §5.2)
Chaque champ porte `{ value, confidence, evidence:{quote,start,end,zone}, validationStatus, reason }`. `validationStatus ∈ {validated, ambiguous, contradicted, unproven}`. Nouveaux champs : `featuredOfferStatus` (1P/3P_FBA/3P_dropship/none), `lowestListedOfferPrice`, `listedOffers[]`, `variantAvailabilityIssue`, `possible_state_leak`. **Étend `tag.bbCapture`** — anticipe que `computeBbCandidates` lira ces champs.

## BLOC C — Validateur déterministe (spec §3, §5.3) — cœur du correctif
Implémente les **red flags RF-01→18** (spec §3, listes fermées). Bloquants (RF-01→08) invalident le champ ; forts (RF-09→18) exigent preuve ou dégradent. Pour chaque champ : citation existe ? retrouvable exactement ? contient la valeur ? zone autorise ce type ? marqueurs présents ? red flag ? contradiction ? Sortie : `{isValid, errors[], invalidFields[], repairableFields[], requiresRetry}`.

## BLOC D — Réparation déterministe SANS 2ᵉ appel IA (spec §5.4)
Cas auto-réparables sans IA : prix « à partir de » → `lowestListedOfferPrice` ; offre listée → `detenteur_BB=null` + conservée dans `listedOffers[]` ; confiance incohérente → basse ; indispo variante ambiguë → `null` + `variantAvailabilityIssue` ; absence featured démontrée → `featuredOfferStatus=none`.

## BLOC E — Ré-essai IA critique CONDITIONNEL (spec §5.5, §5.6)
Déclenche **uniquement** si ambiguïté réparable par relecture (plusieurs zones/vendeurs/prix, variante ambiguë). **Ne déclenche PAS** si valeur absente du texte / aucun marqueur vendeur / pas de bouton featured / texte insuffisant / réparation déterministe suffit. Prompt de ré-essai = spec §5.6 (7 règles impératives, dont « n'utilise aucune valeur d'un parse précédent »). Re-validation déterministe après (§5.7). Échec → dégradation sûre.

## BLOC F — Repli sûr + impact aval (spec §4)
Doute → `detenteur_BB=null`, `confidence=basse`, `validationStatus=ambiguous/unproven`, motif. Jamais « unknown seller / probablement Amazon ». Impact portes : `detenteur_BB=null` → porte 1 **non résolue** ; si capture déjà fournie mais ambiguë → `needsManualReview += detenteur_BB` (distinct de `needsPaste`). **Jamais** « Retail absent/présent » ni « BB-5 confirmé ». BB-5/BB-7 ne sont pas renforcés par un parse ambigu. Conserver les infos partielles valides (ex. `featuredOfferStatus=none` + `lowestListedOfferPrice` même sans détenteur).

## BLOC G — Journalisation (spec §5.10)
Conserver par parse : `rawTextHash`, `initialResult`, `validationErrors`, `deterministicRepairs`, `retryTriggered`, `retryResult`, `finalValidationErrors`, `finalResult`, `manualReviewRequired`. Reproductible/auditable — pas seulement le résultat final.

---

## Validation — les 8 cas de test obligatoires (spec §6) + le cas réel

STOP + BILAN sur les **8 tests de la spec**, ET en priorité le **cas réel qui a déclenché ce correctif** :
- **Bâche B00AYCKLJE** (« à partir de 21,68 € / Voir toutes les offres / Ajouter à votre liste ») → doit donner `featuredOfferStatus=none`, `detenteur_BB=null`, `lowestListedOfferPrice=21,68`, **PAS** « 3P FBA 8,99 € ». Si `possible_state_leak` se déclenche (donnée résiduelle du test Jalon 2), le signaler.
- Re-tester aussi les cas qui marchaient (1P Amazon, 3P dropship du cadenas) → ne pas régresser.

Bilan attendu : tableau des 8 tests (attendu vs obtenu) + le cas bâche. **Validation Fred avant merge.**

---

[Agent Orchestrateur] — Source : spec GPT boucle auto-réparation (autorité, normative) + incident bâche B00AYCKLJE — Confiance : haute ; validateur déterministe = autorité finale ; le bilan se juge sur les 8 tests + le cas réel, pas sur « ça tourne »
