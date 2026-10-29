import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/database.js';

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.header('Idempotency-Key');
  if (!key || req.method === 'GET' || req.method === 'HEAD') {
    return next();
  }

  const db = getDatabase();
  const existing = db.prepare('SELECT status_code, response_json FROM idempotency_keys WHERE idempotency_key = ?').get(key) as { status_code: number; response_json: string } | undefined;

  if (existing) {
    try {
      const data = JSON.parse(existing.response_json);
      res.status(existing.status_code).setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENCY').json(data);
      return;
    } catch (_) {}
  }

  // Intercept json send
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    try {
      db.prepare(`
        INSERT OR REPLACE INTO idempotency_keys (idempotency_key, path, status_code, response_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(key, req.path, res.statusCode, JSON.stringify(body), new Date().toISOString());
    } catch (_) {}
    return originalJson(body);
  };

  next();
}
