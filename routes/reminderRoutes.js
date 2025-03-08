const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { isAuthenticated, isTechnicien, isAdmin } = require('../middleware/authMiddleware');

// Routes pour la gestion des relances
// Seuls les techniciens et administrateurs peuvent accéder aux relances
router.get('/', isAuthenticated, isTechnicien, reminderController.getAllReminders);
router.get('/calendar', isAuthenticated, isTechnicien, reminderController.showCalendar);

// Route pour créer une relance depuis un élément d'inventaire
router.get('/from-item/:itemId', isAuthenticated, isTechnicien, reminderController.showReminderFromItem);

// Seuls les techniciens et administrateurs peuvent créer et gérer des relances
router.get('/create', isAuthenticated, isTechnicien, reminderController.showCreateForm);
router.post('/create', isAuthenticated, isTechnicien, reminderController.createReminder);
router.get('/edit/:id', isAuthenticated, isTechnicien, reminderController.showEditForm);
router.post('/edit/:id', isAuthenticated, isTechnicien, reminderController.updateReminder);
router.get('/mark-as-sent/:id', isAuthenticated, isTechnicien, reminderController.markAsSent);

// Routes pour l'envoi de mails
router.get('/prepare-email/:id', isAuthenticated, isTechnicien, reminderController.prepareEmail);
router.get('/confirm-sent/:id', isAuthenticated, isTechnicien, reminderController.showConfirmSent);

// Routes pour l'archivage des relances
router.get('/archive/:id', isAuthenticated, isTechnicien, reminderController.archiveReminder);
router.get('/archives', isAuthenticated, isTechnicien, reminderController.getArchivedReminders);
router.get('/archives/restore/:id', isAuthenticated, isTechnicien, reminderController.restoreArchivedReminder);
router.get('/archives/delete/:id', isAuthenticated, isAdmin, reminderController.deleteArchivedReminder);

// Seuls les administrateurs peuvent supprimer des relances
router.get('/delete/:id', isAuthenticated, isAdmin, reminderController.deleteReminder);

module.exports = router; 