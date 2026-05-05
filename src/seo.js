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

function buildVCModifyPrompt(asin, market, fiche, c, sku) {
  var vendorCode = (c && c.vendorCode) ? c.vendorCode : '[À_COMPLÉTER]';
  var mkt = market || '.fr';
  var ficheData = (typeof seoResults !== 'undefined' && seoResults[asin] && seoResults[asin][mkt])
    ? seoResults[asin][mkt] : (c && c.ficheOptimisee && c.ficheOptimisee[asin] && c.ficheOptimisee[asin][mkt] ? c.ficheOptimisee[asin][mkt] : {});
  var backendKW = ficheData.backendKW || fiche.backendKW || '';
  var description = ficheData.description || fiche.description || '';
  var bullets = fiche.bullets || ficheData.bullets || ['', '', '', '', ''];
  var vcUrl = 'https://vendorcentral.amazon' + mkt + '/abis/listing/edit/product_details?sku=' + (sku || asin) + '&asin=' + asin + '&vendorCode=' + vendorCode + '#product_details';
  var lines = [
    'Bonjour. Je suis Fred, propriétaire du compte Amazon Pilot.',
    'Tu vas modifier la fiche produit ' + asin + ' sur Vendor Central' + (mkt !== '.fr' ? ' amazon' + mkt : ' France') + '.',
    '',
    'RÈGLES ABSOLUES :',
    '- Demande-moi confirmation avant de cliquer "Enregistrer et terminer"',
    '- Si un champ est verrouillé (grisé), passe au suivant sans erreur',
    '- Si une erreur VC apparaît, STOP et signale-la moi',
    '',
    'ÉTAPE 1 — Navigation',
    'Navigue vers :',
    vcUrl,
    'Attends le chargement complet (les textareas doivent être visibles).',
    '',
    'ÉTAPE 2 — Remplir le titre',
    'Sélecteur : textarea[name="item_name-0-value"]',
    'Contenu EXACT à saisir :',
    fiche.titre || ficheData.titre || '',
    '',
    'ÉTAPE 3 — Remplir les bullets',
    'bullet_point-0-value : ' + (bullets[0] || ''),
    'bullet_point-1-value : ' + (bullets[1] || ''),
    'bullet_point-2-value : ' + (bullets[2] || ''),
    'bullet_point-3-value : ' + (bullets[3] || ''),
    'bullet_point-4-value : ' + (bullets[4] || ''),
    '',
    'ÉTAPE 4 — Remplir la description',
    'Sélecteur : textarea[name="rtip_product_description-0-value"]',
    'Contenu EXACT :',
    description,
    '',
    'ÉTAPE 5 — Remplir les mots-clés',
    'Sélecteur : input[name="generic_keyword-0-value"]',
    'Contenu EXACT :',
    backendKW,
    '',
    'ÉTAPE 6 — Confirmation',
    'Affiche-moi un récapitulatif de ce qui a été rempli.',
    'Attends mon GO avant de cliquer "Enregistrer et terminer".',
    '',
    'Pour remplir chaque champ, utilise ce code JS (React-compatible) :',
    'function fillField(selector, value) {',
    '  const el = document.querySelector(selector);',
    '  if (!el) { console.warn(\'Champ non trouvé :\', selector); return; }',
    '  const proto = el.tagName === \'TEXTAREA\' ? HTMLTextAreaElement : HTMLInputElement;',
    '  const setter = Object.getOwnPropertyDescriptor(proto.prototype, \'value\').set;',
    '  setter.call(el, value);',
    '  el.dispatchEvent(new Event(\'input\', { bubbles: true }));',
    '  el.dispatchEvent(new Event(\'change\', { bubbles: true }));',
    '}'
  ];
  return lines.join('\n');
}

function showVCConfirmModal(asin, market, fiche, c) {
  var existing = document.getElementById('vc-confirm-modal');
  if (existing) existing.remove();

  var vendorCode = (c && c.vendorCode) ? c.vendorCode : null;
  var bullets = fiche.bullets || [];
  var backendKW = (c && c.ficheOptimisee && c.ficheOptimisee[asin] && c.ficheOptimisee[asin].backendKW)
    ? c.ficheOptimisee[asin].backendKW
    : ((typeof seoResults !== 'undefined' && seoResults[asin] && seoResults[asin].backendKW)
      ? seoResults[asin].backendKW : '');
  var kwCount = backendKW ? backendKW.split(/\s+/).filter(Boolean).length : 0;
  var titrePreview = fiche.titre ? (fiche.titre.length > 60 ? fiche.titre.slice(0, 60) + '…' : fiche.titre) : '(vide)';

  var warnHtml = '';
  if (!vendorCode) {
    warnHtml = '<div style="margin-bottom:10px;padding:8px 10px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;font-size:11px;color:#856404">'
      + '⚠️ <strong>vendorCode non défini</strong> sur ce client — le lien VC contiendra [À_COMPLÉTER]. Pensez à le renseigner dans les paramètres client.'
      + '</div>';
  }

  var asinJ = JSON.stringify(asin);
  var mktJ  = JSON.stringify(market);
  var modalHtml = '<div id="vc-confirm-modal" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)">'
    + '<div style="background:var(--bg,#fff);border:1px solid var(--bd,#ddd);border-radius:10px;padding:20px 24px;max-width:460px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.2)">'
    + '<div style="font-size:15px;font-weight:700;margin-bottom:12px">📤 Modifier Vendor Central</div>'
    + warnHtml
    + '<div style="font-size:12px;margin-bottom:4px;color:var(--tx3,#888)">ASIN · marché</div>'
    + '<div style="font-size:13px;font-weight:600;margin-bottom:12px">' + esc(asin) + ' · amazon' + esc(market) + '</div>'
    + '<div style="font-size:12px;color:var(--tx3,#888);margin-bottom:4px">TITRE</div>'
    + '<div style="font-size:12px;margin-bottom:10px;padding:6px 8px;background:var(--s2,#f5f5f5);border-radius:5px">' + esc(titrePreview) + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;font-size:12px">'
    + '<div style="padding:6px 8px;background:var(--s2,#f5f5f5);border-radius:5px"><span style="color:var(--tx3,#888)">Bullets</span><br><strong>' + bullets.filter(Boolean).length + ' / 5</strong></div>'
    + '<div style="padding:6px 8px;background:var(--s2,#f5f5f5);border-radius:5px"><span style="color:var(--tx3,#888)">Description</span><br><strong>' + (fiche.description ? 'HTML ✓' : 'Vide') + '</strong></div>'
    + '<div style="padding:6px 8px;background:var(--s2,#f5f5f5);border-radius:5px"><span style="color:var(--tx3,#888)">Backend KW</span><br><strong>' + (kwCount ? kwCount + ' mots' : 'Vide') + '</strong></div>'
    + '<div style="padding:6px 8px;background:var(--s2,#f5f5f5);border-radius:5px"><span style="color:var(--tx3,#888)">Vendor code</span><br><strong>' + esc(vendorCode || '⚠️ manquant') + '</strong></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end">'
    + '<button class="btn btn-sm" onclick="document.getElementById(\'vc-confirm-modal\').remove()">Annuler</button>'
    + '<button class="btn btn-sm" style="background:var(--accent,#e07b00);color:#fff;border-color:var(--accent,#e07b00)" onclick="document.getElementById(\'vc-confirm-modal\').remove();_doVCCopy(' + asinJ + ',' + mktJ + ')">✅ Générer le script Claude in Chrome</button>'
    + '</div>'
    + '</div>'
    + '</div>';

  var wrapper = document.createElement('div');
  wrapper.innerHTML = modalHtml;
  document.body.appendChild(wrapper.firstChild);
}

function _doVCCopy(asin, market) {
  var c = cl();
  if (!c) return;
  var fiche = (typeof seoResults !== 'undefined' && seoResults[asin] && seoResults[asin][market])
    ? seoResults[asin][market]
    : (c.ficheOptimisee && c.ficheOptimisee[asin] && c.ficheOptimisee[asin][market]);
  if (!fiche) { showToast('Fiche introuvable pour ce marché.', 'alr-r'); return; }
  var prompt = buildVCModifyPrompt(asin, market, fiche, c);
  navigator.clipboard.writeText(prompt).then(function() {
    if (!c.ficheOptimisee) c.ficheOptimisee = {};
    if (!c.ficheOptimisee[asin]) c.ficheOptimisee[asin] = {};
    c.ficheOptimisee[asin].vcUpdateStatus = 'pending';
    c.ficheOptimisee[asin].vcUpdateAt = new Date().toISOString();
    save();
    showToast('✅ Script copié ! Collez-le dans Claude in Chrome.', 'alr-g');
    refreshSEODrawer();
  }).catch(function() {
    showToast('Erreur clipboard — copiez manuellement.', 'alr-r');
  });
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
  var activeMkt = (typeof seoActiveTab !== 'undefined' && seoActiveTab) || c.mainMarket || '.fr';
  var fiche = (typeof seoResults !== 'undefined' && seoResults[asin] && seoResults[asin][activeMkt])
    ? seoResults[asin][activeMkt]
    : (c.ficheOptimisee && c.ficheOptimisee[asin] && c.ficheOptimisee[asin][activeMkt]);
  if (!fiche || fiche.error) { alert('Aucune fiche générée pour cet ASIN.'); return; }
  showVCConfirmModal(asin, activeMkt, fiche, c);
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
    agentVCState = { asin: null, title: '', market: null, vcCode: '', sku: '', step: 1, isNew: false, newRef: '', newBrand: '', newName: '', newCat: '', newEan: '', newFormVisible: false, expandedSteps: new Set() };
    if (initAsin) {
      agentVCState.asin = initAsin;
      var _a = c.asins.find(function(x){ return x.asin === initAsin; });
      if (_a) {
        agentVCState.title = _a.title || initAsin;
        agentVCState.sku = _a.sku || (c.catalogue && c.catalogue.find && c.catalogue.find(function(x){ return x.asin === initAsin; }))?.sku || '';
        agentVCState.step = 2;
        var _mkts = c.markets && c.markets.length ? c.markets : [c.mainMarket || '.fr'];
        agentVCState.market = _mkts[0];
        if (_mkts.length === 1) {
          agentVCState.step = 3;
          if (c.vendorCode) { agentVCState.vcCode = c.vendorCode; agentVCState.step = 4; }
        }
      }
    }
  }

  var mkts = c.markets && c.markets.length ? c.markets : [c.mainMarket || '.fr'];
  var step = agentVCState.step;
  var asin = agentVCState.asin;

  var fiche4 = null;
  if (asin && agentVCState.market) {
    var _res = (typeof seoResults !== 'undefined' && seoResults[asin]) || {};
    var _mkt = agentVCState.market;
    if (_res[_mkt] && !_res[_mkt].error) {
      fiche4 = _res[_mkt];
    } else if (c.ficheOptimisee && c.ficheOptimisee[asin] && c.ficheOptimisee[asin][_mkt] && !c.ficheOptimisee[asin][_mkt].error) {
      fiche4 = c.ficheOptimisee[asin][_mkt];
    }
  }
  var prog4 = asin ? ((typeof seoResults !== 'undefined' && seoResults[asin] && seoResults[asin]._progress) || null) : null;
  var isGenerating = (typeof seoLoading !== 'undefined' && seoLoading && (typeof seoDrawerAsin !== 'undefined' && seoDrawerAsin === asin));
  var vcStatus = asin && c.ficheOptimisee && c.ficheOptimisee[asin] ? c.ficheOptimisee[asin].vcUpdateStatus : null;
  var bkw = asin ? (
    (typeof seoResults !== 'undefined' && seoResults[asin] && seoResults[asin].backendKW) ||
    (c.ficheOptimisee && c.ficheOptimisee[asin] && c.ficheOptimisee[asin].backendKW) || ''
  ) : '';

  var h = '';
  h += '<style>';
  h += '.avc-wrap{display:flex;flex-direction:column;height:100%;}';
  h += '.avc-topbar{background:var(--bg2,#fff);border-bottom:1px solid var(--bd);padding:0 18px;display:flex;align-items:center;gap:10px;height:46px;flex-shrink:0;}';
  h += '.avc-main{padding:18px 28px;max-width:700px;width:100%;margin:0 auto;overflow-y:auto;flex:1;}';
  h += '.avc-sw{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;}';
  h += '.avc-si{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:2px;}';
  h += '.avc-si.pending{background:var(--bg2);border:2px solid var(--bd);color:var(--tx3);}';
  h += '.avc-si.active{background:var(--or);border:2px solid var(--or);color:#000;}';
  h += '.avc-si.done{background:var(--g);border:2px solid var(--g);color:#fff;}';
  h += '.avc-sc{flex:1;background:var(--bg2);border:1px solid var(--bd);border-radius:10px;overflow:hidden;min-width:0;}';
  h += '.avc-sc.active-card{border-color:var(--or);box-shadow:0 0 0 3px rgba(255,153,0,.12);}';
  h += '.avc-sc.done-card .avc-sh{background:var(--s2);border-bottom:none;}';
  h += '.avc-sh{padding:11px 14px;display:flex;align-items:center;gap:8px;}';
  h += '.avc-st{font-size:12px;font-weight:700;}';
  h += '.avc-ss{font-size:11px;color:var(--tx3);margin-top:1px;}';
  h += '.avc-sb{padding:14px 16px;border-top:1px solid var(--bd);}';
  h += '.avc-mkt-pill{font-size:11px;padding:5px 11px;border-radius:20px;border:1.5px solid var(--bd2);cursor:pointer;background:var(--bg2);color:var(--tx2);font-family:inherit;font-weight:500;display:inline-block;margin:2px;}';
  h += '.avc-mkt-pill.on{background:var(--or);color:#000;border-color:var(--or);font-weight:700;}';
  h += '.avc-pb{height:4px;background:var(--bd);border-radius:2px;overflow:hidden;margin-bottom:6px;}';
  h += '.avc-pf{height:100%;background:var(--or);border-radius:2px;transition:width .4s;}';
  h += '.avc-ft{font-size:11px;padding:9px 11px;border-radius:7px;border:1px solid var(--bd);background:var(--s2);line-height:1.5;margin-bottom:8px;}';
  h += '.avc-bl{font-size:11px;padding:7px 9px;border-radius:7px;background:var(--s2);border:1px solid var(--bd);line-height:1.4;display:flex;gap:7px;margin-bottom:4px;}';
  h += '.avc-kw{font-size:10px;padding:7px 9px;border-radius:7px;border:1px solid var(--bd);background:var(--s2);color:var(--tx2);line-height:1.5;margin-bottom:8px;}';
  h += '.avc-sb-box{background:#1C1C1A;border-radius:7px;padding:12px;margin-bottom:10px;}';
  h += '.avc-sb-box pre{color:#A8E6CF;font-size:9px;font-family:var(--mono,monospace);white-space:pre-wrap;word-break:break-all;line-height:1.6;max-height:180px;overflow-y:auto;}';
  h += '.avc-done{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#D1FAE5;border:1px solid #6EE7B7;border-radius:7px;font-size:11px;color:#065F46;font-weight:500;}';
  h += '.avc-pc{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:7px;}';
  h += '.avc-warn{background:#FEF3C7;border:1px solid #F59E0B;border-radius:7px;padding:8px 10px;font-size:11px;color:#78350F;display:flex;gap:6px;margin-bottom:10px;}';
  h += '</style>';

  h += '<div class="avc-wrap">';
  h += '<div class="avc-topbar">';
  h += '<button class="btn btn-xs" onclick="go(\'asins\')">← Retour</button>';
  h += '<div style="width:1px;height:16px;background:var(--bd)"></div>';
  h += '<div style="font-size:13px;font-weight:700">🚀 Agent SEO + Vendor Central</div>';
  h += '<div style="margin-left:auto;font-size:11px;color:var(--tx3)">' + esc(c.name) + '</div>';
  h += '</div>';
  h += '<div class="avc-main">';

  // Étape 1
  var s1done = step > 1;
  var s1sub = s1done ? (agentVCState.isNew ? 'Nouvel article · ' + agentVCState.newBrand + ' ' + agentVCState.newRef : asin + (agentVCState.title ? ' · ' + agentVCState.title.substring(0,45) + (agentVCState.title.length > 45 ? '…' : '') : '')) : 'ASIN existant ou nouvelle référence à créer';
  h += _avcRenderStep(1, 'Sélectionner l\'ASIN', s1sub, step, _avcBody1(c));

  // Étape 2
  if (step >= 2) {
    var s2sub = step > 2 ? 'amazon' + agentVCState.market : 'Sur quel Amazon modifier la fiche ?';
    h += _avcRenderStep(2, 'Marché cible', s2sub, step, _avcBody2(mkts));
  }

  // Étape 3
  if (step >= 3) {
    var s3sub = step > 3 ? 'VC: ' + agentVCState.vcCode + (agentVCState.sku ? ' · SKU: ' + agentVCState.sku : '') : 'Identifiants Vendor Central';
    h += _avcRenderStep(3, 'Paramètres Vendor Central', s3sub, step, _avcBody3(c));
  }

  // Étape 4
  if (step >= 4) {
    var s4sub = step > 4 ? 'Fiche générée — ' + ((fiche4 && fiche4.bullets) ? fiche4.bullets.filter(Boolean).length : 0) + ' bullets · ' + (bkw ? bkw.split(/\s+/).filter(Boolean).length : 0) + ' KW' : 'L\'Agent génère la fiche complète';
    h += _avcRenderStep(4, 'Fiche SEO optimisée', s4sub, step, _avcBody4(asin, fiche4, isGenerating, prog4, bkw));
  }

  // Étape 5
  if (step >= 5) {
    h += _avcRenderStep(5, 'Pousser dans Vendor Central', 'Script pour Claude in Chrome', step, _avcBody5(asin, fiche4, vcStatus, bkw, c));
  }

  h += '</div></div>';
  return h;
}

function _avcRenderStep(n, title, subtitle, currentStep, body) {
  var st = n < currentStep ? 'done' : n === currentStep ? 'active' : 'pending';
  var expanded = st === 'done' && agentVCState.expandedSteps && agentVCState.expandedSteps.has(n);
  var chevron = st === 'done' ? ' <span style="font-size:10px;color:var(--tx3);margin-left:auto">' + (expanded ? '▼' : '▶') + '</span>' : '';
  var headerClick = st === 'done' ? ' onclick="avcToggleStep(' + n + ')" style="cursor:pointer"' : '';
  var h = '<div class="avc-sw">';
  h += '<div class="avc-si ' + st + '">' + (st === 'done' ? '✓' : n) + '</div>';
  h += '<div class="avc-sc' + (st === 'active' ? ' active-card' : st === 'done' ? ' done-card' : '') + '">';
  h += '<div class="avc-sh"' + headerClick + '><div style="flex:1"><div class="avc-st">' + esc(title) + '</div><div class="avc-ss">' + esc(subtitle) + '</div></div>' + chevron + '</div>';
  if (st === 'active' || expanded) h += '<div class="avc-sb">' + body + '</div>';
  h += '</div></div>';
  return h;
}

function _avcBody1(c) {
  var h = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
  h += '<input id="avc-asin-in" style="flex:1;min-width:0;font-family:var(--mono,monospace);font-size:13px;padding:9px 12px;border:2px solid var(--bd2);border-radius:var(--rd);background:var(--bg2);color:var(--tx);outline:none;letter-spacing:.05em;" placeholder="B0XXXXXXXXX" maxlength="10" oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key===\'Enter\')avcLookupAsin()">';
  h += '<button class="btn btn-p" onclick="avcLookupAsin()">🔍 Rechercher</button>';
  h += '</div>';
  h += '<div id="avc-asin-err" style="display:none;font-size:11px;color:var(--r);margin-bottom:8px">❌ ASIN non trouvé dans le catalogue.</div>';
  h += '<div style="border-top:1px solid var(--bd);padding-top:10px;display:flex;align-items:center;gap:8px">';
  h += '<span style="font-size:11px;color:var(--tx3)">Pas encore dans VC ?</span>';
  h += '<button class="btn btn-xs" style="border-style:dashed" onclick="avcToggleNewForm()">➕ Créer un nouvel article</button>';
  h += '</div>';
  if (agentVCState.newFormVisible) {
    h += '<div style="margin-top:12px;padding:12px;background:#FFF8E6;border:1.5px dashed var(--or);border-radius:7px">';
    h += '<div style="font-size:12px;font-weight:700;margin-bottom:10px">📦 Informations du nouvel article</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
    h += '<div><div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Référence *</div><input id="avc-new-ref" style="font-family:var(--mono,monospace);width:100%;font-size:11px;padding:6px 9px;border:1.5px solid var(--bd);border-radius:6px;background:var(--bg2);color:var(--tx);outline:none;" value="' + esc(agentVCState.newRef) + '" placeholder="Ex: 043902" oninput="agentVCState.newRef=this.value;avcCheckNewForm()"></div>';
    h += '<div><div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Marque *</div><input id="avc-new-brand" style="width:100%;font-size:11px;padding:6px 9px;border:1.5px solid var(--bd);border-radius:6px;background:var(--bg2);color:var(--tx);outline:none;font-family:inherit;" value="' + esc(agentVCState.newBrand) + '" placeholder="Ex: RHINO, COGEX" oninput="agentVCState.newBrand=this.value;avcCheckNewForm()"></div>';
    h += '</div>';
    h += '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Nom du produit *</div><input id="avc-new-name" style="width:100%;font-size:11px;padding:6px 9px;border:1.5px solid var(--bd);border-radius:6px;background:var(--bg2);color:var(--tx);outline:none;font-family:inherit;" value="' + esc(agentVCState.newName) + '" placeholder="Ex: Tenaille Russe 200mm" oninput="agentVCState.newName=this.value;avcCheckNewForm()"></div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
    h += '<div><div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Catégorie Amazon</div><input id="avc-new-cat" style="width:100%;font-size:11px;padding:6px 9px;border:1.5px solid var(--bd);border-radius:6px;background:var(--bg2);color:var(--tx);outline:none;font-family:inherit;" value="' + esc(agentVCState.newCat) + '" placeholder="Outillage à main" oninput="agentVCState.newCat=this.value"></div>';
    h += '<div><div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">EAN (optionnel)</div><input id="avc-new-ean" style="font-family:var(--mono,monospace);width:100%;font-size:11px;padding:6px 9px;border:1.5px solid var(--bd);border-radius:6px;background:var(--bg2);color:var(--tx);outline:none;" value="' + esc(agentVCState.newEan) + '" placeholder="3700000000000" oninput="agentVCState.newEan=this.value"></div>';
    h += '</div>';
    h += '<button class="btn btn-p" id="avc-new-go" ' + (!agentVCState.newRef || !agentVCState.newBrand || !agentVCState.newName ? 'disabled' : '') + ' onclick="avcConfirmNewArticle()">✨ Créer et générer la fiche SEO</button>';
    h += '</div>';
  }
  return h;
}

function _avcBody2(mkts) {
  var flags = { '.fr':'🇫🇷', '.es':'🇪🇸', '.de':'🇩🇪', '.nl':'🇳🇱', '.it':'🇮🇹', '.be':'🇧🇪', '.uk':'🇬🇧', '.pl':'🇵🇱', '.se':'🇸🇪' };
  var h = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">';
  mkts.forEach(function(m) {
    h += '<button class="avc-mkt-pill' + (agentVCState.market === m ? ' on' : '') + '" onclick="avcSetMarket(\'' + m + '\')">' + (flags[m] || '') + ' ' + esc(m) + '</button>';
  });
  h += '</div>';
  h += '<div style="display:flex;justify-content:flex-end"><button class="btn btn-p" onclick="avcConfirmMarket()">Confirmer le marché →</button></div>';
  return h;
}

function _avcBody3(c) {
  var h = '';
  if (!c.vendorCode) h += '<div class="avc-warn">⚠️ <span>Vendor Code non renseigné sur ce client. Complétez la fiche client ou saisissez-le ci-dessous.</span></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">';
  h += '<div><div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Vendor Code</div>';
  h += '<input id="avc-vc-code" style="font-family:var(--mono,monospace);width:100%;font-size:12px;padding:7px 9px;border:1.5px solid var(--bd2);border-radius:6px;background:var(--bg2);color:var(--tx);outline:none;" value="' + esc(agentVCState.vcCode || c.vendorCode || '') + '" placeholder="Ex: COGE3"></div>';
  h += '<div><div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">SKU (optionnel)</div>';
  h += '<input id="avc-sku" style="font-family:var(--mono,monospace);width:100%;font-size:12px;padding:7px 9px;border:1.5px solid var(--bd2);border-radius:6px;background:var(--bg2);color:var(--tx);outline:none;" value="' + esc(agentVCState.sku || '') + '" placeholder="Laisser vide si inconnu"></div>';
  h += '</div>';
  h += '<div style="display:flex;justify-content:flex-end"><button class="btn btn-p" onclick="avcConfirmParams()">Suivant →</button></div>';
  return h;
}

function _avcBody4(asin, fiche, isGenerating, prog, bkw) {
  var h = '';
  if (isGenerating) {
    var pct = (prog && prog.pct) || 0;
    var phase = (prog && prog.phase) || '⏳ Traitement en cours…';
    h += '<div class="avc-pb"><div class="avc-pf" style="width:' + pct + '%"></div></div>';
    h += '<div style="font-size:11px;color:var(--tx3)">' + esc(phase) + '</div>';
    return h;
  }
  if (fiche) {
    var tl = fiche.titre ? fiche.titre.length : 0;
    h += '<div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">📝 Titre (' + tl + ' car.)</div>';
    h += '<div class="avc-ft">' + esc(fiche.titre || '') + '</div>';
    h += '<div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">• Bullets</div>';
    (fiche.bullets || []).forEach(function(b, i) {
      if (!b) return;
      h += '<div class="avc-bl"><span style="font-size:10px;font-weight:700;color:var(--tx3);flex-shrink:0;min-width:14px">' + (i+1) + '</span><span>' + esc(b) + '</span></div>';
    });
    if (bkw) {
      var kwCount = bkw.split(/\s+/).filter(Boolean).length;
      h += '<div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin:8px 0 4px">🔑 Backend KW (' + kwCount + ' mots)</div>';
      h += '<div class="avc-kw">' + esc(bkw) + '</div>';
    }
    if (fiche.images && fiche.images.length) {
      h += '<div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">🖼 Préconisations images</div>';
      fiche.images.forEach(function(img) {
        var txt = typeof img === 'string' ? img : ((img.emplacement || '') + (img.scene ? ' — ' + img.scene : ''));
        h += '<div style="font-size:10px;padding:5px 8px;border-radius:5px;background:var(--s2);border:1px solid var(--bd);color:var(--tx2);margin-bottom:3px">📷 ' + esc(txt) + '</div>';
      });
    }
    h += '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">';
    h += '<button class="btn btn-sm" onclick="avcStartGeneration()">🔄 Régénérer</button>';
    h += '<button class="btn btn-p" style="flex:1" onclick="avcGoToVC()">📤 Valider et pousser dans VC →</button>';
    h += '</div>';
    return h;
  }
  h += '<div style="text-align:center;padding:14px 0">';
  h += '<div style="font-size:26px;margin-bottom:10px">🤖</div>';
  h += '<div style="font-size:13px;font-weight:700;margin-bottom:5px">Prêt à générer</div>';
  h += '<div style="font-size:11px;color:var(--tx3);margin-bottom:16px;line-height:1.5">Analyse de la fiche Amazon + concurrents<br>→ titre · bullets · backend KW · préconisations images</div>';
  h += '<button class="btn btn-p" onclick="avcStartGeneration()">✨ Générer la fiche SEO</button>';
  h += '</div>';
  return h;
}

function _avcBody5(asin, fiche, vcStatus, bkw, c) {
  var asinJ = JSON.stringify(asin);
  if (vcStatus === 'success') {
    var ld = c.ficheOptimisee && c.ficheOptimisee[asin] && c.ficheOptimisee[asin].lastVCUpdate ? new Date(c.ficheOptimisee[asin].lastVCUpdate).toLocaleDateString('fr-FR') : '';
    return '<div class="avc-done">✅ Fiche mise à jour dans Vendor Central · amazon' + esc(agentVCState.market || '.fr') + (ld ? ' · ' + ld : '') + '</div>';
  }
  var h = '';
  if (vcStatus !== 'pending') {
    h += '<button class="btn btn-p" style="width:100%;margin-bottom:10px" onclick="avcGenerateScript()">📋 Générer le script Claude in Chrome</button>';
  } else {
    h += '<div style="display:flex;gap:8px;margin-bottom:10px;align-items:center">';
    h += '<button class="btn btn-sm" onclick="avcGenerateScript()">🔄 Regénérer</button>';
    h += '<span style="font-size:11px;color:var(--g);font-weight:600">✅ Script copié !</span>';
    h += '<span style="margin-left:auto;font-size:10px;padding:2px 8px;border-radius:20px;background:#FEF3C7;color:#78350F;font-weight:700">⏳ En cours</span>';
    h += '</div>';
    if (fiche) {
      var preview = buildVCModifyPrompt(asin, agentVCState.market, fiche, c);
      h += '<div class="avc-sb-box"><pre>' + esc(preview.substring(0, 900)) + (preview.length > 900 ? '\n…[tronqué]' : '') + '</pre></div>';
    }
    h += '<button class="btn btn-g" style="width:100%" onclick="seoMarkVCDone(' + asinJ + ')">✅ Confirmer — fiche mise à jour dans VC</button>';
  }
  return h;
}

function avcLookupAsin() {
  var input = document.getElementById('avc-asin-in');
  var val = input ? input.value.trim().toUpperCase() : '';
  if (!val) return;
  var c = cl();
  if (!c) return;
  var found = c.asins.find(function(x){ return x.asin === val; });
  var errEl = document.getElementById('avc-asin-err');
  if (!found) {
    if (errEl) errEl.style.display = 'block';
    if (input) input.style.borderColor = 'var(--r)';
    return;
  }
  agentVCState.asin = val;
  agentVCState.title = found.title || val;
  agentVCState.sku = found.sku || '';
  agentVCState.step = 2;
  var mkts = c.markets && c.markets.length ? c.markets : [c.mainMarket || '.fr'];
  agentVCState.market = mkts[0];
  if (mkts.length === 1) {
    agentVCState.step = 3;
    if (c.vendorCode) { agentVCState.vcCode = c.vendorCode; agentVCState.step = 4; }
  }
  render();
}

function avcToggleNewForm() {
  agentVCState.newFormVisible = !agentVCState.newFormVisible;
  render();
}

function avcCheckNewForm() {
  var btn = document.getElementById('avc-new-go');
  if (btn) btn.disabled = !(agentVCState.newRef && agentVCState.newBrand && agentVCState.newName);
}

function avcConfirmNewArticle() {
  if (!agentVCState.newRef || !agentVCState.newBrand || !agentVCState.newName) return;
  agentVCState.isNew = true;
  agentVCState.asin = 'NEW-' + agentVCState.newRef;
  agentVCState.title = agentVCState.newBrand + ' ' + agentVCState.newRef + ' — ' + agentVCState.newName;
  agentVCState.sku = agentVCState.newRef;
  agentVCState.step = 2;
  var c = cl();
  var mkts = c && c.markets && c.markets.length ? c.markets : [(c && c.mainMarket) || '.fr'];
  agentVCState.market = mkts[0];
  if (mkts.length === 1) {
    agentVCState.step = 3;
    if (c && c.vendorCode) { agentVCState.vcCode = c.vendorCode; agentVCState.step = 4; }
  }
  render();
}

function avcSetMarket(mkt) {
  agentVCState.market = mkt;
  render();
}

function avcConfirmMarket() {
  if (!agentVCState.market) return;
  var c = cl();
  if (c && c.vendorCode) { agentVCState.vcCode = c.vendorCode; agentVCState.step = 4; }
  else { agentVCState.step = 3; }
  render();
}

function avcConfirmParams() {
  var vcEl = document.getElementById('avc-vc-code');
  var skuEl = document.getElementById('avc-sku');
  agentVCState.vcCode = (vcEl ? vcEl.value.trim() : '') || '[À_COMPLÉTER]';
  agentVCState.sku = skuEl ? skuEl.value.trim() : '';
  agentVCState.step = 4;
  render();
}

function avcStartGeneration() {
  var asin = agentVCState.asin;
  var market = agentVCState.market;
  if (!asin || !market) return;
  var c = cl();
  var motcle = (typeof seoMotcle !== 'undefined' && seoMotcle[asin]) || (typeof extractSearchKeyword === 'function' ? extractSearchKeyword(asin, c) : '');
  seoDrawerAsin = asin;
  runSEOFiche(asin, market, motcle);
}

function avcGoToVC() {
  agentVCState.step = 5;
  render();
}

function avcGenerateScript() {
  var c = cl();
  if (!c) return;
  var asin = agentVCState.asin;
  var market = agentVCState.market;
  var fiche = (typeof seoResults !== 'undefined' && seoResults[asin] && seoResults[asin][market] && !seoResults[asin][market].error)
    ? seoResults[asin][market]
    : (c.ficheOptimisee && c.ficheOptimisee[asin] && c.ficheOptimisee[asin][market]);
  if (!fiche) { showToast('Fiche introuvable pour ce marché.', 'alr-r'); return; }
  var prompt = buildVCModifyPrompt(asin, market, fiche, c, agentVCState.sku);
  navigator.clipboard.writeText(prompt).then(function() {
    if (!c.ficheOptimisee) c.ficheOptimisee = {};
    if (!c.ficheOptimisee[asin]) c.ficheOptimisee[asin] = {};
    c.ficheOptimisee[asin].vcUpdateStatus = 'pending';
    c.ficheOptimisee[asin].vcUpdateAt = new Date().toISOString();
    save();
    showToast('✅ Script copié ! Collez-le dans Claude in Chrome.', 'alr-g');
    render();
  }).catch(function() { showToast('Erreur clipboard — copiez manuellement.', 'alr-r'); });
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

    if (res.backendKW) {
      h += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--tx3);margin-bottom:4px">BACKEND KEYWORDS</div>';
      h += '<div style="padding:7px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rd);font-size:10px;color:var(--tx2);line-height:1.5">' + esc(res.backendKW) + '</div>';
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
      h += '<button class="btn btn-xs" onclick="openSEODrawer('+asinJ+')">🔍 SEO</button>';
      h += '<button class="btn btn-xs btn-p" onclick="goAgentVC('+asinJ+')">📤 VC</button>';
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
  openSEODrawer(a.asin);
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

function buildSEOPrompt(a, c, lang, isBackendKW, enrichies, motsExclure) {
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
  const convRate = a.glanceViews > 0 && getRevenue(a,c) > 0
    ? (getRevenue(a,c) / a.glanceViews * 100).toFixed(1) + '%' : 'N/D';
  const totalCA = c.asins.reduce((s,x) => s+(getRevenue(x,c)||0), 0);

  const dataCtx = [
    'Titre actuel : ' + (a.title || 'N/D'),
    'Référence interne : ' + (a.internalRef || 'NON RENSEIGNÉE'),
    'ASIN : ' + a.asin + ' | Marque : ' + (a.brand || 'N/D'),
    'CA semaine : ' + fmtEur(getRevenue(a,c)||0) + ' | Tendance : ' + (trend?.label || 'N/D'),
    'Taux de conversion : ' + convRate,
    'Retours : ' + (a.returns || 0) + ' | Retail % : ' + (a.retailPct || 'N/D'),
    'Segment : ' + calcSegment(a, totalCA),
    'Niveau de gamme estimé (PPM) : ' + niveau + (ppm?.ppm != null ? ' (' + ppm.ppm.toFixed(1) + '%)' : ''),
    'Score potentiel : ' + pot.score + '/100',
    pot.signals.filter(s => s.cls === 'r').length > 0
      ? 'Alertes : ' + pot.signals.filter(s => s.cls === 'r').map(s => s.label).join(', ')
      : '',
  ].filter(Boolean).join('\n');

  if (isBackendKW) {
    return 'Tu es un expert Amazon SEO.\n'
      + 'Génère UNIQUEMENT les backend keywords en ' + langName + '.\n\n'
      + 'CIBLE : 40 à 60 mots maximum — JAMAIS plus de 60.\n'
      + 'FORMAT : mots séparés par des espaces, en minuscules, sans ponctuation, sans virgule.\n\n'
      + 'INTERDIT (rejet automatique si présent) :\n'
      + '- Tout mot déjà présent dans le titre OU les bullets que tu viens de générer (liste fournie ci-dessous)\n'
      + '- Adjectifs vagues sans intention de recherche : polyvalent, robuste, universel, adaptable, ergonomique, confort, qualité, professionnel, durable, pratique, solide, fiable, performant\n'
      + '- Substantifs génériques sans qualificatif : matériaux, formes, espaces, objets, éléments, produits, articles\n'
      + '- Superlatifs, marques concurrentes\n\n'
      + 'Exception autorisée : les synonymes directs du type de produit (autre appellation usuelle du même objet — ex : "pince" synonyme de "tenaille") sont autorisés même s\'ils semblent vagues isolément, car ils correspondent à une vraie requête Amazon.\n\n'
      + 'TEST DE VALIDITÉ pour CHAQUE mot :\n'
      + 'Termine cette phrase : "Un acheteur tape \'...\' dans la barre Amazon."\n'
      + 'Si le mot ne passe pas le test → exclu.\n\n'
      + 'Réponds UNIQUEMENT avec les mots clés, rien d\'autre.\n\n'
      + dataCtx
      + (motsExclure ? '\n\nMOTS EXCLUS — déjà présents dans le titre et les bullets :\n' + motsExclure : '')
      + (enrichies && enrichies.mots_cles_frequents && enrichies.mots_cles_frequents.length
          ? '\n\nMOTS-CLÉS FRÉQUENTS SERP (à utiliser en priorité s\'ils ne sont pas déjà dans titre/bullets) :\n' + enrichies.mots_cles_frequents.join(', ')
          : '');
  }

  const donneesMarche = buildDonneesMarche(enrichies);
  return 'Tu es un expert Amazon FR, spécialisé en SEO A10, conversion, merchandising marketplace, analyse concurrentielle et stratégie catalogue.\n'
    + 'Tu travailles comme un consultant senior Amazon Vendor — pas comme un simple rédacteur.\n'
    + 'Langue de rédaction exclusive : ' + langName.toUpperCase() + '\n\n'
    + 'OBJECTIF : fiche produit Amazon capable de mieux se positionner, mieux convertir, mieux résister dans le temps.\n'
    + 'Ta réponse DOIT être complète, détaillée, professionnelle — pas une ébauche.\n\n'
    + 'DONNÉES PRODUIT :\n' + dataCtx + '\n'
    + donneesMarche + '\n'
    + '━━━━━━━━━━━━━━━━━━\n'
    + 'ÉTAPE 1 — ANALYSE STRATÉGIQUE OBLIGATOIRE (à produire AVANT la fiche)\n'
    + '━━━━━━━━━━━━━━━━━━\n'
    + 'Analyse et explicite :\n'
    + '1. Positionnement : niveau ' + niveau + ' — usage principal, usage secondaire, bénéfice différenciant réel\n'
    + '2. Concurrence Amazon : familles dominantes SERP, arguments surutilisés à éviter, opportunités sous-exploitées\n'
    + '3. Risques : confusion dimensions/compatibilité/usage/pack/qualité — risque sur-promesse — risque avis négatifs\n'
    + '4. Stratégie : ce qu\'il faut mettre en avant, angle marketing retenu, mot-clé prioritaire, 3 longues traînes\n\n'
    + '━━━━━━━━━━━━━━━━━━\n'
    + 'ÉTAPE 2 — RÈGLES DE RÉDACTION IMPÉRATIVES\n'
    + '━━━━━━━━━━━━━━━━━━\n'
    + '1. Toujours écrire en ' + langName + ' naturel, clair et vendeur\n'
    + '2. Toujours rester crédible et exact — ne jamais inventer une caractéristique\n'
    + '3. Ne jamais sur-promettre — adapter au vrai niveau du produit (' + niveau + ')\n'
    + '4. Toujours raisonner en intention d\'achat\n'
    + '5. Intégrer une logique "anti-déception" — filtrer les mauvais clients\n'
    + '6. Penser comme Amazon : ce produit est-il la réponse exacte à cette recherche ?\n\n'
    + '━━━━━━━━━━━━━━━━━━\n'
    + 'RÈGLES DE CONFORMITÉ ABSOLUE (toutes sections : titre, bullets, description, synthèse)\n'
    + '━━━━━━━━━━━━━━━━━━\n'
    + 'INTERDIT — ne JAMAIS écrire :\n'
    + '- "garantie à vie", "à vie", "garantie illimitée", "lifetime warranty"\n'
    + '- Une durée de garantie chiffrée si elle n\'est PAS présente dans les DONNÉES MARCHÉ ci-dessous\n'
    + '- Une date de création de marque, un effectif, un volume de ventes, un classement, une certification non sourcée\n'
    + '- Un matériau, traitement, dimension non présent dans la fiche actuelle ou les données catalogue\n\n'
    + 'SOURCE DE VÉRITÉ pour les SPECS FACTUELLES :\n'
    + '- Reprends UNIQUEMENT les specs présentes dans le bloc DONNÉES MARCHÉ (titre actuel, bullets actuels, description actuelle, données catalogue)\n'
    + '- Si une spec n\'est pas dans la source de vérité : NE LA MENTIONNE PAS. Préférer le silence à l\'invention.\n'
    + '- Bénéfices, usages, positionnement, ton commercial : LIBRE — utilise avis clients et concurrence comme appui\n\n'
    + '━━━━━━━━━━━━━━━━━━\n'
    + 'ÉTAPE 3 — CRÉATION DE LA FICHE EN ' + langName.toUpperCase() + '\n'
    + '━━━━━━━━━━━━━━━━━━\n'
    + 'GÉNÈRE EXACTEMENT dans cet ordre :\n\n'
    + 'NOM_TYPE_PRODUIT: [en ' + langName + ', minuscules, sans marque, précis, sans underscore — ex: tenaille russe / cric rouleur hydraulique]\n\n'
    + 'TITRE: [Viser 150-200 caractères — 200 max — long, informatif ET lisible par un consommateur]\n'
    + 'STRUCTURE OBLIGATOIRE : [Marque] [Référence interne] - [Type produit exact] [Taille/Format] - [Matériau/Attribut clé] - [Usage principal] - [Contexte/Compatibilité si pertinent]\n'
    + 'RÈGLES TITRE STRICTES :\n'
    + '- La RÉFÉRENCE INTERNE doit figurer IMMÉDIATEMENT après la marque — RÈGLE DURE, jamais d\'exception, ordre EXACT : [Marque] [Référence] - [Type produit]…\n'
    + '- Si la référence interne est inconnue : ne PAS inventer, structurer le titre sans référence et signaler "REFERENCE_MANQUANTE: true" dans la sortie\n'
    + '- Séparateurs : tirets - uniquement (JAMAIS de | / ! ? *)\n'
    + '- Mot-clé principal (type produit exact) dans les 40 premiers caractères — tester : un client comprendrait-il ce produit en lisant le titre ?\n'
    + '- Un même mot maximum 2 fois\n'
    + '- INTERDIT dans le titre : prix, promotions, "meilleur", "n°1", "gratuit", "garantie X ans", "garantie à vie", durée de garantie de toute nature\n'
    + '- Pas de répétition de la taille ou des specs\n'
    + '- Majuscule à chaque mot sauf articles/prépositions\n\n'
    + 'BULLET_1: [🔧 ou icône pertinente — BÉNÉFICE PRINCIPAL + mot-clé central + usage terrain spécifique]\n'
    + 'BULLET_2: [💪 ou icône pertinente — MATÉRIAUX / QUALITÉ + specs techniques + différenciation vs concurrents]\n'
    + 'BULLET_3: [🌱 ou icône pertinente — PROFIL CLIENT + cas d\'usage concrets + polyvalence]\n'
    + 'BULLET_4: [📏 ou icône pertinente — DIMENSIONS / SPECS + ergonomie + compatibilité]\n'
    + 'BULLET_5: [🛡️ ou icône pertinente — GARANTIE + marque/distributeur + réassurance achat]\n\n'
    + 'RÈGLES BULLETS STRICTES :\n'
    + '- Exactement 5 bullets — jamais 4, jamais 6\n'
    + '- Bullet 1 : bénéfice principal + mot-clé central + usage terrain concret\n'
    + '- Bullet 2 : différenciation + matériaux/qualité + specs techniques clés\n'
    + '- Bullet 3 : réassurance technique + compatibilité + profil client ciblé\n'
    + '- Bullet 4 : usage concret + projection client + polyvalence\n'
    + '- Bullet 5 : sécurité / praticité / limite bien cadrée / garantie / marque\n'
    + '- Une seule icône pertinente par bullet, en PREMIER — choisie au contexte réel\n'
    + '- Icônes : 🔧 outil/bricolage ⚡ électricité 💧 étanchéité 🔒 sécurité 🚗 auto 🌱 jardin 🔥 barbecue 🧰 kit 📏 dimensions 💪 robustesse 🛡️ garantie\n'
    + '- Interdit : ⭐ ✅ ❌ et répétition d\'icône\n'
    + '- MINIMUM 200 caractères par bullet, idéalement 250-300 — style narratif : bénéfice + usage terrain + preuve — éviter les adjectifs creux, les prouver\n'
    + '- Mélanger : bénéfice client + usage concret + mot-clé secondaire + réassurance\n'
    + '- Pas de HTML, pas de prix, pas de référence interne\n\n'
    + 'DESCRIPTION: [HTML pédagogique UNIQUEMENT — utiliser <b>, <br>, <ul><li> — structure : pour qui / dans quel contexte / pourquoi choisir ce produit / quelles limites éventuelles / liste technique lisible — INTERDIT de mélanger description et synthèse stratégique — la description est un texte vendeur pour le CLIENT, pas pour le consultant]\n\n'
    + 'PRECONISATIONS_IMAGES:\n'
    + 'Toutes les images Amazon doivent faire 1500×1500 px minimum, fond blanc pur RGB(255,255,255) pour l\'image principale, produit ≥85% du cadre pour la principale.\n\n'
    + 'Génère N préconisations (3 ≤ N ≤ 7, viser 5) — chaque préconisation au format STRICT :\n\n'
    + 'IMAGE_1:\n'
    + 'emplacement: principale | secondaire-2 | … | secondaire-7\n'
    + 'type: packshot | usage-terrain | infographie-spec | détail-matière | comparatif-échelle | lifestyle\n'
    + 'scene: [1-2 phrases — ce qu\'on doit voir, lumière, angle, props]\n'
    + 'texte_overlay: [phrase courte ou "aucun"]\n'
    + 'pourquoi_cette_image: [1 phrase — basée sur avis clients OU manque concurrent OU bénéfice à prouver]\n\n'
    + 'RÈGLES :\n'
    + '- IMAGE_1 (principale) : packshot fond blanc OBLIGATOIRE, pas de texte\n'
    + '- Au moins 1 image "usage-terrain"\n'
    + '- Au moins 1 image "infographie-spec" si dimensions/matériaux/specs sont des arguments forts\n'
    + '- Le "pourquoi_cette_image" doit citer EXPLICITEMENT : un avis client ou un manque concurrent ou un bénéfice difficile à comprendre par le titre seul\n'
    + '- Chaque image doit être actionnable par un graphiste sans question\n\n'
    + 'BACKEND_KEYWORDS: [espaces uniquement — CIBLE 40 à 60 mots maximum — JAMAIS plus de 60 — zéro mot du titre ou des bullets — zéro adjectif vague (robuste, polyvalent, etc.) — zéro substantif générique (matériaux, produits, etc.) — zéro marque concurrente — chaque mot doit passer le test : "Un acheteur tape ce mot dans la barre Amazon" — partir du TYPE de produit et de ses USAGES RÉELS : synonymes métier, fautes courantes de recherche, variantes de taille/matériau, longue traîne qualifiée]\n\n'
    + '━━━━━━━━━━━━━━━━━━\n'
    + 'ÉTAPE 4 — SYNTHÈSE STRATÉGIQUE\n'
    + '━━━━━━━━━━━━━━━━━━\n'
    + 'POSITIONNEMENT_AMAZON: [positionnement retenu sur Amazon — 1 phrase claire]\n'
    + 'LEVIERS_RANKING: [3 leviers principaux pour gagner du ranking sur cet ASIN]\n'
    + 'ERREURS_A_EVITER: [erreurs absolues à ne pas commettre sur cette fiche]\n'
    + 'OPPORTUNITE_SEO: [1 opportunité concurrentielle non exploitée]';
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
                   positionnement: '', leviers: '', erreurs: '', opportunite: '' };
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
    result.positionnement = extractField(text, 'POSITIONNEMENT_AMAZON');
    result.leviers      = extractField(text, 'LEVIERS_RANKING');
    result.erreurs      = extractField(text, 'ERREURS_A_EVITER');
    result.opportunite  = extractField(text, 'OPPORTUNITE_SEO');

    for (let i = 1; i <= 5; i++) {
      result.bullets[i-1] = extractField(text, 'BULLET_' + i).replace(/\*\*/g, '').trim();
    }
    const descMatch = text.match(/DESCRIPTION:\s*([\s\S]+?)(?=\n(?:PRECONISATIONS_IMAGES|BACKEND_KEYWORDS|POSITIONNEMENT_AMAZON|LEVIERS_RANKING|ERREURS_A_EVITER|OPPORTUNITE_SEO|ÉTAPE|---)|$)/);
    if (descMatch) result.description = descMatch[1].trim().replace(/```html|```/g, '').trim();

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
