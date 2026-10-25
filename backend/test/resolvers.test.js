// ============================================================================
// UNIVERSAL RESOLVER FIXTURE SUITE
// Every platform parser is checked against the real markup shape of its host.
// Network is fully stubbed, so these tests prove the PARSING works even on
// machines/networks where the live host blocks datacenter IPs.
// ============================================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { __resolverTestables as R } from '../src/services/universalPlatformResolvers.js';

const JSON_HEADERS = { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) };

function htmlResponse(body, url = 'https://example.com/', status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: { get: () => 'text/html; charset=utf-8' },
    text: async () => body,
  };
}

function jsonResponse(obj, url = 'https://example.com/') {
  return {
    ok: true,
    status: 200,
    url,
    headers: JSON_HEADERS,
    text: async () => JSON.stringify(obj),
  };
}

function route(routes) {
  return vi.fn(async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    for (const [pattern, payload] of routes) {
      if (typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)) {
        return typeof payload === 'function' ? payload(url) : payload;
      }
    }
    return htmlResponse('not found', url, 404);
  });
}

const u = (value) => new URL(value);

describe('Universal resolvers — every platform card must play', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('Streamtape: glue of hidden literals becomes a real get_video link', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          'streamtape.com/e/',
          htmlResponse(`<html><head><title>My Video</title></head><body>
<script>document.getElementById('botlink').innerHTML = "//streamtape.com/get_video?id=abc123&token=zzz999" + "";</script>
</body></html>`, 'https://streamtape.com/e/abc123/'),
        ],
      ])
    );
    const res = await R.resolveStreamtape(u('https://streamtape.com/e/abc123/'), 'https://streamtape.com/e/abc123/');
    expect(res).toBeTruthy();
    expect(res.extractorTier).toBe('streamtape_robot_link');
    expect(res.streams.videoAudio[0].directCdnUrl).toBe('https://streamtape.com/get_video?id=abc123&token=zzz999');
  });

  it('DoodStream: pass_md5 token becomes the final CDN mp4', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          'dood.to/e/',
          htmlResponse(
            `<html><head><title>Dood Clip</title></head><body>
<script>$.get('/pass_md5/abcd/xyz987', function(data){ });</script></body></html>`,
            'https://dood.to/e/abcd'
          ),
        ],
        ['pass_md5', htmlResponse('TOKEN987654', 'https://dood.cdn.com/pass_md5/abcd/xyz987')],
      ])
    );
    const res = await R.resolveDoodStream(u('https://dood.to/e/abcd'), 'https://dood.to/e/abcd');
    expect(res).toBeTruthy();
    expect(res.extractorTier).toBe('doodstream_pass_md5');
    expect(res.streams.videoAudio[0].directCdnUrl).toContain('token=TOKEN987654');
  });

  it('MixDrop: MDCore.wurl resolves to a direct mp4', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          'mixdrop.ag/e/',
          htmlResponse(
            `<html><head><title>MixDrop Movie</title></head><body>
<script>MDCore.wurl = "//dm3.mixdrop.ag/movie720.mp4";</script></body></html>`,
            'https://mixdrop.ag/e/xyz'
          ),
        ],
      ])
    );
    const res = await R.resolveMixDrop(u('https://mixdrop.ag/e/xyz'), 'https://mixdrop.ag/e/xyz');
    expect(res.streams.videoAudio[0].directCdnUrl).toBe('https://dm3.mixdrop.ag/movie720.mp4');
  });

  it('FileMoon / VOE style hosts: sources:[{file}] + JSON-LD contentUrl', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          'filemoon.sx/e/',
          htmlResponse(
            `<html><head><title>FileMoon</title></head><body>
<script>jwplayer("v").setup({sources:[{file:"https://cdn.filemoon.sx/hls/master.m3u8"}]});</script>
</body></html>`,
            'https://filemoon.sx/e/abc'
          ),
        ],
      ])
    );
    const res = await R.resolveGenericEmbedHost(
      u('https://filemoon.sx/e/abc'),
      'https://filemoon.sx/e/abc',
      'FileMoon'
    );
    expect(res.extractorTier).toBe('filemoon_embed');
    expect(res.streams.videoAudio[0].formatExt).toBe('ts');
  });

  it('Instagram: triple-escaped embed payload resolves (real markup shape)', async () => {
    // This is literally how Instagram ships the JSON: "\\\"video_url\\\":\\\"https:\\\\/\\\\/…"
    const escaped = String.raw`<html><head><title>Reel</title><meta property="og:image" content="https://scontent.cdninstagram.com/thumb.jpg"/></head><body><script>requireLazy(["x"],function(){var m={\"owner\":{\"username\":\"crafterbhaiya\",\"edge_followed_by\":{\"count\":5}},\"video_url\":\"https:\/\/scontent-sea5-1.cdninstagram.com\/o1\/v\/reel_hd.mp4?_nc_cat=105\u0026efg=abc\",\"display_url\":\"https:\/\/scontent-sea5-1.cdninstagram.com\/thumb.jpg\",\"edge_media_to_caption\":{\"edges\":[{\"node\":{\"text\":\"My new miniature project\"}}]}};});</script></body></html>`;

    vi.stubGlobal(
      'fetch',
      route([
        [
          'instagram.com/reel/ABC123/embed/captioned/',
          htmlResponse(escaped, 'https://www.instagram.com/reel/ABC123/embed/captioned/'),
        ],
        [
          'instagram.com/p/ABC123/embed/captioned/',
          htmlResponse(escaped, 'https://www.instagram.com/p/ABC123/embed/captioned/'),
        ],
      ])
    );

    const res = await R.resolveInstagram(
      u('https://www.instagram.com/reel/ABC123/'),
      'https://www.instagram.com/reel/ABC123/'
    );
    expect(res.extractorTier).toBe('instagram_embed_captioned');
    expect(res.streams.videoAudio[0].directCdnUrl).toMatch(/reel_hd\.mp4\?/);
    expect(res.streams.videoAudio[0].directCdnUrl).toContain('&efg=');
    expect(res.media.title).toContain('miniature');
  });

  it('Instagram: carousel / multi-clip posts return every video', async () => {
    const escaped = String.raw`<html><body><script>{"video_url":"https:\/\/cdninstagram.com\/clip1.mp4","display_url":"https:\/\/cdninstagram.com\/t1.jpg"}{"video_url":"https:\/\/cdninstagram.com\/clip2.mp4"}</script></body></html>`;
    vi.stubGlobal(
      'fetch',
      route([
        [
          'instagram.com/p/CAROUSEL1/embed/captioned/',
          htmlResponse(escaped, 'https://www.instagram.com/p/CAROUSEL1/embed/captioned/'),
        ],
      ])
    );
    const res = await R.resolveInstagram(
      u('https://www.instagram.com/p/CAROUSEL1/'),
      'https://www.instagram.com/p/CAROUSEL1/'
    );
    expect(res.streams.videoAudio.length).toBe(2);
    expect(res.streams.videoAudio[1].directCdnUrl).toContain('clip2.mp4');
  });

  it('Instagram: a private/deleted post honestly returns null (no fake stream)', async () => {
    vi.stubGlobal(
      'fetch',
      route([['instagram.com/', htmlResponse('<html><body>Log in</body></html>', 'https://www.instagram.com/p/X/embed/captioned/')]])
    );
    const res = await R.resolveInstagram(u('https://www.instagram.com/p/X/'), 'https://www.instagram.com/p/X/');
    expect(res).toBeNull();
  });

  it('Threads: embed page exposes video_url', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          'threads.net/@user/post/XYZ99/embed',
          htmlResponse(
            `<html><head><title>Thread video</title></head><body>
<script>{"video_url":"https://scontent.cdninstagram.com/v/threads.mp4"}</script></body></html>`,
            'https://www.threads.net/@user/post/XYZ99/embed'
          ),
        ],
      ])
    );
    const res = await R.resolveThreads(u('https://www.threads.net/@user/post/XYZ99'), 'https://www.threads.net/@user/post/XYZ99');
    expect(res.streams.videoAudio[0].directCdnUrl).toContain('threads.mp4');
  });

  it('Pinterest: V_720P + HLS variants', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          'pinterest.com/pin/',
          htmlResponse(
            `<html><head><title>Pin video</title></head><body>
<script>{"videos":{"V_720P":{"url":"https://v1.pinimg.com/videos/pin720.mp4"},"V_HLSV4":{"url":"https://v1.pinimg.com/videos/pin.m3u8"}}}</script>
</body></html>`,
            'https://www.pinterest.com/pin/123/'
          ),
        ],
      ])
    );
    const res = await R.resolvePinterest(u('https://www.pinterest.com/pin/123/'), 'https://www.pinterest.com/pin/123/');
    const urls = res.streams.videoAudio.map((s) => s.directCdnUrl);
    expect(urls.some((x) => x.includes('pin720.mp4'))).toBe(true);
    expect(urls.some((x) => x.includes('pin.m3u8'))).toBe(true);
  });

  it('Telegram: public embed page <video src>', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          't.me/channel/55',
          htmlResponse(
            `<html><body><video src="https://cdn4.telegram-cdn.org/file/abc/video.mp4" poster="p.jpg"></video></body></html>`,
            'https://t.me/channel/55?embed=1'
          ),
        ],
      ])
    );
    const res = await R.resolveTelegram(u('https://t.me/channel/55'), 'https://t.me/channel/55');
    expect(res.streams.videoAudio[0].directCdnUrl).toBe('https://cdn4.telegram-cdn.org/file/abc/video.mp4');
  });

  it('Tumblr: og:video meta', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          'tumblr.com/blog/123456789',
          htmlResponse(
            `<html><head><meta property="og:video:secure_url" content="https://va.tumblr.com/video.mp4"/><meta property="og:image" content="https://va.tumblr.com/p.jpg"/></head></html>`,
            'https://www.tumblr.com/blog/123456789'
          ),
        ],
      ])
    );
    const res = await R.resolveTumblr(u('https://www.tumblr.com/blog/123456789'), 'https://www.tumblr.com/blog/123456789');
    expect(res.streams.videoAudio[0].directCdnUrl).toBe('https://va.tumblr.com/video.mp4');
  });

  it('Twitch clips: sourceURL qualities', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          'clips.twitch.tv/',
          htmlResponse(
            `<html><head><title>Twitch Clip</title></head><body>
<script>{"videoQualities":[{"sourceURL":"https://clips-media-assets2.twitch.tv/clip-1080.mp4"},{"sourceURL":"https://clips-media-assets2.twitch.tv/clip-480.mp4"}]}</script>
</body></html>`,
            'https://clips.twitch.tv/TestClipSlug'
          ),
        ],
      ])
    );
    const res = await R.resolveTwitch(u('https://clips.twitch.tv/TestClipSlug'), 'https://clips.twitch.tv/TestClipSlug');
    expect(res.streams.videoAudio.length).toBe(2);
    expect(res.streams.videoAudio[0].directCdnUrl).toContain('clip-1080.mp4');
  });

  it('Kick clips: v2 API video_url', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        ['kick.com/api/v2/clips/', jsonResponse({ clip: { title: 'Kick Clip', video_url: 'https://kick.cdn/clip.mp4' } })],
      ])
    );
    const res = await R.resolveKick(
      u('https://kick.com/xqc/clips/clip_01HABC'),
      'https://kick.com/xqc/clips/clip_01HABC'
    );
    expect(res.extractorTier).toBe('kick_clip_api');
    expect(res.streams.videoAudio[0].directCdnUrl).toBe('https://kick.cdn/clip.mp4');
  });

  it('Rumble: embed JSON mp4 + hls', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          'rumble.com/embed/',
          htmlResponse(
            `<html><head><title>Rumble</title></head><body>
<script>{"mp4":{"url":"https://rumble.cdn/video.mp4"},"hls":{"url":"https://rumble.cdn/video.m3u8"}}</script>
</body></html>`,
            'https://rumble.com/embed/v6abcde/'
          ),
        ],
      ])
    );
    const res = await R.resolveRumble(u('https://rumble.com/v6abcde-test.html'), 'https://rumble.com/v6abcde-test.html');
    const urls = res.streams.videoAudio.map((s) => s.directCdnUrl);
    expect(urls).toContain('https://rumble.cdn/video.mp4');
    expect(urls).toContain('https://rumble.cdn/video.m3u8');
  });

  it('Snapchat: contentUrl mp4', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          'snapchat.com/spotlight/',
          htmlResponse(
            `<html><head><title>Spotlight</title></head><body>
<script>{"contentUrl":"https://bolt.snap.com/spotlight/clip.mp4"}</script></body></html>`,
            'https://www.snapchat.com/spotlight/ABC'
          ),
        ],
      ])
    );
    const res = await R.resolveSnapchat(u('https://www.snapchat.com/spotlight/ABC'), 'https://www.snapchat.com/spotlight/ABC');
    expect(res.streams.videoAudio[0].directCdnUrl).toContain('clip.mp4');
  });

  it('LinkedIn: og:video for public posts', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          'linkedin.com/posts/',
          htmlResponse(
            `<html><head><meta property="og:video:secure_url" content="https://dms.licdn.com/video.mp4"/></head></html>`,
            'https://www.linkedin.com/posts/x-activity-123'
          ),
        ],
      ])
    );
    const res = await R.resolveLinkedIn(
      u('https://www.linkedin.com/posts/x-activity-123'),
      'https://www.linkedin.com/posts/x-activity-123'
    );
    expect(res.streams.videoAudio[0].directCdnUrl).toBe('https://dms.licdn.com/video.mp4');
  });

  it('Bluesky: AT Protocol thread → HLS playlist', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          'getPostThread',
          jsonResponse({
            thread: {
              post: {
                uri: 'at://did:plc:abc/app.bsky.feed.post/3l6ove',
                author: { did: 'did:plc:abc', handle: 'creator.bsky.social' },
                record: { text: 'My Bluesky clip' },
                embed: { $type: 'app.bsky.embed.video#view', playlist: 'https://video.bsky.app/watch/abc/playlist.m3u8' },
              },
            },
          }),
        ],
      ])
    );
    const res = await R.resolveBluesky(
      u('https://bsky.app/profile/creator.bsky.social/post/3l6ove'),
      'https://bsky.app/profile/creator.bsky.social/post/3l6ove'
    );
    expect(res.extractorTier).toBe('bluesky_atproto_api');
    expect(res.streams.videoAudio[0].formatExt).toBe('ts');
  });

  it('Mastodon: status API media_attachments', async () => {
    vi.stubGlobal(
      'fetch',
      route([
        [
          '/api/v1/statuses/',
          jsonResponse({
            url: 'https://mastodon.social/@user/112358',
            content: '<p>Hello video</p>',
            media_attachments: [
              { type: 'video', url: 'https://files.mastodon.social/media/video.mp4', preview_url: 'https://x/p.jpg' },
            ],
          }),
        ],
      ])
    );
    const res = await R.resolveMastodon(
      u('https://mastodon.social/@user/112358'),
      'https://mastodon.social/@user/112358'
    );
    expect(res.extractorTier).toBe('mastodon_public_api');
    expect(res.streams.videoAudio[0].directCdnUrl).toContain('video.mp4');
  });

  it('Page intelligence: JSON-LD VideoObject + oEmbed iframe + relative player file', async () => {
    const html = `<html><head>
      <title>Course Lecture</title>
      <meta property="og:image" content="https://cdn.example.com/thumb.jpg"/>
      <link rel="alternate" type="application/json+oembed" href="https://cdn.example.com/oembed.json"/>
      <script type="application/ld+json">{"@type":"VideoObject","name":"Lecture 1","contentUrl":"https://cdn.example.com/lecture/master.m3u8"}</script>
    </head><body><video><source src="media/clip.mp4" type="video/mp4"></video></body></html>`;

    vi.stubGlobal('fetch', route([['cdn.example.com/page', htmlResponse(html, 'https://cdn.example.com/page')]]));

    const sources = await R.collectPageSources(html, 'https://cdn.example.com/page');
    const urls = sources.filter((s) => !s.isEmbed).map((s) => s.url);
    expect(urls.some((x) => x.includes('master.m3u8'))).toBe(true);
    expect(urls.some((x) => x.includes('/media/clip.mp4'))).toBe(true);

    const scanned = R.scanMediaUrls(html, 'https://cdn.example.com/page');
    expect(scanned.some((s) => s.url.includes('master.m3u8'))).toBe(true);
  });

  it('Site chrome is never mistaken for the video', () => {
    const junk = `<html><body><script src="https://static.files.bbci.co.uk/bbcdotcom/web/promo.mp4"></script></body></html>`;
    expect(R.scanMediaUrls(junk, 'https://www.bbc.com/news')).toEqual([]);
  });
});
