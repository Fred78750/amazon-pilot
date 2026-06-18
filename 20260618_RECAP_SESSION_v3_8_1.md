# Récap & clôture de session — 18 juin 2026

**Date:** June 18, 2026
**Rôle tenu:** Orchestrateur produit Amazon Pilot (+ Data Analyst sur les distributions)
**Périmètre:** hotfix modèles IA (v3.7.12) → fix ERP (v3.7.13) → lancement chantier Agent BB (spec v2.2, maquette, moteur v3.8.0/v3.8.1)

---

## A. CE QUI A ÉTÉ FAIT

### A.1 Hotfix modèles IA — v3.7.12 (prod, validé)
- `claude-sonnet-4-20250514` retiré par Anthropic → analyses IA cassées en prod (Cogex).
- `AI_MODELS` étendu à **4 modèles non datés** : `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-opus-4-8`, `claude-haiku-4-5`. Convention : version-mineure, jamais de suffixe date, jamais `latest`.
- **Routage figé par feature** (gouvernance produit), sélecteur modèle retiré de l'UI client.
- **2 bypass hardcodés rapatriés** dans `AI_MODELS` : `runApprosIA`, `initAIDiagnostic`.
- **Lambda IA migrée** : c'était une **whitelist** (pas un proxy transparent) avec fallback sur un modèle retiré → un déploiement app-only aurait cassé autrement.
- `opus-4-7` retiré. Tarifs sourcés `/claude-api` (Opus baissé 15/75 → 5/25).
- Validé prod sur les 3 CTA (Diagnostic / Opportunités / Risques).

### A.2 Fix ERP — v3.7.13 (prod)
- Parser `erp_stock` (255 réf). **Cycle v3.7 clos.** prod = recette = preprod = **v3.7.13**.

### A.3 Chantier Agent BB — Étape 1 : données + spec
- **Divergence diagnostiquée** : `a.history` (7-8 sem) vs `a.foViews` (3-4 sem) = **deux chemins d'import séparés**. La correction manuelle d'un import journalier avait réparé `history` (le graphe) sans repasser par le parser Traffic qui alimente `foViews`.
- **Résolu** : ré-import des 3 semaines manquantes (03/05, 17/05, 24/05) + ajout 19/04 → **8 semaines consécutives** dans `a.foViews['.fr']`, deltas natifs confirmés.
- **Gers = synthétique** (deltas constants 5.2/12.1) → exclu de toute calibration.
- **Distribution mesurée** (rapport v2, 8 sem Cogex FR).
- **Spec v2.2 figée** (commit `972a269`, v2.1 superseded) : filtre actifs obligatoire, critique = 0 sur ≥ 3 sem (primaire) ou −50 % + renforçateur, **caveat compte pathologique §5bis**, cas « apparitions » §10, `erp_stock` §3.

### A.4 Chantier Agent BB — Maquette niveau 1 (validée)
- `maquette_buybox_dashboard_suspects_v2.html` (Claude Design) corrigée et **validée** : 8 sem, critique ≥ 3 sem, entonnoir univers actifs (1 913 → 354), onglet **Dormants grisé « à venir »**, lien niveau 2 corrigé, `trigger` + cas apparition, Δ = mensuel glissant cohérent.

### A.5 Chantier Agent BB — Moteur v3.8.0 (preprod, volumes validés)
- `computeSuspectTags(client)` : `SUSPECT_CONFIG` centralisée, fonction pure, insertion `mergeImportData` (~l.4370, après `markets.sort`, avant `generateWeeklyActions`), filtre actifs, double composante, sortie `a.suspectTag`, `bbCandidates: []`.
- `caExposed` = `client.annualData['2025'].ventes.asins[].revenue` (réconcilié Fab/Appro), fallback 2024 puis somme 8-sem.
- **Rapport de comptage** : 233 taggés (63 crit / 113 warn / 57 opp) sur 365 taggables. Volumes cohérents avec distribution v2, écarts expliqués.
- Vérifs soldées : B00PVPXVBE 61 322 € **légitime** (best-seller, pas d'artefact) ; `caExposed` 92 % sur 2025 ; `annualData` réconcilié confirmé.

### A.6 Chantier Agent BB — Renforçateur v3.8.1 (en cours)
- `aged_90` était reconnu par le parser mais **non mappé** → renforçateur inactif en v3.8.0 (vue partielle : 47 chutes ≤ −50 % bloquées en warn).
- Mapping ajouté (2 lignes, bloc stock ~l.2280).
- Distribution `aged_90` mesurée : **bimodale** (45 % à 0 %, 32 % à 100 %).
- **Critère acté** : renforçateur dormant = ratio `aged90SellableUnits / sellableUnits ≥ 50 %` (`SUSPECT_CONFIG.AGED90_RATIO_CRIT = 50`, paramétrable).
- **Recadrage de fond (méthodo GPT)** : le tag **détecte**, l'Agent BB **diagnostique**. Pas de renforçateur « rupture » (les sellable=0 + chute = **BB-1**, niveau 2). Le tag reste détecteur. `bbCandidates` reste `[]`.

---

## B. ÉTAT & POINT DE REPRISE

- **Prod / recette / preprod = v3.7.13.** Moteur v3.8.0 en preprod (non mergé prod — attendre l'UI). v3.8.1 (mapping + renforçateur) : GO donné pour activer.
- **Prochain pas concret** : **re-rapport de comptage v3.8.1** (nb warn→crit promus ≈ 10 attendus, + split critiques zéro≥3sem / chute+renforçateur). Ce rapport **clôt le moteur**.
- **Ensuite** : 2ᵉ brief de CODE = **UI dashboard suspects** (sur la maquette validée).
- **Mapping renforçateur → bbCandidates** désormais disponible (doc GPT) : aged90+FO chute→BB-3 ; +FO=0→BB-10 ; sellable=0+chute→BB-1 ; BOL→BB-4 ; 3P→BB-5. **À valider avec GPT au cadrage de l'Agent BB (niveau 2), pas à coder dans le moteur.**

---

## C. BACKLOG DORMANT

1. **[sécurité]** `runApprosIA` : clé API exposée côté client → migrer vers Lambda.
2. **[infra]** Vérificateur tarifs mensuel : qualifier la source d'abord ; alerte d'écart, **jamais** correction auto.
3. **[process]** Tolérance transitoire whitelist Lambda aux anciens strings → séquence de déploiement (Lambda avant app).
4. **[méthodo]** Mapping renforçateur → bbCandidates (BB-1/3/4/5/10) à valider GPT au cadrage Agent BB.
5. **[2ᵉ famille]** Suspect **dormant** (trafic historique annuel + stock + sans mouvement) : arbitrage tag vs Enquête A2 ; donnée dispo (annuel 2024/2025 + stocks).
6. **[archi]** **Canal d'import unique** — cause racine de la divergence `history`/`foViews`. À cadrer proprement (audit code → cible → validation).
7. **[produit]** Flag « ASIN mal classé Amazon » (POs mais non reconnu fabricant) = évolution de `sourcingOnly`, lié au conseil Brand Registry (backlog d'avril).
8. **[méthodo]** Reformulation « taux d'exposition = FO/Glance » dans le doc méthodo V3 GPT (déclaré caduc en spec v2.2 §0).
9. **[à surveiller]** Renforçateur `deliveryDefects` (BOL Mismatch) : actif mais 0 déclenchement dans la fenêtre courante — re-vérifier avec plus d'historique.
10. **[traçabilité]** Double SHA app du hotfix (1cbc53e vs 7775e8d) — clarifier lequel est staging / prod.
11. **[reconnaissance]** Re-mapper `aged_90` + ré-import stock S-1 déjà fait ; à confirmer en prod le moment venu.

---

## D. AUTOCRITIQUE (Orchestrateur)

**D.1 — Erreur principale : j'ai fait remonter le diagnostic dans le détecteur.** En fin de session, j'ai voulu que le tag suspect distingue « stock dormant » de « rupture » et créé un débat (2ᵉ renforçateur rupture vs Enquête). Or ces distinctions **sont** le diagnostic de l'Agent BB (BB-1/BB-3/BB-10 de la méthodo GPT). Fred a dû me recadrer (« on tourne en rond, revenons au basic »). *Leçon : le tag détecte, l'Agent BB diagnostique — ne jamais remonter la causalité dans le niveau 1. Quand je me surprends à vouloir « couvrir tous les cas » dans le détecteur, c'est le signal que je déborde sur le niveau 2.*

**D.2 — « Nouveau chantier Fab/Appro » annoncé à tort.** J'ai qualifié la reclassification Fab/Appro de problème neuf sans vérifier le contexte — c'était traité depuis fin avril (logique `sourcingOnly`). Fred m'a fait vérifier. *Leçon : chercher dans le contexte/projet avant d'affirmer qu'un sujet est nouveau. La règle « vérifier les faits avant d'imputer » vaut pour moi autant que pour Claude Code.*

**D.3 — Tendance au sur-cadrage.** Beaucoup de questions et de débats rouverts ; défendable au niveau d'autonomie 0, mais j'aurais pu trancher plus souvent en reco forte sur les points à faible enjeu, pour alléger la charge décisionnelle. Le « revenons au basic » de Fred pointe aussi ça.

**Ce qui a tenu (à reproduire) :**
- « Présence ≠ flux réussi » jusqu'au bout (refus de clôturer le hotfix sans les 3 CTA réels ; exigence du clic prod ; volumes confrontés à la mesure, pas « ça tourne »).
- Doute fondé sur les tarifs Opus **sans inventer** le chiffre — la source a tranché.
- Clone Lambda obligatoire malgré la présomption de transparence → a évité un hotfix qui ne fixait rien (la whitelist).
- STOP anticipé sur la sommation `a.history` (risque de mélange de granularités hebdo/annuel) — confirmé fondé.
- Caveat « compte pathologique » posé fermement plutôt que de livrer des seuils flatteurs.

---

[Agent Orchestrateur] — Source : intégralité de la session du 18 juin 2026 — Confiance : haute sur le récap et l'état ; items §C ouverts ; le double SHA (§C.10) reste à clarifier
