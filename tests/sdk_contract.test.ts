import { describe, it, expect } from 'vitest';
import { SorobanContractBuilder } from '../src/sdk/contract.js';
import { parseContractError } from '../src/sdk/errors.js';

describe('TypeScript SDK Contract and Error Suite', () => {
  const contractId = 'CADMWQPCCQP27UHQU4JG3C6V5I3UFNNC4DVOMSK2GUJFA6Q2PNW36S52';
  const builder = new SorobanContractBuilder(contractId);

  it('generates create_bounty contract invocation payload', () => {
    const payload = builder.buildCreateBounty('GBD...', 2500);
    expect(payload.contractId).toBe(contractId);
    expect(payload.functionName).toBe('create_bounty');
    expect(payload.args).toEqual(['GBD...', 2500]);
  });

  it('generates verify_milestone contract invocation payload', () => {
    const payload = builder.buildVerifyMilestone(1, 2, 'GREV...', true);
    expect(payload.functionName).toBe('verify_milestone');
    expect(payload.args[3]).toBe(true);
  });

  it('maps Soroban protocol error codes accurately', () => {
    const err = parseContractError(7);
    expect(err.code).toBe(7);
    expect(err.message).toContain('DeadlineExpired');
  });
});
