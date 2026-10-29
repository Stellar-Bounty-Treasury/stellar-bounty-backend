# Blockchain Event Indexer Architecture

The **Stellar Bounty Treasury Event Indexer** ingests smart contract events emitted by the Soroban runtime.

```
+-----------------------+       +------------------------+       +-----------------------+
|  Stellar Testnet RPC  | ----> |   eventIndexer.ts      | ----> |   SQLite Database     |
|  (Soroban Contract)   |       |   (Cursor Persistence) |       |   (contract_events)   |
+-----------------------+       +------------------------+       +-----------------------+
                                            |
                                            v
                                +------------------------+
                                |  realtimeService.ts    |
                                |  (Server-Sent Events)  |
                                +------------------------+
```

## Key Guarantees
1. **Idempotency**: Event keys are unique SHA-256 hashes of the transaction hash and event index.
2. **Cursor Recovery**: Stream checkpoints are committed to `indexer_cursors`.
3. **Reconciliation**: State reconciler synchronizes off-chain milestone statuses with on-chain ledgers.
