// Amazon Pilot — Export DOCX Analyse comparée (v3.6.9)
// CTA 13 — Génération DOCX self-contained, zéro dépendance externe.
// Un DOCX est un ZIP (store, pas de compression) contenant des fichiers OOXML.
// Implémentation : CRC-32 + ZIP encoder + OOXML — aucun CDN requis.

// ═══════════════════════════════════════════════════════════════
// UTILITAIRES ZIP / CRC-32
// ═══════════════════════════════════════════════════════════════

(function() {
  // CRC-32 lookup table
  var _crcTable = (function() {
    var t = [], c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();

  function _crc32(buf) {
    var c = -1;
    for (var i = 0; i < buf.length; i++) c = (c >>> 8) ^ _crcTable[(c ^ buf[i]) & 0xFF];
    return (c ^ -1) >>> 0;
  }

  function _u16(n) { return [n & 0xFF, (n >> 8) & 0xFF]; }
  function _u32(n) { return [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]; }

  function _strToUtf8(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80)       { out.push(c); }
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
      else                { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return new Uint8Array(out);
  }

  function _buildZip(files) {
    var parts = [], cds = [], offset = 0;
    files.forEach(function(f) {
      var name = _strToUtf8(f.name);
      var data = _strToUtf8(f.data);
      var crc  = _crc32(data);
      // Local file header
      var lh = new Uint8Array([
        0x50,0x4B,0x03,0x04, 20,0, 0,0, 0,0, 0,0,0,0,
      ].concat(_u32(crc), _u32(data.length), _u32(data.length),
               _u16(name.length), _u16(0)));
      // Central directory entry
      cds.push({ offset: offset, name: name, data: data, crc: crc });
      parts.push(lh, name, data);
      offset += lh.length + name.length + data.length;
    });
    var cdStart = offset, cdSize = 0;
    cds.forEach(function(e) {
      var cd = new Uint8Array([
        0x50,0x4B,0x01,0x02, 20,0, 20,0, 0,0, 0,0, 0,0,0,0,
      ].concat(_u32(e.crc), _u32(e.data.length), _u32(e.data.length),
               _u16(e.name.length), _u16(0), _u16(0), _u16(0), _u16(0),
               _u32(0), _u32(e.offset)));
      parts.push(cd, e.name);
      cdSize += cd.length + e.name.length;
    });
    var eocd = new Uint8Array([
      0x50,0x4B,0x05,0x06, 0,0, 0,0,
    ].concat(_u16(cds.length), _u16(cds.length),
             _u32(cdSize), _u32(cdStart), _u16(0)));
    parts.push(eocd);
    // Concat all Uint8Arrays
    var total = parts.reduce(function(s, p) { return s + p.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    parts.forEach(function(p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  // ═══════════════════════════════════════════════════════════════
  // OOXML HELPERS
  // ═══════════════════════════════════════════════════════════════

  function _xmlEsc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                          .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  }

  function _ooRun(text, opts) {
    opts = opts || {};
    var rpr = '';
    if (opts.bold)   rpr += '<w:b/>';
    if (opts.color)  rpr += '<w:color w:val="' + opts.color + '"/>';
    if (opts.size)   rpr += '<w:sz w:val="' + opts.size + '"/><w:szCs w:val="' + opts.size + '"/>';
    return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + _xmlEsc(text) + '</w:t></w:r>';
  }

  // v3.6.9.1 : zéro référence à des styles nommés (Heading1/TableGrid) → inline uniquement
  // Les styles nommés causaient un crash Word "mode protégé" sans ouverture effective
  function _ooPar(text, opts) {
    opts = opts || {};
    var ppr = '';
    if (opts.before || opts.after) {
      ppr += '<w:spacing'
        + (opts.before ? ' w:before="' + opts.before + '"' : '')
        + (opts.after  ? ' w:after="'  + opts.after  + '"' : '')
        + '/>';
    }
    if (opts.indent) ppr += '<w:ind w:left="' + opts.indent + '"/>';
    return '<w:p>' + (ppr ? '<w:pPr>' + ppr + '</w:pPr>' : '') + _ooRun(text, opts) + '</w:p>';
  }

  function _ooTable(headers, rows) {
    var W = Math.floor(9200 / Math.max(headers.length, 1));
    function cell(txt, isHdr) {
      return '<w:tc>'
        + '<w:tcPr>'
        + '<w:tcW w:w="' + W + '" w:type="dxa"/>'
        + '<w:tcBorders>'
        + '<w:top w:val="single" w:sz="4" w:color="BBBBBB"/>'
        + '<w:bottom w:val="single" w:sz="4" w:color="BBBBBB"/>'
        + '<w:left w:val="single" w:sz="4" w:color="BBBBBB"/>'
        + '<w:right w:val="single" w:sz="4" w:color="BBBBBB"/>'
        + '</w:tcBorders>'
        + (isHdr ? '<w:shd w:val="clear" w:fill="E8ECF0"/>' : '')
        + '</w:tcPr>'
        + '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>'
        + _ooRun(String(txt != null ? txt : ''), isHdr ? { bold: true, size: 18 } : { size: 18 })
        + '</w:p></w:tc>';
    }
    function row(cells, isHdr) {
      return '<w:tr><w:trPr>' + (isHdr ? '<w:tblHeader/>' : '') + '</w:trPr>'
        + cells.map(function(c) { return cell(c, isHdr); }).join('') + '</w:tr>';
    }
    return '<w:tbl>'
      + '<w:tblPr><w:tblW w:w="0" w:type="auto"/>'
      + '<w:tblBorders>'
      + '<w:top w:val="single" w:sz="4" w:color="BBBBBB"/>'
      + '<w:bottom w:val="single" w:sz="4" w:color="BBBBBB"/>'
      + '<w:left w:val="single" w:sz="4" w:color="BBBBBB"/>'
      + '<w:right w:val="single" w:sz="4" w:color="BBBBBB"/>'
      + '<w:insideH w:val="single" w:sz="4" w:color="DDDDDD"/>'
      + '<w:insideV w:val="single" w:sz="4" w:color="DDDDDD"/>'
      + '</w:tblBorders></w:tblPr>'
      + row(headers, true)
      + rows.map(function(r) { return row(r, false); }).join('')
      + '</w:tbl><w:p/>';
  }

  // ═══════════════════════════════════════════════════════════════
  // GÉNÉRATION DU CONTENU DOCX
  // ═══════════════════════════════════════════════════════════════

  function _buildDocumentXml(c, analysis) {
    var d    = analysis.dimensions || {};
    var sign = yoyGetSign((d.dim1 || {}).deltaCAPct);
    var d1   = d.dim1  || {};
    var d7   = d.dim7  || {};
    var d9   = d.dim9  || {};
    var d10  = d.dim10 || {};
    var d11  = d.dim11 || {};
    var d12  = d.dim12 || {};
    var pAL  = analysis.periodA   && analysis.periodA.label   ? analysis.periodA.label   : '?';
    var pRL  = analysis.periodRef && analysis.periodRef.label ? analysis.periodRef.label : '?';
    var dis  = (d7.disparus || []).length;
    var app  = (d7.apparus  || []).length;

    var body = '';

    // ── 1. Page de garde ──
    body += _ooPar('Analyse comparée — ' + (c.name || ''), { bold:true, size:32, before:240, after:120 });
    body += _ooPar(pAL + '  vs  ' + pRL, { size:22 });
    body += _ooPar('Généré le ' + new Date().toLocaleDateString('fr-FR') + ' · Amazon Pilot v3.6.9', { size:18, color:'888888' });
    body += '<w:p/>';

    // ── 2. KPI hero ──
    body += _ooPar('1 — Évolution du chiffre d\'affaires', { bold:true, size:26, before:200, after:80 });
    body += _ooTable(['Indicateur','Valeur'], [
      ['Δ CA annualisé',  d1.deltaCAAnnu != null ? yoyFmtEurSigned(d1.deltaCAAnnu)+'/an' : '—'],
      ['Δ CA %',          d1.deltaCAPct  != null ? yoyFmtPct(d1.deltaCAPct,true)         : '—'],
      ['CA Référence',    d1.caRef       != null ? yoyFmtEur(d1.caRef)                   : '—'],
      ['CA Période A',    d1.caA         != null ? yoyFmtEur(d1.caA)                     : '—']
    ]);

    // ── 3. Catalogue ──
    body += _ooPar('2 — Dynamique catalogue', { bold:true, size:26, before:200, after:80 });
    body += _ooTable(['Catégorie','ASINs','Impact annuel'], [
      ['Disparus',  String(dis), d7.sumDisparusRef ? yoyFmtEur(d7.sumDisparusRef*365)+'/an' : '—'],
      ['Apparus',   String(app), d7.sumApparusA   ? yoyFmtEur(d7.sumApparusA*365)+'/an'   : '—'],
      ['Stables',   String((d7.stables  ||[]).length), '—'],
      ['En hausse', String((d7.enHausse ||[]).length), '—'],
      ['En baisse', String((d7.enBaisse ||[]).length), '—']
    ]);

    // ── 4. Concentration ──
    if (d9.concRef && d9.concA) {
      body += _ooPar('3 — Concentration du portefeuille', { bold:true, size:26, before:200, after:80 });
      body += _ooTable(['Indicateur','Référence','Période A'], [
        ['Top 10',  d9.concRef.top10  != null ? yoyFmtPct(d9.concRef.top10)  : '—', d9.concA.top10  != null ? yoyFmtPct(d9.concA.top10)  : '—'],
        ['Top 20',  d9.concRef.top20  != null ? yoyFmtPct(d9.concRef.top20)  : '—', d9.concA.top20  != null ? yoyFmtPct(d9.concA.top20)  : '—'],
        ['Top 50',  d9.concRef.top50  != null ? yoyFmtPct(d9.concRef.top50)  : '—', d9.concA.top50  != null ? yoyFmtPct(d9.concA.top50)  : '—'],
        ['Top 100', d9.concRef.top100 != null ? yoyFmtPct(d9.concRef.top100) : '—', d9.concA.top100 != null ? yoyFmtPct(d9.concA.top100) : '—']
      ]);
    }

    // ── 5. Marques ──
    body += _ooPar('4 — Dynamique marques (Top 10)', { bold:true, size:26, before:200, after:80 });
    body += _ooTable(['Marque','CA/j réf.','Part réf.','CA/j A','Part A','Var. €/j'],
      (d10.topBrands||[]).slice(0,10).map(function(b) {
        return [b.marque||'—',
          b.caRefPerDay!=null?yoyFmtEur(b.caRefPerDay):'—',
          b.shareRef!=null?yoyFmtPct(b.shareRef):'—',
          b.caAPerDay!=null?yoyFmtEur(b.caAPerDay):'—',
          b.shareA!=null?yoyFmtPct(b.shareA):'—',
          b.delta!=null?yoyFmtEurSigned(b.delta):'—'];
      }));

    // ── 6. Anomalies ──
    var anomPairs = (d12.anomPairs||[]).slice(0,10);
    if (anomPairs.length > 0) {
      body += _ooPar('5 — Doublons orthographiques', { bold:true, size:26, before:200, after:80 });
      body += _ooTable(['Marque 1','Marque 2','Similarité','CA combiné'],
        anomPairs.map(function(p) {
          return [p.marque1||'—', p.marque2||'—',
            p.similarity!=null?yoyFmtPct(p.similarity*100):'—',
            p.caTot!=null?yoyFmtEur(p.caTot):'—'];
        }));
    }

    // ── 7. Top mouvements ──
    body += _ooPar('6 — Top mouvements ASIN', { bold:true, size:26, before:200, after:80 });
    if ((d11.perdants||[]).length > 0) {
      body += _ooPar('Top 10 perdants', { bold:true, size:22 });
      body += _ooTable(['ASIN','Titre','Marque','Δ €/j'],
        (d11.perdants||[]).slice(0,10).map(function(r) {
          return [r.asin||'—',(r.titre||'').substring(0,50),r.marque||'—',
            r.deltaPerDay!=null?yoyFmtEurSigned(r.deltaPerDay):'—'];
        }));
    }
    if ((d11.gagnants||[]).length > 0) {
      body += _ooPar('Top 10 gagnants', { bold:true, size:22 });
      body += _ooTable(['ASIN','Titre','Marque','Δ €/j'],
        (d11.gagnants||[]).slice(0,10).map(function(r) {
          return [r.asin||'—',(r.titre||'').substring(0,50),r.marque||'—',
            r.deltaPerDay!=null?yoyFmtEurSigned(r.deltaPerDay):'—'];
        }));
    }

    // ── 8. Enquête ──
    body += _ooPar('7 — Enquête ASINs disparus', { bold:true, size:26, before:200, after:80 });
    var eq = (typeof _enqueteCache !== 'undefined' && _enqueteCache && _enqueteCache.result) ? _enqueteCache.result : null;
    if (eq) {
      body += _ooTable(['Catégorie','ASINs'], [
        ['Mortalité naturelle (A1)', String((eq.cat1_mortality||[]).length)],
        ['À CREUSER (A2+D1+D2+R)',  String((eq.cat2_investigate||[]).length)],
        ['Autres (B+C)',             String((eq.cat3_others||[]).length)]
      ]);
      if ((eq.cat2_investigate||[]).length > 0) {
        body += _ooPar('À CREUSER — Top 10', { bold:true, size:22 });
        body += _ooTable(['Cat.','ASIN','Titre','CA réf./j'],
          (eq.cat2_investigate||[]).slice(0,10).map(function(item) {
            return [item.subcat||'—',item.asin||'—',(item.titre||'').substring(0,50),
              item.caRefPerDay!=null?yoyFmtEur(item.caRefPerDay):'—'];
          }));
      }
    }

    // ── 9. Plan d'action ──
    body += _ooPar('8 — Plan d\'action priorisé', { bold:true, size:26, before:200, after:80 });
    if (sign === 'negative') {
      body += _ooPar('Priorité 1 — Auditer les ASINs disparus de poids significatif', { bold:true, size:22 });
      var top5dis = (d7.disparus||[]).slice().sort(function(a,b){return (b.caRefPerDay||0)-(a.caRefPerDay||0);}).slice(0,5);
      if (top5dis.length > 0) {
        body += _ooTable(['ASIN','Titre','Marque','CA réf./j'],
          top5dis.map(function(a) {
            return [a.asin||'—',(a.titre||'').substring(0,45),a.marque||'—',
              a.caRefPerDay!=null?yoyFmtEur(a.caRefPerDay):'—'];
          }));
      }
      body += _ooPar('Priorité 2 — Sécuriser les best-sellers actuels', { bold:true, size:22 });
      body += _ooPar('Surveiller Buy Box et disponibilité sur les ASINs du Top 10 actuel.', { size:20 });
      body += _ooPar('Priorité 3 — Reconstituer les familles en recul', { bold:true, size:22 });
      body += _ooPar('Auditer disponibilité, POs et fiches pour les marques qui décrochent.', { size:20 });
    } else if (sign === 'positive') {
      body += _ooPar('Priorité 1 — Sécuriser les accélérateurs', { bold:true, size:22 });
      body += _ooPar('Protéger stock et Buy Box sur les ASINs moteurs de la croissance.', { size:20 });
    } else {
      body += _ooPar('Performance stable. 3 axes : surveiller les baisses, capitaliser sur les hausses, auditer les disparus résiduels.', { size:20 });
    }

    // ── 10. Analyse par famille ──
    body += _ooPar('9 — Analyse par famille — actions recommandées', { bold:true, size:26, before:200, after:80 });
    var famBrands = (d10.topBrands||[]).slice(0,20).sort(function(a,b){return (a.delta||0)-(b.delta||0);});
    if (famBrands.length > 0) {
      function famState(pct) {
        if (pct==null) return 'Inconnu';
        if (pct > 20)  return 'En croissance';
        if (pct >= -20) return 'Stable';
        if (pct >= -50) return 'En recul';
        return 'Hémorragie';
      }
      var FAM_ACT = {'En croissance':'Sécuriser stock + Buy Box','Stable':'Maintenir cadence appro',
        'En recul':'Audit dispo + relance PO','Hémorragie':'Audit prioritaire','Inconnu':'—'};
      body += _ooTable(['Famille','État','CA/j réf.','CA/j A','Var. €/j','Action'],
        famBrands.map(function(b) {
          var st = famState(b.deltaPct);
          return [b.marque||'—',st,
            b.caRefPerDay!=null?yoyFmtEur(b.caRefPerDay):'—',
            b.caAPerDay!=null?yoyFmtEur(b.caAPerDay):'—',
            b.delta!=null?yoyFmtEurSigned(b.delta):'—',
            FAM_ACT[st]||'—'];
        }));
    }

    // ── 11. Mon diagnostic ──
    body += _ooPar('10 — Mon diagnostic', { bold:true, size:26, before:200, after:80 });
    if (c.aiCache && c.aiCache.diagnosticV1 && c.aiCache.diagnosticV1.content) {
      body += _ooPar('Cause la plus probable', { bold:true, size:22 });
      body += _ooPar(c.aiCache.diagnosticV1.content, { size:20 });
    }

    // ── 12. Conclusion ──
    body += _ooPar('11 — Conclusion générale', { bold:true, size:26, before:200, after:80 });
    if (typeof tplConclusion === 'function') {
      var txt = tplConclusion(d, sign, c.name||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      body += _ooPar(txt, { size:20 });
    }

    // ── Pied de page dans le corps (simple) ──
    body += '<w:p/>';
    body += _ooPar('Amazon Pilot v3.6.9  —  ' + (c.name||'') + '  —  ' + pAL + ' vs ' + pRL, { size:16, color:'888888' });

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"'
      + ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
      + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<w:body>' + body
      + '<w:sectPr>'
      + '<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" w:header="709" w:footer="709" w:gutter="0"/>'
      + '</w:sectPr>'
      + '</w:body></w:document>';
  }

  // ═══════════════════════════════════════════════════════════════
  // POINT D'ENTRÉE PUBLIC (CTA 13)
  // ═══════════════════════════════════════════════════════════════

  window.downloadYoYWord = function() {
    var c = cl();
    var a = yoyState && yoyState.currentAnalysis;
    if (!c || !a) { showToast('Aucune analyse en cours', 'alr-a'); return; }

    var btn = document.getElementById('yoy-word-btn');
    if (btn) { btn.textContent = '⏳ Génération...'; btn.disabled = true; }

    try {
      var documentXml = _buildDocumentXml(c, a);

      var CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml"  ContentType="application/xml"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '<Override PartName="/word/styles.xml"   ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        + '</Types>';

      var RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        + '</Relationships>';

      var DOC_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + '</Relationships>';

      // v3.6.9.1 : styles minimalistes — uniquement Normal avec Calibri 11
      // Aucune référence à des styles nommés dans le document → formatage 100% inline
      var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
        + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        + '<w:docDefaults><w:rPrDefault><w:rPr>'
        + '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>'
        + '<w:sz w:val="22"/><w:szCs w:val="22"/>'
        + '</w:rPr></w:rPrDefault></w:docDefaults>'
        + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">'
        + '<w:name w:val="Normal"/>'
        + '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr>'
        + '</w:style>'
        + '</w:styles>';

      var zip = _buildZip([
        { name: '[Content_Types].xml',           data: CONTENT_TYPES },
        { name: '_rels/.rels',                   data: RELS          },
        { name: 'word/document.xml',             data: documentXml   },
        { name: 'word/_rels/document.xml.rels',  data: DOC_RELS      },
        { name: 'word/styles.xml',               data: STYLES        }
      ]);

      var blob = new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      var slug  = (c.name || 'client').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      var today = new Date().toISOString().slice(0, 10);
      var fname = 'Analyse_comparee_' + slug + '_' + today + '.docx';
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url; link.download = fname;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
      showToast('✅ ' + fname + ' téléchargé', 'alr-g', 4000);
    } catch(e) {
      console.error('[word_export] Erreur DOCX :', e);
      showToast('⚠ Erreur génération DOCX — voir console', 'alr-a', 4000);
    } finally {
      if (btn) { btn.textContent = '📄 Rapport Word'; btn.disabled = false; }
    }
  };

})(); // IIFE — évite de polluer le namespace global
