const requiredVars = [
  'NODE_ENV',
  'PORT',
  'HORIZON_URL',
  'SOROBAN_RPC_URL',
];

console.log('Verifying container environment variables...');
const missing = [];

for (const v of requiredVars) {
  if (!process.env[v]) {
    missing.push(v);
  }
}

if (missing.length > 0) {
  console.warn('Warning: Missing recommended environment variables:', missing.join(', '));
  console.warn('Fallback defaults will be used by application config.');
} else {
  console.log('Environment configuration is 100% complete.');
}
