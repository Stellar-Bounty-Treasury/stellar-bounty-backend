import { Router } from 'express';
import {
  createBounty,
  listBounties,
  getBounty,
  recordContribution,
  getContributions,
} from '../controllers/bountyController.js';

export const bountyRouter = Router();

bountyRouter.post('/', createBounty);
bountyRouter.get('/', listBounties);
bountyRouter.get('/:id', getBounty);
bountyRouter.post('/:id/contributions', recordContribution);
bountyRouter.get('/:id/contributions', getContributions);
