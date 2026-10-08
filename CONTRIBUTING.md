# Contributing to Stellar Bounty Backend

Thank you for contributing to the **Stellar Bounty Backend**! This service provides blockchain indexing, Server-Sent Events (SSE) realtime streams, state reconciliation, and REST endpoints for the Stellar Bounty Treasury platform.

---

## Code of Conduct

Please review and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Prerequisites

* **Node.js**: v20+ with npm v10+
* **Git**: with conventional commit workflow

---

## Local Development Workflow

### 1. Setup Dependencies
```bash
npm install
```

### 2. Run Tests
```bash
npm test
```
All 28 unit and integration tests must pass cleanly.

### 3. Build & Typecheck
```bash
npm run build
```

### 4. Start Local Development Server
```bash
npm run dev
```

---

## Key Backend Invariants

1. **Idempotency:** Payment recordings and indexer event ingestion must be idempotent. Deduplication logic must prevent repeat processing.
2. **Reconciliation Health:** The reconciliation service continuously audits database state against on-chain Soroban contract state.
3. **Safe Math:** Basis point allocations must sum to 10,000 without precision leakage.

---

## Pull Request Guidelines

1. Create a feature branch from `main`: `feat/new-sse-filter` or `fix/event-retry-delay`.
2. Follow Conventional Commits format (`feat(api): ...`, `fix(indexer): ...`).
3. Ensure `npm test` and `npm run build` succeed before submitting PR.
4. Link the relevant issue (`Closes #...`).

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
