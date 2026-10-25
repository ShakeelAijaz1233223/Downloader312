import crypto from 'node:crypto';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { ENV } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { assertSafeOutboundUrl } from '../security/antiSsrfGuard.js';
import { selectOptimalUpstreamUserAgent } from './idmTurboDownloader.js';
import {
  ALLOWED_DOWNLOAD_EXTENSIONS,
  getLibraryEntry,
} from '../data/downloadLibrary.js';
import { mimeForExtension, extensionOfFileName } from '../data/mediaFormats.js';

// ============================================================================
// SIGNED, SHORT-LIVED DOWNLOAD TICKETS  (rewritten — V11)
//
// The old engine embedded the *whole* target (a 2–3 KB googlevideo URL + name +
// mime + timestamps) inside the ticket. Trusted proxies, WhatsApp/Telegram
// share-sheets and some browsers truncate long URLs, which produced
// "This download link is not valid or has been modified" on perfectly good
// links. Now the payload is kept server-side (in RAM, keyed by a random id)
// and only a ~80 character signed ticket travels in the URL.
//
// Extra safety net: if the upstream CDN answers 401/403/404/410 (expired
// YouTube/Dailymotion/TeraBox signature), the ticket is transparently
// re-resolved from the original page and the download continues — no more
// "File wasn't available on site".
// ============================================================================

const TICKET_SECRET =
  process.env.DOWNLOAD_TICKET_SECRET || `${ENV.JWT_USER_SECRET}::download-ticket::v11`;
const TICKET_TTL_SECONDS = Number(ENV.DOWNLOAD_TICKET_TTL_SECONDS || 900);
const MAX_TICKET_LENGTH = Number(ENV.DOWNLOAD_TICKET_MAX_LENGTH || 512);
const MAX_STORED_TICKETS = 5000;

/** jti -> { payload, expiresAtMs } */
const TICKET_STORE = new Map();

function signValue(value) {
  return crypto.createHmac('sha256', TICKET_SECRET).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function base64UrlEncode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function purgeExpiredTickets(nowMs = Date.now()) {
  if (TICKET_STORE.size < 200) return;
  for (const [jti, entry] of TICKET_STORE) {
    if (entry.expiresAtMs <= nowMs) TICKET_STORE.delete(jti);
  }
  // Hard cap: drop the oldest entries so a busy box can never leak memory.
  while (TICKET_STORE.size > MAX_STORED_TICKETS) {
    const oldest = TICKET_STORE.keys().next().value;
    if (!oldest) break;
    TICKET_STORE.delete(oldest);
  }
}

export function sanitizeDownloadFileName(rawName, fallbackExt = 'bin') {
  const fallback = `UltraDownloader_File.${fallbackExt}`;
  const cleaned = String(rawName || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120);

  if (!cleaned) return fallback;

  const ext = cleaned.includes('.') ? cleaned.split('.').pop().toLowerCase() : '';
  if (!ALLOWED_DOWNLOAD_EXTENSIONS.includes(ext)) {
    // Never invent or rename an extension: fall back to the safe default.
    return fallback;
  }
  return cleaned;
}

function extensionOf(fileName) {
  return extensionOfFileName(fileName);
}

function buildContentDisposition(fileName) {
  const asciiFallback = String(fileName).replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '') || 'file';
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * Creates a signed ticket for either a library file (`fileId`) or an
 * authorized remote media stream (`url`). Returns a same-origin URL that
 * Chrome/Edge/IDM download natively as an attachment.
 */
export async function createDownloadTicket({
  fileId = '',
  url = '',
  fileName = '',
  mimeType = '',
  sourceUrl = '',
  title = '',
  qualityLabel = '',
  formatId = '',
  qualityKey = '',
  platformId = '',
  user = null,
  originBaseUrl = '',
}) {
  const requestedFileId = String(fileId || '').trim();
  const requestedUrl = String(url || '').trim();

  if (!requestedFileId && !requestedUrl) {
    throw new AppError(
      400,
      'DOWNLOAD_TARGET_REQUIRED',
      'No file was selected for download. Please choose a file or a video stream first.'
    );
  }

  let target;

  if (requestedFileId) {
    const entry = getLibraryEntry(requestedFileId);
    if (!entry) {
      throw new AppError(404, 'FILE_NOT_REGISTERED', 'This file is not available for download.');
    }
    if (entry.requiresAuth && !user) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Please sign in to download this protected file.');
    }
    if (!entry.exists) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'This file is no longer available.');
    }

    target = {
      kind: 'local',
      fileId: entry.fileId,
      absolutePath: entry.absolutePath,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
      sizeBytes: entry.sizeBytes,
    };
  } else {
    const parsed = await assertSafeOutboundUrl(requestedUrl, { performDnsCheck: true });
    const guessedExt = extensionOf(fileName) || extensionOf(parsed.pathname) || 'mp4';
    const finalName = sanitizeDownloadFileName(
      fileName || `UltraDownloader_Download.${guessedExt}`,
      guessedExt
    );
    const finalExt = extensionOf(finalName) || guessedExt;

    target = {
      kind: 'remote',
      upstreamUrl: parsed.toString(),
      fileName: finalName,
      mimeType: String(mimeType || '').trim() || mimeForExtension(finalExt),
      sizeBytes: 0,
      sourceUrl: String(sourceUrl || '').trim(),
      title: String(title || '').slice(0, 200),
      qualityLabel: String(qualityLabel || '').slice(0, 64),
      formatId: String(formatId || '').slice(0, 120),
      qualityKey: String(qualityKey || '').slice(0, 64),
      platformId: String(platformId || '').slice(0, 64),
    };
  }

  const issuedAtMs = Date.now();
  const issuedAt = Math.floor(issuedAtMs / 1000);
  const jti = crypto.randomBytes(12).toString('base64url');
  const payload = {
    ...target,
    iss: 'ultradownloader',
    iat: issuedAt,
    exp: issuedAt + TICKET_TTL_SECONDS,
    jti,
  };

  purgeExpiredTickets(issuedAtMs);
  TICKET_STORE.set(jti, { payload, expiresAtMs: issuedAtMs + TICKET_TTL_SECONDS * 1000 });

  const body = `u1.${jti}.${issuedAt.toString(36)}`;
  const ticket = `${body}.${signValue(body)}`;
  const safeName = encodeURIComponent(payload.fileName);
  const path = `/api/v1/files/download/${safeName}?ticket=${encodeURIComponent(ticket)}`;

  return {
    ticket,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    sizeBytes: payload.sizeBytes || 0,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    expiresInSeconds: TICKET_TTL_SECONDS,
    downloadPath: path,
    downloadUrl: originBaseUrl ? `${originBaseUrl}${path}` : path,
  };
}

/** Accepts BOTH the new short ticket and any legacy long ticket still in flight. */
export function verifyDownloadTicket(rawTicket) {
  const ticket = String(rawTicket || '').trim();
  if (!ticket || ticket.length > MAX_TICKET_LENGTH) {
    throw new AppError(
      400,
      'INVALID_TICKET',
      'This download link is incomplete. Please click Download again.'
    );
  }

  const parts = ticket.split('.');

  // ---- V11 short ticket: u1.<jti>.<issuedAt36>.<signature> ------------------
  if (parts[0] === 'u1') {
    if (parts.length !== 4) {
      throw new AppError(403, 'INVALID_TICKET', 'This download link is not valid. Please click Download again.');
    }
    const body = `${parts[0]}.${parts[1]}.${parts[2]}`;
    if (!safeEqual(signValue(body), parts[3])) {
      throw new AppError(
        403,
        'TICKET_SIGNATURE_INVALID',
        'This download link was modified and cannot be used. Please click Download again.'
      );
    }

    const entry = TICKET_STORE.get(parts[1]);
    if (!entry) {
      throw new AppError(
        410,
        'TICKET_EXPIRED',
        'This download link has expired. Please click Download again to get a fresh link.'
      );
    }
    if (entry.expiresAtMs <= Date.now()) {
      TICKET_STORE.delete(parts[1]);
      throw new AppError(
        410,
        'TICKET_EXPIRED',
        'This download link has expired. Please click Download again to get a fresh link.'
      );
    }
    return entry.payload;
  }

  // ---- Legacy long ticket: <base64url payload>.<signature> ------------------
  const separatorIndex = ticket.lastIndexOf('.');
  if (separatorIndex <= 0) {
    throw new AppError(403, 'INVALID_TICKET', 'This download link is not valid. Please click Download again.');
  }

  const encoded = ticket.slice(0, separatorIndex);
  const signature = ticket.slice(separatorIndex + 1);

  if (!safeEqual(signValue(encoded), signature)) {
    throw new AppError(
      403,
      'TICKET_SIGNATURE_INVALID',
      'This download link was modified and cannot be used. Please click Download again.'
    );
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded));
  } catch {
    throw new AppError(403, 'INVALID_TICKET', 'This download link is not readable. Please click Download again.');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload?.exp || payload.exp <= nowSeconds) {
    throw new AppError(
      410,
      'TICKET_EXPIRED',
      'This download link has expired. Please click Download again to get a fresh link.'
    );
  }

  return payload;
}

function applyAttachmentHeaders(res, fileName, mimeType, extra = {}) {
  res.setHeader('Content-Disposition', buildContentDisposition(fileName));
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Range,Accept-Ranges,Content-Length,Content-Disposition'
  );
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null) res.setHeader(key, value);
  });
}

function parseRangeHeader(rangeHeader, totalSize) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader || '').trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  let start = rawStart ? Number.parseInt(rawStart, 10) : 0;
  let end = rawEnd ? Number.parseInt(rawEnd, 10) : totalSize - 1;

  if (!rawStart && rawEnd) {
    const suffixLength = Number.parseInt(rawEnd, 10);
    start = Math.max(totalSize - suffixLength, 0);
    end = totalSize - 1;
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= totalSize) return null;
  return { start, end: Math.min(end, totalSize - 1) };
}

async function streamLocalFile(req, res, payload) {
  let stat;
  try {
    stat = fs.statSync(payload.absolutePath);
  } catch {
    throw new AppError(404, 'FILE_NOT_FOUND', 'This file is no longer available on the server.');
  }
  if (!stat.isFile()) {
    throw new AppError(404, 'FILE_NOT_FOUND', 'This file is no longer available on the server.');
  }

  const totalSize = stat.size;
  const range = parseRangeHeader(req.headers.range, totalSize);

  res.setHeader('Accept-Ranges', 'bytes');

  if (range) {
    const chunkSize = range.end - range.start + 1;
    applyAttachmentHeaders(res, payload.fileName, payload.mimeType, {
      'Content-Range': `bytes ${range.start}-${range.end}/${totalSize}`,
      'Content-Length': String(chunkSize),
    });
    res.status(206);
    if (req.method === 'HEAD') return res.end();
    await pipeline(
      fs.createReadStream(payload.absolutePath, { start: range.start, end: range.end }),
      res
    ).catch(() => {});
    return;
  }

  applyAttachmentHeaders(res, payload.fileName, payload.mimeType, {
    'Content-Length': String(totalSize),
  });
  res.status(200);
  if (req.method === 'HEAD') return res.end();
  await pipeline(fs.createReadStream(payload.absolutePath), res).catch(() => {});
}

function looksLikeHlsPlaylist(targetUrl, mimeType = '') {
  const u = String(targetUrl || '');
  if (/\.m3u8(\?|#|$)/i.test(u)) return true;
  if (/format=m3u8|type=m3u8|[?&]hls=1/i.test(u)) return true;
  return /mpegurl/i.test(String(mimeType || ''));
}

/**
 * Re-resolves a dead CDN link from the ORIGINAL page/paste, preferring the same
 * format the user picked. This is what makes a 403 "expired signature" heal
 * itself instead of showing "File wasn't available on site".
 */
async function refreshRemoteTarget(payload) {
  const sourceUrl = String(payload?.sourceUrl || '').trim();
  if (!/^https?:\/\//i.test(sourceUrl)) return null;

  let extractor;
  try {
    extractor = await import('./extractorEngine.js');
  } catch {
    return null;
  }

  let analysis;
  try {
    analysis = await extractor.analyzeMediaUrl({ rawUrl: sourceUrl });
  } catch {
    return null;
  }
  if (!analysis?.streams) return null;

  const groups = [
    analysis.streams.videoAudio || [],
    analysis.streams.videoWithAudio || [],
    analysis.streams.videoOnly || [],
    analysis.streams.audioOnly || [],
  ].flat();

  const usable = groups.filter((s) => /^https?:\/\//i.test(String(s?.directCdnUrl || '')));
  if (!usable.length) return null;

  const sameFormat =
    usable.find(
      (s) =>
        (payload.formatId && s.formatId === payload.formatId) ||
        (payload.qualityKey && s.qualityKey === payload.qualityKey)
    ) || null;

  const best =
    sameFormat ||
    usable.find((s) => s.hasAudio && s.hasVideo) ||
    usable[0];

  return {
    upstreamUrl: String(best.directCdnUrl),
    fileName: payload.fileName || undefined,
  };
}

async function openUpstream(payload, req) {
  const upstreamHeaders = {
    'User-Agent': selectOptimalUpstreamUserAgent(payload.upstreamUrl),
    Accept: '*/*',
  };
  if (payload.sourceUrl && /^https?:\/\//i.test(payload.sourceUrl)) {
    upstreamHeaders.Referer = payload.sourceUrl;
    upstreamHeaders.Origin = (() => {
      try {
        return new URL(payload.sourceUrl).origin;
      } catch {
        return '';
      }
    })();
  }
  if (req.headers.range) upstreamHeaders.Range = req.headers.range;

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const response = await fetch(payload.upstreamUrl, {
    method: 'GET',
    headers: upstreamHeaders,
    redirect: 'follow',
    signal: controller.signal,
  }).catch((err) => {
    if (err?.name === 'AbortError') return null;
    return { networkError: err };
  });

  return { upstream: response, controller };
}

async function streamRemoteFile(req, res, payload) {
  // Streaming-only links (HLS / .m3u8): join every segment into ONE real file
  // instead of handing the browser a 2 KB playlist.
  if (looksLikeHlsPlaylist(payload.upstreamUrl, payload.mimeType)) {
    const { writeHlsAsSingleFile } = await import('./streamProxyService.js');
    return writeHlsAsSingleFile(req, res, {
      url: payload.upstreamUrl,
      referer: payload.sourceUrl,
      fileName: payload.fileName,
    });
  }

  let opened = await openUpstream(payload, req);
  let upstream = opened?.upstream;

  // ---- SELF-HEALING LINK: expired / rotated CDN signature ------------------
  const staleStatus = upstream && !upstream.networkError ? upstream.status : 0;
  if (!upstream || upstream.networkError || [401, 403, 404, 410, 451].includes(staleStatus)) {
    const refreshed = await refreshRemoteTarget(payload).catch(() => null);
    if (refreshed?.upstreamUrl && refreshed.upstreamUrl !== payload.upstreamUrl) {
      payload.upstreamUrl = refreshed.upstreamUrl;
      // Persist the healed link so Retry / resume also works.
      for (const entry of TICKET_STORE.values()) {
        if (entry.payload.jti === payload.jti) {
          entry.payload.upstreamUrl = refreshed.upstreamUrl;
          break;
        }
      }
      opened = await openUpstream(payload, req);
      upstream = opened?.upstream;
    }
  }

  if (!upstream || upstream.networkError) {
    throw new AppError(
      502,
      'UPSTREAM_UNAVAILABLE',
      'The media server could not be reached. Please try again in a moment.'
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    throw new AppError(
      upstream.status === 403 || upstream.status === 401 ? 403 : 502,
      'UPSTREAM_ERROR',
      upstream.status === 403 || upstream.status === 401
        ? 'The media server refused this link (signature expired). Click Download again — a fresh link is created automatically.'
        : `The media server returned an error (HTTP ${upstream.status}).`
    );
  }

  const upstreamMime = upstream.headers.get('content-type') || payload.mimeType;
  const contentLength = upstream.headers.get('content-length');
  const contentRange = upstream.headers.get('content-range');

  applyAttachmentHeaders(res, payload.fileName, payload.mimeType || upstreamMime, {
    'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
    'Content-Length': contentLength || undefined,
    'Content-Range': contentRange || undefined,
  });

  res.status(contentRange ? 206 : 200);

  if (req.method === 'HEAD' || !upstream.body) {
    opened.controller.abort();
    return res.end();
  }

  await pipeline(Readable.fromWeb(upstream.body), res).catch(() => {});
}

/**
 * Serves the actual bytes for a verified ticket. Streams, never buffers.
 * Supports HEAD (for verification) and HTTP Range (resume / IDM multi-part).
 */
export async function serveTicketDownload(req, res, rawTicket) {
  const payload = verifyDownloadTicket(rawTicket);

  if (payload.kind === 'local') {
    return streamLocalFile(req, res, payload);
  }
  if (payload.kind === 'remote') {
    return streamRemoteFile(req, res, payload);
  }
  throw new AppError(400, 'INVALID_TICKET', 'This download link is not supported.');
}

export { buildContentDisposition };
