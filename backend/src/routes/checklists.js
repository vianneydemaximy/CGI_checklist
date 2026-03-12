/**
 * routes/checklists.js
 */
const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const cc = require('../controllers/checklistController');
const tc = require('../controllers/taskController');

router.use(authenticate);

router.get('/:id', cc.getOne);
router.put('/:id', requireRole('consultant', 'admin'), cc.update);
router.delete('/:id', requireRole('consultant', 'admin'), cc.remove);

// Tasks under checklist
router.get('/:checklistId/tasks', tc.listByChecklist);
router.post('/:checklistId/tasks', requireRole('consultant', 'admin'), tc.create);

module.exports = router;