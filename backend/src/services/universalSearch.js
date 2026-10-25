// ============================================================================
// UNIVERSAL ANYTHING-SEARCH  (Round-10)
//
// One keyword box -> many sources in parallel:
//   1. YouTube InnerTube search            (best metadata, works from real IPs)
//   2. YouTube results HTML                (fallback when the API is blocked)
//   3. DuckDuckGo HTML                     (covers every website, not just YT)
//   4. Bing HTML                           (second web index)
//   5. Direct video-platform search URLs   (Dailymotion, Vimeo, Archive…)
//
// Only real, clickable results are returned — nothing invented.
// ============================================================================
import { searchLiveVideos } from './extractorEngine.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchText(url, timeout = 12000) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

function clean(text = '') {
  return String(text)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeYtThumb(id) {
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
}

// --- 2. YouTube HTML results ------------------------------------------------
async function searchYoutubeHtml(query, limit = 8) {
  const html = await fetchText(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`
  );
  if (!html) return [];
  const items = [];
  const seen = new Set();
  const re = /"videoRenderer":\s*\{[\s\S]{0,4000}?"videoId":"([A-Za-z0-9_-]{11})"[\s\S]{0,600}?"title":\s*\{"runs":\[\{"text":"([^"]{2,200})"\}\]/g;
  let m;
  while ((m = re.exec(html)) !== null && items.length < limit) {
    const [, id, title] = m;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: clean(title),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: decodeYtThumb(id),
      platformId: 'youtube',
      platformName: 'YouTube',
      source: 'youtube_html',
      durationText: '',
      uploader: '',
    });
  }
  return items;
}

// --- 3. DuckDuckGo HTML -----------------------------------------------------
async function searchDuckDuckGo(query, limit = 6) {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  if (!html) return [];
  const items = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null && items.length < limit) {
    let href = m[1];
    if (href.startsWith('//duckduckgo.com/l/?uddg=')) {
      href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]);
    }
    if (!/^https?:\/\//i.test(href)) continue;
    items.push({
      id: href.slice(-24),
      title: clean(m[2]),
      url: href,
      thumbnailUrl: '',
      platformId: 'web',
      platformName: new URL(href).hostname.replace(/^www\./, ''),
      source: 'duckduckgo',
      durationText: '',
      uploader: '',
    });
  }
  return items;
}

// --- 4. Bing HTML -----------------------------------------------------------
async function searchBing(query, limit = 6) {
  const html = await fetchText(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en`);
  if (!html) return [];
  const items = [];
  const re = /<h2><a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>/g;
  let m;
  while ((m = re.exec(html)) !== null && items.length < limit) {
    const href = m[1];
    if (!/^https?:\/\//i.test(href)) continue;
    if (/bing\.com|microsoft\.com\/…/.test(href)) continue;
    items.push({
      id: href.slice(-24),
      title: clean(m[2]),
      url: href,
      thumbnailUrl: '',
      platformId: 'web',
      platformName: new URL(href).hostname.replace(/^www\./, ''),
      source: 'bing',
      durationText: '',
      uploader: '',
    });
  }
  return items;
}

// --- 5. Platform search pages (always linkable) -----------------------------
function platformSearchLinks(query) {
  const q = encodeURIComponent(query);
  return [
    { platformId: 'dailymotion', platformName: 'Dailymotion', title: `Dailymotion results for “${query}”`, url: `https://www.dailymotion.com/search/${q}/videos` },
    { platformId: 'vimeo', platformName: 'Vimeo', title: `Vimeo results for “${query}”`, url: `https://vimeo.com/search?q=${q}` },
    { platformId: 'archive', platformName: 'Internet Archive', title: `Internet Archive results for “${query}”`, url: `https://archive.org/search?query=${q}` },
    { platformId: 'bilibili', platformName: 'Bilibili', title: `Bilibili results for “${query}”`, url: `https://search.bilibili.com/all?keyword=${q}` },
  ].map((x) => ({ ...x, id: x.platformId + q.slice(0, 10), thumbnailUrl: '', source: 'platform_search', durationText: '' }));
}

export async function universalAnythingSearch({ query, limit = 12 }) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return { query: '', items: [], sources: [] };

  const [youtube, ytHtml, ddg, bing] = await Promise.allSettled([
    searchLiveVideos({ query: cleanQuery, limit }),
    searchYoutubeHtml(cleanQuery, 8),
    searchDuckDuckGo(`${cleanQuery} video`, 6),
    searchBing(`${cleanQuery} video`, 6),
  ]);

  const sources = [];
  const items = [];
  const seen = new Set();
  const push = (list, name) => {
    const arr = Array.isArray(list) ? list : [];
    let added = 0;
    for (const it of arr) {
      const key = String(it.url || it.id || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push(it);
      added += 1;
      if (items.length >= limit) break;
    }
    sources.push({ name, count: added });
  };

  if (youtube.status === 'fulfilled') push(youtube.value?.items, 'YouTube API');
  push(ytHtml.status === 'fulfilled' ? ytHtml.value : [], 'YouTube Web');
  push(ddg.status === 'fulfilled' ? ddg.value : [], 'DuckDuckGo');
  push(bing.status === 'fulfilled' ? bing.value : [], 'Bing');

  // Always keep the platform quick-links at the end (never empty results).
  if (items.length < 4) push(platformSearchLinks(cleanQuery), 'Platform Search');

  return { query: cleanQuery, items: items.slice(0, limit), sources };
}
