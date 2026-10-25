// Round-9: catalogue is exactly the user's two lists (8 social + 18 streaming + 12 cloud)
export const PLATFORM_CATEGORIES = [
  { id: 'all', label: 'All supported (404)' },
  { id: 'social', label: 'Social Media (38)' },
  { id: 'video', label: 'Streaming · Video · Music (122)' },
  { id: 'education', label: 'Courses & Learning (61)' },
  { id: 'cloud_terabox', label: 'TeraBox & Cloud (22)' },
  { id: 'web', label: 'AI · Search · Shopping · Dev (161)' },
];

export const QUICK_SUGGESTION_CHIPS = [
  'Blender 4K Short Film',
  'CS50 Full Lecture HD',
  'Pakistani OST Studio',
  'Coke Studio 4K Audio',
  'Nature 8K HDR Demo',
];

export function isLikelyUrl(text) {
  const clean = String(text || '').trim();
  return /^https?:\/\/[^\s]+\.[^\s]+/i.test(clean);
}

export function detectPlatformFromInput(inputVal, platformsList = []) {
  const clean = String(inputVal || '').trim().toLowerCase();
  if (!clean || !clean.startsWith('http')) return null;

  for (const p of platformsList) {
    const domains = Array.isArray(p.domains) ? p.domains : [];
    if (domains.some((d) => clean.includes(String(d).toLowerCase()))) {
      return p;
    }
  }

  if (
    /(terabox|1024tera|mirrobox|nephobox|freeterabox|4funbox|momerybox|tibibox|terashare|iteraplay|teraviralhub)/i.test(
      clean
    )
  ) {
    return (
      platformsList.find((p) => p.category === 'cloud_terabox') || {
        id: 'terabox_app',
        displayName: 'TeraBox Cloud Engine',
        subtitle: 'Free 16x Turbo Stream + MP4',
        category: 'cloud_terabox',
        accentColor: '#06B6D4',
        iconKey: 'terabox',
      }
    );
  }

  return null;
}
