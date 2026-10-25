import crypto from 'node:crypto';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { assertSafeOutboundUrl } from '../security/antiSsrfGuard.js';
import { selectOptimalUpstreamUserAgent } from './idmTurboDownloader.js';
import { AppError } from '../utils/errors.js';
import { mimeForExtension } from '../data/mediaFormats.js';

function applyContentDispositionHeader(res, downloadFileName) {
  if (!downloadFileName) return;
  const asciiFallback =
    String(downloadFileName)
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\]/g, '')
      .trim() || 'video.mp4';
  const utf8Encoded = encodeURIComponent(downloadFileName);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`
  );
}

// ============================================================================
// REAL RFC-9110 HTTP 206 PARTIAL CONTENT RANGE STREAMER (LOCAL FILES ON DISK)
// ============================================================================
export function streamLocalFileWithRange(
  req,
  res,
  filePath,
  mimeType = 'video/mp4',
  downloadFileName = null
) {
  if (!fs.existsSync(filePath)) {
    throw new AppError(404, 'NOT_FOUND', 'Requested media file does not exist on disk.');
  }

  const stat = fs.statSync(filePath);
  const totalSize = stat.size;
  const rangeHeader = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeType);
  applyContentDispositionHeader(res, downloadFileName);

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) {
      res.setHeader('Content-Range', `bytes */${totalSize}`);
      return res.status(416).end();
    }
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

    if (start >= totalSize || end >= totalSize || start > end) {
      res.setHeader('Content-Range', `bytes */${totalSize}`);
      return res.status(416).end();
    }

    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    res.setHeader('Content-Length', chunkSize);
    return fs.createReadStream(filePath, { start, end }).pipe(res);
  }

  res.status(200);
  res.setHeader('Content-Length', totalSize);
  return fs.createReadStream(filePath).pipe(res);
}

// ============================================================================
// ZERO-STORAGE LIVE REMOTE STREAM, M3U8 HLS PROXY & DIRECT IDM/CHROME DOWNLOADER
// Supports BOTH inline <video>/Hls.js playback AND HTTP 206 multi-connection
// attachment streaming straight into Windows PC `IDMan.exe` or Google Chrome!
// ============================================================================
export async function proxyRemoteMediaStream(req, res, { asAttachment = false } = {}) {
  const targetUrl = String(req.query.url || '').trim();
  const parsed = await assertSafeOutboundUrl(targetUrl, { performDnsCheck: true });
  const customReferer = String(req.query.referer || '').trim();
  const requestedFilename = String(
    req.query.filename || req.params?.fileHint || ''
  ).trim();

  const upstreamHeaders = {
    'User-Agent': selectOptimalUpstreamUserAgent(parsed.toString()),
    Accept: '*/*',
  };

  if (customReferer && !parsed.hostname.includes('googlevideo.com')) {
    upstreamHeaders.Referer = customReferer;
  }
  if (req.headers.range) {
    upstreamHeaders.Range = req.headers.range;
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  let upstream;
  try {
    upstream = await fetch(parsed.toString(), {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    throw new AppError(502, 'UPSTREAM_ERROR', `Upstream stream unreachable: ${err.message}`);
  }

  const upstreamType = upstream.headers.get('content-type') || '';
  const requestedExt = String(requestedFilename || '').split('.').pop().toLowerCase();
  const isGenericType = !upstreamType || /application\/octet-stream|binary\/octet-stream/i.test(upstreamType);

  // Never save an HTML error/consent page as if it were the media file.
  if (asAttachment && /text\/html/i.test(upstreamType) && requestedExt && !/^(html?|php)$/.test(requestedExt)) {
    upstream.body?.cancel?.().catch?.(() => {});
    throw new AppError(
      502,
      'HOST_BLOCKED_DOWNLOAD',
      'The host returned a web page instead of the file. Open the original page in Chrome, or retry with the direct CDN link.'
    );
  }

  const contentType = isGenericType && requestedExt
    ? mimeForExtension(requestedExt)
    : upstreamType || 'video/mp4';

  if (!asAttachment && (contentType.includes('mpegurl') || parsed.pathname.endsWith('.m3u8'))) {
    const manifestText = await upstream.text();
    const rewritten = manifestText
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const resolvedSeg = new URL(trimmed, parsed.toString()).toString();
        return `/api/v1/stream/proxy?url=${encodeURIComponent(resolvedSeg)}`;
      })
      .join('\n');

    res.status(200);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(rewritten);
  }

  res.status(upstream.status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (asAttachment || requestedFilename) {
    const fallbackExt = mimeForExtension(requestedExt).split('/')[1]?.split(';')[0] || 'mp4';
    applyContentDispositionHeader(
      res,
      requestedFilename ||
        `UltraDownloader_Download.${/^[a-z0-9]{2,5}$/i.test(fallbackExt) ? fallbackExt : 'mp4'}`
    );
  }

  const contentLength = upstream.headers.get('content-length');
  if (contentLength) res.setHeader('Content-Length', contentLength);

  const contentRange = upstream.headers.get('content-range');
  if (contentRange) res.setHeader('Content-Range', contentRange);

  if (req.method === 'HEAD' || !upstream.body) {
    return res.end();
  }

  await pipeline(Readable.fromWeb(upstream.body), res).catch(() => {});
}

// ============================================================================
// INSTANT HTTP 200 / 206 ATTACHMENT STREAM FOR WINDOWS PC IDM & GOOGLE CHROME
// ============================================================================
export async function streamDirectDownloadPassThrough(req, res) {
  return proxyRemoteMediaStream(req, res, { asAttachment: true });
}

// ============================================================================
// UNIVERSAL HLS (.m3u8) -> SINGLE PLAYABLE FILE DOWNLOADER (.ts / .mp4)
// Works for any streaming-only platform: master + media playlists are parsed,
// the highest-quality variant is selected and every segment is concatenated
// into ONE attachment file streamed straight to Chrome / PC IDM.
// ============================================================================
async function fetchTextWithUa(targetUrl, extraHeaders = {}) {
  const res = await fetch(targetUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': selectOptimalUpstreamUserAgent(targetUrl),
      Accept: '*/*',
      ...extraHeaders,
    },
  });
  if (!res.ok) throw new AppError(502, 'UPSTREAM_ERROR', `Upstream HTTP ${res.status}`);
  return { text: await res.text(), finalUrl: res.url || targetUrl };
}

function parseAttributeList(line) {
  const attrs = {};
  const body = line.slice(line.indexOf(':') + 1);
  body.split(',').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    attrs[pair.slice(0, idx).trim()] = pair
      .slice(idx + 1)
      .trim()
      .replace(/^"|"$/g, '');
  });
  return attrs;
}

function pickHighestBandwidthVariant(manifestText, baseUrl) {
  const lines = manifestText.split(/\r?\n/);
  let best = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXT-X-STREAM-INF')) continue;
    const attrs = parseAttributeList(line);
    const bandwidth = Number(attrs.BANDWIDTH || attrs['AVERAGE-BANDWIDTH'] || 0);
    const nextLine = (lines[i + 1] || '').trim();
    if (!nextLine || nextLine.startsWith('#')) continue;
    if (!best || bandwidth > best.bandwidth) {
      best = { bandwidth, url: new URL(nextLine, baseUrl).toString() };
    }
  }
  return best;
}

export async function streamHlsDownloadAsFile(req, res) {
  return writeHlsAsSingleFile(req, res, {
    url: req.query.url,
    referer: req.query.referer,
    fileName: req.query.filename || req.params?.fileHint,
  });
}

// Core HLS joiner, reusable from ANY download path (ticket, IDM, admin vault,
// universal engine) so an .m3u8 link always becomes ONE playable file.
export async function writeHlsAsSingleFile(req, res, { url, referer: rawReferer, fileName: rawName } = {}) {
  const targetUrl = String(url || '').trim();
  const parsedTarget = await assertSafeOutboundUrl(targetUrl, { performDnsCheck: true });
  const referer = String(rawReferer || '').trim();
  const requested =
    String(rawName || 'UltraDownloader_Video.ts')
      .replace(/[^\p{L}\p{N}\s_.-]/gu, '')
      .trim() || 'UltraDownloader_Video.ts';
  const fileName = /\.(ts|mp4)$/i.test(requested) ? requested : `${requested}.ts`;

  const extraHeaders = referer && /^https?:\/\//i.test(referer) ? { Referer: referer } : {};

  // HEAD probe (used by the browser before starting a download) must answer
  // instantly: joining every segment just to throw the bytes away made the
  // verifier time out and show "server could not prepare this download".
  if (String(req?.method || 'GET').toUpperCase() === 'HEAD') {
    // Peek at the first playlist only (tiny + cached by the CDN) so the probe
    // reports the SAME container the real download will produce.
    let fmp4 = /mp4/i.test(fileName);
    try {
      const peek = await fetch(parsedTarget.toString(), {
        redirect: 'follow',
        headers: {
          'User-Agent': selectOptimalUpstreamUserAgent(parsedTarget.toString()),
          Accept: '*/*',
          ...extraHeaders,
        },
        signal: AbortSignal.timeout(2500),
      });
      if (peek.ok) {
        const text = await peek.text();
        const variantUrl = text
          .split(/\r?\n/)
          .find((line, idx, arr) => arr[idx - 1]?.startsWith('#EXT-X-STREAM-INF') && !line.startsWith('#'));
        if (variantUrl) {
          const variant = await fetch(new URL(variantUrl.trim(), peek.url || parsedTarget.toString()).toString(), {
            headers: { 'User-Agent': selectOptimalUpstreamUserAgent(parsedTarget.toString()), Accept: '*/*', ...extraHeaders },
            signal: AbortSignal.timeout(2500),
          });
          if (variant.ok) fmp4 = (await variant.text()).includes('#EXT-X-MAP');
        } else {
          fmp4 = text.includes('#EXT-X-MAP');
        }
      }
    } catch {
      /* keep the filename-based guess */
    }

    const outName = fmp4
      ? fileName.replace(/\.(ts|m3u8|mpd)$/i, '.mp4')
      : fileName.replace(/\.(m3u8|mpd)$/i, '.ts');
    res.status(200);
    res.setHeader('Content-Type', fmp4 ? 'video/mp4' : 'video/mp2t');
    res.setHeader('Accept-Ranges', 'none');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    applyContentDispositionHeader(res, outName);
    return res.end();
  }

  const first = await fetchTextWithUa(parsedTarget.toString(), extraHeaders);
  let mediaManifest = first.text;
  let mediaBase = first.finalUrl;

  if (mediaManifest.includes('#EXT-X-STREAM-INF')) {
    const variant = pickHighestBandwidthVariant(mediaManifest, mediaBase);
    if (!variant) throw new AppError(422, 'STREAM_UNAVAILABLE', 'No playable HLS variant found.');
    const variantRes = await fetchTextWithUa(variant.url, extraHeaders);
    mediaManifest = variantRes.text;
    mediaBase = variantRes.finalUrl;
  }

  const lines = mediaManifest.split(/\r?\n/);
  const segments = [];
  let initSegment = '';
  let isFmp4 = false;
  let currentKey = null; // AES-128 key descriptor, rotates with #EXT-X-KEY
  let mediaSequence = 0;

  // Media sequence number (needed to derive the per-segment IV when absent)
  const seqMatch = /#EXT-X-MEDIA-SEQUENCE:\s*(\d+)/i.exec(mediaManifest);
  if (seqMatch) mediaSequence = Number(seqMatch[1]) || 0;

  const keyCache = new Map();
  const loadAesKey = async (uri) => {
    if (keyCache.has(uri)) return keyCache.get(uri);
    const res = await fetch(uri, {
      redirect: 'follow',
      headers: { 'User-Agent': selectOptimalUpstreamUserAgent(uri), Accept: '*/*' },
    });
    if (!res.ok) {
      throw new AppError(422, 'STREAM_UNAVAILABLE', 'The stream key could not be fetched.');
    }
    const buf = Buffer.from(await res.arrayBuffer());
    keyCache.set(uri, buf);
    return buf;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-MAP')) {
      const attrs = parseAttributeList(line);
      if (attrs.URI) {
        initSegment = new URL(attrs.URI, mediaBase).toString();
        isFmp4 = true;
      }
      continue;
    }
    if (line.startsWith('#EXT-X-KEY')) {
      const attrs = parseAttributeList(line);
      const method = String(attrs.METHOD || '').toUpperCase();
      if (!method || method === 'NONE') {
        currentKey = null;
      } else if (method === 'AES-128') {
        // Broadcast HLS encryption: key is public in the playlist, so segments
        // are decryptable -> real downloadable file.
        currentKey = {
          method,
          url: new URL(attrs.URI, mediaBase).toString(),
          iv: attrs.IV ? Buffer.from(String(attrs.IV).replace(/^0x/i, ''), 'hex') : null,
        };
      } else {
        // SAMPLE-AES / SAMPLE-AES-CTR == FairPlay/DRM: genuinely not downloadable
        throw new AppError(
          422,
          'DRM_PROTECTED',
          'This HLS stream uses sample-level DRM encryption and cannot be downloaded.'
        );
      }
      continue;
    }
    if (line.startsWith('#')) continue;
    segments.push({
      url: new URL(line, mediaBase).toString(),
      key: currentKey,
      sequence: mediaSequence + segments.length,
    });
  }

  if (segments.length === 0) {
    throw new AppError(422, 'STREAM_UNAVAILABLE', 'This HLS playlist contains no media segments.');
  }

  res.status(200);
  res.setHeader('Content-Type', isFmp4 ? 'video/mp4' : 'video/mp2t');
  res.setHeader('Accept-Ranges', 'none');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  applyContentDispositionHeader(res, isFmp4 ? fileName.replace(/\.ts$/i, '.mp4') : fileName);

  let clientGone = false;
  if (typeof req?.on === 'function') {
    req.on('close', () => {
      clientGone = true;
    });
  }

  const writeChunk = async (segmentOrUrl) => {
    if (clientGone) return false;
    const chunkUrl = typeof segmentOrUrl === 'string' ? segmentOrUrl : segmentOrUrl.url;
    const key = typeof segmentOrUrl === 'string' ? null : segmentOrUrl.key;
    let upstream;
    try {
      upstream = await fetch(chunkUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': selectOptimalUpstreamUserAgent(chunkUrl), Accept: '*/*' },
      });
    } catch {
      return true;
    }
    if (!upstream.ok || !upstream.body) return true;
    let buffer = Buffer.from(await upstream.arrayBuffer());

    if (key && key.method === 'AES-128') {
      try {
        const keyBytes = await loadAesKey(key.url);
        const iv =
          key.iv && key.iv.length === 16
            ? key.iv
            : (() => {
                const buf = Buffer.alloc(16);
                buf.writeUInt32BE(segmentOrUrl.sequence >>> 0, 12);
                return buf;
              })();
        const decipher = crypto.createDecipheriv('aes-128-cbc', keyBytes.slice(0, 16), iv);
        buffer = Buffer.concat([decipher.update(buffer), decipher.final()]);
      } catch {
        return true; // skip an undecryptable chunk instead of breaking the file
      }
    }

    if (!res.write(buffer)) {
      await new Promise((resolve) => res.once('drain', resolve));
    }
    return true;
  };

  try {
    if (initSegment) await writeChunk(initSegment);
    for (const segment of segments) {
      if (clientGone) break;
      await writeChunk(segment);
    }
  } finally {
    res.end();
  }
}

// ============================================================================
// PURE NODE.JS LIVE PREVIEW RESOLVER (ZERO `yt-dlp.exe` DEPENDENCY!)
// ============================================================================
export async function pipeLivePureJsPreview(req, res) {
  const targetUrl = String(req.query.url || '').trim();
  await assertSafeOutboundUrl(targetUrl, { performDnsCheck: true });

  const { analyzeMediaUrl } = await import('./extractorEngine.js');
  const analysis = await analyzeMediaUrl({ rawUrl: targetUrl });
  const directPreview =
    analysis?.media?.previewPlayer?.streamUrl ||
    analysis?.streams?.videoAudio?.[0]?.streamUrl ||
    '';

  if (!directPreview || directPreview.includes('/stream/live-pipe')) {
    throw new AppError(422, 'STREAM_UNAVAILABLE', 'Unable to resolve preview stream.');
  }

  return res.redirect(302, directPreview);
}

// ============================================================================
// REAL SUBTITLE STREAM FETCHER (.VTT / .SRT)
// ============================================================================
export async function proxySubtitleDownload(req, res) {
  const targetUrl = String(req.query.url || '').trim();
  const lang = String(req.query.lang || 'en').replace(/[^a-zA-Z0-9_-]/g, '');
  const parsed = await assertSafeOutboundUrl(targetUrl, { performDnsCheck: true });

  const upstream = await fetch(parsed.toString());
  if (!upstream.ok) {
    throw new AppError(502, 'UPSTREAM_ERROR', 'Unable to fetch subtitle track from source.');
  }
  const text = await upstream.text();
  res.status(200);
  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="subtitles.${lang}.vtt"`);
  res.send(text);
}

// ============================================================================
// HLS PLAYBACK PROXY  (browser <video> cannot play MPEG-TS, and CDNs block
// cross-origin segment requests)
//   /stream/hls-play?url=<master.m3u8>   -> rewritten playlist (same origin)
//   /stream/hls-play/seg?url=<segment|key> -> raw bytes passthrough
// hls.js on the page then plays ANY platform stream, even locked embeds.
// ============================================================================
function rewritePlaylist(text, baseUrl, referer) {
  const ref = referer ? `&ref=${encodeURIComponent(referer)}` : '';
  const segmentUrl = (raw) =>
    `/api/v1/stream/hls-play/seg?url=${encodeURIComponent(new URL(raw, baseUrl).toString())}${ref}`;

  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#EXT-X-KEY') || trimmed.startsWith('#EXT-X-MAP')) {
        return trimmed.replace(/URI="([^"]+)"/, (_m, uri) => `URI="${segmentUrl(uri)}"`);
      }
      if (trimmed.startsWith('#EXT-X-MEDIA') && /URI="([^"]+)"/.test(trimmed)) {
        return trimmed.replace(/URI="([^"]+)"/, (_m, uri) => `URI="${segmentUrl(uri)}"`);
      }
      if (trimmed.startsWith('#')) return line;
      return segmentUrl(trimmed);
    })
    .join('\n');
}

export async function proxyHlsPlayback(req, res) {
  const targetUrl = String(req.query.url || '').trim();
  const referer = String(req.query.ref || '').trim();
  const parsedTarget = await assertSafeOutboundUrl(targetUrl, { performDnsCheck: true });

  const extraHeaders = referer && /^https?:\/\//i.test(referer) ? { Referer: referer } : {};
  const upstream = await fetch(parsedTarget.toString(), {
    redirect: 'follow',
    headers: {
      'User-Agent': selectOptimalUpstreamUserAgent(parsedTarget.toString()),
      Accept: '*/*',
      ...extraHeaders,
    },
  });

  if (!upstream.ok) {
    res.status(502).json({ success: false, error: { code: 'UPSTREAM_ERROR', message: `Upstream HTTP ${upstream.status}` } });
    return;
  }

  const body = await upstream.text();
  const finalUrl = upstream.url || parsedTarget.toString();

  res.status(200);
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.send(rewritePlaylist(body, finalUrl, referer));
}

export async function proxyHlsSubResource(req, res) {
  const targetUrl = String(req.query.url || '').trim();
  const referer = String(req.query.ref || '').trim();
  const parsedTarget = await assertSafeOutboundUrl(targetUrl, { performDnsCheck: true });

  const extraHeaders = referer && /^https?:\/\//i.test(referer) ? { Referer: referer } : {};
  const controller = new AbortController();
  if (typeof req.on === 'function') req.on('close', () => controller.abort());

  const upstream = await fetch(parsedTarget.toString(), {
    redirect: 'follow',
    headers: {
      'User-Agent': selectOptimalUpstreamUserAgent(parsedTarget.toString()),
      Accept: '*/*',
      ...extraHeaders,
    },
    signal: controller.signal,
  });

  if (!upstream.ok || !upstream.body) {
    res.status(502).end();
    return;
  }

  const upstreamType = String(upstream.headers.get('content-type') || '').toLowerCase();
  const looksPlaylist =
    /mpegurl|x-mpegURL/i.test(upstreamType) || /\.m3u8/i.test(parsedTarget.pathname);

  // A variant/subtitle playlist requested through the segment endpoint must be
  // rewritten as well, otherwise hls.js resolves its child URLs against our
  // own /seg path and playback dies with a black screen.
  if (looksPlaylist) {
    const text = await upstream.text();
    res.status(200);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.send(rewritePlaylist(text, upstream.url || parsedTarget.toString(), referer));
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', upstreamType || 'application/octet-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  Readable.fromWeb(upstream.body).on('error', () => res.end()).pipe(res);
}
