import fs from 'node:fs/promises';
import { extensionOfFileName, hasAllowedExtension } from '../data/mediaFormats.js';
import fsSync from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { execSync, spawn } from 'node:child_process';
import { recordRxBytes, runtimeEnginePreferences } from './trafficEngine.js';

export const CHROME_DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
export const YT_IOS_UA =
  'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)';
export const YT_ANDROID_UA =
  'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip';

// Automatically select the exact upstream User-Agent required by CDN signed URLs
export function selectOptimalUpstreamUserAgent(targetUrl = '') {
  const s = String(targetUrl || '');
  if (s.includes('googlevideo.com')) {
    if (/[?&]c=IOS(&|$)/i.test(s)) return YT_IOS_UA;
    if (/[?&]c=ANDROID(&|$)/i.test(s)) return YT_ANDROID_UA;
  }
  return CHROME_DESKTOP_UA;
}

// ============================================================================
// HIGH-THROUGHPUT KEEP-ALIVE TCP/TLS AGENT POOL (64 CONCURRENT SOCKETS!)
// ============================================================================
const fastHttpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 32,
  timeout: 45000,
});

const fastHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 32,
  timeout: 45000,
});

function openRawRangeStream(targetUrl, extraHeaders = {}, abortSignal, redirectsLeft = 6) {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      return reject(new Error('Download paused or cancelled'));
    }
    if (redirectsLeft <= 0) {
      return reject(new Error('Too many HTTP redirects on media stream'));
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return reject(new Error(`Invalid stream URL: ${targetUrl}`));
    }

    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const req = transport.get(
      parsed,
      {
        agent: isHttps ? fastHttpsAgent : fastHttpAgent,
        headers: {
          'User-Agent': selectOptimalUpstreamUserAgent(targetUrl),
          Accept: '*/*',
          Connection: 'keep-alive',
          ...extraHeaders,
        },
        highWaterMark: 2 * 1024 * 1024,
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const nextUrl = new URL(res.headers.location, targetUrl).toString();
          res.resume();
          return resolve(openRawRangeStream(nextUrl, extraHeaders, abortSignal, redirectsLeft - 1));
        }
        resolve({ req, res, finalUrl: targetUrl });
      }
    );

    const onAbort = () => {
      req.destroy(new Error('Aborted'));
    };
    if (abortSignal) {
      abortSignal.addEventListener('abort', onAbort, { once: true });
      req.on('close', () => abortSignal.removeEventListener('abort', onAbort));
    }
    req.on('error', reject);
  });
}

function createPerFileSpeedPacer() {
  let windowStart = Date.now();
  let bytesInWindow = 0;

  return async function paceBytesIfLimited(chunkBytes) {
    if (!runtimeEnginePreferences.speedLimiterEnabled) return;
    const maxBytesPerSec = Math.max(
      10 * 1024,
      Number(runtimeEnginePreferences.maxSpeedKBps || 500) * 1024
    );
    const now = Date.now();
    const elapsedMs = now - windowStart;
    if (elapsedMs >= 1000) {
      windowStart = now;
      bytesInWindow = chunkBytes;
      return;
    }
    bytesInWindow += chunkBytes;
    const expectedMs = Math.round((bytesInWindow / maxBytesPerSec) * 1000);
    if (expectedMs > elapsedMs + 15) {
      await new Promise((r) => setTimeout(r, Math.min(600, expectedMs - elapsedMs)));
    }
  };
}

// ============================================================================
// 1. TRUE IDM 32-CONNECTION PARALLEL HTTP BYTE-RANGE ACCELERATOR ENGINE
// ============================================================================
export async function downloadParallelIdmRangeStream({
  url,
  destPath,
  referer = '',
  abortSignal,
  threads = runtimeEnginePreferences.idmConnections || 32,
  onProgress,
}) {
  const baseHeaders = referer && !String(url).includes('googlevideo.com') ? { Referer: referer } : {};
  const { req: probeReq, res: probeRes, finalUrl } = await openRawRangeStream(
    url,
    { ...baseHeaders, Range: 'bytes=0-0' },
    abortSignal
  );

  if (probeRes.statusCode !== 200 && probeRes.statusCode !== 206) {
    probeRes.resume();
    probeReq.destroy();
    throw new Error(`Upstream HTTP ${probeRes.statusCode}`);
  }

  const contentRange = String(probeRes.headers['content-range'] || '');
  const totalFromRange = contentRange.includes('/') ? Number(contentRange.split('/')[1]) : 0;
  const totalBytes = totalFromRange || Number(probeRes.headers['content-length'] || 0);
  const supportsRanges = probeRes.statusCode === 206 && totalBytes > 512 * 1024;
  probeRes.destroy();
  probeReq.destroy();

  const startedAt = Date.now();
  let downloadedBytes = 0;
  let lastTick = 0;
  let recentWindowTime = startedAt;
  let recentWindowBytes = 0;
  let smoothSpeedBps = 0;
  const paceBytes = createPerFileSpeedPacer();
  const slabSize = Math.max(1, Number(runtimeEnginePreferences.writeBufferMb || 4)) * 1024 * 1024;

  const reportProgress = (forceTotal = totalBytes, activeThreadsCount = 1) => {
    const now = Date.now();
    if (now - lastTick < 150) return;
    lastTick = now;
    const dt = Math.max(0.08, (now - recentWindowTime) / 1000);
    const instantBps = (downloadedBytes - recentWindowBytes) / dt;
    smoothSpeedBps =
      smoothSpeedBps > 0
        ? Math.round(smoothSpeedBps * 0.45 + instantBps * 0.55)
        : Math.round(instantBps);
    if (now - recentWindowTime >= 750) {
      recentWindowTime = now;
      recentWindowBytes = downloadedBytes;
    }
    const denom = forceTotal || downloadedBytes || 1;
    const pct = forceTotal > 0 ? Math.min(99, Math.round((downloadedBytes / denom) * 100)) : 65;
    const eta =
      forceTotal > 0 && smoothSpeedBps > 0
        ? Math.max(0, Math.round((forceTotal - downloadedBytes) / smoothSpeedBps))
        : 0;
    onProgress?.({
      pct,
      downloadedBytes,
      totalBytes: denom,
      speedBps: Math.max(0, smoothSpeedBps),
      etaSeconds: eta,
      activeThreads: activeThreadsCount,
    });
  };

  if (!supportsRanges) {
    const fileHandle = await fs.open(destPath, 'w');
    const { res: streamRes } = await openRawRangeStream(finalUrl, baseHeaders, abortSignal);
    const slab = Buffer.allocUnsafe(slabSize);
    let filled = 0;
    let filePos = 0;
    try {
      for await (const chunk of streamRes) {
        await paceBytes(chunk.length);
        recordRxBytes(chunk.length);
        downloadedBytes += chunk.length;
        if (filled + chunk.length > slab.length) {
          if (filled > 0) {
            await fileHandle.write(slab, 0, filled, filePos);
            filePos += filled;
            filled = 0;
          }
          if (chunk.length >= slab.length) {
            await fileHandle.write(chunk, 0, chunk.length, filePos);
            filePos += chunk.length;
          } else {
            chunk.copy(slab, 0);
            filled = chunk.length;
          }
        } else {
          chunk.copy(slab, filled);
          filled += chunk.length;
        }
        reportProgress(totalBytes, 1);
      }
      if (filled > 0) {
        await fileHandle.write(slab, 0, filled, filePos);
      }
    } finally {
      await fileHandle.close();
    }
    return downloadedBytes;
  }

  const numParts = Math.min(Math.max(1, Number(threads) || 32), Math.ceil(totalBytes / (512 * 1024)));
  const partSize = Math.ceil(totalBytes / numParts);
  const ranges = [];
  for (let i = 0; i < numParts; i++) {
    const start = i * partSize;
    if (start >= totalBytes) break;
    const end = Math.min(totalBytes - 1, start + partSize - 1);
    ranges.push({ index: i, start, end });
  }

  const fileHandle = await fs.open(destPath, 'w');
  try {
    await Promise.all(
      ranges.map(async (part) => {
        let writeCursor = part.start;
        let attempt = 0;
        const slab = Buffer.allocUnsafe(Math.min(slabSize, part.end - part.start + 1));

        while (writeCursor <= part.end) {
          if (abortSignal?.aborted) throw new Error('Download paused or cancelled');
          let filled = 0;
          let slabStartOffset = writeCursor;

          try {
            const { res: partRes } = await openRawRangeStream(
              finalUrl,
              {
                ...baseHeaders,
                Range: `bytes=${writeCursor}-${part.end}`,
              },
              abortSignal
            );
            if (partRes.statusCode !== 206 && partRes.statusCode !== 200) {
              partRes.resume();
              throw new Error(`Range HTTP ${partRes.statusCode}`);
            }

            for await (const rawChunk of partRes) {
              const remaining = part.end - (slabStartOffset + filled) + 1;
              if (remaining <= 0) break;
              const sliceLen = Math.min(rawChunk.length, remaining);

              await paceBytes(sliceLen);
              recordRxBytes(sliceLen);
              downloadedBytes += sliceLen;

              if (filled + sliceLen > slab.length) {
                if (filled > 0) {
                  await fileHandle.write(slab, 0, filled, slabStartOffset);
                  writeCursor = slabStartOffset + filled;
                  slabStartOffset = writeCursor;
                  filled = 0;
                }
                if (sliceLen >= slab.length) {
                  await fileHandle.write(rawChunk, 0, sliceLen, slabStartOffset);
                  writeCursor = slabStartOffset + sliceLen;
                  slabStartOffset = writeCursor;
                } else {
                  rawChunk.copy(slab, 0, 0, sliceLen);
                  filled = sliceLen;
                }
              } else {
                rawChunk.copy(slab, filled, 0, sliceLen);
                filled += sliceLen;
              }

              reportProgress(totalBytes, ranges.length);
            }

            if (filled > 0) {
              await fileHandle.write(slab, 0, filled, slabStartOffset);
              writeCursor = slabStartOffset + filled;
              filled = 0;
            }
            break;
          } catch (err) {
            if (filled > 0) {
              await fileHandle.write(slab, 0, filled, slabStartOffset).catch(() => {});
              writeCursor = slabStartOffset + filled;
            }
            if (abortSignal?.aborted) throw err;
            attempt += 1;
            if (attempt >= 6) throw err;
            await new Promise((r) => setTimeout(r, 250 * attempt));
          }
        }
      })
    );
  } finally {
    await fileHandle.close();
  }

  return totalBytes;
}

// ============================================================================
// 2. NATIVE WINDOWS INTERNET DOWNLOAD MANAGER (`IDMan.exe`) + `.EF2` EXPORT!
// Automatically discovers IDM via custom path, Windows Registry, or Program Files!
// ============================================================================
let cachedWinIdmRegistryPath = undefined;

export function findLocalWindowsIdmBinary() {
  if (
    runtimeEnginePreferences.customWindowsIdmPath &&
    fsSync.existsSync(runtimeEnginePreferences.customWindowsIdmPath)
  ) {
    return runtimeEnginePreferences.customWindowsIdmPath;
  }
  if (process.platform !== 'win32') return null;

  if (cachedWinIdmRegistryPath === undefined) {
    cachedWinIdmRegistryPath = '';
    try {
      const regOut = execSync('reg query "HKCU\\Software\\DownloadManager" /v ExePath', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2000,
      });
      const match = /ExePath\s+REG_SZ\s+(.+)/i.exec(regOut);
      if (match?.[1]?.trim() && fsSync.existsSync(match[1].trim())) {
        cachedWinIdmRegistryPath = match[1].trim();
      }
    } catch {
      cachedWinIdmRegistryPath = '';
    }
  }
  if (cachedWinIdmRegistryPath && fsSync.existsSync(cachedWinIdmRegistryPath)) {
    return cachedWinIdmRegistryPath;
  }

  const candidates = [
    'C:\\Program Files (x86)\\Internet Download Manager\\IDMan.exe',
    'C:\\Program Files\\Internet Download Manager\\IDMan.exe',
    process.env.LOCALAPPDATA
      ? `${process.env.LOCALAPPDATA}\\Programs\\Internet Download Manager\\IDMan.exe`
      : '',
  ].filter(Boolean);

  return candidates.find((p) => fsSync.existsSync(p)) || null;
}

export function getWindowsIdmStatus() {
  const exe = findLocalWindowsIdmBinary();
  return {
    platform: process.platform,
    detected: Boolean(exe),
    binaryPath: exe,
    defaultWindowsPath: 'C:\\Program Files (x86)\\Internet Download Manager\\IDMan.exe',
    threadsConfigured: runtimeEnginePreferences.idmConnections,
    speedLimiterEnabled: runtimeEnginePreferences.speedLimiterEnabled,
    maxSpeedKBps: runtimeEnginePreferences.maxSpeedKBps,
  };
}

export function triggerLocalWindowsIdmDownload(directDownloadUrl, fileName) {
  const idmExe = findLocalWindowsIdmBinary();

  // ROUTING RULE:
  //   1. IDM installed on the user's PC + extension is supported  -> hand to IDM
  //   2. otherwise                                               -> Chrome download manager
  const extension = extensionOfFileName(fileName) || extensionOfFileName(directDownloadUrl.split('?')[0]);
  const extensionSupported = Boolean(extension) && hasAllowedExtension(fileName || directDownloadUrl.split('?')[0]);

  if (!idmExe || !extensionSupported) {
    return {
      launchedDesktopIdm: false,
      idmBinaryPath: null,
      fallbackMode: 'chrome_browser',
      idmInstalled: Boolean(idmExe),
      extension,
      extensionSupported,
      routingReason: !idmExe ? 'idm_not_installed' : 'extension_not_supported',
    };
  }

  // Launch visible Windows PC IDM dialog / progress directly with exact URL & file name!
  const args = ['/d', directDownloadUrl];
  if (fileName) args.push('/f', fileName);

  try {
    const child = spawn(idmExe, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref?.();
    return {
      launchedDesktopIdm: true,
      idmBinaryPath: idmExe,
      fallbackMode: 'pc_idm_native',
      idmInstalled: true,
      extension,
      extensionSupported: true,
      routingReason: 'idm_installed_and_extension_supported',
    };
  } catch {
    return {
      launchedDesktopIdm: false,
      idmBinaryPath: null,
      fallbackMode: 'chrome_browser',
      idmInstalled: true,
      extension,
      extensionSupported: true,
      routingReason: 'idm_spawn_failed',
    };
  }
}

export function buildIdmEf2FileContent({
  directUrl,
  downloadUrl,
  refererUrl = '',
  referer = '',
  userAgent = '',
}) {
  const url = directUrl || downloadUrl;
  const ref = refererUrl || referer;
  const effectiveUa = userAgent || selectOptimalUpstreamUserAgent(url);
  return ['<', url, ref ? `referer: ${ref}` : '', `User-Agent: ${effectiveUa}`, '>', '']
    .filter(Boolean)
    .join('\r\n');
}

export const generateIdmEf2Content = buildIdmEf2FileContent;
