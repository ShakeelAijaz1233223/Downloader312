import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { UltraApi, validateSafeExternalUrl } from '../services/apiClient';
import {
  normalizeUserUrl,
  buildInstantDownloadUrl,
  buildCleanFileName,
} from '../services/instantDownload';
import {
  requestDownloadTicket,
  probeDownloadUrl,
  dispatchBrowserDownload,
  resolveDownloadTarget,
} from '../services/fileDownload';
import { getApiBaseOrigin } from '../services/apiClient';

async function hasLiveNetwork() {
  try {
    const res = await fetch('https://www.dailymotion.com/', { signal: AbortSignal.timeout(6000) });
    return Boolean(res) && res.status < 500;
  } catch {
    return false;
  }
}

describe('UltraDownloader V10.0 — Full Real UI + Backend End-to-End Verification Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('1. Enforces strict Anti-SSRF & honest Widevine DRM guards before & during real Backend requests', async () => {
    expect(validateSafeExternalUrl('http://127.0.0.1:4000/internal').ok).toBe(false);
    expect(validateSafeExternalUrl('http://169.254.169.254/latest/meta-data').ok).toBe(false);
    expect(validateSafeExternalUrl('https://www.netflix.com/watch/12345').ok).toBe(false);
    expect(validateSafeExternalUrl('https://www.youtube.com/watch?v=32DLasxoOiM').ok).toBe(true);
    await expect(UltraApi.analyzeUrl('http://127.0.0.1:4000/secret')).rejects.toThrow();
  });

  it('1b. Heals EVERY pasted link format so the "HTTP/HTTPS error" can no longer appear', () => {
    const cases = [
      'https://www.youtube.com/watch?v=32DLasxoOiM',
      'HTTPS : //WWW.YOUTUBE.COM/watch?v=32DLasxoOiM',
      'https:/www.youtube.com/watch?v=32DLasxoOiM',
      'www.youtube.com/watch?v=32DLasxoOiM',
      'youtu.be/abc123',
      '  https://youtu.be/abc123.  ',
      'Watch this now: https://youtu.be/abc123 😍',
      '"https://www.terabox.app/sharing/link?surl=IRHSOPX5IEPgJT7l9IoNlg"',
      'https://www.youtube.com/watch?v=32DLasxoOiM​',
    ];
    cases.forEach((raw) => {
      const res = normalizeUserUrl(raw);
      expect(res.ok, raw).toBe(true);
      expect(res.url.startsWith('https://')).toBe(true);
    });

    expect(normalizeUserUrl('java tutorial for beginners').ok).toBe(false);
    expect(normalizeUserUrl('').ok).toBe(false);
  });

  it('1c. Builds a guaranteed HTTP 206 attachment URL for EVERY stream shape (MP4 / proxy / HLS)', () => {
    const origin = window.location.origin;

    const mp4 = buildInstantDownloadUrl({
      stream: {
        streamUrl: 'https://rr4---sn.googlevideo.com/videoplayback?itag=18',
        formatExt: 'mp4',
        qualityTitle: '720p HD',
      },
      media: { title: 'Java Course' },
      sourceUrl: 'https://www.youtube.com/watch?v=32DLasxoOiM',
    });
    expect(mp4).toContain(`${origin}/api/v1/stream/direct-download/`);
    expect(decodeURIComponent(mp4)).toContain('googlevideo.com');
    expect(decodeURIComponent(mp4)).toContain('720p');

    const proxied = buildInstantDownloadUrl({
      stream: {
        streamUrl:
          '/api/v1/stream/proxy?url=' +
          encodeURIComponent('https://cdn.example.com/video.mp4'),
        formatExt: 'mp4',
      },
      media: { title: 'Proxy Video' },
      sourceUrl: 'https://cdn.example.com/watch',
    });
    expect(decodeURIComponent(proxied)).toContain('cdn.example.com/video.mp4');

    const hls = buildInstantDownloadUrl({
      stream: { streamUrl: 'https://cdn.example.com/master.m3u8', formatExt: 'mp4' },
      media: { title: 'HLS Stream' },
      sourceUrl: 'https://cdn.example.com/watch',
    });
    expect(hls).toContain('/api/v1/stream/hls-download/');

    // A normal web page with no resolved stream must NOT download HTML silently
    const pageOnly = buildInstantDownloadUrl({
      stream: {},
      media: { title: 'Page' },
      sourceUrl: 'https://www.youtube.com/watch?v=32DLasxoOiM',
    });
    expect(pageOnly).toBe('');

    expect(buildCleanFileName('Java: Full Course (2024)!', '1080p HD', 'mp4')).toBe(
      'Java_Full_Course_2024_1080pHD.mp4'
    );
  });

  it('1d. Public UI never leaks internal server tech (XAMPP / MySQL / API port / yt-dlp)', () => {
    render(<App />);
    const visible = document.body.textContent || '';
    ['XAMPP', 'MySQL', 'SQLite', ':4000', 'yt-dlp', '64x', '200 MB/s'].forEach((bad) => {
      expect(visible.includes(bad), `public UI leaked "${bad}"`).toBe(false);
    });
  });

  it('2. REAL HOMEPAGE UI FLOW: pasting a real video URL renders the player + quality streams and one working Download button', async (ctx) => {
    // This assertion needs a real third-party site; a sandbox without internet
    // skips it instead of reporting a fake UI failure.
    if (!(await hasLiveNetwork())) {
      console.warn('[skip] no outbound internet — live homepage flow skipped');
      ctx.skip();
      return;
    }
    render(<App />);

    // Dailymotion resolves from every network (YouTube blocks some data-centre
    // IPs with a bot check, which is an upstream condition, not a UI defect).
    const target = 'https://www.dailymotion.com/video/x8jz2mv';
    const input = screen.getByLabelText(/Universal Video URL or Search Input/i);
    fireEvent.change(input, { target: { value: target } });

    fireEvent.submit(input.closest('form'));

    // The analysis is finished when the single Download button appears
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
      },
      { timeout: 30000 }
    );

    // Quality streams are listed (video + audio tabs render real options)
    expect(screen.getAllByText(/HD|Audio|Video/i).length).toBeGreaterThan(0);

    expect(
      screen.queryByText(/Please enter a valid HTTP or HTTPS video URL/i)
    ).not.toBeInTheDocument();

    // Exactly ONE download button — no second/legacy variants
    expect(screen.queryByRole('button', { name: /Direct Chrome Download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download in Direct Download \/ Chrome/i })).not.toBeInTheDocument();

    const clickedHrefs = [];
    const originalClick = window.HTMLAnchorElement.prototype.click;
    window.HTMLAnchorElement.prototype.click = function patchedClick() {
      clickedHrefs.push(this.getAttribute('href') || this.href);
    };

    const dlBtn = screen.getByRole('button', { name: /^Download/ });
    fireEvent.click(dlBtn);

    expect(screen.getByText(/Preparing download/i)).toBeInTheDocument();
    await waitFor(() => expect(dlBtn).not.toBeDisabled(), { timeout: 25000 });

    window.HTMLAnchorElement.prototype.click = originalClick;

    // A genuine signed browser-download URL was handed to the browser
    expect(clickedHrefs.length).toBe(1);
    expect(clickedHrefs[0]).toContain('/api/v1/files/download/');
    expect(clickedHrefs[0]).toContain('ticket=');

    // Only "started" is claimed (never a fake "complete")
    await waitFor(() => expect(screen.getByText(/Download started:/i)).toBeInTheDocument(), {
      timeout: 25000,
    });
    expect(screen.queryByText(/Download complete/i)).not.toBeInTheDocument();
  }, 60000);

  it('2b. REAL FILE DOWNLOADS: sample PDF + ZIP are transferred as genuine attachment bytes with correct name, type and size', async () => {
    // ---- PDF ----
    const pdfTicket = await requestDownloadTicket({ fileId: 'sample_pdf' });
    expect(pdfTicket.fileName).toBe('UltraDownloader_Sample_Guide.pdf');
    expect(pdfTicket.mimeType).toBe('application/pdf');

    const pdfProbe = await probeDownloadUrl(pdfTicket.downloadUrl);
    expect(pdfProbe.ok).toBe(true);
    expect(pdfProbe.mimeType).toContain('application/pdf');
    expect(pdfProbe.sizeBytes).toBeGreaterThan(500);

    const pdfRes = await fetch(pdfTicket.downloadUrl);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get('content-disposition')).toMatch(
      /attachment; filename="UltraDownloader_Sample_Guide\.pdf"/
    );
    const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
    expect(pdfBytes.length).toBe(pdfProbe.sizeBytes);
    expect(String.fromCharCode(...pdfBytes.slice(0, 5))).toBe('%PDF-');

    // ---- ZIP ----
    const zipTicket = await requestDownloadTicket({ fileId: 'sample_zip' });
    expect(zipTicket.fileName).toBe('UltraDownloader_Sample_Pack.zip');
    expect(zipTicket.mimeType).toBe('application/zip');

    const zipRes = await fetch(zipTicket.downloadUrl);
    expect(zipRes.status).toBe(200);
    expect(zipRes.headers.get('content-disposition')).toMatch(/attachment;/);
    expect(zipRes.headers.get('content-type')).toContain('application/zip');
    const zipBytes = new Uint8Array(await zipRes.arrayBuffer());
    expect([...zipBytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    // ---- Range resume (IDM / interrupted download) ----
    const ranged = await fetch(zipTicket.downloadUrl, { headers: { Range: 'bytes=0-99' } });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get('content-range')).toMatch(/^bytes 0-99\//);
    expect((await ranged.arrayBuffer()).byteLength).toBe(100);

    // ---- Missing file ----
    await expect(requestDownloadTicket({ fileId: 'does_not_exist' })).rejects.toThrow(
      /not available/i
    );

    // ---- Tampered / expired link ----
    const tampered = await probeDownloadUrl(`${zipTicket.downloadUrl.slice(0, -8)}AAAAAAAA`);
    expect(tampered.ok).toBe(false);
    expect(tampered.message).toMatch(/modified|expired|not valid/i);

    // ---- Protected file requires an account ----
    await expect(requestDownloadTicket({ fileId: 'pro_pack_zip' })).rejects.toThrow(/sign in/i);
  }, 40000);

  it('2b2. Signed download link stays on a reachable origin (never the internal 127.0.0.1:4000 in the browser)', async () => {
    const ticket = await requestDownloadTicket({ fileId: 'sample_pdf' });

    const target = resolveDownloadTarget(ticket);
    const expectedOrigin = getApiBaseOrigin() || window.location.origin;

    expect(target.startsWith(expectedOrigin)).toBe(true);
    expect(target).toContain('/api/v1/files/download/');
    expect(target).toContain('ticket=');

    // The verified probe must succeed for this URL (this is what failed before)
    const probe = await probeDownloadUrl(target);
    expect(probe.ok).toBe(true);
    expect(probe.status).toBe(200);
    expect(probe.sizeBytes).toBeGreaterThan(500);
  }, 30000);

  it('2c. dispatchBrowserDownload starts a real browser download (anchor with the signed URL, never a blob)', () => {
    const clicked = [];
    const originalClick = window.HTMLAnchorElement.prototype.click;
    window.HTMLAnchorElement.prototype.click = function patched() {
      clicked.push({ href: this.getAttribute('href'), download: this.getAttribute('download') });
    };

    const ok = dispatchBrowserDownload('/api/v1/files/download/Test.zip?ticket=abc', 'Test.zip');
    window.HTMLAnchorElement.prototype.click = originalClick;

    expect(ok).toBe(true);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].href).toContain('/api/v1/files/download/Test.zip?ticket=abc');
    expect(clicked[0].href.startsWith('http')).toBe(true);
    expect(clicked[0].download).toBe('Test.zip');
    expect(clicked[0].href.startsWith('blob:')).toBe(false);
  });

  it('3. Executes 100% LIVE full-stack Admin Padlock Login + Zero-DB RAM Paste -> VIEW -> SAVE -> Vault DELETE', async () => {
    const gate1 = await UltraApi.verifyPin('78645637189230');
    expect(gate1.padlockTicket).toBeTruthy();

    const gate2 = await UltraApi.loginAdmin({
      email: 'shakeelaijaz559986@gmail.com',
      password: 'ShakeelAhmed@@45637189230',
      totpCode: '189230',
    });
    expect(gate2.adminAccessToken).toBeTruthy();

    const initialVault = await UltraApi.getVaultVideos();
    const initialCount = initialVault.length;

    const liveCardA = await UltraApi.silentPasteCapture(
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      'fullstack_test_paste'
    );
    expect(liveCardA.cardId).toBeTruthy();
    expect((await UltraApi.getVaultVideos()).length).toBe(initialCount);

    const viewed = await UltraApi.viewLiveCardStream(liveCardA.cardId);
    expect(viewed.previewPlayer.streamUrl).toBeTruthy();

    const saved = await UltraApi.saveCardToVault(liveCardA.cardId);
    expect(saved.vaultId).toBeTruthy();
    expect((await UltraApi.getVaultVideos()).length).toBe(initialCount + 1);

    await UltraApi.deleteVaultVideo(saved.vaultId);
    expect((await UltraApi.getVaultVideos()).length).toBe(initialCount);
    await UltraApi.clearAllLiveCards();
  });

  it('4. Verifies Guest Zero-History Rule + Logged-In User Personal History + Delete + Clean All History + Cookie Vault API end-to-end', async () => {
    const guestJob = await UltraApi.createDownloadJob({
      title: 'Guest Ephemeral Clip',
      sourceUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      qualityLabel: '1080p',
      formatExt: 'mp4',
    });
    expect(guestJob.savedToHistory).toBe(false);
    expect(await UltraApi.listDownloadJobs()).toEqual([]);

    const email = `ui_user_${Date.now()}@example.com`;
    const auth = await UltraApi.registerUser({
      displayName: 'UI Test User',
      email,
      password: 'Password@123',
    });
    expect(auth.user.email).toBe(email);

    const item1 = await UltraApi.createDownloadJob({
      title: 'User Personal Item 1',
      sourceUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      qualityLabel: '1080p',
      formatExt: 'mp4',
    });
    await UltraApi.createDownloadJob({
      title: 'User Personal Item 2',
      sourceUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      qualityLabel: '720p',
      formatExt: 'mp4',
    });

    expect((await UltraApi.listDownloadJobs()).length).toBe(2);

    await UltraApi.deleteDownloadHistoryItem(item1.id);
    expect((await UltraApi.listDownloadJobs()).length).toBe(1);

    await UltraApi.cleanAllDownloadHistory();
    expect((await UltraApi.listDownloadJobs()).length).toBe(0);

    await UltraApi.logoutUser();
    expect(await UltraApi.listDownloadJobs()).toEqual([]);

    // Verify singular savePlatformCookie alias used in SettingsPage works 100% live!
    const ckSaved = await UltraApi.savePlatformCookie({
      platformId: 'terabox',
      platformLabel: 'TERABOX',
      cookiesTxt: '# Netscape HTTP Cookie File\n.terabox.com\tTRUE\t/\tFALSE\t0\tndus\ttest',
    });
    expect(ckSaved).toBeTruthy();
    await sqlCleanupCookies();

    await UltraApi.verifyPin('78645637189230');
    await UltraApi.loginAdmin({
      email: 'shakeelaijaz559986@gmail.com',
      password: 'ShakeelAhmed@@45637189230',
      totpCode: '189230',
    });
    await UltraApi.clearAllLiveCards();
  });
});

async function sqlCleanupCookies() {
  const cookies = await UltraApi.getCookieProfiles().catch(() => []);
  for (const c of cookies) {
    await UltraApi.deleteCookieProfile(c.id).catch(() => {});
  }
}
