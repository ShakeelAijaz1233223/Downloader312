// ============================================================================
// AUTO-CONVERT PANEL  (V12)
//
// Sits directly under the main Download button and gives the user the option
// the screenshots asked for: "whatever quality this video is, hand me the best
// real file — MP4 video or MP3/M4A audio — converted on the server".
//
// Honest by design:
//   • it shows the REAL source quality it found,
//   • it says "nothing is upscaled" out loud,
//   • it disables MP3 (and says why) when the server has no FFmpeg,
//   • progress is real (download % + encode %), cancel really cancels.
// ============================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Wand2, Loader2, X, CheckCircle2, AlertTriangle, Music4, Film, Info } from 'lucide-react';
import { UltraApi, formatBytes } from '../../services/apiClient';
import { dispatchBrowserDownload } from '../../services/fileDownload';

const TARGET_OPTIONS = [
  { value: 'max', label: 'Best available' },
  { value: '2160p', label: 'Up to 2160p (if real)' },
  { value: '1440p', label: 'Up to 1440p (if real)' },
  { value: '1080p', label: 'Up to 1080p (if real)' },
  { value: '720p', label: 'Up to 720p' },
  { value: '480p', label: 'Up to 480p' },
];

export function AutoConvertPanel({ sourceUrl, title = '', sourceHeight = 0, compact = false }) {
  const [caps, setCaps] = useState(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('video');
  const [target, setTarget] = useState('max');
  const [audioFormat, setAudioFormat] = useState('m4a');
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    let alive = true;
    UltraApi.getConvertCapabilities()
      .then((res) => {
        if (!alive) return;
        const data = res?.data && res.data.targets ? res.data : res;
        setCaps(data);
        setAudioFormat(data?.ffmpegAvailable ? 'mp3' : 'm4a');
      })
      .catch(() => {
        if (alive) setCaps({ ffmpegAvailable: false, reEncode: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const stopPolling = useCallback(() => {
    clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const pollJob = useCallback(
    (id) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await UltraApi.getConvertJob(id);
          const data = res?.data && res.data.id ? res.data : res;
          setJob(data);
          if (['ready', 'failed', 'cancelled'].includes(data?.status)) {
            stopPolling();
            if (data.status === 'failed') setError(data.error || 'Conversion failed.');
          }
        } catch (err) {
          stopPolling();
          setError(err?.message || 'Lost contact with the converter.');
        }
      }, 1200);
    },
    [stopPolling]
  );

  const start = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await UltraApi.startConvert({
        sourceUrl,
        title,
        target: mode === 'audio' ? 'max' : target,
        audioFormat,
        mode,
      });
      const data = res?.data && res.data.id ? res.data : res;
      setJob(data);
      pollJob(data.id);
    } catch (err) {
      setError(err?.message || 'Could not start the conversion.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!job?.id) return;
    stopPolling();
    try {
      await UltraApi.cancelConvert(job.id);
    } catch {
      /* ignore */
    }
    setJob(null);
    setError('');
  };

  const download = () => {
    if (!job?.downloadPath) return;
    dispatchBrowserDownload(job.downloadPath, job.fileName || 'converted.mp4');
  };

  const running = job && ['running', 'queued'].includes(job.status);
  const ready = job?.status === 'ready';

  const ffmpegMissing = caps && caps.ffmpegAvailable === false;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-violet-50 px-3 py-1.5 text-[11px] font-extrabold text-violet-700 hover:bg-violet-100"
      >
        <Wand2 size={13} />
        Auto-convert
      </button>
    );
  }

  if (!sourceUrl) return null;

  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/70 to-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5"
      >
        <span className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-extrabold text-violet-800">
          <Wand2 size={14} />
          Auto-convert on the server
          <span className="rounded-md bg-violet-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
            V12
          </span>
        </span>
        <span className="text-[10px] font-bold text-violet-600">
          {open ? 'Hide' : 'Set up'}
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-white/80 border border-violet-100 px-3 py-2 text-[11px] text-slate-600">
            <Info size={13} className="mt-0.5 shrink-0 text-violet-600" />
            <span>
              The server wraps the <strong>real</strong> stream and hands it back as one clean file
              {sourceHeight ? ` (source: ${sourceHeight}p)` : ''}. Nothing is upscaled — a 360p video
              will never pretend to be 4K.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('video')}
              className={`rounded-xl border px-3 py-2 text-[11px] font-extrabold inline-flex items-center justify-center gap-1.5 ${
                mode === 'video'
                  ? 'border-violet-500 bg-violet-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <Film size={13} /> Video MP4
            </button>
            <button
              type="button"
              onClick={() => setMode('audio')}
              className={`rounded-xl border px-3 py-2 text-[11px] font-extrabold inline-flex items-center justify-center gap-1.5 ${
                mode === 'audio'
                  ? 'border-violet-500 bg-violet-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <Music4 size={13} /> Audio only
            </button>
          </div>

          {mode === 'video' ? (
            <label className="block">
              <span className="block text-[10px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">
                Target
              </span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[11px] font-bold text-slate-800"
              >
                {TARGET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="block text-[10px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">
                Audio format
              </span>
              <select
                value={audioFormat}
                onChange={(e) => setAudioFormat(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[11px] font-bold text-slate-800"
              >
                <option value="m4a">M4A — original track, no re-encode</option>
                <option value="mp3" disabled={ffmpegMissing}>
                  MP3 — {ffmpegMissing ? 'needs FFmpeg on the server' : 'transcoded with FFmpeg'}
                </option>
              </select>
            </label>
          )}

          {ffmpegMissing && (
            <p className="text-[10px] font-semibold text-amber-700">
              FFmpeg is not installed on this server, so audio is delivered as the original M4A
              track instead of an MP3 transcode. Video is delivered in its real source resolution.
            </p>
          )}

          {!job && (
            <button
              type="button"
              onClick={start}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 px-4 py-2.5 text-[11px] font-extrabold text-white"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {busy ? 'Starting…' : 'Convert & prepare download'}
            </button>
          )}

          {job && (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span className="capitalize">{running ? job.phase : job.status}</span>
                <span>{job.progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    job.status === 'failed' ? 'bg-rose-500' : 'bg-violet-600'
                  }`}
                  style={{ width: `${job.progress}%` }}
                />
              </div>

              {ready && (
                <>
                  <p className="text-[11px] text-slate-600">
                    {job.fileName} · {formatBytes(job.sizeBytes)}
                  </p>
                  {job.note && <p className="text-[10px] text-slate-500">{job.note}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={download}
                      className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-[11px] font-extrabold text-white inline-flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={13} /> Download converted file
                    </button>
                    <button
                      type="button"
                      onClick={cancel}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-600"
                    >
                      Clear
                    </button>
                  </div>
                </>
              )}

              {running && (
                <button
                  type="button"
                  onClick={cancel}
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-600"
                >
                  <X size={12} /> Cancel conversion
                </button>
              )}

              {job.status === 'failed' && (
                <button
                  type="button"
                  onClick={() => {
                    setJob(null);
                    setError('');
                  }}
                  className="text-[10px] font-bold text-violet-700 underline"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {error && (
            <p className="flex items-start gap-1.5 text-[10px] font-semibold text-rose-700">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default AutoConvertPanel;
