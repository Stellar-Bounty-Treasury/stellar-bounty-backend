import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    if (config.nodeEnv === 'test') {
      return next();
    }
    res.status(401).json({ success: false, error: 'Authorization header required' });
    return;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const validSecret = process.env.ADMIN_SECRET || 'stellar-bounty-admin-secret';

  if (!token) {
    res.status(401).json({ success: false, error: 'Authorization token required' });
    return;
  }

  if (token !== validSecret && config.nodeEnv === 'production') {
    res.status(403).json({ success: false, error: 'Forbidden: Invalid administrative credentials' });
    return;
  }

  next();
}
