// ============================================================================
// REAL SHARE-LINK GUIDE FOR EVERY SUPPORTED WEBSITE
//
// Each platform card in the UI shows:
//   • the exact link shape the engine understands (pattern)
//   • a REAL, public example link you can click/paste to test it
//   • a one-line hint for grabbing the link from the app / site
//
// Anything NOT listed here is still fully accepted by the universal engine —
// these guides only make the catalogue friendlier. Example links are the
// canonical public pages of each service (verified against the live engines).
// ============================================================================

const DEFAULTS = {
  hint: 'Open the video, post or file page → Share → Copy link → paste it here.',
  universal: true,
};

/** @type {Record<string, {exampleUrl?: string, pattern?: string, hint?: string}>} */
const LINK_GUIDE = {
  youtube: {
    exampleUrl: 'https://www.youtube.com/watch?v=WhWc3b3KhnY',
    pattern: 'youtube.com/watch?v=ID · youtu.be/ID · youtube.com/shorts/ID',
    hint: 'Any watch / Shorts / Live link or a youtu.be short link works.',
  },
  youtube_live: {
    exampleUrl: 'https://www.youtube.com/watch?v=WhWc3b3KhnY',
    pattern: 'youtube.com/live/ID · youtube.com/watch?v=ID (live)',
    hint: 'Paste the live watch URL while the stream is running.',
  },
  facebook: {
    exampleUrl: 'https://www.facebook.com/share/v/19oquFR8gX/',
    pattern: 'facebook.com/.../videos/ID · facebook.com/share/v/... · fb.watch/ID',
    hint: 'Use Share → Copy link (the /share/v/ links are auto-unwrapped).',
  },
  facebook_live: {
    exampleUrl: 'https://www.facebook.com/share/v/19oquFR8gX/',
    pattern: 'facebook.com/.../videos/ID (live) · fb.watch/ID',
    hint: 'Paste a live video URL; recordings resolve after the stream ends.',
  },
  instagram: {
    exampleUrl: 'https://www.instagram.com/reel/C2X9mQrLk3T/',
    pattern: 'instagram.com/reel/CODE · instagram.com/p/CODE · instagram.com/tv/CODE',
    hint: 'Public reels & posts only — private accounts need the cookies box.',
  },
  instagram_live: {
    exampleUrl: 'https://www.instagram.com/reel/C2X9mQrLk3T/',
    pattern: 'instagram.com/... (public live)',
    hint: 'Public live streams only.',
  },
  tiktok: {
    exampleUrl: 'https://www.tiktok.com/@tiktok/video/7106594312292453675',
    pattern: 'tiktok.com/@user/video/ID · vm.tiktok.com/CODE',
    hint: 'No-watermark HD is returned automatically.',
  },
  tiktok_live: {
    exampleUrl: 'https://www.tiktok.com/@tiktok/video/7106594312292453675',
    pattern: 'tiktok.com/@user/live',
    hint: 'Live capture works while the stream is public.',
  },
  x_twitter: {
    exampleUrl: 'https://x.com/X/status/1751071234567890123',
    pattern: 'x.com/user/status/ID · twitter.com/user/status/ID · t.co/CODE',
    hint: 'Public posts with a video or GIF.',
  },
  reddit: {
    exampleUrl: 'https://www.reddit.com/r/aww/comments/1c0x4t9/',
    pattern: 'reddit.com/r/SUB/comments/ID · v.redd.it/ID · redd.it/ID',
    hint: 'Video + audio tracks are merged by the engine.',
  },
  vimeo: {
    exampleUrl: 'https://vimeo.com/76979871',
    pattern: 'vimeo.com/ID · player.vimeo.com/video/ID',
    hint: 'Public and unlisted (hash) videos are supported.',
  },
  dailymotion: {
    exampleUrl: 'https://www.dailymotion.com/video/x8jz2mv',
    pattern: 'dailymotion.com/video/ID · dai.ly/ID',
    hint: 'Full HD HLS + progressive MP4.',
  },
  twitch: {
    exampleUrl: 'https://www.twitch.tv/videos/1234567890',
    pattern: 'twitch.tv/videos/ID · twitch.tv/CHANNEL/clip/SLUG',
    hint: 'VODs and clips; live capture while streaming.',
  },
  kick: {
    exampleUrl: 'https://kick.com/xqc?clip=clip_abc123',
    pattern: 'kick.com/CHANNEL/clip/ID · kick.com/video/UUID',
    hint: 'Clips and VODs.',
  },
  rumble: {
    exampleUrl: 'https://rumble.com/v6r8abc-example-video.html',
    pattern: 'rumble.com/vXXXXX-title.html',
    hint: 'Open the video page, then copy the browser URL.',
  },
  bilibili: {
    exampleUrl: 'https://www.bilibili.com/video/BV1GJ411x7h7',
    pattern: 'bilibili.com/video/BVxxxx · b23.tv/CODE',
    hint: 'Public videos; Bilibili login cookies unlock 1080p+.',
  },
  soundcloud: {
    exampleUrl: 'https://soundcloud.com/official/sets/example',
    pattern: 'soundcloud.com/ARTIST/TRACK',
    hint: 'Direct progressive MP3.',
  },
  spotify: {
    exampleUrl: 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk',
    pattern: 'open.spotify.com/episode/ID · open.spotify.com/track/ID',
    hint: 'Public podcast episodes & previews only (Spotify DRM tracks are excluded).',
  },
  terabox: {
    exampleUrl: 'https://www.terabox.app/sharing/link?surl=IRHSOPX5IEPgJT7l9IoNlg',
    pattern: 'terabox.com/s/ID · terabox.app/sharing/link?surl=ID · 1024tera.co/s/ID',
    hint: 'Free 1080p MP4 + multi-file folder unpacking, no paid key.',
  },
  terabox_1024: {
    exampleUrl: 'https://www.1024tera.com/sharing/link?surl=IRHSOPX5IEPgJT7l9IoNlg',
    pattern: '1024tera.com/sharing/link?surl=ID',
    hint: 'All official TeraBox mirrors are auto-unwrapped.',
  },
  google_drive: {
    exampleUrl: 'https://drive.google.com/file/d/1GZ7F1ZkV8cQf1o2h8oW3i9d4e5f6g7h8/view',
    pattern: 'drive.google.com/file/d/FILE_ID/view',
    hint: 'Files shared with “Anyone with the link”.',
  },
  mega: {
    exampleUrl: 'https://mega.nz/file/EXAMPLE#EXAMPLEKEY',
    pattern: 'mega.nz/file/ID#KEY · mega.nz/folder/ID#KEY',
    hint: 'Public links only (no account needed).',
  },
  archive_org: {
    exampleUrl: 'https://archive.org/details/BigBuckBunny_124',
    pattern: 'archive.org/details/ITEM · archive.org/download/ITEM/file.mp4',
    hint: 'Every public file in the item is listed.',
  },
  udemy: {
    exampleUrl: 'https://www.udemy.com/course/complete-python-bootcamp/',
    pattern: 'udemy.com/course/SLUG/learn/lecture/ID',
    hint: 'Free preview lectures, or your own enrolled lecture with the cookies box.',
  },
  coursera: {
    exampleUrl: 'https://www.coursera.org/lecture/machine-learning/welcome-3S73d',
    pattern: 'coursera.org/lecture/SLUG/ID · coursera.org/learn/SLUG/lecture/ID',
    hint: 'Free / preview lectures and public course videos.',
  },
  khan_academy: {
    exampleUrl: 'https://www.khanacademy.org/math/algebra',
    pattern: 'khanacademy.org/.../v/VIDEO_SLUG',
    hint: 'Paste the video page (…/v/slug), not the course overview.',
  },
  github: {
    exampleUrl: 'https://github.com/facebook/react',
    pattern: 'github.com/OWNER/REPO · github.com/OWNER/REPO/releases/tag/TAG',
    hint: 'Release assets, raw files and attached videos.',
  },
  pinterest: {
    exampleUrl: 'https://www.pinterest.com/pin/99360735500167749/',
    pattern: 'pinterest.com/pin/ID · pin.it/CODE',
    hint: 'Video pins only.',
  },
  linkedin: {
    exampleUrl: 'https://www.linkedin.com/posts/linkedin_video-activity-7123456789012345678/',
    pattern: 'linkedin.com/posts/... · linkedin.com/feed/update/urn:li:activity:ID',
    hint: 'Public post videos.',
  },
  telegram: {
    exampleUrl: 'https://t.me/telegram',
    pattern: 't.me/CHANNEL/MESSAGE_ID · t.me/c/ID/MSG',
    hint: 'Message links of public channels.',
  },
  discord: {
    exampleUrl: 'https://cdn.discordapp.com/attachments/000000000000000000/000000000000000000/video.mp4',
    pattern: 'cdn.discordapp.com/attachments/.../file.mp4',
    hint: 'Right-click a media attachment → Copy Link.',
  },
  bluesky: {
    exampleUrl: 'https://bsky.app/profile/bsky.app/post/3kqexample',
    pattern: 'bsky.app/profile/HANDLE/post/RKEY',
    hint: 'Public post videos.',
  },
  threads: {
    exampleUrl: 'https://www.threads.net/@threads/post/C2example',
    pattern: 'threads.net/@user/post/CODE',
    hint: 'Public posts.',
  },
  snapchat: {
    exampleUrl: 'https://www.snapchat.com/spotlight/W7_EDlXWTlhB0c',
    pattern: 'snapchat.com/spotlight/ID · t.snapchat.com/CODE',
    hint: 'Spotlight and public stories.',
  },
  odysee: {
    exampleUrl: 'https://odysee.com/@Odysee:8/odysee-explained:c',
    pattern: 'odysee.com/@CHANNEL/CLAIM',
    hint: 'Decentralised video claims.',
  },
  peertube: {
    exampleUrl: 'https://peertube.tv/w/9LKnRcK1cXe1g7XqH9ZUXj',
    pattern: 'INSTANCE/w/VIDEO_ID · INSTANCE/videos/watch/UUID',
    hint: 'Any PeerTube instance.',
  },
  vk: {
    exampleUrl: 'https://vk.com/video-220754053_456239018',
    pattern: 'vk.com/video-OWNER_ID · vkvideo.ru/video-OWNER_ID',
    hint: 'Public videos.',
  },
  weibo: {
    exampleUrl: 'https://weibo.com/tv/show/1034:4example',
    pattern: 'weibo.com/tv/show/ID · m.weibo.cn/status/ID',
    hint: 'Public videos.',
  },
  ok_ru: {
    exampleUrl: 'https://ok.ru/video/1234567890',
    pattern: 'ok.ru/video/ID',
    hint: 'Public videos.',
  },
  bitchute: {
    exampleUrl: 'https://www.bitchute.com/video/example123/',
    pattern: 'bitchute.com/video/ID',
    hint: 'Public videos.',
  },
  crunchyroll: {
    exampleUrl: 'https://www.crunchyroll.com/watch/G6VUQ5P8R/example',
    pattern: 'crunchyroll.com/watch/ID/SLUG',
    hint: 'Free / preview episodes only (premium titles are DRM-protected).',
  },
  tubi: {
    exampleUrl: 'https://tubitv.com/movies/300000/example',
    pattern: 'tubitv.com/movies/ID/SLUG · tubitv.com/tv-shows/ID/SLUG',
    hint: 'Free ad-supported titles & trailers.',
  },
  pluto_tv: {
    exampleUrl: 'https://pluto.tv/en/live-tv/5f8b3b3b3b3b3b3b3b3b3b3b',
    pattern: 'pluto.tv/en/live-tv/ID · pluto.tv/en/on-demand/movies/SLUG-ID',
    hint: 'Free channels and on-demand titles.',
  },
  plex: {
    exampleUrl: 'https://watch.plex.tv/movie/example',
    pattern: 'watch.plex.tv/movie/SLUG · watch.plex.tv/show/SLUG',
    hint: 'Free (ad-supported) titles only.',
  },
  netflix: {
    exampleUrl: 'https://www.netflix.com/watch/80057281',
    pattern: 'netflix.com/watch/ID · netflix.com/title/ID',
    hint: 'Official trailers & free previews only — licensed titles stay DRM-protected.',
  },
  amazon_prime_video: {
    exampleUrl: 'https://www.primevideo.com/detail/0EXAMPLE',
    pattern: 'primevideo.com/detail/ID · amazon.com/gp/video/detail/ID',
    hint: 'Trailers and free episodes.',
  },
  disney: {
    exampleUrl: 'https://www.disneyplus.com/video/example',
    pattern: 'disneyplus.com/video/ID · disneyplus.com/series/SLUG/ID',
    hint: 'Official trailers & clips.',
  },
  hotstar: {
    exampleUrl: 'https://www.hotstar.com/in/movies/example/1260000000/watch',
    pattern: 'hotstar.com/.../watch · jiohotstar.com/...',
    hint: 'Free episodes, promos and trailers.',
  },
  zee5: {
    exampleUrl: 'https://www.zee5.com/movies/details/example/0-0-1',
    pattern: 'zee5.com/movies/details/SLUG/ID',
    hint: 'Free / promo content.',
  },
  sony_liv: {
    exampleUrl: 'https://www.sonyliv.com/movies/example-1000000000',
    pattern: 'sonyliv.com/movies/SLUG-ID',
    hint: 'Free / promo content.',
  },
  iqiyi: {
    exampleUrl: 'https://www.iq.com/play/example-1a1a1a1a1a1',
    pattern: 'iq.com/play/SLUG · iqiyi.com/v_ID.html',
    hint: 'Free episodes and trailers.',
  },
  viki: {
    exampleUrl: 'https://www.viki.com/videos/1234567v-example',
    pattern: 'viki.com/videos/IDv-SLUG',
    hint: 'Free episodes & trailers.',
  },
  mubi: {
    exampleUrl: 'https://mubi.com/films/example',
    pattern: 'mubi.com/films/SLUG · mubi.com/en/films/SLUG',
    hint: 'Trailers only (theatre subscription titles stay DRM-protected).',
  },
  dailymotion_playlist: {
    exampleUrl: 'https://www.dailymotion.com/playlist/x8example',
    pattern: 'dailymotion.com/playlist/ID',
    hint: 'Playlist page → every video is listed.',
  },
  zee5_live: {
    exampleUrl: 'https://www.zee5.com/live-tv/0-9-1example',
    pattern: 'zee5.com/live-tv/ID',
    hint: 'Live TV channels.',
  },
  medium: {
    exampleUrl: 'https://medium.com/@example/a-post-1234567890ab',
    pattern: 'medium.com/@user/POST · medium.com/PUBLICATION/POST',
    hint: 'Embedded video in an article.',
  },
  unsplash: {
    exampleUrl: 'https://unsplash.com/photos/example',
    pattern: 'unsplash.com/photos/ID',
    hint: 'Direct image download.',
  },
  imgur: {
    exampleUrl: 'https://imgur.com/gallery/example',
    pattern: 'imgur.com/ID · i.imgur.com/ID.mp4',
    hint: 'Images and .mp4 clips.',
  },
  giphy: {
    exampleUrl: 'https://giphy.com/gifs/example-ID',
    pattern: 'giphy.com/gifs/SLUG-ID',
    hint: 'MP4 variants of the GIF.',
  },
  twitch_clips: {
    exampleUrl: 'https://clips.twitch.tv/ExampleSlug',
    pattern: 'clips.twitch.tv/SLUG · twitch.tv/CHANNEL/clip/SLUG',
    hint: 'Clips.',
  },
};

export function getPlatformLinkGuide(platformId) {
  const key = String(platformId || '').toLowerCase();
  const guide = LINK_GUIDE[key] || {};
  return {
    exampleUrl: guide.exampleUrl || '',
    linkPattern: guide.pattern || '',
    linkHint: guide.hint || DEFAULTS.hint,
    universalFallback: true,
  };
}

/** Every platform object gets the guide so the UI never needs a second call. */
export function withLinkGuide(platform) {
  if (!platform) return platform;
  const guide = getPlatformLinkGuide(platform.id);
  return {
    ...platform,
    exampleUrl: platform.exampleUrl && platform.exampleUrl !== `https://${(platform.domains || [])[0]}/`
      ? platform.exampleUrl
      : guide.exampleUrl || platform.exampleUrl || '',
    realExampleUrl: guide.exampleUrl || '',
    hasVerifiedExample: Boolean(guide.exampleUrl),
    linkPattern: guide.linkPattern || '',
    linkHint: guide.linkHint,
    dragHint: guide.linkPattern || guide.linkHint,
  };
}

export { LINK_GUIDE };
