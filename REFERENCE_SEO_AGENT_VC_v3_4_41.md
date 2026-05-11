# RÉFÉRENCE COMPLÈTE — Fonctionnalité SEO + Agent Vendor Central
**Amazon Pilot v3.4.41 — 11 mai 2026**
**Statut : DOCUMENT VIVANT — mettre à jour à chaque évolution majeure**

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble du flux](#1-vue-densemble-du-flux)
2. [Wizard Optimisation Fiche Article](#2-wizard-optimisation-fiche-article)
3. [Prompt SEO — buildSEOPrompt v2](#3-prompt-seo--buildseoprompt-v2)
4. [Parsing — parseSEOResponse](#4-parsing--parseseoresponse)
5. [Challenge GPT — Comparaison & Arbitrage](#5-challenge-gpt--comparaison--arbitrage)
6. [Agent Vendor Central — buildVCModifyPrompt](#6-agent-vendor-central--buildvcmodifyprompt)
7. [Règles SEO Amazon — Référentiel](#7-règles-seo-amazon--référentiel)
8. [Stockage des données](#8-stockage-des-données)
9. [Fonctions clés — localisation dans le code](#9-fonctions-clés--localisation-dans-le-code)
10. [Règles invariantes](#10-règles-invariantes)

---

## 1. VUE D'ENSEMBLE DU FLUX

```
Vue détail ASIN
    │
    ├── Pas de fiche → [✨ Optimiser la fiche Article]
    │                         │
    └── Fiche existante → [📤 Publier dans VC] [🔄 Régénérer]
                                │
                    ┌───────────▼───────────┐
                    │  WIZARD OPTIMISATION  │
                    │  (8 étapes a→g)       │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼──────────────────┐
              │                 │                  │
         a. SKU          b. Fiche Amazon     c. Génération Claude
              │                 │                  │
         d. Sortie GPT    e. Comparaison      f. Fiche éditable
              │                 │                  │
              └─────────────────┼──────────────────┘
                                │
                           g. CTA final
                    ┌──────────┼──────────┐
                    │          │          │
               g1. Save   g2. Regen  g3. Save + VC
                                          │
                                   ┌──────▼──────┐
                                   │  AGENT VC   │
                                   │ (Claude in  │
                                   │  Chrome)    │
                                   └─────────────┘
```

---

## 2. WIZARD OPTIMISATION FICHE ARTICLE

### Architecture

**State isolé :** `wizardState` — jamais partagé avec `avcState` (wizard Agent SEO existant).

```javascript
let wizardState = {
  asin: null,
  market: null,
  sku: null,
  step: 'a',           // 'a'|'b'|'c'|'d'|'e'|'f'|'g'
  ficheReady: false,
  challengeReady: false,
  progress: null,      // 'seo'|'challenge'|null
  isRegen: false,
  collapsed: {}        // accordéon — { a: true, b: true, ... }
};
```

### Étapes

| Étape | Nom | Contenu | Obligatoire |
|---|---|---|---|
| A | Saisir le SKU | Input texte + bouton Confirmer dynamique | Oui |
| B | Coller la fiche Amazon | Textarea `ficheAmazon` — sauvegardée automatiquement | Non |
| C | Analyse et génération Claude | Appel `runSEOFiche` → affiche titre + 5 bullets | Oui |
| D | Intégrer la sortie GPT | Textarea `ficheGPT` — sauvegardée automatiquement | Non |
| E | Comparaison & arbitrage | Appel `runChallengeGPT` → verdicts + synthèse + GO/NO GO | Si GPT fourni |
| F | Fiche finale éditable | Textareas pré-remplis depuis fusion ou seoResults | Oui |
| G | CTA final | 3 boutons : Save / Regénérer / Save + Publier VC | Oui |

### Accordéon
- Étapes complétées → pliées par défaut (`collapsed[id] = true`)
- Étape active → dépliée
- Flèche ▶/▼ cliquable sur les étapes done
- Fonction : `toggleWizardStep(id)`

### Règle architecture CRITIQUE
`wizardState` est exclusivement pour ce wizard.
`avcState` est réservé au wizard Agent SEO + VC existant.
La seule interaction autorisée entre les deux : passer les données via `seoResults[asin][mkt]` avant d'appeler `goAgentVC()`.

### Boutons vue détail ASIN
```javascript
// Pas de fiche existante
[✨ Optimiser la fiche Article] → openWizard(asin, market, false)

// Fiche existante (a.ficheOptimisee[market])
[Résumé titre + date génération]
[📤 Publier dans VC] → publishVC(asin, market)
[🔄 Régénérer]      → openWizard(asin, market, true)
```

---

## 3. PROMPT SEO — buildSEOPrompt v2

### Signature
```javascript
function buildSEOPrompt(a, c, lang, isBackendKW)
```
- `a` : objet ASIN depuis `c.asins`
- `c` : objet client complet
- `lang` : code langue ('fr', 'de', 'es', 'it', 'nl', 'en')
- `isBackendKW` : boolean — si true, génère uniquement les backend keywords

### Données injectées dans le prompt
```javascript
// Données Vendor Central
'ASIN : ' + a.asin + ' | Marque : ' + a.brand
'Titre actuel : ' + a.title
'CA semaine : ' + fmtEur(a.revenue) + ' | Tendance : ' + trend.label
'Taux de conversion : ' + convRate
'Retours : ' + a.returns + ' | Retail % : ' + a.retailPct
'Segment : ' + calcSegment(a, totalCA)
'Niveau de gamme (PPM) : ' + niveau + ' (' + ppm.ppm + '%)'
'Score potentiel : ' + pot.score + '/100'
'Alertes Vendor : ' + alertes

// Fiche Amazon (si fournie par Fred)
a.ficheAmazon → injectée dans dataCtx sous '--- FICHE AMAZON ACTUELLE ---'
```

### Phase 0 — Analyse obligatoire AVANT toute rédaction
Le prompt impose 6 étapes d'analyse avant de rédiger :

1. **Risque sémantique** — fausses attentes créées par le terme de recherche
2. **Réalité produit** — "Ce produit est [type exact], pour [profil réel], avec [limite principale]"
3. **Analyse concurrentielle** — concurrents directs, arguments surutilisés, case libre
4. **Lecture des avis** — cause réelle avis négatifs : usage ou défaut produit ?
5. **NO GO potentiel** → `ALERTES_FRED` si problème bloquant
6. **Positionnement retenu** — angle marketing, mot-clé prioritaire, profil cible

### Règles de rédaction imposées dans le prompt
- JAMAIS inventer une spec, matière, dimension non confirmée
- JAMAIS sur-promettre — adapter au niveau réel (`niveau`)
- Vocabulaire acheteur (usages réels) > vocabulaire fabricant (specs)
- "garantie à vie" : INTERDIT titre/bullets — autorisé description uniquement si documenté
- "professionnel" : INTERDIT si non prouvé
- "meilleur", "n°1", "incassable", "compatible tous modèles" : INTERDITS

### Structure titre imposée
```
[Marque] [Référence] [Mot-clé position 3] [Matière/Format] [Nom technique] [Usage] [Contexte]
```
- 200 chars maximum — plafond pas cible
- Référence interne obligatoire après la marque
- Mot-clé principal en POSITION 3 (Amazon pondère les premiers mots)
- Séparateurs : tirets `-` uniquement (jamais `|` `/` `!` `?`)

### Structure bullets imposée
- Exactement 5 bullets
- B1 : "C'est quoi et à quoi ça sert ?"
- B2 : "Pour quel usage / surface / compatibilité ?"
- B3 : "Est-ce compatible avec mon besoin ?" — données chiffrées
- B4 : "Dans quels cas je vais l'utiliser ?"
- B5 : **ANTI-DÉCEPTION OBLIGATOIRE** — "Quelles limites ou précautions ?"
- Une icône par bullet, en PREMIER
- 200-250 caractères recommandés par bullet

### Backend keywords — règles imposées
- **249 bytes maximum** (safe : viser 240-245)
- Les accents français comptent 2 bytes (é, è, à, ü...)
- Dépassement → Amazon désindexe TOUT le champ sans warning
- Structure 4 blocs : usages → contextes → synonymes → longue traîne
- Séparateur : espace uniquement (jamais de virgule)
- INTERDIT : stop words (de, le, la, pour, avec), noms de marques concurrentes, superlatifs
- Maximum ~35 mots
- INTERDIT : "pas cher", "discount", "budget", "économique"

### Champs de sortie attendus du modèle
```
NOM_TYPE_PRODUIT:
TITRE:
BULLET_1: à BULLET_5:
DESCRIPTION:
BACKEND_KEYWORDS:
POSITIONNEMENT_AMAZON:
LEVIERS_RANKING:
ERREURS_A_EVITER:
OPPORTUNITE_SEO:
POINT_IMPORTANT:
ALERTES_FRED:
```

---

## 4. PARSING — parseSEOResponse

### Fonction
```javascript
function parseSEOResponse(text, lang)
```

### Champs parsés
```javascript
const result = {
  titre: '',
  bullets: ['','','','',''],
  description: '',
  nomType: '',
  backendKW: '',
  positionnement: '',
  leviers: '',
  erreurs: '',
  opportunite: '',
  pointImportant: '',   // ajouté v3.4.25
  alertesFred: '',      // ajouté v3.4.25
  images: [],
  generatedAt: ''
};
```

### Stockage
```javascript
seoResults[asin][market] = parsed;        // mémoire session
c.ficheOptimisee[asin][market] = parsed;  // persisté IndexedDB via saveClient()
```

### Affichage dans la vue détail ASIN
- `alertesFred` → bloc ⚠️ EN HAUT du drawer (avant le titre)
- `pointImportant` → bloc 🔥 APRÈS la synthèse stratégique

---

## 5. CHALLENGE GPT — COMPARAISON & ARBITRAGE

### Étape D — Saisie GPT
- Textarea `ficheGPT` — texte brut libre depuis ChatGPT
- Sauvegardé dans `a.ficheGPT` via `saveFicheGPT(asin, val)`

### Étape E — Comparaison
- Appel `runChallengeGPT(asin, market)` → prompt comparatif
- Retourne verdicts champ par champ + fiche fusionnée + autocritique + scores

### Format de réponse attendu du modèle
```
VERDICT_TITRE: [Claude|GPT|Égalité] — [raison]
FUSION_TITRE: [meilleure version]
VERDICT_B1: ... FUSION_B1: ...
[...B2 à B5...]
VERDICT_DESC: ... FUSION_DESC: ...
VERDICT_BACKEND: ... FUSION_BACKEND: ...
AUTOCRITIQUE_CLAUDE: [2-3 points concrets]
SCORE_CLAUDE: [X/10]
SCORE_GPT: [X/10]
```

### Parsing — parseChallengeResponse
**CRITIQUE** — parsing ligne par ligne (pas regex multi-ligne) :
```javascript
const match = line.match(/^([A-Z_0-9]+):\s*(.*)/);
// Regex avec [A-Z_0-9]+ — les chiffres sont OBLIGATOIRES pour matcher VERDICT_B1
```
Bug historique : `[A-Z_]+` sans chiffres ne matchait pas `VERDICT_B1` → débordement de texte dans les champs. Corrigé en v3.4.36.

### Affichage étape E
- Tableau champ par champ : 🔵 Claude / 🟢 GPT / ⚪ Égalité + raison
- Scores Claude X/10 · GPT X/10
- Autocritique Claude
- Synthèse stratégique (positionnement, leviers, erreurs, opportunité, point clé)
- Bloc GO/NO GO basé sur `seoR.alertesFred`

### Fiche fusionnée (étape F)
- Textareas pré-remplis : `ch.fusionTitre`, `ch.fusionB1`...`ch.fusionB5`, `ch.fusionDesc`, `ch.fusionBackend`
- Fallback sur `seoR.bullets[i]` si `fusionBN` vide
- Fonction `updateWizardField` met à jour en temps réel dans `ficheChallenge`

### Stockage
```javascript
a.ficheChallenge[market] = {
  verdictTitre, fusionTitre,
  verdictB1...B5, fusionB1...B5,
  verdictDesc, fusionDesc,
  verdictBackend, fusionBackend,
  autocritique, scoreClaude, scoreGPT,
  titreFusion, bulletsFusion[]
}
```

### Export référence SEO
Bouton "💾 Sauvegarder référence SEO" → télécharge un fichier MD avec :
- ASIN, date, titre retenu, bullets retenus, verdict, autocritique

---

## 6. AGENT VENDOR CENTRAL — buildVCModifyPrompt

### Signature
```javascript
function buildVCModifyPrompt(asin, market, fiche, c, sku, vc)
```

### Lecture des données (priorité)
```javascript
// 1. seoResults[asin][mkt]  → prioritaire (session mémoire)
// 2. c.ficheOptimisee[asin][mkt] → fallback (IndexedDB après reload)
// 3. {} → vide si rien
var ficheData = (typeof seoResults !== 'undefined' && seoResults[asin] && seoResults[asin][mkt])
  ? seoResults[asin][mkt]
  : (c?.ficheOptimisee?.[asin]?.[mkt] || {});
```

### Structure du script généré (3 étapes)

#### ÉTAPE 1 — Recherche catalogue
```
Navigue vers vendorcentral.amazon.fr/vendor/members/products/catalog
Sélecteur exact champ recherche : kat-textarea.SearchBox-module__textArea--eo-Yh
Bouton recherche : .SearchBox-module__searchButton--5iHxx kat-icon
Attendre stabilisation compteur "X - X sur X résultats"
Lire TOUS les résultats → vendorEntries = [{vendorCode, sku}, ...]
- 0 résultat → STOP "ASIN introuvable"
- > 2 résultats → alerte "risque vieux listings" + GO attendu
- ≥ 1 résultat → enchaîner ÉTAPE 2 pour CHAQUE entry
```

#### ÉTAPE 2 — Pour chaque vendor code
```
URL d'édition :
https://vendorcentral.amazon.fr/abis/listing/edit/product_details
  ?sku=[SKU_LU]&asin=[ASIN]&vendorCode=[VC_LU]#product_details

Attendre : kat-textarea[name='item_name-0-value'] dans le DOM
```

**Remplissage des champs — fillAndBlur :**
```javascript
function fillAndBlur(name, value) {
  var el = document.querySelector("kat-textarea[name='" + name + "'], kat-input[name='" + name + "']");
  var inner = el.shadowRoot.querySelector('textarea') || el.shadowRoot.querySelector('input');
  inner.focus(); inner.click();
  document.execCommand('selectAll');
  document.execCommand('delete');
  document.execCommand('insertText', false, value);
  inner.blur();
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}
```

**Champs remplis :**
| Champ | Sélecteur |
|---|---|
| Titre | `item_name-0-value` |
| Bullet 1-5 | `bullet_point-0-value` à `bullet_point-4-value` |
| Description | `rtip_product_description-0-value` |
| Backend KW | `generic_keyword-0-value` |

**Backend KW — nettoyage avant injection :**
```javascript
var backendKW = ficheData.backendKW
  .replace(/\*\*/g, '')
  .replace(/,/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .substring(0, 249);
```

**clickAddMore — ajouter des slots bullets :**
```javascript
// Via kat-link dans .attributeGroup contenant bullet_point
var bulletGroup = null;
document.querySelectorAll('.attributeGroup').forEach(g => {
  if (g.querySelector("kat-textarea[name*='bullet_point']")) bulletGroup = g;
});
var anchor = bulletGroup?.querySelector('kat-link')?.shadowRoot?.querySelector('a');
if (anchor) anchor.click();
```

**deleteSurplusBullets — supprimer bullets vides :**
```javascript
// Loop max 15 tentatives — tolérance 1 vide résiduel
// Sélecteur "Supprimer le dernier" via kat-link shadowRoot
var katLinks = document.querySelectorAll('kat-link');
katLinks.forEach(kl => {
  if (kl.shadowRoot?.textContent?.includes('Supprimer le dernier')) deleteKL = kl;
});
var anchor = deleteKL.shadowRoot.querySelector('a');
anchor.click();
```

**fillRemainingEmpties — remplir vides résiduels avec bullet[4] :**
```javascript
// Si 1 vide résiduel ne peut pas être supprimé → le remplir avec le contenu du bullet 5
var remainingBullets = document.querySelectorAll("kat-textarea[name^='bullet_point']");
// → remplir avec bullets[4] via execCommand insertText
```

**Champ Emballage — obligatoire si vide :**
```javascript
// Sélecteur EXACT validé en production :
var embEl = document.querySelector("kat-dropdown[name='package_level-0-value']");
// Ouvrir via .select-header dans shadowRoot
// Sélectionner "Unité" (value='unit') dans les options shadowRoot
// Radio commandable :
var trueRadio = document.querySelector(
  "kat-radiobutton[name='is_trade_item_orderable_unit-0-value'][value='true']"
);
trueRadio.click();
```

**Sauvegarde — double clic requis :**
```javascript
// Clic 1 : validation (scroll + click)
document.getElementById('EditSaveAction').click();
await sleep(5000);
// Clic 2 : soumission effective
document.getElementById('EditSaveAction').click();
```

**Détection SUCCESS — XHR + fetch :**
```javascript
// XHR interceptor (existant)
XMLHttpRequest.prototype.open / send → surveille abis/ajax/edit

// Fetch interceptor (ajouté v3.4.41)
window.fetch = function(url, opts) {
  return origFetch.apply(this, arguments).then(resp => {
    if (url.includes('abis/ajax/edit')) {
      resp.clone().json().then(data => {
        if (data.status === 'SUCCESS') {
          window._lastXHRResponse = { status: 200, response: JSON.stringify(data) };
        }
      });
    }
    return resp;
  });
};
```

#### ÉTAPE 3 — Bilan
```
Pour chaque vendorEntry traité :
  ✅ SUCCESS — [VC] (SKU: [sku]) → submissionSku: [sku]
  ❌ ÉCHEC  — [VC] (SKU: [sku]) — [raison]
```

### URLs Vendor Central par marketplace
| Marché | URL de base |
|---|---|
| France | `vendorcentral.amazon.fr` |
| Espagne | `vendorcentral.amazon.es` |
| Allemagne | `vendorcentral.amazon.de` |
| Italie | `vendorcentral.amazon.it` |
| Pays-Bas | `vendorcentral.amazon.nl` |
| Belgique | `vendorcentral.amazon.com.be` |

### Règles de sécurité agent VC
- Jamais de soumission automatique sans validation Fred
- Confirmation explicite avant toute modification
- Si > 2 vendor codes → alerte + GO explicite attendu
- En cas d'erreur page → signale "intervention manuelle nécessaire" → passe au suivant

---

## 7. RÈGLES SEO AMAZON — RÉFÉRENTIEL

### Titre
- 200 chars max (mobile tronque à ~115)
- Mot-clé principal dans les 30 premiers caractères
- Structure : `Marque Référence - Mot-clé - Attribut - Usage`
- Séparateurs : tiret `-` uniquement
- Interdits : `|` `/` `!` `?` `*` `$` prix, promos, superlatifs
- Même mot : max 2 occurrences (hors articles/prépositions)

### Bullets
- 5 maximum (Vendor Central)
- 200-250 chars recommandés
- 1 icône par bullet en PREMIER
- B5 toujours anti-déception
- "garantie à vie" interdit titre/bullets
- Pas de HTML

### Backend Keywords
- **249 bytes max** (safe : 240-245)
- Accents = 2 bytes (é, è, à, ü, ö...)
- Dépassement → désindexation totale sans warning
- Pas de virgules — espaces uniquement
- Pas de répétitions avec le titre
- Pas de marques concurrentes
- Structure : usages → contextes → synonymes → longue traîne

### Leviers de ranking A10 (par ordre de poids)
1. Taux de conversion ⭐⭐⭐⭐⭐
2. Vélocité des ventes ⭐⭐⭐⭐⭐
3. Pertinence sémantique titre + bullets ⭐⭐⭐⭐
4. Avis clients (volume + fraîcheur) ⭐⭐⭐⭐
5. CTR depuis la SERP ⭐⭐⭐⭐
6. Disponibilité stock ⭐⭐⭐
7. Prix compétitif ⭐⭐⭐
8. Backend keywords ⭐⭐

### NO GO — conditions d'arrêt
- Note < 3,5★ avec > 50 avis → fiche seule insuffisante
- Défaut produit structurel documenté dans les avis
- Prix positionne contre des concurrents mieux notés sur la même SERP
- Rupture de stock signalée
- Spec fausse dans la fiche actuelle

---

## 8. STOCKAGE DES DONNÉES

### Architecture — règle ABSOLUE
```
c.asins[i].revenue, .glanceViews, ...  → données Vendor — JAMAIS modifiées par le SEO
c.asins[i].ficheOptimisee[market]      → fiche SEO sauvegardée — seul endroit écrit
c.asins[i].ficheAmazon                 → fiche Amazon collée par Fred
c.asins[i].ficheGPT                    → sortie GPT collée par Fred
c.asins[i].ficheChallenge[market]      → résultat comparaison
seoResults[asin][market]               → variable mémoire session UNIQUEMENT
```

### saveClient défensif — OBLIGATOIRE avant tout appel
```javascript
if (!c || !c.asins || c.asins.length === 0) {
  console.error('[ABORT] saveClient — asins vide'); return;
}
```

### Copie profonde — OBLIGATOIRE pour ficheOptimisee
```javascript
// JAMAIS de référence directe
c.ficheOptimisee[asin][mkt] = JSON.parse(JSON.stringify(fiche));
```

### Modèle ficheOptimisee
```javascript
{
  titre: '',
  bullets: ['','','','',''],
  description: '',
  backendKW: '',
  nomType: '',
  positionnement: '',
  leviers: '',
  erreurs: '',
  opportunite: '',
  pointImportant: '',
  alertesFred: '',
  generatedAt: '2026-05-11T...',
}
```

### Modèle ficheChallenge
```javascript
{
  verdictTitre, fusionTitre,
  verdictB1, fusionB1, verdictB2, fusionB2,
  verdictB3, fusionB3, verdictB4, fusionB4,
  verdictB5, fusionB5,
  verdictDesc, fusionDesc,
  verdictBackend, fusionBackend,
  autocritique, scoreClaude, scoreGPT,
  titreFusion,
  bulletsFusion: ['','','','',''],
  verdict: 'Titre: ...\nB1: ...',
}
```

---

## 9. FONCTIONS CLÉS — LOCALISATION DANS LE CODE

| Fonction | Fichier | Rôle |
|---|---|---|
| `buildSEOPrompt(a,c,lang,isBackendKW)` | `src/seo.js` L.1 | Construit le prompt SEO v2 |
| `parseSEOResponse(text,lang)` | `src/seo.js` | Parse la réponse SEO du modèle |
| `buildVCModifyPrompt(asin,mkt,fiche,c,sku,vc)` | `src/seo.js` L.72 | Génère le script agent VC |
| `renderOptimisationWizard()` | `src/seo.js` | Render les 8 étapes du wizard |
| `renderWizardStep(id,letter,title,done,active,content,summary)` | `src/seo.js` | Helper accordéon |
| `renderFicheEditable(asin,mkt,src,ch)` | `src/seo.js` | Fiche fusionnée éditable |
| `renderChallengeGPT(asin,market,a)` | `src/seo.js` | Comparaison + verdicts |
| `parseChallengeResponse(text)` | `src/core.js` | Parse les verdicts GPT ligne par ligne |
| `runChallengeGPT(asin,market)` | `src/core.js` | Appel API comparaison |
| `runSEOFiche(asin,market,sku)` | `src/core.js` | Lance la génération SEO |
| `wizardState` | `src/core.js` | State isolé wizard optimisation |
| `resetWizard()` | `src/core.js` | Reset complet wizardState |
| `openWizard(asin,market,isRegen)` | `src/core.js` | Ouvre le wizard |
| `closeWizard()` | `src/core.js` | Ferme + retour vue détail ASIN |
| `toggleWizardStep(id)` | `src/core.js` | Plie/déplie une étape |
| `wizardNextStep(step)` | `src/core.js` | Passe à l'étape suivante |
| `wizardRunSEO()` | `src/core.js` | Lance runSEOFiche depuis wizard |
| `wizardRunChallenge()` | `src/core.js` | Lance runChallengeGPT depuis wizard |
| `wizardSave(asin,mkt)` | `src/core.js` | Sauvegarde fiche dans ficheOptimisee |
| `wizardSaveAndPublish(asin,mkt)` | `src/core.js` | Save + lance agent VC |
| `updateWizardField(asin,mkt,field,val)` | `src/core.js` | Mise à jour champ fiche fusionnée |
| `saveFicheAmazon(asin,val)` | `src/core.js` | Persist ficheAmazon |
| `saveFicheGPT(asin,val)` | `src/core.js` | Persist ficheGPT |
| `saveFicheChallenge(asin,val)` | `src/core.js` | Persist ficheChallenge |
| `clearAllFicheChallenge()` | `src/core.js` | Purge données corrompues IndexedDB |
| `publishVC(asin,market)` | `src/core.js` | Lance agent VC depuis vue détail |
| `exportExemplesGPT(asin,market)` | `src/core.js` | Export MD référence SEO |
| `copyFicheFusion(asin,market)` | `src/core.js` | Copie fiche fusionnée clipboard |

---

## 10. RÈGLES INVARIANTES

### Règle n°1 — Fred valide, Claude Code exécute
Fred n'est pas développeur. Il valide les plans et donne les GO. Claude Code exécute.

### Règle architecture — isolation wizardState
`wizardState` exclusivement pour le wizard optimisation.
`avcState` exclusivement pour le wizard Agent SEO + VC existant.
Jamais d'interférence entre les deux.

### Règle données — protection des ASINs
Jamais modifier `c.asins[i]` en dehors de `ficheOptimisee`, `ficheAmazon`, `ficheGPT`, `ficheChallenge`.
Toujours vérifier `c.asins.length > 0` avant `saveClient`.
Toujours utiliser `JSON.parse(JSON.stringify())` pour les copies dans `ficheOptimisee`.

### Règle SEO — jamais inventer
Si une spec, matière, dimension n'est pas dans les données fournies → ne pas l'écrire.
Règle absolue intégrée dans `buildSEOPrompt`.

### Règle parsing — chiffres dans la regex
`parseChallengeResponse` utilise `[A-Z_0-9]+` (avec chiffres).
Sans les chiffres, `VERDICT_B1` ne matche pas → débordement de texte dans les champs.

### Règle forEach + await
Les callbacks `forEach` sont synchrones. Jamais utiliser `await` à l'intérieur.
Utiliser une boucle `for` indexée ou `for...of`.

### Règle anti-régression
- `node --check` obligatoire avant tout push
- Smoke test sur preprod avant tout merge main
- Vérifier `clients[0].asins.length` intact après chaque test impliquant `saveClient`
- Max 2 patches correctifs consécutifs — puis revert + nouvelle conception

### Règle déploiement
```
staging → CI recette → validation Fred → preprod → Claude Code testing → merge main → prod
Jamais de commit direct sur main
```

---

**FIN DU DOCUMENT — v3.4.41 — 11 mai 2026**
**Prochaine mise à jour : après sessions comparatives Claude vs ChatGPT et fix scroll étape C**
