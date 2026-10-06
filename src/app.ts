import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config.js';
import {
  bountyRouter,
  milestoneRouter,
  settlementRouter,
  transactionRouter,
  eventStreamRouter,
  reconcileRouter,
} from './routes/bountyRoutes.js';
import { healthCheck, readyCheck } from './controllers/bountyController.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { structuredLogger } from './middleware/logger.js';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use(structuredLogger);
  app.use(rateLimiter);

  // Health and Readiness checks
  app.get('/health', healthCheck);
  app.get('/ready', readyCheck);

  // API Routes
  app.use('/api/bounties', bountyRouter);
  app.use('/api/milestones', milestoneRouter);
  app.use('/api/settlements', settlementRouter);
  app.use('/api/transactions', transactionRouter);
  app.use('/api/events', eventStreamRouter);
  app.use('/api/reconcile', reconcileRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `Cannot ${req.method} ${req.path}`,
    });
  });

  // Global error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  });

  return app;
}

export const app = createApp();
