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
  reconcile,
} from '../controllers/bountyController.js';

export const bountyRouter = Router();

// Bounty Routes
bountyRouter.post('/', createBounty);
bountyRouter.get('/', listBounties);
bountyRouter.get('/:id', getBounty);
bountyRouter.post('/:id/contributions', recordContribution);
bountyRouter.get('/:id/contributions', getContributions);
bountyRouter.post('/:id/milestones', createMilestone);
bountyRouter.get('/:id/milestones', listMilestones);
bountyRouter.get('/:id/events', getBountyEvents);

// Global Milestones router
export const milestoneRouter = Router();
milestoneRouter.get('/:id', getMilestone);
milestoneRouter.post('/:id/submit', submitMilestone);
milestoneRouter.post('/:id/verify', verifyMilestone);
milestoneRouter.post('/:id/release', releasePayment);
milestoneRouter.get('/:id/verifications', getVerifications);

// Reconciliation Router
export const reconcileRouter = Router();
reconcileRouter.post('/', reconcile);
