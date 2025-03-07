const express = require('express');
const router = express.Router();
const agencyController = require('../controllers/agencyController');
const { isAuthenticated, isTechnicien, isAdmin } = require('../middleware/authMiddleware');

// Routes pour la gestion des agences
// Tous les utilisateurs authentifiés peuvent voir la liste des agences
router.get('/', isAuthenticated, agencyController.getAllAgencies);

// Seuls les techniciens et administrateurs peuvent créer, modifier et supprimer des agences
router.get('/create', isAuthenticated, isTechnicien, agencyController.showCreateForm);
router.post('/create', isAuthenticated, isTechnicien, agencyController.createAgency);
router.get('/edit/:id', isAuthenticated, isTechnicien, agencyController.showEditForm);
router.post('/edit/:id', isAuthenticated, isTechnicien, agencyController.updateAgency);
router.get('/delete/:id', isAuthenticated, isAdmin, agencyController.deleteAgency); // Seuls les admins peuvent supprimer

module.exports = router; 