# Amazon Pilot — Déploiement Lambda S3 Imports

## Architecture

```
amazon.foliow.app        → S3 + CloudFront (existant)
[Lambda Function URL]    → Lambda + S3 imports (nouveau)
```

## Prérequis

- AWS CLI configuré avec profil `amazon-pilot-deploy`
- Node.js installé sur le poste
- PowerShell

## Instructions étape par étape

### 1. Préparer les fichiers

```powershell
# Créer le dossier source Lambda
New-Item -ItemType Directory -Path C:\AmazonPilot\lambda-src -Force

# Copier le code Lambda (index.mjs téléchargé)
Copy-Item "[chemin]\index.mjs" C:\AmazonPilot\lambda-src\index.mjs
```

### 2. Exécuter le script de déploiement

```powershell
cd C:\AmazonPilot
.\deploy.ps1
```

Le script crée automatiquement :
- Bucket S3 `amazon-pilot-imports-foliow` (lifecycle 7 jours)
- Rôle IAM `amazon-pilot-lambda-role` avec accès S3
- Lambda `amazon-pilot-imports` (Node.js 22.x)
- Function URL publique avec CORS amazon.foliow.app

### 3. Configurer Amazon Pilot

Après le déploiement, copier la **Function URL** affichée et la coller dans :

`Amazon Pilot → Agent Import → Import automatique → URL API Lambda`

### 4. Routes disponibles

| Route | Méthode | Paramètres | Description |
|-------|---------|-----------|-------------|
| /list | GET | `?prefix=cogex/` | Lister les fichiers |
| /download | GET | `?key=cogex/file.csv` | Télécharger un fichier |
| /presign | POST | `{key: "cogex/file.csv"}` | URL pré-signée PUT |
| /presign-batch | POST | `{prefix: "cogex", count: 3}` | N URLs pré-signées |

### 5. Structure S3

```
amazon-pilot-imports-foliow/
├── cogex/
│   ├── Ventes_ASIN_..._S16.csv
│   ├── Trafic_ASIN_..._S16.csv
│   └── Stock_ASIN_..._S16.csv
└── gers/
    ├── Ventes_ASIN_..._FR_S16.csv
    └── Ventes_ASIN_..._ES_S16.csv
```

Les fichiers sont automatiquement supprimés après 7 jours (lifecycle S3).

### 6. Upload depuis Claude in Chrome

Dans le script agent, après chaque téléchargement, Claude in Chrome peut uploader via :

```javascript
// Dans la console Chrome (F12)
const file = // fichier téléchargé
const presignResp = await fetch('https://[FUNCTION_URL]/presign', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({key: 'cogex/' + file.name})
});
const {url} = await presignResp.json();
await fetch(url, {method: 'PUT', body: file});
console.log('✅ Uploadé !');
```

### 7. Coût estimé

- Lambda : < 0,01€/mois (1M requêtes gratuites/mois)
- S3 imports : < 0,01€/mois (fichiers < 500 KB, lifecycle 7j)
- **Total : quasi gratuit**
