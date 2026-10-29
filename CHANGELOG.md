# Changelog

All notable changes to the **Stellar Bounty Treasury Backend** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [4.0.0] - 2026-10-29

### Added
- **Soroban RPC Simulation Proxy**: Added `POST /api/bounties/soroban/simulate` via `sorobanRpcService.ts` simulating CPU instructions, memory bytes, and ledger read/write fees before on-chain submission.
- **Resilient Blockchain Event Indexer**: Automated Server-Sent Events (SSE) streaming engine in `sseService.ts` and `eventStreamService.ts` with cursor tracking in `indexer_cursors` table.
- **SEP-0010 Stellar Web Authentication**: Cryptographic challenge generator and transaction verifier in `src/services/sep10.ts`.
- **Prometheus Metrics Exporter**: Implemented `/metrics` endpoint exporting Prometheus counters for HTTP requests, active bounties, escrow volume, and indexer lag.
- **Financial CSV Export**: Added `GET /api/bounties/export/csv` exporting historical bounty allocations and ledger reconciliation records.
- **Webhook Dispatch System**: Added `webhookService.ts` with exponential backoff retries and HMAC-SHA256 signatures for decentralized event notifications.
- **Native Node SQLite Migration**: Integrated Node 22+ native `node:sqlite` (`DatabaseSync`) with atomic nested savepoints (`db.savepoint()`) and WAL journal mode.
- **Shared TypeScript Client SDK**: Published `@stellar-bounty/sdk` (`src/sdk/index.ts`) with contract invocation helpers, 10,000 BPS settlement math, and SSE event streaming.
- **Containerization & Quickstart**: Multi-stage production `Dockerfile`, `docker-compose.yml`, and `docker-compose.quickstart.yml` bundling local Stellar Quickstart standalone container.
- **Dispute & Multi-Criteria Filtering**: Added search by status, category, date, and keyword alongside cursor-based pagination.

### Changed
- **CI Matrix Optimization**: Upgraded GitHub Actions CI pipeline matrix to test Node 22.x LTS across Ubuntu and Windows runners.
- **Node Engine Requirement**: Enforced `"engines": { "node": ">=22.5.0" }` in `package.json` for native SQLite compatibility.
- **Idempotency Key Middleware**: Cached mutation responses in memory to prevent duplicate transaction submissions.

### Fixed
- Fixed CI failure on Node 20 runners by aligning matrix with Node 22+ `node:sqlite` requirement.
- Fixed indexer reconnection backoff on transient Soroban RPC socket resets.
- Fixed settlement basis points edge-case rounding when distributing odd fractional amounts.

---

## [3.0.0] - 2026-10-08

### Added
- Level 3 Programmable Settlement Router.
- Multi-recipient fixed and percentage allocation routes.
- Real-time Server-Sent Events broadcasting.
- Automated healthcheck probes and database vacuum utilities.

---

## [2.0.0] - 2026-10-01

### Added
- Stellar Testnet Horizon event polling and transaction verification.
- Relational SQLite schema with audit logs and transaction hashes.
- Idempotent deposit tracking and refund recovery handlers.

---

## [1.0.0] - 2026-09-15

### Added
- Initial backend service with Express REST API.
- Basic bounty escrow indexing and health telemetry.
