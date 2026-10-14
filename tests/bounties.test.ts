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

  describe('Milestone Proof Attachments & MIME Type Validation', () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4 sample pdf content for milestone proof test');
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const validJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const validWebpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
    ]);
    const invalidScriptBuffer = Buffer.from('#!/bin/bash\necho "exploit"\n');

    it('uploads valid PDF proof attachment and returns 201', async () => {
      const res = await request(app)
        .post('/api/milestones/1/proof')
        .send({
          filename: 'audit-report.pdf',
          mime_type: 'application/pdf',
          data: validPdfBuffer.toString('base64'),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.filename).toBe('audit-report.pdf');
      expect(res.body.data.mime_type).toBe('application/pdf');
      expect(res.body.data.file_size).toBe(validPdfBuffer.length);
    });

    it('uploads valid PNG proof attachment and returns 201', async () => {
      const res = await request(app)
        .post('/api/milestones/1/proof')
        .send({
          filename: 'test-screenshot.png',
          mime_type: 'image/png',
          data: validPngBuffer.toString('base64'),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mime_type).toBe('image/png');
    });

    it('uploads valid JPEG proof attachment with normalization from image/jpg', async () => {
      const res = await request(app)
        .post('/api/milestones/1/proof')
        .send({
          filename: 'evidence.jpg',
          mime_type: 'image/jpg',
          data: validJpgBuffer.toString('base64'),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mime_type).toBe('image/jpeg');
    });

    it('uploads valid WebP proof attachment and returns 201', async () => {
      const res = await request(app)
        .post('/api/milestones/1/proof')
        .send({
          filename: 'diagram.webp',
          mime_type: 'image/webp',
          data: validWebpBuffer.toString('base64'),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mime_type).toBe('image/webp');
    });

    it('rejects disallowed MIME type (e.g. application/x-sh) with 400', async () => {
      const res = await request(app)
        .post('/api/milestones/1/proof')
        .send({
          filename: 'run.sh',
          mime_type: 'application/x-sh',
          data: invalidScriptBuffer.toString('base64'),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid MIME type');
    });

    it('detects MIME type spoofing (declaring image/png for a bash script) and rejects with 400', async () => {
      const res = await request(app)
        .post('/api/milestones/1/proof')
        .send({
          filename: 'malicious.png',
          mime_type: 'image/png',
          data: invalidScriptBuffer.toString('base64'),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('MIME verification failed');
    });

    it('detects mismatched MIME type signature (declaring image/png for a PDF file) and rejects with 400', async () => {
      const res = await request(app)
        .post('/api/milestones/1/proof')
        .send({
          filename: 'spoofed.png',
          mime_type: 'image/png',
          data: validPdfBuffer.toString('base64'),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('MIME type spoofing detected');
    });

    it('retrieves uploaded proof attachments for milestone', async () => {
      const res = await request(app).get('/api/milestones/1/proof');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      expect(res.body.data[0].filename).toBe('audit-report.pdf');
    });

    it('accepts valid proof attachment embedded in submit milestone request', async () => {
      const res = await request(app)
        .post('/api/milestones/1/submit')
        .send({
          submission_reference: 'https://github.com/Stellar-Bounty-Treasury/contracts/pull/2',
          attachment: {
            filename: 'final-proof.pdf',
            mime_type: 'application/pdf',
            data: validPdfBuffer.toString('base64'),
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.attachments).toBeDefined();
      expect(res.body.data.attachments.length).toBe(1);
      expect(res.body.data.attachments[0].filename).toBe('final-proof.pdf');
    });
  });
});
