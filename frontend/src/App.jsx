import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ToastNotification } from './components/ui/Primitives';
import { HomePage } from './pages/HomePage';
import { ViralSharePage } from './pages/ViralSharePage';
import { SeoToolLandingPage } from './pages/SeoToolLandingPage';
import {
  SupportedSitesPage,
  StandalonePlayerPage,
  AlbumMixSearchPage,
  DownloadsHistoryPage,
  FavoritesPage,
  SettingsPage,
  UserAuthPage,
  LegalPage,
} from './pages/SubPages';
import { HoneypotNotFoundPage } from './pages/HoneypotNotFoundPage';

const SecretAdminPortal = lazy(() =>
  import('./pages/SecretAdminPortal').then((m) => ({ default: m.SecretAdminPortal }))
);

const SECRET_ADMIN_SLUG = String(
  import.meta.env.VITE_ADMIN_SECRET_ROUTE ||
    import.meta.env.VITE_SECRET_ADMIN_SLUG ||
    '/vault-control-x9p4'
)
  .replace(/^\/+|\/+$/g, '')
  .split('/')
  .pop();

// Pro-Security aliases: the same secret console answers on all of them, so the
// owner's old bookmark keeps working while the URL still carries Pro Security.
const ADMIN_ROUTE_PATHS = [
  `/${SECRET_ADMIN_SLUG}`,
  `/pro-security/${SECRET_ADMIN_SLUG}`,
  `/${SECRET_ADMIN_SLUG}/pro-security`,
];

function GlobalStealthShortcutWatcher() {
  const navigate = useNavigate();
  const { toast } = useApp();

  // SECRET KEYBOARD SHORTCUT: Ctrl + Shift + Alt + U opens the Secret Padlock Portal from ANY page!
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.altKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        navigate(`/${SECRET_ADMIN_SLUG}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return <ToastNotification toast={toast} />;
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <GlobalStealthShortcutWatcher />
        <Routes>
          {/* Public Flagship Pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/share-target" element={<HomePage />} />
          <Route path="/v/:shortCode" element={<ViralSharePage />} />
          <Route path="/tools/:slug" element={<SeoToolLandingPage />} />
          <Route path="/sites" element={<SupportedSitesPage />} />
          <Route path="/player" element={<StandalonePlayerPage />} />
          <Route path="/albums" element={<AlbumMixSearchPage />} />
          <Route path="/downloads" element={<DownloadsHistoryPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<UserAuthPage mode="login" />} />
          <Route path="/register" element={<UserAuthPage mode="register" />} />
          <Route path="/legal/:docType" element={<LegalPage />} />

          {/* Stealth Fake-404 Honeypot Traps (Logs Intruder Hit Silently!) */}
          <Route path="/admin" element={<HoneypotNotFoundPage isHoneypot />} />
          <Route path="/admin/*" element={<HoneypotNotFoundPage isHoneypot />} />
          <Route path="/wp-admin" element={<HoneypotNotFoundPage isHoneypot />} />
          <Route path="/dashboard" element={<HoneypotNotFoundPage isHoneypot />} />

          {/* 5-Layer Secret Padlock Executive Command Center (Isolated Stealth Chunk) */}
          {ADMIN_ROUTE_PATHS.map((adminPath) => (
            <Route
              key={adminPath}
              path={adminPath}
              element={
                <Suspense
                  fallback={
                    <div className="min-h-screen bg-[#080512] flex items-center justify-center text-fuchsia-300 font-bold text-sm">
                      Initializing Pro-Security Vault…
                    </div>
                  }
                >
                  <SecretAdminPortal />
                </Suspense>
              }
            />
          ))}

          {/* Catch-all 404 */}
          <Route path="*" element={<HoneypotNotFoundPage />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
