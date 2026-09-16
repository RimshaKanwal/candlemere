// A small in-memory rate limiter.
//
// Deliberately dependency-free and per-process: every room already lives in
// this one process's memory, so a shared store would buy nothing until the
// server itself is horizontally scaled. If that day comes, this is the piece
// to move to Redis.

export function createRateLimiter({ windowMs, max, message }) {
  const buckets = new Map(); // ip -> { count, resetAt }

  // Sweep expired buckets, or a long-running server accumulates one entry per
  // IP it has ever seen. unref() keeps this timer from holding the process up.
  setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(ip);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || "unknown";
    const bucket = buckets.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: message || `Too many requests. Try again in ${retryAfter}s.` });
    }
    next();
  };
}
