import React, { useEffect, useRef, useState } from 'react';
import { Play, Volume2, VolumeX, Maximize2 } from 'lucide-react';

// hls.js (~600 kB) is only needed for .m3u8 streams, so it is loaded on demand
// instead of blocking the first paint of every page.  MP4/WebM previews never
// download it at all.
let hlsModulePromise = null;
function loadHls() {
  if (!hlsModulePromise) {
    hlsModulePromise = import('hls.js')
      .then((mod) => mod.default || mod)
      .catch(() => null);
  }
  return hlsModulePromise;
}

export function OnlineVideoPlayer({
  streamUrl,
  posterUrl = '',
  title = 'Live Stream Preview',
  platformName = 'UltraDownloader',
  subtitles = [],
  autoPlay = false,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !streamUrl) return undefined;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHlsStream =
      /\.m3u8(\?|#|$)/i.test(streamUrl) ||
      streamUrl.includes('/stream/hls-play') ||
      streamUrl.includes('/stream/terabox-hls') ||
      /[?&]url=[^&]*\.m3u8/i.test(streamUrl);

    if (!isHlsStream) {
      videoEl.src = streamUrl;
      if (autoPlay) videoEl.play().catch(() => {});
      return () => {
        videoEl.removeAttribute('src');
        videoEl.load?.();
      };
    }

    let cancelled = false;

    const attachHls = async () => {
      const Hls = await loadHls();
      if (cancelled) return;
      if (!Hls || !Hls.isSupported()) {
        videoEl.src = streamUrl;
        if (autoPlay) videoEl.play().catch(() => {});
        return;
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) videoEl.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data?.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          try {
            hls.startLoad();
            return;
          } catch {
            /* fall through to recovery */
          }
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try {
            hls.recoverMediaError();
            return;
          } catch {
            /* fall through */
          }
        }
        hls.destroy();
        hlsRef.current = null;
      });
    };

    attachHls();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, autoPlay]);

  const changePlaybackRate = (nextRate) => {
    setSpeed(nextRate);
    if (videoRef.current) videoRef.current.playbackRate = nextRate;
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="relative aspect-video bg-slate-950 flex items-center justify-center">
        {streamUrl ? (
          <video
            ref={videoRef}
            poster={posterUrl || undefined}
            controls
            playsInline
            muted={muted}
            className="w-full h-full object-contain bg-black"
          >
            {subtitles.map((sub, i) => (
              <track
                key={`${sub.lang || 'sub'}-${i}`}
                kind="subtitles"
                src={sub.proxyUrl || sub.downloadUrl || sub.url}
                srcLang={sub.lang || 'en'}
                label={sub.label || sub.lang || 'English'}
              />
            ))}
          </video>
        ) : (
          <div className="text-center p-6 text-slate-300 space-y-2">
            <Play size={32} className="mx-auto text-blue-400" />
            <p className="text-xs font-semibold">Paste any video URL to launch online stream player</p>
          </div>
        )}
      </div>

      <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold text-slate-700 truncate max-w-[240px]">
          {platformName} · {title}
        </span>

        <div className="flex items-center gap-1.5">
          {[1, 1.25, 1.5, 2].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => changePlaybackRate(r)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                speed === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {r}x
            </button>
          ))}

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label="Toggle mute"
            className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>

          <button
            type="button"
            onClick={() => videoRef.current?.requestFullscreen?.()}
            aria-label="Fullscreen player"
            className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
