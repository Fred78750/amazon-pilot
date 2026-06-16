# CLAUDE_CODE_v3_7_11_status.md — Orchestrateur Context

**Version :** v3.7.11 (cumule v3.7.9 + v3.7.10 + v3.7.11)
**Date merge prod :** 2026-06-15
**Commit :** df42525 (main)
**Statut :** ✅ PROD déployé — staging + preprod + prod alignés

## Résumé livraison

Cycle de **corrections du graphe « Tendance 52 semaines »** (Tableau de bord), déclenché par l'AUDIT « semaine importée absente du graphe » (Cogex prod).

**v3.7.9 — Fix « semaine absente du graphe »**
`mergeImportData` (import_export.js) : l'import fichier-par-fichier (autoImportFiles / s3_poll : 1 fichier par appel) créait le snapshot hebdo dès le 1er fichier, puis le test `alreadyArchived` **bloquait** les fichiers suivants → snapshot figé (CA périmé/0) alors que les KPI (lus depuis `ex.*` live) restaient bons. Fix = **upsert** (`{...existing, ...snapshot}`) au lieu de skip. Le spread laisse aussi un **0 mesuré** écraser l'ancienne valeur → cohérent avec le signal « passage-à-0 » du SPEC suspectTag v2.

**v3.7.10 — Graphe : libellés + toggle Commandé/Expédié**
1. `buildWeeklyConsolidated` (charts.js) utilisait toujours `h.revenue` (= **expédié** pour Fabrication) tout en libellant « CA Commandé » → barre ≠ KPI. Désormais respecte `c.kpiPrimaireCA` : `ordered`→`orderedRevenue`, `shipped`→`shippedRevenue`.
2. Libellés hebdo : plage **« JJ/MM au JJ/MM »** (dimanche→samedi) si ≤8 semaines, sinon date de fin seule (lisibilité). Le label = début de semaine ; +6j = fin.

**v3.7.11 — Bandeau « semaines incomplètes »** (demande UX Fred)
Sous le graphe (mode semaines), `detectIncompleteWeeks` signale au niveau agrégé par semaine :
- `gv>0` & commandé=0 & expédié=0 → **Ventes manquantes**
- `gv>0` & commandé=0 & expédié>0 → **Commandé manquant**
- ventes présentes & `gv=0` → **Trafic manquant**
- ventes+trafic & stock=0 → **Stock manquant**

Robuste (agrégat ~2000 ASINs : total 0 + vues>0 = donnée non importée, pas « 0 vente »). Vérifié live : 0 faux positif sur données complètes + 4 cas reconnus.

## Environnements

| Env | Version | Deploy |
|---|---|---|
| Production | v3.7.11 | 2026-06-15 — S3 amazon-pilot-foliow + CF E3ERL241475BJI |
| Preprod | v3.7.11 | 2026-06-15 — S3 amazon-pilot-preprod + CF E3CODYJ437XKU5 (manuel, voir §Pièges) |
| Staging | v3.7.11 | 2026-06-15 — S3 amazon-pilot-recette + CF EVQ30COFUNGA7 |

## Résolution du cas Fred (faux bug — capitalisable)

Fred signalait un « trou » sur la semaine 26/04→02/05 « CA reste à 0 même en réimportant ». Diagnostic via console prod (lecture seule) : la semaine **26/04→02/05 était déjà correcte** ; le trou réel = **19/04→25/04** où **seul le Trafic** avait été importé (gv=1030, commandé=0, expédié=0) — les Ventes n'avaient **jamais** été ingérées. Fred réimportait la mauvaise semaine. Le bandeau v3.7.11 rend ce diagnostic visible automatiquement.

**Pattern à capitaliser :** `gv présent + commandé/expédié = 0` au niveau agrégé ⇒ semaine importée en **Trafic seul** (Ventes manquantes), PAS un bug de rangement. Distinguer « donnée non importée » de « valeur nulle réelle ».

## Pièges techniques relevés (pour briefs futurs)

1. **`deploy-preprod.yml` CASSÉ** : déploie `ls amazon-pilot-v*.html | sort -V | tail -1`, or `.gitignore` ignore les versionnés sauf `amazon-pilot-latest.html` → le plus haut suivi = v3.6.7. Un `push preprod` déploierait **v3.6.7**. Contournement : preprod déployé en **manuel** (`s3api put-object` → bucket `amazon-pilot-preprod` + invalidation `E3CODYJ437XKU5`). À corriger : faire pointer le workflow sur `amazon-pilot-latest.html` comme staging/prod. `deploy.yml` (prod) et `deploy-staging.yml` sont OK.
2. **Divergence branches main↔staging** : historique divergent (docs), mais code `src/` identique hors fixes. Livraison prod faite par **port ciblé** (`git checkout staging -- <fichiers>`) sur `main` puis push (déclenche `deploy.yml`), pas par `git merge` (éviterait conflits docs + HTML 1 Mo).

## Méthode de validation employée

Reproduction systématique en **harnais Node** chargeant le vrai code (`parser_vc`, `parsers_internal`, `parser_traffic`, `import_export.mergeImportData`, `charts.buildWeeklyConsolidated`) + vrais CSV, avec shim PapaParse — puis vérification **live preprod** (lecture IndexedDB + instance Chart.js via Claude in Chrome). Navigation prod bloquée par politique de domaine → diagnostic prod par snippet console lecture seule fourni à Fred.
