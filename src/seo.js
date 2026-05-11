// Amazon Pilot — Module Agent SEO
// Extrait automatiquement — ne pas éditer directement

function seoGetPendingVerifications() {
  var c = cl();
  if (!c || !c.ficheOptimisee) return [];
  var now = new Date();
  var pending = [];
  Object.entries(c.ficheOptimisee).forEach(function(entry) {
    var asin = entry[0]; var fiche = entry[1];
    (fiche.actions || []).forEach(function(action) {
      if (action.verified === null && action.verificationDue && new Date(action.verificationDue) < now) {
        pending.push({ asin: asin, action: action });
      }
    });
  });
  return pending;
}


// ── Fonctions SEO utilitaires ──────────────────────────────────
function seoGetStatus(asin, c) {
  var fiche = c.ficheOptimisee && c.ficheOptimisee[asin];
  if (!fiche) return 'none';
  var actions = fiche.actions || [];
  if (!actions.length) return 'generated';
  var last = actions[actions.length - 1];
  if (last.verified === true) return 'verified';
  if (last.verified === false) return 'failed';
  if (last.verificationDue && new Date(last.verificationDue) < new Date()) return 'overdue';
  if (last.submittedAt) return 'submitted';
  return 'generated';
}

function seoStatusLabel(status) {
  var map = {
    none:      { label: 'Non optimisé',          color: 'var(--tx3)', icon: '' },
    generated: { label: 'Fiche générée',          color: 'var(--accent)', icon: '✍️' },
    submitted: { label: 'Soumis VC',              color: '#2196F3', icon: '📤' },
    overdue:   { label: 'Vérification en attente', color: 'var(--or)', icon: '⏰' },
    verified:  { label: 'Conforme',               color: 'var(--g)', icon: '✅' },
    failed:    { label: 'Non conforme',           color: 'var(--r)', icon: '❌' }
  };
  return map[status] || map.none;
}

function seoRecordAction(asin, route, supplierCodes, markets) {
  var c = cl();
  if (!c) return;
  if (!c.ficheOptimisee) c.ficheOptimisee = {};
  if (!c.ficheOptimisee[asin]) c.ficheOptimisee[asin] = {};
  if (!c.ficheOptimisee[asin].actions) c.ficheOptimisee[asin].actions = [];
  var now = new Date();
  var verDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  c.ficheOptimisee[asin].actions.push({
    route: route,
    supplierCodes: supplierCodes || [],
    markets: markets || [],
    submittedAt: now.toISOString(),
    verificationDue: verDue.toISOString(),
    verifiedAt: null,
    verified: null,
    diff: null,
    caseId: null,
    caseStatus: null
  });
  save();
  showToast('Action enregistrée — vérification prévue dans 24h', 'alr-b');
  render();
}

function buildVCModifyPrompt(asin, market, fiche, c, sku, vc) {
  var mkt = market || '.fr';
  var ficheData = (typeof seoResults !== 'undefined' && seoResults[asin] && seoResults[asin][mkt])
    ? seoResults[asin][mkt] : (c && c.ficheOptimisee && c.ficheOptimisee[asin] && c.ficheOptimisee[asin][mkt] ? c.ficheOptimisee[asin][mkt] : {});
  var backendKW = (ficheData.backendKW || fiche.backendKW || '')
    .replace(/\*\*/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 249);
  var description = ficheData.description || fiche.description || '';
  var bullets = fiche.bullets || ficheData.bullets || ['', '', '', '', ''];
  var titre = fiche.titre || ficheData.titre || '';

  var lines = [
    'NE PRENDS AUCUN SCREENSHOT. Travaille uniquement en JS via la console.',
    'Si une erreur image apparaît, ignore-la et continue.',
    '',
    'Tu vas modifier la fiche ' + asin + ' sur Vendor Central France.',
    '',
    '== ÉTAPE 1 — CATALOGUE ==',
    'Navigue vers vendorcentral.amazon.fr/vendor/members/products/catalog',
    'Recherche par ASIN : ' + asin,
    'IMPORTANT : attends que le compteur "X - X sur X résultats" se stabilise avant de lire les résultats.',
    'Lis TOUS les résultats visibles (pas seulement le premier) et construis un tableau :',
    '  vendorEntries = [ {vendorCode: "COGEX", sku: "647808"}, {vendorCode: "COJFI", sku: "647808"}, ... ]',
    'Si vendorEntries.length === 0 → stop, signale "ASIN introuvable dans le catalogue".',
    'Si vendorEntries.length > 2 → alerte "risque vieux listings — attends GO explicite avant de continuer".',
    'Si vendorEntries.length >= 1 → enchaîne ÉTAPE 2 pour CHAQUE entry du tableau.',
    '',
    '== ÉTAPE 2 — POUR CHAQUE VENDOR CODE ==',
    '',
    '2a. Construis l\'URL :',
    'https://vendorcentral.amazon.fr/abis/listing/edit/product_details?sku=[SKU_LU]&asin=' + asin + '&vendorCode=[VC_LU]#product_details',
    'Navigue. Attends que textarea[name="item_name-0-value"] soit dans le DOM.',
    'Si erreur page → signale "intervention manuelle nécessaire pour [VC_LU]" → passe au suivant.',
    '',
    '2b. Exécute ce bloc JS en une seule fois dans la console :',
    '',
    '(function() {',
    '  var origOpen = XMLHttpRequest.prototype.open;',
    '  var origSend = XMLHttpRequest.prototype.send;',
    '  window._lastXHRResponse = null;',
    '  XMLHttpRequest.prototype.open = function(m, url) {',
    '    this._url = url; return origOpen.apply(this, arguments);',
    '  };',
    '  XMLHttpRequest.prototype.send = function(body) {',
    '    var self = this;',
    '    this.addEventListener(\'load\', function() {',
    '      if (self._url && self._url.includes(\'abis\'))',
    '        window._lastXHRResponse = { status: self.status, response: self.responseText };',
    '    });',
    '    return origSend.apply(this, arguments);',
    '  };',
    '  // Intercepte XHR ET fetch pour détecter SUCCESS',
    '  var origFetch = window.fetch;',
    '  window.fetch = function(url, opts) {',
    '    return origFetch.apply(this, arguments).then(function(resp) {',
    '      if (url && url.toString().includes(\'abis/ajax/edit\')) {',
    '        resp.clone().json().then(function(data) {',
    '          if (data && data.status === \'SUCCESS\') {',
    '            window._lastXHRResponse = { status: 200, response: JSON.stringify(data) };',
    '            console.log(\'[VC SUCCESS via fetch] submissionSku:\', data.submissionSku);',
    '          }',
    '        }).catch(function(){});',
    '      }',
    '      return resp;',
    '    });',
    '  };',
    '',
    '  function fillAndBlur(name, val) {',
    '    var el = document.querySelector("kat-textarea[name=\'" + name + "\'], kat-input[name=\'" + name + "\']");',
    '    if (!el) { console.warn("NON TROUVÉ:", name); return; }',
    '    var inner = el.shadowRoot',
    '      ? (el.shadowRoot.querySelector(\'textarea\') || el.shadowRoot.querySelector(\'input\'))',
    '      : null;',
    '    if (!inner) { console.warn("INNER NON TROUVÉ:", name); return; }',
    '    inner.focus(); inner.click();',
    '    document.execCommand(\'selectAll\');',
    '    document.execCommand(\'delete\');',
    '    document.execCommand(\'insertText\', false, val);',
    '    inner.blur();',
    '    el.dispatchEvent(new Event(\'blur\', { bubbles: true }));',
    '    console.log("OK:", name, "→", (val||"").substring(0, 40));',
    '  }',
    '',
    '  function clickAddMore() {',
    '    var bulletGroup = null;',
    '    document.querySelectorAll(".attributeGroup").forEach(function(g) {',
    '      if (g.querySelector("kat-textarea[name*=\'bullet_point\']")) bulletGroup = g;',
    '    });',
    '    var katLink = bulletGroup ? bulletGroup.querySelector("kat-link") : null;',
    '    if (katLink && katLink.shadowRoot) {',
    '      var anchor = katLink.shadowRoot.querySelector("a");',
    '      if (anchor) { anchor.click(); return true; }',
    '    }',
    '    return false;',
    '  }',
    '',
    '  function checkErrors() {',
    '    var errors = [];',
    '    document.querySelectorAll("[class*=\'error\']").forEach(function(el) {',
    '      var t = el.textContent.trim();',
    '      if (t) errors.push(t);',
    '    });',
    '    return errors;',
    '  }',
    '',
    '  function save() {',
    '    document.querySelectorAll("kat-button").forEach(function(btn) {',
    '      if (btn.getAttribute(\'label\') === "Enregistrer et terminer") {',
    '        var ib = btn.shadowRoot && btn.shadowRoot.querySelector("button");',
    '        if (ib) ib.click();',
    '      }',
    '    });',
    '    setTimeout(function() {',
    '      var r = window._lastXHRResponse;',
    '      if (r && r.response.includes(\'"SUCCESS"\')) {',
    '        console.log("✅ SAUVEGARDE RÉUSSIE — vendor code traité.");',
    '      } else {',
    '        console.log("❌ ÉCHEC:", r ? r.response.substring(0, 200) : "pas de réponse XHR");',
    '      }',
    '    }, 3000);',
    '  }',
    '',
    '  function fillAll() {',
    '    fillAndBlur("item_name-0-value", ' + JSON.stringify(titre) + ');',
    '    fillAndBlur("bullet_point-0-value", ' + JSON.stringify(bullets[0] || '') + ');',
    '    fillAndBlur("bullet_point-1-value", ' + JSON.stringify(bullets[1] || '') + ');',
    '    fillAndBlur("bullet_point-2-value", ' + JSON.stringify(bullets[2] || '') + ');',
    '    fillAndBlur("bullet_point-3-value", ' + JSON.stringify(bullets[3] || '') + ');',
    '    fillAndBlur("bullet_point-4-value", ' + JSON.stringify(bullets[4] || '') + ');',
    '    fillAndBlur("rtip_product_description-0-value", ' + JSON.stringify(description) + ');',
    '    fillAndBlur("generic_keyword-0-value", ' + JSON.stringify(backendKW.substring(0, 249)) + ');',
    '    setTimeout(function() {',
    '      var errors = checkErrors();',
    '      if (errors.length) {',
    '        console.log("⚠️ ERREURS DÉTECTÉES — sauvegarde annulée :");',
    '        errors.forEach(function(e) { console.log("→", e); });',
    '        console.log("Signale ces erreurs à Fred avant de continuer.");',
    '      } else {',
    '        console.log("✅ Aucune erreur — sauvegarde en cours...");',
    '        save();',
    '      }',
    '    }, 1000);',
    '  }',
    '',
    '  var clicks = 0;',
    '  function doClick() {',
    '    if (clicks < 4) { clickAddMore(); clicks++; setTimeout(doClick, 400); }',
    '    else setTimeout(fillAll, 2500);',
    '  }',
    '  doClick();',
    '})();',
    '',
    '== ÉTAPE 3 — BILAN ==',
    'Liste vendor codes traités + statut succès/erreur.',
  ];

  return lines.join('\n');
}


function seoGetScriptVerify(asin, market, fiche) {
  var mkt = fiche[market] || fiche['.fr'] || {};
  var bullets = mkt.bullets || [];
  var lines = [
    'Tu es l\'agent de verification SEO.',
    'ASIN : ' + asin,
    'Marche : amazon' + market,
    '',
    'Instructions :',
    '1. Ouvre https://www.amazon' + market + '/dp/' + asin,
    '2. Lis le titre actuel et les 5 bullets',
    '3. Compare avec les valeurs attendues ci-dessous',
    '4. Rapporte : CONFORME ou NON CONFORME avec les differences',
    '',
    'Titre attendu : ' + (mkt.titre || ''),
    'Bullet 1 attendu : ' + (bullets[0] || ''),
    'Bullet 2 attendu : ' + (bullets[1] || ''),
    'Bullet 3 attendu : ' + (bullets[2] || ''),
    'Bullet 4 attendu : ' + (bullets[3] || ''),
    'Bullet 5 attendu : ' + (bullets[4] || '')
  ];
  return lines.join('\n');
}
function seoLaunchModify(asin) {
  var c = cl();
  if (!c) return;
  var vcs = (c.vendorCodes && c.vendorCodes.length) ? c.vendorCodes : (c.vendorCode ? [c.vendorCode] : []);
  if (typeof goAgentVC === 'function') { goAgentVC(asin); return; }
}


function seoLaunchCreate(asin) {
  var c = cl();
  if (!c) return;
  var fiche = c.ficheOptimisee && c.ficheOptimisee[asin];
  if (!fiche) { showToast('Générez d\'abord la fiche SEO', 'alr-r'); return; }
  var mkt = fiche['.fr'] || {};
  var bullets = mkt.bullets || ['', '', '', '', ''];
  var lines = [
    'Tu es l\'agent SEO Amazon Pilot.',
    'Nouvelle référence à créer dans Vendor Central.',
    '',
    'Données produit :',
    'Titre : ' + (mkt.titre || ''),
    'Type produit : ' + (mkt.nomType || ''),
    'Bullet 1 : ' + (bullets[0] || ''),
    'Bullet 2 : ' + (bullets[1] || ''),
    'Bullet 3 : ' + (bullets[2] || ''),
    'Bullet 4 : ' + (bullets[3] || ''),
    'Bullet 5 : ' + (bullets[4] || ''),
    'Description : ' + (mkt.description || ''),
    '',
    'Instructions :',
    '1. Ouvre Vendor Central > Catalogue > Ajouter un produit',
    '2. Sélectionne la catégorie : ' + (mkt.nomType || ''),
    '3. Remplis tous les champs avec les données ci-dessus',
    '4. Soumets la création',
    '5. Rapporte l\'ASIN créé ou l\'erreur'
  ];
  var script = lines.join('\n');
  navigator.clipboard.writeText(script).then(function() {
    showToast('Script Route A copié — collez dans Claude in Chrome sur Vendor Central', 'alr-g');
    seoRecordAction(asin, 'create', [], c.markets || [c.mainMarket || '.fr']);
  });
}
function seoLaunchVerify(asin) {
  var c = cl();
  if (!c) return;
  var fiche = c.ficheOptimisee && c.ficheOptimisee[asin];
  if (!fiche) return;
  var market = c.mainMarket || '.fr';
  var script = seoGetScriptVerify(asin, market, fiche);
  navigator.clipboard.writeText(script).then(function() {
    showToast('Script vérification copié — collez dans Claude in Chrome sur Amazon', 'alr-g');
  });
}

function seoOpenCase(asin) {
  var c = cl();
  if (!c) return;
  var fiche = c.ficheOptimisee && c.ficheOptimisee[asin];
  if (!fiche) return;
  var lastAction = fiche.actions && fiche.actions.length ? fiche.actions[fiche.actions.length-1] : null;
  var lines = [
    'DEMANDE DE CAS SUPPORT AMAZON',
    '',
    'ASIN : ' + asin,
    'Supplier Codes : ' + (lastAction && lastAction.supplierCodes ? lastAction.supplierCodes.join(', ') : 'N/D'),
    'Date de soumission : ' + (lastAction && lastAction.submittedAt ? new Date(lastAction.submittedAt).toLocaleDateString('fr-FR') : 'N/D'),
    '',
    'PROBLEME :',
    'Les modifications soumises via Vendor Central n\'ont pas été appliquées après 24h.',
    '',
    'MODIFICATIONS SOUMISES :',
    'Titre : ' + ((fiche['.fr'] && fiche['.fr'].titre) || ''),
    '',
    'ACTION DEMANDEE :',
    'Merci d\'appliquer les modifications ou d\'indiquer la raison du blocage.'
  ];
  navigator.clipboard.writeText(lines.join('\n')).then(function() {
    showToast('Dossier cas support copié', 'alr-g');
  });
}
function copySEOField(asin, mkt, field) {
  var res = seoResults[asin] || {};
  var text = '';
  if (field === 'backendKW') {
    text = res.backendKW || (res[mkt] && res[mkt].backendKW) || '';
  } else if (field === 'all') {
    var r = res[mkt] || {};
    var parts = [];
    if (r.titre) parts.push('TITRE:\n' + r.titre);
    if (r.bullets && r.bullets.length) parts.push('BULLETS:\n' + r.bullets.filter(Boolean).join('\n'));
    if (r.description) parts.push('DESCRIPTION:\n' + r.description);
    if (res.backendKW) parts.push('BACKEND KW:\n' + res.backendKW);
    text = parts.join('\n\n');
  } else if (res[mkt]) {
    if (field === 'titre') text = res[mkt].titre || '';
    else if (field === 'description') text = res[mkt].description || '';
    else if (field.startsWith('bullet')) {
      var idx = parseInt(field.replace('bullet', '')) - 1;
      text = (res[mkt].bullets || [])[idx] || '';
    }
  }
  if (!text) { showToast('Rien à copier', 'alr-r'); return; }
  navigator.clipboard.writeText(text).then(function() {
    showToast('Copié !', 'alr-g');
  });
}

// ── Score SEO défaillant ────────────────────────────────────────
function calcSEODefaillance(a, c) {
  const asins = c.asins || [];
  const totalCA = asins.reduce(function(s,x){ return s+(getRevenue(x,c)||0); }, 0);
  const seg = calcSegment(a, totalCA);
  const gvList = asins.map(function(x){ return x.glanceViews||0; }).filter(function(v){ return v>0; }).sort(function(a,b){return a-b;});
  const medGV = gvList.length ? gvList[Math.floor(gvList.length/2)] : 0;
  const units = getUnits(a,c)||0;
  const gv = a.glanceViews || 0;
  const convRate = (gv > 0) ? units/gv : 0;
  const convList = asins.map(function(x){ return (x.glanceViews&&x.units) ? x.units/x.glanceViews : 0; }).filter(function(v){return v>0;}).sort(function(a,b){return a-b;});
  const medConv = convList.length ? convList[Math.floor(convList.length/2)] : 0;
  const revDelta = parseNum(a.revenueDelta) || 0;
  const gvDelta  = parseNum(a.gvDelta)     || 0;
  const retailPct = parseNum(a.retailPct)  || 100;
  const sellable = a.sellableUnits != null ? a.sellableUnits : 999;
  const hasFiche = !!(c.ficheOptimisee && c.ficheOptimisee[a.asin]);

  var score = 0;
  if (gv > 0 && gv < medGV * 0.6)                score += 2; // trafic très faible vs catalogue
  if (revDelta <= -10 && gvDelta <= -10)           score += 2; // perte organique
  if (!hasFiche)                                   score += 1; // jamais traité
  if (retailPct < 50)                              score += 1; // Amazon ne met pas en avant
  if (seg === 'A' || seg === 'B')                  score += 1; // priorité commerciale
  if (sellable < 10)                               score -= 2; // exclure : rupture stock
  if (convRate > medConv * 1.2)                    score -= 1; // produit convertit bien, SEO ok
  if (getRevenue(a,c) === 0)                        score -= 1; // pas de ventes = hors scope

  if (score >= 4) return 'critical';   // 🔴
  if (score >= 2) return 'watch';      // 🟡
  return 'ok';                          // ⚪
}

// ── Drawer SEO ──────────────────────────────────────────────────
function openSEODrawer(asin) {
  seoLoading = false; // reset au cas où état corrompu
  seoDrawerAsin = asin;
  var c = cl();
  if (!c) return;
  // Si fiche déjà en mémoire, l'utiliser
  if (!seoResults[asin] && c.ficheOptimisee && c.ficheOptimisee[asin]) {
    seoResults[asin] = c.ficheOptimisee[asin];
  }
  var hasFiche = !!seoResults[asin];
  renderSEODrawer();
  if (!hasFiche) runSEOFiche(asin, seoActiveTab || (c.mainMarket || '.fr'), seoMotcle[asin] || extractSearchKeyword(asin, c));
}

function closeSEODrawer() {
  seoDrawerAsin = null;
  seoLoading = false;
  var d = document.getElementById('seo-drawer');
  if (d) {
    d.style.transform = 'translateX(100%)';
    setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 280);
  }
}

function renderSEODrawer() {
  var existing = document.getElementById('seo-drawer');
  if (existing) existing.parentNode.removeChild(existing);

  var asin = seoDrawerAsin;
  if (!asin) return;
  var c = cl();
  if (!c) return;
  var a = c.asins.find(function(x){ return x.asin === asin; });
  if (!a) return;

  var drawer = document.createElement('div');
  drawer.id = 'seo-drawer';
  drawer.style.cssText = 'position:fixed;top:0;right:0;width:520px;max-width:95vw;height:100vh;background:var(--s1);border-left:1px solid var(--bd2);box-shadow:-4px 0 24px rgba(0,0,0,.15);z-index:250;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .28s cubic-bezier(.4,0,.2,1)';
  document.body.appendChild(drawer);
  setTimeout(function(){ drawer.style.transform = 'translateX(0)'; }, 10);

  refreshSEODrawer();
}

// ── Agent VC State ─────────────────────────────────────────────
var agentVCState = {
  asin: null, title: '', market: null, vcCode: '', sku: '',
  step: 1, isNew: false,
  newRef: '', newBrand: '', newName: '', newCat: '', newEan: '',
  newFormVisible: false,
  expandedSteps: new Set()
};

function avcToggleStep(n) {
  if (!agentVCState.expandedSteps) agentVCState.expandedSteps = new Set();
  if (agentVCState.expandedSteps.has(n)) agentVCState.expandedSteps.delete(n);
  else agentVCState.expandedSteps.add(n);
  render();
}

function renderAgentVC() {
  var c = cl();
  if (!c) return '<div style="padding:24px" class="alr alr-r">Aucun client sélectionné.</div>';

  if (agentVCParam !== null) {
    var initAsin = agentVCParam;
    agentVCParam = null;
    agentVCState = { asin: null, title: '', market: null, vcCode: '', sku: '',
      step: 1, isNew: false, newRef: '', newBrand: '', newName: '',
      newCat: '', newEan: '', newFormVisible: false, expandedSteps: new Set() };
    if (initAsin) {
      agentVCState.asin = initAsin;
      var _a = c.asins.find(function(x){ return x.asin === initAsin; });
      if (_a) {
        agentVCState.title = _a.title || initAsin;
        agentVCState.market = c.mainMarket || '.fr';
        agentVCState.vcCode = c.vendorCode || '';
        agentVCState.step = (agentVCState.market && agentVCState.vcCode) ? 3 : 2;
      }
    }
  }

  var s = agentVCState;
  var vendorCodes = (c.vendorCodes && c.vendorCodes.length) ? c.vendorCodes : (c.vendorCode ? [c.vendorCode] : []);

  var h = '<div style="padding:20px 24px;max-width:680px">';
  h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">';
  h += '<button class="btn btn-sm" onclick="go(\'seo\')">← Retour</button>';
  h += '<div style="font-size:16px;font-weight:700">🚀 Agent SEO + Vendor Central</div>';
  h += '</div>';

  // ── ÉTAPE 1 — ASIN ──
  var step1Done = !!s.asin;
  var step1Open = s.step === 1 || (step1Done && s.expandedSteps && s.expandedSteps.has(1));
  h += avcStepWrap(1, s.step, 'Saisir l\'ASIN', step1Done ? (s.isNew ? '✨ Nouvel article — ' : '') + s.asin + (s.title ? ' — ' + s.title.substring(0,40) + '…' : '') : 'ASIN existant ou nouvelle référence à créer', step1Open);
  if (step1Open) {
    h += '<div style="display:flex;gap:8px;margin-bottom:10px">';
    h += '<input id="avc-asin-input" class="inp" style="flex:1;font-family:var(--mono);letter-spacing:.05em" placeholder="B0XXXXXXXXX" maxlength="10" value="' + esc(s.asin || '') + '" oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key===\'Enter\')avcLookupAsin()">';
    h += '<button class="btn btn-p" onclick="avcLookupAsin()">🔍 Rechercher</button>';
    h += '</div>';
    h += '<div id="avc-asin-error" style="display:none;font-size:11px;color:var(--r);margin-bottom:8px">❌ ASIN non trouvé. Vérifiez ou créez un nouvel article.</div>';
    h += '<button class="btn btn-sm" style="border-style:dashed" onclick="avcToggleNewForm()">➕ Créer un nouvel article</button>';
    if (s.newFormVisible) {
      h += '<div style="margin-top:12px;padding:14px;background:var(--s2);border:1.5px dashed var(--bd2);border-radius:var(--rd)">';
      h += '<div style="font-size:12px;font-weight:700;margin-bottom:10px">📦 Nouvel article</div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
      h += '<div><div style="font-size:10px;font-weight:700;color:var(--tx3);margin-bottom:4px">RÉFÉRENCE *</div><input class="inp" id="avc-new-ref" placeholder="Ex: 043902" value="' + esc(s.newRef||'') + '" oninput="agentVCState.newRef=this.value;avcCheckNew()"></div>';
      h += '<div><div style="font-size:10px;font-weight:700;color:var(--tx3);margin-bottom:4px">MARQUE *</div><input class="inp" id="avc-new-brand" placeholder="Ex: COGEX" value="' + esc(s.newBrand||'') + '" oninput="agentVCState.newBrand=this.value;avcCheckNew()"></div>';
      h += '</div>';
      h += '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:var(--tx3);margin-bottom:4px">NOM PRODUIT *</div><input class="inp" id="avc-new-name" placeholder="Ex: Tenaille Russe 200mm" style="width:100%" value="' + esc(s.newName||'') + '" oninput="agentVCState.newName=this.value;avcCheckNew()"></div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
      h += '<div><div style="font-size:10px;font-weight:700;color:var(--tx3);margin-bottom:4px">CATÉGORIE</div><input class="inp" id="avc-new-cat" placeholder="Ex: Outillage à main" value="' + esc(s.newCat||'') + '" oninput="agentVCState.newCat=this.value"></div>';
      h += '<div><div style="font-size:10px;font-weight:700;color:var(--tx3);margin-bottom:4px">EAN (optionnel)</div><input class="inp" id="avc-new-ean" style="font-family:var(--mono)" placeholder="3700000000000" value="' + esc(s.newEan||'') + '" oninput="agentVCState.newEan=this.value"></div>';
      h += '</div>';
      h += '<button class="btn btn-p" id="avc-new-go" disabled onclick="avcConfirmNew()">✨ Créer et générer la fiche SEO</button>';
      h += '</div>';
    }
  }
  h += '</div></div>';

  // ── ÉTAPE 2 — MARCHÉ ──
  if (s.step >= 2) {
    var step2Done = !!s.market;
    var step2Open = s.step === 2 || (step2Done && s.expandedSteps && s.expandedSteps.has(2));
    var mktLabel = s.market ? ((MARKET_LANG[s.market] && MARKET_LANG[s.market].flag) || '') + ' ' + s.market : '';
    h += avcStepWrap(2, s.step, 'Marché cible', step2Done ? mktLabel : 'Sur quel Amazon modifier la fiche ?', step2Open);
    if (step2Open) {
      var markets = c.markets && c.markets.length ? c.markets : [c.mainMarket || '.fr'];
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">';
      markets.forEach(function(mkt) {
        var ml = MARKET_LANG[mkt];
        h += '<button class="btn' + (s.market === mkt ? ' btn-p' : '') + '" onclick="agentVCState.market=' + JSON.stringify(mkt) + ';render()">';
        h += (ml && ml.flag ? ml.flag : '') + ' ' + mkt + '</button>';
      });
      h += '</div>';
      h += '<button class="btn btn-p" ' + (!s.market ? 'disabled' : '') + ' onclick="avcConfirmMarket()">Confirmer →</button>';
    }
    h += '</div></div>';
  }

  // ── ÉTAPE 3 — VENDOR CODE + SKU ──
  if (s.step >= 3) {
    var step3Done = !!s.sku;
    var step3Open = s.step === 3 || (step3Done && s.expandedSteps && s.expandedSteps.has(3));
    var vcLabel = step3Done ? vendorCodes.map(function(vc){ return vc; }).join(' + ') + ' — SKU : ' + s.sku : 'Vendor code et SKU requis';
    h += avcStepWrap(3, s.step, 'Vendor Code & SKU', vcLabel, step3Open);
    if (step3Open) {
      if (!vendorCodes.length) {
        h += '<div class="alr alr-y" style="margin-bottom:10px">⚠️ Aucun vendor code configuré sur ce client. Renseignez-le dans Fiche client.</div>';
      } else {
        h += '<div style="margin-bottom:10px;font-size:12px;color:var(--tx2)">Vendor code(s) : <strong>' + vendorCodes.map(esc).join(', ') + '</strong></div>';
      }
      h += '<div style="margin-bottom:6px"><div style="font-size:10px;font-weight:700;color:var(--tx3);margin-bottom:4px">SKU <span style="color:var(--r)">*</span></div>';
      h += '<input id="avc-sku" class="inp" style="font-family:var(--mono);width:100%;max-width:260px" placeholder="Ex: 643416 ou ASIN" value="' + esc(s.sku||'') + '" oninput="agentVCState.sku=this.value.trim()" onblur="render()">';
      h += '<div style="font-size:10px;color:var(--tx3);margin-top:4px">Le SKU figure dans le catalogue VC (recherche par ASIN). Il peut être identique à l\'ASIN ou différent.</div></div>';
      h += '<button class="btn btn-p" style="margin-top:8px" ' + (!s.sku ? 'disabled' : '') + ' onclick="avcConfirmSKU()">Confirmer →</button>';
    }
    h += '</div></div>';
  }

  // ── ÉTAPE 4 — GÉNÉRATION SEO ──
  if (s.step >= 4) {
    var progress = (typeof seoResults !== 'undefined' && seoResults[s.asin]) ? seoResults[s.asin]._progress : null;
    var ficheReady = (typeof seoResults !== 'undefined' && seoResults[s.asin] && seoResults[s.asin][s.market] && !seoResults[s.asin][s.market].error);
    var step4Done = ficheReady;
    var step4Open = s.step === 4 || (step4Done && s.expandedSteps && s.expandedSteps.has(4));
    h += avcStepWrap(4, s.step, 'Génération fiche SEO', step4Done ? '✓ Fiche générée' : 'Optimisation IA titre, bullets, description, keywords', step4Open);
    if (step4Open) {
      if (progress && !ficheReady) {
        h += '<div style="margin-bottom:8px"><div style="height:4px;background:var(--bd);border-radius:2px;overflow:hidden"><div style="height:100%;background:var(--accent);border-radius:2px;width:' + (progress.pct||0) + '%"></div></div>';
        h += '<div style="font-size:11px;color:var(--tx3);margin-top:4px">' + esc(progress.phase||'') + '</div></div>';
      } else if (!ficheReady) {
        var aObj4 = s.asin ? c.asins.find(function(x){ return x.asin === s.asin; }) : null;
        var _ficheOk = !!(aObj4 && aObj4.ficheAmazon);
        h += `<div style="margin-bottom:14px">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
    <span style="font-size:13px;font-weight:500">Enrichissement produit</span>
    <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#EEEDFE;color:#3C3489">optionnel · recommandé</span>
  </div>
  <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Coller la fiche Amazon pour une analyse plus précise</div>
  <textarea class="fg-in" id="fiche-amazon-vc-${esc(s.asin)}"
    style="height:90px;font-size:12px;resize:vertical"
    placeholder="Collez ici le contenu de la page Amazon.fr (titre actuel, bullets, description, avis, produits associés)..."
    oninput="saveFicheAmazon('${s.asin}', this.value)"
  >${esc((aObj4 && aObj4.ficheAmazon) || '')}</textarea>
  <div style="font-size:11px;color:var(--muted2);margin-top:4px">Sauvegardée automatiquement pour cet ASIN.</div>
  ${_ficheOk ? `<div style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:var(--ok)">✓ Fiche enrichie — la génération sera plus précise</div>` : ''}
</div>`;
        h += '<button class="btn btn-p" onclick="avcLaunchSEO()">✨ Générer la fiche SEO</button>';
      } else {
        var r4 = seoResults[s.asin][s.market];
        h += '<div style="font-size:12px;padding:8px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd);margin-bottom:8px;line-height:1.5">' + esc((r4.titre||'').substring(0,80)) + '…</div>';
        h += '<div style="display:flex;gap:6px">';
        h += '<button class="btn btn-sm" onclick="selectedAsin=agentVCState.asin;go(\'asins\')">👁 Voir fiche complète</button>';
        h += '<button class="btn btn-sm" onclick="avcLaunchSEO()">🔄 Regénérer</button>';
        h += '<button class="btn btn-p btn-sm" onclick="agentVCState.step=5;render()">📤 Script VC →</button>';
        h += '</div>';
        // renderChallengeGPT supprimé — intégré dans renderOptimisationWizard (v3.4.29)
      }
    }
    h += '</div></div>';
  }

  // ── ÉTAPE 5 — SCRIPT VC ──
  if (s.step >= 5) {
    var step5Done = vendorCodes.every(function(vc){ return s.vcStatus && s.vcStatus[vc] === 'success'; });
    var step5Open = s.step === 5 || (step5Done && s.expandedSteps && s.expandedSteps.has(5));
    h += avcStepWrap(5, s.step, 'Publier sur Vendor Central', step5Done ? '✅ Tous les vendor codes mis à jour' : 'Script(s) à coller dans Claude in Chrome', step5Open);
    if (step5Open) {
      var fiche5 = (typeof seoResults !== 'undefined' && seoResults[s.asin] && seoResults[s.asin][s.market]) ? seoResults[s.asin][s.market] : null;
      if (!fiche5) {
        h += '<div class="alr alr-y">Générez d\'abord la fiche SEO (étape 4).</div>';
      } else {
        vendorCodes.forEach(function(vc, idx) {
          var vcSku = (s.skuByVC && s.skuByVC[vc]) || s.sku || '';
          var vcSt = (s.vcStatus && s.vcStatus[vc]) || 'pending';
          h += '<div style="margin-bottom:14px;padding:12px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd)">';
          h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
          h += '<div style="font-size:12px;font-weight:700">Script ' + (idx+1) + '/' + vendorCodes.length + ' — ' + esc(vc) + '</div>';
          h += '<span style="font-size:11px">' + (vcSt === 'success' ? '✅ Fait' : '⏳ En attente') + '</span>';
          h += '</div>';
          h += '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:var(--tx3);margin-bottom:4px">SKU pour ce vendor code</div>';
          h += '<input class="inp" style="font-family:var(--mono);width:100%;max-width:200px" value="' + esc(vcSku) + '" onchange="if(!agentVCState.skuByVC)agentVCState.skuByVC={};agentVCState.skuByVC[\'' + vc + '\']=this.value;render()"></div>';
          h += '<div style="display:flex;gap:6px">';
          h += '<button class="btn btn-p btn-sm" onclick="avcCopyScript(\'' + vc + '\')">📋 Copier le script</button>';
          if (vcSt !== 'success') {
            h += '<button class="btn btn-sm" onclick="avcMarkDone(\'' + vc + '\')">✅ Confirmer publié</button>';
          }
          h += '</div></div>';
        });
      }
    }
    h += '</div></div>';
  }

  h += '</div>';
  return h;
}

function avcStepWrap(n, currentStep, title, sub, isOpen) {
  var isDone = n < currentStep;
  var isActive = n === currentStep;
  var iconContent = isDone ? '✓' : String(n);
  var h = '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">';
  h += '<div style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;';
  if (isDone) h += 'background:var(--g);color:#fff;border:2px solid var(--g)';
  else if (isActive) h += 'background:var(--accent);color:#000;border:2px solid var(--accent)';
  else h += 'background:var(--bg);color:var(--tx3);border:2px solid var(--bd)';
  h += '">' + iconContent + '</div>';
  h += '<div style="flex:1;background:var(--bg2);border:1px solid ' + (isActive ? 'var(--accent)' : 'var(--bd)') + ';border-radius:var(--rdl);overflow:hidden' + (isActive ? ';box-shadow:0 0 0 3px rgba(255,153,0,.1)' : '') + '">';
  h += '<div style="padding:12px 14px;display:flex;align-items:center;justify-content:space-between;' + (isDone ? 'cursor:pointer;background:var(--s2)' : '') + '"' + (isDone ? ' onclick="avcToggleStep(' + n + ')"' : '') + '>';
  h += '<div><div style="font-size:13px;font-weight:700">' + esc(title) + '</div><div style="font-size:11px;color:var(--tx3);margin-top:1px">' + esc(sub) + '</div></div>';
  if (isDone) h += '<span style="font-size:11px;color:var(--tx3)">' + (isOpen ? '▼' : '▶') + '</span>';
  h += '</div>';
  if (isOpen) h += '<div style="padding:14px;border-top:1px solid var(--bd)">';
  return h;
}

function avcLookupAsin() {
  var val = ((document.getElementById('avc-asin-input') || {}).value || '').trim().toUpperCase();
  var errEl = document.getElementById('avc-asin-error');
  if (!val) return;
  var c = cl();
  var found = c && c.asins.find(function(x){ return x.asin === val; });
  if (!found) { if (errEl) errEl.style.display = 'block'; return; }
  if (errEl) errEl.style.display = 'none';
  agentVCState.asin = found.asin;
  agentVCState.title = found.title || val;
  agentVCState.step = 2;
  render();
}

function avcToggleNewForm() {
  agentVCState.newFormVisible = !agentVCState.newFormVisible;
  render();
}

function avcCheckNew() {
  var btn = document.getElementById('avc-new-go');
  if (btn) btn.disabled = !(agentVCState.newRef && agentVCState.newBrand && agentVCState.newName);
}

function avcConfirmNew() {
  agentVCState.isNew = true;
  agentVCState.asin = 'NEW-' + agentVCState.newRef;
  agentVCState.title = agentVCState.newBrand + ' ' + agentVCState.newName;
  agentVCState.step = 2;
  render();
}

function avcConfirmMarket() {
  if (!agentVCState.market) return;
  agentVCState.step = 3;
  render();
}

function avcConfirmSKU() {
  if (!agentVCState.sku) return;
  agentVCState.step = 4;
  render();
}

function avcLaunchSEO() {
  var c = cl();
  if (!c || !agentVCState.asin || !agentVCState.market) return;
  var keyword = seoMotcle[agentVCState.asin] || extractSearchKeyword(agentVCState.asin, c);
  runSEOFiche(agentVCState.asin, agentVCState.market, keyword);
  agentVCState.step = 4;
  render();
}

function avcCopyScript(vc) {
  var c = cl();
  if (!c) return;
  var fiche = (typeof seoResults !== 'undefined' && seoResults[agentVCState.asin] && seoResults[agentVCState.asin][agentVCState.market])
    ? seoResults[agentVCState.asin][agentVCState.market]
    : (c.ficheOptimisee && c.ficheOptimisee[agentVCState.asin] && c.ficheOptimisee[agentVCState.asin][agentVCState.market])
    ? c.ficheOptimisee[agentVCState.asin][agentVCState.market]
    : null;
  if (!fiche) { showToast('Fiche introuvable — régénérez la fiche SEO.', 'alr-r'); return; }
  var sku = (agentVCState.skuByVC && agentVCState.skuByVC[vc]) || agentVCState.sku || '';
  var prompt = buildVCModifyPrompt(agentVCState.asin, agentVCState.market, fiche, c, sku);
  var ta = document.createElement('textarea');
  ta.value = prompt;
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  var ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!agentVCState.vcStatus) agentVCState.vcStatus = {};
  agentVCState.vcStatus[vc] = agentVCState.vcStatus[vc] || 'pending';
  agentVCState.step = 5;
  showToast(ok ? '✅ Script copié — collez dans Claude in Chrome' : '⚠️ Copie manuelle requise', ok ? 'alr-g' : 'alr-y');
  render();
}

function avcMarkDone(vc) {
  if (!agentVCState.vcStatus) agentVCState.vcStatus = {};
  agentVCState.vcStatus[vc] = 'success';
  var c = cl();
  if (c && c.ficheOptimisee && c.ficheOptimisee[agentVCState.asin]) {
    c.ficheOptimisee[agentVCState.asin].vcUpdateStatus = 'success';
    c.ficheOptimisee[agentVCState.asin].lastVCUpdate = new Date().toISOString();
    save();
  }
  render();
}

function refreshSEODrawer() {
  if (typeof screen !== 'undefined' && screen === 'agentvc') { render(); return; }
  var drawer = document.getElementById('seo-drawer');
  if (!drawer) return;
  var asin = seoDrawerAsin;
  if (!asin) return;
  var c = cl();
  if (!c) return;
  var a = c.asins.find(function(x){ return x.asin === asin; });
  if (!a) return;

  var markets = c.markets && c.markets.length ? c.markets : [c.mainMarket || '.fr'];
  var seenLangs = new Set();
  var mtp = markets.filter(function(mkt) {
    var ml = MARKET_LANG[mkt];
    if (!ml) return false;
    var key = ml.lang + (mkt === '.be' ? '-be' : '');
    if (seenLangs.has(key)) return false;
    seenLangs.add(key);
    return true;
  });

  var res = seoResults[asin] || {};
  var activeMkt = seoActiveTab || mtp[0] || (c.mainMarket || '.fr');
  var r = res[activeMkt];
  if (!r) {
    var firstKey = Object.keys(res).find(function(k){ return k !== '_progress' && k !== 'backendKW'; });
    if (firstKey) { activeMkt = firstKey; r = res[firstKey]; }
  }
  var status = seoGetStatus(asin, c);
  var shortTitle = (a.title || asin).substring(0, 50) + ((a.title||'').length > 50 ? '…' : '');
  var asinJ = "'" + asin + "'";

  var ctrlMkt = activeMkt;
  var ctrlKW = seoMotcle[asin] || extractSearchKeyword(asin, c);
  var h = '';

  // ── Header ──
  h += '<div style="padding:14px 16px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:10px;flex-shrink:0">';
  h += '<button onclick="closeSEODrawer()" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--tx3);padding:0;line-height:1">✕</button>';
  h += '<div style="flex:1;min-width:0">';
  h += '<div style="font-size:13px;font-weight:700;color:var(--tx1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(shortTitle) + '</div>';
  h += '<div style="font-size:10px;color:var(--tx3);font-family:var(--mono)">' + esc(asin) + '</div>';
  h += '</div>';
  h += '<a href="https://www.amazon' + esc(c.mainMarket||'.fr') + '/dp/' + esc(asin) + '" target="_blank" class="btn btn-xs">🔗</a>';
  h += '</div>';

  // ── Contrôles : référence interne + marché + mot-clé + lancer ──
  h += '<div style="padding:8px 16px;border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0">';
  var refVal = a.internalRef || '';
  h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
  h += '<span style="font-size:10px;font-weight:700;color:var(--tx3);width:52px;flex-shrink:0">RÉF. INT.</span>';
  h += '<input type="text" value="' + esc(refVal) + '" placeholder="Ex : RT200, 011162…" '
    + 'style="flex:1;padding:4px 8px;border:1px solid var(--bd2);border-radius:var(--rd);background:var(--s1);color:var(--tx);font-size:11px;font-family:var(--fn)" '
    + 'oninput="seoSetInternalRef(' + asinJ + ',this.value)" />';
  h += '</div>';
  if (mtp.length > 1) {
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
    h += '<span style="font-size:10px;font-weight:700;color:var(--tx3);width:52px;flex-shrink:0">MARCHÉ</span>';
    h += '<select style="flex:1;padding:3px 6px;border:1px solid var(--bd2);border-radius:var(--rd);background:var(--s1);color:var(--tx);font-size:11px;cursor:pointer" onchange="seoActiveTab=this.value;refreshSEODrawer()">';
    mtp.forEach(function(mkt) {
      var ml = MARKET_LANG[mkt];
      h += '<option value="' + esc(mkt) + '"' + (mkt === ctrlMkt ? ' selected' : '') + '>' + (ml ? ml.flag + ' ' + ml.label : mkt) + '</option>';
    });
    h += '</select>';
    h += '</div>';
  }
  h += '<div style="display:flex;align-items:center;gap:6px">';
  h += '<span style="font-size:10px;font-weight:700;color:var(--tx3);width:52px;flex-shrink:0">MOT-CLÉ</span>';
  h += '<input id="seo-kw-input" type="text" value="' + esc(ctrlKW) + '" placeholder="Mot-clé recherche Amazon..." '
    + 'style="flex:1;padding:4px 8px;border:1px solid var(--bd2);border-radius:var(--rd);background:var(--s1);color:var(--tx);font-size:11px;font-family:var(--fn)" '
    + 'oninput="seoSetMotcle(' + asinJ + ',this.value)" />';
  h += '<button class="btn btn-xs" title="Réinitialiser le mot-clé" onclick="seoResetMotcle(' + asinJ + ')">↺</button>';
  h += '</div>';
  if (!seoLoading) {
    h += '<div style="margin-top:6px">';
    var _safeMarket = ctrlMkt || (c.mainMarket || '.fr');
    h += '<button class="btn btn-xs btn-p" style="width:100%" onclick="runSEOFiche(' + asinJ + ',' + JSON.stringify(_safeMarket) + ',seoMotcle[' + asinJ + ']||extractSearchKeyword(' + asinJ + ',cl()))">'
      + (r && !r.error ? '🔄 Regénérer avec enrichissement web' : '✍️ Générer avec enrichissement web') + '</button>';
    h += '</div>';
  }
  h += '</div>';

  // ── Body scrollable ──
  h += '<div style="flex:1;overflow-y:auto;padding:16px">';

  if (seoLoading && seoDrawerAsin === asin) {
    var prog = (seoResults[asin] && seoResults[asin]._progress) || {};
    var progPhase = prog.phase || '⏳ Traitement en cours…';
    var progPct   = prog.pct   || 0;
    if (mtp.length > 1) {
      h += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px">';
      mtp.forEach(function(mkt) {
        var ml = MARKET_LANG[mkt];
        var done = !!(res[mkt] && !res[mkt].error);
        h += '<div style="padding:4px 10px;border-radius:20px;font-size:11px;background:' + (done?'var(--g)':'var(--bd2)') + ';color:' + (done?'#fff':'var(--tx3)') + '">' + (ml?ml.flag+' '+ml.label:mkt) + (done?' ✓':' ⏳') + '</div>';
      });
      h += '</div>';
    }
    h += '<div style="text-align:center;padding:32px 20px">';
    h += '<div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--tx1)">' + esc(progPhase) + '</div>';
    h += '<div style="height:6px;background:var(--bd2);border-radius:3px;overflow:hidden;margin:0 auto;max-width:260px">';
    h += '<div style="height:100%;width:' + progPct + '%;background:var(--accent);border-radius:3px;transition:width .5s ease"></div>';
    h += '</div>';
    h += '<div style="font-size:10px;color:var(--tx3);margin-top:6px">' + progPct + '%</div>';
    if (r && !r.error) {
      h += '</div>';
      h += drawSEOContent(asin, activeMkt, res, mtp, true);
    } else {
      h += '</div>';
    }
  } else if (!r) {
    h += '<div class="alr alr-b">Aucune fiche générée. Cliquez sur Générer.</div>';
  } else if (r.error) {
    h += '<div class="alr alr-r">Erreur : ' + esc(String(r.error)) + '</div>';
  } else {
    // Onglets marchés
    if (mtp.length > 1) {
      h += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px">';
      mtp.forEach(function(mkt) {
        var ml = MARKET_LANG[mkt];
        var done = !!(res[mkt] && !res[mkt].error);
        var isAct = activeMkt === mkt;
        h += '<button class="btn btn-sm' + (isAct?' btn-p':'') + '" onclick="seoActiveTab=' + JSON.stringify(mkt) + ';refreshSEODrawer()">' + (ml?ml.flag+' '+ml.label:mkt) + (done?' ✓':'') + '</button>';
      });
      h += '</div>';
    }
    h += drawSEOContent(asin, activeMkt, res, mtp, false);
  }

  // Historique actions
  var ficheActions = (c.ficheOptimisee&&c.ficheOptimisee[asin]&&c.ficheOptimisee[asin].actions) ? c.ficheOptimisee[asin].actions : [];
  if (ficheActions.length > 0) {
    h += '<div style="margin-top:16px"><div style="font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Historique des actions</div>';
    ficheActions.slice().reverse().forEach(function(action, revIdx) {
      var idx = ficheActions.length - 1 - revIdx;
      var iv = action.verified===true; var iF = action.verified===false;
      var iO = action.verified===null && action.verificationDue && new Date(action.verificationDue)<new Date();
      var sc = iv?'var(--g)':iF?'var(--r)':iO?'var(--or)':'#2196F3';
      var si = iv?'✅':iF?'❌':iO?'⏰':'📤';
      var sl = iv?'Conforme':iF?'Non conforme':iO?'Vérif. en attente':'Soumis VC';
      var sd = action.submittedAt ? new Date(action.submittedAt).toLocaleDateString('fr-FR') : '';
      h += '<div style="padding:8px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd);margin-bottom:6px">';
      h += '<div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:11px;font-weight:600">' + (action.route==='create'?'Route A':'Route B') + '</span><span style="font-size:11px;color:'+sc+';font-weight:600">'+si+' '+sl+'</span></div>';
      h += '<div style="font-size:10px;color:var(--tx3)">' + sd + (action.supplierCodes&&action.supplierCodes.length?' · '+action.supplierCodes.join(', '):'') + '</div>';
      if (action.verified === null) {
        h += '<div style="display:flex;gap:4px;margin-top:6px">';
        h += '<button class="btn btn-xs" style="background:var(--g);color:#fff;border-color:var(--g)" onclick="seoMarkVerified('+asinJ+','+idx+',true)">✅ Conforme</button>';
        h += '<button class="btn btn-xs" style="background:var(--r);color:#fff;border-color:var(--r)" onclick="seoMarkVerified('+asinJ+','+idx+',false)">❌ Non conforme</button>';
        h += '</div>';
      }
      h += '</div>';
    });
    h += '</div>';
  }

  h += '</div>';

  // ── Footer actions ──
  if (!seoLoading) {
    var _safeMarket = activeMkt || ctrlMkt || (c.mainMarket || '.fr');
    var _vcStatus = c.ficheOptimisee && c.ficheOptimisee[asin] ? c.ficheOptimisee[asin].vcUpdateStatus : null;
    var _vcDate   = c.ficheOptimisee && c.ficheOptimisee[asin] ? c.ficheOptimisee[asin].lastVCUpdate : null;
    h += '<div style="padding:12px 16px;border-top:1px solid var(--bd);display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0">';
    if (r && !r.error) {
      h += '<button class="btn btn-sm btn-p" onclick="copySEOTitreMkt('+asinJ+','+JSON.stringify(activeMkt)+')">📋 Tout copier</button>';
      var _vcBtnLabel = _vcStatus === 'pending' ? '⏳ En cours' : _vcStatus === 'success' ? '✅ VC à jour' : '📤 Modifier VC';
      h += '<button class="btn btn-sm" style="background:var(--accent);color:#fff;border-color:var(--accent)" onclick="seoLaunchModify('+asinJ+')">' + _vcBtnLabel + '</button>';
      if (_vcStatus === 'pending') {
        h += '<button class="btn btn-sm" style="background:var(--g);color:#fff;border-color:var(--g)" onclick="seoMarkVCDone('+asinJ+')">✅ Confirmer mise à jour VC</button>';
      }
      if (_vcStatus === 'success' && _vcDate) {
        var _vcDateStr = new Date(_vcDate).toLocaleDateString('fr-FR');
        h += '<span style="font-size:10px;color:var(--g);align-self:center">Mis à jour le ' + _vcDateStr + '</span>';
      }
      if (status==='submitted'||status==='overdue') {
        h += '<button class="btn btn-sm" style="background:var(--or);color:#fff;border-color:var(--or)" onclick="seoLaunchVerify('+asinJ+')">🔍 Vérifier</button>';
      }
      if (status==='failed') {
        h += '<button class="btn btn-sm" style="background:var(--r);color:#fff;border-color:var(--r)" onclick="seoOpenCase('+asinJ+')">🆘 Cas support</button>';
      }
      h += '<button class="btn btn-sm" style="background:var(--or);color:#fff;border-color:var(--or)" '
        + 'onclick="runSEOFiche(' + asinJ + ',' + JSON.stringify(_safeMarket) + ',seoMotcle[' + asinJ + ']||extractSearchKeyword(' + asinJ + ',cl()))">'
        + '🔄 Régénérer</button>';
    }
    h += '</div>';
  }

  drawer.innerHTML = h;
}

function drawSEOContent(asin, activeMkt, res, mtp, compact) {
  var r = res[activeMkt];
  if (!r || r.error) return '';
  var h = '';
  var asinJ = "'" + asin + "'";
  var mktJ  = JSON.stringify(activeMkt);

  // Nom type produit
  if (r.nomType) {
    h += '<div style="margin-bottom:10px;padding:6px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd)">';
    h += '<div style="font-size:9px;font-weight:700;color:var(--tx3);margin-bottom:2px">TYPE PRODUIT</div>';
    h += '<div style="font-size:12px;font-weight:600">' + esc(r.nomType) + '</div>';
    h += '</div>';
  }

  // ALERTES_FRED
  h += `<div class="alr alr-w" style="margin-bottom:16px;${r.alertesFred ? '' : 'display:none'}">
    ⚠️ <strong>Points à vérifier avant publication :</strong><br>
    ${esc(r.alertesFred || '')}
  </div>`;

  // Titre
  var tl = r.titre ? r.titre.length : 0;
  var tc = tl > 200 ? 'var(--r)' : tl >= 80 ? 'var(--g)' : 'var(--or)';
  h += '<div style="margin-bottom:10px">';
  h += '<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--tx3);margin-bottom:4px"><span>TITRE</span><span style="color:'+tc+'">'+tl+' car. '+(tl>200?'⚠':'✓')+'</span></div>';
  h += '<div style="padding:8px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd);font-size:12px;line-height:1.5">' + esc(r.titre||'') + '</div>';
  h += '<button class="btn btn-xs" style="margin-top:3px" onclick="copySEOTitreMkt('+asinJ+','+mktJ+')">📋 Copier titre</button>';
  h += '</div>';

  if (!compact) {
    // Bullets
    h += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--tx3);margin-bottom:6px">BULLET POINTS</div>';
    (r.bullets||[]).forEach(function(b,i) {
      if (!b) return;
      var bf = JSON.stringify('bullet'+(i+1));
      h += '<div style="margin-bottom:5px;padding:7px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd)">';
      h += '<div style="font-size:9px;font-weight:700;color:var(--or);margin-bottom:2px">• '+(i+1)+'</div>';
      h += '<div style="font-size:11px;line-height:1.5">' + esc(b) + '</div>';
      h += '<button class="btn btn-xs" style="margin-top:3px" onclick="copySEOField('+asinJ+','+mktJ+','+bf+')">📋</button>';
      h += '</div>';
    });
    h += '</div>';

    if (r.description) {
      h += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--tx3);margin-bottom:4px">DESCRIPTION HTML</div>';
      h += '<div style="padding:8px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd);font-size:10px;font-family:var(--fm);line-height:1.5;max-height:100px;overflow-y:auto">' + esc(r.description) + '</div>';
      h += '<button class="btn btn-xs" style="margin-top:3px" onclick="copySEODescMkt('+asinJ+','+mktJ+')">📋 Copier</button>';
      h += '</div>';
    }

    var _bkw = res.backendKW || (activeMkt && res[activeMkt] && res[activeMkt].backendKW) || '';
    if (_bkw) {
      h += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--tx3);margin-bottom:4px">BACKEND KEYWORDS</div>';
      h += '<div style="padding:7px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd);font-size:10px;color:var(--tx2);line-height:1.5">' + esc(_bkw) + '</div>';
      h += '<button class="btn btn-xs" style="margin-top:3px" onclick="copySEOBkwMkt('+asinJ+')">📋 Copier</button>';
      h += '</div>';
    }

    if (r.positionnement||r.leviers||r.erreurs||r.opportunite) {
      h += '<div style="margin-bottom:10px;padding:8px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd)">';
      h += '<div style="font-size:11px;font-weight:700;color:var(--tx3);margin-bottom:6px">SYNTHÈSE STRATÉGIQUE</div>';
      if (r.positionnement) h += '<div style="margin-bottom:4px"><span style="font-size:9px;font-weight:700;color:var(--tx3)">POSITIONNEMENT</span><div style="font-size:11px">' + esc(r.positionnement) + '</div></div>';
      if (r.leviers)        h += '<div style="margin-bottom:4px"><span style="font-size:9px;font-weight:700;color:var(--g)">LEVIERS</span><div style="font-size:11px">' + esc(r.leviers) + '</div></div>';
      if (r.erreurs)        h += '<div style="margin-bottom:4px"><span style="font-size:9px;font-weight:700;color:var(--r)">ERREURS</span><div style="font-size:11px">' + esc(r.erreurs) + '</div></div>';
      if (r.opportunite)    h += '<div><span style="font-size:9px;font-weight:700;color:var(--b)">OPPORTUNITÉ</span><div style="font-size:11px">' + esc(r.opportunite) + '</div></div>';
      h += '</div>';
    }

    h += `<div class="cd" style="padding:14px;margin-top:12px;border-left:3px solid var(--or);${r.pointImportant ? '' : 'display:none'}">
    🔥 <strong>Point clé :</strong> ${esc(r.pointImportant || '')}
  </div>`;

    if (r.images && r.images.length) {
      h += '<div style="margin-bottom:10px">';
      h += '<div style="font-size:11px;font-weight:700;color:var(--tx3);margin-bottom:6px">🖼 PRÉCONISATIONS IMAGES (' + r.images.length + ')</div>';
      r.images.forEach(function(img, i) {
        h += '<div style="margin-bottom:5px;padding:7px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd)">';
        h += '<div style="font-size:9px;font-weight:700;color:var(--or);margin-bottom:3px">IMAGE ' + (i+1) + ' — ' + esc(img.emplacement) + ' / ' + esc(img.type) + '</div>';
        if (img.scene)          h += '<div style="font-size:10px;margin-bottom:2px"><span style="font-size:9px;color:var(--tx3)">Scène : </span>' + esc(img.scene) + '</div>';
        if (img.texte_overlay)  h += '<div style="font-size:10px;margin-bottom:2px"><span style="font-size:9px;color:var(--tx3)">Overlay : </span>' + esc(img.texte_overlay) + '</div>';
        if (img.pourquoi)       h += '<div style="font-size:10px;color:var(--tx2)"><span style="font-size:9px;color:var(--tx3)">Pourquoi : </span>' + esc(img.pourquoi) + '</div>';
        h += '</div>';
      });
      h += '</div>';
    }
  }
  return h;
}

function copySEOTitreMkt(asin, mkt) { copySEOField(asin, mkt, 'all'); }
function copySEODescMkt(asin, mkt)  { copySEOField(asin, mkt, 'description'); }
function copySEOBkwMkt(asin)        { copySEOField(asin, null, 'backendKW'); }

function renderChallengeGPT(asin, market, a) {
  const ch = a.ficheChallenge && a.ficheChallenge[market];
  let h = '';

  // === ÉTAPE 6 — Saisie GPT ===
  h += `<div class="cd" style="padding:1.25rem;margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <div style="width:22px;height:22px;border-radius:50%;background:#EAF3DE;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;color:#3B6D11;flex-shrink:0">6</div>
      <span style="font-size:14px;font-weight:500">Challenge GPT</span>
      <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#EAF3DE;color:#3B6D11">apprentissage</span>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Collez la sortie brute de ChatGPT pour comparer objectivement les deux fiches</div>
    <textarea class="fg-in" id="fiche-gpt-${esc(asin)}-${esc(market)}"
      style="height:100px;font-size:12px;resize:vertical"
      placeholder="Collez ici la sortie complète de ChatGPT (titre, bullets, description, backend, synthèse)..."
      oninput="saveFicheGPT('${esc(asin)}', this.value)"
    >${esc(a.ficheGPT || '')}</textarea>
    <div style="margin-top:8px;display:flex;gap:8px">
      ${challengeLoading === asin
        ? `<div style="font-size:12px;color:var(--muted)"><span class="spin">⏳</span> Analyse en cours…</div>`
        : `<button class="btn-or" onclick="runChallengeGPT('${esc(asin)}','${esc(market)}')">⚡ Analyser et comparer</button>`
      }
    </div>
  </div>`;

  // === ÉTAPE 7 — Résultat comparaison ===
  if (ch) {
    const scoreColor = (s) => {
      const n = parseInt(s);
      if (n >= 8) return 'var(--ok)';
      if (n >= 6) return 'var(--or)';
      return 'var(--danger)';
    };

    h += `<div class="cd" style="padding:1.25rem;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="width:22px;height:22px;border-radius:50%;background:#EAF3DE;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;color:#3B6D11;flex-shrink:0">7</div>
        <span style="font-size:14px;font-weight:500">Comparaison & fiche fusionnée</span>
        <span style="font-size:12px;color:var(--muted)">Claude <strong style="color:${scoreColor(ch.scoreClaude)}">${esc(ch.scoreClaude)}</strong> · GPT <strong style="color:${scoreColor(ch.scoreGPT)}">${esc(ch.scoreGPT)}</strong></span>
      </div>`;

    // Autocritique
    if (ch.autocritique) {
      h += `<div class="alr alr-w" style="margin-bottom:14px">
        <strong>Autocritique Claude :</strong> ${esc(ch.autocritique)}
      </div>`;
    }

    // Champs comparaison + fusion éditables
    const fields = [
      { label: 'Titre',            verdict: ch.verdictTitre,   fusion: ch.fusionTitre,   key: 'fusionTitre',   rows: 3 },
      { label: 'Bullet 1',         verdict: ch.verdictB1,      fusion: ch.fusionB1,      key: 'fusionB1',      rows: 4 },
      { label: 'Bullet 2',         verdict: ch.verdictB2,      fusion: ch.fusionB2,      key: 'fusionB2',      rows: 4 },
      { label: 'Bullet 3',         verdict: ch.verdictB3,      fusion: ch.fusionB3,      key: 'fusionB3',      rows: 4 },
      { label: 'Bullet 4',         verdict: ch.verdictB4,      fusion: ch.fusionB4,      key: 'fusionB4',      rows: 4 },
      { label: 'Bullet 5',         verdict: ch.verdictB5,      fusion: ch.fusionB5,      key: 'fusionB5',      rows: 4 },
      { label: 'Description HTML', verdict: ch.verdictDesc,    fusion: ch.fusionDesc,    key: 'fusionDesc',    rows: 8 },
      { label: 'Backend keywords', verdict: ch.verdictBackend, fusion: ch.fusionBackend, key: 'fusionBackend', rows: 3 },
    ];

    fields.forEach(f => {
      const winner = (f.verdict || '').startsWith('GPT') ? '🟢 GPT' : (f.verdict || '').startsWith('Claude') ? '🔵 Claude' : '⚪ Égalité';
      h += `<div style="margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:11px;font-weight:500;color:var(--muted2);text-transform:uppercase;letter-spacing:0.5px">${esc(f.label)}</span>
          <span style="font-size:11px;color:var(--muted)">${winner}</span>
          <span style="font-size:11px;color:var(--muted);font-style:italic">${esc((f.verdict || '').replace(/^[^—]+—\s*/, ''))}</span>
        </div>
        <textarea class="fg-in" rows="${f.rows}"
          style="font-size:12px;resize:vertical"
          oninput="updateFusionField('${esc(asin)}','${esc(market)}','${f.key}',this.value)"
        >${esc(f.fusion || '')}</textarea>
      </div>`;
    });

    h += `<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn-p" onclick="applyFusionAndPublish('${esc(asin)}','${esc(market)}')">
        🚀 Appliquer + Publier dans VC
      </button>
      <button class="btn-or" onclick="copyFicheFusion('${esc(asin)}','${esc(market)}')">
        📋 Copier la fiche fusionnée
      </button>
      <button class="btn-sm" onclick="exportExemplesGPT('${esc(asin)}','${esc(market)}')">
        💾 Sauvegarder référence SEO
      </button>
    </div>`;

    h += '</div>';
  }

  return h;
}

function seoSetInternalRef(asin, val) {
  var c = cl();
  if (!c) return;
  var a = c.asins.find(function(x){ return x.asin === asin; });
  if (!a) return;
  a.internalRef = val.trim();
  save();
}

function seoMarkVerified(asin, actionIndex, isVerified) {
  var c = cl();
  if (!c || !c.ficheOptimisee || !c.ficheOptimisee[asin]) return;
  var actions = c.ficheOptimisee[asin].actions;
  if (!actions || actions[actionIndex] === undefined) return;
  actions[actionIndex].verified = isVerified;
  actions[actionIndex].verifiedAt = new Date().toISOString();
  save();
  showToast(isVerified ? '✅ Marqué conforme' : '❌ Marqué non conforme', isVerified ? 'alr-g' : 'alr-r');
  refreshSEODrawer();
}

function seoMarkVCDone(asin) {
  var c = cl();
  if (!c) return;
  if (!c.ficheOptimisee) c.ficheOptimisee = {};
  if (!c.ficheOptimisee[asin]) c.ficheOptimisee[asin] = {};
  c.ficheOptimisee[asin].vcUpdateStatus = 'success';
  c.ficheOptimisee[asin].lastVCUpdate = new Date().toISOString();
  save();
  showToast('✅ Mise à jour VC confirmée', 'alr-g');
  refreshSEODrawer();
}

// ── renderSEOScreen — nouvelle UX ──────────────────────────────
function renderSEOScreen() {
  var c = cl();
  if (!c) return '<div class="alr alr-r">Aucun client sélectionné.</div>';

  var asins = c.asins || [];
  var totalCA = asins.reduce(function(s,x){ return s+(getRevenue(x,c)||0); }, 0);
  var pendingVerif = seoGetPendingVerifications();
  var markets = c.markets && c.markets.length ? c.markets : [c.mainMarket || '.fr'];

  var h = '<div style="padding:20px 24px;max-width:960px">';

  // ── Titre ──
  h += '<div style="margin-bottom:20px">';
  h += '<h2 style="font-size:20px;font-weight:700;margin:0 0 4px 0">✍️ Agent SEO — ' + esc(c.name) + '</h2>';
  h += '<div style="font-size:12px;color:var(--tx3)">' + markets.join(' · ') + '</div>';
  h += '</div>';

  if (pendingVerif.length > 0) {
    h += '<div class="alr alr-r" style="margin-bottom:16px">⏰ ' + pendingVerif.length + ' vérification' + (pendingVerif.length > 1 ? 's' : '') + ' en attente — modifications soumises il y a plus de 24h.</div>';
  }

  // ── Zone 1 : Saisie ASIN ou création ──
  h += '<div class="cd" style="margin-bottom:16px">';
  h += '<div style="font-size:12px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Travailler sur un ASIN</div>';
  h += '<div style="display:flex;gap:8px;margin-bottom:8px">';
  h += '<input id="seo-asin-input" type="text" placeholder="ASIN, référence interne ou titre..." style="flex:1;padding:9px 12px;border:1px solid var(--bd2);border-radius:var(--rd);background:var(--s2);color:var(--tx);font-size:13px;font-family:var(--fn)" oninput="seoSearchInput()" onkeydown="if(event.key===\'Enter\')seoSearchGo()">';
  h += '<button class="btn btn-p" onclick="seoSearchGo()">✍️ Générer</button>';
  h += '</div>';
  h += '<div id="seo-search-results" style="margin-bottom:4px"></div>';
  h += '<button class="btn btn-sm" style="border-style:dashed" onclick="seoLaunchNewRef()">➕ Créer une nouvelle référence dans VC</button>';
  h += '</div>';

  // ── Zone 2 : ASINs suggérés ──
  var defaillants = asins.filter(function(a) {
    var d = calcSEODefaillance(a, c);
    return d === 'critical' || d === 'watch';
  }).sort(function(a,b) {
    var pa = calcSEODefaillance(a,c)==='critical'?1:0;
    var pb = calcSEODefaillance(b,c)==='critical'?1:0;
    if (pa !== pb) return pb - pa;
    return (getRevenue(b,c)||0) - (getRevenue(a,c)||0);
  }).slice(0, 10);

  if (defaillants.length > 0) {
    h += '<div class="cd" style="margin-bottom:16px">';
    h += '<div style="font-size:12px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">💡 ASINs suggérés pour optimisation SEO</div>';
    defaillants.forEach(function(a) {
      var d = calcSEODefaillance(a, c);
      var seg = calcSegment(a, totalCA);
      var segC = {A:'var(--g)',B:'var(--accent)',C:'var(--tx3)'}[seg]||'var(--tx3)';
      var icon = d==='critical' ? '🔴' : '🟡';
      var label = d==='critical' ? 'SEO défaillant' : 'À surveiller';
      var short = (a.title||a.asin).substring(0,60)+((a.title||'').length>60?'…':'');
      var asinJ = "'" + a.asin + "'";
      h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd)">';
      h += '<div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:'+segC+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff">'+seg+'</div>';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(short) + '</div>';
      h += '<div style="font-size:10px;color:var(--tx3);font-family:var(--mono)">' + esc(a.asin) + ' · ' + fmtEur(getRevenue(a,c)||0) + '</div>';
      h += '</div>';
      h += '<div style="flex-shrink:0;font-size:10px;color:var(--tx3)">' + icon + ' ' + label + '</div>';
      h += '<div style="display:flex;gap:4px">';
      h += '<button class="btn btn-xs btn-p" onclick="goAgentVC('+asinJ+')">🚀 Optimiser</button>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div>';
  }

  // ── Zone 3 : Fiches en cours / non effectives ──
  var inProgress = asins.filter(function(a) {
    var s = seoGetStatus(a.asin, c);
    return s === 'generated' || s === 'submitted' || s === 'overdue' || s === 'failed';
  });

  if (inProgress.length > 0) {
    h += '<div class="cd">';
    h += '<div style="font-size:12px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">📋 Fiches en cours (' + inProgress.length + ')</div>';
    inProgress.forEach(function(a) {
      var status = seoGetStatus(a.asin, c);
      var si = seoStatusLabel(status);
      var fiche = c.ficheOptimisee && c.ficheOptimisee[a.asin];
      var lastAction = fiche && fiche.actions && fiche.actions.length ? fiche.actions[fiche.actions.length-1] : null;
      var short = (a.title||a.asin).substring(0,55)+((a.title||'').length>55?'…':'');
      var asinJ = "'" + a.asin + "'";
      h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd)">';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(short) + '</div>';
      h += '<div style="font-size:10px;color:var(--tx3);font-family:var(--mono)">' + esc(a.asin) + (lastAction ? ' · ' + new Date(lastAction.submittedAt).toLocaleDateString('fr-FR') : '') + '</div>';
      h += '</div>';
      h += '<div style="flex-shrink:0;font-size:11px;font-weight:600;color:'+si.color+'">' + si.icon + ' ' + si.label + '</div>';
      h += '<button class="btn btn-xs" onclick="openSEODrawer('+asinJ+')">👁 Voir</button>';
      if (status==='submitted'||status==='overdue') {
        h += '<button class="btn btn-xs" style="background:var(--or);color:#fff;border-color:var(--or)" onclick="seoLaunchVerify('+asinJ+')">🔍 Vérif.</button>';
      }
      if (status==='failed') {
        h += '<button class="btn btn-xs" style="background:var(--r);color:#fff;border-color:var(--r)" onclick="seoOpenCase('+asinJ+')">🆘</button>';
      }
      h += '</div>';
    });
    h += '</div>';
  } else {
    h += '<div class="alr alr-g">✅ Aucune fiche en attente — tout est conforme ou non encore généré.</div>';
  }

  h += '</div>';
  return h;
}

function seoSearchInput() {
  var input = document.getElementById('seo-asin-input');
  if (!input) return;
  var q = input.value.trim().toUpperCase();
  var results = document.getElementById('seo-search-results');
  if (!results) return;
  if (q.length < 3) { results.innerHTML = ''; return; }
  var c = cl();
  if (!c) return;
  var matches = c.asins.filter(function(a) {
    return a.asin.toUpperCase().includes(q) ||
           (a.title||'').toUpperCase().includes(q) ||
           (c.asins.some(function(x){ return x.asin===a.asin && x.vendorCode && x.vendorCode.toUpperCase().includes(q); }));
  }).slice(0, 5);
  if (!matches.length) { results.innerHTML = '<div style="font-size:11px;color:var(--tx3);padding:4px 0">Aucun résultat</div>'; return; }
  var h = '';
  matches.forEach(function(a) {
    var short = (a.title||a.asin).substring(0,60);
    h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer" onclick="document.getElementById(\'seo-asin-input\').value=\''+esc(a.asin)+'\';document.getElementById(\'seo-search-results\').innerHTML=\'\'">';
    h += '<span style="font-family:var(--mono);font-size:11px;color:var(--accent)">'+esc(a.asin)+'</span>';
    h += '<span style="font-size:11px;color:var(--tx2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(short)+'</span>';
    h += '</div>';
  });
  results.innerHTML = h;
}

function seoSearchGo() {
  var input = document.getElementById('seo-asin-input');
  if (!input) return;
  var q = input.value.trim().toUpperCase();
  if (!q) return;
  var c = cl();
  if (!c) return;
  var a = c.asins.find(function(x){ return x.asin.toUpperCase() === q; });
  if (!a) {
    // Cherche par titre ou ref
    a = c.asins.find(function(x){ return (x.title||'').toUpperCase().includes(q); });
  }
  if (!a) { showToast('ASIN non trouvé dans le catalogue', 'alr-r'); return; }
  goAgentVC(a.asin);
}

function seoLaunchNewRef() {
  showToast('Route A — Création nouvelle référence : fonctionnalité en préparation', 'alr-b');
}

function buildDonneesMarche(enrichies) {
  if (!enrichies) return '';
  var lines = [''];
  lines.push('━━━━━━━━━━━━━━━━━━');
  lines.push('DONNÉES MARCHÉ (Source : Amazon Live + SERP — lues lors de cet appel)');
  lines.push('━━━━━━━━━━━━━━━━━━');
  if (enrichies.definition || enrichies.usages || enrichies.caracteristiques) {
    lines.push('DÉFINITION PRODUIT :');
    if (enrichies.definition)       lines.push('  ' + enrichies.definition);
    if (enrichies.usages)           lines.push('  Usages : ' + enrichies.usages);
    if (enrichies.caracteristiques) lines.push('  Caractéristiques : ' + enrichies.caracteristiques);
    lines.push('');
  }
  if (enrichies.titre_actuel) {
    lines.push('FICHE AMAZON ACTUELLE :');
    lines.push('Titre actuel : ' + enrichies.titre_actuel);
    if (enrichies.note)  lines.push('Note : ' + enrichies.note);
    if (enrichies.specs) lines.push('Specs : ' + enrichies.specs);
    if (enrichies.bullets_actuels && enrichies.bullets_actuels.length) {
      lines.push('Bullets actuels :');
      enrichies.bullets_actuels.forEach(function(b){ lines.push('  • ' + b); });
    }
    lines.push('');
  }
  return lines.join('\n');
}

function buildSEOPrompt(a, c, lang, isBackendKW) {
  const langLabels = { fr:'français', de:'allemand', it:'italien', es:'espagnol',
                       en:'anglais', nl:'néerlandais', sv:'suédois', pl:'polonais' };
  const langName = langLabels[lang] || lang;
  const ppm = (c.ppmData||{})[a.asin];
  const niveau = ppm?.ppm >= 30 ? 'haut de gamme'
               : ppm?.ppm >= 15 ? 'milieu de gamme'
               : ppm?.ppm >= 5  ? 'entrée de gamme'
               : 'niveau non déterminé';
  const pot = calcPotential(a, c);
  const trend = calcTrend(a);
  const convRate = a.glanceViews > 0 && a.revenue > 0
    ? (a.revenue / a.glanceViews * 100).toFixed(1) + '%' : 'N/D';
  const totalCA = c.asins.reduce((s,x) => s+(x.revenue||0), 0);

  const dataCtx = [
    'ASIN : ' + a.asin + ' | Marque : ' + (a.brand || 'N/D'),
    'Titre actuel : ' + (a.title || 'N/D'),
    'CA semaine : ' + fmtEur(a.revenue || 0) + ' | Tendance : ' + (trend?.label || 'N/D'),
    'Taux de conversion : ' + convRate,
    'Retours : ' + (a.returns || 0) + ' | Retail % : ' + (a.retailPct || 'N/D'),
    'Segment : ' + calcSegment(a, totalCA),
    'Niveau de gamme estimé (PPM) : ' + niveau + (ppm?.ppm != null ? ' (' + ppm.ppm.toFixed(1) + '%)' : ''),
    'Score potentiel : ' + pot.score + '/100',
    pot.signals.filter(s => s.cls === 'r').length > 0
      ? 'Alertes Vendor : ' + pot.signals.filter(s => s.cls === 'r').map(s => s.label).join(', ')
      : '',
    a.ficheAmazon ? '\n--- FICHE AMAZON ACTUELLE (titre, bullets, description, avis, concurrents) ---\n' + a.ficheAmazon : '',
  ].filter(Boolean).join('\n');

  // ── BACKEND KW ─────────────────────────────────────────────────────────────
  if (isBackendKW) {
    return 'Tu es un expert Amazon SEO.\n'
      + 'Génère UNIQUEMENT les backend keywords en ' + langName + '.\n'
      + 'RÈGLES STRICTES :\n'
      + '- Séparateur : espace uniquement (jamais de virgule ni ponctuation)\n'
      + '- Maximum 249 BYTES — règle safe : viser 240-245 bytes réels\n'
      + '- ATTENTION : les accents français comptent 2 bytes (é, è, à, ü...)\n'
      + '- Si le champ dépasse 249 bytes, Amazon désindexe TOUT le champ sans warning\n'
      + '- Structure 4 blocs : usages → contextes → synonymes → longue traîne\n'
      + '- Le mot-clé principal peut figurer même s\'il est dans le titre — renforce la pertinence\n'
      + '- Maximum 35 mots — pas plus\n'
      + '- INTERDIT absolument : "pas cher", "discount", "budget", "économique", "meilleur", "top", "n°1", tout superlatif, tout claim commercial\n'
      + '- INTERDIT : noms de marques concurrentes\n'
      + '- Un mot = un concept utile — zéro remplissage\n'
      + '- Zéro répétition entre les blocs\n'
      + '- Zéro stop words inutiles (de, le, la, pour, avec)\n'
      + '- Zéro terme trop générique seul (maison, outil, produit)\n'
      + '- Préférer les usages concrets — couverture sémantique dense, pas liste disparate\n'
      + 'Réponds UNIQUEMENT avec les mots clés, rien d\'autre.\n\n'
      + dataCtx;
  }

  // ── PROMPT PRINCIPAL ────────────────────────────────────────────────────────
  return (
    'Tu es un consultant senior Amazon Vendor spécialisé en SEO A10, conversion et stratégie catalogue.\n'
  + 'Tu travailles pour un compte Vendor Central 1P. Ta mission : produire une fiche qui se positionne mieux, convertit mieux, et génère moins de retours.\n'
  + 'Langue de rédaction exclusive : ' + langName.toUpperCase() + '\n\n'

  + '━━━━━━━━━━━━━━━━━━\n'
  + 'DONNÉES PRODUIT\n'
  + '━━━━━━━━━━━━━━━━━━\n'
  + dataCtx + '\n\n'

  + '━━━━━━━━━━━━━━━━━━\n'
  + 'PHASE 0 — ANALYSE OBLIGATOIRE AVANT TOUTE RÉDACTION\n'
  + '━━━━━━━━━━━━━━━━━━\n'
  + 'IMPORTANT : ne rédige RIEN (titre, bullets, description) avant d\'avoir complété cette phase.\n\n'

  + '1. RISQUE SÉMANTIQUE\n'
  + 'Le terme de recherche principal crée-t-il de fausses attentes ?\n'
  + 'La SERP est-elle dominée par une catégorie supérieure ou différente ?\n'
  + '→ Si oui : définir une case distincte. Ne jamais imiter la catégorie dominante.\n\n'

  + '2. RÉALITÉ PRODUIT (une phrase)\n'
  + 'Ce produit est [type exact], pour [profil acheteur réel], avec [limite principale].\n'
  + 'RÈGLE ABSOLUE : n\'invente aucune spec, matière, dimension non présente dans les données.\n'
  + 'Si une information n\'est pas dans les données fournies → ne pas l\'écrire.\n\n'

  + '3. ANALYSE CONCURRENTIELLE\n'
  + 'Si la fiche Amazon est fournie, identifie depuis les produits associés :\n'
  + '- Les 2-3 concurrents directs (nom, prix estimé, note)\n'
  + '- Les arguments de titre surutilisés → à éviter\n'
  + '- La case libre : ce que personne ne dit mais que ce produit peut revendiquer honnêtement\n\n'

  + '4. LECTURE DES AVIS\n'
  + 'Si des avis sont fournis :\n'
  + 'Cause réelle des avis négatifs : mauvaise utilisation ou défaut produit ?\n'
  + '→ Mauvaise utilisation → opportunité pédagogique dans les bullets\n'
  + '→ Défaut produit → ne pas promettre ce que le produit ne fait pas\n'
  + 'Signal bimodal (beaucoup de 5★ + beaucoup de 1★) = produit technique mal documenté → fort levier pédagogique\n\n'

  + '5. NO GO POTENTIEL\n'
  + 'Arrête-toi et signale dans ALERTES_FRED si :\n'
  + '- Le prix positionne le produit contre des concurrents mieux notés sur la même SERP\n'
  + '- Un défaut produit structurel génère des avis négatifs indépendamment de la fiche\n'
  + '- La note est < 3,5★ avec > 50 avis (fiche seule insuffisante)\n'
  + '- Une spec dans la fiche actuelle est fausse (matière incorrecte, dimensions erronées)\n'
  + '- Rupture de stock signalée\n\n'

  + '6. POSITIONNEMENT RETENU\n'
  + 'En une phrase : angle marketing, mot-clé prioritaire, profil acheteur cible.\n\n'

  + '━━━━━━━━━━━━━━━━━━\n'
  + 'RÈGLES DE RÉDACTION IMPÉRATIVES\n'
  + '━━━━━━━━━━━━━━━━━━\n'
  + '- Langue : ' + langName + ' naturel, clair, vendeur\n'
  + '- JAMAIS inventer une spec, matière, dimension, usage non confirmé par les données\n'
  + '- JAMAIS sur-promettre — adapter au niveau réel du produit (' + niveau + ')\n'
  + '- Vocabulaire acheteur (usages réels) > vocabulaire fabricant (specs techniques)\n'
  + '- Données chiffrées concrètes > qualificatifs vagues ("360g" > "léger", "11cm" > "plat")\n'
  + '- INTERDIT titre ET bullets : "garantie à vie", "incassable", "indestructible", "meilleur", "n°1", "professionnel" si non prouvé, "compatible tous modèles" si non vérifié, "grandes surfaces" si non adapté\n'
  + '- "Garantie à vie" : autorisée UNIQUEMENT dans la description, formulée factuellement si documentée\n'
  + '- Sur les produits face aux leaders (WD-40, Gardena, Facom...) : différencier par usages réels et pédagogie — jamais concurrencer frontalement\n\n'

  + '━━━━━━━━━━━━━━━━━━\n'
  + 'FICHE PRODUIT — GÉNÈRE EXACTEMENT DANS CET ORDRE\n'
  + '━━━━━━━━━━━━━━━━━━\n\n'

  + 'NOM_TYPE_PRODUIT: [minuscules, sans marque, précis — ex: tenaille russe / roue jockey de remorque / cisaille à haies manuelle]\n\n'

  + 'TITRE: [structure : Marque + Référence + Mot-clé principal + Matière/Format + Nom technique exact + Usage + Contexte]\n'
  + 'RÈGLES TITRE :\n'
  + '- 200 chars maximum — plafond, pas cible. Utiliser autant que nécessaire pour être complet et vendeur\n'
  + '- Référence interne OBLIGATOIRE juste après la marque\n'
  + '- Mot-clé principal en POSITION 3 (après Marque + Référence) — Amazon pondère les premiers mots\n'
  + '- Double occurrence autorisée si deux façons de chercher ("machine à crépir" + "tyrolienne")\n'
  + '- Séparateurs : tirets - uniquement (JAMAIS | / ! ? * $)\n'
  + '- Majuscule à chaque mot sauf articles/prépositions\n'
  + '- La matière va dans le titre UNIQUEMENT si c\'est un argument décisif (chrome vanadium = oui / PVC = non)\n'
  + '- Sur les outils à double fonction : expliciter les deux extrémités ("outil 2 têtes plate et œil")\n'
  + '- Sur les kits : expliciter ce qui est inclus ("kit bride + visserie incluses")\n'
  + '- Sur les specs critiques de compatibilité : les inclure (Ø35mm, charge 80kg)\n'
  + '- INTERDIT : prix, promos, "meilleur", "n°1", "gratuit", "garantie à vie"\n\n'

  + 'BULLET_1: [Question client : "C\'est quoi et à quoi ça sert ?" — si produit mal compris : expliquer le bénéfice avant de vendre]\n'
  + 'BULLET_2: [Question client : "Pour quel usage / surface / compatibilité ?" — cadrer l\'usage réel + limites]\n'
  + 'BULLET_3: [Question client : "Est-ce compatible avec mon besoin ?" — données concrètes chiffrées]\n'
  + 'BULLET_4: [Question client : "Dans quels cas je vais l\'utiliser ?" — projection + profil + renvoi gamme si pertinent]\n'
  + 'BULLET_5: [ANTI-DÉCEPTION OBLIGATOIRE — "Quelles limites ou précautions ?" — toujours présent, jamais générique]\n\n'
  + 'RÈGLES BULLETS :\n'
  + '- Exactement 5 bullets\n'
  + '- 2-3 phrases maximum par bullet — sur mobile les longs bullets ne se lisent pas\n'
  + '- Chaque bullet = un angle distinct — zéro redondance\n'
  + '- Une seule icône par bullet, en PREMIER, choisie selon le contexte réel\n'
  + '- Icônes : 🔧 outil 🏗️ construction ⚙️ mécanique ⚖️ poids 🛡️ protection 🚗 auto 🌿 jardin 🔥 chaleur 🧰 kit 📏 dimensions 💪 résistance ⚠️ limite 🎯 précision 🤲 prise en main 🧘 sport/fitness 🔩 visserie\n'
  + '- INTERDIT : ⭐ ✅ ❌ répétition d\'icône bullet sur la marque\n'
  + '- 200-250 caractères recommandés par bullet\n'
  + '- Specs à risque de malentendu → bullet dédié à l\'EXPLICATION pas juste la donnée\n'
  + '  (charge à la flèche ≠ poids total remorque / longueur étirée ≠ longueur repos)\n'
  + '- "Kit complet" → expliciter ce qui est inclus ET ce que ça évite d\'acheter séparément\n'
  + '- Matière limite (PVC, acier chromé) → dans bullet 5 uniquement, jamais dans titre\n\n'

  + 'DESCRIPTION: [HTML strict]\n'
  + 'STRUCTURE OBLIGATOIRE :\n'
  + '<p><strong>[Nom exact produit + usage principal]</strong> est conçu pour [usage réel].</p>\n'
  + '<p>Grâce à [caractéristique clé], il permet de [bénéfice concret + comparaison si pertinent].</p>\n'
  + '<p>Il convient pour [contextes], adapté à [niveau réel : particulier / bricoleur / artisan].</p>\n'
  + '<p>[Phrase technique si nécessaire : consistance, compatibilité, dosage, matière réelle...]</p>\n'
  + '<p>[Phrase anti-déception : montage requis / accessoire non fourni / limite usage / spec importante...]</p>\n'
  + '<ul><li>Référence : ...</li><li>Matière : ...</li><li>Dimensions : ...</li><li>Usage : ...</li></ul>\n'
  + 'RÈGLES DESCRIPTION :\n'
  + '- Ne pas répéter les bullets — compléter et rassurer\n'
  + '- Expliquer les specs complexes en langage naturel\n'
  + '- Informations "négatives" utiles filtrent les mauvais acheteurs — les inclure\n'
  + '- Balises autorisées : <p> <strong> <ul> <li> UNIQUEMENT — pas de <b> <br> CSS\n'
  + '- Ton adapté au niveau réel : entrée de gamme ≠ premium\n'
  + '- Penser mobile : paragraphes de 1-2 phrases, liste courte\n\n'

  + 'BACKEND_KEYWORDS: [espaces uniquement — 240-245 bytes réels maximum (accents = 2 bytes) — 4 blocs : usages → contextes → synonymes → longue traîne — mot-clé principal autorisé même si dans titre]\n\n'

  + '━━━━━━━━━━━━━━━━━━\n'
  + 'SYNTHÈSE STRATÉGIQUE\n'
  + '━━━━━━━━━━━━━━━━━━\n'
  + 'POSITIONNEMENT_AMAZON: [positionnement retenu — 1 phrase claire et spécifique]\n'
  + 'LEVIERS_RANKING: [3 leviers : 1 algorithmique / 1 longue traîne / 1 conversion]\n'
  + 'ERREURS_A_EVITER: [erreurs spécifiques à CE produit — pas génériques]\n'
  + 'OPPORTUNITE_SEO: [1 opportunité concrète non exploitée par les concurrents]\n'
  + 'POINT_IMPORTANT: [Le vrai enjeu — quelle est la promesse implicite du terme de recherche et en quoi le produit s\'en écarte ? Comment la fiche corrige cet écart sans perdre la visibilité SEO ?]\n'
  + 'ALERTES_FRED: [Problèmes à signaler indépendamment du SEO : rupture stock / spec fausse / défaut produit structurel / note trop basse / claim incorrect fiche actuelle — VIDE si aucun problème]'
  );
}

// ── Utilitaires ─────────────────────────────────────────────────
function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

// ── Helpers mot-clé par ASIN ────────────────────────────────────
function seoSetMotcle(asin, val) {
  seoMotcle[asin] = val;
}
function seoResetMotcle(asin) {
  delete seoMotcle[asin];
  refreshSEODrawer();
}

// ── extractSearchKeyword ─────────────────────────────────────────
function extractSearchKeyword(asin, c) {
  var a = c.asins.find(function(x){ return x.asin === asin; });
  if (!a || !a.title) return '';
  var title = a.title.toLowerCase();
  var brand = (a.brand || '').toLowerCase().trim();
  var internalRef = (a.internalRef || '').toLowerCase().trim();
  var stopWords = ['de','du','des','la','le','les','un','une','et','en','au','aux','pour',
    'avec','sans','sur','par','à','a','the','for','with','and','of','in','to',
    'set','lot','pack','pcs','x','nos','notre','pro','kit','new','by'];
  if (brand.length >= 2) {
    title = title.replace(new RegExp('\\b' + brand.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b','g'),' ');
  }
  if (internalRef.length >= 2) {
    title = title.replace(new RegExp('(?:^|\\s)' + internalRef.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '(?:\\s|$)','g'),' ');
  }
  title = title.replace(/\b\d+[,.]?\d*\s*(mm|cm|m|cl|l|ml|kg|g|w|v|hz|inch|pcs|pieces|pc)\b/gi,' ');
  title = title.replace(/\b\d+x\d+(?:x\d+)?\b/gi,' ');
  title = title.replace(/\b\d+\b/g,' ');
  title = title.replace(/[^\wàáâãäçéèêëîïôùúûü\s]/gi,' ');
  var words = title.split(/\s+/)
    .map(function(w){ return w.trim(); })
    .filter(function(w){ return w.length >= 3 && !stopWords.includes(w); });
  return words.slice(0, 4).join(' ').trim();
}

// ── seoFetchDefinition — aperçu IA Google sur le type de produit ──
async function seoFetchDefinition(typeHint) {
  var tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }];
  var prompt = 'Recherche Google : "' + typeHint + '"\n'
    + 'Retourne UNIQUEMENT l\'aperçu IA Google (2-4 phrases max) : définition, usages principaux, caractéristiques physiques clés.\n'
    + 'FORMAT :\nDEFINITION: [texte]\nUSAGES: [texte]\nCARACTERISTIQUES: [texte]';
  var raw = await callAPI('', prompt, 'seo_enrich', tools, 400);
  if (isAIError(raw) || !raw) return { definition: '', usages: '', caracteristiques: '' };
  return {
    definition:       (raw.match(/DEFINITION:\s*(.+)/)       || [])[1] || '',
    usages:           (raw.match(/USAGES:\s*(.+)/)           || [])[1] || '',
    caracteristiques: (raw.match(/CARACTERISTIQUES:\s*(.+)/) || [])[1] || ''
  };
}

// ── seoFetchFiche — lit la fiche Amazon existante ──
async function seoFetchFiche(asin, market) {
  var url = 'https://www.amazon' + market + '/dp/' + asin;
  var tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }];
  var prompt = 'Lis cette page Amazon : ' + url + '\n'
    + 'Retourne UNIQUEMENT :\n'
    + 'TITRE_ACTUEL: [titre exact]\n'
    + 'BULLETS_ACTUELS: [bullet1 | bullet2 | bullet3 | bullet4 | bullet5]\n'
    + 'NOTE: [X/5 (N avis)]\n'
    + 'SPECS: [matériau, dimensions, couleur — uniquement ce qui est affiché sur la page]';
  var raw = await callAPI('', prompt, 'seo_enrich', tools, 1000);
  if (isAIError(raw) || !raw) return { titre_actuel: '', bullets_actuels: [], note: '', specs: '' };
  return {
    titre_actuel:    (raw.match(/TITRE_ACTUEL:\s*([^\n]+)/)    || [])[1] || '',
    bullets_actuels: ((raw.match(/BULLETS_ACTUELS:\s*([^\n]+)/) || [])[1] || '').split('|').map(function(s){ return s.trim(); }).filter(Boolean),
    note:            (raw.match(/NOTE:\s*([^\n]+)/)             || [])[1] || '',
    specs:           (raw.match(/SPECS:\s*([^\n]+)/)            || [])[1] || ''
  };
}

// ── extractMotsTitreBullets — liste de mots à exclure des backend KW ──
function extractMotsTitreBullets(titre, bullets) {
  var stopWords = new Set(['de','du','des','la','le','les','un','une','et','en','au','aux',
    'pour','avec','sans','sur','par','à','a','the','for','with','and','of','in','to',
    'est','sont','ce','se','si','ne','pas','plus','très','tout','mais','ou','car',
    'qui','que','dont','où','il','elle','ils','elles','vous','nous','on','sa','son','ses']);
  var all = [titre || ''].concat(bullets || []).join(' ');
  var words = all.toLowerCase()
    .replace(/[^a-zàáâãäçéèêëîïôùúûü\s]/gi,' ')
    .split(/\s+/)
    .filter(function(w){ return w.length >= 3 && !stopWords.has(w); });
  return Array.from(new Set(words)).join(' ');
}

function parseSEOResponse(text, lang) {
  const result = { titre: '', bullets: ['','','','',''], description: '',
                   nomType: '', backendKW: '', images: [],
                   positionnement: '', leviers: '', erreurs: '', opportunite: '',
                   pointImportant: '', alertesFred: '' };
  try {
    // Utiliser split par lignes pour éviter les regex multilignes
    function extractField(t, key) {
      const lines = t.split('\n');
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        const idx = line.indexOf(key + ':');
        if (idx !== -1) {
          let val = line.slice(idx + key.length + 1).trim();
          // Récupérer les lignes suivantes si la valeur continue
          let li2 = li + 1;
          while (li2 < lines.length && lines[li2] && !lines[li2].match(/^[A-Z_\u00C9]{3,}:/) && !lines[li2].match(/^[-─━]{3,}/) && !lines[li2].match(/^\*\*ÉTAPE|^ÉTAPE/)) {
            val += ' ' + lines[li2].trim();
            li2++;
          }
          return val.trim();
        }
      }
      return '';
    }

    result.nomType      = extractField(text, 'NOM_TYPE_PRODUIT').replace(/\*\*/g, '').trim();
    result.titre        = extractField(text, 'TITRE').replace(/\*\*/g, '').trim();
    result.backendKW    = extractField(text, 'BACKEND_KEYWORDS');
    result.positionnement = extractField(text, 'POSITIONNEMENT_AMAZON').replace(/\*\*/g, '').trim();
    result.leviers      = extractField(text, 'LEVIERS_RANKING').replace(/\*\*/g, '').trim();
    result.erreurs      = extractField(text, 'ERREURS_A_EVITER').replace(/\*\*/g, '').trim();
    result.opportunite  = extractField(text, 'OPPORTUNITE_SEO').replace(/\*\*/g, '').trim();
    result.pointImportant = extractField(text, 'POINT_IMPORTANT').replace(/\*\*/g, '').trim();
    result.alertesFred    = extractField(text, 'ALERTES_FRED').replace(/\*\*/g, '').trim();

    for (let i = 1; i <= 5; i++) {
      result.bullets[i-1] = extractField(text, 'BULLET_' + i).replace(/\*\*/g, '').trim();
    }
    const descMatch = text.match(/DESCRIPTION:\s*([\s\S]+?)(?=\n?(?:PRECONISATIONS_IMAGES|BACKEND_KEYWORDS|POSITIONNEMENT_AMAZON|LEVIERS_RANKING|ERREURS_A_EVITER|OPPORTUNITE_SEO|REFERENCE_MANQUANTE|ÉTAPE|---)|$)/);
    if (descMatch) result.description = descMatch[1].trim().replace(/```html|```/g, '').replace(/\*\*/g, '').trim();

    // Parse PRECONISATIONS_IMAGES
    const imgSection = text.match(/PRECONISATIONS_IMAGES:[\s\S]*?(?=BACKEND_KEYWORDS:|$)/);
    if (imgSection) {
      const blocks = imgSection[0].split(/\n?IMAGE_\d+:\s*\n?/);
      result.images = blocks.slice(1).map(function(block) {
        function gf(key) {
          const m = block.match(new RegExp(key + ':\\s*(.+)'));
          return m ? m[1].trim() : '';
        }
        return {
          emplacement: gf('emplacement'), type: gf('type'),
          scene: gf('scene'), texte_overlay: gf('texte_overlay'),
          pourquoi: gf('pourquoi_cette_image')
        };
      }).filter(function(img) { return img.emplacement || img.type; });
    }
  } catch(e) { /* parsing partiel OK */ }
  return result;
}

// ── Wizard Optimisation Fiche Article ────────────────────────────────────────

function renderOptimisationWizard() {
  var ws  = wizardState;
  var c   = cl(); if (!c) return '<div style="padding:24px" class="alr alr-r">Erreur client</div>';
  var a   = c.asins.find(function(x){ return x.asin === ws.asin; });
  if (!a) return '<div style="padding:24px" class="alr alr-r">ASIN introuvable</div>';
  var mkt = ws.market || '.fr';

  var h = '<div style="max-width:680px;margin:0 auto;padding:1.5rem">';
  h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:1.5rem">';
  h += '<button class="btn btn-sm" onclick="closeWizard()">← Retour</button>';
  h += '<h2 style="font-size:16px;font-weight:500;margin:0">' + (ws.isRegen ? '🔄 Régénérer la fiche' : '✨ Optimiser la fiche Article') + '</h2>';
  h += '<span style="font-size:12px;color:var(--tx3)">' + esc(ws.asin) + '</span>';
  h += '</div>';

  // ── ÉTAPE A — SKU ──────────────────────────────────────────────
  var stepA_done = !!ws.sku;
  h += renderWizardStep('a', 'A', 'Saisir le SKU', stepA_done, ws.step === 'a',
    '<div style="font-size:12px;color:var(--tx3);margin-bottom:8px">Le SKU figure dans le catalogue Vendor Central.</div>' +
    '<input type="text" class="fg-in" id="wiz-sku" style="max-width:280px;font-size:13px" placeholder="Ex: 50405 ou B009L0RMUG" value="' + esc(ws.sku || '') + '" oninput="wizardState.sku=this.value;document.getElementById(\'wiz-sku-btn\').disabled=!this.value.trim()" />' +
    '<div style="margin-top:10px"><button class="btn btn-p" id="wiz-sku-btn" onclick="if(wizardState.sku){wizardNextStep(\'b\')}" ' + (!ws.sku ? 'disabled' : '') + '>Confirmer →</button></div>',
    'SKU : ' + esc(ws.sku || '')
  );

  // ── ÉTAPE B — FICHE AMAZON ─────────────────────────────────────
  var stepB_done = !!(a.ficheAmazon);
  h += renderWizardStep('b', 'B', 'Coller la fiche Amazon', stepB_done, ws.step === 'b',
    '<div style="font-size:12px;color:var(--tx3);margin-bottom:8px">Collez le contenu de la page Amazon.fr — titre actuel, bullets, description, avis, produits associés.<br><span style="color:var(--tx3);opacity:.7">Optionnel mais recommandé pour une analyse précise.</span></div>' +
    '<textarea class="fg-in" style="height:100px;font-size:12px;resize:vertical" placeholder="Collez ici le contenu de la page Amazon.fr..." oninput="saveFicheAmazon(\'' + esc(ws.asin) + '\', this.value)">' + esc(a.ficheAmazon || '') + '</textarea>' +
    '<div style="margin-top:10px;display:flex;gap:8px"><button class="btn btn-p" onclick="wizardRunSEO()">✨ Générer la fiche →</button><button class="btn btn-sm" onclick="wizardNextStep(\'c\')" style="font-size:12px">Passer cette étape</button></div>',
    stepB_done ? 'Fiche Amazon enrichie ✓' : 'Non renseignée'
  );

  // ── ÉTAPE C — GÉNÉRATION CLAUDE ────────────────────────────────
  var seoR = seoResults[ws.asin] && seoResults[ws.asin][mkt];
  var stepC_done = !!seoR;
  var stepC_content;
  if (ws.progress === 'seo') {
    stepC_content = '<div style="font-size:13px;color:var(--tx3)"><span class="spin">⏳</span> Génération en cours...</div>';
  } else if (stepC_done) {
    stepC_content = '<div style="margin-bottom:10px">' +
      '<div style="font-size:12px;font-weight:500;color:var(--color-text-primary);margin-bottom:6px">' + esc(seoR.titre || '') + '</div>' +
      (seoR.bullets || []).map(function(b, i) {
        return '<div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:4px"><strong>B' + (i+1) + '</strong> ' + esc(b) + '</div>';
      }).join('') +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-p" onclick="wizardNextStep(\'d\')">Continuer →</button><button class="btn btn-sm" onclick="wizardRunSEO()">Regénérer</button></div>';
  } else {
    stepC_content = '<button class="btn btn-p" onclick="wizardRunSEO()">✨ Générer</button>';
  }
  h += renderWizardStep('c', 'C', 'Analyse et génération Claude', stepC_done, ws.step === 'c', stepC_content, '');

  // ── ÉTAPE D — SORTIE GPT ───────────────────────────────────────
  var stepD_done = !!(a.ficheGPT);
  h += renderWizardStep('d', 'D', 'Intégrer la sortie GPT', stepD_done, ws.step === 'd',
    '<div style="font-size:12px;color:var(--tx3);margin-bottom:8px">Collez la sortie brute de ChatGPT pour la comparaison.<br><span style="color:var(--tx3);opacity:.7">Optionnel — sans GPT, la fiche Claude est utilisée directement.</span></div>' +
    '<textarea class="fg-in" style="height:100px;font-size:12px;resize:vertical" placeholder="Collez ici la sortie complète de ChatGPT..." oninput="saveFicheGPT(\'' + esc(ws.asin) + '\', this.value);document.getElementById(\'wiz-gpt-btn\').disabled=!this.value.trim()">' + esc(a.ficheGPT || '') + '</textarea>' +
    '<div style="margin-top:10px;display:flex;gap:8px"><button class="btn btn-p" id="wiz-gpt-btn" onclick="wizardRunChallenge()" ' + (!a.ficheGPT ? 'disabled' : '') + '>⚡ Comparer et arbitrer →</button><button class="btn btn-sm" onclick="wizardNextStep(\'f\')" style="font-size:12px">Utiliser la fiche Claude telle quelle</button></div>',
    stepD_done ? 'Sortie GPT renseignée ✓' : 'Non renseignée'
  );

  // ── ÉTAPE E — COMPARAISON ──────────────────────────────────────
  var ch = a.ficheChallenge && a.ficheChallenge[mkt];
  var stepE_done = !!ch;
  if (ws.step === 'e' || stepE_done) {
    var stepE_content;
    if (ws.progress === 'challenge') {
      stepE_content = '<div style="font-size:13px;color:var(--tx3)"><span class="spin">⏳</span> Comparaison en cours...</div>';
    } else if (stepE_done) {
      var eFields = [
        { label: 'Titre',    verdict: ch.verdictTitre   || '' },
        { label: 'Bullet 1', verdict: ch.verdictB1      || '' },
        { label: 'Bullet 2', verdict: ch.verdictB2      || '' },
        { label: 'Bullet 3', verdict: ch.verdictB3      || '' },
        { label: 'Bullet 4', verdict: ch.verdictB4      || '' },
        { label: 'Bullet 5', verdict: ch.verdictB5      || '' },
        { label: 'Desc.',    verdict: ch.verdictDesc     || '' },
        { label: 'Backend',  verdict: ch.verdictBackend  || '' },
      ];
      var eRows = '';
      eFields.forEach(function(f) {
        var winner = f.verdict.startsWith('GPT')    ? '🟢 GPT'
                   : f.verdict.startsWith('Claude') ? '🔵 Claude' : '⚪ Égalité';
        var reason = f.verdict.replace(/^(GPT|Claude|Égalité)\s*—\s*/, '');
        eRows += '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;font-size:12px">' +
          '<span style="min-width:60px;font-weight:500;color:var(--tx3)">' + esc(f.label) + '</span>' +
          '<span style="min-width:70px">' + winner + '</span>' +
          '<span style="color:var(--tx3)">' + esc(reason.split('\n')[0]) + '</span>' +
          '</div>';
      });
      // Synthèse stratégique depuis seoResults
      var _seoRe = seoResults[ws.asin] && seoResults[ws.asin][mkt];
      var eSynthese = '';
      if (_seoRe) {
        eSynthese += '<div style="margin-top:14px;padding-top:12px;border-top:0.5px solid var(--bd)">';
        if (_seoRe.positionnement) eSynthese += '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Positionnement</div><div style="font-size:12px">' + esc(_seoRe.positionnement) + '</div></div>';
        if (_seoRe.leviers)        eSynthese += '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Leviers ranking</div><div style="font-size:12px">' + esc(_seoRe.leviers) + '</div></div>';
        if (_seoRe.erreurs)        eSynthese += '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Erreurs à éviter</div><div style="font-size:12px">' + esc(_seoRe.erreurs) + '</div></div>';
        if (_seoRe.opportunite)    eSynthese += '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:500;color:var(--tx3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">Opportunité SEO</div><div style="font-size:12px">' + esc(_seoRe.opportunite) + '</div></div>';
        if (_seoRe.pointImportant) eSynthese += '<div style="margin-bottom:8px;padding:10px 12px;background:var(--alr-w-bg,#FFF9ED);border-radius:var(--rdl)"><div style="font-size:10px;font-weight:500;color:var(--ok-w,#7A4D00);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">🔥 Point clé</div><div style="font-size:12px">' + esc(_seoRe.pointImportant) + '</div></div>';
        eSynthese += '</div>';
      }
      // GO / NO GO
      var eGoNoGo = (_seoRe && _seoRe.alertesFred)
        ? '<div class="alr alr-w" style="margin-bottom:12px;font-size:12px"><strong>⚠️ Points à vérifier avant publication :</strong><br>' + esc(_seoRe.alertesFred) + '</div>'
        : '<div class="alr alr-g" style="margin-bottom:12px;font-size:12px">✅ GO — aucun point bloquant identifié</div>';

      stepE_content =
        '<div style="font-size:12px;font-weight:500;margin-bottom:10px">Claude <strong>' + esc(String(ch.scoreClaude || '')) + '</strong> · GPT <strong>' + esc(String(ch.scoreGPT || '')) + '</strong></div>' +
        eRows +
        (ch.autocritique ? '<div class="alr alr-w" style="margin:8px 0;font-size:12px"><strong>Autocritique :</strong> ' + esc(ch.autocritique) + '</div>' : '') +
        eSynthese +
        eGoNoGo +
        '<button class="btn btn-p" onclick="wizardNextStep(\'f\')">Voir la fiche fusionnée →</button>';
    } else {
      stepE_content = '<button class="btn btn-p" onclick="wizardRunChallenge()">⚡ Comparer</button>';
    }
    h += renderWizardStep('e', 'E', 'Comparaison & arbitrage', stepE_done, ws.step === 'e', stepE_content, '');
  }

  // ── ÉTAPE F — FICHE FUSIONNÉE ÉDITABLE ────────────────────────
  var fusionSrc = ch || seoR;
  if (ws.step === 'f' || ws.step === 'g') {
    h += renderWizardStep('f', 'F', 'Fiche finale — éditable', true, ws.step === 'f' || ws.step === 'g',
      renderFicheEditable(ws.asin, mkt, fusionSrc, ch) +
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p" onclick="wizardSaveAndChoose()">Valider la fiche →</button><button class="btn btn-sm" onclick="wizardNextStep(\'d\')">← Modifier la comparaison</button></div>',
      ''
    );
  }

  // ── ÉTAPE G — CTA FINAL ────────────────────────────────────────
  if (ws.step === 'g') {
    h += renderWizardStep('g', 'G', 'Que faire de cette fiche ?', false, true,
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-p" onclick="wizardSave(\'' + esc(ws.asin) + '\',\'' + esc(mkt) + '\')">💾 Sauvegarder</button>' +
      '<button class="btn btn-or" onclick="wizardSaveAndPublish(\'' + esc(ws.asin) + '\',\'' + esc(mkt) + '\')">📤 Sauvegarder + Publier dans VC</button>' +
      '<button class="btn btn-sm" onclick="wizardNextStep(\'c\')">🔄 Regénérer depuis le début</button>' +
      '</div>',
      ''
    );
  }

  h += '</div>';
  return h;
}

function renderWizardStep(id, letter, title, done, active, content, summary) {
  var numBg  = done ? 'var(--ok-bg,#EAF3DE)' : active ? '#EEEDFE' : 'var(--s2)';
  var numCol = done ? 'var(--ok,#3B6D11)'    : active ? '#3C3489' : 'var(--tx3)';
  var numTxt = done ? '✓' : letter;
  // Accordéon : étapes done pliées par défaut, dépliables par clic
  var isCollapsed = done && !active && (wizardState.collapsed[id] !== false);
  var showContent = active || !isCollapsed;
  return '<div class="cd" style="padding:1.25rem;margin-bottom:12px;' + (active ? 'border-color:var(--accent)' : done ? 'opacity:0.75' : 'opacity:0.4') + '">' +
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:' + (showContent && content ? '12px' : '0') + '">' +
    '<div style="width:22px;height:22px;border-radius:50%;background:' + numBg + ';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;color:' + numCol + ';flex-shrink:0">' + numTxt + '</div>' +
    '<span style="font-size:14px;font-weight:500">' + esc(title) + '</span>' +
    (done && !active && summary ? '<span style="font-size:11px;color:var(--tx3);margin-left:6px">' + summary + '</span>' : '') +
    (done && !active ? '<span onclick="toggleWizardStep(\'' + id + '\')" style="cursor:pointer;margin-left:auto;color:var(--tx3);font-size:12px;padding:2px 4px">' + (isCollapsed ? '▶' : '▼') + '</span>' : '') +
    '</div>' +
    (showContent ? '<div style="overflow:visible;padding-top:12px">' + content + '</div>' : '') +
    '</div>';
}

function cleanFusionValue(val) {
  if (!val) return '';
  // Supprimer tout ce qui ressemble à VERDICT_xx: ou FUSION_xx: (données corrompues ancien parser)
  return val.replace(/^(VERDICT|FUSION)_[A-Z0-9]+:.*$/gm, '').trim();
}

function renderFicheEditable(asin, mkt, src, ch) {
  if (!src && !(seoResults[asin] && seoResults[asin][mkt])) return '<div style="font-size:12px;color:var(--tx3)">Aucune fiche disponible.</div>';
  var _seoR   = (seoResults[asin] && seoResults[asin][mkt]) || {};
  var titre   = cleanFusionValue((ch && ch.fusionTitre)   || _seoR.titre       || (src && src.titre)       || '');
  var bullets = [
    cleanFusionValue((ch && ch.fusionB1) || (_seoR.bullets && _seoR.bullets[0]) || (src && src.bullets && src.bullets[0]) || ''),
    cleanFusionValue((ch && ch.fusionB2) || (_seoR.bullets && _seoR.bullets[1]) || (src && src.bullets && src.bullets[1]) || ''),
    cleanFusionValue((ch && ch.fusionB3) || (_seoR.bullets && _seoR.bullets[2]) || (src && src.bullets && src.bullets[2]) || ''),
    cleanFusionValue((ch && ch.fusionB4) || (_seoR.bullets && _seoR.bullets[3]) || (src && src.bullets && src.bullets[3]) || ''),
    cleanFusionValue((ch && ch.fusionB5) || (_seoR.bullets && _seoR.bullets[4]) || (src && src.bullets && src.bullets[4]) || ''),
  ];
  var desc    = cleanFusionValue((ch && ch.fusionDesc)    || _seoR.description || (src && src.description) || '');
  var backend = cleanFusionValue((ch && ch.fusionBackend) || _seoR.backendKW   || (src && src.backendKW)   || '');
  var h = '';
  h += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:500;color:var(--tx3);text-transform:uppercase;margin-bottom:4px">Titre</div>' +
    '<textarea class="fg-in" rows="3" style="font-size:12px;resize:vertical" oninput="updateWizardField(\'' + esc(asin) + '\',\'' + esc(mkt) + '\',\'titre\',this.value)">' + esc(titre) + '</textarea></div>';
  bullets.forEach(function(b, i) {
    h += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:500;color:var(--tx3);text-transform:uppercase;margin-bottom:4px">Bullet ' + (i+1) + '</div>' +
      '<textarea class="fg-in" rows="4" style="font-size:12px;resize:vertical" oninput="updateWizardField(\'' + esc(asin) + '\',\'' + esc(mkt) + '\',\'bullet' + i + '\',this.value)">' + esc(b || '') + '</textarea></div>';
  });
  h += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:500;color:var(--tx3);text-transform:uppercase;margin-bottom:4px">Description HTML</div>' +
    '<textarea class="fg-in" rows="8" style="font-size:12px;resize:vertical" oninput="updateWizardField(\'' + esc(asin) + '\',\'' + esc(mkt) + '\',\'description\',this.value)">' + esc(desc) + '</textarea></div>';
  h += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:500;color:var(--tx3);text-transform:uppercase;margin-bottom:4px">Backend keywords</div>' +
    '<textarea class="fg-in" rows="3" style="font-size:12px;resize:vertical" oninput="updateWizardField(\'' + esc(asin) + '\',\'' + esc(mkt) + '\',\'backendKW\',this.value)">' + esc(backend) + '</textarea></div>';
  return h;
}
