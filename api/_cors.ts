// Shared Cross-Origin (CORS) and security header utilities for Vercel Serverless Functions

export interface CorsOptions {
  methods?: string;
  resourcePolicy?: 'same-origin' | 'same-site' | 'cross-origin';
  /**
   * When true, cross-origin requests from unrecognized origins are rejected with 403
   * for both GET and POST (used on endpoints that handle student records).
   */
  restrictReadsToTrustedOrigins?: boolean;
}

const DEFAULT_ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With, Accept';
const DEFAULT_ALLOWED_METHODS = 'GET, POST, OPTIONS';

function getEnvString(key: string): string {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[key] || '';
}

function getRequestHost(req: any): string {
  const fwdHost = req?.headers?.['x-forwarded-host'] || req?.headers?.host || '';
  return String(Array.isArray(fwdHost) ? fwdHost[0] : fwdHost)
    .split(',')[0]
    .trim()
    .toLowerCase();
}

export function isTrustedOrigin(origin: string | undefined, req: any): boolean {
  if (!origin) return true; // Same-origin navigations or server-to-server requests without Origin header

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const originHost = parsed.host.toLowerCase();
  const originHostname = parsed.hostname.toLowerCase();
  const reqHost = getRequestHost(req);

  // 1. Exact same host as the current deployment (Vercel custom domain, preview URL, or localhost)
  if (reqHost && originHost === reqHost) {
    return true;
  }

  // 2. Local development origins
  if (originHostname === 'localhost' || originHostname === '127.0.0.1') {
    return true;
  }

  // 3. This portal's own AI Studio preview/published hosts (HTTPS only)
  const knownPortalHosts = [
    'ais-dev-f7jpkmgt4fqk7n2ogmc4x2-740969633609.asia-southeast1.run.app',
    'ais-pre-f7jpkmgt4fqk7n2ogmc4x2-740969633609.asia-southeast1.run.app'
  ];
  if (parsed.protocol === 'https:' && knownPortalHosts.includes(originHostname)) {
    return true;
  }

  // 4. Explicit custom origins configured via ALLOWED_ORIGINS or APP_URL environment variables
  const configured = [getEnvString('ALLOWED_ORIGINS'), getEnvString('APP_URL')]
    .filter(Boolean)
    .join(',')
    .split(',')
    .map(item => item.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);

  const normalizedOrigin = origin.trim().replace(/\/+$/, '').toLowerCase();
  return configured.includes(normalizedOrigin);
}

/**
 * Applies verified CORS, Vary, cache, and cross-origin resource headers.
 * Returns `true` if the request has already been handled (e.g. OPTIONS preflight or 403 block).
 */
export function applyCorsHeaders(req: any, res: any, options: CorsOptions = {}): boolean {
  const methods = options.methods || DEFAULT_ALLOWED_METHODS;
  const resourcePolicy = options.resourcePolicy || 'cross-origin';
  const rawOrigin = req?.headers?.origin;
  const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
  const trusted = isTrustedOrigin(origin, req);

  // Always prevent MIME sniffing and CDN caching of dynamic API responses
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Cross-Origin-Resource-Policy', resourcePolicy);
  res.setHeader('Vary', 'Origin');

  if (origin && trusted) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // No Origin header (same-origin GET or curl/server check) — no wildcard needed
  }

  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', DEFAULT_ALLOWED_HEADERS);
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    if (origin && !trusted) {
      res.status(403).json({ success: false, error: 'Origin not allowed' });
      return true;
    }
    res.status(204).end();
    return true;
  }

  // Block untrusted cross-origin writes (and untrusted reads when restricted)
  if (origin && !trusted && (req.method !== 'GET' || options.restrictReadsToTrustedOrigins)) {
    res.status(403).json({ success: false, error: 'Cross-origin request blocked' });
    return true;
  }

  return false;
}

export function stripDangerousKeys(value: unknown, depth = 0): any {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(item => stripDangerousKeys(item, depth + 1));
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    clean[k] = stripDangerousKeys(v, depth + 1);
  }
  return clean;
}
