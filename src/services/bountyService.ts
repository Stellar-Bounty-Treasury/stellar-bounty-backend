import { getDatabase } from '../db/database.js';
import { StellarService, stellarService as defaultStellarService } from './stellar.js';
import { eventIndexer } from './eventIndexer.js';
import { realtimeService } from './realtimeService.js';
import { config } from '../config.js';

export interface Bounty {
  id: number;
  contract_id?: string;
  title: string;
  description: string;
  creator_address: string;
  target_amount: number;
  funded_amount: number;
  status: 'open' | 'funded' | 'completed' | 'cancelled';
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

export interface SettlementRecipient {
  recipient: string;
  amount: number;
  percentage_bps?: number;
  label?: string;
}

export interface Settlement {
  id: number;
  bounty_id: number;
  milestone_id: number;
  allocation_type: 'fixed' | 'percentage';
  total_amount: number;
  recipients: SettlementRecipient[];
  status: 'pending' | 'authorized' | 'executing' | 'settled' | 'failed';
  transaction_hash?: string;
  created_at: string;
  updated_at: string;
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

export interface ConfigureSettlementDTO {
  allocation_type: 'fixed' | 'percentage';
  recipients: SettlementRecipient[];
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

    realtimeService.broadcast('bounty_created', bounty);
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

  // --- Milestones ---

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

    const milestone = db.prepare(`SELECT * FROM milestones WHERE id = ?`).get(info.lastInsertRowid) as Milestone;
    realtimeService.broadcast('milestone_created', milestone);
    return milestone;
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

    const updated = this.getMilestoneById(milestoneId)!;

    eventIndexer.processEvent({
      eventKey: `${txHash || 'offchain'}-milestone-${milestoneId}-submit`,
      eventType: 'milestone_submitted',
      bountyId: milestone.bounty_id,
      milestoneId: milestone.contract_milestone_id,
      txHash,
      payload: { submission_ref: submissionReference },
    });

    return updated;
  }

  public verifyMilestone(
    milestoneId: number,
    reviewerAddress: string,
    decision: 'approve' | 'reject',
    txHash?: string
  ): { milestone: Milestone; verification: Verification } {
    const milestone = this.getMilestoneById(milestoneId);
    if (!milestone) throw new Error(`Milestone ${milestoneId} not found.`);

    if (!reviewerAddress || !this.stellar.isValidAddress(reviewerAddress)) {
      throw new Error('Valid Stellar reviewer address is required.');
    }

    if (milestone.status !== 'submitted' && milestone.status !== 'under_review') {
      throw new Error(`Milestone is not open for review (status: ${milestone.status}).`);
    }

    const db = getDatabase();
    const existing = db
      .prepare(`SELECT * FROM verifications WHERE milestone_id = ? AND reviewer_address = ?`)
      .get(milestoneId, reviewerAddress);

    if (existing) {
      throw new Error(`Reviewer ${reviewerAddress} has already verified this milestone.`);
    }

    const now = new Date().toISOString();

    const result = db.transaction(() => {
      const ins = db.prepare(`
        INSERT INTO verifications (milestone_id, reviewer_address, decision, transaction_hash, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const vInfo = ins.run(milestoneId, reviewerAddress, decision, txHash || null, now);

      let newApprovals = milestone.approvals;
      let newRejections = milestone.rejections;
      if (decision === 'approve') newApprovals++;
      else newRejections++;

      let newStatus = milestone.status;
      if (newApprovals >= milestone.approval_threshold) {
        newStatus = 'approved';
      } else {
        newStatus = 'under_review';
      }

      db.prepare(`
        UPDATE milestones
        SET approvals = ?, rejections = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(newApprovals, newRejections, newStatus, now, milestoneId);

      const verification = db
        .prepare(`SELECT * FROM verifications WHERE id = ?`)
        .get(vInfo.lastInsertRowid) as Verification;

      const updatedMilestone = this.getMilestoneById(milestoneId)!;

      if (newStatus === 'approved') {
        eventIndexer.processEvent({
          eventKey: `${txHash || 'offchain'}-milestone-${milestoneId}-approved`,
          eventType: 'milestone_approved',
          bountyId: milestone.bounty_id,
          milestoneId: milestone.contract_milestone_id,
          txHash,
          payload: { approvals: newApprovals },
        });
      }

      return { milestone: updatedMilestone, verification };
    });

    return result();
  }

  // --- Level 3 Settlement Router ---

  public configureSettlement(
    bountyId: number,
    milestoneId: number,
    data: ConfigureSettlementDTO
  ): Settlement {
    const bounty = this.getBountyById(bountyId);
    if (!bounty) throw new Error(`Bounty ${bountyId} not found.`);

    const milestone = this.getMilestoneById(milestoneId);
    if (!milestone) throw new Error(`Milestone ${milestoneId} not found.`);
    if (milestone.bounty_id !== bountyId) throw new Error(`Milestone does not belong to bounty.`);
    if (milestone.status === 'paid') throw new Error(`Cannot configure settlement for already paid milestone.`);

    if (!data.recipients || data.recipients.length === 0) {
      throw new Error(`Settlement must contain at least one recipient.`);
    }

    // Check recipients uniqueness and valid addresses
    const seen = new Set<string>();
    let totalAllocated = 0;
    let totalBps = 0;

    for (const item of data.recipients) {
      if (!this.stellar.isValidAddress(item.recipient)) {
        throw new Error(`Invalid Stellar recipient address: ${item.recipient}`);
      }
      if (seen.has(item.recipient)) {
        throw new Error(`Duplicate recipient address: ${item.recipient}`);
      }
      seen.add(item.recipient);

      if (data.allocation_type === 'fixed') {
        if (typeof item.amount !== 'number' || item.amount <= 0) {
          throw new Error(`Fixed allocation recipient amount must be positive.`);
        }
        totalAllocated += item.amount;
      } else {
        const bps = item.percentage_bps || 0;
        if (bps <= 0 || bps > 10000) {
          throw new Error(`Percentage allocation basis points must be between 1 and 10000.`);
        }
        totalBps += bps;
      }
    }

    if (data.allocation_type === 'fixed') {
      const diff = Math.abs(totalAllocated - milestone.reward_amount);
      if (diff > 0.00001) {
        throw new Error(`Total fixed allocation (${totalAllocated} XLM) must equal milestone reward (${milestone.reward_amount} XLM).`);
      }
    } else {
      if (totalBps !== 10000) {
        throw new Error(`Total percentage basis points (${totalBps}) must equal exactly 10000 (100%).`);
      }
      // Compute amounts
      data.recipients = data.recipients.map((r) => ({
        ...r,
        amount: Math.round(((milestone.reward_amount * (r.percentage_bps || 0)) / 10000) * 10000000) / 10000000,
      }));
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO settlements (bounty_id, milestone_id, allocation_type, total_amount, recipients_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      ON CONFLICT(bounty_id, milestone_id) DO UPDATE SET
        allocation_type = excluded.allocation_type,
        total_amount = excluded.total_amount,
        recipients_json = excluded.recipients_json,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      bountyId,
      milestoneId,
      data.allocation_type,
      milestone.reward_amount,
      JSON.stringify(data.recipients),
      now,
      now
    );

    const settlement = this.getSettlementByMilestone(bountyId, milestoneId)!;
    realtimeService.broadcast('settlement_configured', settlement);
    return settlement;
  }

  public getSettlementsForBounty(bountyId: number): Settlement[] {
    const db = getDatabase();
    const rows = db.prepare(`SELECT * FROM settlements WHERE bounty_id = ? ORDER BY id ASC`).all(bountyId) as any[];
    return rows.map((r) => ({
      ...r,
      recipients: JSON.parse(r.recipients_json),
    }));
  }

  public getSettlementById(id: number): Settlement | null {
    const db = getDatabase();
    const row = db.prepare(`SELECT * FROM settlements WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      ...row,
      recipients: JSON.parse(row.recipients_json),
    };
  }

  public getSettlementByMilestone(bountyId: number, milestoneId: number): Settlement | null {
    const db = getDatabase();
    const row = db
      .prepare(`SELECT * FROM settlements WHERE bounty_id = ? AND milestone_id = ?`)
      .get(bountyId, milestoneId) as any;
    if (!row) return null;
    return {
      ...row,
      recipients: JSON.parse(row.recipients_json),
    };
  }

  public executeSettlement(
    bountyId: number,
    milestoneId: number,
    txHash?: string
  ): Settlement {
    const milestone = this.getMilestoneById(milestoneId);
    if (!milestone) throw new Error(`Milestone ${milestoneId} not found.`);
    if (milestone.status !== 'approved') {
      throw new Error("Milestone status must be 'approved' to release payment.");
    }

    const bounty = this.getBountyById(bountyId);
    if (!bounty) throw new Error(`Bounty ${bountyId} not found.`);

    const settlement = this.getSettlementByMilestone(bountyId, milestoneId);
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.transaction(() => {
      // Deduct from bounty funded amount and mark milestone paid
      const newFunded = Math.max(0, bounty.funded_amount - milestone.reward_amount);
      db.prepare(`UPDATE bounties SET funded_amount = ?, updated_at = ? WHERE id = ?`).run(newFunded, now, bountyId);
      db.prepare(`UPDATE milestones SET status = 'paid', updated_at = ? WHERE id = ?`).run(now, milestoneId);

      if (settlement) {
        db.prepare(`
          UPDATE settlements
          SET status = 'settled', transaction_hash = ?, updated_at = ?
          WHERE id = ?
        `).run(txHash || null, now, settlement.id);
      }

      eventIndexer.processEvent({
        eventKey: `${txHash || 'offchain'}-settle-${milestoneId}-done`,
        eventType: 'settlement_completed',
        bountyId,
        milestoneId: milestone.contract_milestone_id,
        txHash,
        payload: {
          total_amount: milestone.reward_amount,
          recipients: settlement ? settlement.recipients : [{ recipient: milestone.recipient_address, amount: milestone.reward_amount }],
        },
      });

      return this.getSettlementByMilestone(bountyId, milestoneId) || {
        id: 0,
        bounty_id: bountyId,
        milestone_id: milestoneId,
        allocation_type: 'fixed' as const,
        total_amount: milestone.reward_amount,
        recipients: [{ recipient: milestone.recipient_address, amount: milestone.reward_amount }],
        status: 'settled' as const,
        transaction_hash: txHash,
        created_at: now,
        updated_at: now,
      };
    });

    return result();
  }

  public refundBounty(bountyId: number, txHash?: string): Bounty {
    const bounty = this.getBountyById(bountyId);
    if (!bounty) throw new Error(`Bounty ${bountyId} not found.`);
    if (bounty.status === 'completed' || bounty.status === 'cancelled') {
      throw new Error(`Bounty is already ${bounty.status}.`);
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE bounties
      SET status = 'cancelled', funded_amount = 0, updated_at = ?
      WHERE id = ?
    `).run(now, bountyId);

    eventIndexer.processEvent({
      eventKey: `${txHash || 'offchain'}-refund-${bountyId}`,
      eventType: 'refund_completed',
      bountyId,
      txHash,
      payload: { refund_amount: bounty.funded_amount },
    });

    return this.getBountyById(bountyId)!;
  }

  public completeBounty(bountyId: number): Bounty {
    const bounty = this.getBountyById(bountyId);
    if (!bounty) throw new Error(`Bounty ${bountyId} not found.`);

    const milestones = this.listMilestonesForBounty(bountyId);
    if (milestones.length === 0) {
      throw new Error(`Cannot complete bounty with no milestones.`);
    }

    const allPaid = milestones.every((m) => m.status === 'paid');
    if (!allPaid) {
      throw new Error(`All milestones must be paid before marking bounty completed.`);
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    db.prepare(`UPDATE bounties SET status = 'completed', updated_at = ? WHERE id = ?`).run(now, bountyId);

    eventIndexer.processEvent({
      eventKey: `complete-bounty-${bountyId}`,
      eventType: 'bounty_completed',
      bountyId,
      payload: { milestone_count: milestones.length },
    });

    return this.getBountyById(bountyId)!;
  }

  public trackTransaction(txHash: string, opType: string, status: string, details?: any): any {
    const db = getDatabase();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO transactions (transaction_hash, operation_type, status, details_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(transaction_hash) DO UPDATE SET
        status = excluded.status,
        details_json = excluded.details_json,
        updated_at = excluded.updated_at
    `).run(
      txHash.toLowerCase(),
      opType,
      status,
      details ? JSON.stringify(details) : null,
      now,
      now
    );

    return this.getTransaction(txHash);
  }

  public getTransaction(txHash: string): any {
    const db = getDatabase();
    const row = db.prepare(`SELECT * FROM transactions WHERE transaction_hash = ?`).get(txHash.toLowerCase()) as any;
    if (!row) return null;
    return {
      ...row,
      details: row.details_json ? JSON.parse(row.details_json) : null,
    };
  }

  public getTreasuryStats(): {
    total_funds: number;
    total_bounties: number;
    active_bounties: number;
    completed_bounties: number;
    pending_milestones: number;
    pending_settlements: number;
    total_distributed: number;
  } {
    const db = getDatabase();
    const totalBounties = (db.prepare(`SELECT COUNT(*) as count FROM bounties`).get() as any).count;
    const activeBounties = (db.prepare(`SELECT COUNT(*) as count FROM bounties WHERE status IN ('open', 'funded')`).get() as any).count;
    const completedBounties = (db.prepare(`SELECT COUNT(*) as count FROM bounties WHERE status = 'completed'`).get() as any).count;
    const totalFunds = (db.prepare(`SELECT COALESCE(SUM(funded_amount), 0) as total FROM bounties`).get() as any).total;
    const pendingMilestones = (db.prepare(`SELECT COUNT(*) as count FROM milestones WHERE status IN ('pending', 'submitted', 'under_review')`).get() as any).count;
    const pendingSettlements = (db.prepare(`SELECT COUNT(*) as count FROM settlements WHERE status IN ('pending', 'authorized', 'executing')`).get() as any).count;
    const totalDistributed = (db.prepare(`SELECT COALESCE(SUM(reward_amount), 0) as total FROM milestones WHERE status = 'paid'`).get() as any).total;

    return {
      total_funds: totalFunds,
      total_bounties: totalBounties,
      active_bounties: activeBounties,
      completed_bounties: completedBounties,
      pending_milestones: pendingMilestones,
      pending_settlements: pendingSettlements,
      total_distributed: totalDistributed,
    };
  }

  public getVerificationsForMilestone(milestoneId: number): Verification[] {
    const db = getDatabase();
    return db.prepare(`SELECT * FROM verifications WHERE milestone_id = ? ORDER BY id DESC`).all(milestoneId) as Verification[];
  }

  public getEventsForBounty(bountyId: number): any[] {
    const db = getDatabase();
    return db.prepare(`SELECT * FROM contract_events WHERE bounty_id = ? ORDER BY id DESC`).all(bountyId);
  }

  public async recordContribution(
    bountyId: number,
    data: RecordContributionDTO,
    skipVerification: boolean = false
  ): Promise<{ contribution: Contribution; bounty: Bounty }> {
    const db = getDatabase();
    const bounty = this.getBountyById(bountyId);
    if (!bounty) throw new Error(`Bounty with ID ${bountyId} not found.`);

    if (bounty.status === 'cancelled' || bounty.status === 'completed') {
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
