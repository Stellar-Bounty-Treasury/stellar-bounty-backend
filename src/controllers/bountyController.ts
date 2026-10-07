import { Request, Response } from 'express';
import { bountyService } from '../services/bountyService.js';
import { eventIndexer } from '../services/eventIndexer.js';
import { realtimeService } from '../services/realtimeService.js';
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

    const milestones = bountyService.listMilestonesForBounty(id);
    const contributions = bountyService.getContributionsForBounty(id);
    const settlements = bountyService.getSettlementsForBounty(id);

    res.status(200).json({
      success: true,
      data: {
        ...bounty,
        milestones,
        contributions,
        settlements,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve bounty details',
    });
  }
}

export async function createMilestone(req: Request, res: Response): Promise<void> {
  try {
    const rawBountyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bountyId = parseInt(String(rawBountyId), 10);
    if (isNaN(bountyId)) {
      res.status(400).json({ success: false, error: 'Invalid bounty ID.' });
      return;
    }

    const { contract_milestone_id, description, reward_amount, recipient_address, approval_threshold } = req.body;
    const milestone = bountyService.createMilestone(bountyId, {
      contract_milestone_id: Number(contract_milestone_id),
      description,
      reward_amount: Number(reward_amount),
      recipient_address,
      approval_threshold: approval_threshold ? Number(approval_threshold) : 2,
    });

    res.status(201).json({
      success: true,
      data: milestone,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to create milestone',
    });
  }
}

export async function listMilestones(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bountyId = parseInt(String(rawId), 10);
    if (isNaN(bountyId)) {
      res.status(400).json({ success: false, error: 'Invalid bounty ID.' });
      return;
    }

    const milestones = bountyService.listMilestonesForBounty(bountyId);
    res.status(200).json({
      success: true,
      data: milestones,
      count: milestones.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve milestones',
    });
  }
}

export async function getMilestone(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(String(rawId), 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid milestone ID.' });
      return;
    }

    const milestone = bountyService.getMilestoneById(id);
    if (!milestone) {
      res.status(404).json({ success: false, error: `Milestone with ID ${id} not found.` });
      return;
    }

    const verifications = bountyService.getVerificationsForMilestone(id);
    const settlement = bountyService.getSettlementByMilestone(milestone.bounty_id, id);

    res.status(200).json({
      success: true,
      data: {
        ...milestone,
        verifications,
        settlement,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve milestone',
    });
  }
}

export async function submitMilestone(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(String(rawId), 10);
    const { submission_reference, tx_hash } = req.body;

    if (!submission_reference) {
      res.status(400).json({ success: false, error: 'Submission reference (PR / CID) is required.' });
      return;
    }

    const milestone = bountyService.submitMilestone(id, submission_reference, tx_hash);
    res.status(200).json({
      success: true,
      data: milestone,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to submit milestone',
    });
  }
}

export async function verifyMilestone(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(String(rawId), 10);
    const { reviewer_address, decision, tx_hash } = req.body;

    if (!reviewer_address || !['approve', 'reject'].includes(decision)) {
      res.status(400).json({ success: false, error: 'Valid reviewer address and decision (approve/reject) required.' });
      return;
    }

    const result = bountyService.verifyMilestone(id, reviewer_address, decision, tx_hash);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to record milestone verification',
    });
  }
}

// --- Programmable Settlement Router Handlers ---

export async function configureSettlement(req: Request, res: Response): Promise<void> {
  try {
    const rawBountyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bountyId = parseInt(String(rawBountyId), 10);

    const rawMilestoneId = Array.isArray(req.params.mId) ? req.params.mId[0] : req.params.mId;
    const milestoneId = parseInt(String(rawMilestoneId), 10);

    const { allocation_type, recipients } = req.body;

    if (!allocation_type || !['fixed', 'percentage'].includes(allocation_type)) {
      res.status(400).json({ success: false, error: "allocation_type must be 'fixed' or 'percentage'" });
      return;
    }

    const settlement = bountyService.configureSettlement(bountyId, milestoneId, {
      allocation_type,
      recipients,
    });

    res.status(201).json({
      success: true,
      data: settlement,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to configure settlement router',
    });
  }
}

export async function getSettlements(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bountyId = parseInt(String(rawId), 10);

    const settlements = bountyService.getSettlementsForBounty(bountyId);
    res.status(200).json({
      success: true,
      data: settlements,
      count: settlements.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve settlements',
    });
  }
}

export async function getSettlementById(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(String(rawId), 10);

    const settlement = bountyService.getSettlementById(id);
    if (!settlement) {
      res.status(404).json({ success: false, error: `Settlement ${id} not found.` });
      return;
    }

    res.status(200).json({
      success: true,
      data: settlement,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve settlement',
    });
  }
}

export async function releasePayment(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const milestoneId = parseInt(String(rawId), 10);
    const { tx_hash } = req.body;

    const milestone = bountyService.getMilestoneById(milestoneId);
    if (!milestone) {
      res.status(404).json({ success: false, error: 'Milestone not found' });
      return;
    }

    const settlement = bountyService.executeSettlement(milestone.bounty_id, milestoneId, tx_hash);
    const updated = bountyService.getMilestoneById(milestoneId)!;
    res.status(200).json({
      success: true,
      data: {
        ...updated,
        status: 'paid',
        settlement,
      },
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to release payment',
    });
  }
}

export async function refundBounty(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bountyId = parseInt(String(rawId), 10);
    const { tx_hash } = req.body;

    const bounty = bountyService.refundBounty(bountyId, tx_hash);
    res.status(200).json({
      success: true,
      data: bounty,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to refund bounty',
    });
  }
}

export async function completeBounty(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bountyId = parseInt(String(rawId), 10);

    const bounty = bountyService.completeBounty(bountyId);
    res.status(200).json({
      success: true,
      data: bounty,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to complete bounty',
    });
  }
}

export async function recordContribution(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const bountyId = parseInt(String(rawId), 10);
    const { contributor_address, amount, transaction_hash, skip_verification } = req.body;

    const result = await bountyService.recordContribution(
      bountyId,
      {
        contributor_address,
        amount: Number(amount),
        transaction_hash,
      },
      skip_verification === true
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to record contribution',
    });
  }
}

export async function getContributions(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(String(rawId), 10);

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

export async function getVerifications(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(String(rawId), 10);

    const verifications = bountyService.getVerificationsForMilestone(id);
    res.status(200).json({
      success: true,
      data: verifications,
      count: verifications.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve verifications',
    });
  }
}

export async function getBountyEvents(req: Request, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(String(rawId), 10);

    const events = bountyService.getEventsForBounty(id);
    res.status(200).json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve bounty events',
    });
  }
}

export async function trackTransaction(req: Request, res: Response): Promise<void> {
  try {
    const rawHash = Array.isArray(req.params.hash) ? req.params.hash[0] : req.params.hash;
    const hash = String(rawHash);
    const { operation_type, status, details } = req.body;

    const tx = bountyService.trackTransaction(hash, operation_type, status, details);
    res.status(200).json({
      success: true,
      data: tx,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to track transaction',
    });
  }
}

export async function getTransaction(req: Request, res: Response): Promise<void> {
  try {
    const rawHash = Array.isArray(req.params.hash) ? req.params.hash[0] : req.params.hash;
    const hash = String(rawHash);
    const tx = bountyService.getTransaction(hash);

    if (!tx) {
      res.status(404).json({ success: false, error: `Transaction ${hash} not tracked.` });
      return;
    }

    res.status(200).json({
      success: true,
      data: tx,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve transaction status',
    });
  }
}

export async function getTreasuryStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = bountyService.getTreasuryStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve treasury statistics',
    });
  }
}

export async function streamEvents(req: Request, res: Response): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  realtimeService.addClient(res);
}

export async function reconcile(req: Request, res: Response): Promise<void> {
  try {
    const { bounty_id } = req.body;
    if (!bounty_id) {
      res.status(400).json({ success: false, error: 'bounty_id is required' });
      return;
    }

    const result = eventIndexer.reconcileBounty(Number(bounty_id));
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Reconciliation failed',
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
      service: 'stellar-bounty-backend',
      version: '3.0.0',
      network: config.stellarNetwork,
      contractAddress: config.contractAddress,
      horizonUrl: config.horizonUrl,
      sorobanRpcUrl: config.sorobanRpcUrl,
      database: dbCheck?.alive === 1 ? 'connected' : 'disconnected',
      realtime_clients: realtimeService.getClientCount(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message,
    });
  }
}

export async function readyCheck(req: Request, res: Response): Promise<void> {
  try {
    const db = getDatabase();
    const dbCheck = db.prepare('SELECT 1 as alive').get() as { alive: number };
    const isDbReady = dbCheck?.alive === 1;

    if (!isDbReady) {
      res.status(503).json({ ready: false, reason: 'Database unready' });
      return;
    }

    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString(),
      network: config.stellarNetwork,
      contractAddress: config.contractAddress,
      sorobanRpcUrl: config.sorobanRpcUrl,
      horizonUrl: config.horizonUrl,
    });
  } catch (err: any) {
    res.status(503).json({
      ready: false,
      error: err.message,
    });
  }
}
