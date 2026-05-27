# BRIEF CLAUDE CODE — v3.6.7 YoY Étape 2 : Warnings + éveil 80/20

**Version cible** : v3.6.7
**Chantier** : YoY Étape 2 — Couche d'alerte visuelle sur le module YoY + éveil 80/20 longue traîne
**Durée estimée** : ~1 semaine Claude Code
**Auteur brief** : Claude Orchestrateur — 26 mai 2026
**Audience** : Claude Code (implémentation) + Fred (relecture / validation)
**Type** : Chantier fonctionnel majeur (slot v3.6.7 réservé en V0.6)
**Référence cible visuelle** : `maquette_yoy_cogex_v3.html`
**Référence delta** : `YOY_DELTA_MAQUETTE_VS_PROD.md` (sections 3.2, 3.4, 4)

---

## 1. OBJECTIF

Ajouter une **couche d'alerte visuelle** sur le module YoY Étape 1 déjà livré en prod (v3.6.6.2). Implémentation des règles de seuil (warnings), du KPI hero block visuel cible maquette V3, et du **mécanisme d'éveil 80/20 longue traîne** sur Dashboard et Revue Hebdo.

C'est la **première matérialisation visuelle** du delta entre la maquette V3 et la prod. Pas de logique d'enquête détaillée — c'est l'objet de v3.6.8.

## 2. ENJEUX MÉTIER

L'utilisateur d'Amazon Pilot doit :
1. Voir en 5 secondes sur le tableau de bord YoY si quelque chose mérite attention (warnings visuels)
2. Pouvoir cliquer "Enquêter →" sur chaque warning pour mener l'investigation (mène pour l'instant vers Analyse ASINs filtré — la vraie enquête détaillée arrive en v3.6.8)
3. Être réveillé sur le Dashboard et la Revue Hebdo quand la **longue traîne** s'érode (mécanisme 80/20)

Pourquoi maintenant : le KPI hero block visuel de la maquette V3 est le **pavé d'entrée commercial**. Sans lui, la démo commerciale du module YoY n'a pas son "wow effect".

---

## 3. CE QUI EST DANS LE SCOPE

### 3.1 Refonte visuelle du KPI hero block

Conformité visuelle à la maquette V3 sur le **bloc d'entrée** du module YoY :
- 3 KPIs principaux affichés en grand (CA perdu / ASINs disparus / Concentration accrue)
- Delta % + delta absolu sous chaque KPI
- Couleur cohérente (rouge si négatif, vert si positif, neutre si stable)
- Espacement et typographie alignés sur le design system existant Amazon Pilot

Les indicateurs sont **déjà calculés** en YoY Étape 1 (v3.6.5.x). Il s'agit uniquement de **les présenter sous le format visuel cible**.

### 3.2 Règles de seuil (warnings)

Implémentation de 3 règles d'alerte simples qui se déclenchent automatiquement quand le seuil métier est franchi :

| Warning | Règle de déclenchement | Couleur | Niveau |
|---|---|---|---|
| **W1 — Baisse CA significative** | CA période A < CA période B - 20% | Rouge | Critique |
| **W2 — Concentration accrue** | Part Top 10 ASINs (période A) > Part Top 10 ASINs (période B) + 10 points | Orange | Attention |
| **W3 — Catalogue actif contracté** | Nb ASINs vendus période A < Nb ASINs vendus période B - 30% | Rouge | Critique |

**Affichage** : carte d'alerte visuellement intégrée sous le KPI hero block, avec :
- Icône d'alerte (rouge ou orange selon niveau)
- Libellé court ("Votre CA baisse de 23% — situation à investiguer")
- Bouton CTA **"Enquêter →"** qui mène vers Analyse ASINs avec un filtre actif selon le warning

Les seuils sont **codés en dur** dans le module (pas configurables dans l'UI pour cette itération). À mettre dans une constante `YOY_WARNING_THRESHOLDS` pour facilité de tuning.

### 3.3 Mécanisme d'éveil 80/20 longue traîne

Sur **Dashboard** et **Revue Hebdo** (en dehors du module YoY) : pavé d'éveil qui signale l'érosion silencieuse de la longue traîne.

Logique :
- Pour chaque période d'observation (semaine en cours dans Revue Hebdo, mois en cours sur Dashboard), identifier les ASINs hors top 20% (queue de catalogue)
- Calculer la baisse moyenne de CA de ces ASINs vs N-1 (ou période de référence selon contexte)
- Si l'érosion cumulée >= seuil (à valider à l'implémentation, suggestion 5 000 €/mois) → afficher un pavé d'éveil

**Format du pavé** :
```
🔍 X ASINs longue traîne en érosion = Y €/mois
[Voir les ASINs en érosion →]
```

Le bouton mène vers une vue filtrée d'Analyse ASINs (ASINs concernés).

**Note** : ce mécanisme s'appuie sur les données déjà présentes dans `c.asins[]` (CA historique, ASINs vendus). Pas de nouvel import nécessaire.

### 3.4 CTA implémentés

- **CTA 11** — `Enquêter →` (sur chaque warning) → mène vers Analyse ASINs filtré
- **CTA 12** — `Voir les ASINs en érosion →` (pavé éveil 80/20) → mène vers Analyse ASINs filtré sur longue traîne en baisse

Pour les deux CTA, le filtre actif doit être visible sur Analyse ASINs (badge "Filtré par : longue traîne en érosion" par exemple, avec possibilité de retirer le filtre).

---

## 4. CE QUI EST HORS SCOPE (LIMITES NÉGATIVES)

À écrire en début parce que projet à enjeu commercial — la dérive de scope est le risque principal.

- **PAS de classification des ASINs disparus** en 3 catégories (À CREUSER / Mortalité / Autres). C'est **v3.6.8**. Le warning W3 (catalogue contracté) **renvoie vers Analyse ASINs filtré** sur les ASINs disparus, mais sans classification fine.
- **PAS de fiche détail d'enquête par ASIN**. C'est v3.6.8 — la fiche détail n'existe pas encore.
- **PAS de section Marques avec tagging** (chute/croissance/sortie). C'est v3.6.8.
- **PAS de Section Anomalies** (détection cas atypiques). C'est v3.6.8.
- **PAS de toggle Vue Free / Vue Pro** ni de logique freemium. C'est v3.6.9.
- **PAS de plan d'action 5 priorités**. C'est v3.6.9.
- **PAS d'export Word** ni de narrative IA. C'est v3.6.9.
- **PAS de CTA `Ouvrir des cas Vendor Central depuis Buy Box →`** ni `Sécuriser les best-sellers via Buy Box →`. C'est v3.6.10.
- **PAS de croisement avec les défauts livraison**. C'est v3.6.10.
- **PAS de modification du parser CSV VC** (livré en v3.6.6.2, stable).
- **PAS de modification de l'algorithme stock dynamique Buy Box** (livré en v3.6.1.4, stable).
- **PAS de seuils configurables dans l'UI** (codés en dur dans une constante).

---

## 5. CRITÈRES DE RÉCEPTION

À la livraison v3.6.7 (avant merge prod), les critères suivants doivent être validés :

### 5.1 Visuel
- [ ] KPI hero block correspond visuellement à la maquette V3 (3 KPIs principaux + deltas)
- [ ] Cartes warnings (W1, W2, W3) visibles dans le bon ordre selon priorité
- [ ] Pavé d'éveil 80/20 visible sur Dashboard et Revue Hebdo (sous le KPI principal, non intrusif)

### 5.2 Comportemental
- [ ] W1 se déclenche quand CA période A < CA période B - 20%
- [ ] W2 se déclenche quand concentration Top 10 augmente de plus de 10 points
- [ ] W3 se déclenche quand nb ASINs vendus baisse de plus de 30%
- [ ] Pavé éveil 80/20 ne s'affiche pas si érosion < seuil (pas de "pavé vide")
- [ ] Boutons CTA 11 et CTA 12 mènent vers Analyse ASINs avec le bon filtre actif

### 5.3 Validation terrain Fred
- [ ] Sur Cogex avec données prod : au moins 1 warning se déclenche (Cogex a un cas réel d'érosion catalogue documenté)
- [ ] Sur Gers avec données prod : warnings s'appliquent ou non selon données réelles
- [ ] Le pavé d'éveil 80/20 se déclenche sur au moins un des clients

### 5.4 Régression
- [ ] Module YoY Étape 1 (KPIs bruts) fonctionne toujours après v3.6.7
- [ ] Module Parser ERP v3.6.6 inchangé
- [ ] Module Parser CSV VC v3.6.6.2 inchangé
- [ ] Module Buy Box Phase 1+2 inchangé
- [ ] IndexedDB v5 stores intacts (clients, meta, yoy_analyses, erp_stock, smoke_history)

---

## 6. AUDIT ANTI-RÉGRESSION (RÈGLE 28 V0.7)

Avant push prod, audit anti-régression en **4 blocs** selon le standard établi (v3.6.5.12, v3.6.6, v3.6.6.2) :

### Bloc 1 — Validation code
- `node --check` sur tous les `src/*.js`
- APP_VERSION = '3.6.7' alignée partout (build.py, bundle, titre onglet)
- Taille bundle vs v3.6.6.2 (±10%)

### Bloc 2 — Playwright smoke tests
- 20+ tests existants doivent rester verts
- Ajouter nouveaux tests V8 :
  - V8a — Warning W1 déclenché si CA -20%
  - V8b — Warning W2 déclenché si concentration +10 pts
  - V8c — Warning W3 déclenché si catalogue -30%
  - V8d — Pavé éveil 80/20 affiché si érosion > seuil
  - V8e — CTA 11 mène vers Analyse ASINs filtré
  - V8f — CTA 12 mène vers Analyse ASINs filtré longue traîne

### Bloc 3 — Navigation 10 écrans
Navigation Playwright headless sur les 10 écrans, 0 erreur console JS.

### Bloc 4 — Tests fonctionnels ciblés
- Modules non touchés intacts (YoY Étape 1, Parser ERP, Parser VC, Buy Box, SMOKE_REF, smoke_history)
- IndexedDB v5 stores intacts
- Sur Cogex : SMOKE_REF V9a/V9b verts (calibration Cogex préservée)
- Sur Gers : SMOKE_REF en skip info, pas en alerte rouge

---

## 7. RESSOURCES

### 7.1 Documents de référence
- `maquette_yoy_cogex_v3.html` (cible visuelle)
- `YOY_DELTA_MAQUETTE_VS_PROD.md` (référence delta)
- `Claude_Orchestrateur_Context_V0_7.md` (règles session, V0.7)
- `20260518_RECAP_SESSION_v3_6_1_5.md` (méthodologie 4 étapes, principes)

### 7.2 Données de test
- Cogex (FR mono-pays) : données prod existantes — au moins 1 warning attendu
- Gers (multi-pays agrégé) : données prod existantes
- Pas besoin de nouveau jeu de données

---

## 8. PROCÉDURE

1. Tu lis ce brief en entier avant de coder
2. Tu lis `YOY_DELTA_MAQUETTE_VS_PROD.md` section 3.2 et 3.4 (concentration)
3. Tu lis `maquette_yoy_cogex_v3.html` (visuel cible)
4. Tu exposes ton plan technique avant de coder (règle n°1) :
   - Quels fichiers source touchés
   - Quelles nouvelles fonctions / constantes
   - Quel impact sur les écrans Dashboard et Revue Hebdo
   - Quelles régressions possibles
5. Tu attends le GO Fred
6. Tu codes en suivant le scope strict
7. Tu push sur staging
8. Tu fais l'audit anti-régression 4 blocs sur preprod
9. Tu attends validation Fred → merge prod
10. Tu mets à jour `YOY_DELTA_MAQUETTE_VS_PROD.md` (cocher éléments livrés + récap CTA)
11. Tu mets à jour `CLAUDE_CODE_CONTEXT.md` (version prod = v3.6.7)

---

## 9. POINTS D'ATTENTION

### 9.1 Risque de glissement vers v3.6.8

La tentation de "tant qu'on touche au YoY, autant faire un peu de classification" doit être combattue. **Garde-fou** : si le code que tu écris commence à matcher une condition sur 9 codes VC (`AC`, `IA`, `IR`, `OS`, `CP`, `CK`, `CQ`, `R2`), tu sors du scope v3.6.7 et tu rentres dans v3.6.8. Stop et clarifier.

### 9.2 Risque de seuils inventés

Les seuils des 3 warnings (-20% / +10 pts / -30%) sont des **valeurs initiales raisonnables**, pas des vérités gravées dans le marbre. Fred validera lors du test terrain. Si tu trouves dans `AMAZON_PILOT_REFERENCE.md` ou dans le brief Buy Box des seuils différents pour des cas analogues, **demande à Fred avant de coder** — anti-pattern documenté en V0.6 (seuils métier inventés).

### 9.3 Pavé éveil 80/20 — risque de bruit

Si le seuil d'érosion est trop bas, le pavé d'éveil affichera "X ASINs en érosion" même quand X est petit ou Y est négligeable → bruit perçu. Suggestion : ne pas afficher si Y < 1 000 €/mois OU X < 10 ASINs. À valider à l'implémentation.

### 9.4 Cohérence avec le mécanisme alertes existant Buy Box

Le module Buy Box a déjà ses propres alertes (Phase 1 = ASINs en difficulté). Les warnings YoY de v3.6.7 doivent être **complémentaires**, pas redondants. Pas de double alerte sur le même phénomène. Si un ASIN apparaît à la fois dans Buy Box critique ET dans le pavé d'éveil 80/20 → ne pas le compter deux fois.

---

## 10. AUTOCRITIQUE PRÉ-LIVRAISON

Quand tu livres v3.6.7, tu produis aussi une autocritique courte (cf. patterns V0.7) :
- Ce qui a bien fonctionné dans la collaboration
- Ce qui a moins bien fonctionné
- Les ratios "lignes de code utile / lignes d'instructions" (anti-pattern v3.6.1.x : 600+ lignes pour 200 lignes de code)
- Les bugs détectés en cours de route et leur cause racine

---

**FIN DU BRIEF v3.6.7**

[Claude Orchestrateur — 26 mai 2026]
