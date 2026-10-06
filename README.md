# ⚙️ Stellar Bounty Treasury — Backend API & Verifier

The backend service, persistent database, and on-chain Stellar Testnet transaction verification engine for **Stellar Bounty Treasury**.

---

## 📌 Project Overview

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

## 📡 API Specification

### 1. Health Check
* **`GET /health`**
* **Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-10-06T18:48:54.000Z",
  "network": "TESTNET",
  "horizonUrl": "https://horizon-testnet.stellar.org",
  "database": "connected",
  "version": "1.0.0"
}
```

### 2. Create Bounty
* **`POST /api/bounties`**
* **Request Body**:
```json
{
  "title": "Fix Stellar SDK Documentation Bug",
  "description": "Resolve outdated examples in the JavaScript SDK README",
  "creator_address": "GBSVC3MFSXVVYNUP6MUNDSM37G4ED5JACUSG3OLDSPBOYIYM6XGL4OAB",
  "target_amount": 100
}
```
* **Response**: `201 Created` with bounty metadata.

### 3. List Bounties
* **`GET /api/bounties`**
* Returns all bounties ordered by newest first.

### 4. Retrieve Bounty Details
* **`GET /api/bounties/:id`**
* Returns bounty metadata including list of all associated contributions.

### 5. Record & Verify Contribution
* **`POST /api/bounties/:id/contributions`**
* **Request Body**:
```json
{
  "contributor_address": "GBYM3U4FTGGKTUDY2SWY2WKJYSUSHDZKVMUQKSCO5RH2IEN3X7RUNGTU",
  "amount": 25,
  "transaction_hash": "a8f4b2c1d3e5f7a9b0c2d4e6f8a1b3c5d7e9f0a2b4c6d8e1f3a5b7c9d0e2f4a6"
}
```
* **Process**:
  1. Validates bounty exists and is in `open` state.
  2. Ensures `transaction_hash` has not been previously recorded.
  3. Verifies transaction directly on Stellar Testnet via Horizon:
     - Confirms transaction was successful.
     - Confirms payment operation destination and amount.
  4. Atomically increments bounty's `funded_amount`.
  5. Updates status to `funded` if target reached.

### 6. List Contributions for a Bounty
* **`GET /api/bounties/:id/contributions`**

---

## ⚙️ Environment Variables

Create `.env` using `.env.example`:

```bash
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*
DATABASE_PATH=./data/treasury.db
STELLAR_NETWORK=TESTNET
HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_PASSPHRASE="Test SDF Network ; September 2015"
```

---

## 🚀 Running the Backend

### Installation

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

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

## 🔄 Progression to Level 2 and Level 3

The architecture is explicitly decoupled to enable:
* **Level 2**:
  - Live Stellar/Soroban contract event ingestion.
  - Periodic reconciliation workers indexing Soroban events.
  - Multi-signature milestone submission records.
* **Level 3**:
  - WebSockets / Server-Sent Events (SSE) for realtime bounty updates.
  - Conditional settlement oracle monitors.
  - Automated payout triggers on milestone satisfaction.

---

## 📄 License

MIT
