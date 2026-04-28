# Amazon Pilot — Document de reprise de session
**Dernière mise à jour : 2026-04-17**
**Fichier de référence : `amazon-pilot-latest.html` (6 229 lignes — 324 KB)**

---

## Déploiement AWS (commande PowerShell)

```powershell
copy "C:\Fred\VitaJardin\Amazon\last html\amazon-pilot-latest.html" C:\AmazonPilot\amazon-pilot-latest.html
aws s3 cp amazon-pilot-latest.html s3://amazon-pilot-foliow/index.html
aws cloudfront create-invalidation --distribution-id E3ERL241475BJI --paths "/*"
```

**URL de production : https://amazon.foliow.app**
⚠️ Toujours déployer sur AWS — ne jamais ouvrir en `file://` (IndexedDB vide à chaque fois)

---

## Infrastructure AWS
| Composant | Détail |
|-----------|--------|
| S3 | `amazon-pilot-foliow` — eu-west-3 — versioning ON |
| CloudFront | `E3ERL241475BJI` — `d35lvbpki2vqdp.cloudfront.net` |
| Certificat | ACM us-east-1 — ISSUED |
| Domaine | `amazon.foliow.app` (CNAME Gandi → CloudFront) |
| IAM | `amazon-pilot-deploy` — S3FullAccess + CloudFrontFullAccess |
| Coût | < 0.15 €/mois |

---

## Protocole début de session (OBLIGATOIRE)

```
1. ls /mnt/user-data/uploads/
2. cp /mnt/user-data/uploads/amazon-pilot-latest.html /home/claude/amazon-pilot-latest.html
   OU cp /mnt/user-data/outputs/amazon-pilot-latest.html /home/claude/amazon-pilot-latest.html
3. Vérifier le nombre de lignes (doit être >= 6229)
4. Validation syntaxe JS avant livraison
5. Copier vers /mnt/user-data/outputs/amazon-pilot-latest.html en fin de session
6. Rappeler la commande PowerShell en bas de chaque livraison
```

### Validation syntaxe JS
```python
import re, subprocess
with open('/home/claude/amazon-pilot-latest.html') as f:
    html = f.read()
scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script>', html)
biggest = max(scripts, key=len)
with open('/tmp/check.js', 'w') as f:
    f.write(biggest)
r = subprocess.run(['node', '--check', '/tmp/check.js'], capture_output=True, text=True)
print(r.stderr or "✓ OK")
```

---

## Stack technique
| Composant | Solution |
|-----------|----------|
| UI | HTML/CSS vanilla, thème clair/sombre |
| Parser CSV | PapaParse 5.4.1 (CDN) |
| Graphiques | Chart.js 4.4.1 (CDN) |
| Parser XLS/XLSX | SheetJS 0.18.5 (CDN) |
| Stockage | IndexedDB `AmazonPilot` + localStorage (clé API, thème, préfs) |
| IA | Anthropic API browser-direct (`anthropic-dangerous-direct-browser-access: true`) |
| Typo | DM Sans + JetBrains Mono (Google Fonts CDN) |
| Import auto | File System Access API (Chrome) |

---

## Modèle de données client (freshClient)

```javascript
{
  id, name, brand, sector, contactOp, reason,
  model, vendorCode, markets[], mainMarket,
  fulfillment, stockDeporte, btr, btrNote, threeP,
  budget, pricingPolicy,
  imports: [], asins: [], csvImported: bool,
  history: { weekly: [], monthly: [], yearly: [] },
  weeklyActions: [], monthlyActions: [],
  annualData: {},   // { '2024': { ventes, trafic, stock } }
  ytdData: {},      // { ventes, trafic, stock }
  leadTime: 20, stockTarget: 8, moq: 0,
  catalogue: [],    // [{ asin, sku, ean, description, prixAchat, vendorCode }]
  pos: [],          // [{ poId, asin, sku, title, vendorCode, qty, qtyAccepted,
                    //    qtyRemaining, cost, warehouse, orderDate,
                    //    deliveryDeadline, status, importedAt }]
  ppmData: {},      // { asin: { ppm, ppmDeltaBps, importedAt } }      ← NOUVEAU 17/04
  forecastData: {}, // { asin: { weeks[48], weekLabels[48], importedAt } } ← NOUVEAU 17/04
  awayUntil: null,
}
```

---

## Architecture données

| Niveau | Clé stockage | Fréquence | Détection |
|--------|-------------|-----------|-----------|
| Hebdo | asins[] + history.weekly[] | Chaque semaine | Intervalle=[Semaine] |
| YTD | ytdData | Chaque semaine (écrase) | Intervalle=[Année en cours.] |
| Annuel | annualData[année] | 1 fois N-2/N-1 | Intervalle=[An] |
| POs | pos[] | Selon activité commande | Extension .xls/.xlsx/.csv |
| PPM nette | ppmData{} | Mensuel | CSV Retail Analytics |
| Prévisions | forecastData{} | Bimensuel | CSV 48 semaines glissantes |

---

## Navigation (NAV)

```
weekly / dashboard / import / agent / asins / pompier / potentiel / appros / fiche / config
```

Nouvel écran : **🚀 ASINs Potentiel** (ajouté 17/04)

---

## Fonctionnalités actives

### Import (5 étapes)
1. Historique N-2/N-1/YTD (grille 3x3)
2. Hebdomadaire (Ventes/Trafic/Stock)
3. Bons de commande (XLS/CSV)
4. PPM Nette (CSV) ← NOUVEAU 17/04
5. Prévisions Amazon 48 semaines (CSV) ← NOUVEAU 17/04

### Parsers
- `parseCSVFile` — CSV Retail Analytics (ventes/trafic/stock/ytd/annuel)
- `parsePOFile` — XLS/CSV POs (colonnes FR/EN, dates float Excel)
- `parsePPMFile` — CSV PPM nette (% + delta bps vs N-1) ← NOUVEAU 17/04
- `parseForecastFile` — CSV prévisions 48 semaines glissantes ← NOUVEAU 17/04

### getPOsForAsin(asin, client)
Analyse POs par ASIN : qtyEnTransit, ruptureTotal/Partielle, tauxAcceptation, prochainelivraison

### calcPotential(a, c) ← NOUVEAU 17/04
Score 0-100 sur 5 signaux :
- Prévision Amazon S+1→S+4 vs vélocité (0-25 pts)
- Tendance court terme slope (0-20 pts)
- PPM nette ≥ 15% (0-20 pts)
- Stock suffisant > 3× vélocité (0-20 pts)
- Conversion CA/GV stable ou en hausse (0-15 pts)

Candidat BTR = score ≥ 70 + PPM ≥ 15% + stock OK + BTR non interdit

### Écran 🚀 ASINs Potentiel ← NOUVEAU 17/04
- Filtres : Fort (≥70) / Moyen (45-69) / BTR / Tous
- KPIs : nb Fort, nb Moyen, nb BTR, nb analysés
- Tableau : score, niveau, signaux clés, prévision S+4, PPM, CA, stock
- Badge BTR automatique
- Lien → fiche ASIN

### Colonnes ajoutées dans tableau Analyse ASINs
- 🚀 Score potentiel (coloré vert/orange si ≥ 45)
- PPM (coloré selon seuil)

### calcAppro — intégration pos[]
- Utilise `getPOsForAsin()` au lieu de `openPOQty` CSV
- Fallback sur `a.openPOQty` si pas de POs chargés
- Champs return : rupturesFournisseur, ruptureTotal, rupturePartielle, tauxAcceptation, prochainelivraison, hasPOData

### Écran Appros
- Bandeau ruptures fournisseur (total 🚫 / partielle ⚠️ / OK ✓)
- Colonne "POs / Fournisseur" dans le tableau

### buildAsinContext — prompts IA enrichis
Injecte dans chaque analyse :
- PPM nette + delta vs N-1 + signal risque si < 5%
- Prévisions Amazon : S+1 + moy. S+1→S+4 + ratio vs vélocité
- POs en cours : qtyEnTransit, date livraison, alertes rupture fournisseur

---

## Agent Import — Refonte complète (17/04)

### Architecture
- **1 bouton "Tout mettre à jour"** par client
- Script intelligent : génère uniquement les rapports obsolètes
- Gestion multi-marchés : 1 bloc d'étapes par marché pour ventes/trafic/stock
- 6 rapports suivis avec fréquences différentes

### Fréquences par rapport
| Rapport | Fréquence | Seuil obsolescence |
|---------|-----------|-------------------|
| Ventes | Hebdo | > 7 jours |
| Trafic | Hebdo | > 7 jours |
| Stock | Hebdo | > 7 jours |
| POs | Hebdo | > 7 jours |
| Prévisions | Bimensuel | > 14 jours |
| PPM nette | Mensuel | > 30 jours |

### File System Access API
- Bouton "Autoriser l'accès aux Téléchargements" (une seule fois)
- Surveillance toutes les 3 secondes (`setInterval`)
- Détection par nom de fichier (vente/sales/trafic/stock/prevision/ppm/bons...)
- Import silencieux + toast de confirmation
- Routing automatique vers le bon parser selon le type détecté

### Fonctions clés
- `getEnrichedFreshness(c)` — fraîcheur des 6 rapports
- `generateFullScript(c)` — génère le script complet multi-étapes
- `copyFullScript(clientId)` — copie dans le presse-papier
- `requestDownloadsAccess()` — File System Access API
- `startFileWatch()` / `stopFileWatch()` — surveillance dossier
- `autoImportFiles(files)` — import automatique détecté

### ⚠️ Backlog Agent — sous-comptes Gers Equipement
Gers Equipement a des **sous-comptes par marché** dans VC (entités FR + ES séparées).
Le script doit naviguer vers le bon sous-compte avant chaque export marché.
À implémenter : détection du sous-compte actif + navigation vers l'entité correcte.

---

## Clients

### Cogex Outillage
- Marché : FR mono-pays
- Catalogue matrice tarif : ~2 909 ASINs
- POs : XLS ou CSV, colonnes Français
- Entrepôts : CDG7, LIL1, ETZ2, XCD2

### Gers Equipement
- Marchés : FR + ES + NL + DE + BE + IT
- ⚠️ Sous-comptes par marché dans VC (FR et ES sont des entités séparées)
- Format CSV doublement encapsulé (bug résolu 15/04)
- POs Gers FR : CSV, colonnes Français / POs Gers ES : XLS, colonnes Anglais
- Entrepôts ES : ZAZ1, BCN1

### Contexte général Fred
- 3 clients Vendor Central + 2 clients Seller Central (SC non intégré pour l'instant)
- 1 profil Chrome par client (5 profils au total)
- Utilise Claude in Chrome pour l'automatisation
- Déploiement sur AWS via PowerShell depuis C:\AmazonPilot

---

## URLs Vendor Central

| Rapport | Chemin |
|---------|--------|
| Ventes | /retail-analytics/dashboard/sales |
| Trafic | /retail-analytics/dashboard/traffic |
| Stock | /retail-analytics/dashboard/inventory |
| Prévisions | /retail-analytics/dashboard/forecast |
| PPM nette | /retail-analytics/dashboard/netppm |
| POs | /po/vendor/members/po-mgmt/managepos?tabId=confirmed |

Domaines : .fr .de .it .es .co.uk .nl .be .se .pl
Paramètre langue : `?mons_sel_locale=en_GB` (optionnel — chemin toujours en anglais)

---

## Bugs résolus (historique)

| Date | Bug | Fix |
|------|-----|-----|
| 15/04 | sellableUnits mauvaise colonne | Priorité `vendables en stock` dans findCol |
| 15/04 | Merge IndexedDB crash Appros | Merge avec freshClient() dans load() |
| 15/04 | CSV multi-pays Gers CA=0 | Désencapsulation format doublement encapsulé |
| 16/04 | showToast() inexistante | Ajout fonction générique |
| 16/04 | saveClients() → save() | 2 occurrences corrigées |
| 16/04 | toLocaleString() sur null Appros | Guards sur ruptureStr, limiteStr, couvColor |

---

## Backlog

| # | Sujet | Priorité |
|---|-------|----------|
| 1 | Agent : navigation sous-comptes Gers (FR/ES) | 🔴 Haute |
| 2 | Tester parser POs sur fichiers XLS réels | 🔴 Haute |
| 3 | Tester File System Access API en production | 🔴 Haute |
| 4 | Upgrade fiche client (champs manquants) | 🟡 Moyenne |
| 5 | Brand Analytics filtré (68K lignes → top termes client) | 🟡 Moyenne |
| 6 | BTR Simulator (calcul dossier depuis vélocité + prix achat) | 🟡 Moyenne |
| 7 | Score de conversion dédié + alerte trafic sans vente | 🟡 Moyenne |
| 8 | Rapport PDF mensuel auto | 🟡 Moyenne |
| 9 | Feedback 👍/👎 sur les analyses IA | 🟢 Basse |
| 10 | Phase 2 — Refactoring + Vite (backend) | Long terme |
| 11 | Phase 3 — Lambda + DynamoDB | Long terme |
| 12 | Phase 4 — Cognito auth + rôles Admin/Viewer | Long terme |
| 13 | Seller Central (2 clients) | Long terme |

---

## Vision produit

| Phase | Statut |
|-------|--------|
| Phase 1 — S3 + CloudFront (amazon.foliow.app) | ✅ Livré |
| Phase 5 — Module Appros | ✅ Livré |
| Phase 6 — PPM + Prévisions + Score Potentiel | ✅ Livré 17/04 |
| Phase 7 — Agent autonome (File System Access) | ✅ Livré 17/04 (à tester) |
| Phase 2 — Refactoring multi-fichiers + Vite | 🔲 |
| Phase 3 — Lambda + DynamoDB | 🔲 |
| Phase 4 — Cognito auth + rôles Admin/Viewer | 🔲 |

Clients cibles : Admin (Fred) accès complet / Viewer (client) dashboard+KPIs, fee mensuel
Horizon Viewer : 3-6 mois
Déploiement client : cogex.foliow.app ou white label

---

## Brainstorm features (session 17/04)

### Fonctionnalités prioritaires identifiées
1. ~~PPM nette pondérée~~ ✅ Fait
2. ~~Prévisions Amazon → Appros~~ ✅ Fait
3. ~~Score de potentiel / ASINs à fort potentiel~~ ✅ Fait
4. Brand Analytics filtré (top termes où les ASINs client sont présents)
5. BTR Simulator (dossier auto depuis données existantes)
6. Rapport PDF mensuel automatique
7. Score conversion + alerte "trafic sans vente"
8. Saisonnalité S vs S-52
9. Upgrade fiche client
10. Dashboard Viewer (dépend backend)

### Exports Amazon à intégrer (priorisés)
| Export | Impact | Faisabilité |
|--------|--------|-------------|
| ~~PPM nette~~ | ⭐⭐⭐⭐⭐ | ✅ Fait |
| ~~Prévisions~~ | ⭐⭐⭐⭐⭐ | ✅ Fait |
| Brand Analytics | ⭐⭐⭐ | ⚠️ 68K lignes — traitement serveur recommandé |
| Sales Diagnostic | ⭐⭐⭐⭐ | 🔲 À faire |
| Matrice tarif XML | ⭐⭐⭐⭐ | ✅ Déjà intégré |
| Ventes temps réel | ⭐⭐⭐ | 🔲 À faire |

### Notes PPM nette
- La PPM brute est trompeuse : moyenne non pondérée par CA
- Croisement avec CA nécessaire pour une PPM pondérée réelle
- Actuellement stockée brute — pondération possible dans calcPotential

### Notes Brand Analytics
- Fichier FR mars 2026 : 68 757 lignes
- Seulement 14 lignes contiennent "Cogex/COGEX"
- Approche recommandée : filtrer côté client, ne stocker que les termes pertinents

---

## Prompt de reprise recommandé

```
Bonjour ! Reprends le projet Amazon Pilot.
Fichier : amazon-pilot-latest.html (uploadé) + 2026-04-17_amazon-pilot-resume.md
Dernière session : 17/04/2026.
Nouveautés : PPM nette, Prévisions 48 sem., Score Potentiel, Agent refonte complète
(bouton "Tout mettre à jour", File System Access API, script multi-marchés).
Prochaine priorité : [DÉCRIRE ICI]
Commence par lire le fichier HTML avant de coder.
```
