import { normalizeUserUrl } from './instantDownload';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.MODE === 'test' ? 'http://127.0.0.1:4000/api/v1' : '/api/v1');

// ============================================================================
// 100% PURE LIVE FULL-STACK REST + SSE CLIENT V8.0
// ZERO MOCK DATA · ZERO FAKE ARRAYS · ZERO LOCALSTORAGE FALLBACKS!
// ============================================================================

export function healMirrorUrlInput(rawUrl) {
  let clean = String(rawUrl || '').trim();
  if (!clean) return clean;
  clean = clean
    .replace(/^https?:\/\/ww\.mirrobox\.com/i, 'https://www.mirrobox.com')
    .replace(/^https?:\/\/(www\.)?terabox\.ap(\/|$)/i, 'https://www.terabox.app$2')
    .replace(/^https?:\/\/(www\.)?1024tera\.co(\/|$)/i, 'https://www.1024tera.com$2')
    .replace(/^https?:\/\/4funbox\.co(\/|$)/i, 'https://www.4funbox.com$1');
  return clean;
}

export function validateSafeExternalUrl(rawUrl) {
  const normalized = normalizeUserUrl(rawUrl);
  if (!normalized.ok) {
    return {
      ok: false,
      code: 'INVALID_URL',
      message: 'Please paste a valid video link (for example https://www.youtube.com/watch?v=...).',
    };
  }
  const healed = healMirrorUrlInput(normalized.url);
  let parsed;
  try {
    parsed = new URL(healed);
  } catch {
    return {
      ok: false,
      code: 'INVALID_URL',
      message: 'This link looks incomplete. Please paste the full link starting with https://',
    };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, code: 'INVALID_URL', message: 'Only normal web links (http / https) are supported.' };
  }
  const host = parsed.hostname.toLowerCase();
  const forbiddenHosts = ['localhost', '0.0.0.0', '::1', '[::1]', '169.254.169.254', 'metadata.google.internal'];
  if (
    forbiddenHosts.includes(host) ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return {
      ok: false,
      code: 'SSRF_BLOCKED',
      message: 'This link points to a local or private network address and cannot be opened.',
    };
  }
  const drmDomains = ['netflix.com', 'primevideo.com', 'disneyplus.com', 'hulu.com'];
  if (drmDomains.some((d) => host.includes(d))) {
    return {
      ok: false,
      code: 'DRM_PROTECTED',
      message: 'This service uses hardware DRM protection, so its videos cannot be downloaded.',
    };
  }
  return { ok: true, parsed, healed };
}

// Origin the API is actually reachable from ('' means: same origin via proxy).
export function getApiBaseOrigin() {
  try {
    const parsed = new URL(API_BASE, 'http://relative.local');
    if (parsed.host !== 'relative.local') return parsed.origin;
  } catch {
    /* fall through */
  }
  // Relative base (normal Vite / XAMPP deployment): keep everything on the
  // page's own origin so the /api proxy handles it — never hit :4000 directly.
  if (typeof process !== 'undefined' && process.versions?.node) {
    return 'http://127.0.0.1:4000'; // Node/jsdom test runner talks to the local API
  }
  return '';
}

export async function apiRequest(path, options = {}) {
  const userToken = sessionStorage.getItem('ud_user_access_token') || '';
  const adminToken = sessionStorage.getItem('ud_admin_access_token') || '';
  const padlockTicket = sessionStorage.getItem('ud_padlock_ticket') || '';
  const activeSiteId = localStorage.getItem('ud_active_website_id') || 'site_main_clean';

  const headers = {
    'Content-Type': 'application/json',
    'X-Website-Project-Id': activeSiteId,
    ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
    ...(adminToken ? { 'X-Admin-Token': `Bearer ${adminToken}` } : {}),
    ...(padlockTicket ? { 'X-Admin-Padlock-Ticket': padlockTicket } : {}),
    ...(options.headers || {}),
  };

  const rawUrl = `${API_BASE}${path}`;
  const fullUrl =
    rawUrl.startsWith('/') && typeof process !== 'undefined' && process.versions?.node
      ? `http://127.0.0.1:4000${rawUrl}`
      : rawUrl;

  const res = await fetch(fullUrl, {
    ...options,
    credentials: 'include',
    headers,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const err = new Error(json?.error?.message || `HTTP ${res.status} Request Failed`);
    err.code = json?.error?.code || 'API_ERROR';
    err.details = json?.error?.details || {};
    err.status = res.status;
    throw err;
  }
  return json.data;
}

export const UltraApi = {
  // Health, Live TX/RX Telemetry & Synced Engine Settings
  getHealth() {
    return apiRequest('/health');
  },

  getTelemetry() {
    return apiRequest('/system/telemetry');
  },

  getEngineSettings() {
    return apiRequest('/system/settings');
  },

  updateEngineSettings(payload) {
    return apiRequest('/system/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  savePlatformCookies(payload) {
    return apiRequest('/system/cookies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  savePlatformCookie(payload) {
    return apiRequest('/system/cookies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  clearEngineCache() {
    return apiRequest('/system/clear-cache', { method: 'POST' });
  },

  bootstrap() {
    return apiRequest('/config/bootstrap');
  },

  // Public User Auth & Synced SQL Favorites
  async registerUser({ fullName, displayName, email, password }) {
    const resolvedName = String(fullName || displayName || 'User').trim();
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName: resolvedName, email, password }),
    });
    sessionStorage.setItem('ud_user_access_token', data.userAccessToken);
    return data;
  },

  async loginUser({ email, password }) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    sessionStorage.setItem('ud_user_access_token', data.userAccessToken);
    return data;
  },

  getCurrentUser() {
    return apiRequest('/auth/me');
  },

  async logoutUser() {
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem('ud_user_access_token');
  },

  getFavorites() {
    return apiRequest('/user/favorites');
  },

  toggleFavoriteOnServer(video) {
    return apiRequest('/user/favorites', {
      method: 'POST',
      body: JSON.stringify(video),
    });
  },

  // Live Zero-DB Paste Capture, Search, Analysis & 16x IDM Turbo Downloads
  async silentPasteCapture(rawUrl, sourceContext = 'hero_input') {
    const check = validateSafeExternalUrl(rawUrl);
    if (!check.ok) {
      const err = new Error(check.message);
      err.code = check.code;
      throw err;
    }
    return apiRequest('/intake/paste-capture', {
      method: 'POST',
      body: JSON.stringify({ rawUrl: check.healed, sourceContext }),
    });
  },

  searchVideos({ q = '', mode = 'video', sort = 'relevance' }) {
    const qs = new URLSearchParams({ q, mode, sort }).toString();
    return apiRequest(`/search?${qs}`);
  },

  // Universal "anything" search: one keyword -> every engine + every platform
  searchAnything({ q = '', limit = 12 }) {
    return apiRequest('/search/anything', {
      method: 'POST',
      body: JSON.stringify({ q, limit }),
    });
  },

  // --- ADS + MONETISATION ---
  getAdSlots() {
    return apiRequest('/ads/slots');
  },
  trackAdEvent(payload) {
    return apiRequest('/ads/event', { method: 'POST', body: JSON.stringify(payload) });
  },
  trackVisit() {
    return apiRequest('/analytics/visit', { method: 'POST', body: '{}' });
  },
  adminListAdSlots() {
    return apiRequest('/admin/ads/slots');
  },
  adminCreateAdSlot(payload) {
    return apiRequest('/admin/ads/slots', { method: 'POST', body: JSON.stringify(payload) });
  },
  adminUpdateAdSlot(id, payload) {
    return apiRequest(`/admin/ads/slots/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  adminDeleteAdSlot(id) {
    return apiRequest(`/admin/ads/slots/${id}`, { method: 'DELETE' });
  },
  adminAdsAnalytics() {
    return apiRequest('/admin/ads/analytics');
  },

  async analyzeUrl(urlOrObj, selectedPlatformIdArg = '', ephemeralCookiesArg = '') {
    const opts =
      typeof urlOrObj === 'string'
        ? {
            url: urlOrObj,
            selectedPlatformId: selectedPlatformIdArg,
            cardId: '',
            ephemeralCookiesTxt: ephemeralCookiesArg,
          }
        : urlOrObj || {};

    const check = validateSafeExternalUrl(opts.url);
    if (!check.ok) {
      const err = new Error(check.message);
      err.code = check.code;
      throw err;
    }
    return apiRequest('/analysis', {
      method: 'POST',
      body: JSON.stringify({
        url: check.healed,
        selectedPlatformId: opts.selectedPlatformId || '',
        pasteLeadId: opts.cardId || '',
        ephemeralCookiesTxt: opts.ephemeralCookiesTxt || '',
      }),
    });
  },

  // Signed real-file download system (PDF / ZIP / media streams)
  requestDownloadTicket(payload) {
    return apiRequest('/files/download-ticket', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getDownloadLibrary() {
    return apiRequest('/files/library');
  },

  createDownloadJob(payload) {
    return apiRequest('/downloads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  listDownloadJobs() {
    return apiRequest('/downloads');
  },

  getDownloadJob(id) {
    return apiRequest(`/downloads/${id}`);
  },

  controlDownloadJob(id, action) {
    return apiRequest(`/downloads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
  },

  deleteDownloadHistoryItem(id) {
    return apiRequest(`/downloads/${id}`, {
      method: 'DELETE',
    });
  },

  cleanAllDownloadHistory() {
    return apiRequest('/downloads', {
      method: 'DELETE',
    });
  },

  openInWindowsIdm(id) {
    return apiRequest(`/downloads/${id}/open-in-idm`, {
      method: 'POST',
    });
  },

  batchDownloadJobs(action) {
    return apiRequest('/downloads/batch', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  sendDirectToWindowsIdm(payload) {
    return apiRequest('/downloads/send-direct-idm', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getDbDiagnostics() {
    return apiRequest('/system/db-diagnostics');
  },

  runDbMaintenance(action) {
    return apiRequest('/system/db-maintenance', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  // Viral Watch Links, SEO Pages, Telemetry & Honeypot
  createViralShareLink(payload) {
    return apiRequest('/share', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  resolveViralShareLink(shortCode) {
    return apiRequest(`/share/${shortCode}`);
  },

  getSeoLanding(slug) {
    return apiRequest(`/seo/landing/${encodeURIComponent(slug)}`);
  },

  trackEvent(eventName, platformId = null, meta = {}) {
    return apiRequest('/events/track', {
      method: 'POST',
      body: JSON.stringify({ eventName, platformId, meta }),
    }).catch(() => {});
  },

  reportHoneypotHit(attemptedPath) {
    return apiRequest('/security/honeypot', {
      method: 'POST',
      body: JSON.stringify({ attemptedPath }),
    }).catch(() => {});
  },

  // 5-Layer Secret Padlock Admin Auth
  async verifyPin(pin) {
    try {
      const data = await apiRequest('/admin/padlock/verify', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      sessionStorage.setItem('ud_padlock_ticket', data.padlockTicket);
      return data;
    } catch (err) {
      if (err.code === 'ADMIN_IP_BANNED_30M') {
        err.payload = { bannedUntil: err.details?.unlocksAt };
      }
      throw err;
    }
  },

  async loginAdmin({ email, identifier, password, totpCode }) {
    const data = await apiRequest('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: identifier || email,
        password,
        totpCode,
      }),
    });
    sessionStorage.setItem('ud_admin_access_token', data.adminAccessToken);
    return data;
  },

  async logoutAdmin() {
    await apiRequest('/admin/auth/logout', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem('ud_admin_access_token');
    sessionStorage.removeItem('ud_padlock_ticket');
  },

  subscribeAdminLiveCards(onEvent) {
    const adminToken = sessionStorage.getItem('ud_admin_access_token') || '';
    if (typeof EventSource === 'undefined' || !adminToken) {
      return () => {};
    }

    const es = new EventSource(
      `${API_BASE}/admin/live-cards/stream?adminToken=${encodeURIComponent(adminToken)}`,
      { withCredentials: true }
    );

    ['snapshot', 'card_added', 'card_updated', 'card_removed'].forEach((evtName) => {
      es.addEventListener(evtName, (msg) => {
        try {
          onEvent(evtName, JSON.parse(msg.data));
        } catch {
          // ignore malformed chunk
        }
      });
    });

    return () => es.close();
  },

  getLiveCards() {
    return apiRequest('/admin/live-cards');
  },

  async viewLiveCardStream(cardId) {
    const res = await apiRequest(`/admin/live-cards/${cardId}/view`);
    const c = res.card || res;
    return {
      ...c,
      previewPlayer: { streamUrl: c.streamUrl || res?.player?.streamUrl },
    };
  },

  saveCardToVault(cardId, extra = {}) {
    return apiRequest(`/admin/live-cards/${cardId}/save`, {
      method: 'POST',
      body: JSON.stringify(extra),
    });
  },

  closeLiveCard(cardId) {
    return apiRequest(`/admin/live-cards/${cardId}/close`, {
      method: 'DELETE',
    });
  },

  clearAllLiveCards() {
    return apiRequest('/admin/live-cards', { method: 'DELETE' });
  },

  getVaultVideos() {
    return apiRequest('/admin/vault');
  },

  deleteVaultVideo(vaultId) {
    return apiRequest(`/admin/vault/${vaultId}`, { method: 'DELETE' });
  },

  getAnalyticsOverview() {
    return apiRequest('/admin/analytics/overview');
  },

  getTrafficFunnel() {
    return apiRequest('/admin/traffic/sources-funnel');
  },

  getAiRecommendations() {
    return apiRequest('/admin/ai-recommendations');
  },

  getSeoKeywords() {
    return apiRequest('/admin/seo/keywords');
  },

  addSeoKeyword(payload) {
    return apiRequest('/admin/seo/keywords', {
      method: 'POST',
      body: JSON.stringify(typeof payload === 'string' ? { keyword: payload } : payload),
    });
  },

  deleteSeoKeyword(id) {
    return apiRequest(`/admin/seo/keywords/${id}`, { method: 'DELETE' });
  },

  getFinanceLedger() {
    return apiRequest('/admin/finance');
  },

  addFinanceEntry(entry) {
    return apiRequest('/admin/finance', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  },

  deleteFinanceEntry(id) {
    return apiRequest(`/admin/finance/${id}`, { method: 'DELETE' });
  },

  getWebsites() {
    return apiRequest('/admin/websites');
  },

  addWebsite(site) {
    return apiRequest('/admin/websites', {
      method: 'POST',
      body: JSON.stringify(site),
    });
  },

  getPlatforms() {
    return apiRequest('/admin/platforms');
  },

  saveCustomPlatform(plat) {
    return apiRequest('/admin/platforms', {
      method: 'POST',
      body: JSON.stringify(plat),
    });
  },

  saveAdWaterfall(cfg) {
    return apiRequest('/admin/ads/waterfall', {
      method: 'PUT',
      body: JSON.stringify(cfg),
    });
  },

  saveSystemSettings(cfg) {
    return apiRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(cfg),
    });
  },

  getCookieProfiles() {
    return apiRequest('/admin/cookies');
  },

  addCookieProfile(profile) {
    return apiRequest('/admin/cookies', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  },

  deleteCookieProfile(id) {
    return apiRequest(`/admin/cookies/${id}`, { method: 'DELETE' });
  },

  getAuditLogs() {
    return apiRequest('/admin/audit-logs');
  },
};

export function formatBytes(bytes) {
  if (!bytes || Number.isNaN(Number(bytes)) || Number(bytes) <= 0) return 'Live Stream';
  const n = Number(bytes);
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
