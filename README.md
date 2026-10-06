# 🏦 Stellar Bounty Treasury — Backend & Indexer Engine

[![Stellar Testnet](https://img.shields.io/badge/Stellar-Testnet-blue.svg)](https://stellar.org)
[![Soroban Events](https://img.shields.io/badge/Soroban-Event%20Streaming-7c3aed.svg)](https://soroban.stellar.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6.svg)](https://www.typescriptlang.org/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-Passing-brightgreen.svg)](https://github.com/Stellar-Bounty-Treasury/stellar-bounty-backend/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

The **Stellar Bounty Treasury Backend** provides blockchain indexing, persistent storage, state reconciliation, and real-time event streaming for the Stellar Bounty Treasury ecosystem.

In accordance with core protocol design principles:
> **Smart contracts enforce financial rules.**  
> **Backend indexes and streams blockchain state.**  
> **Frontend orchestrates user interactions and visualizes state.**

The backend never acts as an authority for payment authorization. It continuously ingests Soroban contract events, maintains an idempotent ledger projection, tracks transaction lifecycles, and broadcasts real-time updates via Server-Sent Events (SSE).

---

## 🎬 Product Demonstration

![Stellar Bounty Treasury Walkthrough](docs/evidence/level3_demo.gif)

* **Direct Video Links**: [High-Definition MP4](docs/evidence/level3_demo.mp4) • [WebM Video](docs/evidence/level3_demo.webm)
* **Frontend Web Application**: [https://stellar-bounty-treasury-2676.netlify.app](https://stellar-bounty-treasury-2676.netlify.app)
* **Smart Contract ID**: [`CADMWQPCCQP27UHQU4JG3C6V5I3UFNNC4DVOMSK2GUJFA6Q2PNW36S52`](https://stellar.expert/explorer/testnet/contract/CADMWQPCCQP27UHQU4JG3C6V5I3UFNNC4DVOMSK2GUJFA6Q2PNW36S52)

---

## 🏗️ System Architecture

```text
  Soroban Smart Contracts (Testnet)
                │
                │ Emits Contract Events (topics & data)
                ▼
  ┌────────────────────────────────────────┐
  │       Advanced Event Processor         │
  │  1. Ingestion & Validation             │
  │  2. Cryptographic Deduplication Hash   │
  │  3. Retry Recovery Queue (Backoff)     │
  └──────────────────┬─────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
  ┌──────────────┐       ┌──────────────────────┐
  │  Relational  │       │ Realtime Event Hub   │
  │   Database   │       │ Server-Sent Events   │
  └──────┬───────┘       └──────────┬───────────┘
         │                          │
         ▼                          ▼
   REST API Layer              Web Clients
```

---

## 🌟 Core Architecture & Capabilities

### 1. 🔄 Advanced Event Processor & Idempotency
* **Cryptographic Event Ingestion**: Validates event structure and calculates deduplication signatures (`sha256(event_key + tx_hash + type)`).
* **Guaranteed Idempotence**: Reprocessing the same event (e.g. `bounty_funded`, `recipient_paid`) never produces double-counting or corrupt duplicate financial entries.
* **Retry Recovery Queue**: Transient indexing failures trigger exponential backoff retries with dead-letter queue classification.

### 2. 📡 Realtime Streaming (Server-Sent Events)
* Streams live blockchain occurrences to connected frontend clients via `/api/events/stream`.
* Supports typed channels: `bounty_funded`, `milestone_approved`, `settlement_authorized`, `recipient_paid`, `settlement_completed`, `refund_completed`, `bounty_completed`.

### 3. ⚖️ Authoritative State Reconciliation
* Periodic background worker and on-demand endpoint (`POST /api/reconcile`) comparing local database projections against authoritative on-chain contract state.
* Detects and repairs missing events, stale records, or settlement desynchronization.

### 4. ⏱️ Transaction Lifecycle Tracking
* Distinguishes distinct stages: `DETECTED` ➔ `SUBMITTED` ➔ `CONFIRMED` ➔ `INDEXED`.
* Retrievable by hash via `GET /api/transactions/:hash`.

### 5. 🛡️ Security, Rate Limiting & Observability
* IP-based token bucket rate limiter to protect public endpoints.
* Structured JSON logging with request IDs and correlation context.
* Comprehensive `/health` and `/ready` probes distinguishing process liveness from database and RPC availability.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/health` | Liveness health check |
| `GET` | `/ready` | Readiness probe (database & RPC connectivity) |
| `GET` | `/api/bounties/stats` | Global treasury analytics (escrow, bounties, payouts) |
| `GET` | `/api/bounties` | List all bounties with milestones and settlements |
| `POST` | `/api/bounties` | Index a new bounty |
| `GET` | `/api/bounties/:id` | Fetch specific bounty details |
| `POST` | `/api/bounties/:id/contributions` | Record and verify a funding transaction |
| `GET` | `/api/bounties/:id/contributions` | List all contributions for a bounty |
| `POST` | `/api/bounties/:id/milestones` | Create a milestone |
| `GET` | `/api/bounties/:id/milestones` | List milestones for a bounty |
| `POST` | `/api/bounties/:id/milestones/:mId/submit` | Submit work evidence |
| `POST` | `/api/bounties/:id/milestones/:mId/verify` | Record community verification vote |
| `POST` | `/api/bounties/:id/milestones/:mId/settlement` | Configure Settlement Router rules |
| `GET` | `/api/bounties/:id/milestones/:mId/settlement` | Get settlement configuration |
| `POST` | `/api/milestones/:id/release` | Record multi-recipient settlement execution |
| `POST` | `/api/bounties/:id/refund` | Record refund of unspent bounty escrow |
| `POST` | `/api/bounties/:id/complete` | Record bounty completion |
| `GET` | `/api/settlements/:id` | Fetch settlement report with all recipients |
| `GET` | `/api/transactions/:hash` | Track transaction state (`DETECTED`, `CONFIRMED`, `INDEXED`) |
| `POST` | `/api/reconcile` | Trigger contract state reconciliation |
| `GET` | `/api/events/stream` | Real-time Server-Sent Events (SSE) stream |

---

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/Stellar-Bounty-Treasury/stellar-bounty-backend.git
cd stellar-bounty-backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
```

### Environment Configuration (`.env`)

```env
PORT=5000
DATABASE_URL=sqlite:./treasury.sqlite
STELLAR_NETWORK=TESTNET
SOROBAN_CONTRACT_ID=CADMWQPCCQP27UHQU4JG3C6V5I3UFNNC4DVOMSK2GUJFA6Q2PNW36S52
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
```

### Running Locally

```bash
# Development mode with hot-reloading
npm run dev

# Run test suite (28 unit and integration tests)
npm test

# Build for production
npm run build

# Start production server
npm start
```

---

## 🧪 Testing Suite

Run the comprehensive test suite with Jest:

```bash
npm test
```

Includes 28 passing unit and integration tests covering:
* Event ingestion, deduplication, and retry recovery
* Multi-recipient settlement routing (fixed and percentage allocations)
* Transaction lifecycle tracking and state machine transitions
* Idempotent payment recording
* Contract reconciliation and health checks

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
