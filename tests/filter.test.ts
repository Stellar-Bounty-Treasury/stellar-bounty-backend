import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/database.js';

const TEST_DB = path.resolve(process.cwd(), 'tests', 'test_filter.db');

describe('Stellar Bounty Treasury Backend API — Search, Filtering, and Pagination Suite', () => {
  const creator = 'GBSVC3MFSXVVYNUP6MUNDSM37G4ED5JACUSG3OLDSPBOYIYM6XGL4OAB';

  beforeAll(async () => {
    process.env.DATABASE_PATH = TEST_DB;
    if (fs.existsSync(TEST_DB)) {
      try { fs.unlinkSync(TEST_DB); } catch (e) {}
    }
    getDatabase(TEST_DB);

    // Seed test bounties
    await request(app).post('/api/bounties').send({
      title: 'Soroban Smart Contract Audit',
      description: 'Security review of vault contract',
      creator_address: creator,
      target_amount: 500,
    });
    await request(app).post('/api/bounties').send({
      title: 'React Freighter Integration',
      description: 'Web3 wallet frontend modal',
      creator_address: creator,
      target_amount: 200,
    });
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB)) {
      try { fs.unlinkSync(TEST_DB); } catch (e) {}
    }
  });

  it('filters bounties by search keyword', async () => {
    const res = await request(app).get('/api/bounties?search=Soroban');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].title).toContain('Soroban');
  });

  it('filters bounties by min and max amounts', async () => {
    const res = await request(app).get('/api/bounties?min_amount=300');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].target_amount).toBe(500);
  });

  it('paginates bounty results', async () => {
    const res = await request(app).get('/api/bounties?page=1&limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.totalPages).toBe(2);
  });
});
