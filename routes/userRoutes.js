const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuthenticated, isTechnicien, isAdmin } = require('../middleware/authMiddleware');

// Routes pour la gestion des utilisateurs
// Seuls les techniciens et administrateurs peuvent voir la liste des utilisateurs
router.get('/', isAuthenticated, isTechnicien, userController.getAllUsers);

// Route pour la gestion des rôles et droits (administrateurs uniquement)
router.get('/roles', isAuthenticated, isAdmin, userController.showRolesManagement);
router.post('/roles/create', isAuthenticated, isAdmin, userController.createRole);
router.post('/roles/update', isAuthenticated, isAdmin, userController.updateRolePermissions);
router.delete('/roles/:roleId', isAuthenticated, isAdmin, userController.deleteRole);

// Seuls les administrateurs peuvent créer, modifier et supprimer des utilisateurs
router.get('/create', isAuthenticated, isAdmin, userController.showCreateForm);
router.post('/create', isAuthenticated, isAdmin, userController.createUser);
router.get('/edit/:id', isAuthenticated, isAdmin, userController.showEditForm);
router.post('/edit/:id', isAuthenticated, isAdmin, userController.updateUser);
router.get('/delete/:id', isAuthenticated, isAdmin, userController.deleteUser);

module.exports = router; 