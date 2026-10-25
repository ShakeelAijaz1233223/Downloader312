// ============================================================================
// COMPLETE MEDIA FORMAT REGISTRY (video · audio · image · subtitle · archive)
// Single source of truth for: direct-link detection, MIME type, download naming.
// ============================================================================

export const VIDEO_VIDEO_EXTENSIONS = [
  'mp4', 'm4v', 'mkv', 'mov', 'qt', 'avi', 'wmv', 'flv', 'f4v', 'f4p',
  'webm', 'mpg', 'mpeg', 'mpe', 'm2v', 'mpv', 'vob', 'm2p', 'ts', 'mts', 'm2ts', 'm2t',
  'ogv', 'ogx', 'ogm', '3gp', '3g2', 'asf', 'rm', 'rmvb', 'divx', 'xvid', 'nsv', 'yuv',
  'mxf', 'r3d', 'braw', 'crm', 'ari', 'cine', 'm4s', 'cmfv', 'cmfa', 'dv', 'm1v',
];

export const AUDIO_EXTENSIONS = [
  'mp3', 'm4a', 'm4b', 'aac', 'wav', 'wave', 'flac', 'alac', 'ape', 'wv', 'tta', 'tak',
  'ofr', 'ofs', 'ogg', 'oga', 'opus', 'spx', 'wma', 'aiff', 'aif', 'aifc', 'au', 'snd',
  'amr', '3ga', 'caf', 'mka', 'mpc', 'ra', 'ram', 'pcm', 'raw', 's16le', 's24le', 's32le',
  'mid', 'midi', 'kar', 'rmi', 'ac3', 'eac3', 'dts', 'mlp',
];

export const IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'avif', 'jxl', 'apng', 'mng',
  'tif', 'tiff', 'exr', 'dpx', 'hdr', 'heic', 'heif', 'svg', 'eps', 'ai',
  'cr2', 'cr3', 'nef', 'arw', 'dng', 'orf', 'rw2', 'raf',
];

export const PLAYLIST_EXTENSIONS = ['m3u', 'm3u8', 'mpd', 'pls', 'asx', 'wpl', 'xspf'];

export const SUBTITLE_EXTENSIONS = [
  'srt', 'vtt', 'ass', 'ssa', 'sub', 'idx', 'sbv', 'ttml', 'dfxp', 'smi', 'sami',
  'lrc', 'stl', 'cap', 'scc', 'itt',
];

export const ARCHIVE_EXTENSIONS = [
  'zip', '7z', 'rar', 'tar', 'gz', 'bz2', 'xz', 'zst', 'tgz', 'tbz2', 'txz',
  'iso', 'img', 'bin', 'cue', 'nrg', 'torrent', 'meta4', 'apk', 'exe', 'msi', 'dmg', 'pkg',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'json', 'xml', 'epub',
];

export const ALL_ALLOWED_EXTENSIONS = Object.freeze([
  ...new Set([
    ...VIDEO_VIDEO_EXTENSIONS,
    ...AUDIO_EXTENSIONS,
    ...IMAGE_EXTENSIONS,
    ...PLAYLIST_EXTENSIONS,
    ...SUBTITLE_EXTENSIONS,
    ...ARCHIVE_EXTENSIONS,
  ]),
]);

// Regex-safe alternatives for direct-link / page sniffing
export const MEDIA_URL_EXT_PATTERN = [
  ...VIDEO_VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...PLAYLIST_EXTENSIONS,
].join('|');

export const ANY_FILE_EXT_PATTERN = [
  ...VIDEO_VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ...PLAYLIST_EXTENSIONS,
  ...SUBTITLE_EXTENSIONS,
  ...ARCHIVE_EXTENSIONS,
].join('|');

const MIME = {
  // video
  mp4: 'video/mp4', m4v: 'video/x-m4v', mkv: 'video/x-matroska', mov: 'video/quicktime',
  qt: 'video/quicktime', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv', flv: 'video/x-flv',
  f4v: 'video/x-f4v', f4p: 'video/x-f4v', webm: 'video/webm', mpg: 'video/mpeg',
  mpeg: 'video/mpeg', mpe: 'video/mpeg', m2v: 'video/mpeg', mpv: 'video/mpeg',
  vob: 'video/dvd', m2p: 'video/mpeg', ts: 'video/mp2t', mts: 'video/mp2t',
  m2ts: 'video/mp2t', m2t: 'video/mp2t', ogv: 'video/ogg', ogx: 'video/ogg', ogm: 'video/ogg',
  '3gp': 'video/3gpp', '3g2': 'video/3gpp2', asf: 'video/x-ms-asf', rm: 'application/vnd.rn-realmedia',
  rmvb: 'application/vnd.rn-realmedia-vbr', divx: 'video/divx', xvid: 'video/x-msvideo',
  nsv: 'video/x-nsv', yuv: 'video/x-raw-yuv', mxf: 'application/mxf', r3d: 'video/x-r3d',
  braw: 'video/x-braw', crm: 'video/x-canon-crm', ari: 'video/x-arri', cine: 'video/x-phantom',
  m4s: 'video/iso.segment', cmfv: 'video/iso.segment', cmfa: 'audio/iso.segment', dv: 'video/dv', m1v: 'video/mpeg',
  // audio
  mp3: 'audio/mpeg', m4a: 'audio/mp4', m4b: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
  wave: 'audio/wav', flac: 'audio/flac', alac: 'audio/mp4', ape: 'audio/x-ape',
  wv: 'audio/x-wavpack', tta: 'audio/x-tta', tak: 'audio/x-tak', ofr: 'audio/x-ofr',
  ofs: 'audio/x-ofs', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', spx: 'audio/ogg',
  wma: 'audio/x-ms-wma', aiff: 'audio/aiff', aif: 'audio/aiff', aifc: 'audio/aiff',
  au: 'audio/basic', snd: 'audio/basic', amr: 'audio/amr', '3ga': 'audio/3gpp',
  caf: 'audio/x-caf', mka: 'audio/x-matroska', mpc: 'audio/x-musepack', ra: 'audio/x-realaudio',
  ram: 'audio/x-pn-realaudio', pcm: 'audio/L16', raw: 'application/octet-stream',
  s16le: 'audio/L16', s24le: 'audio/L24', s32le: 'audio/L32', mid: 'audio/midi',
  midi: 'audio/midi', kar: 'audio/midi', rmi: 'audio/midi', ac3: 'audio/ac3',
  eac3: 'audio/eac3', dts: 'audio/vnd.dts', mlp: 'audio/vnd.dolby.mlp',
  // playlist / streaming
  m3u: 'audio/x-mpegurl', m3u8: 'application/vnd.apple.mpegurl', mpd: 'application/dash+xml',
  pls: 'audio/x-scpls', asx: 'video/x-ms-asf', wpl: 'application/vnd.ms-wpl',
  xspf: 'application/xspf+xml',
  // subtitles
  srt: 'text/plain; charset=utf-8', vtt: 'text/vtt; charset=utf-8',
  ass: 'text/plain; charset=utf-8', ssa: 'text/plain; charset=utf-8',
  sub: 'text/plain; charset=utf-8', idx: 'text/plain; charset=utf-8',
  sbv: 'text/plain; charset=utf-8', ttml: 'application/ttml+xml', dfxp: 'application/ttml+xml',
  smi: 'text/plain; charset=utf-8', sami: 'text/plain; charset=utf-8',
  lrc: 'text/plain; charset=utf-8', stl: 'text/plain; charset=utf-8',
  cap: 'text/plain; charset=utf-8', scc: 'text/plain; charset=utf-8',
  itt: 'application/ttml+xml',
  // images
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  bmp: 'image/bmp', webp: 'image/webp', avif: 'image/avif', jxl: 'image/jxl',
  apng: 'image/apng', mng: 'image/x-mng', tif: 'image/tiff', tiff: 'image/tiff',
  exr: 'image/x-exr', dpx: 'image/x-dpx', hdr: 'image/vnd.radiance', heic: 'image/heic',
  heif: 'image/heif', svg: 'image/svg+xml', eps: 'application/postscript',
  ai: 'application/postscript', cr2: 'image/x-canon-cr2', cr3: 'image/x-canon-cr3',
  nef: 'image/x-nikon-nef', arw: 'image/x-sony-arw', dng: 'image/x-adobe-dng',
  orf: 'image/x-olympus-orf', rw2: 'image/x-panasonic-rw2', raf: 'image/x-fuji-raf',
  // archives / docs
  zip: 'application/zip', '7z': 'application/x-7z-compressed', rar: 'application/vnd.rar',
  tar: 'application/x-tar', gz: 'application/gzip', bz2: 'application/x-bzip2',
  xz: 'application/x-xz', zst: 'application/zstd', tgz: 'application/gzip',
  tbz2: 'application/x-bzip2', txz: 'application/x-xz', iso: 'application/x-iso9660-image',
  img: 'application/octet-stream', bin: 'application/octet-stream',
  cue: 'application/x-cue', nrg: 'application/octet-stream',
  meta4: 'application/metalink4+xml',
  torrent: 'application/x-bittorrent', apk: 'application/vnd.android.package-archive',
  exe: 'application/octet-stream', msi: 'application/x-msi', dmg: 'application/x-apple-diskimage',
  pkg: 'application/x-newton-compatible-pkg', pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv; charset=utf-8', txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8', xml: 'application/xml; charset=utf-8',
  epub: 'application/epub+zip',
};

export function mimeForExtension(ext) {
  return MIME[String(ext || '').toLowerCase()] || 'application/octet-stream';
}

export function extensionOfFileName(fileName) {
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

export function hasAllowedExtension(fileName) {
  return ALL_ALLOWED_EXTENSIONS.includes(extensionOfFileName(fileName));
}
