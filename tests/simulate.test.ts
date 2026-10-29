import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Stellar Bounty Treasury Backend API — Soroban RPC Simulation Suite', () => {
  it('simulates transaction execution and returns resource estimates', async () => {
    const res = await request(app)
      .post('/api/bounties/soroban/simulate')
      .send({ tx: 'AAAAAgAAAAD...' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cpuInstructions).toBeGreaterThan(0);
  });
});
