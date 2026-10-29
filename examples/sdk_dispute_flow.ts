import { parseContractError } from '../src/sdk/index.js';

function main() {
  console.log('Handling Soroban contract error code 8 (DisputeActive)...');
  const err = parseContractError(8);
  console.log('Parsed Error Name:', err.name);
  console.log('Parsed Message:', err.message);
  console.log('Error Code:', err.code);
}

main();
