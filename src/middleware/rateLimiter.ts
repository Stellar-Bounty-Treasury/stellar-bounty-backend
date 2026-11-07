import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const store: RateLimitStore = {};
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 300; // 300 requests per minute per IP

// Evict expired entries every 60 seconds to prevent unbounded memory growth
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const k of Object.keys(store)) {
    if (store[k].resetTime < now) {
      delete store[k];
    }
  }
}, 60000);
if (cleanupTimer.unref) cleanupTimer.unref();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  // Exclude SSE stream and health checks from rate limiting
  if (req.path === '/api/events/stream' || req.path === '/health' || req.path === '/ready') {
    return next();
  }

  const rawIp = req.socket.remoteAddress || '127.0.0.1';
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : rawIp;
  const now = Date.now();

  // Emergency safety prune if store exceeds 5,000 active entries
  if (Object.keys(store).length > 5000) {
    for (const k of Object.keys(store)) {
      if (store[k].resetTime < now) delete store[k];
    }
  }

  if (!store[ip] || now > store[ip].resetTime) {
    store[ip] = { count: 1, resetTime: now + WINDOW_MS };
    return next();
  }

  store[ip].count++;

  if (store[ip].count > MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please slow down and try again later.',
      retryAfterSeconds: Math.ceil((store[ip].resetTime - now) / 1000),
    });
    return;
  }

  next();
}
