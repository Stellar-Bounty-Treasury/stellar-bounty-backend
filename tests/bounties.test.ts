import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/database.js';
import { stellarService } from '../src/services/stellar.js';

const TEST_DB = path.resolve(process.cwd(), 'tests', 'test_treasury.db');

describe('Stellar Bounty Treasury Backend API', () => {
  const validCreator = 'GBSVC3MFSXVVYNUP6MUNDSM37G4ED5JACUSG3OLDSPBOYIYM6XGL4OAB';
  const validContributor = 'GBYM3U4FTGGKTUDY2SWY2WKJYSUSHDZKVMUQKSCO5RH2IEN3X7RUNGTU';

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
    it('returns healthy status with database and stellar metadata', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.database).toBe('connected');
      expect(res.body.network).toBe('TESTNET');
    });
  });

  describe('POST /api/bounties (Creation)', () => {
    it('successfully creates a valid bounty', async () => {
      const res = await request(app)
        .post('/api/bounties')
        .send({
          title: 'Implement Soroban Escrow Settlement',
          description: 'Build conditional settlement contract for milestone disbursements',
          creator_address: validCreator,
          target_amount: 150,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(1);
      expect(res.body.data.title).toBe('Implement Soroban Escrow Settlement');
      expect(res.body.data.target_amount).toBe(150);
      expect(res.body.data.funded_amount).toBe(0);
      expect(res.body.data.status).toBe('open');
    });

    it('rejects creation when title is missing or empty', async () => {
      const res = await request(app)
        .post('/api/bounties')
        .send({
          title: '',
          description: 'No title provided',
          creator_address: validCreator,
          target_amount: 50,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('title is required');
    });

    it('rejects creation when creator address is invalid Stellar G key', async () => {
      const res = await request(app)
        .post('/api/bounties')
        .send({
          title: 'Invalid Address Test',
          description: 'Invalid address',
          creator_address: 'not-a-stellar-key',
          target_amount: 50,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Valid Stellar creator address');
    });

    it('rejects creation when target amount is zero or negative', async () => {
      const res = await request(app)
        .post('/api/bounties')
        .send({
          title: 'Zero Amount Bounty',
          description: 'Zero amount description',
          creator_address: validCreator,
          target_amount: -10,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('positive number');
    });
  });

  describe('GET /api/bounties & GET /api/bounties/:id (Retrieval)', () => {
    it('lists existing bounties', async () => {
      const res = await request(app).get('/api/bounties');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('retrieves a single bounty by id with contributions array', async () => {
      const res = await request(app).get('/api/bounties/1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(1);
      expect(Array.isArray(res.body.data.contributions)).toBe(true);
    });

    it('returns 404 for a non-existent bounty id', async () => {
      const res = await request(app).get('/api/bounties/9999');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/bounties/:id/contributions (Funding & Verification)', () => {
    const fakeTxHash = 'a8f4b2c1d3e5f7a9b0c2d4e6f8a1b3c5d7e9f0a2b4c6d8e1f3a5b7c9d0e2f4a6';

    it('records a verified contribution and updates bounty funded amount', async () => {
      vi.spyOn(stellarService, 'verifyTransaction').mockResolvedValueOnce({
        verified: true,
        amount: 50,
        sourceAccount: validContributor,
        destinationAccount: validCreator,
        ledger: 123456,
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/bounties/1/contributions')
        .send({
          contributor_address: validContributor,
          amount: 50,
          transaction_hash: fakeTxHash,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.contribution.amount).toBe(50);
      expect(res.body.data.contribution.transaction_hash).toBe(fakeTxHash);
      expect(res.body.data.bounty.funded_amount).toBe(50);
      expect(res.body.data.bounty.status).toBe('open');
    });

    it('rejects duplicate submission with the same transaction hash (Idempotency)', async () => {
      const res = await request(app)
        .post('/api/bounties/1/contributions')
        .send({
          contributor_address: validContributor,
          amount: 50,
          transaction_hash: fakeTxHash,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already been recorded');
    });

    it('transitions bounty status to "funded" when contribution meets target', async () => {
      const secondTxHash = '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';

      vi.spyOn(stellarService, 'verifyTransaction').mockResolvedValueOnce({
        verified: true,
        amount: 100,
        sourceAccount: validContributor,
        destinationAccount: validCreator,
        ledger: 123457,
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/bounties/1/contributions')
        .send({
          contributor_address: validContributor,
          amount: 100,
          transaction_hash: secondTxHash,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.bounty.funded_amount).toBe(150);
      expect(res.body.data.bounty.status).toBe('funded');
    });

    it('retrieves contributions list for the bounty', async () => {
      const res = await request(app).get('/api/bounties/1/contributions');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data[0].transaction_hash).toBeDefined();
    });
  });
});
