import { describe, it, expect } from 'vitest';
import { StellarBountyClient } from '../src/sdk/client.js';

describe('TypeScript SDK Client Suite', () => {
  it('instantiates client with base URL configuration', () => {
    const client = new StellarBountyClient({ baseUrl: 'http://localhost:3001/' });
    expect(client).toBeDefined();
  });
});
