# Méthodologie d’audit Buy Box / Featured Offer — Vendor Central 1P

**Version : v2 — intégrant les enseignements des cas B00PVPXVBE, B009G3EQ70 et B0CKXVJGXS**  
**Objectif :** diagnostiquer les pertes de Buy Box / Featured Offer sur un compte Amazon Vendor 1P, distinguer les causes probables, identifier les inputs nécessaires et définir les actions de rétablissement.

---

## 0. Principe central v2

L’enseignement majeur des trois cas analysés est le suivant :

> **Stock Amazon possédé ≠ stock fiable ≠ stock exposé ≠ Buy Box Amazon.**

Un ASIN peut avoir du stock côté Amazon, mais ne plus générer de ventes Retail si Amazon ne considère pas ce stock comme fiable, exploitable, correctement réconcilié ou économiquement pertinent à exposer.

Il faut donc éviter de conclure trop vite :

```text
Stock Amazon présent + ventes nulles = simple stock dormant
```

La bonne lecture est plus exigeante :

```text
Stock Amazon présent
→ ce stock est-il sellable ?
→ ce stock est-il trusted ?
→ ce stock est-il exposé en Retail ?
→ Amazon Retail détient-il la Featured Offer ?
→ le stock a-t-il été reclassé, corrigé ou retiré du sellable ?
```

---

# 1. Méthodologie pour comprendre une perte de Buy Box Vendor 1P

La méthode doit reconstruire la chaîne complète :

```text
ASIN
→ historique ventes
→ trafic / Featured Offer views
→ stock Amazon
→ statut du stock : sellable, aged, reserved, transfer, unsellable
→ POs récents
→ acceptation PO
→ DESADV / ASN
→ BOL
→ rendez-vous Carrier Central / ISA
→ réception
→ défauts livraison / chargebacks
→ retail offer
→ Buy Box / Featured Offer
```

L’objectif est de trouver **où la chaîne casse**.

---

## Étape 1 — Qualifier précisément le symptôme client

Avant de parler de “perte Buy Box”, il faut identifier ce qui est réellement observé.

| Symptôme observé | Lecture probable |
|---|---|
| Amazon Retail visible mais pas en Buy Box | Featured Offer perdue : prix, promesse, 3P, éligibilité |
| Buy Box détenue par un vendeur 3P | Amazon Retail absent, non compétitif ou non exposé |
| Amazon Retail absent des offres | Retail offer inactive / Retail availability restriction |
| ASIN “currently unavailable” | stock non sellable ou offre retail bloquée |
| ASIN visible par URL mais introuvable en recherche | search suppression / discoverability |
| ASIN visible en Business mais pas en standard | segmentation canal / disponibilité / promesse |
| Stock Amazon présent mais ventes nulles | stock dormant, stock non trusted, offer suppression |
| PO récent mais CA = 0 | flux appro en cours mais non converti en stock vendable |
| Vues page produit présentes mais vues offre vedette faibles | page visitée mais Featured Offer non exposée |

---

## Étape 2 — Reconstruire la timeline

La timeline est devenue indispensable. Pour chaque ASIN, il faut aligner :

| Date / période | Élément à reconstruire |
|---|---|
| Dernier mois normal de ventes | niveau de référence |
| Premier mois de chute | point de rupture |
| Stock Amazon au moment de la chute | rupture réelle ou stock présent ? |
| Vues Featured Offer | exposition réelle de l’offre vedette |
| Buy Box winner observé | Amazon ou 3P |
| Derniers POs | approvisionnement récent ou non |
| Dernières réceptions | stock reçu proprement ou non |
| Défauts delivery / BOL / ASN | signaux de défiance opérationnelle |
| Changement de stock brutal | correction / reclassification potentielle |

Le diagnostic change radicalement selon que l’arrêt des ventes précède ou suit la chute du stock.

---

## Étape 3 — Utiliser le trafic comme proxy Featured Offer

Côté Vendor Central, l’export le plus utile est :

```text
Retail Analytics → Traffic
```

Le champ clé est :

```text
Vues de la page de l’offre vedette
```

Il ne donne pas directement le vendeur gagnant de la Buy Box, mais il permet d’objectiver la perte d’exposition.

### Calcul recommandé

```text
Taux d’exposition Featured Offer = Vues offre vedette / Vues page produit
```

À défaut de “Vues page produit”, les **vues offre vedette mensuelles** permettent déjà de détecter :

| Signal | Lecture |
|---|---|
| Vues FO = 0 avec stock présent | coupure totale de l’offre vedette |
| Vues FO en baisse de 70 à 90 % | dés-exposition massive |
| Vues FO faibles mais non nulles | Featured Offer intermittente ou partielle |
| Vues FO stables mais ventes basses | problème conversion, prix, promesse ou concurrence |
| Vues FO fortes puis stock dormant | stock non converti / stock non trusted possible |

---

## Étape 4 — Vérifier la confiance stock Amazon

Nouvelle question centrale :

> **Amazon fait-il confiance à ce stock ?**

Signaux de stock non trusted :

| Signal | Interprétation |
|---|---|
| Stock dormant important mais ventes nulles | stock présent mais non exposé |
| Correction brutale du stock | reclassification / réconciliation |
| BOL mismatch sur POs récents | défaut de corrélation ASN / appointment |
| “No ASN matches” sur CARP | appointment orphelin ou ASN non exploitable |
| Réceptions incomplètes | écarts réception / shortage |
| Not On Time / Delivery Window récurrents | fiabilité réception dégradée |
| POs massivement non acceptés | instock reliability dégradée |
| Aucun PO ouvert malgré forte demande | purchase hold / restriction instock possible |
| Buy Box passée à un 3P malgré stock Amazon | Amazon Retail ne soutient plus l’offre |

---

## Étape 5 — Classer l’ASIN dans une typologie BB

| Code | Diagnostic | Lecture |
|---|---|---|
| **BB-1** | Rupture réelle | Amazon n’a plus assez de stock vendable |
| **BB-2** | Stock présent mais non sellable | reserved, transfer, unsellable, receiving non finalisé |
| **BB-3** | Stock dormant / aged inventory | stock vendable mais non écoulé |
| **BB-4** | Problème inbound / réception | ASN, DESADV, BOL, appointment, receiving |
| **BB-5** | Problème pricing / 3P / Featured Offer | Amazon Retail buyable mais non Featured |
| **BB-6** | Catalogue / conformité | suppression, attribut manquant, compliance, variation cassée |
| **BB-7** | Promesse livraison | délai, Prime, géographie, stock mal positionné |
| **BB-8** | CRaP / profitabilité / purchase hold | do-not-reorder, economics défavorables |
| **BB-9** | Cas mixte nécessitant escalade | plusieurs signaux simultanés |
| **BB-10** | Stock présent mais non trusted | stock possédé mais non exposé car jugé non fiable |
| **BB-11** | Sous-exposition durable Featured Offer | FO views durablement faibles malgré fiche active |
| **BB-12** | Problème variation-level Featured Offer | certaines options sans offre vedette |

---

# 2. Inputs nécessaires pour établir un diagnostic fiable

## A. Données commerciales

| Input | Pourquoi |
|---|---|
| ASIN | clé principale |
| SKU / modèle / EAN | rapprochement catalogue |
| Marque | segmentation portefeuille |
| CA N-1 | base de référence |
| CA courant | mesure de la chute |
| Unités commandées / expédiées | dynamique commerciale |
| Date de début de chute | localisation de l’événement |
| Retours client | signal qualité / conversion |

---

## B. Données trafic

| Input | Pourquoi |
|---|---|
| Vues page produit / Glance views | visibilité totale |
| Vues de la page de l’offre vedette | proxy Featured Offer |
| Taux d’exposition Featured Offer | mesure de perte Buy Box |
| Conversion | trafic vs transformation |
| Granularité mensuelle | détecter mois de rupture |
| Granularité hebdomadaire si possible | prouver coupure courte |

**Fréquence recommandée :** mensuelle minimum ; hebdomadaire sur ASINs sensibles.

---

## C. Données stock Vendor Central

| Input | Pourquoi |
|---|---|
| Sellable on hand | stock vraiment vendable |
| Unsellable | stock bloqué |
| Reserved | stock non disponible client |
| Transfer | stock en mouvement |
| Aged inventory >90 jours | stock dormant |
| Unhealthy inventory | signal inventory management |
| Open PO quantity | réapprovisionnement attendu |
| Stock historique | détecter correction / reclassification |

---

## D. Données PO

| Input | Pourquoi |
|---|---|
| PO number | rattachement appro |
| PO date | récence |
| PO status | confirmé, clôturé, annulé |
| Code dispo | AC, IA, IR, etc. |
| Quantité demandée | besoin Amazon |
| Quantité acceptée | réponse fournisseur |
| Quantité ASN | expédition déclarée |
| Quantité reçue | réception réelle |
| Ship-to FC | lieu réception |
| Écart accepté / reçu | shortage ou correction |

---

## E. Données ASN / DESADV

| Input | Pourquoi |
|---|---|
| ASN Amazon ID / ARN | référence Amazon |
| Référence DESADV / BOL | clé fournisseur / transport |
| Date d’envoi DESADV | ordre DESADV vs appointment |
| Statut ASN | soumis / rejeté |
| CONTRL / accusé EDI | preuve acceptation |
| PO dans DESADV | contrôle rattachement |
| BOL dans DESADV | contrôle matching |
| Palettes / cartons | cohérence Carrier Central |
| FC destination | cohérence réception |

---

## F. Données Carrier Central / CARP

Les données CARP ont souvent une **fenêtre de disponibilité courte**. Il faut donc les capturer rapidement.

| Input | Pourquoi |
|---|---|
| ISA / appointment ID | preuve rendez-vous |
| Date de création appointment | ordre ASN vs RDV |
| BOL saisi | matching ASN |
| ASN / ARN | référence Amazon |
| PRO / consignment | référence transport |
| Carrier code | transporteur / affrètement |
| FC | cohérence destination |
| Palettes / cartons | cohérence physique |
| Statut appointment | scheduled / completed / rejected |
| Message “No ASN matches” | signal critique |
| Capture écran | preuve à joindre au case |

**Routine recommandée :** export CARP quotidien ou bihebdomadaire pendant la période de correction + archivage horodaté.

---

## G. Données défauts / chargebacks

| Input | Pourquoi |
|---|---|
| PRO/BOL mismatch | défaut clé ASN / appointment |
| Missing / incorrect ASN | défaut critique |
| Not On Time | fiabilité livraison |
| Delivery Window Compliance | respect créneau |
| NCNS | no call no show |
| Shortage claim | écart réception |
| Chargeback amount | impact économique |
| PO / ISA / FC liés | rattachement causal |

---

## H. Données page Amazon live

| Input | Pourquoi |
|---|---|
| Buy Box winner | Amazon ou 3P |
| Vendu par / expédié par | vérifier Amazon Retail |
| Prix Amazon | pricing |
| Prix 3P | concurrence |
| Prime / délai | promesse client |
| “Voir toutes les offres” | présence Amazon dans autres offres |
| Compte standard vs Business | segmentation |
| Code postal | disponibilité locale |
| Capture datée | preuve case Amazon |

---

# 2 bis. Scraping Amazon : position opérationnelle

Je ne recommande pas le scraping brut des pages Amazon.

Amazon est dynamique et personnalisé selon :

- compte standard ou Business ;
- code postal ;
- cookies ;
- disponibilité locale ;
- vendeur éligible ;
- prix et promesse ;
- Buy Box temps réel.

Un scraping simple peut produire une donnée fausse ou non reproductible.

## Approche recommandée

Mettre en place un protocole de collecte contrôlé :

| Champ à capturer | Exemple |
|---|---|
| Date / heure | 2026-06-03 10:00 |
| ASIN | B00PVPXVBE |
| Compte | standard / Business |
| Code postal | 750xx ou autre |
| Prix | 6,60 € |
| Buy Box winner | Amazon / 3P |
| Vendu par | vendeur exact |
| Expédié par | Amazon / vendeur |
| Disponibilité | en stock / indisponible |
| Livraison promise | date affichée |
| Capture écran | fichier preuve |

---

# 3. Moyens de rétablir une Buy Box / Retail offer selon les cas

## Cas A — Stock vendable insuffisant

### Diagnostic

- Sellable on hand faible ou nul.
- Ventes arrêtées.
- POs absents ou non livrés.
- 3P gagne la Buy Box faute d’offre Retail soutenable.

### Actions

1. Pousser un réapprovisionnement propre.
2. Obtenir ou provoquer un PO.
3. Accepter intégralement les POs.
4. Envoyer DESADV avant Carrier Central.
5. Contrôler PO / ASN / BOL / ISA / FC / quantités.
6. Demander un refresh Retail Availability après réception.

### Message type Amazon

```text
The ASIN has lost Amazon Retail Featured Offer while sellable Retail inventory is now too low. Please review replenishment / instock status and confirm whether Amazon Retail can be restocked and re-enabled for Featured Offer once inventory is received and sellable.
```

---

## Cas B — Stock présent mais non sellable / non exploitable

### Diagnostic

- Stock Amazon visible.
- ASIN non buyable ou Amazon Retail non Featured.
- Stock en reserved, transfer, unsellable, under investigation ou receiving.

### Actions

1. Demander Inventory Health / receiving reconciliation.
2. Fournir PO, ASN, BOL, ISA, received quantity.
3. Demander la classification exacte du stock.
4. Demander le passage du stock en sellable si l’écart est corrigé.

### Message type Amazon

```text
Amazon inventory exists but the Retail offer is not buyable / not featured. Please confirm whether the inventory is sellable, reserved, in transfer, unsellable, under investigation, or blocked by receiving reconciliation.
```

---

## Cas C — BOL / ASN / appointment mismatch

### Diagnostic

- “No ASN matches”.
- PRO/BOL mismatch.
- ASN créée après RDV.
- DESADV absent ou rejeté.
- Appointment orphelin.

### Actions

1. Vérifier que le DESADV est envoyé et accepté.
2. Distinguer ASN / ARN Amazon du BOL fournisseur.
3. Resauvegarder ou recréer le rendez-vous Carrier Central après création de l’ASN.
4. Vérifier PO / BOL / ASN / ISA / FC / palettes / cartons.
5. Ouvrir case Livraisons / Carrier Central / ASN.
6. Ensuite demander Retail Availability refresh.

### Message type Amazon

```text
The inbound issue has been corrected. ASN, BOL, PO, FC and appointment are now aligned. Please review whether the ASIN is still impacted by inventory reliability / receiving reconciliation and refresh Retail availability / Featured Offer eligibility.
```

---

## Cas D — Stock dormant / aged inventory

### Diagnostic

- Sellable on hand important.
- Aged inventory >90 jours.
- Ventes faibles ou nulles.
- Pas forcément de problème inbound récent.

### Actions

1. Vérifier si Amazon Retail est bien vendeur et Featured.
2. Vérifier prix Amazon vs 3P / marché.
3. Demander Retail Availability / Inventory Management review.
4. Tester baisse prix, coupon, promo ou deal pour relancer sell-through.
5. Vérifier si l’ASIN est en purchase hold / inventory suppression.

### Message type Amazon

```text
The ASIN has sellable aged inventory but very low Retail sales / Featured Offer exposure. Please confirm whether it is impacted by inventory management suppression, purchase hold, pricing threshold, catalog suppression, or another Retail Availability restriction.
```

---

## Cas E — Prix / concurrence 3P

### Diagnostic

- Amazon Retail visible mais pas Featured.
- 3P gagne la Buy Box.
- Amazon trop cher ou promesse moins bonne.
- Prix externe inférieur.

### Actions

1. Comparer Amazon vs 3P vs marché externe.
2. Vérifier prix par unité / pack / variation.
3. Signaler fausse comparaison prix si nécessaire.
4. Adapter coût d’achat, promotion ou funding.
5. Demander Featured Offer eligibility check.

### Message type Amazon

```text
Amazon Retail is buyable but not Featured. Please confirm whether the ASIN is ineligible due to pricing threshold, external price comparison, 3P offer competition, or delivery promise.
```

---

## Cas F — Catalogue / conformité

### Diagnostic

- Search suppression.
- Attribut manquant.
- Variation cassée.
- Marque / EAN / compliance.
- Page visible mais non achetable.

### Actions

1. Corriger les attributs catalogue.
2. Réenregistrer la fiche.
3. Vérifier browse node, unit count, images, compliance.
4. Ouvrir case catalogue si blocage.

---

## Cas G — Stock présent mais non trusted par Amazon

### Diagnostic

- Stock dormant au moment de l’arrêt des ventes.
- Vues offre vedette à zéro ou quasi zéro.
- Buy Box captée par 3P.
- Défauts PO / BOL / delivery récurrents.
- Correction brutale du stock ensuite.

### Actions

1. Reconstituer la timeline stock / trafic / ventes.
2. Prouver que l’arrêt de l’offre est arrivé alors qu’Amazon avait du stock.
3. Documenter les défauts PO / ASN / BOL / réception.
4. Demander une revue Inventory Reliability / Receiving Reconciliation.
5. Demander pourquoi le stock n’est plus trusted / sellable / exposé.
6. Corriger les prochains flux inbound pour reconstruire la confiance.
7. Demander un refresh Retail Availability / Featured Offer après réception propre.

### Message type Amazon

```text
The ASIN stopped generating Amazon Retail sales while Amazon still had dormant inventory. The inventory was later adjusted / reclassified. Given the history of PO non-acceptance, delivery defects and BOL/ASN correlation issues, we suspect the inventory may no longer be trusted or exposed as reliable Retail sellable stock. Please review Inventory Reliability, Receiving Reconciliation and Retail Availability status.
```

---

## Cas H — Sous-exposition durable Featured Offer

### Diagnostic

- Vues offre vedette durablement très inférieures à N-1.
- Stock disponible ou aged.
- ASIN parfois buyable, parfois sans Buy Box.
- Pas forcément de défaut BOL identifié.

### Actions

1. Comparer trafic FO mensuel N vs N-1.
2. Identifier le mois de décrochage.
3. Vérifier prix, concurrence, catalogue, variation, Retail Availability.
4. Demander à Amazon la cause de la dés-exposition durable.
5. Tester un levier commercial : prix, coupon, promotion, deal, Ads.
6. Suivre la remontée FO views sur 7 / 14 / 30 jours.

### Message type Amazon

```text
The ASIN has sellable inventory but Featured Offer exposure collapsed vs last year and has remained structurally low. Please confirm whether the ASIN is affected by Retail Availability restriction, inventory management suppression, pricing threshold, catalog issue or Featured Offer eligibility problem.
```

---

## Cas I — Problème variation-level Featured Offer

### Diagnostic

- Certaines options sans offres en vedette.
- Parentage avec variations actives et variations sans Buy Box.
- Stock / prix / disponibilité hétérogènes par variation.

### Actions

1. Auditer chaque enfant ASIN.
2. Capturer prix, vendeur, stock, Buy Box par variation.
3. Vérifier variation theme, parentage, titres, attributs.
4. Demander review Featured Offer par variation.
5. Corriger attributs ou pricing des enfants problématiques.

### Message type Amazon

```text
The variation family shows partial Featured Offer issues. Please review Retail Availability and Featured Offer eligibility at child-ASIN level, as some options appear without Featured Offer despite sellable inventory.
```

---

# 4. Application aux trois cas étudiés

## 4.1 B00PVPXVBE — COGEX cadenas 30 mm

### Observations clés

| Signal | Lecture |
|---|---|
| Stock dormant observé côté Amazon : environ 645 pièces | stock présent mais non converti en ventes |
| Plus de ventes fournisseur depuis avril | arrêt Retail malgré stock |
| Vues offre vedette mai 2026 : 0 | coupure totale de l’offre vedette |
| Buy Box actuelle tenue par un 3P | Amazon Retail non Featured |
| Stock actuel corrigé à 5 unités | correction / reclassification probable |
| POs massivement non acceptés en IR | instock reliability dégradée |
| Défauts Not On Time, Delivery Window, BOL mismatch, NCNS | historique inbound dégradé |

### Diagnostic

**Code principal : BB-10 — stock présent mais non trusted par Amazon.**  
Codes secondaires : **BB-4**, **BB-5**, **BB-2**, **BB-8 possible**.

Le cadenas est le cas le plus fort pour démontrer que :

> Amazon a pu posséder du stock, mais ne plus l’exposer comme Retail sellable trusted inventory.

La coupure à zéro vue offre vedette en mai 2026, combinée au stock dormant, à la Buy Box 3P et à la correction du stock, rend le diagnostic très solide.

### Actions recommandées

1. Ouvrir un case **Inventory Reliability / Receiving Reconciliation / Retail Availability**.
2. Fournir la timeline : stock 645 dormant, arrêt ventes, FO views = 0 en mai, stock corrigé à 5.
3. Joindre défauts PO / delivery : BOL mismatch, Not On Time, Delivery Window, NCNS.
4. Demander pourquoi le stock de 645 n’était pas exposé.
5. Demander si le stock a été reclassé en unsellable, reserved, transfer, investigation ou corrigé.
6. Demander s’il existe un purchase hold / instock restriction.
7. Sécuriser les prochains flux : ASN avant CARP, BOL strictement aligné, réception propre.
8. Après réception propre, demander refresh Amazon Retail Featured Offer.

### Message case recommandé

```text
Hello,

We need Amazon’s support to investigate ASIN B00PVPXVBE.

The ASIN stopped generating Amazon Retail sales while Amazon still appeared to have approximately 645 units of dormant inventory. In May 2026, Featured Offer Page Views dropped to zero, and the current Featured Offer is held by a 3P seller. The current sellable inventory now appears to have been adjusted down to 5 units.

This suggests that the issue was not initially a physical out-of-stock situation, but possibly an Inventory Reliability / Receiving Reconciliation / Retail Availability issue. The ASIN also has a history of PO non-acceptance, delivery defects, and BOL/ASN correlation issues.

Could you please confirm:
1. why Amazon Retail stopped exposing the offer while dormant inventory existed;
2. whether the previous 645 units were sellable, reserved, transfer, unsellable or under investigation;
3. why the stock was later adjusted down to 5 units;
4. whether prior PO / ASN / BOL / appointment defects impacted inventory trust;
5. whether there is any purchase hold, do-not-reorder, instock or Retail Availability restriction;
6. what action is required to restore Amazon Retail Featured Offer eligibility.
```

---

## 4.2 B009G3EQ70 — Expert Line multiprise 5 prises

### Observations clés

| Signal | Lecture |
|---|---|
| Produit one-shot | absence de PO récent moins significative |
| Stock vendable âgé | stock dormant |
| Article encore sans Buy Box la semaine précédente | Featured Offer intermittente / supprimée temporairement |
| Page actuelle revenue avec prix et Choix d’Amazon | réactivation récente probable |
| Janvier-mai 2026 FO views : 1 600 | exposition très faible |
| Janvier-mai 2025 FO views : 12 036 | référence historique forte |
| Évolution FO views : -86,7 % | dés-exposition massive |
| Décrochage initial dès avril 2025 | problème structurel, pas incident isolé |
| Pas de preuve PO/BOL directe | BOL non démontré |

### Diagnostic

**Code principal : BB-11 — sous-exposition durable Featured Offer.**  
Codes secondaires : **BB-3**, **BB-5**, **BB-8 possible mais moins fort car one-shot**.

Ce cas ne ressemble pas au cadenas. Ici, le problème n’est pas une coupure totale récente liée à une réconciliation stock. C’est une dés-exposition durable, probablement liée à inventory management, pricing, concurrence, ou suppression Retail Availability partielle.

### Actions recommandées

1. Capturer le bloc Buy Box actuel : vendu par / expédié par.
2. Capturer “Toutes les offres” pour voir si Amazon Retail est présent ou si un 3P gagne.
3. Vérifier prix Amazon vs 3P vs marché.
4. Vérifier catalogue / compliance électrique / attributs obligatoires.
5. Demander à Amazon la cause de la sous-exposition FO durable.
6. Tester relance commerciale : baisse prix, coupon, promo, deal ou Ads si Amazon Retail est bien exposé.
7. Suivre FO views sur 7 / 14 / 30 jours après action.

### Message case recommandé

```text
Hello,

We request a Retail Availability / Featured Offer review for ASIN B009G3EQ70.

This is a one-shot ASIN with remaining sellable aged inventory. The ASIN was still without Featured Offer last week, while the current page appears to show the offer again. However, Featured Offer Page Views have collapsed structurally: Jan-May 2026 shows 1,600 Featured Offer Page Views vs 12,036 over the same period in 2025, a decrease of approximately 86.7%.

Could you please confirm whether this ASIN is affected by:
1. Retail Availability restriction;
2. inventory management suppression;
3. pricing threshold or 3P offer competition;
4. catalog or compliance issue;
5. Featured Offer eligibility issue.

Please also confirm whether the ASIN is now fully re-enabled for Featured Offer exposure.
```

---

## 4.3 B0CKXVJGXS — ITENSE multiprise étanche IP44

### Observations clés

| Signal | Lecture |
|---|---|
| Stock vendable important | pas une rupture réelle |
| Stock >90 jours significatif | stock dormant |
| Janvier-mai 2026 FO views : 2 161 | exposition encore présente |
| Janvier-mai 2025 FO views : 3 060 | baisse de 29,4 % |
| Page actuelle avec “options sans offres en vedette” | problème variation-level probable |
| Défauts inbound / BOL sur PO historique | confiance stock possiblement dégradée |
| Écart accepté / reçu | réception imparfaite |
| Aucun PO ouvert | inventory management / demand planning à vérifier |

### Diagnostic

**Code principal : BB-12 — problème Featured Offer au niveau variation / option.**  
Codes secondaires : **BB-3**, **BB-4**, **BB-10 possible**, **BB-5**.

Contrairement au cadenas, il n’y a pas coupure totale. Contrairement à B009G3EQ70, il existe des signaux inbound. Le cas est mixte : stock dormant, historique livraison/BOL, et instabilité de la Featured Offer selon les variations.

### Actions recommandées

1. Auditer chaque variation : 3 prises, 5 prises, option sans Featured Offer.
2. Capturer vendu par / expédié par pour chaque enfant ASIN.
3. Comparer prix, stock, promesse et Buy Box par variation.
4. Vérifier parentage, attribut “nombre de sorties”, variation theme.
5. Demander une review Retail Availability / Featured Offer par child-ASIN.
6. Mettre en avant les défauts inbound uniquement comme facteur contributif, pas cause unique.
7. Tester pricing / promotion sur la variation principale.

### Message case recommandé

```text
Hello,

We request a Retail Availability / Featured Offer review for ASIN B0CKXVJGXS and its variation family.

The ASIN has sellable aged inventory and the page currently indicates that at least one option has no Featured Offer. Featured Offer Page Views declined by approximately 29.4% over Jan-May 2026 vs the same period in 2025. The ASIN also has a history of inbound delivery defects, including BOL mismatch and delivery window compliance issues.

Could you please review:
1. Featured Offer eligibility at child-ASIN level;
2. whether any variation is blocked by Retail Availability restriction;
3. whether inventory trust / receiving reconciliation is affecting the offer;
4. whether pricing or 3P competition prevents the Featured Offer;
5. whether the variation family has catalog or parentage issues.
```

---

# 5. Matrice de décision rapide

| Situation observée | Diagnostic prioritaire | Action prioritaire |
|---|---|---|
| Stock = 0 ou très faible | BB-1 | réappro propre + instock review |
| Stock présent mais pas buyable | BB-2 | inventory health / receiving reconciliation |
| Stock dormant + ventes nulles | BB-3 ou BB-10 | vérifier confiance stock + inventory management |
| FO views = 0 avec stock présent | BB-10 | Retail Availability / Inventory Reliability case |
| FO views -80 % vs N-1 | BB-11 | review Featured Offer / pricing / inventory management |
| Buy Box 3P | BB-5 | comparer prix, stock, promesse, présence Amazon |
| BOL mismatch récent | BB-4 | corriger ASN / BOL / CARP puis demander refresh |
| Option sans Featured Offer | BB-12 | audit child-ASIN / variation |
| Aucun PO malgré ASIN fort | BB-8 possible | instock / purchase hold review |

---

# 6. Plan d’expérimentation correctif

Les actions doivent être suivies comme des tests, pas comme des certitudes.

| Action | ASIN cible | Indicateur de succès | Délai d’observation |
|---|---|---|---|
| Case Inventory Reliability | B00PVPXVBE | réponse sur stock 645 → 5 / statut stock | 3 à 10 jours |
| Réception propre suivante | B00PVPXVBE | stock sellable rétabli + FO views repartent | 7 à 21 jours |
| Case Featured Offer / Retail Availability | B009G3EQ70 | confirmation cause sous-exposition | 3 à 15 jours |
| Test promo / coupon / prix | B009G3EQ70 | hausse FO views + unités commandées | 7 à 30 jours |
| Audit variation-level | B0CKXVJGXS | identification option sans FO | immédiat à 7 jours |
| Case child-ASIN Retail Availability | B0CKXVJGXS | résolution option sans FO | 7 à 21 jours |
| Monitoring page Amazon | 3 ASINs | Buy Box winner stable Amazon | quotidien / hebdo |
| Export trafic hebdo | 3 ASINs | FO views remontent | hebdo |

---

# 7. Structure recommandée du fichier d’audit

## Onglet 1 — ASIN_Audit_v2

| ASIN | SKU | EAN | CA N-1 | CA courant | FO Views N-1 | FO Views courant | Écart FO | Stock sellable | Stock aged | Buy Box winner | Diagnostic BB | Priorité | Action |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|

## Onglet 2 — Monthly_Traffic

| ASIN | Mois | Vues page produit | Vues offre vedette | Taux exposition FO | Unités commandées | CA | Commentaire |
|---|---|---:|---:|---:|---:|---:|---|

## Onglet 3 — Stock_Timeline

| ASIN | Date | Sellable | Aged | Reserved | Transfer | Unsellable | Open PO | Commentaire |
|---|---|---:|---:|---:|---:|---:|---:|---|

## Onglet 4 — PO_ASN_CARP

| ASIN | PO | PO date | Code dispo | Statut PO | ASN ID | BOL | ISA | FC | Cartons | Palettes | Défaut | Matching |
|---|---|---|---|---|---|---|---|---|---:|---:|---|---|

## Onglet 5 — Defects_Chargebacks

| ASIN | PO | Défaut | Date | ISA | BOL | FC | Quantité | Impact probable | Corrigé ? |
|---|---|---|---|---|---|---|---:|---|---|

## Onglet 6 — Amazon_Page_Check

| Date | ASIN | Compte | Code postal | Prix | Buy Box winner | Vendu par | Expédié par | Amazon présent autres offres ? | Capture |
|---|---|---|---|---:|---|---|---|---|---|

## Onglet 7 — Remediation_Tracker

| ASIN | Action | Type case | Date ouverture | Pièces jointes | Réponse Amazon | Résultat | Prochaine étape |
|---|---|---|---|---|---|---|---|

---

# 8. Résumé opérationnel

Pour comprendre une perte de Buy Box Vendor 1P, la question n’est plus seulement :

```text
Amazon a-t-il du stock ?
```

La vraie question est :

```text
Amazon fait-il suffisamment confiance à ce stock pour l’exposer en Retail Featured Offer ?
```

La séquence d’audit v2 est donc :

```text
1. L’ASIN est-il buyable ?
2. Qui tient la Buy Box ?
3. Amazon Retail est-il présent dans les offres ?
4. Le stock Amazon est-il sellable, aged, reserved, transfer, unsellable ?
5. Les vues offre vedette chutent-elles ?
6. La chute est-elle brutale ou structurelle ?
7. Les POs / ASN / BOL / CARP sont-ils propres ?
8. Le stock a-t-il été corrigé / reclassé ?
9. Le prix / la concurrence expliquent-ils la perte ?
10. Le problème est-il au niveau ASIN ou variation ?
11. Quelle équipe Amazon doit traiter : Inbound, Inventory Health, Retail Availability, Instock, Pricing, Catalogue ?
```

Et la logique de rétablissement est :

> **Corriger la cause opérationnelle ou commerciale, prouver que le stock est fiable et vendable, puis demander un refresh Retail Availability / Featured Offer.**

