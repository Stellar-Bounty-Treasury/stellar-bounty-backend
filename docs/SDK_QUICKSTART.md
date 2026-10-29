# Stellar Bounty Treasury — TypeScript SDK

Official TypeScript / JavaScript SDK for interacting with the **Stellar Bounty Treasury** smart contracts and indexing API.

---

## Installation

```bash
npm install stellar-bounty-sdk
```

---

## Quick Start

```typescript
import { StellarBountyClient, SorobanContractBuilder } from 'stellar-bounty-sdk';

const client = new StellarBountyClient({ baseUrl: 'https://api.bounties.stellar.org' });
const bounties = await client.getBounties();
console.log('Active bounties:', bounties);
```

---

## Features
- **Contract Invocation Builders**: Typed payloads for `create_bounty`, `fund_bounty`, `verify_milestone`, and `execute_settlement`.
- **Pre-Flight Simulation**: Predict CPU instructions and minimum gas stroops before committing transactions.
- **10,000 BPS Settlement Math**: Strict validation for multi-recipient reward disbursement.
