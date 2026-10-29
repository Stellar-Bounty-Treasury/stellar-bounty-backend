import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Database Backup and Restore Script Integrity Suite', () => {
  it('validates backup and restore script files exist and are readable', () => {
    const backupScript = path.resolve(process.cwd(), 'scripts/backup_db.js');
    const restoreScript = path.resolve(process.cwd(), 'scripts/restore_db.js');

    expect(fs.existsSync(backupScript)).toBe(true);
    expect(fs.existsSync(restoreScript)).toBe(true);

    const backupContent = fs.readFileSync(backupScript, 'utf8');
    expect(backupContent).toContain('fs.copyFileSync');
    expect(backupContent).toContain('bounties_backup_');
  });
});
