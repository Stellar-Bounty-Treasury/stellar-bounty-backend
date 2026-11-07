import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/database.js';

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.header('Idempotency-Key');
  if (!key || req.method === 'GET' || req.method === 'HEAD') {
    return next();
  }

  const normalizedPath = req.originalUrl || req.path;
  const db = getDatabase();
  const existing = db
    .prepare('SELECT path, status_code, response_json FROM idempotency_keys WHERE idempotency_key = ?')
    .get(key) as { path: string; status_code: number; response_json: string } | undefined;

  if (existing && (existing.path === normalizedPath || existing.path === req.path)) {
    try {
      const data = JSON.parse(existing.response_json);
      res.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENCY');
      res.status(existing.status_code).json(data);
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
      `).run(key, normalizedPath, res.statusCode, JSON.stringify(body), new Date().toISOString());
    } catch (_) {}
    return originalJson(body);
  };

  next();
}
