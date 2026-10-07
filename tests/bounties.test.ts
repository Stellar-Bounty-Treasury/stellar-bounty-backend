import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/database.js';
import { stellarService } from '../src/services/stellar.js';
import { eventIndexer } from '../src/services/eventIndexer.js';

const TEST_DB = path.resolve(process.cwd(), 'tests', 'test_treasury.db');

describe('Stellar Bounty Treasury Backend API — Core Escrow & Milestones Suite', () => {
  const validCreator = 'GBSVC3MFSXVVYNUP6MUNDSM37G4ED5JACUSG3OLDSPBOYIYM6XGL4OAB';
  const validContributor = 'GBYM3U4FTGGKTUDY2SWY2WKJYSUSHDZKVMUQKSCO5RH2IEN3X7RUNGTU';
  const validReviewer1 = 'GD6DQE75KKO6Y3SA76IXGQH2GFFUULPUTQUQ3LXIPRDJ66K2UUGDF2DN';
  const validReviewer2 = 'GBDOSMGJGGPBIUAORRTYPEWPO5TXTXPQC7FLAP5ZZ4XVYHTDAFBCOMRX';

  beforeAll(() => {
    process.env.DATABASE_PATH = TEST_DB;
    if (fs.existsSync(TEST_DB)) {
      try {
        fs.unlinkSync(TEST_DB);
      } catch (e) {}
    }
    getDatabase(TEST_DB);
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB)) {
      try {
        fs.unlinkSync(TEST_DB);
      } catch (e) {}
    }
  });

  describe('GET /health', () => {
    it('returns healthy status with database, network, and contract address', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.database).toBe('connected');
      expect(res.body.contractAddress).toBeDefined();
    });
  });

  describe('Bounty Creation & Retrieval', () => {
    it('creates a bounty and returns 201', async () => {
      const res = await request(app)
        .post('/api/bounties')
        .send({
          title: 'Implement On-Chain Escrow',
          description: 'Lock funds in Soroban contract vault',
          creator_address: validCreator,
          target_amount: 200,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(1);
      expect(res.body.data.status).toBe('open');
    });

    it('retrieves bounty details with empty milestones initially', async () => {
      const res = await request(app).get('/api/bounties/1');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.milestones)).toBe(true);
      expect(res.body.data.milestones.length).toBe(0);
    });
  });

  describe('Milestones Lifecycle & Community Verification', () => {
    it('creates a milestone on the bounty', async () => {
      const res = await request(app)
        .post('/api/bounties/1/milestones')
        .send({
          contract_milestone_id: 1,
          description: 'Deliver core escrow contract',
          reward_amount: 100,
          recipient_address: validContributor,
          approval_threshold: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(1);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.approval_threshold).toBe(2);
    });

    it('submits milestone evidence', async () => {
      const res = await request(app)
        .post('/api/milestones/1/submit')
        .send({
          submission_reference: 'https://github.com/Stellar-Bounty-Treasury/contracts/pull/1',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('submitted');
      expect(res.body.data.submission_reference).toContain('pull/1');
    });

    it('records first reviewer approval', async () => {
      const res = await request(app)
        .post('/api/milestones/1/verify')
        .send({
          reviewer_address: validReviewer1,
          decision: 'approve',
          transaction_hash: 'tx-rev-1',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.milestone.approvals).toBe(1);
      expect(res.body.data.milestone.status).toBe('under_review'); // threshold is 2
    });

    it('rejects duplicate verification vote from the same reviewer (Security)', async () => {
      const res = await request(app)
        .post('/api/milestones/1/verify')
        .send({
          reviewer_address: validReviewer1,
          decision: 'approve',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already verified');
    });

    it('prevents payment release before threshold is reached', async () => {
      const res = await request(app)
        .post('/api/milestones/1/release')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('must be \'approved\'');
    });

    it('reaches approval threshold upon second reviewer vote and marks approved', async () => {
      const res = await request(app)
        .post('/api/milestones/1/verify')
        .send({
          reviewer_address: validReviewer2,
          decision: 'approve',
          transaction_hash: 'tx-rev-2',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.milestone.approvals).toBe(2);
      expect(res.body.data.milestone.status).toBe('approved');
    });

    it('releases payment once approved', async () => {
      const res = await request(app)
        .post('/api/milestones/1/release')
        .send({
          transaction_hash: 'tx-settle-1',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('paid');
    });

    it('retrieves milestone verifications list', async () => {
      const res = await request(app).get('/api/milestones/1/verifications');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });
  });

  describe('Contract Event Indexing & Idempotency', () => {
    it('processes a new contract event successfully', () => {
      const result = eventIndexer.processEvent({
        eventKey: 'event-unique-101',
        eventType: 'bounty_funded',
        bountyId: 1,
        payload: { amount: 50 },
      });

      expect(result).toBe(true);
    });

    it('handles duplicate events idempotently (deduplication)', () => {
      const result = eventIndexer.processEvent({
        eventKey: 'event-unique-101', // same eventKey!
        eventType: 'bounty_funded',
        bountyId: 1,
        payload: { amount: 50 },
      });

      // Must be false (ignored), without throwing or duplicating
      expect(result).toBe(false);
    });

    it('retrieves events for bounty', async () => {
      const res = await request(app).get('/api/bounties/1/events');
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/reconcile', () => {
    it('reconciles on-chain state cleanly', async () => {
      const res = await request(app)
        .post('/api/reconcile')
        .send({ bounty_id: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.reconciled).toBe(true);
    });
  });
});
