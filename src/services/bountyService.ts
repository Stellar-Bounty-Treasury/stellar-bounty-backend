import { getDatabase } from '../db/database.js';
import { StellarService, stellarService as defaultStellarService } from './stellar.js';
import { eventIndexer } from './eventIndexer.js';
import { config } from '../config.js';

export interface Bounty {
  id: number;
  contract_id?: string;
  title: string;
  description: string;
  creator_address: string;
  target_amount: number;
  funded_amount: number;
  status: 'open' | 'funded' | 'settled' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: number;
  bounty_id: number;
  contract_milestone_id: number;
  description: string;
  reward_amount: number;
  recipient_address: string;
  status: 'pending' | 'submitted' | 'under_review' | 'approved' | 'paid' | 'rejected';
  approval_threshold: number;
  approvals: number;
  rejections: number;
  submission_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface Contribution {
  id: number;
  bounty_id: number;
  contributor_address: string;
  amount: number;
  transaction_hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
}

export interface Verification {
  id: number;
  milestone_id: number;
  reviewer_address: string;
  decision: 'approve' | 'reject';
  transaction_hash?: string;
  created_at: string;
}

export interface CreateBountyDTO {
  title: string;
  description: string;
  creator_address: string;
  target_amount: number;
  contract_id?: string;
}

export interface CreateMilestoneDTO {
  contract_milestone_id: number;
  description: string;
  reward_amount: number;
  recipient_address: string;
  approval_threshold?: number;
}

export interface RecordContributionDTO {
  contributor_address: string;
  amount: number;
  transaction_hash: string;
}

export class BountyService {
  private stellar: StellarService;

  constructor(stellar?: StellarService) {
    this.stellar = stellar || defaultStellarService;
  }

  public createBounty(data: CreateBountyDTO): Bounty {
    if (!data.title || data.title.trim().length === 0) {
      throw new Error('Bounty title is required.');
    }
    if (!data.description || data.description.trim().length === 0) {
      throw new Error('Bounty description is required.');
    }
    if (!data.creator_address || !this.stellar.isValidAddress(data.creator_address)) {
      throw new Error('Valid Stellar creator address (starting with G) is required.');
    }
    if (typeof data.target_amount !== 'number' || isNaN(data.target_amount) || data.target_amount <= 0) {
      throw new Error('Funding target amount must be a positive number.');
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    const contractId = data.contract_id || config.contractAddress;

    const stmt = db.prepare(`
      INSERT INTO bounties (contract_id, title, description, creator_address, target_amount, funded_amount, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 'open', ?, ?)
    `);

    const info = stmt.run(
      contractId,
      data.title.trim(),
      data.description.trim(),
      data.creator_address.trim(),
      data.target_amount,
      now,
      now
    );

    const bounty = this.getBountyById(Number(info.lastInsertRowid));
    if (!bounty) {
      throw new Error('Failed to retrieve newly created bounty.');
    }
    return bounty;
  }

  public listBounties(): Bounty[] {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT * FROM bounties ORDER BY id DESC`);
    return stmt.all() as Bounty[];
  }

  public getBountyById(id: number): Bounty | null {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT * FROM bounties WHERE id = ?`);
    const row = stmt.get(id);
    return (row as Bounty) || null;
  }

  // --- Level 2 Milestones ---

  public createMilestone(bountyId: number, data: CreateMilestoneDTO): Milestone {
    const bounty = this.getBountyById(bountyId);
    if (!bounty) {
      throw new Error(`Bounty ${bountyId} not found.`);
    }

    if (!data.description || data.description.trim().length === 0) {
      throw new Error('Milestone description is required.');
    }
    if (typeof data.reward_amount !== 'number' || isNaN(data.reward_amount) || data.reward_amount <= 0) {
      throw new Error('Milestone reward amount must be a positive number.');
    }
    if (!data.recipient_address || !this.stellar.isValidAddress(data.recipient_address)) {
      throw new Error('Valid Stellar recipient address (starting with G) is required.');
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    const threshold = data.approval_threshold || 2;

    const stmt = db.prepare(`
      INSERT INTO milestones (bounty_id, contract_milestone_id, description, reward_amount, recipient_address, status, approval_threshold, approvals, rejections, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, 0, 0, ?, ?)
    `);

    const info = stmt.run(
      bountyId,
      data.contract_milestone_id,
      data.description.trim(),
      data.reward_amount,
      data.recipient_address.trim(),
      threshold,
      now,
      now
    );

    return db.prepare(`SELECT * FROM milestones WHERE id = ?`).get(info.lastInsertRowid) as Milestone;
  }

  public listMilestonesForBounty(bountyId: number): Milestone[] {
    const db = getDatabase();
    return db.prepare(`SELECT * FROM milestones WHERE bounty_id = ? ORDER BY id ASC`).all(bountyId) as Milestone[];
  }

  public getMilestoneById(id: number): Milestone | null {
    const db = getDatabase();
    return (db.prepare(`SELECT * FROM milestones WHERE id = ?`).get(id) as Milestone) || null;
  }

  public submitMilestone(
    milestoneId: number,
    submissionReference: string,
    txHash?: string
  ): Milestone {
    const milestone = this.getMilestoneById(milestoneId);
    if (!milestone) throw new Error(`Milestone ${milestoneId} not found.`);

    const db = getDatabase();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE milestones
      SET status = 'submitted', submission_reference = ?, updated_at = ?
      WHERE id = ?
    `).run(submissionReference, now, milestoneId);

    // Record contract event
    eventIndexer.processEvent({
      eventKey: `${txHash || 'sub'}-${milestone.bounty_id}-${milestone.contract_milestone_id}`,
      eventType: 'milestone_submitted',
      bountyId: milestone.bounty_id,
      milestoneId: milestone.contract_milestone_id,
      txHash,
      payload: { submission_ref: submissionReference },
    });

    return this.getMilestoneById(milestoneId)!;
  }

  public verifyMilestone(
    milestoneId: number,
    reviewerAddress: string,
    decision: 'approve' | 'reject',
    txHash?: string
  ): { verification: Verification; milestone: Milestone } {
    const milestone = this.getMilestoneById(milestoneId);
    if (!milestone) throw new Error(`Milestone ${milestoneId} not found.`);

    if (!this.stellar.isValidAddress(reviewerAddress)) {
      throw new Error('Valid Stellar reviewer address is required.');
    }

    const db = getDatabase();

    // Prevent duplicate verification
    const existing = db
      .prepare(`SELECT id FROM verifications WHERE milestone_id = ? AND reviewer_address = ?`)
      .get(milestoneId, reviewerAddress);
    if (existing) {
      throw new Error('Reviewer has already verified this milestone.');
    }

    const now = new Date().toISOString();

    const result = db.transaction(() => {
      const vInfo = db.prepare(`
        INSERT INTO verifications (milestone_id, reviewer_address, decision, transaction_hash, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(milestoneId, reviewerAddress, decision, txHash || null, now);

      const newApprovals = decision === 'approve' ? milestone.approvals + 1 : milestone.approvals;
      const newRejections = decision === 'reject' ? milestone.rejections + 1 : milestone.rejections;
      const newStatus =
        newApprovals >= milestone.approval_threshold ? 'approved' : 'under_review';

      db.prepare(`
        UPDATE milestones
        SET approvals = ?, rejections = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(newApprovals, newRejections, newStatus, now, milestoneId);

      const verification = db
        .prepare(`SELECT * FROM verifications WHERE id = ?`)
        .get(vInfo.lastInsertRowid) as Verification;

      const updatedMilestone = this.getMilestoneById(milestoneId)!;
      return { verification, milestone: updatedMilestone };
    });

    return result();
  }

  public releaseMilestonePayment(milestoneId: number, txHash?: string): Milestone {
    const milestone = this.getMilestoneById(milestoneId);
    if (!milestone) throw new Error(`Milestone ${milestoneId} not found.`);

    if (milestone.status !== 'approved') {
      throw new Error(`Cannot release payment: milestone status is '${milestone.status}', must be 'approved'.`);
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE milestones
      SET status = 'paid', updated_at = ?
      WHERE id = ?
    `).run(now, milestoneId);

    // Record contract event
    eventIndexer.processEvent({
      eventKey: `${txHash || 'paid'}-${milestone.bounty_id}-${milestone.contract_milestone_id}`,
      eventType: 'milestone_paid',
      bountyId: milestone.bounty_id,
      milestoneId: milestone.contract_milestone_id,
      txHash,
      payload: { amount: milestone.reward_amount, recipient: milestone.recipient_address },
    });

    return this.getMilestoneById(milestoneId)!;
  }

  public getVerificationsForMilestone(milestoneId: number): Verification[] {
    const db = getDatabase();
    return db.prepare(`SELECT * FROM verifications WHERE milestone_id = ? ORDER BY id DESC`).all(milestoneId) as Verification[];
  }

  public getEventsForBounty(bountyId: number): any[] {
    const db = getDatabase();
    return db.prepare(`SELECT * FROM contract_events WHERE bounty_id = ? ORDER BY id DESC`).all(bountyId);
  }

  // --- Funding & Contributions ---

  public async recordContribution(
    bountyId: number,
    data: RecordContributionDTO,
    skipVerification: boolean = false
  ): Promise<{ contribution: Contribution; bounty: Bounty }> {
    const db = getDatabase();

    const bounty = this.getBountyById(bountyId);
    if (!bounty) {
      throw new Error(`Bounty with ID ${bountyId} not found.`);
    }

    if (bounty.status === 'cancelled' || bounty.status === 'settled') {
      throw new Error(`Cannot contribute to a bounty with status '${bounty.status}'.`);
    }

    if (!data.contributor_address || !this.stellar.isValidAddress(data.contributor_address)) {
      throw new Error('Valid Stellar contributor address (starting with G) is required.');
    }

    if (typeof data.amount !== 'number' || isNaN(data.amount) || data.amount <= 0) {
      throw new Error('Contribution amount must be a positive number.');
    }

    if (!data.transaction_hash || data.transaction_hash.trim().length !== 64) {
      throw new Error('Valid 64-character transaction hash is required.');
    }

    const txHash = data.transaction_hash.trim().toLowerCase();

    const existing = db.prepare(`SELECT * FROM contributions WHERE transaction_hash = ?`).get(txHash);
    if (existing) {
      throw new Error(`Transaction ${txHash} has already been recorded.`);
    }

    let verifiedAmount = data.amount;
    if (!skipVerification) {
      const verifiedTx = await this.stellar.verifyTransaction(
        txHash,
        data.amount,
        bounty.creator_address
      );
      verifiedAmount = verifiedTx.amount;
    }

    const now = new Date().toISOString();

    const recordTransaction = db.transaction(() => {
      const insertContribution = db.prepare(`
        INSERT INTO contributions (bounty_id, contributor_address, amount, transaction_hash, status, created_at)
        VALUES (?, ?, ?, ?, 'confirmed', ?)
      `);
      const info = insertContribution.run(
        bountyId,
        data.contributor_address.trim(),
        verifiedAmount,
        txHash,
        now
      );

      const newFundedAmount = Math.round((bounty.funded_amount + verifiedAmount) * 10000000) / 10000000;
      const newStatus = newFundedAmount >= bounty.target_amount ? 'funded' : bounty.status;

      const updateBounty = db.prepare(`
        UPDATE bounties
        SET funded_amount = ?, status = ?, updated_at = ?
        WHERE id = ?
      `);
      updateBounty.run(newFundedAmount, newStatus, now, bountyId);

      const contribution = db
        .prepare(`SELECT * FROM contributions WHERE id = ?`)
        .get(info.lastInsertRowid) as Contribution;

      const updatedBounty = db
        .prepare(`SELECT * FROM bounties WHERE id = ?`)
        .get(bountyId) as Bounty;

      // Register event
      eventIndexer.processEvent({
        eventKey: `${txHash}-fund`,
        eventType: 'bounty_funded',
        bountyId,
        txHash,
        payload: { amount: verifiedAmount, contributor: data.contributor_address },
      });

      return { contribution, bounty: updatedBounty };
    });

    return recordTransaction();
  }

  public getContributionsForBounty(bountyId: number): Contribution[] {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT * FROM contributions WHERE bounty_id = ? ORDER BY id DESC`);
    return stmt.all(bountyId) as Contribution[];
  }
}

export const bountyService = new BountyService();
