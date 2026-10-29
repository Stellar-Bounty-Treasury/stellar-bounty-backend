# Container Deployment & Operations Guide

This guide covers running the **Stellar Bounty Treasury Backend** via Docker and Docker Compose.

---

## 1. Quick Start with Docker Compose

To launch the backend connected to Stellar Testnet:

```bash
docker compose up -d --build
```

Verify health:
```bash
docker compose ps
curl http://localhost:3001/health
```

---

## 2. Local Standalone Network (Stellar Quickstart)

To develop completely offline without public Testnet dependencies:

```bash
docker compose -f docker-compose.quickstart.yml up -d
```

This spins up an isolated Stellar Core validator and Soroban RPC container.

---

## 3. Production Deployment

```bash
docker compose -f docker-compose.prod.yml up -d
```
