import { Request, Response, NextFunction } from 'express';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = req.header('X-Request-ID');
  const reqId = existing || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  res.setHeader('X-Request-ID', reqId);
  (req as any).requestId = reqId;
  next();
}
