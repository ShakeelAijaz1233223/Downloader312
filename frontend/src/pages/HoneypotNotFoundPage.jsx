import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnnouncementBar } from '../components/layout/AnnouncementBar';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { UltraApi } from '../services/apiClient';

export function HoneypotNotFoundPage({ isHoneypot = false }) {
  const location = useLocation();

  useEffect(() => {
    if (isHoneypot) {
      UltraApi.reportHoneypotHit(location.pathname).catch(() => {});
    }
  }, [isHoneypot, location.pathname]);

  return (
    <div className="min-h-screen w-full bg-white text-slate-900 flex flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-20 text-center">
        <div className="max-w-md rounded-3xl bg-slate-50 border border-slate-200 p-10 space-y-4 shadow-sm">
          <p className="font-display font-extrabold text-6xl text-blue-600">404</p>
          <h1 className="text-xl font-extrabold text-slate-900">Page Not Found</h1>
          <p className="text-xs sm:text-sm text-slate-600">
            The requested URL <code className="text-blue-700 font-semibold">{location.pathname}</code> does not exist on this server.
          </p>
          <Link
            to="/"
            className="inline-block rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-2.5 text-xs font-extrabold text-white"
          >
            Back to Home Studio
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
