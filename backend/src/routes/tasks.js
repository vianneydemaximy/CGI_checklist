/**
 * routes/tasks.js
 * All routes require consultant or admin role.
 */
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const upload  = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },   // 50 MB max
});

const { authenticate, requireRole } = require('../middleware/auth');
const tc = require('../controllers/taskController');
const dc = require('../controllers/documentController');

// All routes: authenticated consultant or admin
router.use(authenticate, requireRole('consultant', 'admin'));

router.get('/:id',           tc.getOne);
router.put('/:id',           tc.update);
router.delete('/:id',        tc.remove);
router.patch('/:id/status',  tc.updateStatus);

// Documents for task
router.get('/:taskId/documents',  dc.listByTask);
router.post('/:taskId/documents', upload.single('file'), dc.upload);

module.exports = router;