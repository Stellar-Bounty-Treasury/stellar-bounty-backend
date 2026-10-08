# Security Policy — Stellar Bounty Backend

The Stellar Bounty Treasury team takes backend service security, API integrity, and state reconciliation seriously.

---

## Supported Versions

Only the `main` branch receives active security updates.

| Branch | Supported |
| :--- | :--- |
| `main` | :white_check_mark: |
| Older releases | :x: |

---

## Reporting a Vulnerability

**Please do not report vulnerabilities via public GitHub issues.**

Privately report vulnerabilities to:
1. Email: **`security@stellar-bounty-treasury.org`**
2. GitHub Private Advisory: [Report a vulnerability](https://github.com/Stellar-Bounty-Treasury/stellar-bounty-backend/security/advisories)

### Response SLA
* **Initial Response:** Within 24 hours.
* **Triage & Classification:** Within 48 hours.
* **Remediation:** Coordinated private patch within 7 days.

---

## Backend Security Principles

* **Non-Custodial Design:** The backend service never holds or manages private keys for bounty creators or settlement recipients.
* **RPC Protection:** External calls to Stellar Horizon and Soroban RPC implement rate limiting, exponential backoff, and strict payload validation.
* **Reconciliation Auditing:** The reconciliation service continuously compares local transaction state with authoritative on-chain contracts.
* **Input Sanitization:** All incoming requests are strictly validated using Zod / TypeScript schema definitions before processing.
