import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/database.js';

const TEST_DB = path.resolve(process.cwd(), 'tests', 'test_extension.db');

describe('Stellar Bounty Treasury Backend API — Milestone Extension and Cancellation Suite', () => {
  const creator = 'GBSVC3MFSXVVYNUP6MUNDSM37G4ED5JACUSG3OLDSPBOYIYM6XGL4OAB';
  const dev = 'GBYM3U4FTGGKTUDY2SWY2WKJYSUSHDZKVMUQKSCO5RH2IEN3X7RUNGTU';
  let bId: number;
  let mId: number;

  beforeAll(async () => {
    process.env.DATABASE_PATH = TEST_DB;
    if (fs.existsSync(TEST_DB)) {
      try { fs.unlinkSync(TEST_DB); } catch (e) {}
    }
    getDatabase(TEST_DB);

    const bRes = await request(app).post('/api/bounties').send({
      title: 'Ext Bounty',
      description: 'Deadline test',
      creator_address: creator,
      target_amount: 100,
    });
    bId = bRes.body.data.id;

    const mRes = await request(app).post(`/api/bounties/${bId}/milestones`).send({
      contract_milestone_id: 1,
      description: 'Ext Milestone',
      reward_amount: 50,
      recipient_address: dev,
    });
    mId = mRes.body.data.id;
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB)) {
      try { fs.unlinkSync(TEST_DB); } catch (e) {}
    }
  });

  it('extends milestone deadline', async () => {
    const res = await request(app)
      .post(`/api/bounties/${bId}/milestones/${mId}/extend`)
      .send({ deadline: '2026-12-31T23:59:59Z' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('cancels an unpaid milestone', async () => {
    const res = await request(app).post(`/api/bounties/${bId}/milestones/${mId}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
  });
});
