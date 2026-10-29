export interface ContractInvocationPayload {
  contractId: string;
  functionName: string;
  args: any[];
}

export class SorobanContractBuilder {
  private contractId: string;

  constructor(contractId: string) {
    this.contractId = contractId;
  }

  public buildCreateBounty(creator: string, targetAmount: number): ContractInvocationPayload {
    return {
      contractId: this.contractId,
      functionName: 'create_bounty',
      args: [creator, targetAmount],
    };
  }

  public buildFundBounty(bountyId: number, funder: string, amount: number): ContractInvocationPayload {
    return {
      contractId: this.contractId,
      functionName: 'fund_bounty',
      args: [bountyId, funder, amount],
    };
  }

  public buildVerifyMilestone(bountyId: number, milestoneId: number, reviewer: string, approve: boolean): ContractInvocationPayload {
    return {
      contractId: this.contractId,
      functionName: 'verify_milestone',
      args: [bountyId, milestoneId, reviewer, approve],
    };
  }

  public buildExecuteSettlement(bountyId: number, milestoneId: number): ContractInvocationPayload {
    return {
      contractId: this.contractId,
      functionName: 'execute_settlement',
      args: [bountyId, milestoneId],
    };
  }
}
