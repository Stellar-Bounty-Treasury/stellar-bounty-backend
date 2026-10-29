const { getDatabase, closeDatabase } = require('../dist/db/database.js');

const db = getDatabase();

console.log('Seeding hackathon demonstration bounties...');

const bounties = [
  {
    title: 'Soroban Automated Market Maker Router',
    description: 'Build a multi-hop liquidity router integrating Constant Product AMM pools on Stellar Testnet.',
    creator_address: 'GBDOSMGJGGPBIUAORRTYPEWPO5TXTXPQC7FLAP5ZZ4XVYHTDAFBCOMRX',
    target_amount: 5000,
    funded_amount: 5000,
    status: 'funded',
    category: 'DeFi',
    tags_json: '["soroban", "amm", "liquidity", "router"]',
  },
  {
    title: 'Zero-Knowledge Milestone Deliverable Verifier',
    description: 'Implement Bulletproofs zero-knowledge verification for enterprise milestone releases on Soroban.',
    creator_address: 'GCG5S6QWVRIIVSQWA5DF3X2Q2KQQ6KEHMAXZUMGFPX7YDGGA2X67TPEU',
    target_amount: 8000,
    funded_amount: 4000,
    status: 'open',
    category: 'Security',
    tags_json: '["zk", "bulletproofs", "privacy"]',
  },
];

const now = new Date().toISOString();

for (const b of bounties) {
  const existing = db.prepare('SELECT id FROM bounties WHERE title = ?').get(b.title);
  if (!existing) {
    db.prepare(`
      INSERT INTO bounties (title, description, creator_address, target_amount, funded_amount, status, category, tags_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(b.title, b.description, b.creator_address, b.target_amount, b.funded_amount, b.status, b.category, b.tags_json, now, now);
    console.log('Seeded bounty:', b.title);
  }
}

closeDatabase();
console.log('Seeding completed successfully.');
