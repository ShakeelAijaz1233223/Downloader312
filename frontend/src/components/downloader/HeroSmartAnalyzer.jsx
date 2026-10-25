import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardPaste,
  Search,
  Sparkles,
  Download,
  ExternalLink,
  Share2,
  Heart,
  ShieldCheck,
  Gauge,
  KeyRound,
  Play,
  CheckCircle2,
  Zap,
  Sliders,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Globe2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UltraApi, formatBytes } from '../../services/apiClient';
import { normalizeUserUrl, buildCleanFileName } from '../../services/instantDownload';
import { runUniversalDownload } from '../../services/downloadEngine';
import { SearchAnythingModal } from './SearchAnythingModal';
import {
  DOWNLOAD_STATE,
  requestDownloadTicket,
  probeDownloadUrl,
  dispatchBrowserDownload,
  resolveDownloadTarget,
  formatDownloadSize,
} from '../../services/fileDownload';
import { OnlineVideoPlayer } from '../player/OnlineVideoPlayer';
import { PlatformIcon } from '../icons/PlatformIcon';
import { AnimatedWhiteBackdrop } from '../ui/Primitives';
import { evaluateSmartDownloadAdTrigger, NativeSponsorBanner } from '../monetization/AdWaterfallManager';

const QUICK_SAMPLE_LINKS = [
  {
    label: 'Free TeraBox Full Movie Test',
    url: 'https://www.terabox.app/sharing/link?surl=IRHSOPX5IEPgJT7l9IoNlg',
    badge: '0 Paid Key',
  },
  {
    label: 'iTeraPlay Wrapper Link',
    url: 'https://iteraplay.com/?url=https://www.1024tera.co/sharing/link?surl=IRHSOPX5IEPgJT7l9IoNlg',
    badge: 'Auto-Unwrap',
  },
  {
    label: 'YouTube 4K HDR Sample',
    url: 'https://www.youtube.com/watch?v=WhWc3b3KhnY',
    badge: '4K + MP3',
  },
  {
    label: 'Search Trending Lectures',
    url: 'MIT Python Data Science Full Lecture',
    badge: 'Live Search',
  },
];

export function HeroSmartAnalyzer({ presetPlatform = null }) {
  const {
    t,
    platforms,
    adWaterfall,
    enginePrefs,
    startManagedDownload,
    sendDirectUrlToIdm,
    toggleFavorite,
    user,
    setSpeedLimiterModalOpen,
    showToast,
  } = useApp();

  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [streamTab, setStreamTab] = useState('video_audio');
  // "Auto" = the engine chooses the best real stream for THIS video (never a
  // fake 4K label). Picking a card manually switches Auto off.
  const [manualPickKey, setManualPickKey] = useState('');
  const [showCookieBox, setShowCookieBox] = useState(false);
  const [searchAnythingOpen, setSearchAnythingOpen] = useState(false);
  const [ephemeralCookies, setEphemeralCookies] = useState('');
  const [shareCodeUrl, setShareCodeUrl] = useState('');
  // Real browser-managed download state (single fast button)
  const [dl, setDl] = useState({
    state: DOWNLOAD_STATE.IDLE,
    message: '',
    fileName: '',
    sizeBytes: 0,
  });
  const dlLockRef = useRef(false);

  useEffect(() => {
    if (presetPlatform?.displayName) {
      setShareCodeUrl('');
    }
  }, [presetPlatform]);

  const detectedPlatform = useMemo(() => {
    const raw = inputVal.trim().toLowerCase();
    if (!raw || !raw.includes('.')) return presetPlatform || null;
    return (
      platforms.find((p) =>
        (p.domains || []).some((d) => raw.includes(String(d).toLowerCase()))
      ) || presetPlatform
    );
  }, [inputVal, platforms, presetPlatform]);

  const handleAnalyzeOrSearch = async (overrideInput) => {
    const raw = String(overrideInput ?? inputVal).trim();
    if (!raw) {
      showToast('Paste a video URL or type keywords to search live streams.', 'info');
      return;
    }

    setLoading(true);
    setShareCodeUrl('');
    try {
      const urlProbe = normalizeUserUrl(raw);
      const looksLikeUrl = urlProbe.ok;
      const normalized = urlProbe.ok ? urlProbe.url : raw;

      if (looksLikeUrl) {
        setSearchResults(null);
        const res = await UltraApi.analyzeUrl(
          normalized,
          detectedPlatform?.id || '',
          ephemeralCookies
        );
        setAnalysis(res);
        setStreamTab(res?.autoStreamMeta?.tab || 'video_audio');
        setManualPickKey('');
      } else {
        setAnalysis(null);
        const searchRes = await UltraApi.searchVideos({ q: raw, page: 1 });
        setSearchResults(searchRes.items || []);
      }
    } catch (err) {
      showToast(
        err?.code === 'PASTE_CONTENT_LINK'
          ? 'That is a homepage. Open the video / reel / post / file page and paste that exact link.'
          : err?.code === 'NO_MEDIA_ON_PAGE'
            ? 'This page has no video file. Paste the actual video post link or a direct .mp4 / .m3u8 link.'
            : err.message || 'This link could not be opened. Please check the URL or try another one.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputVal(text.trim());
        if (/^https?:\/\//i.test(text.trim())) {
          UltraApi.silentPasteCapture(text.trim(), 'paste_button').catch(() => {});
          handleAnalyzeOrSearch(text.trim());
        }
      }
    } catch {
      showToast('Press Ctrl+V directly inside the input box.', 'info');
    }
  };

  const streamGroups = useMemo(() => {
    const s = analysis?.streams || analysis?.media?.streams || {};
    const dedupe = (list = []) => {
      const seen = new Set();
      return list.filter((item) => {
        if (!item) return false;
        const key = `${item.qualityKey || item.qualityTitle || ''}|${item.formatExt || ''}|${
          item.directCdnUrl || item.streamUrl || ''
        }`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const withAudio = dedupe(s.videoAudio || s.videoWithAudio || []);
    const onlyWithAudio = withAudio.filter((item) => item.hasAudio !== false);

    return {
      // "Video + Sound" must never list a muted adaptive track.
      video_audio: onlyWithAudio.length ? onlyWithAudio : withAudio,
      video_only: dedupe(s.videoOnly || []),
      audio_only: dedupe(s.audioOnly || []),
      hadSilentOnly: withAudio.length > 0 && onlyWithAudio.length === 0,
    };
  }, [analysis]);

  const activeStreamsList = streamGroups[streamTab] || [];

  // Auto choice: prefer the server's recommendation for THIS video, otherwise
  // the best stream that really contains sound.
  const autoStream = analysis?.autoStream || null;
  const autoIdx = useMemo(() => {
    if (!activeStreamsList.length) return -1;
    if (autoStream) {
      const byId = activeStreamsList.findIndex(
        (item) =>
          (autoStream.formatId && item.formatId === autoStream.formatId) ||
          (autoStream.directCdnUrl && item.directCdnUrl === autoStream.directCdnUrl)
      );
      if (byId >= 0) return byId;
    }
    return 0;
  }, [activeStreamsList, autoStream]);

  const manualIdx = useMemo(() => {
    if (!manualPickKey) return -1;
    return activeStreamsList.findIndex(
      (item) => `${item.formatId || ''}|${item.qualityKey || ''}` === manualPickKey
    );
  }, [activeStreamsList, manualPickKey]);

  const activeIdx = manualIdx >= 0 ? manualIdx : autoIdx;
  const activeStream = activeStreamsList[activeIdx] || activeStreamsList[0] || null;
  const isAutoQuality = manualIdx < 0;

  const handleCreateViralLink = async () => {
    if (!analysis) return;
    try {
      const res = await UltraApi.createViralShareLink({
        url: analysis.canonicalUrl,
        title: analysis.media.title,
        platformId: analysis.platform?.id,
        thumbnailUrl: analysis.media.thumbnailUrl,
        durationText: analysis.media.durationText,
        streamUrl: analysis.media.previewPlayer?.streamUrl || '',
      });
      const fullShare = `${window.location.origin}${res.sharePath}`;
      setShareCodeUrl(fullShare);
      navigator.clipboard?.writeText(fullShare).catch(() => {});
      showToast('Shareable Watch Link copied to clipboard!', 'success');
    } catch (err) {
      showToast(err.message || 'Could not create share link', 'error');
    }
  };

  // ==========================================================================
  // REAL DOWNLOAD FLOW (single button):
  // ticket -> HEAD verification -> browser transfers the verified bytes.
  // Chrome owns the transfer, so we only ever report "Download started".
  // ==========================================================================
  const runRealDownload = useCallback(async () => {
    if (dlLockRef.current) return; // blocks accidental duplicate requests
    if (!activeStream) return;

    dlLockRef.current = true;
    setDl({ state: DOWNLOAD_STATE.STARTING, message: 'Preparing download…', fileName: '', sizeBytes: 0 });

    try {
      evaluateSmartDownloadAdTrigger(adWaterfall);

      // Single shared engine: ticket -> verify -> IDM (if installed) -> Chrome.
      const result = await runUniversalDownload({
        stream: activeStream,
        analysis,
        user,
        onProgress: ({ state, message }) =>
          setDl((prev) => ({ ...prev, state, message, fileName: prev.fileName })),
        reportHistory: () =>
          startManagedDownload({
            media: analysis?.media,
            platform: analysis?.platform,
            selectedStream: activeStream,
            sourceUrl: analysis?.canonicalUrl,
            deliveryMode: 'auto',
            skipDeviceTrigger: true,
          }),
      });

      setDl({
        state: DOWNLOAD_STATE.STARTED,
        message: result.message,
        fileName: result.fileName,
        sizeBytes: result.sizeBytes,
      });
    } catch (err) {
      setDl({
        state: DOWNLOAD_STATE.FAILED,
        message:
          err?.message || 'The download could not be started. Check your connection and click Retry.',
        fileName: '',
        sizeBytes: 0,
      });
    } finally {
      dlLockRef.current = false;
    }
  }, [activeStream, adWaterfall, analysis, startManagedDownload, user]);

  const isDlBusy = dl.state === DOWNLOAD_STATE.STARTING || dl.state === DOWNLOAD_STATE.VERIFYING;

  const downloadButtonLabel = isDlBusy
    ? dl.message
    : dl.state === DOWNLOAD_STATE.FAILED
    ? 'Retry Download'
    : dl.state === DOWNLOAD_STATE.STARTED
    ? 'Download Again'
    : `Download${isAutoQuality ? ' · Auto' : ''} · ${
        activeStream?.qualityTitle || 'HD'
      } ${activeStream?.formatExt ? `(${String(activeStream.formatExt).toUpperCase()})` : ''}`;

  return (
    <section className="relative w-full overflow-hidden pt-8 pb-12 border-b border-slate-200/80">
      <AnimatedWhiteBackdrop />

      <div className="w-full px-4 sm:px-8 xl:px-12">
        {/* Top Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
          className="w-full max-w-5xl mx-auto text-center"
        >
          <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-4 py-1.5 text-xs font-bold text-blue-700 mb-4 shadow-sm">
            <Sparkles size={14} className="text-blue-600" />
            <span>{presetPlatform ? `${presetPlatform.displayName} Dedicated Engine` : t.heroEyebrow}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
            {presetPlatform ? `${presetPlatform.displayName} Online Player & ` : `${t.heroTitle1} `}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 bg-clip-text text-transparent">
              {t.heroTitleAccent}
            </span>
          </h1>

          <p className="mt-3.5 text-sm sm:text-base lg:text-lg text-slate-600 max-w-4xl mx-auto leading-relaxed">
            {t.heroSub}
          </p>
        </motion.div>

        {/* Full-Width Smart Extractor Command Bar */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="mt-7 w-full max-w-6xl mx-auto rounded-3xl bg-white border-2 border-slate-200 focus-within:border-blue-500 shadow-[0_12px_40px_rgba(37,99,235,0.08)] p-3 sm:p-4 transition-colors"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAnalyzeOrSearch();
            }}
            className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5"
          >
            <div className="flex-1 flex items-center gap-3 px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200/80">
              {detectedPlatform ? (
                <PlatformIcon platform={detectedPlatform} size={30} />
              ) : (
                <span className="h-8 w-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Search size={17} />
                </span>
              )}
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData?.getData('text') || '';
                  if (/^https?:\/\//i.test(pasted.trim())) {
                    UltraApi.silentPasteCapture(pasted.trim(), 'hero_input_paste').catch(() => {});
                  }
                }}
                placeholder={
                  presetPlatform?.exampleUrl
                    ? `Paste ${presetPlatform.displayName} link (e.g. ${presetPlatform.exampleUrl})...`
                    : t.inputPlaceholder
                }
                aria-label="Universal Video URL or Search Input"
                className="w-full bg-transparent text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              {inputVal && (
                <button
                  type="button"
                  onClick={() => setInputVal('')}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 hover:bg-slate-200 px-4 py-3 text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap transition-colors"
              >
                <ClipboardPaste size={16} className="text-blue-600" />
                <span>{t.pasteBtn}</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-6 py-3 text-xs sm:text-sm font-extrabold text-white shadow-md shadow-blue-600/20 whitespace-nowrap disabled:opacity-60 transition-all"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : <Zap size={17} />}
                <span>{loading ? 'Extracting Stream...' : t.analyzeBtn}</span>
              </button>
            </div>
          </form>

          {inputVal.trim().includes('.') && !detectedPlatform && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-[11px] text-violet-900">
              <Globe2 size={14} className="mt-0.5 shrink-0 text-violet-600" />
              <span>
                <strong>Universal mode:</strong> this website is not in the catalogue — it is still
                accepted. Paste the exact video / post / file URL and press Extract.
              </span>
            </div>
          )}

          {/* Bottom Bar Inside Command Deck: Sample Links + Speed Mode + Enrolled Course Cookies */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-500 mr-1">Try Live:</span>
              {QUICK_SAMPLE_LINKS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setInputVal(s.url);
                    handleAnalyzeOrSearch(s.url);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-blue-700 transition-colors"
                >
                  <span>{s.label}</span>
                  <span className="rounded bg-blue-100 text-blue-700 px-1.5 py-0.2 text-[10px] font-bold">
                    {s.badge}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSpeedLimiterModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-800"
              >
                <Gauge size={13} className="text-emerald-600" />
                <span>
                  {enginePrefs.speedLimiterEnabled
                    ? `Speed Limiter: ${enginePrefs.maxSpeedKBps} KB/s`
                    : 'Unlimited Speed'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSearchAnythingOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 border border-blue-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
              >
                <Globe2 size={12} />
                <span>Search Anything</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCookieBox((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
              >
                <KeyRound size={12} className="text-indigo-600" />
                <span>{showCookieBox ? 'Hide Session Cookies' : 'Course / Private Cookies'}</span>
              </button>
            </div>
          </div>

          {showCookieBox && (
            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Optional One-Time Session Cookies (`cookies.txt` format for enrolled Udemy/Coursera lectures or private shares — never stored as plain text):
              </label>
              <textarea
                rows={3}
                value={ephemeralCookies}
                onChange={(e) => setEphemeralCookies(e.target.value)}
                placeholder="# Netscape HTTP Cookie File..."
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs font-mono text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
        </motion.div>

        {/* Full-Width Trust Strip */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-600" /> 100% Free TeraBox, iTeraPlay &amp; 30+ Mirrors
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Gauge size={15} className="text-blue-600" /> Fast Multi-Part Download Engine
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-indigo-600" /> Safe, Private &amp; Secure Downloads
          </span>
        </div>

        {/* FULL-WIDTH LIVE EXTRACTION WORKSPACE (PLAYER LEFT + 200MB/s DOWNLOAD MATRIX RIGHT) */}
        {analysis?.media && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 w-full rounded-3xl bg-white border border-slate-200 shadow-lg p-5 sm:p-7"
          >
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left 6 Columns: Built-In Live Browser Player */}
              <div className="xl:col-span-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PlatformIcon platform={analysis.platform} size={28} />
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
                        {/* Never show raw internal ids to visitors */}
                        {(() => {
                          const raw = String(analysis.extractorTier || '');
                          if (!raw || /^[a-z0-9_]+$/.test(raw)) return 'Fast direct download';
                          return raw;
                        })()}
                      </span>
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                        {analysis.media.title}
                      </h2>
                    </div>
                  </div>
                  {analysis.media.durationText && (
                    <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {analysis.media.durationText}
                    </span>
                  )}
                </div>

                <OnlineVideoPlayer
                  streamUrl={activeStream?.previewUrl || analysis.media.previewPlayer?.streamUrl}
                  posterUrl={analysis.media.thumbnailUrl}
                  title={analysis.media.title}
                  platformName={analysis.platform?.displayName}
                  subtitles={analysis.media.subtitles || []}
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCreateViralLink}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 px-3.5 py-2 text-xs font-bold text-slate-800"
                    >
                      <Share2 size={14} className="text-blue-600" />
                      <span>Create /v/ Watch Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        toggleFavorite({
                          url: analysis.canonicalUrl,
                          title: analysis.media.title,
                          platformId: analysis.platform?.id,
                          thumbnailUrl: analysis.media.thumbnailUrl,
                          durationText: analysis.media.durationText,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 px-3.5 py-2 text-xs font-bold text-slate-800"
                    >
                      <Heart size={14} className="text-rose-500" />
                      <span>Save Favorite</span>
                    </button>
                  </div>

                  {shareCodeUrl && (
                    <a
                      href={shareCodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{shareCodeUrl}</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>

              {/* Right 6 Columns: Quality Picker + 3 Ultra-Fast Download Modes */}
              <div className="xl:col-span-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    {[
                      { id: 'video_audio', label: 'Video + Sound (HD/4K)' },
                      { id: 'video_only', label: 'Video Only (Muted)' },
                      { id: 'audio_only', label: 'Audio MP3 / M4A' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setStreamTab(tab.id);
                          setManualPickKey('');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          streamTab === tab.id
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                        isAutoQuality
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      <Sparkles size={11} />
                      {isAutoQuality ? 'Auto quality' : 'Manual quality'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSpeedLimiterModalOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      <Sliders size={13} />
                      <span>Speed Settings</span>
                    </button>
                  </div>
                </div>

                {/* Quality List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {activeStreamsList.map((st, idx) => {
                    const selected = idx === activeIdx;
                    return (
                      <button
                        key={`${st.formatId || idx}-${st.qualityTitle}`}
                        type="button"
                        onClick={() =>
                          setManualPickKey(`${st.formatId || ''}|${st.qualityKey || ''}`)
                        }
                        className={`text-left rounded-2xl border p-3.5 transition-all flex items-center justify-between gap-2 ${
                          selected
                            ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/15'
                            : 'border-slate-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-extrabold text-slate-900">
                              {st.qualityTitle || '1080p HD'}
                            </span>
                            <span className="rounded bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px] font-extrabold uppercase">
                              {st.formatExt || 'mp4'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {st.codecLabel || st.qualitySub || 'H.264 + AAC'} ·{' '}
                            {st.sizeBytes
                              ? `${st.sizeEstimated ? '~' : ''}${formatBytes(st.sizeBytes)}`
                              : 'Size shown during download'}
                          </p>
                        </div>
                        <span
                          className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                            selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                          }`}
                        >
                          {selected && <CheckCircle2 size={13} />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {activeStreamsList.length === 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] text-amber-900">
                    This source only exposes{' '}
                    {streamTab === 'audio_only' ? 'video tracks' : 'other tracks'} on this tab. Open
                    another tab — the engine never invents a resolution that the video does not have.
                  </div>
                )}

                {/* SINGLE fast download button — real bytes, real browser download */}
                {activeStream && (
                  <div className="pt-2 space-y-2.5">
                    <button
                      type="button"
                      onClick={runRealDownload}
                      disabled={isDlBusy}
                      aria-label="Download"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-500 disabled:to-indigo-500 disabled:cursor-wait px-5 py-3.5 text-xs sm:text-sm font-extrabold text-white shadow-md shadow-blue-600/20 transition-all"
                    >
                      {isDlBusy ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : dl.state === DOWNLOAD_STATE.FAILED ? (
                        <RotateCcw size={17} />
                      ) : (
                        <Download size={17} />
                      )}
                      <span>{downloadButtonLabel}</span>
                    </button>

                    {dl.state === DOWNLOAD_STATE.STARTED && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[11px] text-emerald-800 flex items-start gap-2">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                        <span>
                          <strong>{dl.message}</strong>
                          {dl.sizeBytes ? ` · ${formatDownloadSize(dl.sizeBytes)}` : ''} — the browser is
                          transferring the file. Open{' '}
                          <strong>Chrome → Ctrl + J</strong> to follow the progress, pause or open it.
                        </span>
                      </div>
                    )}

                    {dl.state === DOWNLOAD_STATE.FAILED && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11px] text-rose-800 flex items-start gap-2">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <span className="flex-1">{dl.message}</span>
                        <button
                          type="button"
                          onClick={runRealDownload}
                          className="shrink-0 rounded-lg bg-rose-600 hover:bg-rose-700 px-2.5 py-1 text-[11px] font-extrabold text-white"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                )}

                    {/* Multi-File TeraBox Folder List (if shared folder has multiple videos) */}
                    {Array.isArray(analysis.folderItems) && analysis.folderItems.length > 1 && (
                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-1.5">
                        <p className="text-xs font-extrabold text-slate-800">
                          Shared Folder Videos ({analysis.folderItems.length} files unpacked):
                        </p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {analysis.folderItems.map((fileItem) => (
                            <div
                              key={fileItem.fsId}
                              className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs"
                            >
                              <span className="font-semibold text-slate-800 truncate">
                                {fileItem.title} ({formatBytes(fileItem.sizeBytes)})
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInputVal(fileItem.shareUrl);
                                    handleAnalyzeOrSearch(fileItem.shareUrl);
                                  }}
                                  className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 text-[11px] font-bold"
                                >
                                  Preview
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    startManagedDownload({
                                      media: { title: fileItem.title, thumbnailUrl: fileItem.thumbnailUrl },
                                      platform: analysis.platform,
                                      selectedStream: {
                                        qualityTitle: 'HD',
                                        formatExt: 'ts',
                                        streamUrl: fileItem.directDownloadUrl,
                                      },
                                      sourceUrl: fileItem.shareUrl,
                                      deliveryMode: 'auto',
                                    })
                                  }
                                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 text-[11px] font-bold"
                                >
                                  Direct Download
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                <NativeSponsorBanner />
              </div>
            </div>
          </motion.div>
        )}

        {/* LIVE VIDEO SEARCH RESULTS GRID */}
        {Array.isArray(searchResults) && (
          <div className="mt-8 w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Live Video Search Results ({searchResults.length})
              </h2>
              <button
                type="button"
                onClick={() => setSearchResults(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900"
              >
                Close Search
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className="ud-card p-8 text-center text-sm text-slate-500">
                No public streams matched your search query. Try another title or paste a direct URL.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {searchResults.map((vid) => (
                  <div
                    key={vid.id || vid.url}
                    className="bg-white border border-slate-200 hover:border-blue-400 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
                  >
                    <div className="relative aspect-video bg-slate-100 overflow-hidden">
                      {vid.thumbnailUrl && (
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}
                      {vid.durationText && (
                        <span className="absolute bottom-2 right-2 rounded-md bg-slate-900/85 text-white px-2 py-0.5 text-[11px] font-bold">
                          {vid.durationText}
                        </span>
                      )}
                    </div>
                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2">
                          {vid.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-1 truncate">
                          {vid.channelName || 'Public Stream'} · {vid.viewsText || 'HD'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setInputVal(vid.url);
                          handleAnalyzeOrSearch(vid.url);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 py-2 text-xs font-bold text-white"
                      >
                        <Play size={13} fill="currentColor" />
                        <span>Play &amp; Download HD</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <SearchAnythingModal
        open={searchAnythingOpen}
        onClose={() => setSearchAnythingOpen(false)}
        onPick={(item) => {
          setSearchAnythingOpen(false);
          setInputVal(item.url);
          handleAnalyzeOrSearch(item.url);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onDownload={(item) => {
          setSearchAnythingOpen(false);
          setInputVal(item.url);
          handleAnalyzeOrSearch(item.url);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </section>
  );
}
