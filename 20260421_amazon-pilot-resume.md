# Amazon Pilot — Reprise de session
**Date : 21 avril 2026**
**Fichier : `amazon-pilot-latest.html` — 7 415 lignes — 384 KB**

---

## Déploiement AWS

```powershell
aws s3 cp C:\AmazonPilot\amazon-pilot-latest.html s3://amazon-pilot-foliow/index.html
aws cloudfront create-invalidation --distribution-id E3ERL241475BJI --paths "/*"
```

**URL prod : https://amazon.foliow.app**

---

## Infrastructure AWS

| Composant | Détail |
|-----------|--------|
| S3 app | `amazon-pilot-foliow` — eu-west-3 |
| CloudFront | `E3ERL241475BJI` |
| S3 imports | `amazon-pilot-imports-foliow` — lifecycle 7j |
| Lambda | `amazon-pilot-imports` — Node.js 22.x |
| Function URL | `https://2rclwsmhposm33vds7yli2uuti0hkwzt.lambda-url.eu-west-3.on.aws` |

---

## 🔴 BUG PRIORITAIRE — Poll S3 cause SyntaxError

### Symptôme
```
Uncaught SyntaxError: Unexpected end of input
at https://amazon.foliow.app/:1:13
```
Apparaît au chargement de la page, après "Amazon Pilot v3.1 initialisé".

### Diagnostic effectué
- ✅ Syntaxe JS valide (node --check OK)
- ✅ localStorage sain (6 clés propres)
- ✅ CDN chargés correctement (PapaParse, Chart.js, xlsx)
- ✅ render() sans erreur
- ✅ Extension Claude in Chrome désactivée → erreur persiste
- ✅ **stopS3Poll() → erreur disparaît**
- ✅ **startS3Poll() → erreur réapparaît après ~10s**

### Cause identifiée
Le poll S3 (`pollS3Imports`) fait `fetch(apiUrl + '/list?prefix=cogex/')` toutes les 10s.
La Lambda répond parfois avec du contenu non-JSON (HTML d'erreur, timeout, CORS).
Le code fait `resp.ok` check mais pas de try/catch autour du `.json()` parsing.

### Fix à appliquer
Dans `pollS3Imports()` — wrapper le `.json()` dans un try/catch :

```javascript
// AVANT (ligne ~4462)
const { files } = await resp.json();

// APRÈS
let parsed;
try {
  parsed = await resp.json();
} catch(jsonErr) {
  console.warn('[AP] pollS3 JSON parse error:', jsonErr.message);
  return;
}
const { files } = parsed || {};
```

Aussi vérifier que la Lambda retourne bien `Content-Type: application/json`
et que les erreurs CORS ne causent pas de réponses HTML.

---

## Travaux du 21 avril

### Corrections livrées
| Fix | Détail |
|-----|--------|
| Logique fraîcheur semaine ISO | `targetWeek = currentWeek - 1` toujours, basé sur `periodEnd` du filename |
| Plan d'action régénéré après import | `generateWeeklyActions()` dans `mergeImportData()` |
| Bannière affiche S-1 | Titre et labels utilisent `targetWeek` |
| Vues prédéfinies ASINs | 7 boutons filtrés : Tous, Ruptures, Baisses, Croissance, A, B, C |
| Export ciblé par vue | `exportViewXlsx()` avec colonnes adaptées + Raison alerte |
| Navigation ← → supprimée | `pushState` retiré (causait des erreurs) |
| SEO prompt v2 | 4 étapes : Analyse stratégique, Positionnement, Fiche, Synthèse |
| SEO parser ligne par ligne | `extractField()` remplace les regex multilignes |
| SEO UI enrichie | NOM_TYPE_PRODUIT, compteur titre, Backend KW, Synthèse stratégique |
| SEO injection post-render | Section SEO injectée via DOM séparé (évite conflits innerHTML) |
| Global error handler | `addEventListener('error')` pour capturer les erreurs avec stack |
| Charts try/catch | `initChart`, `initSegChart`, `initHistoryChart` wrappés |

### Fonctionnalités actives
- **Poll S3** : actif sur Cogex, vérifie toutes les 10s `cogex/` dans le bucket imports
- **Upload PowerShell** : script dans `C:\AmazonPilot\` pour uploader vers S3 après téléchargement VC
- **Vues prédéfinies** : clic sur alerte Dashboard → tableau filtré + export ciblé

---

## Modèle de données client

```javascript
{
  imports: [{ type, periodStart, periodEnd, periodType, filename, ... }],
  asins: [], history: { weekly: [], monthly: [], yearly: [] },
  annualData: {}, ytdData: {}, catalogue: [], pos: [],
  ppmData: {}, forecastData: {}, ficheOptimisee: {}, weeklyActions: [],
  awayUntil: null
}
```

---

## Clients

| Client | Marchés | S3 prefix |
|--------|---------|-----------|
| Cogex Outillage | FR | `cogex/` |
| Gers Équipement | FR+ES+NL+DE+BE+IT | `gers/` |

---

## Backlog priorisé

| # | Sujet | Priorité |
|---|-------|----------|
| 0 | **FIX : Poll S3 → SyntaxError** | 🔴 URGENT |
| 1 | Agent SEO : tester sur B08TWY9RGH depuis amazon.foliow.app | 🔴 |
| 2 | Agent SEO : modifier fiches VC via Chrome | 🔴 |
| 3 | Ajuster les prévisions (calcAppro + 48 sem.) | 🔴 |
| 4 | Navigation ← → navigateur (hash router propre) | 🟡 |
| 5 | Agent : sous-comptes Gers (FR/ES entités séparées) | 🟡 |
| 6 | CloudFront /api/* → Lambda (URL propre) | 🟡 |
| 7 | Backend DynamoDB + Cognito Auth | Long terme |

---

## Règles de session

1. **Règle n°1** : Fred valide et donne les instructions. Claude exécute les tâches techniques
2. **Claude Code** dès que hors HTML/JS (AWS, système, fichiers)
3. Toujours valider syntaxe JS avant livraison
4. `present_files` après chaque livraison

---

## Prompt de reprise

```
Bonjour ! Reprends le projet Amazon Pilot.
Fichier : amazon-pilot-latest.html (outputs) + résumé 2026-04-21.
PRIORITÉ IMMÉDIATE : corriger le bug poll S3 → SyntaxError JSON.parse.
Le bug est localisé : pollS3Imports() → resp.json() plante quand la Lambda
retourne du HTML au lieu de JSON. Fix = try/catch autour du .json().
Commence par lire le HTML, valider syntaxe, appliquer le fix.
Utilise Claude Code pour les tâches AWS.
```
