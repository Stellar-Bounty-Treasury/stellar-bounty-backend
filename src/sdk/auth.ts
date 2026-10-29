export class Sep10AuthClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public async fetchChallenge(publicKey: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/bounties/auth/challenge?public_key=${encodeURIComponent(publicKey)}`);
    if (!res.ok) throw new Error(`Failed to fetch auth challenge: ${res.statusText}`);
    const json: any = await res.json();
    return json.data;
  }
}
