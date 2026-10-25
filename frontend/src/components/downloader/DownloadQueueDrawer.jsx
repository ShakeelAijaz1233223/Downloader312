import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  PlusCircle,
  Trash2,
  Sliders,
  Settings,
  Download,
  FolderOpen,
  Film,
  Music,
  Cloud,
  Gauge,
  FileDown,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  LogIn,
} from 'lucide-react';
import { useApp, triggerNativeChromeDownload } from '../../context/AppContext';
import { formatBytes } from '../../services/apiClient';
import { ProgressQueueSponsorCard } from '../monetization/AdWaterfallManager';

// ============================================================================
// FULL-WIDTH DOWNLOAD STUDIO + STRICT PER-USER DOWNLOAD HISTORY (PURE WHITE)
// - Guest Mode (`!user`): ZERO download history stored (`0` items saved).
// - Logged-In User (`user`): Shows ONLY this user's own history with instant
//   Direct Download launch, per-item `Delete`, and 1-click `Clean History`!
// ============================================================================
export function IdmDownloadStudio() {
  const {
    user,
    downloadQueue,
    enginePrefs,
    startManagedDownload,
    resolveAndStartDownload,
    sendDirectUrlToIdm,
    deleteHistoryItem,
    cleanAllHistory,
    openJobInIdm,
    setSpeedLimiterModalOpen,
    showToast,
  } = useApp();

  const [selectedJobId, setSelectedJobId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [addUrlModalOpen, setAddUrlModalOpen] = useState(false);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);

  const selectedJob = useMemo(
    () => downloadQueue.find((j) => j.id === selectedJobId) || downloadQueue[0] || null,
    [downloadQueue, selectedJobId]
  );

  const filteredJobs = useMemo(() => {
    if (!user) return [];
    return downloadQueue.filter((j) => {
      if (categoryFilter === 'all') return true;
      return (j.category || 'video') === categoryFilter;
    });
  }, [downloadQueue, categoryFilter, user]);

  const handleQuickAddUrl = async (e) => {
    e.preventDefault();
    const raw = newUrlInput.trim();
    if (!raw) return;
    setAddingBusy(true);
    try {
      const isDirectFile = /\.(mp4|mkv|webm|mov|mp3|m4a|ts)(\?|#|$)/i.test(raw);
      if (isDirectFile) {
        await startManagedDownload({
          media: { title: raw.split('/').pop()?.split('?')[0] || 'Direct_Media_File' },
          platform: { id: 'direct_media', displayName: 'Direct Link' },
          selectedStream: {
            qualityTitle: 'Original',
            formatExt: /\.mp3(\?|$)/i.test(raw) ? 'mp3' : 'mp4',
            formatSelector: 'direct_idm_stream',
            streamUrl: raw,
          },
          sourceUrl: raw,
          deliveryMode: 'auto',
          openDrawer: false,
        });
      } else {
        // Normal webpage link (YouTube, TeraBox, movie page...) → resolve first.
        await resolveAndStartDownload({ url: raw });
      }
      setNewUrlInput('');
      setAddUrlModalOpen(false);
    } catch (err) {
      showToast(err.message || 'Could not start download', 'error');
    } finally {
      setAddingBusy(false);
    }
  };

  const sidebarCategories = [
    { id: 'all', label: 'All My History', icon: FolderOpen, count: user ? downloadQueue.length : 0 },
    {
      id: 'video',
      label: 'Video (MP4 / HD)',
      icon: Film,
      count: user ? downloadQueue.filter((j) => (j.category || 'video') === 'video').length : 0,
    },
    {
      id: 'music',
      label: 'Audio (MP3 / M4A)',
      icon: Music,
      count: user ? downloadQueue.filter((j) => j.category === 'music').length : 0,
    },
    {
      id: 'cloud',
      label: 'TeraBox & Cloud',
      icon: Cloud,
      count: user ? downloadQueue.filter((j) => j.category === 'cloud').length : 0,
    },
  ];

  return (
    <div className="w-full rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      {/* Download Studio Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 via-blue-50/60 to-indigo-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <Gauge size={17} />
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
              Fast Direct Download Manager · Personal User History
            </h2>
            <p className="text-[11px] text-slate-500">
              {user
                ? `Signed in as ${user.fullName || user.displayName || user.email} · Private User History Enabled`
                : 'Guest Mode Active — 0 Download History Saved When Logged Out'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSpeedLimiterModalOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-extrabold transition-colors ${
            enginePrefs.speedLimiterEnabled
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800'
          }`}
        >
          <Sliders size={14} />
          <span>
            {enginePrefs.speedLimiterEnabled
              ? `Speed Limiter ON: ${enginePrefs.maxSpeedKBps} KB/s`
              : 'Speed Mode: UNLIMITED (Full Direct Download Speed)'}
          </span>
        </button>
      </div>

      {/* Action Toolbar with Add URL, Delete Selected, and Clean All History */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAddUrlModalOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm"
        >
          <PlusCircle size={15} />
          <span>Add Direct URL</span>
        </button>

        {user && (
          <>
            <button
              type="button"
              disabled={!selectedJob}
              onClick={() => selectedJob && deleteHistoryItem(selectedJob.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 text-xs font-extrabold text-rose-700 disabled:opacity-40"
            >
              <Trash2 size={14} />
              <span>Delete Selected</span>
            </button>

            <button
              type="button"
              disabled={downloadQueue.length === 0}
              onClick={cleanAllHistory}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-extrabold text-white shadow-sm disabled:opacity-40"
            >
              <Trash2 size={14} />
              <span>Clean History ({downloadQueue.length})</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setSpeedLimiterModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 text-xs font-extrabold text-blue-700"
        >
          <Sliders size={14} />
          <span>Speed Limiter</span>
        </button>

        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 ml-auto"
        >
          <Settings size={14} className="text-blue-600" />
          <span>Options</span>
        </Link>
      </div>

      {/* Inline Add URL Bar */}
      {addUrlModalOpen && (
        <form
          onSubmit={handleQuickAddUrl}
          className="px-5 py-3.5 bg-blue-50/60 border-b border-blue-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <input
            type="url"
            required
            value={newUrlInput}
            onChange={(e) => setNewUrlInput(e.target.value)}
            placeholder="Paste any YouTube, TeraBox, TikTok, Social, or Direct MP4/MP3 URL to start immediate Direct Download download..."
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={addingBusy}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-xs font-extrabold text-white"
            >
              {addingBusy ? 'Starting...' : 'Download in Direct Download'}
            </button>
            <button
              type="button"
              onClick={() =>
                newUrlInput.trim() &&
                sendDirectUrlToIdm({
                  streamUrl: newUrlInput.trim(),
                  sourceUrl: newUrlInput.trim(),
                  fileName: 'Direct_IDM_Download.mp4',
                })
              }
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-extrabold text-white"
            >
              Open again
            </button>
          </div>
        </form>
      )}

      {/* Main Split Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[360px]">
        {/* Left Category Tree */}
        <aside className="lg:col-span-3 xl:col-span-2 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/70 p-3 space-y-1">
          <p className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            History Categories
          </p>
          {sidebarCategories.map((cat) => {
            const Icon = cat.icon;
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                  active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-white'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon size={15} className={active ? 'text-white' : 'text-blue-600'} />
                  <span className="truncate">{cat.label}</span>
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Right Full-Width User History Area */}
        <div className="lg:col-span-9 xl:col-span-10 overflow-x-auto">
          {!user ? (
            <div className="p-12 sm:p-16 text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <ShieldCheck size={26} />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                No User Logged In — Zero Download History Saved
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                All downloads start immediately in your <strong>Direct Download</strong> or{' '}
                <strong>Google Chrome</strong>, and <strong>zero history</strong> is saved while logged out. Sign in to save and manage your personal download history per account.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm"
                >
                  <LogIn size={15} />
                  <span>Sign In to Save Personal History</span>
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-5 py-2.5 text-xs font-extrabold text-slate-800"
                >
                  <UserCheck size={15} className="text-blue-600" />
                  <span>Create Free Account</span>
                </Link>
              </div>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-14 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto">
                <Download size={22} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Your Personal Download History Is Empty
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Signed in as <strong>{user.fullName || user.email}</strong>. Any video you download now will appear exclusively in your account history.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-3">Quality</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3">Engine</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-4 text-right">Direct Download / Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredJobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id;
                  const directHref =
                    job.directDownloadUrl || job.streamUrl || `/api/v1/downloads/${job.id}/file`;

                  return (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-bold text-slate-900 truncate" title={job.fileName}>
                          {job.fileName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{job.title}</p>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-700 uppercase">
                          {job.qualityLabel || 'HD'} · {job.formatExt || 'MP4'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                        {job.totalBytes > 0 ? formatBytes(job.totalBytes) : 'Direct Stream'}
                      </td>

                      <td className="py-3.5 px-3 font-medium text-emerald-700 whitespace-nowrap">
                        {job.engineLabel || 'Direct Download Direct'}
                      </td>

                      <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                        {job.createdAt ? new Date(job.createdAt).toLocaleString() : 'Just now'}
                      </td>

                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openJobInIdm(job.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 text-[11px] font-bold text-white"
                          >
                            <ExternalLink size={12} />
                            <span>Direct Download</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => triggerNativeChromeDownload(directHref, job.fileName)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 text-[11px] font-bold text-white"
                          >
                            <FileDown size={13} />
                            <span>Chrome</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteHistoryItem(job.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 text-[11px] font-bold text-rose-700"
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Slide-Over Personal Download History Drawer in Navbar
export function DownloadQueueDrawer({ open, onClose }) {
  const {
    user,
    downloadQueue,
    deleteHistoryItem,
    cleanAllHistory,
    openJobInIdm,
    setSpeedLimiterModalOpen,
  } = useApp();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/35 flex justify-end">
      <div className="w-full max-w-xl bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              {user
                ? `My Download History (${downloadQueue.length})`
                : 'Guest Mode — Zero History Saved'}
            </h3>
            <p className="text-xs text-slate-500">
              {user
                ? `Account: ${user.fullName || user.displayName || user.email}`
                : 'Sign in anytime to save personal history per user account'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSpeedLimiterModalOpen(true)}
              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700"
            >
              Speed Limiter
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg hover:bg-slate-200/70 flex items-center justify-center text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 bg-white text-xs">
          <div className="flex items-center gap-2">
            {user && downloadQueue.length > 0 && (
              <button
                type="button"
                onClick={cleanAllHistory}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1.5 font-extrabold text-white"
              >
                <Trash2 size={13} />
                <span>Clean All History</span>
              </button>
            )}
          </div>
          <Link
            to="/downloads"
            onClick={onClose}
            className="font-extrabold text-blue-600 hover:underline"
          >
            Full History Manager →
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!user ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center space-y-3">
              <ShieldCheck size={28} className="mx-auto text-emerald-600" />
              <p className="text-sm font-extrabold text-slate-900">
                0 History Stored While Logged Out
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Every download launches immediately in Direct Download or Google Chrome without storing history. Sign in to keep personal download history for your account.
              </p>
              <Link
                to="/login"
                onClick={onClose}
                className="inline-block rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-extrabold text-white"
              >
                Sign In / Create Account
              </Link>
            </div>
          ) : downloadQueue.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-xs text-slate-500">
              Your personal download history is clean (0 saved items).
            </div>
          ) : (
            downloadQueue.map((job) => {
              const directHref =
                job.directDownloadUrl || job.streamUrl || `/api/v1/downloads/${job.id}/file`;
              return (
                <div
                  key={job.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                        {job.fileName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {job.qualityLabel || 'HD'} ·{' '}
                        {job.totalBytes > 0 ? formatBytes(job.totalBytes) : 'Direct Stream'}
                      </p>
                    </div>
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">
                      Saved
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => deleteHistoryItem(job.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openJobInIdm(job.id)}
                        className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1 text-[11px] font-bold text-white"
                      >
                        Direct Download
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerNativeChromeDownload(directHref, job.fileName)}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1 text-[11px] font-bold text-white"
                      >
                        Chrome Save
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <ProgressQueueSponsorCard />
        </div>
      </div>
    </div>
  );
}
