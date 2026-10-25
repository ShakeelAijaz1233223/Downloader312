import { describe, it, expect, beforeAll } from 'vitest';
import {
  TOP_COUNT,
  MIDDLE_COUNT,
  TOTAL_COUNT,
  __internal as searchInternal,
  SEARCH_FILTERS,
} from '../src/services/videoSearchService.js';
import {
  pickStreamForTarget,
  qualityToHeight,
  getFfmpegStatus,
  getConverterCapabilities,
  createConvertJob,
  getConvertJob,
  cancelConvertJob,
  streamConvertedFile,
  __internal as convertInternal,
} from '../src/services/mediaConverter.js';
import {
  buildDownloadVerdict,
  buildSeoBlock,
  extractKeywords,
  __internal as seoInternal,
} from '../src/services/seoAiService.js';
import { verifyDownloadTicket } from '../src/services/fileDownloadService.js';

const VIDEO_AUDIO = { hasAudio: true, hasVideo: true, height: 360, directCdnUrl: 'https://cdn.example/360.mp4' };
const VIDEO_1080 = { hasAudio: false, hasVideo: true, height: 1080, directCdnUrl: 'https://cdn.example/1080.mp4' };
const VIDEO_2160 = { hasAudio: false, hasVideo: true, height: 2160, directCdnUrl: 'https://cdn.example/2160.mp4' };
const AUDIO_128 = { hasAudio: true, hasVideo: false, bitrate: 128000, directCdnUrl: 'https://cdn.example/a.m4a' };
const AUDIO_48 = { hasAudio: true, hasVideo: false, bitrate: 48000, directCdnUrl: 'https://cdn.example/b.m4a' };

describe('V12 — real search engine (50 videos: 30 top + 20 middle)', () => {
  it('1. Splits exactly 30 top + 20 middle = 50 and never asks for more', () => {
    expect(TOP_COUNT).toBe(30);
    expect(MIDDLE_COUNT).toBe(20);
    expect(TOTAL_COUNT).toBe(50);
    expect(SEARCH_FILTERS.durations).toContain('long');
    expect(SEARCH_FILTERS.sorts).toContain('views');
  });

  it('2. Only real watch URLs survive — channels/playlists are rejected', () => {
    expect(searchInternal.isVideoRow({ id: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk' })).toBe(true);
    expect(searchInternal.isVideoRow({ id: 'x', url: 'https://www.youtube.com/@channel' })).toBe(false);
    expect(searchInternal.isVideoRow({ id: 'x', url: 'https://www.youtube.com/playlist?list=1' })).toBe(false);
    expect(searchInternal.isVideoRow(null)).toBe(false);
  });

  it('3. Duration filter really filters (short / medium / long)', () => {
    expect(searchInternal.durationMatches({ durationText: '2:10' }, 'short')).toBe(true);
    expect(searchInternal.durationMatches({ durationText: '2:10' }, 'long')).toBe(false);
    expect(searchInternal.durationMatches({ durationText: '12:00' }, 'medium')).toBe(true);
    expect(searchInternal.durationMatches({ durationText: '45:00' }, 'long')).toBe(true);
    // Unknown duration must not silently disappear
    expect(searchInternal.durationMatches({ durationText: '' }, 'long')).toBe(true);
  });

  it('4. Parses a real videoRenderer block into a usable row', () => {
    const html = JSON.stringify({
      videoRenderer: {
        videoId: 'dQw4w9WgXcQ',
        title: { runs: [{ text: 'Real Video Title' }] },
        ownerText: { runs: [{ text: 'Real Channel' }] },
        lengthText: { simpleText: '3:33' },
        viewCountText: { simpleText: '1,234,567 views' },
      },
    });
    const rows = searchInternal.parseYoutubeHtml(html, 5);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('dQw4w9WgXcQ');
    expect(rows[0].title).toBe('Real Video Title');
    expect(rows[0].channelName).toBe('Real Channel');
    expect(rows[0].url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('5. View parsing sorts correctly', () => {
    expect(searchInternal.parseViews('1.2M views')).toBe(1_200_000);
    expect(searchInternal.parseViews('950K views')).toBe(950_000);
    expect(searchInternal.parseViews('nonsense')).toBe(0);
  });
});

describe('V12 — auto-convert engine picks REAL streams only', () => {
  const streams = {
    videoAudio: [VIDEO_AUDIO],
    videoOnly: [VIDEO_1080, VIDEO_2160],
    audioOnly: [AUDIO_128, AUDIO_48],
  };

  it('6. "Best available" never returns an upscale and prefers a track with sound', () => {
    const picked = pickStreamForTarget(streams, { mode: 'video', target: 'max' });
    expect(picked.stream.directCdnUrl).toBe(VIDEO_AUDIO.directCdnUrl);
    expect(picked.kind).toBe('video-audio');
  });

  it('7. A lower target never claims a higher resolution', () => {
    const picked = pickStreamForTarget(streams, { mode: 'video', target: '720p' });
    expect(Number(picked.stream.height)).toBeLessThanOrEqual(720);
  });

  it('8. Audio mode prefers the real audio-only track with the best bitrate', () => {
    const picked = pickStreamForTarget(streams, { mode: 'audio' });
    expect(picked.kind).toBe('audio-only');
    expect(picked.stream.directCdnUrl).toBe(AUDIO_128.directCdnUrl);
  });

  it('9. Targets map to real heights, and bogus input falls back to "best"', () => {
    expect(qualityToHeight('1080p')).toBe(1080);
    expect(qualityToHeight('2160p')).toBe(2160);
    expect(qualityToHeight('max')).toBe(0);
    expect(qualityToHeight('garbage')).toBe(0);
  });

  it('10. Capabilities are honest about FFmpeg', async () => {
    const status = await getFfmpegStatus();
    const caps = await getConverterCapabilities();
    expect(typeof status.available).toBe('boolean');
    expect(caps.reEncode).toBe(status.available);
    expect(caps.directCopy).toBe(true);
    expect(caps.targets).toContain('max');
    if (!status.available) {
      expect(caps.note.toLowerCase()).toContain('ffmpeg not found');
    }
  });

  it('11. A job can be created, read and cancelled; bad input is rejected', async () => {
    await expect(createConvertJob({ sourceUrl: 'not-a-url' })).rejects.toThrow();

    const job = await createConvertJob({
      sourceUrl: 'https://example.invalid/video',
      title: 'Unit Test',
      target: '720p',
      mode: 'video',
    });
    expect(job.id).toMatch(/^[a-f0-9]{16}$/);
    expect(job.target).toBe('720p');

    const found = getConvertJob(job.id);
    expect(found.id).toBe(job.id);

    const cancelled = cancelConvertJob(job.id);
    expect(cancelled.status).toBe('cancelled');
    expect(getConvertJob(job.id).status).toBe('cancelled');
  });

  it('12. A finished job streams real bytes with Range support', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { Writable } = await import('node:stream');
    const { CONVERT_ROOT } = await import('../src/services/mediaConverter.js');

    const jobId = 'testjob000000001';
    const jobDir = path.join(CONVERT_ROOT, jobId);
    fs.mkdirSync(jobDir, { recursive: true });
    const outPath = path.join(jobDir, 'output.mp4');
    fs.writeFileSync(outPath, Buffer.alloc(2048, 1));

    convertInternal.JOBS.set(jobId, {
      id: jobId,
      status: 'ready',
      phase: 'ready',
      progress: 100,
      outputExt: 'mp4',
      fileName: 'Unit_Test.mp4',
      sizeBytes: 2048,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 60000,
    });

    const chunks = [];
    const res = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk);
        cb();
      },
    });
    res.headers = {};
    res.statusCode = 200;
    res.setHeader = (k, v) => {
      res.headers[k] = v;
    };
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };

    // The 'finish' event can fire inside the awaited call, so listen first.
    const finished = new Promise((resolve) => res.on('finish', resolve));
    await streamConvertedFile(
      { method: 'GET', headers: { range: 'bytes=0-99' } },
      res,
      { filePath: outPath, fileName: 'Unit_Test.mp4', mimeType: 'video/mp4' }
    );
    await finished;

    expect(res.statusCode).toBe(206);
    expect(res.headers['Content-Range']).toBe('bytes 0-99/2048');
    expect(res.headers['Content-Length']).toBe('100');
    expect(res.headers['Content-Disposition']).toContain('Unit_Test.mp4');
    expect(chunks.reduce((n, c) => n + c.length, 0)).toBe(100);

    fs.rmSync(jobDir, { recursive: true, force: true });
    convertInternal.JOBS.delete(jobId);
  });
});

describe('V12 — SEO + AI analysis is honest', () => {
  it('13. Verdict reports real qualities and explains the mux limit', () => {
    const verdict = buildDownloadVerdict({
      streams: {
        videoAudio: [VIDEO_AUDIO],
        videoOnly: [VIDEO_1080, VIDEO_2160],
        audioOnly: [AUDIO_128],
      },
    });
    expect(verdict.downloadable).toBe(true);
    expect(verdict.bestQuality).toBe('2160p');
    expect(verdict.bestQualityWithSound).toBe('360p');
    expect(verdict.realQualities).toEqual(['2160p', '1080p', '360p']);
    expect(verdict.notes.join(' ')).toMatch(/video-only track/i);
  });

  it('14. No streams means "not downloadable", never a fake YES', () => {
    const verdict = buildDownloadVerdict({ streams: {} });
    expect(verdict.downloadable).toBe(false);
    expect(verdict.bestQuality).toBe('');
    expect(verdict.realQualities).toEqual([]);
  });

  it('15. SEO block respects meta length limits and is copy-ready', () => {
    const seo = buildSeoBlock({
      title: 'Tera Mera Rishta - New Version Awarapan 2 Emraan Hashmi Mithoon Saaj Sa',
      channelName: 'T-Series',
      platformName: 'YouTube',
      durationText: '4:12',
      verdict: { bestQuality: '1080p' },
    });
    expect(seo.metaTitle.length).toBeLessThanOrEqual(62);
    expect(seo.metaDescription.length).toBeLessThanOrEqual(158);
    expect(seo.metaDescription.length).toBeGreaterThanOrEqual(70);
    expect(seo.slug).toMatch(/^[a-z0-9-]+$/);
    expect(seo.keywords.length).toBeGreaterThanOrEqual(5);
    expect(seo.jsonLd['@type']).toBe('VideoObject');
    expect(seo.checks.every((c) => typeof c.ok === 'boolean')).toBe(true);
    expect(seoInternal.truncateWords('a b c d e f', 9)).toMatch(/…$/);
  });

  it('16. Keywords come from the real title and drop filler words', () => {
    const keywords = extractKeywords({
      title: 'How to download the best video for free',
      channelName: 'Tech Channel',
      platformName: 'YouTube',
    });
    expect(keywords).toContain('download');
    expect(keywords).toContain('youtube downloader');
    expect(keywords).not.toContain('the');
    expect(keywords.length).toBeLessThanOrEqual(12);
  });
});

describe('V12 — download tickets keep refusing tampered links', () => {
  it('17. A tampered ticket is rejected, a malformed one is rejected', () => {
    expect(() => verifyDownloadTicket('')).toThrow();
    expect(() => verifyDownloadTicket('u1.abc.def.zzz')).toThrow();
    expect(() => verifyDownloadTicket('garbage-ticket-value')).toThrow();
    let code = '';
    try {
      verifyDownloadTicket('u1.AAAA.BBBB.CCCC');
    } catch (err) {
      code = err.code || '';
    }
    expect(['INVALID_TICKET', 'TICKET_SIGNATURE_INVALID']).toContain(code);
  });
});

beforeAll(() => {
  // Keep the converter tests hermetic: never let a stray job hit the network.
  convertInternal.setFfmpegProbe({ available: false, binary: null, version: null });
});
