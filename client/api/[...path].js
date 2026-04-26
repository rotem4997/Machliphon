// Vercel serverless function: proxies all /api/* requests to the Render backend.
// This runs on Vercel's Node.js runtime (server-side) so CORS is irrelevant —
// the request is Vercel → Render, not browser → Render.
const BACKEND = 'https://machliphon-server.onrender.com';

export default async function handler(req, res) {
  const segments = req.query.path;
  const pathStr = Array.isArray(segments) ? segments.join('/') : (segments || '');

  // Preserve original query string (minus the 'path' param Vercel injects)
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const targetUrl = `${BACKEND}/api/${pathStr}${qs}`;

  const headers = {};
  if (req.headers['content-type'])  headers['content-type']  = req.headers['content-type'];
  if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];

  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const buffer = await upstream.arrayBuffer();
    const ct = upstream.headers.get('content-type');

    res.status(upstream.status);
    if (ct) res.setHeader('content-type', ct);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[proxy]', targetUrl, err.message);
    res.status(502).json({ error: 'בעיית חיבור לשרת. נסה שנית.', debug: err.message });
  }
}
