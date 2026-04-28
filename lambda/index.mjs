// Amazon Pilot — Lambda Handler
// Routes : /api/list · /api/download · /api/presign
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'eu-west-3' });
const BUCKET = process.env.IMPORTS_BUCKET || 'amazon-pilot-imports-foliow';

// CORS headers
const CORS = {
  'Access-Control-Allow-Origin': 'https://amazon.foliow.app',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function resp(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path   = event.requestContext?.http?.path   || event.path || '/';

  // Preflight CORS
  if (method === 'OPTIONS') return resp(200, '', CORS);

  try {
    // ── GET /api/list?prefix=cogex/ ──────────────────────────────
    if (path.endsWith('/list') && method === 'GET') {
      const prefix = event.queryStringParameters?.prefix || '';
      const cmd = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, MaxKeys: 100 });
      const result = await s3.send(cmd);
      const files = (result.Contents || []).map(obj => ({
        key:          obj.Key,
        name:         obj.Key.split('/').pop(),
        size:         obj.Size,
        lastModified: obj.LastModified,
      }));
      return resp(200, { files, count: files.length });
    }

    // ── GET /api/download?key=cogex/fichier.csv ──────────────────
    if (path.endsWith('/download') && method === 'GET') {
      const key = event.queryStringParameters?.key;
      if (!key) return resp(400, { error: 'Paramètre key manquant' });
      // Sécurité : interdire les traversées de répertoire
      if (key.includes('..')) return resp(403, { error: 'Accès refusé' });
      const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
      const result = await s3.send(cmd);
      const body = await result.Body.transformToString('utf-8');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS },
        body,
      };
    }

    // ── POST /api/presign ────────────────────────────────────────
    // Body : { bucket?, key, region? }
    // Retourne une URL pré-signée PUT valable 1h
    if (path.endsWith('/presign') && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const key  = body.key;
      if (!key) return resp(400, { error: 'Paramètre key manquant' });
      if (key.includes('..')) return resp(403, { error: 'Accès refusé' });
      const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key });
      const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
      return resp(200, { url, key, bucket: BUCKET });
    }

    // ── POST /api/presign-batch ──────────────────────────────────
    // Body : { prefix, count }
    // Retourne N URLs pré-signées pour upload par l'agent
    if (path.endsWith('/presign-batch') && method === 'POST') {
      const body   = JSON.parse(event.body || '{}');
      const prefix = body.prefix || '';
      const count  = Math.min(body.count || 1, 20);
      const urls   = [];
      for (let i = 0; i < count; i++) {
        const key = prefix + '/pending-' + Date.now() + '-' + i;
        const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key });
        const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
        urls.push({ url, key });
      }
      return resp(200, { urls });
    }

    return resp(404, { error: 'Route non trouvée : ' + path });

  } catch (e) {
    console.error('Lambda error:', e);
    return resp(500, { error: e.message });
  }
};
