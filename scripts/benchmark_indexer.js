console.log('=== Benchmarking Event Indexer Ingestion ===');
const startTime = Date.now();
const testEvents = 1000;

for (let i = 0; i < testEvents; i++) {
  // Simulate synthetic event parse
  JSON.parse(JSON.stringify({ event: 'milestone_approved', id: i, amount: 1000 }));
}

const elapsed = Date.now() - startTime;
console.log('Processed', testEvents, 'synthetic events in', elapsed, 'ms (' + Math.round((testEvents / (elapsed || 1)) * 1000) + ' ops/sec)');
