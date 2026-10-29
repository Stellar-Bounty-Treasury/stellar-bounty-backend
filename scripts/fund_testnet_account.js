const targetAddress = process.argv[2];

if (!targetAddress || !targetAddress.startsWith('G')) {
  console.error('Usage: node scripts/fund_testnet_account.js <STELLAR_PUBLIC_KEY>');
  process.exit(1);
}

console.log('Requesting 10,000 Testnet XLM from Friendbot for:', targetAddress);

fetch('https://friendbot.stellar.org?addr=' + encodeURIComponent(targetAddress))
  .then((res) => {
    if (!res.ok) throw new Error('Friendbot returned HTTP ' + res.status);
    return res.json();
  })
  .then((data) => {
    console.log('Funding Successful! Transaction Hash:', data.hash);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Friendbot Funding Failed:', err.message);
    process.exit(1);
  });
