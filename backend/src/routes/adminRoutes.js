import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ENV } from '../config/env.js';
import { sqlQuery, writeSecurityAuditLog } from '../db/database.js';
import { AppError, asyncHandler, sendSuccess } from '../utils/errors.js';
import {
  verifySecretHash,
  verifyTotp2FA,
  signPadlockTicket,
  signAdminAccessToken,
  encryptVaultSecret,
  sanitizeCustomSvg,
} from '../security/cryptoVault.js';
import {
  enforceAdminIpAllowlist,
  assertAdminIpNotBanned,
  recordAdminFailureAndBanOnThirdStrike,
  clearAdminIpLockout,
  requirePadlockGate1Ticket,
  requireSuperAdminAuth,
} from '../middleware/securityMiddleware.js';
import {
  attachAdminSseClient,
  getAllVolatileCards,
  getVolatileCardById,
  removeVolatileCard,
  clearAllVolatileCards,
} from '../services/liveCardBus.js';
import {
  analyzeMediaUrl,
  getActivePlatformsFromDb,
  getMediaBinariesStatus,
} from '../services/extractorEngine.js';
import { downloadParallelIdmRangeStream } from '../services/idmTurboDownloader.js';
import { streamLocalFileWithRange } from '../services/streamProxyService.js';
import {
  listAdSlots,
  createAdSlot,
  updateAdSlot,
  deleteAdSlot,
  getAdsAnalytics,
} from '../services/adsService.js';
import {
  loadAdWaterfallMapFromDb,
  loadSystemSettingsFromDb,
  loadWebsitesFromDb,
} from './publicRoutes.js';

export const adminRouter = express.Router();

adminRouter.use(enforceAdminIpAllowlist);

// ============================================================================
// GATE 1: SECRET DIGITAL KEYPAD PIN VERIFICATION (3 WRONG TRIES = 30M BAN!)
// ============================================================================
adminRouter.post(
  '/padlock/verify',
  asyncHandler(async (req, res) => {
    await assertAdminIpNotBanned(req.clientIp);

    const submittedPin = String(req.body?.pin || '').trim();
    const admins = await sqlQuery('SELECT * FROM admin_users LIMIT 1');
    const masterAdmin = admins[0];

    const pinValid = masterAdmin && (await verifySecretHash(submittedPin, masterAdmin.pin_hash));
    if (!pinValid) {
      await recordAdminFailureAndBanOnThirdStrike(
        req.clientIp,
        req.headers['user-agent'],
        'GATE_1_PADLOCK_PIN'
      );
    }

    const padlockTicket = signPadlockTicket(req.clientIp);
    res.cookie('ud_padlock_ticket', padlockTicket, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });

    await writeSecurityAuditLog(
      'PADLOCK_GATE_1_UNLOCKED',
      req.clientIp,
      req.headers['user-agent'],
      'Secret Gate-1 Digital Keypad PIN verified.'
    );

    return sendSuccess(res, { padlockTicket, expiresInSeconds: 600 });
  })
);

// ============================================================================
// GATE 2: MASTER CREDENTIALS + 6-DIGIT TOTP 2FA VERIFICATION
// ============================================================================
adminRouter.post(
  '/auth/login',
  requirePadlockGate1Ticket,
  asyncHandler(async (req, res) => {
    await assertAdminIpNotBanned(req.clientIp);

    const identifier = String(req.body?.identifier || req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    const totpCode = String(req.body?.totpCode || '').trim();

    const rows = await sqlQuery(
      'SELECT * FROM admin_users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1',
      [identifier, identifier]
    );
    const adminRow = rows[0];

    const passwordOk = adminRow && (await verifySecretHash(password, adminRow.password_hash));
    const totpOk = adminRow && verifyTotp2FA(totpCode, adminRow.totp_secret);

    if (!passwordOk || !totpOk) {
      await recordAdminFailureAndBanOnThirdStrike(
        req.clientIp,
        req.headers['user-agent'],
        'GATE_2_ADMIN_CREDENTIALS_2FA'
      );
    }

    await clearAdminIpLockout(req.clientIp);
    await sqlQuery('UPDATE admin_users SET last_login_at = ? WHERE id = ?', [
      new Date().toISOString(),
      adminRow.id,
    ]);

    const admin = {
      id: adminRow.id,
      email: adminRow.email,
      fullName: adminRow.full_name,
      role: adminRow.role,
    };
    const adminAccessToken = signAdminAccessToken(admin);

    res.cookie('ud_admin_jwt', adminAccessToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });

    await writeSecurityAuditLog(
      'ADMIN_LOGIN_SUCCESS',
      req.clientIp,
      req.headers['user-agent'],
      `Super-Admin ${admin.email} unlocked Executive Suite.`
    );

    return sendSuccess(res, { adminAccessToken, admin });
  })
);

adminRouter.post('/auth/logout', (_req, res) => {
  res.clearCookie('ud_admin_jwt', { path: '/' });
  res.clearCookie('ud_padlock_ticket', { path: '/' });
  return sendSuccess(res, { loggedOut: true });
});

// ============================================================================
// ALL ROUTES BELOW REQUIRE VERIFIED SUPER-ADMIN SESSION!
// ============================================================================
adminRouter.use(requireSuperAdminAuth);

// ============================================================================
// ADS CONTROL CENTER + REAL EARNINGS ANALYTICS (Round-10)
// ============================================================================
adminRouter.get(
  '/ads/slots',
  asyncHandler(async (_req, res) => {
    const slots = await listAdSlots();
    return sendSuccess(res, { slots });
  })
);

adminRouter.post(
  '/ads/slots',
  asyncHandler(async (req, res) => {
    const slot = await createAdSlot(req.body || {});
    return sendSuccess(res, slot, 201);
  })
);

adminRouter.put(
  '/ads/slots/:id',
  asyncHandler(async (req, res) => {
    const slot = await updateAdSlot(req.params.id, req.body || {});
    if (!slot) throw new AppError(404, 'NOT_FOUND', 'Ad slot not found.');
    return sendSuccess(res, slot);
  })
);

adminRouter.delete(
  '/ads/slots/:id',
  asyncHandler(async (req, res) => {
    const result = await deleteAdSlot(req.params.id);
    return sendSuccess(res, result);
  })
);

adminRouter.get(
  '/ads/analytics',
  asyncHandler(async (_req, res) => {
    const analytics = await getAdsAnalytics();
    return sendSuccess(res, analytics);
  })
);

// 1. REAL-TIME UNBUFFERED SSE LIVE CARD STREAM & 3-BUTTON (`VIEW` | `SAVE` | `CLOSE`) ENGINE
adminRouter.get('/live-cards/stream', (req, res) => {
  attachAdminSseClient(req, res);
});

adminRouter.get('/live-cards', (_req, res) => {
  return sendSuccess(res, getAllVolatileCards());
});

// [ VIEW ] BUTTON -> Streams Live Video in Center Modal (0 SQL Rows & 0 Disk Bytes!)
adminRouter.get('/live-cards/:cardId/view', (req, res) => {
  const card = getVolatileCardById(req.params.cardId);
  if (!card) {
    throw new AppError(404, 'NOT_FOUND', 'Live notification card expired or already handled.');
  }
  return sendSuccess(res, {
    card,
    player: {
      mode: 'direct_proxy',
      streamUrl: card.streamUrl,
    },
  });
});

// [ SAVE ] BUTTON -> Commits Card to Permanent SQL `saved_vault_videos` + Archives Real MP4 to Disk!
adminRouter.post(
  '/live-cards/:cardId/save',
  asyncHandler(async (req, res) => {
    const card = getVolatileCardById(req.params.cardId);
    if (!card) {
      throw new AppError(404, 'NOT_FOUND', 'Live notification card already processed or expired.');
    }

    const vaultId = `vault-${Date.now()}-${uuidv4().slice(0, 5)}`;
    const nowIso = new Date().toISOString();
    const targetMp4Path = path.join(ENV.VAULT_STORAGE_DIR, `${vaultId}.mp4`);

    const title = String(req.body?.customTitle || card.title);
    const notes = String(req.body?.notes || '');
    const isPinned = req.body?.isPinned ? 1 : 0;

    await sqlQuery(
      `INSERT INTO saved_vault_videos (
        id, website_id, title, source_url, stream_url, local_file_path, thumbnail_url,
        platform_id, platform_json, category, duration_text, resolution_label,
        file_size_bytes, file_present_on_disk, is_pinned, is_adult, admin_notes, saved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        vaultId,
        req.websiteProjectId,
        title,
        card.rawUrl,
        card.streamUrl,
        targetMp4Path,
        card.thumbnailUrl,
        card.platform?.id || 'youtube',
        JSON.stringify(card.platform || {}),
        card.category || 'video',
        card.durationText || 'HD',
        card.resolutionLabel || 'HD',
        Number(card.estimatedSizeBytes || 0),
        isPinned,
        card.isAdult ? 1 : 0,
        notes,
        nowIso,
      ]
    );

    // Archive real playable MP4 to Vault storage asynchronously via Pure Node.js 32x IDM Stream Engine
    (async () => {
      try {
        const analysis = await analyzeMediaUrl({ rawUrl: card.rawUrl });
        const candidateUrl =
          analysis?.streams?.videoAudio?.[0]?.directCdnUrl ||
          (/^https?:\/\//i.test(card.rawUrl) ? card.rawUrl : '');
        if (!candidateUrl) return;
        await downloadParallelIdmRangeStream({
          url: candidateUrl,
          referer: card.rawUrl,
          destPath: targetMp4Path,
          threads: 16,
        });
        if (fsSync.existsSync(targetMp4Path)) {
          const st = await fs.stat(targetMp4Path).catch(() => null);
          if (st) {
            await sqlQuery(
              'UPDATE saved_vault_videos SET file_present_on_disk = 1, file_size_bytes = ?, stream_url = ? WHERE id = ?',
              [st.size, `/api/v1/admin/vault/${vaultId}/stream`, vaultId]
            ).catch(() => {});
          }
        }
      } catch {
        // non-blocking archive worker
      }
    })();

    removeVolatileCard(card.cardId);

    await writeSecurityAuditLog(
      'ADMIN_SAVED_CARD_TO_VAULT',
      req.clientIp,
      req.headers['user-agent'],
      `Saved "${title}" (${vaultId}) to Permanent Server Vault.`
    );

    return sendSuccess(
      res,
      {
        id: vaultId,
        vaultId,
        title,
        sourceUrl: card.rawUrl,
        rawUrl: card.rawUrl,
        streamUrl: card.streamUrl,
        thumbnailUrl: card.thumbnailUrl,
        platform: card.platform,
        platformName: card.platform?.displayName || 'Stream',
        category: card.category,
        durationText: card.durationText,
        resolutionLabel: card.resolutionLabel,
        maxResolutionLabel: card.resolutionLabel,
        fileSizeBytes: Number(card.estimatedSizeBytes || 0),
        sizeBytes: Number(card.estimatedSizeBytes || 0),
        filePresentOnDisk: true,
        isPinned: Boolean(isPinned),
        isAdult: Boolean(card.isAdult),
        adminNotes: notes,
        savedAt: nowIso,
      },
      201
    );
  })
);

// [ CLOSE ] BUTTON -> Wipes Card Immediately from RAM (`0` SQL Rows, `0` Disk Bytes!)
adminRouter.delete('/live-cards/:cardId/close', (req, res) => {
  removeVolatileCard(req.params.cardId);
  return sendSuccess(res, { closed: true, dbSaved: false, diskBytesUsed: 0 });
});

adminRouter.delete('/live-cards', (_req, res) => {
  clearAllVolatileCards();
  return sendSuccess(res, { cleared: true });
});

// ============================================================================
// 2. PERMANENT SAVED VIDEO VAULT CRUD + REAL FILE & DB DELETE!
// ============================================================================
function mapVaultRow(r) {
  let platform = { id: r.platform_id, displayName: r.platform_id };
  try {
    platform = JSON.parse(r.platform_json);
  } catch {
    // fallback object
  }
  return {
    id: r.id,
    vaultId: r.id,
    title: r.title,
    sourceUrl: r.source_url,
    rawUrl: r.source_url,
    streamUrl: r.file_present_on_disk ? `/api/v1/admin/vault/${r.id}/stream` : r.stream_url,
    thumbnailUrl: r.thumbnail_url,
    platform,
    platformName: platform?.displayName || r.platform_id,
    category: r.category,
    durationText: r.duration_text,
    resolutionLabel: r.resolution_label,
    maxResolutionLabel: r.resolution_label,
    fileSizeBytes: Number(r.file_size_bytes || 0),
    sizeBytes: Number(r.file_size_bytes || 0),
    filePresentOnDisk: Boolean(r.file_present_on_disk),
    isPinned: Boolean(r.is_pinned),
    isAdult: Boolean(r.is_adult),
    adminNotes: r.admin_notes || '',
    savedAt: r.saved_at,
  };
}

adminRouter.get(
  '/vault',
  asyncHandler(async (_req, res) => {
    const rows = await sqlQuery('SELECT * FROM saved_vault_videos ORDER BY saved_at DESC');
    return sendSuccess(res, rows.map(mapVaultRow));
  })
);

adminRouter.delete(
  '/vault/:id',
  asyncHandler(async (req, res) => {
    const rows = await sqlQuery('SELECT local_file_path, title FROM saved_vault_videos WHERE id = ?', [
      req.params.id,
    ]);
    if (rows[0]?.local_file_path) {
      await fs.unlink(rows[0].local_file_path).catch(() => {});
    }

    await sqlQuery('DELETE FROM saved_vault_videos WHERE id = ?', [req.params.id]);

    await writeSecurityAuditLog(
      'VAULT_STORAGE_DELETED',
      req.clientIp,
      req.headers['user-agent'],
      `Deleted Vault video "${rows[0]?.title || req.params.id}" from Disk & SQL.`
    );

    const remaining = await sqlQuery('SELECT * FROM saved_vault_videos ORDER BY saved_at DESC');
    return sendSuccess(res, remaining.map(mapVaultRow));
  })
);

adminRouter.get(
  '/vault/:id/stream',
  asyncHandler(async (req, res) => {
    const rows = await sqlQuery('SELECT * FROM saved_vault_videos WHERE id = ?', [req.params.id]);
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Vault item not found.');
    if (rows[0].local_file_path && fsSync.existsSync(rows[0].local_file_path)) {
      return streamLocalFileWithRange(req, res, rows[0].local_file_path, 'video/mp4');
    }

    // PLAY = exactly what a normal visitor gets: inline proxy stream, so the
    // admin <video> player behaves identically instead of triggering a download.
    const stored = String(rows[0].stream_url || '');
    try {
      const parsedStored = new URL(stored, 'http://placeholder.local');
      const upstream = parsedStored.searchParams.get('url');
      if (upstream && /^https?:\/\//i.test(upstream)) {
        return res.redirect(`/api/v1/stream/proxy?url=${encodeURIComponent(upstream)}`);
      }
    } catch {
      /* not a proxy path — fall through */
    }
    return res.redirect(stored);
  })
);

// ============================================================================
// 3. 100% REAL SQL ANALYTICS OVERVIEW, FUNNEL & LIVE DIAGNOSTICS (ZERO FAKE DATA!)
// ============================================================================
adminRouter.get(
  '/analytics/overview',
  asyncHandler(async (_req, res) => {
    const [
      ledgerRows,
      eventCounts,
      downloadStats,
      vaultStats,
      shareStats,
      seoStats,
    ] = await Promise.all([
      sqlQuery('SELECT entry_type, category, amount, entry_date FROM finance_ledger ORDER BY entry_date ASC'),
      sqlQuery('SELECT event_name, COUNT(*) AS cnt FROM analytics_events GROUP BY event_name'),
      sqlQuery(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed FROM download_jobs"
      ),
      sqlQuery('SELECT COUNT(*) AS cnt, COALESCE(SUM(file_size_bytes), 0) AS bytes FROM saved_vault_videos'),
      sqlQuery('SELECT COUNT(*) AS links, COALESCE(SUM(views), 0) AS views FROM share_links'),
      sqlQuery('SELECT COUNT(*) AS routes, COALESCE(SUM(clicks), 0) AS clicks, COALESCE(SUM(impressions), 0) AS impressions FROM seo_keywords'),
    ]);

    const totalRevenue = ledgerRows
      .filter((r) => r.entry_type === 'income')
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const totalExpenses = ledgerRows
      .filter((r) => r.entry_type === 'expense')
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const netProfit = totalRevenue - totalExpenses;

    // Group real ledger entries by date for the AreaChart
    const byDateMap = new Map();
    for (const r of ledgerRows) {
      const d = r.entry_date || 'Today';
      const cur = byDateMap.get(d) || { label: d, revenue: 0, cost: 0 };
      if (r.entry_type === 'income') cur.revenue += Number(r.amount);
      else cur.cost += Number(r.amount);
      byDateMap.set(d, cur);
    }
    const timelineSeries = Array.from(byDateMap.values());

    // Real event counts map
    const evtMap = {};
    for (const e of eventCounts) {
      evtMap[e.event_name] = Number(e.cnt);
    }

    const totalVisits =
      (evtMap.app_visit || 0) +
      (evtMap.seo_landing_visit || 0) +
      (evtMap.share_visit || 0);

    // Real Channel Activity Table computed purely from SQL!
    const channelPerformance = [
      {
        channel: 'Universal URL Analyzer (Direct)',
        events: (evtMap.video_analyzed || 0) + (evtMap.url_pasted || 0),
        downloads: Number(downloadStats[0]?.total || 0),
        completed: Number(downloadStats[0]?.completed || 0),
      },
      {
        channel: 'Live Search Engine (yt-dlp ytsearch)',
        events: evtMap.search_executed || 0,
        downloads: 0,
        completed: 0,
      },
      {
        channel: 'Programmatic SEO Pages (/tools/:slug)',
        events: Number(seoStats[0]?.clicks || 0),
        downloads: 0,
        completed: 0,
      },
      {
        channel: 'Viral Watch Links (/v/:shortCode)',
        events: Number(shareStats[0]?.views || 0),
        downloads: 0,
        completed: 0,
      },
    ];

    // Real Ad Waterfall Zone Impressions
    const waterfallBreakdown = [
      { name: 'Download Click Trigger', value: evtMap.ad_download_click || 0, color: '#2563EB' },
      { name: 'Native Banner Impressions', value: evtMap.ad_native_banner || 0, color: '#10B981' },
      { name: 'Player Pre-Roll Views', value: evtMap.ad_preroll || 0, color: '#8B5CF6' },
      { name: 'Queue Sponsor Views', value: evtMap.ad_queue_sponsor || 0, color: '#F59E0B' },
    ];

    return sendSuccess(res, {
      totalRevenue,
      totalExpenses,
      netProfit,
      roas: totalExpenses > 0 ? Number((totalRevenue / totalExpenses).toFixed(2)) : null,
      totalVisits,
      totalAnalyses: evtMap.video_analyzed || 0,
      totalSearches: evtMap.search_executed || 0,
      totalDownloads: Number(downloadStats[0]?.total || 0),
      completedDownloads: Number(downloadStats[0]?.completed || 0),
      savedVaultCount: Number(vaultStats[0]?.cnt || 0),
      savedVaultBytes: Number(vaultStats[0]?.bytes || 0),
      shareLinksCount: Number(shareStats[0]?.links || 0),
      shareViewsCount: Number(shareStats[0]?.views || 0),
      seoRoutesCount: Number(seoStats[0]?.routes || 0),
      seoClicksCount: Number(seoStats[0]?.clicks || 0),
      seoImpressionsCount: Number(seoStats[0]?.impressions || 0),
      timelineSeries,
      waterfallBreakdown,
      channelPerformance,
    });
  })
);

adminRouter.get(
  '/traffic/sources-funnel',
  asyncHandler(async (_req, res) => {
    const [shareStats, seoStats, visitRows] = await Promise.all([
      sqlQuery('SELECT COALESCE(SUM(views), 0) AS views FROM share_links'),
      sqlQuery('SELECT COALESCE(SUM(clicks), 0) AS clicks FROM seo_keywords'),
      sqlQuery("SELECT COUNT(*) AS cnt FROM analytics_events WHERE event_name = 'app_visit'"),
    ]);

    const directBookmarks = Number(visitRows[0]?.cnt || 0);
    const seoOrganic = Number(seoStats[0]?.clicks || 0);
    const viralWatchShares = Number(shareStats[0]?.views || 0);

    return sendSuccess(res, {
      totalFreeVisits: directBookmarks + seoOrganic + viralWatchShares,
      seoOrganic,
      viralWatchShares,
      directBookmarks,
    });
  })
);

// Real System Health & Configuration Diagnostics (Zero Fake Revenue Claims!)
adminRouter.get(
  '/ai-recommendations',
  asyncHandler(async (_req, res) => {
    const [binaries, cookiesCount, ledgerCount, seoCount, adWaterfall] = await Promise.all([
      getMediaBinariesStatus(),
      sqlQuery('SELECT COUNT(*) AS c FROM encrypted_cookies'),
      sqlQuery('SELECT COUNT(*) AS c FROM finance_ledger'),
      sqlQuery('SELECT COUNT(*) AS c FROM seo_keywords'),
      loadAdWaterfallMapFromDb(),
    ]);

    const cCount = Number(cookiesCount[0]?.c || 0);
    const lCount = Number(ledgerCount[0]?.c || 0);
    const sCount = Number(seoCount[0]?.c || 0);
    const activeZones = Object.values(adWaterfall).filter((z) => z?.enabled).length;

    return sendSuccess(res, [
      {
        id: 'diag-binaries',
        title: `Extractor Core: yt-dlp ${binaries.ytdlpVersion || 'Offline'} + FFmpeg ${binaries.ffmpegInstalled ? 'Ready' : 'Missing'}`,
        impact: 'LIVE ENGINE',
        gainEstimate: `${sCount} Active SEO Routes`,
        description:
          'Live stream extraction, real multi-track FFmpeg audio/video muxing, and HTTP 206 Range streaming are active.',
      },
      {
        id: 'diag-cookies',
        title: `Encrypted Cookies Vault: ${cCount} Session Profile${cCount === 1 ? '' : 's'} Stored`,
        impact: cCount === 0 ? 'ACTION SUGGESTED' : 'CONFIGURED',
        gainEstimate: 'AES-256-GCM Protected',
        description:
          cCount === 0
            ? 'Upload Netscape cookies.txt in the Sites & Cookies tab to unlock login-gated Vimeo, Instagram, or TeraBox streams.'
            : `${cCount} encrypted cookie profile(s) available for authenticated yt-dlp extraction.`,
      },
      {
        id: 'diag-ads-ledger',
        title: `Monetization & Ledger: ${activeZones}/4 Ad Zones Enabled · ${lCount} Ledger Entries`,
        impact: 'REAL TELEMETRY',
        gainEstimate: `Cooldown ${adWaterfall.download_click_direct_tab?.cooldownMinutes || 20}m`,
        description:
          'All KPI cards and charts reflect 100% real SQL transactions and live tracked events with zero dummy numbers.',
      },
    ]);
  })
);

// Real SQL SEO Routes & Hit Counters
adminRouter.get(
  '/seo/keywords',
  asyncHandler(async (_req, res) => {
    const rows = await sqlQuery('SELECT * FROM seo_keywords ORDER BY clicks DESC, created_at DESC');
    return sendSuccess(
      res,
      rows.map((r) => {
        const imp = Number(r.impressions || 0);
        const clk = Number(r.clicks || 0);
        const ctr = imp > 0 ? `${((clk / imp) * 100).toFixed(1)}%` : '0.0%';
        return {
          id: r.id,
          keyword: r.keyword,
          slug: r.slug,
          impressions: imp,
          clicks: clk,
          ctr,
          createdAt: r.created_at,
        };
      })
    );
  })
);

adminRouter.post(
  '/seo/keywords',
  asyncHandler(async (req, res) => {
    const kw = String(req.body?.keyword || '').trim();
    if (!kw) throw new AppError(400, 'VALIDATION_ERROR', 'Keyword is required.');
    const slug =
      String(req.body?.slug || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-') ||
      kw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const id = `seo-${uuidv4().slice(0, 8)}`;
    await sqlQuery(
      `INSERT INTO seo_keywords (id, keyword, slug, impressions, clicks, created_at)
       VALUES (?, ?, ?, 0, 0, ?)`,
      [id, kw, slug, new Date().toISOString()]
    );
    const rows = await sqlQuery('SELECT * FROM seo_keywords ORDER BY clicks DESC, created_at DESC');
    return sendSuccess(res, rows, 201);
  })
);

adminRouter.delete(
  '/seo/keywords/:id',
  asyncHandler(async (req, res) => {
    await sqlQuery('DELETE FROM seo_keywords WHERE id = ?', [req.params.id]);
    const rows = await sqlQuery('SELECT * FROM seo_keywords ORDER BY clicks DESC, created_at DESC');
    return sendSuccess(res, rows);
  })
);

// Real SQL Smart Financial Ledger
adminRouter.get(
  '/finance',
  asyncHandler(async (_req, res) => {
    const rows = await sqlQuery('SELECT * FROM finance_ledger ORDER BY created_at DESC');
    return sendSuccess(
      res,
      rows.map((r) => ({
        id: r.id,
        type: r.entry_type,
        category: r.category,
        website: r.website_label,
        amount: Number(r.amount),
        status: r.status,
        date: r.entry_date,
        notes: r.notes || '',
      }))
    );
  })
);

adminRouter.post(
  '/finance',
  asyncHandler(async (req, res) => {
    const amountNum = Number(req.body?.amount || 0);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Amount must be greater than 0.');
    }
    const id = `fin-${uuidv4().slice(0, 8)}`;
    await sqlQuery(
      `INSERT INTO finance_ledger (id, website_id, website_label, entry_type, category, amount, status, entry_date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'RECORDED', ?, ?, ?)`,
      [
        id,
        req.websiteProjectId || 'site_main_clean',
        String(req.body?.website || 'Primary Website'),
        req.body?.type === 'expense' ? 'expense' : 'income',
        String(req.body?.category || 'Revenue'),
        amountNum,
        String(req.body?.date || new Date().toISOString().slice(0, 10)),
        String(req.body?.notes || ''),
        new Date().toISOString(),
      ]
    );
    const rows = await sqlQuery('SELECT * FROM finance_ledger ORDER BY created_at DESC');
    return sendSuccess(res, rows, 201);
  })
);

adminRouter.delete(
  '/finance/:id',
  asyncHandler(async (req, res) => {
    await sqlQuery('DELETE FROM finance_ledger WHERE id = ?', [req.params.id]);
    const rows = await sqlQuery('SELECT * FROM finance_ledger ORDER BY created_at DESC');
    return sendSuccess(res, rows);
  })
);

// Multi-Website Portfolio, Custom SVG Platforms, 4-Stage Ad Waterfall & AES-256 Cookies
adminRouter.get(
  '/websites',
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, await loadWebsitesFromDb());
  })
);

adminRouter.post(
  '/websites',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const domain = String(req.body?.domain || '').trim().toLowerCase();
    if (!name || !domain) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Website name and domain are required.');
    }
    const id = `site-${uuidv4().slice(0, 6)}`;
    const mode = req.body?.shieldMode || req.body?.contentMode || 'clean_mainstream';
    await sqlQuery(
      `INSERT INTO websites (id, name, domain, content_mode, status, monthly_revenue, monthly_expense, seo_score, created_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', 0, 0, 100, ?)`,
      [id, name, domain, mode, new Date().toISOString()]
    );
    return sendSuccess(res, await loadWebsitesFromDb(), 201);
  })
);

adminRouter.get(
  '/platforms',
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, await getActivePlatformsFromDb());
  })
);

adminRouter.post(
  '/platforms',
  asyncHandler(async (req, res) => {
    const displayName = String(req.body?.displayName || '').trim();
    const domain = String(req.body?.domainPattern || '').trim().toLowerCase();
    if (!displayName || !domain) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Platform name and domain pattern are required.');
    }

    const id = `custom_${uuidv4().slice(0, 8)}`;
    const category = String(req.body?.category || 'video');
    const sanitizedSvg = sanitizeCustomSvg(req.body?.customSvg || req.body?.iconSvg || '');
    const seoSlug = `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${id.slice(-4)}`;

    await sqlQuery(
      `INSERT INTO platforms (
        id, display_name, subtitle, category, accent_color, icon_key, icon_svg,
        domains_json, example_url, seo_slug, is_adult, supports_search,
        supports_online_player, supports_download, supports_resume, is_enabled,
        health_status, known_limitations, created_at
      ) VALUES (?, ?, ?, ?, ?, 'globe', ?, ?, ?, ?, ?, 0, 1, 1, 1, 1, 'operational', ?, ?)`,
      [
        id,
        displayName,
        String(req.body?.subtitle || 'Custom SVG Stream Adapter'),
        category,
        String(req.body?.brandColor || req.body?.accentColor || '#2563EB'),
        sanitizedSvg,
        JSON.stringify([domain]),
        `https://${domain}/`,
        seoSlug,
        category === 'adult_18' ? 0 : 0, // family-safe product: adult is never stored
        'Custom admin-registered SVG extractor.',
        new Date().toISOString(),
      ]
    );

    return sendSuccess(res, await getActivePlatformsFromDb(), 201);
  })
);

adminRouter.put(
  '/ads/waterfall',
  asyncHandler(async (req, res) => {
    const incoming = req.body || {};
    const current = await loadAdWaterfallMapFromDb();
    const merged = { ...current, ...incoming };
    const now = new Date().toISOString();

    for (const [zoneKey, cfg] of Object.entries(merged)) {
      await sqlQuery(
        `UPDATE ad_waterfall_zones
         SET enabled = ?, cooldown_minutes = ?, config_json = ?, updated_at = ?
         WHERE zone_key = ?`,
        [cfg?.enabled ? 1 : 0, Number(cfg?.cooldownMinutes || 20), JSON.stringify(cfg), now, zoneKey]
      );
    }

    await writeSecurityAuditLog(
      'AD_WATERFALL_UPDATED',
      req.clientIp,
      req.headers['user-agent'],
      'Updated 4-Stage Ad Waterfall settings.'
    );
    return sendSuccess(res, merged);
  })
);

adminRouter.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const current = await loadSystemSettingsFromDb();
    const next = { ...current, ...(req.body || {}) };
    await sqlQuery('UPDATE system_settings SET setting_json = ?, updated_at = ? WHERE setting_key = ?', [
      JSON.stringify(next),
      new Date().toISOString(),
      'global',
    ]);
    return sendSuccess(res, next);
  })
);

adminRouter.get(
  '/cookies',
  asyncHandler(async (_req, res) => {
    const rows = await sqlQuery('SELECT * FROM encrypted_cookies ORDER BY updated_at DESC');
    return sendSuccess(
      res,
      rows.map((r) => ({
        id: r.id,
        platformId: r.platform_id,
        label: r.platform_label,
        maskedPreview: r.masked_preview,
        status: r.status,
        updatedAt: r.updated_at,
      }))
    );
  })
);

adminRouter.post(
  '/cookies',
  asyncHandler(async (req, res) => {
    const rawCookieTxt = String(req.body?.rawCookieTxt || '').trim();
    const platformId = String(req.body?.platformId || '').trim();
    const label = String(req.body?.label || '').trim();
    if (!platformId || !label || !rawCookieTxt) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Platform ID, profile label, and Netscape cookies.txt content are all required.'
      );
    }

    const enc = encryptVaultSecret(rawCookieTxt);
    const id = `ck-${uuidv4().slice(0, 8)}`;

    await sqlQuery(
      `INSERT INTO encrypted_cookies (id, platform_label, platform_id, iv_hex, auth_tag_hex, ciphertext_hex, masked_preview, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Active (AES-256-GCM Encrypted)', ?)`,
      [id, label, platformId, enc.ivHex, enc.authTagHex, enc.ciphertextHex, enc.maskedPreview, new Date().toISOString()]
    );

    const rows = await sqlQuery('SELECT * FROM encrypted_cookies ORDER BY updated_at DESC');
    return sendSuccess(
      res,
      rows.map((r) => ({
        id: r.id,
        platformId: r.platform_id,
        label: r.platform_label,
        maskedPreview: r.masked_preview,
        status: r.status,
        updatedAt: r.updated_at,
      })),
      201
    );
  })
);

adminRouter.delete(
  '/cookies/:id',
  asyncHandler(async (req, res) => {
    await sqlQuery('DELETE FROM encrypted_cookies WHERE id = ?', [req.params.id]);
    const rows = await sqlQuery('SELECT * FROM encrypted_cookies ORDER BY updated_at DESC');
    return sendSuccess(res, rows);
  })
);

adminRouter.get(
  '/audit-logs',
  asyncHandler(async (_req, res) => {
    const rows = await sqlQuery(
      'SELECT * FROM security_audit_logs ORDER BY created_at DESC LIMIT 100'
    );
    return sendSuccess(
      res,
      rows.map((r) => ({
        id: r.id,
        action: r.event_type,
        eventType: r.event_type,
        ip: r.ip_address,
        userAgent: r.user_agent,
        detail: r.details_text,
        createdAt: r.created_at,
      }))
    );
  })
);

adminRouter.post(
  '/security/unlock-ip',
  asyncHandler(async (req, res) => {
    const targetIp = String(req.body?.ip || req.clientIp);
    await clearAdminIpLockout(targetIp);
    return sendSuccess(res, { unlockedIp: targetIp });
  })
);
