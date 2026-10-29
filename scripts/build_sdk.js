const { execSync } = require('child_process');

console.log('Compiling TypeScript SDK with declarations...');
try {
  execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' });
  console.log('SDK Compilation Successful.');
  process.exit(0);
} catch (e) {
  console.error('SDK Compilation Failed:', e.message);
  process.exit(1);
}
