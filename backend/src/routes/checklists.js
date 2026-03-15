/**
 * routes/checklists.js
 */
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const { authenticate, requireRole } = require('../middleware/auth');
const cc = require('../controllers/checklistController');
const tc = require('../controllers/taskController');

router.use(authenticate);

router.get('/:id',    cc.getOne);
router.put('/:id',    requireRole('consultant', 'admin'), cc.update);
router.delete('/:id', requireRole('consultant', 'admin'), cc.remove);

// Tâches sous une checklist
router.get('/:checklistId/tasks',  tc.listByChecklist);
router.post('/:checklistId/tasks', requireRole('consultant', 'admin'), tc.create);

module.exports = router;