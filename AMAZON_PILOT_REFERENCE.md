# Amazon Pilot — Document de Référence Produit
**Version :** 1.0 — 30 avril 2026
**Statut :** Référence figée — mise à jour à chaque session majeure

---

## 1. Vision & Positionnement

### Problème résolu
Les responsables e-commerce de marques vendant sur Amazon Vendor Central (1P) perdent un temps considérable sur des tâches répétitives et des données dispersées : gestion des réapprovisionnements, pilotage de la Buy Box, optimisation SEO des fiches, analyse des ASINs. Les outils existants sont soit trop chers (>350€/mois), soit orientés 3P (Sellers), soit non adaptés au marché FR.

### Solution
Amazon Pilot est un outil SaaS de pilotage Vendor Central qui automatise les tâches à forte valeur ajoutée : réappros IA, Buy Box 4 phases, Agent SEO, analyse SWOT ASINs. Spécialisé 1P, en français, accessible dès 79€/mois.

### Marché cible
- **Segment A** (2-3 clients) : Fred Rochette en tant que consultant — clients gérés en direct, financent le développement
- **Segment B** (SaaS autonome) : Responsables e-commerce de marques Amazon FR, PMEs avec catalogue 500-5000 ASINs, qui gèrent leur compte Vendor sans consultant

### Positionnement prix
- Blue ocean FR : pas d'outil Vendor spécialisé sous 350€/mois
- ROI immédiat : 1 rupture évitée = 1 mois d'abonnement remboursé
- Concurrent indirect : DataHawk (350-900$/mois), Helium 10 (39-249$/mois, orienté 3P)

---

## 2. Modèle de Monétisation

### Plans abonnement

| Plan | Prix | Modules | ASINs | Marchés | IA tokens/mois |
|------|------|---------|-------|---------|----------------|
| **Free** | 0€ | Dashboard + Revue Hebdo (lecture) + Buy Box alertes | 500 | FR | 50 000 output |
| **Starter** | 79€/mois | Free + Appros complet + Buy Box plan d'action + Imports illimités | 2 000 | FR | 500 000 output |
| **Pro** | 149€/mois | Starter + SEO + SWOT ASINs + Gestion tarifs + Multi-marchés | Illimité | FR+ES+DE+IT+NL+BE | 2 000 000 output |

### Add-ons Pay as You Go
| Add-on | Prix |
|--------|------|
| Analyse IA à la demande | 2€/analyse |
| Rapport mensuel PDF | 5€/rapport |
| Marché supplémentaire (hors Pro) | 29€/mois |
| Utilisateur supplémentaire | 19€/mois |

### Clients directs (Segment A)
Plan sur mesure non public — Fred gère les imports, accès total, facturation hors abonnement.

### Coût IA (base Sonnet 4 — avril 2026)
| Tarif Anthropic | Valeur |
|-----------------|--------|
| Input | $3 / 1M tokens |
| Output | $15 / 1M tokens |
| Coût moyen Buy Box analyse | ~0,01€ |
| Coût moyen fiche SEO | ~0,02€ |
| Coût moyen SWOT ASIN | ~0,025€ |

**Marge IA par plan :**
- Free : coût max ~0,75€/mois → accepté (coût d'acquisition)
- Starter 79€ : coût max ~7,50€ → marge 90%
- Pro 149€ : coût max ~30€ → marge 80%

---

## 3. Architecture Technique

### Infrastructure AWS (eu-west-3)

```
┌─────────────────────────────────────────────────────────┐
│  FRED (admin)                                           │
│  amazon.foliow.app  ←→  S3 + CloudFront E3ERL241475BJI │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  API LAMBDA  amazon-pilot-api-prod                      │
│  URL: konuaxmdxjnzcuw2etjqwczrla0xycvt.lambda-url...   │
│                                                         │
│  Routes :                                               │
│  GET  /health                                           │
│  GET  /me                    ← profil + droits JWT      │
│  GET/PUT /client/{id}/data/{sk}                         │
│  GET/PUT /client/{id}/seo/{asin}                        │
│  GET/PUT /client/{id}/config                            │
│  POST /ai/complete           ← proxy IA + comptabilité  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  DynamoDB (eu-west-3)                                   │
│  ap-clients-prod   ← métadonnées clients                │
│  ap-data-prod      ← toutes les données (SK flexible)   │
│  ap-users-prod     ← users + droits modules             │
│  ap-usage-prod     ← comptabilité tokens IA (à créer)   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Cognito  eu-west-3_8P9UzCONx                          │
│  App Client: 5nnllolhnc3572800bvce94682                 │
│  Auth: ID Token (custom:role, custom:modules)           │
│  Groupes: admin (Fred) / clients                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  CLIENTS (Segment B)                                    │
│  amazon.foliow.app/client  ← même CloudFront            │
│  Auth: Cognito JWT                                      │
│  Modules selon plan: appros / buybox / seo / swot       │
└─────────────────────────────────────────────────────────┘
```

### URLs (règle stricte — ne pas utiliser pilot.foliow.app)
| Usage | URL |
|-------|-----|
| App admin (Fred) | `amazon.foliow.app` |
| App client (Segment B) | `amazon.foliow.app/client` |
| API Lambda | `api.amazon.foliow.app` *(à configurer)* |
| Cognito callback | `amazon.foliow.app/auth/callback` |

**Séparation Foliow / Amazon Pilot :**
- `foliow-proxy.azurewebsites.net` → projet **Foliow** (decision engine investissement, Azure, Flask)
- `amazon.foliow.app` → projet **Amazon Pilot** (AWS, Lambda, DynamoDB)
- Ces deux projets sont **totalement indépendants** — ne jamais mélanger les ressources

### Stack technique
| Composant | Tech | Détail |
|-----------|------|--------|
| Frontend | HTML/JS mono-fichier | Build modulaire `src/` + `build.py` |
| Stockage local | IndexedDB + localStorage | Cache client |
| Backend | AWS Lambda Node.js 22.x | `amazon-pilot-api-prod` |
| Base de données | DynamoDB | 4 tables (clients/data/users/usage) |
| Auth | Cognito + JWT ID Token | User Pool `eu-west-3_8P9UzCONx` |
| IA | Anthropic Claude Sonnet 4 | Via proxy Lambda (pas direct depuis browser) |
| CI/CD | GitHub Actions | Push `main` → prod, `staging` → recette |

### Tables DynamoDB — Spec complète

**ap-clients-prod**
```
PK: clientId    SK: "meta"
Attributs: name, markets, constraints, plan, updatedAt
```

**ap-data-prod**
```
PK: clientId    SK: dataType#period    TTL: attribut "ttl"
```
| SK | Contenu | Expiration côté app |
|----|---------|---------------------|
| `weekly#YYYY-Wnn` | ASINs ventes+trafic+stock | 2 ans DynamoDB |
| `weekly#latest` | Alias dernière semaine | — |
| `annual#2024` | Stats annuelles 2024 | 31/12/2026 |
| `annual#2025` | Stats annuelles 2025 | 31/12/2027 |
| `annual#ytd` | YTD en cours | — |
| `po#latest` | Import PO complet | — |
| `forecasts#latest` | Prévisions 48 semaines | — |
| `ppm#latest` | PPM nette | — |
| `appros#params` | Lead time, MOQ, stock cible | — |
| `seo#{asin}` | Fiche SEO par ASIN | — |
| `seo#actions#{asin}` | Historique soumissions | — |
| `buybox#cases` | Dossiers Buy Box | — |
| `config#client` | Marchés, contraintes | — |
| `config#modules` | Droits par module | — |

**ap-users-prod**
```
PK: userId (email)    SK: "profile"
GSI: clientId-index
Attributs: clientId, role (admin|client), modules, cognitoSub
```

**ap-usage-prod** *(à créer)*
```
PK: clientId    SK: YYYY-MM
Attributs: tokens_input, tokens_output, cost_eur, calls,
by_feature: { buybox, seo, appros, swot }
```

---

## 4. App — Modules & État

### Version prod
`v3.1.66` — `amazon.foliow.app`

### Structure build modulaire
```
src/
  shell.html      4 Ko   HTML shell
  styles.css     25 Ko   CSS global
  core.js       419 Ko   Code principal + placeholders @xxx
  buybox.js      44 Ko   Module Buy Box
  seo.js         42 Ko   Module Agent SEO
  smoke.js       11 Ko   Smoke test
  guide_asn.js   20 Ko   PDF Guide ASN/BOL (base64)
build.py                 python3 build.py --version X.Y.Z
```

### Modules — État actuel

| Module | État | Segment A | Segment B |
|--------|------|-----------|-----------|
| Dashboard + Revue Hebdo | ✅ Prod | ✅ | Free |
| Import CSV Vendor Central | ✅ Prod | ✅ | Starter |
| Import PO (CSV/XLS) | ✅ Prod | ✅ | Starter |
| Import ERP Cogex (Format A + B) | ✅ Prod | ✅ | Starter |
| Appros (calcul + export) | ✅ Prod | ✅ | Starter |
| Buy Box 4 phases + IA | ✅ Prod | ✅ | Starter/Pro |
| Guide ASN/BOL embarqué | ✅ Prod | ✅ | Starter |
| Agent SEO | 🔄 Partiel | En cours | Pro |
| Analyse SWOT ASINs | 📋 Spécifié | À coder | Pro |
| Gestion tarifs | 📋 Spécifié | À coder | Pro |
| Interface client `/client` | 📋 Spécifié | — | Starter/Pro |
| Proxy IA Lambda | 📋 Spécifié | — | Tous plans |
| Compteur tokens IA | 📋 Spécifié | — | Tous plans |

### Clients actuels
| Client | Marchés | Préfixe | État |
|--------|---------|---------|------|
| Cogex Outillage | FR | `cogex/` | ✅ Actif |
| Gers Équipement | FR+ES+NL+DE+BE+IT | `gers/` | ⏳ En attente |

---

## 5. Roadmap

### Mai 2026

**S1 (prochaine session)**
- [ ] Compteur tokens IA dans l'app (avant migration Lambda)
- [ ] Route `/ai/complete` dans Lambda (proxy IA + `ap-usage`)
- [ ] Migration appels IA app → Lambda
- [ ] Interface client `amazon.foliow.app/client` — Appros + Buy Box

**S2**
- [ ] Agent SEO complet — `generateSEOFiche()` + Route B (écriture VC)
- [ ] Analyse SWOT ASINs (IA)
- [ ] Gers Équipement multi-marchés

**S3**
- [ ] Gestion tarifs
- [ ] Login Cognito dans l'app admin
- [ ] Tests beta clients actuels (Cogex + 1 nouveau)

**S4**
- [ ] Stripe — Free/Starter/Pro
- [ ] Gestion quotas tokens par plan
- [ ] Onboarding client autonome

### Juin 2026

**S1**
- [ ] Agent acquisition LinkedIn (agentique Claude in Chrome)
- [ ] Landing page `amazon.foliow.app`

**S2**
- [ ] Beta fermée — 10-15 responsables e-commerce sélectionnés
- [ ] Feedback loop + correctifs

**S3-S4**
- [ ] Beta publique
- [ ] Distribution ouverte — objectif fin juin ✅

---

## 6. Règles de Développement

### Règle n°1 (non-négociable)
Fred n'est pas codeur. Claude exécute toutes les tâches techniques (code, AWS, déploiements, fichiers). Fred valide et donne les instructions.

### Protocole de session
1. Vérifier `APP_VERSION` dans `amazon-pilot-work.html`
2. Reconstruire depuis `src/` si nécessaire : `python3 build.py --version X.Y.Z`
3. Validation JS : `node --check /tmp/check.js`
4. Déployer en staging → Playwright 6/6 → merger en prod

### Protocole de livraison
```bash
cp amazon-pilot-vX.Y.Z.html amazon-pilot-latest.html
git add amazon-pilot-latest.html src/
git commit -m "vX.Y.Z - [description]"
git push origin staging
# Attendre 2 min → nouvel onglet RECETTE → smoke test Playwright
# Si 6/6 → git push origin main → invalidation CloudFront
```

### Nommage fichiers
- Livraison : `amazon-pilot-vX.Y.Z.html`
- Jamais livrer `amazon-pilot-latest.html` directement
- Fred copie en `amazon-pilot-latest.html` pour le repo

### Lambda Function URL eu-west-3 — Procédure déblocage
```bash
# Depuis CloudShell, après installation CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install --update

/usr/local/bin/aws lambda add-permission \
  --function-name {FN} \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region eu-west-3

/usr/local/bin/aws lambda put-public-access-block-config \
  --public-access-block-config BlockPublicPolicy=false \
  --region eu-west-3
```
⚠️ CLI v1 ne supporte pas `put-public-access-block-config`
⚠️ 403 "Host not in allowlist" depuis container Claude = normal

### Cognito — Règles
- Toujours utiliser l'**ID Token** (pas Access Token) dans `Authorization: Bearer`
- L'Access Token ne contient que `sub` + scopes OAuth
- L'ID Token contient `email` + tous les `custom:*`
- Mot de passe admin : `AmazonPilot2026!`

### IA — Règles architecture
- **Jamais** appeler `api.anthropic.com` directement depuis le browser client
- Tous les appels IA passent par `POST /ai/complete` (Lambda)
- La Lambda comptabilise tokens dans `ap-usage` et vérifie les quotas du plan
- Clé Anthropic stockée uniquement dans les variables d'env Lambda

### build.py — Pièges connus
- `// @smoke` vs `// @smoke_manual` → collision substring → toujours injecter avec `\n` terminateur
- `runSmokeTestManual` en fin de `smoke.js` sans `\n` → `replace('\n' + fn)` au lieu de regex
- `strip_header` doit être appliqué à `core.js` aussi (pas seulement aux modules)
- `APP_VERSION` dans `core.js` est mis à jour automatiquement par `build.py`

### Console AWS dans sandbox Claude
La console AWS plante avec "React error #310" dans le sandbox Claude in Chrome. **Ne jamais essayer** — aller directement au CLI CloudShell ou Claude Code.

---

## 7. Credentials & Références

| Élément | Valeur |
|---------|--------|
| App prod | `amazon.foliow.app` |
| App RECETTE | `d9xny9istvl53.cloudfront.net` |
| CloudFront prod | `E3ERL241475BJI` |
| S3 bucket | `amazon-pilot-foliow` |
| Lambda API URL | `konuaxmdxjnzcuw2etjqwczrla0xycvt.lambda-url.eu-west-3.on.aws` |
| Cognito User Pool | `eu-west-3_8P9UzCONx` |
| Cognito App Client | `5nnllolhnc3572800bvce94682` |
| Admin email | `frochette@vitajardin.com` |
| Région AWS | `eu-west-3` |
| GitHub app | `Fred78750/amazon-pilot` |
| GitHub API | `Fred78750/amazon-pilot-api` |

---

## 8. Autocritique & Leçons apprises

| Leçon | Application |
|-------|-------------|
| Règle n°1 violée → perte de temps | Claude Code exécute tout, Fred valide |
| Lambda Function URL bloquée 2 fois | Procédure documentée section 6 — appliquer systématiquement |
| `put-public-access-block-config` CLI v1 inexistante | Toujours installer CLI v2 sur CloudShell |
| `// @smoke` collision avec `// @smoke_manual` | Injection avec `\n` terminateur obligatoire |
| Access Token vs ID Token Cognito | ID Token obligatoire pour custom claims |
| `h.units = 0` → calcAppro retourne null | Fallback vélocité `revenue / prixMoyen` implémenté |
| Bug titre onglet figé → 10 versions sans détection | Smoke test I7 ajouté, règle : tout bug récurrent = test auto |
