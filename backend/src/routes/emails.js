/**
 * routes/emails.js
 */
const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ec = require('../controllers/emailController');

router.use(authenticate);
router.get('/:id', ec.getOne);
router.post('/:id/send', requireRole('consultant', 'admin'), ec.sendDraft);

module.exports = router;