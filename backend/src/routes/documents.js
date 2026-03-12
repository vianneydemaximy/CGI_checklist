/**
 * routes/documents.js
 */
const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const dc = require('../controllers/documentController');

router.use(authenticate);
router.get('/:id/download', dc.download);
router.delete('/:id', requireRole('consultant', 'admin'), dc.remove);

module.exports = router;