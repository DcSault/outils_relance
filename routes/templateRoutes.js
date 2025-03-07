const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { isAuthenticated, isTechnicien, isAdmin } = require('../middleware/authMiddleware');

// Routes pour la gestion des templates
// Seuls les techniciens et administrateurs peuvent accéder aux templates
router.get('/', isAuthenticated, isTechnicien, templateController.getAllTemplates);
router.get('/details/:id', isAuthenticated, isTechnicien, templateController.showTemplateDetails);

// Seuls les techniciens et administrateurs peuvent créer et modifier des templates
router.get('/create', isAuthenticated, isTechnicien, templateController.showCreateForm);
router.post('/create', isAuthenticated, isTechnicien, templateController.createTemplate);
router.get('/edit/:id', isAuthenticated, isTechnicien, templateController.showEditForm);
router.post('/edit/:id', isAuthenticated, isTechnicien, templateController.updateTemplate);

// Seuls les administrateurs peuvent supprimer des templates
router.get('/delete/:id', isAuthenticated, isAdmin, templateController.deleteTemplate);

module.exports = router; 