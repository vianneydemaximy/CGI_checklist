/**
 * routes/templates.js
 */
const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const tc = require('../controllers/templateController');

router.use(authenticate);
router.get('/', tc.list);
router.get('/:id', tc.getOne);
router.post('/', requireRole('consultant', 'admin'), tc.create);

module.exports = router;