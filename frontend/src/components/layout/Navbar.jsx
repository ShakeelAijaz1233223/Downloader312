import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Settings,
  Download,
  UserCheck,
  LogIn,
  Globe,
  Gauge,
  X,
  Menu,
  Sliders,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UltraApi } from '../../services/apiClient';
import { DownloadQueueDrawer } from '../downloader/DownloadQueueDrawer';

export function SpeedLimiterModal({ open, onClose }) {
  const { enginePrefs, saveEnginePrefs } = useApp();
  const [limitEnabled, setLimitEnabled] = useState(Boolean(enginePrefs.speedLimiterEnabled));
  const [kbValue, setKbValue] = useState(Number(enginePrefs.maxSpeedKBps || 500));
  const [alwaysStartup, setAlwaysStartup] = useState(Boolean(enginePrefs.alwaysLimitOnStartup));

  useEffect(() => {
    if (open) {
      setLimitEnabled(Boolean(enginePrefs.speedLimiterEnabled));
      setKbValue(Number(enginePrefs.maxSpeedKBps || 500));
      setAlwaysStartup(Boolean(enginePrefs.alwaysLimitOnStartup));
    }
  }, [open, enginePrefs]);

  if (!open) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    await saveEnginePrefs({
      speedLimiterEnabled: limitEnabled,
      maxSpeedKBps: Math.max(10, Number(kbValue) || 500),
      alwaysLimitOnStartup: alwaysStartup,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Speed Limiter Settings"
      className="fixed inset-0 z-[105] bg-slate-900/40 flex items-center justify-center p-4"
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onSubmit={handleSave}
        className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge size={18} className="text-blue-600" />
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              Download Speed Settings
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-lg hover:bg-slate-200/70 flex items-center justify-center text-slate-500"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Choice 1: Full Unthrottled PC Speed (200 MB/s+) */}
          <label
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
              !limitEnabled
                ? 'border-blue-500 bg-blue-50/60'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              checked={!limitEnabled}
              onChange={() => setLimitEnabled(false)}
              className="mt-1 accent-blue-600"
            />
            <div>
              <p className="text-xs sm:text-sm font-extrabold text-slate-900">
                Unlimited Speed — Use My Full Internet Connection (Recommended)
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                No artificial throttling — downloads run at the maximum speed your connection allows.
              </p>
            </div>
          </label>

          {/* Choice 2: Classic IDM Single-File Speed Limiter (KB/s) */}
          <label
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
              limitEnabled
                ? 'border-amber-400 bg-amber-50/50'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              checked={limitEnabled}
              onChange={() => setLimitEnabled(true)}
              className="mt-1 accent-amber-600"
            />
            <div className="flex-1 space-y-2.5">
              <p className="text-xs sm:text-sm font-extrabold text-slate-900">
                Enable Speed Limiter (Cap Bandwidth Per File)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  Maximum download speed for one file:
                </span>
                <input
                  type="number"
                  min={10}
                  max={2000000}
                  value={kbValue}
                  onChange={(e) => {
                    setLimitEnabled(true);
                    setKbValue(e.target.value);
                  }}
                  className="w-28 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                />
                <span className="text-xs font-bold text-slate-600">
                  KBytes/sec ({(Number(kbValue || 0) / 1024).toFixed(2)} MB/s)
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: '500 KB/s', val: 500 },
                  { label: '2 MB/s', val: 2048 },
                  { label: '10 MB/s', val: 10240 },
                  { label: '50 MB/s', val: 51200 },
                  { label: 'Max', val: 204800 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => {
                      setLimitEnabled(true);
                      setKbValue(preset.val);
                    }}
                    className="rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </label>

          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2 leading-relaxed">
            Note: very low limits can make some servers stop the transfer. Keep{' '}
            <strong className="text-slate-700">Unlimited Speed</strong> for the fastest downloads.
          </p>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alwaysStartup}
              onChange={(e) => setAlwaysStartup(e.target.checked)}
              className="rounded accent-blue-600"
            />
            <span>Always turn on Speed Limiter on startup</span>
          </label>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white hover:bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-xs font-bold text-white shadow-sm"
          >
            OK · Apply Live
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function AuthModal({ open, onClose }) {
  const { setUser, showToast } = useApp();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res =
        mode === 'register'
          ? await UltraApi.registerUser({ email, password, displayName })
          : await UltraApi.loginUser({ email, password });
      setUser(res.user);
      showToast(`Signed in as ${res.user.displayName || res.user.email}`, 'success');
      onClose();
    } catch (err) {
      showToast(err.message || 'Authentication failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[105] bg-slate-900/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-slate-900">
            {mode === 'login' ? 'Sign In to Sync Saved Links' : 'Create Free Account (500/day Quota)'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <input
              type="text"
              required
              placeholder="Full Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
          />
          <input
            type="password"
            required
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-60"
          >
            {busy ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-3 w-full text-center text-xs font-semibold text-blue-600 hover:underline"
        >
          {mode === 'login' ? 'Need an account? Register free →' : 'Already have an account? Sign in →'}
        </button>
      </div>
    </div>
  );
}

export function Navbar() {
  const location = useLocation();
  const {
    lang,
    setLang,
    backendLive,
    platforms,
    downloadQueue,
    favorites,
    user,
    setUser,
    enginePrefs,
    queueDrawerOpen,
    setQueueDrawerOpen,
    speedLimiterModalOpen,
    setSpeedLimiterModalOpen,
  } = useApp();

  const [authOpen, setAuthOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeJobsCount = downloadQueue.filter(
    (j) => j.status === 'downloading' || j.status === 'muxing' || j.status === 'queued'
  ).length;

  const navItems = [
    { to: '/', label: 'Home Studio' },
    { to: '/sites', label: `${platforms.length} Sites` },
    { to: '/downloads', label: `My Downloads (${downloadQueue.length})` },
    { to: '/player', label: 'Online Player' },
    { to: '/albums', label: 'Audio & Search' },
    { to: '/favorites', label: `Saved (${favorites.length})` },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="w-full px-4 sm:px-8 xl:px-12 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0 group">
            <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Zap size={20} strokeWidth={2.5} />
            </span>
            <div className="leading-tight">
              <div className="font-display font-extrabold text-base sm:text-lg text-slate-900 tracking-tight whitespace-nowrap">
                Ultra<span className="text-blue-600">Downloader</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 whitespace-nowrap">
                Free · Fast · HD &amp; 4K Video Saver
              </div>
            </div>
          </Link>

          {/* Center: Full Single-Line White Studio Pill Navigation */}
          <nav
            aria-label="Primary navigation"
            className="hidden xl:flex items-center gap-1 rounded-2xl bg-slate-100/90 border border-slate-200/80 p-1"
          >
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    active ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="whiteStudioActiveNav"
                      transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                      className="absolute inset-0 rounded-xl bg-white shadow-sm border border-slate-200/80 -z-0"
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Live Controls (Pure White Studio Only — Zero Clutter!) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick IDM Drawer Trigger */}
            <button
              type="button"
              onClick={() => setQueueDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 px-3 py-1.5 text-xs font-bold text-slate-800 whitespace-nowrap transition-colors"
            >
              <Download size={14} className="text-blue-600" />
              <span className="hidden sm:inline">Queue</span>
              <span className="rounded-md bg-blue-600 text-white px-1.5 py-0.5 text-[10px] font-extrabold">
                {activeJobsCount > 0 ? `${activeJobsCount} Live` : downloadQueue.length}
              </span>
            </button>

            {/* Quick Speed Limiter Modal Button */}
            <button
              type="button"
              onClick={() => setSpeedLimiterModalOpen(true)}
              title="Open Speed Limiter Settings"
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                enginePrefs.speedLimiterEnabled
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Sliders size={13} className="text-blue-600" />
              <span>{enginePrefs.speedLimiterEnabled ? `${enginePrefs.maxSpeedKBps} KB/s` : 'Speed Limit'}</span>
            </button>

            {/* EN / Urdu Switch */}
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'ur' : 'en')}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 whitespace-nowrap"
            >
              <Globe size={13} className="text-blue-600" />
              <span>{lang === 'en' ? 'EN / اردو' : 'اردو / EN'}</span>
            </button>

            {/* User Sign In / Account */}
            {user ? (
              <button
                type="button"
                title="Click to Sign Out"
                onClick={async () => {
                  await UltraApi.logoutUser().catch(() => {});
                  setUser(null);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 px-3 py-1.5 text-xs font-bold text-emerald-800 whitespace-nowrap transition-colors"
              >
                <UserCheck size={14} />
                <span>{user.fullName || user.displayName || user.email} · Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 whitespace-nowrap"
              >
                <LogIn size={14} />
                <span>Sign In</span>
              </button>
            )}

            {/* Full Settings Button */}
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm whitespace-nowrap transition-colors"
            >
              <Settings size={14} />
              <span>Settings</span>
            </Link>

            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Open navigation menu"
              className="xl:hidden h-9 w-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="xl:hidden border-t border-slate-200 bg-white px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2"
            >
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold ${
                    location.pathname === item.to
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <DownloadQueueDrawer open={queueDrawerOpen} onClose={() => setQueueDrawerOpen(false)} />
      <SpeedLimiterModal
        open={speedLimiterModalOpen}
        onClose={() => setSpeedLimiterModalOpen(false)}
      />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
