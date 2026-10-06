import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

let dbInstance: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const resolvedPath = dbPath || config.databasePath;
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new Database(resolvedPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  initSchema(dbInstance);
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function initSchema(db: Database.Database): void {
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

    CREATE TABLE IF NOT EXISTS contract_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      bounty_id INTEGER,
      milestone_id INTEGER,
      transaction_hash TEXT,
      ledger INTEGER,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
    CREATE INDEX IF NOT EXISTS idx_milestones_bounty ON milestones(bounty_id);
    CREATE INDEX IF NOT EXISTS idx_contributions_bounty ON contributions(bounty_id);
    CREATE INDEX IF NOT EXISTS idx_verifications_milestone ON verifications(milestone_id);
    CREATE INDEX IF NOT EXISTS idx_events_bounty ON contract_events(bounty_id);
    CREATE INDEX IF NOT EXISTS idx_events_key ON contract_events(event_key);
  `);
}
