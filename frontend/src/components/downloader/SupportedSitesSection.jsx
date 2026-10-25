import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ArrowUpRight,
  CheckCircle2,
  Sparkles,
  Copy,
  Link2,
  Globe2,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformIcon } from '../icons/PlatformIcon';

const CATEGORY_BASE = [
  { id: 'all', label: 'All Mainstream' },
  { id: 'social', label: 'Social Media' },
  { id: 'video', label: 'Streaming · Video · Music' },
  { id: 'education', label: 'Courses & Learning' },
  { id: 'cloud_terabox', label: 'TeraBox & Cloud' },
  { id: 'web', label: 'AI · Search · Shopping · Dev' },
];

const PAGE_SIZE = 48;

export function SupportedSitesSection({ onPickPlatform, initialCategory = 'all', showAllByDefault = false }) {
  const { platforms, enginePrefs, showToast } = useApp();
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [filterText, setFilterText] = useState('');
  const [visibleCount, setVisibleCount] = useState(showAllByDefault ? Infinity : PAGE_SIZE);

  const counts = useMemo(() => {
    const map = { all: 0, social: 0, video: 0, education: 0, cloud_terabox: 0, web: 0 };
    for (const p of platforms) {
      if (p.isAdult || p.category === 'adult_18') continue; // family-safe only
      map.all += 1;
      if (map[p.category] !== undefined) map[p.category] += 1;
    }
    return map;
  }, [platforms]);

  const categories = useMemo(
    () => CATEGORY_BASE.filter((c) => c.id === 'all' || counts[c.id] > 0),
    [counts]
  );

  const filteredPlatforms = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return platforms.filter((p) => {
      if (p.isAdult || p.category === 'adult_18') return false; // never list adult sites
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (!q) return true;
      return (
        p.displayName?.toLowerCase().includes(q) ||
        p.subtitle?.toLowerCase().includes(q) ||
        (p.linkPattern || '').toLowerCase().includes(q) ||
        (p.domains || []).some((d) => String(d).toLowerCase().includes(q))
      );
    });
  }, [platforms, activeCategory, filterText]);

  const visiblePlatforms = filteredPlatforms.slice(0, visibleCount);

  const copyExample = async (plat) => {
    const link = plat.realExampleUrl || plat.exampleUrl || '';
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      showToast?.(`Example ${plat.displayName} link copied — paste it in the box above.`, 'success');
    } catch {
      showToast?.(`Copy this link: ${link}`, 'info');
    }
  };

  return (
    <section
      id="supported-websites"
      className="relative w-full overflow-hidden border-b border-violet-200/60 bg-gradient-to-b from-white via-violet-50/40 to-white py-14"
    >
      <div className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.16),transparent_70%)]" />

      <div className="relative w-full px-4 sm:px-8 xl:px-12">
        <div className="mb-7 flex w-full flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3.5 py-1 text-xs font-bold text-violet-700">
              <Sparkles size={13} />
              <span>{counts.all} live website adapters · every share link checked</span>
            </span>

            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl xl:text-4xl">
              Supported Websites —{' '}
              <span className="bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Social, Movies, Courses &amp; TeraBox
              </span>
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Every card carries the <strong className="text-slate-800">exact share-link shape</strong> it
              accepts plus a real example you can copy. Click a card to load its dedicated extractor,
              online browser player and <strong className="text-slate-800">one-click download engine</strong>.
            </p>
          </div>

          <div className="w-full shrink-0 lg:w-[420px]">
            <div className="flex items-center gap-2.5 rounded-2xl border border-violet-200 bg-white px-4 py-3 shadow-sm transition-colors focus-within:border-violet-500">
              <Search size={17} className="shrink-0 text-violet-600" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => {
                  setFilterText(e.target.value);
                  setVisibleCount(Infinity);
                }}
                placeholder={`Search ${counts.all} sites or a link pattern (youtube.com/watch…)`}
                aria-label="Search supported websites"
                className="w-full bg-transparent text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-sm"
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

        {/* Universal acceptance banner — any site, even ones not listed here */}
        <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2 font-semibold">
            <Globe2 size={15} className="text-emerald-600" />
            Not in this list? Paste it anyway — the universal engine opens{' '}
            <strong>any website</strong> with a video, reel, audio file or embedded player.
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-bold text-emerald-700 ring-1 ring-emerald-200">
            <ShieldCheck size={12} /> Unlimited sites
          </span>
        </div>

        <div className="mb-7 flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setVisibleCount(showAllByDefault ? Infinity : PAGE_SIZE);
                }}
                className={`relative flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors sm:text-sm ${
                  active
                    ? 'border-violet-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:text-violet-700'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="activeVioletCategoryTab"
                    transition={{ type: 'spring', stiffness: 460, damping: 35 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600"
                  />
                )}
                <span className="relative z-10">{cat.label}</span>
                <span
                  className={`relative z-10 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {counts[cat.id]}
                </span>
              </button>
            );
          })}
        </div>

        <motion.div layout className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <AnimatePresence initial={false}>
            {visiblePlatforms.map((plat, index) => (
              <motion.div
                key={plat.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2, delay: Math.min(index, 12) * 0.012 }}
                onClick={() => {
                  onPickPlatform?.(plat);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="group relative flex cursor-pointer flex-col justify-between gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-violet-400 hover:shadow-[0_16px_40px_rgba(139,92,246,0.18)]"
              >
                <span className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-violet-400/0 blur-2xl transition-all duration-300 group-hover:bg-violet-400/25" />

                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <PlatformIcon platform={plat} size={34} />
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <CheckCircle2 size={10} />
                      <span>{enginePrefs.idmConnections || 32} threads</span>
                    </span>
                  </div>

                  <h3 className="truncate text-sm font-extrabold text-slate-900 transition-colors group-hover:text-violet-700">
                    {plat.displayName}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                    {plat.subtitle}
                  </p>

                  {plat.linkPattern && (
                    <p className="mt-2 line-clamp-2 rounded-lg bg-violet-50/70 px-2 py-1 font-mono text-[10px] leading-snug text-violet-700">
                      {plat.linkPattern}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1 border-t border-slate-100 pt-2 text-[11px] font-bold">
                  {plat.hasVerifiedExample ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyExample(plat);
                      }}
                      className="inline-flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-1 text-violet-700 transition-colors hover:bg-violet-50"
                      title={`Copy a real example: ${plat.realExampleUrl}`}
                    >
                      <Copy size={11} />
                      <span className="truncate">Example</span>
                    </button>
                  ) : (
                    <span
                      className="inline-flex min-w-0 items-center gap-1 px-1.5 py-1 text-slate-400"
                      title={plat.linkHint || 'Paste any public video / file link from this site'}
                    >
                      <Copy size={11} />
                      <span className="truncate">Any link</span>
                    </span>
                  )}

                  <Link
                    to={`/tools/${plat.seoSlug}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex shrink-0 items-center gap-0.5 px-1.5 py-1 text-violet-700 hover:text-violet-900"
                  >
                    <span>Open</span>
                    <ArrowUpRight size={12} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredPlatforms.length === 0 && (
          <div className="rounded-2xl border border-dashed border-violet-300 bg-white/70 p-8 text-center">
            <Link2 className="mx-auto mb-2 text-violet-500" size={22} />
            <p className="text-sm font-bold text-slate-800">
              No catalogue card matches “{filterText}”.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              That is fine — the universal engine still accepts the link. Paste it in the box above and
              press Extract.
            </p>
          </div>
        )}

        {filteredPlatforms.length > visiblePlatforms.length && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE * 2)}
              className="inline-flex items-center gap-2 rounded-2xl border border-violet-300 bg-white px-6 py-3 text-xs font-extrabold text-violet-800 shadow-sm transition-colors hover:bg-violet-50 sm:text-sm"
            >
              <ChevronDown size={15} />
              Show {Math.min(PAGE_SIZE * 2, filteredPlatforms.length - visiblePlatforms.length)} more of{' '}
              {filteredPlatforms.length} platforms
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
