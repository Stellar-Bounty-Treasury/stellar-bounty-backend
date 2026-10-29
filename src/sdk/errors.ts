export class SorobanProtocolError extends Error {
  public code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'SorobanProtocolError';
    this.code = code;
  }
}

export const CONTRACT_ERROR_CODES: Record<number, string> = {
  1: 'AlreadyInitialized',
  2: 'Unauthorized',
  3: 'AlreadyPaused',
  4: 'NotPaused',
  5: 'BountyNotFound',
  6: 'MilestoneNotFound',
  7: 'DeadlineExpired',
  8: 'DisputeActive',
  9: 'ReentrancyDetected',
  10: 'InvalidSettlementSum',
};

export function parseContractError(code: number): SorobanProtocolError {
  const desc = CONTRACT_ERROR_CODES[code] || 'UnknownContractError';
  return new SorobanProtocolError(`Soroban Contract Error [${code}]: ${desc}`, code);
}
