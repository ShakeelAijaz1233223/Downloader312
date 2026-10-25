import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { UltraApi } from '../services/apiClient';
import { runUniversalDownload } from '../services/downloadEngine';
import {
  normalizeUserUrl,
  buildInstantDownloadUrl,
  buildCleanFileName,
  triggerDeviceDownload,
  absoluteApiUrl,
} from '../services/instantDownload';

const AppContext = createContext(null);

const UI_TEXT = {
  en: {
    heroEyebrow: 'Free online video downloader · 400+ websites · No software needed',
    heroTitle1: 'Download any video from any website —',
    heroTitleAccent: 'in one click, straight to your PC',
    heroSub:
      'Paste a link from YouTube, Facebook, Instagram, TikTok, TeraBox, a course page or any other website. We find the real video file, let you watch it instantly in the browser, and download it in HD — free, no sign-up, nothing to install.',
    inputPlaceholder: 'Paste any video link (YouTube, TeraBox, Instagram, course page…) or type what you want to find…',
    pasteBtn: 'Paste Link',
    analyzeBtn: 'Extract & Play',
  },
  ur: {
    heroEyebrow: 'فری آن لائن ویڈیو ڈاؤن لوڈر · 400+ ویب سائٹس · کوئی سافٹ ویئر نہیں',
    heroTitle1: 'کسی بھی ویب سائٹ کا ویڈیو ڈاؤن لوڈ کریں —',
    heroTitleAccent: 'ایک کلک میں، سیدھا اپنے کمپیوٹر پر',
    heroSub:
      'یوٹیوب، فیس بک، انسٹاگرام، ٹک ٹاک، TeraBox، کورس یا کسی بھی ویب سائٹ کا لنک پیسٹ کریں۔ ہم اصل ویڈیو فائل تلاش کرتے ہیں، آپ کو براؤزر میں فوراً دکھاتے ہیں اور HD میں ڈاؤن لوڈ کرتے ہیں — مفت، بغیر اکاؤنٹ، بغیر کسی انسٹال کے۔',
    inputPlaceholder: 'کوئی بھی ویڈیو لنک پیسٹ کریں یا سرچ کے لیے نام لکھیں…',
    pasteBtn: 'لنک پیسٹ کریں',
    analyzeBtn: 'اسٹریم نکالیں',
  },
};

export function triggerNativeChromeDownload(downloadUrl, fileName = 'Video.mp4') {
  if (!downloadUrl || typeof document === 'undefined') return false;
  const absolute = absoluteApiUrl(downloadUrl);
  return triggerDeviceDownload(absolute, fileName);
}

export function AppProvider({ children }) {
  const theme = 'light';
  const setTheme = useCallback(() => {}, []);
  const accent = 'blue';
  const setAccent = useCallback(() => {}, []);

  const [lang, setLang] = useState(() => localStorage.getItem('ud_lang') || 'en');
  const [backendLive, setBackendLive] = useState(false);

  const [websites, setWebsites] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [adWaterfall, setAdWaterfall] = useState({});
  const [settings, setSettings] = useState({});
  const [windowsIdmInfo, setWindowsIdmInfo] = useState({ detected: false, binaryPath: null });
  const [enginePrefs, setEnginePrefs] = useState({
    idmConnections: 32,
    writeBufferMb: 4,
    speedLimiterEnabled: false,
    maxSpeedKBps: 500,
    alwaysLimitOnStartup: false,
    autoSaveToBrowser: true,
    autoLaunchWindowsIdm: true,
    customWindowsIdmPath: '',
    dnsOverHttpsBypass: true,
    dohProvider: 'cloudflare',
    outboundProxyUrl: '',
    preferredTeraboxHost: 'https://www.1024tera.com',
    autoUnwrapIteraplay: true,
    browserCookieSource: 'auto',
    defaultVideoQuality: 'auto',
    showAdultVaultTab: false,
    autoCleanTempHours: 12,
  });

  const [telemetry, setTelemetry] = useState(null);
  const [adultGateUnlocked, setAdultGateUnlocked] = useState(false);

  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  // STRICT PER-USER DOWNLOAD HISTORY: ALWAYS [] WHEN NO USER IS LOGGED IN!
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false);
  const [speedLimiterModalOpen, setSpeedLimiterModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ id: Date.now(), message, tone: type, type });
    setTimeout(() => {
      setToast((cur) => (cur && Date.now() - cur.id >= 3600 ? null : cur));
    }, 3700);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    localStorage.setItem('ud_lang', lang);
  }, [lang]);

  // Initial bootstrap + resilient telemetry polling
  useEffect(() => {
    UltraApi.bootstrap()
      .then((boot) => {
        setBackendLive(true);
        setWebsites(boot.websites || []);
        setPlatforms(boot.platforms || []);
        setAdWaterfall(boot.adWaterfallConfig || {});
        setSettings(boot.settings || {});
        if (boot.enginePreferences) {
          setEnginePrefs((prev) => ({ ...prev, ...boot.enginePreferences }));
        }
        if (boot.traffic) {
          setTelemetry({ traffic: boot.traffic });
        }
      })
      .catch(() => {
        setBackendLive(false);
      });

    UltraApi.getEngineSettings()
      .then((res) => {
        if (res?.enginePreferences) {
          setEnginePrefs((prev) => ({ ...prev, ...res.enginePreferences }));
        }
        if (res?.windowsIdm) {
          setWindowsIdmInfo(res.windowsIdm);
        }
      })
      .catch(() => {});

    UltraApi.getCurrentUser()
      .then((res) => {
        setUser(res?.user || null);
      })
      .catch(() => {
        setUser(null);
      });

    const telTimer = setInterval(() => {
      UltraApi.getTelemetry()
        .then((snap) => {
          setBackendLive(true);
          setTelemetry(snap);
        })
        .catch(() => {
          setBackendLive(false);
        });
    }, 8000);

    return () => clearInterval(telTimer);
  }, []);

  // STRICT USER-SCOPED HISTORY SYNC:
  // - Logged Out (`!user`) -> `downloadQueue = []` & `favorites = []` IMMEDIATELY!
  // - Logged In (`user`) -> Fetches ONLY this user's own personal MySQL history!
  useEffect(() => {
    if (!user) {
      setDownloadQueue([]);
      setFavorites([]);
      return;
    }

    UltraApi.listDownloadJobs()
      .then((jobs) => setDownloadQueue(Array.isArray(jobs) ? jobs : []))
      .catch(() => setDownloadQueue([]));

    UltraApi.getFavorites()
      .then((favs) => setFavorites(Array.isArray(favs) ? favs : []))
      .catch(() => setFavorites([]));
  }, [user]);

  // ==========================================================================
  // 100% UNIVERSAL 1-CLICK DOWNLOAD (Chrome Download Bar + Direct Downloadan.exe)
  // The attachment download is fired SYNCHRONOUSLY inside the click gesture,
  // so EVERY platform (YouTube, TeraBox, TikTok, Movies, Direct MP4/MP3...)
  // starts downloading instantly — no server round-trip can block it.
  // ==========================================================================
  const startManagedDownload = useCallback(
    async ({
      media,
      platform,
      selectedStream,
      sourceUrl,
      deliveryMode = 'auto',
      openDrawer = false,
      // When the caller already dispatched a verified signed download
      // (single-button flow), only record history here — never trigger twice.
      skipDeviceTrigger = false,
    }) => {
      // Never label a download with a resolution it does not have: the real
      // stream title wins, otherwise the preference is used only if it is not
      // the "auto" sentinel.
      const pref = enginePrefs.defaultVideoQuality;
      const qualityLabel =
        selectedStream?.qualityTitle ||
        (pref && pref !== 'auto' ? pref : '') ||
        'HD';
      const formatExt = selectedStream?.formatExt || 'mp4';
      const fileName =
        selectedStream?.fileName ||
        buildCleanFileName(media?.title || 'Video', qualityLabel, formatExt);

      // STEP 1: the SAME verified signed-ticket engine the hero button uses.
      // (A second, unsigned download path used to exist here and produced
      //  different — sometimes broken — results for the same stream.)
      let launched = false;
      if (!skipDeviceTrigger) {
        try {
          const result = await runUniversalDownload({
            stream: selectedStream,
            analysis: { media, canonicalUrl: sourceUrl, platform },
            user,
            onProgress: () => {},
          });
          launched = Boolean(result?.ok);
          if (launched) showToast(result.message, 'success');
        } catch (err) {
          // Last-resort fallback for a plain direct file link only.
          const instantUrl = buildInstantDownloadUrl({
            stream: selectedStream,
            media,
            sourceUrl,
            qualityLabel,
          });
          launched = instantUrl ? triggerDeviceDownload(instantUrl, fileName) : false;
          if (!launched) {
            showToast(err?.message || 'Could not start this download.', 'error');
          }
        }
      }

      // STEP 2 (background): save personal history ONLY for logged-in users.
      try {
        const created = await UltraApi.createDownloadJob({
          deliveryMode,
          title: media?.title || 'Video',
          sourceUrl: sourceUrl || '',
          formatSelector: selectedStream?.formatSelector || 'direct_idm_stream',
          streamUrl: selectedStream?.streamUrl || '',
          thumbnailUrl: media?.thumbnailUrl || '',
          platformId: platform?.id || 'youtube',
          qualityLabel,
          formatExt,
          totalBytes: selectedStream?.sizeBytes || 0,
        });

        if (user && created?.savedToHistory) {
          setDownloadQueue((prev) => [created, ...prev.filter((j) => j.id !== created.id)]);
          if (openDrawer) setQueueDrawerOpen(true);
        }

        // Fallback: stream was not resolvable client-side (fresh page link) —
        // the backend just resolved it, so start the device download now.
        if (!launched && !skipDeviceTrigger) {
          const serverUrl = absoluteApiUrl(created?.directDownloadUrl || created?.streamUrl || '');
          if (serverUrl) {
            launched = triggerDeviceDownload(serverUrl, created?.fileName || fileName);
            if (launched) {
              showToast(`Download started: ${created?.fileName || fileName}`, 'success');
            }
          }
        }
        return created;
      } catch (err) {
        if (!launched) {
          showToast(
            err?.message || 'Could not start this download. Check the link and try again.',
            'error'
          );
        }
        return null;
      }
    },
    [enginePrefs.defaultVideoQuality, showToast, user]
  );

  // Resolve ANY pasted page link first, then start the device download instantly.
  const resolveAndStartDownload = useCallback(
    async ({ url, deliveryMode = 'auto' }) => {
      const normalized = normalizeUserUrl(url);
      if (!normalized.ok) {
        showToast('Please paste a valid video page or direct file link.', 'error');
        return null;
      }
      try {
        const analysis = await UltraApi.analyzeUrl(normalized.url);
        const pool = [
          ...(analysis?.streams?.videoAudio || analysis?.media?.streams?.videoWithAudio || []),
          ...(analysis?.streams?.videoOnly || analysis?.media?.streams?.videoOnly || []),
          ...(analysis?.streams?.audioOnly || analysis?.media?.streams?.audioOnly || []),
        ];
        const chosen =
          analysis?.autoStream ||
          pool.find((item) => item?.hasAudio && item?.hasVideo) ||
          pool[0] ||
          null;
        if (!chosen) {
          showToast('This page has no downloadable media stream.', 'error');
          return null;
        }
        return await startManagedDownload({
          media: analysis.media,
          platform: analysis.platform,
          selectedStream: chosen,
          sourceUrl: analysis.canonicalUrl || normalized.url,
          deliveryMode,
        });
      } catch (err) {
        showToast(err?.message || 'Could not resolve this link.', 'error');
        return null;
      }
    },
    [showToast, startManagedDownload]
  );

  // Explicit hand-off to Windows PC `IDMan.exe` (falls back to instant Chrome save).
  const sendDirectUrlToIdm = useCallback(
    async ({ streamUrl, sourceUrl, fileName }) => {
      const normalized = normalizeUserUrl(streamUrl || sourceUrl);
      const target = normalized.ok ? normalized.url : String(streamUrl || sourceUrl || '');
      const directUrl = buildInstantDownloadUrl({
        stream: { streamUrl: target, formatExt: 'mp4' },
        media: { title: fileName || 'Video' },
        sourceUrl,
        qualityLabel: 'HD',
      });
      const safeName = fileName || buildCleanFileName('Video', 'HD', 'mp4');

      // Always fire the native download immediately (IDM intercepts it if installed).
      const launched = directUrl ? triggerDeviceDownload(directUrl, safeName) : false;
      if (launched) showToast(`Download started: ${safeName}`, 'success');

      try {
        const res = await UltraApi.sendDirectToWindowsIdm({
          streamUrl: directUrl || target,
          sourceUrl: sourceUrl || target,
          fileName: safeName,
        });
        if (res?.launchedDesktopIdm) {
          showToast(`Sent to Windows IDMan.exe: ${safeName}`, 'success');
        }
      } catch {
        /* silent — the browser download already started above */
      }
      return launched;
    },
    [showToast]
  );

  // Delete single user history item (`DELETE /api/v1/downloads/:id`)
  const deleteHistoryItem = useCallback(
    async (jobId) => {
      try {
        await UltraApi.deleteDownloadHistoryItem(jobId);
        setDownloadQueue((prev) => prev.filter((j) => j.id !== jobId));
        showToast('Download history item deleted.', 'success');
      } catch (err) {
        showToast(err.message || 'Could not delete history item.', 'error');
      }
    },
    [showToast]
  );

  // Clean ALL user download history (`DELETE /api/v1/downloads`)
  const cleanAllHistory = useCallback(async () => {
    try {
      await UltraApi.cleanAllDownloadHistory();
      setDownloadQueue([]);
      showToast('All download history cleaned cleanly!', 'success');
    } catch (err) {
      showToast(err.message || 'Could not clean history.', 'error');
    }
  }, [showToast]);

  const controlDownloadJob = useCallback(
    async (jobId, action) => {
      if (action === 'delete') {
        return deleteHistoryItem(jobId);
      }
      try {
        const updated = await UltraApi.controlDownloadJob(jobId, action);
        if (updated?.status === 'deleted') {
          setDownloadQueue((prev) => prev.filter((j) => j.id !== jobId));
        } else {
          setDownloadQueue((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
        }
      } catch (err) {
        showToast(err.message || 'Action failed', 'error');
      }
    },
    [deleteHistoryItem, showToast]
  );

  const runBatchQueueAction = useCallback(
    async (action) => {
      if (action === 'delete_all' || action === 'clean') {
        return cleanAllHistory();
      }
      try {
        const res = await UltraApi.batchDownloadJobs(action);
        if (Array.isArray(res?.jobs)) {
          setDownloadQueue(res.jobs);
        }
        showToast('Download history updated cleanly.', 'success');
      } catch (err) {
        showToast(err.message || 'History action failed', 'error');
      }
    },
    [cleanAllHistory, showToast]
  );

  const openJobInIdm = useCallback(
    async (jobId) => {
      const job = downloadQueue.find((j) => j.id === jobId);
      const fallbackUrl = job ? absoluteApiUrl(job.directDownloadUrl || job.streamUrl) : '';
      // Instant local trigger first (zero latency, never blocked).
      if (fallbackUrl) {
        triggerDeviceDownload(fallbackUrl, job?.fileName || 'Video.mp4');
        showToast('Download started in Chrome / IDM.', 'success');
      }
      try {
        const res = await UltraApi.openInWindowsIdm(jobId);
        if (res?.launchedDesktopIdm || res?.launched) {
          showToast('Also sent to Windows Internet Download Manager (IDMan.exe).', 'success');
        }
      } catch {
        if (!fallbackUrl) {
          showToast('Could not start this download. Please re-analyze the link.', 'error');
        }
      }
    },
    [downloadQueue, showToast]
  );

  const saveEnginePrefs = useCallback(
    async (patch) => {
      const merged = { ...enginePrefs, ...patch };
      setEnginePrefs(merged);
      try {
        const saved = await UltraApi.updateEngineSettings(merged);
        if (saved?.enginePreferences)
          setEnginePrefs((prev) => ({ ...prev, ...saved.enginePreferences }));
        if (saved?.windowsIdm) setWindowsIdmInfo(saved.windowsIdm);
        showToast('Settings saved successfully!', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to sync settings', 'error');
      }
    },
    [enginePrefs, showToast]
  );

  const toggleFavorite = useCallback(
    async (video) => {
      if (!user) {
        showToast('Sign in first (free) to save Favorites in your account.', 'info');
        return;
      }
      try {
        const synced = await UltraApi.toggleFavoriteOnServer(video);
        setFavorites(synced);
        showToast('Saved to your account.', 'success');
      } catch (err) {
        showToast(err.message || 'Unable to update favorite.', 'error');
      }
    },
    [user, showToast]
  );

  return (
    <AppContext.Provider
      value={{
        theme,
        setTheme,
        accent,
        setAccent,
        lang,
        setLang,
        t: UI_TEXT[lang] || UI_TEXT.en,
        backendLive,
        websites,
        setWebsites,
        platforms,
        setPlatforms,
        selectedPlatform,
        setSelectedPlatform,
        adWaterfall,
        setAdWaterfall,
        settings,
        setSettings,
        windowsIdmInfo,
        enginePrefs,
        setEnginePrefs,
        saveEnginePrefs,
        telemetry,
        adultGateUnlocked,
        setAdultGateUnlocked,
        user,
        setUser,
        favorites,
        setFavorites,
        toggleFavorite,
        downloadQueue,
        setDownloadQueue,
        queueDrawerOpen,
        setQueueDrawerOpen,
        speedLimiterModalOpen,
        setSpeedLimiterModalOpen,
        startManagedDownload,
        resolveAndStartDownload,
        sendDirectUrlToIdm,
        deleteHistoryItem,
        cleanAllHistory,
        controlDownloadJob,
        runBatchQueueAction,
        openJobInIdm,
        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
