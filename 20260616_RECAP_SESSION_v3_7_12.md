# Récap & clôture de session — Hotfix v3.7.12 (migration modèles IA)

**Date:** June 16, 2026
**Rôle tenu:** Orchestrateur produit Amazon Pilot
**Objet de session:** rétablissement des analyses IA suite au retrait de `claude-sonnet-4-20250514` par Anthropic. *(La session devait porter sur l'Agent BB — interrompue dès le départ par l'incident prod.)*

---

## 1. Ce qui a été fait — Hotfix v3.7.12 (déployé prod, validé)

**Cause racine :** Anthropic a retiré `claude-sonnet-4-20250514` (16 juin) → bloc Analyse IA cassé en prod (`__ERR_UNKNOWN__`).

**Livré :**
- `AI_MODELS` étendu de `standard/premium/rapide` à **4 modèles à strings non datés** : `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-opus-4-8`, `claude-haiku-4-5`. Convention actée : **version-mineure, jamais de suffixe date, jamais `latest`.**
- **Routage figé par feature** (gouvernance « figé produit ») : tier décidé en code, **sélecteur modèle retiré de l'UI client**. Mapping : Diagnostic complet + legacy → Opus 4.8 ; Diagnostic baisses / Opportunités / Risques → Opus 4.6 ; Analyse ASIN / Agent SEO / Appros → Sonnet 4.6.
- **2 bypass hardcodés rapatriés** dans `AI_MODELS` : `runApprosIA` (l.9238), `initAIDiagnostic` (l.14128). C'était le vrai correctif durable — sans ça, récidive au prochain retrait.
- **Whitelist Lambda IA migrée** (`amazon-pilot-api`, `routes/ai.js`). Découverte critique : la Lambda n'était **pas** un proxy transparent mais une **whitelist** rejetant tout string non listé, **avec fallback sur un modèle retiré**. Un déploiement app-only aurait remplacé l'erreur par un rejet `400`.
- `opus-4-7` **entièrement retiré** (non routé, grep vide).
- Tarifs sourcés (`/claude-api`, cache 2026-06-04) : Sonnet 4.6 = 3/15 ; Opus 4.6 & 4.8 = 5/25 (baisse réelle vs ancien Opus 15/75) ; Haiku 4.5 = 1/5.

**Déploiement :** app `7775e8d` + Lambda `de300dc` (staging → prod). Incident upload rattrapé via contrôle `ContentLength` (index.html resté en v3.7.11, ré-uploadé). CloudFront invalidé.

**Validation fonctionnelle :** Diagnostic complet (Opus 4.8) rendu correctement en prod sur Cogex. Chaîne app→Lambda→Anthropic OK bout en bout.

---

## 2. Reste à clore (mineur, non bloquant)

- **Confirmer Opportunités + Risques** (Opus 4.6) par 2 clics en prod Cogex. Diagnostic complet (tier le plus lourd) passe déjà → probabilité haute, mais à solder pour rigueur.

---

## 3. Backlog dormant — items nés cette session

1. **[SÉCURITÉ — prioritaire] `runApprosIA`** appelle `api.anthropic.com` en direct avec **clé API exposée côté client**. Le hotfix a corrigé le string, pas l'exposition. Migrer cet appel vers la Lambda. Rappel : épisode clé IAM exposée d'avril.
2. **[Mini-spec] Vérificateur de tarifs mensuel.** Étape 0 = Claude Code qualifie la source (endpoint pricing programmatique stable ? ou seulement page HTML / cache skill ?). Forme = **détecteur d'écart qui alerte**, **jamais** correcteur automatique. Si la seule source est un scraping fragile → **ne pas implémenter**, rester en revue manuelle.
3. **[Process déploiement] Tolérance transitoire de la whitelist Lambda.** Question restée **sans réponse** : la nouvelle whitelist accepte-t-elle encore les anciens strings le temps de la propagation app/CloudFront ? L'incident d'upload a créé une fenêtre app-v3.7.11 / Lambda-à-jour. À trancher **avant tout prochain déploiement à fenêtre serrée** (règle : Lambda avant app).
4. **[À vérifier] Commentaire table tarifs.** Le commentaire « photo manuelle au 2026-06-04 » (décidé en cours de session) a-t-il bien été ajouté au code ? Non confirmé par Claude Code. À vérifier.

*(Rappel des items antérieurs : cf. backlog du V0.12 — deploy-preprod.yml, réconciliation branches, sémantique shippedRevenue, recalibrage seuils tag suspect, etc.)*

---

## 4. Point de reprise — Chantier Agent BB (jamais entamé)

La session n'a **pas avancé** sur la cible Agent BB. On est resté au point de départ :

- **Étape 1 : spec tag suspect v2.1.** Aligner la spec v2 (staging, 12 juin) sur le contexte canonique V0.12 : **maille mensuelle glissante + double composante** (passage-à-0 hebdo / chute-hausse mensuelle) + **seuils provisoires calibrés Cogex FR mai** (T_CHUTE −50 %, T_SURVEILLER −30 %, T_HAUSSE +50 %, FENETRE 8 sem, plancher activité). La spec staging est désynchronisée — à reprendre **avant** tout brief de code v3.8.
- Puis : 1ᵉʳ brief de CODE v3.8 (tag suspect, pré-calcul import, `a.suspectTag`).

**Observation terrain à verser au chantier :** l'analyse IA de Cogex a elle-même signalé « *0 baisses / 0 croissances suspectes — l'absence totale de mouvement sur 397 ASINs est anormale* ». Elle décrit en narratif ce que le tag suspect doit détecter en structuré → confirme le besoin réel de la spec.

---

## 5. Autocritique (règle n°1)

**Erreur principale — affirmation non vérifiée.** Au tour « Opus 4.6 », j'ai affirmé que ce modèle « n'existait pas » / relevait d'une « confusion de numéro », sur la seule base de mon cutoff (janvier 2026). Fred a dû me corriger par capture du sélecteur. **C'est une violation de la règle « doute plutôt qu'invention »** : j'ai produit une affirmation confiante pour combler une lacune au lieu de marquer INCERTAIN d'emblée. *Leçon : ne jamais affirmer l'inexistence d'un fait/modèle récent sur la base du cutoff ; poser INCERTAIN et laisser la vérification trancher.* (À ma décharge : le garde-fou « aucun string déployé sans test 200 » était posé, donc l'erreur n'aurait pas atteint la prod.)

**Hypothèse laissée filer — « Lambda présumée transparente ».** Le brief v1 qualifiait la Lambda de proxy transparent sans l'avoir vérifié. C'était faux (whitelist + fallback retiré). Le clone obligatoire que j'avais maintenu (E.6) a rattrapé le coup, mais l'hypothèse aurait pu orienter vers un déploiement app-only cassant. *Leçon : une hypothèse non vérifiée se marque « à vérifier en priorité », pas « présumée ».*

**Charge décisionnelle.** Beaucoup de décisions remontées à Fred (a priori/a posteriori, A-minimal/complet, gouvernance, ordre déploiement). Défendable au niveau d'autonomie 0, mais j'aurais pu trancher en reco forte sur les points à faible enjeu pour alléger.

**Ce qui a tenu (à reproduire) :**
- Refus de clôturer sur un rapport « structurel » — exigence du **clic réel** (présence ≠ flux réussi, leçon V0.11). A confirmé le fix.
- Alerte tarifs (5/25 jugé suspect) : le doute était fondé même si le chiffre s'est avéré réel — la **source** a tranché, pas l'intuition. Zéro chiffre extrapolé écrit.
- Maintien du clone Lambda malgré la présomption de transparence : a évité un hotfix qui ne fixait rien.
- Distinction alerte ≠ correction automatique sur le vérificateur de tarifs (refus de réintroduire une valeur Anthropic mouvante sans validation humaine).

---

[Agent Orchestrateur] — Source : intégralité de la session du 16 juin 2026 (briefs v1→v3, rapports Claude Code, captures prod Fred) — Confiance : haute sur le récap et le déployé ; les items §3.3 et §3.4 restent ouverts
