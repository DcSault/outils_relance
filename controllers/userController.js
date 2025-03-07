const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Chemin vers les fichiers de données
const usersFilePath = path.join(__dirname, '../data/users.json');
const agenciesFilePath = path.join(__dirname, '../data/agencies.json');

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

// Contrôleur pour les utilisateurs
const userController = {
    // Afficher tous les utilisateurs
    getAllUsers: (req, res) => {
        const usersData = getUsersData();
        const agenciesData = getAgenciesData();
        
        // Ajouter les informations des agences aux utilisateurs
        const usersWithAgencies = usersData.users.map(user => {
            const agency = user.agency ? agenciesData.agencies.find(a => a.id === user.agency) : null;
            
            return {
                ...user,
                agencyName: agency ? agency.name : null
            };
        });
        
        res.render('users/index', {
            title: 'Gestion des Utilisateurs',
            users: usersWithAgencies,
            user: req.session.user
        });
    },
    
    // Afficher le formulaire de création d'un utilisateur
    showCreateForm: (req, res) => {
        const agenciesData = getAgenciesData();
        
        res.render('users/create', {
            title: 'Créer un Utilisateur',
            agencies: agenciesData.agencies,
            user: req.session.user
        });
    },
    
    // Créer un nouvel utilisateur
    createUser: (req, res) => {
        const { username, agencyId, role, email, phone } = req.body;
        
        // Validation de base
        if (!username || username.trim() === '') {
            return res.render('users/create', {
                title: 'Créer un Utilisateur',
                error: 'Le nom d\'utilisateur est requis',
                formData: req.body,
                agencies: getAgenciesData().agencies,
                user: req.session.user
            });
        }
        
        // Vérifier si l'utilisateur existe déjà
        const usersData = getUsersData();
        if (usersData.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            return res.render('users/create', {
                title: 'Créer un Utilisateur',
                error: 'Ce nom d\'utilisateur existe déjà',
                formData: req.body,
                agencies: getAgenciesData().agencies,
                user: req.session.user
            });
        }
        
        // Création du nouvel utilisateur
        const newUser = {
            id: uuidv4(),
            username: username.trim(),
            agency: agencyId !== 'none' ? agencyId : null,
            role: role || 'user', // admin, user, technicien
            email: email || '',
            phone: phone || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Si l'utilisateur est un technicien et qu'aucune agence n'est spécifiée,
        // on l'associe automatiquement à l'agence Services Informatique
        if (newUser.role === 'technicien' && !newUser.agency) {
            // Recherche de l'agence Services Informatique
            const agenciesData = getAgenciesData();
            const itServiceAgency = agenciesData.agencies.find(a => a.name === 'Services Informatique');
            
            if (itServiceAgency) {
                newUser.agency = itServiceAgency.id;
            }
        }
        
        // Ajout de l'utilisateur à la liste
        usersData.users.push(newUser);
        
        // Sauvegarde des données
        if (!saveUsersData(usersData)) {
            return res.render('users/create', {
                title: 'Créer un Utilisateur',
                error: 'Erreur lors de la sauvegarde de l\'utilisateur',
                formData: req.body,
                agencies: getAgenciesData().agencies,
                user: req.session.user
            });
        }
        
        // Redirection avec message de succès
        req.session.success = 'Utilisateur créé avec succès';
        res.redirect('/users');
    },
    
    // Afficher le formulaire de modification d'un utilisateur
    showEditForm: (req, res) => {
        const { id } = req.params;
        const usersData = getUsersData();
        const user = usersData.users.find(u => u.id === id);
        
        if (!user) {
            req.session.error = 'Utilisateur non trouvé';
            return res.redirect('/users');
        }
        
        const agenciesData = getAgenciesData();
        
        res.render('users/edit', {
            title: 'Modifier l\'Utilisateur',
            userData: user,
            agencies: agenciesData.agencies,
            user: req.session.user
        });
    },
    
    // Mettre à jour un utilisateur
    updateUser: (req, res) => {
        const { id } = req.params;
        const { username, agencyId, role, email, phone } = req.body;
        
        // Validation de base
        if (!username || username.trim() === '') {
            req.session.error = 'Le nom d\'utilisateur est requis';
            return res.redirect(`/users/edit/${id}`);
        }
        
        // Récupération des données
        const usersData = getUsersData();
        const userIndex = usersData.users.findIndex(u => u.id === id);
        
        if (userIndex === -1) {
            req.session.error = 'Utilisateur non trouvé';
            return res.redirect('/users');
        }
        
        // Vérifier si le nom d'utilisateur existe déjà (sauf pour l'utilisateur actuel)
        if (usersData.users.some(u => u.id !== id && u.username.toLowerCase() === username.toLowerCase())) {
            req.session.error = 'Ce nom d\'utilisateur existe déjà';
            return res.redirect(`/users/edit/${id}`);
        }
        
        // Mise à jour de l'utilisateur
        const updatedUser = {
            ...usersData.users[userIndex],
            username: username.trim(),
            agency: agencyId !== 'none' ? agencyId : null,
            role: role || 'user',
            email: email || '',
            phone: phone || '',
            updatedAt: new Date().toISOString()
        };
        
        // Si l'utilisateur est un technicien et qu'aucune agence n'est spécifiée,
        // on l'associe automatiquement à l'agence Services Informatique
        if (updatedUser.role === 'technicien' && !updatedUser.agency) {
            // Recherche de l'agence Services Informatique
            const agenciesData = getAgenciesData();
            const itServiceAgency = agenciesData.agencies.find(a => a.name === 'Services Informatique');
            
            if (itServiceAgency) {
                updatedUser.agency = itServiceAgency.id;
            }
        }
        
        // Mise à jour dans le tableau
        usersData.users[userIndex] = updatedUser;
        
        // Sauvegarde des données
        if (!saveUsersData(usersData)) {
            req.session.error = 'Erreur lors de la sauvegarde de l\'utilisateur';
            return res.redirect(`/users/edit/${id}`);
        }
        
        // Redirection avec message de succès
        req.session.success = 'Utilisateur mis à jour avec succès';
        res.redirect('/users');
    },
    
    // Supprimer un utilisateur
    deleteUser: (req, res) => {
        const { id } = req.params;
        
        // Récupération des données
        const usersData = getUsersData();
        const userIndex = usersData.users.findIndex(u => u.id === id);
        
        if (userIndex === -1) {
            req.session.error = 'Utilisateur non trouvé';
            return res.redirect('/users');
        }
        
        // Vérifier si l'utilisateur est l'utilisateur connecté
        if (req.session.user && req.session.user.id === id) {
            req.session.error = 'Vous ne pouvez pas supprimer votre propre compte';
            return res.redirect('/users');
        }
        
        // Suppression de l'utilisateur
        usersData.users.splice(userIndex, 1);
        
        // Sauvegarde des données
        if (!saveUsersData(usersData)) {
            req.session.error = 'Erreur lors de la suppression de l\'utilisateur';
            return res.redirect('/users');
        }
        
        // Redirection avec message de succès
        req.session.success = 'Utilisateur supprimé avec succès';
        res.redirect('/users');
    }
};

module.exports = userController; 