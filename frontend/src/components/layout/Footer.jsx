import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, ShieldCheck, Globe, Heart, Sparkles } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-200 bg-slate-50 text-slate-700">
      <div className="w-full px-4 sm:px-8 xl:px-12 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <Link to="/" className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Zap size={18} strokeWidth={2.5} />
            </span>
            <span className="font-display font-extrabold text-base sm:text-lg text-slate-900">
              Ultra<span className="text-blue-600">Downloader</span>
            </span>
          </Link>
          <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
            Download videos, reels, movies and songs from 120+ websites in HD and 4K — watch online
            first, then save the file directly to your device in one click.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
              <ShieldCheck size={13} /> Safe &amp; Private
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-blue-700 font-bold px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200">
              <Sparkles size={13} /> Always Free
            </span>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-3">
            Popular Downloaders
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
            <li><Link to="/tools/terabox-app-video-downloader" className="hover:text-blue-600">TeraBox Video Player &amp; Downloader</Link></li>
            <li><Link to="/tools/iteraplay-free-video-downloader" className="hover:text-blue-600">iTeraPlay &amp; TeraViralHub Downloader</Link></li>
            <li><Link to="/tools/watch-movies-pk-video-downloader" className="hover:text-blue-600">Watch-Movies PK &amp; HD Movies</Link></li>
            <li><Link to="/tools/tiktok-video-downloader" className="hover:text-blue-600">TikTok &amp; Reels (No Watermark)</Link></li>
            <li><Link to="/tools/youtube-4k-video-mp3-downloader" className="hover:text-blue-600">YouTube 4K Video &amp; MP3</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-3">
            Your Workspace
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
            <li><Link to="/sites" className="hover:text-blue-600">All 120+ Supported Websites</Link></li>
            <li><Link to="/downloads" className="hover:text-blue-600">My Downloads</Link></li>
            <li><Link to="/player" className="hover:text-blue-600">Online Video Player</Link></li>
            <li><Link to="/albums" className="hover:text-blue-600">Video &amp; Audio Search</Link></li>
            <li><Link to="/settings" className="hover:text-blue-600">Download &amp; Quality Settings</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-3">
            Legal &amp; Help
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
            <li><Link to="/legal/privacy" className="hover:text-blue-600">Privacy Policy</Link></li>
            <li><Link to="/legal/terms" className="hover:text-blue-600">Terms of Service</Link></li>
            <li><Link to="/legal/copyright" className="hover:text-blue-600">Copyright / DMCA</Link></li>
          </ul>
          <p className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
            <Globe size={13} className="text-blue-600 shrink-0" /> Works on Windows, Mac, Android &amp; iOS.
          </p>
          <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1.5">
            <Heart size={13} className="text-rose-500 shrink-0" /> Please download only your own or authorized content.
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} UltraDownloader. All rights reserved.
      </div>
    </footer>
  );
}
