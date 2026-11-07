import crypto from 'crypto';
import { StrKey, Keypair } from '@stellar/stellar-sdk';
import { config } from '../config.js';

export interface AuthChallenge {
  nonce: string;
  serverPublicKey: string;
  clientPublicKey: string;
  issuedAt: string;
  expiresAt: string;
  networkPassphrase: string;
}

export class Sep10Service {
  private serverKey = process.env.SEP10_SERVER_PUBLIC_KEY || 'GBDOSMGJGGPBIUAORRTYPEWPO5TXTXPQC7FLAP5ZZ4XVYHTDAFBCOMRX';

  public createChallenge(clientPublicKey: string): AuthChallenge {
    if (!clientPublicKey || !StrKey.isValidEd25519PublicKey(clientPublicKey)) {
      throw new Error('Valid Stellar client public key starting with G is required.');
    }

    const now = Date.now();
    return {
      nonce: crypto.randomBytes(32).toString('hex'),
      serverPublicKey: this.serverKey,
      clientPublicKey,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 300000).toISOString(), // 5 min TTL
      networkPassphrase: config.stellarPassphrase,
    };
  }

  public verifyChallenge(challenge: AuthChallenge, clientPublicKey: string, signatureHex?: string): boolean {
    if (!challenge || !challenge.clientPublicKey || challenge.clientPublicKey !== clientPublicKey) return false;
    if (Date.now() > new Date(challenge.expiresAt).getTime()) return false;
    if (signatureHex) {
      try {
        const kp = Keypair.fromPublicKey(clientPublicKey);
        const dataBuf = Buffer.from(challenge.nonce, 'utf-8');
        const sigBuf = Buffer.from(signatureHex, 'hex');
        return kp.verify(dataBuf, sigBuf);
      } catch {
        return false;
      }
    }
    return true;
  }
}

export const sep10Service = new Sep10Service();
