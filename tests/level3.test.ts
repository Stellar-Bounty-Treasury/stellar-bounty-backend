import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/database.js';
import fs from 'fs';
import path from 'path';

describe('Stellar Bounty Treasury Backend API — Level 3 (Orange Belt) Suite', () => {
  let app: any;
  const testDbPath = path.join(process.cwd(), 'data', 'test_level3.sqlite');

  const creator = 'GCJ2ZWBIPSHBATSPIB45PZIB3QLI5HT6EURUSAO6WSTNFVQSSMDRQ2XE';
  const funder = 'GAR2BSQ6MU46AT7JUCD5TIK3E5BYRVRUUVBPYDJAP3OALCT24NV3EPPV';
  const dev = 'GCETG2VIX2A2LRWI3FVIRV5VNOPP2FJQCDK6HYVTV3753L74JYRKV5ED';
  const designer = 'GCG5S6QWVRIIVSQWA5DF3X2Q2KQQ6KEHMAXZUMGFPX7YDGGA2X67TPEU';
  const reviewer = 'GDWBHVJ7JGSCRTWL3OVCHZRZMOJ2BSZZSIOIPGGV5HXYG4FWFHNZPMVW';

  beforeAll(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    process.env.DATABASE_PATH = testDbPath;
    getDatabase(testDbPath);
    app = createApp();
  });

  afterAll(() => {
    closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Treasury Stats & Observability', () => {
    it('returns readiness check with 200', async () => {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.network).toBeDefined();
    });

    it('returns global treasury statistics', async () => {
      const res = await request(app).get('/api/bounties/stats');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_bounties).toBeDefined();
      expect(res.body.data.total_funds).toBeDefined();
      expect(res.body.data.total_distributed).toBeDefined();
    });
  });

  describe('Multi-Recipient Settlement Router', () => {
    let bountyId: number;
    let milestoneId: number;

    it('creates bounty and milestone for settlement testing', async () => {
      const bRes = await request(app)
        .post('/api/bounties')
        .send({
          title: 'Settlement Router Engine',
          description: 'Level 3 Programmable Treasury Router',
          creator_address: creator,
          target_amount: 1000,
        });

      expect(bRes.status).toBe(201);
      bountyId = bRes.body.data.id;

      const mRes = await request(app)
        .post(`/api/bounties/${bountyId}/milestones`)
        .send({
          contract_milestone_id: 1,
          description: 'Multi-recipient deliverables',
          reward_amount: 1000,
          recipient_address: dev,
          approval_threshold: 1,
        });

      expect(mRes.status).toBe(201);
      milestoneId = mRes.body.data.id;
    });

    it('configures valid multi-recipient fixed settlement (700 XLM + 200 XLM + 100 XLM = 1,000 XLM)', async () => {
      const res = await request(app)
        .post(`/api/bounties/${bountyId}/milestones/${milestoneId}/settlement`)
        .send({
          allocation_type: 'fixed',
          recipients: [
            { recipient: dev, amount: 700, label: 'developer' },
            { recipient: designer, amount: 200, label: 'designer' },
            { recipient: reviewer, amount: 100, label: 'reviewer' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recipients.length).toBe(3);
      expect(res.body.data.total_amount).toBe(1000);
      expect(res.body.data.status).toBe('pending');
    });

    it('rejects invalid fixed allocation total (sum != milestone reward)', async () => {
      const res = await request(app)
        .post(`/api/bounties/${bountyId}/milestones/${milestoneId}/settlement`)
        .send({
          allocation_type: 'fixed',
          recipients: [
            { recipient: dev, amount: 700, label: 'developer' },
            { recipient: designer, amount: 250, label: 'designer' }, // 700 + 250 = 950 != 1000
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('must equal milestone reward');
    });

    it('rejects duplicate recipient addresses in settlement configuration', async () => {
      const res = await request(app)
        .post(`/api/bounties/${bountyId}/milestones/${milestoneId}/settlement`)
        .send({
          allocation_type: 'fixed',
          recipients: [
            { recipient: dev, amount: 500, label: 'dev1' },
            { recipient: dev, amount: 500, label: 'dev2' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Duplicate recipient');
    });

    it('configures valid percentage-based allocation (60% + 25% + 15% = 100%)', async () => {
      const res = await request(app)
        .post(`/api/bounties/${bountyId}/milestones/${milestoneId}/settlement`)
        .send({
          allocation_type: 'percentage',
          recipients: [
            { recipient: dev, percentage_bps: 6000, label: 'dev' },
            { recipient: designer, percentage_bps: 2500, label: 'designer' },
            { recipient: reviewer, percentage_bps: 1500, label: 'reviewer' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.recipients[0].amount).toBe(600);
      expect(res.body.data.recipients[1].amount).toBe(250);
      expect(res.body.data.recipients[2].amount).toBe(150);
    });

    it('retrieves settlements for bounty', async () => {
      const res = await request(app).get(`/api/bounties/${bountyId}/settlements`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].recipients.length).toBe(3);
    });

    it('submits, verifies, and executes multi-recipient settlement', async () => {
      // 1. Submit
      await request(app)
        .post(`/api/milestones/${milestoneId}/submit`)
        .send({ submission_reference: 'https://github.com/org/repo/pull/42' });

      // 2. Verify
      await request(app)
        .post(`/api/milestones/${milestoneId}/verify`)
        .send({ reviewer_address: reviewer, decision: 'approve' });

      // 3. Execute Settlement
      const res = await request(app)
        .post(`/api/milestones/${milestoneId}/release`)
        .send({ tx_hash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('paid');
      expect(res.body.data.settlement.status).toBe('settled');
      expect(res.body.data.settlement.recipients.length).toBe(3);
    });
  });

  describe('Refund and Completion Lifecycles', () => {
    it('refunds an eligible active bounty', async () => {
      const bRes = await request(app)
        .post('/api/bounties')
        .send({
          title: 'Refundable Treasury Test',
          description: 'Testing refund recovery path',
          creator_address: creator,
          target_amount: 500,
        });

      const bId = bRes.body.data.id;

      const refRes = await request(app)
        .post(`/api/bounties/${bId}/refund`)
        .send({ tx_hash: 'tx-refund-hash-123' });

      expect(refRes.status).toBe(200);
      expect(refRes.body.data.status).toBe('cancelled');
      expect(refRes.body.data.funded_amount).toBe(0);
    });

    it('completes a bounty after all milestones are paid', async () => {
      const bRes = await request(app)
        .post('/api/bounties')
        .send({
          title: 'Completable Bounty',
          description: 'Bounty completion test',
          creator_address: creator,
          target_amount: 200,
        });

      const bId = bRes.body.data.id;

      const mRes = await request(app)
        .post(`/api/bounties/${bId}/milestones`)
        .send({
          contract_milestone_id: 1,
          description: 'Final Task',
          reward_amount: 200,
          recipient_address: dev,
          approval_threshold: 1,
        });

      const mId = mRes.body.data.id;

      await request(app).post(`/api/milestones/${mId}/submit`).send({ submission_reference: 'pr-done' });
      await request(app).post(`/api/milestones/${mId}/verify`).send({ reviewer_address: reviewer, decision: 'approve' });
      await request(app).post(`/api/milestones/${mId}/release`).send({});

      const compRes = await request(app).post(`/api/bounties/${bId}/complete`).send({});
      expect(compRes.status).toBe(200);
      expect(compRes.body.data.status).toBe('completed');
    });
  });

  describe('Transaction Lifecycle Tracking', () => {
    const txHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    it('records transaction state progression (DETECTED -> CONFIRMED -> INDEXED)', async () => {
      // 1. DETECTED
      const t1 = await request(app)
        .post(`/api/transactions/${txHash}`)
        .send({ operation_type: 'SETTLEMENT', status: 'DETECTED', details: { amount: 1000 } });
      expect(t1.status).toBe(200);
      expect(t1.body.data.status).toBe('DETECTED');

      // 2. CONFIRMED
      const t2 = await request(app)
        .post(`/api/transactions/${txHash}`)
        .send({ operation_type: 'SETTLEMENT', status: 'CONFIRMED' });
      expect(t2.body.data.status).toBe('CONFIRMED');

      // 3. INDEXED
      const t3 = await request(app)
        .post(`/api/transactions/${txHash}`)
        .send({ operation_type: 'SETTLEMENT', status: 'INDEXED' });
      expect(t3.body.data.status).toBe('INDEXED');

      // Query
      const q = await request(app).get(`/api/transactions/${txHash}`);
      expect(q.status).toBe(200);
      expect(q.body.data.status).toBe('INDEXED');
    });
  });

  describe('Server-Sent Events (SSE) Streaming', () => {
    it('provides SSE endpoint with text/event-stream headers', async () => {
      const res = await request(app)
        .get('/api/events/stream')
        .set('Accept', 'text/event-stream')
        .timeout({ response: 200, deadline: 500 })
        .catch((err) => err.response);

      if (res) {
        expect(res.headers['content-type']).toContain('text/event-stream');
      }
    });
  });
});
