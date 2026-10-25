import React, { useState } from 'react';
import { Play, Trash2, Copy, Eye, EyeOff, Search, Database, Film, Download, Loader2 } from 'lucide-react';
import { runUniversalDownload, upstreamFromProxyPath } from '../../services/downloadEngine';
import { formatBytes } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';

export function SavedVaultTab({ items = [], onPlayVaultItem, onDeleteVaultItem, showToast, user }) {
  const [busyId, setBusyId] = useState('');

  // Same engine as the public site: IDM if installed on this PC, else Chrome.
  const handleVaultDownload = async (item) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      const result = await runUniversalDownload({
        stream: {
          formatExt: item.formatExt || 'mp4',
          qualityTitle: item.maxResolutionLabel || item.resolutionLabel || 'HD',
          directCdnUrl: item.directCdnUrl || upstreamFromProxyPath(item.streamUrl),
          streamUrl: item.streamUrl,
          mimeType: item.mimeType || '',
        },
        analysis: {
          media: { title: item.title, thumbnailUrl: item.thumbnailUrl },
          canonicalUrl: item.rawUrl || item.sourceUrl,
          fileId: item.fileId,
        },
        user: activeUser,
        onProgress: () => {},
      });
      toast?.(result.message, 'success');
    } catch (err) {
      toast?.(err?.message || 'Download could not be started.', 'error');
    } finally {
      setBusyId('');
    }
  };

  const { showToast: appToast, user: appUser } = useApp();
  const toast = showToast || appToast;
  const activeUser = user || appUser;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [unblurred, setUnblurred] = useState({});

  const filtered = items.filter((item) => {
    if (filterMode === 'clean' && item.isAdult) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.platformName?.toLowerCase().includes(q) ||
      item.rawUrl?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
            <Database size={19} className="text-sky-400" />
            <span>Permanent SQL & Disk Video Vault ({items.length})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            ONLY videos explicitly approved via <strong className="text-emerald-400">[SAVE]</strong> appear here. Click{' '}
            <strong className="text-rose-400">Delete Forever</strong> anytime to remove from SQL & disk.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search saved vault..."
              className="rounded-xl bg-[#080C15] border border-slate-700 pl-8 pr-3 py-1.5 text-xs text-white"
            />
          </div>

          {['all', 'clean'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFilterMode(m)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize ${
                filterMode === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-12 text-center">
          <Database size={32} className="mx-auto text-slate-500 mb-2" />
          <p className="text-sm font-extrabold text-white">0 Videos Saved in SQL Vault</p>
          <p className="text-xs text-slate-400 mt-1">
            Click <strong className="text-emerald-400">[SAVE]</strong> on any live card in the Right-Side Notification Stream to archive it permanently here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const vidId = item.vaultId || item.id;
            const blurred = item.isAdult && !unblurred[vidId];
            return (
              <div
                key={vidId}
                className="rounded-2xl bg-[#0D1320] border border-slate-800 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-video bg-slate-950 overflow-hidden">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className={`w-full h-full object-cover ${blurred ? 'blur-xl scale-110' : ''}`}
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-sky-400">
                        <Film size={28} />
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <span className="rounded-full bg-slate-950/90 px-2.5 py-0.5 text-[10px] font-bold text-sky-300 border border-slate-800">
                        {item.platformName} · {item.maxResolutionLabel || item.resolutionLabel || 'HD'}
                      </span>
                                          </div>
                    <button
                      type="button"
                      onClick={() => onPlayVaultItem(item)}
                      className="absolute inset-0 flex items-center justify-center bg-slate-950/25 hover:bg-slate-950/10"
                    >
                      <span className="h-11 w-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg">
                        <Play size={18} fill="currentColor" className="ml-0.5" />
                      </span>
                    </button>
                  </div>

                  <div className="p-4">
                    <h3 className="text-sm font-extrabold text-white line-clamp-2">{item.title}</h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Saved {new Date(item.savedAt).toLocaleString()} · {formatBytes(item.fileSizeBytes || item.sizeBytes)}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPlayVaultItem(item)}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <Play size={12} fill="currentColor" /> Play
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(item.rawUrl || item.sourceUrl).catch(() => {});
                        showToast('Vault URL copied!', 'info');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-200"
                    >
                      <Copy size={12} /> URL
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVaultDownload(item)}
                      disabled={busyId === item.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 px-2.5 py-1.5 text-xs font-bold text-white"
                    >
                      {busyId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      Download
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteVaultItem(vidId)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 hover:bg-rose-600 border border-rose-500/35 px-3 py-1.5 text-xs font-extrabold text-rose-300 hover:text-white transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Delete Forever</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
