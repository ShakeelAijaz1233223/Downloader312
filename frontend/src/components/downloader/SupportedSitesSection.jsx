import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ShieldAlert, ArrowUpRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformIcon } from '../icons/PlatformIcon';

export function SupportedSitesSection({ onPickPlatform, initialCategory = 'all', showAllByDefault = false }) {
  const { platforms, enginePrefs } = useApp();
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [filterText, setFilterText] = useState('');
  const [expanded, setExpanded] = useState(showAllByDefault);

  const counts = useMemo(() => {
    const map = { all: 0, social: 0, video: 0, education: 0, cloud_terabox: 0, web: 0 };
    for (const p of platforms) {
      if (p.isAdult || p.category === 'adult_18') continue; // family-safe only
      map.all += 1;
      if (map[p.category] !== undefined) map[p.category] += 1;
    }
    return map;
  }, [platforms]);

  const categories = useMemo(() => {
    const base = [
      { id: 'all', label: 'All Mainstream', count: counts.all },
      { id: 'social', label: 'Social Media', count: counts.social },
      { id: 'video', label: 'Streaming · Video · Music', count: counts.video },
      { id: 'education', label: 'Courses & Learning', count: counts.education },
      { id: 'cloud_terabox', label: 'TeraBox & Cloud', count: counts.cloud_terabox },
      { id: 'web', label: 'AI · Search · Shopping · Dev', count: counts.web },
    ];
    return base.filter((c) => c.id === 'all' || c.count > 0);
  }, [counts]);

  const filteredPlatforms = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return platforms.filter((p) => {
      if (p.isAdult || p.category === 'adult_18') return false; // never list adult sites
      if (activeCategory !== 'all' && p.category !== activeCategory) {
        return false;
      }

      if (!q) return true;
      return (
        p.displayName?.toLowerCase().includes(q) ||
        p.subtitle?.toLowerCase().includes(q) ||
        (p.domains || []).some((d) => String(d).toLowerCase().includes(q))
      );
    });
  }, [platforms, activeCategory, filterText]);

  const visiblePlatforms = expanded || filterText.trim() ? filteredPlatforms : filteredPlatforms.slice(0, 60);

  return (
    <section className="w-full bg-slate-50/70 border-b border-slate-200/80 py-14">
      <div className="w-full px-4 sm:px-8 xl:px-12">
        {/* FULL-WIDTH CLEAR HEADER ROW (100% Fixed Layout — Zero Column Squish!) */}
        <div className="w-full flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-7">
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3.5 py-1 text-xs font-bold text-blue-700 mb-3">
              <Sparkles size={13} />
              <span>{platforms.length} Live Multi-Engine Adapters · Zero Paid Keys</span>
            </span>

            <h2 className="font-display text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-tight text-slate-900">
              Supported Websites —{' '}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 bg-clip-text text-transparent">
                Social, Movies, Courses &amp; TeraBox
              </span>
            </h2>

            <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-4xl leading-relaxed">
              Click any website card below to load its dedicated extractor, online browser player, and{' '}
              <strong className="text-slate-800">fast one-click download engine</strong> instantly.
            </p>
          </div>

          {/* Wide Right Search Box */}
          <div className="w-full lg:w-[420px] shrink-0">
            <div className="flex items-center gap-2.5 rounded-2xl bg-white border border-slate-300 focus-within:border-blue-600 px-4 py-3 shadow-sm">
              <Search size={17} className="text-blue-600 shrink-0" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={`Search ${platforms.length} supported sites (YouTube, Udemy, TeraBox, GitHub…)`}
                className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              {filterText && (
                <button
                  type="button"
                  onClick={() => setFilterText('')}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* FULL-WIDTH FRAMER MOTION CATEGORY TABS */}
        <div className="flex flex-wrap items-center gap-2 mb-7">
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setExpanded(showAllByDefault);
                }}
                className={`relative px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors border ${
                  active
                    ? 'text-white border-blue-600 bg-blue-600 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="activeWhiteCategoryTab"
                    transition={{ type: 'spring', stiffness: 460, damping: 35 }}
                    className="absolute inset-0 rounded-xl bg-blue-600 -z-0"
                  />
                )}
                <span className="relative z-10">{cat.label}</span>
                <span
                  className={`relative z-10 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        <>
            {/* ULTRA-SMOOTH 120 FPS FULL-WIDTH 8-COLUMN WHITE TAILWIND GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3.5">
              {visiblePlatforms.map((plat) => (
                <div
                  key={plat.id}
                  onClick={() => {
                    onPickPlatform?.(plat);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="group cursor-pointer bg-white border border-slate-200 hover:border-blue-500 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-150 hover:-translate-y-0.5 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <PlatformIcon platform={plat} size={34} />
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <CheckCircle2 size={10} />
                        <span>{enginePrefs.idmConnections || 32}x</span>
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                      {plat.displayName}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                      {plat.subtitle}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-400 truncate max-w-[115px]">
                      {(plat.domains && plat.domains[0]) || 'direct-stream'}
                    </span>
                    <Link
                      to={`/tools/${plat.seoSlug}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 shrink-0"
                    >
                      <span>Open</span>
                      <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {filteredPlatforms.length > visiblePlatforms.length && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-400 px-6 py-3 text-xs sm:text-sm font-extrabold text-slate-800 shadow-sm transition-colors"
                >
                  <span>
                    Show All {filteredPlatforms.length} Platforms in This Tab (+
                    {filteredPlatforms.length - visiblePlatforms.length} More)
                  </span>
                </button>
              </div>
            )}
        </>
      </div>
    </section>
  );
}
