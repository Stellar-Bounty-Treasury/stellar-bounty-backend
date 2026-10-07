const express = require('express');
const router = express.Router();
const bountyService = require('../services/bountyService');

// GET /api/bounties - List all bounties
router.get('/', async (req, res) => {
  try {
    const bounties = await bountyService.getAllBounties();
    res.json(bounties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/bounties/:id - Get bounty by ID
router.get('/:id', async (req, res) => {
  try {
    const bounty = await bountyService.getBountyById(req.params.id);
    if (!bounty) {
      return res.status(404).json({ error: 'Bounty not found' });
    }
    res.json(bounty);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/bounties - Create new bounty
router.post('/', async (req, res) => {
  try {
    const bounty = await bountyService.createBounty(req.body);
    res.status(201).json(bounty);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/bounties/creator/:wallet - Get bounties created by a wallet
router.get('/creator/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    
    if (!wallet || wallet.trim() === '') {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    const bounties = await bountyService.getBountiesByCreator(wallet);
    res.json(bounties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
