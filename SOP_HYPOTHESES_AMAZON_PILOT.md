# SOP_HYPOTHESES_AMAZON_PILOT.md
**Date de création** : 29 mai 2026
**Auteur méthodologie** : Fred Rochette (savoir-faire KAM) — Production : Claude Orchestrateur
**Version** : V1.0 — fiche A2 (première fiche d'une série de 16)
**Objet** : SOP par hypothèse Buy Box + Analyse comparée Enquête. Document de référence consultable en situation réelle KAM, et matière source pour la roadmap d'automatisation Amazon Pilot.

---

## INVENTAIRE DES HYPOTHÈSES (16 au total)

### ⚠️ PRÉCISION FONDAMENTALE — perspective des codes de disponibilité PO

**Les codes de disponibilité (`AC`, `IA`, `IR`, `OS`, `CK`, `CP`, `CQ`, `R2`, `CA`) qui figurent dans le rapport POItemExport sont émis par le FOURNISSEUR, pas par Amazon.**

Le cycle de communication est :
1. Amazon émet un PO (Purchase Order) au fournisseur
2. Le fournisseur répond via EDI (ou manuellement dans Vendor Central) en apposant un code de disponibilité
3. Ce code matérialise **la réponse du fournisseur face à la demande Amazon**

Cette précision est capitale pour interpréter correctement chaque hypothèse :
- `AC` / `IA` = le **fournisseur** a accepté (manuellement ou par EDI)
- `IR` / `OS` = le **fournisseur** signale une rupture temporaire
- `CK` = le **fournisseur** signale une rupture longue / refus
- `CP` = le **fournisseur** signale une fin de série
- `CQ` = le **fournisseur** refuse car franco non atteint sur sa propre grille tarifaire
- `R2` = le **fournisseur** refuse le prix de cession proposé par Amazon
- `CA` = pré-lancement, pas encore commandable

Une dérive Amazon (ex. pricing automatique aberrant) peut **provoquer** un code fournisseur (ex. `R2` lié à un prix farfelu proposé par Amazon), mais le code lui-même reste apposé par le fournisseur.

---

### Analyse comparée — Enquête (4 sous-catégories À CREUSER)
- [x] **A2** — Stock dormant *(fiche ci-dessous)*
- [x] **D1** — Mystère (`AC` ou `IA Clôturé`) *(fiche ci-dessous)*
- [x] **D2** — PO en cours (`IA Confirmé`) *(fiche ci-dessous)*
- [x] **R** — Désaccord commercial (`CQ` ou `R2`) *(fiche ci-dessous)*

### Buy Box — APPROCHE ABANDONNÉE le 30 mai 2026

**Décision méthodologique** : les 11 fiches Buy Box hypothèse-par-hypothèse listées ci-dessous **ne seront PAS produites**.

**Raison** : le test terrain mené sur 3 ASINs Cogex (B00PVPXVBE, B009G3EQ70, B0CKXVJGXS) a démontré que la liste plate des 11 hypothèses de l'écran Buy Box v3.6.8.9 ne couvre pas correctement les cas réels :
- Aucun des 3 ASINs testés ne correspond aux patterns de la liste plate
- B00PVPXVBE relève d'un cas type "stock présent mais non trusted" (non listé dans les 11 hypothèses)
- B009G3EQ70 relève d'une "sous-exposition durable Featured Offer" (non listé)
- B0CKXVJGXS relève d'un "problème variation-level" (non listé)

**Méthode officielle remplacante** : cadre **BB-1 à BB-12** issu de la méthodologie GPT-5 V2, validé empiriquement sur ces 3 cas Cogex. Cf. documents officiels :
- `livrable_audit_buybox_vendor1p_v2.md` — méthodologie officielle (12 codes diagnostics, séquence d'audit, templates case Amazon)
- `modele_audit_buybox_vendor1p_v2.xlsx` — outil opérationnel à utiliser en parallèle d'Amazon Pilot d'ici v3.8

**Métrique centrale ajoutée** : Featured Offer Page Views (rapport `Retail Analytics → Traffic` de Vendor Central) — pas encore ingérée dans Amazon Pilot, à intégrer en v3.7.

**Principe central V2** : `Stock Amazon possédé ≠ stock fiable ≠ stock exposé ≠ Buy Box Amazon`. La vraie question n'est plus "y a-t-il du stock ?" mais "Amazon fait-il suffisamment confiance à ce stock pour l'exposer en Retail Featured Offer ?"

**Intégration dans Amazon Pilot** : refonte UX Buy Box en 3 niveaux + 2 agents distincts (Agent BB Diagnostic v3.8 + Agent Communication Amazon v3.9), précédée de 4 maquettes HTML obligatoires.

### Buy Box (ex-liste 11 hypothèses — abandonnée)
- [ ] BOL non transmis aux opérationnels
- [ ] Concurrent 3P prix
- [ ] Stock insuffisant
- [ ] PO non confirmé
- [ ] Suppression éligibilité (compliance)
- [ ] Pricing automatique Vendor
- [ ] Listing inactif
- [ ] CRaP désigné
- [ ] Variation parent/enfant perdue
- [ ] Spécifications incohérentes
- [ ] Restriction marché
- [ ] *(placeholder — autres hypothèses à venir)*

---

## FORMAT UNIFIÉ DES FICHES (gabarit)

Chaque fiche suit cette structure stricte :
1. **Définition** — Qu'est-ce que cette hypothèse signifie en termes métier ?
2. **Quand suspecter** — Symptômes terrain
3. **Procédure d'investigation** — Sources, étapes, croisements
4. **Critères de confirmation / écartement** — Décision binaire
5. **Action si confirmée** — Plan d'action priorisé
6. **Délai typique de résolution**
7. **Automatisable dans Amazon Pilot ?** — Détection / vérification / résolution
8. **Sources de données**
9. **Pistes roadmap Amazon Pilot** — manques détectés
10. **Références externes** (si applicable)
11. **Cas réel** (optionnel)

---

# HYPOTHÈSE A2 — Stock dormant

## 1. Définition

ASIN qui répond aux 3 conditions simultanées :
- **Présent dans le catalogue actif** (vendu en période de référence N-1)
- **Aucune vente en période courante N** (CA_A = 0)
- **Stock Amazon Retail présent** (`Unités vendables en stock` > 0, et notamment `Unités vendables datant de plus de 90 jours` > 0)
- **Pas de PO récent** dans la fenêtre d'observation (par défaut 4 mois)

**Le critère pathologique** n'est PAS le stock dormant en soi (qui peut être saisonnier ou normal), mais l'**arrêt total des ventes alors que le stock est présent**, hors saisonnalité reconnue. Amazon cherche normalement toujours à ajuster son stock vers le bas en vendant — quand il arrête net, c'est qu'il y a un blocage côté offre, pas côté demande.

**Le vrai sujet de A2 n'est PAS "comment écouler le stock dormant"** mais **"POURQUOI Amazon a arrêté de vendre"**. C'est un symptôme dont les causes profondes peuvent être multiples (cf. section 5).

## 2. Quand suspecter

Tous les signaux ci-dessous activent l'hypothèse A2 :
- Présence d'`Unités vendables datant de plus de 90 jours` > 5 unités dans le rapport hebdo Stock_ASIN_Fabrication
- ET aucune vente N (`Quantité nette reçue` ≈ 0, ou `% de vente au détail` ≈ 0)
- ET aucun PO ouvert dans la période (`Quantité de bons de commande ouverts` = 0)
- ET pas de saisonnalité naturelle expliquant l'arrêt (BBQ en janvier, articles plage en novembre, etc.)
- ET produit n'est pas en fin de série annoncée (code dispo dernier PO ≠ `CP`)

**Seuil-plancher de criticité** : à partir de **5 unités vendables 90j+ sans aucune vente sur la même période**, le cas est "très très louche" et mérite une investigation. En-dessous de ce seuil, on est dans le bruit normal du catalogue.

**Signal additionnel renforçant la suspicion** : si plusieurs ASINs du même client passent en A2 simultanément, c'est probablement une cause systémique (défauts inbound récurrents, problème de pricing, etc.), pas un cas isolé.

## 3. Procédure d'investigation

Investigation en **2 niveaux** :
- **Niveau 1** : qualifier que c'est bien un A2 pathologique (pas un faux positif)
- **Niveau 2** : diagnostiquer laquelle des 7 sous-causes est à l'œuvre (cf. section 5)

### Niveau 1 — Qualifier A2 pathologique

**Étape 1.1 — Extraire les données de référence**

Sources :
- `Stock_ASIN_Fabrication_*.csv` (rapport hebdo Stock Amazon Retail)
- `Ventes_ASIN_*.csv` (rapport ventes 12 mois)
- `POItemExport.csv` (historique POs)

Pour l'ASIN candidat, relever :
- `Unités vendables en stock` (stock total)
- `Unités vendables datant de plus de 90 jours` (stock dormant)
- `% de vente au détail` (rotation actuelle)
- Ventes N-1 sur la même période (référence)
- Date du dernier PO actif
- Code dispo du dernier PO (`AC`, `IA`, `IR`, etc.)

**Étape 1.2 — Calculer la vitesse de rotation moyenne historique**

Vitesse rotation = (Unités vendues sur les 12 derniers mois hors période actuelle) / 365 jours
→ donne un repère "vitesse normale" en unités/jour pour cet ASIN.

Si stock 90j+ × vitesse rotation moyenne >> 90 jours de couverture, c'est anormal : Amazon devrait avoir déjà écoulé.

**Étape 1.3 — Écarter la saisonnalité**

Croiser les ventes N-1 sur la **même fenêtre calendaire** que la période courante (ex. comparer mai-2026 vs mai-2025). Si N-1 vendait à cette période, l'arrêt actuel n'est pas saisonnier → A2 pathologique confirmé.

Si N-1 ne vendait pas non plus à cette période, c'est probablement saisonnier → écarter A2, classer en saisonnier normal.

**Étape 1.4 — Écarter la fin de série prévue**

Si le code dispo du dernier PO est `CP` (fin de série, sortie organisée), c'est un B (Sortie organisée), pas un A2. Écarter.

### Niveau 2 — Diagnostiquer la sous-cause

Une fois A2 pathologique confirmé, **investigation des 7 sous-causes possibles** (cf. section 5 ci-dessous). Cette investigation se fait dans Vendor Central directement, écran par écran.

## 4. Critères de confirmation / écartement

### Critères de confirmation (A2 pathologique)
- Stock vendable 90j+ > 5 unités ET aucune vente sur la période ET pas de PO ouvert
- Vitesse rotation historique > 0 (l'ASIN se vendait avant)
- N-1 vendait sur la même fenêtre calendaire (pas saisonnier)
- Dernier PO n'est pas `CP` (pas une fin de série prévue)

### Critères d'écartement (faux positif A2)
- Saisonnalité claire : N-1 ne vendait pas non plus à cette période → écartement
- Fin de série annoncée : code dispo dernier PO = `CP` → reclassifier en B (Sortie organisée)
- Stock < 5 unités vendable 90j+ → bruit normal, écartement
- Vente en cours sur la période A (même faible) → pas un A2, plutôt un déclin lent → reclassifier
- PO ouvert dans la fenêtre → pas un A2, c'est D2 (PO en cours) → reclassifier

## 5. Les 7 sous-causes profondes de A2

Une fois A2 pathologique confirmé, déterminer laquelle des 7 sous-causes est à l'œuvre. Plusieurs peuvent coexister sur le même ASIN. **Le scoring de probabilité ci-dessous est issu du doc GPT-5 sourcé sur Vendor Central forums + Amalytix + Reason Automation** — indicatif, à pondérer selon le contexte client.

### Sous-cause 5.1 — Inventory reliability dégradée (probabilité très élevée si défauts inbound)

**Définition** : Amazon a physiquement reçu les palettes mais ses systèmes ne font plus confiance au lien PO → ASN → BOL → appointment → réception → ASIN vendable. Le stock existe mais devient "opérationnellement douteux" pour la recommandation retail.

**Signaux à chercher** :
- Historique de défauts BOL mismatch, ASN inaccuracy, PRO/BOL mismatch sur l'ASIN ou le compte
- Quantités reçues divergentes des PO confirmées
- Réceptions FC non rapprochées
- Appointment mismatch ou no-show récents

**Conséquence Amazon Pilot** : c'est l'hypothèse n°1 si le client a un historique chargé de défauts livraison. Cogex est typiquement dans ce cas (cf. 73 ASINs purchase hold détectés v3.6.8 backlog v3.6.10).

### Sous-cause 5.2 — Stock physiquement présent mais non "sellable" (probabilité très élevée)

**Définition** : nuance capitale entre stock total et stock vendable. Amazon peut avoir 645 unités en FC sans qu'elles soient toutes vendables.

**Causes possibles** :
| Cause | Effet |
|---|---|
| Stock en réception non finalisée | pas buyable |
| Stock en FC mais en quarantaine | pas buyable |
| Stock endommagé / suspect | pas buyable |
| Stock mal rattaché à l'ASIN | pas buyable |
| Stock bloqué en investigation | pas buyable |
| Stock en transfert inter-FC | disponibilité instable |
| Stock réservé / non alloué | Buy Box instable |
| Stock reçu sous mauvaise référence | dormant ou invisible retail |

**Vérification Vendor Central** : comparer `Stock disponible à la vente` (€) vs `Stock disponible invendable` (€). Si l'invendable est élevé, on est dans ce cas.

### Sous-cause 5.3 — Excess inventory / business inventory management suppression (probabilité élevée)

**Définition** : Amazon a sur-stocké et supprime temporairement l'offre Featured pour réduire l'exposition le temps d'écouler. Cas documenté Vendor Central : témoignage modérateur Amazon confirmant que ces suppressions dépendent du forecasting et de l'inventory actuel.

**Symptôme typique** : message Vendor Central type "offre temporairement supprimée pour business and inventory management reasons, sera rétablie automatiquement quand les circonstances changent".

**Vérification** : Inventory Health Report, sell-through rate, semaines de couverture. Si la couverture stock est >> que la demande prévue, on est dans ce cas.

### Sous-cause 5.4 — Pricing threshold / prix externe / price matching non soutenable (probabilité moyenne à élevée)

**Définition** : Amazon a une logique de seuil de prix interne. Si le prix retail Amazon est jugé trop élevé vs marché externe (ou si un retailer hors Amazon vend moins cher), la Featured Offer peut être supprimée.

**Vérification** :
- Comparer le prix Amazon FR vs le prix de l'ASIN chez d'autres retailers (recherche Google Shopping)
- Vérifier si Amazon compare une mauvaise variante ou un pack size différent
- Vérifier si une promotion externe en cours fausse le seuil
- Détecter le statut CRaP (Can't Realize a Profit — Amazon perd de l'argent sur l'ASIN au prix actuel)

### Sous-cause 5.5 — Offre 3P Prime plus attractive (probabilité moyenne)

**Définition** : Même avec du stock 1P, un vendeur 3P peut gagner la Featured Offer si son offre est meilleure selon l'algorithme (prix total, promesse de livraison, Prime/FBA, performance vendeur, stock plus proche du client).

**Vérification** : sur la page ASIN public, regarder :
- Qui est Featured Offer ?
- Amazon est-il dans "Other sellers" ?
- Un 3P FBA est-il moins cher ?
- L'offre Amazon est-elle visible mais non featured ?

| Cas | Diagnostic |
|---|---|
| Amazon visible mais pas Buy Box | perte au profit d'un concurrent 3P |
| Amazon absent des offres | retail offer supprimée / non buyable |
| Aucune Buy Box | suppression Featured Offer |
| Page indisponible | buyability ou stock vendable bloqué |

### Sous-cause 5.6 — Promesse de livraison insuffisante (probabilité moyenne)

**Définition** : la Featured Offer n'est pas seulement une affaire de prix. Amazon mentionne aussi la "delivered promise" comme facteur de sélection. Même avec du stock, l'offre peut être dégradée si Amazon ne peut pas garantir une promesse client fiable.

**Symptômes typiques** :
- Buy Box visible pour certains codes postaux mais pas d'autres
- Disponible en compte Business mais pas en compte standard (cas vécu)
- Disponible un jour puis indisponible
- Promesse longue ou instable
- Amazon présent dans les offres mais non featured

**Causes profondes** : stock dans un FC éloigné, stock en transfert, stock non éligible Prime, stock non disponible pour certaines zones, problème de transport interne, quantité faible ou dispersée, stock en cours de réconciliation.

### Sous-cause 5.7 — Suppression catalogue / conformité (probabilité moyenne à faible)

**Définition** : Amazon distingue la capacité d'un produit à être "buyable" et à être "discoverable". Un listing peut être suppressed à cause d'un attribut catalogue défaillant (count type, unit count, image, variation, etc.).

**Vérification** :
- Statut catalogue dans Vendor Central
- Attributs obligatoires manquants
- Mauvais count type / unit count
- Images non conformes
- Variation parent/enfant incohérente
- Marque / EAN / licence en conflit
- Catégorie / browse node sensible
- Produit restreint

Moins probable si la suppression touche massivement des ASINs liés aux mêmes incidents inbound (auquel cas 5.1 ou 5.2 sont plus probables).

### Sous-cause 5.8 — CRaP / profitabilité insuffisante (mentionnée mais redondante avec 5.4)

Souvent une variante de 5.4 (pricing threshold). À mentionner si Amazon affiche explicitement un statut CRaP côté Vendor Central.

### Sous-cause 5.9 — Forecast / demand planning (probabilité élevée si vue d'ensemble cohérente)

**Définition** : Amazon a stoppé les POs et l'exposition retail parce qu'il a re-forecasté à la baisse, ou parce que l'ASIN est passé dans une logique "do not reorder".

**Signaux** :
- Arrêt total des POs depuis plusieurs mois
- Amazon ne recommande plus l'ASIN dans Retail Analytics
- Suggestion d'écoulement avant nouvelle commande

### Grille de probabilité dans le contexte client Cogex / Gers

Pour les comptes avec historique de défauts inbound (cas Cogex avec 73 ASINs purchase hold) :

| Rang | Sous-cause | Probabilité |
|---|---|---|
| 1 | Inventory reliability / inbound defect signal (5.1) | Très élevée |
| 2 | Stock non sellable malgré stock physique (5.2) | Très élevée |
| 3 | Excess inventory suppression (5.3) | Élevée |
| 4 | Forecast / sell-through faible (5.9) | Élevée |
| 5 | Pricing threshold (5.4) | Moyenne à élevée |
| 6 | Offre 3P Prime attractive (5.5) | Moyenne |
| 7 | Promesse livraison instable (5.6) | Moyenne |
| 8 | Suppression catalogue (5.7) | Moyenne à faible |

## 6. Action si confirmée

### Action principale : ouverture d'un cas Amazon bien argumenté

**Ne PAS parler de Buy Box** dans le titre du cas. Parler de **Retail offer availability** et **inventory reliability**.

#### Titre du cas Amazon recommandé

```
Bulk ASIN review requested – Amazon Retail offer not buyable despite on-hand inventory
```

#### Angle du cas

```
The affected ASINs show Amazon on-hand / dormant inventory, but the Amazon Retail offer is no longer featured, recommended or buyable. We suspect the issue may be linked to inventory reliability, receiving reconciliation, excess inventory, or retail availability signals following inbound defects.
```

#### Questions à poser dans le cas

```
For each ASIN, could Amazon confirm whether the retail offer is blocked or degraded due to:

1. inventory reliability / receiving reconciliation issue;
2. sellable vs unsellable inventory status;
3. excess inventory / business inventory management suppression;
4. pricing threshold / external price competitiveness;
5. CRaP / profitability issue;
6. delivery promise / FC allocation issue;
7. catalog suppression / compliance issue;
8. 3P offer winning the Featured Offer;
9. forecast / demand planning status;
10. any other retail availability restriction?
```

### Phrase de diagnostic à utiliser avec Amazon

```
Amazon Retail has on-hand inventory, but the ASIN is not buyable / not featured.
Please confirm whether the issue is caused by inventory reliability, sellable
inventory status, excess inventory suppression, pricing threshold, or another
retail availability restriction.
```

### Actions complémentaires selon la sous-cause identifiée

| Sous-cause confirmée | Action prioritaire |
|---|---|
| 5.1 Inventory reliability | Audit défauts inbound 90j (BOL, ASN, CARP) + plan correctif fournisseur + demander review réception |
| 5.2 Stock non sellable | Demander statut détaillé sellable/unsellable + investigation FC sur ASINs concernés |
| 5.3 Excess inventory | Accepter le statut + attendre écoulement OU négocier ramp-up promotionnel |
| 5.4 Pricing threshold | Audit prix marché + ajuster prix de cession si possible + demander price match review |
| 5.5 3P attractive | Analyser l'offre 3P + ajuster pricing ou disponibilité retail |
| 5.6 Promesse livraison | Demander review allocation FC + transferts inter-FC |
| 5.7 Catalogue | Audit attributs catalogue + correction images / variations / EAN |
| 5.9 Forecast | Demander à Amazon les raisons du re-forecasting + propositions de relance |

### Actions à éviter

- **Ne pas brader** précipitamment (ça ne résout pas la cause profonde, ça crée juste un précédent commercial défavorable)
- **Ne pas demander retour fournisseur** sans avoir épuisé les leviers Amazon (return-to-vendor a un coût + perte de présence catalogue)
- **Ne pas couper l'ASIN** tant que la cause n'est pas comprise (un ASIN A2 qui devient B définitif est une perte sèche)

## 7. Délai typique de résolution

**Ordre de grandeur : 2 mois**, dans une fourchette de 1 à 3 mois selon la sous-cause :

| Sous-cause | Délai typique |
|---|---|
| 5.4 Pricing threshold | 2-4 semaines (relativement rapide après ajustement prix) |
| 5.7 Catalogue | 2-4 semaines après correction attribut |
| 5.3 Excess inventory | 1-3 mois (écoulement naturel) |
| 5.1 Inventory reliability | 2-3 mois (long — Amazon doit reconstruire la confiance) |
| 5.2 Stock non sellable | 1-3 mois (investigation FC longue) |
| 5.6 Promesse livraison | 1-2 mois (transfert FC) |
| 5.9 Forecast | 2-3 mois (cycle de re-forecasting Amazon) |

**Conséquence opérationnelle** : pas de mode panique court terme sur A2. Le suivi se fait dans la durée. Amazon Pilot devrait permettre de tracer l'âge des cas ouverts pour ne pas perdre la trace des A2 en attente.

## 8. Automatisable dans Amazon Pilot ?

### Détection automatique — déjà partiellement implémentée v3.6.8

| Critère | Statut |
|---|---|
| ASIN absent N + présent N-1 | ✅ Algorithme Enquête v3.6.8 |
| Stock Amazon présent (`sellableUnits` > 0) | ✅ Données disponibles |
| Pas de PO récent dans la fenêtre | ✅ Algorithme Enquête v3.6.8 |
| Stock 90j+ détaillé | ⚠️ Champ `Unités vendables datant de plus de 90 jours` disponible dans le CSV Stock_ASIN_Fabrication mais pas encore ingéré dans Amazon Pilot |
| Seuil 5 unités appliqué | ⚠️ À implémenter dans `classifyMissingASINs()` |

### Vérification automatique — pistes nouvelles

| Vérification | Faisabilité |
|---|---|
| Calcul vitesse rotation historique par ASIN | Possible avec données ventes 12 mois (déjà importées) — module dérivé à créer |
| Distinction saisonnier / non saisonnier | Possible en croisant N-1 sur même fenêtre calendaire |
| Détection des défauts BOL/ASN historiques sur l'ASIN | Possible avec rapport Délivery (déjà importable) — pertinent pour sous-cause 5.1 |
| Comparaison `Stock vendable` vs `Stock invendable` | Possible avec rapport Stock_ASIN_Fabrication (déjà importable) — pertinent pour sous-cause 5.2 |
| Détection statut CRaP | Non automatique — nécessite vérification manuelle dans Vendor Central |
| Comparaison prix Amazon vs marché externe | Non automatique — nécessite scraping ou API tiers |
| Vérification offre 3P sur ASIN | Possible via API Amazon Buy Box (déjà utilisée en partie module Buy Box) |

### Résolution automatique — non automatisable

L'ouverture du cas Amazon est et reste manuelle. Amazon Pilot peut **assister** :
- CTA "Ouvrir un cas A2 dans Vendor Central" avec template pré-rempli (titre + angle + 10 questions)
- Tracking de l'âge du cas ouvert (compteur de jours depuis création)

## 9. Pistes roadmap Amazon Pilot

Manques structurels détectés via la production de cette fiche, à reporter sur la roadmap future (pas dans v3.6.9 figé) :

| Manque | Piste | Version cible probable |
|---|---|---|
| Vitesse de rotation moyenne par ASIN comme référentiel | Module dérivé `smoke_history` + ventes 12 mois → calcul auto vitesse rotation référentielle, utilisable par tous les diagnostics | v3.7 ou v3.8 |
| Sub-classification automatique des 7 sous-causes A2 | Algorithme de scoring basé sur signaux disponibles (défauts BOL count, ratio sellable/invendable, vitesse rotation, présence statut CRaP, etc.) | v3.7 |
| Détection automatique saisonnalité | Croisement N-2 / N-1 / N sur même fenêtre calendaire | v3.7 |
| Template case Amazon pré-rempli pour A2 | CTA "Ouvrir un cas A2" depuis fiche détail Enquête avec template "inventory reliability" pré-rédigé en EN | v3.6.10 ou v3.7 |
| Suivi cas Amazon ouverts par âge | Module "Cas en cours" cross-ASIN avec compteur de jours depuis ouverture, alerte si > 60 jours sans réponse | v3.8 |
| Ingestion native du champ "stock 90j+" | Enrichir `c.asins[i]` avec `unitsAged90Plus` depuis Stock_ASIN_Fabrication | v3.6.10 (peut être combiné avec parser ERP existant) |
| Détection automatique défauts inbound corrélés à A2 | Croisement A2 × défauts livraison sur 90j pour identifier le pattern "défauts → A2" | v3.6.10 |

## 10. Sources de données

| Source | Champ utile | Statut Amazon Pilot |
|---|---|---|
| `Stock_ASIN_Fabrication_*.csv` (hebdo) | `Unités vendables datant de plus de 90 jours`, `Unités vendables en stock`, `Stock disponible à la vente`, `Stock disponible invendable` | Partiellement ingéré v3.6.6.2 |
| `Ventes_ASIN_*.csv` (12 mois) | `Quantité vendue`, par mois | Ingéré v3.6.6.2 |
| `POItemExport.csv` (12 mois) | Date PO, code dispo, statut, vendor code | Ingéré v3.6.8 |
| `Delivery_*.csv` (12 mois) | Défauts livraison BOL/ASN/CARP par ASIN | Partiellement disponible, non ingéré natif (référence v3.6.10) |
| Vendor Central — Inventory Health Report | sell-through rate, aged inventory, semaines de couverture | Non ingéré, vérification manuelle |
| Vendor Central — page ASIN | Statut Featured Offer, Other Sellers, statut catalogue | Non ingéré, vérification manuelle |

## 11. Références externes

Le diagnostic des sous-causes A2 s'appuie sur les sources externes suivantes (à considérer comme indicatives, pas autoritaires — forums et docs tiers) :

- **Amazon Seller Central forums** — discussions sur excess inventory suppression et Vendor Central Direct Fulfillment Inventory Product Suppression
- **Amalytix — Amazon Inventory Health Report Guide for Vendors** — métriques sellable on hand et arbitrages Vendor 1P
- **Reason Automation — Amazon Lost Buy Box and Lost Featured Offer metrics** — arbitrage entre Vendor 1P et 3P Prime
- **Amazon Seller Central docs — Becoming the Featured Offer** (G201687550) — facteurs de sélection officiels
- **SP-API docs — Understanding Amazon listing status** — distinction buyable / discoverable

Ces sources sont citées pour ancrer l'analyse, pas pour faire autorité. Le savoir-faire KAM Fred (validé par expérience terrain Cogex + Gers) prime en cas de désaccord.

## 12. Cas réel — référence Cogex

Cogex Outillage a actuellement (au 29 mai 2026) un historique de **73 ASINs en purchase hold détectés v3.6.8 via croisement BOL mismatch × catalogue**. Ces ASINs sont des candidats forts pour la sous-cause 5.1 (Inventory reliability dégradée) et constituent un terrain de validation idéal pour la procédure A2.

**Recommandation** : sur les premiers cas Cogex traités via la procédure A2 ci-dessus, capitaliser :
- Quelle sous-cause s'est confirmée le plus souvent ?
- Quel délai de résolution réel observé ?
- Quel template de case Amazon a le mieux fonctionné ?

Ces apprentissages alimenteront une **V2 de cette fiche** dans 3-6 mois.

---

# HYPOTHÈSE D1 — Mystère (`AC` ou `IA Clôturé`)

## 1. Définition

ASIN qui répond aux 4 conditions simultanées :
- **Présent dans le catalogue actif** (vendu en période de référence N-1)
- **Aucune vente en période courante N** (CA_A = 0)
- **PO récent** dans la fenêtre d'observation (par défaut 4 mois) — pas d'absence de PO
- **Code dispo du dernier PO = `AC` (Accepté confirmé manuellement) OU `IA` avec Statut `Clôturé`**

**Le point clé de D1** : les deux signaux PO sont **positifs**. `AC` = Amazon a accepté manuellement, stock OK côté approvisionnement. `IA Clôturé` = Amazon a reçu et traité l'acceptation EDI, le PO est arrivé au bout de son cycle administratif. Pourtant l'ASIN ne vend plus.

**Angle directeur de D1** (différent de A2) :

> **Le flux procurement a fonctionné, mais le flux retail availability ne s'est pas réactivé.**

C'est la phrase de diagnostic centrale. Le mystère n'est pas "pourquoi Amazon n'a pas accepté ?". Le mystère est :

> **"Pourquoi Amazon accepte / clôture le procurement, mais ne remet pas l'ASIN en vente ?"**

**Faux signal de réassurance** : `AC` et `IA Clôturé` prouvent que la chaîne PO a fonctionné. Ils ne prouvent **pas** que :
- Le stock est sellable
- L'offre retail est active
- L'ASIN est buyable
- Amazon a bien rattaché le stock à l'ASIN
- La Buy Box est éligible
- Le produit est recommandable
- Le stock est disponible pour le canal client concerné

## 2. Quand suspecter

Tous les signaux ci-dessous activent l'hypothèse D1 :
- Présence d'un PO récent (< X mois, défaut 4) sur l'ASIN
- ET code dispo du dernier PO = `AC` OU `IA Clôturé`
- ET aucune vente sur la période courante N
- ET pas de saisonnalité naturelle expliquant l'arrêt

**Signal de différenciation D1 vs A2** : pour A2, le critère est l'**absence** de PO récent + stock dormant. Pour D1, c'est la **présence** d'un PO récent + signaux PO rassurants + arrêt commercial.

**Signal additionnel renforçant la suspicion** : si l'ASIN se vendait normalement il y a 6-12 mois (vitesse de rotation historique > 0), et qu'il est passé en arrêt sec malgré un PO récent accepté, le mystère est confirmé.

## 3. Procédure d'investigation

Investigation en **2 niveaux**, structurée différemment de A2 :
- **Niveau 1** : caractériser l'état aval de l'ASIN (4 cas distincts à distinguer)
- **Niveau 2** : diagnostiquer la sous-cause downstream

### Niveau 1 — Caractériser l'état aval de l'ASIN

Le terme "ASIN disparu" peut cacher 4 états très différents qui imposent des actions très différentes. **Vérification obligatoire avant tout case Amazon** :

| Vérification | Méthode | Conclusion |
|---|---|---|
| L'ASIN est-il trouvable en recherche sur amazon.fr ? | Recherche par mot-clé / EAN | Si NON → suppression search / non discoverable |
| L'ASIN est-il accessible par URL directe ? | Construire l'URL `amazon.fr/dp/{ASIN}` | Si page = "currently unavailable" → buyability bloquée |
| Amazon Retail est-il dans les vendeurs visibles ? | Vue page produit + "Other Sellers" | Si NON visible → retail offer désactivée |
| Si Amazon Retail visible, est-il Featured Offer ? | Vue page produit | Si NON → prix / concurrence / promesse |

**Grille de lecture issue du doc GPT-5** :

| Cas observé | Diagnostic aval |
|---|---|
| ASIN introuvable en recherche | discoverability / ranking / search suppression |
| ASIN accessible par URL mais "currently unavailable" | buyability / stock vendable bloqués |
| ASIN accessible, Amazon absent des vendeurs | retail offer désactivée |
| ASIN accessible, Amazon présent mais pas Buy Box | prix / concurrence / promesse |
| ASIN accessible, Amazon Featured mais pas de ventes | problème conversion / pricing / SEO interne |

Cette caractérisation oriente toute la suite. **Le traitement Amazon ne sera pas le même selon le cas.**

### Niveau 2 — Diagnostiquer la sous-cause downstream

Une fois l'état aval caractérisé, **investigation des 7 sous-causes possibles** (cf. section 5). Ces sous-causes sont les mêmes que pour A2 mais avec un **scoring de probabilité différent** (cf. grille 5.X).

## 4. Critères de confirmation / écartement

### Critères de confirmation (D1 caractérisé)
- PO récent < X mois avec code AC ou IA Clôturé
- Aucune vente sur période A
- Vitesse de rotation historique > 0 (l'ASIN se vendait avant)
- L'un des 4 cas de Niveau 1 est observé (non discoverable / non buyable / retail désactivée / non Featured)

### Critères d'écartement (faux positif D1)
- Saisonnalité reconnue (N-1 ne vendait pas non plus sur la même fenêtre calendaire)
- Reprise des ventes même faibles sur période A → reclassifier en "déclin lent" hors D1
- PO encore ouvert / non clôturé → c'est D2 (PO en cours), pas D1
- ASIN avec stock 90j+ pathologique sans PO récent → c'est A2, pas D1
- Code dispo dernier PO différent de AC ou IA Clôturé → autre classification

## 5. Les 7 sous-causes profondes de D1 (re-scorées vs A2)

**Différence majeure vs A2** : pour D1, les signaux PO étant rassurants (Amazon a accepté), les sous-causes "amont" (inventory reliability suite à défauts inbound) descendent dans le scoring. Les sous-causes "aval" (retail availability, inventory management) remontent.

### Grille de probabilité D1 (contexte Cogex / Gers)

| Rang | Sous-cause | Probabilité D1 | Probabilité A2 (comparaison) |
|---|---|---|---|
| 1 | Inventory management suppression / excess inventory | **Très élevée** | Élevée (rang 3 sur A2) |
| 2 | Stock présent mais non sellable / non marketable | **Très élevée** | Très élevée |
| 3 | Retail offer inactive / ASIN not buyable | **Très élevée** | (intégrée dans 5.2 sur A2) |
| 4 | Featured Offer inéligible pour prix / prix externe | Moyenne à élevée | Moyenne à élevée |
| 5 | Promesse livraison / FC allocation / disponibilité locale | Moyenne | Moyenne |
| 6 | Search suppression / attribut catalogue | Moyenne | Moyenne à faible |
| 7 | Offre 3P Prime plus attractive | Moyenne | Moyenne |
| 8 | Inbound reconciliation / ASN / BOL issue | **Faible** | **Très élevée (rang 1 sur A2)** |

Note : Le rang 8 de D1 (inventory reliability) est paradoxalement BAS car les codes AC et IA clôturé prouvent que la chaîne PO a fonctionné. Si l'inventory reliability était dégradée, le PO n'aurait probablement pas été confirmé ou clôturé proprement. Donc cette sous-cause reste possible mais peu probable en première intention.

### Description des sous-causes (rappel — détail dans la fiche A2 §5)

**5.1 Inventory management suppression / excess inventory** (rang 1 D1)
Amazon a accepté le PO, le stock est arrivé, mais Amazon a re-calibré et décide de ne pas exposer l'offre Featured tant que le stock ne s'écoule pas. Cas documenté Vendor Central : "offre temporairement supprimée pour business and inventory management reasons".

**5.2 Stock présent mais non sellable** (rang 2 D1)
Le stock est en FC mais pas dans un état "sellable on hand" : quarantaine, réservé, en transfert inter-FC, endommagé, mal rattaché. La PO est propre mais le stock ne devient pas réellement vendable.

**5.3 Retail offer inactive** (rang 3 D1)
Amazon a du stock mais décide de ne pas exposer son offre retail (seuil prix, sell-through faible, faible profitabilité, restriction commerciale). Cas documenté : stock affiché disponible mais "not buyable".

**5.4 à 5.8** : voir fiche A2 §5 (descriptions identiques).

### Désalignement entre systèmes Amazon (insight clé D1)

Le cas D1 illustre que les systèmes Amazon peuvent avoir des **états divergents** simultanément :

| Système | Peut dire |
|---|---|
| PO / Vendor Procurement | accepté / clôturé (= AC, IA Clôturé) |
| Inventory Health | stock disponible ou présent |
| Retail offer | non buyable |
| Amazon Ads | out of stock |
| Page produit | unavailable |
| Search | invisible |
| Buy Box | absente |

**Conséquence opérationnelle** : le case Amazon doit demander explicitement de **comparer les états entre systèmes**, pas se contenter d'un seul indicateur. C'est un point clé qui différencie D1 de A2.

## 6. Action si confirmée

### Action principale : case Amazon avec angle "downstream from procurement"

**Différence majeure vs A2** : le case D1 doit ouvertement **acknowledger** que la PO a fonctionné, et orienter l'investigation **vers l'aval**. Ne pas redemander d'investiguer la PO.

#### Titre du case Amazon recommandé

```
ASIN no longer buyable / featured despite completed PO lifecycle (AC / IA closed)
```

#### Angle du case (phrase clé)

```
The PO lifecycle appears completed, but the ASIN is no longer buyable / discoverable / featured.
Please confirm which retail availability restriction is currently applied to this ASIN.
```

#### Template de case Amazon (issu doc GPT-5, à adapter par ASIN)

```
Hello,

We need Amazon's help to investigate an ASIN that stopped selling during 
period A despite a recent PO lifecycle showing positive signals:

- Last availability code: AC – accepted / manually confirmed
- Or related status: IA closed – accepted through EDI and PO now closed
- Amazon appears to have accepted the PO flow, yet the ASIN is no longer 
  selling / no longer visible / no longer buyable.

Could you please confirm the current retail availability status of the ASIN 
and identify whether the issue is caused by one of the following:

1. Amazon Retail offer inactive or suppressed;
2. Inventory available but not sellable;
3. Inventory in receiving / transfer / reserved / unsellable status;
4. Excess inventory or business inventory management suppression;
5. Pricing threshold / Featured Offer ineligibility;
6. Delivery promise issue;
7. Catalog suppression / search suppression;
8. ASIN discoverability issue;
9. Receiving reconciliation issue;
10. Any other retail availability restriction.

The PO acceptance and closure signals suggest that the procurement flow is 
completed. The issue is downstream from procurement and should be 
investigated as a retail availability / buyability / inventory management issue.

Please escalate to the appropriate Retail Availability / Instock / Inventory 
Health team if needed.
```

### Différenciation case D1 vs case A2

| Élément | Case A2 | Case D1 |
|---|---|---|
| Titre | "not buyable despite on-hand inventory" | "not buyable despite completed PO lifecycle" |
| Angle | "inventory reliability following inbound defects" | "downstream from procurement / retail availability" |
| Cible escalation | Vendor Operations / Inbound | Retail Availability / Instock / Inventory Health |
| Ordre des 10 questions | 5.1 inventory reliability en tête | 5.3 retail offer inactive en tête |

### Actions complémentaires selon Niveau 1 (caractérisation aval)

| État aval observé | Action prioritaire |
|---|---|
| Non discoverable (search) | Audit catalogue (attributs, count type, variations) + cas search team |
| Non buyable (currently unavailable) | Cas Retail Availability + audit sellable status |
| Retail désactivée (Amazon absent) | Cas Inventory Health + audit excess inventory |
| Non Featured (Amazon visible mais 3P gagne) | Audit pricing + concurrence + promesse |

### Actions à éviter

- **Ne pas demander à Amazon d'investiguer la PO** — elle est déjà acceptée et clôturée
- **Ne pas conclure trop vite à un défaut BOL** — peu probable si AC/IA Clôturé sont propres
- **Ne pas brader** ni couper l'ASIN avant compréhension de la sous-cause

## 7. Délai typique de résolution

**Ordre de grandeur : 1 mois**, soit ~1 mois de moins que A2. Justification :
- La PO récente prouve qu'Amazon "voulait" l'ASIN il y a peu
- La réactivation potentielle est plus rapide si le blocage est en aval (pricing, sellable status, recommandation retail)
- Mais si la sous-cause est `5.1 Inventory management suppression` (excess inventory), retour possible à 2-3 mois (besoin d'écoulement)

Fourchette estimée par sous-cause :

| Sous-cause D1 | Délai typique |
|---|---|
| 5.4 Pricing threshold | 2-4 semaines |
| 5.6 Search / catalogue | 2-4 semaines |
| 5.3 Retail offer inactive | 3-5 semaines |
| 5.2 Stock non sellable | 4-6 semaines |
| 5.1 Excess inventory suppression | 1-3 mois |
| 5.7 3P attractive | 2-4 semaines (ajustement pricing) |

## 8. Automatisable dans Amazon Pilot ?

### Détection automatique — déjà implémentée v3.6.8

| Critère | Statut |
|---|---|
| ASIN absent N + présent N-1 | ✅ Algorithme Enquête v3.6.8 |
| Présence PO récent dans fenêtre | ✅ Algorithme Enquête v3.6.8 |
| Code dispo AC ou IA Clôturé sur dernier PO | ✅ Algorithme Enquête v3.6.8 |
| Distinction IA Confirmé vs IA Clôturé | ✅ Statut PO parsé v3.6.8 |

### Vérification automatique — pistes nouvelles

| Vérification | Faisabilité |
|---|---|
| Caractérisation Niveau 1 (4 cas aval) | Possible partiellement via API Amazon — module Buy Box existant peut détecter "Amazon Featured / non Featured / absent" |
| Détection "currently unavailable" sur page ASIN | Possible via scraping public ou API Amazon |
| Détection "search suppressed" | Possible via API Amazon (statut catalogue) |
| Vitesse rotation historique > 0 | Possible avec ventes 12 mois ingérées |
| Désalignement entre systèmes Amazon (inventory / retail / search) | Non automatique — nécessite vérifications manuelles VC |

### Résolution automatique — non automatisable

L'ouverture du case Amazon reste manuelle. Amazon Pilot peut **assister** :
- CTA "Ouvrir un cas D1 dans Vendor Central" avec template "downstream from procurement" pré-rempli
- Affichage du Niveau 1 caractérisé (4 cas) directement dans la fiche détail de l'ASIN
- Tracking de l'âge du case ouvert (compteur de jours)

## 9. Pistes roadmap Amazon Pilot

Manques structurels spécifiques à D1 (à ajouter aux pistes A2) :

| Manque | Piste | Version cible probable |
|---|---|---|
| Caractérisation automatique Niveau 1 (4 cas aval) | Module dérivé exploitant l'API Buy Box existante + scraping public page ASIN | v3.6.10 ou v3.7 |
| Template case Amazon pré-rempli D1 (différent A2) | CTA "Ouvrir un cas D1" avec angle "downstream from procurement" + 10 questions ordonnées par scoring D1 | v3.6.10 ou v3.7 |
| Détection désalignement entre systèmes Amazon | Module dérivé qui croise inventory health / retail offer / search status pour détecter incohérences | v3.7 ou v3.8 |
| Distinction A2 vs D1 dans l'UI | Déjà fait v3.6.8 mais clarifier visuellement les actions différenciées (badge sous-catégorie + template case différent) | v3.6.9 (cosmétique) ou v3.6.10 |

## 10. Sources de données

| Source | Champ utile | Statut Amazon Pilot |
|---|---|---|
| `POItemExport.csv` | Code dispo (AC / IA), Statut PO (Confirmé / Clôturé), date PO, vendor code | Ingéré v3.6.8 |
| `Ventes_ASIN_*.csv` (12 mois) | Vitesse rotation historique, comparaison N-1 même fenêtre | Ingéré v3.6.6.2 |
| `Stock_ASIN_Fabrication_*.csv` | `Stock disponible vendable` vs `Stock disponible invendable`, `Unités sellable on hand` | Partiellement ingéré |
| Vendor Central — Inventory Health Report | sellable / unsellable / aged inventory | Non ingéré, vérification manuelle |
| Vendor Central — page ASIN publique | Featured Offer ? Amazon présent ? Currently unavailable ? Search suppressed ? | Non ingéré, vérification manuelle |
| API Amazon Buy Box | Statut Featured Offer + Other Sellers | Partiellement utilisée (module Buy Box existant) |

## 11. Références externes

Le diagnostic des sous-causes D1 s'appuie sur les sources externes suivantes (indicatives, pas autoritaires) :

- **Amazon Seller Central forums** — cas Vendor Central "How to Resolve Suppressed Listings Due to Excess Inventory" et "Vendor Central Direct Fulfillment Inventory Product Was Suppressed Other Reasons"
- **Amazon Seller Central forums (FR/CA/DE/ES)** — cas Featured Offer Ineligibility, listing not buyable despite all requirements met, FBA inventory shows Available but Amazon Ads says out of stock
- **Amalytix — Amazon Inventory Health Report Guide** — distinction Sellable / Unsellable / Aged 90+ On Hand Inventory
- **Wakecommerce / Amalytix** — guides chargebacks et ASN Accuracy (référence indirecte, pas pertinente directement pour D1)
- **Amazon Seller Central docs — Becoming the Featured Offer** (G201687550)

Ces sources convergent sur un point central : **AC et IA Clôturé sont des signaux administratifs PO, pas des garanties de disponibilité commerciale**. Le savoir-faire KAM Fred valide ce constat sur le terrain.

## 12. Cas réel — à capitaliser

Pas de cas concret D1 documenté à ce jour côté Cogex (à enrichir au fil des premiers cas traités via la procédure D1).

**Recommandation** : sur les premiers cas Cogex traités, capitaliser :
- Quel état aval (4 cas Niveau 1) revient le plus souvent ?
- Quelle sous-cause se confirme statistiquement le plus ?
- Quel délai de résolution réel observé (vs estimé 1 mois) ?
- Le template case D1 "downstream from procurement" est-il bien reçu par Amazon ?

Ces apprentissages alimenteront une **V2 de cette fiche** dans 3-6 mois.

---

# HYPOTHÈSE D2 — PO en cours (`IA Confirmé`)

## 1. Définition

ASIN qui répond aux 5 conditions simultanées :
- **Présent dans le catalogue actif** (vendu en période de référence N-1)
- **Aucune vente en période courante N** (CA_A = 0)
- **PO récent** dans la fenêtre d'observation (par défaut 4 mois)
- **Code dispo du dernier PO = `IA`** (Accepté EDI uniquement)
- **Statut de ce dernier PO = `Confirmé`** (PO encore ouvert, en cours de traitement)

**Cadre métier central** :

> **PO en cours mais le produit ne rentre pas en stock.**

Le blocage est **physique / logistique**, pas commercial. La PO existe, Amazon l'attend, le fournisseur l'a probablement engagée — mais quelque chose entre l'expédition fournisseur et l'inventaire vendable Amazon ne se déclenche pas.

**Différence vs D1** : un PO Confirmé est "vivant" — Amazon attend physiquement la marchandise. Un PO Clôturé (D1) a terminé son cycle administratif sans débloquer la situation commerciale.

| | D1 | D2 |
|---|---|---|
| Statut PO | Clôturé | **Confirmé (ouvert)** |
| Diagnostic | Découplage procurement / retail availability | **Marchandise qui ne rentre pas en stock** |
| Blocage suspect | Aval (retail systems) | **Logistique (chaîne fournisseur → Amazon)** |
| Délai résolution | ~1 mois | Variable selon sous-cas (cf. §7) |

**Piège central D2** : ne pas se dire "PO Confirmé donc tout va bien". Un PO IA Confirmé peut rester sans effet commercial à chaque maillon de la chaîne logistique downstream.

## 2. Quand suspecter

**Critère déclencheur de criticité** :

> **Date d'aujourd'hui > date de fin de fenêtre théorique de livraison + 3 semaines**

Avant ce seuil : attente normale, le PO suit son cours.
Au-delà : D2 anormalement long, à investiguer.

**Sub-classification par âge absolu du PO** (gravité) :

| Sous-cas | Âge PO | Lecture |
|---|---|---|
| **D2-A** | < 15 jours | Normal / en cours — pas d'action, surveiller |
| **D2-B** | 15-45 jours | Risque — investigation logistique requise |
| **D2-C** | > 45-60 jours | Anomalie forte — case Vendor Central + escalation |

**Les 2 critères se combinent** : le critère "fenêtre théorique + 3 semaines" déclenche l'investigation, la sub-classification D2-A/B/C donne le niveau de gravité.

**Signal de priorisation algorithmique critique** : croiser **âge PO × montant PO**. Les D2 sur grosses commandes (> 5 palettes ou équivalent CA significatif) sont à traiter en priorité absolue car un seul cas Carrier Central RDV-avant-ASN non détecté peut représenter plusieurs dizaines de k€ de marchandise en souffrance.

## 3. Procédure d'investigation

Check-list **10 étapes en 3 phases** :

### Phase 1 — Qualifier le PO + ASN/DESADV (étapes 1-4)

| # | Question | Source | Lecture |
|---|---|---|---|
| 1 | Le PO IA Confirmé a-t-il une date de livraison prévue ? | POItemExport `Date prévue` ou `Fenêtre de livraison` | Si absent → PO mal configuré, demander correction |
| 2 | Les quantités ont-elles été acceptées intégralement ? | POItemExport `Quantité acceptée` vs `Quantité demandée` | Si acceptée < demandée → Amazon a réduit unilatéralement, vérifier raison |
| 3 | Le DESADV / ASN existe-t-il ? | Fournisseur — système EDI + Vendor Central ASN tracking | Si absent → maillon principal du blocage probable |
| 4 | L'ASN porte-t-elle le bon PO, BOL, FC, quantités ? | ASN détail vs PO | Si incohérence → ASN à corriger / retransmettre |

### Phase 2 — Qualifier le transport + la réception (étapes 5-7)

| # | Question | Source | Lecture |
|---|---|---|---|
| 5 | Un appointment Carrier Central existe-t-il ? | Carrier Central VC | Si absent → RDV à prendre |
| 6 | L'appointment matche-t-il l'ASN ? | Comparer dates / quantités / BOL | **Si RDV pris AVANT ASN → cas Carrier Central spécifique (cf. 5.3)** |
| 7 | Le PO est-il partiellement reçu ? | POItemExport `Quantité reçue` | Si partiel → analyser le delta, identifier ce qui manque |

### Phase 3 — Qualifier l'état aval (étapes 8-10)

| # | Question | Source | Lecture |
|---|---|---|---|
| 8 | Le stock est-il sellable on hand ? | Inventory Health Report VC | Si reçu mais non sellable → bascule effective vers D1 |
| 9 | L'offre Amazon Retail est-elle buyable ? | Page ASIN publique | Si non buyable → cf. fiche D1 sous-causes |
| 10 | La Buy Box est-elle présente ? | Page ASIN publique | Si non → cf. fiche Buy Box (à venir) |

**Logique sous-jacente** : la chaîne D2 a 5 maillons à valider dans l'ordre :

```
DESADV/ASN → rendez-vous Carrier Central → réception FC → stock sellable → offre buyable
```

Identifier **où la chaîne casse** détermine l'action prioritaire (cf. §6).

## 4. Critères de confirmation / écartement

### Critères de confirmation (D2 anormalement long)
- PO récent IA Confirmé non clôturé
- Date d'aujourd'hui > fin de fenêtre théorique de livraison + 3 semaines
- Pas de vente en période A
- Au moins un maillon de la chaîne logistique cassé (étapes 1-10 ci-dessus)

### Critère de confirmation spécifique au cas piégeux Carrier Central
> Si le fournisseur dit "j'ai livré, j'ai mon RDV Carrier Central, j'ai mes preuves de livraison" ET Amazon dit "PO toujours Confirmé, rien reçu" → **fortement suspect du cas RDV-avant-ASN (cf. 5.3)**.

### Critères d'écartement (faux positif D2)
- PO récent < 15 jours → D2-A, attente normale, pas d'action
- PO partiellement reçu et expédition complémentaire en cours → cas suivi normal
- Saisonnalité reconnue (N-1 ne vendait pas non plus à cette période)
- Stock effectivement sellable on hand → bascule vers D1 (problème retail aval, pas logistique)
- PO clôturé entre-temps → c'est D1, pas D2

## 5. Les sous-causes profondes de D2

### Grille de probabilité D2 (contexte Cogex / Gers)

| Rang | Sous-cause | Probabilité | Description |
|---|---|---|---|
| 1 | ASN manquante / non émise | **Très élevée** si pas d'EDI fournisseur fluide | Le fournisseur n'a pas envoyé son DESADV |
| 2 | ASN émise mais incohérente | **Élevée** | ASN existe mais quantités, BOL ou FC ne matchent pas |
| **3** | **RDV Carrier Central pris AVANT ASN** | **Élevée pour grosses commandes auto-affrétées** | RDV existe sans ASN à recouper → réception orpheline → PO jamais clôturé |
| 4 | Retard transport / appointment no-show | Moyenne | Pure cause logistique transporteur |
| 5 | Stock reçu mais non sellable | Moyenne | Bascule effective vers D1 (problème retail) |
| 6 | PO trop récent pour avoir relancé les ventes | Cas D2-A, normal | État transitoire, pas d'action |

### Sous-cause 5.1 — ASN manquante / non émise (rang 1)

**Définition** : le PO est accepté EDI (`IA`), mais le fournisseur n'a pas envoyé le DESADV / ASN qui prévient Amazon de l'expédition.

**Symptômes** :
- Pas de trace ASN dans Vendor Central côté Amazon
- Pas de trace ASN dans le système EDI fournisseur
- PO reste Confirmé sans activité downstream

**Cause typique** : EDI fournisseur immature, ou opérateur fournisseur qui n'a pas déclenché manuellement le DESADV.

### Sous-cause 5.2 — ASN émise mais incohérente (rang 2)

**Définition** : le DESADV existe mais ne matche pas correctement le PO. Amazon ne peut pas réceptionner proprement.

**Cas typiques** :
- ASN avec quantités différentes du PO accepté
- ASN avec BOL différent du transport effectif
- ASN avec FC de destination différent de celui prévu au PO
- ASN avec dates incohérentes

**Conséquence** : Amazon rejette ou met en attente la réception. Stock potentiellement reçu mais non rapproché au PO.

### Sous-cause 5.3 — Cas spécifique RDV Carrier Central pris AVANT ASN (rang 3, attention CA)

**Définition** : configuration métier piégeuse, marginale en nombre de commandes mais potentiellement majeure en CA.

**Configuration** :
- Grosse commande (typiquement > 5 palettes ou équivalent)
- Le fournisseur affrète le transport lui-même
- Il a accès à Carrier Central et y prend son rendez-vous de livraison
- **Il prend le RDV AVANT d'envoyer le message DESADV/ASN**

**Conséquence** :
- Le RDV existe dans Carrier Central, mais sans ASN associée à recouper
- La marchandise arrive physiquement, mais le système Amazon ne peut pas l'apparier au PO
- Amazon réceptionne du stock "orphelin" qui ne rejoint pas le PO d'origine
- **Résultat** : PO toujours marqué Confirmé (jamais reçu), marchandise en souffrance dans le FC

**Caractéristique dangereuse** : ce cas est **silencieux**. Il n'apparaît dans aucun dashboard Vendor Central jusqu'à ce qu'on creuse manuellement. Le fournisseur croit avoir livré (et a juridiquement raison). Amazon ne reconnaît rien dans son système.

**ROI investigation** : très élevé sur les grosses commandes même si le taux de prévalence est faible sur l'ensemble du parc. Un seul cas non détecté = plusieurs dizaines de k€ en souffrance.

### Sous-cause 5.4 — Retard transport / appointment no-show (rang 4)

**Définition** : pure cause logistique. ASN émise correctement, RDV pris, mais la livraison n'a pas eu lieu (retard, problème transporteur, no-show, refus de réception côté FC).

**Vérification** : statut appointment dans Carrier Central, communication transporteur.

### Sous-cause 5.5 — Stock reçu mais non sellable (rang 5)

**Définition** : la marchandise a été reçue physiquement, mais elle n'est pas dans un état "sellable on hand". Quarantaine, réservé, transferé inter-FC, endommagé.

**Conséquence** : on bascule effectivement dans une logique D1 (problème retail aval). Le cas D2 est résolu sur sa partie logistique, mais l'ASIN reste sans ventes pour une autre raison. **Le case Amazon évolue vers une formulation D1.**

### Sous-cause 5.6 — PO trop récent (D2-A, état normal)

**Définition** : le PO a < 15 jours, le cycle logistique est en cours. Pas d'anomalie.

**Action** : surveiller, pas d'investigation prématurée.

## 6. Action si confirmée

### Action principale : selon où le maillon casse

| Maillon cassé (Phase + Étape) | Action prioritaire |
|---|---|
| Phase 1 / Étape 3 — ASN manquante | **Fournisseur** : générer et émettre le DESADV |
| Phase 1 / Étape 4 — ASN incohérente | **Fournisseur** : retransmettre ASN corrigée (bon PO, BOL, FC, quantités) |
| Phase 2 / Étape 6 — **RDV avant ASN (cas 5.3)** | **Action mixte** : (1) fournisseur retransmet ASN avec bonnes références, (2) case Amazon pour matcher manuellement la réception orpheline au PO |
| Phase 2 / Étape 5 — RDV non pris | **Fournisseur** : prendre RDV Carrier Central |
| Phase 2 / Étape 7 — Réception partielle | **Amazon** : case réception / reconciliation pour identifier le delta |
| Phase 3 / Étape 8 — Stock non sellable | **Amazon** : bascule vers traitement D1 (Inventory Health team) |
| Phase 3 / Étape 9-10 — Offre / Buy Box | **Amazon** : bascule vers traitement D1 ou hypothèse Buy Box |

### Template case Amazon — cas standard (ASN incohérente / réception partielle)

```
Hello,

We need Amazon's help to investigate a PO that remains in Confirmed status
beyond the expected delivery window:

- PO ID: [PO_ID]
- ASIN: [ASIN]
- Code: IA – accepted via EDI
- Status: Confirmed (still open)
- Expected delivery: [date], today is [+X weeks past window]
- Supplier confirms shipment / ASN: [Yes/No]
- Appointment in Carrier Central: [Yes/No, date]
- Quantity received per VC: [X / Y]

Could you please:
1. Confirm whether the PO has been physically received at the FC;
2. Identify any reception reconciliation issues;
3. Check if ASN matching has failed against the appointment;
4. Provide the current status of the linked appointment.

The supplier reports that shipment has been [shipped/in transit/delivered],
but the PO is not progressing on Amazon side. We need to identify where
the inbound flow is blocked.
```

### Template case Amazon — cas RDV-avant-ASN (5.3, grosses commandes)

```
Hello,

We need Amazon's help on an inbound reconciliation issue affecting a large
PO that remains in Confirmed status beyond expected delivery window:

- PO ID: [PO_ID]
- ASIN: [ASIN]
- Order volume: [N pallets / X units]
- Self-arranged transport by supplier with appointment in Carrier Central
- Appointment date: [date] — confirmed and honored by supplier
- ASN/DESADV: emitted AFTER the appointment was created
- Supplier confirms physical delivery against appointment
- Amazon system shows PO still Confirmed, no received quantities

We suspect this is an inbound reconciliation issue where the appointment
exists without a matching ASN at the time of receiving, leading to an
"orphan" reception that did not link to the original PO.

Please:
1. Confirm whether the merchandise has been physically received at the FC;
2. Match the orphan reception (if any) back to the original PO;
3. Update the PO status to Received with the correct quantities;
4. Confirm the ASIN can be reactivated for retail sales once reconciliation
   is complete.

Supporting documents: BOL [X], appointment ID [Y], proof of delivery
[from supplier].
```

### Actions à éviter

- **Ne pas se dire "PO Confirmé donc tout va bien"** — c'est précisément le piège central D2
- **Ne pas conclure trop vite que c'est un problème fournisseur** sans vérifier l'ASN et l'appointment côté Amazon
- **Ne pas oublier le cas Carrier Central 5.3** sur grosses commandes, même si statistiquement rare
- **Ne pas attendre indéfiniment** un PO Confirmé > 45j sans investigation (passage automatique en D2-C)

## 7. Délai typique de résolution

Variable selon sous-cas :

| Sous-cas | Délai typique |
|---|---|
| **D2-A** (< 15j) | Pas d'action, attente normale — résolution naturelle 1-3 semaines |
| **D2-B avec ASN à retransmettre** | 1-2 semaines (action fournisseur rapide) |
| **D2-B avec appointment à reprendre** | 2-3 semaines (cycle administratif + transport) |
| **D2-C anomalie forte (case Amazon escalé)** | 1-2 mois |
| **Cas 5.3 RDV-avant-ASN sur grosse commande** | 3-6 semaines (reconciliation manuelle Amazon) |
| **Bascule en D1 (stock reçu non sellable)** | Voir fiche D1 (~1 mois supplémentaire) |

## 8. Automatisable dans Amazon Pilot ?

### Détection automatique — déjà implémentée v3.6.8

| Critère | Statut |
|---|---|
| Code dispo IA + Statut Confirmé du dernier PO | ✅ Algorithme Enquête v3.6.8 (classification D2) |
| Date PO + fenêtre théorique | ✅ Données POItemExport ingérées |

### Vérification automatique — pistes nouvelles

| Vérification | Faisabilité | Priorité |
|---|---|---|
| Calcul automatique "fenêtre théorique + 3 semaines dépassée" | Possible (POItemExport `Fenêtre de livraison` ou `Date prévue`) | Élevée |
| Sub-classification automatique D2-A/B/C par âge PO | Possible (calcul `today - orderDate`) | Élevée |
| Priorisation par montant PO (€) | Possible (POItemExport `Coût total accepté`) — utile pour faire remonter les gros D2 | **Très élevée** (cas 5.3) |
| Croisement avec données Delivery (présence ASN, défauts BOL, appointments) | Possible si rapport Delivery ingéré nativement | Élevée (v3.6.10) |
| **Détection automatique cas 5.3 RDV-avant-ASN** | Possible en croisant date appointment vs date ASN dans données Delivery | Moyenne (signal complexe) |
| Vérification statut sellable on hand | Non automatique (Inventory Health VC manuel) | Faible |

### Résolution automatique — non automatisable

L'ouverture du case Amazon reste manuelle. Amazon Pilot peut **assister** :
- CTA "Ouvrir un cas D2 dans Vendor Central" avec template pré-rempli selon le maillon cassé identifié
- Tracking de l'âge du case ouvert (compteur de jours)
- Affichage de la chaîne logistique 5 maillons visuellement (où on est, où ça casse)

## 9. Pistes roadmap Amazon Pilot

Manques structurels détectés via la production de cette fiche :

| Manque | Piste | Version cible |
|---|---|---|
| Priorisation algorithmique des D2 par montant PO | Tri descendant par `costAccepted` dans la fiche détail Enquête sous-cat D2 | v3.6.9 (cosmétique) ou v3.6.10 |
| Affichage automatique "X semaines au-delà de la fenêtre théorique" | Calcul + badge coloré (vert < fenêtre / orange 0-3 sem / rouge > 3 sem) | v3.6.10 |
| Sub-classification D2-A/B/C affichée | Badge dans la fiche détail Enquête | v3.6.10 |
| Ingestion native rapport Delivery (défauts BOL, ASN, appointments) | Parser dédié + enrichissement c.delivery | v3.6.10 (déjà au backlog) |
| Détection automatique cas 5.3 RDV-avant-ASN | Croisement date appointment vs date ASN dans Delivery report | v3.7 |
| 2 templates case Amazon pré-remplis (standard + cas 5.3) | CTA "Ouvrir un cas D2" avec switch selon sous-cause détectée | v3.6.10 ou v3.7 |
| Visualisation chaîne logistique 5 maillons | Affichage visuel "DESADV → RDV → Réception → Sellable → Buyable" avec maillon cassé highlighté | v3.7 |

## 10. Sources de données

| Source | Champ utile | Statut Amazon Pilot |
|---|---|---|
| `POItemExport.csv` | Code dispo (`IA`), Statut PO (`Confirmé`), date PO, fenêtre livraison, quantités demandée/acceptée/reçue, coût total accepté | Ingéré v3.6.8 |
| `Delivery_*.csv` | Présence ASN, défauts BOL Mismatch, défauts ASN inaccuracy, appointments | Partiellement disponible, ingestion native v3.6.10 |
| Vendor Central — ASN tracking | Statut ASN par PO | Non ingéré, vérification manuelle |
| Vendor Central — Carrier Central | Appointments, statuts RDV | Non ingéré, vérification manuelle |
| Vendor Central — Inventory Health Report | Sellable on hand, unsellable, reception status | Non ingéré, vérification manuelle |
| Système EDI fournisseur | Statut DESADV émis / non émis | Externe, demande fournisseur |

## 11. Références externes

Sources externes citées (indicatives, pas autoritaires) :

- **Doc GPT-5 D2** — analyse Vendor Central et chaîne logistique IA Confirmé
- **Cas terrain Fred Rochette (KAM)** — cas spécifique Carrier Central RDV-avant-ASN sur grosses commandes (savoir-faire non documenté ailleurs)
- Convergence avec sources A2/D1 sur les sous-causes 5.5 (stock non sellable) et bascules vers D1

## 12. Cas réel — à capitaliser

Pas de cas concret D2 documenté à ce jour. **Recommandation** : sur les premiers cas Cogex/Gers traités via la procédure D2, capitaliser :

- Quel maillon de la chaîne logistique casse le plus souvent (étapes 1-10) ?
- Quel est le délai moyen de résolution réel par sous-cas (D2-B simple vs D2-C escalé) ?
- **Combien de cas 5.3 RDV-avant-ASN détectés sur 12 mois ? Sur quel CA cumulé en souffrance ?** (important pour mesurer le ROI d'une automatisation v3.7 dédiée à ce cas)
- Le template case D2 "inbound reconciliation" est-il efficace ?

Ces apprentissages alimenteront une **V2 de cette fiche** dans 3-6 mois.

---

# HYPOTHÈSE R — Désaccord commercial (`CQ` ou `R2`)

## 1. Définition

ASIN qui répond aux 4 conditions simultanées :
- **Présent dans le catalogue actif** (vendu en période de référence N-1)
- **Aucune vente en période courante N** (CA_A = 0)
- **PO récent** dans la fenêtre d'observation (par défaut 4 mois)
- **Code dispo du dernier PO = `CQ` (franco non atteint) OU `R2` (prix de cession refusé)**

**Précision fondamentale** : ces codes sont apposés **par le fournisseur** en réponse au PO Amazon (cf. encadré général en début de document). Ce n'est pas Amazon qui refuse, c'est le fournisseur qui refuse de livrer dans les conditions proposées par Amazon.

**Cadre métier central** :

> R représente un **désaccord commercial visible et tracé**. À la différence de A2, D1 et D2 (qui sont des "mystères" à investiguer), la cause R est connue d'avance : le fournisseur explique pourquoi il refuse via le code apposé.

**Différence radicale vs A2/D1/D2** :

| | A2 / D1 / D2 | R |
|---|---|---|
| Source du blocage | Inconnue, à investiguer | **Connue, tracée sur le PO** |
| Émetteur de la "décision" | Amazon (souvent) | **Fournisseur** |
| Type d'action | Investigation puis case Amazon | **Action commerciale (négociation, ajustement)** |
| SOP d'investigation | Nécessaire | **Non nécessaire pour le cas opérationnel courant** |

**Conséquence structurelle** : la fiche R est organisée en **2 niveaux** :
- **Niveau opérationnel courant** : très court — le fournisseur gère, pas besoin de SOP
- **Niveau structurel à creuser** : 3 sous-cas distincts qui méritent investigation

## 2. Cas opérationnel courant — fournisseur gère

### Lecture du code apposé

| Code | Lecture | Action fournisseur |
|---|---|---|
| `CQ` | Le fournisseur refuse car la commande Amazon n'atteint pas son franco minimal sur sa grille tarifaire | Attendre regroupement par Amazon au prochain cycle, ou abaisser franco si justifié |
| `R2` | Le fournisseur refuse car le prix de cession proposé par Amazon est inacceptable (vs grille tarifaire ou marge minimale) | Renvoyer le bon prix au prochain PO, ou contester ponctuellement |

### Pas d'action Amazon Pilot nécessaire dans ce cas

Le fournisseur **sait pourquoi il refuse**, la source est visible sur le bon de commande. Au prochain cycle d'approvisionnement Amazon, soit la commande est regroupée et passe (CQ résolu), soit le prix de cession est corrigé (R2 résolu).

**Pas d'investigation, pas de case Amazon, pas de SOP**. L'ASIN repart dès le prochain PO normal.

**Quand R reste un cas opérationnel courant** :
- 1 ou 2 PO consécutifs en `CQ` ou `R2`
- Pas de récurrence sur les autres ASINs de la même famille / marque
- Pas de période de négociation annuelle en cours

## 3. Quand R devient suspect / structurel

### 3 sous-cas qui méritent investigation

| Sous-cas | Déclencheur | Niveau |
|---|---|---|
| **R-α** | 3 POs consécutifs en `CQ` sur le même ASIN | Dérive lente du cadrage commercial |
| **R-β** | `R2` lié à un pricing Amazon farfelu | Signal d'alerte sur comportement Amazon |
| **R-γ** | Vague de refus (`CQ`, `R2`) corrélée à la négociation commerciale annuelle | Blocage structurel AVN |

Les 3 sous-cas demandent des actions très différentes — pas un seul "cas R structurel" mais 3 réalités distinctes à traiter séparément.

## 4. Sous-cas R-α — Récurrence de `CQ` sur un ASIN (dérive lente)

### Définition
Un ASIN passe en `CQ` (franco non atteint) sur **3 POs consécutifs ou plus**. Le franco fournisseur est mal calibré par rapport à la rotation réelle Amazon sur cet ASIN : Amazon commande systématiquement en quantités trop faibles pour atteindre le franco du fournisseur.

### Quand suspecter
- 3 POs consécutifs en `CQ` sur le même ASIN
- Ou proportion > 50% des PO sur l'ASIN en `CQ` sur 6 mois
- L'ASIN tournait normalement avant la dérive (vitesse de rotation historique > 0)

### Cause profonde
**Le fournisseur prend tactiquement la décision de refuser** parce qu'il sait que la commande Amazon est trop petite pour être rentable à livrer (coût de préparation, expédition, manutention > marge sur la commande).

C'est une **dérive commerciale lente** : ASIN par ASIN, le compte s'érode parce que la rotation Amazon réelle ne justifie plus le franco fournisseur initialement calibré.

### Procédure d'investigation
1. Identifier les ASINs en R-α (croisement POs récents + code `CQ` + comptage récurrence)
2. Pour chaque ASIN, calculer la rotation Amazon réelle (unités/mois sur 6-12 mois)
3. Comparer à la quantité de commande Amazon typique : est-elle < franco fournisseur ?
4. Identifier le pattern : ASIN isolé ou famille entière ? Marque entière ?

### Action si confirmé
- **Soit** : renégocier le franco fournisseur **à la baisse** sur cet ASIN ou cette famille pour s'aligner sur la cadence Amazon réelle (ex. franco par référence vs franco global)
- **Soit** : accepter de fait que l'ASIN sorte du catalogue Amazon (décision commerciale, ASIN trop marginal en volume)

Choix entre les deux selon l'enjeu CA potentiel et la marge sur l'ASIN.

### Délai de résolution
**Quelques semaines** (renégociation franco entre Cogex et fournisseur — ou abandon de l'ASIN qui sort du catalogue Amazon par attrition).

## 5. Sous-cas R-β — `R2` lié à un pricing Amazon farfelu

### Définition
Le fournisseur appose `R2` (prix de cession refusé) parce qu'Amazon a proposé un prix de cession **aberrant** (sous le coût de revient, voire négatif, ou très en deçà du prix précédent).

### Cause profonde
Amazon utilise son pricing automatique retail. À un moment, l'algorithme Amazon propose au fournisseur un prix de cession qui n'a aucun sens commercial. Causes possibles :
- Un ASIN en `CRaP designated` côté Amazon (Can't Realize a Profit) — Amazon pousse les fournisseurs à baisser les prix pour rentabiliser, parfois jusqu'à l'absurde
- Une erreur ponctuelle d'algorithme Amazon (pricing externe mal lu, comparaison sur un pack size erroné, etc.)
- Une renégociation tactique Amazon en milieu de cycle (Amazon teste les fournisseurs avant l'AVN)

→ Le `R2` est alors le **signal** d'une dérive Amazon, pas un caprice fournisseur.

### Quand suspecter
- Un `R2` qui apparaît brutalement sur un ASIN qui tournait normalement
- ASIN en `CRaP` connu côté Vendor Central
- Vague de `R2` simultanée sur plusieurs ASINs (signe d'un changement d'algorithme Amazon)
- Période hors-AVN (sinon basculer en R-γ)

### Procédure d'investigation
1. Récupérer le prix de cession proposé par Amazon dans le PO (champ `Coût` ou équivalent)
2. **Comparer au prix de référence fournisseur** issu de la matrice tarifaire XML (cf. ressources §10)
3. Calculer l'écart : si prix Amazon < seuil critique (ex. < 70% du prix XML, à calibrer) → R-β confirmé
4. Vérifier le statut CRaP de l'ASIN dans Vendor Central
5. Vérifier si le cas est isolé ou systémique (autres ASINs touchés ?)

### Détection automatique dans Amazon Pilot (piste roadmap clé)

**Source de référence** : prix dans la matrice tarifaire XML (déjà autoritaire dans Amazon Pilot pour Gers — mémoire architecture).

**Exigence opérationnelle critique** : **prévoir des mises à jour régulières de la matrice XML** pour intégrer :
- Changements de tarif fournisseur (revues de prix annuelles ou ponctuelles)
- Nouveautés produits (nouveaux ASINs entrant au catalogue)

Sans ces mises à jour, l'algorithme R-β générera des **faux positifs** sur des tarifs périmés.

**Algorithme proposé** :
```
Pour chaque ASIN en R-β candidat :
  prix_amazon = PO.coût (prix de cession proposé par Amazon)
  prix_ref = matrice_XML[ASIN].prix_cession
  écart = (prix_amazon - prix_ref) / prix_ref
  
  Si écart < -30% (seuil à calibrer)
    → Alerter "R-β probable : Amazon propose X, référence fournisseur Y"
    → Niveau de gravité = abs(écart)
```

### Action si confirmé
- **Documenter la trace `R2`** comme leverage de négociation
- **Remonter le cas au Vendor Manager Amazon** avec argumentation chiffrée :
  - Coût de revient fournisseur
  - Marge minimale acceptable
  - Comparaison avec le prix précédent
- Demander à Amazon de **revoir le prix proposé** (escalation Vendor Manager si nécessaire)
- En cas de récurrence systémique, **escalader la dérive d'algorithme Amazon** au Vendor Manager

### Délai de résolution
**1-2 mois** (escalade Vendor Manager Amazon + cycle de réponse).

## 6. Sous-cas R-γ — Désaccord sur les conditions commerciales annuelles (AVN)

### Définition
Pendant ou après la négociation commerciale annuelle (Annual Vendor Negotiation, typiquement janvier/février, peut traîner jusqu'au printemps), un désaccord non résolu se traduit par une **vague de refus fournisseur** (`CQ`, `R2`, voire `CK`) sur tout ou partie du catalogue.

C'est le seul cas où R devient **structurellement bloquant** pour l'activité commerciale entière sur les ASINs concernés tant que la négociation n'aboutit pas.

### Quand suspecter
- Plusieurs ASINs (idéalement plusieurs marques / familles entières) passent en `CQ`, `R2`, ou `CK` simultanément
- Période proche du cycle AVN (janvier-juin)
- Communication Vendor Manager Amazon explicite ou implicite sur des sujets de désaccord
- Pas de pattern individuel (ASIN par ASIN) — c'est **systémique**

### Procédure d'investigation
1. **Mesurer le périmètre** : combien d'ASINs touchés ? Une marque / famille / tout le catalogue ?
2. **Identifier les sujets de désaccord en cours** : marge demandée par Amazon, co-op, terms paiement, prix de cession globaux, MFN obligations
3. **Identifier l'interlocuteur Vendor Manager Amazon** et son niveau d'autorité (junior / senior)
4. **Vérifier le statut AVN côté Cogex / fournisseur** : où en est-on dans le cycle ? Quelles concessions tactiques sont sur la table ?

### Action si confirmé

**Ce n'est pas un cas Vendor Central technique. C'est un dossier de direction commerciale.**

Combinaison d'actions :
- **(a) Négociation directe** entre direction commerciale Cogex et Vendor Manager Amazon
- **(b) Concessions tactiques** côté fournisseur pour débloquer (accepter une partie des demandes Amazon)
- **(c) Escalade hiérarchique côté Amazon** si le Vendor Manager n'a pas la main pour conclure

**Pas de case Vendor Central technique** — ça ne servirait à rien.

### Délai de résolution
**2-4 mois** (cycle complet de négociation commerciale).

## 7. Critères de confirmation / écartement

### Critères de confirmation R structurel
- 3 POs consécutifs en `CQ` sur même ASIN → R-α
- Écart prix Amazon vs prix XML < -30% (seuil à calibrer) → R-β
- Vague simultanée multi-ASINs en `CQ` / `R2` / `CK` corrélée période AVN → R-γ

### Critères d'écartement (cas opérationnel courant)
- 1-2 POs en `CQ` ou `R2` isolés → cas courant, le fournisseur gère
- Pas de récurrence sur les autres ASINs de la même famille
- Pas de période AVN en cours
- Écart prix proche du prix XML (< 30% en valeur absolue)

## 8. Action si confirmée — synthèse

| Sous-cas | Action prioritaire | Acteur |
|---|---|---|
| Cas courant | Aucune | Fournisseur (au prochain PO) |
| R-α | Renégocier franco OU accepter perte ASIN | Direction commerciale + fournisseur |
| R-β | Documenter trace + remonter Vendor Manager | KAM + direction commerciale |
| R-γ | Négociation AVN + concessions tactiques + escalade | **Direction commerciale Cogex** |

**Particularité R vs A2/D1/D2** : **pas de template case Amazon technique** dans les 3 sous-cas. C'est de la négociation commerciale, pas de l'investigation opérationnelle.

## 9. Délai typique de résolution

| Sous-cas | Délai typique |
|---|---|
| Cas opérationnel courant | Résolution au prochain PO (1-2 semaines) |
| **R-α** (récurrence franco) | **Quelques semaines** (renégociation franco) |
| **R-β** (pricing Amazon farfelu) | **1-2 mois** (escalade Vendor Manager) |
| **R-γ** (désaccord AVN) | **2-4 mois** (cycle de négociation annuelle) |

## 10. Automatisable dans Amazon Pilot ?

### Détection automatique — déjà implémentée v3.6.8

| Critère | Statut |
|---|---|
| Code dispo `CQ` ou `R2` du dernier PO | ✅ Algorithme Enquête v3.6.8 (classification R) |
| Date PO + ancienneté | ✅ Données POItemExport ingérées |

### Détection automatique — pistes nouvelles (priorité forte)

| Détection | Faisabilité | Priorité |
|---|---|---|
| **R-α : compter les `CQ` consécutifs sur un ASIN** | Possible (parcourir historique PO trié par date par ASIN) | **Élevée** |
| **R-β : comparer prix PO Amazon vs prix matrice XML** | Possible si matrice XML à jour (cf. exigence ci-dessous) | **Très élevée** |
| **R-γ : détecter vague simultanée multi-ASINs** | Possible (clustering temporel des bascules en `CQ`/`R2`/`CK`) | Moyenne |
| Affichage du delta prix Amazon vs prix XML dans fiche détail R | Possible | Élevée |
| Calibration automatique du seuil R-β (% écart) | Moyenne (nécessite calibration empirique sur premiers cas réels) | Moyenne |

### Exigence opérationnelle critique pour R-β

**La matrice tarifaire XML doit être maintenue à jour régulièrement** pour intégrer :
1. Changements de tarif fournisseur (revues annuelles, ajustements ponctuels)
2. Nouveautés produits (nouveaux ASINs entrant au catalogue)

Sans ces mises à jour, l'algorithme R-β générera des faux positifs sur des tarifs périmés. **Cette maintenance régulière fait partie intégrante de l'opérationnalisation de la détection R-β**. À cadrer comme processus client / KAM (fréquence de mise à jour, responsable, mécanisme d'import dans Amazon Pilot).

### Vérification automatique non possible

- Statut AVN en cours (négociation annuelle) : **information externe**, dans la tête du KAM ou de la direction commerciale
- Statut CRaP côté Amazon : vérification manuelle Vendor Central, non ingéré
- Sujets de désaccord AVN : externe à Amazon Pilot

### Résolution automatique — non automatisable

R est par nature un cas **commercial négocié**. Amazon Pilot peut **assister** en :
- Affichant clairement le sous-cas R-α / R-β / R-γ détecté
- Affichant le delta prix Amazon vs XML pour R-β
- Affichant la chronologie des `CQ` consécutifs pour R-α
- Identifiant les vagues multi-ASINs pour R-γ
- Tracking de l'âge du dossier (compteur jours depuis détection)

Mais l'action elle-même reste manuelle (négociation Cogex / Vendor Manager Amazon).

## 11. Pistes roadmap Amazon Pilot

| Manque | Piste | Version cible |
|---|---|---|
| Comptage automatique `CQ` consécutifs par ASIN (R-α) | Module dérivé `c.poHistoryByAsin` + détection séries | v3.6.10 |
| **Comparaison prix Amazon vs prix XML (R-β)** | Module dérivé enrichissement `c.asins[i].priceRef` depuis XML + alerte si écart > seuil | v3.6.10 ou v3.7 |
| **Mécanisme de mise à jour régulière de la matrice XML** | Procédure import + UI fiche client pour suivi date dernière maj XML | v3.6.10 |
| Détection vague R-γ (clustering temporel multi-ASINs) | Analyse statistique des bascules par fenêtre temporelle | v3.7 ou v3.8 |
| Affichage chronologie des PO par ASIN en R-α | Vue détail ASIN avec timeline des POs et codes apposés | v3.6.10 ou v3.7 |
| Pas de template case Amazon pour R (volontaire) | — | Sans objet |
| Suivi des dossiers commerciaux en cours (R-α, R-β, R-γ) | Module "Dossiers commerciaux ouverts" avec statut et compteur d'âge | v3.8 ou v3.9 |

## 12. Sources de données

| Source | Champ utile | Statut Amazon Pilot |
|---|---|---|
| `POItemExport.csv` | Code dispo (`CQ`, `R2`), date PO, ASIN, vendor code, **Coût (prix de cession proposé par Amazon)** | Ingéré v3.6.8 |
| **Matrice tarifaire XML** (cf. mémoire architecture Gers) | Prix de cession de référence fournisseur par ASIN | Source autoritaire catalogue, ingestion à enrichir pour R-β |
| Système commercial Cogex / fournisseur | Statut négociations AVN en cours, sujets de désaccord, dates concessions | Externe, dans la tête du KAM / direction commerciale |
| Vendor Central — statut CRaP | Statut `CRaP designated` par ASIN | Non ingéré, vérification manuelle |
| Vendor Central — communications Vendor Manager | Échanges email / Vendor Central | Externe, gardé en tête KAM |

## 13. Références externes

- **Précision Fred (KAM)** sur la perspective fournisseur des codes `CQ` / `R2` — savoir terrain critique non documenté ailleurs
- **Précision Fred sur le cas R-β** : pricing automatique Amazon parfois aberrant → fournisseur appose `R2` qui est en réalité un signal de dérive Amazon
- **Architecture XML matrice tarifaire Gers** (mémoire orchestrateur) : source autoritaire catalogue
- Pas de référence externe Amazon ou tiers pertinente sur ces sous-cas (savoir terrain pur)

## 14. Cas réel — à capitaliser

Pas de cas concret R structurel documenté à ce jour. **Recommandation** : sur les premiers cas Cogex/Gers traités via la procédure R, capitaliser :

- Combien d'ASINs en R-α détectés sur 12 mois ? Quelle proportion résolue par renégociation franco vs abandon ?
- Combien de cas R-β détectés ? Sur quel CA cumulé ? Quel délai moyen de réponse Vendor Manager Amazon ?
- Combien d'épisodes R-γ identifiés (vagues AVN) ? Quel impact CA temporaire ?
- Le seuil R-β (-30% écart prix XML) est-il bien calibré sur le terrain ? À ajuster ?

Ces apprentissages alimenteront une **V2 de cette fiche** dans 3-6 mois.

---

# ENQUÊTE — FIN DU CHANTIER (4/4 sous-catégories À CREUSER produites)

Les 4 sous-catégories de la catégorie "À CREUSER" du module Analyse comparée — Enquête sont désormais documentées :

| Hypothèse | Lecture centrale |
|---|---|
| A2 | Stock dormant — POURQUOI Amazon a arrêté de vendre |
| D1 | Mystère — découplage procurement / retail availability |
| D2 | PO en cours — marchandise qui ne rentre pas en stock |
| R | Désaccord commercial — désaccord visible, action commerciale (pas technique) |

**Convergences notables entre les 4 fiches** :
- Les sous-causes "Stock non sellable", "Retail offer inactive", "Inventory management suppression" reviennent dans A2 et D1
- D2 peut basculer en D1 si la marchandise arrive mais n'est pas sellable
- R est structurellement différent (côté commercial, pas technique)

**Méthodologie capturée transversalement** :
- Distinguer l'opérationnel courant (pas d'action) du structurel à creuser (SOP requise)
- Multi-sous-causes scorées par contexte client (Cogex / Gers)
- Templates de case Amazon différents selon angle (inventory reliability / downstream from procurement / inbound reconciliation)

---

# SECTION BUY BOX — RÉFÉRENCE OFFICIELLE EXTERNE

La méthodologie Buy Box d'Amazon Pilot s'appuie désormais sur la **référence officielle externe** :

- `livrable_audit_buybox_vendor1p_v2.md` (méthodologie complète : 12 codes BB-X, séquence d'audit en 11 étapes, templates case Amazon FR/EN, plan d'expérimentation)
- `modele_audit_buybox_vendor1p_v2.xlsx` (outil opérationnel : 12 onglets dont Diagnosis_Codes_v2, ASIN_Audit_v2, Action_Playbook_v2, Case_Templates)

**Documents validés empiriquement** sur 3 cas Cogex (mai-juin 2026) :
- B00PVPXVBE → BB-10 (stock non trusted)
- B009G3EQ70 → BB-11 (sous-exposition durable Featured Offer)
- B0CKXVJGXS → BB-3 + BB-12 (dormant + variation-level)

**Maquettes UX à produire** avant brief Claude Code v3.8 / v3.9 :
1. Landing page Buy Box refondue (niveau 3 — header existant + typologie BB-X + liste ASINs suspects + CTA "Lancer Agent BB")
2. Fiche ASIN Recovery Agent (inspirée preview__1_.html GPT, validée par Fred 03/06/2026)
3. Workflow conversationnel Agent BB Diagnostic (pattern Agent SEO existant)
4. Workflow Agent Communication Amazon v3.9 (génération case + diffusion après validation KAM)

**Inspiration externe non briefée à conserver comme référence** :
- `preview.html` et `preview__1_.html` (maquettes GPT-5 produites spontanément le 03/06/2026, non utilisées comme livrables officiels mais comme références d'inspiration)

---

# FIN DU DOCUMENT — état au 03/06/2026

**Section Enquête (Analyse comparée)** : 4 fiches produites et validées (A2 / D1 / D2 / R) — restent valides telles quelles.

**Section Buy Box** : approche fiche-par-hypothèse abandonnée, remplacée par référence officielle externe (livrable + Excel GPT-5 V2).

**Prochaines étapes** :
1. Test terrain sur B00PVPXVBE (case Amazon Retail Availability / Inventory Reliability)
2. Capitalisation des retours Amazon dans le modèle Excel V2
3. Production des 4 maquettes UX pour cadrage v3.7 / v3.8 / v3.9

---

[Agent Orchestrateur] — Source : 4 réponses Fred Q-A2.1 à Q-A2.4 + doc GPT-5 hypothèses Buy Box / stock dormant + CSV Stock_ASIN_Fabrication + brief v3.6.8 algorithme Enquête + 73 ASINs purchase hold Cogex backlog v3.6.10 — Confiance : haute sur la structure et le savoir-faire capté, moyenne sur les sources externes (forums et docs tiers — indicatif), à valider empiriquement sur les premiers cas Cogex.

**FIN FICHE A2 — Document à enrichir au fil des 15 hypothèses restantes**
