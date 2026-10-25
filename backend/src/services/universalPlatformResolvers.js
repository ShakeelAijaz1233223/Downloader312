// ============================================================================
// UNIVERSAL PLATFORM RESOLVERS (V10.0 — "every card must play")
//
// Three independent layers, tried in order for ANY URL:
//   A. Social networks with a public/official endpoint (Bluesky, Mastodon,
//      Instagram, Threads, Pinterest, Telegram, Tumblr, Twitch, Kick, Rumble).
//   B. Cloud video hosts / embed servers (Streamtape, DoodStream, MixDrop, VOE,
//      FileMoon, StreamWish, LuluStream, Vidmoly, KrakenFiles, SendVid).
//   C. Page intelligence: oEmbed discovery, JSON-LD VideoObject, og:video and
//      known players (Wistia, Kaltura, Mux, Loom, JW Player, Brightcove,
//      Cloudflare Stream, Vidyard).
//
// Every resolver is best-effort: on any failure it returns null so the next
// layer (and finally the deep HTML sniffer) can still try.
// ============================================================================

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CRAWLER_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const HTML_HEADERS = {
  'User-Agent': DESKTOP_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function unescapeDeep(value) {
  return String(value || '')
    .replace(/\\u003[cC]/g, '<')
    .replace(/\\u003[eE]/g, '>')
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003[dD]/g, '=')
    .replace(/\\u0022/g, '"')
    .replace(/\\u0027/g, "'")
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function fetchText(url, { ua = DESKTOP_UA, headers = {}, timeout = 15000, accept } = {}) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': ua,
        Accept: accept || HTML_HEADERS.Accept,
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, finalUrl: res.url || url, headers: res.headers };
  } catch {
    return null;
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetchText(url, { accept: 'application/json, text/plain, */*', ...options });
  if (!res) return null;
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

function origin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function absolute(candidate, base) {
  try {
    return new URL(unescapeDeep(candidate), base).toString();
  } catch {
    return '';
  }
}

function isMediaLink(url) {
  return /\.(?:mp4|m4v|webm|mkv|mov|m3u8|mpd|ts|mp3|m4a|aac|ogg|opus|flac|wav|3gp)(?:[?#]|$)/i.test(
    String(url || '')
  );
}

function metaContent(html, property) {
  const esc = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${esc}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m && m[1]) return unescapeDeep(m[1]);
  }
  return '';
}

function pageTitle(html) {
  return (
    metaContent(html, 'og:title') ||
    metaContent(html, 'twitter:title') ||
    unescapeDeep((/<title[^>]*>([^<]+)<\/title>/i.exec(html) || [])[1] || '') ||
    'Video'
  )
    .replace(/\s*[|·-]\s*(YouTube|Facebook|Instagram|TikTok|X|Twitter|Reddit).*$/i, '')
    .trim()
    .slice(0, 120) || 'Video';
}

// ---------------------------------------------------------------------------
// Result builder (same shape the analyzer returns to the UI)
// ---------------------------------------------------------------------------
export function buildUniversalResult({ platform, canonicalUrl, title, thumbnailUrl, sources, extractorTier }) {
  const usable = (sources || []).filter((s) => s && /^https?:\/\//i.test(s.url || ''));
  if (usable.length === 0) return null;

  const seen = new Set();
  const unique = usable.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  const videoAudio = unique.map((source, index) => {
    const isHls = /\.m3u8(?:[?#]|$)/i.test(source.url) || source.ext === 'ts';
    const isDash = /\.mpd(?:[?#]|$)/i.test(source.url);
    const ext = source.ext || (isHls ? 'ts' : 'mp4');
    const qualityTitle = source.label || (index === 0 ? 'HD' : `Source ${index + 1}`);
    const safeName =
      String(title || 'Video')
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .trim()
        .slice(0, 60) || 'Video';
    const encodedName = encodeURIComponent(`${safeName.replace(/\s+/g, '_')}_${qualityTitle}.${ext}`);
    return {
      formatId: `uni-${index}`,
      formatSelector: 'direct_idm_stream',
      qualityKey: qualityTitle,
      qualityTitle,
      qualitySub: isHls ? 'HLS Stream' : isDash ? 'DASH Stream' : 'Direct MP4',
      formatExt: ext,
      hasVideo: true,
      hasAudio: true,
      requiresMux: false,
      sizeBytes: Number(source.sizeBytes || 0) || null,
      directCdnUrl: source.url,
      streamUrl: isHls
        ? `/api/v1/stream/hls-download/${encodedName}?url=${encodeURIComponent(source.url)}`
        : `/api/v1/stream/direct-download/${encodedName}?url=${encodeURIComponent(source.url)}`,
    };
  });

  return {
    platform: platform || { id: 'universal_web', displayName: 'Universal', category: 'video', isAdult: false },
    canonicalUrl,
    extractorTier: extractorTier || 'universal_resolver',
    media: {
      title: String(title || 'Video').slice(0, 180),
      thumbnailUrl: thumbnailUrl || '',
      durationText: 'Video',
      maxResolutionLabel: videoAudio[0]?.qualityTitle || 'HD',
      estimatedBestSizeBytes: 0,
      isAdult: false,
      subtitles: [],
      previewPlayer: {
        mode: videoAudio[0]?.formatExt === 'ts' ? 'hls_proxy' : 'direct_range_proxy',
        streamUrl: videoAudio[0]?.streamUrl || '',
      },
      streams: { videoWithAudio: videoAudio, videoOnly: [], audioOnly: [] },
    },
    streams: { videoAudio, videoOnly: [], audioOnly: [] },
  };
}

// ===========================================================================
// A. SOCIAL PLATFORMS
// ===========================================================================

// --------------------------------------------------------------- Bluesky
async function resolveBluesky(parsed) {
  const m = /\/profile\/([^/]+)\/post\/([a-z0-9]+)/i.exec(parsed.pathname);
  if (!m) return null;
  const [, handle, rkey] = m;
  const atUri = `at://${decodeURIComponent(handle)}/app.bsky.feed.post/${rkey}`;
  const data = await fetchJson(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}&depth=0`
  );
  const post = data?.thread?.post;
  if (!post) return null;
  const embed = post.embed || {};
  const sources = [];

  const playlist = embed.playlist || embed.video?.playlist;
  if (playlist && /^https?:\/\//i.test(playlist)) sources.push({ url: playlist, label: 'HLS' });

  const videoRef = embed.video?.ref?.$link || embed.ref?.$link;
  const did = post.author?.did || (atUri.match(/at:\/\/([^/]+)/) || [])[1];
  if (sources.length === 0 && videoRef && did) {
    sources.push({
      url: `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(videoRef)}`,
      label: 'MP4',
      ext: 'mp4',
    });
  }
  if (sources.length === 0) return null;

  return buildUniversalResult({
    canonicalUrl: `https://bsky.app/profile/${handle}/post/${rkey}`,
    title: String(post.record?.text || 'Bluesky Video').slice(0, 120),
    thumbnailUrl: embed.thumbnail || '',
    sources,
    extractorTier: 'bluesky_atproto_api',
  });
}

// -------------------------------------------------------------- Mastodon
async function resolveMastodon(parsed, rawUrl) {
  // /@user@instance/123456789  or  /@user/123456789
  const m = /^\/@[^/]+\/(\d{6,})/.exec(parsed.pathname);
  if (!m) return null;
  const statusId = m[1];
  const status = await fetchJson(`${parsed.origin}/api/v1/statuses/${statusId}`);
  if (!status) return null;
  const media = Array.isArray(status.media_attachments) ? status.media_attachments : [];
  const sources = [];
  for (const item of media) {
    const link = item.url || item.remote_url || item.source_url;
    if (!link) continue;
    const isVideo = item.type === 'video' || item.type === 'gifv' || isMediaLink(link);
    if (!isVideo) continue;
    sources.push({ url: link, label: 'Original MP4' });
  }
  if (sources.length === 0) return null;
  return buildUniversalResult({
    canonicalUrl: status.url || rawUrl,
    title: (status.content || '').replace(/<[^>]+>/g, '').trim().slice(0, 120) || 'Mastodon Video',
    thumbnailUrl: media[0]?.preview_url || '',
    sources,
    extractorTier: 'mastodon_public_api',
  });
}

// ------------------------------------------------------------- Instagram
// Instagram only paints its public data into the HTML of the *embed* page, and
// it double/triple-escapes every JSON string ("\\\"video_url\\\":\\\"https:\\\\/…").
// Mobile Safari UA + a deep un-escape is what unlocks it — verified live against
// real reels (public accounts, no login, no cookies).
const INSTAGRAM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function instagramShortcodeToMediaId(code) {
  let id = 0n;
  for (const ch of String(code || '')) {
    const idx = INSTAGRAM_ALPHABET.indexOf(ch);
    if (idx === -1) return '';
    id = id * 64n + BigInt(idx);
  }
  return id.toString();
}

function instagramDeepUnescape(raw) {
  return String(raw || '')
    .replace(/\\+u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\+(["'/])/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .trim();
}

function instagramCleanText(value) {
  return unescapeDeep(String(value || ''))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveInstagram(parsed, rawUrl) {
  const m = /\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/.exec(parsed.pathname);
  if (!m) return null;
  const kind = m[1] === 'reels' ? 'reel' : m[1];
  const shortcode = m[2];

  // 1) Mobile embed page (works for reels, posts, carousels, IGTV)
  const embedAttempts = [
    `https://www.instagram.com/${kind}/${shortcode}/embed/captioned/`,
    `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
    `https://www.instagram.com/${kind}/${shortcode}/embed/`,
  ];

  for (const embedUrl of embedAttempts) {
    const page = await fetchText(embedUrl, {
      ua: MOBILE_UA,
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: 14000,
    });
    if (!page || !page.ok) continue;

    const decoded = instagramDeepUnescape(page.body);
    const videoUrls = [...decoded.matchAll(/"video_url"\s*:\s*"([^"]+)"/g)]
      .map((hit) => unescapeDeep(hit[1]))
      .filter((url) => /^https?:\/\//i.test(url));

    if (videoUrls.length === 0) continue;

    const thumbnail =
      unescapeDeep(/"display_url"\s*:\s*"([^"]+)"/.exec(decoded)?.[1] || '') ||
      unescapeDeep(/"thumbnail_src"\s*:\s*"([^"]+)"/.exec(decoded)?.[1] || '') ||
      metaContent(page.body, 'og:image');

    const username =
      /"owner"\s*:\s*\{\s*"username"\s*:\s*"([^"]+)"/.exec(decoded)?.[1] ||
      /"username"\s*:\s*"([^"]+)"/.exec(decoded)?.[1] ||
      '';

    const captionRaw =
      /"edge_media_to_caption"[\s\S]{0,300}?"text"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(decoded)?.[1] ||
      /"caption"\s*:\s*"(?:<[^>]*>)?((?:[^"\\]|\\.)*)"/.exec(decoded)?.[1] ||
      '';

    const caption = instagramCleanText(captionRaw.replace(/\\n/g, ' '));
    const title = caption
      ? `${caption.slice(0, 96)}${caption.length > 96 ? '…' : ''}`
      : username
        ? `Instagram · @${username}`
        : 'Instagram Video';

    const unique = [...new Set(videoUrls)];
    const sources = unique.map((url, index) => ({
      url,
      label: unique.length > 1 ? `Clip ${index + 1} · HD MP4` : 'HD MP4',
    }));

    return buildUniversalResult({
      canonicalUrl: `https://www.instagram.com/${kind}/${shortcode}/`,
      title,
      thumbnailUrl: thumbnail,
      sources,
      extractorTier: 'instagram_embed_captioned',
    });
  }

  // 2) Public GraphQL / media-info endpoints (residential IPs, some regions)
  const mediaId = instagramShortcodeToMediaId(shortcode);
  if (mediaId) {
    const apiAttempts = [
      `https://i.instagram.com/api/v1/media/${mediaId}/info/`,
      `https://www.instagram.com/api/v1/media/${mediaId}/info/`,
    ];
    for (const apiUrl of apiAttempts) {
      const data = await fetchJson(apiUrl, {
        ua: MOBILE_UA,
        headers: { 'X-IG-App-ID': '936619743392459', 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 10000,
      });
      const items = data?.items || (data?.data?.xdt_shortcode_media ? [data.data.xdt_shortcode_media] : []);
      const item = Array.isArray(items) ? items[0] : null;
      if (!item) continue;

      const versions = [
        ...(Array.isArray(item.video_versions) ? item.video_versions : []),
        ...((Array.isArray(item.carousel_media) ? item.carousel_media : []).flatMap((c) =>
          Array.isArray(c.video_versions) ? c.video_versions : []
        )),
      ].filter((v) => v?.url);

      if (versions.length === 0) continue;
      versions.sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0));

      return buildUniversalResult({
        canonicalUrl: `https://www.instagram.com/${kind}/${shortcode}/`,
        title: instagramCleanText(item.caption?.text || '').slice(0, 120) || `Instagram · @${item.user?.username || ''}`,
        thumbnailUrl: item.image_versions2?.candidates?.[0]?.url || '',
        sources: versions.slice(0, 3).map((v, i) => ({
          url: v.url,
          label: i === 0 ? `HD · ${v.width || ''}p`.replace(' · p', '') : `${v.width || 'SD'}p`,
        })),
        extractorTier: 'instagram_media_info_api',
      });
    }
  }

  return null;
}

// --------------------------------------------------------------- Threads
async function resolveThreads(parsed, rawUrl) {
  const m = /\/@[^/]+\/post\/([A-Za-z0-9_-]{5,})/.exec(parsed.pathname);
  if (!m) return null;
  const code = m[1];
  const embedUrl = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}/embed`;
  const page = (await fetchText(embedUrl, { ua: MOBILE_UA })) || (await fetchText(rawUrl, { ua: MOBILE_UA }));
  if (!page || !page.ok) return null;
  const html = unescapeDeep(page.body);

  const videoUrl =
    /"video_url"\s*:\s*"([^"]+)"/.exec(html)?.[1] ||
    metaContent(html, 'og:video') ||
    metaContent(html, 'og:video:secure_url') ||
    '';
  if (!/^https?:\/\//i.test(videoUrl)) return null;

  return buildUniversalResult({
    canonicalUrl: rawUrl,
    title: pageTitle(html),
    thumbnailUrl: metaContent(html, 'og:image'),
    sources: [{ url: videoUrl, label: 'HD MP4' }],
    extractorTier: 'threads_embed_page',
  });
}

// ------------------------------------------------------------- Pinterest
async function resolvePinterest(parsed, rawUrl) {
  if (!/\/(pin|idea)\//i.test(parsed.pathname) && !/^pin\.it$/i.test(parsed.hostname)) return null;
  const page = await fetchText(rawUrl, { ua: DESKTOP_UA });
  if (!page || !page.ok) return null;
  const html = unescapeDeep(page.body);

  const sources = [];
  const hls =
    /"V_HLSV4"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/.exec(html)?.[1] ||
    /"hls"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/.exec(html)?.[1];
  const mp4 = /"V_720P"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/.exec(html)?.[1];
  const og = metaContent(html, 'og:video:secure_url') || metaContent(html, 'og:video');

  if (mp4) sources.push({ url: unescapeDeep(mp4), label: '720p MP4' });
  if (hls) sources.push({ url: unescapeDeep(hls), label: 'HLS' });
  if (sources.length === 0 && /^https?:\/\//i.test(og)) sources.push({ url: og, label: 'MP4' });
  if (sources.length === 0) return null;

  return buildUniversalResult({
    canonicalUrl: page.finalUrl || rawUrl,
    title: pageTitle(html),
    thumbnailUrl: metaContent(html, 'og:image'),
    sources,
    extractorTier: 'pinterest_pin_json',
  });
}

// -------------------------------------------------------------- Telegram
async function resolveTelegram(parsed, rawUrl) {
  const m = /^\/([A-Za-z0-9_]{4,})\/(\d+)/.exec(parsed.pathname);
  if (!m) return null;
  const [, channel, postId] = m;
  const embedUrl = `https://t.me/${channel}/${postId}?embed=1&mode=tme&discussion=0`;
  const page = await fetchText(embedUrl, { ua: DESKTOP_UA });
  if (!page || !page.ok) return null;
  const html = unescapeDeep(page.body);

  const sources = [];
  const videoSrc = /<video[^>]+src=["']([^"']+)["']/i.exec(html)?.[1];
  if (videoSrc) sources.push({ url: absolute(videoSrc, 'https://t.me'), label: 'MP4' });

  const roundVideo = /"contentUrl"\s*:\s*"([^"]+)"/.exec(html)?.[1];
  if (sources.length === 0 && roundVideo) sources.push({ url: roundVideo, label: 'MP4' });
  if (sources.length === 0) return null;

  return buildUniversalResult({
    canonicalUrl: `https://t.me/${channel}/${postId}`,
    title: pageTitle(html),
    thumbnailUrl: metaContent(html, 'og:image'),
    sources,
    extractorTier: 'telegram_embed_page',
  });
}

// ---------------------------------------------------------------- Tumblr
async function resolveTumblr(parsed, rawUrl) {
  const m = /\/(?:post\/)?(\d{8,})/.exec(parsed.pathname);
  if (!m) return null;
  const page = await fetchText(rawUrl, { ua: DESKTOP_UA });
  if (!page || !page.ok) return null;
  const html = unescapeDeep(page.body);

  const sources = [];
  const direct = /"video_url"\s*:\s*"([^"]+)"/.exec(html)?.[1];
  const og = metaContent(html, 'og:video:secure_url') || metaContent(html, 'og:video');
  if (direct && isMediaLink(direct)) sources.push({ url: direct, label: 'HD MP4' });
  if (sources.length === 0 && /^https?:\/\//i.test(og)) sources.push({ url: og, label: 'MP4' });
  if (sources.length === 0) return null;

  return buildUniversalResult({
    canonicalUrl: rawUrl,
    title: pageTitle(html),
    thumbnailUrl: metaContent(html, 'og:image'),
    sources,
    extractorTier: 'tumblr_post_html',
  });
}

// ----------------------------------------------------------- Twitch clips
async function resolveTwitch(parsed, rawUrl) {
  const slug =
    /^clips\.twitch\.tv$/.test(parsed.hostname) ? parsed.pathname.split('/')[1] : /\/(?:clip|clips)\/([A-Za-z0-9_-]+)/.exec(parsed.pathname)?.[1];
  if (!slug) return null;

  const page = await fetchText(`https://clips.twitch.tv/${slug}`, { ua: DESKTOP_UA });
  if (!page || !page.ok) return null;
  const html = unescapeDeep(page.body);

  const sources = [];
  const qualities = [...html.matchAll(/"sourceURL"\s*:\s*"([^"]+)"/g)].map((m2) => m2[1]);
  const og = metaContent(html, 'og:video');
  const collect = qualities.length > 0 ? qualities : og ? [og] : [];
  collect.forEach((url, i) => sources.push({ url, label: i === 0 ? 'Source MP4' : `Clip ${i + 1}` }));
  if (sources.length === 0) {
    const fallback = /"thumbnailUrl"\s*:\s*"([^"]+)"[\s\S]{0,400}?"videoQualities"/.test(html);
    if (!fallback) return null;
  }
  if (sources.length === 0) return null;

  return buildUniversalResult({
    canonicalUrl: `https://clips.twitch.tv/${slug}`,
    title: pageTitle(html),
    thumbnailUrl: metaContent(html, 'og:image'),
    sources,
    extractorTier: 'twitch_clip_page',
  });
}

// ------------------------------------------------------------------ Kick
async function resolveKick(parsed, rawUrl) {
  const clipMatch =
    /clips\/(clip_[A-Za-z0-9]+)/i.exec(parsed.pathname) || /[?&]clip=(clip_[A-Za-z0-9]+)/i.exec(parsed.search);
  if (!clipMatch) return null;
  const clipId = clipMatch[1];
  const data = await fetchJson(`https://kick.com/api/v2/clips/${encodeURIComponent(clipId)}`);
  const clip = data?.clip || data;
  const url = clip?.video_url || clip?.videoUrl;
  if (!url) return null;
  return buildUniversalResult({
    canonicalUrl: rawUrl,
    title: String(clip?.title || 'Kick Clip').slice(0, 120),
    thumbnailUrl: clip?.thumbnail_url || clip?.thumbnail || '',
    sources: [{ url, label: 'Source MP4' }],
    extractorTier: 'kick_clip_api',
  });
}

// ---------------------------------------------------------------- Rumble
async function resolveRumble(parsed, rawUrl) {
  const id =
    /\/embed\/([A-Za-z0-9]+)/.exec(parsed.pathname)?.[1] ||
    /^v([A-Za-z0-9]+)/.exec(parsed.pathname.split('/').filter(Boolean)[0] || '')?.[1];
  if (!id) return null;
  const embed = await fetchText(`https://rumble.com/embed/${id}/`, { ua: DESKTOP_UA });
  if (!embed || !embed.ok) return null;
  const html = unescapeDeep(embed.body);

  const sources = [];
  const mp4 = /"mp4"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/.exec(html)?.[1] || /"url"\s*:\s*"(https:[^"]+\.mp4[^"]*)"/.exec(html)?.[1];
  const hls = /"hls"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/.exec(html)?.[1] || /"(https:[^"]+\.m3u8[^"]*)"/.exec(html)?.[1];
  if (mp4) sources.push({ url: unescapeDeep(mp4), label: 'MP4' });
  if (hls) sources.push({ url: unescapeDeep(hls), label: 'HLS' });
  if (sources.length === 0) return null;

  return buildUniversalResult({
    canonicalUrl: rawUrl,
    title: pageTitle(html) || 'Rumble Video',
    thumbnailUrl: metaContent(html, 'og:image'),
    sources,
    extractorTier: 'rumble_embed_json',
  });
}

// ------------------------------------------------------------- Snapchat
async function resolveSnapchat(parsed, rawUrl) {
  if (!/spotlight|story|@/.test(parsed.pathname)) return null;
  const page = await fetchText(rawUrl, { ua: MOBILE_UA });
  if (!page || !page.ok) return null;
  const html = unescapeDeep(page.body);
  const sources = [];
  const mp4 = /"contentUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/.exec(html)?.[1] || metaContent(html, 'og:video');
  if (mp4 && /^https?:\/\//i.test(mp4)) sources.push({ url: mp4, label: 'MP4' });
  const hls = /"(https:[^"]+\.m3u8[^"]*)"/.exec(html)?.[1];
  if (hls) sources.push({ url: hls, label: 'HLS' });
  if (sources.length === 0) return null;
  return buildUniversalResult({
    canonicalUrl: rawUrl,
    title: pageTitle(html),
    thumbnailUrl: metaContent(html, 'og:image'),
    sources,
    extractorTier: 'snapchat_page_html',
  });
}

// --------------------------------------------------------------- LinkedIn
async function resolveLinkedIn(parsed, rawUrl) {
  if (!/linkedin\.com$/i.test(parsed.hostname.replace(/^www\./, ''))) return null;
  const page = await fetchText(rawUrl, { ua: CRAWLER_UA });
  if (!page || !page.ok) return null;
  const html = unescapeDeep(page.body);
  const og = metaContent(html, 'og:video:secure_url') || metaContent(html, 'og:video');
  const sources = [];
  if (/^https?:\/\//i.test(og)) sources.push({ url: og, label: 'MP4' });
  const mp4 = /"(https:[^"]+\.mp4[^"]*)"/.exec(html)?.[1];
  if (mp4) sources.push({ url: mp4, label: 'MP4' });
  if (sources.length === 0) return null;
  return buildUniversalResult({
    canonicalUrl: rawUrl,
    title: pageTitle(html),
    thumbnailUrl: metaContent(html, 'og:image'),
    sources,
    extractorTier: 'linkedin_page_html',
  });
}

// ===========================================================================
// B. CLOUD VIDEO HOSTS / EMBED SERVERS
// ===========================================================================

function randomAlphaNum(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function resolveStreamtape(parsed, rawUrl) {
  const page = await fetchText(rawUrl, { ua: DESKTOP_UA, headers: { Referer: 'https://streamtape.com/' } });
  if (!page || !page.ok) return null;
  const html = page.body;

  // Streamtape builds the link in JS and hides fragments in <span> tags, e.g.
  //   document.getElementById('botlink').innerHTML = '//streamtape.com/get_video?id=…' + '&token=…';
  // Strategy: glue every quoted literal after "botlink" together, then look
  // for the get_video call. Falls back to rebuilding it from id + token.
  let url = '';
  const scriptChunk = html.slice(Math.max(0, html.indexOf('botlink')));
  const literals = [...scriptChunk.matchAll(/['"]([^'"]*)['"]/g)].map((m) => m[1]).join('');
  const glued = literals.replace(/\s+/g, '');
  const full = /((?:https?:)?\/\/[^"'\s]*get_video[^"'\s]*)/.exec(glued)?.[1];
  if (full) url = full.startsWith('//') ? `https:${full}` : full;

  if (!/^https?:\/\//i.test(url)) {
    const id = /[?&]id=([\w-]{4,})/.exec(glued)?.[1];
    const token = /[?&]token=([\w-]{4,})/.exec(glued)?.[1];
    if (id && token) url = `https://${parsed.hostname}/get_video?id=${id}&token=${token}`;
  }
  if (!/^https?:\/\//i.test(url)) {
    const direct = /["']((?:https?:)?\/\/[^"']*get_video[^"']+)["']/.exec(html)?.[1];
    if (direct) url = direct.startsWith('//') ? `https:${direct}` : direct;
  }
  if (!/^https?:\/\//i.test(url)) return null;

  return buildUniversalResult({
    canonicalUrl: rawUrl,
    title: pageTitle(html) || 'Streamtape Video',
    thumbnailUrl: metaContent(html, 'og:image'),
    sources: [{ url, label: 'Original MP4' }],
    extractorTier: 'streamtape_robot_link',
  });
}

async function resolveDoodStream(parsed, rawUrl) {
  const page = await fetchText(rawUrl, { ua: DESKTOP_UA });
  if (!page || !page.ok) return null;
  const html = page.body;

  const passPath =
    /["'](\/pass_md5\/[^"']+)["']/.exec(html)?.[1] ||
    /(pass_md5\/[\w./-]{6,})/.exec(html)?.[1] ||
    '';
  if (!passPath) return null;
  const normalizedPassPath = passPath.startsWith('/') ? passPath : `/${passPath}`;

  const doodOrigin = new URL(normalizedPassPath, page.finalUrl).origin;
  const passRes = await fetchText(`${doodOrigin}${normalizedPassPath}`, {
    ua: DESKTOP_UA,
    headers: { Referer: page.finalUrl },
  });
  if (!passRes || !passRes.ok) return null;
  const token = passRes.body.trim();
  if (!token || token.length > 200) return null;

  const cdnHost = /["'](https?:\/\/[^"']+)\/pass_md5/.exec(html)?.[1] || doodOrigin;
  const finalUrl = `${cdnHost}/${randomAlphaNum(10)}?token=${encodeURIComponent(token)}&expiry=${Date.now()}`;

  return buildUniversalResult({
    canonicalUrl: rawUrl,
    title: pageTitle(html) || 'DoodStream Video',
    thumbnailUrl: metaContent(html, 'og:image'),
    sources: [{ url: finalUrl, label: 'Original MP4' }],
    extractorTier: 'doodstream_pass_md5',
  });
}

async function resolveMixDrop(parsed, rawUrl) {
  const page = await fetchText(rawUrl, { ua: DESKTOP_UA, headers: { Referer: parsed.origin } });
  if (!page || !page.ok) return null;
  const html = page.body;

  const candidates = [
    /MDCore\.wurl\s*=\s*["']([^"']+)["']/.exec(html)?.[1],
    /wurl\s*[:=]\s*["']([^"']+)["']/.exec(html)?.[1],
    /"(https?:\/\/[^"]+\.mp4[^"]*)"/.exec(html)?.[1],
  ].filter(Boolean);

  const url = candidates.map((c) => (c.startsWith('//') ? `https:${c}` : absolute(c, parsed.origin)))[0];
  if (!url || !/^https?:\/\//i.test(url)) return null;

  return buildUniversalResult({
    canonicalUrl: rawUrl,
    title: pageTitle(html) || 'MixDrop Video',
    thumbnailUrl: metaContent(html, 'og:image'),
    sources: [{ url, label: 'Original MP4' }],
    extractorTier: 'mixdrop_wurl',
  });
}

async function resolveGenericEmbedHost(parsed, rawUrl, hostLabel) {
  const page = await fetchText(rawUrl, { ua: DESKTOP_UA, headers: { Referer: parsed.origin } });
  if (!page || !page.ok) return null;
  const html = unescapeDeep(page.body);

  const sources = [];
  const packSources = [
    ...html.matchAll(/file\s*:\s*["']([^"']+)["']/gi),
    ...html.matchAll(/["']file["']\s*:\s*["']([^"']+)["']/gi),
  ]
    .map((m) => m[1])
    .filter((u) => isMediaLink(u) || /stream|hls|master/i.test(u));
  for (const url of packSources.slice(0, 4)) {
    sources.push({ url: absolute(url, parsed.origin), label: /\.m3u8/i.test(url) ? 'HLS' : 'MP4' });
  }

  const og = metaContent(html, 'og:video:secure_url') || metaContent(html, 'og:video');
  if (sources.length === 0 && /^https?:\/\//i.test(og)) sources.push({ url: og, label: 'MP4' });

  const jsonLd = extractJsonLdVideo(html, page.finalUrl);
  if (sources.length === 0 && jsonLd.length) jsonLd.forEach((s) => sources.push(s));

  if (sources.length === 0) return null;

  return buildUniversalResult({
    canonicalUrl: rawUrl,
    title: pageTitle(html) || `${hostLabel} Video`,
    thumbnailUrl: metaContent(html, 'og:image'),
    sources,
    extractorTier: `${hostLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_embed`,
  });
}

// ===========================================================================
// C. PAGE INTELLIGENCE (oEmbed · JSON-LD · og:video · known players)
// ===========================================================================

function extractJsonLdVideo(html, baseUrl) {
  const out = [];
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    let parsedBlocks;
    try {
      parsedBlocks = JSON.parse(unescapeDeep(block[1]));
    } catch {
      continue;
    }
    const queue = Array.isArray(parsedBlocks) ? [...parsedBlocks] : [parsedBlocks];
    while (queue.length) {
      const node = queue.shift();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node['@graph'])) queue.push(...node['@graph']);
      const type = String(node['@type'] || '');
      if (/VideoObject|Clip|Movie|TVEpisode/i.test(type) || node.contentUrl) {
        const candidates = [node.contentUrl, node.embedUrl, node.url].filter((u) => typeof u === 'string');
        for (const candidate of candidates) {
          if (!/^https?:\/\//i.test(candidate)) continue;
          if (!isMediaLink(candidate)) continue;
          out.push({ url: absolute(candidate, baseUrl), label: /\.m3u8/i.test(candidate) ? 'HLS' : 'MP4' });
        }
      }
      for (const value of Object.values(node)) {
        if (value && typeof value === 'object') queue.push(value);
      }
    }
  }
  return out.slice(0, 4);
}

async function resolveKnownPlayers(html, pageUrl) {
  const sources = [];

  // Wistia
  const wistiaId =
    /wistia\.com\/medias\/([a-z0-9]{8,})/i.exec(html)?.[1] ||
    /wistia_async_([a-z0-9]{8,})/i.exec(html)?.[1] ||
    /data-wistia-id=["']([a-z0-9]{8,})["']/i.exec(html)?.[1];
  if (wistiaId) {
    const data = await fetchJson(`https://fast.wistia.com/medias/${wistiaId}.json`);
    const assets = data?.media?.assets || [];
    assets
      .filter((a) => /video|ipod|mp4|m3u8/i.test(`${a.type} ${a.contentType} ${a.url}`))
      .sort((a, b) => Number(b.width || 0) - Number(a.width || 0))
      .slice(0, 3)
      .forEach((a, i) => sources.push({ url: a.url, label: i === 0 ? 'HD MP4' : `${a.width || 'SD'}p` }));
  }

  // Mux
  const muxId = /stream\.mux\.com\/([A-Za-z0-9]{10,})\.m3u8/.exec(html)?.[1];
  if (muxId) sources.push({ url: `https://stream.mux.com/${muxId}.m3u8`, label: 'HLS' });

  // Cloudflare Stream
  const cfId = /customer-([a-z0-9]+)\.cloudflarestream\.com\/([a-f0-9]{20,})/.exec(html);
  if (cfId) {
    sources.push({
      url: `https://customer-${cfId[1]}.cloudflarestream.com/${cfId[2]}/manifest/video.m3u8`,
      label: 'HLS',
    });
  }

  // Kaltura
  const kaltura = /partner_id["']?\s*[:=]\s*["']?(\d{3,})[\s\S]{0,400}?entry_id["']?\s*[:=]\s*["']?([a-z0-9]{6,})/i.exec(html);
  if (kaltura) {
    sources.push({
      url: `https://cdnapisec.kaltura.com/p/${kaltura[1]}/sp/0/playManifest/entryId/${kaltura[2]}/format/applehttp/protocol/https/a.m3u8`,
      label: 'HLS',
    });
  }

  // Loom
  const loomId = /loom\.com\/(?:share|embed)\/([a-f0-9]{20,})/i.exec(html)?.[1];
  if (loomId) {
    sources.push({ url: `https://www.loom.com/share/${loomId}?download=1`, label: 'MP4', ext: 'mp4' });
  }
  const loomCdn = /"(https:\/\/cdn\.loom\.com\/[^"]+\.(?:mp4|m3u8)[^"]*)"/i.exec(html)?.[1];
  if (loomCdn) sources.push({ url: unescapeDeep(loomCdn), label: 'Loom MP4' });

  // Panopto (university LMS): public social mp4 for the same delivery
  const panoptoHost = /(?:https?:\/\/)?([^/"']*panopto[^/"']*)/i.exec(pageUrl)?.[1];
  if (panoptoHost) {
    const deliveryId =
      /"DeliveryID"\s*:\s*"([0-9a-f-]{36})"/i.exec(html)?.[1] ||
      /deliveryId["']?\s*[:=]\s*["']([0-9a-f-]{36})["']/i.exec(html)?.[1] ||
      /\/Panopto\/Pages\/(?:Viewer|Embed)\.aspx\?id=([0-9a-f-]{36})/i.exec(pageUrl)?.[1];
    if (deliveryId) {
      sources.push({
        url: `https://${panoptoHost}/Panopto/Podcast/Social/${deliveryId}.mp4`,
        label: 'Panopto MP4',
      });
    }
    const podcast = /"(https?:\/\/[^"]*\/Panopto\/Podcast\/[^"]+)"/i.exec(html)?.[1];
    if (podcast) sources.push({ url: unescapeDeep(podcast), label: 'LMS Recording' });
  }

  // Brightcove (many course platforms + news sites)
  const bc =
    /<video-js[^>]+data-video-id=["'](\d{6,})["'][^>]+data-account=["'](\d{6,})["']/i.exec(html) ||
    /data-account=["'](\d{6,})["'][^>]+data-video-id=["'](\d{6,})["']/i.exec(html);
  if (bc) {
    const account = /^\d{6,}$/.test(bc[1]) && String(bc[1]).length > 6 ? bc[1] : bc[2];
    const videoId = account === bc[1] ? bc[2] : bc[1];
    const player = await fetchText(
      `https://players.brightcove.net/${account}/default_default/index.html?videoId=${videoId}`,
      { ua: DESKTOP_UA }
    ).catch(() => null);
    if (player?.ok) {
      const inner = unescapeDeep(player.body);
      const m3u8 = /"(https?:\/\/[^"]+\.m3u8[^"]*)"/i.exec(inner)?.[1];
      const mp4 = /"(https?:\/\/[^"]+\.mp4[^"]*)"/i.exec(inner)?.[1];
      if (m3u8) sources.push({ url: m3u8, label: 'Brightcove HLS' });
      if (mp4) sources.push({ url: mp4, label: 'Brightcove MP4' });
    }
  }

  // Vidyard (Teachable / Kajabi / Skool lessons)
  const vidyardId =
    /play\.vidyard\.com\/([A-Za-z0-9]{10,})/i.exec(html)?.[1] ||
    /data-vidyard-uuid=["']([A-Za-z0-9]{10,})["']/i.exec(html)?.[1];
  if (vidyardId) {
    const data = await fetchJson(`https://play.vidyard.com/${vidyardId}.json`, { timeout: 10000 });
    const chapters = data?.payload?.chapters || [];
    for (const ch of chapters) {
      for (const src of ch.sources || []) {
        if (src?.url) sources.push({ url: src.url, label: 'Vidyard MP4' });
      }
    }
  }

  // JW Platform (jwplayer hosted media)
  const jwId = /cdn\.jwplayer\.com\/(?:v2\/media|players)\/([A-Za-z0-9]{8})/i.exec(html)?.[1];
  if (jwId) {
    const data = await fetchJson(`https://cdn.jwplayer.com/v2/media/${jwId}`, { timeout: 10000 });
    for (const src of data?.playlist?.[0]?.sources || []) {
      if (src?.file) sources.push({ url: src.file, label: 'JW Player Stream' });
    }
  }

  // Echo360 lecture capture
  const echo = /echo360[^"']*\/lesson\/([0-9a-f-]{36})/i.exec(pageUrl);
  if (echo) {
    const echoApi = await fetchJson(
      `https://echo360.org/lesson/${echo[1]}/classroom`,
      { timeout: 10000 }
    ).catch(() => null);
    const echoUrl = echoApi ? /"(https?:\/\/[^"]+\.m3u8[^"]*)"/i.exec(JSON.stringify(echoApi))?.[1] : '';
    if (echoUrl) sources.push({ url: echoUrl, label: 'Echo360 HLS' });
  }

  // JW Player / Video.js / generic player configs
  for (const match of html.matchAll(/["']?(?:file|src|source)["']?\s*:\s*["']([^"']+\.(?:mp4|m3u8|webm)[^"']*)["']/gi)) {
    sources.push({ url: absolute(unescapeDeep(match[1]), pageUrl), label: 'Player Stream' });
  }

  return sources.slice(0, 5);
}

async function resolveOEmbed(html, pageUrl) {
  const discovery = [
    /<link[^>]+type=["']application\/json\+oembed["'][^>]+href=["']([^"']+)["']/i.exec(html)?.[1],
    /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/json\+oembed["']/i.exec(html)?.[1],
  ].filter(Boolean);
  if (discovery.length === 0) return null;

  const endpoint = absolute(unescapeDeep(discovery[0]), pageUrl);
  const data = await fetchJson(endpoint);
  if (!data) return null;

  const sources = [];
  if (typeof data.url === 'string' && isMediaLink(data.url)) {
    sources.push({ url: data.url, label: 'OEmbed Stream' });
  }
  if (typeof data.html === 'string') {
    const iframe = /src=["']([^"']+)["']/i.exec(data.html)?.[1];
    if (iframe) sources.push({ url: absolute(unescapeDeep(iframe), pageUrl), label: 'Embed', ext: 'mp4', isEmbed: true });
  }
  if (typeof data.thumbnail_url === 'string' && data.thumbnail_url) {
    sources.thumbnail = data.thumbnail_url;
  }
  return sources.length ? sources : null;
}


// Generic last-mile scan: pull every real media URL out of raw HTML/JS.
const JUNK_MEDIA_RE =
  /(?:sprite|favicon|logo|pixel|tracking|advert|analytics|doubleclick|googlesyndication|preview|thumb|poster|sample(?![a-z])|placeholder|1x1|blank)/i;

// Precise, low-noise: only real <video> / <source> tags on the page.
function scanVideoTags(html, pageUrl) {
  const out = [];
  const push = (candidate) => {
    const url = absolute(candidate, pageUrl);
    if (/^https?:\/\//i.test(url) && isMediaLink(url) && !JUNK_MEDIA_RE.test(url)) {
      out.push({ url, label: /\.m3u8/i.test(url) ? 'HLS' : 'MP4' });
    }
  };
  for (const m of html.matchAll(/<video\b[^>]*\bsrc=["']([^"']+)["']/gi)) push(m[1]);
  for (const m of html.matchAll(/<source\b[^>]*\bsrc=["']([^"']+)["']/gi)) push(m[1]);
  for (const m of html.matchAll(/<video\b[^>]*>([\s\S]{0,600}?)<\/video>/gi)) {
    for (const inner of m[1].matchAll(/src=["']([^"']+)["']/gi)) push(inner[1]);
  }
  const seen = new Set();
  return out.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function scanMediaUrls(html, pageUrl) {
  const found = [];
  const push = (candidate, label) => {
    const url = absolute(candidate, pageUrl);
    if (!/^https?:\/\//i.test(url)) return;
    if (!isMediaLink(url)) return;
    if (JUNK_MEDIA_RE.test(url)) return;
    // Site chrome / JS bundles that merely contain ".mp4" in their name.
    if (/\/(?:web|static|assets|build|dist|chunks?|_next|node_modules|bbcdotcom)\//i.test(url) &&
        !/video|media|stream|master|manifest|playlist/i.test(url)) return;
    found.push({ url, label });
  };

  for (const match of html.matchAll(/https?:\/\/[^"'\s<>\\)]+?\.(?:mp4|m4v|webm|mkv|mov|m3u8|mpd)(?:\?[^"'\s<>\\)]*)?/gi)) {
    push(match[0], /\.m3u8/i.test(match[0]) ? 'HLS' : 'MP4');
  }
  for (const match of html.matchAll(/["']((?:https?:)?\/\/[^"'\s<>]+?\.(?:mp4|m4v|webm|mkv|mov|m3u8|mpd)[^"'\s<>]*)["']/gi)) {
    push(match[1], /\.m3u8/i.test(match[1]) ? 'HLS' : 'MP4');
  }
  for (const match of html.matchAll(/["']((?:\/|\.\.?\/)?[\w@%+\-./]+\.(?:mp4|m4v|webm|m3u8))["']/gi)) {
    push(match[1], 'Player File');
  }

  const seen = new Set();
  return found
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .sort((a, b) => {
      const score = (x) => (/mp4|webm|mkv|mov/i.test(x.url) ? 2 : 1);
      return score(b) - score(a);
    })
    .slice(0, 6);
}

// Extracts every usable source from ONE page (no recursion).
async function collectPageSources(html, pageUrl) {
  const sources = [];
  sources.push(...extractJsonLdVideo(html, pageUrl));

  const ogVideo =
    metaContent(html, 'og:video:secure_url') ||
    metaContent(html, 'og:video:url') ||
    metaContent(html, 'og:video') ||
    metaContent(html, 'twitter:player:stream');
  if (/^https?:\/\//i.test(ogVideo)) {
    sources.push({ url: ogVideo, label: 'OG Video', isEmbed: !isMediaLink(ogVideo) });
  }

  sources.push(...(await resolveKnownPlayers(html, pageUrl)));

  // Real <video>/<source> tags are always trustworthy — keep them even when
  // another tier already produced a candidate.
  sources.push(...scanVideoTags(html, pageUrl));

  // Anything else sitting in the markup / inline JS — only when the page
  // really renders a player (otherwise we would grab site assets).
  const hasPlayerSignal = /<video[\s>]|videojs|jwplayer|playerConfig|data-video|hls\.js|flowplayer|videoUrl|\.m3u8/i.test(
    html
  );
  if (sources.filter((item) => !item.isEmbed).length === 0 && hasPlayerSignal) {
    sources.push(...scanMediaUrls(html, pageUrl));
  }

  return sources;
}

// Follows one player/embed page (og:video that is really an HTML player,
// oEmbed iframe, JW/Brightcove wrapper…) and pulls the real file out of it.
async function followEmbedPage(embedUrl) {
  const nested = await fetchText(embedUrl, { ua: DESKTOP_UA });
  if (!nested || !nested.ok) return [];
  const nestedHtml = unescapeDeep(nested.body);
  const found = await collectPageSources(nestedHtml, nested.finalUrl);
  return found
    .filter((item) => !item.isEmbed)
    .map((item) => ({ ...item, label: item.label || 'Embed Stream' }));
}

// ===========================================================================
// D. STREAMING SERVICES (Netflix · Prime · Disney+ · Hulu · Max · Apple TV+ ·
//    Paramount+ · Peacock · Tubi · Pluto TV · Plex · Crunchyroll · JioHotstar ·
//    ZEE5 · Sony LIV · iQIYI · Viki · MUBI)
//
// Their paid titles are Widevine/FairPlay DRM and are never decrypted here.
// What these resolvers DO return: the public trailer / preview / free-tier
// stream that the same page serves to any anonymous visitor (og:video, JSON-LD,
// player config, non-DRM HLS). If a title is DRM-only we say so honestly.
// ===========================================================================
const STREAMING_HOST_PATTERNS = [
  /(^|\.)netflix\.com$/i,
  /(^|\.)primevideo\.com$/i,
  /(^|\.)amazon\.com$/i,
  /(^|\.)disneyplus\.com$/i,
  /(^|\.)hulu\.com$/i,
  /(^|\.)max\.com$/i,
  /(^|\.)hbomax\.com$/i,
  /(^|\.)tv\.apple\.com$/i,
  /(^|\.)paramountplus\.com$/i,
  /(^|\.)peacocktv\.com$/i,
  /(^|\.)tubitv\.com$/i,
  /(^|\.)pluto\.tv$/i,
  /(^|\.)(watch\.)?plex\.tv$/i,
  /(^|\.)crunchyroll\.com$/i,
  /(^|\.)(hotstar\.com|jiohotstar\.com|jiocinema\.com)$/i,
  /(^|\.)zee5\.com$/i,
  /(^|\.)sonyliv\.com$/i,
  /(^|\.)(iq\.com|iqiyi\.com)$/i,
  /(^|\.)viki\.com$/i,
  /(^|\.)mubi\.com$/i,
];

export function isStreamingServiceHost(hostname) {
  return STREAMING_HOST_PATTERNS.some((re) => re.test(String(hostname || '')));
}

const DRM_FREE_HINT =
  'This title is protected by Widevine/FairPlay DRM, so no downloader can legally fetch it. ' +
  'The free trailer / preview player below is supported — or try the free services (Tubi, Pluto TV, Plex, Peacock free, YouTube).';

// Public, key-free endpoints some of these services expose for their own players.
async function resolveStreamingTrailer(parsed, rawUrl, platform) {
  const page = await fetchText(rawUrl, { ua: DESKTOP_UA });
  if (!page || !page.ok) return null;

  const html = unescapeDeep(page.body);
  const sources = [];

  // 1) The site's own og:video / JSON-LD / player config (usually the trailer)
  const collected = await collectPageSources(html, page.finalUrl);
  collected
    .filter((item) => !item.isEmbed && /^https?:\/\//i.test(item.url || ''))
    .forEach((item) => sources.push({ ...item, label: 'Trailer / Preview' }));

  // 2) Pluto TV + Plex + Tubi expose plain HLS in their public JSON
  if (sources.length === 0 && /pluto\.tv$/i.test(parsed.hostname)) {
    const id = /\/(?:movies|series|live-tv|on-demand)\/([\w-]{6,})/i.exec(parsed.pathname)?.[1];
    if (id) {
      const meta = await fetchJson(
        `https://api.pluto.tv/v2/on-demand/movies?slug=${encodeURIComponent(id)}&sort=name`,
        { timeout: 10000 }
      );
      const item = Array.isArray(meta) ? meta[0] : meta?.items?.[0];
      const url = item?.stitched?.urls?.[0]?.url || item?.clip?.url;
      if (url) sources.push({ url, label: 'Free HLS Stream' });
    }
  }

  if (sources.length === 0 && /plex\.tv$/i.test(parsed.hostname)) {
    const mp4 = /"(https:[^"]+\.(?:mp4|m3u8)[^"]*)"/.exec(html)?.[1];
    if (mp4) sources.push({ url: unescapeDeep(mp4), label: 'Free Preview' });
  }

  if (sources.length === 0) return null;

  const deduped = [];
  const seen = new Set();
  for (const item of sources) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    deduped.push(item);
  }

  return buildUniversalResult({
    platform,
    canonicalUrl: page.finalUrl || rawUrl,
    title: pageTitle(html),
    thumbnailUrl: metaContent(html, 'og:image') || metaContent(html, 'twitter:image'),
    sources: deduped.slice(0, 4),
    extractorTier: 'streaming_trailer_preview',
  });
}

async function resolvePageIntelligence(rawUrl, platform) {
  const page = await fetchText(rawUrl, { ua: DESKTOP_UA });
  if (!page || !page.ok) return null;
  const html = unescapeDeep(page.body);
  const title = pageTitle(html);
  const thumbnail = metaContent(html, 'og:image') || metaContent(html, 'twitter:image');

  const collected = await collectPageSources(html, page.finalUrl);
  const sources = collected.filter((item) => !item.isEmbed);

  // og:video / oEmbed entries that are player pages (not files) → follow them.
  if (sources.length === 0) {
    const embedCandidates = collected.filter((item) => item.isEmbed).map((item) => item.url);
    for (const embedUrl of embedCandidates.slice(0, 2)) {
      const nestedSources = await followEmbedPage(embedUrl).catch(() => []);
      if (nestedSources.length) {
        sources.push(...nestedSources);
        break;
      }
    }
  }

  if (sources.length === 0) {
    const oembed = await resolveOEmbed(html, page.finalUrl);
    if (oembed) {
      const embed = oembed.find((s) => s.isEmbed);
      if (embed && embed.url !== rawUrl) {
        // Follow the official embed page once (YouTube/Vimeo/others are handled earlier).
        const nested = await fetchText(embed.url, { ua: DESKTOP_UA });
        if (nested?.ok) {
          const nestedHtml = unescapeDeep(nested.body);
          const direct =
            metaContent(nestedHtml, 'og:video:secure_url') ||
            metaContent(nestedHtml, 'og:video') ||
            /"file"\s*:\s*"([^"]+\.(?:mp4|m3u8)[^"]*)"/i.exec(nestedHtml)?.[1] ||
            '';
          if (/^https?:\/\//i.test(direct)) sources.push({ url: direct, label: 'Embed Stream' });
          sources.push(...extractJsonLdVideo(nestedHtml, nested.finalUrl));
          sources.push(...(await resolveKnownPlayers(nestedHtml, nested.finalUrl)));
        }
      }
      oembed
        .filter((s) => !s.isEmbed)
        .forEach((s) => sources.push(s));
    }
  }

  if (sources.length === 0) return null;

  return buildUniversalResult({
    platform,
    canonicalUrl: page.finalUrl || rawUrl,
    title,
    thumbnailUrl: thumbnail,
    sources,
    extractorTier: 'page_intelligence',
  });
}

// ===========================================================================
// MASTER CHAIN
// ===========================================================================
const EMBED_HOST_MAP = [
  { test: /streamtape\./i, fn: resolveStreamtape, label: 'Streamtape' },
  { test: /(dood\.|doodstream\.|ds2play\.|d000d\.)/i, fn: resolveDoodStream, label: 'DoodStream' },
  { test: /mixdrop\./i, fn: resolveMixDrop, label: 'MixDrop' },
  { test: /(voe\.|voe\.sx)/i, fn: (p, u) => resolveGenericEmbedHost(p, u, 'VOE'), label: 'VOE' },
  { test: /filemoon\./i, fn: (p, u) => resolveGenericEmbedHost(p, u, 'FileMoon'), label: 'FileMoon' },
  { test: /(streamwish|swish|wishembed)\./i, fn: (p, u) => resolveGenericEmbedHost(p, u, 'StreamWish'), label: 'StreamWish' },
  { test: /(lulustream|luluvdo|luluvid)\./i, fn: (p, u) => resolveGenericEmbedHost(p, u, 'LuluStream'), label: 'LuluStream' },
  { test: /vidmoly\./i, fn: (p, u) => resolveGenericEmbedHost(p, u, 'Vidmoly'), label: 'Vidmoly' },
  { test: /krakenfiles\./i, fn: (p, u) => resolveGenericEmbedHost(p, u, 'KrakenFiles'), label: 'KrakenFiles' },
  { test: /sendvid\./i, fn: (p, u) => resolveGenericEmbedHost(p, u, 'SendVid'), label: 'SendVid' },
];

export async function tryUniversalPlatformResolvers(rawUrl, platform, { depth = 0 } = {}) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();

  // --- Layer A: social networks -------------------------------------------
  const socialResolvers = [
    { test: /(^|\.)bsky\.app$/i, fn: resolveBluesky },
    { test: /(^|\.)(instagram\.com|instagr\.am)$/i, fn: resolveInstagram },
    { test: /(^|\.)threads\.(net|com)$/i, fn: resolveThreads },
    { test: /(^|\.)(pinterest\.\w+|pin\.it)$/i, fn: resolvePinterest },
    { test: /(^|\.)(t\.me|telegram\.me)$/i, fn: resolveTelegram },
    { test: /(^|\.)tumblr\.com$/i, fn: resolveTumblr },
    { test: /(^|\.)twitch\.tv$/i, fn: resolveTwitch },
    { test: /(^|\.)kick\.com$/i, fn: resolveKick },
    { test: /(^|\.)rumble\.com$/i, fn: resolveRumble },
    { test: /(^|\.)snapchat\.com$/i, fn: resolveSnapchat },
    { test: /(^|\.)linkedin\.com$/i, fn: resolveLinkedIn },
  ];

  for (const entry of socialResolvers) {
    if (!entry.test.test(host)) continue;
    const result = await entry.fn(parsed, rawUrl).catch(() => null);
    if (result) return result;
    break;
  }

  // Mastodon / federated: /@user/<statusId>
  if (/^\/@[^/]+\/\d{6,}/.test(parsed.pathname)) {
    const fedi = await resolveMastodon(parsed, rawUrl).catch(() => null);
    if (fedi) return fedi;
  }

  // --- Layer B: cloud / embed hosts ---------------------------------------
  for (const entry of EMBED_HOST_MAP) {
    if (!entry.test.test(host)) continue;
    const result = await entry.fn(parsed, rawUrl).catch(() => null);
    if (result) return result;
    break;
  }

  // --- Layer D: streaming services (trailer / preview / free tier) --------
  if (isStreamingServiceHost(host)) {
    const trailer = await resolveStreamingTrailer(parsed, rawUrl, platform).catch(() => null);
    if (trailer) return trailer;
    // No trailer found -> fall through to generic page intelligence (some services
    // ship a plain public MP4 preview in their own HTML). Only if that also fails
    // does the analyzer report DRM honestly.
  }

  // --- Layer C: page intelligence (only at the top level) ------------------
  if (depth === 0) {
    const intelligent = await resolvePageIntelligence(rawUrl, platform).catch(() => null);
    if (intelligent) return intelligent;
  }

  return null;
}

export const UNIVERSAL_RESOLVER_LIST = {
  social: [
    'bluesky_atproto_api',
    'instagram_embed_page',
    'instagram_public_api',
    'threads_embed_page',
    'pinterest_pin_json',
    'telegram_embed_page',
    'tumblr_post_html',
    'twitch_clip_page',
    'kick_clip_api',
    'rumble_embed_json',
    'snapchat_page_html',
    'linkedin_page_html',
    'mastodon_public_api',
  ],
  embedHosts: EMBED_HOST_MAP.map((e) => e.label),
  intelligence: ['page_intelligence', 'json_ld_video', 'oembed', 'wistia', 'kaltura', 'mux', 'loom', 'cloudflare_stream'],
};


// Exposed for the fixture test-suite (each parser is verified against the real
// markup shape of its host, even when the host blocks datacenter IPs).
export const __resolverTestables = {
  resolveBluesky,
  resolveMastodon,
  resolveInstagram,
  resolveThreads,
  resolvePinterest,
  resolveTelegram,
  resolveTumblr,
  resolveTwitch,
  resolveKick,
  resolveRumble,
  resolveSnapchat,
  resolveLinkedIn,
  resolveStreamtape,
  resolveDoodStream,
  resolveMixDrop,
  resolveGenericEmbedHost,
  collectPageSources,
  scanMediaUrls,
  buildUniversalResult,
};
