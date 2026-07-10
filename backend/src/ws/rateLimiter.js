// ─── Rate Limiter ────────────────────────────────────────────────────────────
// Small fixed-window limiter keyed by an arbitrary string (we key by
// "ip:messageType"). Now that the server is publicly reachable, this stops
// the cheapest abuse case — a script hammering create_room/join_room to
// exhaust memory or brute-force room codes — without needing a real store.

const buckets = new Map(); // key -> { count, resetAt }

function isAllowed(key, limit, windowMs) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

// Periodic cleanup so the map doesn't grow forever with stale IPs.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

module.exports = { isAllowed };
