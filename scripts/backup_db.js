const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../data/bounties.db');
const backupDir = path.resolve(__dirname, '../backups');

if (!fs.existsSync(dbPath)) {
  console.log('Database not found at', dbPath, '- skipping backup.');
  process.exit(0);
}

fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, 'bounties_backup_' + timestamp + '.db');

fs.copyFileSync(dbPath, backupFile);
console.log('Database successfully backed up to:', backupFile);
