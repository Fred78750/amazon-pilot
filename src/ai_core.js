// Amazon Pilot — src/ai_core.js
// Bloc IA/API extrait de core.js (v3.7.3)
// Injecté via // @ai_core dans core.js (build.py)

async function callAPI(sys, usr, feature, tools, maxTokens, inputHash = null) {
  const modelKey = aiUsage.getModel(feature || 'revue');
  const modelId  = AI_MODELS[modelKey].id;
  const feat     = feature || 'revue';
  const tokLimit = maxTokens || 2500;

  // Tenter via Lambda (proxy IA avec comptabilité serveur)
  const idToken = localStorage.getItem('ap-id-token');
  if (idToken) {
    try {
      const lambdaBody = {
        model: modelId, max_tokens: tokLimit, system: sys,
        messages: [{ role: 'user', content: usr }], feature: feat,
      };
      if (tools) lambdaBody.tools = tools;
      if (inputHash) lambdaBody.inputHash = inputHash;
      const res = await fetch(API_BASE_URL + '/ai/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify(lambdaBody)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur Lambda');
      const tokIn  = data.usage?.input_tokens  || 0;
      const tokOut = data.usage?.output_tokens || 0;
      aiUsage.record(feat, modelKey, tokIn, tokOut);
      const textBlocks = (data.content || []).filter(b => b.type === 'text');
      return textBlocks.length ? textBlocks[textBlocks.length - 1].text : '';
    } catch(lambdaErr) {
      console.warn('[AI] Lambda fallback direct:', lambdaErr.message);
    }
  }

  // Mode direct (admin local sans token Cognito)
  const directBody = {
    model: modelId, max_tokens: tokLimit, system: sys,
    messages: [{ role: 'user', content: usr }]
  };
  if (tools) directBody.tools = tools;
  const directHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'
  };
  if (tools && tools.some(t => t.type && t.type.startsWith('web_search'))) {
    directHeaders['anthropic-beta'] = 'web-search-2025-03-05';
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: directHeaders,
    body: JSON.stringify(directBody)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Erreur API');
  const tokIn  = data.usage?.input_tokens  || 0;
  const tokOut = data.usage?.output_tokens || 0;
  aiUsage.record(feat, modelKey, tokIn, tokOut);
  const textBlocks = (data.content || []).filter(b => b.type === 'text');
  return textBlocks.length ? textBlocks[textBlocks.length - 1].text : '';
}

async function askClaude(sys, usr, feature) {
  if (!apiKey) return `__ERR_NOKEY__`;
  try {
    log('🤖 Appel Claude API...');
    const result = await callAPI(sys, usr, feature);
    log('✓ Réponse OK', 'ok');
    return result || 'Pas de réponse';
  } catch(e) {
    log('AI Error: ' + e.message, 'err');
    if (e.message.includes('Failed to fetch')) return `__ERR_CORS__`;
    if (e.message.includes('401')) return `__ERR_401__`;
    if (e.message.includes('403')) return `__ERR_403__`;
    if (e.message.includes('429')) return `__ERR_429__`;
    if (e.message.includes('529') || e.message.includes('503')) return `__ERR_529__`;
    return `__ERR_UNKNOWN__` + e.message;
  }
}

function isAIError(r) { return r && typeof r === 'string' && r.startsWith('__ERR_'); }

function renderAIError(code, retryFn) {
  const MSGS = {
    '__ERR_NOKEY__': { icon: '🔑', title: 'Clé API non configurée',
      body: 'Allez dans ⚙️ Configuration et entrez votre clé Anthropic (sk-ant-...).', retry: false },
    '__ERR_401__':   { icon: '🔑', title: 'Clé API invalide',
      body: 'Vérifiez votre clé dans ⚙️ Configuration.', retry: false },
    '__ERR_403__':   { icon: '🚫', title: 'Accès refusé (CORS)',
      body: "Utilisez l'app dans un Artifact Claude.ai.", retry: false },
    '__ERR_529__':   { icon: '⏱️', title: 'API momentanément surchargée',
      body: 'Les serveurs Anthropic sont très sollicités en ce moment. Un retry automatique a déjà été tenté. Réessayez dans quelques instants.', retry: true },
    '__ERR_429__':   { icon: '🔄', title: 'Limite de débit atteinte',
      body: 'Trop de requêtes consécutives. Attendez 30 secondes avant de réessayer.', retry: true },
    '__ERR_CORS__':  { icon: '🌐', title: 'Erreur de connexion',
      body: "Utilisez l'app dans un Artifact Claude.ai.", retry: false },
  };
  const key = Object.keys(MSGS).find(k => code.startsWith(k));
  const m = key ? MSGS[key] : { icon: '❌', title: 'Erreur inattendue',
    body: code.replace(/^__ERR_\d+__/, ''), retry: true };
  const btn = (m.retry && retryFn)
    ? `<button class="btn btn-sm" onclick="${retryFn}" style="flex-shrink:0;border-color:var(--r-bd);color:var(--r)">↻ Réessayer</button>`
    : '';
  return `<div style="display:flex;align-items:flex-start;gap:12px;padding:16px;background:var(--r-bg);border:1px solid var(--r-bd);border-radius:var(--rdl);margin-top:12px">
    <span style="font-size:22px;flex-shrink:0">${m.icon}</span>
    <div style="flex:1">
      <div style="font-weight:600;font-size:13px;margin-bottom:4px;color:var(--r)">${m.title}</div>
      <div style="font-size:12px;color:var(--tx2);line-height:1.6">${m.body}</div>
    </div>
    ${btn}
  </div>`;
}



// Construit le bloc contexte historique injecté dans les prompts IA
function buildAsinContext(a, c) {
  const deep = calcTrendDeep(a, c);
  const lines = [];

  lines.push('📈 CONTEXTE HISTORIQUE:');

  if (deep.ca2 !== null) {
    lines.push(`- ${deep.prev2Year}: ${fmtEur(deep.ca2)}`);
  }
  if (deep.ca1 !== null) {
    const delta = deep.ca2 ? ` (${parseFloat(((deep.ca1-deep.ca2)/deep.ca2*100).toFixed(1))>=0?'+':''}${((deep.ca1-deep.ca2)/deep.ca2*100).toFixed(1)}% vs ${deep.prev2Year})` : '';
    lines.push(`- ${deep.prevYear}: ${fmtEur(deep.ca1)}${delta}`);
  }
  if (deep.caYTD !== null) {
    const ytdPeriod = c.ytdData?.ventes?.periodEnd ? `01/01/${deep.curYear}→${c.ytdData.ventes.periodEnd}` : `YTD ${deep.curYear}`;
    const ytdDelta = deep.ytdVsN1 !== null ? ` (${deep.ytdVsN1>=0?'+':''}${deep.ytdVsN1}% vs même période ${deep.prevYear})` : '';
    lines.push(`- ${ytdPeriod}: ${fmtEur(deep.caYTD)}${ytdDelta}`);
  } else if (a.revenueYoY) {
    lines.push(`- YoY (fourni par Amazon): ${a.revenueYoY}`);
  }

  if (deep.shortTrend) {
    lines.push(`- Tendance court terme (${deep.shortTrend.n} semaines): ${deep.shortTrend.label} (pente ${deep.shortTrend.slope > 0 ? '+' : ''}${deep.shortTrend.slope.toFixed(1)}%/sem.)`);
  }

  lines.push(`- ⚡ Signal composite: ${deep.signal}`);

  if (!deep.hasLongData && !deep.yoyAmazon) {
    lines.push('- ⚠ Pas de données annuelles chargées — analyse limitée au court terme');
  }

  // Ajouter les 8 dernières semaines si disponibles
  if (a.history?.length > 0) {
    lines.push('');
    lines.push('📊 HISTORIQUE HEBDO (8 dernières semaines, plus récent en premier):');
    const recent = a.history.slice(-8).reverse();
    recent.forEach(h => {
      const period = h.periodStart ? h.periodStart.slice(0,5)+'→'+h.period.slice(0,5) : (h.period||'?');
      const stock = h.sellableUnits != null ? ' | Stock: '+h.sellableUnits+'u' : '';
      const delta = h.revenueDelta ? ' | Δ '+h.revenueDelta : '';
      lines.push(`  ${period}: ${fmtEur(h.revenue||0)} (${fmt(h.units||0)}u | GV: ${fmt(h.glanceViews||0)}${stock}${delta})`);
    });
  }

  // Synthèses mensuelles si disponibles
  if (a.historyMonthly?.length > 0) {
    lines.push('');
    lines.push('📆 SYNTHÈSES MENSUELLES (6 derniers mois):');
    a.historyMonthly.slice(-6).reverse().forEach(m => {
      lines.push(`  ${m.label}: ${fmtEur(m.revenue||0)} (${fmt(m.units||0)}u | ${m.weeks} sem. | Stock fin: ${m.sellableUnitsLast!=null?m.sellableUnitsLast+'u':'N/A'})`);
    });
  }

  // PPM Nette
  const ppmEntry = (c.ppmData||{})[a.asin];
  if (ppmEntry?.ppm != null) {
    lines.push('');
    lines.push('💰 PPM NETTE : ' + ppmEntry.ppm.toFixed(1) + '%'
      + (ppmEntry.ppmDeltaBps ? ' (Δ vs N-1 : ' + (ppmEntry.ppmDeltaBps > 0 ? '+' : '') + (ppmEntry.ppmDeltaBps/100).toFixed(2) + '%)' : '')
      + (ppmEntry.ppm < 5 ? ' — ⚠️ FAIBLE : risque de déréférencement Amazon' : ppmEntry.ppm >= 20 ? ' — ✓ Bonne marge' : ''));
  }

  // Prévisions Amazon
  const fcEntry = (c.forecastData||{})[a.asin];
  if (fcEntry?.weeks?.length >= 4) {
    const s1 = Math.round(fcEntry.weeks[1]||0);
    const s4avg = Math.round(((fcEntry.weeks[1]||0)+(fcEntry.weeks[2]||0)+(fcEntry.weeks[3]||0)+(fcEntry.weeks[4]||0))/4);
    lines.push('');
    lines.push('📊 PRÉVISIONS AMAZON (prochaines semaines) :');
    lines.push('  S+1 : ' + s1 + 'u prévues | Moy. S+1→S+4 : ' + s4avg + 'u/sem.');
    const velocite = a.history?.length >= 2 ? Math.round(a.history.slice(-4).reduce((s,h)=>s+(h.units||0),0)/Math.min(a.history.length,4)) : (getUnits(a,c)||0);
    if (velocite > 0) {
      const ratio = Math.round(s4avg/velocite*100);
      lines.push('  Vs vélocité actuelle (' + velocite + 'u) : ' + ratio + '%' + (ratio > 110 ? ' — Amazon anticipe une hausse' : ratio < 90 ? ' — Amazon anticipe une baisse' : ' — stable'));
    }
  }

  // POs actifs et statut fournisseur
  const poInfo = getPOsForAsin(a.asin, c);
  if (poInfo) {
    lines.push('');
    lines.push('📦 BONS DE COMMANDE EN COURS:');
    if (poInfo.ruptureTotal) {
      lines.push('  🚫 RUPTURE TOTALE FOURNISSEUR — Amazon a commandé mais rien accepté.');
    } else if (poInfo.rupturePartielle) {
      lines.push('  ⚠️ Rupture partielle fournisseur — taux d\'acceptation : '+poInfo.tauxAcceptation+'%');
    }
    if (poInfo.qtyEnTransit > 0) {
      lines.push('  Quantité en transit : '+poInfo.qtyEnTransit+'u');
      if (poInfo.prochainelivraison) {
        lines.push('  Prochaine livraison estimée : '+poInfo.prochainelivraison.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}));
      }
    }
    poInfo.alertesFournisseur.forEach(function(al){ lines.push('  '+al); });
  }

  return lines.join('\n');
}

// Construit le contexte global du compte pour le system prompt
function buildClientContext(c) {
  const curYear = new Date().getFullYear().toString();
  const prevYear = (parseInt(curYear) - 1).toString();
  const prev2Year = (parseInt(curYear) - 2).toString();
  const lines = [];

  const ca2 = c.annualData?.[prev2Year]?.ventes?.totalCA;
  const ca1 = c.annualData?.[prevYear]?.ventes?.totalCA;
  const caYTD = c.ytdData?.ventes?.totalCA;
  const gv1 = c.annualData?.[prevYear]?.trafic?.totalGV;
  const gvYTD = c.ytdData?.trafic?.totalGV;

  if (ca2 || ca1 || caYTD) {
    lines.push('\n📅 CONTEXTE COMPTE (données historiques):');
    if (ca2) lines.push(`- CA ${prev2Year}: ${fmtEur(ca2)}`);
    if (ca1) {
      const d = ca2 ? ` (${ca2>0?(((ca1-ca2)/ca2*100)>=0?'+':'')+((ca1-ca2)/ca2*100).toFixed(1)+'% vs '+prev2Year:'N/A'})` : '';
      lines.push(`- CA ${prevYear}: ${fmtEur(ca1)}${d}`);
    }
    if (caYTD) {
      const ytdEnd = c.ytdData?.ventes?.periodEnd || "aujourd'hui";
      const d = ca1 && c.ytdData?.ventes?.periodStart && c.ytdData?.ventes?.periodEnd ? (() => {
        const [ds,ms,ys] = (c.ytdData.ventes.periodStart).split('/').map(Number);
        const [de,me,ye] = (c.ytdData.ventes.periodEnd).split('/').map(Number);
        const days = Math.round((new Date(ye,me-1,de)-new Date(ys,ms-1,ds))/86400000);
        const prorata = ca1 * days/365;
        return prorata > 0 ? ` (${((caYTD-prorata)/prorata*100)>=0?'+':''}${((caYTD-prorata)/prorata*100).toFixed(1)}% vs même période ${prevYear})` : '';
      })() : '';
      lines.push(`- CA YTD ${curYear} (01/01→${ytdEnd}): ${fmtEur(caYTD)}${d}`);
    }
    if (gv1) lines.push(`- GV ${prevYear}: ${fmt(gv1)}`);
    if (gvYTD) lines.push(`- GV YTD ${curYear}: ${fmt(gvYTD)}`);

    // Top catégories en croissance/déclin depuis les données annuelles
    if (ca1 && c.annualData?.[prevYear]?.ventes?.asins && c.asins?.length) {
      const annAsins = c.annualData[prevYear].ventes.asins;
      const currentAsins = c.asins.filter(a => (getRevenue(a,c)||0) > 0);
      const totalCur = currentAsins.reduce((s,a) => s+(getRevenue(a,c)||0), 0);
      // Comparer les marques
      const brandGrowth = {};
      currentAsins.forEach(a => {
        if (!a.brand) return;
        const annVal = annAsins[a.asin] ? parseNum(annAsins[a.asin].revenue) : 0;
        if (!brandGrowth[a.brand]) brandGrowth[a.brand] = { cur: 0, prev: 0 };
        brandGrowth[a.brand].cur += getRevenue(a,c)||0;
        brandGrowth[a.brand].prev += annVal;
      });
      const topBrands = Object.entries(brandGrowth)
        .filter(([,v]) => v.cur > 500 && v.prev > 0)
        .map(([b,v]) => ({ brand: b, pct: (v.cur-v.prev)/v.prev*100 }))
        .sort((a,b) => Math.abs(b.pct)-Math.abs(a.pct))
        .slice(0, 4);
      if (topBrands.length) {
        lines.push(`- Dynamique marques vs ${prevYear}: ` + topBrands.map(b => `${b.brand} ${b.pct>=0?'+':''}${b.pct.toFixed(0)}%`).join(', '));
      }
    }
  }

  return lines.join('\n');
}

function getSysPrompt(c) {
  const cs = [];
  if (!c.stockDeporte) cs.push('Stock déporté INTERDIT');
  if (c.btr === 'Conditionnel') cs.push('Born to Run CONDITIONNEL');
  if (c.btr === 'Interdit') cs.push('Born to Run INTERDIT');
  if (!c.threeP) cs.push('3P / Seller Central INTERDIT');

  const clientCtx = buildClientContext(c);

  return `Tu es un expert Amazon Vendor Central. Tu analyses les performances et formules des recommandations concrètes et actionnables.

CLIENT: ${c.name}
MODÈLE: ${c.model}
MARCHÉS: ${c.markets.join(', ')}
CONTRAINTES: ${cs.join(', ') || 'Aucune'}${clientCtx}

RÈGLES ABSOLUES:
- Ne recommande JAMAIS un levier interdit par les contraintes
- Priorise par impact CA potentiel
- Distingue toujours tendance court terme vs tendance structurelle longue
- Un creux ponctuel sur fond haussier n'est PAS une alarme — dis-le explicitement
- Un rebond court sur fond baissier structurel reste un risque — dis-le aussi
- Quand des données historiques sont disponibles, base tes recommandations dessus
- Réponds en français, structure avec des émojis, sois concis et actionnable`;
}

async function runAsinAI(asin) {
  const c = cl();
  if (!c) return;
  const a = c.asins.find(x => x.asin === asin);
  if (!a) return;
  aiLoading = true; aiResult = ''; selectedAsin = asin; render();
  const totalCA = c.asins.reduce((s,x) => s+(getRevenue(x,c)||0), 0);
  const seg = calcSegment(a, totalCA, c);
  const health = calcHealth(a);
  const deep = calcTrendDeep(a, c);
  const histCtx = buildAsinContext(a, c);

  const prompt = `ANALYSE ASIN DÉTAILLÉE

📦 ${a.title||'N/A'}
ASIN: ${a.asin} | Marque: ${a.brand||'N/A'} | Marché: ${a.market||'.fr'}
Segment: ${seg} | Health Score: ${health}/100

📊 MÉTRIQUES PÉRIODE EN COURS:
- CA: ${fmtEur(getRevenue(a,c)||0)} (Δ période: ${a.revenueDelta||'N/A'})
- Unités: ${fmt(getUnits(a,c)||0)} (Δ ${a.unitsDelta||'N/A'})
- Glance Views: ${fmt(a.glanceViews||0)} (Δ GV: ${a.gvDelta||'N/A'})
- Stock vendable: ${a.sellableUnits!=null?a.sellableUnits+'u':'N/A'} | Malsain: ${a.unhealthyUnits||0}u
- Retail %: ${a.retailPct||'N/A'} | Confirm %: ${a.confirmPct||'N/A'}
- Retours: ${a.returns||0}

${histCtx}

🎯 ANALYSE DEMANDÉE:
1) Diagnostic santé en tenant compte de la trajectoire longue (pas seulement la période)
2) Signal principal : le mouvement actuel est-il structurel ou ponctuel ?
3) Recommandations (max 3) adaptées à la tendance de fond
4) Points de vigilance spécifiques à ce profil d'ASIN`;

  aiResult = await askClaude(getSysPrompt(c), prompt);
  aiLoading = false; render();
}
