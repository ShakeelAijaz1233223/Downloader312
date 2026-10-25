import React from 'react';
import { Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function NativeSponsorBanner() {
  const { adWaterfall } = useApp();
  const cfg = adWaterfall?.native_banner;
  if (!cfg?.enabled) return null;

  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
          <Sparkles size={17} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
              Sponsored
            </span>
            <p className="text-xs sm:text-sm font-bold text-slate-900">{cfg.title}</p>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">{cfg.subtitle}</p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shrink-0">
        <span>{cfg.ctaText || 'Open'}</span>
        <ExternalLink size={13} />
      </span>
    </div>
  );
}

export function evaluateSmartDownloadAdTrigger(adWaterfall) {
  const cfg = adWaterfall?.download_click_direct_tab;
  if (!cfg?.enabled) return { triggered: false, reason: 'disabled' };

  const cooldownMs = Math.max(1, Number(cfg.cooldownMinutes || 20)) * 60 * 1000;
  const lastFired = Number(localStorage.getItem('ud_last_direct_ad_ts') || '0');
  const now = Date.now();

  if (now - lastFired < cooldownMs) {
    return {
      triggered: false,
      reason: 'cooldown_active',
      minutesRemaining: Math.ceil((cooldownMs - (now - lastFired)) / 60000),
    };
  }

  localStorage.setItem('ud_last_direct_ad_ts', String(now));
  if (cfg.directUrl && cfg.directUrl.startsWith('http')) {
    window.open(cfg.directUrl, '_blank', 'noopener,noreferrer');
  }
  return { triggered: true, reason: 'fired_with_20m_cooldown' };
}

export function ProgressQueueSponsorCard() {
  const { adWaterfall } = useApp();
  const cfg = adWaterfall?.progress_modal_sponsor;
  if (!cfg?.enabled) return null;

  return (
    <div className="mt-3 rounded-xl bg-blue-50/70 border border-blue-200 p-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
        <div className="truncate">
          <p className="text-xs font-bold text-slate-900 truncate">{cfg.title}</p>
          <p className="text-[11px] text-slate-600 truncate">{cfg.subtitle}</p>
        </div>
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-blue-200 text-blue-700 shrink-0">
        Tip
      </span>
    </div>
  );
}
