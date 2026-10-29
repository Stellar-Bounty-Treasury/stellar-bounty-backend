import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/database.js';

const TEST_DB = path.resolve(process.cwd(), 'tests', 'test_export_auth.db');

describe('Stellar Bounty Treasury Backend API — CSV Export and SEP-10 Auth Suite', () => {
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

  it('downloads bounties CSV with correct headers', async () => {
    const res = await request(app).get('/api/bounties/export/csv');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/csv');
    expect(res.text).toContain('ID,Title,Creator Address');
  });

  it('generates SEP-10 authentication challenge', async () => {
    const pubKey = 'GBSVC3MFSXVVYNUP6MUNDSM37G4ED5JACUSG3OLDSPBOYIYM6XGL4OAB';
    const res = await request(app).get(`/api/bounties/auth/challenge?public_key=${pubKey}`);
    expect(res.status).toBe(200);
    expect(res.body.data.clientPublicKey).toBe(pubKey);
    expect(res.body.data.nonce).toBeDefined();
  });
});
