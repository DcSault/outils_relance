const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { isAuthenticated, isTechnicien, isAdmin } = require('../middleware/authMiddleware');

// Routes pour les notifications
// Seuls les techniciens et administrateurs peuvent accéder aux notifications
router.get('/unread', isAuthenticated, isTechnicien, notificationController.getUnreadNotifications);
router.post('/mark-as-read/:id', isAuthenticated, isTechnicien, notificationController.markAsRead);
router.post('/mark-all-as-read', isAuthenticated, isTechnicien, notificationController.markAllAsRead);
router.delete('/delete/:id', isAuthenticated, isTechnicien, notificationController.deleteNotification);

module.exports = router; 