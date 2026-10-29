import { SdkBounty, SdkMilestone, SdkSettlement, SdkTreasuryStats } from './types.js';

export interface ClientConfig {
  baseUrl: string;
  timeoutMs?: number;
}

export class StellarBountyClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs || 5000;
  }

  public async getBounties(): Promise<SdkBounty[]> {
    const res = await fetch(`${this.baseUrl}/api/bounties`, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`Failed to fetch bounties: ${res.statusText}`);
    const json: any = await res.json();
    return json.data;
  }

  public async getBounty(id: number): Promise<SdkBounty> {
    const res = await fetch(`${this.baseUrl}/api/bounties/${id}`, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`Failed to fetch bounty ${id}: ${res.statusText}`);
    const json: any = await res.json();
    return json.data;
  }

  public async getTreasuryStats(): Promise<SdkTreasuryStats> {
    const res = await fetch(`${this.baseUrl}/api/bounties/stats`, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`Failed to fetch treasury stats: ${res.statusText}`);
    const json: any = await res.json();
    return json.data;
  }

  public async simulateTransaction(txXdr: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/bounties/soroban/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tx: txXdr }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Simulation failed: ${res.statusText}`);
    const json: any = await res.json();
    return json.data;
  }
}
