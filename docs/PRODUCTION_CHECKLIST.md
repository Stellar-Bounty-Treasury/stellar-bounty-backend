# Production Readiness Checklist

Before deploying the Stellar Bounty Treasury backend to production, ensure:

- [x] Node.js 22 LTS or higher is used.
- [x] Rate limiting is enabled (`API_RATE_LIMIT=120`).
- [x] CORS origin is locked to the official frontend domain.
- [x] SQLite database path is mounted to a persistent cloud volume.
- [x] Automated daily backup cron job is configured (`scripts/backup_db.js`).
- [x] Prometheus metrics scraping is enabled at `/metrics`.
- [x] Container healthcheck is active.
- [x] Storage Rent TTL auto-extension cron is active.
