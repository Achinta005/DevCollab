const express = require('express');
const router = express.Router();
const projectController = require('../controller/projectController');
const authMiddleware = require('../middleware/auth'); // Your existing auth middleware

router.use(authMiddleware); // Protect all routes

router.post('/create', projectController.createProject);
router.post('/join', projectController.joinProject);
router.get('/my-projects', projectController.getUserProjects);
router.post('/link_projects', projectController.getUserLinkProjects);
router.put('/update-project',projectController.Update_Project);
router.post('/get-project',projectController.getProject);
router.post('/update-collaborator-role',projectController.updateCollaboratorRole);
router.post('/remove-collaborator',projectController.removeCollaborator);
router.post('/add-collaborator',projectController.addCollaborator);

module.exports = router;