import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Globe,
  Receipt,
  HardDrive,
  Layers,
  Sliders,
  KeyRound,
  ShieldCheck,
  LogOut,
  ExternalLink,
  RefreshCw,
  Menu,
  X,
  Radio,
  Search,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UltraApi } from '../services/apiClient';
import { PadlockAuthScreen } from '../components/admin/PadlockAuthScreen';
import { LiveNotificationDrawer } from '../components/admin/LiveNotificationDrawer';
import { ProfitDashboardTab } from '../components/admin/ProfitDashboardTab';
import { AdsEarningsTab } from '../components/admin/AdsEarningsTab';
import { SeoManagerTab } from '../components/admin/SeoManagerTab';
import { FinanceLedgerTab } from '../components/admin/FinanceLedgerTab';
import { SavedVaultTab } from '../components/admin/SavedVaultTab';
import { OperationsTab } from '../components/admin/OperationsTab';
import { CenterTheaterModal } from '../components/player/CenterTheaterModal';

const ADMIN_NAV = [
  { id: 'profit', label: 'Dashboard', hint: 'Revenue & traffic', icon: TrendingUp },
  { id: 'seo', label: 'SEO Manager', hint: 'Keywords & meta', icon: Globe },
  { id: 'finance', label: 'Ledger', hint: 'Income & costs', icon: Receipt },
  { id: 'vault', label: 'Video Vault', hint: 'Saved media', icon: HardDrive },
  { id: 'websites', label: 'Websites', hint: 'Multi-project', icon: Layers },
  { id: 'platforms', label: 'Platforms', hint: 'platform adapters', icon: Sliders },
  { id: 'ads', label: 'Ads & Earnings', hint: 'Slots, traffic, revenue', icon: Radio },
  { id: 'cookies', label: 'Cookies', hint: 'Site access', icon: KeyRound },
  { id: 'security', label: 'Security', hint: 'Audit & ban list', icon: ShieldCheck },
];

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.22, ease: 'easeOut' },
};

export function SecretAdminPortal() {
  const { showToast, user } = useApp();
  const [adminUser, setAdminUser] = useState(null);
  const [activeTab, setActiveTab] = useState('profit');
  const [navOpen, setNavOpen] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);
  const [query, setQuery] = useState('');

  const [liveCards, setLiveCards] = useState([]);
  const [vaultVideos, setVaultVideos] = useState([]);
  const [overview, setOverview] = useState(null);
  const [trafficFunnel, setTrafficFunnel] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [seoKeywords, setSeoKeywords] = useState([]);
  const [financeEntries, setFinanceEntries] = useState([]);
  const [cookieProfiles, setCookieProfiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [centerPreviewCard, setCenterPreviewCard] = useState(null);
  const [previewFromVault, setPreviewFromVault] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadAllAdminData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [cards, vault, ov, funnel, recs, seo, fin, cookies, logs] = await Promise.all([
        UltraApi.getLiveCards(),
        UltraApi.getVaultVideos(),
        UltraApi.getAnalyticsOverview(),
        UltraApi.getTrafficFunnel(),
        UltraApi.getAiRecommendations(),
        UltraApi.getSeoKeywords(),
        UltraApi.getFinanceLedger(),
        UltraApi.getCookieProfiles(),
        UltraApi.getAuditLogs(),
      ]);
      setLiveCards(cards);
      setVaultVideos(vault);
      setOverview(ov);
      setTrafficFunnel(funnel);
      setRecommendations(recs);
      setSeoKeywords(seo);
      setFinanceEntries(fin);
      setCookieProfiles(cookies);
      setAuditLogs(logs);
    } catch {
      setAdminUser(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // A stale sessionStorage flag must never "unlock" the console: the server is
  // the only authority on whether this tab still has a valid admin session.
  useEffect(() => {
    let alive = true;
    (async () => {
      const token = sessionStorage.getItem('ud_admin_access_token');
      if (!token) return;
      const session = await UltraApi.getAdminSession();
      if (!alive) return;
      if (session?.authenticated && session.admin) {
        setAdminUser(session.admin);
      } else {
        sessionStorage.removeItem('ud_admin_access_token');
        sessionStorage.removeItem('ud_padlock_ticket');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!adminUser) return undefined;
    loadAllAdminData();

    const unsubscribe = UltraApi.subscribeAdminLiveCards((eventName, payload) => {
      if (eventName === 'snapshot' && Array.isArray(payload)) {
        setLiveCards(payload);
      } else if (eventName === 'card_added' || eventName === 'card_updated') {
        setLiveCards((prev) => {
          const exists = prev.some((c) => c.cardId === payload.cardId);
          return exists
            ? prev.map((c) => (c.cardId === payload.cardId ? payload : c))
            : [payload, ...prev];
        });
      } else if (eventName === 'card_removed') {
        setLiveCards((prev) => prev.filter((c) => c.cardId !== payload.cardId));
      }
    });

    return () => unsubscribe();
  }, [adminUser, loadAllAdminData]);

  useEffect(() => {
    if (adminUser) loadAllAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleViewLiveCard = async (card) => {
    const viewPayload = await UltraApi.viewLiveCardStream(card.cardId);
    setPreviewFromVault(false);
    setCenterPreviewCard({
      ...viewPayload,
      streamUrl: viewPayload.previewPlayer?.streamUrl || viewPayload.streamUrl,
    });
  };

  const handleSaveLiveCard = async (card) => {
    try {
      const savedItem = await UltraApi.saveCardToVault(card.cardId);
      setVaultVideos((prev) => [savedItem, ...prev.filter((v) => v.id !== savedItem.id)]);
      setLiveCards((prev) => prev.filter((c) => c.cardId !== card.cardId));
      await loadAllAdminData();
      showToast(`Saved "${savedItem.title}" to the permanent vault.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCloseLiveCard = async (card) => {
    await UltraApi.closeLiveCard(card.cardId);
    setLiveCards((prev) => prev.filter((c) => c.cardId !== card.cardId));
    showToast('Card removed from live memory.', 'info');
  };

  const handleClearAllLiveCards = async () => {
    await UltraApi.clearAllLiveCards();
    setLiveCards([]);
    showToast('Cleared all live cards.', 'info');
  };

  const handleDeleteVaultVideo = async (vaultId) => {
    const remaining = await UltraApi.deleteVaultVideo(vaultId);
    setVaultVideos(remaining);
    await loadAllAdminData();
    showToast('Deleted video file & record permanently.', 'info');
  };

  const handleAdminLogout = async () => {
    await UltraApi.logoutAdmin();
    setAdminUser(null);
  };

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ADMIN_NAV;
    return ADMIN_NAV.filter(
      (item) => item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q)
    );
  }, [query]);

  const activeMeta = ADMIN_NAV.find((n) => n.id === activeTab) || ADMIN_NAV[0];

  const kpis = [
    { label: 'Live Now', value: liveCards.length, tone: 'emerald' },
    { label: 'Vault Items', value: vaultVideos.length, tone: 'sky' },
    { label: 'SEO Keywords', value: seoKeywords.length, tone: 'indigo' },
    { label: 'Ledger Entries', value: financeEntries.length, tone: 'amber' },
  ];

  if (!adminUser) {
    return (
      <PadlockAuthScreen
        onAuthenticated={(admin) => {
          setAdminUser(admin);
          showToast('Admin suite unlocked.', 'success');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#080512] text-slate-200 flex flex-col">
      {/* ================= TOP COMMAND BAR ================= */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#080512]/95 backdrop-blur">
        <div className="w-full px-4 sm:px-6 flex items-center justify-between gap-3 h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              className="lg:hidden h-9 w-9 rounded-lg border border-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-800/60"
              aria-label="Toggle navigation"
            >
              {navOpen ? <X size={17} /> : <Menu size={17} />}
            </button>

            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <span className="relative h-9 w-9 rounded-xl overflow-hidden ring-1 ring-violet-400/40 shrink-0">
                <img
                  src="/brand/cube-tunnel-256.png"
                  alt="ShakeelAdminProDownloader"
                  className="h-9 w-9 object-cover"
                />
              </span>
              <span className="hidden sm:block leading-tight">
                <span className="block text-sm font-extrabold text-white tracking-tight">
                  ShakeelAdminProDownloader
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-400">
                  Pro Security · Command Center
                </span>
              </span>
            </Link>

            <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
              <ChevronRight size={13} />
              <span className="text-slate-300 font-semibold">{activeMeta.label}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5">
              <Search size={13} className="text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to section..."
                className="w-40 bg-transparent text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
              />
            </div>

            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>

            <button
              type="button"
              onClick={() => setStreamOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200"
            >
              <Radio size={13} className="text-fuchsia-400" />
              <span className="hidden sm:inline">Live Feed</span>
              <span className="rounded bg-fuchsia-500/15 px-1.5 text-[10px] font-extrabold text-fuchsia-300">
                {liveCards.length}
              </span>
            </button>

            <button
              type="button"
              onClick={loadAllAdminData}
              className="h-9 w-9 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center"
              aria-label="Refresh data"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <Link
              to="/"
              className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 px-3 text-xs font-bold text-fuchsia-300"
            >
              <ExternalLink size={13} />
              <span>Public Site</span>
            </Link>

            <button
              type="button"
              onClick={handleAdminLogout}
              className="h-9 w-9 rounded-lg border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 flex items-center justify-center"
              aria-label="Lock admin suite"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full flex min-h-0">
        {/* ================= LEFT NAVIGATION RAIL ================= */}
        <motion.aside
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className={`${
                navOpen ? 'flex' : 'hidden lg:flex'
          } fixed lg:static inset-y-16 left-0 z-30 w-64 shrink-0 flex-col border-r border-slate-800/80 bg-[#0B0718] p-3 gap-1 overflow-y-auto`}
        >
              <p className="px-3 pt-2 pb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-600">
                Workspace
              </p>

              {filteredNav.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setNavOpen(false);
                    }}
                    className={`relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      active ? 'text-white' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="adminNavActive"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-xl bg-fuchsia-500/12 border border-fuchsia-500/35"
                      />
                    )}
                    <Icon size={16} className={`relative z-10 ${active ? 'text-fuchsia-400' : ''}`} />
                    <span className="relative z-10 min-w-0">
                      <span className="block text-xs font-bold truncate">{item.label}</span>
                      <span className="block text-[10px] text-slate-500 truncate">{item.hint}</span>
                    </span>
                    {item.id === 'vault' && vaultVideos.length > 0 && (
                      <span className="relative z-10 ml-auto rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-300">
                        {vaultVideos.length}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="mt-auto rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Signed in
                </p>
                <p className="mt-1 text-xs font-bold text-slate-200 truncate">
                  {adminUser.email || 'Super Admin'}
                </p>
                <p className="text-[10px] text-slate-500">Super Admin · Full access</p>
              </div>
        </motion.aside>

        {/* ================= MAIN WORKSPACE ================= */}
        <main className="flex-1 min-w-0 w-full overflow-y-auto">
          <div className="w-full px-4 sm:px-6 py-5 space-y-5">
            {/* Page header + KPI strip */}
            <motion.div {...fadeUp} className="w-full">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    {activeMeta.label}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeMeta.hint} · all figures stream live from your own server
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-400">
                  <ShieldCheck size={13} className="text-emerald-400" />
                  Secure session · auto-lock enabled
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {kpis.map((kpi, index) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * index, duration: 0.24 }}
                    className="rounded-xl border border-slate-800 bg-[#0D0820] px-4 py-3"
                  >
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      {kpi.label}
                    </p>
                    <p className="mt-1 text-xl font-extrabold text-white tabular-nums">
                      {kpi.value}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Animated tab content */}
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} {...fadeUp} className="w-full">
                {activeTab === 'profit' && (
                  <ProfitDashboardTab
                    overview={overview}
                    recommendations={recommendations}
                    trafficFunnel={trafficFunnel}
                  />
                )}

                {activeTab === 'seo' && (
                  <SeoManagerTab
                    keywords={seoKeywords}
                    onUpdateKeywords={(next) => {
                      setSeoKeywords(next);
                      loadAllAdminData();
                    }}
                    showToast={showToast}
                  />
                )}

                {activeTab === 'finance' && (
                  <FinanceLedgerTab
                    entries={financeEntries}
                    onUpdateEntries={async (next) => {
                      setFinanceEntries(next);
                      await loadAllAdminData();
                    }}
                    showToast={showToast}
                  />
                )}

                {activeTab === 'vault' && (
                  <SavedVaultTab
                    items={vaultVideos}
                    onPlayVaultItem={(vid) => {
                      setPreviewFromVault(true);
                      setCenterPreviewCard({
                        ...vid,
                        rawUrl: vid.rawUrl || vid.sourceUrl,
                      });
                    }}
                    onDeleteVaultItem={handleDeleteVaultVideo}
                    showToast={showToast}
                    user={user}
                  />
                )}

                {activeTab === 'ads' && <AdsEarningsTab showToast={showToast} />}

                {['websites', 'platforms', 'cookies', 'security'].includes(activeTab) && (
                  <OperationsTab
                    subTab={activeTab}
                    auditLogs={auditLogs}
                    cookieProfiles={cookieProfiles}
                    onUpdateCookies={(next) => {
                      setCookieProfiles(next);
                      loadAllAdminData();
                    }}
                    showToast={showToast}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* ================= RIGHT LIVE FEED ================= */}
        <div className={`${streamOpen ? 'block' : 'hidden xl:block'} w-full xl:w-80 shrink-0`}>
          <LiveNotificationDrawer
            liveCards={liveCards}
            onViewCard={handleViewLiveCard}
            onSaveCard={handleSaveLiveCard}
            onCloseCard={handleCloseLiveCard}
            onClearAll={handleClearAllLiveCards}
            onRefreshCards={loadAllAdminData}
            showToast={showToast}
          />
        </div>
      </div>

      {centerPreviewCard && (
        <CenterTheaterModal
          item={centerPreviewCard}
          isFromSavedVault={previewFromVault}
          onCloseModal={() => setCenterPreviewCard(null)}
          onSaveCard={handleSaveLiveCard}
          onDiscardCard={handleCloseLiveCard}
        />
      )}
    </div>
  );
}
