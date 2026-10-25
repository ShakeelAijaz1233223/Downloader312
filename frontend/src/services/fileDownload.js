// ============================================================================
// REAL BROWSER-MANAGED FILE DOWNLOAD (single-button flow)
// 1. Ask the backend for a short-lived signed download ticket.
// 2. Verify the link with a cheap HEAD request (real file, real headers).
// 3. Hand the URL to the browser so Chrome/Edge/IDM performs the transfer.
//    The page never buffers large files in memory and never claims a
//    "completed" state it cannot observe.
// ============================================================================
import { apiRequest, getApiBaseOrigin } from './apiClient';

export const DOWNLOAD_STATE = Object.freeze({
  IDLE: 'idle',
  STARTING: 'starting',
  VERIFYING: 'verifying',
  STARTED: 'started',
  FAILED: 'failed',
});

export async function requestDownloadTicket(payload) {
  return apiRequest('/files/download-ticket', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * The signed URL MUST stay on the page's own origin (Vite proxy -> backend).
 * Using the backend's internal host (127.0.0.1:4000) breaks the download on
 * every real deployment (different origin / behind a proxy / remote preview).
 */
export function resolveDownloadTarget(ticket) {
  if (!ticket) return '';
  // Prefer the SAME origin the API is served from. In production that is the
  // page's own origin (Vite/nginx proxy) so the browser never touches
  // 127.0.0.1:4000 directly; only an explicitly absolute API base overrides it.
  const apiOrigin = getApiBaseOrigin();
  const origin =
    apiOrigin || (typeof window !== 'undefined' ? window.location.origin : '');

  if (ticket.downloadPath) {
    const path = String(ticket.downloadPath);
    return path.startsWith('http') ? path : `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  const raw = String(ticket.downloadUrl || '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw, origin || 'http://localhost');
    if (origin && parsed.origin !== origin) {
      return `${origin}${parsed.pathname}${parsed.search}`;
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

/**
 * Confirms the signed link really serves a real file before we trigger the
 * browser download. HEAD only — no bytes are transferred or buffered.
 */
export async function probeDownloadUrl(downloadUrl) {
  const buildOk = (res) => {
    const disposition = res.headers.get('content-disposition') || '';
    const totalFromRange = /\/(\d+)$/.exec(res.headers.get('content-range') || '');
    return {
      ok: res.ok && (/attachment/i.test(disposition) || res.status === 200 || res.status === 206),
      status: res.status,
      sizeBytes: Number(res.headers.get('content-length') || totalFromRange?.[1] || 0),
      mimeType: res.headers.get('content-type') || '',
      acceptsRanges: (res.headers.get('accept-ranges') || '').includes('bytes'),
    };
  };

  // 1) Preferred: HEAD (no bytes at all).
  try {
    const head = await fetch(downloadUrl, {
      method: 'HEAD',
      credentials: 'include',
      cache: 'no-store',
    });
    if (head.ok) return buildOk(head);
    // HEAD rejected (405/501 on some proxies) -> fall through to a 1-byte GET,
    // but keep real 4xx/410 error messages.
    if (![405, 501, 0].includes(head.status)) {
      return { ok: false, status: head.status, message: await readErrorFromResponse(head) };
    }
  } catch {
    /* fall through to ranged GET */
  }

  // 2) Fallback: ask for exactly one byte, then cancel the body.
  try {
    const ranged = await fetch(downloadUrl, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      credentials: 'include',
      cache: 'no-store',
    });

    if (!ranged.ok) {
      return { ok: false, status: ranged.status, message: await readErrorFromResponse(ranged) };
    }

    const info = buildOk(ranged);
    try {
      await ranged.body?.cancel();
    } catch {
      /* ignore */
    }
    return info;
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message:
        err?.message === 'Failed to fetch'
          ? 'Could not reach the server. Check that the app is running and try again.'
          : err?.message || 'Could not verify this download.',
    };
  }
}

async function readErrorFromResponse(res) {
  try {
    const json = await res.json();
    if (json?.error?.message) return json.error.message;
  } catch {
    /* not JSON */
  }
  if (res.status === 404) return 'This file is no longer available on the server.';
  if (res.status === 401) return 'Please sign in to download this protected file.';
  if (res.status === 403) {
    return 'This download link is not valid or has been modified. Please click Download again to get a fresh link.';
  }
  if (res.status === 410) return 'This download link has expired. Please click Download again.';
  if (res.status === 429) return 'Too many download requests. Please wait a moment and try again.';
  if (res.status >= 500) return 'The server could not prepare this download. Please try again.';
  return `The download request failed (HTTP ${res.status}).`;
}

/**
 * Hands the verified URL to the browser. Chrome owns the transfer and lists it
 * in Ctrl+J; the page cannot observe final completion, so callers must only
 * report "download started".
 */
export function dispatchBrowserDownload(downloadUrl, fileName) {
  if (!downloadUrl || typeof document === 'undefined') return false;

  let absolute = downloadUrl;
  if (!/^https?:\/\//i.test(absolute)) {
    absolute = `${window.location.origin}${absolute.startsWith('/') ? '' : '/'}${absolute}`;
  }

  try {
    const anchor = document.createElement('a');
    anchor.href = absolute;
    anchor.download = fileName || '';
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch {
    try {
      window.location.assign(absolute);
      return true;
    } catch {
      return false;
    }
  }
}

export function formatDownloadSize(bytes) {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
