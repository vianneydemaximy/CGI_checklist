/**
 * routes/projects.js
 */
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const { authenticate, requireRole } = require('../middleware/auth');
const pc  = require('../controllers/projectController');
const cc  = require('../controllers/checklistController');
const ec  = require('../controllers/emailController');
const hc  = require('../controllers/historyController');

// All project routes require authentication
router.use(authenticate);

// Projects CRUD
router.get('/',    pc.list);
router.post('/',   requireRole('consultant', 'admin'), pc.create);
router.get('/:id', pc.getOne);
router.put('/:id', requireRole('consultant', 'admin'), pc.update);
router.delete('/:id', requireRole('consultant', 'admin'), pc.remove);

// Checklists under project
router.get('/:projectId/checklists', cc.listByProject);
router.post('/:projectId/checklists', requireRole('consultant', 'admin'), cc.create);
router.post('/:projectId/checklists/ai-extract', requireRole('consultant', 'admin'), upload.single('rfp'), cc.aiExtract);
router.post('/:projectId/checklists/ai-validate', requireRole('consultant', 'admin'), cc.aiValidate);

// Emails under project
router.get('/:projectId/emails', ec.listByProject);
router.post('/:projectId/emails/generate', requireRole('consultant', 'admin'), ec.generateDraft);

// History
router.get('/:projectId/history', hc.projectHistory);

module.exports = router;