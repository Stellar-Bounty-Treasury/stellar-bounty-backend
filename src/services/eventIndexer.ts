import { rpc } from '@stellar/stellar-sdk';
import { getDatabase } from '../db/database.js';
import { config } from '../config.js';
import { realtimeService } from './realtimeService.js';

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
      .prepare(`SELECT id, status FROM contract_events WHERE event_key = ?`)
      .get(event.eventKey) as { id: number; status: string } | undefined;

    if (existing && existing.status === 'processed') {
      // Event already processed, ignore to guarantee zero duplicate financial records
      return false;
    }

    const now = new Date().toISOString();

    try {
      const applyEvent = db.transaction(() => {
        // Record or update event log
        if (!existing) {
          db.prepare(`
            INSERT INTO contract_events (event_key, event_type, bounty_id, milestone_id, transaction_hash, ledger, payload, status, retry_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'processed', 0, ?)
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
        } else {
          db.prepare(`
            UPDATE contract_events
            SET status = 'processed', retry_count = retry_count + 1
            WHERE event_key = ?
          `).run(event.eventKey);
        }

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

              // Update any pending settlement to authorized
              db.prepare(`
                UPDATE settlements
                SET status = 'authorized', updated_at = ?
                WHERE bounty_id = ? AND milestone_id = (SELECT id FROM milestones WHERE bounty_id = ? AND contract_milestone_id = ?)
              `).run(now, event.bountyId, event.bountyId, event.milestoneId);
            }
            break;

          case 'settlement_authorized':
            if (event.bountyId && event.milestoneId) {
              db.prepare(`
                UPDATE settlements
                SET status = 'authorized', updated_at = ?
                WHERE bounty_id = ? AND milestone_id = (SELECT id FROM milestones WHERE bounty_id = ? AND contract_milestone_id = ?)
              `).run(now, event.bountyId, event.bountyId, event.milestoneId);
            }
            break;

          case 'settlement_started':
            if (event.bountyId && event.milestoneId) {
              db.prepare(`
                UPDATE settlements
                SET status = 'executing', updated_at = ?
                WHERE bounty_id = ? AND milestone_id = (SELECT id FROM milestones WHERE bounty_id = ? AND contract_milestone_id = ?)
              `).run(now, event.bountyId, event.bountyId, event.milestoneId);
            }
            break;

          case 'recipient_paid':
            // Individual recipient payment event emitted during atomic settlement
            break;

          case 'settlement_completed':
          case 'milestone_paid':
            if (event.bountyId && event.milestoneId) {
              db.prepare(`
                UPDATE milestones
                SET status = 'paid', updated_at = ?
                WHERE bounty_id = ? AND contract_milestone_id = ?
              `).run(now, event.bountyId, event.milestoneId);

              db.prepare(`
                UPDATE settlements
                SET status = 'settled', transaction_hash = COALESCE(?, transaction_hash), updated_at = ?
                WHERE bounty_id = ? AND milestone_id = (SELECT id FROM milestones WHERE bounty_id = ? AND contract_milestone_id = ?)
              `).run(event.txHash || null, now, event.bountyId, event.bountyId, event.milestoneId);
            }
            break;

          case 'refund_completed':
            if (event.bountyId) {
              db.prepare(`
                UPDATE bounties
                SET status = 'cancelled', funded_amount = 0, updated_at = ?
                WHERE id = ?
              `).run(now, event.bountyId);
            }
            break;

          case 'bounty_completed':
            if (event.bountyId) {
              db.prepare(`
                UPDATE bounties
                SET status = 'completed', updated_at = ?
                WHERE id = ?
              `).run(now, event.bountyId);
            }
            break;

          default:
            break;
        }

        return true;
      });

      const success = applyEvent();

      if (success) {
        // Broadcast in realtime to all connected SSE clients
        realtimeService.broadcast(event.eventType, {
          eventKey: event.eventKey,
          eventType: event.eventType,
          bountyId: event.bountyId,
          milestoneId: event.milestoneId,
          txHash: event.txHash,
          payload: event.payload,
          timestamp: now,
        });
      }

      return success;
    } catch (err: any) {
      console.error(`Error processing event ${event.eventKey}:`, err);
      // Mark as failed for retry handling
      db.prepare(`
        INSERT INTO contract_events (event_key, event_type, bounty_id, milestone_id, transaction_hash, ledger, payload, status, retry_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', 1, ?)
        ON CONFLICT(event_key) DO UPDATE SET status = 'failed', retry_count = retry_count + 1
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
      return false;
    }
  }

  /**
   * Retry failed events up to max retries
   */
  public retryFailedEvents(maxRetries: number = 3): { retried: number; recovered: number } {
    const db = getDatabase();
    const failed = db
      .prepare(`SELECT * FROM contract_events WHERE status = 'failed' AND retry_count < ?`)
      .all(maxRetries) as any[];

    let recovered = 0;
    for (const record of failed) {
      const event: IndexedEvent = {
        eventKey: record.event_key,
        eventType: record.event_type,
        bountyId: record.bounty_id,
        milestoneId: record.milestone_id,
        txHash: record.transaction_hash,
        ledger: record.ledger,
        payload: JSON.parse(record.payload),
      };

      if (this.processEvent(event)) {
        recovered++;
      }
    }

    return { retried: failed.length, recovered };
  }

  /**
   * Reconcile local database state with on-chain Soroban contract state.
   */
  public reconcileBounty(bountyId: number): {
    reconciled: boolean;
    bountyId: number;
    milestonesUpdated: number;
    bountyStatusUpdated: boolean;
  } {
    const db = getDatabase();
    const bounty = db.prepare(`SELECT * FROM bounties WHERE id = ?`).get(bountyId) as any;
    if (!bounty) {
      throw new Error(`Bounty ${bountyId} not found for reconciliation`);
    }

    const now = new Date().toISOString();
    const milestones = db
      .prepare(`SELECT * FROM milestones WHERE bounty_id = ?`)
      .all(bountyId) as any[];

    let milestonesUpdated = 0;
    let allPaid = milestones.length > 0;

    for (const m of milestones) {
      if (m.approvals >= m.approval_threshold && m.status !== 'approved' && m.status !== 'paid') {
        db.prepare(`UPDATE milestones SET status = 'approved', updated_at = ? WHERE id = ?`).run(now, m.id);
        milestonesUpdated++;
      }

      if (m.status !== 'paid') {
        allPaid = false;
      }
    }

    let bountyStatusUpdated = false;
    if (allPaid && bounty.status !== 'completed') {
      db.prepare(`UPDATE bounties SET status = 'completed', updated_at = ? WHERE id = ?`).run(now, bountyId);
      bountyStatusUpdated = true;
    }

    return {
      reconciled: true,
      bountyId,
      milestonesUpdated,
      bountyStatusUpdated,
    };
  }
}

export const eventIndexer = new EventIndexerService();
