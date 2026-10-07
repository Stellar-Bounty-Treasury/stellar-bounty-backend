const request = require('supertest');
const express = require('express');
const bountyRoutes = require('../../src/routes/bounties');

const app = express();
app.use('/api/bounties', bountyRoutes);

describe('Bounties Routes', () => {
  describe('GET /api/bounties/creator/:wallet', () => {
    it('should return 400 when wallet is empty', async () => {
      const res = await request(app)
        .get('/api/bounties/creator/')
        .send();
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Wallet address is required');
    });

    it('should return bounties for a valid wallet', async () => {
      const testWallet = '0x96eE7904BdCd8a82c71B4FFc3362C96b1Aae03e0';
      
      const res = await request(app)
        .get(`/api/bounties/creator/${testWallet}`)
        .send();
      
      // Should not throw and should return an array (even if empty)
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should handle wallet with invalid format gracefully', async () => {
      const res = await request(app)
        .get('/api/bounties/creator/invalid_wallet')
        .send();
      
      // Should not crash, just return empty array or handle appropriately
      expect(res.status).toBe(200);
    });
  });
});
