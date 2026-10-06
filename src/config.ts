import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'treasury.db'),
  stellarNetwork: process.env.STELLAR_NETWORK || 'TESTNET',
  horizonUrl: process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  stellarPassphrase: process.env.STELLAR_PASSPHRASE || 'Test SDF Network ; September 2015',
  contractAddress:
    process.env.CONTRACT_ADDRESS || 'CADMWQPCCQP27UHQU4JG3C6V5I3UFNNC4DVOMSK2GUJFA6Q2PNW36S52',
  treasuryReceiverAddress: process.env.TREASURY_RECEIVER_ADDRESS || '',
};
