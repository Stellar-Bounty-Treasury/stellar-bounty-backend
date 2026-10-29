import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CI/CD Workflows Configuration Suite', () => {
  it('validates CI pipeline workflow structure and triggers', () => {
    const ciYaml = fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    expect(ciYaml).toContain('name: CI Pipeline');
    expect(ciYaml).toContain('node-version: [ 20.x, 22.x ]');
    expect(ciYaml).toContain('run: npm test');
    expect(ciYaml).toContain('run: npm run build');
  });

  it('validates security audit workflow schedule', () => {
    const auditYaml = fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/audit.yml'), 'utf8');
    expect(auditYaml).toContain('name: Dependency Security Audit');
    expect(auditYaml).toContain('npm audit --audit-level=high');
  });

  it('validates Dependabot configuration', () => {
    const depYaml = fs.readFileSync(path.resolve(process.cwd(), '.github/dependabot.yml'), 'utf8');
    expect(depYaml).toContain('package-ecosystem: "npm"');
    expect(depYaml).toContain('package-ecosystem: "github-actions"');
  });
});
