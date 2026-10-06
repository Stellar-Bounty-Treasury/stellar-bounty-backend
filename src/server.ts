import { app } from './app.js';
import { config } from './config.js';
import { getDatabase } from './db/database.js';

const server = app.listen(config.port, () => {
  // Ensure DB is initialized
  getDatabase();

  console.log('========================================================');
  console.log(`🏦 Stellar Bounty Treasury Backend API`);
  console.log(`📡 Server listening on port: ${config.port}`);
  console.log(`🌍 Stellar Network: ${config.stellarNetwork}`);
  console.log(`🔗 Horizon URL: ${config.horizonUrl}`);
  console.log(`💾 Database: ${config.databasePath}`);
  console.log('========================================================');
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server terminated gracefully.');
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server interrupted gracefully.');
  });
});
