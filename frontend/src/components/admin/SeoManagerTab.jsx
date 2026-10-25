import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Plus, ExternalLink, Trash2 } from 'lucide-react';
import { UltraApi } from '../../services/apiClient';

export function SeoManagerTab({ keywords = [], onUpdateKeywords, showToast }) {
  const [newKeyword, setNewKeyword] = useState('');
  const [newSlug, setNewSlug] = useState('');

  const totals = useMemo(() => {
    const impressions = keywords.reduce((sum, k) => sum + Number(k.impressions || 0), 0);
    const clicks = keywords.reduce((sum, k) => sum + Number(k.clicks || 0), 0);
    const ctr = impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : '0.0%';
    return { impressions, clicks, ctr };
  }, [keywords]);

  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    try {
      const updated = await UltraApi.addSeoKeyword({
        keyword: newKeyword.trim(),
        slug:
          newSlug.trim() ||
          newKeyword
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
      });
      onUpdateKeywords(updated);
      setNewKeyword('');
      setNewSlug('');
      showToast('Live programmatic SEO route saved to SQL & /sitemap.xml.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not add SEO route.', 'error');
    }
  };

  const handleDeleteRoute = async (id) => {
    try {
      const updated = await UltraApi.deleteSeoKeyword(id);
      onUpdateKeywords(updated);
      showToast('SEO landing route deleted from SQL.', 'info');
    } catch (err) {
      showToast(err.message || 'Delete failed.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 100% REAL SQL KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-400">Active /tools/:slug Routes</p>
          <p className="text-2xl font-extrabold text-white mt-2">{keywords.length}</p>
          <p className="text-[11px] text-emerald-400 mt-1">Auto-listed in live /sitemap.xml</p>
        </div>

        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-400">Recorded SQL Impressions</p>
          <p className="text-2xl font-extrabold text-sky-400 mt-2">{totals.impressions.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400 mt-1">Real visits across SEO landing routes</p>
        </div>

        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-400">Recorded SQL Clicks</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-2">{totals.clicks.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400 mt-1">Click Open Page below to test live count</p>
        </div>

        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-400">Measured CTR</p>
          <p className="text-2xl font-extrabold text-amber-300 mt-2">{totals.ctr}</p>
          <p className="text-[11px] text-slate-400 mt-1">JSON-LD Rich Schema active</p>
        </div>
      </div>

      {/* Add Route Form */}
      <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe size={17} className="text-sky-400" />
          <h3 className="text-sm font-extrabold text-white">
            Publish New Programmatic SEO Route (Auto-Updates SQL & /sitemap.xml)
          </h3>
        </div>
        <form onSubmit={handleCreateRoute} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            required
            placeholder="Target keyword (e.g. YouTube Shorts HD Downloader)"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            className="rounded-xl bg-[#080C15] border border-slate-800 px-3.5 py-2 text-xs sm:text-sm text-white"
          />
          <input
            type="text"
            placeholder="Optional custom URL slug (e.g. youtube-shorts-hd)"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            className="rounded-xl bg-[#080C15] border border-slate-800 px-3.5 py-2 text-xs sm:text-sm text-white"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1D6FF2] hover:bg-blue-500 px-5 py-2.5 text-xs font-extrabold text-white"
          >
            <Plus size={15} /> Publish SEO Page
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-white">
            Live SQL Programmatic SEO Routes ({keywords.length})
          </h3>
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-sky-300"
          >
            Inspect Live /sitemap.xml <ExternalLink size={12} />
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-3">Target Keyword</th>
                <th className="py-2 px-3">Live Path</th>
                <th className="py-2 px-3">Impressions</th>
                <th className="py-2 px-3">Clicks</th>
                <th className="py-2 pl-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {keywords.map((row) => (
                <tr key={row.id || row.slug}>
                  <td className="py-2.5 pr-3 font-bold text-white">{row.keyword}</td>
                  <td className="py-2.5 px-3 font-mono text-sky-400">/tools/{row.slug}</td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {Number(row.impressions || 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-emerald-400">
                    {Number(row.clicks || 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 pl-3 flex items-center gap-2">
                    <Link
                      to={`/tools/${row.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-bold text-white"
                    >
                      Open Page <ExternalLink size={11} />
                    </Link>
                    {row.id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRoute(row.id)}
                        className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
