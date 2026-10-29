import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/database.js';

const TEST_DB = path.resolve(process.cwd(), 'tests', 'test_disputes.db');

describe('Stellar Bounty Treasury Backend API — Disputes & Arbitration Suite', () => {
  const creator = 'GBSVC3MFSXVVYNUP6MUNDSM37G4ED5JACUSG3OLDSPBOYIYM6XGL4OAB';
  const dev = 'GBYM3U4FTGGKTUDY2SWY2WKJYSUSHDZKVMUQKSCO5RH2IEN3X7RUNGTU';
  const arb = 'GD6DQE75KKO6Y3SA76IXGQH2GFFUULPUTQUQ3LXIPRDJ66K2UUGDF2DN';
  let bId: number;
  let mId: number;

  beforeAll(async () => {
    process.env.DATABASE_PATH = TEST_DB;
    if (fs.existsSync(TEST_DB)) {
      try { fs.unlinkSync(TEST_DB); } catch (e) {}
    }
    getDatabase(TEST_DB);

    const bRes = await request(app).post('/api/bounties').send({
      title: 'Dispute Bounty',
      description: 'Audit dispute resolution',
      creator_address: creator,
      target_amount: 100,
    });
    bId = bRes.body.data.id;

    const mRes = await request(app).post(`/api/bounties/${bId}/milestones`).send({
      contract_milestone_id: 1,
      description: 'Milestone 1',
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

  it('files a dispute for a milestone', async () => {
    const res = await request(app)
      .post(`/api/bounties/${bId}/milestones/${mId}/dispute`)
      .send({
        initiator_address: creator,
        reason: 'Milestone scope incomplete',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('active');
  });

  it('retrieves dispute by bounty and milestone id', async () => {
    const res = await request(app).get(`/api/bounties/${bId}/milestones/${mId}/dispute`);
    expect(res.status).toBe(200);
    expect(res.body.data.reason).toBe('Milestone scope incomplete');
  });

  it('resolves dispute in favor of contributor', async () => {
    const res = await request(app)
      .post(`/api/bounties/${bId}/milestones/${mId}/dispute/resolve`)
      .send({
        arbitrator_address: arb,
        verdict: 'favor_contributor',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('resolved');
  });
});
