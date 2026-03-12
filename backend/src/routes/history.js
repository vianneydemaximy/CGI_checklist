/**
 * routes/history.js
 */
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const hc = require('../controllers/historyController');

router.use(authenticate);
router.get('/entity/:entityType/:entityId', hc.entityHistory);

module.exports = router;