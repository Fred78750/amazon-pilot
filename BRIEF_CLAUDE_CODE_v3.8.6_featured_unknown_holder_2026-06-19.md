# BRIEF CLAUDE CODE — v3.8.6 · État featured_unknown_holder + exploitation analytique

**Date:** June 19, 2026
**De:** Orchestrateur produit Amazon Pilot
**Pour:** Claude Code (via Fred)
**Cible:** v3.8.6 *[tag à confirmer]* — raffinement de la boucle v3.8.5. Corrige la sur-prudence révélée par le cadenas (featured présente classée `none` à tort).
**Référence NORMATIVE:** `SPEC_featured_unknown_holder` (GPT) — à déposer. Les états, marqueurs, narrations autorisées/interdites, impact BB = la spec, non réinterprétables.

---

## 0. CE QUE TU NE FAIS PAS (limites négatives)

- ❌ **Existence Featured ≠ identité détenteur** : ne jamais transformer « détenteur non identifiable » en « absence de Featured Offer ».
- ❌ **Mots interdits dans la narration** : « tiers », « concurrent », « Amazon a perdu », « aucune Buy Box », « état non stabilisé », « détenue par ». Le mot « tiers/concurrent » implique non-Amazon → non prouvé.
- ❌ **`detenteur_BB=null` ne renforce aucun BB** (ni BB-5, ni autre). Offres 3P listées ≠ preuve qu'un 3P détient la featured.
- ❌ **Ne pas arbitrer H1 (Amazon) vs H2 (3P)** sans preuve. Les deux restent ouvertes.
- ❌ **Narration générée UNIQUEMENT depuis les champs validés finaux** (garde-fou anti-contradiction §12).
- ❌ Pas de merge sans GO Fred.

---

## BLOC A — Nouvel état `featured_unknown_holder` (spec §1, §2, §3)
- `featuredOfferStatus` passe à 3 valeurs : `present` / `none` (+ détenteur résolu via `holderResolution`).
- Règle déterministe (§2.1) : `mainBuyBox` identifié + action d'achat featured présente + prix featured présent sans « à partir de » + **seller/shipper absents du mainBuyBox** → `featuredOfferStatus=present`, `holderResolution=unknown`, `detenteur_BB=null`.
- **Exclusion mutuelle (§3.3)** : si action d'achat featured présente → `featuredOfferStatus` ne peut JAMAIS être `none`. Si `none` → `featuredPrice=null` + `holderResolution=not_applicable`.
- `holderResolution ∈ {resolved, unknown, not_applicable}`.

## BLOC B — Confiance par champ (spec §1.3, §13)
Refactor `confidence` en objet : `{featuredOfferStatus, featuredPrice, detenteur_BB, listedOffers}`. Cas cadenas : existence/prix = haute, détenteur = basse. (Conserver une rétro-compat si du code lit `confidence` scalaire.)

## BLOC C — Exploitation analytique (spec §4, §13)
- `visibleListedOffers[]` (seller + price), `lowestListedOfferPrice`.
- `featuredPriceComparison` : `{status: lower_than_all_visible_listed_offers | ..., differenceToLowest}`.
- Constats autorisés (§7.1) uniquement : featured présente, prix prouvé, featured distincte des offres listées par le prix. **Hypothèses (§7.2)** stockées séparément dans `hypothesesNonDeterministes[]` — n'affectent AUCUN score.

## BLOC D — Re-capture ciblée (spec §8)
`featuredOfferStatus=present` + `detenteur_BB=null` → `needsTargetedRecapture = [seller_featured, shipper_featured, amazon_retail_presence]`. UI : proposer une recapture du **bas du bloc d'achat** (prix + boutons + lignes Vendu/Expédié + livraison). Porte 1 = `non_resolue` (ni franchie ni bloquée).
> **À vérifier au test** : si Amazon n'affiche pas de « Vendu par » pour sa propre featured, la recapture ne donnera rien → bascule `needsManualReview`. Ne pas boucler indéfiniment sur la recapture.

## BLOC E — Impact grille BB (spec §9, §10)
- **BB-1** : featured présente + achat actif → BB-1 ne peut être fort sur l'état actuel (exception `sellable_zero` Vendor = conflit de données, pas indispo storefront).
- **BB-2** : featured présente → BB-2 actuel ≤ à confirmer.
- **BB-5** : `detenteur_BB=null` → **à confirmer** (jamais renforcé par le détenteur). Featured < 3P visibles affaiblit l'hypothèse « 3P visible moins cher » sans éliminer un 3P non visible.
- **BB-7** : à confirmer + `needsDeliveryPromise`.
- **BB-8** : `featuredPrice` bas → **aucun** changement auto (fort uniquement sur retour Amazon « cost not profitable »).
- **BB-11** : forme conservée (historique FO views), jamais cause racine.

## BLOC F — Narration normative + garde-fou (spec §11, §12)
- Narration depuis champs validés finaux uniquement.
- Si `present` + `detenteur_BB=null` : narration DOIT contenir « Featured Offer présente » + « détenteur non prouvé » ; NE PEUT contenir « Amazon détient » / « un 3P détient » / « aucune Buy Box » / « tiers » / « concurrent » / « état non stabilisé ».
- Forme courte recommandée : « Featured Offer présente — détenteur non prouvé — prix inférieur aux offres listées visibles. »
- Le prompt de narration IA doit recevoir ces interdits explicitement.

## BLOC G — Tests
**5 cas de test spec §14** (featured sans détenteur ; featured + offres listées plus chères ; pas de featured = bâche ; featured 1P prouvée ; featured 3P FBA prouvée). PLUS, sur **fiches réelles** :
- **Cadenas B00PVPXVBE** → `featuredOfferStatus=present`, `holderResolution=unknown`, `detenteur_BB=null`, `featuredPrice=6,19`, `featuredPriceComparison=lower_than_all_visible`, narration conforme (sans « tiers/concurrent/non stabilisé »), `needsTargetedRecapture`. **Plus de `none`.**
- **Bâche B00AYCKLJE** → reste `none` (non-régression v3.8.5).
- **1P sain réel** → `holderResolution=resolved`, `detenteur_BB=1P_Amazon` (non dégradé).

STOP + BILAN : tableau des 5 tests + 3 fiches réelles (statut, holderResolution, narration, retry IA oui/non). Mesurer la **fréquence du ré-essai IA #2**. Validation Fred avant merge.

---

[Agent Orchestrateur] — Source : spec GPT featured_unknown_holder (autorité, normative) + incident cadenas — Confiance : haute ; « tiers/concurrent » interdits (corrige aussi mon propre constat antérieur) ; re-capture ciblée à éprouver au test (Amazon peut ne pas afficher « Vendu par »)
