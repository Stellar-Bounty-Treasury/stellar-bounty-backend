export interface SplitItem {
  recipient: string;
  bps: number;
}

export function validateBpsSplit(splits: SplitItem[]): { valid: boolean; totalBps: number; error?: string } {
  const totalBps = splits.reduce((sum, s) => sum + s.bps, 0);
  if (totalBps !== 10000) {
    return {
      valid: false,
      totalBps,
      error: `Total split must equal 10,000 basis points (current: ${totalBps})`,
    };
  }
  return { valid: true, totalBps };
}

export function calculatePayoutAmounts(totalAmountXlm: number, splits: SplitItem[]): Array<{ recipient: string; amountXlm: number }> {
  return splits.map((s) => ({
    recipient: s.recipient,
    amountXlm: (totalAmountXlm * s.bps) / 10000,
  }));
}
