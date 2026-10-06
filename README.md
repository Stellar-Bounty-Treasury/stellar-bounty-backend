# ⚙️ Stellar Bounty Treasury — Backend API & Verifier

The backend service, persistent database, and on-chain Stellar Testnet transaction verification engine for **Stellar Bounty Treasury**.

---

## 📌 What It Does

At **Level 1 (White Belt)**, this backend provides:
* **Persistent Bounty Storage**: Reliable SQLite storage tracking bounty specifications, creator accounts, targets, and current funding progress.
* **On-Chain Stellar Verification**: Every incoming contribution is audited against the **Stellar Testnet** via Horizon RPC. Transactions that do not exist, failed, or have mismatched amounts/recipients are strictly rejected.
* **Idempotency & Replay Protection**: Each transaction hash can only be registered once, preventing double-credit exploits.
* **REST API Endpoints**: Clean JSON interface for frontend clients and future indexers.

---

## 🏛️ Architecture & Extensibility

```text
stellar-bounty-backend/
├── src/
│   ├── config.ts               # Environment variables and network configurations
│   ├── app.ts                  # Express server, middleware, error handling
│   ├── server.ts               # Server bootstrap & lifecycle listeners
│   ├── db/
│   │   └── database.ts         # SQLite schema initialization (WAL mode)
│   ├── services/
│   │   ├── stellar.ts          # Stellar Testnet Horizon verification service
│   │   └── bountyService.ts    # Business logic, state transitions, idempotency
│   ├── controllers/
│   │   └── bountyController.ts # HTTP request/response handlers
│   └── routes/
│       └── bountyRoutes.ts     # Express router definition
├── tests/
│   └── bounties.test.ts        # Comprehensive test suite with Vitest
├── .env.example
├── tsconfig.json
└── package.json
```

---

## 🚀 How to Run It

### Installation

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

The server listens on `http://localhost:5000`.

### Production Build & Run

```bash
npm run build
npm start
```

### Running Test Suite

```bash
npm test
```

---

## ⚙️ Required Environment Variables

Create `.env` based on `.env.example`:

```bash
# Server Configuration
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*

# Database Persistence
DATABASE_PATH=./data/treasury.db

# Stellar Network
STELLAR_NETWORK=TESTNET
HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_PASSPHRASE="Test SDF Network ; September 2015"
```

---

## 👛 How to Connect a Stellar Testnet Wallet

While the backend operates headless, it validates cryptographic Stellar addresses and transactions submitted by wallets:
1. Contributors and creators use valid Stellar Ed25519 public keys starting with `G` (56 characters).
2. The backend uses `@stellar/stellar-sdk`'s `StrKey.isValidEd25519PublicKey(address)` to ensure wallet addresses are authentic before persisting them.
3. For server-to-server operations or testing, keys can be funded via Friendbot at `https://friendbot.stellar.org?addr=<PUBLIC_KEY>`.

---

## 📝 How to Create a Bounty

To create a bounty programmatically, send a `POST` request to `/api/bounties`:

```bash
curl -X POST http://localhost:5000/api/bounties \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Build Soroban Escrow Settlement Contract",
    "description": "Implement token lockup and conditional release modules.",
    "creator_address": "GBDOSMGJGGPBIUAORRTYPEWPO5TXTXPQC7FLAP5ZZ4XVYHTDAFBCOMRX",
    "target_amount": 100
  }'
```

---

## 💸 How to Fund a Bounty

To record a contribution, submit the verified on-chain Stellar transaction hash to `/api/bounties/:id/contributions`:

```bash
curl -X POST http://localhost:5000/api/bounties/1/contributions \
  -H "Content-Type: application/json" \
  -d '{
    "contributor_address": "GD6DQE75KKO6Y3SA76IXGQH2GFFUULPUTQUQ3LXIPRDJ66K2UUGDF2DN",
    "amount": 25,
    "transaction_hash": "d0ed248c8119390c9269b56348b6b995e7116d9cc5dc6b5cafa6111f185583f0"
  }'
```

---

## 🔍 How to Verify a Transaction

When `/api/bounties/:id/contributions` is invoked, the backend executes the following on-chain verification sequence:
1. Queries Stellar Horizon Testnet (`/transactions/<transaction_hash>`).
2. Checks that `tx.successful === true`.
3. Inspects operations to verify that a native `payment` was made for the claimed XLM amount to the bounty creator or treasury.
4. If verified, updates the bounty's `funded_amount` atomically inside a SQLite transaction.
5. If the transaction does not exist or failed on-chain, returns HTTP `400 Bad Request` with the verification error reason.

---

## 🔄 How the Repository Will Evolve in Levels 2 and 3

The architecture is explicitly decoupled to enable:
* **Level 2**:
  - Live Stellar/Soroban contract event ingestion worker.
  - Periodic reconciliation workers indexing Soroban events.
  - Multi-signature milestone submission records and claim verification.
* **Level 3**:
  - WebSockets / Server-Sent Events (SSE) for realtime bounty updates.
  - Conditional settlement oracle monitors.
  - Automated payout triggers on milestone satisfaction.

---

## 📄 License

MIT
