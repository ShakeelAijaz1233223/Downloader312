import React, { useState } from 'react';
import { Eye, Save, X, Trash2, Radio, PlusCircle, Film } from 'lucide-react';
import { formatBytes, UltraApi } from '../../services/apiClient';

export function LiveNotificationDrawer({
  liveCards,
  onViewCard,
  onSaveCard,
  onCloseCard,
  onClearAll,
  onRefreshCards,
  showToast,
}) {
  const [livePasteUrl, setLivePasteUrl] = useState('');

  const handleManualPasteCapture = async (e) => {
    e.preventDefault();
    const url = livePasteUrl.trim();
    if (!url) {
      showToast('Paste a real https:// video URL to send into RAM Notification Stream.', 'info');
      return;
    }
    try {
      await UltraApi.silentPasteCapture(url, 'admin_live_intake');
      setLivePasteUrl('');
      await onRefreshCards();
      showToast('Real URL captured in Volatile RAM only — 0 SQL rows written.', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <aside
      aria-label="Live Paste Notification Stream"
      className="w-full xl:w-80 shrink-0 bg-[#090E1D] border-t xl:border-t-0 xl:border-l border-slate-800 flex flex-col max-h-screen"
    >
      <div className="p-4 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-extrabold text-white">Live Paste Stream</span>
            <span className="rounded-full bg-blue-600/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
              {liveCards.length} RAM
            </span>
          </div>

          {liveCards.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 hover:bg-rose-600 px-2 py-1 text-[11px] font-bold text-rose-300 hover:text-white"
            >
              <Trash2 size={11} /> Clear All
            </button>
          )}
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-slate-200">Zero-Auto-DB Rule:</strong> Pasted links stay strictly in Volatile RAM until you click{' '}
          <strong className="text-emerald-400">SAVE</strong>.
        </p>

        <form onSubmit={handleManualPasteCapture} className="flex gap-1.5">
          <input
            type="url"
            value={livePasteUrl}
            onChange={(e) => setLivePasteUrl(e.target.value)}
            placeholder="Paste real https:// video URL..."
            className="flex-1 rounded-lg bg-[#050914] border border-slate-800 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-lg bg-[#1D6FF2] hover:bg-blue-500 px-2.5 py-1.5 text-xs font-extrabold text-white"
          >
            <PlusCircle size={13} /> Push
          </button>
        </form>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {liveCards.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2">
            <Radio size={28} className="mx-auto text-slate-600" />
            <p className="text-xs font-bold text-slate-300">Waiting for Live Pasted URLs</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Paste any real URL on the public home page or above to stream its live video card here in real time.
            </p>
          </div>
        ) : (
          liveCards.map((card) => (
            <article
              key={card.cardId}
              className="rounded-xl bg-[#0D1322] border border-slate-800 overflow-hidden shadow-md"
            >
              <div
                onClick={() => onViewCard(card)}
                className="cursor-pointer relative aspect-video bg-slate-950 overflow-hidden"
              >
                {card.thumbnailUrl ? (
                  <img src={card.thumbnailUrl} alt={card.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-sky-400">
                    <Film size={24} />
                  </div>
                )}
                <span className="absolute top-2 left-2 rounded-full bg-slate-950/90 px-2 py-0.5 text-[10px] font-extrabold text-sky-300">
                  {card.platform?.displayName || card.platformName || 'Stream'}
                </span>
                <span className="absolute bottom-2 right-2 rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {card.resolutionLabel} · {card.durationText}
                </span>
              </div>

              <div className="p-3 space-y-2.5">
                <p className="text-xs font-bold text-white line-clamp-2">{card.title}</p>

                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{formatBytes(card.estimatedSizeBytes)}</span>
                  <span className="text-amber-300 font-semibold">RAM Only · Not Saved</span>
                </div>

                {/* STRICT 3 ACTION BUTTONS: [ VIEW ] | [ SAVE ] | [ CLOSE ] */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onViewCard(card)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 py-1.5 text-[11px] font-extrabold text-sky-300 hover:text-white transition-colors"
                  >
                    <Eye size={12} /> VIEW
                  </button>

                  <button
                    type="button"
                    onClick={() => onSaveCard(card)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 py-1.5 text-[11px] font-extrabold text-emerald-300 hover:text-white transition-colors"
                  >
                    <Save size={12} /> SAVE
                  </button>

                  <button
                    type="button"
                    onClick={() => onCloseCard(card)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 py-1.5 text-[11px] font-extrabold text-rose-300 hover:text-white transition-colors"
                  >
                    <X size={12} /> CLOSE
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
