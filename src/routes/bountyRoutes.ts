import { Router } from 'express';
import {
  createBounty,
  listBounties,
  getBounty,
  recordContribution,
  getContributions,
  createMilestone,
  listMilestones,
  getMilestone,
  submitMilestone,
  verifyMilestone,
  releasePayment,
  getVerifications,
  getBountyEvents,
  configureSettlement,
  getSettlements,
  getSettlementById,
  refundBounty,
  completeBounty,
  trackTransaction,
  getTransaction,
  getTreasuryStats,
  streamEvents,
  reconcile,
  getCategoryStatsHandler,
  getAuditLogsHandler,
  getLeaderboardHandler,
  fileDisputeHandler,
  getDisputeHandler,
  resolveDisputeHandler,
  extendMilestoneHandler,
  cancelMilestoneHandler,
} from '../controllers/bountyController.js';

export const bountyRouter = Router();

// Treasury Stats
bountyRouter.get('/stats', getTreasuryStats);

// Categories Stats
bountyRouter.get('/categories/stats', getCategoryStatsHandler);
bountyRouter.get('/audit-logs', getAuditLogsHandler);
bountyRouter.get('/leaderboard', getLeaderboardHandler);

// Bounty Core Routes
bountyRouter.post('/', createBounty);
bountyRouter.get('/', listBounties);
bountyRouter.get('/:id', getBounty);
bountyRouter.post('/:id/contributions', recordContribution);
bountyRouter.get('/:id/contributions', getContributions);
bountyRouter.post('/:id/milestones', createMilestone);
bountyRouter.get('/:id/milestones', listMilestones);
bountyRouter.post('/:id/milestones/:mId/settlement', configureSettlement);
bountyRouter.get('/:id/settlements', getSettlements);
bountyRouter.post('/:id/refund', refundBounty);
bountyRouter.post('/:id/complete', completeBounty);
bountyRouter.get('/:id/events', getBountyEvents);
bountyRouter.post('/:id/milestones/:mId/dispute', fileDisputeHandler);
bountyRouter.get('/:id/milestones/:mId/dispute', getDisputeHandler);
bountyRouter.post('/:id/milestones/:mId/dispute/resolve', resolveDisputeHandler);
bountyRouter.post('/:id/milestones/:mId/extend', extendMilestoneHandler);
bountyRouter.post('/:id/milestones/:mId/cancel', cancelMilestoneHandler);

// Global Milestones router
export const milestoneRouter = Router();
milestoneRouter.get('/:id', getMilestone);
milestoneRouter.post('/:id/submit', submitMilestone);
milestoneRouter.post('/:id/verify', verifyMilestone);
milestoneRouter.post('/:id/release', releasePayment);
milestoneRouter.get('/:id/verifications', getVerifications);

// Settlements router
export const settlementRouter = Router();
settlementRouter.get('/:id', getSettlementById);

// Transactions router
export const transactionRouter = Router();
transactionRouter.get('/:hash', getTransaction);
transactionRouter.post('/:hash', trackTransaction);

// Realtime Events Router
export const eventStreamRouter = Router();
eventStreamRouter.get('/stream', streamEvents);

// Reconciliation Router
export const reconcileRouter = Router();
reconcileRouter.post('/', reconcile);
