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
    console.log(`[proxy] ${req.method} ${target}`);
    const upstream = await fetch(target, init);
    console.log(`[proxy] ${target} -> ${upstream.status}`);
    return upstream;
  };

  let upstream;
  let triedFallback = false;
  try {
    upstream = await tryUrl(PRIMARY_BACKEND);
    // If primary returns 404 from Render's host wildcard ("Host not in allowlist"
    // / "Application not found"), try the fallback.
    if (upstream.status === 404 || upstream.status === 403) {
      const peek = await upstream.clone().text();
      if (/host not in allowlist|application not found|no service/i.test(peek)) {
        console.log(`[proxy] primary returned ${upstream.status} wildcard, trying fallback`);
        triedFallback = true;
        upstream = await tryUrl(FALLBACK_BACKEND);
      }
    }
  } catch (err) {
    console.error(`[proxy] PRIMARY error:`, err.message);
    try {
      triedFallback = true;
      upstream = await tryUrl(FALLBACK_BACKEND);
    } catch (err2) {
      console.error(`[proxy] FALLBACK error:`, err2.message);
      res.status(502).json({
        error: 'בעיית חיבור לשרת. נסה שנית.',
        debug: { primary: err.message, fallback: err2.message },
      });
      return;
    }
  }

  const buffer = await upstream.arrayBuffer();
  const ct = upstream.headers.get('content-type');

  res.status(upstream.status);
  if (ct) res.setHeader('content-type', ct);
  res.setHeader('x-proxy-backend', triedFallback ? FALLBACK_BACKEND : PRIMARY_BACKEND);
  res.send(Buffer.from(buffer));
}
