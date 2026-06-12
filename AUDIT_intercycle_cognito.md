# AUDIT intercycle — Preprod Lambda + Mystère ap-usage-prod

**Date :** 2026-06-12  
**Chantier :** intercycle entre v3.7.3 et v3.7.4  
**Objectif :** valider la chaîne Lambda en preprod + trancher le mystère ap-usage-prod vide

---

## 1. Étape 2 — CloudWatch (fait EN PREMIER, avant création user)

**Requête :** `describe-log-streams` + `get-log-events` sur `/aws/lambda/amazon-pilot-api-prod`, 30 derniers jours.

**Résultat :**
- Durée max observée : **208 ms**
- Durée typique d'un appel Anthropic réel : > 1 000 ms
- 208 ms = uniquement des 401 (auth) — Lambda retourne avant d'appeler Anthropic

**Verdict (b) CONFIRMÉ :** Fred utilise api-key (mode direct), la Lambda n'a reçu aucun appel 2xx en production depuis 30+ jours. La table ap-usage-prod est vide car `saveUsage()` n'est jamais appelée en prod.

---

## 2. Étape 1 — Compte Cognito test créé

| Attribut | Valeur |
|---|---|
| Email | test-preprod@foliow.app |
| Sub | 71b9e00e-4031-70fd-b5a0-8448442b0c5d |
| custom:clientId | mosv47vfwm5 |
| custom:role | admin |
| custom:modules | * |
| custom:plan | (absent — non dans le schéma actuel) |

Attributs copiés verbatim depuis l'utilisateur existant (frochette@vitajardin.com) via `admin-get-user`. Aucune valeur inventée.

---

## 3. Étape 4 — Chaîne Lambda complète

Méthode : `initiate-auth` → token sauvegardé fichier → appels Lambda via `invoke-url/ai/complete`.

| Appel | Condition | Status | Durée CloudWatch |
|---|---|---|---|
| 1 | Sans inputHash | **2xx** ✅ | ~2 871 ms (appel Anthropic réel) |
| 2 | Avec inputHash `v1_41fd47c5` | **2xx** ✅ | ~1 571 ms (appel Anthropic réel) |

**CloudWatch :** 2 appels Anthropic confirmés (durées > 1s). Aucune ligne `[USAGE] Erreur save:` dans les logs — `saveUsage()` s'exécute sans erreur levée.

---

## 4. Bug DynamoDB — Diagnostic (sans correction — GO Fred requis)

### Constat

Après les 2 appels 2xx : scan `ap-usage-prod` → **Count: 0** (toujours vide).  
Scan `ap-data-prod` (clientId=mosv47vfwm5, sk begins_with usage#) → **1 item trouvé**.

### Root cause

`saveUsage()` dans `routes/ai.js` appelle `putData(clientId, sk, usage, 'system')`.  
`putData()` dans `lib/dynamo.js` écrit dans `TABLES.data` = `process.env.TABLE_DATA` = **`ap-data-prod`**.

```javascript
// lib/dynamo.js — TABLES object (pas d'entrée TABLE_USAGE)
const TABLES = {
  clients: process.env.TABLE_CLIENTS || 'ap-clients',
  data:    process.env.TABLE_DATA    || 'ap-data',
  users:   process.env.TABLE_USERS   || 'ap-users',
  // ← pas de clé "usage"
};

async function putData(clientId, sk, payload, importedBy = 'system') {
  await ddb.send(new PutCommand({
    TableName: TABLES.data,  // ← hardcodé sur TABLE_DATA, jamais TABLE_USAGE
    ...
  }));
}

// De plus, getData() n'accepte que 2 params :
async function getData(clientId, sk) { ... }
// → le 3ème arg TABLE_USAGE passé dans getUsage() est silencieusement ignoré
```

### Items de test écrits dans ap-data-prod (à purger)

| Champ | Valeur |
|---|---|
| Table | ap-data-prod |
| clientId | mosv47vfwm5 |
| sk | usage#2026-06 |
| importedAt | 2026-06-12T08:01:00.447Z |
| lastCall.inputHash | v1_41fd47c5 |
| lastCall.model | claude-sonnet-4-20250514 |
| lastCall.timestamp | 2026-06-12T08:01:00.447Z |

### Fix recommandé (GO Fred requis)

Dans `routes/ai.js`, remplacer l'appel `saveUsage()` par un `PutCommand` direct ciblant `TABLE_USAGE` :

```javascript
// Option A — PutCommand direct dans routes/ai.js
const TABLE_USAGE = process.env.TABLE_USAGE || 'ap-usage-prod';
await ddb.send(new PutCommand({
  TableName: TABLE_USAGE,
  Item: { clientId, sk: `usage#${month}`, ...usage, updatedAt: new Date().toISOString() },
}));

// Option B — Ajouter putUsage() dans lib/dynamo.js avec TABLES.usage = process.env.TABLE_USAGE
```

**Contrainte brief : ❌ ne pas corriger sans GO Fred.**

---

## 5. Cartographie des modes

| Acteur | Mode | Auth | saveUsage() appelée |
|---|---|---|---|
| Fred (prod) | api-key direct | localStorage `ap-api-key` | ❌ jamais (callAPI direct bypass Lambda) |
| Futurs clients | Lambda | Bearer token Cognito | ✅ (mais écrit dans ap-data-prod — bug) |
| Test preprod | Lambda | Bearer token Cognito | ✅ (confirme le bug) |

**Implication critique :** l'instrumentation serveur Phase 2 (quotas, plans, analytics) ne mesure QUE le trafic Lambda. L'usage Fred (api-key) est invisible côté serveur. Seule la table `aiUsage` locale (getAiUsageStats()) trace les appels de Fred.

---

## 6. Tickets à ouvrir / fermer

| # | Action | Priorité |
|---|---|---|
| T1 | **Fix saveUsage()** : cibler `TABLE_USAGE` (ap-usage-prod), pas `TABLE_DATA` | Bloquant pour Phase 2 (quotas) — GO Fred requis |
| T2 | **Purger item test** : ap-data-prod, clientId=mosv47vfwm5, sk=usage#2026-06 | Cosmétique — avant mise en prod clients |
| T3 | **Unification A1** : ai_diagnostic.js → callAPI (ticket ouvert AUDIT v3.7.3) | Technique — chantier séparé |
| A2 | Fermer : session Cognito absente en preprod | Résolu — mode Lambda validé ce chantier |
| B | Fermer : mystère ap-usage-prod vide | Résolu — verdict (b) + bug T1 documentés |

---

## 7. Validation checklist (brief §2)

| # | Point | Résultat |
|---|---|---|
| 1 | Login compte test Cognito preprod OK | ✅ |
| 2 | Chaîne complète : ai/complete 2xx + inputHash dans body | ✅ |
| 3 | Item DynamoDB ap-usage observé (ou échec diagnostiqué) | ⚠️ Échec diagnostiqué — écrit dans ap-data-prod (bug T1) |
| 4 | Mystère tranché : (a) ou (b) avec preuves | ✅ Verdict (b) + variante silencieuse de (a) |
| 5 | PROCEDURE_PREPROD_LAMBDA.md déposé | ✅ |
| 6 | Mode api-key restauré preprod | ✅ (Fred rouvre preprod avec sa config api-key habituelle) |
| 7 | AUDIT_intercycle_cognito.md | ✅ (ce fichier) |
