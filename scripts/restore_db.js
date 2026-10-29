const fs = require('fs');
const path = require('path');

const snapshotPath = process.argv[2];
const targetDb = process.env.DATABASE_PATH || path.resolve(__dirname, '../data/bounties.db');

if (!snapshotPath) {
  console.error('Usage: node scripts/restore_db.js <SNAPSHOT_FILE_PATH>');
  process.exit(1);
}

if (!fs.existsSync(snapshotPath)) {
  console.error('Snapshot file not found:', snapshotPath);
  process.exit(1);
}

fs.mkdirSync(path.dirname(targetDb), { recursive: true });
fs.copyFileSync(snapshotPath, targetDb);
console.log('Database successfully restored from', snapshotPath, 'to', targetDb);
