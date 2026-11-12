import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server/app.mjs';
import {PayPal} from '../server/paypal.mjs';
import {createNvidia} from '../server/nvidia.mjs';
import {Store, secret, createExchangeRateLoader} from '../server/store.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(here, '../website/dist');
const loadRates = createExchangeRateLoader();

let storePromise;
function getStore() {
  if (!storePromise) {
    const dataFile = process.env.DATA_FILE || (process.env.VERCEL ? '/tmp/splitsync-ledger.json' : resolve(here, '../server/data/sandbox-ledger.json'));
    storePromise = new Store(dataFile).init();
  }
  return storePromise;
}

const envToken = process.env.ORGANIZER_TOKEN?.trim() || '';
const organizerToken = envToken.length >= 24 ? envToken : secret();
const appByKey = new Map();

function collectHostsAndOrigins(req) {
  const rawProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const candidates = [
    req.headers['x-forwarded-host'],
    req.headers.host,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ]
    .flatMap(v => String(v || '').split(','))
    .map(v => v.trim())
    .filter(Boolean);

  const hosts = [];
  const origins = [];
  for (const h of candidates) {
    const proto = rawProto || (h.startsWith('localhost') || h.startsWith('127.0.0.1') ? 'http' : 'https');
    try {
      const u = new URL(`${proto === 'http' ? 'http' : 'https'}://${h}`);
      hosts.push(u.host);
      origins.push(u.origin);
    } catch {}
  }
  if (process.env.PUBLIC_BASE_URL) {
    try {
      const u = new URL(process.env.PUBLIC_BASE_URL);
      hosts.push(u.host);
      origins.push(u.origin);
    } catch {}
  }
  if (process.env.FLUTTER_WEB_ORIGIN) origins.push(process.env.FLUTTER_WEB_ORIGIN);
  const baseUrl = origins[0] || 'http://localhost:3000';
  return {
    baseUrl,
    allowedHosts: [...new Set(hosts)],
    allowedOrigins: [...new Set(origins)],
  };
}

function restoreRewrittenUrl(req) {
  try {
    const parsed = new URL(req.url || '/', 'http://localhost');
    const route = parsed.searchParams.get('__route');
    if (route && (route.startsWith('/api/') || route.startsWith('/paypal/'))) {
      parsed.searchParams.delete('__route');
      const qs = parsed.searchParams.toString();
      req.url = route + (qs ? `?${qs}` : '');
      return;
    }
  } catch {}
  if (typeof req.url === 'string' && req.url.startsWith('/api/paypal/')) {
    req.url = req.url.slice(4);
  }
}

async function getHandler(req) {
  const {baseUrl, allowedHosts, allowedOrigins} = collectHostsAndOrigins(req);
  const cacheKey = `${baseUrl}|${allowedHosts.join(',')}|${allowedOrigins.join(',')}`;
  if (!appByKey.has(cacheKey)) {
    const store = await getStore();
    const paypal = new PayPal({
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      webhookId: process.env.PAYPAL_WEBHOOK_ID,
    });
    const nvidia = createNvidia({
      key: process.env.NVIDIA_API_KEY,
      python: process.env.NVIDIA_PYTHON,
    });
    const hasEnvOrganizer = Boolean(envToken);
    const isLocalBase = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl);
    const autoLinkLocal = process.env.LOCAL_ORGANIZER_AUTO_LOGIN === 'true'
      || (hasEnvOrganizer && process.env.LOCAL_ORGANIZER_AUTO_LOGIN !== 'false' && isLocalBase);
    const envOrganizerAutoLogin = (hasEnvOrganizer || Boolean(process.env.VERCEL))
      && process.env.LOCAL_ORGANIZER_AUTO_LOGIN !== 'false';

    const {handler} = createApp({
      store,
      paypal,
      nvidia,
      organizerToken,
      baseUrl,
      flutterOrigin: process.env.FLUTTER_WEB_ORIGIN || '',
      localOrganizerAutoLogin: autoLinkLocal,
      envOrganizerAutoLogin,
      allowedHosts,
      allowedOrigins,
      loadRates,
      staticDir,
    });
    appByKey.set(cacheKey, handler);
  }
  return appByKey.get(cacheKey);
}

export const config = {
  api: {
    bodyParser: false,
  },
};

/** Vercel serverless entrypoint handling rewritten `/api/*` and `/paypal/*` requests via `createApp`. */
export default async function handler(req, res) {
  restoreRewrittenUrl(req);
  const appHandler = await getHandler(req);
  return appHandler(req, res);
}
