# SMOKE TEST — Amazon Pilot preprod

URL : https://preprod.amazon.foliow.app
À exécuter après chaque déploiement preprod.

## Test 1 — Affichage fiche existante
- [ ] Ouvrir Cogex Outillage → Analyse ASINs
- [ ] Cliquer sur B0CGDDZNHD (ou tout ASIN avec fiche générée)
- [ ] Vérifier : TITRE non vide
- [ ] Vérifier : BULLETS présents (5 bullets)
- [ ] Vérifier : DESCRIPTION HTML présente
- [ ] Vérifier : BACKEND KEYWORDS présents
- [ ] Vérifier : SYNTHÈSE STRATÉGIQUE présente (4 champs minimum)
- [ ] Vérifier : Console DevTools → zéro erreur rouge

## Test 2 — Nouvelle génération
- [ ] Ouvrir Agent SEO
- [ ] Saisir B009L0RMUG → FR → SKU 50405
- [ ] Étape 4 : vérifier que le textarea "Enrichissement produit" est visible
- [ ] Cliquer "Générer la fiche SEO"
- [ ] Vérifier que la génération se lance (barre de progression)
- [ ] Vérifier que le résultat s'affiche (titre non vide)

## Test 3 — Saisie SKU
- [ ] Saisir un SKU dans le wizard Agent SEO
- [ ] Vérifier que la saisie est fluide (pas de perte de focus entre chaque caractère)

## Résultat
- Tous les points cochés → GO pour merge main
- Un point non coché → STOP + rapport à Fred
