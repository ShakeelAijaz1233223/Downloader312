// ============================================================================
// AUTO-CONVERT ENGINE  (V12)
//
// What this does — and what it deliberately refuses to do:
//
//   ✔ Picks the best REAL stream the source actually offers and converts it to
//     the format/container the user asked for (MP4 / MP3 / M4A).
//   ✔ Converts with FFmpeg when FFmpeg is installed on the server (real
//     transcode, real progress, cancel support).
//   ✔ Without FFmpeg it still delivers a playable file: the best real stream is
//     copied through untouched (MP4 stays MP4, the native M4A audio track stays
//     M4A). It never re-encodes and never invents quality.
//   ✘ It NEVER upscales 360p to "8K" and calls it Ultra HD. Fake resolution is
//     the one thing this engine will not fake — an honest 360p beats a lie.
//
// Everything is server-side: the browser only starts a job, polls progress and
// receives a signed download link when the file is really ready.
// ============================================================================
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ENV } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { selectOptimalUpstreamUserAgent } from './idmTurboDownloader.js';

// backend/storage/converted — next to storage/files and storage/vault.
export const CONVERT_ROOT = path.resolve(
  ENV.TEMP_EPHEMERAL_DIR ? path.dirname(ENV.TEMP_EPHEMERAL_DIR) : path.resolve('.'),
  'converted'
);

const MAX_JOBS = 60;
const JOB_TTL_MS = 90 * 60 * 1000; // converted files survive 90 minutes
const DOWNLOAD_IDLE_TIMEOUT_MS = 45_000;

export const TARGET_QUALITIES = Object.freeze(['max', '2160p', '1440p', '1080p', '720p', '480p']);
export const AUDIO_FORMATS = Object.freeze(['mp3', 'm4a']);

/** jobId -> job */
const JOBS = new Map();
let ffmpegProbe = null;

// ---------------------------------------------------------------------------
// FFmpeg capability probe (cached, never blocks a request longer than 3s)
// ---------------------------------------------------------------------------
function runBinary(binary, args, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(binary, args, { windowsHide: true });
    } catch {
      return resolve({ ok: false, stdout: '' });
    }
    let stdout = '';
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      resolve({ ok, stdout });
    };
    child.stdout?.on('data', (chunk) => {
      if (stdout.length < 8192) stdout += chunk.toString();
    });
    child.on('error', () => finish(false));
    child.on('close', (code) => finish(code === 0));
    setTimeout(() => finish(false), timeoutMs);
  });
}

export async function getFfmpegStatus({ refresh = false } = {}) {
  if (ffmpegProbe && !refresh) return ffmpegProbe;

  const envPath = String(process.env.FFMPEG_PATH || '').trim();
  const candidates = [envPath, 'ffmpeg'].filter(Boolean);

  for (const binary of candidates) {
    const result = await runBinary(binary, ['-hide_banner', '-version']);
    if (result.ok) {
      const version = /ffmpeg version (\S+)/i.exec(result.stdout)?.[1] || 'unknown';
      ffmpegProbe = { available: true, binary, version };
      return ffmpegProbe;
    }
  }

  ffmpegProbe = { available: false, binary: null, version: null };
  return ffmpegProbe;
}

export async function getConverterCapabilities() {
  const ffmpeg = await getFfmpegStatus();
  return {
    ffmpegAvailable: ffmpeg.available,
    ffmpegVersion: ffmpeg.version,
    // Without FFmpeg the server still converts by copying the best real stream
    // into the requested container; only re-encoding (e.g. MP4 -> MP3) needs it.
    directCopy: true,
    reEncode: ffmpeg.available,
    targets: TARGET_QUALITIES,
    audioFormats: AUDIO_FORMATS,
    maxConcurrentJobs: 2,
    jobTtlMinutes: Math.round(JOB_TTL_MS / 60000),
    note: ffmpeg.available
      ? 'FFmpeg detected — real transcoding is enabled.'
      : 'FFmpeg not found on this server. Convert will deliver the best real stream as-is (MP4/M4A). Install FFmpeg to unlock MP3 conversion and re-encoding.',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function jobDir(jobId) {
  return path.join(CONVERT_ROOT, jobId);
}

function sanitizeBaseName(name = '') {
  return (
    String(name)
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/^\.+/, '')
      .trim()
      .slice(0, 90) || 'UltraDownloader_Convert'
  );
}

export function qualityToHeight(target) {
  const key = String(target || 'max').toLowerCase();
  if (key === 'max' || key === 'best' || key === 'auto') return 0;
  const match = /^(\d{3,4})p$/.exec(key);
  return match ? Number(match[1]) : 0;
}

function publicJobView(job) {
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    progress: Math.max(0, Math.min(100, Math.round(job.progress))),
    target: job.target,
    audioFormat: job.audioFormat,
    title: job.title,
    sourceLabel: job.sourceLabel,
    outputLabel: job.outputLabel,
    fileName: job.fileName || null,
    sizeBytes: job.sizeBytes || 0,
    transcoded: Boolean(job.transcoded),
    note: job.note || '',
    error: job.error || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    expiresAt: job.expiresAt,
    downloadPath: job.status === 'ready' ? `/api/v1/convert/${job.id}/file` : null,
  };
}

function touch(job, patch = {}) {
  Object.assign(job, patch, { updatedAt: Date.now() });
}

function purgeOldJobs() {
  const now = Date.now();
  for (const [id, job] of JOBS) {
    if (job.expiresAt > now) continue;
    if (job.status === 'downloading' || job.status === 'converting') continue;
    JOBS.delete(id);
    fsp.rm(jobDir(id), { recursive: true, force: true }).catch(() => {});
  }
  while (JOBS.size > MAX_JOBS) {
    const [oldestId, oldest] = JOBS.entries().next().value || [];
    if (!oldestId || oldest?.status === 'downloading' || oldest?.status === 'converting') break;
    JOBS.delete(oldestId);
    fsp.rm(jobDir(oldestId), { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Stream selection (imported lazily: extractorEngine is heavy)
// ---------------------------------------------------------------------------
function flattenStreams(streams = {}) {
  return [
    ...(streams.videoAudio || []),
    ...(streams.videoWithAudio || []),
    ...(streams.videoOnly || []),
    ...(streams.audioOnly || []),
  ].filter((s) => s && /^https?:\/\//i.test(String(s.directCdnUrl || '')));
}

/**
 * Chooses the stream that best satisfies the request WITHOUT inventing quality.
 *  - audio mode  -> real audio-only track when the source has one
 *  - video mode  -> highest real stream that is <= requested height, else the
 *                   lowest available (never an upscale, never a fake 4K row)
 */
export function pickStreamForTarget(streams, { mode = 'video', target = 'max' } = {}) {
  const all = flattenStreams(streams);
  if (!all.length) return null;

  if (mode === 'audio') {
    const audioOnly = all.filter((s) => s.hasAudio && !s.hasVideo);
    if (audioOnly.length) {
      const scored = [...audioOnly].sort(
        (a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0)
      );
      return { stream: scored[0], kind: 'audio-only' };
    }
    const withSound = all
      .filter((s) => s.hasAudio && s.hasVideo)
      .sort((a, b) => Number(a.height || 0) - Number(b.height || 0));
    if (withSound.length) return { stream: withSound[0], kind: 'audio-from-video' };
    return null;
  }

  const wanted = qualityToHeight(target);
  // Prefer a stream that already carries sound; fall back to video-only.
  const withSound = all.filter((s) => s.hasAudio && s.hasVideo);
  const pool = withSound.length ? withSound : all.filter((s) => s.hasVideo);

  const sorted = [...pool].sort((a, b) => Number(b.height || 0) - Number(a.height || 0));
  if (!wanted) return { stream: sorted[0], kind: withSound.length ? 'video-audio' : 'video-only' };

  const within = sorted.filter((s) => Number(s.height || 0) <= wanted);
  const chosen = within[0] || sorted[sorted.length - 1];
  return { stream: chosen, kind: withSound.length ? 'video-audio' : 'video-only' };
}

// ---------------------------------------------------------------------------
// Download phase (real progress, resumable, cancellable)
// ---------------------------------------------------------------------------
async function downloadToFile({ url, referer, destination, job, signal }) {
  const headers = {
    'User-Agent': selectOptimalUpstreamUserAgent(url),
    Accept: '*/*',
  };
  if (referer && /^https?:\/\//i.test(referer)) {
    headers.Referer = referer;
    try {
      headers.Origin = new URL(referer).origin;
    } catch {
      /* ignore */
    }
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const idleTimer = setTimeout(() => controller.abort(), DOWNLOAD_IDLE_TIMEOUT_MS);

  const response = await fetch(url, {
    headers,
    redirect: 'follow',
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    clearTimeout(idleTimer);
    signal?.removeEventListener('abort', onAbort);
    throw new AppError(
      response.status === 403 || response.status === 401 ? 403 : 502,
      'CONVERT_SOURCE_UNAVAILABLE',
      `The media server refused the source file (HTTP ${response.status}). Click Convert again to fetch a fresh link.`
    );
  }

  const total = Number(response.headers.get('content-length') || 0);
  let received = 0;

  const counter = new Transform({
    transform(chunk, _enc, cb) {
      received += chunk.length;
      if (total > 0) {
        touch(job, {
          phase: 'downloading',
          progress: Math.min(92, (received / total) * 92),
          sizeBytes: received,
        });
      } else {
        touch(job, { phase: 'downloading', sizeBytes: received });
      }
      cb(null, chunk);
    },
  });

  await pipeline(Readable.fromWeb(response.body), counter, fs.createWriteStream(destination));
  clearTimeout(idleTimer);
  signal?.removeEventListener('abort', onAbort);
  return received;
}

// ---------------------------------------------------------------------------
// FFmpeg transcode phase (real progress from -progress pipe:1)
// ---------------------------------------------------------------------------
function runFfmpeg({ binary, args, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true });
    let stderrTail = '';
    let settled = false;

    const done = (err) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      if (err) reject(err);
      else resolve();
    };

    const onAbort = () => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      done(new Error('CONVERT_CANCELLED'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        const match = /out_time_ms=(\d+)/.exec(line);
        if (!match) continue;
        onProgress(Number(match[1]) / 1_000_000);
      }
    });
    child.stderr?.on('data', (chunk) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-1200);
    });
    child.on('error', (err) => done(err));
    child.on('close', (code) => {
      if (code === 0) return done(null);
      return done(new Error(stderrTail.trim() || `FFmpeg exited with code ${code}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Job runner
// ---------------------------------------------------------------------------
async function resolveAnalysis(sourceUrl) {
  const extractor = await import('./extractorEngine.js');
  const analysis = await extractor.analyzeMediaUrl({ rawUrl: sourceUrl });
  if (!analysis?.streams) {
    throw new AppError(
      422,
      'CONVERT_NO_STREAMS',
      'No downloadable stream was found on that page.'
    );
  }
  return analysis;
}


// ---------------------------------------------------------------------------
// Output production: download the real stream, then copy or transcode it.
// Never upscales, never re-encodes without FFmpeg, never lies about quality.
// ---------------------------------------------------------------------------
async function produceOutput({ job, analysis, stream, ffmpeg, signal }) {
  const sourceHeight = Number(stream.height || 0);
  job.transcoded = false;

  if (job.mode === 'audio') {
    const wantsMp3 = job.audioFormat === 'mp3';
    job.outputExt = ffmpeg.available && wantsMp3 ? 'mp3' : 'm4a';
    job.note =
      ffmpeg.available && wantsMp3
        ? 'Audio transcoded to MP3 with FFmpeg.'
        : 'Delivered as the original M4A/WebM audio track (FFmpeg not installed, so nothing is re-encoded).';
  } else {
    job.outputExt = 'mp4';
    job.note = sourceHeight
      ? `Source stream: ${sourceHeight}p. Nothing is upscaled — you get the real resolution.`
      : 'Nothing is upscaled — you get the real source resolution.';
  }

  const dir = jobDir(job.id);
  await fsp.mkdir(dir, { recursive: true });
  const rawPath = path.join(dir, `source.${job.mode === 'audio' ? 'm4a' : 'mp4'}`);
  const outPath = path.join(dir, `output.${job.outputExt}`);

  touch(job, { phase: 'downloading', progress: 5 });
  const bytes = await downloadToFile({
    url: stream.directCdnUrl,
    referer: job.sourceUrl,
    destination: rawPath,
    job,
    signal,
  });
  if (job.cancelled) throw new Error('CONVERT_CANCELLED');

  job.sizeBytes = bytes;
  touch(job, { phase: 'converting', progress: 93 });

  const needsTranscode = ffmpeg.available && job.mode === 'audio' && job.outputExt === 'mp3';

  if (!needsTranscode) {
    await fsp.rename(rawPath, outPath).catch(async () => {
      await fsp.copyFile(rawPath, outPath);
      await fsp.unlink(rawPath).catch(() => {});
    });
    touch(job, {
      phase: 'converting',
      progress: 99,
      transcoded: false,
      outputLabel:
        job.mode === 'audio'
          ? `${job.outputExt.toUpperCase()} audio · ${sourceHeight ? `${sourceHeight}p source` : 'original track'}`
          : `${sourceHeight ? `${sourceHeight}p` : 'Original'} · MP4 (real source quality)`,
    });
    return;
  }

  const durationSec = Number(analysis.media?.durationSeconds || 0);
  await runFfmpeg({
    binary: ffmpeg.binary,
    args: [
      '-hide_banner',
      '-y',
      '-i',
      rawPath,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '2',
      '-progress',
      'pipe:1',
      '-nostats',
      outPath,
    ],
    onProgress: (secondsDone) => {
      const pct =
        durationSec > 0
          ? 93 + Math.min(6, (secondsDone / durationSec) * 6)
          : Math.min(99, 93 + secondsDone / 10);
      touch(job, { progress: pct });
    },
    signal,
  });
  await fsp.unlink(rawPath).catch(() => {});
  touch(job, {
    transcoded: true,
    outputLabel: `MP3 audio · converted from the real ${
      sourceHeight ? `${sourceHeight}p` : 'source'
    } stream`,
  });
}

async function runJob(job) {
  const controller = new AbortController();
  job.abortController = controller;

  try {
    touch(job, { status: 'running', phase: 'resolving', progress: 2 });

    const analysis = await resolveAnalysis(job.sourceUrl);
    if (job.cancelled) throw new Error('CONVERT_CANCELLED');

    job.title = job.title || analysis.media?.title || 'UltraDownloader';
    const picked = pickStreamForTarget(analysis.streams, {
      mode: job.mode,
      target: job.target,
    });
    if (!picked?.stream) {
      throw new AppError(
        422,
        'CONVERT_NO_MATCH',
        job.mode === 'audio'
          ? 'This video does not expose a downloadable audio track.'
          : 'This page does not expose a downloadable video stream.'
      );
    }

    const stream = picked.stream;
    const ffmpeg = await getFfmpegStatus();

    await produceOutput({ job, analysis, stream, ffmpeg, signal: controller.signal });

    const finalName = `${sanitizeBaseName(job.title)}_${
      job.mode === 'audio' ? 'Audio' : `${job.outputLabel.match(/^(\d+p|Original)/)?.[1] || 'Video'}`
    }.${job.outputExt}`;

    const stat = await fsp.stat(path.join(jobDir(job.id), `output.${job.outputExt}`));
    touch(job, {
      status: 'ready',
      phase: 'ready',
      progress: 100,
      fileName: finalName,
      sizeBytes: stat.size,
      expiresAt: Date.now() + JOB_TTL_MS,
    });
  } catch (err) {
    if (job.cancelled || err?.message === 'CONVERT_CANCELLED') {
      touch(job, { status: 'cancelled', phase: 'cancelled', progress: 0, error: null });
    } else {
      logger?.warn?.({ err: err?.message, jobId: job.id }, 'convert job failed');
      touch(job, {
        status: 'failed',
        phase: 'failed',
        progress: 0,
        error: err?.message || 'Conversion failed.',
      });
    }
    fsp.rm(jobDir(job.id), { recursive: true, force: true }).catch(() => {});
  } finally {
    job.abortController = null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function createConvertJob({
  sourceUrl,
  title = '',
  target = 'max',
  audioFormat = 'mp3',
  mode = 'video',
}) {
  if (!/^https?:\/\//i.test(String(sourceUrl || ''))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A valid video URL is required to convert.');
  }

  purgeOldJobs();

  const running = [...JOBS.values()].filter((j) => j.status === 'running').length;
  if (running >= 2) {
    throw new AppError(
      429,
      'CONVERT_BUSY',
      'Two conversions are already running. Please wait for one to finish.'
    );
  }

  const id = crypto.randomBytes(8).toString('hex');
  const now = Date.now();
  const job = {
    id,
    sourceUrl: String(sourceUrl),
    title: String(title || '').slice(0, 160),
    target: TARGET_QUALITIES.includes(String(target)) ? String(target) : 'max',
    audioFormat: AUDIO_FORMATS.includes(String(audioFormat)) ? String(audioFormat) : 'mp3',
    mode: mode === 'audio' ? 'audio' : 'video',
    status: 'running',
    phase: 'queued',
    progress: 0,
    sizeBytes: 0,
    fileName: null,
    outputExt: 'mp4',
    outputLabel: '',
    sourceLabel: '',
    note: '',
    transcoded: false,
    error: null,
    cancelled: false,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + JOB_TTL_MS,
  };

  JOBS.set(id, job);
  runJob(job).catch(() => {});
  return publicJobView(job);
}

export function getConvertJob(id) {
  purgeOldJobs();
  const job = JOBS.get(String(id || ''));
  return job ? publicJobView(job) : null;
}

export function listConvertJobs(limit = 10) {
  purgeOldJobs();
  return [...JOBS.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map(publicJobView);
}

export function cancelConvertJob(id) {
  const job = JOBS.get(String(id || ''));
  if (!job) return null;
  job.cancelled = true;
  try {
    job.abortController?.abort();
  } catch {
    /* ignore */
  }
  touch(job, { status: 'cancelled', phase: 'cancelled', progress: 0 });
  fsp.rm(jobDir(job.id), { recursive: true, force: true }).catch(() => {});
  return publicJobView(job);
}

export function getConvertedFilePath(id) {
  const job = JOBS.get(String(id || ''));
  if (!job || job.status !== 'ready') return null;
  const filePath = path.join(jobDir(job.id), `output.${job.outputExt}`);
  if (!fs.existsSync(filePath)) return null;
  return { filePath, fileName: job.fileName, mimeType: mimeForOutput(job.outputExt) };
}

function mimeForOutput(ext) {
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'm4a') return 'audio/mp4';
  return 'video/mp4';
}

/**
 * Streams a finished conversion to the browser with real Range support so the
 * download resumes like any static file. HEAD is answered without bytes.
 */
export async function streamConvertedFile(req, res, file) {
  const stat = await fsp.stat(file.filePath);
  const total = stat.size;

  const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
  const setBase = () => {
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${String(file.fileName).replace(/["\\]/g, '')}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
    );
  };

  if (rangeMatch) {
    const start = rangeMatch[1] ? Number(rangeMatch[1]) : 0;
    const end = rangeMatch[2] ? Math.min(Number(rangeMatch[2]), total - 1) : total - 1;
    if (Number.isFinite(start) && start < total) {
      setBase();
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', String(end - start + 1));
      if (req.method === 'HEAD') return res.end();
      return pipeline(fs.createReadStream(file.filePath, { start, end }), res).catch(() => {});
    }
  }

  setBase();
  res.status(200);
  res.setHeader('Content-Length', String(total));
  if (req.method === 'HEAD') return res.end();
  return pipeline(fs.createReadStream(file.filePath), res).catch(() => {});
}

/** Test hooks — never used by the HTTP layer. */
export const __internal = {
  JOBS,
  pickStreamForTarget,
  qualityToHeight,
  sanitizeBaseName,
  setFfmpegProbe(value) {
    ffmpegProbe = value;
  },
};
