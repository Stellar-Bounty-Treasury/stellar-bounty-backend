const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '../dist'),
  path.join(__dirname, '../tests/test_webhooks.db'),
  path.join(__dirname, '../tests/test_export_auth.db'),
];

console.log('Cleaning build artifacts and test databases...');
for (const t of targets) {
  if (fs.existsSync(t)) {
    try {
      fs.rmSync(t, { recursive: true, force: true });
      console.log('Removed:', path.basename(t));
    } catch (e) {
      console.warn('Could not remove:', t, e.message);
    }
  }
}
console.log('Clean complete.');
