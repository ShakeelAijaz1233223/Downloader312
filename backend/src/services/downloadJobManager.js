import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { ENV } from '../config/env.js';
import { sqlQuery } from '../db/database.js';
import { AppError } from '../utils/errors.js';
import { assertSafeOutboundUrl, normalizeCommonMirrorTypos } from '../security/antiSsrfGuard.js';
import { analyzeMediaUrl, wrapDirectPassThroughUrl } from './extractorEngine.js';
import { isTeraboxEcosystemUrl, downloadTeraboxFullVideoTurbo } from './teraboxEngine.js';
import {
  downloadParallelIdmRangeStream,
  triggerLocalWindowsIdmDownload,
  generateIdmEf2Content,
} from './idmTurboDownloader.js';
import { runtimeEnginePreferences } from './trafficEngine.js';

const activeProcesses = new Map();
const liveProgressOverlay = new Map();

function pushLiveProgress(jobId, patch) {
  const prev = liveProgressOverlay.get(jobId) || {};
  const next = { ...prev, ...patch, updatedAtMs: Date.now() };
  if ((next.speedBps || 0) > (prev.peakSpeedBps || 0)) {
    next.peakSpeedBps = next.speedBps;
  }
  liveProgressOverlay.set(jobId, next);
}

function getAuthenticatedUserId(user) {
  const uid = user?.sub || user?.id || '';
  return String(uid).trim() || null;
}

export function buildCleanDownloadFileName(rawTitle, qualityLabel = 'HD', ext = 'mp4') {
  const safeExt = ['mp3', 'm4a', 'webm', 'ts', 'mp4'].includes(String(ext).toLowerCase())
    ? String(ext).toLowerCase()
    : 'mp4';
  const cleanTitle =
    String(rawTitle || 'Video')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 56) || 'Video';
  const cleanQual =
    String(qualityLabel || 'HD')
      .replace(/[^\p{L}\p{N}_-]/gu, '')
      .slice(0, 18) || 'HD';
  return `${cleanTitle}_${cleanQual}.${safeExt}`;
}

// Resolve a guaranteed direct HTTP 206 attachment stream URL for PC IDM & Chrome!
export async function resolveInstantDirectStreamPayload({
  sourceUrl,
  streamUrl = '',
  title = '',
  qualityLabel = '1080p',
  formatExt = 'mp4',
  totalBytes = 0,
}) {
  const healedUrl = normalizeCommonMirrorTypos(String(sourceUrl || '').trim());
  await assertSafeOutboundUrl(healedUrl, { performDnsCheck: true });

  let resolvedTitle = title;
  let resolvedExt = String(formatExt || 'mp4').toLowerCase();
  let resolvedBytes = Number(totalBytes || 0);
  let directPassUrl = String(streamUrl || '').trim();
  let rawUpstreamUrl = '';

  if (directPassUrl) {
    if (/^https?:\/\//i.test(directPassUrl)) {
      rawUpstreamUrl = directPassUrl;
      const fn = buildCleanDownloadFileName(resolvedTitle || 'Video', qualityLabel, resolvedExt);
      directPassUrl = wrapDirectPassThroughUrl(rawUpstreamUrl, fn, healedUrl);
    } else if (directPassUrl.startsWith('/api/v1/stream/proxy?url=')) {
      const u = new URL(directPassUrl, 'http://127.0.0.1:4000');
      rawUpstreamUrl = u.searchParams.get('url') || '';
      const fn = buildCleanDownloadFileName(resolvedTitle || 'Video', qualityLabel, resolvedExt);
      if (rawUpstreamUrl) {
        directPassUrl = wrapDirectPassThroughUrl(rawUpstreamUrl, fn, healedUrl);
      }
    }
  } else {
    const analyzed = await analyzeMediaUrl({ rawUrl: healedUrl });
    resolvedTitle = resolvedTitle || analyzed?.media?.title || 'Video';
    const pool =
      resolvedExt === 'mp3' || resolvedExt === 'm4a'
        ? [...(analyzed?.streams?.audioOnly || []), ...(analyzed?.streams?.videoAudio || [])]
        : [...(analyzed?.streams?.videoAudio || []), ...(analyzed?.streams?.audioOnly || [])];

    const matched =
      pool.find(
        (s) =>
          String(s.qualityTitle || '').toLowerCase() === String(qualityLabel || '').toLowerCase() ||
          String(s.qualityKey || '').toLowerCase() === String(qualityLabel || '').toLowerCase()
      ) || pool[0];

    if (!matched?.streamUrl) {
      throw new AppError(422, 'STREAM_UNAVAILABLE', 'No direct stream available for download.');
    }
    resolvedExt = matched.formatExt || resolvedExt;
    resolvedBytes = resolvedBytes || Number(matched.sizeBytes || 0);
    rawUpstreamUrl = matched.directCdnUrl || '';
    directPassUrl = matched.streamUrl;

    if (rawUpstreamUrl && directPassUrl.startsWith('/api/v1/stream/direct-download')) {
      const fn = buildCleanDownloadFileName(resolvedTitle, qualityLabel, resolvedExt);
      directPassUrl = wrapDirectPassThroughUrl(rawUpstreamUrl, fn, healedUrl);
    }
  }

  const fileName = buildCleanDownloadFileName(resolvedTitle || 'Video', qualityLabel, resolvedExt);
  return {
    healedUrl,
    title: resolvedTitle || 'Video',
    fileName,
    formatExt: resolvedExt,
    totalBytes: resolvedBytes,
    rawUpstreamUrl,
    directDownloadPath: directPassUrl,
  };
}

// Optional background local disk cache for API consumers calling GET /api/v1/downloads/:id/file
async function cacheLocalFileIfRequested(jobId, rawUpstreamUrl, healedUrl, fileName) {
  await fs.mkdir(ENV.TEMP_EPHEMERAL_DIR, { recursive: true });
  const outputPath = path.join(ENV.TEMP_EPHEMERAL_DIR, `${jobId}_${fileName}`);
  const ac = new AbortController();
  activeProcesses.set(jobId, { abortController: ac, outputPath });

  try {
    let size = 0;
    if (isTeraboxEcosystemUrl(healedUrl)) {
      size = await downloadTeraboxFullVideoTurbo({
        sourceUrl: healedUrl,
        outputPath,
        abortSignal: ac.signal,
        onProgress: ({ pct, downloadedBytes, totalBytes, speedBps }) => {
          pushLiveProgress(jobId, { status: 'downloading', pct, downloadedBytes, totalBytes, speedBps });
        },
      });
    } else if (rawUpstreamUrl) {
      size = await downloadParallelIdmRangeStream({
        url: rawUpstreamUrl,
        referer: healedUrl,
        destPath: outputPath,
        abortSignal: ac.signal,
        threads: runtimeEnginePreferences.idmConnections || 32,
        onProgress: ({ pct, downloadedBytes, totalBytes, speedBps, etaSeconds, activeThreads }) => {
          pushLiveProgress(jobId, {
            status: 'downloading',
            pct,
            downloadedBytes,
            totalBytes,
            speedBps,
            etaSeconds,
            activeThreads,
          });
        },
      });
    }
    const stat = fsSync.existsSync(outputPath) ? await fs.stat(outputPath) : { size };
    activeProcesses.delete(jobId);
    pushLiveProgress(jobId, {
      status: 'completed',
      pct: 100,
      downloadedBytes: stat.size,
      totalBytes: stat.size,
      speedBps: 0,
      etaSeconds: 0,
    });
    await sqlQuery(
      `UPDATE download_jobs
       SET status = 'completed', progress_pct = 100, local_output_path = ?,
           bytes_downloaded = ?, total_bytes = ?, speed_bps = 0, eta_seconds = 0
       WHERE id = ?`,
      [outputPath, stat.size, stat.size, jobId]
    ).catch(() => {});
  } catch (err) {
    activeProcesses.delete(jobId);
    pushLiveProgress(jobId, { status: 'failed', speedBps: 0 });
    await sqlQuery(
      `UPDATE download_jobs SET status = 'failed', speed_bps = 0, error_message = ? WHERE id = ?`,
      [err.message || 'Stream transfer interrupted', jobId]
    ).catch(() => {});
  }
}

// ============================================================================
// CREATE / TRIGGER DIRECT PC IDM OR CHROME BROWSER DOWNLOAD
// STRICT RULE:
// - If NO user is logged in (`!userId`): `0` rows saved to MySQL `download_jobs`!
//   Returns instant PC IDM launch + Chrome direct stream URL immediately!
// - If a user IS logged in (`userId` present): Stores strictly under `user_id`!
// ============================================================================
export async function createManagedDownloadJob({
  requesterIp,
  user = null,
  originBaseUrl = `http://127.0.0.1:${ENV.PORT}`,
  deliveryMode = 'auto', // 'auto' | 'idm' | 'chrome' | 'server_cache'
  title,
  sourceUrl,
  formatSelector = 'direct_idm_stream',
  streamUrl = '',
  thumbnailUrl = '',
  platformId = 'youtube',
  qualityLabel = '1080p',
  formatExt = 'mp4',
  totalBytes = 0,
}) {
  const resolved = await resolveInstantDirectStreamPayload({
    sourceUrl,
    streamUrl,
    title,
    qualityLabel,
    formatExt,
    totalBytes,
  });

  const absoluteDirectUrl = resolved.directDownloadPath.startsWith('http')
    ? resolved.directDownloadPath
    : `${originBaseUrl}${resolved.directDownloadPath}`;

  // Trigger Windows PC Internet Download Manager (`IDMan.exe`) immediately unless user explicitly picked Chrome-only
  const idmResult =
    deliveryMode === 'chrome'
      ? { launchedDesktopIdm: false, idmBinaryPath: null, fallbackMode: 'chrome_browser' }
      : triggerLocalWindowsIdmDownload(absoluteDirectUrl, resolved.fileName);

  const ef2Content = generateIdmEf2Content({
    downloadUrl: absoluteDirectUrl,
    referer: resolved.healedUrl,
  });

  const userId = getAuthenticatedUserId(user);

  // ==========================================================================
  // STRICT GUEST ZERO-HISTORY MANDATE:
  // No user logged in -> SAVE ZERO ROWS TO MYSQL `download_jobs`!
  // ==========================================================================
  if (!userId) {
    return {
      id: `guest-ephemeral-${uuidv4().slice(0, 8)}`,
      savedToHistory: false,
      guestZeroHistoryMode: true,
      userId: null,
      title: resolved.title,
      fileName: resolved.fileName,
      sourceUrl: resolved.healedUrl,
      streamUrl: resolved.directDownloadPath,
      directDownloadUrl: resolved.directDownloadPath,
      absoluteDirectUrl,
      thumbnailUrl,
      platformId,
      qualityLabel,
      formatExt: resolved.formatExt,
      status: 'dispatched',
      progressPct: 100,
      progressPercent: 100,
      downloadedBytes: resolved.totalBytes,
      totalBytes: resolved.totalBytes,
      launchedDesktopIdm: idmResult.launchedDesktopIdm,
      idmBinaryPath: idmResult.idmBinaryPath,
      deliveryTarget: idmResult.launchedDesktopIdm ? 'pc_idm' : 'chrome_browser',
      ef2Content,
      createdAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // LOGGED-IN USER MANDATE:
  // Store strictly bound to `user_id` so ONLY this logged-in user can see/manage it!
  // ==========================================================================
  const id = `dl-${uuidv4().slice(0, 10)}`;
  const now = new Date().toISOString();
  const initialStatus = deliveryMode === 'server_cache' ? 'downloading' : 'completed';
  const initialPct = deliveryMode === 'server_cache' ? 0 : 100;

  await sqlQuery(
    `INSERT INTO download_jobs (
      id, requester_ip, user_id, title, file_name, source_url, format_selector, stream_url,
      thumbnail_url, platform_id, quality_label, format_ext, status,
      progress_pct, bytes_downloaded, total_bytes, speed_bps, eta_seconds, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
    [
      id,
      requesterIp || '0.0.0.0',
      userId,
      resolved.title,
      resolved.fileName,
      resolved.healedUrl,
      formatSelector,
      resolved.directDownloadPath,
      thumbnailUrl,
      platformId,
      qualityLabel,
      resolved.formatExt,
      initialStatus,
      initialPct,
      deliveryMode === 'server_cache' ? 0 : resolved.totalBytes,
      resolved.totalBytes,
      now,
    ]
  );

  if (deliveryMode === 'server_cache') {
    cacheLocalFileIfRequested(
      id,
      resolved.rawUpstreamUrl,
      resolved.healedUrl,
      resolved.fileName
    ).catch(() => {});
  }

  const savedJob = await getDownloadJobById(id, userId);
  return {
    ...savedJob,
    savedToHistory: true,
    guestZeroHistoryMode: false,
    directDownloadUrl: resolved.directDownloadPath,
    absoluteDirectUrl,
    launchedDesktopIdm: idmResult.launchedDesktopIdm,
    idmBinaryPath: idmResult.idmBinaryPath,
    deliveryTarget: idmResult.launchedDesktopIdm ? 'pc_idm' : 'chrome_browser',
    ef2Content,
  };
}

export async function getDownloadJobById(id, userId = null) {
  const rows = userId
    ? await sqlQuery('SELECT * FROM download_jobs WHERE id = ? AND user_id = ?', [id, userId])
    : await sqlQuery('SELECT * FROM download_jobs WHERE id = ?', [id]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Download history item not found.');
  return mapDownloadRow(rows[0]);
}

export async function getDownloadJobRawRow(id, userId = null) {
  const rows = userId
    ? await sqlQuery('SELECT * FROM download_jobs WHERE id = ? AND user_id = ?', [id, userId])
    : await sqlQuery('SELECT * FROM download_jobs WHERE id = ?', [id]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Download history item not found.');
  return rows[0];
}

// STRICT USER-ONLY HISTORY QUERY: Returns [] when no user is logged in!
export async function listDownloadJobsForUser(user = null) {
  const userId = getAuthenticatedUserId(user);
  if (!userId) {
    return [];
  }
  const rows = await sqlQuery(
    'SELECT * FROM download_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
    [userId]
  );
  return rows.map(mapDownloadRow);
}

// Keep legacy alias forwarding cleanly to strict user-scoped query
export const listDownloadJobsForRequester = (_requesterIp, user = null) =>
  listDownloadJobsForUser(user);

export async function controlManagedDownloadJob(id, action, user = null) {
  const userId = getAuthenticatedUserId(user);
  if (!userId) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Please sign in to manage your download history.');
  }

  const existing = await sqlQuery(
    'SELECT id, local_output_path FROM download_jobs WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  if (!existing[0]) {
    throw new AppError(404, 'NOT_FOUND', 'Download history item not found for this user.');
  }

  const entry = activeProcesses.get(id);

  if (action === 'pause') {
    pushLiveProgress(id, { status: 'paused', speedBps: 0 });
    await sqlQuery(
      "UPDATE download_jobs SET status = 'paused', speed_bps = 0 WHERE id = ? AND user_id = ?",
      [id, userId]
    );
    entry?.abortController?.abort();
    activeProcesses.delete(id);
  } else if (action === 'cancel' || action === 'delete') {
    entry?.abortController?.abort();
    activeProcesses.delete(id);
    liveProgressOverlay.delete(id);
    if (existing[0].local_output_path) {
      await fs.unlink(existing[0].local_output_path).catch(() => {});
    }
    if (action === 'delete') {
      await sqlQuery('DELETE FROM download_jobs WHERE id = ? AND user_id = ?', [id, userId]);
      return { id, status: 'deleted', deleted: true };
    }
    await sqlQuery(
      "UPDATE download_jobs SET status = 'cancelled', speed_bps = 0 WHERE id = ? AND user_id = ?",
      [id, userId]
    );
  }

  return getDownloadJobById(id, userId);
}

export async function batchControlDownloadJobs(user = null, action = 'delete_all') {
  const userId = getAuthenticatedUserId(user);
  if (!userId) {
    return [];
  }

  const rows = await sqlQuery(
    'SELECT id, status, local_output_path FROM download_jobs WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );

  if (action === 'delete_all' || action === 'clean') {
    for (const r of rows) {
      activeProcesses.get(r.id)?.abortController?.abort();
      activeProcesses.delete(r.id);
      liveProgressOverlay.delete(r.id);
      if (r.local_output_path) {
        await fs.unlink(r.local_output_path).catch(() => {});
      }
    }
    await sqlQuery('DELETE FROM download_jobs WHERE user_id = ?', [userId]);
    return [];
  }

  if (action === 'delete_completed') {
    for (const r of rows) {
      if (['completed', 'cancelled', 'dispatched'].includes(r.status)) {
        if (r.local_output_path) {
          await fs.unlink(r.local_output_path).catch(() => {});
        }
        liveProgressOverlay.delete(r.id);
      }
    }
    await sqlQuery(
      "DELETE FROM download_jobs WHERE user_id = ? AND status IN ('completed', 'cancelled')",
      [userId]
    );
  }

  return listDownloadJobsForUser(user);
}

function mapDownloadRow(r) {
  const live = liveProgressOverlay.get(r.id);
  const status = live?.status || r.status;
  const pct = live?.pct !== undefined ? Number(live.pct) : Number(r.progress_pct);
  const dlBytes =
    live?.downloadedBytes !== undefined ? Number(live.downloadedBytes) : Number(r.bytes_downloaded);
  const totBytes = live?.totalBytes ? Number(live.totalBytes) : Number(r.total_bytes || 0);
  const spd = live?.speedBps !== undefined ? Number(live.speedBps) : Number(r.speed_bps);
  const threads = live?.activeThreads || runtimeEnginePreferences.idmConnections || 32;

  const isTera = isTeraboxEcosystemUrl(r.source_url);
  const engineLabel = isTera
    ? `TeraPlay IDM ${threads}x Direct`
    : `PC IDM / Chrome ${threads}x Direct`;

  const category =
    r.format_ext === 'mp3' || r.format_ext === 'm4a'
      ? 'music'
      : isTera
      ? 'cloud'
      : 'video';

  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    fileName: r.file_name,
    sourceUrl: r.source_url,
    streamUrl: r.stream_url || '',
    directDownloadUrl: r.stream_url || `/api/v1/downloads/${r.id}/file`,
    thumbnailUrl: r.thumbnail_url,
    platformId: r.platform_id,
    qualityLabel: r.quality_label,
    formatExt: r.format_ext,
    category,
    status,
    progressPct: pct,
    progressPercent: pct,
    downloadedBytes: dlBytes,
    totalBytes: totBytes,
    speedBytesPerSec: status === 'downloading' ? spd : 0,
    peakSpeedBytesPerSec: live?.peakSpeedBps || spd,
    activeThreads: threads,
    etaSeconds: 0,
    errorMessage: r.error_message || '',
    engineLabel,
    idmExportUrl: `/api/v1/downloads/${r.id}/idm-export`,
    directFileUrl: r.local_output_path
      ? `/api/v1/downloads/${r.id}/file`
      : r.stream_url || `/api/v1/downloads/${r.id}/file`,
    createdAt: r.created_at,
  };
}
