import { Request, Response } from 'express';
import { bountyService } from '../services/bountyService.js';
import { getDatabase } from '../db/database.js';
import { config } from '../config.js';

export async function createBounty(req: Request, res: Response): Promise<void> {
  try {
    const { title, description, creator_address, target_amount } = req.body;
    const bounty = bountyService.createBounty({
      title,
      description,
      creator_address,
      target_amount: Number(target_amount),
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

    res.status(200).json({
      success: true,
      data: {
        ...bounty,
        contributions,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve bounty',
    });
  }
}

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
      database: dbCheck?.alive === 1 ? 'connected' : 'disconnected',
      version: '1.0.0',
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message,
    });
  }
}
