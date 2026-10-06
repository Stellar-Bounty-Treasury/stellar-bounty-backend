import { Horizon, StrKey } from '@stellar/stellar-sdk';
import { config } from '../config.js';

export interface VerifiedTransaction {
  verified: boolean;
  amount: number;
  sourceAccount: string;
  destinationAccount: string;
  ledger: number;
  createdAt: string;
}

export class StellarService {
  private server: Horizon.Server;

  constructor(horizonUrl?: string) {
    this.server = new Horizon.Server(horizonUrl || config.horizonUrl);
  }

  public isValidAddress(address: string): boolean {
    return StrKey.isValidEd25519PublicKey(address);
  }

  /**
   * Verifies that a transaction exists on Stellar Testnet, was successful,
   * and contains a valid native XLM payment matching the expected contribution.
   */
  public async verifyTransaction(
    txHash: string,
    expectedAmount?: number,
    expectedDestination?: string
  ): Promise<VerifiedTransaction> {
    if (!txHash || typeof txHash !== 'string' || txHash.length !== 64) {
      throw new Error('Invalid transaction hash format. Must be a 64-character hex string.');
    }

    try {
      const tx = await this.server.transactions().transaction(txHash).call();

      if (!tx.successful) {
        throw new Error('Stellar transaction was not successful on-chain.');
      }

      // Fetch transaction operations
      const opsPage = await tx.operations();
      const operations = opsPage.records;

      // Look for a native XLM payment or create_account operation
      let paidAmount = 0;
      let source = tx.source_account;
      let destination = '';

      for (const op of operations) {
        if (op.type === 'payment') {
          const paymentOp = op as any;
          if (paymentOp.asset_type === 'native') {
            const amount = parseFloat(paymentOp.amount);
            paidAmount += amount;
            source = paymentOp.from || paymentOp.source_account || source;
            destination = paymentOp.to;
          }
        } else if (op.type === 'create_account') {
          const createOp = op as any;
          const amount = parseFloat(createOp.starting_balance);
          paidAmount += amount;
          source = createOp.funder || createOp.source_account || source;
          destination = createOp.account;
        }
      }

      if (paidAmount <= 0) {
        throw new Error('No valid native XLM payment operation found in this transaction.');
      }

      if (expectedAmount !== undefined && Math.abs(paidAmount - expectedAmount) > 0.0001) {
        throw new Error(
          `Transaction amount mismatch: expected ${expectedAmount} XLM, but on-chain payment was ${paidAmount} XLM.`
        );
      }

      if (
        expectedDestination &&
        destination &&
        expectedDestination.toLowerCase() !== destination.toLowerCase()
      ) {
        throw new Error(
          `Destination mismatch: payment was sent to ${destination}, expected ${expectedDestination}.`
        );
      }

      return {
        verified: true,
        amount: paidAmount,
        sourceAccount: source,
        destinationAccount: destination,
        ledger: tx.ledger_attr,
        createdAt: tx.created_at,
      };
    } catch (err: any) {
      if (err.response?.status === 404 || err.message?.includes('404')) {
        throw new Error('Transaction not found on Stellar Testnet. Please ensure it has been confirmed.');
      }
      throw new Error(`Stellar verification failed: ${err.message || 'Unknown network error'}`);
    }
  }
}

export const stellarService = new StellarService();
