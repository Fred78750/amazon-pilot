# YOY_DELTA_MAQUETTE_VS_PROD.md

**Document de suivi du delta entre la maquette cible YoY V3 (`maquette_yoy_cogex_v3.html`) et la prod actuelle (v3.6.6.2)**

**Date production** : 26 mai 2026
**Auteur** : Claude Orchestrateur
**Statut** : v1 — document vivant, à mettre à jour à chaque livraison v3.6.x
**Cible commerciale** : été 2026 (3-4 mois de runway)

---

## 1. Objet de ce document

La maquette `maquette_yoy_cogex_v3.html` est la cible commerciale finale du module YoY pour la commercialisation été 2026. Elle a été produite en session précédente (déjà v3 = 3e itération). Entre la maquette cible et la prod actuelle (v3.6.6.2 = YoY Étape 1 livrée), il existe un écart fonctionnel et visuel.

Ce document liste **section par section** :
- Ce qui est présent dans la maquette
- Ce qui est livré en prod
- Ce qui reste à intégrer
- Le chantier futur qui le prend en charge

C'est le document de référence pour planifier les itérations v3.6.7 → v3.6.10 et tracer l'avancement.

---

## 2. Structure de la maquette V3 — vue d'ensemble

La maquette est structurée en 8 grandes sections (lecture top-down) :

1. **Header avec sélecteurs de période** (2 périodes côte à côte)
2. **KPI hero block** (3 grands KPIs avec deltas + CTA)
3. **Section Catalogue** (ASINs disparus, nouveaux, mortalité)
4. **Section Concentration** (Top 10, Pareto, fragilité)
5. **Section Marques** (chute / croissance / sortie)
6. **Section Anomalies** (cas atypiques détectés)
7. **Plan d'action 5 priorités** (vue Pro avec sections bloquées Free)
8. **Synthèse exécutive** (vue dirigeant non-spécialiste)

---

## 3. Delta détaillé section par section

### 3.1 Header + sélecteurs de période

| Maquette V3 | Prod v3.6.6.2 | Delta | Chantier |
|---|---|---|---|
| Sélecteur de 2 périodes côte à côte (référence vs analyse) | Sélecteur 2 périodes présent (livré en YoY Étape 1) | ✅ Pas de delta | — |
| Bouton "← Modifier les imports" | Bouton présent | ✅ Pas de delta | — |
| Bouton Vue Free / Vue Pro toggle | **ABSENT en prod** | Toggle freemium non implémenté | **v3.6.9** (segmentation commerciale finale) |
| Bouton "Lancer l'analyse comparée →" (état import) | Bouton présent | ✅ Pas de delta | — |

### 3.2 KPI hero block

| Maquette V3 | Prod v3.6.6.2 | Delta | Chantier |
|---|---|---|---|
| 3 grands KPIs (CA perdu / ASINs disparus / Concentration) | Tableau de bord d'indicateurs bruts livré | Partiel — pas le format "hero" 3 KPIs en gros | **v3.6.7** (refonte visuelle KPI hero block) |
| Delta % et delta absolu par KPI | Présent | ✅ Pas de delta | — |
| CTA `Examiner les ASINs en baisse dans Analyse ASINs →` (CTA 1) | **ABSENT** | CTA non implémenté | **v3.6.8** (YoY Étape 3a — Enquête) |
| CTA `Voir le Diagnostic CA détaillé →` (CTA 2) | **ABSENT** | CTA non implémenté | **v3.6.8** |

### 3.3 Section Catalogue (ASINs disparus, nouveaux, mortalité)

| Maquette V3 | Prod v3.6.6.2 | Delta | Chantier |
|---|---|---|---|
| Bloc "313 ASINs disparus en un an" avec narrative | Indicateur brut présent | Narrative absente | **v3.6.9** (rendu béotien) |
| Classification 3 catégories (À CREUSER / Mortalité / Autres) | **ABSENTE** | Algorithme de classification 9 codes → 3 catégories non implémenté | **v3.6.8** (YoY Étape 3a) |
| Détail ASIN par ASIN avec investigation | **ABSENT** | Fiche détail enquête non implémentée | **v3.6.8** |
| CTA `Filtrer les 313 disparus dans Analyse ASINs →` (CTA 3) | **ABSENT** | CTA non implémenté | **v3.6.8** |
| CTA `Ouvrir des cas Vendor Central depuis Buy Box →` (CTA 4) | **ABSENT** | CTA non implémenté | **v3.6.10** (BOL Mismatch + purchase hold) |

### 3.4 Section Concentration (Top 10, Pareto, fragilité)

| Maquette V3 | Prod v3.6.6.2 | Delta | Chantier |
|---|---|---|---|
| Top 10 ASINs par CA avec parts | Indicateur brut présent | Partiel — visuel à refaire | **v3.6.7** (refonte visuelle) |
| Indicateur de fragilité (concentration accrue 27,6% → 45,1%) | **ABSENT** | Calcul + alerte concentration non implémentés | **v3.6.7** (warnings) |
| CTA `Sécuriser les best-sellers via Buy Box →` (CTA 5) | **ABSENT** | CTA non implémenté | **v3.6.10** |

### 3.5 Section Marques (chute / croissance / sortie)

| Maquette V3 | Prod v3.6.6.2 | Delta | Chantier |
|---|---|---|---|
| Tableau marques avec delta + tag (chute / croissance / sortie) | **ABSENT** | Vue par marque non implémentée | **v3.6.8** (YoY Étape 3a) |
| CTA `Explorer les marques en chute dans Analyse ASINs →` (CTA 6) | **ABSENT** | CTA non implémenté | **v3.6.8** |

### 3.6 Section Anomalies (cas atypiques détectés)

| Maquette V3 | Prod v3.6.6.2 | Delta | Chantier |
|---|---|---|---|
| Détection automatique des cas atypiques (CA YoY > 1000% sur ASIN unique = fusion catalogue) | **ABSENTE** | Algorithme détection cas atypiques non implémenté | **v3.6.8** |
| CTA `Ouvrir un cas de fusion catalogue →` (CTA 7) | **ABSENT** | CTA non implémenté | **v3.6.8** |

### 3.7 Plan d'action 5 priorités (vue Pro)

| Maquette V3 | Prod v3.6.6.2 | Delta | Chantier |
|---|---|---|---|
| Bloc "Plan d'action 5 priorités" (vue Pro débloquée) | **ABSENT** | Vue Pro entière à construire | **v3.6.9** |
| Priorité 1 : Audit ASINs en baisse | **ABSENTE** | Logique de priorisation non implémentée | **v3.6.9** |
| CTA `Démarrer l'audit dans Analyse ASINs →` (CTA 8) | **ABSENT** | CTA non implémenté | **v3.6.8** |
| Priorité 2 : Surveillance Buy Box | **ABSENTE** | Bloc non implémenté | **v3.6.10** |
| CTA `Surveillance Buy Box des best-sellers →` (CTA 9) | **ABSENT** | CTA non implémenté | **v3.6.10** |
| Section "Analyse par famille — actions recommandées" (PRO) | **ABSENTE** | Vue tableau par famille non implémentée | **v3.6.9** |
| Bandeau "Accès complet à l'analyse causale" CTA Pro | **ABSENT** | Logique freemium non implémentée | **v3.6.9** |

### 3.8 Synthèse exécutive

| Maquette V3 | Prod v3.6.6.2 | Delta | Chantier |
|---|---|---|---|
| Bloc texte narratif synthèse pour dirigeant | **ABSENT** | Narrative IA Claude non implémentée | **v3.6.9** (avec plan B : narrative pré-rédigée si IA non prête pour été) |
| Export Word automatisé | **ABSENT** | Génération document Word non implémentée | **v3.6.9** |

---

## 4. Récap des CTA — positionnement par version

Synthèse du mapping CTA, à conserver comme référence opérationnelle. 9 CTA dans la maquette + 1 CTA additionnel (BOL Mismatch / Purchase Hold).

| # | CTA | Localisation maquette | Version cible |
|---|---|---|---|
| 1 | Examiner les ASINs en baisse dans Analyse ASINs → | KPI hero | v3.6.8 |
| 2 | Voir le Diagnostic CA détaillé → | KPI hero | v3.6.8 |
| 3 | Filtrer les 313 disparus dans Analyse ASINs → | Section Catalogue | v3.6.8 |
| 4 | Ouvrir des cas Vendor Central depuis Buy Box → | Section Catalogue | **v3.6.10** |
| 5 | Sécuriser les best-sellers via Buy Box → | Section Concentration | **v3.6.10** |
| 6 | Explorer les marques en chute dans Analyse ASINs → | Section Marques | v3.6.8 |
| 7 | Ouvrir un cas de fusion catalogue → | Section Anomalies | v3.6.8 |
| 8 | Démarrer l'audit dans Analyse ASINs → | Plan d'action P1 | v3.6.8 |
| 9 | Surveillance Buy Box des best-sellers → | Plan d'action P2 | **v3.6.10** |
| 10 | 📋 ASINs purchase hold (BOL mismatch) → | Buy Box + YoY | **v3.6.10** |
| 11 | Enquêter → (générique warning) | Sur chaque alerte warning | **v3.6.7** |
| 12 | Voir les ASINs en érosion → (éveil 80/20) | Dashboard + Revue Hebdo | **v3.6.7** |
| 13 | Télécharger le rapport Word → | Tableau de bord YoY | **v3.6.9** |
| 14 | Toggle Vue Free / Vue Pro | Header | **v3.6.9** |
| 15 | Bandeau Pro débloque | Multiples emplacements | **v3.6.9** |

---

## 5. Approche stratégique par chantier

### v3.6.7 — Warnings + éveil 80/20 (~1 sem)

**Objectif** : ajouter la couche d'alerte visuelle sur le YoY Étape 1 livré. Refonte visuelle du KPI hero block. Premier niveau de matérialisation du delta maquette.

**Approche** : ne pas modifier le calcul des indicateurs (déjà livrés), ajouter une couche d'overlay visuel et 2-3 règles de seuil.

**CTA livrés** : 11 (Enquêter générique), 12 (Voir ASINs en érosion).

**Risque** : faible. Pas de refonte data, juste UI.

### v3.6.8 — Enquête ASINs disparus + classification (~4 sem)

**Objectif** : grosse itération qui apporte l'essentiel des CTA et de la matière fonctionnelle. Cœur du module YoY.

**Approche** : implémentation algorithme classification 9 codes → 3 catégories. Détail ASIN par ASIN dans la catégorie À CREUSER. Section Marques + Section Anomalies + Section Catalogue enrichie.

**CTA livrés** : 1, 2, 3, 6, 7, 8.

**Risque** : moyen. Beaucoup de logique métier à coder (table VC_AVAILABILITY_CODES, algorithme branchements).

### v3.6.9 — Rendu béotien + export Word + Pro (~3 sem)

**Objectif** : derniers éléments pour la commercialisation. Synthèse exécutive narrative, segmentation freemium Free/Pro, export Word.

**Approche** : narrative IA Claude (plan B si trop ambitieux : sections fixes pré-rédigées). Toggle Vue Free/Vue Pro. Génération Word via docx-js ou ReportLab (à arbitrer).

**CTA livrés** : 13, 14, 15.

**Risque** : moyen-élevé. Narrative IA peut prendre plus que prévu. Plan B documenté en V0.6.

### ── Borne commercialisation été 2026 ──

À ce stade, le YoY est fonctionnellement complet pour la cible commerciale. Tous les CTA de la maquette V3 visibles "Free" et la plupart "Pro" sont livrés.

### v3.6.10 — Couche causale défauts livraison + BOL Mismatch (automne 2026)

**Objectif** : extension post-commercialisation pour les clients qui ont besoin du diagnostic causal défauts livraison.

**Approche** : intégration du croisement défauts livraison 24 mois × ASINs. Liste 73 ASINs Cogex purchase hold native dans l'outil (vs CSV statique en hors-process actuellement).

**CTA livrés** : 4, 5, 9, 10.

**Risque** : élevé. Nécessite 24 mois de données défauts livraison, table de mapping codes VC universelle, qualification empirique sur Gers (transporteurs différents de Cogex).

---

## 6. Risques et points d'attention

### 6.1 Risque "scope creep" entre v3.6.7 et v3.6.8

La frontière entre "warnings simples" (v3.6.7) et "enquête détaillée" (v3.6.8) peut être brouillée. Garde-fou : v3.6.7 = lecture seule + bouton, **pas de fiche détail**. La fiche détail = v3.6.8 strict.

### 6.2 Dépendance narrative IA (v3.6.9)

Si la narrative IA Claude prend plus que 3 semaines, plan B = sections fixes pré-rédigées + export Word sans paragraphes générés. Acceptable pour la commercialisation été, la narrative IA arrive en patch v3.6.9.x.

### 6.3 CSV BOL Mismatch hors-process (mai 2026)

La liste 73 ASINs purchase hold Cogex a été produite **en hors-process** par Claude Orchestrateur le 26 mai 2026 (`cogex_asins_bol_mismatch_purchase_hold.csv` dans outputs). Cette donnée :
- Sert Fred pour un besoin commercial immédiat
- N'est PAS intégrée à Amazon Pilot tant que v3.6.10 n'est pas livré
- Doit être recalculée à chaque période d'observation (pas figée)

Risque : tentation d'utiliser le CSV statique au-delà du cas d'usage commercial ponctuel. À ne pas faire — la matière doit être recalculée nativement en v3.6.10.

### 6.4 Tag "vue Pro" — segmentation commerciale finale

Le toggle Free/Pro de la maquette V3 implique une logique freemium back-end. Si Stripe/quotas ne sont pas en place côté API au moment de v3.6.9, le toggle peut être UI-only (fonctionnellement, tout est Pro) — décision commerciale à acter au moment de v3.6.9.

---

## 7. Critères de réception finale

À la livraison v3.6.9 (borne commercialisation été 2026), le YoY doit :

- [ ] Reproduire visuellement ≥90% de la maquette V3 (vue Free comme vue Pro)
- [ ] Tous les CTA 1 à 9 et 11 à 15 fonctionnels (CTA 4, 5, 9, 10 = v3.6.10 post-commercialisation)
- [ ] Export Word téléchargeable avec narrative complète
- [ ] Algorithme classification 3 catégories validé sur Cogex (287 ASINs disparus → ratios cohérents avec cas terrain documenté)
- [ ] Vue par marque + Vue par famille opérationnelles
- [ ] Toggle Vue Free / Vue Pro intégré (UI-only ou backend selon arbitrage commercial)

### Démonstration commerciale réussie

Le test ultime : Fred (ou un consultant) peut **présenter le module YoY à un prospect ETI VC** en 10 minutes, en racontant l'histoire suivante :
1. Constat factuel (Étape 1) — "Vous perdez X €/an"
2. Warnings (Étape 2) — "Voici les 2-3 alertes critiques"
3. Enquête (Étape 3a) — "On a classé vos ASINs disparus en 3 catégories"
4. Rendu (Étape 4) — "Voici votre rapport Word à présenter en CODIR"

Si cette démo en 10 minutes peut être faite sur Cogex avec données réelles, la commercialisation est prête.

---

## 8. Mise à jour de ce document

À mettre à jour à chaque livraison v3.6.x mergée en prod :
- Cocher les éléments livrés dans les tables section par section
- Mettre à jour le récap CTA (colonne "version cible" → "✅ livré v3.6.X")
- Documenter les écarts détectés vs maquette si nécessaire (parfois la livraison réelle s'écarte du visuel — à tracer)

---

**FIN DU DOCUMENT DELTA**

[Claude Orchestrateur — 26 mai 2026]
