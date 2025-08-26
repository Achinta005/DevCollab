const express = require('express');
const router = express.Router();
const projectController = require('../controller/projectController');
const authMiddleware = require('../middleware/auth'); // Your existing auth middleware

router.use(authMiddleware); // Protect all routes

router.post('/create', projectController.createProject);
router.post('/join', projectController.joinProject);
router.get('/my-projects', projectController.getUserProjects);
router.post('/link_projects', projectController.getUserLinkProjects);

module.exports = router;