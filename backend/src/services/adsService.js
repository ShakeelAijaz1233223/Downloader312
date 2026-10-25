// ============================================================================
// ADS + MONETISATION ENGINE  (Round-10)
//
//  - 5 placements: header · belowPlayer · sidebar · inline · footer
//  - 3 ad types per slot: house banner · Google AdSense · custom HTML
//  - Real impression / click tracking (no fake numbers)
//  - Unique visitor sessions hashed from IP (raw IP never stored)
//  - Estimated earnings from a configurable CPM/CPC, plus live "can I earn yet"
//    readiness rules (traffic, unique IPs, users, ad fill)
// ============================================================================
import crypto from 'node:crypto';
import { sqlQuery } from '../db/database.js';

const DEFAULT_CPM_USD = 1.2;      // house/AdSense blend, conservative
const DEFAULT_CPC_USD = 0.08;

export function hashVisitor(ip, ua = '') {
  const salt = process.env.ADS_HASH_SALT || 'ultra-ads-v10';
  return crypto.createHash('sha256').update(`${salt}:${ip}:${ua.slice(0, 80)}`).digest('hex').slice(0, 32);
}

function normalizeSlot(row) {
  return {
    id: Number(row.id),
    slotKey: row.slot_key,
    name: row.name,
    placement: row.placement,
    adType: row.ad_type || 'house',
    headline: row.headline || '',
    body: row.body || '',
    ctaText: row.cta_text || '',
    targetUrl: row.target_url || '',
    imageUrl: row.image_url || '',
    adsenseClient: row.adsense_client || '',
    adsenseSlot: row.adsense_slot || '',
    isActive: Number(row.is_active) === 1,
    weight: Number(row.weight || 10),
    createdAt: row.created_at,
  };
}

export async function listAdSlots({ activeOnly = false } = {}) {
  const rows = await sqlQuery('SELECT * FROM ad_slots ORDER BY id ASC');
  const slots = (rows || []).map(normalizeSlot);
  return activeOnly ? slots.filter((s) => s.isActive) : slots;
}

export async function createAdSlot(payload = {}) {
  const now = new Date().toISOString();
  const values = [
    String(payload.slotKey || `slot_${Date.now()}`).slice(0, 64),
    String(payload.name || 'New Ad Slot').slice(0, 120),
    String(payload.placement || 'inline').slice(0, 32),
    String(payload.adType || 'house').slice(0, 24),
    String(payload.headline || '').slice(0, 160),
    String(payload.body || '').slice(0, 300),
    String(payload.ctaText || '').slice(0, 40),
    String(payload.targetUrl || '').slice(0, 400),
    String(payload.imageUrl || '').slice(0, 600),
    String(payload.adsenseClient || '').slice(0, 40),
    String(payload.adsenseSlot || '').slice(0, 40),
    payload.isActive === false ? 0 : 1,
    Number(payload.weight || 10),
    now,
  ];
  await sqlQuery(
    `INSERT INTO ad_slots (slot_key, name, placement, ad_type, headline, body, cta_text, target_url, image_url, adsense_client, adsense_slot, is_active, weight, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values
  );
  const slots = await listAdSlots();
  return slots.find((s) => s.slotKey === values[0]) || slots[slots.length - 1];
}

export async function updateAdSlot(id, patch = {}) {
  const map = {
    slotKey: 'slot_key',
    name: 'name',
    placement: 'placement',
    adType: 'ad_type',
    headline: 'headline',
    body: 'body',
    ctaText: 'cta_text',
    targetUrl: 'target_url',
    imageUrl: 'image_url',
    adsenseClient: 'adsense_client',
    adsenseSlot: 'adsense_slot',
    weight: 'weight',
  };
  const cols = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (patch[key] === undefined) continue;
    cols.push(`${column} = ?`);
    params.push(patch[key]);
  }
  if (patch.isActive !== undefined) {
    cols.push('is_active = ?');
    params.push(patch.isActive ? 1 : 0);
  }
  if (!cols.length) return null;
  params.push(id);
  await sqlQuery(`UPDATE ad_slots SET ${cols.join(', ')} WHERE id = ?`, params);
  const slots = await listAdSlots();
  return slots.find((s) => String(s.id) === String(id)) || null;
}

export async function deleteAdSlot(id) {
  const res = await sqlQuery('DELETE FROM ad_slots WHERE id = ?', [id]);
  return { deleted: Number(res?.affectedRows || 0) > 0 };
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------
export async function recordAdEvent({ slotKey, eventType, ip, userAgent, pagePath }) {
  if (!slotKey || !['impression', 'click'].includes(eventType)) return { ok: false };
  const revenue = eventType === 'impression' ? DEFAULT_CPM_USD / 1000 : DEFAULT_CPC_USD;
  await sqlQuery(
    `INSERT INTO ad_events (slot_key, event_type, ip_hash, user_agent, page_path, revenue_usd, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      String(slotKey).slice(0, 64),
      eventType,
      hashVisitor(ip, userAgent || ''),
      String(userAgent || '').slice(0, 250),
      String(pagePath || '/').slice(0, 250),
      revenue,
      new Date().toISOString(),
    ]
  );
  return { ok: true, revenue };
}

export async function recordVisitorSession({ ip, userAgent, country = '' }) {
  const hash = hashVisitor(ip, userAgent || '');
  const rows = await sqlQuery('SELECT * FROM visitor_sessions');
  const existing = (rows || []).find((v) => v.ip_hash === hash);
  const now = new Date().toISOString();
  if (existing) {
    // touched through the same INSERT branch (upsert in standby + MySQL)
    await sqlQuery(
      `INSERT INTO visitor_sessions (ip_hash, user_agent, country, last_seen)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE last_seen = VALUES(last_seen), hits = hits + 1`,
      [hash, String(userAgent || '').slice(0, 250), String(country || '').slice(0, 60), now]
    );
    return { isNew: false, hash };
  }
  await sqlQuery(
    `INSERT INTO visitor_sessions (ip_hash, user_agent, country, last_seen)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE last_seen = VALUES(last_seen), hits = hits + 1`,
    [hash, String(userAgent || '').slice(0, 250), String(country || '').slice(0, 60), now]
  );
  return { isNew: true, hash };
}

// ---------------------------------------------------------------------------
// Earnings + live-readiness report
// ---------------------------------------------------------------------------
export async function getAdsAnalytics() {
  const [slots, events, visitors] = await Promise.all([
    listAdSlots(),
    sqlQuery('SELECT * FROM ad_events'),
    sqlQuery('SELECT * FROM visitor_sessions'),
  ]);

  const impressions = (events || []).filter((e) => e.event_type === 'impression');
  const clicks = (events || []).filter((e) => e.event_type === 'click');
  const revenue = (events || []).reduce((sum, e) => sum + Number(e.revenue_usd || 0), 0);

  const activeSlots = slots.filter((s) => s.isActive);
  const configuredSlots = activeSlots.filter(
    (s) => s.adType === 'house' || (s.adsenseClient && s.adsenseSlot) || s.adType === 'custom'
  );

  const uniqueVisitors = (visitors || []).length;
  const today = new Date().toISOString().slice(0, 10);
  const impressionsToday = impressions.filter((e) => String(e.created_at).startsWith(today)).length;
  const visitorsToday = (visitors || []).filter((v) => String(v.last_seen).startsWith(today)).length;

  const ctr = impressions.length ? (clicks.length / impressions.length) * 100 : 0;

  // "Can I earn yet?" — the rules an ad network (and a real audience) needs.
  const readiness = [
    { key: 'ad_slots', label: 'At least 1 active ad slot', pass: configuredSlots.length >= 1, value: `${configuredSlots.length}/${activeSlots.length}` },
    { key: 'unique_visitors', label: '100 unique visitors', pass: uniqueVisitors >= 100, value: uniqueVisitors },
    { key: 'impressions', label: '1,000 impressions', pass: impressions.length >= 1000, value: impressions.length },
    { key: 'clicks', label: '25 clicks', pass: clicks.length >= 25, value: clicks.length },
    { key: 'signed_users', label: '10 registered users', pass: (await countUsers()) >= 10, value: await countUsers() },
  ];

  const perSlot = slots.map((slot) => {
    const imp = impressions.filter((e) => e.slot_key === slot.slotKey).length;
    const clk = clicks.filter((e) => e.slot_key === slot.slotKey).length;
    return {
      slotKey: slot.slotKey,
      name: slot.name,
      placement: slot.placement,
      adType: slot.adType,
      isActive: slot.isActive,
      impressions: imp,
      clicks: clk,
      ctr: imp ? Number(((clk / imp) * 100).toFixed(2)) : 0,
      revenueUsd: Number(
        events
          .filter((e) => e.slot_key === slot.slotKey)
          .reduce((sum, e) => sum + Number(e.revenue_usd || 0), 0)
          .toFixed(4)
      ),
    };
  });

  return {
    slots: perSlot,
    totals: {
      impressions: impressions.length,
      clicks: clicks.length,
      ctr: Number(ctr.toFixed(2)),
      revenueUsd: Number(revenue.toFixed(4)),
      uniqueVisitors,
      visitorsToday,
      impressionsToday,
      projectedMonthlyUsd: Number(((impressions.length || 0) * (DEFAULT_CPM_USD / 1000) * 30).toFixed(2)),
    },
    readiness,
    canEarnNow: readiness.every((rule) => rule.pass),
    model: { cpmUsd: DEFAULT_CPM_USD, cpcUsd: DEFAULT_CPC_USD },
  };
}

async function countUsers() {
  try {
    const rows = await sqlQuery('SELECT COUNT(*) AS cnt FROM users');
    return Number(rows?.[0]?.cnt || 0);
  } catch {
    return 0;
  }
}
