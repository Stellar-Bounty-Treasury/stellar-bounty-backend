import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Backend Scripts and Automation Suite', () => {
  it('verifies existence of operational scripts', () => {
    const scripts = [
      'scripts/verify_all.js',
      'scripts/clean.js',
      'scripts/health_check.js',
      'scripts/seed_demo_bounties.js',
      'scripts/fund_testnet_account.js',
      'scripts/deploy_contracts.js',
      'scripts/export_schema.js',
      'scripts/benchmark_indexer.js',
    ];

    for (const s of scripts) {
      const fullPath = path.resolve(process.cwd(), s);
      expect(fs.existsSync(fullPath), `Script ${s} should exist`).toBe(true);
    }
  });
});
