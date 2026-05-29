// Amazon Pilot — Export Rapport Word Analyse comparée (v3.6.9)
// CTA 13 — Génération RTF self-contained (zéro dépendance CDN)
// RTF = format natif Microsoft Word, ouverture sans conversion, compatible toutes versions.
// Choix technique : CDN docx.js bloqué par CSP CloudFront → RTF sans bibliothèque externe.

// ═══════════════════════════════════════════════════════════════
// POINT D'ENTRÉE PUBLIC (CTA 13)
// ═══════════════════════════════════════════════════════════════

function downloadYoYWord() {
  var c = cl();
  var a = yoyState && yoyState.currentAnalysis;
  if (!c || !a) { showToast('Aucune analyse en cours', 'alr-a'); return; }

  var btn = document.getElementById('yoy-word-btn');
  if (btn) { btn.textContent = '⏳ Génération...'; btn.disabled = true; }

  try {
    var rtf = _generateRTF(c, a);
    // Extension .doc : Word ouvre les fichiers RTF avec extension .doc sans conversion
    // (contenu RTF, icône et association Word standard pour l'utilisateur)
    var blob = new Blob([rtf], { type: 'application/msword' });
    var slug  = (c.name || 'client').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    var today = new Date().toISOString().slice(0, 10);
    var filename = 'Analyse_comparee_' + slug + '_' + today + '.doc';
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
    showToast('✅ Rapport téléchargé : ' + filename, 'alr-g', 4000);
  } catch(e) {
    console.error('[word_export] Erreur RTF :', e);
    showToast('⚠ Erreur génération rapport — voir console', 'alr-a', 4000);
  } finally {
    if (btn) { btn.textContent = '📄 Rapport Word'; btn.disabled = false; }
  }
}

// ═══════════════════════════════════════════════════════════════
// GÉNÉRATEUR RTF
// ═══════════════════════════════════════════════════════════════

function _rtfEsc(s) {
  if (!s) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    // Convertir les caractères non-ASCII en séquences RTF unicode
    .replace(/[^\x00-\x7F]/g, function(ch) {
      return '\\u' + ch.charCodeAt(0) + '?';
    });
}

function _rtfPar(text, opts) {
  opts = opts || {};
  var s = '\\pard';
  if (opts.bold)   s += '{\\b ' + _rtfEsc(text) + '}';
  else if (opts.h1) s += '{\\b\\fs32 ' + _rtfEsc(text) + '}';
  else if (opts.h2) s += '{\\b\\fs26 ' + _rtfEsc(text) + '}';
  else              s += _rtfEsc(text);
  return s + '\\par\n';
}

function _rtfTable(headers, rows) {
  var colWidth = Math.floor(9000 / Math.max(headers.length, 1)); // ~15.8cm total
  var out = '';

  function rtfRow(cells, isHeader) {
    var row = '\\trowd\\trgaph108\\trleft-108';
    var pos = 0;
    for (var i = 0; i < headers.length; i++) {
      pos += colWidth;
      row += '\\cellx' + pos;
    }
    row += '\n';
    for (var j = 0; j < headers.length; j++) {
      var cellText = String(cells[j] != null ? cells[j] : '');
      row += '\\pard\\intbl';
      if (isHeader) row += '{\\b ' + _rtfEsc(cellText) + '}';
      else          row += _rtfEsc(cellText);
      row += '\\cell\n';
    }
    row += '\\row\n';
    return row;
  }

  out += rtfRow(headers, true);
  for (var r = 0; r < rows.length; r++) {
    out += rtfRow(rows[r], false);
  }
  return out + '\\pard\\par\n';
}

function _generateRTF(c, analysis) {
  var d      = analysis.dimensions || {};
  var dA     = analysis.periodA   ? analysis.periodA.days    : null;
  var dRef   = analysis.periodRef ? analysis.periodRef.days  : null;
  var pAL    = analysis.periodA   && analysis.periodA.label   ? analysis.periodA.label   : '?';
  var pRefL  = analysis.periodRef && analysis.periodRef.label ? analysis.periodRef.label : '?';
  var sign   = yoyGetSign((d.dim1 || {}).deltaCAPct);
  var d1  = d.dim1  || {};
  var d7  = d.dim7  || {};
  var d9  = d.dim9  || {};
  var d10 = d.dim10 || {};
  var d11 = d.dim11 || {};
  var d12 = d.dim12 || {};

  var body = '';

  // ── 1. Page de garde ──
  body += _rtfPar('Analyse comparée — ' + (c.name || ''), { h1: true });
  body += _rtfPar(pAL + ' vs ' + pRefL);
  body += _rtfPar('Généré le ' + new Date().toLocaleDateString('fr-FR') + ' par Amazon Pilot v3.6.9');
  body += '\\par\n';

  // ── 2. KPI hero ──
  body += _rtfPar('1 — Évolution du chiffre d\'affaires', { h2: true });
  body += _rtfTable(
    ['Indicateur', 'Valeur'],
    [
      ['Δ CA annualisé', d1.deltaCAAnnu != null ? yoyFmtEurSigned(d1.deltaCAAnnu) + '/an' : '—'],
      ['Δ CA %',         d1.deltaCAPct  != null ? yoyFmtPct(d1.deltaCAPct, true)           : '—'],
      ['CA Référence',   d1.caRef       != null ? yoyFmtEur(d1.caRef)                      : '—'],
      ['CA Période A',   d1.caA         != null ? yoyFmtEur(d1.caA)                        : '—']
    ]
  );

  // ── 3. Catalogue ──
  body += _rtfPar('2 — Dynamique catalogue', { h2: true });
  var dis = (d7.disparus  || []).length;
  var app = (d7.apparus   || []).length;
  body += _rtfTable(
    ['Catégorie', 'ASINs', 'Impact annuel'],
    [
      ['Disparus',  String(dis), d7.sumDisparusRef != null ? yoyFmtEur(d7.sumDisparusRef * 365) + '/an' : '—'],
      ['Apparus',   String(app), d7.sumApparusA   != null ? yoyFmtEur(d7.sumApparusA   * 365) + '/an' : '—'],
      ['Stables',   String((d7.stables  || []).length), '—'],
      ['En hausse', String((d7.enHausse || []).length), '—'],
      ['En baisse', String((d7.enBaisse || []).length), '—']
    ]
  );

  // ── 4. Concentration ──
  if (d9.concRef && d9.concA) {
    body += _rtfPar('3 — Concentration du portefeuille', { h2: true });
    body += _rtfTable(
      ['Indicateur', 'Référence', 'Période A'],
      [
        ['Top 10',  d9.concRef.top10  != null ? yoyFmtPct(d9.concRef.top10)  : '—', d9.concA.top10  != null ? yoyFmtPct(d9.concA.top10)  : '—'],
        ['Top 20',  d9.concRef.top20  != null ? yoyFmtPct(d9.concRef.top20)  : '—', d9.concA.top20  != null ? yoyFmtPct(d9.concA.top20)  : '—'],
        ['Top 50',  d9.concRef.top50  != null ? yoyFmtPct(d9.concRef.top50)  : '—', d9.concA.top50  != null ? yoyFmtPct(d9.concA.top50)  : '—'],
        ['Top 100', d9.concRef.top100 != null ? yoyFmtPct(d9.concRef.top100) : '—', d9.concA.top100 != null ? yoyFmtPct(d9.concA.top100) : '—']
      ]
    );
  }

  // ── 5. Marques Top 10 ──
  body += _rtfPar('4 — Dynamique marques (Top 10)', { h2: true });
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
  body += _rtfTable(['Marque', 'CA/j réf.', 'Part réf.', 'CA/j A', 'Part A', 'Var. €/j'], brandRows);

  // ── 6. Anomalies ──
  var anomPairs = (d12.anomPairs || []).slice(0, 10);
  if (anomPairs.length > 0) {
    body += _rtfPar('5 — Doublons orthographiques détectés', { h2: true });
    body += _rtfTable(
      ['Marque 1', 'Marque 2', 'Similarité', 'CA combiné'],
      anomPairs.map(function(p) {
        return [p.marque1||'—', p.marque2||'—',
          p.similarity != null ? yoyFmtPct(p.similarity * 100) : '—',
          p.caTot      != null ? yoyFmtEur(p.caTot)            : '—'];
      })
    );
  }

  // ── 7. Top mouvements ASIN ──
  body += _rtfPar('6 — Top mouvements ASIN', { h2: true });
  if ((d11.perdants || []).length > 0) {
    body += _rtfPar('Top 10 perdants', { bold: true });
    body += _rtfTable(
      ['ASIN', 'Titre', 'Marque', 'Δ €/j'],
      (d11.perdants || []).slice(0, 10).map(function(r) {
        return [r.asin||'—', (r.titre||'').substring(0, 50), r.marque||'—',
          r.deltaPerDay != null ? yoyFmtEurSigned(r.deltaPerDay) : '—'];
      })
    );
  }
  if ((d11.gagnants || []).length > 0) {
    body += _rtfPar('Top 10 gagnants', { bold: true });
    body += _rtfTable(
      ['ASIN', 'Titre', 'Marque', 'Δ €/j'],
      (d11.gagnants || []).slice(0, 10).map(function(r) {
        return [r.asin||'—', (r.titre||'').substring(0, 50), r.marque||'—',
          r.deltaPerDay != null ? yoyFmtEurSigned(r.deltaPerDay) : '—'];
      })
    );
  }

  // ── 8. Enquête ASINs disparus ──
  body += _rtfPar('7 — Enquête ASINs disparus', { h2: true });
  body += _rtfPar(String(dis) + ' ASINs disparus classifiés');
  var enqueteCache = (typeof _enqueteCache !== 'undefined') ? _enqueteCache : null;
  if (enqueteCache && enqueteCache.result) {
    var eq = enqueteCache.result;
    body += _rtfTable(
      ['Catégorie', 'ASINs'],
      [
        ['Mortalité naturelle (A1)', String((eq.cat1_mortality   || []).length)],
        ['À CREUSER (A2+D1+D2+R)',   String((eq.cat2_investigate || []).length)],
        ['Autres (B+C)',              String((eq.cat3_others      || []).length)]
      ]
    );
    if ((eq.cat2_investigate || []).length > 0) {
      body += _rtfPar('À CREUSER — Top 10', { bold: true });
      body += _rtfTable(
        ['Cat.', 'ASIN', 'Titre', 'CA réf./j'],
        (eq.cat2_investigate || []).slice(0, 10).map(function(item) {
          return [item.subcat||'—', item.asin||'—', (item.titre||'').substring(0, 50),
            item.caRefPerDay != null ? yoyFmtEur(item.caRefPerDay) : '—'];
        })
      );
    }
  }

  // ── 9. Plan d'action ──
  body += _rtfPar('8 — Plan d\'action priorisé', { h2: true });
  if (sign === 'negative') {
    body += _rtfPar('Priorité 1 — Auditer les ASINs disparus de poids significatif', { bold: true });
    var top5dis = (d7.disparus || []).slice().sort(function(a, b) {
      return (b.caRefPerDay || 0) - (a.caRefPerDay || 0);
    }).slice(0, 5);
    if (top5dis.length > 0) {
      body += _rtfTable(
        ['ASIN', 'Titre', 'Marque', 'CA réf./j'],
        top5dis.map(function(a) {
          return [a.asin||'—', (a.titre||'').substring(0, 45), a.marque||'—',
            a.caRefPerDay != null ? yoyFmtEur(a.caRefPerDay) : '—'];
        })
      );
    }
    body += _rtfPar('Priorité 2 — Sécuriser les best-sellers actuels', { bold: true });
    body += _rtfPar('Le Top 10 représente la concentration actuelle. Surveiller Buy Box et disponibilité sur ces ASINs.');
    body += _rtfPar('Priorité 3 — Reconstituer les familles en recul', { bold: true });
    body += _rtfPar('Auditer disponibilité, POs et fiches pour les marques qui décrochent en valeur quotidienne.');
  } else if (sign === 'positive') {
    body += _rtfPar('Priorité 1 — Sécuriser les accélérateurs', { bold: true });
    body += _rtfPar('Les ASINs en forte progression sont le moteur de la dynamique actuelle. Protéger stock et Buy Box.');
    body += _rtfPar('Priorité 2 — Investiguer les ASINs qui décrochent malgré la croissance', { bold: true });
    body += _rtfPar('Certains ASINs reculent même en contexte positif — identifier et corriger.');
  } else {
    body += _rtfPar('Performance stable. 3 axes : surveiller les baisses, capitaliser sur les hausses, auditer les disparus résiduels.');
  }

  // ── 10. Analyse par famille ──
  body += _rtfPar('9 — Analyse par famille — actions recommandées', { h2: true });
  var famBrands = (d10.topBrands || []).slice(0, 20).sort(function(a, b) {
    return ((a.delta || 0)) - ((b.delta || 0));
  });
  if (famBrands.length > 0) {
    function brandStateLabel(deltaPct) {
      if (deltaPct == null) return 'Inconnu';
      if (deltaPct > 20)   return 'En croissance';
      if (deltaPct >= -20) return 'Stable';
      if (deltaPct >= -50) return 'En recul';
      return 'Hémorragie';
    }
    var ACTIONS_RTF = {
      'En croissance': 'Sécuriser stock + Buy Box',
      'Stable':        'Maintenir cadence appro',
      'En recul':      'Audit dispo + relance PO',
      'Hémorragie':    'Audit prioritaire',
      'Inconnu':       '—'
    };
    body += _rtfTable(
      ['Famille', 'État', 'CA/j réf.', 'CA/j A', 'Var. €/j', 'Action'],
      famBrands.map(function(b) {
        var state = brandStateLabel(b.deltaPct);
        return [b.marque||'—', state,
          b.caRefPerDay != null ? yoyFmtEur(b.caRefPerDay) : '—',
          b.caAPerDay   != null ? yoyFmtEur(b.caAPerDay)   : '—',
          b.delta       != null ? yoyFmtEurSigned(b.delta)  : '—',
          ACTIONS_RTF[state] || '—'];
      })
    );
  }

  // ── 11. Mon diagnostic ──
  body += _rtfPar('10 — Mon diagnostic', { h2: true });
  // Narrative IA si disponible dans le cache client
  if (c.aiCache && c.aiCache.diagnosticV1 && c.aiCache.diagnosticV1.content) {
    body += _rtfPar('Cause la plus probable', { bold: true });
    body += _rtfPar(c.aiCache.diagnosticV1.content);
  } else {
    // Fallback : texte par signe
    body += _rtfPar(sign === 'negative'
      ? 'Le recul du compte provient principalement de la contraction du catalogue actif. ' + String(dis) + ' ASINs ont disparu, dont une partie est récupérable. Voir le plan d\'action ci-dessus.'
      : sign === 'positive'
      ? 'La progression du compte est portée par la croissance des ASINs actifs et l\'arrivée de nouveaux. Sécuriser les moteurs de croissance est la priorité.'
      : 'Le compte est en performance stable. Les mouvements internes (disparus / apparus) se compensent. Surveiller marque par marque.'
    );
  }

  // ── 12. Conclusion ──
  body += _rtfPar('11 — Conclusion générale', { h2: true });
  if (typeof tplConclusion === 'function') {
    var concluHtmlStr = tplConclusion(d, sign, c.name || '');
    // Nettoyer le HTML pour ne garder que le texte
    var concluText = concluHtmlStr.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    body += _rtfPar(concluText);
  }

  // ── Assemblage RTF final ──
  return '{\\rtf1\\ansi\\ansicpg1252\\deff0\n'
    + '{\\fonttbl{\\f0\\fswiss\\fcharset0 Calibri;}}\n'
    + '{\\colortbl ;\\red0\\green0\\blue0;}\n'
    + '\\widowctrl\\hyphauto\n'
    + '\\margl1800\\margr1800\\margt1440\\margb1440\n'
    + '\\f0\\fs22\\cf1\n'
    + body
    + '}';
}

// Exposer sur window
window.downloadYoYWord = downloadYoYWord;
