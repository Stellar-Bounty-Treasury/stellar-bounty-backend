import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/database.js';

const TEST_DB = path.resolve(process.cwd(), 'tests', 'test_idempotency.db');

describe('Stellar Bounty Treasury Backend API — Idempotency Middleware Suite', () => {
  const creator = 'GBSVC3MFSXVVYNUP6MUNDSM37G4ED5JACUSG3OLDSPBOYIYM6XGL4OAB';

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

  it('returns cached response on duplicate request with same Idempotency-Key', async () => {
    const key = 'idem-unique-key-12345';
    const payload = {
      title: 'Idempotent Bounty',
      description: 'Testing replay',
      creator_address: creator,
      target_amount: 250,
    };

    const res1 = await request(app).post('/api/bounties').set('Idempotency-Key', key).send(payload);
    expect(res1.status).toBe(201);
    const createdId = res1.body.data.id;

    const res2 = await request(app).post('/api/bounties').set('Idempotency-Key', key).send(payload);
    expect(res2.status).toBe(201);
    expect(res2.header['x-cache-lookup']).toBe('HIT-IDEMPOTENCY');
    expect(res2.body.data.id).toBe(createdId);
  });
});
