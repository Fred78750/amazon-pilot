// Amazon Pilot — src/s3_poll.js
// Injecté via // @s3_poll dans core.js (build.py)
// v3.7.4 — déplacement strict depuis core.js (aucune modification fonctionnelle)

// ── Configuration S3 imports ────────────────────────
function getS3Config() {
  return {
    bucket:  localStorage.getItem('ap-s3-bucket')  || 'amazon-pilot-imports-foliow',
    region:  localStorage.getItem('ap-s3-region')  || 'eu-west-3',
    enabled: localStorage.getItem('ap-s3-enabled') === '1',
  };
}

function saveS3Config(bucket, region, enabled) {
  localStorage.setItem('ap-s3-bucket',  bucket);
  localStorage.setItem('ap-s3-region',  region);
  localStorage.setItem('ap-s3-enabled', enabled ? '1' : '0');
  showToast('Configuration S3 sauvegardée', 'alr-g');
  render();
}

// ── Clé S3 pour un fichier client ───────────────────
// Ex: cogex/Ventes_ASIN_..._S16.csv
function getS3Key(clientName, filename) {
  const slug = clientName.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  return slug + '/' + filename;
}

// ── Générer URL pré-signée S3 PUT via API Gateway ───
// Nécessite un endpoint Lambda qui génère les URLs pré-signées
async function getS3PresignedUrl(clientName, filename) {
  const cfg = getS3Config();
  if (!cfg.enabled) return null;
  const apiUrl = localStorage.getItem('ap-s3-api-url');
  if (!apiUrl) return null;
  try {
    const key = getS3Key(clientName, filename);
    const resp = await fetch(apiUrl + '/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: cfg.bucket, key, region: cfg.region })
    });
    if (!resp.ok) return null;
    const { url } = await resp.json();
    return url;
  } catch(e) {
    return null;
  }
}

// ── Poll S3 pour détecter nouveaux fichiers ──────────
let _s3PollHandle = null;
let _s3KnownKeys  = new Set();


function activateS3Poll() {
  const u = document.getElementById('s3-api-url');
  const b = document.getElementById('s3-bucket');
  if (!u || !b) { showToast('Champs introuvables', 'alr-a'); return; }
  const url = u.value.trim(), bkt = b.value.trim();
  if (!url || !bkt) { showToast('Remplissez URL et bucket', 'alr-a'); return; }
  localStorage.setItem('ap-s3-api-url', url);
  saveS3Config(bkt, 'eu-west-3', true);
  startS3Poll();
}

function startS3Poll() {
  stopS3Poll();
  const cfg = getS3Config();
  if (!cfg.enabled) return;
  const c = cl();
  if (!c) return;

  // Charger les clés déjà traitées depuis localStorage
  const stored = localStorage.getItem('ap-s3-known-' + c.id);
  if (stored) { try { JSON.parse(stored).forEach(k => _s3KnownKeys.add(k)); } catch(e) {} }

  _s3PollHandle = setInterval(function() {
    pollS3Imports().catch(function(e) { console.warn('[AP] pollS3 error:', e.message); });
  }, 10000);

  // Première vérification immédiate
  pollS3Imports().catch(function(e) { console.warn('[AP] pollS3 error:', e.message); });
}

function stopS3Poll() {
  if (_s3PollHandle) { clearInterval(_s3PollHandle); _s3PollHandle = null; }
}

async function pollS3Imports() {
  const cfg = getS3Config();
  if (!cfg.enabled) return;
  const c = cl();
  if (!c) return;

  const apiUrl = localStorage.getItem('ap-s3-api-url');
  if (!apiUrl) return;

  try {
    const slug = c.name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');

    const resp = await fetch(apiUrl + '/list?prefix=' + slug + '/');
    if (!resp.ok) return;
    let _parsedList;
    try {
      _parsedList = await resp.json();
    } catch(jsonErr) {
      console.warn('[AP] pollS3 JSON parse error:', jsonErr.message);
      return;
    }
    const { files } = _parsedList || {};

    const newFiles = (files || []).filter(f => !_s3KnownKeys.has(f.key) && f.size > 0);
    if (!newFiles.length) return;

    for (const file of newFiles) {
      try {
        // Télécharger le fichier depuis S3
        const dlResp = await fetch(apiUrl + '/download?key=' + encodeURIComponent(file.key));
        if (!dlResp.ok) continue;
        const text = await dlResp.text();

        // Router vers le bon parser
        const lower = file.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        let imported = false;

        if (lower.includes('vente') || lower.includes('sales')) {
          const parsed = parseCSVFile(text, file.name);
          if (!parsed.error) { mergeImportData(c, [parsed]); imported = true; }
        } else if (lower.includes('trafic') || lower.includes('traffic')) {
          const parsed = parseCSVFile(text, file.name);
          if (!parsed.error) { mergeImportData(c, [parsed]); imported = true; }
        } else if (lower.includes('stock') || lower.includes('inventory')) {
          const parsed = parseCSVFile(text, file.name);
          if (!parsed.error) { mergeImportData(c, [parsed]); imported = true; }
        } else if (lower.includes('prevision') || lower.includes('forecast')) {
          const res = parseForecastFile(text, file.name);
          if (!res.error) { c.forecastData = Object.assign(c.forecastData||{}, res.forecastData); imported = true; }
        } else if (lower.includes('ppm') || lower.includes('netppm')) {
          const res = parsePPMFile(text, file.name);
          if (!res.error) { c.ppmData = Object.assign(c.ppmData||{}, res.ppmData); imported = true; }
        }

        if (imported) {
          _s3KnownKeys.add(file.key);
          // Persister les clés traitées
          localStorage.setItem('ap-s3-known-' + c.id, JSON.stringify([..._s3KnownKeys]));
          save();
          render();
          showToast('✅ ' + file.name + ' importé automatiquement depuis S3', 'alr-g', 6000);
        }
      } catch(e) { /* fichier inaccessible */ }
    }
  } catch(e) { /* poll silencieux */ }
}