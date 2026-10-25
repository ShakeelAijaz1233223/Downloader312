import { MEDIA_URL_EXT_PATTERN, ANY_FILE_EXT_PATTERN } from '../data/mediaFormats.js';
import { isTeraboxEcosystemUrl } from './teraboxEngine.js';

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const BLOCKED_EMBED_HOSTS =
  /googletagmanager|google-analytics|doubleclick|googlesyndication|facebook\.com\/plugins|recaptcha|disqus|adservice|adsystem|taboola|outbrain|histats|cloudflareinsights|crisp\.chat|tawk\.to|intercom|hotjar/i;

// Mainstream embed hosts whose page URL can be resolved by the normal engine.
const KNOWN_VIDEO_EMBED_HOSTS =
  /youtube\.com\/embed|youtu\.be|player\.vimeo\.com|dailymotion\.com\/embed|ok\.ru\/videoembed|vk\.com\/video_ext|rumble\.com\/embed|bitchute\.com\/embed|streamable\.com\/e|drive\.google\.com\/file|archive\.org\/embed|player\.twitch\.tv|facebook\.com\/plugins\/video|instagram\.com\/p|tiktok\.com|vimeo\.com/i;

function decodeEscapes(raw) {
  return String(raw || '')
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&#0?38;/g, '&')
    .replace(/\\"/g, '"')
    .trim();
}

function normalizeCandidate(rawUrl, baseUrl) {
  let candidate = decodeEscapes(rawUrl);
  if (!candidate) return '';
  if (candidate.startsWith('//')) candidate = `https:${candidate}`;

  // Bare relative paths ("mov_bbb.mp4", "media/clip.m3u8") are valid player
  // sources too — resolve them against the page URL instead of dropping them.
  if (!/^(?:https?:)?\/\//i.test(candidate)) {
    try {
      candidate = new URL(candidate, baseUrl).toString();
    } catch {
      return '';
    }
  }

  if (!/^https?:\/\//i.test(candidate)) return '';
  try {
    return new URL(candidate).toString();
  } catch {
    return '';
  }
}

function isMediaUrl(url) {
  return new RegExp(`\\.(?:${MEDIA_URL_EXT_PATTERN})(\\?|#|$)`, 'i').test(url);
}

function isJunkUrl(url) {
  return (
    BLOCKED_EMBED_HOSTS.test(url) ||
    /(?:^|\/)(?:logo|favicon|sprite|banner|pixel|tracking)[^/]*$/i.test(url) ||
    /\.(?:jpe?g|png|gif|svg|webp|ico|css|js|woff2?)(\?|#|$)/i.test(url)
  );
}

// Ordered, most-reliable-first strategies. Each returns a raw URL string.
const MEDIA_STRATEGIES = [
  // 1. Open Graph / Twitter video cards (works on 99% of social & news sites)
  /<meta[^>]+(?:property|name)=["'](?:og:video:secure_url|og:video:url|og:video|twitter:player:stream|twitter:player:stream:content_type)["'][^>]*content=["']([^"']+)["']/gi,
  /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:video:secure_url|og:video:url|og:video|twitter:player:stream)["']/gi,
  // 2. Schema.org / JSON-LD VideoObject
  /"contentUrl"\s*:\s*"([^"]+)"/gi,
  /"embedUrl"\s*:\s*"([^"]+)"/gi,
  // 3. HTML5 <video> / <source>
  /<video[^>]+src=["']([^"']+)["']/gi,
  /<source[^>]+src=["']([^"']+)["']/gi,
  /<(?:video|source)[^>]+src=["']([^"']+\.(?:m3u8|mp4|webm)[^"']*)["']/gi,
  // 4. data-*/lazy attributes used by custom players
  /data-(?:video|video-url|videoUrl|src|hls|dash|file|stream|media|source)=["']([^"']+)["']/gi,
  // 5. Player configs: JW Player, Video.js, Plyr, Flowplayer, Clappr, Brightcove
  /["']?\b(?:file|src|url|hls|dash|videoUrl|video_url|contentUrl)\b["']?\s*[:=]\s*["']([^"']+\.(?:m3u8|mpd|mp4|webm|mp3|m4a)[^"']*)["']/gi,
  // 6. Anywhere in the HTML / inline JS (escaped slashes already decoded)
  new RegExp(
    `(https?:\\/\\/[^\\s"\'<>\\\\]+?\\.(?:${MEDIA_URL_EXT_PATTERN})(?:\\?[^\\s"\'<>\\\\]*)?)`,
    'gi'
  ),
  // 7. Relative path players
  /["'](\/[^\s"'<>]+?\.(?:m3u8|mp4|webm)[^"']*)["']/gi,
];

const IFRAME_STRATEGIES = [
  /<iframe[^>]+(?:src|data-src|data-litespeed-src)=["']([^"']+)["']/gi,
  /<embed[^>]+src=["']([^"']+)["']/gi,
  /<object[^>]+data=["']([^"']+)["']/gi,
];

// Player IDs that live in JSON (course platforms, LMS pages, news sites) instead
// of a visible <iframe>. Resolved back into their canonical player URL.
const PLAYER_ID_STRATEGIES = [
  { re: /(?:youtube\.com\/(?:embed|watch\?v=)|youtu\.be\/|"videoId"\s*:\s*"|"youtube_id"\s*:\s*"|youtube_id=)([A-Za-z0-9_-]{11})/gi, to: (id) => `https://www.youtube.com/watch?v=${id}` },
  { re: /player\.vimeo\.com\/video\/(\d{6,12})/gi, to: (id) => `https://vimeo.com/${id}` },
  { re: /dailymotion\.com\/(?:embed\/video|video)\/([A-Za-z0-9]{6,10})/gi, to: (id) => `https://www.dailymotion.com/video/${id}` },
  { re: /([A-Za-z0-9]{10,12})\.cloudflarestream\.com/gi, to: () => '' },
];

async function fetchPage(pageUrl, userAgent, cookieHeader) {
  const res = await fetch(pageUrl, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: pageUrl,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(14000),
  });
  return res;
}

function extractMeta(html) {
  const pick = (patterns) => {
    for (const re of patterns) {
      const m = re.exec(html);
      if (m?.[1]) return m[1].trim();
    }
    return '';
  };

  const title =
    pick([
      /property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]*property=["']og:title["']/i,
      /name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]) || 'Extracted Web Stream';

  const thumb =
    pick([
      /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
      /name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
    ]) || '';

  return { pageTitle: decodeEscapes(title).replace(/\s+/g, ' ').trim(), pageThumb: normalizeCandidate(thumb, 'https://example.com') };
}

/**
 * UNIVERSAL deep sniffer: finds a real media stream on ANY page that embeds one
 * (Open Graph video, Twitter player, JSON-LD VideoObject, HTML5 <video>,
 * data-* players, JW/Video.js/Plyr configs, escaped URLs in inline JS,
 * TeraBox links, or a video iframe) — no platform whitelist required.
 */
export async function sniffEmbeddedStreamFromWebPage(pageUrl, cookieHeader = '') {
  let res;
  try {
    res = await fetchPage(pageUrl, DESKTOP_UA, cookieHeader);
  } catch {
    return null;
  }

  // The URL may itself be an extension-less media file (CDN / stream host).
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
    return {
      kind: 'direct_media',
      targetUrl: pageUrl,
      pageTitle: `Direct ${contentType.split('/')[1]?.toUpperCase() || 'Media'} Stream`,
      pageThumb: '',
    };
  }

  if (!res.ok) return null;

  let html = await res.text();
  if (!html || html.length < 32) return null;

  // Retry once with a mobile UA when the desktop page looks like a JS shell.
  if (html.length < 2000 && !/og:video|<video|<iframe/i.test(html)) {
    try {
      const mobile = await fetchPage(pageUrl, MOBILE_UA, cookieHeader);
      if (mobile.ok) {
        const mobileHtml = await mobile.text();
        if (mobileHtml.length > html.length) html = mobileHtml;
      }
    } catch {
      /* keep desktop html */
    }
  }

  const normalizedHtml = decodeEscapes(html);
  const { pageTitle, pageThumb } = extractMeta(normalizedHtml);

  // 1. TeraBox / cloud mirror share link embedded in the post body
  const tbMatch =
    /https?:\/\/(?:www\.|ww\.)?(?:terabox|1024tera|1024terabox|freeterabox|mirrobox|nephobox|4funbox|momerybox|tibibox|terasharelink|teraboxapp)\.[a-z.]+?\/[^\s"'<>\\]+/i.exec(
      normalizedHtml
    );
  if (tbMatch?.[0] && isTeraboxEcosystemUrl(tbMatch[0])) {
    return { kind: 'terabox', targetUrl: tbMatch[0], pageTitle, pageThumb };
  }

  // 2. Ordered media strategies (og:video first — highest hit rate)
  for (const strategy of MEDIA_STRATEGIES) {
    const re = new RegExp(strategy.source, strategy.flags);
    let match;
    let scanned = 0;
    while ((match = re.exec(normalizedHtml)) !== null && scanned < 40) {
      scanned += 1;
      const candidate = normalizeCandidate(match[1], pageUrl);
      if (!candidate || isJunkUrl(candidate) || candidate === pageUrl) continue;
      if (!isMediaUrl(candidate)) continue;
      return { kind: 'direct_media', targetUrl: candidate, pageTitle, pageThumb };
    }
  }

  // 3. Video player iframes / embeds (YouTube, Dailymotion, OK.ru, VK, Rumble…)
  const iframeCandidates = [];
  // Player ids hidden in JSON / inline JS (locked LMS + course pages)
  for (const strategy of PLAYER_ID_STRATEGIES) {
    const re = new RegExp(strategy.re.source, strategy.re.flags);
    let match;
    let scanned = 0;
    while ((match = re.exec(normalizedHtml)) !== null && scanned < 10) {
      scanned += 1;
      const built = strategy.to(match[1]);
      if (!built || isJunkUrl(built)) continue;
      iframeCandidates.push(built);
    }
  }

  for (const strategy of IFRAME_STRATEGIES) {
    const re = new RegExp(strategy.source, strategy.flags);
    let match;
    let scanned = 0;
    while ((match = re.exec(normalizedHtml)) !== null && scanned < 30) {
      scanned += 1;
      const candidate = normalizeCandidate(match[1], pageUrl);
      if (!candidate || isJunkUrl(candidate) || candidate === pageUrl) continue;
      iframeCandidates.push(candidate);
    }
  }

  // Prefer a recognised video host, then fall back to the first plausible embed.
  const knownEmbed = iframeCandidates.find((url) => KNOWN_VIDEO_EMBED_HOSTS.test(url));
  if (knownEmbed) {
    return { kind: 'iframe_embed', targetUrl: knownEmbed, pageTitle, pageThumb };
  }
  if (iframeCandidates[0]) {
    return { kind: 'iframe_embed', targetUrl: iframeCandidates[0], pageTitle, pageThumb };
  }

  // 4. Last resort: a player/page URL reference (e.g. /embed/xyz, /player.php?id=)
  const playerPath =
    /["'](?:https?:\/\/[^"']+)?\/(?:embed|player|video|watch|v)\/[^"'<>\s]{2,}["']/i.exec(
      normalizedHtml
    );
  if (playerPath?.[0]) {
    const candidate = normalizeCandidate(playerPath[0].replace(/^["']|["']$/g, ''), pageUrl);
    if (candidate && !isJunkUrl(candidate) && candidate !== pageUrl) {
      return { kind: 'iframe_embed', targetUrl: candidate, pageTitle, pageThumb };
    }
  }

  return null;
}
