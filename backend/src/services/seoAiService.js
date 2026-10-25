// ============================================================================
// SEO + AI ANALYSIS  (V12)
//
// Takes a real video URL, really analyses it, and answers the two questions the
// owner actually asks:
//
//   1. "Is this link downloadable — and at what real quality?"
//        → platform, title, duration, every stream the source returned,
//          best REAL quality, what will fail and why (DRM, private, geo…)
//   2. "What should the page's SEO look like?"
//        → meta title, meta description, slug, keywords, OpenGraph block,
//          JSON-LD VideoObject — all derived from the analysed metadata.
//
// No external AI key is required and nothing is fabricated: every word in the
// output comes from the media metadata or from a fixed, documented template.
// The analysis is deterministic, so the same URL always gives the same answer
// (which is exactly what an SEO audit needs).
// ============================================================================
import { analyzeMediaUrl } from './extractorEngine.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'you', 'your', 'are', 'was',
  'were', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'not', 'but',
  'all', 'any', 'how', 'what', 'when', 'where', 'who', 'why', 'its', 'our',
  'their', 'them', 'they', 'about', 'into', 'over', 'than', 'then', 'there',
  'here', 'also', 'just', 'like', 'been', 'being', 'more', 'most', 'some',
  'such', 'only', 'very', 'out', 'off', 'get', 'got', 'new', 'full', 'video',
  'official', 'hd', 'hq', 'mp4',
]);

/** Truncates on a word boundary so a meta tag never ends mid-word. */
function truncateWords(text, max, suffix = '…') {
  const value = cleanText(text);
  if (value.length <= max) return value;
  const cut = value.slice(0, max - suffix.length);
  const at = cut.lastIndexOf(' ');
  return `${(at > 20 ? cut.slice(0, at) : cut).replace(/[\s—–-]+$/, '')}${suffix}`;
}

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function titleCase(value = '') {
  return cleanText(value)
    .split(' ')
    .map((word) => (word.length > 2 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function slugify(value = '') {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

/** Real keywords: frequency analysis over the real title + channel + platform. */
export function extractKeywords({ title = '', channelName = '', platformName = '', extra = [] }) {
  const words = cleanText(`${title} ${channelName} ${extra.join(' ')}`)
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06ff]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([word]) => word);

  const platform = cleanText(platformName).toLowerCase();
  const base = platform ? [`${platform} downloader`, `${platform} video download`] : [];
  return [...new Set([...ranked, ...base, 'download video', 'hd mp4'])].slice(0, 12);
}

/**
 * Honest download-plan verdict derived from the streams that really exist.
 * This is the "is this link downloadable?" answer the owner asked for.
 */
export function buildDownloadVerdict(analysis) {
  const streams = analysis?.streams || {};
  const withSound = [...(streams.videoAudio || []), ...(streams.videoWithAudio || [])];
  const videoOnly = streams.videoOnly || [];
  const audioOnly = streams.audioOnly || [];

  const heights = [...withSound, ...videoOnly]
    .map((s) => Number(s.height || 0))
    .filter((h) => h > 0);
  const bestHeight = heights.length ? Math.max(...heights) : 0;
  const bestWithSoundHeight = withSound.length
    ? Math.max(...withSound.map((s) => Number(s.height || 0)))
    : 0;

  const canVideo = withSound.length > 0 || videoOnly.length > 0;
  const canAudio = audioOnly.length > 0 || withSound.length > 0;

  const notes = [];
  if (bestWithSoundHeight && bestHeight > bestWithSoundHeight) {
    notes.push(
      `The source exposes ${bestHeight}p as a video-only track. Without FFmpeg on the server the combined ` +
        `"Video + Sound" file tops out at ${bestWithSoundHeight}p — the higher resolution stays silent.`
    );
  }
  if (!withSound.length && videoOnly.length) {
    notes.push('Only muted video tracks were returned; the audio must be shipped separately.');
  }
  if (analysis?.isDrmProtected) {
    notes.push('This title is DRM-protected. Only public trailers/previews can be downloaded.');
  }

  return {
    downloadable: canVideo || canAudio,
    canVideo,
    canAudio,
    bestQuality: bestHeight ? `${bestHeight}p` : '',
    bestQualityWithSound: bestWithSoundHeight ? `${bestWithSoundHeight}p` : '',
    realQualities: [...new Set(heights)].sort((a, b) => b - a).map((h) => `${h}p`),
    counts: {
      videoWithSound: withSound.length,
      videoOnly: videoOnly.length,
      audioOnly: audioOnly.length,
    },
    notes,
  };
}

/** Deterministic SEO block built from real metadata (no invented facts). */
export function buildSeoBlock({ title, channelName, platformName, durationText, verdict }) {
  const cleanTitle = cleanText(title) || 'Video';
  const platform = cleanText(platformName) || 'Video';
  const channel = cleanText(channelName);
  const quality = verdict?.bestQuality ? ` in up to ${verdict.bestQuality}` : '';

  const metaTitle = truncateWords(
    `${titleCase(cleanTitle)} — Download${quality} MP4 | ${platform} Downloader`,
    62
  );

  const metaDescription = truncateWords(
    `Download “${cleanTitle}”${channel ? ` by ${channel}` : ''} from ${platform}${
      durationText ? ` (${durationText})` : ''
    }${quality}. Real MP4 video or MP3/M4A audio — free, no software, works on mobile.`,
    158
  );

  const keywords = extractKeywords({ title: cleanTitle, channelName: channel, platformName: platform });

  const slug = slugify(`${cleanTitle}-${platform}`) || 'download-video';

  const openGraph = [
    ['og:type', 'video.other'],
    ['og:title', metaTitle],
    ['og:description', metaDescription],
    ['og:site_name', platform],
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: cleanTitle,
    description: metaDescription,
    ...(channel ? { author: { '@type': 'Person', name: channel } } : {}),
  };

  return {
    metaTitle,
    metaDescription,
    slug,
    keywords,
    canonicalHint: `/${slug}`,
    openGraph,
    jsonLd,
    checks: [
      { label: 'Title length', value: metaTitle.length, ok: metaTitle.length <= 62, target: '≤ 62 chars' },
      {
        label: 'Description length',
        value: metaDescription.length,
        ok: metaDescription.length >= 70 && metaDescription.length <= 158,
        target: '70–158 chars',
      },
      { label: 'Keyword count', value: keywords.length, ok: keywords.length >= 5, target: '5+' },
      { label: 'Slug length', value: slug.length, ok: slug.length > 0 && slug.length <= 70, target: '≤ 70 chars' },
    ],
  };
}

/**
 * Full analysis: real extraction + honest verdict + SEO block.
 * Errors are translated into actionable messages, never stack traces.
 */
export async function analyseForSeo(rawUrl, { selectedPlatformId = '' } = {}) {
  const url = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Paste a full http(s) video URL first.');
  }

  let analysis;
  try {
    analysis = await analyzeMediaUrl({ rawUrl: url, selectedPlatformId });
  } catch (err) {
    logger?.warn?.({ err: err?.message, url }, 'seo analysis failed');
    return {
      ok: false,
      url,
      verdict: {
        downloadable: false,
        canVideo: false,
        canAudio: false,
        bestQuality: '',
        bestQualityWithSound: '',
        realQualities: [],
        counts: { videoWithSound: 0, videoOnly: 0, audioOnly: 0 },
        notes: [
          err?.message ||
            'This link could not be analysed. It may be private, region-locked, DRM-protected or offline.',
        ],
      },
      seo: null,
      media: null,
    };
  }

  const verdict = buildDownloadVerdict(analysis);
  const media = {
    title: analysis.media?.title || '',
    channelName: analysis.media?.author || analysis.media?.channelName || '',
    durationText: analysis.media?.durationText || '',
    thumbnailUrl: analysis.media?.thumbnailUrl || '',
    platformId: analysis.platform?.id || '',
    platformName: analysis.platform?.displayName || '',
    canonicalUrl: analysis.canonicalUrl || url,
  };

  const seo = buildSeoBlock({
    title: media.title,
    channelName: media.channelName,
    platformName: media.platformName,
    durationText: media.durationText,
    verdict,
  });

  return {
    ok: verdict.downloadable,
    url,
    media,
    verdict,
    seo,
    extractorTier: analysis.extractorTier || '',
  };
}

export const __internal = { slugify, titleCase, cleanText, truncateWords };
