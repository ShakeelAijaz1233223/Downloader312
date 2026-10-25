import React, { useState } from 'react';
import { Globe, Layers, KeyRound, Sliders, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UltraApi } from '../../services/apiClient';
import { PlatformIcon } from '../icons/PlatformIcon';

export function OperationsTab({
  subTab = 'websites',
  auditLogs = [],
  cookieProfiles = [],
  onUpdateCookies,
  showToast,
}) {
  const { websites, setWebsites, platforms, setPlatforms, adWaterfall, setAdWaterfall } = useApp();

  const [siteName, setSiteName] = useState('');
  const [siteDomain, setSiteDomain] = useState('');
  const [shieldMode, setShieldMode] = useState('clean_mainstream');

  const [platName, setPlatName] = useState('');
  const [platDomain, setPlatDomain] = useState('');
  const [platCategory, setPlatCategory] = useState('video');
  const [platColor, setPlatColor] = useState('#2563EB');
  const [customSvg, setCustomSvg] = useState(
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#FFFFFF" stroke-width="2"><polygon points="6 4 20 12 6 20 6 4"/></svg>'
  );

  const [cookiePlatform, setCookiePlatform] = useState('youtube');
  const [cookieLabel, setCookieLabel] = useState('');
  const [rawCookieTxt, setRawCookieTxt] = useState('');

  const handleAddWebsite = async (e) => {
    e.preventDefault();
    if (!siteName.trim() || !siteDomain.trim()) return;
    try {
      const updated = await UltraApi.addWebsite({
        name: siteName.trim(),
        domain: siteDomain.trim(),
        shieldMode,
      });
      setWebsites(updated);
      setSiteName('');
      setSiteDomain('');
      showToast('Website project registered in SQL.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not add website.', 'error');
    }
  };

  const handleAddPlatform = async (e) => {
    e.preventDefault();
    if (!platName.trim() || !platDomain.trim()) return;
    try {
      const updated = await UltraApi.saveCustomPlatform({
        displayName: platName.trim(),
        domainPattern: platDomain.trim(),
        category: platCategory,
        brandColor: platColor,
        customSvg,
      });
      setPlatforms(updated);
      setPlatName('');
      setPlatDomain('');
      showToast(`Custom SVG platform "${platName}" published to SQL & live on Home page.`, 'success');
    } catch (err) {
      showToast(err.message || 'Could not save platform.', 'error');
    }
  };

  const handleSaveWaterfall = async (nextCfg) => {
    try {
      const saved = await UltraApi.saveAdWaterfall(nextCfg);
      setAdWaterfall(saved);
      showToast('4-Stage Ad Waterfall settings saved to SQL.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save Ad Waterfall.', 'error');
    }
  };

  const handleAddCookie = async (e) => {
    e.preventDefault();
    if (!cookieLabel.trim() || !rawCookieTxt.trim()) return;
    try {
      const updated = await UltraApi.addCookieProfile({
        platformId: cookiePlatform,
        label: cookieLabel.trim(),
        rawCookieTxt: rawCookieTxt.trim(),
      });
      onUpdateCookies(updated);
      setCookieLabel('');
      setRawCookieTxt('');
      showToast('Cookies encrypted with AES-256-GCM in SQL Vault.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save cookie profile.', 'error');
    }
  };

  const handleDeleteCookie = async (id) => {
    try {
      const updated = await UltraApi.deleteCookieProfile(id);
      onUpdateCookies(updated);
      showToast('Encrypted cookie profile purged from SQL.', 'info');
    } catch (err) {
      showToast(err.message || 'Delete failed.', 'error');
    }
  };

  if (subTab === 'platforms') {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-sky-400" />
            <h3 className="text-sm font-extrabold text-white">
              Add Custom SVG Extractor Platform (Saved in SQL & Live Immediately)
            </h3>
          </div>

          <form onSubmit={handleAddPlatform} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                required
                placeholder="Platform Name (e.g. PeerTube)"
                value={platName}
                onChange={(e) => setPlatName(e.target.value)}
                className="rounded-xl bg-[#080C15] border border-slate-800 px-3.5 py-2 text-xs text-white"
              />
              <input
                required
                placeholder="Domain match (e.g. peertube.tv)"
                value={platDomain}
                onChange={(e) => setPlatDomain(e.target.value)}
                className="rounded-xl bg-[#080C15] border border-slate-800 px-3.5 py-2 text-xs text-white"
              />
              <select
                value={platCategory}
                onChange={(e) => setPlatCategory(e.target.value)}
                className="rounded-xl bg-[#080C15] border border-slate-800 px-3.5 py-2 text-xs text-white"
              >
                <option value="social">Social Media</option>
                <option value="video">Streaming & Movies</option>
                <option value="cloud_terabox">TeraBox & Cloud</option>
              </select>
              <input
                type="color"
                value={platColor}
                onChange={(e) => setPlatColor(e.target.value)}
                className="h-9 w-full rounded-xl bg-[#080C15] border border-slate-800 p-1"
              />
            </div>

            <textarea
              rows={3}
              value={customSvg}
              onChange={(e) => setCustomSvg(e.target.value)}
              placeholder="Paste clean <svg>...</svg> icon markup"
              className="w-full rounded-xl bg-[#080C15] border border-slate-800 p-3 text-xs font-mono text-white"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <span>Live Preview:</span>
                <span className="h-10 w-10 rounded-xl bg-[#080C15] border border-slate-800 grid place-items-center">
                  <PlatformIcon
                    platform={{ displayName: platName || 'New', accentColor: platColor, iconSvg: customSvg }}
                    size={22}
                  />
                </span>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D6FF2] hover:bg-blue-500 px-4 py-2 text-xs font-extrabold text-white"
              >
                <Plus size={14} /> Publish SVG Platform
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <h3 className="text-sm font-extrabold text-white mb-3">
            Active SQL Extractor Directory ({platforms.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {platforms.map((p) => (
              <div
                key={p.id}
                className="rounded-xl bg-[#080C15] border border-slate-800 p-3 flex items-center gap-2.5"
              >
                <PlatformIcon platform={p} size={22} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{p.displayName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{p.category}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (subTab === 'ads') {
    const directZone = adWaterfall.download_click_direct_tab || {};
    const bannerZone = adWaterfall.native_banner || {};
    const prerollZone = adWaterfall.player_preroll_vast || {};
    const sponsorZone = adWaterfall.progress_modal_sponsor || {};

    return (
      <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Sliders size={18} className="text-emerald-400" />
          <div>
            <h3 className="text-sm font-extrabold text-white">
              4-Stage Smart Ad Waterfall & Cooldown Controller (SQL Persisted)
            </h3>
            <p className="text-xs text-slate-400">
              All zones disabled cleanly by default — enter your real ad URLs and toggle ON anytime.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-[#080C15] border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">
              Zone 3: Download Click Smart Direct-Link Tab (1x Cooldown)
            </span>
            <input
              type="checkbox"
              checked={Boolean(directZone.enabled)}
              onChange={(e) =>
                handleSaveWaterfall({
                  ...adWaterfall,
                  download_click_direct_tab: { ...directZone, enabled: e.target.checked },
                })
              }
            />
          </div>

          <input
            type="url"
            placeholder="Your Real Ad Network Direct Link URL (https://...)"
            value={directZone.directUrl || ''}
            onChange={(e) =>
              setAdWaterfall({
                ...adWaterfall,
                download_click_direct_tab: { ...directZone, directUrl: e.target.value },
              })
            }
            className="w-full rounded-xl bg-[#0D1320] border border-slate-800 px-3.5 py-2 text-xs text-white"
          />

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-slate-300">
              Cooldown: <strong className="text-emerald-400">{directZone.cooldownMinutes || 20} mins</strong>
            </span>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={directZone.cooldownMinutes || 20}
              onChange={(e) =>
                setAdWaterfall({
                  ...adWaterfall,
                  download_click_direct_tab: {
                    ...directZone,
                    cooldownMinutes: Number(e.target.value),
                  },
                })
              }
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => handleSaveWaterfall(adWaterfall)}
              className="rounded-xl bg-[#1D6FF2] px-4 py-1.5 text-xs font-bold text-white"
            >
              Save Zone 3
            </button>
          </div>
        </div>

        {[
          { key: 'native_banner', label: 'Zone 1: Below-Hero Native Sponsor Banner', data: bannerZone },
          { key: 'player_preroll_vast', label: 'Zone 2: 5-Second Skippable Player Pre-Roll', data: prerollZone },
          { key: 'progress_modal_sponsor', label: 'Zone 4: Download Queue Sponsor Card', data: sponsorZone },
        ].map((z) => (
          <div key={z.key} className="rounded-xl bg-[#080C15] border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">{z.label}</span>
              <input
                type="checkbox"
                checked={Boolean(z.data.enabled)}
                onChange={(e) =>
                  handleSaveWaterfall({
                    ...adWaterfall,
                    [z.key]: { ...z.data, enabled: e.target.checked },
                  })
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Sponsor Title / Headline"
                value={z.data.title || z.data.headline || ''}
                onChange={(e) =>
                  setAdWaterfall({
                    ...adWaterfall,
                    [z.key]: { ...z.data, title: e.target.value, headline: e.target.value },
                  })
                }
                className="rounded-xl bg-[#0D1320] border border-slate-800 px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Subtitle / Description"
                value={z.data.subtitle || ''}
                onChange={(e) =>
                  setAdWaterfall({
                    ...adWaterfall,
                    [z.key]: { ...z.data, subtitle: e.target.value },
                  })
                }
                className="rounded-xl bg-[#0D1320] border border-slate-800 px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                onClick={() => handleSaveWaterfall(adWaterfall)}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-white"
              >
                Save Zone
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (subTab === 'cookies') {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-amber-300" />
            <div>
              <h3 className="text-sm font-extrabold text-white">
                Encrypted Access Cookie Vault (AES-256-GCM)
              </h3>
              <p className="text-xs text-slate-400">
                Encrypted in SQL at rest; automatically decrypted to temporary ephemeral RAM-file during live extraction.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddCookie} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={cookiePlatform}
                onChange={(e) => setCookiePlatform(e.target.value)}
                className="rounded-xl bg-[#080C15] border border-slate-800 px-3.5 py-2 text-xs text-white"
              >
                <option value="youtube">YouTube Age-Gated / Members</option>
                <option value="instagram">Instagram Session</option>
                <option value="vimeo">Vimeo Private Account</option>
                <option value="terabox">TeraBox Cloud Session</option>
                <option value="tiktok">TikTok Authenticated Session</option>
              </select>
              <input
                required
                placeholder="Profile Label (e.g. Main YouTube Session)"
                value={cookieLabel}
                onChange={(e) => setCookieLabel(e.target.value)}
                className="rounded-xl bg-[#080C15] border border-slate-800 px-3.5 py-2 text-xs text-white"
              />
            </div>

            <textarea
              required
              rows={4}
              value={rawCookieTxt}
              onChange={(e) => setRawCookieTxt(e.target.value)}
              placeholder="# Netscape HTTP Cookie File..."
              className="w-full rounded-xl bg-[#080C15] border border-slate-800 p-3 text-xs font-mono text-white"
            />

            <button
              type="submit"
              className="rounded-xl bg-[#1D6FF2] hover:bg-blue-500 px-4 py-2 text-xs font-extrabold text-white"
            >
              Encrypt & Store in AES-256 Vault
            </button>
          </form>
        </div>

        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <h3 className="text-sm font-extrabold text-white mb-3">
            Stored Encrypted Session Profiles ({cookieProfiles.length})
          </h3>
          {cookieProfiles.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              0 cookie profiles stored (`0` fake entries). Upload Netscape cookies.txt above when needed.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3">Platform</th>
                  <th className="py-2 px-3">Label</th>
                  <th className="py-2 px-3">Masked Preview</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 pl-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {cookieProfiles.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-3 font-bold text-white">{c.platformId}</td>
                    <td className="py-2.5 px-3 text-slate-300">{c.label}</td>
                    <td className="py-2.5 px-3 font-mono text-sky-400">{c.maskedPreview}</td>
                    <td className="py-2.5 px-3">
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3">
                      <button
                        type="button"
                        onClick={() => handleDeleteCookie(c.id)}
                        className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  if (subTab === 'security') {
    return (
      <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-400" />
          <h3 className="text-sm font-extrabold text-white">
            Live SQL Security Audit Log & Decoy Honeypot Feed ({auditLogs.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-3">Timestamp</th>
                <th className="py-2 px-3">Event Type</th>
                <th className="py-2 px-3">Client IP</th>
                <th className="py-2 pl-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 pr-3 text-slate-400">{log.createdAt}</td>
                  <td className="py-2 px-3">
                    <span className="rounded-full bg-blue-600/20 px-2.5 py-0.5 text-[10px] font-bold text-sky-300">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-200">{log.ip}</td>
                  <td className="py-2 pl-3 text-slate-300">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-sky-400" />
          <h3 className="text-sm font-extrabold text-white">
            Multi-Website Portfolio & Brand-Safety Content Shield (SQL)
          </h3>
        </div>
        <form onSubmit={handleAddWebsite} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            required
            placeholder="Project Name (e.g. EduClips Hub)"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            className="rounded-xl bg-[#080C15] border border-slate-800 px-3.5 py-2 text-xs text-white"
          />
          <input
            required
            placeholder="Domain (e.g. educlips.io)"
            value={siteDomain}
            onChange={(e) => setSiteDomain(e.target.value)}
            className="rounded-xl bg-[#080C15] border border-slate-800 px-3.5 py-2 text-xs text-white"
          />
          <select
            value={shieldMode}
            onChange={(e) => setShieldMode(e.target.value)}
            className="rounded-xl bg-[#080C15] border border-slate-800 px-3.5 py-2 text-xs text-white"
          >
            <option value="clean_mainstream">Clean Mainstream Mode</option>
            <option value="hybrid_all">All Supported Categories</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1D6FF2] hover:bg-blue-500 px-4 py-2 text-xs font-extrabold text-white"
          >
            <Plus size={14} /> Add Domain
          </button>
        </form>
      </div>

      <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2 pr-3">Website Project</th>
              <th className="py-2 px-3">Domain</th>
              <th className="py-2 px-3">Content Shield</th>
              <th className="py-2 pl-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {websites.map((w) => (
              <tr key={w.id}>
                <td className="py-2.5 pr-3 font-bold text-white">{w.name}</td>
                <td className="py-2.5 px-3 font-mono text-sky-400">{w.domain}</td>
                <td className="py-2.5 px-3">
                  <span className="rounded-full bg-blue-600/20 px-2.5 py-0.5 text-[10px] font-bold text-sky-300">
                    {w.shieldMode || w.contentMode}
                  </span>
                </td>
                <td className="py-2.5 pl-3">
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    {w.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
