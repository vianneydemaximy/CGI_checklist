/**
 * routes/documents.js
 */
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const { authenticate, requireRole } = require('../middleware/auth');
const dc = require('../controllers/documentController');

router.use(authenticate, requireRole('consultant', 'admin'));

router.get('/:id/download',             dc.download);
router.delete('/:id',                   dc.remove);
router.post('/:id/replace', upload.single('file'), dc.replace);   // ← V3

module.exports = router;