import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Globe2,
  History,
  Heart,
  Settings,
  PlaySquare,
  Disc3,
  UserPlus,
  LogIn,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function AppSidebar() {
  const location = useLocation();
  const { favorites, downloadQueue, user } = useApp();

  const items = [
    { to: '/', label: 'Home & Analyzer', icon: Home },
    { to: '/albums', label: 'Album & Mix Search', icon: Disc3 },
    { to: '/sites', label: 'Supported Sites', icon: Globe2 },
    { to: '/seo-analyzer', label: 'SEO + AI Analyzer', icon: Sparkles },
    { to: '/player', label: 'Built-in Player', icon: PlaySquare },
    { to: '/downloads', label: 'Download History', icon: History, badge: downloadQueue.length },
    { to: '/favorites', label: 'Favorites', icon: Heart, badge: favorites.length },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="hidden xl:flex flex-col w-60 shrink-0 ud-card p-3.5 h-fit sticky top-20">
      <div className="mb-3 flex items-center gap-2.5 px-2">
        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-violet-400/40">
          <img
            src="/brand/cube-tunnel-256.png"
            alt="Downloader cube tunnel"
            className="h-10 w-10 object-cover"
            loading="lazy"
          />
          <span className="pointer-events-none absolute inset-0 rounded-xl bg-violet-500/10" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-extrabold uppercase tracking-wider text-violet-700">
            Pro Workspace
          </span>
          <span className="block truncate text-[10px] font-semibold text-slate-400">
            cube-tunnel engine
          </span>
        </span>
      </div>
      <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        Workspace Menu
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                active
                  ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-[0_6px_20px_rgba(139,92,246,0.4)]'
                  : 'ud-text-secondary hover:bg-violet-500/10'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon size={16} />
                <span>{item.label}</span>
              </span>
              {item.badge > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-900/80 text-sky-300 font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-800/70">
        <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          User Access
        </p>
        {user ? (
          <div className="px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 font-semibold">
            Signed in: {user.fullName}
          </div>
        ) : (
          <div className="space-y-1">
            <Link
              to="/login"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ud-text-secondary hover:bg-blue-500/10"
            >
              <LogIn size={15} className="text-sky-400" />
              <span>Login</span>
            </Link>
            <Link
              to="/register"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ud-text-secondary hover:bg-blue-500/10"
            >
              <UserPlus size={15} className="text-sky-400" />
              <span>Register</span>
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
