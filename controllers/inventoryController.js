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

// Contrôleur pour l'inventaire
const inventoryController = {
    // Afficher tous les éléments de l'inventaire
    getAllItems: (req, res) => {
        const inventoryData = getInventoryData();
        const agenciesData = getAgenciesData();
        const usersData = getUsersData();
        
        // Ajouter les informations des agences et des utilisateurs aux éléments
        const itemsWithDetails = inventoryData.items.map(item => {
            const agency = item.agencyId ? agenciesData.agencies.find(a => a.id === item.agencyId) : null;
            const user = item.borrowedBy ? usersData.users.find(u => u.id === item.borrowedBy) : null;
            
            return {
                ...item,
                agency: agency ? agency.name : null,
                borrower: user ? user.username : null
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
            agencyId: agencyId !== 'none' ? agencyId : null,
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
        
        // Mise à jour de l'élément
        inventoryData.items[itemIndex] = {
            ...inventoryData.items[itemIndex],
            name: name.trim(),
            description: description || '',
            serialNumber: serialNumber || '',
            quantity: parseInt(quantity) || 1,
            status: status || 'available',
            agencyId: agencyId !== 'none' ? agencyId : null,
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
        
        res.render('inventory/details', {
            title: 'Détails de l\'Élément',
            item,
            agency,
            borrower,
            users: usersData.users,
            user: req.session.user
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
        
        // Mise à jour de l'élément
        inventoryData.items[itemIndex] = {
            ...inventoryData.items[itemIndex],
            status: 'available',
            borrowedBy: null,
            borrowDate: null,
            expectedReturnDate: null,
            updatedAt: new Date().toISOString()
        };
        
        // Sauvegarde des données
        if (!saveInventoryData(inventoryData)) {
            req.session.error = 'Erreur lors du retour de l\'élément';
            return res.redirect(`/inventory/details/${id}`);
        }
        
        // Redirection avec message de succès
        req.session.success = 'Élément retourné avec succès';
        res.redirect(`/inventory/details/${id}`);
    }
};

module.exports = inventoryController; 