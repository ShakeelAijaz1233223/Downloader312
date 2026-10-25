// ============================================================================
// ULTRA UNIVERSAL INSTANT DOWNLOAD ENGINE (V10.1)
// 1) `normalizeUserUrl()` — heals EVERY paste format (no more "HTTP/HTTPS error")
// 2) `buildInstantDownloadUrl()` — always returns a Chrome/IDM attachment URL
// 3) `triggerDeviceDownload()` — fires SYNCHRONOUSLY inside the click gesture
//    so Google Chrome Download Bar / IDM browser integration ALWAYS start!
// ============================================================================

const ZERO_WIDTH_AND_BIDI = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

function cleanRawInput(raw) {
  return String(raw || '')
    .replace(ZERO_WIDTH_AND_BIDI, '')
    .replace(/[\u201C\u201D\u2018\u2019\u00AB\u00BB]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim();
}

function trimUrlTail(url) {
  let out = url;
  // Strip wrapping punctuation that mobile share sheets / chat apps add.
  out = out.replace(/^[<([{'"`]+/, '').replace(/[>)\]}"'`]+$/, '');
  out = out.replace(/[.,;:!?]+$/, '');
  return out;
}

export function healProtocolTypos(url) {
  let out = String(url || '').trim();
  out = out.replace(/^(https?)\s*:\s*\/+\s*/i, (_m, p) => `${p.toLowerCase()}://`);
  out = out.replace(/^(https?):\/(?!\/)/i, '$1://');
  out = out.replace(/^\/\/(www\.|[a-z0-9-]+\.[a-z]{2,})/i, 'https://$1');
  out = out.replace(/^hxxps?:\/\//i, (m) => (m.toLowerCase().startsWith('hxxps') ? 'https://' : 'http://'));
  return out;
}

const BARE_DOMAIN_RE = /^(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff-]*\.)+[a-z\u00a1-\uffff]{2,}(?::\d{1,5})?(?:[/?#].*)?$/i;
const EMBEDDED_URL_RE = /(?:https?:\/\/|\/\/|www\.)[^\s<>"'\u0600-\u06FF]+/i;

/**
 * Normalizes ANY user paste into a clean absolute http(s) URL.
 * Handles: share text, "HTTPS : //", "https:/x", "www.x.com/a", uppercase,
 * smart quotes, trailing punctuation, emojis, missing protocol, spaces.
 */
export function normalizeUserUrl(rawInput) {
  const cleaned = cleanRawInput(rawInput);
  if (!cleaned) return { ok: false, url: '', reason: 'EMPTY' };

  let candidate = cleaned;

  // 1. If the paste contains a URL inside extra words (e.g. shared captions)
  const embedded = cleaned.match(EMBEDDED_URL_RE);
  if (embedded) {
    candidate = embedded[0];
  } else if (BARE_DOMAIN_RE.test(cleaned.replace(/\s+/g, ''))) {
    // 2. Bare domain such as `youtu.be/xyz` or `www.terabox.com/s/1abc`
    candidate = `https://${cleaned.replace(/\s+/g, '')}`;
  } else {
    // Not a URL at all → treat as a live search query
    return { ok: false, url: '', reason: 'NOT_A_URL' };
  }

  candidate = trimUrlTail(healProtocolTypos(candidate));

  // 3. Still no scheme? (e.g. `www.x.com/a` extracted from share text)
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    const bare = candidate.replace(/\s+/g, '');
    if (/^www\./i.test(bare) || BARE_DOMAIN_RE.test(bare)) {
      candidate = `https://${bare}`;
    }
  }

  const tryParse = (value) => {
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  let parsed = tryParse(candidate);
  if (!parsed && /\s/.test(candidate)) {
    parsed = tryParse(candidate.replace(/\s+/g, encodeURIComponent(' ')));
  }
  if (!parsed) {
    const encoded = candidate.replace(/%(?![0-9A-Fa-f]{2})/g, '%25').replace(/\s+/g, '%20');
    parsed = tryParse(encoded);
  }
  if (!parsed) return { ok: false, url: '', reason: 'INVALID' };

  return { ok: true, url: parsed.toString(), parsed, reason: 'URL' };
}

export function isLikelyUrl(rawInput) {
  return normalizeUserUrl(rawInput).ok;
}

const SAFE_EXT = ['mp4', 'mkv', 'webm', 'mp3', 'm4a', 'ts', 'mov', 'avi', 'flv'];

export function buildCleanFileName(rawTitle, qualityLabel = 'HD', ext = 'mp4') {
  const safeExt = SAFE_EXT.includes(String(ext || '').toLowerCase())
    ? String(ext).toLowerCase()
    : 'mp4';
  const title =
    String(rawTitle || 'Video')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 70) || 'Video';
  const quality =
    String(qualityLabel || 'HD')
      .replace(/[^\p{L}\p{N}_-]/gu, '')
      .slice(0, 20) || 'HD';
  return `${title}_${quality}.${safeExt}`;
}

function extractUpstreamFromProxyPath(path) {
  try {
    const u = new URL(path, 'http://placeholder.local');
    const raw = u.searchParams.get('url') || '';
    if (raw && /^https?:\/\//i.test(raw)) return raw;
  } catch {
    /* ignore */
  }
  return '';
}

function isHlsUpstream(url) {
  return /\.m3u8(\?|$)/i.test(url) || /[?&]format=m3u8/i.test(url);
}

/**
 * Builds an ABSOLUTE HTTP 206 / attachment URL that always downloads
 * (never opens a player page) on Chrome, Edge, Firefox, IDM & mobile.
 */
export function buildInstantDownloadUrl({ stream, media, sourceUrl, qualityLabel }) {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  const ext = String(stream?.formatExt || 'mp4').toLowerCase();
  const fileName =
    stream?.fileName ||
    buildCleanFileName(
      media?.title || stream?.qualityTitle || 'Video',
      qualityLabel || stream?.qualityTitle || 'HD',
      ext
    );

  const rawStreamUrl = String(stream?.streamUrl || stream?.downloadUrl || '').trim();
  let upstream =
    String(stream?.directCdnUrl || '').trim() ||
    (rawStreamUrl.startsWith('/') ? extractUpstreamFromProxyPath(rawStreamUrl) : '') ||
    (/^https?:\/\//i.test(rawStreamUrl) ? rawStreamUrl : '');

  const referer = String(sourceUrl || media?.sourceUrl || '').trim();
  const safeReferer = /^https?:\/\//i.test(referer) ? referer : '';

  if (!upstream) {
    // Only a DIRECT media page link (mp4/mkv/webm/mp3/m4a/m3u8) can be passed
    // straight through. Normal web pages must be resolved by the backend first,
    // otherwise we would download HTML instead of video.
    const isDirectFile =
      /\.(mp4|m4v|mkv|mov|qt|avi|wmv|flv|f4v|webm|mpg|mpeg|mpe|m2v|mpv|vob|m2p|ts|mts|m2ts|m2t|ogv|ogx|ogm|3gp|3g2|asf|rm|rmvb|divx|xvid|nsv|yuv|mxf|r3d|braw|crm|ari|cine|m4s|cmfv|dv|m1v|mp3|m4a|m4b|aac|wav|wave|flac|alac|ape|wv|tta|tak|ofr|ofs|ogg|oga|opus|spx|wma|aiff|aif|aifc|au|snd|amr|3ga|caf|mka|mpc|ra|ram|pcm|raw|s16le|s24le|s32le|mid|midi|kar|rmi|ac3|eac3|dts|mlp|m3u|m3u8|mpd|pls|asx|wpl|xspf|srt|vtt|ass|ssa|sub|idx|sbv|ttml|dfxp|smi|sami|lrc|stl|cap|scc|itt|jpe?g|png|gif|bmp|webp|avif|jxl|apng|mng|tiff?|exr|dpx|hdr|heic|heif|svg|eps|ai|cr2|cr3|nef|arw|dng|orf|rw2|raf|zip|7z|rar|tar|gz|bz2|xz|zst|tgz|tbz2|txz|iso|img|cue|nrg|torrent|apk|exe|msi|dmg|pkg|pdf|docx?|xlsx?|pptx?|csv|txt|json|xml|epub)(\?|#|$)/i.test(referer);
    if (!referer || !isDirectFile) return '';
    return `${origin}/api/v1/stream/direct-download/${encodeURIComponent(
      fileName
    )}?url=${encodeURIComponent(referer)}&filename=${encodeURIComponent(fileName)}`;
  }

  if (isHlsUpstream(upstream)) {
    const tsName = fileName.replace(/\.(mp4|mkv|webm)$/i, '.ts');
    return `${origin}/api/v1/stream/hls-download/${encodeURIComponent(
      tsName
    )}?url=${encodeURIComponent(upstream)}&filename=${encodeURIComponent(tsName)}`;
  }

  const qs = new URLSearchParams({ url: upstream, filename: fileName });
  if (safeReferer) qs.set('referer', safeReferer);
  // File name inside the path keeps IDM's browser monitor + Chrome happy.
  return `${origin}/api/v1/stream/direct-download/${encodeURIComponent(fileName)}?${qs.toString()}`;
}

/**
 * SYNCHRONOUS native download trigger — must be called directly inside a
 * click handler (never after an `await`) so Chrome never blocks it.
 */
export function triggerDeviceDownload(downloadUrl, fileName = 'Video.mp4') {
  if (!downloadUrl || typeof document === 'undefined') return false;
  try {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    try {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      return true;
    } catch {
      return false;
    }
  }
}

export function absoluteApiUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (typeof window === 'undefined') return pathOrUrl;
  return `${window.location.origin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}
