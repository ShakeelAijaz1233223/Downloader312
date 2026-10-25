import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/apiClient';

// ============================================================================
// REAL AD SLOT — renders an active ad, counts a real impression once it is
// actually visible, and a real click when the user opens it.
// Types: house banner · Google AdSense · custom HTML.
// ============================================================================

let cachedSlots = null;
let cachedAt = 0;

export async function fetchAdSlots({ force = false } = {}) {
  if (!force && cachedSlots && Date.now() - cachedAt < 120000) return cachedSlots;
  try {
    const res = await apiRequest('/ads/slots');
    cachedSlots = res?.slots || [];
    cachedAt = Date.now();
    return cachedSlots;
  } catch {
    return [];
  }
}

function track(slotKey, eventType) {
  try {
    apiRequest('/ads/event', {
      method: 'POST',
      body: JSON.stringify({
        slotKey,
        eventType,
        pagePath: typeof window !== 'undefined' ? window.location.pathname : '/',
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* tracking must never break the UI */
  }
}

export function useAdSlot(placement) {
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchAdSlots().then((slots) => {
      if (!alive) return;
      setSlot((slots || []).find((s) => s.placement === placement) || null);
    });
    return () => {
      alive = false;
    };
  }, [placement]);

  return slot;
}

export function AdSlot({ placement, className = '', compact = false }) {
  const slot = useAdSlot(placement);
  const ref = useRef(null);
  const counted = useRef(false);
  const [adsenseReady, setAdsenseReady] = useState(false);

  useEffect(() => {
    if (!slot || counted.current || !ref.current) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !counted.current) {
          counted.current = true;
          track(slot.slotKey, 'impression');
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [slot]);

  // Google AdSense (only if the admin filled client + slot ids)
  useEffect(() => {
    if (slot?.adType !== 'adsense' || !slot?.adsenseClient || !slot?.adsenseSlot) return;
    const scriptId = 'adsbygoogle-js';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        slot.adsenseClient
      )}`;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
      script.onload = () => setAdsenseReady(true);
    } else {
      setAdsenseReady(true);
    }
  }, [slot]);

  useEffect(() => {
    if (!adsenseReady || slot?.adType !== 'adsense') return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* AdSense still loading */
    }
  }, [adsenseReady, slot]);

  if (!slot || !slot.isActive) return null;

  const onOpen = () => track(slot.slotKey, 'click');
  const shell =
    'w-full rounded-xl border border-slate-200 bg-white/80 overflow-hidden ' + className;

  if (slot.adType === 'adsense') {
    return (
      <div ref={ref} className={shell}>
        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
          Advertisement
        </div>
        <ins
          className="adsbygoogle block"
          style={{ display: 'block' }}
          data-ad-client={slot.adsenseClient}
          data-ad-slot={slot.adsenseSlot}
          data-ad-format={compact ? 'auto' : 'horizontal'}
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  if (slot.adType === 'custom') {
    return (
      <div ref={ref} className={shell}>
        <div
          className="px-3 py-2 text-xs text-slate-600"
          dangerouslySetInnerHTML={{ __html: slot.body || '' }}
        />
      </div>
    );
  }

  // House banner (default) — clean studio style
  return (
    <div ref={ref} className={shell}>
      <a
        href={slot.targetUrl || '/'}
        onClick={onOpen}
        target={/^https?:/i.test(slot.targetUrl || '') ? '_blank' : undefined}
        rel="noopener noreferrer sponsored"
        className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 transition-colors"
      >
        {slot.imageUrl ? (
          <img
            src={slot.imageUrl}
            alt={slot.headline || 'Sponsored'}
            className="h-10 w-10 rounded-lg object-cover border border-slate-200"
          />
        ) : (
          <span className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white grid place-items-center text-[11px] font-black">
            AD
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-slate-800 truncate">
            {slot.headline || slot.name}
          </span>
          {!compact && slot.body ? (
            <span className="block text-[11px] text-slate-500 truncate">{slot.body}</span>
          ) : null}
        </span>
        {slot.ctaText ? (
          <span className="shrink-0 rounded-lg bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1">
            {slot.ctaText}
          </span>
        ) : null}
      </a>
      <div className="px-3.5 pb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-300">
        Sponsored
      </div>
    </div>
  );
}

export default AdSlot;
