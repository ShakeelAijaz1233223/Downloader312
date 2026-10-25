// ============================================================================
// ONE SHARED DOWNLOAD ENGINE  (user site + admin panel = identical behaviour)
//
//   ticket  ->  HEAD verify  ->  normal browser download (no extra software)
//
// Both surfaces call `runUniversalDownload()`, so the button, the routing rule
// and the messages can never drift apart again.
// ============================================================================
import { UltraApi, formatBytes } from './apiClient';
import { buildCleanFileName } from './instantDownload';
import {
  DOWNLOAD_STATE,
  requestDownloadTicket,
  resolveDownloadTarget,
  probeDownloadUrl,
  dispatchBrowserDownload,
} from './fileDownload';

/**
 * The raw CDN url hidden inside a local proxy path
 * (`/api/v1/stream/direct-download/File.mp4?url=<encoded>`), so admin vault
 * items (which store only the proxy path) download exactly like user streams.
 */
export function upstreamFromProxyPath(pathOrUrl) {
  try {
    const value = String(pathOrUrl || '');
    if (!value.includes('?')) return '';
    const parsed = new URL(value, 'http://placeholder.local');
    const raw = parsed.searchParams.get('url') || '';
    return /^https?:\/\//i.test(raw) ? raw : '';
  } catch {
    return '';
  }
}

/**
 * Sends a verified link to the user's own Direct Download.
 * Returns true only when IDMan.exe was really launched.
 */
export async function trySendToIdm({ streamUrl, fileName, sourceUrl }) {
  try {
    const res = await UltraApi.sendDirectToWindowsIdm({ streamUrl, fileName, sourceUrl });
    return Boolean(res?.launchedDesktopIdm);
  } catch {
    return false; // IDM hand-off is optional — Chrome remains the default
  }
}

/**
 * The single download path used everywhere.
 *
 * @returns {{ok:boolean, routedToIdm:boolean, fileName:string, sizeBytes:number, message:string}}
 */
export async function runUniversalDownload({
  stream,
  analysis,
  onProgress,
  reportHistory,
  user,
  sendDirectUrlToIdm,
}) {
  const notify = (state, message) => {
    try {
      onProgress?.({ state, message });
    } catch {
      /* UI callback must never break the transfer */
    }
  };

  if (!stream) {
    return { ok: false, routedToIdm: false, message: 'No download source selected.' };
  }

  const ext = String(stream.formatExt || 'mp4').toLowerCase();
  const qualityLabel = stream.qualityTitle || 'HD';
  const fileName = buildCleanFileName(
    analysis?.media?.title || stream.qualityTitle || 'Video',
    qualityLabel,
    ext
  );

  const upstreamUrl =
    stream.directCdnUrl ||
    upstreamFromProxyPath(stream.streamUrl) ||
    (/^https?:\/\//i.test(String(stream.streamUrl || '')) &&
    !String(stream.streamUrl).includes('localhost') &&
    !String(stream.streamUrl).includes('127.0.0.1')
      ? stream.streamUrl
      : '') ||
    (/^https?:\/\//i.test(String(analysis?.canonicalUrl || '')) ? '' : '');

  notify(DOWNLOAD_STATE.STARTING, 'Preparing download…');

  /**
   * A signed ticket is requested, verified with a real HEAD request, and — if
   * the CDN link has silently expired — the whole thing is retried with a
   * BRAND-NEW ticket and `refreshSource: true`, which makes the backend
   * re-resolve the original page and mint a link that is only seconds old.
   *
   * This is the actual cure for "This download link is not valid or has been
   * modified" and "File wasn't available on site": one click heals itself, up
   * to three attempts, without ever looping forever.
   */
  const requestVerifiedTicket = async (attempt) => {
    const ticket = await requestDownloadTicket({
      fileId: analysis?.fileId || stream.fileId || '',
      url: upstreamUrl,
      fileName,
      mimeType: stream.mimeType || '',
      sourceUrl: analysis?.canonicalUrl || '',
      title: analysis?.media?.title || '',
      qualityLabel,
      formatId: stream.formatId || '',
      qualityKey: stream.qualityKey || '',
      platformId: analysis?.platform?.id || '',
      refreshSource: attempt > 0,
    });

    const target = resolveDownloadTarget(ticket);
    if (!target) {
      throw new Error('The server did not return a download link. Please click Retry.');
    }

    notify(
      DOWNLOAD_STATE.VERIFYING,
      attempt ? 'Refreshing expired link…' : 'Verifying file…'
    );
    const probe = await probeDownloadUrl(target);
    return { ticket, target, probe };
  };

  const MAX_ATTEMPTS = 3;
  let lastProbe = { ok: false, message: '' };
  let verified = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await requestVerifiedTicket(attempt);
      lastProbe = result.probe;
      if (result.probe.ok) {
        verified = result;
        break;
      }
    } catch (err) {
      lastProbe = { ok: false, message: err?.message || '' };
    }
    // Small backoff so a rotated CDN signature has time to settle.
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }

  if (!verified) {
    throw new Error(
      lastProbe.message ||
        'The media server would not serve this file. Please try again in a moment.'
    );
  }

  const { ticket, target: downloadTarget, probe } = verified;

  // ---- plain, normal download (exactly like any website) -----------------
  // No external download manager, no branding: the browser's own download
  // manager takes the file. If the user has a download manager installed, the
  // browser hands it over automatically — we never depend on it.
  const routedToIdm = false;
  const dispatched = dispatchBrowserDownload(downloadTarget, ticket.fileName || fileName);
  if (!dispatched) {
    throw new Error(
      'Your browser blocked the download. Please allow downloads for this site and click Retry.'
    );
  }

  const message = `Download started: ${ticket.fileName || fileName}`;

  notify(DOWNLOAD_STATE.STARTED, message);

  // History is written only for signed-in users, and never blocks the transfer.
  try {
    if (user && typeof reportHistory === 'function') {
      await Promise.resolve(reportHistory());
    } else if (user && sendDirectUrlToIdm) {
      /* no-op: kept for call-site compatibility */
    }
  } catch {
    /* history must never fail a download */
  }

  return {
    ok: true,
    routedToIdm,
    fileName: ticket.fileName || fileName,
    sizeBytes: probe.sizeBytes || ticket.sizeBytes || 0,
    message,
  };
}

export { DOWNLOAD_STATE, formatBytes };
