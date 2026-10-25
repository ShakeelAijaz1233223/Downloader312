import fs from 'node:fs';
import path from 'node:path';
import { BACKEND_ROOT } from '../config/env.js';
import {
  ALL_ALLOWED_EXTENSIONS,
  mimeForExtension,
  extensionOfFileName,
} from './mediaFormats.js';

// ============================================================================
// AUTHORIZED DOWNLOAD LIBRARY (single source of truth)
// - Files are resolved ONLY through this registry (never by user input path).
// - Filename + MIME type come from trusted metadata, never from the request.
// - Every path is verified to stay inside FILES_ROOT (no path traversal).
// ============================================================================

export const FILES_ROOT = path.resolve(BACKEND_ROOT, 'storage/files');

const LIBRARY = [
  {
    fileId: 'sample_pdf',
    fileName: 'UltraDownloader_Sample_Guide.pdf',
    mimeType: 'application/pdf',
    title: 'UltraDownloader Sample Guide (PDF)',
    requiresAuth: false,
  },
  {
    fileId: 'sample_zip',
    fileName: 'UltraDownloader_Sample_Pack.zip',
    mimeType: 'application/zip',
    title: 'UltraDownloader Sample Pack (ZIP)',
    requiresAuth: false,
  },
  {
    fileId: 'pro_pack_zip',
    fileName: 'UltraDownloader_Pro_Pack.zip',
    mimeType: 'application/zip',
    title: 'UltraDownloader Pro Pack (account required)',
    requiresAuth: true,
  },
];

function assertInsideRoot(absolutePath) {
  const normalizedRoot = FILES_ROOT.endsWith(path.sep) ? FILES_ROOT : `${FILES_ROOT}${path.sep}`;
  if (!absolutePath.startsWith(normalizedRoot)) {
    const err = new Error('Resolved file path escapes the download storage root.');
    err.code = 'PATH_TRAVERSAL_BLOCKED';
    throw err;
  }
  return absolutePath;
}

export function getLibraryEntry(fileId) {
  const cleanId = String(fileId || '').trim();
  const entry = LIBRARY.find((item) => item.fileId === cleanId);
  if (!entry) return null;

  // Build the absolute path from trusted metadata only.
  const absolutePath = assertInsideRoot(path.resolve(FILES_ROOT, entry.fileName));
  let exists = false;
  let sizeBytes = 0;
  try {
    const stat = fs.statSync(absolutePath);
    exists = stat.isFile();
    sizeBytes = exists ? stat.size : 0;
  } catch {
    exists = false;
  }

  return { ...entry, absolutePath, exists, sizeBytes };
}

export function listLibraryFiles({ includeProtected = false } = {}) {
  return LIBRARY.filter((item) => includeProtected || !item.requiresAuth).map((item) => {
    const resolved = getLibraryEntry(item.fileId);
    return {
      fileId: resolved.fileId,
      fileName: resolved.fileName,
      mimeType: resolved.mimeType,
      title: resolved.title,
      requiresAuth: resolved.requiresAuth,
      sizeBytes: resolved.sizeBytes,
      available: resolved.exists,
      downloadPath: `/api/v1/files/${resolved.fileId}/download`,
    };
  });
}

export const ALLOWED_DOWNLOAD_EXTENSIONS = ALL_ALLOWED_EXTENSIONS;

export const MIME_BY_EXTENSION = new Proxy(
  {},
  { get: (_t, key) => (typeof key === 'string' ? mimeForExtension(key) : undefined) }
);

export function mimeFromExtension(ext) {
  return mimeForExtension(ext);
}

export { extensionOfFileName };
