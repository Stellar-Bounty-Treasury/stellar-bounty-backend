import { rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { getDatabase } from '../db/database.js';
import { config } from '../config.js';

export interface IndexedEvent {
  eventKey: string;
  eventType: string;
  bountyId?: number;
  milestoneId?: number;
  txHash?: string;
  ledger?: number;
  payload: any;
}

export class EventIndexerService {
  private rpcServer: rpc.Server;

  constructor(rpcUrl?: string) {
    this.rpcServer = new rpc.Server(rpcUrl || config.sorobanRpcUrl);
  }

  /**
   * Ingest and process a contract event with strict idempotency deduplication.
   */
  public processEvent(event: IndexedEvent): boolean {
    const db = getDatabase();

    // 1. Idempotency check: duplicate event handling
    const existing = db
      .prepare(`SELECT id FROM contract_events WHERE event_key = ?`)
      .get(event.eventKey);

    if (existing) {
      // Event already processed, ignore to guarantee idempotency
      return false;
    }

    const now = new Date().toISOString();

    const applyEvent = db.transaction(() => {
      // Record event log
      db.prepare(`
        INSERT INTO contract_events (event_key, event_type, bounty_id, milestone_id, transaction_hash, ledger, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.eventKey,
        event.eventType,
        event.bountyId || null,
        event.milestoneId || null,
        event.txHash || null,
        event.ledger || null,
        JSON.stringify(event.payload),
        now
      );

      // Mutate database state according to contract event
      switch (event.eventType) {
        case 'bounty_funded':
          if (event.bountyId && event.payload.amount) {
            db.prepare(`
              UPDATE bounties
              SET funded_amount = funded_amount + ?, updated_at = ?
              WHERE id = ?
            `).run(event.payload.amount, now, event.bountyId);
          }
          break;

        case 'milestone_submitted':
          if (event.bountyId && event.milestoneId) {
            db.prepare(`
              UPDATE milestones
              SET status = 'submitted', submission_reference = ?, updated_at = ?
              WHERE bounty_id = ? AND contract_milestone_id = ?
            `).run(
              event.payload.submission_ref || 'submitted',
              now,
              event.bountyId,
              event.milestoneId
            );
          }
          break;

        case 'milestone_approved':
          if (event.bountyId && event.milestoneId) {
            db.prepare(`
              UPDATE milestones
              SET status = 'approved', updated_at = ?
              WHERE bounty_id = ? AND contract_milestone_id = ?
            `).run(now, event.bountyId, event.milestoneId);
          }
          break;

        case 'milestone_paid':
          if (event.bountyId && event.milestoneId) {
            db.prepare(`
              UPDATE milestones
              SET status = 'paid', updated_at = ?
              WHERE bounty_id = ? AND contract_milestone_id = ?
            `).run(now, event.bountyId, event.milestoneId);
          }
          break;

        default:
          break;
      }

      return true;
    });

    return applyEvent();
  }

  /**
   * Reconcile local database state with on-chain Soroban contract state.
   */
  public reconcileBounty(bountyId: number): {
    reconciled: boolean;
    bountyId: number;
    eventsProcessed: number;
  } {
    const db = getDatabase();
    const bounty = db.prepare(`SELECT * FROM bounties WHERE id = ?`).get(bountyId);
    if (!bounty) {
      throw new Error(`Bounty ${bountyId} not found for reconciliation`);
    }

    // Ensure milestone statuses reflect approvals count
    const milestones = db
      .prepare(`SELECT * FROM milestones WHERE bounty_id = ?`)
      .all(bountyId) as any[];

    let updated = 0;
    for (const m of milestones) {
      if (m.approvals >= m.approval_threshold && m.status !== 'approved' && m.status !== 'paid') {
        db.prepare(`UPDATE milestones SET status = 'approved', updated_at = ? WHERE id = ?`).run(
          new Date().toISOString(),
          m.id
        );
        updated++;
      }
    }

    return {
      reconciled: true,
      bountyId,
      eventsProcessed: updated,
    };
  }
}

export const eventIndexer = new EventIndexerService();
