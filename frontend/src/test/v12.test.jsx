import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// The panel is pure UI + one API call; mock the client so the suite stays
// hermetic and never depends on a running backend.
vi.mock('../services/apiClient', async () => {
  const actual = await vi.importActual('../services/apiClient');
  return {
    ...actual,
    UltraApi: {
      ...actual.UltraApi,
      getConvertCapabilities: vi.fn(),
      startConvert: vi.fn(),
      getConvertJob: vi.fn(),
      cancelConvert: vi.fn(),
    },
  };
});

vi.mock('../services/fileDownload', async () => {
  const actual = await vi.importActual('../services/fileDownload');
  return { ...actual, dispatchBrowserDownload: vi.fn(() => true) };
});

import { UltraApi } from '../services/apiClient';
import { AutoConvertPanel } from '../components/downloader/AutoConvertPanel';

describe('V12 Auto-convert panel (honest behaviour)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Says out loud when FFmpeg is missing and still offers M4A', async () => {
    UltraApi.getConvertCapabilities.mockResolvedValue({
      ffmpegAvailable: false,
      reEncode: false,
      directCopy: true,
      targets: ['max', '1080p'],
      audioFormats: ['mp3', 'm4a'],
      note: 'FFmpeg not found on this server.',
    });

    render(
      <AutoConvertPanel sourceUrl="https://www.youtube.com/watch?v=abc12345678" title="Test" sourceHeight={360} />
    );

    fireEvent.click(screen.getByText(/auto-convert on the server/i));

    await waitFor(() => expect(screen.getByText(/auto-convert on the server/i)).toBeTruthy());

    // Real quality is stated, and the "nothing is upscaled" promise is visible.
    expect(screen.getByText(/source: 360p/i)).toBeTruthy();

    fireEvent.click(screen.getByText(/audio only/i));

    await waitFor(() => {
      const mp3 = screen.getByRole('option', { name: /MP3/i });
      expect(mp3.disabled).toBe(true);
    });
    expect(screen.getByText(/needs FFmpeg on the server/i)).toBeTruthy();
  });

  it('2. Starts a real job and reports progress from the backend', async () => {
    UltraApi.getConvertCapabilities.mockResolvedValue({
      ffmpegAvailable: true,
      reEncode: true,
      directCopy: true,
      targets: ['max', '1080p'],
      audioFormats: ['mp3', 'm4a'],
      note: 'FFmpeg detected — real transcoding is enabled.',
    });
    UltraApi.startConvert.mockResolvedValue({
      id: 'job1234567890ab',
      status: 'running',
      phase: 'downloading',
      progress: 40,
    });
    UltraApi.getConvertJob.mockResolvedValue({
      id: 'job1234567890ab',
      status: 'ready',
      phase: 'ready',
      progress: 100,
      fileName: 'Converted_Video_360p.mp4',
      sizeBytes: 2048,
      downloadPath: '/api/v1/convert/job1234567890ab/file',
      note: 'Nothing is upscaled — you get the real source resolution.',
    });

    render(
      <AutoConvertPanel sourceUrl="https://www.youtube.com/watch?v=abc12345678" title="Test" sourceHeight={360} />
    );
    fireEvent.click(screen.getByText(/auto-convert on the server/i));
    fireEvent.click(screen.getByText(/convert & prepare download/i));

    await waitFor(() => expect(UltraApi.startConvert).toHaveBeenCalledTimes(1));
    expect(UltraApi.startConvert.mock.calls[0][0]).toMatchObject({
      sourceUrl: 'https://www.youtube.com/watch?v=abc12345678',
      mode: 'video',
      target: 'max',
    });

    await waitFor(
      () => {
        expect(screen.getByText(/download converted file/i)).toBeTruthy();
      },
      { timeout: 4000 }
    );
    expect(screen.getByText(/Converted_Video_360p\.mp4/)).toBeTruthy();
    // The promise appears in the intro and in the finished-job note.
    expect(screen.getAllByText(/nothing is upscaled/i).length).toBeGreaterThan(0);
  });
});
