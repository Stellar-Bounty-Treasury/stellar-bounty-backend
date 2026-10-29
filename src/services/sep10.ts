import crypto from 'crypto';

export interface AuthChallenge {
  nonce: string;
  serverPublicKey: string;
  clientPublicKey: string;
  issuedAt: string;
  expiresAt: string;
  networkPassphrase: string;
}

export class Sep10Service {
  private serverKey = 'GBDOSMGJGGPBIUAORRTYPEWPO5TXTXPQC7FLAP5ZZ4XVYHTDAFBCOMRX';

  public createChallenge(clientPublicKey: string): AuthChallenge {
    if (!clientPublicKey || !clientPublicKey.startsWith('G')) {
      throw new Error('Valid Stellar client public key starting with G is required.');
    }

    const now = Date.now();
    return {
      nonce: crypto.randomBytes(16).toString('hex'),
      serverPublicKey: this.serverKey,
      clientPublicKey,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 300000).toISOString(), // 5 min TTL
      networkPassphrase: 'Test SDF Network ; September 2015',
    };
  }

  public verifyChallenge(challenge: AuthChallenge, clientPublicKey: string): boolean {
    if (challenge.clientPublicKey !== clientPublicKey) return false;
    if (Date.now() > new Date(challenge.expiresAt).getTime()) return false;
    return true;
  }
}

export const sep10Service = new Sep10Service();
