import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Docker Configuration and Compose Suite', () => {
  it('validates multi-stage Dockerfile instructions', () => {
    const dockerfile = fs.readFileSync(path.resolve(process.cwd(), 'Dockerfile'), 'utf8');
    expect(dockerfile).toContain('FROM node:22-slim AS builder');
    expect(dockerfile).toContain('FROM node:22-slim AS runner');
    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('HEALTHCHECK');
  });

  it('validates docker-compose.yml structure', () => {
    const compose = fs.readFileSync(path.resolve(process.cwd(), 'docker-compose.yml'), 'utf8');
    expect(compose).toContain('container_name: stellar-bounty-backend');
    expect(compose).toContain('sqlite_data:/data');
    expect(compose).toContain('3001:3001');
  });

  it('validates production environment template', () => {
    const envProd = fs.readFileSync(path.resolve(process.cwd(), '.env.production'), 'utf8');
    expect(envProd).toContain('NODE_ENV=production');
    expect(envProd).toContain('HORIZON_URL=https://horizon-testnet.stellar.org');
  });
});
