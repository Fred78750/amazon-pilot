# Passation de session — Amazon Pilot · clôture 18 juin 2026

**Date:** June 18, 2026
**Rôle tenu:** Orchestrateur produit (+ Data Analyst)
**Périmètre:** hotfix modèles IA → fix ERP → moteur tag suspect → **conception complète du module Buy Box (processus 3 agents)** → refonte UI Détecter.
**Document de reprise** — chapeaute les 20 livrables de la session (inventaire §7).

---

## 1. RÉALISATIONS

### Prod (déployé, validé)
- **v3.7.12** — Migration modèles IA : 4 modèles non datés (`sonnet-4-6`, `opus-4-6`, `opus-4-8`, `haiku-4-5`), routage figé par feature, Lambda whitelist migrée, 2 bypass rapatriés. Validé sur 3 CTA.
- **v3.7.13** — Fix parser `erp_stock`. **Cycle v3.7 clos.**

### Preprod (validé, NON mergé prod — décision : merge groupé avec l'Agent BB)
- **Moteur tag suspect v3.8.0/v3.8.1** — `computeSuspectTags`, double composante (zéro hebdo ≥3 sem + chute mensuelle glissante), renforçateur dormant `aged90/sellable ≥ 50 %`. **Recalcul propre : 86 crit / 90 warn / 57 opp / 233 taggés** (les 233 antérieurs dataient de v3.8.0 sans renforçateur → 23 warn promus crit). `caExposed` = `annualData['2025']` réconcilié Fab/Appro.
- **UI Agent Détecter v3.8.3** — écran unifié, fil 3 agents, entonnoir, **2 lentilles** (Exposition `suspectTag` / Buy Box perdue `retailPct`), passage de relais « Lancer l'Agent BB » → stub. **Narration validée visuellement par Fred** (« beaucoup plus compréhensible »).

### Données & nettoyage
- `foViews` Cogex FR : **8 semaines consécutives** reconstituées (ré-import 03/05, 17/05, 24/05 + 19/04).
- `aged90SellableUnits` mappé (v3.8.1).
- **Carnet Phase 2 supprimé** : `buyboxCases` vidé preprod (Cogex+Gers = 0) ; prod nettoyé (⚠ via console Fred — voir autocritique §6).

---

## 2. DÉCISIONS VERROUILLÉES

1. **Modèles IA** : convention version-mineure non datée ; routage figé par feature (pas de sélecteur client).
2. **Module Buy Box = processus vivant à 3 agents** (Détecter → Diagnostiquer → Agir), sur la chaîne de confiance. Décision **(c)** : page Processus en porte d'entrée + fil 3 agents persistant.
3. **Détecter** = écran unifié, 2 lentilles (Exposition / Buy Box perdue). Badge onglet = `retailPct` (perte actée).
4. **Diagnostiquer** = Agent BB Recovery **seul**. Carnet 11 hypothèses **supprimé** ; plomberie de dossier réutilisée (7 fonctions/11, schéma `buyboxCases` inchangé).
5. **Capture page** = 2 collages guidés (éditoriale + **bloc d'achat obligatoire**), **pattern IA** (`parseBuyBoxCapture`, pas de regex), bloc d'achat requis même en mono-vendeur.
6. **Règle de lecture bloc d'achat** (autorité GPT) : Vendu+expédié Amazon = 1P sain ; Vendu par X / expédié Amazon = 3P FBA (concurrent aligné) ; Vendu+expédié X = 3P dropshipping (levier promesse).
7. **v3.8.x reste en preprod** — merge prod groupé **avec** l'Agent BB Recovery (« à minima l'agent » : un Détecter sans diagnostic n'a pas de valeur en prod).

---

## 3. ÉTAT TECHNIQUE

| | Version | Note |
|---|---|---|
| **Prod** (`amazon.foliow.app`) | v3.7.13 | merge groupé v3.8.0/1/2 = commit `a59464c` poussé, mais valeur réelle conditionnée à l'Agent BB |
| **Preprod** | v3.8.3 | moteur + UI Détecter, validés |
| `buyboxCases` | vidé | preprod (0/0) + prod |
| Tags `suspectTag` | recalculés propres | 86/90/57/233 = référence |

---

## 4. POINT DE REPRISE — Agent BB Recovery (niveau 2)

**Le prochain gros morceau.** Transforme le stub en écran réel. Ingrédients déjà rassemblés :
- Capture 2 copies + `parseBuyBoxCapture` (Option B, pattern IA validé par audit).
- Règles de lecture 1P / 3P-FBA / 3P-dropship.
- 6 portes → BB-1→12 → 16 familles A→P (méthodo GPT).
- Plomberie dossier réutilisable (à réécrire : `buyboxAutoEvaluateHypotheses` + `renderBuyBoxCase`).

**Mérite son propre cadrage** (enchaînement des 6 portes, rôle de l'IA dans la classification, ce que l'utilisateur voit à chaque porte) **avant** le brief de code. À attaquer à tête reposée.

Puis : intégration page Processus complète, puis Agent Communication (v3.9).

---

## 5. BACKLOG DORMANT

1. [sécurité] `runApprosIA` — clé API exposée client → Lambda.
2. [infra] Vérificateur tarifs IA mensuel (alerte d'écart, jamais correction auto).
3. [process] **Voie propre pour la maintenance prod sans console Fred** (CloudShell / Chrome auto) — cf. §6.
4. [archi] **Canal d'import unique** — cause racine divergence `history`/`foViews`.
5. [produit] Flag « ASIN mal classé Amazon » (évolution `sourcingOnly`, lié Brand Registry).
6. [méthodo] Reformulation « taux d'exposition = FO/GV » (caduc en spec v2.2 §0) — à demander à GPT.
7. [produit] Lentille BB perdue : distinguer « récupérable » de « structurellement mort » (1231 perdues dont beaucoup à 0 %/listing supprimé) — itération, tri/filtre par CA.
8. [2ᵉ famille] Suspect dormant (trafic historique + stock sans mouvement) — arbitrage tag vs Enquête A2.
9. [à surveiller] Renforçateur `deliveryDefects` (BOL) — 0 déclenchement fenêtre courante.
10. [traçabilité] Double SHA hotfix (1cbc53e / 7775e8d) à clarifier.

---

## 6. AUTOCRITIQUE (Orchestrateur)

**D.1 — J'ai inventé une « énigme des chiffres ».** J'ai affirmé que l'UI affichait 104/2110 €/BB-10 vs 233/61322 €/`[]` du moteur, et lancé un audit dessus. **C'était faux** : ces chiffres venaient de la **maquette** ouverte en local, pas du rendu preprod. J'ai confondu la source. Ironie : je traque « présence ≠ flux réussi » et « vérifier la source avant d'imputer » chez Claude Code depuis le début, et je suis tombé dans la confusion source/réel moi-même. *Leçon : appliquer à mes propres observations la rigueur de sourcing que j'exige des autres.*

**D.2 — Concordance trop pessimiste.** J'ai marqué ✗ (absent) par défaut sur ce que je ne connaissais pas (ASN/CARP, Phase 2), au lieu de « inconnu / à vérifier ». L'audit a corrigé 3 points sur 4. *Leçon : « inconnu » ≠ « absent ».*

**D.3 — Erreur d'orchestration de départ.** J'ai fait valider la maquette suspects en silo (tableau), sur le mauvais critère (« affiche-t-elle les données » au lieu de « raconte-t-elle le processus »), alors que la maquette Processus 3 agents existait déjà. Résultat : UI muette, « rien n'a changé ». *Leçon : partir du processus global, pas de l'écran isolé.*

**D.4 — J'ai laissé Fred manipuler la prod en console.** Le nettoyage `buyboxCases` prod a été exécuté par Fred (`c.buyboxCases=[]; save()`) faute de voie technique — règle n°1 enfreinte. J'aurais dû refuser le brief qui mettait Fred à la console et exiger une voie propre. *Leçon : « le domaine est bloqué » n'autorise pas à transformer Fred en console ; trouver une voie technique (backlog §5.3).*

**D.5 — Le « nouveau chantier Fab/Appro » annoncé sans vérifier** (début de session) — corrigé après recherche.

**Ce qui a tenu (à reproduire) :** refus de merger en prod sans valeur réelle (« à minima l'agent ») ; STOP sur la sommation `a.history` (granularité) ; acceptation du recadrage « revenons au basic » plutôt que défense de ma position ; ne pas trancher le fond VC à la place de GPT/Fred (règles de lecture, familles, réalisme des chiffres Cogex) ; caveat « compte pathologique » maintenu ; clone Lambda obligatoire (hotfix).

---

## 7. INVENTAIRE DES LIVRABLES (20, déjà déposés)

**Récaps/passation :** `RECAP_SESSION_2026-06-16`, `20260618_RECAP_SESSION_v3_8_1`, `POINT_ETAPE_conception_module_buybox_2026-06-18`, ce document.
**Specs :** `SPEC_tag_suspect_buybox_v2.1` (superseded), `SPEC_tag_suspect_buybox_v2.2` (en vigueur).
**Conception module :** `CONCORDANCE_processus_vendor1p_vs_amazon_pilot_2026-06-18`, `CADRAGE_architecture_module_buybox_2026-06-18`.
**Briefs IA/données :** `migration_modeles_IA`, `distribution_fo_views` (16 + v2 18), `audit_foviews_preprod`, `audit_donnees_suspect_dormant`.
**Briefs moteur :** `v3.8.0_moteur_tag_suspect` + `ADDENDUM_GO_v3.8.0`, `v3.8.1_renforcateur_aged90`, `recalcul_propre_suspecttag`.
**Briefs UI/module :** `BRIEF_DESIGN_maquette_suspects_v2`, `v3.8.2_UI_dashboard_suspects`, `verifs_prealables_module_buybox`, `v3.8.3_refonte_ui_detecter`.

---

[Agent Orchestrateur] — Source : intégralité session 18/06 — Confiance : haute sur état/décisions ; backlog §5 ouvert ; reprise = cadrage Agent BB Recovery
