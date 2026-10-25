import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Eye, Sparkles, AlertCircle } from 'lucide-react';
import { AnnouncementBar } from '../components/layout/AnnouncementBar';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { OnlineVideoPlayer } from '../components/player/OnlineVideoPlayer';
import { NativeSponsorBanner } from '../components/monetization/AdWaterfallManager';
import { UltraApi } from '../services/apiClient';
import { useApp } from '../context/AppContext';

export function ViralSharePage() {
  const { shortCode } = useParams();
  const { startManagedDownload } = useApp();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    setErrorMsg('');
    UltraApi.resolveViralShareLink(shortCode)
      .then((res) => setItem(res))
      .catch((err) => setErrorMsg(err.message || 'Shared link not found.'))
      .finally(() => setLoading(false));
  }, [shortCode]);

  return (
    <div className="min-h-screen w-full bg-white text-slate-900 flex flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1 w-full px-4 sm:px-8 xl:px-12 py-10">
        {loading ? (
          <div className="max-w-4xl mx-auto rounded-3xl bg-slate-50 border border-slate-200 p-12 text-center text-sm font-semibold text-slate-600">
            Loading watch stream...
          </div>
        ) : errorMsg || !item ? (
          <div className="max-w-3xl mx-auto rounded-3xl bg-white border border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <AlertCircle size={40} className="mx-auto text-rose-500" />
            <h1 className="text-xl font-extrabold text-slate-900">Shared Watch Link Not Found</h1>
            <p className="text-xs sm:text-sm text-slate-600">{errorMsg}</p>
            <Link
              to="/"
              className="inline-block rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-2.5 text-xs font-extrabold text-white"
            >
              Paste &amp; Share Your Own Video Link
            </Link>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                <Sparkles size={13} /> Direct Browser Stream · Zero Account Needed
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Eye size={14} className="text-blue-600" />
                <strong>{item.views}</strong> views
              </span>
            </div>

            <OnlineVideoPlayer
              streamUrl={item.streamUrl}
              posterUrl={item.thumbnailUrl}
              title={item.title}
              platformName={item.platformId || 'Live Stream'}
              autoPlay={true}
            />

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-extrabold text-slate-900">{item.title}</h1>
                <p className="text-xs text-slate-600 mt-1">
                  Duration: {item.durationText || 'Live Stream'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    startManagedDownload({
                      media: { title: item.title, thumbnailUrl: item.thumbnailUrl },
                      platform: { id: item.platformId || 'youtube', displayName: 'Video' },
                      selectedStream: {
                        qualityTitle: 'HD',
                        formatExt: 'mp4',
                        formatSelector: 'direct_idm_stream',
                        sizeBytes: 0,
                        streamUrl: item.streamUrl,
                      },
                      sourceUrl: item.url,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-extrabold text-white"
                >
                  <Download size={15} /> Download Full MP4
                </button>
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-extrabold text-white"
                >
                  Paste Another Link →
                </Link>
              </div>
            </div>

            <NativeSponsorBanner />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
