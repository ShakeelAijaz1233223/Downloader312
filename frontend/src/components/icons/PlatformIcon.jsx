import React from 'react';
import { GraduationCap, Cloud, Film, Tv, ShieldAlert } from 'lucide-react';

function deriveSmartBadgeCode(platform, fallbackKey) {
  const name = String(platform?.displayName || fallbackKey || 'WEB').trim();
  const clean = name.replace(/[^a-zA-Z0-9\s.-]/g, '').trim();
  const words = clean.split(/[\s.-]+/).filter(Boolean);
  if (words.length >= 2) {
    const c = `${words[0][0]}${words[1][0]}`.toUpperCase();
    return c;
  }
  const single = words[0] || 'VD';
  // Prefer uppercase capital letters inside CamelCase (e.g. JustWatch -> JW, FMovies -> FM, PornHub -> PH)
  const caps = single.replace(/[^A-Z0-9]/g, '');
  if (caps.length >= 2 && caps.length <= 3) return caps;
  return single.slice(0, 3).toUpperCase();
}

export function PlatformIcon({ platform, iconKey, customSvg, color, size = 22, className = '' }) {
  const id = platform?.id || '';
  const key = iconKey || platform?.iconKey || 'globe';
  const accent = color || platform?.accentColor || '#06B6D4';
  const cat = platform?.category || '';
  const rawSvg = customSvg || platform?.iconSvg || platform?.customSvg;

  if (rawSvg && typeof rawSvg === 'string' && rawSvg.trim().startsWith('<svg')) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size, color: accent }}
        dangerouslySetInnerHTML={{ __html: rawSvg }}
        aria-hidden="true"
      />
    );
  }

  // Dedicated Brand Vector SVGs for Top Global & TeraBox Platforms
  if (key === 'youtube' || id === 'youtube') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect x="2" y="4.5" width="20" height="15" rx="4.5" fill="#FF0033" />
        <path d="M10 8.6L15.8 12L10 15.4V8.6Z" fill="#FFFFFF" />
      </svg>
    );
  }
  if (key === 'shorts' || id === 'youtube_shorts') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect x="4" y="2" width="16" height="20" rx="5.2" fill="#FF2E54" />
        <path d="M10.2 8.4L15.5 12L10.2 15.6V8.4Z" fill="#FFFFFF" />
      </svg>
    );
  }
  if (key === 'facebook' || id === 'facebook') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5.5" fill="#1877F2" />
        <path
          d="M13.6 20V13H16L16.4 10.2H13.6V8.4C13.6 7.6 13.9 7 15 7H16.5V4.5C16.2 4.5 15.3 4.4 14.3 4.4C12.1 4.4 10.7 5.7 10.7 8.1V10.2H8.2V13H10.7V20H13.6Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }
  if (key === 'instagram' || id === 'instagram') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="igGradV8" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F58529" />
            <stop offset="50%" stopColor="#DD2A7B" />
            <stop offset="100%" stopColor="#8134AF" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#igGradV8)" />
        <circle cx="12" cy="12" r="4.2" stroke="#FFFFFF" strokeWidth="2" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="#FFFFFF" />
      </svg>
    );
  }
  if (key === 'tiktok' || id === 'tiktok' || id === 'douyin') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5.5" fill="#0B1120" stroke={accent} strokeWidth="1.6" />
        <path
          d="M14.2 6V14.2C14.2 15.6 13.1 16.7 11.7 16.7C10.3 16.7 9.2 15.6 9.2 14.2C9.2 12.9 10.2 11.8 11.5 11.7V9.4C8.9 9.5 6.9 11.6 6.9 14.2C6.9 16.9 9 19 11.7 19C14.4 19 16.5 16.9 16.5 14.2V10.4C17.4 11 18.5 11.3 19.6 11.3V9C17.9 9 16.5 7.7 16.5 6H14.2Z"
          fill="#2DD4BF"
        />
      </svg>
    );
  }
  if (key === 'x' || id === 'twitter_x') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5.5" fill="#0B1120" stroke="#38BDF8" strokeWidth="1.4" />
        <path d="M6.8 6.5L11.1 12.2L6.6 17.5H8.5L12 13.4L15.1 17.5H17.4L12.8 11.4L17 6.5H15.1L11.9 10.2L9.1 6.5H6.8Z" fill="#F8FAFC" />
      </svg>
    );
  }
  if (key === 'terabox' || key === 'terashare' || id.includes('tera') || id.includes('box')) {
    const shortTag = deriveSmartBadgeCode(platform, key).slice(0, 2);
    return (
      <span
        className={`relative inline-flex items-center justify-center rounded-lg font-black text-white shadow-sm shrink-0 ${className}`}
        style={{
          width: size + 4,
          height: size + 4,
          background: `linear-gradient(135deg, ${accent}, #0284C7)`,
          boxShadow: `0 4px 12px ${accent}55`,
        }}
        aria-hidden="true"
      >
        <Cloud size={Math.round(size * 0.62)} strokeWidth={2.3} />
        <span className="absolute -bottom-1 -right-1 rounded px-1 text-[7px] font-black bg-slate-950 text-cyan-300 border border-cyan-400/40 leading-tight">
          {shortTag}
        </span>
      </span>
    );
  }

  // Unique Custom Monogram + Category Emblem Badge for Every Supported Platform!
  const code = deriveSmartBadgeCode(platform, key);
  const SubIcon =
    cat === 'education'
      ? GraduationCap
      : cat === 'video'
      ? Film
      : cat === 'cloud_terabox'
      ? Cloud
      : cat === 'adult_18'
      ? ShieldAlert
      : Tv;

  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-lg font-extrabold tracking-tight text-white shrink-0 select-none ${className}`}
      style={{
        width: size + 4,
        height: size + 4,
        background: `linear-gradient(145deg, ${accent}, ${accent}AA)`,
        boxShadow: `0 4px 14px ${accent}44`,
        fontSize: Math.max(9, Math.round(size * (code.length >= 3 ? 0.38 : 0.44))),
      }}
      aria-hidden="true"
    >
      {code}
      <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-slate-950 border border-white/25 flex items-center justify-center text-white/90">
        <SubIcon size={8} />
      </span>
    </span>
  );
}
