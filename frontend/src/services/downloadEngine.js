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

  const ticket = await requestDownloadTicket({
    fileId: analysis?.fileId || stream.fileId || '',
    url: upstreamUrl,
    fileName,
    mimeType: stream.mimeType || '',
    sourceUrl: analysis?.canonicalUrl || '',
    title: analysis?.media?.title || '',
    qualityLabel,
  });

  const downloadTarget = resolveDownloadTarget(ticket);
  if (!downloadTarget) {
    throw new Error('The server did not return a download link. Please click Retry.');
  }

  notify(DOWNLOAD_STATE.VERIFYING, 'Verifying file…');
  const probe = await probeDownloadUrl(downloadTarget);
  if (!probe.ok) {
    throw new Error(probe.message || 'The server could not serve this file. Please try again.');
  }

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
