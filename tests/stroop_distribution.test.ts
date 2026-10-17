import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/database.js';
import fs from 'fs';
import path from 'path';

const STROOPS_PER_XLM = 10_000_000;

/**
 * Reference implementation of the on-chain settlement arithmetic from
 * stellar-bounty-contracts `configure_settlement` (AllocationType::Percentage):
 *
 *   calculated_amt = (reward_stroops * percentage_bps) / 10_000   // i128 floor division
 *   remainder      = reward_stroops - sum(calculated_amt)
 *   if remainder > 0 { first_recipient.amount += remainder }
 *
 * The smart contract invariant is that the converted shares always sum back
 * to the milestone reward exactly (zero precision leakage) — see
 * CONTRIBUTING.md, "Safe Math: Basis point allocations must sum to 10,000
 * without precision leakage". This suite verifies that the backend's
 * settlement router produces the same stroop distribution as the contract.
 */
function contractShares(rewardXlm: number, bpsList: number[]): bigint[] {
  const rewardStroops = BigInt(Math.round(rewardXlm * STROOPS_PER_XLM));
  const shares = bpsList.map((bps) => (rewardStroops * BigInt(bps)) / 10000n);
  const allocated = shares.reduce((sum, share) => sum + share, 0n);
  const remainder = rewardStroops - allocated;
  if (remainder > 0n && shares.length > 0) {
    shares[0] += remainder;
  }
  return shares;
}

function toStroops(xlm: number): number {
  return Math.round(xlm * STROOPS_PER_XLM);
}

describe('Stellar Bounty Treasury Backend API — Stroop Distribution Invariant Suite', () => {
  let app: any;
  const testDbPath = path.join(process.cwd(), 'data', 'test_stroop_distribution.sqlite');

  const creator = 'GCJ2ZWBIPSHBATSPIB45PZIB3QLI5HT6EURUSAO6WSTNFVQSSMDRQ2XE';
  const dev = 'GCETG2VIX2A2LRWI3FVIRV5VNOPP2FJQCDK6HYVTV3753L74JYRKV5ED';
  const designer = 'GCG5S6QWVRIIVSQWA5DF3X2Q2KQQ6KEHMAXZUMGFPX7YDGGA2X67TPEU';
  const reviewer = 'GDWBHVJ7JGSCRTWL3OVCHZRZMOJ2BSZZSIOIPGGV5HXYG4FWFHNZPMVW';
  const ops = 'GAR2BSQ6MU46AT7JUCD5TIK3E5BYRVRUUVBPYDJAP3OALCT24NV3EPPV';

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

  async function createMilestoneForReward(rewardXlm: number): Promise<{ bountyId: number; milestoneId: number }> {
    const bRes = await request(app)
      .post('/api/bounties')
      .send({
        title: `Stroop distribution arithmetic bounty (${rewardXlm} XLM)`,
        description: 'Verifies backend settlement arithmetic matches the smart contract invariant',
        creator_address: creator,
        target_amount: Math.max(rewardXlm, 1),
      });
    expect(bRes.status).toBe(201);

    const mRes = await request(app)
      .post(`/api/bounties/${bRes.body.data.id}/milestones`)
      .send({
        contract_milestone_id: 1,
        description: 'Stroop precision deliverable',
        reward_amount: rewardXlm,
        recipient_address: dev,
        approval_threshold: 1,
      });
    expect(mRes.status).toBe(201);
    return { bountyId: bRes.body.data.id, milestoneId: mRes.body.data.id };
  }

  async function configurePercentageSettlement(
    bountyId: number,
    milestoneId: number,
    splits: { recipient: string; bps: number }[]
  ) {
    return request(app)
      .post(`/api/bounties/${bountyId}/milestones/${milestoneId}/settlement`)
      .send({
        allocation_type: 'percentage',
        recipients: splits.map((s) => ({ recipient: s.recipient, percentage_bps: s.bps })),
      });
  }

  describe('Contract Parity — canonical on-chain scenario', () => {
    it('distributes 500 XLM as 60% / 25% / 15% exactly like the contract test (300 / 125 / 75 XLM)', async () => {
      const { bountyId, milestoneId } = await createMilestoneForReward(500);

      const res = await configurePercentageSettlement(bountyId, milestoneId, [
        { recipient: dev, bps: 6000 },
        { recipient: designer, bps: 2500 },
        { recipient: reviewer, bps: 1500 },
      ]);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const amounts: number[] = res.body.data.recipients.map((r: any) => r.amount);
      expect(amounts).toEqual([300, 125, 75]);
      // Contract asserts: 300_0000000 / 125_0000000 / 75_0000000 stroops
      expect(amounts.map(toStroops)).toEqual([3000000000, 1250000000, 750000000]);
      expect(toStroops(amounts.reduce((a, b) => a + b, 0))).toBe(toStroops(500));
    });
  });

  describe('Contract Invariant — rounding residue is never lost or created', () => {
    it('credits the floor-division remainder to the first recipient (1.0000001 XLM, 3334/3333/3333 bps)', async () => {
      // reward = 10_000_001 stroops
      // floor(10_000_001 * 3334 / 10_000) = 3_334_000 ; twice 3_333_000 -> sum 10_000_000
      // remainder = 1 stroop -> first recipient receives 3_334_001.
      // The previous Math.round-per-recipient arithmetic lost that stroop.
      const { bountyId, milestoneId } = await createMilestoneForReward(1.0000001);

      const res = await configurePercentageSettlement(bountyId, milestoneId, [
        { recipient: dev, bps: 3334 },
        { recipient: designer, bps: 3333 },
        { recipient: reviewer, bps: 3333 },
      ]);

      expect(res.status).toBe(201);
      const amounts: number[] = res.body.data.recipients.map((r: any) => r.amount);
      expect(amounts.map(toStroops)).toEqual([3334001, 3333000, 3333000]);
      expect(toStroops(amounts.reduce((a, b) => a + b, 0))).toBe(10000001);
    });

    it('never over-allocates sub-stroop rewards (0.0000003 XLM, 50%/50%)', async () => {
      // reward = 3 stroops: floor(3 * 5000 / 10_000) = 1 each, remainder 1 -> [2, 1].
      // Math.round-per-recipient previously produced [2, 2] = 4 stroops (inflation).
      const { bountyId, milestoneId } = await createMilestoneForReward(0.0000003);

      const res = await configurePercentageSettlement(bountyId, milestoneId, [
        { recipient: dev, bps: 5000 },
        { recipient: designer, bps: 5000 },
      ]);

      expect(res.status).toBe(201);
      const amounts: number[] = res.body.data.recipients.map((r: any) => r.amount);
      expect(amounts.map(toStroops)).toEqual([2, 1]);
      expect(toStroops(amounts.reduce((a, b) => a + b, 0))).toBe(3);
    });

    it('distributes a 5-way uneven split with zero precision leakage (0.1234567 XLM)', async () => {
      const reward = 0.1234567;
      const splits = [
        { recipient: dev, bps: 3333 },
        { recipient: designer, bps: 2667 },
        { recipient: reviewer, bps: 2001 },
        { recipient: ops, bps: 999 },
        { recipient: creator, bps: 1000 },
      ];

      const { bountyId, milestoneId } = await createMilestoneForReward(reward);
      const res = await configurePercentageSettlement(bountyId, milestoneId, splits);

      expect(res.status).toBe(201);
      const amounts: number[] = res.body.data.recipients.map((r: any) => r.amount);

      // Invariant 1: every allocated amount is a whole number of stroops.
      for (const amount of amounts) {
        expect(Number.isInteger(toStroops(amount))).toBe(true);
      }

      // Invariant 2: shares sum back to the milestone reward exactly.
      const sumStroops = amounts.reduce((sum, amount) => sum + toStroops(amount), 0);
      expect(sumStroops).toBe(toStroops(reward));

      // Invariant 3: per-recipient stroops match the contract's reference arithmetic.
      const expected = contractShares(reward, splits.map((s) => s.bps));
      expect(amounts.map((a) => BigInt(toStroops(a)))).toEqual(expected);
    });
  });

  describe('Contract Invariant — persisted settlement state', () => {
    it('keeps stroop-exact recipients in the stored settlement projection', async () => {
      const { bountyId, milestoneId } = await createMilestoneForReward(100.0000001);

      const res = await configurePercentageSettlement(bountyId, milestoneId, [
        { recipient: dev, bps: 3334 },
        { recipient: designer, bps: 3333 },
        { recipient: reviewer, bps: 3333 },
      ]);
      expect(res.status).toBe(201);

      // Persisted projection must preserve the invariant: 1_000_000_001 stroops
      // distributed as [333_400_001, 333_300_000, 333_300_000].
      const stored = await request(app).get(`/api/bounties/${bountyId}/settlements`);
      expect(stored.status).toBe(200);
      const settlement = stored.body.data.find((s: any) => s.milestone_id === milestoneId);
      expect(settlement).toBeDefined();

      const amounts: number[] = settlement.recipients.map((r: any) => r.amount);
      expect(amounts.map(toStroops)).toEqual([333400001, 333300000, 333300000]);
      expect(amounts.reduce((sum, amount) => sum + toStroops(amount), 0)).toBe(1000000001);
    });
  });

  describe('Validation — contract-equivalent bps constraints', () => {
    it('rejects fractional basis points (on-chain bps are u32 integers)', async () => {
      const { bountyId, milestoneId } = await createMilestoneForReward(10);

      const res = await configurePercentageSettlement(bountyId, milestoneId, [
        { recipient: dev, bps: 3333.5 },
        { recipient: designer, bps: 3333.5 },
        { recipient: reviewer, bps: 3333 },
      ]);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('whole basis points');
    });
  });
});
