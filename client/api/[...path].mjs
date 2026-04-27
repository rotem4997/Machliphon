// Vercel serverless function — proxies /api/* to the Render backend.
// .mjs extension forces ESM regardless of package.json "type" field.
// Logs are visible in Vercel dashboard → Deployments → Functions tab.

const PRIMARY_BACKEND = process.env.BACKEND_URL || 'https://machliphon.onrender.com';
const FALLBACK_BACKEND = 'https://machliphon-server.onrender.com';

export default async function handler(req, res) {
  const segments = req.query.path;
  const pathStr = Array.isArray(segments) ? segments.join('/') : (segments || '');

  // Preserve query string from original URL
  const qIdx = req.url.indexOf('?');
  const qs = qIdx >= 0 ? req.url.slice(qIdx) : '';

  console.log(`[proxy] ▶ ${req.method} /api/${pathStr}${qs}`);
  console.log(`[proxy] PRIMARY=${PRIMARY_BACKEND} FALLBACK=${FALLBACK_BACKEND}`);

  const headers = {};
  if (req.headers['content-type'])  headers['content-type']  = req.headers['content-type'];
  if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];
  if (req.headers['accept'])        headers['accept']        = req.headers['accept'];

  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  const tryUrl = async (base) => {
    const target = `${base}/api/${pathStr}${qs}`;
    console.log(`[proxy] → fetch ${req.method} ${target}`);
    const upstream = await fetch(target, init);
    console.log(`[proxy] ← ${target} status=${upstream.status}`);
    return upstream;
  };

  let upstream;
  let triedFallback = false;
  try {
    upstream = await tryUrl(PRIMARY_BACKEND);

    // Fall back if primary returns a host-level failure (4xx/5xx that indicates
    // the service isn't reachable, not a legitimate app-level error).
    // We do NOT body-match any more — any 404/403/502/503/504 from the primary
    // means "wrong host or service down"; try the fallback instead.
    if (upstream.status === 404 || upstream.status === 403 ||
        upstream.status === 502 || upstream.status === 503 || upstream.status === 504) {
      const snippet = await upstream.clone().text().then(t => t.slice(0, 300)).catch(() => '');
      console.log(`[proxy] primary ${upstream.status} → switching to fallback. body snippet: ${snippet}`);
      triedFallback = true;
      upstream = await tryUrl(FALLBACK_BACKEND);
    }
  } catch (err) {
    console.error(`[proxy] PRIMARY fetch error: ${err.message}`);
    try {
      triedFallback = true;
      upstream = await tryUrl(FALLBACK_BACKEND);
    } catch (err2) {
      console.error(`[proxy] FALLBACK fetch error: ${err2.message}`);
      res.status(502).json({
        error: 'בעיית חיבור לשרת. נסה שנית.',
        debug: { primary: err.message, fallback: err2.message },
      });
      return;
    }
  }

  console.log(`[proxy] ✓ responding with status=${upstream.status} backend=${triedFallback ? FALLBACK_BACKEND : PRIMARY_BACKEND}`);

  const buffer = await upstream.arrayBuffer();
  const ct = upstream.headers.get('content-type');

  res.status(upstream.status);
  if (ct) res.setHeader('content-type', ct);
  res.setHeader('x-proxy-backend', triedFallback ? FALLBACK_BACKEND : PRIMARY_BACKEND);
  res.setHeader('x-proxy-path', `/api/${pathStr}`);
  res.send(Buffer.from(buffer));
}
