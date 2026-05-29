// Amazon Pilot — Export Word Analyse comparée (v3.6.9)
// CTA 13 — Génération côté client via librairie docx (lazy-loaded depuis CDN)
// Décision Q4=a : génération client (pas Lambda). Décision F3 : Calibri 11 partout.
// Bundle docx ~300Ko → lazy-loaded au premier clic (critère 9.8).

var _DOCX_CDN = 'https://unpkg.com/docx@8.5.0/build/index.js';
var _docxLoaded = false;

// ═══════════════════════════════════════════════════════════════
// POINT D'ENTRÉE PUBLIC
// ═══════════════════════════════════════════════════════════════

/**
 * downloadYoYWord()
 * Appelé par CTA 13. Lazy-load docx si nécessaire puis génère + télécharge.
 */
function downloadYoYWord() {
  var c = cl();
  var a = yoyState && yoyState.currentAnalysis;
  if (!c || !a) { showToast('Aucune analyse en cours', 'alr-a'); return; }

  var btn = document.getElementById('yoy-word-btn');
  if (btn) { btn.textContent = '⏳ Génération...'; btn.disabled = true; }

  function doGenerate() {
    try {
      _generateAndDownload(c, a);
    } catch(e) {
      console.error('[word_export] Erreur génération :', e);
      showToast('⚠ Erreur génération Word — voir console', 'alr-a', 4000);
    } finally {
      if (btn) { btn.textContent = '📄 Rapport Word'; btn.disabled = false; }
    }
  }

  if (_docxLoaded || (typeof window.docx !== 'undefined')) {
    _docxLoaded = true;
    doGenerate();
  } else {
    var script = document.createElement('script');
    script.src = _DOCX_CDN;
    script.onload = function() { _docxLoaded = true; doGenerate(); };
    script.onerror = function() {
      showToast('⚠ Impossible de charger la librairie Word (vérifiez votre connexion)', 'alr-a', 5000);
      if (btn) { btn.textContent = '📄 Rapport Word'; btn.disabled = false; }
    };
    document.head.appendChild(script);
  }
}

// ═══════════════════════════════════════════════════════════════
// GÉNÉRATION + TÉLÉCHARGEMENT
// ═══════════════════════════════════════════════════════════════

function _generateAndDownload(c, analysis) {
  var docx = window.docx;
  if (!docx) throw new Error('docx non chargé');

  var d       = analysis.dimensions || {};
  var dA      = analysis.periodA   ? analysis.periodA.days   : null;
  var dRef    = analysis.periodRef ? analysis.periodRef.days : null;
  var pALabel  = analysis.periodA   && analysis.periodA.label   ? analysis.periodA.label   : '?';
  var pRefLabel = analysis.periodRef && analysis.periodRef.label ? analysis.periodRef.label : '?';
  var sign = yoyGetSign((d.dim1 || {}).deltaCAPct);

  // Helpers docx
  var P      = docx.Paragraph;
  var T      = docx.TextRun;
  var TStyle = { font: 'Calibri', size: 22 }; // 11pt = 22 half-points
  var TBold  = { font: 'Calibri', size: 22, bold: true };

  function para(text, opts) {
    return new P({ children: [new T(Object.assign({}, TStyle, opts || {}, { text: text || '' }))] });
  }
  function paraBold(text) { return para(text, { bold: true }); }
  function heading(text, level) {
    return new P({
      heading: level === 1 ? docx.HeadingLevel.HEADING_1 : docx.HeadingLevel.HEADING_2,
      children: [new T({ text: text || '', font: 'Calibri', size: level === 1 ? 32 : 26, bold: true })]
    });
  }
  function separator() {
    return new P({ border: { bottom: { color: 'CCCCCC', size: 1, space: 1, style: 'single' } }, children: [] });
  }
  function tableRow(cells, isHeader) {
    return new docx.TableRow({
      children: cells.map(function(txt) {
        return new docx.TableCell({
          shading: isHeader ? { fill: 'F3F4F6' } : undefined,
          children: [new P({ children: [new T(Object.assign({}, TStyle, isHeader ? { bold: true } : {}, { text: String(txt || '') }))] })]
        });
      })
    });
  }
  function makeTable(headers, rows) {
    var docxRows = [tableRow(headers, true)].concat(rows.map(function(r) { return tableRow(r, false); }));
    return new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      borders: {
        top:    { style: docx.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left:   { style: docx.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right:  { style: docx.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideH:{ style: docx.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideV:{ style: docx.BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
      },
      rows: docxRows
    });
  }

  var children = [];

  // ── 1. Page de garde ──
  children.push(heading('Analyse comparée — ' + esc(c.name || ''), 1));
  children.push(para(pALabel + ' vs ' + pRefLabel));
  children.push(para('Généré le ' + new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) + ' par Amazon Pilot v3.6.9'));
  children.push(separator());

  // ── 2. KPI hero ──
  var d1 = d.dim1 || {};
  children.push(heading('1 — Évolution du chiffre d\'affaires', 2));
  children.push(makeTable(
    ['Indicateur', 'Valeur'],
    [
      ['Δ CA annualisé', d1.deltaCAAnnu != null ? yoyFmtEurSigned(d1.deltaCAAnnu) + '/an' : '—'],
      ['Δ CA %', d1.deltaCAPct != null ? yoyFmtPct(d1.deltaCAPct, true) : '—'],
      ['CA Référence', d1.caRef != null ? yoyFmtEur(d1.caRef) : '—'],
      ['CA Période A (observé)', d1.caA != null ? yoyFmtEur(d1.caA) : '—']
    ]
  ));
  children.push(separator());

  // ── 3. Catalogue ──
  var d7  = d.dim7 || {};
  var dis = (d7.disparus  || []).length;
  var app = (d7.apparus   || []).length;
  children.push(heading('2 — Dynamique catalogue', 2));
  children.push(makeTable(
    ['Catégorie', 'ASINs', 'CA réf. annualisé'],
    [
      ['Disparus', String(dis), d7.sumDisparusRef != null ? yoyFmtEur(d7.sumDisparusRef * 365) + '/an' : '—'],
      ['Apparus',  String(app), d7.sumApparusA   != null ? yoyFmtEur(d7.sumApparusA   * 365) + '/an' : '—'],
      ['Stables',  String((d7.stables  ||[]).length), '—'],
      ['En hausse',String((d7.enHausse ||[]).length), '—'],
      ['En baisse',String((d7.enBaisse ||[]).length), '—']
    ]
  ));
  children.push(separator());

  // ── 4. Concentration ──
  var d9 = d.dim9 || {};
  children.push(heading('3 — Concentration du portefeuille', 2));
  if (d9.concRef && d9.concA) {
    children.push(makeTable(
      ['Indicateur', 'Référence', 'Période A'],
      [
        ['Top 10',  d9.concRef.top10  != null ? yoyFmtPct(d9.concRef.top10)  : '—', d9.concA.top10  != null ? yoyFmtPct(d9.concA.top10)  : '—'],
        ['Top 20',  d9.concRef.top20  != null ? yoyFmtPct(d9.concRef.top20)  : '—', d9.concA.top20  != null ? yoyFmtPct(d9.concA.top20)  : '—'],
        ['Top 50',  d9.concRef.top50  != null ? yoyFmtPct(d9.concRef.top50)  : '—', d9.concA.top50  != null ? yoyFmtPct(d9.concA.top50)  : '—'],
        ['Top 100', d9.concRef.top100 != null ? yoyFmtPct(d9.concRef.top100) : '—', d9.concA.top100 != null ? yoyFmtPct(d9.concA.top100) : '—']
      ]
    ));
  }
  children.push(separator());

  // ── 5. Marques Top 10 ──
  var d10 = d.dim10 || {};
  children.push(heading('4 — Dynamique marques', 2));
  var brandRows = (d10.topBrands || []).slice(0, 10).map(function(b) {
    return [
      b.marque || '—',
      b.caRefPerDay != null ? yoyFmtEur(b.caRefPerDay) : '—',
      b.shareRef    != null ? yoyFmtPct(b.shareRef)     : '—',
      b.caAPerDay   != null ? yoyFmtEur(b.caAPerDay)    : '—',
      b.shareA      != null ? yoyFmtPct(b.shareA)       : '—',
      b.delta       != null ? yoyFmtEurSigned(b.delta)  : '—'
    ];
  });
  children.push(makeTable(['Marque', 'CA/j réf.', 'Part réf.', 'CA/j A', 'Part A', 'Variation €/j'], brandRows));
  children.push(separator());

  // ── 6. Anomalies ──
  var d12 = d.dim12 || {};
  var anomPairs = (d12.anomPairs || []).slice(0, 10);
  if (anomPairs.length > 0) {
    children.push(heading('5 — Doublons orthographiques détectés', 2));
    children.push(makeTable(
      ['Marque 1', 'Marque 2', 'Similarité', 'CA combiné'],
      anomPairs.map(function(p) {
        return [p.marque1||'—', p.marque2||'—',
          p.similarity != null ? yoyFmtPct(p.similarity * 100) : '—',
          p.caTot      != null ? yoyFmtEur(p.caTot)            : '—'];
      })
    ));
    children.push(separator());
  }

  // ── 7. Top mouvements ASIN ──
  var d11 = d.dim11 || {};
  children.push(heading('6 — Top mouvements ASIN', 2));
  children.push(paraBold('Top 10 perdants'));
  if ((d11.perdants||[]).length > 0) {
    children.push(makeTable(
      ['ASIN', 'Titre', 'Marque', 'Δ €/j'],
      (d11.perdants||[]).slice(0,10).map(function(r) {
        return [r.asin||'—', (r.titre||'').substring(0,50), r.marque||'—',
          r.deltaPerDay != null ? yoyFmtEurSigned(r.deltaPerDay) : '—'];
      })
    ));
  }
  children.push(paraBold('Top 10 gagnants'));
  if ((d11.gagnants||[]).length > 0) {
    children.push(makeTable(
      ['ASIN', 'Titre', 'Marque', 'Δ €/j'],
      (d11.gagnants||[]).slice(0,10).map(function(r) {
        return [r.asin||'—', (r.titre||'').substring(0,50), r.marque||'—',
          r.deltaPerDay != null ? yoyFmtEurSigned(r.deltaPerDay) : '—'];
      })
    ));
  }
  children.push(separator());

  // ── 8. Enquête ASINs disparus ──
  children.push(heading('7 — Enquête ASINs disparus', 2));
  children.push(para(dis + ' ASINs disparus classifiés'));
  // Résumé 3 catégories (si cache enquête disponible)
  var enqueteCache = (typeof _enqueteCache !== 'undefined') ? _enqueteCache : null;
  if (enqueteCache && enqueteCache.result) {
    var eq = enqueteCache.result;
    children.push(makeTable(
      ['Catégorie', 'ASINs'],
      [
        ['Mortalité naturelle (A1)', String((eq.cat1_mortality  ||[]).length)],
        ['À CREUSER (A2+D1+D2+R)',  String((eq.cat2_investigate||[]).length)],
        ['Autres (B+C)',             String((eq.cat3_others     ||[]).length)]
      ]
    ));
    if ((eq.cat2_investigate||[]).length > 0) {
      children.push(paraBold('À CREUSER — Top 10'));
      children.push(makeTable(
        ['Cat.', 'ASIN', 'Titre', 'CA réf./j'],
        (eq.cat2_investigate||[]).slice(0,10).map(function(item) {
          return [item.subcat||'—', item.asin||'—', (item.titre||'').substring(0,50),
            item.caRefPerDay != null ? yoyFmtEur(item.caRefPerDay) : '—'];
        })
      ));
    }
  }
  children.push(separator());

  // ── 9. Plan d'action ──
  children.push(heading('8 — Plan d\'action priorisé', 2));
  var s8Content = _buildPlanActionText(d7, d9, d10, d11, sign);
  s8Content.forEach(function(p) { children.push(p); });
  children.push(separator());

  // ── 10. Analyse par famille ──
  children.push(heading('9 — Analyse par famille — actions recommandées', 2));
  var famBrands = (d10.topBrands||[]).slice(0,20).sort(function(a,b) {
    return ((a.delta||0)) - ((b.delta||0));
  });
  if (famBrands.length > 0) {
    function brandStateLabel(deltaPct) {
      if (deltaPct == null) return 'Inconnu';
      if (deltaPct > 20)   return 'En croissance';
      if (deltaPct >= -20) return 'Stable';
      if (deltaPct >= -50) return 'En recul';
      return 'Hémorragie';
    }
    var ACTIONS_WORD = {
      'En croissance': 'Sécuriser stock + surveiller Buy Box',
      'Stable':        'Maintenir la cadence d\'approvisionnement',
      'En recul':      'Audit disponibilité + relance PO + révision fiches',
      'Hémorragie':    'Audit prioritaire — problème pricing ou suppression',
      'Inconnu':       '—'
    };
    children.push(makeTable(
      ['Famille', 'État', 'CA/j réf.', 'CA/j A', 'Variation €/j', 'Action'],
      famBrands.map(function(b) {
        var state = brandStateLabel(b.deltaPct);
        return [b.marque||'—', state,
          b.caRefPerDay != null ? yoyFmtEur(b.caRefPerDay) : '—',
          b.caAPerDay   != null ? yoyFmtEur(b.caAPerDay)   : '—',
          b.delta       != null ? yoyFmtEurSigned(b.delta)  : '—',
          ACTIONS_WORD[state] || '—'];
      })
    ));
  }
  children.push(separator());

  // ── 11. Mon diagnostic ──
  children.push(heading('10 — Mon diagnostic', 2));
  children.push(paraBold('Ce que les chiffres disent'));
  var diagCacheEl = document.getElementById('yoy-diag-cause-probable');
  var causeProbable = diagCacheEl ? diagCacheEl.innerText : '';
  // Narratif IA si disponible dans le cache client
  if (c.aiCache && c.aiCache.diagnosticV1 && c.aiCache.diagnosticV1.content) {
    children.push(paraBold('Cause la plus probable'));
    children.push(para(c.aiCache.diagnosticV1.content || '—'));
  } else if (causeProbable && causeProbable.indexOf('⏳') === -1) {
    children.push(paraBold('Cause la plus probable'));
    children.push(para(causeProbable));
  }
  children.push(separator());

  // ── 12. Conclusion ──
  children.push(heading('11 — Conclusion générale', 2));
  // Texte de conclusion depuis tplConclusion si disponible
  if (typeof tplConclusion === 'function') {
    var concluData = tplConclusion(d, sign, c.name || '');
    var concluText = concluData.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    children.push(para(concluText));
  }

  // ── Construction document docx ──
  var doc = new docx.Document({
    creator: 'Amazon Pilot v3.6.9',
    title:   'Analyse comparée — ' + (c.name || ''),
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } }
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } // 2.5cm
      },
      footers: {
        default: new docx.Footer({
          children: [new docx.Paragraph({
            children: [new docx.TextRun({
              text: 'Amazon Pilot v3.6.9 — Page ',
              font: 'Calibri', size: 18
            }), new docx.TextRun({ children: [docx.PageNumber.CURRENT], font: 'Calibri', size: 18 }),
            new docx.TextRun({ text: ' / ', font: 'Calibri', size: 18 }),
            new docx.TextRun({ children: [docx.PageNumber.TOTAL_PAGES], font: 'Calibri', size: 18 })]
          })]
        })
      },
      children: children
    }]
  });

  docx.Packer.toBlob(doc).then(function(blob) {
    var slug = (c.name || 'client').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    var today = new Date().toISOString().slice(0, 10);
    var filename = 'Analyse_comparee_' + slug + '_' + today + '.docx';
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
    showToast('✅ Rapport Word téléchargé : ' + filename, 'alr-g', 4000);
    var btn = document.getElementById('yoy-word-btn');
    if (btn) { btn.textContent = '📄 Rapport Word'; btn.disabled = false; }
  });
}

// ── Helper plan d'action (texte simplifié pour Word) ──
function _buildPlanActionText(d7, d9, d10, d11, sign) {
  var paragraphs = [];
  if (sign === 'negative') {
    paragraphs.push(new (window.docx ? window.docx.Paragraph : Object)({
      children: [new (window.docx.TextRun)({
        text: 'Priorité 1 — Auditer les ASINs disparus de poids significatif',
        font: 'Calibri', size: 22, bold: true
      })]
    }));
    var top5dis = ((d7.disparus||[]).slice().sort(function(a,b){return (b.caRefPerDay||0)-(a.caRefPerDay||0);}).slice(0,5));
    if (top5dis.length > 0) {
      var rows = top5dis.map(function(a) {
        return [a.asin||'—', (a.titre||'').substring(0,45), a.marque||'—',
          a.caRefPerDay != null ? yoyFmtEur(a.caRefPerDay) : '—'];
      });
      // Can't call makeTable here (out of scope), build simple table
      paragraphs.push(new window.docx.Table({
        width: { size: 100, type: window.docx.WidthType.PERCENTAGE },
        rows: [
          new window.docx.TableRow({ children: ['ASIN','Titre','Marque','CA réf./j'].map(function(h){
            return new window.docx.TableCell({ children: [new window.docx.Paragraph({children:[new window.docx.TextRun({text:h,bold:true,font:'Calibri',size:22})]})]});
          })}),
        ].concat(rows.map(function(r){ return new window.docx.TableRow({ children: r.map(function(cell){
          return new window.docx.TableCell({children:[new window.docx.Paragraph({children:[new window.docx.TextRun({text:String(cell),font:'Calibri',size:22})]})]});
        })}); }))
      }));
    }
  }
  return paragraphs;
}

// Exposer sur window
window.downloadYoYWord = downloadYoYWord;
