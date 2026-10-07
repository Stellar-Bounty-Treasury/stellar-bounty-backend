const { pool } = require('../db');

// Get all bounties
async function getAllBounties() {
  try {
    const result = await pool.query(
      'SELECT * FROM bounties ORDER BY created_at DESC'
    );
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to fetch bounties: ${error.message}`);
  }
}

// Get bounty by ID
async function getBountyById(id) {
  try {
    const result = await pool.query(
      'SELECT * FROM bounties WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to fetch bounty: ${error.message}`);
  }
}

// Create new bounty
async function createBounty(bountyData) {
  try {
    const { title, description, reward, creator_wallet, status } = bountyData;
    
    const result = await pool.query(
      `INSERT INTO bounties (title, description, reward, creator_wallet, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, description, reward, creator_wallet, status || 'open']
    );
    
    return result.rows[0];
  } catch (error) {
    throw new Error(`Failed to create bounty: ${error.message}`);
  }
}

// Get bounties created by a specific wallet
async function getBountiesByCreator(wallet) {
  try {
    const result = await pool.query(
      'SELECT * FROM bounties WHERE creator_wallet = $1 ORDER BY created_at DESC',
      [wallet]
    );
    return result.rows;
  } catch (error) {
    throw new Error(`Failed to fetch bounties by creator: ${error.message}`);
  }
}

module.exports = {
  getAllBounties,
  getBountyById,
  createBounty,
  getBountiesByCreator
};
