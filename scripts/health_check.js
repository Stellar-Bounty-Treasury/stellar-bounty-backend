const http = require('http');

const port = process.env.PORT || 3001;
const options = {
  hostname: '127.0.0.1',
  port: port,
  path: '/health',
  method: 'GET',
  timeout: 3000,
};

console.log('Probing Stellar Bounty Treasury Backend health on port', port, '...');

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('Health Check OK [200]:', body);
      process.exit(0);
    } else {
      console.error('Health Check Failed with status:', res.statusCode, body);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('Health Check Error: Could not connect to backend:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health Check Error: Request timed out');
  req.destroy();
  process.exit(1);
});

req.end();
