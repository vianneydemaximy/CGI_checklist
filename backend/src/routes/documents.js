/**
 * routes/documents.js
 * All routes require consultant or admin role.
 */
const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const dc = require('../controllers/documentController');

router.use(authenticate, requireRole('consultant', 'admin'));

router.get('/:id/download', dc.download);
router.delete('/:id',       dc.remove);

module.exports = router;