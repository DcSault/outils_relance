const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Chemin vers les fichiers de données
const inventoryFilePath = path.join(__dirname, '../data/inventory.json');
const agenciesFilePath = path.join(__dirname, '../data/agencies.json');
const usersFilePath = path.join(__dirname, '../data/users.json');

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

// Fonction utilitaire pour écrire les données de l'inventaire
const saveInventoryData = (data) => {
    try {
        fs.writeFileSync(inventoryFilePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'écriture du fichier inventory.json:', error);
        return false;
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

// Fonction utilitaire pour ajouter une entrée à l'historique d'un élément
const addHistoryEntry = (itemId, action, description, userId) => {
    const inventoryData = getInventoryData();
    const itemIndex = inventoryData.items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) return false;
    
    // Créer une nouvelle entrée d'historique
    const historyEntry = {
        id: `hist_${Date.now()}`,
        date: new Date().toISOString(),
        action,
        description,
        userId
    };
    
    // Initialiser le tableau d'historique s'il n'existe pas
    if (!inventoryData.items[itemIndex].history) {
        inventoryData.items[itemIndex].history = [];
    }
    
    // Ajouter l'entrée à l'historique
    inventoryData.items[itemIndex].history.unshift(historyEntry); // Ajouter au début pour avoir les plus récents en premier
    
    // Mettre à jour la date de dernière modification
    inventoryData.items[itemIndex].updatedAt = new Date().toISOString();
    
    // Sauvegarder les données
    return saveInventoryData(inventoryData);
};

// Fonction utilitaire pour obtenir l'historique d'un élément
const getItemHistory = (itemId) => {
    const inventoryData = getInventoryData();
    const item = inventoryData.items.find(item => item.id === itemId);
    
    if (!item) return [];
    
    return item.history || [];
};

// Fonction utilitaire pour obtenir l'ID de l'agence Services Informatique
const getITServiceAgencyId = () => {
    const agenciesData = getAgenciesData();
    const itServiceAgency = agenciesData.agencies.find(a => a.name === 'Services Informatique');
    return itServiceAgency ? itServiceAgency.id : null;
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

// Contrôleur pour l'inventaire
const inventoryController = {
    // Afficher tous les éléments de l'inventaire
    getAllItems: (req, res) => {
        const inventoryData = getInventoryData();
        const agenciesData = getAgenciesData();
        const usersData = getUsersData();
        
        // Enrichir les données des éléments avec les informations utilisateur et agence
        const itemsWithDetails = inventoryData.items.map(item => {
            // Trouver l'utilisateur associé à l'élément
            const user = item.borrowedBy ? usersData.users.find(u => u.id === item.borrowedBy) : null;
            
            // Calculer la durée de prêt si l'élément est emprunté
            let borrowDuration = null;
            let reminderStatus = null;
            
            if (item.status === 'borrowed' && item.borrowDate) {
                borrowDuration = calculateBorrowDuration(item.borrowDate);
                reminderStatus = isReminderNeeded(borrowDuration);
            }
            
            return {
                ...item,
                borrowedByUser: user ? user.username : null,
                borrowedByAgency: user && user.agency ? 
                    (agenciesData.agencies.find(a => a.id === user.agency)?.name || 'Agence inconnue') : null,
                borrowDuration,
                reminderStatus
            };
        });
        
        res.render('inventory/index', {
            title: 'Gestion de l\'Inventaire',
            items: itemsWithDetails,
            user: req.session.user
        });
    },
    
    // Afficher le formulaire de création d'un élément
    showCreateForm: (req, res) => {
        const agenciesData = getAgenciesData();
        const usersData = getUsersData();
        
        res.render('inventory/create', {
            title: 'Ajouter un Élément',
            agencies: agenciesData.agencies,
            users: usersData.users,
            user: req.session.user
        });
    },
    
    // Créer un nouvel élément
    createItem: (req, res) => {
        const { name, description, serialNumber, quantity, status, agencyId, borrowedBy, expectedReturnDate, tags, customFields } = req.body;
        
        // Validation de base
        if (!name || name.trim() === '') {
            return res.render('inventory/create', {
                title: 'Ajouter un Élément',
                error: 'Le nom de l\'élément est requis',
                formData: req.body,
                agencies: getAgenciesData().agencies,
                users: getUsersData().users,
                user: req.session.user
            });
        }
        
        // Déterminer si l'élément est prêté ou attribué à un utilisateur
        const isAssigned = status === 'assigned' && borrowedBy && borrowedBy !== 'none';
        const isBorrowed = status === 'borrowed' && borrowedBy && borrowedBy !== 'none';
        
        // Création du nouvel élément
        const newItem = {
            id: uuidv4(),
            name: name.trim(),
            description: description || '',
            serialNumber: serialNumber || '',
            quantity: parseInt(quantity) || 1,
            status: status || 'available',
            agencyId: agencyId !== 'none' ? agencyId : getITServiceAgencyId(),
            tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
            customFields: customFields ? JSON.parse(customFields) : [],
            borrowedBy: (isAssigned || isBorrowed) ? borrowedBy : null,
            borrowDate: (isAssigned || isBorrowed) ? new Date().toISOString() : null,
            expectedReturnDate: isBorrowed && expectedReturnDate ? new Date(expectedReturnDate).toISOString() : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Ajout de l'élément à l'inventaire
        const inventoryData = getInventoryData();
        inventoryData.items.push(newItem);
        
        // Sauvegarde des données
        if (!saveInventoryData(inventoryData)) {
            return res.render('inventory/create', {
                title: 'Ajouter un Élément',
                error: 'Erreur lors de la sauvegarde de l\'élément',
                formData: req.body,
                agencies: getAgenciesData().agencies,
                users: getUsersData().users,
                user: req.session.user
            });
        }
        
        // Ajouter une entrée d'historique pour la création
        addHistoryEntry(
            newItem.id,
            'Création',
            `Élément créé par ${req.session.user.username}`,
            req.session.user.id
        );
        
        // Si l'élément est attribué au service informatique par défaut, ajouter une entrée d'historique
        if (agencyId === 'none' && newItem.agencyId) {
            const agenciesData = getAgenciesData();
            const itServiceAgency = agenciesData.agencies.find(a => a.id === newItem.agencyId);
            
            addHistoryEntry(
                newItem.id,
                'Attribution automatique',
                `Attribué automatiquement à l'agence ${itServiceAgency ? itServiceAgency.name : 'Services Informatique'}`,
                req.session.user.id
            );
        }
        
        // Si l'élément est prêté ou attribué, ajouter une entrée d'historique
        if (isAssigned) {
            const user = getUsersData().users.find(u => u.id === borrowedBy);
            addHistoryEntry(
                newItem.id,
                'Attribution',
                `Attribué à ${user ? user.username : 'un utilisateur'}`,
                req.session.user.id
            );
        } else if (isBorrowed) {
            const user = getUsersData().users.find(u => u.id === borrowedBy);
            addHistoryEntry(
                newItem.id,
                'Prêt',
                `Prêté à ${user ? user.username : 'un utilisateur'}${expectedReturnDate ? ` jusqu'au ${new Date(expectedReturnDate).toLocaleDateString('fr-FR')}` : ''}`,
                req.session.user.id
            );
        }
        
        // Redirection avec message de succès
        req.session.success = 'Élément ajouté avec succès';
        res.redirect('/inventory');
    },
    
    // Afficher le formulaire de modification d'un élément
    showEditForm: (req, res) => {
        const { id } = req.params;
        const inventoryData = getInventoryData();
        const item = inventoryData.items.find(i => i.id === id);
        
        if (!item) {
            req.session.error = 'Élément non trouvé';
            return res.redirect('/inventory');
        }
        
        const agenciesData = getAgenciesData();
        const usersData = getUsersData();
        
        res.render('inventory/edit', {
            title: 'Modifier l\'Élément',
            item,
            agencies: agenciesData.agencies,
            users: usersData.users,
            user: req.session.user
        });
    },
    
    // Mettre à jour un élément
    updateItem: (req, res) => {
        const { id } = req.params;
        const { name, description, serialNumber, quantity, status, agencyId, borrowedBy, expectedReturnDate, tags, customFields } = req.body;
        
        // Validation de base
        if (!name || name.trim() === '') {
            req.session.error = 'Le nom de l\'élément est requis';
            return res.redirect(`/inventory/edit/${id}`);
        }
        
        // Récupération des données
        const inventoryData = getInventoryData();
        const itemIndex = inventoryData.items.findIndex(i => i.id === id);
        
        if (itemIndex === -1) {
            req.session.error = 'Élément non trouvé';
            return res.redirect('/inventory');
        }
        
        // Déterminer si l'élément est prêté ou attribué à un utilisateur
        const isAssigned = status === 'assigned' && borrowedBy && borrowedBy !== 'none';
        const isBorrowed = status === 'borrowed' && borrowedBy && borrowedBy !== 'none';
        const wasAssignedOrBorrowed = inventoryData.items[itemIndex].borrowedBy !== null;
        
        // Déterminer l'agence à utiliser
        let itemAgencyId;
        if (agencyId !== 'none') {
            // Si une agence est explicitement sélectionnée, l'utiliser
            itemAgencyId = agencyId;
        } else if (status === 'available') {
            // Si l'élément est disponible, l'attribuer au service informatique
            itemAgencyId = getITServiceAgencyId();
        } else {
            // Sinon, conserver l'agence actuelle
            itemAgencyId = inventoryData.items[itemIndex].agencyId;
        }
        
        // Mise à jour de l'élément
        inventoryData.items[itemIndex] = {
            ...inventoryData.items[itemIndex],
            name: name.trim(),
            description: description || '',
            serialNumber: serialNumber || '',
            quantity: parseInt(quantity) || 1,
            status: status || 'available',
            agencyId: itemAgencyId,
            tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
            customFields: customFields ? JSON.parse(customFields) : [],
            borrowedBy: (isAssigned || isBorrowed) ? borrowedBy : null,
            borrowDate: (isAssigned || isBorrowed) ? 
                        (wasAssignedOrBorrowed ? inventoryData.items[itemIndex].borrowDate : new Date().toISOString()) : 
                        null,
            expectedReturnDate: isBorrowed && expectedReturnDate ? new Date(expectedReturnDate).toISOString() : null,
            updatedAt: new Date().toISOString()
        };
        
        // Sauvegarde des données
        if (!saveInventoryData(inventoryData)) {
            req.session.error = 'Erreur lors de la sauvegarde de l\'élément';
            return res.redirect(`/inventory/edit/${id}`);
        }
        
        // Ajouter une entrée d'historique pour la modification
        addHistoryEntry(
            id,
            'Modification',
            `Élément modifié par ${req.session.user.username}`,
            req.session.user.id
        );
        
        // Si le statut a changé, ajouter une entrée d'historique spécifique
        const oldStatus = inventoryData.items[itemIndex].status;
        if (status !== oldStatus) {
            let statusAction = '';
            let statusDescription = '';
            
            switch (status) {
                case 'available':
                    statusAction = 'Disponibilité';
                    statusDescription = 'Marqué comme disponible';
                    break;
                case 'assigned':
                    statusAction = 'Attribution';
                    const assignedUser = getUsersData().users.find(u => u.id === borrowedBy);
                    statusDescription = `Attribué à ${assignedUser ? assignedUser.username : 'un utilisateur'}`;
                    break;
                case 'borrowed':
                    statusAction = 'Prêt';
                    const borrower = getUsersData().users.find(u => u.id === borrowedBy);
                    statusDescription = `Prêté à ${borrower ? borrower.username : 'un utilisateur'}${expectedReturnDate ? ` jusqu'au ${new Date(expectedReturnDate).toLocaleDateString('fr-FR')}` : ''}`;
                    break;
                case 'service':
                    statusAction = 'SAV';
                    statusDescription = 'Envoyé en service après-vente';
                    break;
                case 'missing':
                    statusAction = 'Perte';
                    statusDescription = 'Marqué comme introuvable';
                    break;
                default:
                    statusAction = 'Changement de statut';
                    statusDescription = `Statut changé de "${oldStatus}" à "${status}"`;
            }
            
            addHistoryEntry(
                id,
                statusAction,
                statusDescription,
                req.session.user.id
            );
        }
        
        // Redirection avec message de succès
        req.session.success = 'Élément mis à jour avec succès';
        res.redirect('/inventory');
    },
    
    // Supprimer un élément
    deleteItem: (req, res) => {
        const { id } = req.params;
        
        // Récupération des données
        const inventoryData = getInventoryData();
        const itemIndex = inventoryData.items.findIndex(i => i.id === id);
        
        if (itemIndex === -1) {
            req.session.error = 'Élément non trouvé';
            return res.redirect('/inventory');
        }
        
        // Suppression de l'élément
        inventoryData.items.splice(itemIndex, 1);
        
        // Sauvegarde des données
        if (!saveInventoryData(inventoryData)) {
            req.session.error = 'Erreur lors de la suppression de l\'élément';
            return res.redirect('/inventory');
        }
        
        // Redirection avec message de succès
        req.session.success = 'Élément supprimé avec succès';
        res.redirect('/inventory');
    },
    
    // Afficher les détails d'un élément
    showItemDetails: (req, res) => {
        const { id } = req.params;
        const inventoryData = getInventoryData();
        const item = inventoryData.items.find(i => i.id === id);
        
        if (!item) {
            req.session.error = 'Élément non trouvé';
            return res.redirect('/inventory');
        }
        
        const agenciesData = getAgenciesData();
        const usersData = getUsersData();
        
        const agency = item.agencyId ? agenciesData.agencies.find(a => a.id === item.agencyId) : null;
        const borrower = item.borrowedBy ? usersData.users.find(u => u.id === item.borrowedBy) : null;
        
        // Récupérer l'historique de l'élément
        const history = item.history || [];
        
        // Enrichir l'historique avec les noms d'utilisateurs
        const historyWithUsernames = history.map(entry => {
            const historyUser = entry.userId ? usersData.users.find(u => u.id === entry.userId) : null;
            return {
                ...entry,
                username: historyUser ? historyUser.username : 'Utilisateur inconnu'
            };
        });
        
        // Calculer la durée de prêt si l'élément est emprunté
        let borrowDuration = null;
        let reminderStatus = null;
        
        if (item.status === 'borrowed' && item.borrowDate) {
            borrowDuration = calculateBorrowDuration(item.borrowDate);
            reminderStatus = isReminderNeeded(borrowDuration);
        }
        
        res.render('inventory/details', {
            title: 'Détails de l\'Élément',
            item,
            agency,
            borrower,
            history: historyWithUsernames,
            users: usersData.users,
            user: req.session.user,
            borrowDuration,
            reminderStatus
        });
    },
    
    // Prêter un élément
    lendItem: (req, res) => {
        const { id } = req.params;
        const { userId, expectedReturnDate } = req.body;
        
        // Validation de base
        if (!userId || userId === 'none') {
            req.session.error = 'Veuillez sélectionner un utilisateur';
            return res.redirect(`/inventory/details/${id}`);
        }
        
        // Récupération des données
        const inventoryData = getInventoryData();
        const itemIndex = inventoryData.items.findIndex(i => i.id === id);
        const usersData = getUsersData();
        
        if (itemIndex === -1) {
            req.session.error = 'Élément non trouvé';
            return res.redirect('/inventory');
        }
        
        // Vérification de la disponibilité
        if (inventoryData.items[itemIndex].status !== 'available') {
            req.session.error = 'Cet élément n\'est pas disponible pour le prêt';
            return res.redirect(`/inventory/details/${id}`);
        }
        
        // Mise à jour de l'élément
        inventoryData.items[itemIndex] = {
            ...inventoryData.items[itemIndex],
            status: 'borrowed',
            borrowedBy: userId,
            borrowDate: new Date().toISOString(),
            expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate).toISOString() : null,
            updatedAt: new Date().toISOString()
        };
        
        // Sauvegarde des données
        if (!saveInventoryData(inventoryData)) {
            req.session.error = 'Erreur lors du prêt de l\'élément';
            return res.redirect(`/inventory/details/${id}`);
        }
        
        // Ajouter une entrée d'historique pour le prêt
        const user = usersData.users.find(u => u.id === userId);
        addHistoryEntry(
            id,
            'Prêt',
            `Prêté à ${user ? user.username : 'un utilisateur'}${expectedReturnDate ? ` jusqu'au ${new Date(expectedReturnDate).toLocaleDateString('fr-FR')}` : ''}`,
            req.session.user.id
        );
        
        // Redirection avec message de succès
        req.session.success = 'Élément prêté avec succès';
        res.redirect(`/inventory/details/${id}`);
    },
    
    // Attribuer un élément
    assignItem: (req, res) => {
        const { id } = req.params;
        const { userId } = req.body;
        
        // Validation de base
        if (!userId || userId === 'none') {
            req.session.error = 'Veuillez sélectionner un utilisateur';
            return res.redirect(`/inventory/details/${id}`);
        }
        
        // Récupération des données
        const inventoryData = getInventoryData();
        const itemIndex = inventoryData.items.findIndex(i => i.id === id);
        
        if (itemIndex === -1) {
            req.session.error = 'Élément non trouvé';
            return res.redirect('/inventory');
        }
        
        // Vérification de la disponibilité
        if (inventoryData.items[itemIndex].status !== 'available') {
            req.session.error = 'Cet élément n\'est pas disponible pour être attribué';
            return res.redirect(`/inventory/details/${id}`);
        }
        
        // Mise à jour de l'élément
        inventoryData.items[itemIndex] = {
            ...inventoryData.items[itemIndex],
            status: 'assigned',
            borrowedBy: userId,
            borrowDate: new Date().toISOString(),
            expectedReturnDate: null,
            updatedAt: new Date().toISOString()
        };
        
        // Sauvegarde des données
        if (!saveInventoryData(inventoryData)) {
            req.session.error = 'Erreur lors de l\'attribution de l\'élément';
            return res.redirect(`/inventory/details/${id}`);
        }
        
        // Ajouter une entrée d'historique pour l'attribution
        const usersData = getUsersData();
        const user = usersData.users.find(u => u.id === userId);
        addHistoryEntry(
            id,
            'Attribution',
            `Attribué à ${user ? user.username : 'un utilisateur'}`,
            req.session.user.id
        );
        
        // Redirection avec message de succès
        req.session.success = 'Élément attribué avec succès';
        res.redirect(`/inventory/details/${id}`);
    },
    
    // Retourner un élément
    returnItem: (req, res) => {
        const { id } = req.params;
        
        // Récupération des données
        const inventoryData = getInventoryData();
        const itemIndex = inventoryData.items.findIndex(i => i.id === id);
        
        if (itemIndex === -1) {
            req.session.error = 'Élément non trouvé';
            return res.redirect('/inventory');
        }
        
        // Vérification du statut
        if (inventoryData.items[itemIndex].status !== 'borrowed' && inventoryData.items[itemIndex].status !== 'assigned') {
            req.session.error = 'Cet élément n\'est pas actuellement prêté ou attribué';
            return res.redirect(`/inventory/details/${id}`);
        }
        
        // Récupérer les informations sur l'emprunteur pour l'historique
        const usersData = getUsersData();
        const borrowerId = inventoryData.items[itemIndex].borrowedBy;
        const borrower = borrowerId ? usersData.users.find(u => u.id === borrowerId) : null;
        const previousStatus = inventoryData.items[itemIndex].status;
        
        // Mise à jour de l'élément
        inventoryData.items[itemIndex] = {
            ...inventoryData.items[itemIndex],
            status: 'available',
            borrowedBy: null,
            borrowDate: null,
            expectedReturnDate: null,
            agencyId: getITServiceAgencyId(), // Réattribuer au service informatique
            updatedAt: new Date().toISOString()
        };
        
        // Sauvegarde des données
        if (!saveInventoryData(inventoryData)) {
            req.session.error = 'Erreur lors du retour de l\'élément';
            return res.redirect(`/inventory/details/${id}`);
        }
        
        // Ajouter une entrée d'historique pour le retour
        addHistoryEntry(
            id,
            'Retour',
            `Retourné par ${borrower ? borrower.username : 'un utilisateur'} (précédemment ${previousStatus === 'borrowed' ? 'prêté' : 'attribué'})`,
            req.session.user.id
        );
        
        // Ajouter une entrée d'historique pour l'attribution au service informatique
        const itServiceAgencyId = getITServiceAgencyId();
        if (itServiceAgencyId) {
            const agenciesData = getAgenciesData();
            const itServiceAgency = agenciesData.agencies.find(a => a.id === itServiceAgencyId);
            
            addHistoryEntry(
                id,
                'Attribution automatique',
                `Réattribué automatiquement à l'agence ${itServiceAgency ? itServiceAgency.name : 'Services Informatique'}`,
                req.session.user.id
            );
        }
        
        // Redirection avec message de succès
        req.session.success = 'Élément retourné avec succès';
        res.redirect(`/inventory/details/${id}`);
    },
    
    // Ajouter une entrée d'historique de réparation
    addRepairHistory: (req, res) => {
        const { id } = req.params;
        const { repairDescription, repairDate, repairStatus } = req.body;
        
        // Validation de base
        if (!repairDescription || repairDescription.trim() === '') {
            req.session.error = 'La description de la réparation est requise';
            return res.redirect(`/inventory/details/${id}`);
        }
        
        // Récupération des données
        const inventoryData = getInventoryData();
        const itemIndex = inventoryData.items.findIndex(i => i.id === id);
        
        if (itemIndex === -1) {
            req.session.error = 'Élément non trouvé';
            return res.redirect('/inventory');
        }
        
        // Ajouter une entrée d'historique pour la réparation
        addHistoryEntry(
            id,
            'Réparation',
            repairDescription.trim(),
            req.session.user.id
        );
        
        // Si le statut a été changé en "available", ajouter une entrée pour l'attribution au service informatique
        if (repairStatus === 'available') {
            const itServiceAgencyId = getITServiceAgencyId();
            if (itServiceAgencyId) {
                const agenciesData = getAgenciesData();
                const itServiceAgency = agenciesData.agencies.find(a => a.id === itServiceAgencyId);
                
                addHistoryEntry(
                    id,
                    'Attribution automatique',
                    `Réattribué automatiquement à l'agence ${itServiceAgency ? itServiceAgency.name : 'Services Informatique'} après réparation`,
                    req.session.user.id
                );
            }
        }
        
        // Mettre à jour le statut de l'élément si nécessaire
        if (repairStatus && repairStatus !== 'no_change') {
            const oldStatus = inventoryData.items[itemIndex].status;
            inventoryData.items[itemIndex].status = repairStatus;
            
            // Si le statut est changé en "available", réattribuer au service informatique
            if (repairStatus === 'available') {
                const itServiceAgencyId = getITServiceAgencyId();
                inventoryData.items[itemIndex].agencyId = itServiceAgencyId;
                inventoryData.items[itemIndex].borrowedBy = null;
                inventoryData.items[itemIndex].borrowDate = null;
                inventoryData.items[itemIndex].expectedReturnDate = null;
            }
            
            inventoryData.items[itemIndex].updatedAt = new Date().toISOString();
            
            // Sauvegarder les données
            if (!saveInventoryData(inventoryData)) {
                req.session.error = 'Erreur lors de la mise à jour du statut de l\'élément';
                return res.redirect(`/inventory/details/${id}`);
            }
            
            // Ajouter une entrée d'historique pour le changement de statut
            let statusDescription = '';
            switch (repairStatus) {
                case 'available':
                    statusDescription = 'Marqué comme disponible après réparation';
                    break;
                case 'service':
                    statusDescription = 'Envoyé en service après-vente';
                    break;
                default:
                    statusDescription = `Statut changé de "${oldStatus}" à "${repairStatus}" après réparation`;
            }
            
            addHistoryEntry(
                id,
                'Changement de statut',
                statusDescription,
                req.session.user.id
            );
        }
        
        // Redirection avec message de succès
        req.session.success = 'Entrée de réparation ajoutée avec succès';
        res.redirect(`/inventory/details/${id}`);
    }
};

module.exports = inventoryController; 