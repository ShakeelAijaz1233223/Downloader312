import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { ENV } from '../config/env.js';
import {
  sqlQuery,
  getDatabaseHealth,
  getDatabaseDiagnostics,
  optimizeDatabaseTables,
  writeSecurityAuditLog,
} from '../db/database.js';
import { AppError, asyncHandler, sendSuccess } from '../utils/errors.js';
import {
  hashSecret,
  verifySecretHash,
  signUserAccessToken,
  encryptVaultSecret,
} from '../security/cryptoVault.js';
import { validateSafeExternalUrlSync, normalizeCommonMirrorTypos } from '../security/antiSsrfGuard.js';
import {
  getMediaBinariesStatus,
  getActivePlatformsFromDb,
  searchLiveVideos,
  analyzeMediaUrl,
} from '../services/extractorEngine.js';
import {
  proxyRemoteMediaStream,
  streamDirectDownloadPassThrough,
  pipeLivePureJsPreview,
  proxySubtitleDownload,
  streamLocalFileWithRange,
  streamHlsDownloadAsFile,
  proxyHlsPlayback,
  proxyHlsSubResource,
} from '../services/streamProxyService.js';
import {
  listAdSlots,
  recordAdEvent,
  recordVisitorSession,
} from '../services/adsService.js';
import {
  createConvertJob,
  getConvertJob,
  listConvertJobs,
  cancelConvertJob,
  getConvertedFilePath,
  getConverterCapabilities,
  streamConvertedFile,
} from '../services/mediaConverter.js';
import { searchVideos50, SEARCH_FILTERS } from '../services/videoSearchService.js';
import { analyseForSeo } from '../services/seoAiService.js';
import { universalAnythingSearch } from '../services/universalSearch.js';
import {
  createDownloadTicket,
  serveTicketDownload,
} from '../services/fileDownloadService.js';
import { listLibraryFiles } from '../data/downloadLibrary.js';
import {
  createManagedDownloadJob,
  getDownloadJobById,
  getDownloadJobRawRow,
  listDownloadJobsForUser,
  controlManagedDownloadJob,
  batchControlDownloadJobs,
} from '../services/downloadJobManager.js';
import { pushOrUpdateVolatileCard, getAllVolatileCards } from '../services/liveCardBus.js';
import { requireRegisteredUser } from '../middleware/securityMiddleware.js';
import {
  DEFAULT_AD_WATERFALL,
  DEFAULT_SYSTEM_SETTINGS,
  detectPlatformFromUrl,
} from '../data/platformDefinitions.js';
import {
  buildLiveTeraboxM3u8Manifest,
  streamLiveTeraboxDirectDownload,
} from '../services/teraboxEngine.js';
import {
  generateIdmEf2Content,
  triggerLocalWindowsIdmDownload,
  getWindowsIdmStatus,
} from '../services/idmTurboDownloader.js';
import {
  enqueueAnalyticsWrite,
  getBackendTrafficSnapshot,
  runtimeEnginePreferences,
  updateRuntimeEnginePreferences,
  resetRuntimeEnginePreferences,
  clearReadThroughCache,
  cachedOrCoalesced,
} from '../services/trafficEngine.js';

export const publicRouter = express.Router();

export async function loadAdWaterfallMapFromDb() {
  return cachedOrCoalesced('sql:ad_waterfall_map', 10000, async () => {
    const rows = await sqlQuery('SELECT zone_key, config_json FROM ad_waterfall_zones');
    if (!rows.length) return DEFAULT_AD_WATERFALL;
    const map = { ...DEFAULT_AD_WATERFALL };
    for (const r of rows) {
      try {
        map[r.zone_key] = JSON.parse(r.config_json);
      } catch {
        // ignore corrupted JSON
      }
    }
    return map;
  });
}

export async function loadSystemSettingsFromDb() {
  return cachedOrCoalesced('sql:system_settings_global', 10000, async () => {
    const rows = await sqlQuery('SELECT setting_json FROM system_settings WHERE setting_key = ?', [
      'global',
    ]);
    if (!rows[0]) return DEFAULT_SYSTEM_SETTINGS;
    try {
      return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(rows[0].setting_json) };
    } catch {
      return DEFAULT_SYSTEM_SETTINGS;
    }
  });
}

export async function loadWebsitesFromDb() {
  return cachedOrCoalesced('sql:websites_list', 15000, async () => {
    const rows = await sqlQuery('SELECT * FROM websites ORDER BY created_at ASC');
    return rows.map((w) => ({
      id: w.id,
      name: w.name,
      domain: w.domain,
      contentMode: w.content_mode,
      shieldMode: w.content_mode,
      status: w.status,
      monthlyRevenue: Number(w.monthly_revenue),
      monthlyExpense: Number(w.monthly_expense),
      seoScore: Number(w.seo_score),
    }));
  });
}

// High-Traffic Non-Blocking Write-Behind SQL Batcher!
function logAnalyticsEvent(websiteId, eventName, platformId = null, meta = {}) {
  enqueueAnalyticsWrite(
    sqlQuery,
    websiteId || 'site_main_clean',
    eventName,
    platformId,
    meta
  );
}

// 1. Live System Health Probe + Real-Time Backend TX/RX & High-Traffic Pool Telemetry
publicRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const [binaries, database] = await Promise.all([
      getMediaBinariesStatus(),
      getDatabaseHealth(),
    ]);
    return sendSuccess(res, {
      status: 'online',
      service: 'UltraDownloader High-Traffic Lockstep Engine',
      version: '8.0.0',
      database,
      binaries,
      traffic: getBackendTrafficSnapshot(),
      enginePreferences: runtimeEnginePreferences,
      liveRamCardsCount: getAllVolatileCards().length,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  })
);

publicRouter.get(
  '/system/telemetry',
  asyncHandler(async (_req, res) => {
    const [database, binaries] = await Promise.all([
      getDatabaseHealth(),
      getMediaBinariesStatus(),
    ]);
    return sendSuccess(res, {
      traffic: getBackendTrafficSnapshot(),
      database,
      binaries,
      enginePreferences: runtimeEnginePreferences,
      liveRamCardsCount: getAllVolatileCards().length,
      uptimeSeconds: Math.round(process.uptime()),
    });
  })
);

// 2. Full Frontend <-> Backend Synced Engine Settings API (IDM, Speed Limiter, TeraBox, Proxy/DoH, SQL)
publicRouter.get(
  '/system/settings',
  asyncHandler(async (_req, res) => {
    const cookieRows = await sqlQuery(
      'SELECT id, platform_label, platform_id, masked_preview, updated_at FROM encrypted_cookies ORDER BY updated_at DESC'
    ).catch(() => []);
    return sendSuccess(res, {
      enginePreferences: runtimeEnginePreferences,
      windowsIdm: getWindowsIdmStatus(),
      savedCookiesCount: cookieRows.length,
      savedCookies: cookieRows,
    });
  })
);

publicRouter.put(
  '/system/settings',
  asyncHandler(async (req, res) => {
    const updated = updateRuntimeEnginePreferences(req.body || {});
    const now = new Date().toISOString();
    await sqlQuery(
      `INSERT INTO system_settings (setting_key, setting_json, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_json = VALUES(setting_json), updated_at = VALUES(updated_at)`,
      ['engine_preferences', JSON.stringify(updated), now]
    );
    clearReadThroughCache('analysis:');
    return sendSuccess(res, {
      enginePreferences: updated,
      windowsIdm: getWindowsIdmStatus(),
      persistedInMysql: true,
    });
  })
);

// Live MySQL Database Diagnostics & 1-Click Maintenance (Optimize Tables / Clear Cache / Clean Completed)
publicRouter.get(
  '/system/db-diagnostics',
  asyncHandler(async (_req, res) => {
    const [diagnostics, binaries] = await Promise.all([
      getDatabaseDiagnostics(),
      getMediaBinariesStatus(),
    ]);
    return sendSuccess(res, {
      diagnostics,
      binaries,
      windowsIdm: getWindowsIdmStatus(),
      traffic: getBackendTrafficSnapshot(diagnostics),
    });
  })
);

publicRouter.post(
  '/system/db-maintenance',
  asyncHandler(async (req, res) => {
    const action = String(req.body?.action || 'optimize_tables');
    let clearedCacheEntries = 0;

    if (action === 'optimize_tables') {
      clearedCacheEntries = clearReadThroughCache();
      await optimizeDatabaseTables();
    } else if (action === 'flush_ram_cache') {
      clearedCacheEntries = clearReadThroughCache();
    } else if (action === 'clear_completed_jobs') {
      await batchControlDownloadJobs(req.clientIp, 'delete_completed');
    } else if (action === 'factory_reset_settings') {
      const defaults = resetRuntimeEnginePreferences();
      await sqlQuery(
        `INSERT INTO system_settings (setting_key, setting_json, updated_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_json = VALUES(setting_json), updated_at = VALUES(updated_at)`,
        ['engine_preferences', JSON.stringify(defaults), new Date().toISOString()]
      );
      clearedCacheEntries = clearReadThroughCache();
    }

    const diagnostics = await getDatabaseDiagnostics();
    return sendSuccess(res, {
      action,
      clearedCacheEntries,
      diagnostics,
      enginePreferences: runtimeEnginePreferences,
      timestamp: new Date().toISOString(),
    });
  })
);

// Save Enrolled Course / TeraBox Netscape Cookies Encrypted in MySQL (AES-256-GCM) directly from Settings!
publicRouter.post(
  '/system/cookies',
  asyncHandler(async (req, res) => {
    const platformId = String(req.body?.platformId || 'udemy').trim().toLowerCase();
    const platformLabel = String(req.body?.platformLabel || platformId.toUpperCase()).trim();
    const cookiesTxt = String(req.body?.cookiesTxt || '').trim();
    if (cookiesTxt.length < 10) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Paste valid Netscape cookies.txt lines or session cookie header.');
    }

    const enc = encryptVaultSecret(cookiesTxt);
    const id = `ck-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();
    await sqlQuery('DELETE FROM encrypted_cookies WHERE platform_id = ?', [platformId]);
    await sqlQuery(
      `INSERT INTO encrypted_cookies (
        id, platform_label, platform_id, iv_hex, auth_tag_hex, ciphertext_hex, masked_preview, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active (AES-256-GCM)', ?)`,
      [
        id,
        platformLabel,
        platformId,
        enc.ivHex,
        enc.authTagHex,
        enc.ciphertextHex,
        `AES-256-GCM (${cookiesTxt.length} chars)`,
        now,
      ]
    );
    clearReadThroughCache('analysis:');
    return sendSuccess(res, { saved: true, id, platformId, platformLabel }, 201);
  })
);

publicRouter.post(
  '/system/clear-cache',
  asyncHandler(async (_req, res) => {
    clearReadThroughCache();
    return sendSuccess(res, { cleared: true, timestamp: new Date().toISOString() });
  })
);

// 3. Unified Frontend Bootstrap Config
publicRouter.get(
  '/config/bootstrap',
  asyncHandler(async (req, res) => {
    const [websites, allPlatforms, adWaterfallConfig, settings] = await Promise.all([
      loadWebsitesFromDb(),
      getActivePlatformsFromDb(),
      loadAdWaterfallMapFromDb(),
      loadSystemSettingsFromDb(),
    ]);

    const activeWebsite =
      websites.find((w) => w.id === req.websiteProjectId) || websites[0];

    // Family-safe product: 18+ platforms are permanently removed, so every
    // content mode simply serves the full clean platform list.
    const filteredPlatforms = allPlatforms.filter((p) => !p.isAdult && p.category !== 'adult_18');

    logAnalyticsEvent(req.websiteProjectId, 'app_visit', null, {});

    return sendSuccess(res, {
      backendMode: 'node_express_lockstep_v8',
      websiteProject: activeWebsite,
      websites,
      contentMode: activeWebsite?.contentMode || 'clean_mainstream',
      platforms: filteredPlatforms,
      adWaterfallConfig,
      settings,
      enginePreferences: runtimeEnginePreferences,
      traffic: getBackendTrafficSnapshot(),
    });
  })
);

// 4. Public User Registration & Login (Real Bcrypt + SQL Persistence)
// ---------------------------------------------------------------------------
// ADS  (public: fetch active slots + track real impressions / clicks)
// ---------------------------------------------------------------------------
publicRouter.get(
  '/ads/slots',
  asyncHandler(async (_req, res) => {
    const slots = await listAdSlots({ activeOnly: true });
    return sendSuccess(res, { slots });
  })
);

publicRouter.post(
  '/ads/event',
  asyncHandler(async (req, res) => {
    const ip = String(req.ip || req.headers['x-forwarded-for'] || '0.0.0.0').split(',')[0].trim();
    const result = await recordAdEvent({
      slotKey: String(req.body?.slotKey || '').trim(),
      eventType: String(req.body?.eventType || 'impression').trim(),
      ip,
      userAgent: req.headers['user-agent'] || '',
      pagePath: String(req.body?.pagePath || '/'),
    });
    return sendSuccess(res, result);
  })
);

// Real traffic ledger: hashed visitor sessions (new IP = new visitor).
publicRouter.post(
  '/analytics/visit',
  asyncHandler(async (req, res) => {
    const ip = String(req.ip || req.headers['x-forwarded-for'] || '0.0.0.0').split(',')[0].trim();
    const session = await recordVisitorSession({
      ip,
      userAgent: req.headers['user-agent'] || '',
      country: String(req.headers['cf-ipcountry'] || ''),
    });
    return sendSuccess(res, session);
  })
);

publicRouter.post(
  '/auth/register',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      fullName: z.string().min(2).max(120),
      email: z.string().email().max(190),
      password: z.string().min(6).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Provide a valid full name, email, and 6+ character password.');
    }

    const emailLower = parsed.data.email.trim().toLowerCase();
    const existing = await sqlQuery('SELECT id FROM users WHERE email = ?', [emailLower]);
    if (existing.length > 0) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }

    const user = {
      id: `usr-${uuidv4().slice(0, 8)}`,
      fullName: parsed.data.fullName.trim(),
      email: emailLower,
      dailyQuota: 500,
    };
    const passHash = await hashSecret(parsed.data.password);
    await sqlQuery(
      'INSERT INTO users (id, full_name, email, password_hash, daily_quota, created_at) VALUES (?, ?, ?, ?, 500, ?)',
      [user.id, user.fullName, user.email, passHash, new Date().toISOString()]
    );

    const token = signUserAccessToken(user);
    res.cookie('ud_user_jwt', token, { httpOnly: true, sameSite: 'lax', path: '/' });
    return sendSuccess(res, { userAccessToken: token, user }, 201);
  })
);

publicRouter.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const emailLower = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const rows = await sqlQuery('SELECT * FROM users WHERE email = ?', [emailLower]);
    const row = rows[0];
    if (!row || !(await verifySecretHash(password, row.password_hash))) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password.');
    }

    const user = {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      dailyQuota: Number(row.daily_quota),
    };
    const token = signUserAccessToken(user);
    res.cookie('ud_user_jwt', token, { httpOnly: true, sameSite: 'lax', path: '/' });
    return sendSuccess(res, { userAccessToken: token, user });
  })
);

publicRouter.get(
  '/auth/me',
  requireRegisteredUser,
  asyncHandler(async (req, res) => {
    const rows = await sqlQuery('SELECT id, full_name, email, daily_quota FROM users WHERE id = ?', [
      req.user.sub,
    ]);
    if (!rows[0]) throw new AppError(401, 'UNAUTHORIZED', 'User account not found.');
    return sendSuccess(res, {
      user: {
        id: rows[0].id,
        fullName: rows[0].full_name,
        email: rows[0].email,
        dailyQuota: Number(rows[0].daily_quota),
      },
    });
  })
);

publicRouter.post('/auth/logout', (_req, res) => {
  res.clearCookie('ud_user_jwt', { path: '/' });
  return sendSuccess(res, { loggedOut: true });
});

// 5. User Synced Favorites (Real SQL CRUD)
publicRouter.get(
  '/user/favorites',
  requireRegisteredUser,
  asyncHandler(async (req, res) => {
    const rows = await sqlQuery(
      'SELECT * FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.sub]
    );
    return sendSuccess(
      res,
      rows.map((r) => ({
        id: r.id,
        url: r.video_url,
        title: r.title,
        thumbnailUrl: r.thumbnail_url,
        platformId: r.platform_id,
        durationText: r.duration_text,
      }))
    );
  })
);

publicRouter.post(
  '/user/favorites',
  requireRegisteredUser,
  asyncHandler(async (req, res) => {
    const url = String(req.body?.url || '').trim();
    if (!url) throw new AppError(400, 'VALIDATION_ERROR', 'Video URL is required.');

    const existing = await sqlQuery(
      'SELECT id FROM user_favorites WHERE user_id = ? AND video_url = ?',
      [req.user.sub, url]
    );
    if (existing[0]) {
      await sqlQuery('DELETE FROM user_favorites WHERE id = ?', [existing[0].id]);
    } else {
      await sqlQuery(
        `INSERT INTO user_favorites (id, user_id, video_url, title, thumbnail_url, platform_id, duration_text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `fav-${uuidv4().slice(0, 8)}`,
          req.user.sub,
          url,
          String(req.body?.title || 'Saved Video'),
          String(req.body?.thumbnailUrl || ''),
          String(req.body?.platformId || 'youtube'),
          String(req.body?.durationText || ''),
          new Date().toISOString(),
        ]
      );
    }

    const updated = await sqlQuery(
      'SELECT * FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.sub]
    );
    return sendSuccess(
      res,
      updated.map((r) => ({
        id: r.id,
        url: r.video_url,
        title: r.title,
        thumbnailUrl: r.thumbnail_url,
        platformId: r.platform_id,
        durationText: r.duration_text,
      }))
    );
  })
);

// 6. ZERO-AUTO-DB SILENT PASTE CAPTURE -> RAM ONLY + REAL BACKGROUND ENRICH!
publicRouter.post(
  '/intake/paste-capture',
  asyncHandler(async (req, res) => {
    const rawUrl = normalizeCommonMirrorTypos(String(req.body?.rawUrl || req.body?.url || '').trim());
    const sourceContext = String(req.body?.sourceContext || 'hero_input').slice(0, 64);

    validateSafeExternalUrlSync(rawUrl);

    const platforms = await getActivePlatformsFromDb();
    // NEVER fail for an unlisted host: every URL gets a universal adapter.
    const detectedPlat =
      detectPlatformFromUrl(rawUrl, platforms) ||
      (() => {
        let host = 'web';
        try {
          host = new URL(rawUrl).hostname.replace(/^www\./, '');
        } catch {
          /* keep default */
        }
        return {
          id: 'universal_web',
          displayName: host,
          subtitle: 'Universal engine · any website',
          category: 'web',
          accentColor: '#38BDF8',
          iconKey: 'globe',
          domains: [host],
          isAdult: false,
        };
      })();
    const cardId = `card-${Date.now()}-${uuidv4().slice(0, 6)}`;
    const nowIso = new Date().toISOString();

    const initialCard = {
      cardId,
      rawUrl,
      canonicalUrl: rawUrl,
      title: `Resolving stream: ${rawUrl}`,
      thumbnailUrl: '',
      platform: detectedPlat,
      platformId: detectedPlat.id,
      platformName: detectedPlat.displayName,
      category: detectedPlat.category,
      durationText: 'Probing...',
      resolutionLabel: 'Live',
      estimatedSizeBytes: null,
      streamUrl: `/api/v1/stream/live-pipe?url=${encodeURIComponent(rawUrl)}`,
      previewPlayer: {
        streamUrl: `/api/v1/stream/live-pipe?url=${encodeURIComponent(rawUrl)}`,
      },
      isAdult: Boolean(detectedPlat.isAdult),
      isSavedToVault: false,
      sourceContext,
      createdAt: nowIso,
      pastedAt: nowIso,
    };

    pushOrUpdateVolatileCard(initialCard);
    logAnalyticsEvent(req.websiteProjectId, 'url_pasted', detectedPlat.id, { sourceContext });

    analyzeMediaUrl({ rawUrl })
      .then((resolved) => {
        pushOrUpdateVolatileCard({
          ...initialCard,
          canonicalUrl: resolved.canonicalUrl,
          title: resolved.media.title,
          thumbnailUrl: resolved.media.thumbnailUrl,
          platform: resolved.platform,
          platformId: resolved.platform.id,
          platformName: resolved.platform.displayName,
          category: resolved.platform.category,
          durationText: resolved.media.durationText,
          resolutionLabel: resolved.media.maxResolutionLabel,
          estimatedSizeBytes: resolved.media.estimatedBestSizeBytes,
          streamUrl: resolved.media.previewPlayer.streamUrl,
          previewPlayer: { streamUrl: resolved.media.previewPlayer.streamUrl },
          isAdult: Boolean(resolved.media.isAdult),
        });
      })
      .catch((err) => {
        pushOrUpdateVolatileCard({
          ...initialCard,
          durationText: 'Restricted / Unresolved',
          title: `${detectedPlat.displayName} URL (${err.message || 'Check Cookies / Access'})`,
        });
      });

    return sendSuccess(res, initialCard, 201);
  })
);

// 6b. UNIVERSAL "ANYTHING" SEARCH — one keyword, every engine
publicRouter.post(
  '/search/anything',
  asyncHandler(async (req, res) => {
    const query = String(req.body?.q || req.query?.q || '').trim();
    if (!query) {
      throw new AppError(400, 'INVALID_QUERY', 'Type a name, title or keyword to search.');
    }
    const result = await universalAnythingSearch({ query, limit: Number(req.body?.limit || 12) });
    logAnalyticsEvent(req.websiteProjectId, 'universal_search', null, { q: query });
    return sendSuccess(res, result);
  })
);

// 7. Real Live Search via `yt-dlp ytsearch:`
publicRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const mode = String(req.query.mode || 'video');
    const sort = String(req.query.sort || 'relevance');

    if (!q) {
      return sendSuccess(res, { items: [], page: 1, hasMore: false });
    }

    logAnalyticsEvent(req.websiteProjectId, 'search_executed', 'youtube', { q, mode });
    const data = await searchLiveVideos({ query: q, mode, sort, limit: 9 });
    return sendSuccess(res, data);
  })
);

// 8. Full Multi-Engine URL Analysis (TeraPlay Free + yt-dlp + Deep Movie/Course Sniffer)
publicRouter.post(
  '/analysis',
  asyncHandler(async (req, res) => {
    const rawUrl = String(req.body?.url || '').trim();
    const selectedPlatformId = String(req.body?.selectedPlatformId || '');
    const pasteLeadId = String(req.body?.pasteLeadId || req.body?.cardId || '');
    const ephemeralCookiesTxt = String(req.body?.ephemeralCookiesTxt || '');

    const analysis = await analyzeMediaUrl({
      rawUrl,
      selectedPlatformId,
      ephemeralCookiesTxt,
    });

    logAnalyticsEvent(req.websiteProjectId, 'video_analyzed', analysis.platform.id, {
      extractorTier: analysis.extractorTier,
    });

    const cardId = pasteLeadId || `card-${Date.now()}-${uuidv4().slice(0, 6)}`;
    const nowIso = new Date().toISOString();

    pushOrUpdateVolatileCard({
      cardId,
      rawUrl,
      canonicalUrl: analysis.canonicalUrl,
      title: analysis.media.title,
      thumbnailUrl: analysis.media.thumbnailUrl,
      platform: analysis.platform,
      platformId: analysis.platform.id,
      platformName: analysis.platform.displayName,
      category: analysis.platform.category,
      durationText: analysis.media.durationText,
      resolutionLabel: analysis.media.maxResolutionLabel,
      estimatedSizeBytes: analysis.media.estimatedBestSizeBytes,
      streamUrl: analysis.media.previewPlayer.streamUrl,
      previewPlayer: { streamUrl: analysis.media.previewPlayer.streamUrl },
      isAdult: Boolean(analysis.media.isAdult),
      isSavedToVault: false,
      sourceContext: 'analyzed',
      createdAt: nowIso,
      pastedAt: nowIso,
    });

    return sendSuccess(res, analysis);
  })
);

// 9. Instant Online Browser Players: TeraPlay HLS + Range Proxy + Live Pipe + Subtitles
publicRouter.get(
  '/stream/terabox-hls',
  asyncHandler(async (req, res) => {
    const surl = String(req.query.surl || '').trim();
    const fsId = String(req.query.fs_id || '').trim();
    const rawUrl = String(
      req.query.url || (surl ? `https://www.terabox.app/sharing/link?surl=${surl}` : '')
    ).trim();
    if (!rawUrl) throw new AppError(400, 'VALIDATION_ERROR', 'Missing TeraBox share URL.');
    const manifest = await buildLiveTeraboxM3u8Manifest(rawUrl, fsId);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(manifest);
  })
);

publicRouter.get(
  '/stream/terabox-direct',
  asyncHandler(async (req, res) => {
    await streamLiveTeraboxDirectDownload(req, res);
  })
);

publicRouter.get(
  '/stream/direct-download',
  asyncHandler(async (req, res) => {
    await streamDirectDownloadPassThrough(req, res);
  })
);

publicRouter.get(
  '/stream/direct-download/:fileHint',
  asyncHandler(async (req, res) => {
    await streamDirectDownloadPassThrough(req, res);
  })
);

publicRouter.get(
  '/stream/hls-download',
  asyncHandler(async (req, res) => {
    await streamHlsDownloadAsFile(req, res);
  })
);

// Same handler with a real file name in the path so IDM's browser monitor
// instantly recognises the extension (e.g. `/stream/direct-download/Movie_720p.mp4`).
publicRouter.get(
  '/stream/hls-download/:fileHint',
  asyncHandler(async (req, res) => {
    await streamHlsDownloadAsFile(req, res);
  })
);

publicRouter.get(
  '/stream/hls-play',
  asyncHandler(async (req, res) => {
    await proxyHlsPlayback(req, res);
  })
);

publicRouter.get(
  '/stream/hls-play/seg',
  asyncHandler(async (req, res) => {
    await proxyHlsSubResource(req, res);
  })
);

publicRouter.get(
  '/stream/proxy',
  asyncHandler(async (req, res) => {
    await proxyRemoteMediaStream(req, res);
  })
);

publicRouter.get(
  '/stream/live-pipe',
  asyncHandler(async (req, res) => {
    await pipeLivePureJsPreview(req, res);
  })
);

publicRouter.get(
  '/stream/subtitle',
  asyncHandler(async (req, res) => {
    await proxySubtitleDownload(req, res);
  })
);

// 10. Direct PC IDM / Chrome Download Trigger + Strict User-Only Download History (`0` Guest History!)
const handleTriggerDirectDownload = asyncHandler(async (req, res) => {
  const originBaseUrl = `${req.protocol}://${req.get('host')}`;
  const job = await createManagedDownloadJob({
    requesterIp: req.clientIp,
    user: req.user,
    originBaseUrl,
    deliveryMode: String(req.body?.deliveryMode || 'auto'),
    title: req.body?.title,
    sourceUrl: String(req.body?.sourceUrl || req.body?.url || ''),
    formatSelector: String(req.body?.formatSelector || 'direct_idm_stream'),
    streamUrl: String(req.body?.streamUrl || ''),
    thumbnailUrl: String(req.body?.thumbnailUrl || ''),
    platformId: String(req.body?.platformId || 'youtube'),
    qualityLabel: String(req.body?.qualityLabel || '1080p'),
    formatExt: String(req.body?.formatExt || 'mp4'),
    totalBytes: Number(req.body?.totalBytes || 0),
  });
  logAnalyticsEvent(req.websiteProjectId, 'download_started', job.platformId, {
    qualityLabel: job.qualityLabel,
    formatExt: job.formatExt,
    savedToHistory: Boolean(job.savedToHistory),
  });
  return sendSuccess(res, job, 201);
});

publicRouter.post('/downloads', handleTriggerDirectDownload);
publicRouter.post('/downloads/trigger', handleTriggerDirectDownload);

// Strictly returns ONLY the logged-in user's download history (`[]` when logged out!)
publicRouter.get(
  '/downloads',
  asyncHandler(async (req, res) => {
    const jobs = await listDownloadJobsForUser(req.user);
    return sendSuccess(res, jobs);
  })
);

// Clean All History (`DELETE /api/v1/downloads`) — removes ALL history rows for logged-in user!
publicRouter.delete(
  '/downloads',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return sendSuccess(res, { cleaned: true, jobs: [] });
    }
    const jobs = await batchControlDownloadJobs(req.user, 'delete_all');
    return sendSuccess(res, { cleaned: true, jobs });
  })
);

// Batch Toolbar Actions: `clean`, `delete_all`, `delete_completed`
publicRouter.post(
  '/downloads/batch',
  asyncHandler(async (req, res) => {
    const action = String(req.body?.action || 'delete_all');
    const jobs = await batchControlDownloadJobs(req.user, action);
    return sendSuccess(res, { action, jobs });
  })
);

// Instant Direct Send to Windows PC `IDMan.exe` (0 Server Wait -> Full Line Speed!)
publicRouter.post(
  '/downloads/send-direct-idm',
  asyncHandler(async (req, res) => {
    const rawTarget = String(req.body?.streamUrl || req.body?.sourceUrl || '').trim();
    if (!rawTarget) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Missing download stream URL.');
    }
    const cleanName =
      String(req.body?.fileName || 'UltraDownloader_Video.mp4')
        .replace(/[^\p{L}\p{N}\s_.-]/gu, '')
        .trim()
        .replace(/\s+/g, '_') || 'Video.mp4';
    const referer = String(req.body?.sourceUrl || rawTarget);

    const origin = `${req.protocol}://${req.get('host')}`;
    const absoluteTarget = rawTarget.startsWith('/') ? `${origin}${rawTarget}` : rawTarget;

    const launched = triggerLocalWindowsIdmDownload(absoluteTarget, cleanName);
    const ef2Content = generateIdmEf2Content({
      downloadUrl: absoluteTarget,
      referer,
    });

    return sendSuccess(res, {
      ...launched,
      targetUrl: absoluteTarget,
      fileName: cleanName,
      ef2Content,
    });
  })
);

publicRouter.get(
  '/downloads/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Sign in required to inspect saved download history.');
    }
    const job = await getDownloadJobById(req.params.id, req.user.sub || req.user.id);
    return sendSuccess(res, job);
  })
);

publicRouter.patch(
  '/downloads/:id',
  asyncHandler(async (req, res) => {
    const updated = await controlManagedDownloadJob(
      req.params.id,
      req.body?.action || 'delete',
      req.user
    );
    return sendSuccess(res, updated);
  })
);

publicRouter.delete(
  '/downloads/:id',
  asyncHandler(async (req, res) => {
    const updated = await controlManagedDownloadJob(req.params.id, 'delete', req.user);
    return sendSuccess(res, updated);
  })
);

publicRouter.get(
  '/downloads/:id/file',
  asyncHandler(async (req, res) => {
    const rawJob = await getDownloadJobRawRow(req.params.id);
    if (rawJob.local_output_path) {
      const mimeMap = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        ts: 'video/mp2t',
      };
      const mime = mimeMap[rawJob.format_ext] || 'application/octet-stream';
      return streamLocalFileWithRange(req, res, rawJob.local_output_path, mime, rawJob.file_name);
    }
    if (rawJob.stream_url) {
      return res.redirect(302, rawJob.stream_url);
    }
    throw new AppError(404, 'DOWNLOAD_NOT_FOUND', 'Stream target unavailable.');
  })
);

// 1-Click IDM `.ef2` Export File (Internet Download Manager Native Multi-Connection Import)
publicRouter.get(
  '/downloads/:id/idm-export',
  asyncHandler(async (req, res) => {
    const rawJob = await getDownloadJobRawRow(req.params.id);
    const origin = `${req.protocol}://${req.get('host')}`;
    const targetUrl = rawJob.stream_url?.startsWith('/')
      ? `${origin}${rawJob.stream_url}`
      : /^https?:\/\//i.test(String(rawJob.stream_url || ''))
      ? rawJob.stream_url
      : `${origin}/api/v1/downloads/${rawJob.id}/file`;

    const ef2Payload = generateIdmEf2Content({
      downloadUrl: targetUrl,
      referer: rawJob.source_url,
    });
    const safeEf2Name = `${rawJob.file_name.replace(/\.[^.]+$/, '')}_IDM_32x.ef2`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeEf2Name}"`);
    return res.status(200).send(ef2Payload);
  })
);

// Direct Windows `IDMan.exe` Trigger Endpoint
publicRouter.post(
  '/downloads/:id/open-in-idm',
  asyncHandler(async (req, res) => {
    const rawJob = await getDownloadJobRawRow(req.params.id);
    const origin = `${req.protocol}://${req.get('host')}`;
    const targetUrl = rawJob.stream_url?.startsWith('/')
      ? `${origin}${rawJob.stream_url}`
      : /^https?:\/\//i.test(String(rawJob.stream_url || ''))
      ? rawJob.stream_url
      : `${origin}/api/v1/downloads/${rawJob.id}/file`;

    const result = triggerLocalWindowsIdmDownload(targetUrl, rawJob.file_name);
    return sendSuccess(res, {
      ...result,
      targetUrl,
      directDownloadUrl: rawJob.stream_url || `/api/v1/downloads/${rawJob.id}/file`,
      idmEf2Url: `/api/v1/downloads/${rawJob.id}/idm-export`,
    });
  })
);

// 10b. SIGNED FILE DOWNLOAD SYSTEM (real bytes, real browser download)
// - POST /files/download-ticket  -> verifies the target & returns a short-lived signed URL
// - GET  /files/download/:name   -> streams the real file with Content-Disposition
// - GET  /files/library          -> authorized public file catalogue
publicRouter.get(
  '/files/library',
  asyncHandler(async (req, res) => {
    return sendSuccess(res, { files: listLibraryFiles() });
  })
);

publicRouter.post(
  '/files/download-ticket',
  asyncHandler(async (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const ticket = await createDownloadTicket({
      fileId: req.body?.fileId,
      url: req.body?.url,
      fileName: req.body?.fileName,
      mimeType: req.body?.mimeType,
      sourceUrl: req.body?.sourceUrl,
      title: req.body?.title,
      qualityLabel: req.body?.qualityLabel,
      formatId: req.body?.formatId,
      qualityKey: req.body?.qualityKey,
      platformId: req.body?.platformId,
      user: req.user,
      originBaseUrl: origin,
      refreshSource: Boolean(req.body?.refreshSource),
    });
    return sendSuccess(res, ticket, 201);
  })
);

const handleTicketDownload = asyncHandler(async (req, res) => {
  await serveTicketDownload(req, res, req.query.ticket || req.query.t || '');
});

publicRouter.head('/files/download', handleTicketDownload);
publicRouter.get('/files/download', handleTicketDownload);
publicRouter.head('/files/download/:fileHint', handleTicketDownload);
publicRouter.get('/files/download/:fileHint', handleTicketDownload);

// ============================================================================
// 12. AUTO-CONVERT ENGINE  (V12) — real MP3/M4A + real-quality MP4 output
// ============================================================================
publicRouter.get(
  '/convert/capabilities',
  asyncHandler(async (_req, res) => sendSuccess(res, await getConverterCapabilities()))
);

publicRouter.post(
  '/convert',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const job = await createConvertJob({
      sourceUrl: body.sourceUrl || body.url,
      title: body.title,
      target: body.target,
      audioFormat: body.audioFormat,
      mode: body.mode,
    });
    return sendSuccess(res, job, 202);
  })
);

publicRouter.get(
  '/convert',
  asyncHandler(async (_req, res) => sendSuccess(res, { jobs: listConvertJobs(10) }))
);

publicRouter.get(
  '/convert/:id',
  asyncHandler(async (req, res) => {
    const job = getConvertJob(req.params.id);
    if (!job) {
      throw new AppError(404, 'CONVERT_JOB_NOT_FOUND', 'That conversion job no longer exists.');
    }
    return sendSuccess(res, job);
  })
);

publicRouter.delete(
  '/convert/:id',
  asyncHandler(async (req, res) => {
    const job = cancelConvertJob(req.params.id);
    if (!job) {
      throw new AppError(404, 'CONVERT_JOB_NOT_FOUND', 'That conversion job no longer exists.');
    }
    return sendSuccess(res, job);
  })
);

publicRouter.get(
  '/convert/:id/file',
  asyncHandler(async (req, res) => {
    const file = getConvertedFilePath(req.params.id);
    if (!file) {
      throw new AppError(
        410,
        'CONVERT_FILE_GONE',
        'This converted file has expired or was removed. Please convert again.'
      );
    }
    return streamConvertedFile(req, res, file);
  })
);

publicRouter.head(
  '/convert/:id/file',
  asyncHandler(async (req, res) => {
    const file = getConvertedFilePath(req.params.id);
    if (!file) {
      throw new AppError(
        410,
        'CONVERT_FILE_GONE',
        'This converted file has expired or was removed. Please convert again.'
      );
    }
    return streamConvertedFile(req, res, file);
  })
);

// ============================================================================
// 13. VIDEO SEARCH ENGINE (V12) — exactly 50 real videos: 30 top + 20 middle
// ============================================================================
publicRouter.get(
  '/videos/search',
  asyncHandler(async (req, res) => {
    const data = await searchVideos50({
      query: req.query.q || req.query.query || '',
      duration: String(req.query.duration || 'any'),
      sort: String(req.query.sort || 'relevance'),
      refresh: String(req.query.refresh || '') === '1',
    });
    return sendSuccess(res, { ...data, filters: SEARCH_FILTERS });
  })
);

// ============================================================================
// 14. SEO + AI ANALYSIS (V12) — real metadata + honest download verdict + SEO
// ============================================================================
publicRouter.post(
  '/seo/analyze',
  asyncHandler(async (req, res) => {
    const data = await analyseForSeo(req.body?.url, {
      selectedPlatformId: req.body?.selectedPlatformId || '',
    });
    return sendSuccess(res, data);
  })
);

// Direct one-click download for a public library file (no ticket round-trip needed
// for plain links; the endpoint still re-validates the registry + file on disk).
publicRouter.get(
  '/files/:fileId/download',
  asyncHandler(async (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const ticket = await createDownloadTicket({
      fileId: req.params.fileId,
      user: req.user,
      originBaseUrl: origin,
    });
    const target = new URL(ticket.downloadUrl);
    return res.redirect(302, `${target.pathname}${target.search}`);
  })
);

// 11. Viral Watch-Link Sharing (/v/:shortCode)
publicRouter.post(
  '/share',
  asyncHandler(async (req, res) => {
    const rawUrl = normalizeCommonMirrorTypos(String(req.body?.url || '').trim());
    validateSafeExternalUrlSync(rawUrl);

    const shortCode = uuidv4().replace(/-/g, '').slice(0, 7);
    const streamUrl =
      req.body?.streamUrl || `/api/v1/stream/live-pipe?url=${encodeURIComponent(rawUrl)}`;

    await sqlQuery(
      `INSERT INTO share_links (short_code, source_url, title, platform_id, thumbnail_url, duration_text, stream_url, views, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        shortCode,
        rawUrl,
        String(req.body?.title || rawUrl),
        String(req.body?.platformId || 'youtube'),
        String(req.body?.thumbnailUrl || ''),
        String(req.body?.durationText || ''),
        streamUrl,
        new Date().toISOString(),
      ]
    );

    logAnalyticsEvent(req.websiteProjectId, 'share_created', req.body?.platformId, { shortCode });
    return sendSuccess(res, { shortCode, sharePath: `/v/${shortCode}` }, 201);
  })
);

publicRouter.get(
  '/share/:shortCode',
  asyncHandler(async (req, res) => {
    const code = String(req.params.shortCode || '').trim();
    const rows = await sqlQuery('SELECT * FROM share_links WHERE short_code = ?', [code]);
    if (!rows[0]) {
      throw new AppError(404, 'NOT_FOUND', `Shared watch link /v/${code} does not exist.`);
    }

    const found = rows[0];
    const nextViews = Number(found.views || 0) + 1;
    await sqlQuery('UPDATE share_links SET views = ? WHERE short_code = ?', [nextViews, code]);
    logAnalyticsEvent(req.websiteProjectId, 'share_visit', found.platform_id, { shortCode: code });

    return sendSuccess(res, {
      shortCode: found.short_code,
      url: found.source_url,
      title: found.title,
      platformId: found.platform_id,
      thumbnailUrl: found.thumbnail_url,
      durationText: found.duration_text,
      streamUrl: found.stream_url,
      views: nextViews,
    });
  })
);

// 12. 4-Stage Ad Waterfall Config & Hit-Tracked SEO Landing Metadata
publicRouter.get(
  '/ads/waterfall',
  asyncHandler(async (_req, res) => {
    const waterfall = await loadAdWaterfallMapFromDb();
    return sendSuccess(res, waterfall);
  })
);

publicRouter.get(
  '/seo/landing/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const platforms = await getActivePlatformsFromDb();

    await sqlQuery(
      'UPDATE seo_keywords SET impressions = impressions + 1, clicks = clicks + 1 WHERE slug = ?',
      [slug]
    );
    logAnalyticsEvent(req.websiteProjectId, 'seo_landing_visit', null, { slug });

    const matched =
      platforms.find((p) => p.seoSlug === slug) || {
        id: 'universal_web',
        displayName: slug
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        subtitle: 'Live Online Player & Video Downloader',
        category: 'video',
        seoSlug: slug,
        exampleUrl: '',
      };

    return sendSuccess(res, {
      slug,
      platform: matched,
      metaTitle: `${matched.displayName} Online Video Player & Downloader — UltraDownloader`,
      metaDescription: `Analyze, preview in the browser and download ${matched.displayName} streams as real MP4 video or an MP3/M4A audio track — free, no software.`,
    });
  })
);

// 13. Event Tracker & Fake-404 Honeypot Trap Logger
publicRouter.post(
  '/events/track',
  asyncHandler(async (req, res) => {
    logAnalyticsEvent(
      req.websiteProjectId,
      String(req.body?.eventName || 'page_view'),
      req.body?.platformId || null,
      req.body?.meta || {}
    );
    return sendSuccess(res, { tracked: true }, 201);
  })
);

publicRouter.post(
  '/security/honeypot',
  asyncHandler(async (req, res) => {
    const attemptedPath = String(req.body?.attemptedPath || '/admin').slice(0, 128);
    await writeSecurityAuditLog(
      'HONEYPOT_TRAP_TRIGGERED',
      req.clientIp,
      req.headers['user-agent'],
      `Blocked probe on decoy route ${attemptedPath} (Fake 404 Served)`
    );
    return sendSuccess(res, { logged: true });
  })
);
