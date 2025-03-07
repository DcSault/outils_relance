const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Chemin vers le fichier de données des agences
const agenciesFilePath = path.join(__dirname, '../data/agencies.json');
const usersFilePath = path.join(__dirname, '../data/users.json');

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

// Fonction utilitaire pour écrire les données des agences
const saveAgenciesData = (data) => {
    try {
        fs.writeFileSync(agenciesFilePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'écriture du fichier agencies.json:', error);
        return false;
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

// Fonction utilitaire pour écrire les données des utilisateurs
const saveUsersData = (data) => {
    try {
        fs.writeFileSync(usersFilePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'écriture du fichier users.json:', error);
        return false;
    }
};

// Contrôleur pour les agences
const agencyController = {
    // Afficher toutes les agences
    getAllAgencies: (req, res) => {
        const agenciesData = getAgenciesData();
        const usersData = getUsersData();
        
        // Ajouter les informations des utilisateurs associés aux agences
        const agenciesWithUsers = agenciesData.agencies.map(agency => {
            const associatedUser = usersData.users.find(user => user.agency === agency.id);
            return {
                ...agency,
                user: associatedUser || null
            };
        });
        
        res.render('agencies/index', {
            title: 'Gestion des Agences',
            agencies: agenciesWithUsers,
            user: req.session.user
        });
    },
    
    // Afficher le formulaire de création d'une agence
    showCreateForm: (req, res) => {
        const usersData = getUsersData();
        const availableUsers = usersData.users.filter(user => !user.agency);
        
        res.render('agencies/create', {
            title: 'Créer une Agence',
            availableUsers,
            user: req.session.user
        });
    },
    
    // Créer une nouvelle agence
    createAgency: (req, res) => {
        const { name, address, phone, email, userId } = req.body;
        
        // Validation de base
        if (!name || name.trim() === '') {
            return res.render('agencies/create', {
                title: 'Créer une Agence',
                error: 'Le nom de l\'agence est requis',
                formData: req.body,
                user: req.session.user
            });
        }
        
        // Création de la nouvelle agence
        const newAgency = {
            id: uuidv4(),
            name: name.trim(),
            address: address || '',
            phone: phone || '',
            email: email || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Ajout de l'agence à la liste
        const agenciesData = getAgenciesData();
        agenciesData.agencies.push(newAgency);
        
        // Sauvegarde des données
        if (!saveAgenciesData(agenciesData)) {
            return res.render('agencies/create', {
                title: 'Créer une Agence',
                error: 'Erreur lors de la sauvegarde de l\'agence',
                formData: req.body,
                user: req.session.user
            });
        }
        
        // Si un utilisateur est associé, mettre à jour ses informations
        if (userId && userId !== 'none') {
            const usersData = getUsersData();
            const userIndex = usersData.users.findIndex(user => user.id === userId);
            
            if (userIndex !== -1) {
                usersData.users[userIndex].agency = newAgency.id;
                saveUsersData(usersData);
            }
        }
        
        // Redirection avec message de succès
        req.session.success = 'Agence créée avec succès';
        res.redirect('/agencies');
    },
    
    // Afficher le formulaire de modification d'une agence
    showEditForm: (req, res) => {
        const { id } = req.params;
        const agenciesData = getAgenciesData();
        const agency = agenciesData.agencies.find(a => a.id === id);
        
        if (!agency) {
            req.session.error = 'Agence non trouvée';
            return res.redirect('/agencies');
        }
        
        const usersData = getUsersData();
        const currentUser = usersData.users.find(user => user.agency === id);
        const availableUsers = usersData.users.filter(user => !user.agency || user.agency === id);
        
        res.render('agencies/edit', {
            title: 'Modifier l\'Agence',
            agency,
            currentUser,
            availableUsers,
            user: req.session.user
        });
    },
    
    // Mettre à jour une agence
    updateAgency: (req, res) => {
        const { id } = req.params;
        const { name, address, phone, email, userId } = req.body;
        
        // Validation de base
        if (!name || name.trim() === '') {
            req.session.error = 'Le nom de l\'agence est requis';
            return res.redirect(`/agencies/edit/${id}`);
        }
        
        // Récupération des données
        const agenciesData = getAgenciesData();
        const agencyIndex = agenciesData.agencies.findIndex(a => a.id === id);
        
        if (agencyIndex === -1) {
            req.session.error = 'Agence non trouvée';
            return res.redirect('/agencies');
        }
        
        // Mise à jour de l'agence
        agenciesData.agencies[agencyIndex] = {
            ...agenciesData.agencies[agencyIndex],
            name: name.trim(),
            address: address || '',
            phone: phone || '',
            email: email || '',
            updatedAt: new Date().toISOString()
        };
        
        // Sauvegarde des données
        if (!saveAgenciesData(agenciesData)) {
            req.session.error = 'Erreur lors de la sauvegarde de l\'agence';
            return res.redirect(`/agencies/edit/${id}`);
        }
        
        // Gestion de l'association utilisateur-agence
        const usersData = getUsersData();
        
        // Supprimer l'association précédente
        usersData.users.forEach(user => {
            if (user.agency === id) {
                user.agency = null;
            }
        });
        
        // Créer la nouvelle association si un utilisateur est sélectionné
        if (userId && userId !== 'none') {
            const userIndex = usersData.users.findIndex(user => user.id === userId);
            if (userIndex !== -1) {
                usersData.users[userIndex].agency = id;
            }
        }
        
        // Sauvegarde des données utilisateurs
        saveUsersData(usersData);
        
        // Redirection avec message de succès
        req.session.success = 'Agence mise à jour avec succès';
        res.redirect('/agencies');
    },
    
    // Supprimer une agence
    deleteAgency: (req, res) => {
        const { id } = req.params;
        
        // Récupération des données
        const agenciesData = getAgenciesData();
        const agencyIndex = agenciesData.agencies.findIndex(a => a.id === id);
        
        if (agencyIndex === -1) {
            req.session.error = 'Agence non trouvée';
            return res.redirect('/agencies');
        }
        
        // Suppression de l'agence
        agenciesData.agencies.splice(agencyIndex, 1);
        
        // Sauvegarde des données
        if (!saveAgenciesData(agenciesData)) {
            req.session.error = 'Erreur lors de la suppression de l\'agence';
            return res.redirect('/agencies');
        }
        
        // Mise à jour des utilisateurs associés
        const usersData = getUsersData();
        let updated = false;
        
        usersData.users.forEach(user => {
            if (user.agency === id) {
                user.agency = null;
                updated = true;
            }
        });
        
        if (updated) {
            saveUsersData(usersData);
        }
        
        // Redirection avec message de succès
        req.session.success = 'Agence supprimée avec succès';
        res.redirect('/agencies');
    }
};

module.exports = agencyController; 