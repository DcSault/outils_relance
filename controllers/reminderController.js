const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mailUtils = require('../utils/mailUtils');

// Chemin vers les fichiers de données
const remindersFilePath = path.join(__dirname, '../data/reminders.json');
const templatesFilePath = path.join(__dirname, '../data/templates.json');
const inventoryFilePath = path.join(__dirname, '../data/inventory.json');
const usersFilePath = path.join(__dirname, '../data/users.json');
const agenciesFilePath = path.join(__dirname, '../data/agencies.json');

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

// Fonction utilitaire pour écrire les données des relances
const saveRemindersData = (data) => {
    try {
        fs.writeFileSync(remindersFilePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'écriture du fichier reminders.json:', error);
        return false;
    }
};

// Fonction utilitaire pour lire les données des templates
const getTemplatesData = () => {
    try {
        const data = fs.readFileSync(templatesFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors de la lecture du fichier templates.json:', error);
        return { templates: [] };
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

// Fonction utilitaire pour lire les données des utilisateurs
const getUsersData = () => {
    try {
        const data = fs.readFileSync(usersFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors de la lecture du fichier users.json:', error);
        return { users: [] };
    }
};

// Fonction utilitaire pour lire les données des agences
const getAgenciesData = () => {
    try {
        const data = fs.readFileSync(agenciesFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors de la lecture du fichier agencies.json:', error);
        return { agencies: [] };
    }
};

// Contrôleur pour les relances
const reminderController = {
    // Afficher toutes les relances
    getAllReminders: (req, res) => {
        const remindersData = getRemindersData();
        const inventoryData = getInventoryData();
        const usersData = getUsersData();
        const templatesData = getTemplatesData();
        
        // Ajouter les informations des éléments, utilisateurs et templates aux relances
        const remindersWithDetails = remindersData.reminders.map(reminder => {
            const item = inventoryData.items.find(i => i.id === reminder.itemId);
            const user = usersData.users.find(u => u.id === reminder.userId);
            const template = templatesData.templates.find(t => t.id === reminder.templateId);
            
            return {
                ...reminder,
                itemName: item ? item.name : 'Élément inconnu',
                userName: user ? user.username : 'Utilisateur inconnu',
                templateName: template ? template.name : 'Template inconnu'
            };
        });
        
        res.render('reminders/index', {
            title: 'Gestion des Relances',
            reminders: remindersWithDetails,
            user: req.session.user
        });
    },
    
    // Afficher le formulaire de création d'une relance
    showCreateForm: (req, res) => {
        const inventoryData = getInventoryData();
        const usersData = getUsersData();
        const templatesData = getTemplatesData();
        
        // Filtrer les éléments prêtés
        const borrowedItems = inventoryData.items.filter(item => item.status === 'borrowed');
        
        res.render('reminders/create', {
            title: 'Créer une Relance',
            items: borrowedItems,
            users: usersData.users,
            templates: templatesData.templates,
            user: req.session.user
        });
    },
    
    // Créer une nouvelle relance
    createReminder: (req, res) => {
        const { itemId, userId, templateId, reminderDate, notes } = req.body;
        
        // Validation de base
        if (!itemId || !userId || !templateId || !reminderDate) {
            return res.render('reminders/create', {
                title: 'Créer une Relance',
                error: 'Tous les champs sont requis',
                formData: req.body,
                items: getInventoryData().items.filter(item => item.status === 'borrowed'),
                users: getUsersData().users,
                templates: getTemplatesData().templates,
                user: req.session.user
            });
        }
        
        // Création de la nouvelle relance
        const newReminder = {
            id: uuidv4(),
            itemId,
            userId,
            templateId,
            reminderDate: new Date(reminderDate).toISOString(),
            notes: notes || '',
            status: 'pending', // pending, sent, cancelled
            sentDate: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Ajout de la relance à la liste
        const remindersData = getRemindersData();
        remindersData.reminders.push(newReminder);
        
        // Sauvegarde des données
        if (!saveRemindersData(remindersData)) {
            return res.render('reminders/create', {
                title: 'Créer une Relance',
                error: 'Erreur lors de la sauvegarde de la relance',
                formData: req.body,
                items: getInventoryData().items.filter(item => item.status === 'borrowed'),
                users: getUsersData().users,
                templates: getTemplatesData().templates,
                user: req.session.user
            });
        }
        
        // Redirection avec message de succès
        req.session.success = 'Relance créée avec succès';
        res.redirect('/reminders');
    },
    
    // Afficher le formulaire de modification d'une relance
    showEditForm: (req, res) => {
        const { id } = req.params;
        const remindersData = getRemindersData();
        const reminder = remindersData.reminders.find(r => r.id === id);
        
        if (!reminder) {
            req.session.error = 'Relance non trouvée';
            return res.redirect('/reminders');
        }
        
        const inventoryData = getInventoryData();
        const usersData = getUsersData();
        const templatesData = getTemplatesData();
        
        // Filtrer les éléments prêtés et ajouter l'élément actuel s'il n'est pas dans la liste
        let borrowedItems = inventoryData.items.filter(item => item.status === 'borrowed');
        const currentItem = inventoryData.items.find(item => item.id === reminder.itemId);
        if (currentItem && !borrowedItems.some(item => item.id === currentItem.id)) {
            borrowedItems.push(currentItem);
        }
        
        res.render('reminders/edit', {
            title: 'Modifier la Relance',
            reminder,
            items: borrowedItems,
            users: usersData.users,
            templates: templatesData.templates,
            user: req.session.user
        });
    },
    
    // Mettre à jour une relance
    updateReminder: (req, res) => {
        const { id } = req.params;
        const { itemId, userId, templateId, reminderDate, notes, status } = req.body;
        
        // Validation de base
        if (!itemId || !userId || !templateId || !reminderDate) {
            req.session.error = 'Tous les champs sont requis';
            return res.redirect(`/reminders/edit/${id}`);
        }
        
        // Récupération des données
        const remindersData = getRemindersData();
        const reminderIndex = remindersData.reminders.findIndex(r => r.id === id);
        
        if (reminderIndex === -1) {
            req.session.error = 'Relance non trouvée';
            return res.redirect('/reminders');
        }
        
        // Mise à jour de la relance
        remindersData.reminders[reminderIndex] = {
            ...remindersData.reminders[reminderIndex],
            itemId,
            userId,
            templateId,
            reminderDate: new Date(reminderDate).toISOString(),
            notes: notes || '',
            status: status || 'pending',
            updatedAt: new Date().toISOString()
        };
        
        // Sauvegarde des données
        if (!saveRemindersData(remindersData)) {
            req.session.error = 'Erreur lors de la sauvegarde de la relance';
            return res.redirect(`/reminders/edit/${id}`);
        }
        
        // Redirection avec message de succès
        req.session.success = 'Relance mise à jour avec succès';
        res.redirect('/reminders');
    },
    
    // Supprimer une relance
    deleteReminder: (req, res) => {
        const { id } = req.params;
        
        // Récupération des données
        const remindersData = getRemindersData();
        const reminderIndex = remindersData.reminders.findIndex(r => r.id === id);
        
        if (reminderIndex === -1) {
            req.session.error = 'Relance non trouvée';
            return res.redirect('/reminders');
        }
        
        // Suppression de la relance
        remindersData.reminders.splice(reminderIndex, 1);
        
        // Sauvegarde des données
        if (!saveRemindersData(remindersData)) {
            req.session.error = 'Erreur lors de la suppression de la relance';
            return res.redirect('/reminders');
        }
        
        // Redirection avec message de succès
        req.session.success = 'Relance supprimée avec succès';
        res.redirect('/reminders');
    },
    
    // Marquer une relance comme envoyée
    markAsSent: (req, res) => {
        const { id } = req.params;
        
        // Récupération des données
        const remindersData = getRemindersData();
        const reminderIndex = remindersData.reminders.findIndex(r => r.id === id);
        
        if (reminderIndex === -1) {
            req.session.error = 'Relance non trouvée';
            return res.redirect('/reminders');
        }
        
        // Mise à jour de la relance
        remindersData.reminders[reminderIndex] = {
            ...remindersData.reminders[reminderIndex],
            status: 'sent',
            sentDate: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Sauvegarde des données
        if (!saveRemindersData(remindersData)) {
            req.session.error = 'Erreur lors de la mise à jour de la relance';
            return res.redirect('/reminders');
        }
        
        // Redirection avec message de succès
        req.session.success = 'Relance marquée comme envoyée';
        res.redirect('/reminders');
    },
    
    // Afficher le calendrier des relances
    showCalendar: (req, res) => {
        const remindersData = getRemindersData();
        const inventoryData = getInventoryData();
        const usersData = getUsersData();
        
        // Ajouter les informations des éléments et utilisateurs aux relances
        const remindersWithDetails = remindersData.reminders.map(reminder => {
            const item = inventoryData.items.find(i => i.id === reminder.itemId);
            const user = usersData.users.find(u => u.id === reminder.userId);
            
            return {
                ...reminder,
                itemName: item ? item.name : 'Élément inconnu',
                userName: user ? user.username : 'Utilisateur inconnu'
            };
        });
        
        res.render('reminders/calendar', {
            title: 'Calendrier des Relances',
            reminders: remindersWithDetails,
            user: req.session.user
        });
    },
    
    // Préparer un mail pour une relance
    prepareEmail: (req, res) => {
        const { id } = req.params;
        
        // Récupération des données
        const remindersData = getRemindersData();
        const templatesData = getTemplatesData();
        const inventoryData = getInventoryData();
        const usersData = getUsersData();
        const agenciesData = getAgenciesData();
        
        // Recherche de la relance
        const reminder = remindersData.reminders.find(r => r.id === id);
        
        if (!reminder) {
            req.session.error = 'Relance non trouvée';
            return res.redirect('/reminders');
        }
        
        // Recherche des informations associées
        const template = templatesData.templates.find(t => t.id === reminder.templateId);
        const item = inventoryData.items.find(i => i.id === reminder.itemId);
        const recipient = usersData.users.find(u => u.id === reminder.userId);
        const agency = recipient && recipient.agency ? agenciesData.agencies.find(a => a.id === recipient.agency) : null;
        
        if (!template || !item || !recipient) {
            req.session.error = 'Informations manquantes pour préparer le mail';
            return res.redirect('/reminders');
        }
        
        // Préparation des données pour le template
        const mailData = {
            userName: recipient.username,
            itemName: item.name,
            borrowDate: item.borrowDate,
            reminderDate: reminder.reminderDate,
            agencyName: agency ? agency.name : 'Agence inconnue',
            customVariables: {} // Variables personnalisées supplémentaires si nécessaire
        };
        
        // Vérifier si le destinataire a un email défini et non vide
        const hasEmail = recipient.email && recipient.email.trim() !== '';
        const recipientEmail = hasEmail ? recipient.email : '';
        
        // Préparation du mail
        const mailInfo = mailUtils.prepareMailFromTemplate(template, mailData, recipientEmail);
        
        // Rendu de la page de prévisualisation du mail
        res.render('reminders/prepare-email', {
            title: 'Préparer un Email',
            reminder,
            template,
            item,
            recipient: {
                ...recipient,
                email: recipientEmail // S'assurer que l'email est une chaîne vide si non défini
            },
            agency,
            mailInfo,
            mailtoLink: mailInfo.mailtoLink,
            hasEmail,
            user: req.session.user // L'utilisateur connecté
        });
    },
    
    // Afficher la page de confirmation d'envoi de mail
    showConfirmSent: (req, res) => {
        const { id } = req.params;
        
        // Récupération des données
        const remindersData = getRemindersData();
        const reminder = remindersData.reminders.find(r => r.id === id);
        
        if (!reminder) {
            req.session.error = 'Relance non trouvée';
            return res.redirect('/reminders');
        }
        
        res.render('reminders/confirm-sent', {
            title: 'Confirmer l\'envoi du mail',
            reminder,
            user: req.session.user
        });
    }
};

module.exports = reminderController; 