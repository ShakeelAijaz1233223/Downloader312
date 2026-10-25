import dns from 'node:dns/promises';
import net from 'node:net';
import { AppError } from '../utils/errors.js';
import { runtimeEnginePreferences } from '../services/trafficEngine.js';

const FORBIDDEN_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '::1',
  '[::1]',
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
]);

const DRM_SUBSCRIPTION_DOMAINS = [
  'netflix.com',
  'primevideo.com',
  'disneyplus.com',
  'hulu.com',
  'max.com',
  'hbomax.com',
  'tv.apple.com',
  'peacocktv.com',
];

const dohCache = new Map();

export async function resolvePublicIpViaDoH(hostname) {
  const cached = dohCache.get(hostname);
  if (cached && cached.exp > Date.now()) return cached.ips;

  const endpoints =
    runtimeEnginePreferences.dohProvider === 'google'
      ? [
          `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`,
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
        ]
      : [
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
          `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`,
        ];

  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const ips = (j.Answer || [])
        .filter((a) => a.type === 1 && net.isIPv4(a.data))
        .map((a) => a.data);
      if (ips.length > 0) {
        dohCache.set(hostname, { ips, exp: Date.now() + 10 * 60 * 1000 });
        return ips;
      }
    } catch {
      // try fallback DoH resolver
    }
  }
  return [];
}

export function isPrivateOrReservedIp(ip) {
  if (!ip) return true;
  const clean = ip.replace(/^\[|\]$/g, '').toLowerCase();

  if (clean.startsWith('::ffff:')) {
    return isPrivateOrReservedIp(clean.slice(7));
  }

  if (net.isIPv4(clean)) {
    const parts = clean.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }

  if (net.isIPv6(clean)) {
    if (clean === '::' || clean === '::1') return true;
    if (clean.startsWith('fc') || clean.startsWith('fd')) return true;
    if (clean.startsWith('fe8') || clean.startsWith('fe9') || clean.startsWith('fea') || clean.startsWith('feb')) {
      return true;
    }
    return false;
  }

  return true;
}

// Auto-heal common WhatsApp/Telegram copy-paste domain typos (e.g. ww.mirrobox.com, www.terabox.ap, www.1024tera.co)
export function normalizeCommonMirrorTypos(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  return rawUrl
    .trim()
    .replace(/^(https?:\/\/)ww\.mirrobox\.com\b/i, '$1www.mirrobox.com')
    .replace(/^(https?:\/\/)(?:www\.)?terabox\.ap(?=\/|$|\?)/i, '$1www.terabox.app')
    .replace(/^(https?:\/\/)(?:www\.)?1024tera\.co(?=\/|$|\?)/i, '$1www.1024tera.com')
    .replace(/^(https?:\/\/)(?:www\.)?4funbox\.co(?=\/|$|\?)/i, '$1www.4funbox.com');
}

// Synchronous Fast Layer-1 URL + Private CIDR + Honest Widevine DRM Check
export function validateSafeExternalUrlSync(rawUrl) {
  const healed = normalizeCommonMirrorTypos(rawUrl);
  if (!healed || typeof healed !== 'string' || healed.length > 4096) {
    throw new AppError(400, 'INVALID_URL', 'Please provide a valid HTTP or HTTPS video URL.');
  }

  let parsed;
  try {
    parsed = new URL(healed);
  } catch {
    throw new AppError(400, 'INVALID_URL', 'Malformed URL format. Ensure https:// is included.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError(400, 'INVALID_URL', 'Only http:// and https:// URLs are permitted.');
  }

  if (parsed.username || parsed.password) {
    throw new AppError(400, 'SSRF_BLOCKED', 'Embedded credentials inside URLs are blocked for security.');
  }

  const host = parsed.hostname.toLowerCase();
  if (FORBIDDEN_HOSTNAMES.has(host) || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new AppError(
      403,
      'SSRF_BLOCKED',
      'Security Guard (Anti-SSRF): Localhost, internal hosts, and cloud metadata endpoints are strictly forbidden.'
    );
  }

  const bareHost = host.replace(/^\[|\]$/g, '');
  if (net.isIP(bareHost) && isPrivateOrReservedIp(bareHost)) {
    throw new AppError(
      403,
      'SSRF_BLOCKED',
      'Security Guard (Anti-SSRF): Private, loopback, and link-local IP ranges are strictly forbidden.'
    );
  }

  if (DRM_SUBSCRIPTION_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    throw new AppError(
      422,
      'DRM_PROTECTED',
      'Encrypted Hardware DRM Stream (Widevine/PlayReady) — Subscription-encrypted streams cannot be extracted.'
    );
  }

  return parsed;
}

// Asynchronous Layer-2 DNS-Rebinding Guard WITH Encrypted DoH Verification
// (Prevents false SSRF errors when Pakistani ISPs poison blocked adult/movie domains to 127.0.0.1!)
export async function assertSafeOutboundUrl(rawUrl, { performDnsCheck = false } = {}) {
  const parsed = validateSafeExternalUrlSync(rawUrl);
  const bareHost = parsed.hostname.replace(/^\[|\]$/g, '');

  if (performDnsCheck && !net.isIP(bareHost)) {
    try {
      const records = await dns.lookup(bareHost, { all: true });
      const hasPrivate = records.some((rec) => isPrivateOrReservedIp(rec.address));
      if (hasPrivate) {
        // Check via Encrypted Cloudflare/Google DoH whether local ISP poisoned DNS to 127.0.0.1/0.0.0.0!
        if (runtimeEnginePreferences.dnsOverHttpsBypass && bareHost.includes('.')) {
          const realGlobalIps = await resolvePublicIpViaDoH(bareHost);
          if (realGlobalIps.length > 0 && realGlobalIps.every((ip) => !isPrivateOrReservedIp(ip))) {
            return parsed;
          }
        }
        throw new AppError(
          403,
          'SSRF_BLOCKED',
          `DNS Rebinding Blocked: Host ${bareHost} resolved to private/internal IP.`
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
    }
  }

  return parsed;
}
