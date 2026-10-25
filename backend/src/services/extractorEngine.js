import { v4 as uuidv4 } from 'uuid';
import { Innertube, UniversalCache, Log } from 'youtubei.js';
import yts from 'yt-search';

Log.setLevel(Log.Level.NONE);
import { sqlQuery } from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { assertSafeOutboundUrl, normalizeCommonMirrorTypos } from '../security/antiSsrfGuard.js';
import { decryptVaultSecret } from '../security/cryptoVault.js';
import { PLATFORM_DEFINITIONS, detectPlatformFromUrl } from '../data/platformDefinitions.js';
import { isTeraboxEcosystemUrl, analyzeTeraboxShareLink } from './teraboxEngine.js';
import { sniffEmbeddedStreamFromWebPage } from './deepPageSniffer.js';
import { tryExtendedEmbedExtractors } from './extendedEmbedExtractors.js';
import { tryUniversalPlatformResolvers } from './universalPlatformResolvers.js';
import {
  ANY_FILE_EXT_PATTERN,
  MEDIA_URL_EXT_PATTERN,
  VIDEO_VIDEO_EXTENSIONS as VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  SUBTITLE_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  extensionOfFileName,
  mimeForExtension,
} from '../data/mediaFormats.js';

const ANY_EXT_URL_RE = new RegExp(`\\.(?:${ANY_FILE_EXT_PATTERN})(?:[?#].*)?$`, 'i');

function isAnyAcceptedExtensionUrl(url) {
  try {
    const candidate = new URL(String(url)).pathname;
    return ANY_EXT_URL_RE.test(candidate) || ANY_EXT_URL_RE.test(String(url));
  } catch {
    return ANY_EXT_URL_RE.test(String(url));
  }
}
import {
  CHROME_DESKTOP_UA,
  YT_ANDROID_UA,
  YT_IOS_UA,
  getWindowsIdmStatus,
} from './idmTurboDownloader.js';
import { cachedOrCoalesced, runtimeEnginePreferences } from './trafficEngine.js';

// ============================================================================
// ULTRA-FAST PURE NODE.JS MULTI-PLATFORM STREAM & IDM DIRECT LINK ENGINE
// 100% Zero `yt-dlp.exe` · Zero `.exe` Postinstall Hangs · Direct HTTP 206!
// ============================================================================

let cachedScClientId = { id: '', expiresAt: 0 };

function extractBalancedJson(source, startIndex) {
  let depth = 0;
  let inStr = false;
  let escaped = false;
  const openChar = source[startIndex];
  const closeChar = openChar === '[' ? ']' : '}';
  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return source.slice(startIndex, i + 1);
    }
  }
  return '';
}

// ============================================================================
// PARALLEL, PRIORITY-AWARE TIER RACE  (V10.0 speed core)
// All extractor tiers start at the same time; the highest-priority tier that
// answers wins. A short grace window lets a better tier finish instead of
// returning a lower-quality result from a faster one. This turns a 4-tier
// sequential chain (2–10s) into one parallel round trip (~0.4–1.5s).
// ============================================================================
function racePriorityTiers(tasks, { graceMs = 220, timeoutMs = 18000 } = {}) {
  return new Promise((resolve) => {
    const results = new Array(tasks.length).fill(undefined);
    let done = false;
    let graceTimer = null;

    const finish = (value) => {
      if (done) return;
      done = true;
      if (graceTimer) clearTimeout(graceTimer);
      resolve(value || null);
    };

    const evaluate = () => {
      if (done) return;
      let pendingHigher = false;
      for (let i = 0; i < results.length; i += 1) {
        if (results[i] === undefined) {
          pendingHigher = true; // a better tier is still thinking
          break;
        }
        if (results[i]) {
          finish(results[i]); // best settled success in priority order
          return;
        }
      }

      const settledAll = results.every((r) => r !== undefined);
      if (settledAll) {
        finish(null);
        return;
      }

      // Nothing usable yet. If a lower-priority tier already succeeded,
      // give the better ones a brief chance, then take what we have.
      if (pendingHigher && results.some(Boolean) && !graceTimer) {
        graceTimer = setTimeout(() => finish(results.find(Boolean) || null), graceMs);
      }
    };

    tasks.forEach((task, idx) => {
      Promise.resolve()
        .then(() => task.run())
        .catch(() => null)
        .then((value) => {
          results[idx] = value || null;
          evaluate();
        });
    });

    setTimeout(() => finish(results.find(Boolean) || null), timeoutMs);
  });
}

const KNOWN_DRM_STREAMING_HOSTS = [
  'netflix.com',
  'disneyplus.com',
  'primevideo.com',
  'hulu.com',
  'max.com',
  'hbomax.com',
  'tv.apple.com',
  'open.spotify.com',
  'peacocktv.com',
  'paramountplus.com',
  'crunchyroll.com',
  'zee5.com',
  'sonyliv.com',
  'hotstar.com',
  'jiohotstar.com',
  'jiocinema.com',
  'iq.com',
  'iqiyi.com',
  'viki.com',
  'mubi.com',
];

let cachedVisitorSession = { visitorData: '', expiresAt: 0, inflight: null };

async function getYoutubeVisitorData() {
  if (cachedVisitorSession.visitorData && Date.now() < cachedVisitorSession.expiresAt) {
    return cachedVisitorSession.visitorData;
  }
  if (cachedVisitorSession.inflight) {
    return cachedVisitorSession.inflight;
  }
  cachedVisitorSession.inflight = (async () => {
    try {
      const yt = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
      });
      const token = yt.session?.context?.client?.visitorData || '';
      cachedVisitorSession = {
        visitorData: token,
        expiresAt: Date.now() + 25 * 60 * 1000,
        inflight: null,
      };
      return token;
    } catch {
      cachedVisitorSession.inflight = null;
      return '';
    }
  })();
  return cachedVisitorSession.inflight;
}

export async function getMediaBinariesStatus() {
  const winIdm = getWindowsIdmStatus();
  return {
    pureIdmDirectMode: true,
    ytdlpRemoved: true,
    ytdlpInstalled: false,
    ytdlpVersion: 'Removed — Pure Node.js Direct IDM/Chrome Engine',
    ffmpegInstalled: false,
    ffmpegBinaryPath: null,
    ffprobeBinaryPath: null,
    engineMode: 'Pure Node.js Direct IDM/Chrome 32x Stream Engine',
    windowsIdmDetected: winIdm.detected,
    windowsIdmPath: winIdm.binaryPath,
    teraboxFreeEngineReady: true,
    idmParallelThreads: runtimeEnginePreferences.idmConnections || 32,
  };
}

export async function getActivePlatformsFromDb() {
  return cachedOrCoalesced('sql:active_platforms_v10', 15000, async () => {
    const rows = await sqlQuery('SELECT * FROM platforms');
    if (!rows.length) {
      return PLATFORM_DEFINITIONS.map((p, idx) => ({ ...p, isEnabled: true, sortOrder: idx + 1 }));
    }

    const dbById = new Map(rows.map((r) => [r.id, r]));
    const extraMetaById = new Map(PLATFORM_DEFINITIONS.map((p) => [p.id, p]));

    const combined = PLATFORM_DEFINITIONS.map((def, idx) => {
      const r = dbById.get(def.id);
      if (!r) return { ...def, isEnabled: true, sortOrder: idx + 1 };
      return {
        ...def,
        id: r.id,
        displayName: r.display_name || def.displayName,
        subtitle: r.subtitle || def.subtitle,
        category: r.category || def.category,
        accentColor: r.accent_color || def.accentColor,
        iconKey: r.icon_key || def.iconKey,
        iconSvg: r.icon_svg || def.iconSvg,
        domains: (() => {
          try {
            const parsed = JSON.parse(r.domains_json || '[]');
            return parsed.length >= def.domains.length ? parsed : def.domains;
          } catch {
            return def.domains;
          }
        })(),
        exampleUrl: r.example_url || def.exampleUrl,
        seoSlug: r.seo_slug || def.seoSlug,
        isAdult: Boolean(r.is_adult ?? def.isAdult),
        isEnabled: Boolean(r.is_enabled),
        supportsSearch: Boolean(r.supports_search ?? def.supportsSearch),
        sortOrder: idx + 1,
      };
    });

    for (const r of rows) {
      if (!extraMetaById.has(r.id)) {
        combined.push({
          id: r.id,
          displayName: r.display_name,
          subtitle: r.subtitle,
          category: r.category,
          accentColor: r.accent_color,
          iconKey: r.icon_key,
          iconSvg: r.icon_svg || '',
          domains: JSON.parse(r.domains_json || '[]'),
          exampleUrl: r.example_url || '',
          seoSlug: r.seo_slug,
          isAdult: Boolean(r.is_adult),
          isEnabled: Boolean(r.is_enabled),
          supportsSearch: Boolean(r.supports_search),
          sortOrder: 999,
          regionNote: 'Custom',
          authHint: 'free_direct',
        });
      }
    }

    return combined;
  });
}

export function formatDurationSeconds(sec) {
  const s = Math.max(0, Math.round(Number(sec || 0)));
  if (!s) return 'Live Stream';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

function classifyResolutionTier(width, height, formatNote = '') {
  const h = Number(height || 0);
  const w = Number(width || 0);
  const maxDim = Math.max(w, h);
  if (h >= 4000 || maxDim >= 7600) return { key: '8k', title: '8K Ultra HD', sub: '4320p', rank: 8 };
  if (h >= 2000 || maxDim >= 3800) return { key: '4k', title: '4K Ultra HD', sub: '2160p', rank: 7 };
  if (h >= 1350 || maxDim >= 2500) return { key: '2k', title: '2K QHD', sub: '1440p', rank: 6 };
  if (h >= 960 || maxDim >= 1900) return { key: '1080p', title: '1080p Full HD', sub: 'FHD', rank: 5 };
  if (h >= 680 || maxDim >= 1200) return { key: '720p', title: '720p HD', sub: 'HD', rank: 4 };
  if (h >= 440) return { key: '480p', title: '480p Standard', sub: 'SD', rank: 3 };
  if (h >= 320) return { key: '360p', title: '360p Medium', sub: 'Fast', rank: 2 };
  return { key: '240p', title: formatNote || '240p Data Saver', sub: 'Low Data', rank: 1 };
}

function buildSafeDownloadFileName(rawTitle, qualitySuffix = 'HD', ext = 'mp4') {
  const cleanBase =
    String(rawTitle || 'Video')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'Video';
  const cleanQual = String(qualitySuffix || 'HD').replace(/[^a-zA-Z0-9_-]/g, '');
  return `${cleanBase}_${cleanQual}.${ext}`;
}

export function wrapDirectPassThroughUrl(directMediaUrl, fileName, referer = '') {
  return `/api/v1/stream/direct-download?url=${encodeURIComponent(
    directMediaUrl
  )}&filename=${encodeURIComponent(fileName)}${
    referer ? `&referer=${encodeURIComponent(referer)}` : ''
  }`;
}

export async function prepareCookieFileIfAvailable(platformId = '', ephemeralCookiesTxt = '') {
  let cookieContent = String(ephemeralCookiesTxt || '').trim();
  if (!cookieContent && platformId) {
    const stored = await sqlQuery(
      'SELECT iv_hex, auth_tag_hex, ciphertext_hex FROM encrypted_cookies WHERE platform_id = ? ORDER BY updated_at DESC LIMIT 1',
      [platformId]
    ).catch(() => []);
    if (stored[0]) {
      try {
        cookieContent = decryptVaultSecret(stored[0]);
      } catch {
        cookieContent = '';
      }
    }
  }
  return cookieContent;
}

export function normalizeExtractorTarget(rawUrl) {
  let cleaned = normalizeCommonMirrorTypos(String(rawUrl || '').trim());
  try {
    const parsed = new URL(cleaned);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('youtu.be')) {
      const vid = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (vid) return `https://www.youtube.com/watch?v=${vid}`;
    }
    if (host.includes('youtube.com')) {
      const shortsMatch = /\/shorts\/([a-zA-Z0-9_-]{8,15})/.exec(parsed.pathname);
      if (shortsMatch) return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
      const embedMatch = /\/embed\/([a-zA-Z0-9_-]{8,15})/.exec(parsed.pathname);
      if (embedMatch) return `https://www.youtube.com/watch?v=${embedMatch[1]}`;
    }
  } catch {
    // pass through
  }
  return cleaned;
}

export function extractYoutubeVideoId(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const h = u.hostname.toLowerCase();
    if (h.includes('youtu.be')) {
      return u.pathname.replace(/^\//, '').split('/')[0] || '';
    }
    if (h.includes('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = /\/(shorts|embed|live|v)\/([a-zA-Z0-9_-]{8,15})/.exec(u.pathname);
      if (m) return m[2];
    }
  } catch {
    // ignore
  }
  return '';
}

// ============================================================================
// 1. LIVE VIDEO & MUSIC KEYWORD SEARCH (PURE JS `yt-search` — ~600ms!)
// ============================================================================
export async function searchLiveVideos(input, modeArg = 'video', limitArg = 12) {
  const isObj = input && typeof input === 'object';
  const cleanQuery = String(isObj ? input.query || input.q || '' : input || '').trim();
  const mode = String(isObj ? input.mode || 'video' : modeArg || 'video');
  const sort = String(isObj ? input.sort || 'relevance' : 'relevance');
  const limit = Number(isObj ? input.limit || 12 : limitArg || 12);

  if (!cleanQuery) {
    return { items: [], page: 1, hasMore: false };
  }

  const cacheKey = `search:v10:${mode}:${sort}:${limit}:${cleanQuery.toLowerCase()}`;
  return cachedOrCoalesced(cacheKey, 90000, async () => {
    const effectiveQuery = mode === 'music' ? `${cleanQuery} official audio` : cleanQuery;
    const result = await yts(effectiveQuery);
    let videos = Array.isArray(result?.videos) ? [...result.videos] : [];

    if (sort === 'views') {
      videos.sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
    } else if (sort === 'duration_desc') {
      videos.sort((a, b) => Number(b.seconds || 0) - Number(a.seconds || 0));
    }
    videos = videos.slice(0, limit);

    const items = videos.map((v) => ({
      id: v.videoId || uuidv4().slice(0, 8),
      title: v.title || cleanQuery,
      url: v.url || `https://www.youtube.com/watch?v=${v.videoId}`,
      durationSeconds: Number(v.seconds || 0),
      durationText: v.timestamp || formatDurationSeconds(v.seconds || 0),
      uploader: v.author?.name || 'Verified Creator',
      channelName: v.author?.name || 'Verified Creator',
      viewCount: Number(v.views || 0),
      viewCountText: v.views ? `${Number(v.views).toLocaleString()} views` : 'Live Verified',
      thumbnailUrl: v.thumbnail || v.image || '',
      platformId: mode === 'music' ? 'ytmusic' : 'youtube',
      platformName: mode === 'music' ? 'YouTube Music' : 'YouTube',
    }));

    return {
      items,
      page: 1,
      hasMore: (result?.videos?.length || 0) > limit,
    };
  });
}

// ============================================================================
// 2. DIRECT MEDIA URL INSPECTOR (.mp4 / .mkv / .webm / .m3u8 / .mp3 / .m4a)
// ============================================================================
async function inspectDirectMediaUrl(url, platform, fallbackTitle = '', fallbackThumb = '') {
  let contentLength = 0;
  let contentType = 'video/mp4';
  try {
    const headRes = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': CHROME_DESKTOP_UA, Range: 'bytes=0-1' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    contentType = headRes.headers.get('content-type') || 'video/mp4';
    const cr = headRes.headers.get('content-range') || '';
    if (cr.includes('/')) {
      contentLength = Number(cr.split('/')[1]) || 0;
    } else {
      contentLength = Number(headRes.headers.get('content-length') || 0);
    }
    headRes.body?.cancel?.();
  } catch {
    // non-blocking metadata probe
  }

  const parsedPath = new URL(url).pathname;
  // Keep the REAL extension of the file (.mkv /.flac /.tiff /.zip /.srt ...) so
  // IDM & Chrome save it correctly instead of forcing everything to .mp4.
  const urlExt = extensionOfFileName(parsedPath) || '';
  const rawName = decodeURIComponent(parsedPath.split('/').pop() || 'Direct_Media_Stream')
    .replace(new RegExp(`\\.(?:${ANY_FILE_EXT_PATTERN})$`, 'i'), '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const title = fallbackTitle || rawName || 'Direct High-Speed Media Stream';
  const isHls =
    /\.(?:m3u8|mpd)(\?|$)/i.test(url) || contentType.includes('mpegurl') || contentType.includes('dash');
  const isAudio =
    AUDIO_EXTENSIONS.includes(urlExt) || (contentType.startsWith('audio/') && !VIDEO_EXTENSIONS.includes(urlExt));
  const isImage = IMAGE_EXTENSIONS.includes(urlExt) || contentType.startsWith('image/');
  const isSubtitle = SUBTITLE_EXTENSIONS.includes(urlExt) || contentType.startsWith('text/vtt');
  const isArchive = ARCHIVE_EXTENSIONS.includes(urlExt) && !isImage;
  const isVideo = VIDEO_EXTENSIONS.includes(urlExt) || (!isAudio && !isImage && !isSubtitle && contentType.startsWith('video/'));

  const ext = urlExt || (isHls ? (/\.mpd(\?|$)/i.test(url) ? 'mpd' : 'm3u8') : isAudio ? 'mp3' : isImage ? 'jpg' : 'mp4');
  const kindLabel = isHls
    ? 'Streaming Playlist'
    : isAudio
      ? 'Audio'
      : isImage
        ? 'Image'
        : isSubtitle
          ? 'Subtitle'
          : isArchive
            ? 'File'
            : 'Video';

  const passUrl = wrapDirectPassThroughUrl(
    url,
    buildSafeDownloadFileName(title, 'Direct_Original', ext),
    url
  );
  const proxyUrl = `/api/v1/stream/proxy?url=${encodeURIComponent(url)}`;

  return {
    extractorTier: 'Direct IDM / Chrome HTTP 206 Stream Engine',
    platform,
    canonicalUrl: url,
    media: {
      id: `direct-${uuidv4().slice(0, 8)}`,
      title,
      uploader: new URL(url).hostname,
      durationSeconds: 0,
      durationText: isHls ? 'Live HLS Stream' : 'Direct Media',
      viewCount: null,
      viewCountText: contentLength
        ? `${(contentLength / 1048576).toFixed(1)} MB Direct CDN`
        : 'Direct CDN Ready',
      thumbnailUrl: fallbackThumb || '',
      maxResolutionLabel: isHls
        ? 'HLS / DASH Stream'
        : isAudio
          ? 'Original Audio'
          : isImage
            ? 'Original Image'
            : `Original ${ext.toUpperCase()}`,
      estimatedBestSizeBytes: contentLength || null,
      isAdult: Boolean(platform?.isAdult),
      previewPlayer: {
        mode: isHls ? 'hls_proxy' : 'direct_range_proxy',
        streamUrl: proxyUrl,
      },
    },
    streams: {
      videoAudio: isAudio || isImage || isSubtitle || isArchive
        ? []
        : [
            {
              formatId: 'direct-original-hd',
              formatSelector: 'direct_http_stream',
              label: 'Original Full Quality — Direct PC IDM / Chrome Download',
              qualityKey: `original_${ext}`,
              qualityTitle: `Original ${ext.toUpperCase()}${isVideo ? '' : ` (${kindLabel})`}`,
              qualitySub: `${kindLabel} · IDM / Chrome Direct`,
              height: isVideo ? 1080 : null,
              fps: null,
              formatExt: ext,
              mimeType: mimeForExtension(ext),
              hasAudio: isAudio || (!isImage && !isSubtitle && !isArchive && !isVideo),
              hasVideo: isVideo || isHls,
              requiresMux: false,
              badge: 'Direct IDM / Chrome',
              sizeBytes: contentLength || null,
              directCdnUrl: url,
              streamUrl: passUrl,
            },
          ],
      videoOnly: [],
      audioOnly: [
        {
          formatId: 'direct-audio-stream',
          formatSelector: 'direct_http_audio',
          label: 'Direct Audio Track — PC IDM / Chrome Download',
          qualityKey: `original_${ext}`,
          qualityTitle: `Original ${ext.toUpperCase()}`,
          qualitySub: isAudio ? 'Native Audio' : `${kindLabel} · Direct Stream`,
          height: null,
          fps: null,
          formatExt: ext,
          mimeType: mimeForExtension(ext),
          hasAudio: isAudio,
          hasVideo: isVideo,
          badge: 'Direct Audio',
          sizeBytes: contentLength || null,
          directCdnUrl: url,
          streamUrl: passUrl,
        },
      ],
      subtitles: [],
    },
    folderItems: [],
  };
}

// ============================================================================
// 3. PURE NODE.JS YOUTUBE & SHORTS DIRECT INNERTUBE RESOLVER (~250ms!)
// Returns real unencrypted googlevideo.com HTTP 206 URLs for PC IDM & Chrome!
// ============================================================================
async function extractYoutubeDirectStreams(videoId, canonicalUrl, platform) {
  // Speed: never let the Innertube visitor-data handshake block the player call.
  // It keeps warming in the background; the ANDROID/IOS clients answer fine
  // without it, so we only wait 600ms on a cold start.
  const visitorData =
    (await Promise.race([
      getYoutubeVisitorData().catch(() => ''),
      new Promise((resolve) => setTimeout(() => resolve(''), 600)),
    ])) || '';

  const clients = [
    {
      name: 'ANDROID',
      ua: YT_ANDROID_UA,
      id: '3',
      body: {
        clientName: 'ANDROID',
        clientVersion: '20.10.38',
        androidSdkVersion: 34,
        osName: 'Android',
        osVersion: '14',
        visitorData,
        hl: 'en',
        gl: 'US',
      },
    },
    {
      name: 'IOS',
      ua: YT_IOS_UA,
      id: '5',
      body: {
        clientName: 'IOS',
        clientVersion: '20.10.4',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        osName: 'iPhone',
        osVersion: '18.3.2.22D82',
        visitorData,
        hl: 'en',
        gl: 'US',
      },
    },
  ];

  const responses = await Promise.all(
    clients.map((c) =>
      fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': c.ua,
          'X-YouTube-Client-Name': c.id,
          'X-YouTube-Client-Version': c.body.clientVersion,
          ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
        },
        body: JSON.stringify({
          videoId,
          context: { client: c.body },
          contentCheckOk: true,
          racyCheckOk: true,
        }),
        signal: AbortSignal.timeout(12000),
      })
        .then((r) => r.json())
        .catch(() => null)
    )
  );

  const okPayloads = responses.filter(
    (p) =>
      p?.playabilityStatus?.status === 'OK' &&
      (p?.streamingData?.formats?.length || p?.streamingData?.adaptiveFormats?.length)
  );

  if (!okPayloads.length) {
    const reason =
      responses.find((p) => p?.playabilityStatus?.reason)?.playabilityStatus?.reason ||
      'Unable to extract YouTube direct streams.';
    throw new AppError(422, 'EXTRACTION_FAILED', reason);
  }

  const primary = okPayloads[0];
  const details = primary.videoDetails || {};
  const title = details.title || 'YouTube Video';
  const durationSec = Number(details.lengthSeconds || 0);
  const viewCount = details.viewCount ? Number(details.viewCount) : null;
  const thumbs = details.thumbnail?.thumbnails || [];
  const bestThumb =
    thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

  const combinedFormats = [];
  const adaptiveFormats = [];
  let hlsManifestUrl = '';

  for (const payload of okPayloads) {
    if (!hlsManifestUrl && payload.streamingData?.hlsManifestUrl) {
      hlsManifestUrl = payload.streamingData.hlsManifestUrl;
    }
    for (const f of payload.streamingData?.formats || []) {
      if (f.url) combinedFormats.push(f);
    }
    for (const f of payload.streamingData?.adaptiveFormats || []) {
      if (f.url) adaptiveFormats.push(f);
    }
  }

  const videoAudio = [];
  const seenVa = new Set();

  // 1) Combined Progressive Video + Audio MP4 (100% single file with sound for Chrome & PC IDM!)
  for (const f of combinedFormats.sort((a, b) => Number(b.height || 0) - Number(a.height || 0))) {
    const tier = classifyResolutionTier(f.width, f.height, f.qualityLabel);
    if (seenVa.has(tier.key)) continue;
    seenVa.add(tier.key);
    const bytes = Number(f.contentLength || 0) || Math.round(((Number(f.bitrate || 650000)) / 8) * durationSec) || null;
    const dlName = buildSafeDownloadFileName(title, `${tier.key}_VideoAudio`, 'mp4');
    videoAudio.push({
      formatId: `yt-va-${f.itag}`,
      formatSelector: `itag_${f.itag}`,
      label: `${tier.title} — Direct Combined MP4 (Video + Audio)`,
      qualityKey: tier.key,
      qualityTitle: `${tier.title} (With Sound)`,
      qualitySub: '1-Click IDM / Chrome MP4',
      height: f.height || 360,
      fps: f.fps || 30,
      formatExt: 'mp4',
      hasAudio: true,
      hasVideo: true,
      requiresMux: false,
      badge: 'Video + Sound MP4',
      sizeBytes: bytes,
      directCdnUrl: f.url,
      streamUrl: wrapDirectPassThroughUrl(f.url, dlName),
    });
  }

  // 2) High-Resolution 4K / 2K / 1080p / 720p / 480p Direct Streams (HTTP 206 multi-thread ready!)
  const videoOnly = [];
  const seenHeight = new Set();
  const sortedAdaptiveVideos = adaptiveFormats
    .filter((f) => String(f.mimeType || '').startsWith('video/'))
    .sort((a, b) => {
      const hDiff = Number(b.height || 0) - Number(a.height || 0);
      if (hDiff !== 0) return hDiff;
      const aMp4 = String(a.mimeType).includes('mp4') ? 1 : 0;
      const bMp4 = String(b.mimeType).includes('mp4') ? 1 : 0;
      if (bMp4 !== aMp4) return bMp4 - aMp4;
      return Number(b.bitrate || 0) - Number(a.bitrate || 0);
    });

  for (const f of sortedAdaptiveVideos) {
    const h = Number(f.height || 0);
    if (!h) continue;
    const tier = classifyResolutionTier(f.width, f.height, f.qualityLabel);
    const ext = String(f.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
    const bytes = Number(f.contentLength || 0) || null;

    if (!seenVa.has(tier.key)) {
      seenVa.add(tier.key);
      const dlName = buildSafeDownloadFileName(title, tier.key, ext);
      videoAudio.push({
        formatId: `yt-hd-${f.itag}`,
        formatSelector: `itag_${f.itag}`,
        label: `${tier.title} (${f.qualityLabel || `${h}p`}) — Direct ${ext.toUpperCase()} Stream`,
        qualityKey: tier.key,
        qualityTitle: tier.title,
        qualitySub: `${ext.toUpperCase()} · IDM 32x Direct`,
        height: h,
        fps: f.fps || 30,
        formatExt: ext,
        hasAudio: false,
        hasVideo: true,
        requiresMux: false,
        badge: h >= 1080 ? 'Ultra HD Direct' : 'Direct IDM / Chrome',
        sizeBytes: bytes,
        directCdnUrl: f.url,
        streamUrl: wrapDirectPassThroughUrl(f.url, dlName),
      });
    }

    const voKey = `${h}-${ext}`;
    if (!seenHeight.has(voKey)) {
      seenHeight.add(voKey);
      const dlName = buildSafeDownloadFileName(title, `${h}p_Stream`, ext);
      videoOnly.push({
        formatId: `yt-vo-${f.itag}`,
        formatSelector: `itag_${f.itag}`,
        label: `${h}p ${f.fps && f.fps > 30 ? `${f.fps}fps ` : ''}Direct ${ext.toUpperCase()}`,
        qualityKey: `${h}p`,
        qualityTitle: `${h}p`,
        qualitySub: ext.toUpperCase(),
        height: h,
        fps: f.fps || 30,
        formatExt: ext,
        hasAudio: false,
        hasVideo: true,
        badge: 'Direct CDN',
        sizeBytes: bytes,
        directCdnUrl: f.url,
        streamUrl: wrapDirectPassThroughUrl(f.url, dlName),
      });
    }
  }

  videoAudio.sort((a, b) => {
    // Prioritize combined Video+Audio streams first so default click ALWAYS has full sound!
    if (Boolean(a.hasAudio) !== Boolean(b.hasAudio)) {
      return a.hasAudio ? -1 : 1;
    }
    return Number(b.height || 0) - Number(a.height || 0);
  });

  // 3) High-Bitrate Direct Audio Only Tracks (M4A / WebM)
  const audioOnly = [];
  const audioFormats = adaptiveFormats
    .filter((f) => String(f.mimeType || '').startsWith('audio/'))
    .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0));

  for (const af of audioFormats.slice(0, 3)) {
    const isM4a = String(af.mimeType || '').includes('mp4');
    const ext = isM4a ? 'm4a' : 'webm';
    const kbps = Math.max(64, Math.round(Number(af.bitrate || 128000) / 1000));
    const dlName = buildSafeDownloadFileName(title, `${kbps}kbps_Audio`, ext);
    audioOnly.push({
      formatId: `yt-ao-${af.itag}`,
      formatSelector: `itag_${af.itag}`,
      label: `Audio Only — ${kbps}kbps ${ext.toUpperCase()} Direct Stream`,
      qualityKey: `audio_${af.itag}`,
      qualityTitle: `${kbps}kbps`,
      qualitySub: `Direct ${ext.toUpperCase()}`,
      height: null,
      fps: null,
      formatExt: ext,
      hasAudio: true,
      hasVideo: false,
      badge: `${kbps}kbps Audio`,
      sizeBytes: Number(af.contentLength || 0) || null,
      directCdnUrl: af.url,
      streamUrl: wrapDirectPassThroughUrl(af.url, dlName),
    });
  }

  // 4) Subtitles / Captions
  const captionTracks =
    primary.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const subtitles = captionTracks.slice(0, 12).map((c) => {
    const vttUrl = c.baseUrl.includes('fmt=') ? c.baseUrl : `${c.baseUrl}&fmt=vtt`;
    const lang = c.languageCode || 'en';
    const name = c.name?.simpleText || c.name?.runs?.[0]?.text || lang.toUpperCase();
    return {
      lang,
      label: `${name} (VTT)`,
      ext: 'vtt',
      downloadUrl: `/api/v1/stream/subtitle?lang=${encodeURIComponent(lang)}&url=${encodeURIComponent(
        vttUrl
      )}`,
    };
  });

  const bestPreviewSource = combinedFormats[0]?.url || hlsManifestUrl || sortedAdaptiveVideos[0]?.url;
  const previewMode = combinedFormats[0]?.url
    ? 'direct_range_proxy'
    : hlsManifestUrl
    ? 'hls_proxy'
    : 'direct_range_proxy';

  return {
    extractorTier: 'Pure Node.js Direct IDM / Chrome 32x Stream Engine',
    platform,
    canonicalUrl,
    media: {
      id: videoId,
      title,
      uploader: details.author || 'YouTube Channel',
      durationSeconds: durationSec,
      durationText: formatDurationSeconds(durationSec),
      viewCount,
      viewCountText: viewCount ? `${viewCount.toLocaleString()} views` : 'Live Verified',
      thumbnailUrl: bestThumb,
      maxResolutionLabel: videoAudio[0]?.qualityTitle || 'HD MP4',
      estimatedBestSizeBytes: videoAudio[0]?.sizeBytes || null,
      isAdult: false,
      previewPlayer: {
        mode: previewMode,
        streamUrl: `/api/v1/stream/proxy?url=${encodeURIComponent(bestPreviewSource)}`,
      },
    },
    streams: {
      videoAudio,
      videoOnly,
      audioOnly,
      subtitles,
    },
    folderItems: [],
  };
}

// ============================================================================
// 4. DEDICATED PURE-JS SOCIAL & FEDERATED API EXTRACTORS
// Covers PeerTube, TikTok (No-Watermark HD), Twitter/X, Reddit, Vimeo, Dailymotion!
// ============================================================================
// ============================================================================
// DAILYMOTION (player metadata API) — works for dailymotion.com & dai.ly links
// ============================================================================
async function tryDailymotionExtractor(healedUrl, platform) {
  let parsed;
  try {
    parsed = new URL(healedUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (!/dailymotion\.com|dai\.ly$/.test(host)) return null;

  let videoId = '';
  // New format: /video/<id> · Embed: /embed/video/<id> · Old: /video/<slug>/<id>
  const newFormat = /\/(?:video|embed\/video|hub)\/([a-zA-Z0-9]{6,})(?:[/?#]|$)/.exec(parsed.pathname);
  const oldFormat = /\/(?:video|embed\/video|hub)\/[^/]+\/([a-zA-Z0-9]{6,})(?:[/?#]|$)/.exec(parsed.pathname);
  if (oldFormat) videoId = oldFormat[1];
  else if (newFormat) videoId = newFormat[1];
  if (/^dai\.ly$/.test(host)) videoId = parsed.pathname.replace(/\//g, '');
  if (!videoId) return null;

  const metaRes = await fetch(`https://www.dailymotion.com/player/metadata/video/${videoId}`, {
    headers: { 'User-Agent': CHROME_DESKTOP_UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  if (!metaRes?.ok) return null;

  const meta = await metaRes.json().catch(() => null);
  if (!meta) return null;

  const auto = Array.isArray(meta.qualities?.auto) ? meta.qualities.auto : [];
  const mp4s = auto.filter((q) => /mp4/i.test(String(q.type || '')) && /^https?:/i.test(String(q.url || '')));
  const hls = auto.find((q) => /mpegurl/i.test(String(q.type || '')) && /^https?:/i.test(String(q.url || '')));

  if (mp4s.length === 0 && !hls?.url) return null;

  const title = String(meta.title || 'Dailymotion Video').trim();
  const thumbnailUrl = String(meta.thumbnail_url || '').trim();
  const durationText = meta.duration ? `${Math.floor(meta.duration / 60)}m ${meta.duration % 60}s` : 'Video';

  const sources = mp4s.length > 0 ? mp4s : [hls];
  const videoAudio = sources.map((item, index) => {
    const isHls = /mpegurl/i.test(String(item.type || ''));
    const qualityLabel = String(item.quality || (isHls ? 'Auto HLS' : index === 0 ? 'HD' : `${index + 1}`)).toUpperCase();
    return {
      formatId: `dm-${qualityLabel}-${index}`,
      formatSelector: 'direct_idm_stream',
      qualityKey: qualityLabel,
      qualityTitle: `${qualityLabel} (Dailymotion)`,
      qualitySub: isHls ? 'HLS Stream' : 'Progressive MP4',
      formatExt: isHls ? 'ts' : 'mp4',
      hasVideo: true,
      hasAudio: true,
      requiresMux: false,
      sizeBytes: 0,
      directCdnUrl: item.url,
      streamUrl: isHls
        ? `/api/v1/stream/hls-download/Dailymotion_Stream.ts?url=${encodeURIComponent(item.url)}`
        : `/api/v1/stream/direct-download/Dailymotion_Video.mp4?url=${encodeURIComponent(item.url)}`,
    };
  });

  return {
    platform,
    canonicalUrl: `https://www.dailymotion.com/video/${videoId}`,
    extractorTier: 'dailymotion_metadata',
    media: {
      title,
      thumbnailUrl,
      durationText,
      maxResolutionLabel: 'HD',
      estimatedBestSizeBytes: 0,
      isAdult: false,
      subtitles: [],
      previewPlayer: {
        mode: videoAudio[0].formatExt === 'ts' ? 'hls_proxy' : 'direct_range_proxy',
        streamUrl: videoAudio[0].streamUrl,
      },
      streams: { videoWithAudio: videoAudio, videoOnly: [], audioOnly: [] },
    },
    streams: { videoAudio, videoOnly: [], audioOnly: [] },
  };
}

async function tryDedicatedSocialApiExtractors(healedUrl, platform) {
  const parsed = new URL(healedUrl);
  const host = parsed.hostname.toLowerCase();

  // A) PeerTube Open REST API (`/videos/watch/<uuid>` or `/w/<uuid>`)
  const peerMatch = /\/(?:videos\/watch|w)\/([a-zA-Z0-9-]{8,40})/.exec(parsed.pathname);
  if (peerMatch) {
    const vid = peerMatch[1];
    const apiRes = await fetch(`${parsed.origin}/api/v1/videos/${vid}`, {
      headers: { 'User-Agent': CHROME_DESKTOP_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (apiRes?.ok) {
      const meta = await apiRes.json();
      const rawFiles = [
        ...(Array.isArray(meta.files) ? meta.files : []),
        ...(Array.isArray(meta.streamingPlaylists?.[0]?.files)
          ? meta.streamingPlaylists[0].files
          : []),
      ];
      if (rawFiles.length > 0) {
        const title = meta.name || 'PeerTube Video';
        const videoAudio = rawFiles
          .sort((a, b) => Number(b.resolution?.id || 0) - Number(a.resolution?.id || 0))
          .map((f, i) => {
            const h = Number(f.resolution?.id || 720);
            const tier = classifyResolutionTier(0, h, f.resolution?.label);
            const dlUrl = f.fileDownloadUrl || f.fileUrl;
            const dlName = buildSafeDownloadFileName(title, `${h}p`, 'mp4');
            return {
              formatId: `pt-${h}-${i}`,
              formatSelector: `peertube_${h}p`,
              label: `${tier.title} — Direct MP4 (Video + Audio)`,
              qualityKey: tier.key,
              qualityTitle: tier.title,
              qualitySub: 'IDM 32x / Chrome Direct',
              height: h,
              fps: f.fps || 30,
              formatExt: 'mp4',
              hasAudio: true,
              hasVideo: true,
              requiresMux: false,
              badge: 'Direct MP4',
              sizeBytes: Number(f.size || 0) || null,
              directCdnUrl: dlUrl,
              streamUrl: wrapDirectPassThroughUrl(dlUrl, dlName, healedUrl),
            };
          });

        const capsRes = await fetch(`${parsed.origin}/api/v1/videos/${vid}/captions`, {
          headers: { 'User-Agent': CHROME_DESKTOP_UA },
          signal: AbortSignal.timeout(6000),
        }).catch(() => null);
        const capsJson = capsRes?.ok ? await capsRes.json().catch(() => ({ data: [] })) : { data: [] };
        const subtitles = (capsJson.data || []).map((c) => {
          const absSub = new URL(c.captionPath, parsed.origin).toString();
          return {
            lang: c.language?.id || 'en',
            label: `${c.language?.label || 'Subtitle'} (VTT)`,
            ext: 'vtt',
            downloadUrl: `/api/v1/stream/subtitle?lang=${encodeURIComponent(
              c.language?.id || 'en'
            )}&url=${encodeURIComponent(absSub)}`,
          };
        });

        const previewRaw = videoAudio[0].directCdnUrl;
        const thumbUrl = meta.previewPath
          ? new URL(meta.previewPath, parsed.origin).toString()
          : '';

        return {
          extractorTier: 'Pure Node.js PeerTube Direct CDN Engine',
          platform,
          canonicalUrl: healedUrl,
          media: {
            id: String(meta.shortUUID || meta.uuid || vid),
            title,
            uploader: meta.account?.displayName || meta.channel?.displayName || parsed.hostname,
            durationSeconds: Number(meta.duration || 0),
            durationText: formatDurationSeconds(meta.duration || 0),
            viewCount: Number(meta.views || 0),
            viewCountText: `${Number(meta.views || 0).toLocaleString()} views`,
            thumbnailUrl: thumbUrl,
            maxResolutionLabel: videoAudio[0]?.qualityTitle || 'HD MP4',
            estimatedBestSizeBytes: videoAudio[0]?.sizeBytes || null,
            isAdult: Boolean(meta.nsfw || platform?.isAdult),
            previewPlayer: {
              mode: 'direct_range_proxy',
              streamUrl: `/api/v1/stream/proxy?url=${encodeURIComponent(previewRaw)}`,
            },
          },
          streams: {
            videoAudio,
            videoOnly: [],
            audioOnly: [
              {
                formatId: 'pt-audio-track',
                formatSelector: 'peertube_audio',
                label: 'Fast Audio Stream — Direct PC IDM / Chrome',
                qualityKey: 'audio_mp3_320',
                qualityTitle: 'Audio Track',
                qualitySub: 'Direct Stream',
                height: null,
                fps: null,
                formatExt: 'mp4',
                hasAudio: true,
                hasVideo: true,
                badge: 'Direct Stream',
                sizeBytes: videoAudio[videoAudio.length - 1]?.sizeBytes || null,
                directCdnUrl: videoAudio[videoAudio.length - 1]?.directCdnUrl,
                streamUrl: videoAudio[videoAudio.length - 1]?.streamUrl,
              },
            ],
            subtitles,
          },
          folderItems: [],
        };
      }
    }
  }

  // B) TikTok No-Watermark HD API
  if (host.includes('tiktok.com')) {
    const tkRes = await fetch(
      `https://www.tikwm.com/api/?hd=1&url=${encodeURIComponent(healedUrl)}`,
      {
        headers: { 'User-Agent': CHROME_DESKTOP_UA },
        signal: AbortSignal.timeout(12000),
      }
    ).catch(() => null);
    const tkJson = tkRes?.ok ? await tkRes.json().catch(() => null) : null;
    if (tkJson?.code === 0 && tkJson?.data) {
      const d = tkJson.data;
      const title = d.title || `TikTok_${d.id}`;
      const hdUrl = d.hdplay || d.play;
      const sdUrl = d.play || hdUrl;
      const mp3Url = d.music;
      const videoAudio = [
        {
          formatId: 'tk-hd-nowm',
          formatSelector: 'tiktok_hd_nowm',
          label: 'Full HD 1080p — No Watermark Direct MP4',
          qualityKey: '1080p',
          qualityTitle: '1080p No-WM',
          qualitySub: 'IDM / Chrome Direct MP4',
          height: 1080,
          fps: 30,
          formatExt: 'mp4',
          hasAudio: true,
          hasVideo: true,
          requiresMux: false,
          badge: 'No Watermark HD',
          sizeBytes: Number(d.hd_size || d.size || 0) || null,
          directCdnUrl: hdUrl,
          streamUrl: wrapDirectPassThroughUrl(
            hdUrl,
            buildSafeDownloadFileName(title, '1080p_NoWM', 'mp4'),
            'https://www.tikwm.com/'
          ),
        },
        {
          formatId: 'tk-sd-nowm',
          formatSelector: 'tiktok_sd_nowm',
          label: 'Standard 720p — Fast No Watermark MP4',
          qualityKey: '720p',
          qualityTitle: '720p Fast',
          qualitySub: 'No Watermark MP4',
          height: 720,
          fps: 30,
          formatExt: 'mp4',
          hasAudio: true,
          hasVideo: true,
          requiresMux: false,
          badge: 'Fast MP4',
          sizeBytes: Number(d.size || 0) || null,
          directCdnUrl: sdUrl,
          streamUrl: wrapDirectPassThroughUrl(
            sdUrl,
            buildSafeDownloadFileName(title, '720p_NoWM', 'mp4'),
            'https://www.tikwm.com/'
          ),
        },
      ];

      const audioOnly = mp3Url
        ? [
            {
              formatId: 'tk-mp3-orig',
              formatSelector: 'tiktok_music_mp3',
              label: 'Original TikTok Sound — Direct MP3 Audio',
              qualityKey: 'audio_mp3_320',
              qualityTitle: 'Original MP3',
              qualitySub: 'Direct Audio',
              height: null,
              fps: null,
              formatExt: 'mp3',
              hasAudio: true,
              hasVideo: false,
              badge: 'Direct MP3',
              sizeBytes: null,
              directCdnUrl: mp3Url,
              streamUrl: wrapDirectPassThroughUrl(
                mp3Url,
                buildSafeDownloadFileName(title, 'Audio', 'mp3'),
                'https://www.tikwm.com/'
              ),
            },
          ]
        : [];

      return {
        extractorTier: 'Pure Node.js TikTok No-Watermark HD Engine',
        platform,
        canonicalUrl: healedUrl,
        media: {
          id: String(d.id || uuidv4().slice(0, 8)),
          title,
          uploader: d.author?.nickname || d.author?.unique_id || 'TikTok Creator',
          durationSeconds: Number(d.duration || 0),
          durationText: formatDurationSeconds(d.duration || 0),
          viewCount: Number(d.play_count || 0),
          viewCountText: `${Number(d.play_count || 0).toLocaleString()} plays`,
          thumbnailUrl: d.origin_cover || d.cover || '',
          maxResolutionLabel: '1080p No-WM',
          estimatedBestSizeBytes: videoAudio[0].sizeBytes,
          isAdult: false,
          previewPlayer: {
            mode: 'direct_range_proxy',
            streamUrl: `/api/v1/stream/proxy?url=${encodeURIComponent(sdUrl)}`,
          },
        },
        streams: { videoAudio, videoOnly: [], audioOnly, subtitles: [] },
        folderItems: [],
      };
    }
  }

  // C) Twitter / X Direct MP4 API (`api.vxtwitter.com`)
  if (host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')) {
    const vxUrl = `https://api.vxtwitter.com${parsed.pathname}`;
    const vxRes = await fetch(vxUrl, {
      headers: { 'User-Agent': CHROME_DESKTOP_UA },
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    const vxJson = vxRes?.ok ? await vxRes.json().catch(() => null) : null;
    const vidMedia = (vxJson?.media_extended || []).find((m) => m.type === 'video' || m.type === 'gif');
    if (vidMedia?.url) {
      const title = (vxJson.text || 'X_Twitter_Video').slice(0, 80);
      const passUrl = wrapDirectPassThroughUrl(
        vidMedia.url,
        buildSafeDownloadFileName(title, 'HD', 'mp4'),
        healedUrl
      );
      return {
        extractorTier: 'Pure Node.js X/Twitter Direct MP4 Engine',
        platform,
        canonicalUrl: healedUrl,
        media: {
          id: vxJson.tweetID || uuidv4().slice(0, 8),
          title,
          uploader: vxJson.user_name || 'X Creator',
          durationSeconds: Math.round(Number(vidMedia.duration_millis || 0) / 1000),
          durationText: formatDurationSeconds(Number(vidMedia.duration_millis || 0) / 1000),
          viewCount: Number(vxJson.likes || 0),
          viewCountText: `${Number(vxJson.likes || 0).toLocaleString()} likes`,
          thumbnailUrl: vidMedia.thumbnail_url || '',
          maxResolutionLabel: 'HD MP4',
          estimatedBestSizeBytes: null,
          isAdult: false,
          previewPlayer: {
            mode: 'direct_range_proxy',
            streamUrl: `/api/v1/stream/proxy?url=${encodeURIComponent(vidMedia.url)}`,
          },
        },
        streams: {
          videoAudio: [
            {
              formatId: 'tw-hd-mp4',
              formatSelector: 'twitter_hd_mp4',
              label: 'Original HD MP4 — Direct PC IDM / Chrome Download',
              qualityKey: '1080p',
              qualityTitle: 'HD MP4',
              qualitySub: 'IDM / Chrome Direct',
              height: vidMedia.size?.height || 720,
              fps: 30,
              formatExt: 'mp4',
              hasAudio: true,
              hasVideo: true,
              requiresMux: false,
              badge: 'Direct MP4',
              sizeBytes: null,
              directCdnUrl: vidMedia.url,
              streamUrl: passUrl,
            },
          ],
          videoOnly: [],
          audioOnly: [],
          subtitles: [],
        },
        folderItems: [],
      };
    }
  }

  // D) Reddit Direct `v.redd.it` MP4 JSON API
  if (host.includes('reddit.com')) {
    const jsonEndpoint = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}.json`;
    const rdRes = await fetch(jsonEndpoint, {
      headers: { 'User-Agent': CHROME_DESKTOP_UA },
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    const rdJson = rdRes?.ok ? await rdRes.json().catch(() => null) : null;
    const post = rdJson?.[0]?.data?.children?.[0]?.data;
    const rv = post?.secure_media?.reddit_video || post?.media?.reddit_video;
    if (rv?.fallback_url) {
      const title = post.title || 'Reddit Video';
      const passUrl = wrapDirectPassThroughUrl(
        rv.fallback_url,
        buildSafeDownloadFileName(title, `${rv.height || 720}p`, 'mp4'),
        healedUrl
      );
      return {
        extractorTier: 'Pure Node.js Reddit Direct MP4 Engine',
        platform,
        canonicalUrl: healedUrl,
        media: {
          id: post.id || uuidv4().slice(0, 8),
          title,
          uploader: `r/${post.subreddit || 'reddit'}`,
          durationSeconds: Number(rv.duration || 0),
          durationText: formatDurationSeconds(rv.duration || 0),
          viewCount: Number(post.ups || 0),
          viewCountText: `${Number(post.ups || 0).toLocaleString()} upvotes`,
          thumbnailUrl: post.thumbnail?.startsWith('http') ? post.thumbnail : '',
          maxResolutionLabel: `${rv.height || 720}p HD`,
          estimatedBestSizeBytes: null,
          isAdult: Boolean(post.over_18),
          previewPlayer: {
            mode: 'direct_range_proxy',
            streamUrl: `/api/v1/stream/proxy?url=${encodeURIComponent(rv.fallback_url)}`,
          },
        },
        streams: {
          videoAudio: [
            {
              formatId: 'rd-hd-mp4',
              formatSelector: 'reddit_hd_mp4',
              label: `${rv.height || 720}p HD — Direct PC IDM / Chrome Download`,
              qualityKey: '720p',
              qualityTitle: `${rv.height || 720}p MP4`,
              qualitySub: 'IDM / Chrome Direct',
              height: rv.height || 720,
              fps: 30,
              formatExt: 'mp4',
              hasAudio: true,
              hasVideo: true,
              requiresMux: false,
              badge: 'Direct MP4',
              sizeBytes: null,
              directCdnUrl: rv.fallback_url,
              streamUrl: passUrl,
            },
          ],
          videoOnly: [],
          audioOnly: [],
          subtitles: [],
        },
        folderItems: [],
      };
    }
  }

  // E) Vimeo Player Config API (`player.vimeo.com/video/<id>`)
  if (host.includes('vimeo.com')) {
    const vmMatch = /\/(?:video\/)?(\d{5,15})/.exec(parsed.pathname);
    if (vmMatch) {
      const vid = vmMatch[1];
      const vRes = await fetch(`https://player.vimeo.com/video/${vid}`, {
        headers: { 'User-Agent': CHROME_DESKTOP_UA, Referer: healedUrl },
        signal: AbortSignal.timeout(12000),
      }).catch(() => null);
      const vHtml = vRes?.ok ? await vRes.text() : '';
      const markerIdx = vHtml.indexOf('window.playerConfig');
      if (markerIdx !== -1) {
        const braceIdx = vHtml.indexOf('{', markerIdx);
        const rawJson = braceIdx !== -1 ? extractBalancedJson(vHtml, braceIdx) : '';
        const cfg = rawJson ? JSON.parse(rawJson) : null;
        if (cfg?.video) {
          const title = cfg.video.title || `Vimeo_${vid}`;
          const durationSec = Number(cfg.video.duration || 0);
          const progressive = cfg.request?.files?.progressive || [];
          const hlsCdns = cfg.request?.files?.hls?.cdns || {};
          const firstCdn = Object.values(hlsCdns)[0] || {};
          const hlsUrl = firstCdn.avc_url || firstCdn.url || '';
          const streamSpecs =
            progressive.length > 0
              ? progressive.map((p) => ({
                  h: Number(p.height || 720),
                  fps: p.fps || 24,
                  url: p.url,
                  isHls: false,
                }))
              : (cfg.request?.files?.dash?.streams || [
                  { quality: '720p', fps: 24 },
                  { quality: '360p', fps: 24 },
                ]).map((s) => ({
                  h: parseInt(s.quality, 10) || 720,
                  fps: s.fps || 24,
                  url: hlsUrl,
                  isHls: true,
                }));

          const videoAudio = streamSpecs
            .sort((a, b) => b.h - a.h)
            .map((s, idx) => {
              const tier = classifyResolutionTier(0, s.h, `${s.h}p`);
              const dlName = buildSafeDownloadFileName(title, `${s.h}p`, 'mp4');
              return {
                formatId: `vm-${s.h}-${idx}`,
                formatSelector: `vimeo_${s.h}p`,
                label: `${tier.title} — Direct Stream (Video + Audio)`,
                qualityKey: tier.key,
                qualityTitle: tier.title,
                qualitySub: s.isHls ? 'HLS Stream' : 'Direct MP4',
                height: s.h,
                fps: s.fps,
                formatExt: 'mp4',
                hasAudio: true,
                hasVideo: true,
                requiresMux: false,
                badge: 'Vimeo HD',
                sizeBytes: null,
                directCdnUrl: s.url,
                streamUrl: s.isHls
                  ? `/api/v1/stream/proxy?url=${encodeURIComponent(s.url)}`
                  : wrapDirectPassThroughUrl(s.url, dlName, healedUrl),
              };
            });

          const subtitles = (cfg.request?.text_tracks || []).map((t) => {
            const absTrack = t.url.startsWith('http')
              ? t.url
              : `https://player.vimeo.com${t.url}`;
            return {
              lang: t.lang || 'en',
              label: `${t.label || t.lang || 'Subtitle'} (VTT)`,
              ext: 'vtt',
              downloadUrl: `/api/v1/stream/subtitle?lang=${encodeURIComponent(
                t.lang || 'en'
              )}&url=${encodeURIComponent(absTrack)}`,
            };
          });

          const bestPreview = progressive[0]?.url || hlsUrl;
          return {
            extractorTier: 'Pure Node.js Vimeo Player Stream Engine',
            platform,
            canonicalUrl: healedUrl,
            media: {
              id: String(cfg.video.id || vid),
              title,
              uploader: cfg.video.owner?.name || 'Vimeo Creator',
              durationSeconds: durationSec,
              durationText: formatDurationSeconds(durationSec),
              viewCount: null,
              viewCountText: 'Vimeo Verified',
              thumbnailUrl: cfg.video.thumbnail_url || '',
              maxResolutionLabel: videoAudio[0]?.qualityTitle || '720p HD',
              estimatedBestSizeBytes: null,
              isAdult: false,
              previewPlayer: {
                mode: progressive[0]?.url ? 'direct_range_proxy' : 'hls_proxy',
                streamUrl: `/api/v1/stream/proxy?url=${encodeURIComponent(bestPreview)}`,
              },
            },
            streams: {
              videoAudio,
              videoOnly: [],
              audioOnly: [
                {
                  formatId: 'vm-audio',
                  formatSelector: 'vimeo_audio',
                  label: 'Audio Track — Direct Stream',
                  qualityKey: 'audio_mp3_320',
                  qualityTitle: 'Audio Stream',
                  qualitySub: 'Direct Stream',
                  height: null,
                  fps: null,
                  formatExt: 'mp3',
                  hasAudio: true,
                  hasVideo: false,
                  badge: 'Audio',
                  sizeBytes: null,
                  directCdnUrl: bestPreview,
                  streamUrl: `/api/v1/stream/proxy?url=${encodeURIComponent(bestPreview)}`,
                },
              ],
              subtitles,
            },
            folderItems: [],
          };
        }
      }
    }
  }

  // F) SoundCloud Direct Progressive MP3 Stream Engine
  if (host.includes('soundcloud.com')) {
    const scRes = await fetch(healedUrl, {
      headers: { 'User-Agent': CHROME_DESKTOP_UA },
      signal: AbortSignal.timeout(12000),
    }).catch(() => null);
    const scHtml = scRes?.ok ? await scRes.text() : '';
    const hydIdx = scHtml.indexOf('window.__sc_hydration');
    if (hydIdx !== -1) {
      const arrIdx = scHtml.indexOf('[', hydIdx);
      const rawArr = arrIdx !== -1 ? extractBalancedJson(scHtml, arrIdx) : '';
      const hydrated = rawArr ? JSON.parse(rawArr) : [];
      const sound = hydrated.find((x) => x.hydratable === 'sound')?.data;
      if (sound?.media?.transcodings?.length) {
        if (!cachedScClientId.id || Date.now() > cachedScClientId.expiresAt) {
          const scripts = [
            ...scHtml.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g),
          ].map((m) => m[1]);
          for (const jsUrl of scripts.slice(-4)) {
            const jsTxt = await fetch(jsUrl)
              .then((r) => r.text())
              .catch(() => '');
            const cm = /client_id\s*:\s*"([a-zA-Z0-9]{28,38})"/.exec(jsTxt);
            if (cm?.[1]) {
              cachedScClientId = { id: cm[1], expiresAt: Date.now() + 60 * 60 * 1000 };
              break;
            }
          }
        }
        if (cachedScClientId.id) {
          const prog =
            sound.media.transcodings.find((t) => t.format?.protocol === 'progressive') ||
            sound.media.transcodings[0];
          const trRes = await fetch(
            `${prog.url}?client_id=${cachedScClientId.id}&track_authorization=${encodeURIComponent(
              sound.track_authorization || ''
            )}`,
            { headers: { 'User-Agent': CHROME_DESKTOP_UA } }
          ).catch(() => null);
          const trJson = trRes?.ok ? await trRes.json().catch(() => null) : null;
          if (trJson?.url) {
            const title = sound.title || 'SoundCloud Track';
            const durationSec = Math.round(Number(sound.duration || 0) / 1000);
            const passUrl = wrapDirectPassThroughUrl(
              trJson.url,
              buildSafeDownloadFileName(title, '320kbps', 'mp3'),
              healedUrl
            );
            return {
              extractorTier: 'Pure Node.js SoundCloud Direct MP3 Engine',
              platform,
              canonicalUrl: healedUrl,
              media: {
                id: String(sound.id || uuidv4().slice(0, 8)),
                title,
                uploader: sound.user?.username || 'SoundCloud Artist',
                durationSeconds: durationSec,
                durationText: formatDurationSeconds(durationSec),
                viewCount: Number(sound.playback_count || 0),
                viewCountText: `${Number(sound.playback_count || 0).toLocaleString()} plays`,
                thumbnailUrl: (sound.artwork_url || '').replace('-large', '-t500x500'),
                maxResolutionLabel: 'MP3 Direct Audio',
                estimatedBestSizeBytes: null,
                isAdult: false,
                previewPlayer: {
                  mode: 'direct_range_proxy',
                  streamUrl: `/api/v1/stream/proxy?url=${encodeURIComponent(trJson.url)}`,
                },
              },
              streams: {
                videoAudio: [],
                videoOnly: [],
                audioOnly: [
                  {
                    formatId: 'sc-mp3-direct',
                    formatSelector: 'soundcloud_mp3',
                    label: 'High Quality Direct MP3 — PC IDM / Chrome Download',
                    qualityKey: 'audio_mp3_320',
                    qualityTitle: 'MP3 Studio',
                    qualitySub: 'Direct MP3',
                    height: null,
                    fps: null,
                    formatExt: 'mp3',
                    hasAudio: true,
                    hasVideo: false,
                    badge: 'Direct MP3',
                    sizeBytes: null,
                    directCdnUrl: trJson.url,
                    streamUrl: passUrl,
                  },
                ],
                subtitles: [],
              },
              folderItems: [],
            };
          }
        }
      }
    }
  }

  return null;
}

// ============================================================================
// 5. MASTER UNIFIED MULTI-PLATFORM STREAM ANALYZER
// ============================================================================
export async function analyzeMediaUrl({
  rawUrl,
  selectedPlatformId = '',
  ephemeralCookiesTxt = '',
  _depth = 0,
}) {
  const healedInput = normalizeExtractorTarget(rawUrl);
  await assertSafeOutboundUrl(healedInput, { performDnsCheck: true });

  const hostLower = new URL(healedInput).hostname.toLowerCase();
  const isDrmServiceHost = KNOWN_DRM_STREAMING_HOSTS.some(
    (d) => hostLower === d || hostLower.endsWith(`.${d}`)
  );

  const allPlatforms = await getActivePlatformsFromDb();
  const detected =
    allPlatforms.find((p) => p.id === selectedPlatformId) ||
    detectPlatformFromUrl(healedInput, allPlatforms);
  const platform = detected || {
    id: 'universal_web',
    displayName: 'Direct Web Stream',
    category: 'video',
    isAdult: false,
  };

  const cacheKey =
    !ephemeralCookiesTxt && _depth === 0
      ? `analysis:v10:${platform.id}:${healedInput}`
      : null;

  const runCoreAnalysis = async () => {
    // 1. Direct Media Files (.mp4 / .mkv / .webm / .m3u8 / .mp3 / .m4a)
    if (isAnyAcceptedExtensionUrl(healedInput)) {
      return inspectDirectMediaUrl(healedInput, platform);
    }

    // 2. TeraBox + iTeraPlay + TeraViralHub + All 32 Cloud Mirrors
    if (isTeraboxEcosystemUrl(healedInput)) {
      const cookies = await prepareCookieFileIfAvailable('terabox', ephemeralCookiesTxt);
      const tbRes = await analyzeTeraboxShareLink({
        rawUrl: healedInput,
        platform,
        ephemeralCookiesTxt: cookies,
      });
      if (tbRes?.redirectToDirectUrl && _depth < 2) {
        return inspectDirectMediaUrl(tbRes.redirectToDirectUrl, platform);
      }
      return tbRes;
    }

    // 3. YouTube & YouTube Shorts Direct InnerTube HTTP 206 Engine
    const ytId = extractYoutubeVideoId(healedInput);
    if (ytId) {
      return extractYoutubeDirectStreams(ytId, healedInput, platform);
    }

    // 3b–4c. ALL generic tiers race in parallel (priority = list order):
    //   1) Dailymotion player-metadata API
    //   2) Dedicated social APIs (PeerTube / TikTok / X / Reddit / Vimeo / SoundCloud)
    //   3) Extended embed APIs (Reddit / OK.ru / BitChute / VK / Bilibili / Odysee)
    //   4) Universal resolvers (Bluesky · Instagram · Threads · Pinterest · Telegram ·
    //      Tumblr · Twitch · Kick · Rumble · Snapchat · LinkedIn · Mastodon · cloud
    //      embed hosts · page intelligence)
    const raced = await racePriorityTiers([
      { run: () => tryDailymotionExtractor(healedInput, platform) },
      { run: () => tryDedicatedSocialApiExtractors(healedInput, platform) },
      { run: () => tryExtendedEmbedExtractors(healedInput, platform) },
      {
        run: () =>
          tryUniversalPlatformResolvers(healedInput, platform, { depth: _depth }),
      },
    ]);

    if (raced) {
      return raced;
    }

    // 5. UNIVERSAL Deep HTML sniffer — works for ANY website (og:video, JSON-LD,
    //    <video>, data-* players, JW/Video.js/Plyr, escaped JS urls, iframes…)
    if (_depth < 4) {
      const sniffed = await sniffEmbeddedStreamFromWebPage(healedInput).catch(() => null);
      if (sniffed && sniffed.targetUrl) {
        if (sniffed.kind === 'direct_media') {
          return inspectDirectMediaUrl(
            sniffed.targetUrl,
            platform,
            sniffed.pageTitle,
            sniffed.pageThumb
          );
        }
        if (sniffed.targetUrl !== healedInput) {
          try {
            return await analyzeMediaUrl({
              rawUrl: sniffed.targetUrl,
              selectedPlatformId: '',
              ephemeralCookiesTxt,
              _depth: _depth + 1,
            });
          } catch {
            /* keep trying other tiers below */
          }
        }
      }
    }

    // 6. Embedded player page (YouTube/Vimeo/other host) discovered in the URL
    //    itself, e.g. ?url=, ?v=, /embed/<id>
    if (_depth < 4) {
      const nested = extractNestedMediaUrl(healedInput);
      if (nested && nested !== healedInput) {
        try {
          return await analyzeMediaUrl({
            rawUrl: nested,
            selectedPlatformId: '',
            ephemeralCookiesTxt,
            _depth: _depth + 1,
          });
        } catch {
          /* fall through to the honest error below */
        }
      }
    }

    // Paid streaming services: explain honestly instead of "not supported".
    if (isDrmServiceHost) {
      // ...but first make sure the site did not simply rate-limit / block us.
      const probeStatus = await (async () => {
        try {
          const r = await fetch(healedInput, {
            method: 'GET',
            redirect: 'follow',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(9000),
          });
          return r.status;
        } catch {
          return 0;
        }
      })();

      if (probeStatus === 429 || probeStatus === 403 || probeStatus >= 500) {
        throw new AppError(
          503,
          'UPSTREAM_RATE_LIMITED',
          `The site is temporarily blocking automated requests (HTTP ${probeStatus}). Wait a minute and paste the link again.`
        );
      }

      throw new AppError(
        422,
        'DRM_PROTECTED',
        'This title is DRM-protected (Widevine/FairPlay), so it cannot be downloaded — no downloader can do that legally. Trailers, previews and free-tier episodes (Tubi, Pluto TV, Plex, Peacock free) do work.'
      );
    }

    // Friendly, actionable message for a bare homepage / profile / feed link.
    const pathDepth = new URL(healedInput).pathname.split('/').filter(Boolean).length;
    const looksLikeHomepage =
      pathDepth === 0 ||
      /^\/(?:home|explore|feed|trending|discover|search|category|results)\/?$/i.test(
        new URL(healedInput).pathname
      );

    if (looksLikeHomepage) {
      throw new AppError(
        422,
        'PASTE_CONTENT_LINK',
        `This is a ${platform.displayName || 'website'} homepage. Open the actual video, reel, post or file page and paste THAT link — every single-video page is supported.`
      );
    }

    throw new AppError(
      422,
      'NO_MEDIA_ON_PAGE',
      'This page does not contain any video or audio file to download. Try the actual video post/share link (or a direct .mp4 / .m3u8 link).'
    );
  };

// Finds a nested media / embed URL inside a wrapper link
// (e.g. player.php?url=https://... , /embed/youtube/ID, ?v=ID).
function extractNestedMediaUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return '';
  }

  for (const key of ['url', 'u', 'src', 'video', 'file', 'link', 'target', 'media', 'v']) {
    const value = parsed.searchParams.get(key);
    if (!value) continue;
    const candidate = normalizeCommonMirrorTypos(String(value).trim());
    if (/^https?:\/\//i.test(candidate) && candidate !== rawUrl) return candidate;
  }

  const ytEmbed = /\/embed\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/.exec(parsed.pathname);
  if (ytEmbed) return `https://www.youtube.com/watch?v=${ytEmbed[1]}`;

  const vimeoEmbed = /\/video\/(\d{6,})(?:[/?#]|$)/.exec(parsed.pathname);
  if (vimeoEmbed) return `https://vimeo.com/${vimeoEmbed[1]}`;

  return '';
}

// ---------------------------------------------------------------------------
// Browser-playable preview URL. MPEG-TS / .m3u8 cannot play in <video>, so HLS
// always goes through the playlist-rewriting proxy (hls.js on the page).
// ---------------------------------------------------------------------------
function upstreamFromAnyProxyPath(value) {
  try {
    const parsed = new URL(String(value || ''), 'http://placeholder.local');
    const raw = parsed.searchParams.get('url') || '';
    return /^https?:\/\//i.test(raw) ? raw : '';
  } catch {
    return '';
  }
}

function buildPlayablePreview(rawResult) {
  if (!rawResult || !rawResult.media) return rawResult;
  const media = rawResult.media;
  const streams = rawResult.streams || {};
  const flat = [
    ...(streams.videoAudio || []),
    ...(streams.videoWithAudio || []),
    ...(streams.videoOnly || []),
  ];

  const hlsStream = flat.find((item) => {
    const url = String(item?.directCdnUrl || item?.streamUrl || '');
    return /\.m3u8(\?|$)/i.test(url) || /\.m3u8/i.test(item?.formatSelector || '');
  });

  const preview = media.previewPlayer || {};
  const previewUrl = String(preview.streamUrl || '');
  const looksHls =
    preview.mode === 'hls_proxy' ||
    /\.m3u8/i.test(previewUrl) ||
    (/\/stream\/hls-/.test(previewUrl) && Boolean(upstreamFromAnyProxyPath(previewUrl)));

  const hlsUpstream =
    (/^https?:\/\//i.test(previewUrl) && /\.m3u8/i.test(previewUrl) ? previewUrl : '') ||
    upstreamFromAnyProxyPath(previewUrl) ||
    String(hlsStream?.directCdnUrl || '');

  if (looksHls && /^https?:\/\//i.test(hlsUpstream)) {
    return {
      ...rawResult,
      media: {
        ...media,
        previewPlayer: {
          mode: 'hls_proxy',
          streamUrl: `/api/v1/stream/hls-play?url=${encodeURIComponent(hlsUpstream)}`,
          downloadUrl: previewUrl || '',
        },
      },
    };
  }

  return rawResult;
}

const FRIENDLY_ENGINE_LABEL = 'Ultra Direct Download Engine';

function friendlyTier(tier) {
  const value = String(tier || '').trim();
  if (!value) return FRIENDLY_ENGINE_LABEL;
  if (/^[a-z0-9_]+$/.test(value)) {
    // internal ids like `dailymotion_metadata` must never reach the UI
    return FRIENDLY_ENGINE_LABEL;
  }
  return value
    .replace(/Pure Node\.js\s*/gi, '')
    .replace(/Direct\s*IDM\s*\/\s*Chrome/gi, 'Ultra Direct')
    .replace(/IDM\s*\/\s*Chrome/gi, 'Ultra Direct')
    .replace(/PC\s*IDM/gi, 'Ultra Direct')
    .replace(/IDM/gi, 'Ultra Direct')
    .replace(/Chrome/gi, 'Browser')
    .replace(/\s{2,}/g, ' ')
    .trim() || FRIENDLY_ENGINE_LABEL;
}

function attachUnifiedStreamAliases(rawResult) {
  if (!rawResult || !rawResult.media) return rawResult;
  rawResult = buildPlayablePreview(rawResult);
  const s = rawResult.streams || {};
  const decorate = (list, fallbackLabel) =>
    (Array.isArray(list) ? list : []).map((item) => ({
      ...item,
      codecLabel:
        item.codecLabel ||
        (item.hasVideo && item.hasAudio
          ? `${(item.formatExt || 'MP4').toUpperCase()} · Video + Full Sound`
          : item.hasVideo
          ? `${(item.formatExt || 'MP4').toUpperCase()} · HD Direct Stream`
          : `${(item.formatExt || 'M4A').toUpperCase()} · High-Bitrate Audio`),
      badge: item.badge || fallbackLabel,
    }));

  const videoAudio = decorate(s.videoAudio || s.videoWithAudio, 'Direct Download');
  const videoOnly = decorate(s.videoOnly, 'HD Video');
  const audioOnly = decorate(s.audioOnly, 'Direct Audio');
  const subtitles = (Array.isArray(s.subtitles) ? s.subtitles : []).map((sub) => ({
    ...sub,
    proxyUrl: sub.proxyUrl || sub.downloadUrl || sub.url || '',
    url: sub.url || sub.downloadUrl || sub.proxyUrl || '',
  }));

  const unifiedStreams = {
    videoAudio,
    videoWithAudio: videoAudio,
    videoOnly,
    audioOnly,
    subtitles,
  };

  return {
    ...rawResult,
    extractorTierId: rawResult.extractorTier,
    extractorTier: friendlyTier(rawResult.extractorTier),
    streams: unifiedStreams,
    media: {
      ...rawResult.media,
      streams: unifiedStreams,
      subtitles,
    },
  };
}

  const finalizeAnalysis = async () => attachUnifiedStreamAliases(await runCoreAnalysis());

  if (!cacheKey) return finalizeAnalysis();
  return cachedOrCoalesced(cacheKey, 180000, finalizeAnalysis);
}


// ============================================================================
// BACKGROUND WARM-UP — called once at boot so the very first user request is
// already fast (YouTube visitor session + platform cache are pre-built).
// ============================================================================
export async function warmUpExtractorEngine() {
  await Promise.allSettled([
    getYoutubeVisitorData().catch(() => ''),
    getActivePlatformsFromDb().catch(() => []),
  ]);
  return true;
}
