const { getDatabase, closeDatabase } = require('../dist/db/database.js');
const fs = require('fs');
const path = require('path');

const db = getDatabase();
const tables = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

const ddl = tables.map((t) => t.sql + ';').join('\n\n');
const outPath = path.join(__dirname, '../docs/DATABASE_SCHEMA.sql');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, '-- Stellar Bounty Treasury Database Schema\n\n' + ddl + '\n');

closeDatabase();
console.log('Database schema successfully exported to:', outPath);
