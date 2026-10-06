import { getDatabase } from '../db/database.js';
import { StellarService, stellarService as defaultStellarService } from './stellar.js';

export interface Bounty {
  id: number;
  title: string;
  description: string;
  creator_address: string;
  target_amount: number;
  funded_amount: number;
  status: 'open' | 'funded' | 'settled' | 'cancelled';
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

export interface CreateBountyDTO {
  title: string;
  description: string;
  creator_address: string;
  target_amount: number;
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

    const stmt = db.prepare(`
      INSERT INTO bounties (title, description, creator_address, target_amount, funded_amount, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 'open', ?, ?)
    `);

    const info = stmt.run(
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

  public async recordContribution(
    bountyId: number,
    data: RecordContributionDTO,
    skipVerification: boolean = false
  ): Promise<{ contribution: Contribution; bounty: Bounty }> {
    const db = getDatabase();

    // 1. Validate Bounty existence
    const bounty = this.getBountyById(bountyId);
    if (!bounty) {
      throw new Error(`Bounty with ID ${bountyId} not found.`);
    }

    if (bounty.status === 'cancelled' || bounty.status === 'settled') {
      throw new Error(`Cannot contribute to a bounty with status '${bounty.status}'.`);
    }

    // 2. Validate Contributor & Amount
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

    // 3. Prevent duplicate transaction submission (Idempotency)
    const existing = db.prepare(`SELECT * FROM contributions WHERE transaction_hash = ?`).get(txHash);
    if (existing) {
      throw new Error(`Transaction ${txHash} has already been recorded.`);
    }

    // 4. Stellar Testnet On-Chain Verification
    let verifiedAmount = data.amount;
    if (!skipVerification) {
      const verifiedTx = await this.stellar.verifyTransaction(
        txHash,
        data.amount,
        bounty.creator_address
      );
      verifiedAmount = verifiedTx.amount;
    }

    // 5. Atomic database persistence
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
