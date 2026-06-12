# CLAUDE_CODE_v3_7_3_status.md — Orchestrateur Context

**Version :** v3.7.3  
**Date merge prod :** 2026-06-12  
**Commit :** 325096a (main) — tag v3.7.3  
**Statut :** ✅ PROD déployé

## Résumé livraison

Périmètre A : extraction ai_core.js (8 fonctions IA/API, core.js −335 L).  
Périmètre B : callAPI accepte inputHash (B1) ; ai_diagnostic envoie hash (B2) ; Lambda saveUsage enrichie model/asin/market/inputHash/timestamp (B3).  
Lambda déployée avant client (coordination §4 respectée).

## Environnements

| Env | Version | Deploy |
|---|---|---|
| Production | v3.7.3 | 2026-06-12 — S3 amazon-pilot-foliow + CF E3ERL241475BJI |
| Preprod | v3.7.3 | 2026-06-12 — S3 amazon-pilot-preprod + CF E3CODYJ437XKU5 |
| Staging | v3.7.3 | 2026-06-12 — S3 amazon-pilot-recette + CF EVQ30COFUNGA7 |
