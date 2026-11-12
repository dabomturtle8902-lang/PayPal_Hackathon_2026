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
const appByOrigin = new Map();

function resolveRequestOrigin(req) {
  const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').split(',')[0].trim();
  if (rawHost) {
    const rawProto = String(req.headers['x-forwarded-proto'] || (rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1') ? 'http' : 'https')).split(',')[0].trim();
    const proto = rawProto === 'http' ? 'http' : 'https';
    try {
      return new URL(`${proto}://${rawHost}`).origin;
    } catch {}
  }
  return process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
}

async function getHandler(baseUrl) {
  if (!appByOrigin.has(baseUrl)) {
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
      loadRates,
      staticDir,
    });
    appByOrigin.set(baseUrl, handler);
  }
  return appByOrigin.get(baseUrl);
}

export const config = {
  api: {
    bodyParser: false,
  },
};

/** Vercel serverless entrypoint forwarding `/api/*` and rewritten `/paypal/*` routes to `createApp`. */
export default async function handler(req, res) {
  if (typeof req.url === 'string' && req.url.startsWith('/api/paypal/')) {
    req.url = req.url.slice(4);
  }
  const baseUrl = resolveRequestOrigin(req);
  const appHandler = await getHandler(baseUrl);
  return appHandler(req, res);
}
