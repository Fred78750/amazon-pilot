# Spécification méthodologique — Boucle d’auto-réparation du parse de capture Buy Box
## 0. Principe normatif
Aucun champ extrait ne peut être validé sans preuve textuelle exacte.

Un résultat plausible mais non cité est invalide.

Une offre listée n’est jamais assimilée à la Featured Offer
sans marqueur explicite du bloc d’achat principal.
Chaque champ extrait doit comporter :
{
  "value": null,
  "confidence": "basse",
  "evidence": {
    "quote": null,
    "start": null,
    "end": null
  },
  "validationStatus": "unproven",
  "reason": "..."
}
Valeurs autorisées de validationStatus :
validated
ambiguous
contradicted
unproven

# 1. Signatures textuelles fiables
## 1.1 Règle générale de validation du détenteur
Un détenteur de Featured Offer n’est validé que si les trois conditions suivantes sont réunies :
A. Une signature vendeur/expéditeur est présente.
B. Cette signature appartient au bloc d’achat principal.
C. Le même bloc contient une action d’achat Featured.
Actions d’achat Featured admissibles :
Ajouter au panier
Acheter cet article
Acheter maintenant
Commander
Variantes linguistiques équivalentes autorisées si le marché n’est pas français.
Une signature vendeur/expéditeur sans action d’achat Featured adjacente ne prouve pas le détenteur de la Buy Box.

## 1.2 1P_Amazon
### Signature forte
Vendu par Amazon
ET
Expédié par Amazon
ET
action d’achat Featured dans le même bloc
Ou formulation fusionnée :
Vendu et expédié par Amazon
ET
action d’achat Featured dans le même bloc
### Variantes Amazon admissibles
Amazon
Amazon EU S.à r.l.
Amazon EU
Amazon.com
Amazon.co.uk
Amazon.de
Amazon.fr
Amazon Retail
La valeur doit être normalisée en :
"detenteur_BB": "1P_Amazon"
### Règle logique
IF seller_is_amazon
AND shipper_is_amazon
AND featured_purchase_action_same_block
AND NOT inside_all_offers_panel
THEN detenteur_BB = 1P_Amazon
### Ce qui ne suffit pas
Expédié par Amazon
seul ne prouve pas le 1P : il peut s’agir d’un 3P FBA.
Vendu par Amazon
sans action d’achat Featured ne prouve pas que l’offre Amazon détient la Buy Box.

## 1.3 3P_FBA
### Signature forte
Vendu par [vendeur non Amazon]
ET
Expédié par Amazon
ET
action d’achat Featured dans le même bloc
### Règle logique
IF seller_is_not_amazon
AND shipper_is_amazon
AND featured_purchase_action_same_block
AND NOT inside_all_offers_panel
THEN detenteur_BB = 3P_FBA
Sortie :
{
  "detenteur_BB": "3P_FBA",
  "sellerName": "[nom exact cité]"
}
### Règle de non-confusion
IF "Vendu par X / Expédié par Amazon"
appears after:
- Voir toutes les offres
- Autres vendeurs
- X options à partir de
- Neuf à partir de
- D’occasion à partir de
THEN cette signature est une offre listée
AND ne valide pas detenteur_BB

## 1.4 3P_dropship
### Signature forte
Vendu par [vendeur non Amazon]
ET
Expédié par [vendeur non Amazon]
ET
action d’achat Featured dans le même bloc
Ou :
Vendu et expédié par [vendeur non Amazon]
ET
action d’achat Featured dans le même bloc
### Règle logique
IF seller_is_not_amazon
AND shipper_is_not_amazon
AND featured_purchase_action_same_block
AND NOT inside_all_offers_panel
THEN detenteur_BB = 3P_dropship
### Cas ambigu
Si le texte contient :
Vendu par X
mais aucun expéditeur identifiable :
detenteur_BB = null
confidence = basse
reason = "Expéditeur non prouvé"
Ne jamais déduire FBA ou dropship depuis le nom du vendeur.

## 1.5 Absence de Featured Offer
### Signature forte d’absence
Combinaison recommandée :
présence de :
- Voir toutes les offres
OU
- X option(s) à partir de
OU
- Neuf à partir de
OU
- Disponible auprès de ces vendeurs

ET absence de :
- Ajouter au panier
- Acheter maintenant
- bloc vendeur/expéditeur principal
Marqueurs complémentaires :
Ajouter à votre liste
Voir les options d’achat
Aucune offre en vedette disponible
Aucune offre actuellement en vedette
Afficher toutes les options d’achat
### Règle logique
IF all_offers_cta_present
AND featured_purchase_action_absent
AND featured_seller_shipper_block_absent
THEN featuredOfferStatus = "none"
AND detenteur_BB = null
### Niveau de confiance
Fort :
all_offers_cta + absence bouton panier + absence vendeur/expéditeur principal

Modéré :
all_offers_cta + absence bouton panier,
mais structure du collage incomplète

Faible :
simple absence du bouton panier dans un texte potentiellement tronqué
### Cas réel type
1 option à partir de 21,68 €
Voir toutes les offres
Ajouter à votre liste
sans :
Ajouter au panier
Vendu par
Expédié par
doit donner :
{
  "featuredOfferStatus": "none",
  "detenteur_BB": null,
  "featuredPrice": null,
  "confidence": "haute"
}
Le prix 21,68 € est alors :
lowestListedOfferPrice
et jamais :
featuredPrice

## 1.6 indisponible
### Signature textuelle
Actuellement indisponible
Temporairement en rupture de stock
Nous ne savons pas quand cet article sera de nouveau approvisionné
Cet article n’est actuellement pas disponible
### Niveau ASIN entier
Valider indisponible = true uniquement si le marqueur se rapporte à la variante actuellement sélectionnée ou au bloc d’achat principal.
IF unavailable_marker
AND marker_in_selected_variant_or_main_buybox
THEN indisponible = true
### Niveau variation
Si le texte contient plusieurs variantes et que l’indisponibilité apparaît à proximité d’une autre option :
indisponible = null
variantAvailabilityIssue = true
confidence = basse ou modérée
reason = "Indisponibilité rattachable à une variante, pas nécessairement à l’ASIN sélectionné"
### Règle de sécurité
Le simple mot "indisponible" présent quelque part dans le collage
ne suffit pas à fixer indisponible = true pour l’ASIN courant.
Il faut une relation locale avec :
- nom de la variante sélectionnée ;
- prix principal ;
- bloc d’achat ;
- marqueur de sélection ;
- titre ASIN courant.

# 2. Featured Offer versus offre listée
## 2.1 Segmentation obligatoire du texte
Avant extraction, le parse doit segmenter le collage en zones :
productHeader
selectedVariant
mainBuyBox
allOffersPanel
alternativeSellers
recommendations
otherVariants
unknown
Aucun détenteur Featured ne peut être extrait depuis :
allOffersPanel
alternativeSellers
recommendations
otherVariants
unknown
sauf si une preuve supplémentaire rattache explicitement le fragment au bloc principal.

## 2.2 Marqueurs d’entrée dans une zone d’offres listées
Liste fermée initiale :
Voir toutes les offres
Autres vendeurs sur Amazon
Autres vendeurs
X options à partir de
X offre(s) à partir de
Neuf à partir de
D’occasion à partir de
Disponible auprès de ces vendeurs
Comparer les offres
Voir les options d’achat
Après l’un de ces marqueurs, toute paire :
Vendu par X
Expédié par Y
est présumée être une offre listée, jusqu’à détection d’un changement de section.

## 2.3 Marqueurs du bloc d’achat principal
Un bloc peut être qualifié mainBuyBox si au moins deux catégories parmi les suivantes sont présentes dans une même fenêtre locale :
### Catégorie A — Action d’achat
Ajouter au panier
Acheter maintenant
Acheter cet article
### Catégorie B — Prix principal
prix unique clairement affiché
symbole monétaire adjacent
absence de "à partir de"
### Catégorie C — Vendeur / expéditeur
Vendu par
Expédié par
Vendu et expédié par
### Catégorie D — Quantité / disponibilité
En stock
Il ne reste plus que X exemplaire(s)
Quantité :
### Règle
IF at least 2 categories are present
AND one category is purchase action
AND block is before any all-offers marker
THEN zone = mainBuyBox
Pour valider le détenteur :
purchase action + seller/shipper
sont obligatoires.

## 2.4 Fenêtre de proximité
Valeur par défaut recommandée :
seller/shipper et bouton d’achat dans un rayon de 500 caractères
Ou, si structure en lignes :
dans les 12 lignes avant/après
Paramétrable : oui.
Si le collage contient des séparateurs DOM ou labels de section, ils priment sur la distance brute.

## 2.5 Règle absolue contre l’incident observé
IF price_is_preceded_by_or_attached_to("à partir de")
THEN priceType = lowestListedOfferPrice
AND featuredPrice = null
IF seller/shipper appears in allOffersPanel
THEN sellerOfferType = listedOffer
AND detenteur_BB remains null
IF no mainBuyBox zone can be established
THEN no featured holder may be asserted
La première offre du panneau « Toutes les offres » n’est jamais promue par défaut en Featured Offer.

# 3. Red flags d’incohérence
## 3.1 Red flags bloquants
Un red flag bloquant invalide le champ concerné.
### RF-01 — Détenteur sans preuve vendeur
IF detenteur_BB != null
AND no cited seller marker
THEN invalidate detenteur_BB
### RF-02 — Classification logistique sans preuve expéditeur
IF detenteur_BB IN (1P_Amazon, 3P_FBA, 3P_dropship)
AND no cited shipper marker
THEN invalidate detenteur_BB
Exception :
formulation fusionnée "Vendu et expédié par ..."
### RF-03 — Prix absent du texte
IF extracted_price normalized value
does not appear in cited source fragment
THEN invalidate price
La comparaison doit accepter les variantes :
8,99 €
8.99 €
8€99
EUR 8.99
mais pas une valeur calculée ou reconstruite sans champ distinct.
### RF-04 — Prix « à partir de » traité comme Featured
IF source contains "à partir de"
AND extracted field = featuredPrice
THEN invalidate featuredPrice
AND reclassify as lowestListedOfferPrice
### RF-05 — Offre listée traitée comme Featured
IF cited seller fragment belongs to allOffersPanel
THEN invalidate detenteur_BB
### RF-06 — Confiance haute sans action d’achat Featured
IF detenteur_BB != null
AND featured_purchase_action_absent
AND confidence = haute
THEN invalidate confidence
AND detenteur_BB = null
### RF-07 — Détenteur et absence de Featured Offer simultanés
IF featuredOfferStatus = none
AND detenteur_BB != null
THEN contradiction
AND detenteur_BB = null
### RF-08 — Citation ne soutenant pas la valeur
IF evidence.quote does not contain
the textual facts required for the extracted value
THEN invalidate field

## 3.2 Red flags forts mais non automatiquement bloquants
### RF-09 — Voir toutes les offres + détenteur affirmé
IF all_offers_marker_present
AND detenteur_BB != null
THEN require explicit proof that cited block is mainBuyBox
Sans cette preuve :
detenteur_BB = null
confidence = basse
### RF-10 — Plusieurs vendeurs dans le collage
IF count(distinct seller names) > 1
THEN confidence cannot be haute
UNLESS mainBuyBox segmentation is explicit
### RF-11 — Plusieurs prix concurrents
IF multiple prices detected
AND no unique mainBuyBox price
THEN featuredPrice = null
Les autres prix peuvent être conservés dans :
"listedOfferPrices": []
### RF-12 — indisponible = false alors que le terme est présent
IF unavailable_marker_present
AND indisponible = false
THEN require evidence that marker belongs to another variant
Sinon :
indisponible = null
validationStatus = ambiguous
### RF-13 — indisponible = true avec bouton panier actif
IF indisponible = true
AND active_featured_purchase_action_present
THEN contradiction
Résolution :
- vérifier si indisponibilité appartient à une autre variante ;
- sinon dégrader les deux champs ;
- ne jamais conserver confiance haute.
### RF-14 — 1P Amazon mais vendeur non Amazon
IF detenteur_BB = 1P_Amazon
AND cited seller is not Amazon
THEN invalidate detenteur_BB
### RF-15 — 3P FBA mais expéditeur non Amazon
IF detenteur_BB = 3P_FBA
AND cited shipper is not Amazon
THEN reclassify candidate as 3P_dropship
ONLY IF seller and shipper are explicitly proven
ELSE null
### RF-16 — Donnée non rattachée à la variante sélectionnée
IF selected variant exists
AND cited price/status/seller belongs to another variant
THEN invalidate field for current ASIN context
### RF-17 — Citation trop large ou non locale
IF evidence.quote exceeds 500 characters
OR contains several competing seller/price blocks
THEN evidence is non-discriminating
AND field cannot have confidence haute
### RF-18 — Donnée résiduelle d’un parse antérieur
IF extracted value is absent from current raw text
THEN invalidate value
AND flag possible_state_leak = true

## 3.3 Matrice de confiance
### Confiance haute
Uniquement si :
- mainBuyBox identifié ;
- action d’achat Featured présente ;
- vendeur cité ;
- expéditeur cité ;
- prix cité si prix renseigné ;
- aucun red flag ;
- aucun marqueur "à partir de" attaché au prix ;
- fragment hors panneau Toutes les offres.
### Confiance modérée
- bloc principal probable ;
- vendeur et expéditeur présents ;
- action d’achat présente ;
- segmentation imparfaite ou texte partiellement tronqué ;
- aucun red flag bloquant.
### Confiance basse
- détenteur non prouvé ;
- bloc principal absent ;
- panneau Toutes les offres présent ;
- plusieurs vendeurs/prix ;
- variante ambiguë ;
- données contradictoires ;
- texte incomplet.

# 4. Comportement de repli
## 4.1 Sortie normative en cas de doute
La proposition est confirmée :
{
  "detenteur_BB": null,
  "featuredPrice": null,
  "confidence": "basse",
  "validationStatus": "ambiguous",
  "reason": "Détenteur Featured non prouvé par un bloc d’achat principal cité.",
  "raw_indices": []
}
Ne jamais utiliser :
unknown seller
probablement Amazon
probablement 3P
dans le champ déterministe.
Une hypothèse narrative peut être conservée séparément :
{
  "parserHypothesis": "Une offre 3P FBA est visible dans le panneau des offres, mais elle n’est pas prouvée comme Featured Offer."
}
Cette hypothèse ne doit alimenter aucun score BB déterministe.

## 4.2 Impact sur les portes de triage
Si detenteur_BB = null :
porte 1 = non résolue
needsPaste conserve detenteur_BB
Si le collage a déjà été fourni mais reste ambigu :
needsPaste est remplacé par :
needsManualReview += detenteur_BB
Ne pas marquer :
Retail absent
Retail présent
BB-5 confirmé

## 4.3 Impact sur les faisceaux BB
### BB-5
detenteur_BB null
→ aucun renforcement NP de BB-5
La dynamique FO peut maintenir :
BB-5 = à confirmer
mais jamais modéré ou fort sur la base du parse ambigu.
### BB-7
detenteur_BB null
→ BB-7 reste à confirmer
→ needsDeliveryPromise reste actif
### BB-1 / BB-2
indisponible ambigu ne doit pas renforcer BB-1 ou BB-2.
### BB-11
La dynamique FO déterministe reste exploitable indépendamment de la capture.

## 4.4 Conservation des informations partielles
Un échec à prouver le détenteur ne doit pas supprimer les données valides.
Exemple :
{
  "featuredOfferStatus": "none",
  "detenteur_BB": null,
  "featuredPrice": null,
  "lowestListedOfferPrice": 21.68,
  "allOffersVisible": true,
  "confidence": "haute"
}
Ici, l’absence de Featured Offer peut être prouvée même si aucun détenteur n’existe.

# 5. Structure de la boucle d’auto-réparation
## 5.1 Architecture recommandée
Étape 1 — Parse IA initial
Étape 2 — Validation déterministe champ par champ
Étape 3 — Réparation déterministe simple
Étape 4 — Ré-essai IA critique conditionnel
Étape 5 — Nouvelle validation déterministe
Étape 6 — Acceptation ou dégradation sûre
Le validateur déterministe reste l’autorité finale.
L’IA ne peut jamais contourner une règle bloquante.

## 5.2 Première passe IA
Entrée :
rawPageText
marketplace
selectedVariantContext si disponible
Sortie exigée :
{
  "featuredOfferStatus": null,
  "detenteur_BB": null,
  "sellerName": null,
  "shipperName": null,
  "featuredPrice": null,
  "lowestListedOfferPrice": null,
  "prix_concurrent": null,
  "indisponible": null,
  "confidence": "basse",
  "evidence": {
    "featuredOfferStatus": null,
    "seller": null,
    "shipper": null,
    "featuredPrice": null,
    "unavailable": null
  },
  "zones": [],
  "reasoningSummary": ""
}
Chaque evidence contient :
{
  "quote": "...",
  "start": 123,
  "end": 184,
  "zone": "mainBuyBox"
}

## 5.3 Validation déterministe
Pour chaque champ :
1. La citation existe-t-elle ?
2. La citation est-elle retrouvable exactement dans rawPageText ?
3. La citation contient-elle la valeur ?
4. La zone citée autorise-t-elle ce type de valeur ?
5. Les marqueurs nécessaires sont-ils présents ?
6. Un red flag est-il déclenché ?
7. Existe-t-il une contradiction avec un autre champ ?
Sortie :
{
  "isValid": false,
  "errors": ["RF-04", "RF-05"],
  "invalidFields": ["detenteur_BB", "featuredPrice"],
  "repairableFields": ["featuredPrice"],
  "requiresRetry": true
}

## 5.4 Réparation déterministe sans second appel IA
Cas réparables automatiquement :
### Prix avec « à partir de »
featuredPrice → null
lowestListedOfferPrice → valeur
### Offre listée
detenteur_BB → null
sellerName peut être conservé dans listedOffers[]
### Confiance incohérente
haute → basse
### Indisponibilité de variante ambiguë
indisponible → null
variantAvailabilityIssue → true
### Absence de Featured Offer démontrée
featuredOfferStatus → none
detenteur_BB → null
featuredPrice → null
Un second appel IA n’est pas nécessaire si la correction est déterministe.

## 5.5 Déclenchement d’une seconde passe IA critique
Déclencher uniquement si :
- plusieurs zones candidates existent ;
- la citation est présente mais la zone est ambiguë ;
- plusieurs vendeurs ou prix existent ;
- indisponibilité potentiellement liée à une variante ;
- texte collé désordonné mais contient peut-être un bloc principal valide.
Ne pas déclencher si :
- la valeur est absente du texte ;
- aucun marqueur vendeur/expéditeur n’existe ;
- aucun bouton d’achat Featured n’existe ;
- le texte est manifestement insuffisant ;
- la réparation déterministe suffit.

## 5.6 Prompt de ré-essai critique
Ton premier parse a été rejeté par le validateur déterministe.

Erreurs :
[ERROR_CODES]

Champs invalides :
[INVALID_FIELDS]

Tu dois relire uniquement le texte source fourni.

Règles impératives :
1. N’affirme aucun détenteur sans citation exacte "Vendu par" et "Expédié par".
2. Le vendeur et l’expéditeur doivent appartenir au même bloc qu’une action d’achat Featured.
3. Toute offre située après "Voir toutes les offres", "Autres vendeurs" ou "X options à partir de" est une offre listée, pas nécessairement Featured.
4. Un prix précédé de "à partir de" n’est jamais le prix Featured.
5. Si aucun bloc Featured n’est prouvé, retourne detenteur_BB=null, featuredPrice=null et confiance=basse.
6. Cite un fragment court et exact pour chaque champ.
7. N’utilise aucune valeur provenant d’un parse précédent.

Réponds uniquement avec le schéma JSON demandé.
Le second appel reçoit :
rawPageText
premier résultat
codes d’erreur
mais doit être explicitement instruit de ne pas réutiliser une valeur non présente dans le texte.

## 5.7 Validation après ré-essai
Le second résultat repasse exactement dans le même validateur déterministe.
IF all mandatory fields valid
THEN accept corrected result

ELSE degrade invalid fields to null
AND confidence = basse
AND validationStatus = ambiguous or contradicted
L’IA ne reçoit pas de troisième tentative.

## 5.8 Critère d’arrêt
Nombre maximal recommandé :
1 parse initial
+ 1 ré-essai critique maximum
Soit :
maxAiIterations = 2
Critère d’arrêt anticipé :
IF deterministic validator can safely repair
THEN do not call AI again
Critère d’abandon :
IF second result triggers any blocking red flag
OR required evidence remains absent
THEN degrade safely
AND route to manual review if strategically necessary

## 5.9 Hiérarchie d’autorité
1. Texte source collé
2. Citations exactes
3. Validateur déterministe
4. Parse IA
5. Narration IA
Une sortie IA ne peut jamais primer sur :
- l’absence de citation ;
- une contradiction textuelle ;
- une zone "Toutes les offres" ;
- un prix "à partir de" ;
- l’absence de bloc Featured.

## 5.10 Journalisation
Conserver pour chaque parse :
{
  "parseVersion": "v1",
  "rawTextHash": "...",
  "initialResult": {},
  "validationErrors": [],
  "deterministicRepairs": [],
  "retryTriggered": true,
  "retryResult": {},
  "finalValidationErrors": [],
  "finalResult": {},
  "manualReviewRequired": false
}
Ne pas stocker seulement le résultat final : l’incident doit être reproductible et auditable.

# 6. Cas de test obligatoires
## Test 1 — 1P Amazon Featured
Ajouter au panier
Vendu par Amazon
Expédié par Amazon
Attendu :
detenteur_BB = 1P_Amazon
confidence = haute

## Test 2 — 3P FBA Featured
Ajouter au panier
Vendu par Vendeur X
Expédié par Amazon
Attendu :
detenteur_BB = 3P_FBA
confidence = haute

## Test 3 — 3P dropship Featured
Ajouter au panier
Vendu par Vendeur X
Expédié par Vendeur X
Attendu :
detenteur_BB = 3P_dropship
confidence = haute

## Test 4 — Pas de Featured Offer
1 option à partir de 21,68 €
Voir toutes les offres
Ajouter à votre liste
Attendu :
featuredOfferStatus = none
detenteur_BB = null
featuredPrice = null
lowestListedOfferPrice = 21.68
confidence = haute

## Test 5 — Offre 3P dans le panneau
Voir toutes les offres
21,68 €
Vendu par Vendeur X
Expédié par Amazon
Ajouter au panier
Attendu :
detenteur_BB = null
listedOffers[0].seller = Vendeur X
listedOffers[0].fulfillment = FBA
Le bouton panier du panneau ne transforme pas l’offre en Featured Offer.

## Test 6 — Prix halluciné
Texte :
1 option à partir de 21,68 €
Parse proposé :
featuredPrice = 8.99
Attendu :
featuredPrice = null
validationStatus = contradicted
possible_state_leak = true

## Test 7 — Indisponibilité sur autre variante
Couleur sélectionnée : Bleu — En stock
Rouge — Actuellement indisponible
Attendu :
indisponible = false
variantAvailabilityIssue = true
À condition que la sélection Bleu soit explicitement prouvée.

## Test 8 — Variante sélectionnée ambiguë
Bleu — En stock
Rouge — Actuellement indisponible
sans marqueur de sélection.
Attendu :
indisponible = null
confidence = basse
reason = variante sélectionnée non prouvée

# 7. Décision méthodologique finale
Un parse incomplet mais prudent est valide.

Un parse précis mais non prouvé est invalide.
La sortie sûre par défaut est :
{
  "detenteur_BB": null,
  "featuredPrice": null,
  "indisponible": null,
  "confidence": "basse",
  "validationStatus": "unproven"
}
Le moteur de scoring aval doit interpréter null comme :
porte non résolue
et jamais comme :
absence confirmée