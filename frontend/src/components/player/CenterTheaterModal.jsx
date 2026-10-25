import React, { useCallback, useRef, useState } from 'react';
import { X, Save, Trash2, ExternalLink, HardDrive, Download, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { OnlineVideoPlayer } from './OnlineVideoPlayer';
import { PlatformIcon } from '../icons/PlatformIcon';
import { formatBytes } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
import { runUniversalDownload, upstreamFromProxyPath } from '../../services/downloadEngine';

export function CenterTheaterModal({
  item: rawItem,
  card,
  onCloseModal,
  onSaveCard,
  onDiscardCard,
  isFromSavedVault = false,
}) {
  const item = rawItem || card;
  const { user, showToast } = useApp() || {};
  const [dl, setDl] = useState({ state: 'idle', message: '' });
  const dlLockRef = useRef(false);

  // EXACT same engine the public site uses: ticket -> verify -> IDM or Chrome.
  const handleDownload = useCallback(async () => {
    if (dlLockRef.current || !item) return;
    dlLockRef.current = true;
    setDl({ state: 'starting', message: 'Preparing download…' });

    try {
      const stream =
        item.selectedStream || {
          formatExt: item.formatExt || 'mp4',
          qualityTitle: item.resolutionLabel || item.qualityLabel || 'HD',
          directCdnUrl:
            item.directCdnUrl || item.rawStreamUrl || upstreamFromProxyPath(item.streamUrl) || '',
          streamUrl: item.streamUrl,
          mimeType: item.mimeType || '',
        };

      const result = await runUniversalDownload({
        stream,
        analysis: {
          media: { title: item.title, thumbnailUrl: item.thumbnailUrl },
          canonicalUrl: item.rawUrl || item.sourceUrl,
          fileId: item.fileId,
        },
        user,
        onProgress: ({ state, message }) => setDl({ state, message }),
      });

      setDl({ state: 'started', message: result.message });
      showToast?.(result.message, 'success');
    } catch (err) {
      setDl({ state: 'failed', message: err?.message || 'Download could not be started.' });
      showToast?.(err?.message || 'Download could not be started.', 'error');
    } finally {
      dlLockRef.current = false;
    }
  }, [item, showToast, user]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Center Theater Video Player"
      className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <PlatformIcon platform={item.platform} size={24} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600">
                  {isFromSavedVault ? 'Saved Server Vault Player' : 'Live RAM Stream Preview (0 GB Saved)'}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold">
                  {item.resolutionLabel || '1080p HD'} · {formatBytes(item.estimatedSizeBytes || item.fileSizeBytes)}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {item.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseModal}
            aria-label="Close theater viewer"
            className="h-9 w-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 bg-white">
          <OnlineVideoPlayer
            streamUrl={item.streamUrl}
            posterUrl={item.thumbnailUrl}
            title={item.title}
            platformName={item.platform?.displayName}
            autoPlay={true}
          />

          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-slate-200">
            <div className="min-w-0 max-w-full">
              <p className="text-xs text-slate-600 flex items-center gap-1.5 truncate">
                <HardDrive size={13} className="text-blue-600 shrink-0" />
                <span className="truncate">{item.rawUrl || item.sourceUrl}</span>
                <a
                  href={item.rawUrl || item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-bold hover:underline inline-flex items-center gap-0.5 shrink-0"
                >
                  Open Source <ExternalLink size={11} />
                </a>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end shrink-0">
              <button
                type="button"
                onClick={handleDownload}
                disabled={dl.state === 'starting' || dl.state === 'verifying'}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition-colors"
              >
                {dl.state === 'starting' || dl.state === 'verifying' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : dl.state === 'started' ? (
                  <CheckCircle2 size={15} />
                ) : dl.state === 'failed' ? (
                  <AlertTriangle size={15} />
                ) : (
                  <Download size={15} />
                )}
                <span>
                  {dl.state === 'starting' || dl.state === 'verifying'
                    ? dl.message || 'Preparing…'
                    : dl.state === 'started'
                      ? 'Download Again'
                      : dl.state === 'failed'
                        ? 'Retry Download'
                        : 'Download · Direct Download'}
                </span>
              </button>

            {!isFromSavedVault && (
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onDiscardCard?.(item);
                    onCloseModal();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-700 hover:text-white transition-colors"
                >
                  <Trash2 size={15} />
                  <span>CLOSE (No Save · 0 Record)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSaveCard?.(item);
                    onCloseModal();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-colors"
                >
                  <Save size={15} />
                  <span>SAVE TO VAULT &amp; DB</span>
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
