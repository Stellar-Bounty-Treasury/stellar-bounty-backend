import { Request, Response } from 'express';
import { bountyService } from '../services/bountyService.js';
import { eventIndexer } from '../services/eventIndexer.js';
import { getDatabase } from '../db/database.js';
import { config } from '../config.js';

export async function createBounty(req: Request, res: Response): Promise<void> {
  try {
    const { title, description, creator_address, target_amount, contract_id } = req.body;
    const bounty = bountyService.createBounty({
      title,
      description,
      creator_address,
      target_amount: Number(target_amount),
      contract_id,
    });

    res.status(201).json({
      success: true,
      data: bounty,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to create bounty',
    });
  }
}

export async function listBounties(req: Request, res: Response): Promise<void> {
  try {
    const bounties = bountyService.listBounties();
    res.status(200).json({
      success: true,
      data: bounties,
      count: bounties.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve bounties',
    });
  }
}

export async function getBounty(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(String(rawId), 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid bounty ID.' });
      return;
    }

    const bounty = bountyService.getBountyById(id);
    if (!bounty) {
      res.status(404).json({ success: false, error: `Bounty with ID ${id} not found.` });
      return;
    }

    const contributions = bountyService.getContributionsForBounty(id);
    const milestones = bountyService.listMilestonesForBounty(id);
    const events = bountyService.getEventsForBounty(id);

    res.status(200).json({
      success: true,
      data: {
        ...bounty,
        contributions,
        milestones,
        events,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve bounty',
    });
  }
}

// --- Milestone Handlers ---

export async function createMilestone(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bountyId = parseInt(String(rawId), 10);
    if (isNaN(bountyId)) {
      res.status(400).json({ success: false, error: 'Invalid bounty ID.' });
      return;
    }

    const { contract_milestone_id, description, reward_amount, recipient_address, approval_threshold } = req.body;
    const milestone = bountyService.createMilestone(bountyId, {
      contract_milestone_id: Number(contract_milestone_id || 1),
      description,
      reward_amount: Number(reward_amount),
      recipient_address,
      approval_threshold: approval_threshold ? Number(approval_threshold) : 2,
    });

    res.status(201).json({ success: true, data: milestone });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function listMilestones(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bountyId = parseInt(String(rawId), 10);
    const milestones = bountyService.listMilestonesForBounty(bountyId);
    res.status(200).json({ success: true, data: milestones, count: milestones.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getMilestone(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const milestoneId = parseInt(String(rawId), 10);
    const milestone = bountyService.getMilestoneById(milestoneId);
    if (!milestone) {
      res.status(404).json({ success: false, error: 'Milestone not found' });
      return;
    }
    const verifications = bountyService.getVerificationsForMilestone(milestoneId);
    res.status(200).json({ success: true, data: { ...milestone, verifications } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function submitMilestone(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const milestoneId = parseInt(String(rawId), 10);
    const { submission_reference, transaction_hash } = req.body;

    const milestone = bountyService.submitMilestone(milestoneId, submission_reference, transaction_hash);
    res.status(200).json({ success: true, message: 'Milestone submitted for community verification', data: milestone });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function verifyMilestone(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const milestoneId = parseInt(String(rawId), 10);
    const { reviewer_address, decision, transaction_hash } = req.body;

    const result = bountyService.verifyMilestone(milestoneId, reviewer_address, decision, transaction_hash);
    res.status(201).json({ success: true, message: 'Vote recorded successfully', data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function releasePayment(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const milestoneId = parseInt(String(rawId), 10);
    const { transaction_hash } = req.body;

    const milestone = bountyService.releaseMilestonePayment(milestoneId, transaction_hash);
    res.status(200).json({ success: true, message: 'Milestone payment released successfully', data: milestone });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

export async function getVerifications(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const milestoneId = parseInt(String(rawId), 10);
    const verifications = bountyService.getVerificationsForMilestone(milestoneId);
    res.status(200).json({ success: true, data: verifications, count: verifications.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getBountyEvents(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bountyId = parseInt(String(rawId), 10);
    const events = bountyService.getEventsForBounty(bountyId);
    res.status(200).json({ success: true, data: events, count: events.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function reconcile(req: Request, res: Response): Promise<void> {
  try {
    const { bounty_id } = req.body;
    const result = eventIndexer.reconcileBounty(Number(bounty_id));
    res.status(200).json({ success: true, message: 'Reconciliation completed', data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}

// --- Contributions & Health ---

export async function recordContribution(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(String(rawId), 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid bounty ID.' });
      return;
    }

    const { contributor_address, amount, transaction_hash, skip_verification } = req.body;

    const result = await bountyService.recordContribution(
      id,
      {
        contributor_address,
        amount: Number(amount),
        transaction_hash,
      },
      Boolean(skip_verification)
    );

    res.status(201).json({
      success: true,
      message: 'Contribution confirmed and recorded successfully.',
      data: result,
    });
  } catch (err: any) {
    const statusCode = err.message?.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to record contribution',
    });
  }
}

export async function getContributions(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(String(rawId), 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid bounty ID.' });
      return;
    }

    const contributions = bountyService.getContributionsForBounty(id);
    res.status(200).json({
      success: true,
      data: contributions,
      count: contributions.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve contributions',
    });
  }
}

export async function healthCheck(req: Request, res: Response): Promise<void> {
  try {
    const db = getDatabase();
    const dbCheck = db.prepare('SELECT 1 as alive').get() as { alive: number };

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      network: config.stellarNetwork,
      horizonUrl: config.horizonUrl,
      sorobanRpcUrl: config.sorobanRpcUrl,
      contractAddress: config.contractAddress,
      database: dbCheck?.alive === 1 ? 'connected' : 'disconnected',
      version: '2.0.0',
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message,
    });
  }
}
