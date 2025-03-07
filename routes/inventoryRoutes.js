const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { isAuthenticated, isTechnicien, isAdmin } = require('../middleware/authMiddleware');

// Routes pour la gestion de l'inventaire
// Tous les utilisateurs authentifiés peuvent voir la liste des items
router.get('/', isAuthenticated, inventoryController.getAllItems);
router.get('/details/:id', isAuthenticated, inventoryController.showItemDetails);

// Seuls les techniciens et administrateurs peuvent créer, modifier et gérer l'inventaire
router.get('/create', isAuthenticated, isTechnicien, inventoryController.showCreateForm);
router.post('/create', isAuthenticated, isTechnicien, inventoryController.createItem);
router.get('/edit/:id', isAuthenticated, isTechnicien, inventoryController.showEditForm);
router.post('/edit/:id', isAuthenticated, isTechnicien, inventoryController.updateItem);
router.get('/delete/:id', isAuthenticated, isAdmin, inventoryController.deleteItem); // Seuls les admins peuvent supprimer
router.post('/lend/:id', isAuthenticated, isTechnicien, inventoryController.lendItem);
router.post('/assign/:id', isAuthenticated, isTechnicien, inventoryController.assignItem);
router.get('/return/:id', isAuthenticated, isTechnicien, inventoryController.returnItem);

module.exports = router; 