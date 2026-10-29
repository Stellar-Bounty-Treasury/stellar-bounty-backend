import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/database.js';
import { auditService } from '../src/services/auditService.js';

const TEST_DB = path.resolve(process.cwd(), 'tests', 'test_audit.db');

describe('Stellar Bounty Treasury Backend API — Audit Logging Suite', () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = TEST_DB;
    if (fs.existsSync(TEST_DB)) {
      try { fs.unlinkSync(TEST_DB); } catch (e) {}
    }
    getDatabase(TEST_DB);
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB)) {
      try { fs.unlinkSync(TEST_DB); } catch (e) {}
    }
  });

  it('logs and retrieves administrative audit actions', async () => {
    auditService.log({
      action_type: 'SET_PLATFORM_FEE',
      actor_address: 'GBSVC3MFSXVVYNUP6MUNDSM37G4ED5JACUSG3OLDSPBOYIYM6XGL4OAB',
      resource_id: 'fee_config',
      details: { bps: 250 },
    });

    const res = await request(app).get('/api/bounties/audit-logs');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].action_type).toBe('SET_PLATFORM_FEE');
  });
});
