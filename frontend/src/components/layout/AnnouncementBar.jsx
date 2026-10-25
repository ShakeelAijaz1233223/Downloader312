import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Film } from 'lucide-react';

// User-facing trust bar only — internal engine details stay hidden from visitors.
export function AnnouncementBar() {
  return (
    <div className="w-full border-b border-slate-200 bg-gradient-to-r from-slate-50 via-blue-50/70 to-indigo-50/60 text-xs text-slate-700">
      <div className="w-full px-4 sm:px-8 xl:px-12 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ud-live-dot shrink-0" />
          <Sparkles size={14} className="text-blue-600 shrink-0" />
          <span className="font-semibold text-slate-800 truncate">
            Watch TeraBox, Reels, Movies, Courses &amp; 4K Videos Online — Then Download in One Click
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>100% Free · No Sign-Up Needed</span>
          </span>

          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
            <Film size={12} className="text-blue-600" />
            <span>HD · 4K · MP3 Quality</span>
          </span>

          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
            <Zap size={12} className="text-indigo-600" />
            <span>Instant Download Start</span>
          </span>

          <Link
            to="/sites"
            className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>All Supported Sites</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
