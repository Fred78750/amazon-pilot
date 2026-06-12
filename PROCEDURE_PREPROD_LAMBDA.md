# PROCEDURE — Bascule api-key ↔ Lambda (Preprod)

**Date :** 2026-06-12  
**Contexte :** Preprod dispose à la fois d'une api-key Anthropic configurée ET d'une URL Lambda.  
Quand `ap-api-key` est présent dans localStorage, callAPI prend le chemin direct (Anthropic) — la Lambda n'est pas appelée.  
Pour tester le chemin Lambda, il faut supprimer temporairement la clé.

---

## Mode actuel preprod (référence)

```
ap-api-key  → présent (configuré dans Configuration IA)
ap-id-token → absent (ou expiré — Cognito non configuré pour Fred)
```

→ callAPI prend le chemin api-key direct. La Lambda n'est jamais appelée.

---

## Bascule vers mode Lambda pur

**Aucune modification de code nécessaire.** La bascule est pure config/localStorage.

### Étape 1 — Obtenir un token Cognito

```powershell
$auth = aws cognito-idp initiate-auth `
  --auth-flow USER_PASSWORD_AUTH `
  --client-id 5nnllolhnc3572800bvce94682 `
  --auth-parameters USERNAME=test-preprod@foliow.app,PASSWORD=<mot-de-passe> `
  --region eu-west-3 | ConvertFrom-Json

$auth.AuthenticationResult.IdToken | Out-File -FilePath test_id_token.txt -Encoding utf8 -NoNewline
```

Compte test : `test-preprod@foliow.app` (sub 71b9e00e-4031-70fd-b5a0-8448442b0c5d, clientId mosv47vfwm5).

### Étape 2 — Dans la console JS preprod

```javascript
// Supprimer la clé API (force le chemin Lambda)
localStorage.removeItem('ap-api-key');

// Injecter le token Cognito
// (copier le contenu de test_id_token.txt)
localStorage.setItem('ap-id-token', '<id_token>');

// Vérifier
console.log('api-key:', localStorage.getItem('ap-api-key'));   // null
console.log('id-token:', !!localStorage.getItem('ap-id-token')); // true
```

### Étape 3 — Recharger la page

Rechargement complet (F5). Le Dashboard charge avec la session Cognito.

---

## Vérification mode Lambda actif

Dans la console JS :

```javascript
// callAPI prend le chemin Lambda si id-token présent et non expiré
// Test minimal — ouvrir Vue Pro Cogex, déclencher une narrative
// Network tab : POST /ai/complete avec header Authorization: Bearer <token>
```

Token Cognito valide **1 heure**. Passé ce délai : répéter l'Étape 1.

---

## Retour en mode api-key

```javascript
// Console JS preprod
localStorage.removeItem('ap-id-token');
// Reconfigurer la clé API via l'interface Configuration IA (onglet Configuration)
// ou :
localStorage.setItem('ap-api-key', '<votre-api-key>');
```

Recharger la page. Vérifier dans Configuration IA que la clé est présente.

---

## Références

| Item | Valeur |
|---|---|
| UserPool | eu-west-3_8P9UzCONx |
| App Client | 5nnllolhnc3572800bvce94682 |
| Invoke URL Lambda | variable `_AI_LAMBDA_URL` dans l'app (voir Configuration) |
| Compte test | test-preprod@foliow.app (clientId mosv47vfwm5, role admin, modules *) |

---

## Contraintes

- ❌ Ne pas supprimer `ap-api-key` en prod (Fred n'a pas de token Cognito actif en prod)
- ❌ La bascule Lambda preprod ne nécessite aucun rebuild ni redéploiement
- ⚠️ Bug connu : saveUsage() écrit dans ap-data-prod (pas ap-usage-prod) — voir AUDIT_intercycle_cognito.md §4
