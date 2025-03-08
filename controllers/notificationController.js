const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Chemin vers les fichiers de données
const notificationsFilePath = path.join(__dirname, '../data/notifications.json');
const inventoryFilePath = path.join(__dirname, '../data/inventory.json');
const remindersFilePath = path.join(__dirname, '../data/reminders.json');

// Fonction utilitaire pour lire les données des notifications
const getNotificationsData = () => {
    try {
        if (!fs.existsSync(notificationsFilePath)) {
            // Créer le fichier s'il n'existe pas
            fs.writeFileSync(notificationsFilePath, JSON.stringify({ notifications: [] }, null, 2));
            return { notifications: [] };
        }
        const data = fs.readFileSync(notificationsFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors de la lecture du fichier notifications.json:', error);
        return { notifications: [] };
    }
};

// Fonction utilitaire pour écrire les données des notifications
const saveNotificationsData = (data) => {
    try {
        fs.writeFileSync(notificationsFilePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'écriture du fichier notifications.json:', error);
        return false;
    }
};

// Fonction utilitaire pour lire les données de l'inventaire
const getInventoryData = () => {
    try {
        const data = fs.readFileSync(inventoryFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors de la lecture du fichier inventory.json:', error);
        return { items: [] };
    }
};

// Fonction utilitaire pour lire les données des relances
const getRemindersData = () => {
    try {
        const data = fs.readFileSync(remindersFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors de la lecture du fichier reminders.json:', error);
        return { reminders: [] };
    }
};

// Fonction utilitaire pour calculer la durée de prêt en jours
const calculateBorrowDuration = (borrowDate) => {
    if (!borrowDate) return null;
    
    const today = new Date();
    const bDate = new Date(borrowDate);
    const diffTime = Math.abs(today - bDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
};

// Fonction pour déterminer si une relance est nécessaire
const isReminderNeeded = (borrowDuration) => {
    // Seuils de relance (en jours)
    const reminderThresholds = {
        first: 14,  // Première relance après 14 jours
        second: 30, // Deuxième relance après 30 jours
        urgent: 45  // Relance urgente après 45 jours
    };
    
    if (borrowDuration >= reminderThresholds.urgent) {
        return { needed: true, level: 'urgent', threshold: reminderThresholds.urgent };
    } else if (borrowDuration >= reminderThresholds.second) {
        return { needed: true, level: 'second', threshold: reminderThresholds.second };
    } else if (borrowDuration >= reminderThresholds.first) {
        return { needed: true, level: 'first', threshold: reminderThresholds.first };
    }
    
    return { needed: false };
};

// Contrôleur pour les notifications
const notificationController = {
    // Générer les notifications pour les relances nécessaires
    generateReminderNotifications: () => {
        const inventoryData = getInventoryData();
        const remindersData = getRemindersData();
        const notificationsData = getNotificationsData();
        
        // Filtrer les éléments empruntés
        const borrowedItems = inventoryData.items.filter(item => item.status === 'borrowed' && item.borrowDate);
        
        // Vérifier chaque élément emprunté pour voir si une relance est nécessaire
        borrowedItems.forEach(item => {
            const borrowDuration = calculateBorrowDuration(item.borrowDate);
            const reminderStatus = isReminderNeeded(borrowDuration);
            
            if (reminderStatus.needed) {
                // Vérifier si une relance existe déjà pour cet élément
                const existingReminder = remindersData.reminders.find(r => 
                    r.itemId === item.id && 
                    r.status === 'pending' && 
                    new Date(r.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Créée dans les 7 derniers jours
                );
                
                // Vérifier si une notification existe déjà pour cet élément
                const existingNotification = notificationsData.notifications.find(n => 
                    n.itemId === item.id && 
                    n.type === 'reminder_needed' &&
                    !n.read
                );
                
                // Si aucune relance récente n'existe et aucune notification n'existe, créer une notification
                if (!existingReminder && !existingNotification) {
                    const newNotification = {
                        id: uuidv4(),
                        type: 'reminder_needed',
                        itemId: item.id,
                        itemName: item.name,
                        borrowDuration,
                        reminderLevel: reminderStatus.level,
                        message: `Relance nécessaire pour "${item.name}" (${borrowDuration} jours)`,
                        createdAt: new Date().toISOString(),
                        read: false
                    };
                    
                    notificationsData.notifications.push(newNotification);
                }
            }
        });
        
        // Sauvegarder les notifications
        saveNotificationsData(notificationsData);
    },
    
    // Obtenir toutes les notifications non lues
    getUnreadNotifications: (req, res) => {
        const notificationsData = getNotificationsData();
        
        // Filtrer les notifications non lues
        const unreadNotifications = notificationsData.notifications.filter(n => !n.read);
        
        // Trier par date de création (plus récent en premier)
        unreadNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json(unreadNotifications);
    },
    
    // Marquer une notification comme lue
    markAsRead: (req, res) => {
        try {
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID de notification manquant' });
            }
            
            const notificationsData = getNotificationsData();
            
            // Trouver l'index de la notification
            const notificationIndex = notificationsData.notifications.findIndex(n => n.id === id);
            
            if (notificationIndex === -1) {
                return res.status(404).json({ success: false, error: 'Notification non trouvée' });
            }
            
            // Marquer comme lue
            notificationsData.notifications[notificationIndex].read = true;
            
            // Sauvegarder les modifications
            if (!saveNotificationsData(notificationsData)) {
                return res.status(500).json({ success: false, error: 'Erreur lors de la sauvegarde des notifications' });
            }
            
            return res.json({ success: true });
        } catch (error) {
            console.error('Erreur dans markAsRead:', error);
            return res.status(500).json({ success: false, error: 'Erreur serveur: ' + error.message });
        }
    },
    
    // Marquer toutes les notifications comme lues
    markAllAsRead: (req, res) => {
        try {
            const notificationsData = getNotificationsData();
            
            // Vérifier s'il y a des notifications non lues
            const unreadNotifications = notificationsData.notifications.filter(n => !n.read);
            
            if (unreadNotifications.length === 0) {
                return res.json({ success: true, message: 'Aucune notification non lue à traiter' });
            }
            
            // Marquer toutes les notifications comme lues
            notificationsData.notifications.forEach(notification => {
                notification.read = true;
            });
            
            // Sauvegarder les modifications
            if (!saveNotificationsData(notificationsData)) {
                return res.status(500).json({ success: false, error: 'Erreur lors de la sauvegarde des notifications' });
            }
            
            return res.json({ success: true });
        } catch (error) {
            console.error('Erreur dans markAllAsRead:', error);
            return res.status(500).json({ success: false, error: 'Erreur serveur: ' + error.message });
        }
    },
    
    // Supprimer une notification
    deleteNotification: (req, res) => {
        try {
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({ success: false, error: 'ID de notification manquant' });
            }
            
            const notificationsData = getNotificationsData();
            
            // Trouver l'index de la notification
            const notificationIndex = notificationsData.notifications.findIndex(n => n.id === id);
            
            if (notificationIndex === -1) {
                return res.status(404).json({ success: false, error: 'Notification non trouvée' });
            }
            
            // Supprimer la notification
            notificationsData.notifications.splice(notificationIndex, 1);
            
            // Sauvegarder les modifications
            if (!saveNotificationsData(notificationsData)) {
                return res.status(500).json({ success: false, error: 'Erreur lors de la sauvegarde des notifications' });
            }
            
            return res.json({ success: true });
        } catch (error) {
            console.error('Erreur dans deleteNotification:', error);
            return res.status(500).json({ success: false, error: 'Erreur serveur: ' + error.message });
        }
    }
};

module.exports = notificationController; 