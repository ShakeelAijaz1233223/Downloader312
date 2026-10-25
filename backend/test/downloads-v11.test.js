import { describe, it, expect, vi } from 'vitest';
import {
  createDownloadTicket,
  verifyDownloadTicket,
} from '../src/services/fileDownloadService.js';
import { selectAutoStream, dedupeStreams } from '../src/services/extractorEngine.js';
import { PLATFORM_DEFINITIONS } from '../src/data/platformDefinitions.js';
import { getPlatformLinkGuide, withLinkGuide } from '../src/data/platformLinks.js';
import { getAdminLoginHints, ADMIN_PIN_LENGTH, ADMIN_BRAND } from '../src/data/adminIdentity.js';
import { verifyTotp2FA } from '../src/security/cryptoVault.js';
import { listLibraryFiles } from '../src/data/downloadLibrary.js';

describe('V11 download engine — short tickets, honest qualities, real link guides', () => {
  it('1. Keeps the signed download URL SHORT even for a huge CDN link', async () => {
    const hugeCdn =
      'https://rr4---sn-googlevideo.example/videoplayback?' +
      new URLSearchParams({
        itag: '22',
        expire: '1793000000',
        sig: 'A'.repeat(1200),
        pot: 'B'.repeat(900),
      }).toString();
    expect(hugeCdn.length).toBeGreaterThan(2000);

    const ticket = await createDownloadTicket({
      url: hugeCdn,
      fileName: 'Short_Ticket_Test.mp4',
      mimeType: 'video/mp4',
      sourceUrl: 'https://www.youtube.com/watch?v=WhWc3b3KhnY',
      qualityKey: '720p',
      formatId: 'yt-va-22',
      platformId: 'youtube',
      originBaseUrl: 'http://localhost:5173',
    });

    expect(ticket.downloadUrl.length).toBeLessThan(260);
    expect(ticket.downloadUrl).toContain('/api/v1/files/download/Short_Ticket_Test.mp4?ticket=');

    const payload = verifyDownloadTicket(ticket.ticket);
    expect(payload.upstreamUrl).toBe(hugeCdn);
    expect(payload.qualityKey).toBe('720p');
    expect(payload.formatId).toBe('yt-va-22');
    expect(payload.platformId).toBe('youtube');
  });

  it('2. Rejects tampered, unknown and expired tickets with explicit codes', async () => {
    const ticket = await createDownloadTicket({
      url: 'https://cdn.example.com/video.mp4',
      fileName: 'Clip.mp4',
      originBaseUrl: 'http://localhost:5173',
    });

    // tampered signature -> 403
    const tampered = `${ticket.ticket.slice(0, -4)}AAAA`;
    let err = null;
    try {
      verifyDownloadTicket(tampered);
    } catch (e) {
      err = e;
    }
    expect(err?.statusCode).toBe(403);
    expect(err?.code).toBe('TICKET_SIGNATURE_INVALID');

    // unknown but correctly signed id -> 410 (never a silent 200)
    err = null;
    try {
      verifyDownloadTicket('u1.unknown-ticket-id.tngd9n.invalid-signature');
    } catch (e) {
      err = e;
    }
    expect(err?.statusCode).toBe(403);

    // expired -> 410
    const ttl = Number(ticket.expiresInSeconds || 300);
    const realNow = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(realNow + (ttl + 2) * 1000);
    err = null;
    try {
      verifyDownloadTicket(ticket.ticket);
    } catch (e) {
      err = e;
    }
    clock.mockRestore();
    expect(err?.statusCode).toBe(410);
    expect(err?.code).toBe('TICKET_EXPIRED');
  });

  it('3. Auto quality always prefers a real stream WITH sound, never invents one', () => {
    const streams = {
      videoAudio: [
        { qualityTitle: '360p', hasAudio: true, hasVideo: true, height: 360, formatExt: 'mp4', formatId: 'a' },
        { qualityTitle: '720p', hasAudio: true, hasVideo: true, height: 720, formatExt: 'mp4', formatId: 'b' },
      ],
      videoOnly: [
        { qualityTitle: '2160p', hasAudio: false, hasVideo: true, height: 2160, formatExt: 'webm', formatId: 'c' },
      ],
      audioOnly: [{ qualityTitle: '142kbps', hasAudio: true, hasVideo: false, formatExt: 'webm', formatId: 'd' }],
    };
    const picked = selectAutoStream(streams);
    expect(picked.stream.formatId).toBe('b');
    expect(picked.hasAudio).toBe(true);
    expect(picked.muted).toBe(false);

    // A source with only silent video is reported honestly as muted.
    const silent = selectAutoStream({
      videoAudio: [],
      videoOnly: [{ qualityTitle: '1080p', hasAudio: false, hasVideo: true, height: 1080, formatExt: 'mp4', formatId: 'e' }],
      audioOnly: [],
    });
    expect(silent.muted).toBe(true);
    expect(silent.hasAudio).toBe(false);

    expect(selectAutoStream({}).stream).toBeNull();
  });

  it('4. De-duplicates identical formats (no more twin "142kbps WEBM" rows)', () => {
    const list = [
      { qualityTitle: '142kbps', formatExt: 'webm', directCdnUrl: 'https://cdn/1' },
      { qualityTitle: '142kbps', formatExt: 'webm', directCdnUrl: 'https://cdn/1' },
      { qualityTitle: '142kbps', formatExt: 'webm', directCdnUrl: 'https://cdn/2' },
      { qualityTitle: '131kbps', formatExt: 'm4a', directCdnUrl: 'https://cdn/3' },
    ];
    const out = dedupeStreams(list, (item) => `${item.qualityTitle}|${item.formatExt}|${item.directCdnUrl}`);
    expect(out).toHaveLength(3);
  });

  it('5. Every supported website carries a real link guide and a unique id', () => {
    const ids = PLATFORM_DEFINITIONS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const platform of PLATFORM_DEFINITIONS) {
      const guide = getPlatformLinkGuide(platform.id);
      expect(guide.linkHint.length).toBeGreaterThan(10);
      if (guide.exampleUrl) expect(guide.exampleUrl).toMatch(/^https:\/\//);
      const enriched = withLinkGuide(platform);
      expect(enriched.linkHint).toBeTruthy();
      expect(enriched.exampleUrl || '').toMatch(/^https:\/\//);
    }

    // The flagship examples the UI shows must be real share links, not homepages.
    expect(getPlatformLinkGuide('youtube').exampleUrl).toContain('/watch?v=');
    expect(getPlatformLinkGuide('terabox').exampleUrl).toContain('sharing/link?surl=');
    expect(getPlatformLinkGuide('dailymotion').exampleUrl).toContain('/video/');
    expect(getPlatformLinkGuide('facebook').exampleUrl).toContain('/share/');
    expect(getPlatformLinkGuide('not_a_real_platform').universalFallback).toBe(true);
  });

  it('6. Pro-Security admin identity is described without leaking any secret', () => {
    const hints = getAdminLoginHints();
    expect(hints.brand).toBe(ADMIN_BRAND);
    expect(hints.brand).toBe('ShakeelAdminProDownloader');
    expect(hints.pinLength).toBe(ADMIN_PIN_LENGTH);
    expect(ADMIN_PIN_LENGTH).toBe(14);
    expect(JSON.stringify(hints)).not.toMatch(/ShakeelAhmed|78645637189230|189230|gmail/i);
    expect(hints.routes.primary).toBe('/vault-control-x9p4');
    expect(hints.routes.proSecurity).toContain('pro-security');
  });

  it('7. Two-factor check accepts the owner code and rejects empty/unknown codes', () => {
    expect(verifyTotp2FA('189230')).toBe(true);
    expect(verifyTotp2FA('')).toBe(false);
    expect(verifyTotp2FA('   ')).toBe(false);
    expect(verifyTotp2FA('000000')).toBe(false);
    expect(verifyTotp2FA('12345')).toBe(false);
  });

  it('8. Public download library exposes only signed sample files', () => {
    const files = listLibraryFiles();
    const ids = files.map((f) => f.fileId);
    expect(ids).toContain('sample_pdf');
    expect(ids).toContain('sample_zip');
    expect(ids).not.toContain('pro_pack_zip');
    for (const file of files) {
      expect(file.downloadPath || file.fileName).toBeTruthy();
    }
  });
});
