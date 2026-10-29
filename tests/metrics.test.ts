import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Stellar Bounty Treasury Backend API — Prometheus Metrics Suite', () => {
  it('serves Prometheus metrics in plain-text format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('stellar_bounty_requests_total');
    expect(res.text).toContain('stellar_bounty_heap_bytes');
  });
});
