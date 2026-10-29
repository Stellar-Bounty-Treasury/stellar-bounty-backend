import { describe, it, expect } from 'vitest';
import { validateBpsSplit, calculatePayoutAmounts } from '../src/sdk/settlement.js';

describe('TypeScript SDK Settlement Math Suite', () => {
  it('validates 10,000 BPS split integrity', () => {
    const validSplits = [
      { recipient: 'G1...', bps: 8000 },
      { recipient: 'G2...', bps: 2000 },
    ];
    const res = validateBpsSplit(validSplits);
    expect(res.valid).toBe(true);
    expect(res.totalBps).toBe(10000);

    const invalidSplits = [
      { recipient: 'G1...', bps: 7000 },
      { recipient: 'G2...', bps: 2000 },
    ];
    const res2 = validateBpsSplit(invalidSplits);
    expect(res2.valid).toBe(false);
    expect(res2.error).toContain('10,000 basis points');
  });

  it('calculates recipient payout amounts correctly', () => {
    const splits = [
      { recipient: 'G1...', bps: 5000 },
      { recipient: 'G2...', bps: 5000 },
    ];
    const payouts = calculatePayoutAmounts(1000, splits);
    expect(payouts[0].amountXlm).toBe(500);
    expect(payouts[1].amountXlm).toBe(500);
  });
});
