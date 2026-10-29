import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

export interface StatementSync {
  run(...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get<T = any>(...params: any[]): T | undefined;
  all<T = any>(...params: any[]): T[];
}

export interface ExtendedDatabaseSync extends Omit<DatabaseSync, 'prepare'> {
  prepare(sql: string): StatementSync;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
  pragma(sql: string): any;
}

let dbInstance: ExtendedDatabaseSync | null = null;

export function getDatabase(dbPath?: string): ExtendedDatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const resolvedPath = dbPath || config.databasePath;
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const rawDb = new DatabaseSync(resolvedPath);
  rawDb.exec('PRAGMA journal_mode = WAL;');
  rawDb.exec('PRAGMA foreign_keys = ON;');
  rawDb.exec('PRAGMA busy_timeout = 5000;');

  const extendedDb = rawDb as unknown as ExtendedDatabaseSync;

  extendedDb.pragma = (pragmaStr: string) => {
    return rawDb.exec(`PRAGMA ${pragmaStr};`);
  };

  let txDepth = 0;
  extendedDb.transaction = <T extends (...args: any[]) => any>(fn: T): T => {
    const wrapped = (...args: any[]) => {
      const isTopLevel = txDepth === 0;
      txDepth++;
      const savepointName = `sp_${txDepth}`;
      if (isTopLevel) {
        rawDb.exec('BEGIN TRANSACTION;');
      } else {
        rawDb.exec(`SAVEPOINT ${savepointName};`);
      }
      try {
        const result = fn(...args);
        if (isTopLevel) {
          rawDb.exec('COMMIT;');
        } else {
          rawDb.exec(`RELEASE SAVEPOINT ${savepointName};`);
        }
        return result;
      } catch (err) {
        try {
          if (isTopLevel) {
            rawDb.exec('ROLLBACK;');
          } else {
            rawDb.exec(`ROLLBACK TO SAVEPOINT ${savepointName};`);
          }
        } catch (_) {}
        throw err;
      } finally {
        txDepth--;
      }
    };
    return wrapped as T;
  };

  initSchema(rawDb);
  dbInstance = extendedDb;
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    (dbInstance as unknown as DatabaseSync).close();
    dbInstance = null;
  }
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bounties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      creator_address TEXT NOT NULL,
      target_amount REAL NOT NULL,
      funded_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      category TEXT NOT NULL DEFAULT 'General',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bounty_id INTEGER NOT NULL,
      contract_milestone_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      reward_amount REAL NOT NULL,
      recipient_address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approval_threshold INTEGER NOT NULL DEFAULT 2,
      approvals INTEGER NOT NULL DEFAULT 0,
      rejections INTEGER NOT NULL DEFAULT 0,
      submission_reference TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (bounty_id) REFERENCES bounties(id) ON DELETE CASCADE,
      UNIQUE(bounty_id, contract_milestone_id)
    );

    CREATE TABLE IF NOT EXISTS contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bounty_id INTEGER NOT NULL,
      contributor_address TEXT NOT NULL,
      amount REAL NOT NULL,
      transaction_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL,
      FOREIGN KEY (bounty_id) REFERENCES bounties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      milestone_id INTEGER NOT NULL,
      reviewer_address TEXT NOT NULL,
      decision TEXT NOT NULL,
      transaction_hash TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE,
      UNIQUE(milestone_id, reviewer_address)
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bounty_id INTEGER NOT NULL,
      milestone_id INTEGER NOT NULL,
      allocation_type TEXT NOT NULL DEFAULT 'fixed',
      total_amount REAL NOT NULL,
      recipients_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      transaction_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (bounty_id) REFERENCES bounties(id) ON DELETE CASCADE,
      FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE,
      UNIQUE(bounty_id, milestone_id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_hash TEXT NOT NULL UNIQUE,
      operation_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DETECTED',
      ledger INTEGER,
      details_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contract_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      bounty_id INTEGER,
      milestone_id INTEGER,
      transaction_hash TEXT,
      ledger INTEGER,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processed',
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );


    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bounty_id INTEGER NOT NULL,
      milestone_id INTEGER NOT NULL,
      initiator_address TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      resolution TEXT,
      arbitrator_address TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (bounty_id) REFERENCES bounties(id) ON DELETE CASCADE,
      FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE,
      UNIQUE(bounty_id, milestone_id)
    );

    CREATE INDEX IF NOT EXISTS idx_disputes_bounty ON disputes(bounty_id);
    CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

    CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
    CREATE INDEX IF NOT EXISTS idx_milestones_bounty ON milestones(bounty_id);
    CREATE INDEX IF NOT EXISTS idx_contributions_bounty ON contributions(bounty_id);
    CREATE INDEX IF NOT EXISTS idx_verifications_milestone ON verifications(milestone_id);
    CREATE INDEX IF NOT EXISTS idx_settlements_bounty ON settlements(bounty_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(transaction_hash);
    CREATE INDEX IF NOT EXISTS idx_events_bounty ON contract_events(bounty_id);
    CREATE INDEX IF NOT EXISTS idx_events_key ON contract_events(event_key);
  `);
}
