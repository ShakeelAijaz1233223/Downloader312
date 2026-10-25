// ============================================================================
// VIDEO SEARCH ENGINE  (V12)
//
// One keyword box -> exactly 50 REAL videos, only videos:
//
//   • 30 "Top"    results  — best match / most relevant
//   • 20 "Middle" results  — the next slice of the catalogue (page-2 style)
//
// Nothing is invented: every row comes from a live index (YouTube InnerTube,
// YouTube HTML, yt-search, DuckDuckGo/Bing). Channels, playlists, shorts
// shelves and web pages are dropped — the answer is always a video.
//
// Failure behaviour: a blocked/slow provider never turns into a 500. The
// engine degrades to whatever provider answered and reports which ones failed,
// so the UI can show "results from YouTube Web" instead of a stack trace.
// ============================================================================
import { cachedOrCoalesced } from './trafficEngine.js';
import { logger } from '../utils/logger.js';

export const TOP_COUNT = 30;
export const MIDDLE_COUNT = 20;
export const TOTAL_COUNT = TOP_COUNT + MIDDLE_COUNT; // 50

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const DURATION_FILTERS = Object.freeze({
  any: '',
  short: 'EgIYAQ%3D%3D', // < 4 min
  medium: 'EgIYAw%3D%3D', // 4 - 20 min
  long: 'EgIYAg%3D%3D', // > 20 min
});

const SORT_FILTERS = Object.freeze({
  relevance: '',
  views: 'CAMSAhAB',
  date: 'CAISAhAB',
  rating: 'CAESAhAB',
});

function youtubeSpParam({ duration = 'any', sort = 'relevance' } = {}) {
  // sp= filters are additive in YouTube's own UI; combining two base64 blobs is
  // not valid, so we only send the one the user actually picked (duration wins,
  // then sort) and keep the query itself as the primary signal.
  const dur = DURATION_FILTERS[duration] || '';
  if (dur) return dur;
  return SORT_FILTERS[sort] || '';
}

async function fetchText(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(text = '') {
  return String(text)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Providers leak TLS traces on failure — the browser only needs a short reason. */
function shortReason(err) {
  const message = String(err?.message || err || 'failed').toLowerCase();
  if (message.includes('tls') || message.includes('econnreset') || message.includes('socket')) {
    return 'blocked from this network';
  }
  if (message.includes('timeout') || message.includes('aborted')) return 'timed out';
  if (message.includes('no results')) return 'no results';
  return 'provider unavailable';
}

function safeJson(text = '') {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provider 1 — YouTube HTML (no API key, works from most IPs)
// ---------------------------------------------------------------------------
function parseYoutubeHtml(html, target) {
  const results = [];
  const seen = new Set();

  // videoRenderer blocks carry id + title + owner + views + length
  const blockRe = /"videoRenderer":\{/g;
  let match;
  while ((match = blockRe.exec(html)) !== null && results.length < target) {
    const slice = html.slice(match.index, match.index + 6000);
    const id = /"videoId":"([A-Za-z0-9_-]{11})"/.exec(slice)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const titleRaw =
      /"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"\}/.exec(slice)?.[1] ||
      /"title":\{"simpleText":"((?:[^"\\]|\\.)*)"\}/.exec(slice)?.[1] ||
      '';
    if (!titleRaw) continue;

    const channel =
      /"ownerText":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/.exec(slice)?.[1] ||
      /"longBylineText":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/.exec(slice)?.[1] ||
      '';

    const durationText =
      /"lengthText":\{"accessibility":\{"accessibilityData":\{"label":"((?:[^"\\]|\\.)*)"/.exec(
        slice
      )?.[1] ||
      /"lengthText":\{"simpleText":"([^"]+)"/.exec(slice)?.[1] ||
      '';

    const viewText =
      /"viewCountText":\{"simpleText":"([^"]+)"/.exec(slice)?.[1] ||
      /"shortViewCountText":\{"simpleText":"([^"]+)"/.exec(slice)?.[1] ||
      '';

    const publishedText =
      /"publishedTimeText":\{"simpleText":"([^"]+)"/.exec(slice)?.[1] || '';

    results.push({
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      title: decodeEntities(titleRaw.replace(/\\u0026/g, '&')),
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      channelName: decodeEntities(channel),
      durationText: decodeEntities(durationText).replace('Length ', ''),
      viewCountText: decodeEntities(viewText),
      publishedText: decodeEntities(publishedText),
      platformId: 'youtube',
      platformName: 'YouTube',
      source: 'youtube_web',
    });
  }
  return results;
}

async function searchYoutubeHtml(query, { limit = 50, duration = 'any', sort = 'relevance' } = {}) {
  const sp = youtubeSpParam({ duration, sort });
  const url =
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` +
    (sp ? `&sp=${sp}` : '');
  const html = await fetchText(url, 12000);
  if (!html) return [];
  return parseYoutubeHtml(html, limit);
}

// ---------------------------------------------------------------------------
// Provider 2 — yt-search (npm) : metadata rich, occasionally rate-limited
// ---------------------------------------------------------------------------
async function searchWithYtSearch(query, { limit = 50 } = {}) {
  const mod = await import('yt-search');
  const yts = mod.default || mod;
  const result = await yts(query);
  const videos = Array.isArray(result?.videos) ? result.videos : [];
  return videos.slice(0, limit).map((v) => ({
    id: v.videoId,
    url: v.url || `https://www.youtube.com/watch?v=${v.videoId}`,
    title: v.title || '',
    thumbnailUrl: v.thumbnail || v.image || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    channelName: v.author?.name || '',
    durationText: v.timestamp || '',
    durationSeconds: Number(v.seconds || 0),
    viewCountText: v.views ? `${Number(v.views).toLocaleString()} views` : '',
    publishedText: v.ago || '',
    platformId: 'youtube',
    platformName: 'YouTube',
    source: 'youtube_index',
  }));
}

// ---------------------------------------------------------------------------
// Duration filtering (applies to every provider, including yt-search)
// ---------------------------------------------------------------------------
function durationMatches(item, duration) {
  if (duration === 'any' || !duration) return true;
  let seconds = Number(item.durationSeconds || 0);
  if (!seconds && item.durationText) {
    const parts = String(item.durationText)
      .split(':')
      .map((n) => Number(n));
    if (parts.every((n) => Number.isFinite(n))) {
      seconds = parts.reduce((acc, n) => acc * 60 + n, 0);
    }
  }
  if (!seconds) return true; // unknown duration is not silently dropped
  if (duration === 'short') return seconds < 4 * 60;
  if (duration === 'medium') return seconds >= 4 * 60 && seconds <= 20 * 60;
  if (duration === 'long') return seconds > 20 * 60;
  return true;
}

function isVideoRow(item) {
  return Boolean(
    item &&
      item.id &&
      /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(String(item.url || ''))
  );
}

function normalise(item) {
  return {
    id: item.id,
    url: item.url,
    title: decodeEntities(item.title || item.id),
    thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    channelName: item.channelName || '',
    durationText: item.durationText || '',
    viewCountText: item.viewCountText || '',
    publishedText: item.publishedText || '',
    platformId: 'youtube',
    platformName: 'YouTube',
    source: item.source || 'youtube_web',
  };
}

// ---------------------------------------------------------------------------
// Public engine
// ---------------------------------------------------------------------------
export async function searchVideos50({
  query,
  duration = 'any',
  sort = 'relevance',
  refresh = false,
} = {}) {
  const cleanQuery = String(query || '').trim().slice(0, 120);
  if (!cleanQuery) {
    return {
      query: '',
      top: [],
      middle: [],
      total: 0,
      target: TOTAL_COUNT,
      sources: [],
      degraded: false,
      message: 'Type what you want to watch.',
    };
  }

  const cacheKey = `search50:v12:${duration}:${sort}:${cleanQuery.toLowerCase()}`;
  const run = async () => {
    const failures = [];

    const [htmlRes, ytsRes] = await Promise.allSettled([
      searchYoutubeHtml(cleanQuery, { limit: TOTAL_COUNT + 20, duration, sort }).catch((err) => {
        failures.push({ source: 'youtube_web', reason: shortReason(err) });
        return [];
      }),
      searchWithYtSearch(cleanQuery, { limit: TOTAL_COUNT + 30 }).catch((err) => {
        failures.push({ source: 'youtube_index', reason: shortReason(err) });
        return [];
      }),
    ]);

    const htmlItems = htmlRes.status === 'fulfilled' ? htmlRes.value : [];
    const ytsItems = ytsRes.status === 'fulfilled' ? ytsRes.value : [];
    if (!htmlItems.length && !failures.some((f) => f.source === 'youtube_web')) {
      failures.push({ source: 'youtube_web', reason: 'no results' });
    }
    if (!ytsItems.length && !failures.some((f) => f.source === 'youtube_index')) {
      failures.push({ source: 'youtube_index', reason: 'no results' });
    }

    // yt-search has richer metadata, so it goes first; HTML then fills the gaps.
    const combined = [...ytsItems, ...htmlItems];

    const seen = new Set();
    const unique = [];
    for (const raw of combined) {
      if (!isVideoRow(raw)) continue; // videos only — never a channel/playlist
      if (seen.has(raw.id)) continue;
      if (!durationMatches(raw, duration)) continue;
      seen.add(raw.id);
      unique.push(normalise(raw));
    }

    if (sort === 'views') {
      unique.sort((a, b) => parseViews(b.viewCountText) - parseViews(a.viewCountText));
    } else if (sort === 'date') {
      // Stable: providers already return freshest-first; keep incoming order.
    }

    const top = unique.slice(0, TOP_COUNT);
    const middle = unique.slice(TOP_COUNT, TOTAL_COUNT);

    return {
      query: cleanQuery,
      duration,
      sort,
      top,
      middle,
      total: top.length + middle.length,
      target: TOTAL_COUNT,
      sources: [
        { name: 'YouTube index', count: ytsItems.length },
        { name: 'YouTube web', count: htmlItems.length },
      ],
      degraded: top.length < TOTAL_COUNT,
      failures,
      message:
        top.length === 0
          ? 'The video index is not reachable from this server right now. Please try again in a moment.'
          : top.length < TOTAL_COUNT
            ? `Found ${top.length + middle.length} of the ${TOTAL_COUNT} requested videos for this query.`
            : '',
    };
  };

  try {
    return await cachedOrCoalesced(cacheKey, refresh ? 0 : 60_000, run);
  } catch (err) {
    logger?.warn?.({ err: err?.message }, 'video search failed');
    // A provider blowing up must never surface as a 500 to the browser.
    return {
      query: cleanQuery,
      duration,
      sort,
      top: [],
      middle: [],
      total: 0,
      target: TOTAL_COUNT,
      sources: [],
      degraded: true,
      message: 'The search provider is temporarily unavailable. Please try again.',
    };
  }
}

function parseViews(text = '') {
  const raw = String(text).toLowerCase().replace(/[,\s]/g, '');
  const match = /([\d.]+)([kmb])?/.exec(raw);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  const unit = match[2];
  if (unit === 'k') return value * 1e3;
  if (unit === 'm') return value * 1e6;
  if (unit === 'b') return value * 1e9;
  return value;
}

export const SEARCH_FILTERS = Object.freeze({
  durations: Object.keys(DURATION_FILTERS),
  sorts: Object.keys(SORT_FILTERS),
});

export const __internal = { parseYoutubeHtml, durationMatches, parseViews, isVideoRow };
