# RÉCAP SESSION — 18 mai 2026
## v3.6.0 + v3.6.1.x livrées en prod
**Note de session : 8/10**
**Production (main) : v3.6.1.5 (commit `fae7d79`)**
**Staging : v3.6.1.5**
**Preprod : v3.6.1.5**

---

## BILAN HONNÊTE

### Ce qui a bien fonctionné

- **7 versions livrées en une session sans régression** (v3.6.0 → v3.6.1.5)
- **Buy Box Phase 1 + Phase 2** fonctionnelles selon maquettes
- **Auto-marquage hypothèses** Phase 2 (Stock dynamique, PO, Listing inactif) — gain de temps réel pour le KAM
- **Algorithme dynamique stock** basé sur vélocité × stock × PO — reflète la réalité métier
- **Tri par criticité** (CA × inversé Retail% × accélérateur delta) — focus sur urgence vraie, pas sur taille brute
- **Garde-fous d'import étendus** (v3.6.0) — défauts livraison vérifiés contre vendor codes du client
- **Parser rendez-vous bilingue FR/EN** — détection auto via header `BdC` vs `PO`
- **Helper `fmtNum`** unifié pour formatage français
- **Cadrage produit commercial** : pivot cible "agents externes → entreprises VC internes" tranché
- **Discipline staging/preprod stricte** : 0 commit direct sur main, validation visuelle Fred obligatoire avant merge

### Ce qui a moins bien fonctionné

- **Seuils métier inventés** au lieu de chercher dans `AMAZON_PILOT_REFERENCE.md` et doc pilotage du 11 avril → Fred a dû corriger les seuils en 2 itérations (v3.6.1.3 → v3.6.1.4)
- **600+ lignes d'instructions** Claude Code cumulées pour ~200 lignes de code utile (ratio défavorable)
- **Tests automatiques 27/27 = GO merge** présenté comme suffisant initialement → Fred a dû imposer la revue UI obligatoire
- **Smoke tests** ne couvraient pas le rendu visuel sur cas neuf → un bug (auto-marquage non visible sur cas existants) a généré une fausse alerte
- **Précision flottante** (`+0,4500000000000284 pt`) oubliée dès la première version — bug classique à anticiper
- **`.toFixed()` sans `.replace('.', ',')`** répété sur 2 patches successifs (v3.6.1.3 et v3.6.1.4) — pattern à fixer par helper unifié (fait en v3.6.1.5)

---

## ÉTAT ACTUEL

### Production (v3.6.1.5) — STABLE ✅

**Buy Box Phase 1 (Identifier)** :
- 4 KPIs : ASINs en difficulté, CA à risque/mois, Dossiers ouverts, Résolus 90j
- Bandeau contexte sectoriel (Vendor on-time policy Amazon janvier 2026, source ChannelX)
- Filtres cycle de vie (Tous/Best/Permanent/Fin de vie) — structure prête, dérivation v3.6.2
- Tabs (Perdue/Compromise/Fragile/Récupérées) — Fragile/Récupérées en stub
- Tri par défaut : criticité décroissante (formule : CA × inverse Retail% × accélérateur delta)
- Tri alternatif : CA décroissant (bouton)
- Colonne "Cause suspectée" : "—" en v3.6.1.x (croisement v3.6.2)

**Buy Box Phase 2 (Carnet d'enquête)** :
- Bloc Faits auto-calculé : Retail%, stock, vélocité, couv stock, couv totale, PO, défauts globaux, prix, concurrent 3P (placeholder), dernière modif fiche, code vie (placeholder), saisonnalité (placeholder)
- 11 hypothèses pré-définies (7 maquette + 4 orchestrateur : CRaP, parent/enfant, specs, restriction marché)
- Auto-marquage à l'ouverture (3 hypothèses sur 11) : Stock insuffisant, PO non confirmé, Listing inactif
- Badge "⚙ auto" pour distinguer marquage algorithmique vs manuel
- Reset auto → manuel si l'utilisateur change le statut
- Journal : entrées système + entrées auto + entrées manuelles
- Conclusion verrouillée tant que 3 conditions non remplies (≥3 journal, ≥1 validée OU ≥3 écartées avec faits, source BOL renseignée)
- Garde-fou "L'IA n'a pas le droit de précipiter" affiché

**Imports v3.6.0** :
- Défauts livraison : parseur CSV avec garde-fou vendor code bloquant
- Rendez-vous : parseur bilingue FR/EN, détection auto par header
- Source du BOL configurable dans fiche client (ERP/CMS/OMS/Transporteur/Inconnu + détail libre)
- Écrasement complet à chaque import (pas de fusion incrémentale)

---

## ALGORITHME STOCK INSUFFISANT — RÉFÉRENCE v3.6.1.4

Pour mémoire (et débat futur) :

```
vélocité (v) :
  - hist >= 4 sem : moyenne 4 dernières sem
  - hist 1-3 sem  : moyenne sur ce qu'on a
  - hist = 0      : v = null

hl (historique long) = moyenne des semaines 5-16

couvertureStock  = stock / v
couvertureTotale = (stock + PO) / v

Statut auto :
  - v === null                                     → todo
  - v === 0 ET hl >= 5/sem (faisait des ventes)   → todo (ambigüe, mord la queue)
  - v === 0 ET hl < 5/sem (dormant)               → rejected
  - couvStock < 2 ET couvTotale < 4               → investigate (rupture imminente)
  - couvStock < 2 ET couvTotale >= 4              → rejected (PO couvre)
  - couvStock < 4 ET couvTotale < 6               → investigate (tension)
  - couvTotale > 12                                → rejected (surplus)
  - sinon                                          → todo
```

**Cas réel testé** : ASIN B009G3EMDI Cogex — stock 1184 u. (semble énorme en absolu) → vélocité 693 u./sem → couv 1,7 sem → **investigate**. L'algo a corrigé la perception "stock = beaucoup" en regardant la réalité vélocité.

---

## CADRAGE PRODUIT COMMERCIAL — TRANCHÉ EN SESSION

### Cible
**Entreprises Vendor Central pilotant leur compte en interne et qui galèrent.** Pas les agents externes (qui se feront leurs outils avec ChatGPT/Claude).

### Personas
| Rôle | Type |
|---|---|
| Décideur d'achat | Directeur e-commerce / digital |
| Porte d'entrée vente | KAM Amazon + Responsable Marketing |
| Utilisateurs quotidiens | KAM Amazon + Responsable Marketing |

### Pricing (à revoir — incohérence reconnue)
- Free / Starter 79€ / Pro 149€
- Facturation par utilisateur ET par compte VC
- Pay-as-you-go IA au-delà du forfait
- **Risque identifié** : un client mid-market arrive vite à 800€+/mois → trop cher pour la promesse freemium. À retravailler en session dédiée.

### Valeur perçue (priorité décroissante)
1. **Argent récupéré** (CA sécurisé, POs sauvés) — discours commercial #1, à chiffrer en €
2. **Temps gagné** (1h/jour routine)
3. **Clarté du diagnostic**
4. **Sérénité** (rien ne passe à côté)

### Niveau d'automatisation
**5 sur 10** : copilote intelligent. L'outil diagnostique, propose, l'humain valide. L'IA ne précipite jamais.

### Onboarding
- Free + Starter : self-service assisté par chatbot IA Claude
- Pro : + call setup humain gratuit

### Connexion VC
- Phase 1 (initial) : CSV manuel
- Phase 2+ : agent Chrome / SP-API pour Pro

### Concurrence
Pas identifiée sur VC (marché peu disputé). SC saturé. Fenêtre estimée 12-24 mois avant arrivée concurrents.

### Sujets restant ouverts
- Modèle économique (par-utilisateur × par-compte génère factures incohérentes)
- "Organisation agentique" commercialisation — concept à creuser
- Migration Cogex/Gers vers le SaaS (a/b/c discuté)
- Architecture technique v3.7 (modulaire monolithe vs bundler vs microservices)

---

## RÈGLES TECHNIQUES AJOUTÉES CETTE SESSION

### Règle `fmtNum` — formatage numérique français

Pour toute valeur numérique affichée à l'utilisateur en français :

```javascript
function fmtNum(v, decimals) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  var d = decimals !== undefined ? decimals : 1;
  return v.toFixed(d).replace('.', ',');
}
```

Usage systématique : `fmtNum(couvSem, 1) + ' sem'`. **JAMAIS** `.toFixed()` sans `.replace()`.

### Règle critères de tri

Pour tout écran de pilotage qui affiche une liste d'ASINs :
- **Pas de "tri par défaut" arbitraire** sans demander à Fred quel est le bon critère
- **Critère = mesure de criticité opérationnelle**, pas mesure brute (taille, CA)
- Formule de criticité par défaut : `CA × (1 − retailPct/100) × (1 + max(0, −deltaS1)/10)`

### Règle auto-marquage hypothèses

Toute auto-évaluation d'hypothèse doit :
1. **Persister** le statut + un flag `auto: true`
2. **Afficher un badge** "⚙ auto" pour transparence
3. **Tracer dans le journal** au moment de l'auto-marquage
4. **Repasser à `auto: false`** si l'utilisateur surcharge manuellement
5. **Ne PAS rejouer** sur les cas déjà ouverts (anti-régression)
6. **Garder une branche "todo"** pour les cas ambigus — ne jamais forcer un statut quand la donnée est insuffisante

### Règle anti-précipitation IA

Tout pré-marquage automatique doit être révocable, traçable, et toujours laisser la décision finale à l'humain. Le garde-fou "L'IA n'a pas le droit de précipiter" s'applique aussi à la logique pure (pas seulement à l'IA).

### Règle "chercher les seuils métier avant d'inventer"

Avant de proposer un seuil (stock, couverture, retail%, etc.), chercher dans :
- `AMAZON_PILOT_REFERENCE.md`
- Doc pilotage du 11 avril 2026
- Récap sessions précédentes

Si trouvé → utiliser tel quel. Si pas trouvé → **demander à Fred AVANT** de coder, pas après.

### Règle smoke tests rendu visuel

Pour toute feature qui produit du rendu visuel, le smoke test doit inclure :
- "Ouvrir tel écran"
- "Voir tel élément à l'écran avec telles caractéristiques visibles"

Pas seulement "appeler telle fonction et inspecter l'objet retourné".

---

## SUJETS POUR PROCHAINE SESSION

### Priorité 1 — Test usage réel prolongé

Fred utilise v3.6.1.5 en prod pendant quelques jours sur Cogex et Gers. Accumule retours de pilotage réel. Pas de dev pendant cette phase.

### Priorité 2 — v3.6.2 — Croisement défauts × ASIN + codeVie

Quand Fred est prêt :
- Croisement `c.deliveryDefects` × `c.pos` × `c.asins` pour afficher la "Cause suspectée" en colonne Phase 1
- Mapping `codeVie` depuis `c.erpStock` vers `c.asins[]` pour filtres cycle de vie réels
- Dérivation des tabs "Fragile" et "Récupérées" (logique stub aujourd'hui)
- Auto-marquage "BOL non transmis" si nb défauts BOL Mismatch > seuil sur ASIN sur 30j
- Optionnel : tabs "Fragile" basé sur delta négatif ≥ 2 sem consécutives
- Format C ERP Gers (parser XLSX onglet "Feuil4", header L.2) si toujours pertinent

### Priorité 2-bis — Moteur de recherche ASINs transversal

Besoin identifié fin de session 18 mai : **4 écrans listent des ASINs mais n'ont pas de moteur de recherche**, contrairement à "Analyse ASINs" qui en a un.

Écrans concernés :
- **Buy Box** (Phase 1 et Phase 2)
- **Appros**
- **Prévisionnel**
- **Diagnostic CA**

Approche recommandée : **factoriser le composant de recherche existant** dans Analyse ASINs (probablement dans `renderAsins`) en un helper réutilisable, puis l'intégrer dans les 4 écrans. À traiter dans v3.6.2 ou en patch séparé v3.6.2.x.

À vérifier au moment du dev :
- Localisation du moteur de recherche actuel dans `renderAsins`
- Possibilité d'extraire en helper (`renderAsinSearch(list, options)` par exemple)
- UX : input + filtre live, ou aussi des tris/filtres avancés ?
- Cohérence avec les filtres existants (cycle de vie, tabs, etc.) — éviter conflits

### Priorité 3 — v3.6.3 — Suggestion IA hypothèses sémantiques

Quand v3.6.2 est en prod et les données fiabilisées :
- Suggestion IA Claude pour les 7 hypothèses qui restent manuelles (Compliance, Pricing Vendor, CRaP, Specs, Restriction marché, etc.)
- Réutilisation de la structure `c.bbKnowledge` (renommée `c.buyboxKnowledge` ?)
- Phase 3 (Proposer) débloquée — l'outil propose une action concrète quand la Conclusion est verrouillée

### Priorité 4 — Cadrage stratégique commercial

Sujets ouverts à creuser en session dédiée :
- Modèle économique (résoudre l'incohérence par-utilisateur × par-compte)
- "Organisation agentique" pour commercialisation — c'est quoi concrètement
- Migration Cogex/Gers vers SaaS multi-tenant
- Pricing rénové aligné cible "entreprise VC interne"

### Priorité 5 — Architecture v3.7 (modulaire)

Après v3.6.2 et v3.6.3 livrés. Pas avant.

3 questions structurantes déjà tranchées :
- `python build.py` conservé (pas Vite/esbuild)
- JS vanilla pur conservé (pas ES6+ partout)
- Découpage **progressif** par domaine (buybox/, seo/, appro/...) — pas migration big bang

Brief séparé à produire après cadrage commercial.

---

## INFRASTRUCTURE (rappel)

| Ressource | Valeur |
|---|---|
| S3 prod | `amazon-pilot-foliow` |
| CloudFront prod | `E3ERL241475BJI` |
| S3 staging | `amazon-pilot-recette` |
| CloudFront staging | `EVQ30COFUNGA7` |
| S3 preprod | `amazon-pilot-preprod` |
| CloudFront preprod | `E3CODYJ437XKU5` |
| Lambda imports | `https://hue3u3z5ghbi4tcj2lxqewk4ua0nrbyx.lambda-url.eu-west-3.on.aws` |
| Lambda API prod | `https://konuaxmdxjnzcuw2etjqwczrla0xycvt.lambda-url.eu-west-3.on.aws` |
| Cognito | `eu-west-3_8P9UzCONx` / `5nnllolhnc3572800bvce94682` |
| Repo GitHub | `Fred78750/amazon-pilot` |
| Repo local | `C:\AmazonPilot\repo` |

---

## VERSIONS STABLES

| Version | Statut | Hash git |
|---|---|---|
| v3.4.27 | ✅ Stable | d9738ca |
| v3.4.28 | ✅ Stable | d747085 |
| v3.4.41 | ✅ Stable | cd3e709 |
| v3.5.9 | ✅ Stable précédent | a0789ce |
| **v3.6.1.5** | ✅ **Stable prod actuel** | **fae7d79** |

---

## AUTOCRITIQUE SESSION ORCHESTRATEUR

### Patterns à conserver

1. **Distinction stricte entre dev en cours et cadrage stratégique** — pas de mélange "tant qu'on y est"
2. **Cadrage par blocs** des questions stratégiques quand Fred l'a demandé — c'était la bonne discipline
3. **Confrontation systématique au code source** avant de planifier — éviter d'inventer ce qui existe déjà (`c.erpStock` déjà présent en v3.5.9, `c.bbCases` à supprimer parce que jamais utilisé)
4. **Refus du merge prématuré** quand seuls les tests automatiques passent — la revue UI Fred est obligatoire
5. **Points de vigilance V1-V15** en tête des plans complexes — pédagogie sur les pièges connus

### Patterns à corriger en session prochaine

1. **Chercher les seuils dans les docs existants AVANT d'inventer** — j'ai inventé des seuils stock (10/30/50, 1 sem/4 sem) alors que le doc pilotage du 11 avril disait "Stock < 30u OU dispo < 90%"
2. **Format Claude Code plus léger en mode itératif** — 600+ lignes d'instructions cumulées pour 200 lignes de code, ratio défavorable. Sur les patches successifs sur le même domaine, passer en mode plus laconique
3. **Anticiper le formatage français** dès le premier plan — `fmtNum` aurait dû exister dès v3.6.1, pas en v3.6.1.5
4. **Anticiper la précision flottante** — `+0,4500000000000284 pt` est un piège classique JS, à intégrer dans ma checklist de plan
5. **Rendu visuel dans les smoke tests** — "ouvrir l'écran et VOIR" doit être un test explicite, pas un implicite

### Patterns spécifiques à Claude Code

1. **`grep` préalable** systématique avant suppression / réutilisation (fait pour `copyBuyBoxChromePrompt`, `showToast`, CSS classes) — à conserver
2. **Diagnostic complet avec preuves DevTools** quand un bug est suspecté (fait pour delta S-1 cassé) — qualité à conserver
3. **Confirmation explicite** quand un patch divergeait de ma spec (ordre P4/P5 inversé, signature `showToast`) — discipline à conserver

---

## DOCUMENTS DE RÉFÉRENCE (dans le repo)

| Fichier | Contenu |
|---|---|
| `AMAZON_PILOT_REFERENCE.md` | Vision, architecture, roadmap |
| `CLAUDE_CODE_CONTEXT.md` | Contexte Claude Code — anti-régression |
| `REFERENCE_SEO_AGENT_VC_v3_4_41.md` | Référence SEO + agent VC |
| `NOTE_ORCHESTRATEUR_v1.md` | Note stratégique Buy Box (3 phases, garde-fous) |
| `BRIEF_BUYBOX_v1.md` | Brief technique Buy Box |
| `buybox_phase1.html` / `buybox_phase2.html` | Maquettes UX validées |
| `20260415_amazon-pilot-vision-architecture.md` | Vision produit + plan déploiement 6 phases |

---

**FIN RÉCAP — 18 mai 2026 — Note : 8/10**
