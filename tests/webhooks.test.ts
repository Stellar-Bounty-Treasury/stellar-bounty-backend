import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/database.js';

const TEST_DB = path.resolve(process.cwd(), 'tests', 'test_webhooks.db');

describe('Stellar Bounty Treasury Backend API — Webhook Subscriptions Suite', () => {
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

  it('registers and lists webhooks', async () => {
    const regRes = await request(app).post('/api/bounties/webhooks').send({
      url: 'https://example.com/webhook',
      event_types: 'bounty_created,milestone_paid',
    });

    expect(regRes.status).toBe(201);
    expect(regRes.body.data.url).toBe('https://example.com/webhook');

    const listRes = await request(app).get('/api/bounties/webhooks');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
