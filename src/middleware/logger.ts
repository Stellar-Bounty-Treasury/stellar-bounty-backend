import { Request, Response, NextFunction } from 'express';

export function structuredLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const reqId = Math.random().toString(36).substring(2, 9);

  res.on('finish', () => {
    // Exclude SSE keep-alive from cluttering logs
    if (req.path === '/api/events/stream') return;

    const durationMs = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      reqId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
    };

    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
}
