// ============================================================================
// STRICT VOLATILE RAM NOTIFICATION BUFFER (ZERO DOCKER / REDIS / SQL OVERHEAD)
// - Every pasted URL lives strictly inside Node.js process RAM (`volatileCardsMap`).
// - ZERO SQL INSERTs & ZERO Disk files occur on paste or [VIEW].
// - Clicking [CLOSE] immediately wipes the entry from RAM (`0` trace).
// ============================================================================

const MAX_LIVE_CARDS = 200;
const CARD_TTL_MS = 2 * 60 * 60 * 1000;

const volatileCardsMap = new Map();
const sseClients = new Set();

export async function initLiveCardBus() {
  return true;
}

function pruneExpiredCards() {
  const cutoff = Date.now() - CARD_TTL_MS;
  for (const [cardId, card] of volatileCardsMap.entries()) {
    if (new Date(card.createdAt).getTime() < cutoff) {
      volatileCardsMap.delete(cardId);
    }
  }
  while (volatileCardsMap.size > MAX_LIVE_CARDS) {
    const oldestKey = volatileCardsMap.keys().next().value;
    volatileCardsMap.delete(oldestKey);
  }
}

function writeSseFrame(res, eventName, payload) {
  try {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    if (typeof res.flush === 'function') {
      res.flush();
    }
  } catch {
    sseClients.delete(res);
  }
}

function broadcastLiveCardEvent(eventName, payload) {
  for (const clientRes of sseClients) {
    writeSseFrame(clientRes, eventName, payload);
  }
}

// Normalized identity of a card so the SAME url never produces two entries
// (paste-capture + analysis both report the same link).
function normalizeCardUrlKey(rawUrl) {
  return String(rawUrl || '')
    .trim()
    .toLowerCase()
    .replace(/#.*$/, '')
    .replace(/\/+$/, '');
}

function cardUrlKeys(card) {
  const keys = new Set();
  const raw = normalizeCardUrlKey(card?.rawUrl);
  const canonical = normalizeCardUrlKey(card?.canonicalUrl);
  if (raw) keys.add(raw);
  if (canonical) keys.add(canonical);
  return keys;
}

function findExistingCardIdFor(card) {
  const incoming = cardUrlKeys(card);
  if (incoming.size === 0) return null;
  for (const [existingId, existingCard] of volatileCardsMap.entries()) {
    if (existingId === card.cardId) continue;
    const existing = cardUrlKeys(existingCard);
    for (const key of incoming) {
      if (existing.has(key)) return existingId;
    }
  }
  return null;
}

export function pushOrUpdateVolatileCard(card) {
  pruneExpiredCards();

  // De-duplicate: one live card per unique URL, updated in place.
  const duplicateId = findExistingCardIdFor(card);
  if (duplicateId) {
    const previous = volatileCardsMap.get(duplicateId);
    const merged = {
      ...previous,
      ...card,
      cardId: duplicateId,
      createdAt: previous.createdAt || card.createdAt,
    };
    volatileCardsMap.set(duplicateId, merged);
    if (card.cardId !== duplicateId && volatileCardsMap.has(card.cardId)) {
      volatileCardsMap.delete(card.cardId);
    }
    broadcastLiveCardEvent('card_updated', merged);
    return merged;
  }

  const existed = volatileCardsMap.has(card.cardId);
  volatileCardsMap.set(card.cardId, card);
  broadcastLiveCardEvent(existed ? 'card_updated' : 'card_added', card);
  return card;
}

export function getAllVolatileCards() {
  pruneExpiredCards();
  return Array.from(volatileCardsMap.values()).sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt))
  );
}

export function getVolatileCardById(cardId) {
  pruneExpiredCards();
  return volatileCardsMap.get(cardId) || null;
}

export function removeVolatileCard(cardId) {
  const existed = volatileCardsMap.delete(cardId);
  if (existed) {
    broadcastLiveCardEvent('card_removed', { cardId });
  }
  return existed;
}

export function clearAllVolatileCards() {
  volatileCardsMap.clear();
  broadcastLiveCardEvent('snapshot', []);
}

export function attachAdminSseClient(req, res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  sseClients.add(res);

  writeSseFrame(res, 'snapshot', getAllVolatileCards());

  const heartbeatTimer = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
      res.flush?.();
    } catch {
      clearInterval(heartbeatTimer);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    sseClients.delete(res);
  });
}
