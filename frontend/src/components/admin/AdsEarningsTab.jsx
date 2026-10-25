import React, { useCallback, useEffect, useState } from 'react';
import {
  Radio,
  Plus,
  Trash2,
  Save,
  DollarSign,
  Eye,
  MousePointerClick,
  Users,
  TrendingUp,
  CheckCircle2,
  Circle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { UltraApi } from '../../services/apiClient';

// ============================================================================
// ADS & EARNINGS — real slots, real impressions, real click ledger.
// "Can I earn yet?" shows exactly which threshold is still missing.
// ============================================================================
const PLACEMENTS = ['header', 'belowPlayer', 'sidebar', 'inline', 'footer'];
const TYPES = [
  { id: 'house', label: 'House banner (own design)' },
  { id: 'adsense', label: 'Google AdSense' },
  { id: 'custom', label: 'Custom HTML' },
];

const emptySlot = {
  slotKey: '',
  name: '',
  placement: 'inline',
  adType: 'house',
  headline: '',
  body: '',
  ctaText: 'Open',
  targetUrl: '/',
  imageUrl: '',
  adsenseClient: '',
  adsenseSlot: '',
  isActive: true,
  weight: 10,
};

export function AdsEarningsTab({ showToast }) {
  const [slots, setSlots] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptySlot);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [slotRes, analyticsRes] = await Promise.all([
        UltraApi.adminListAdSlots(),
        UltraApi.adminAdsAnalytics(),
      ]);
      setSlots(slotRes?.slots || []);
      setAnalytics(analyticsRes || null);
    } catch (err) {
      showToast?.(err?.message || 'Could not load ads data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const createSlot = async () => {
    if (!draft.slotKey.trim() || !draft.name.trim()) {
      showToast?.('Slot key and name are required.', 'error');
      return;
    }
    try {
      await UltraApi.adminCreateAdSlot(draft);
      setDraft(emptySlot);
      showToast?.('Ad slot created.', 'success');
      load();
    } catch (err) {
      showToast?.(err?.message || 'Could not create slot.', 'error');
    }
  };

  const patchSlot = async (slot, patch) => {
    setSavingId(slot.id);
    try {
      await UltraApi.adminUpdateAdSlot(slot.id, patch);
      await load();
    } catch (err) {
      showToast?.(err?.message || 'Update failed.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const removeSlot = async (slot) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete ad slot “${slot.name}”?`)) return;
    try {
      await UltraApi.adminDeleteAdSlot(slot.id);
      showToast?.('Slot deleted.', 'success');
      load();
    } catch (err) {
      showToast?.(err?.message || 'Delete failed.', 'error');
    }
  };

  const totals = analytics?.totals || {};

  const statCards = [
    { label: 'Estimated revenue', value: `$${Number(totals.revenueUsd || 0).toFixed(4)}`, icon: DollarSign, tint: 'text-emerald-400' },
    { label: 'Impressions', value: totals.impressions || 0, icon: Eye, tint: 'text-sky-400' },
    { label: 'Clicks', value: totals.clicks || 0, icon: MousePointerClick, tint: 'text-violet-400' },
    { label: 'Unique visitors', value: totals.uniqueVisitors || 0, icon: Users, tint: 'text-amber-400' },
    { label: 'CTR', value: `${totals.ctr || 0}%`, icon: TrendingUp, tint: 'text-pink-400' },
    { label: 'Projected / month', value: `$${Number(totals.projectedMonthlyUsd || 0).toFixed(2)}`, icon: Radio, tint: 'text-cyan-400' },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Radio size={18} className="text-emerald-400" /> Ads &amp; Earnings
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real impressions and clicks are recorded from the public site. Nothing is simulated.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B1220] border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-600"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl bg-[#0B1220] border border-slate-800 p-3.5">
            <card.icon size={15} className={card.tint} />
            <p className="mt-2 text-[11px] text-slate-400">{card.label}</p>
            <p className="text-base font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Earn readiness */}
      <div className="rounded-xl bg-[#0B1220] border border-slate-800 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white">Can this site earn yet?</h3>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              analytics?.canEarnNow
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
            }`}
          >
            {analytics?.canEarnNow ? 'YES — thresholds reached' : 'NOT YET'}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
          {(analytics?.readiness || []).map((rule) => (
            <div
              key={rule.key}
              className="flex items-start gap-2 rounded-lg border border-slate-800 bg-[#070C15] px-2.5 py-2"
            >
              {rule.pass ? (
                <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <Circle size={14} className="text-slate-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-200 leading-tight">{rule.label}</p>
                <p className="text-[10px] text-slate-500">{rule.value}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Traffic counts only when real visitors load the site from new IPs — the visitor ledger hashes every IP,
          so a new IP = a new visitor. Register users from the public site to grow the signed-users number.
        </p>
      </div>

      {/* Existing slots */}
      <div className="rounded-xl bg-[#0B1220] border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Ad slots ({slots.length})</h3>
          <span className="text-[11px] text-slate-500">Toggle a slot to publish it instantly</span>
        </div>
        <div className="divide-y divide-slate-800">
          {slots.map((slot) => (
            <div key={slot.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => patchSlot(slot, { isActive: !slot.isActive })}
                disabled={savingId === slot.id}
                className={`h-6 w-11 rounded-full transition-colors relative shrink-0 ${
                  slot.isActive ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
                aria-label={`Toggle ${slot.name}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    slot.isActive ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{slot.name}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {slot.placement} · {slot.adType} · {slot.slotKey}
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span>👁 {slot.impressions ?? 0}</span>
                <span>🖱 {slot.clicks ?? 0}</span>
                <span className="text-emerald-400">${Number(slot.revenueUsd || 0).toFixed(4)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeSlot(slot)}
                className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-500/20"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {!slots.length && !loading && (
            <p className="px-4 py-6 text-center text-xs text-slate-500">No ad slots yet — create one below.</p>
          )}
        </div>
      </div>

      {/* Create slot */}
      <div className="rounded-xl bg-[#0B1220] border border-slate-800 p-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Plus size={15} className="text-emerald-400" /> New ad slot
        </h3>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <Field label="Slot key">
            <input
              value={draft.slotKey}
              onChange={(e) => setDraft({ ...draft, slotKey: e.target.value })}
              placeholder="home_sidebar_1"
              className="admin-input"
            />
          </Field>
          <Field label="Name">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Homepage sidebar"
              className="admin-input"
            />
          </Field>
          <Field label="Placement">
            <select
              value={draft.placement}
              onChange={(e) => setDraft({ ...draft, placement: e.target.value })}
              className="admin-input"
            >
              {PLACEMENTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select
              value={draft.adType}
              onChange={(e) => setDraft({ ...draft, adType: e.target.value })}
              className="admin-input"
            >
              {TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Headline">
            <input
              value={draft.headline}
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
              placeholder="Download any video free"
              className="admin-input"
            />
          </Field>
          <Field label="Body / custom HTML">
            <input
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="No software needed."
              className="admin-input"
            />
          </Field>
          <Field label="Button text">
            <input
              value={draft.ctaText}
              onChange={(e) => setDraft({ ...draft, ctaText: e.target.value })}
              className="admin-input"
            />
          </Field>
          <Field label="Target URL">
            <input
              value={draft.targetUrl}
              onChange={(e) => setDraft({ ...draft, targetUrl: e.target.value })}
              className="admin-input"
            />
          </Field>
          <Field label="Image URL (optional)">
            <input
              value={draft.imageUrl}
              onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
              className="admin-input"
            />
          </Field>
          <Field label="AdSense client (ca-pub-…)">
            <input
              value={draft.adsenseClient}
              onChange={(e) => setDraft({ ...draft, adsenseClient: e.target.value })}
              placeholder="ca-pub-0000000000000000"
              className="admin-input"
            />
          </Field>
          <Field label="AdSense slot id">
            <input
              value={draft.adsenseSlot}
              onChange={(e) => setDraft({ ...draft, adsenseSlot: e.target.value })}
              placeholder="1234567890"
              className="admin-input"
            />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              onClick={createSlot}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-sm font-bold text-slate-950"
            >
              <Save size={14} /> Create slot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export default AdsEarningsTab;
