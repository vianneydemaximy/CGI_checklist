/**
 * routes/emailTemplates.js — Email templates
 */
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const tc = require('../controllers/templateController');

router.use(authenticate);

router.get('/',    tc.listEmail);
router.get('/:id', tc.getOneEmail);
router.post('/',   tc.createEmail);
router.put('/:id', tc.updateEmail);
router.delete('/:id', tc.removeEmail);

module.exports = router;