const { execSync } = require('child_process');

console.log('=== Running Full Verification Suite ===');

try {
  console.log('[1/2] Running Unit Tests with Vitest...');
  execSync('npm test', { stdio: 'inherit' });

  console.log('[2/2] Compiling TypeScript with tsc...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('Verification Suite Succeeded: All checks clean.');
  process.exit(0);
} catch (err) {
  console.error('Verification Suite Failed:', err.message);
  process.exit(1);
}
