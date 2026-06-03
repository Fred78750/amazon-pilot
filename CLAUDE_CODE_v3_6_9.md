# CLAUDE_CODE_v3_6_9.md
**Chantier** : v3.6.9 — Analyse comparée Étape 4 — Rendu béotien + Vue Free/Pro + Export Word + Narrative IA
**Date production brief** : 29 mai 2026
**Producteur** : Claude Orchestrateur
**Cible commerciale** : été 2026 — **dernier chantier avant commercialisation**
**Durée estimée** : ~2 semaines (scope réduit grâce aux anticipations v3.6.8)
**Statut prod amont** : v3.6.8.9 en validation preprod (29 mai). v3.6.8.8 en prod (29 mai).

---

## 1. OBJECTIF

Finaliser le module Analyse comparée pour la cible commerciale ETI VC. Ajouter la couche "Rendu béotien" qui transforme l'outil de pilotage en livrable directorial. Concrètement : toggle Vue Free / Vue Pro (UI-only), narrative IA semi-personnalisée pour le bloc "Mon diagnostic", section "Analyse par famille — actions recommandées" en vue Pro, export Word automatisé du rapport complet. 3 CTA livrés (13 Export Word, 14 Toggle, 15 Bandeaux Pro).

**Pas de backend paiement.** Pas de quotas Stripe. Pas de P4/P5 spéculatives. Le scope est focalisé sur ce qui rend la démo commerciale crédible, pas sur l'infrastructure SaaS complète (qui arrive en v3.6.11 ou v3.8).

---

## 2. ENJEUX MÉTIER

v3.6.9 est la **dernière itération avant la commercialisation été 2026**. Trois éléments structurent le passage du "produit interne Fred" au "produit présentable à prospect ETI" :

**Le toggle Free/Pro** matérialise la segmentation commerciale. Sans toggle, la démo prospect ressemble à un outil de consultant, pas à un SaaS commercial. Avec le toggle UI-only, le prospect comprend en 5 secondes "voilà ce que je vois sans payer, voilà ce que je débloque en m'abonnant". L'absence de backend paiement n'est pas un problème en phase pré-commercialisation (démos sous NDA, premiers clients onboardés manuellement par Fred). Le backend arrive quand le volume de clients le justifie.

**La narrative IA semi-IA** transforme le rapport d'un tableau de bord opérationnel en livrable signé par un consultant. C'est ce qui justifie le tarif Pro pour le directeur d'ETI. Le bloc "Mon diagnostic" personnalisé par IA est l'élément qui rend chaque rapport unique, lisible "en Codir". Le coût IA est plafonné via cache (1 génération par client par périmètre, invalidé sur changement de données).

**L'export Word** ferme le scénario commercial. Le directeur d'ETI ne lit pas un outil web pendant 30 minutes en réunion — il lit un PDF/Word imprimé. Sans export, le scénario d'onboarding dissimulé (décrit dans Orchestrateur V0.8 section Personas) ne se finalise pas. C'est l'objet livrable du KAM Amazon vers son N+1.

**La section "Analyse par famille — actions recommandées"** complète la matière en vue Pro. C'est la dernière section non livrée de la maquette V3.

Sans v3.6.9 mergé prod avant fin juin, la commercialisation été 2026 reste théorique.

---

## 3. SCOPE INCLUS — 5 sous-sections

### 3.1 Toggle Vue Free / Vue Pro — UI-only

**Principe** : pas de backend paiement. Le toggle est un état UI persisté en IndexedDB qui détermine quelles sections sont visibles à l'écran. **Toutes les fonctionnalités sont techniquement accessibles** (un utilisateur curieux peut inspecter le DOM), mais l'UX simule la segmentation commerciale.

**Implémentation** :
- Toggle dans le header de l'écran Analyse comparée (à droite de "Modifier les imports" / "Imprimer")
- Libellé : `Vue Free [○━━━●] Vue Pro` (switch visuel à 2 états)
- État stocké dans `c.viewMode` (`'free'` ou `'pro'`, défaut `'free'`)
- Persistance IndexedDB store `clients`, par client (Fred peut tester sur Cogex en Pro et Gers en Free)
- Au changement de toggle : re-render immédiat de l'écran Analyse comparée

**Comportement par section** :

| Section | Vue Free | Vue Pro |
|---|---|---|
| KPI hero block | Visible | Visible |
| Section Catalogue (3 catégories) | Visible | Visible |
| Section Marques (Top 10) | Visible | Visible |
| Section Anomalies (doublons orthographiques) | Visible | Visible |
| Top mouvements ASIN | Visible (livré v3.6.8) | Visible |
| Section Enquête (À CREUSER) | **Visible** (descriptif) | Visible |
| Plan d'action P1 | **Top 3 ASINs visibles** + flou sur la suite + bandeau "Accès Pro" | Liste complète |
| Plan d'action P2 (best-sellers) | Masqué + bandeau "Accès Pro" | Visible |
| Plan d'action P3 (familles) | Masqué + bandeau "Accès Pro" | Visible |
| **Section "Analyse par famille — actions recommandées"** | Masquée + bandeau "Accès Pro" | Visible (tableau) |
| **Mon diagnostic** (3 sous-sections + narrative IA) | Masqué + bandeau "Accès Pro" | Visible |
| **Conclusion générale** | Masquée + bandeau "Accès Pro" | Visible |
| **Bouton "Télécharger le rapport Word"** | Masqué + bandeau "Accès Pro" | Visible |

**Bandeau "Accès Pro"** (CTA 15) :
- Format : encadré horizontal, fond gradient subtil, texte centré
- Libellé type : `🔒 Accès complet à l'analyse causale et au rapport Word — Passer en Pro →`
- Bouton "Passer en Pro" : pour l'instant, simple alert/modal "Contactez Fred — frochette@vitajardin.com" (pas de Stripe en v3.6.9)
- Cohérence visuelle : 1 seul style de bandeau Pro réutilisé partout, pas 5 variantes

**Performance** : le toggle doit re-render en < 500ms (test sur Cogex 1711 ASINs).

### 3.2 Narrative IA semi-IA — Bloc "Mon diagnostic" personnalisé

**Contexte** : v3.6.8 a livré "Mon diagnostic" avec narrative en dur (sections "Ce que les chiffres disent" + "Ce que je ne vois pas dans les chiffres" + "Cause la plus probable"). v3.6.9 enrichit avec une couche IA personnalisée.

**Périmètre IA** : uniquement le sous-bloc "**Cause la plus probable**" (paragraphe de synthèse signé par l'IA). Les 2 premiers sous-blocs restent en dur (textes structurés par les données chiffrées, pas par interprétation).

**Pourquoi seulement "Cause la plus probable"** : c'est le paragraphe qui demande une véritable analyse causale (multi-marques en chute + ratio retour + tendance Buy Box + concentration). Les 2 autres sous-blocs sont structurellement chiffres + énumération — pas besoin d'IA pour les rédiger.

**Implémentation** :

Appel IA via Lambda existante `POST /ai/complete` (architecture V0.7 — jamais appeler `api.anthropic.com` directement depuis le browser).

Modèle : **Sonnet 4** (~0.01€/analyse, suffisant pour ce type de synthèse). Pas Opus.

Prompt structuré (à raffiner par Claude Code, structure indicative) :

```
Tu es consultant senior Amazon Vendor Central. Analyse les données ci-dessous 
et produis UN seul paragraphe (~80-120 mots) qui répond à la question : 
"Quelle est la cause la plus probable du recul du compte ?"

=== DONNÉES ===
Client : ${clientName}
Période : ${periodLabel}
Δ CA annualisé : ${deltaCA}
ASINs disparus : ${disparusCount} (${disparusPct}%)
Top 3 marques en chute (€/j) : ${top3MarquesChute}
Top 3 catégories disparus : ${cat1Count} A1 / ${cat2Count} À CREUSER / ${cat3Count} Autres
Concentration Top 10 : ${concentrationRef}% → ${concentrationA}% (${concentrationDelta})
Ratio retours : ${retourRefPct}% → ${retourAPct}%
Prix moyen vente : ${priceRefEur} → ${priceAEur} (${priceDelta})

=== DEMANDE ===
Produis UN paragraphe (~80-120 mots) qui :
1. Nomme la cause causale la plus plausible (multi-marques en chute / 
   contraction catalogue / problème commercial / problème logistique / 
   problème pricing — UNE seule cause dominante)
2. Cite 2-3 chiffres précis pour étayer
3. Conclut avec UNE phrase actionnable ("La piste à creuser en priorité 
   est X")

Style : direct, factuel, ton consultant senior. Pas de "il semblerait que", 
pas de "potentiellement". Pas de markdown, pas de bullets. UN paragraphe 
continu.
```

**Cache** (Q5 = α IndexedDB) :
- Stockage : `c.aiCache.diagnosticV1` (versionner pour invalidation future)
- Structure : `{ hash: 'sha256-of-source-data', generatedAt: ISO, content: 'paragraphe' }`
- Hash calculé sur : (clientName, periodLabel, deltaCA, disparusCount, top3MarquesChute, autres KPIs structurants)
- Invalidation automatique : si hash actuel ≠ hash stocké → régénération
- Bouton "Régénérer le diagnostic" (vue Pro uniquement) : force régénération même si hash identique
- Affichage : "Diagnostic généré le ${date} — basé sur les données importées le ${importDate}"

**Coût plafonné** : un client qui consulte son Analyse comparée 5 fois par jour ne paie qu'**1 génération** par périmètre (cache hit pour les 4 suivantes). Si Fred a 100 clients consultant 5 fois/jour, coût IA ~1€/jour, pas 5€/jour.

**Plan B si la Lambda IA échoue** : afficher la narrative en dur de v3.6.8 sans crash. Toujours avoir un fallback texte statique, ne jamais laisser une zone vide ou un message d'erreur intrusif.

### 3.3 Section "Analyse par famille — actions recommandées" (vue Pro)

**Objectif** : tableau Pro listant les familles de produits/marques avec une action recommandée pour chacune. Distinct du Plan d'action P3 livré en v3.6.8 (qui liste seulement les 3 familles en plus forte chute).

**Données source** : agrégats par marque (post-normalisation et post-fusion `brandAliases`) sur la période de référence et la période A. Réutiliser les calculs existants du module Marques (v3.6.8).

**Affichage** :

Tableau Pro avec colonnes :
- **Famille** (= marque post-normalisation/fusion)
- **État** (badge coloré : En croissance / Stable / En recul / Hémorragie)
- **CA/j réf.** (€)
- **CA/j A** (€)
- **Variation €/j** (€)
- **Variation %**
- **Action recommandée** (texte court généré selon règles statiques — pas d'IA, voir ci-dessous)

**Règles de classification "État"** (statiques, codées en dur — pas d'IA) :

| Condition | État | Couleur |
|---|---|---|
| Variation > +20% | En croissance | Vert |
| Variation entre -20% et +20% | Stable | Gris |
| Variation entre -50% et -20% | En recul | Orange |
| Variation < -50% | Hémorragie | Rouge |

**Règles de génération "Action recommandée"** (statiques) :

| État | Action recommandée |
|---|---|
| En croissance | Sécuriser stock + surveiller Buy Box (best-seller émergent) |
| Stable | Maintenir la cadence d'approvisionnement |
| En recul | Audit disponibilité + relance PO + révision fiches produit |
| Hémorragie | Audit prioritaire — possible suppression ou problème pricing |

**Tri par défaut** : `Variation €/j` croissante (les pires en haut — c'est le sens de lecture du KAM).

**Limite affichage** : 20 familles maximum (filtre Top 20 par CA réf. décroissant pour éviter le bruit des marques marginales). Si > 20, ajouter un bouton "Voir toutes les familles" en bas.

**Placement écran** : juste après le Plan d'action P3 (Reconstituer les familles en recul), avant le bloc "Mon diagnostic". Cohérent avec le flow narratif (priorités → analyse détaillée par famille → diagnostic synthétique).

### 3.4 Export Word automatisé (CTA 13)

**Génération côté client** (Q4 = a) via librairie `docx` (JS, déjà compatible avec l'archi standalone Amazon Pilot).

**Périmètre du document** :

Le Word doit reproduire le rapport Analyse comparée tel qu'il s'affiche en **vue Pro** (toutes sections visibles), dans l'ordre exact d'apparition à l'écran :

1. Page de garde
   - Logo Amazon Pilot (placeholder texte si pas d'asset prêt)
   - Titre : `Analyse comparée — ${clientName}`
   - Sous-titre : période de référence vs période A
   - Date de génération
2. Section KPI hero block (4 KPIs en table)
3. Section Catalogue (3 catégories Mortalité / À CREUSER / Autres + tableau bucket)
4. Section "Le portefeuille devient plus fragile : la concentration s'accentue" (tableau Top 10/20/50/100)
5. Section Marques (Top 10 marques avec 6 colonnes)
6. Section Anomalies (paires de doublons orthographiques)
7. Section Top mouvements ASIN (Top 10 perdants + Top 10 gagnants)
8. Section Enquête (3 catégories + tableau À CREUSER avec sous-cat A2/D1/D2/R)
9. Plan d'action P1, P2, P3
10. **Section Analyse par famille — actions recommandées** (livrée 3.3)
11. **Mon diagnostic** (3 sous-blocs dont le paragraphe IA)
12. Conclusion générale

**Mise en forme** :
- Police par défaut : Calibri 11 (lisible Codir, compatible Word universel)
- Titres section : Calibri 16 gras + ligne horizontale en dessous
- Tables avec bordures fines + entêtes en gras + alternance ligne grisée
- Pied de page : `Amazon Pilot v3.6.9 — Page X / Y`
- Marges 2.5cm

**Nom de fichier généré** : `Analyse_comparee_${clientName}_${YYYY-MM-DD}.docx` (slug du nom client, pas d'espace)

**Comportement bouton** :
- Localisation : en haut de l'écran Analyse comparée (à côté du toggle Free/Pro), libellé `📄 Télécharger le rapport Word`
- Cliquer : génération immédiate (loader spinner 2-3s) puis téléchargement automatique via `<a download>`
- Vue Free : bouton masqué (remplacé par bandeau Pro)
- Vue Pro : bouton actif

**Pas dans le scope** :
- Pas d'envoi par email automatique
- Pas de templates Word avec variables (la génération est dynamique 100% à partir des données client)
- Pas de génération PDF (Word uniquement — la cible Codir ouvre Word, pas un viewer PDF)
- Pas d'export Excel des données sous-jacentes (les chiffres sont dans le Word)

### 3.5 CTA finalisés

3 CTA livrés en v3.6.9 :

| # | Libellé | Localisation | Comportement |
|---|---|---|---|
| 13 | `📄 Télécharger le rapport Word →` | Header Analyse comparée (Vue Pro uniquement) | Génère et télécharge le .docx (voir 3.4) |
| 14 | `Vue Free [○━━━●] Vue Pro` | Header Analyse comparée | Toggle qui change `c.viewMode`, re-render section |
| 15 | `🔒 Accès complet à l'analyse causale et au rapport Word — Passer en Pro →` | Sur chaque section masquée en vue Free | Ouvre modal/alert "Contactez Fred" (pas Stripe) |

**Tous les autres CTA (1, 2, 3, 6, 7, 8) sont livrés v3.6.8. CTA 11, 12 livrés v3.6.7. CTA 4, 5, 9, 10 = v3.6.10.**

---

## 4. LIMITES NÉGATIVES — ce qui N'EST PAS dans le scope

Anti scope creep. Ces éléments sont attendus ou tentants mais explicitement reportés.

- ❌ **Backend paiement Stripe** — c'est v3.6.11 ou v3.8 (back admin générique)
- ❌ **Quotas IA back-end (Lambda enforce le plan)** — c'est v3.6.11
- ❌ **Gestion utilisateurs / multi-tenant complet** — c'est v3.6.11 ou v3.8
- ❌ **Stockage Stripe customerId / subscriptionId** — c'est v3.6.11
- ❌ **Plan d'action Priorité 4 + Priorité 5** — pas dans la maquette V3, arriveront avec l'usage post-commercialisation
- ❌ **Refonte du Plan d'action P1/P2/P3 livré en anticipation v3.6.8** — ne pas redoubler. Garder tel quel, ajuster uniquement la logique Free/Pro (P1 limité à 3 ASINs en Free, P2 + P3 entièrement masqués)
- ❌ **Refonte de Mon diagnostic / Top mouvements / Conclusion livrés en anticipation v3.6.8** — garder les structures. Seul "Cause la plus probable" devient IA.
- ❌ **Narrative IA full génération à chaque chargement** — exclu, coût non plafonné
- ❌ **Génération PDF** — exclu, Word uniquement
- ❌ **Génération Excel** — exclu
- ❌ **Envoi par email du rapport** — exclu
- ❌ **CTA 4, 5, 9, 10 (Buy Box)** — c'est v3.6.10
- ❌ **Croisement défauts livraison × ASINs** — c'est v3.6.10
- ❌ **Modification du module Analyse comparée pour ajouter des sections** au-delà de "Analyse par famille — actions recommandées"
- ❌ **Modification du parser POItemExport v3.6.8** — stable, ne pas toucher
- ❌ **Modification du parser CSV VC v3.6.6.2** — stable, ne pas toucher
- ❌ **Modification du parser ERP v3.6.6 / v3.6.7.1** — stable, ne pas toucher
- ❌ **Refonte UX globale Buy Box** — pas dans la roadmap pré-commercialisation
- ❌ **Refacto archi modulaire** — c'est v3.7 post-commercialisation

---

## 5. CRITÈRES DE RÉCEPTION

### 5.1 Critères visuels (à valider par Fred sur Cogex et Gers)

- Toggle Free/Pro visible dans le header Analyse comparée, switch fonctionnel avec animation de transition
- En Vue Free sur Cogex : sections Pro masquées proprement (pas de blanc, pas de zone vide), bandeau "Accès Pro" cohérent visuellement (1 seul style)
- En Vue Pro sur Cogex : toutes les sections visibles, dont la nouvelle "Analyse par famille — actions recommandées" (tableau Top 20 familles avec États colorés)
- Bloc "Mon diagnostic" affiche la narrative IA pour le sous-bloc "Cause la plus probable" (différent du texte en dur de v3.6.8)
- Bouton "Télécharger le rapport Word" visible uniquement en Vue Pro, animation loader pendant la génération
- Word généré ouvert dans Word/LibreOffice : 12 sections présentes dans l'ordre, mise en forme cohérente, pas de glitch typographique

### 5.2 Critères comportementaux

- Toggle Free/Pro : changement d'état persisté en IndexedDB, restauré au prochain chargement
- Narrative IA : 1ère consultation = appel Sonnet (loader 2-3s), 2e consultation = cache hit (instantané)
- Bouton "Régénérer le diagnostic" (vue Pro) : force régénération IA même si cache valide
- Changement d'imports (ré-upload Ventes/POs/Stock) → invalidation du cache narrative au prochain affichage
- Plan B narrative IA : si Lambda `/ai/complete` retourne erreur (timeout, quota, autre) → fallback narrative en dur, pas de zone vide
- Export Word : génération <5s sur Cogex (1711 ASINs), <10s sur Gers (selon volume)
- Téléchargement déclenché immédiatement après génération, nom de fichier conforme template `Analyse_comparee_${clientName}_${YYYY-MM-DD}.docx`

### 5.3 Critères non-régression

- Tous les écrans existants (Tableau de bord, Revue Hebdo, Analyse ASINs, Buy Box, Diagnostic CA, Appros, Prévisionnel, Agent SEO, Fiche client, Import données, Agent Import, Configuration) restent fonctionnels en Vue Free comme en Vue Pro
- Parser POItemExport v3.6.8 inchangé
- Parser CSV VC v3.6.6.2 inchangé
- Parser ERP v3.6.6 / v3.6.7.1 inchangé
- Module Enquête v3.6.8 inchangé (algorithme classification, sections Marques + Anomalies)
- Plan d'action P1/P2/P3 livré v3.6.8 : structure conservée, seule la logique Free/Pro est ajoutée
- IndexedDB compatible : nouveau champ `c.viewMode` + `c.aiCache` ajoutés avec valeurs par défaut (pas de crash sur clients existants)
- Export backup JSON Amazon Pilot fonctionne toujours

### 5.4 Validation Fred obligatoire avant merge prod

- Démo bout en bout sur Cogex en Vue Free puis en Vue Pro (toutes sections affichées correctement)
- Démo bout en bout sur Gers FR en Vue Pro
- Génération Word sur Cogex + lecture du document dans Word : structure, mise en forme, contenu cohérents
- Test narrative IA sur Cogex et Gers : les paragraphes "Cause la plus probable" sont différents (vraie personnalisation, pas un template recopié)

---

## 6. AUDIT ANTI-RÉGRESSION 4 BLOCS (règle 28)

À effectuer systématiquement avant tout merge prod. Documenter dans `AUDIT_v3.6.9.md`.

**Bloc 1 — Smoke tests fonctionnels existants** : passer la suite de smoke tests existante. Cible : 100% pass. Ajouter nouveaux tests :
- Test toggle Free/Pro : changement d'état + persistance IndexedDB
- Test cache narrative IA : 1er appel = call Lambda, 2e appel = cache hit
- Test génération Word : fichier produit non vide, structure 12 sections

**Bloc 2 — Comparaison rendu visuel avant/après** : capture preprod v3.6.8.9 vs build candidat v3.6.9 sur les écrans clés (Tableau de bord, Revue Hebdo, Analyse comparée Free, Analyse comparée Pro, Analyse ASINs, Buy Box, Diagnostic CA, Appros, Agent SEO, Fiche client). Tout écart hors scope = régression.

**Bloc 3 — Smoke tests parsers** : reparser les 6 fichiers de référence (CSV VC + ERP + POItemExport ×3) avec v3.6.9. Cible : counts identiques à v3.6.8.9.

**Bloc 4 — Validation IndexedDB backward compat** : charger un export client v3.6.8.9 (JSON backup) dans v3.6.9 candidat. Cible : pas d'erreur, données rechargées, nouveaux champs `c.viewMode` et `c.aiCache` initialisés à valeurs par défaut (`'free'` et `{}`).

---

## 7. RESSOURCES

### 7.1 Documents de référence (project_knowledge)
- `Claude_Orchestrateur_Context.md` V0.8 — contexte orchestrateur courant, règles 1 à 34
- `YOY_DELTA_MAQUETTE_VS_PROD.md` — delta maquette V3 vs prod, table CTA par version (section 3.7 = Plan d'action 5 priorités, section 3.8 = Synthèse exécutive)
- `maquette_yoy_cogex_v3.html` — cible visuelle (section "Mon diagnostic", section "Analyse par famille — actions recommandées" en vue Pro)
- `AUDIT_v3.6.8.md` — anticipations v3.6.9 livrées en v3.6.8, à ne pas redoubler

### 7.2 Données de test
- Cogex Outillage (FR mono-pays) — données complètes (Ventes, Stock, POs, ERP)
- Gers Équipement (FR multi-comptes BdC + ES) — données complètes

### 7.3 Environnements
- **Staging → recette** : S3 `amazon-pilot-recette`, CloudFront `EVQ30COFUNGA7`
- **Preprod** : `preprod.amazon.foliow.app`, S3 `amazon-pilot-preprod`, CloudFront `E3CODYJ437XKU5`
- **Prod** : `amazon.foliow.app`, S3 `amazon-pilot-foliow`, CloudFront `E3ERL241475BJI`

### 7.4 Lambda IA
- URL : `https://konuaxmdxjnzcuw2etjqwczrla0xycvt.lambda-url.eu-west-3.on.aws`
- Endpoint utilisé : `POST /ai/complete`
- Modèle : Sonnet 4 (~0.01€/analyse)
- Architecture règle V0.7 : **jamais** appeler `api.anthropic.com` directement depuis le browser

### 7.5 Librairie Word
- Lib JS : `docx` (npm/CDN) — génération côté client
- Documentation : https://docx.js.org/
- Bundle estimé : +200ko sur le HTML — acceptable

---

## 8. PROCÉDURE

1. **Lecture des ressources** — Claude Code lit les 4 documents 7.1 + audite le rendu actuel de l'écran Analyse comparée en preprod v3.6.8.9 pour identifier les zones à modifier
2. **Plan technique exhaustif** — Claude Code produit un plan détaillé AVANT toute écriture de code (règle n°1), incluant :
   - Architecture des nouveaux modules / fonctions (notamment `src/word_export.js` ou équivalent, et `src/ai_diagnostic.js`)
   - Structure de données (`c.viewMode`, `c.aiCache.diagnosticV1`)
   - Prompt IA Sonnet définitif (à valider par Fred avant production)
   - Stratégie cache (hash data source, invalidation)
   - Plan de l'export Word (structure du .docx, librairie docx-js)
   - UX du toggle Free/Pro (animation, position, accessibilité)
   - Section "Choix non spécifiés dans le brief" — arbitrages rencontrés
3. **GO Fred** sur le plan technique — Fred valide ou amende, retour Claude Code si besoin, GO final
4. **Implémentation par commits logiques** — découper en étapes :
   - Commit a : toggle Free/Pro UI-only + bandeau Pro générique
   - Commit b : section "Analyse par famille — actions recommandées" (tableau Pro)
   - Commit c : narrative IA semi-IA (Lambda call + cache + fallback)
   - Commit d : export Word
   - Commit e : harmonisation visuelle + finitions
5. **Mini mapping scope-livré vs scope-brief avant push staging** (règle 33 — anti-Zélé). Si débordement détecté, signaler avant push, pas après.
6. **Push staging** → tests recette
7. **Audit anti-régression 4 blocs** sur build candidat preprod (section 6)
8. **Validation Fred bout en bout** sur Cogex (Vue Free + Vue Pro) + Gers FR (Vue Pro)
9. **Merge main → prod** après validation explicite Fred (jamais sans)
10. **Mise à jour `YOY_DELTA_MAQUETTE_VS_PROD.md`** — cocher les lignes livrées (CTA 13, 14, 15)
11. **Commit `Claude_Orchestrateur_Context.md` V0.9** — déposé par Claude Code après production par Orchestrateur

Pas de raccourci sur l'ordre. Pas de commit direct sur main (règle 5).

---

## 9. POINTS D'ATTENTION

### 9.1 Frontière Pro / Free — cohérence à tenir
La frontière des sections masquées en Vue Free doit être **strictement** ce qui est listé dans la table de 3.1, ni plus ni moins. Pattern Zélé à anticiper : "tant qu'on y est, masquer aussi X". Non. Le scope est figé.

### 9.2 Narrative IA — robustesse fallback
La Lambda peut échouer (quota Anthropic, timeout, erreur réseau). Le fallback narrative en dur DOIT être implémenté dès le commit c, pas en patch ultérieur. Un test explicite "Lambda KO → fallback visible" doit être dans les smoke tests Bloc 1.

### 9.3 Génération Word — performance sur gros volumes
Cogex 1711 ASINs et Gers >2000 ASINs. La génération de tables Word avec des milliers de lignes peut être lente. **Mais** : le Word ne reproduit pas TOUS les ASINs, seulement les agrégats (4 KPIs, Top 10 marques, Top 20 perdants, Top 20 gagnants, ~50 ASINs À CREUSER max, etc.). Volume Word raisonnable. Si la génération dépasse 10s, paginer ou optimiser.

### 9.4 Cache IA — hash data source
Le hash doit capturer **tout ce qui change la conclusion du diagnostic**. Pas seulement les KPIs principaux. Exemples d'éléments à inclure dans le hash : delta CA annualisé, count disparus, top 3 marques en chute, concentration Top 10, ratio retours, prix moyen. Si un de ces éléments change, le cache invalide.

### 9.5 Prompt IA — validation Fred obligatoire avant production
Le prompt Sonnet pour "Cause la plus probable" est un livrable produit à part entière. Claude Code propose un prompt dans le plan technique, Fred valide AVANT que Claude Code l'utilise en code. Test sur Cogex : le paragraphe généré doit dire quelque chose comme "Le recul du compte vient principalement de la contraction du catalogue actif (X ASINs disparus) sur les marques Y/Z/T..." — pas du remplissage générique.

### 9.6 Bouton "Passer en Pro" — comportement minimaliste
Pas de Stripe, pas de formulaire d'inscription. Simple modal/alert "Pour passer en Pro, contactez Fred Rochette — frochette@vitajardin.com". Ne pas surinvestir cette zone qui sera refondue en v3.6.11 (back admin).

### 9.7 Section "Analyse par famille" — état "En croissance" plus rare que prévu
Sur Cogex actuel (recul global), peu de familles seront "En croissance". S'assurer que le rendu visuel reste lisible si seulement 1-2 familles sont vertes parmi 20 (test sur Cogex preprod). Pas de message "aucune famille en croissance" intrusif — laisser le tableau parler.

### 9.8 Compatibilité bundle JS
La librairie `docx` ajoute ~200ko au bundle. Vérifier que le total reste compatible avec l'archi (HTML actuellement ~1Mo). Si ça pose problème : lazy-load la lib uniquement au moment du clic sur "Télécharger le rapport Word".

### 9.9 Section "Choix non spécifiés dans le brief" attendue dans le plan
Pattern positif Claude Code à conserver : section "Choix non spécifiés" dans le plan technique listant les arbitrages rencontrés. Notamment :
- Format exact du toggle Free/Pro (slider vs 2 boutons radio vs autre)
- Position exacte du bouton "Télécharger" (droite du header, à côté toggle ?)
- Police exacte du Word (Calibri 11 par défaut, à confirmer)
- Couleurs des badges "État" du tableau familles (cohérence avec charte existante)

---

## 10. SIGNATURE LIVRABLE

[Agent Orchestrateur] — Source : YOY_DELTA_MAQUETTE_VS_PROD.md §3.7 + §3.8, maquette V3, AUDIT_v3.6.8.md anticipations, arbitrages Fred A1=UI-only / A2=semi-IA / A3=section famille / Q4=client docx / Q5=IndexedDB cache, Orchestrateur V0.8 — Confiance : haute sur le scope (figé après recadrage P4/P5), haute sur l'architecture, moyenne sur le prompt IA (à raffiner par Claude Code et valider par Fred avant production), à valider empiriquement sur la performance Word.

**FIN DU BRIEF**
