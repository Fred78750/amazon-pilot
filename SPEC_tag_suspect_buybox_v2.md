# SPEC — Tag « suspect » Buy Box (fondation Agent BB, v3.8) — v2.1

**Date:** June 16, 2026
**Version:** v2.1 — aligne la v2 (12 juin) sur le contexte canonique V0.12 : **maille mensuelle glissante + double composante**, seuils **calibrés provisoires** (Cogex FR mai), recalibrage hebdo+Gers versé au backlog. Le fond (signal = dynamique des Featured Offer Page Views) est inchangé.
**Statut:** prérequis n°1 au 1ᵉʳ brief de CODE v3.8. Structure [FERME] ; seuils [PROVISOIRES-PARAMÉTRABLES].

---

## 0. Rappel — prérequis Glance Views LEVÉ (inchangé v2)

Pour un Vendor 1P, « Featured Offer Page Views » **est** l'équivalent moderne des Glance Views (vocabulaire Amazon réuniformisé). Conséquences :
- Pas de dénominateur distinct à ingérer ; un ratio FO/Glance ≈ 1, non discriminant.
- Le signal = **la dynamique des Featured Offer Page Views elles-mêmes** (niveau, passage à 0, variation, tendance).
- **Toutes les données nécessaires sont déjà disponibles** : `a.foViews[marché][semaine].views` (v3.7.7) + variations natives (`deltaPrevPct`, `deltaYoyPct`). Aucune ingestion supplémentaire.

> **À répercuter sur le doc méthodo V3 (backlog) :** la méthodo V3 GPT définit encore « taux d'exposition = FO / Glance ». À faire reformuler par GPT (le signal est la dynamique des FO views, pas un ratio). Non bloquant pour le code.

---

## 1. Objectif et place dans v3.8 (inchangé)

Le tag répond à **« quels ASINs regarder »** (niveau 1). Il **détecte le symptôme**, ne diagnostique pas la cause (Agent BB = niveau 2 : 6 portes + BB-1→12).

---

## 2. Signal central — dynamique des FO views, lue en DOUBLE COMPOSANTE [MODIFIÉ v2.1]

Le signal reste la dynamique des Featured Offer Page Views. **Nouveauté v2.1 : il se lit sur deux mailles complémentaires**, parce que deux phénomènes distincts n'ont pas la même temporalité optimale :

- **Composante HEBDO (réactive) — passage à 0.**
  Le passage des FO views à 0 est un signal **binaire et urgent** (perte d'exposition franche). On le détecte sur la **maille hebdomadaire native**, sans lissage, pour le capter vite.
- **Composante MENSUELLE GLISSANTE (tendance) — chute / hausse.**
  La dérive progressive (baisse ou réveil) est un signal **de tendance**, bruité en hebdo. On le lit sur un **cumul mensuel glissant** (4 semaines), comparé au bloc mensuel précédent — ce qui lisse le bruit hebdomadaire et évite de tagger sur une seule semaine atypique.

**Pourquoi double et pas une seule maille :** une maille unique force un compromis perdant — trop courte, elle tague sur du bruit (faux positifs de chute) ; trop longue, elle rate un passage à 0 récent (réactivité perdue sur le signal le plus urgent). La double composante traite chaque phénomène à sa bonne échelle.

Par ASIN × marché, on lit donc :
- **niveau courant** `foViews[marché][semaine].views`
- **passage à 0** (composante hebdo) — FO views = 0 alors que l'ASIN a une activité commerciale connue
- **variation mensuelle glissante** : delta du cumul 4 sem N vs cumul 4 sem N-1 (s'appuie sur `deltaPrevPct` natif et/ou recalcul sur la fenêtre)
- **variation YoY** `deltaYoyPct` (native)
- **tendance** = pente des `views` sur la fenêtre

**Interprétation :** FO views = exposition de l'offre Amazon. Chute / passage à 0 = perte d'exposition (défensif). Hausse soutenue = réveil (offensif).

---

## 3. Données d'entrée (toutes disponibles — inchangé)

- `foViews[marché][semaine]` : `views`, `deltaPrevPct`, `deltaYoyPct` — v3.7.7 ✅
- `deliveryDefects[semaine][type]` — v3.7.8 (renforçateur) ✅
- ventes / unités / PO récents — pour qualifier « activité connue » (FO=0 sans activité = inactif, pas suspect) ✅
- stock dormant/vendable, BB détenteur (capture manuelle) — orientation ✅
- CA 12 mois — priorisation ✅

---

## 4. Algorithme — maille double composante [structure FERME, paramètres PROVISOIRES] [MODIFIÉ v2.1]

Par ASIN × marché opéré :

1. **Filtre plancher d'activité** : ignorer si aucune activité commerciale sur la fenêtre (ni ventes ni vues significatives) → inactif, non taggé. Anti-bruit. *(Calibration §5.)*
2. **Lecture hebdo (réactive)** : détection d'un **passage à 0** des FO views sur les dernières semaines (avec activité commerciale connue).
3. **Lecture mensuelle glissante (tendance)** : cumul `views` sur 4 sem glissantes, comparé au bloc 4 sem précédent → variation + pente, sur `FENETRE` = 8 sem (= 2 blocs mensuels comparés).
4. **Classification** (§5) : combine composante hebdo (0) et composante mensuelle (chute/hausse).
5. **Renforcement** : défauts livraison récurrents (BOL Mismatch ≥ N sem) ou stock dormant élevé → +1 cran de sévérité + pré-oriente les hypothèses BB candidates.

---

## 5. Mapping vers sévérité — SEUILS [PROVISOIRES-PARAMÉTRABLES, calibrés Cogex FR mai] [MODIFIÉ v2.1]

| Sévérité | Sens | Règle (seuils provisoires) |
|---|---|---|
| **Critique** | défensif | FO views = 0 sur ≥ 2 sem (composante hebdo, activité connue) **ou** chute mensuelle glissante < **T_CHUTE = −50 %** + défaut livraison récurrent |
| **À surveiller** | défensif | baisse soutenue : chute mensuelle entre **T_SURVEILLER = −30 %** et T_CHUTE, ou pente négative ≥ 3 sem sans rebond |
| **Sain** | — | niveau stable / variation ≈ 0 ou positive — non taggé |
| **Opportunité** | offensif | hausse mensuelle glissante ≥ **T_HAUSSE = +50 %** soutenue (≥ 3 sem) sur un marché — candidat à investir |

**Paramètres provisoires (origine : calibration Cogex FR mai, V0.12) :**
- `T_CHUTE` = **−50 %** (≈ 20 % des ASINs actifs concernés)
- `T_SURVEILLER` = **−30 %**
- `T_HAUSSE` = **+50 %**
- `FENETRE` = **8 sem** (2 blocs mensuels)
- **Plancher activité = critique** : une large part du catalogue est à 0 vue → sans ce filtre, bruit massif.

> ⚠️ **Divergence de chiffre à clarifier [À VÉRIFIER, ne pas lisser] :** le V0.12 indique « **44 % à 0 vue** » (Cogex FR mai) comme justification du plancher critique ; la spec v2 citait « **279 ASINs Cogex à 0 FO** » (≈ 20 % du catalogue ~1420) et « **51 % Gers FR à 0** ». Ces mesures ne portent vraisemblablement pas sur le même périmètre (catalogue entier vs actifs) ni la même maille. **À confirmer par Claude Code** lors du calcul de distribution (§12.1) — ne pas figer le plancher avant.

**Recalibrage [BACKLOG, non bloquant] :** ces seuils sont posés sur **Cogex FR mai uniquement**. Recalibrage sur **Gers** + **maille hebdo** différé post-accumulation. Les seuils restent **paramétrables** (pas de magie en dur) → ajustables sans refonte quand la distribution Gers sera mesurée.

---

## 6. Articulation 6 portes (méthodo V3 — inchangé)

Le tag **détecte**, les 6 portes + l'Agent BB **orientent/diagnostiquent**. Le tag ne présume pas la porte ; les renforçateurs (défauts, stock, BB 3P) pré-orientent les hypothèses BB candidates sans conclure. **Nuance (Agent BB, pas le tag) :** croiser FO views × ventes × conversion pour distinguer problème de **visibilité** (vues chutent) vs **conversion** (vues stables, ventes chutent).

---

## 7. Sortie — `a.suspectTag` [MODIFIÉ v2.1 : champ `trigger`]

```
a.suspectTag = {
  severity: 'crit'|'warn'|'opp'|null,
  direction: 'defensif'|'offensif'|null,
  trigger: 'zero_hebdo'|'chute_mensuelle'|'hausse_mensuelle'|null,  // composante déclencheuse (double composante §2)
  marketWorst: '<marché le plus dégradé>',
  foViewsCurrent: <int>,
  deltaMensuelPct: <float>,    // variation cumul mensuel glissant N vs N-1
  trend: 'up'|'flat'|'down',
  reinforcers: ['BOL Mismatch x3','stock dormant','BB 3P'],
  bbCandidates: ['BB-10','BB-8',...],   // pré-orientation, NON conclusive
  caExposed: <float>,
  computedAt: <semaine>
}
```

Le champ `trigger` trace **laquelle des deux composantes** a déclenché le tag — utile pour l'Agent BB en aval (un passage à 0 hebdo n'oriente pas les mêmes hypothèses qu'une dérive mensuelle).

---

## 8. Double usage [FERME — inchangé]

`direction` défensif (chute → Agent BB → case Amazon) / offensif (réveil → recommandation d'investissement). Même calcul, pente positive/négative. Teal = offensif, ambre/rouge = défensif.

---

## 9. Performance [FERME — leçon v3.7.6, inchangé]

Pré-calculé à l'import Traffic (pas au render). Stocker `a.suspectTag`, recalcul à chaque nouvel import. Mesurer sur Gers. **Historique réel disponible** (V0.12) : preprod ~5-6 sem, prod ~9-10 sem → le delta mensuel glissant est déjà calculable en prod.

---

## 10. Cas limites [FERME — adaptés double composante]

- **FO views = 0 sans aucune activité** → inactif, non taggé (filtre §4.1).
- **ASIN neuf** (< FENETRE) → « données insuffisantes », non classé ; mais un **passage à 0 hebdo** reste détectable dès ≥ 2 semaines (composante hebdo n'attend pas la fenêtre mensuelle complète).
- **Marché mineur** (GB/TR/SA…) → stocké, hors affichage par défaut.
- **`deltaPrevPct` absent** (1ʳᵉ semaine d'un ASIN) → utiliser la pente interne dès ≥ 2 points.
- **Bloc mensuel incomplet** (< 4 sem disponibles) → composante mensuelle = « partielle », la composante hebdo (passage à 0) reste pleinement active.

---

## 11. Ce que le tag NE fait PAS [limites négatives — inchangé]

- ❌ Ne diagnostique pas la cause (Agent BB).
- ❌ Ne conclut pas une hypothèse BB (pré-oriente seulement).
- ❌ Ne se calcule pas en live (pré-calcul import).
- ❌ Ne tague pas les ASINs inactifs (anti-bruit).
- ❌ N'utilise PAS de ratio FO/Glance (caduc — cf. §0).
- ❌ Ne fige PAS de seuil en dur — tout seuil est paramétrable (§5).

---

## 12. Récap — ce qui reste

1. **[mesurable, prérequis code]** Distribution réelle des `views`, du **passage à 0** (hebdo) et des variations **mensuelles glissantes** sur **Cogex + Gers** → confirme/affine `T_CHUTE` / `T_SURVEILLER` / `T_HAUSSE` / `FENETRE` / plancher, **et tranche la divergence 44 % vs 20 %/51 %** (§5). Mini-script d'analyse, pas de code produit.
2. **[Fred]** Validation de la structure (double composante, sortie `a.suspectTag` avec `trigger`) + des seuils provisoires.
3. **[à lister]** Marchés « opérés » affichés par défaut.
4. **[backlog]** Pondération des renforçateurs ; recalibrage hebdo + Gers ; reformulation « taux d'exposition » méthodo V3 (GPT).

---

*Prochaine étape : (1) Claude Code produit la distribution réelle (Cogex + Gers, double composante) → seuils fondés + divergence §5 tranchée. (2) Fred valide structure + seuils. (3) Le tag suspect entre dans le 1ᵉʳ brief de CODE v3.8 (pré-calcul import, sortie `a.suspectTag`). Aucune dépendance données bloquante.*

---

[Agent Orchestrateur] — Source : SPEC v2 (12 juin) + contexte canonique V0.12 + captures prod Cogex — Confiance : haute sur la structure (reports d'éléments actés) ; les seuils sont PROVISOIRES (calibration Cogex FR mai) et la divergence de chiffre du plancher est INCERTAINE, à trancher par mesure (§12.1)
