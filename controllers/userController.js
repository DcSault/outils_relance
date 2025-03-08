const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Chemin vers les fichiers de données
const usersFilePath = path.join(__dirname, '../data/users.json');
const agenciesFilePath = path.join(__dirname, '../data/agencies.json');
const rolesFilePath = path.join(__dirname, '../data/roles.json');
const inventoryFilePath = path.join(__dirname, '../data/inventory.json');
const remindersFilePath = path.join(__dirname, '../data/reminders.json');

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

// Fonction utilitaire pour lire les données des rôles
const getRolesData = () => {
    try {
        const data = fs.readFileSync(rolesFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors de la lecture du fichier roles.json:', error);
        return { roles: [] };
    }
};

// Fonction utilitaire pour écrire les données des rôles
const saveRolesData = (data) => {
    try {
        fs.writeFileSync(rolesFilePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'écriture du fichier roles.json:', error);
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

// Contrôleur pour les utilisateurs
const userController = {
    // Afficher la page de gestion des rôles et droits
    showRolesManagement: (req, res) => {
        const rolesData = getRolesData();
        
        res.render('users/roles', {
            title: 'Gestion des Rôles et Droits',
            roles: rolesData.roles,
            user: req.session.user
        });
    },
    
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
    },
    
    // Afficher les détails d'un utilisateur
    showUserDetails: (req, res) => {
        const { id } = req.params;
        
        // Récupération des données
        const usersData = getUsersData();
        const user = usersData.users.find(u => u.id === id);
        
        if (!user) {
            req.session.error = 'Utilisateur non trouvé';
            return res.redirect('/users');
        }
        
        // Récupération des données des agences
        const agenciesData = getAgenciesData();
        const agency = user.agency ? agenciesData.agencies.find(a => a.id === user.agency) : null;
        
        // Récupération des données de l'inventaire
        const inventoryData = getInventoryData();
        
        // Éléments actuellement empruntés par l'utilisateur
        const borrowedItems = inventoryData.items.filter(item => 
            item.borrowedBy === user.id && 
            (item.status === 'borrowed' || item.status === 'assigned')
        );
        
        // Historique des éléments retournés
        const returnedItems = [];
        
        // Parcourir tous les éléments pour trouver ceux qui ont un historique de retour pour cet utilisateur
        inventoryData.items.forEach(item => {
            if (item.history) {
                const returnEntries = item.history.filter(entry => 
                    entry.action === 'Retour' && 
                    entry.description.toLowerCase().includes(user.username.toLowerCase())
                );
                
                returnEntries.forEach(entry => {
                    returnedItems.push({
                        ...entry,
                        itemId: item.id,
                        itemName: item.name
                    });
                });
            }
        });
        
        // Récupération des données des relances
        const remindersData = getRemindersData();
        
        // Relances pour cet utilisateur
        const reminders = remindersData.reminders
            .filter(reminder => reminder.userId === user.id)
            .map(reminder => {
                const item = inventoryData.items.find(i => i.id === reminder.itemId);
                return {
                    ...reminder,
                    itemName: item ? item.name : 'Élément inconnu'
                };
            });
        
        // Historique des réparations
        const repairs = [];
        
        // Parcourir tous les éléments pour trouver les réparations sur le matériel de l'utilisateur
        inventoryData.items.forEach(item => {
            if (item.history) {
                const repairEntries = item.history.filter(entry => 
                    entry.action === 'Réparation' && 
                    (item.borrowedBy === user.id || 
                     returnedItems.some(ri => ri.itemId === item.id))
                );
                
                repairEntries.forEach(entry => {
                    const technician = usersData.users.find(u => u.id === entry.userId);
                    
                    repairs.push({
                        ...entry,
                        itemId: item.id,
                        itemName: item.name,
                        technicianName: technician ? technician.username : 'Utilisateur inconnu'
                    });
                });
            }
        });
        
        // Rendu de la page de détails
        res.render('users/details', {
            title: `Détails de l'utilisateur ${user.username}`,
            userData: user,
            agency,
            borrowedItems,
            returnedItems,
            reminders,
            repairs,
            user: req.session.user
        });
    },
    
    // Créer un nouveau rôle
    createRole: (req, res) => {
        const { name, description, baseRole } = req.body;
        
        // Validation de base
        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Le nom du rôle est requis' });
        }
        
        // Récupération des données des rôles
        const rolesData = getRolesData();
        
        // Vérifier si le rôle existe déjà
        if (rolesData.roles.some(r => r.name.toLowerCase() === name.toLowerCase())) {
            return res.status(400).json({ success: false, message: 'Un rôle avec ce nom existe déjà' });
        }
        
        // Récupérer les permissions du rôle de base
        const baseRoleData = rolesData.roles.find(r => r.id === baseRole);
        if (!baseRoleData) {
            return res.status(400).json({ success: false, message: 'Rôle de base invalide' });
        }
        
        // Générer un ID unique pour le nouveau rôle
        const roleId = 'role_' + uuidv4().substring(0, 8);
        
        // Créer le nouveau rôle
        const newRole = {
            id: roleId,
            name: name.trim(),
            description: description || '',
            isSystem: false,
            permissions: { ...baseRoleData.permissions }
        };
        
        // Ajouter le rôle à la liste
        rolesData.roles.push(newRole);
        
        // Sauvegarder les données
        if (!saveRolesData(rolesData)) {
            return res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde du rôle' });
        }
        
        // Retourner le succès
        return res.status(200).json({ success: true, role: newRole });
    },
    
    // Mettre à jour les permissions d'un rôle
    updateRolePermissions: (req, res) => {
        const { roleId, permissions } = req.body;
        
        // Récupération des données des rôles
        const rolesData = getRolesData();
        
        // Trouver le rôle à mettre à jour
        const roleIndex = rolesData.roles.findIndex(r => r.id === roleId);
        if (roleIndex === -1) {
            return res.status(404).json({ success: false, message: 'Rôle non trouvé' });
        }
        
        // Vérifier les permissions critiques pour les rôles système
        if (rolesData.roles[roleIndex].isSystem) {
            // Pour le rôle admin, on s'assure que certaines permissions restent activées
            if (roleId === 'admin') {
                permissions.perm_roles_manage = true; // L'admin doit toujours pouvoir gérer les rôles
                permissions.perm_users_view = true; // L'admin doit toujours pouvoir voir les utilisateurs
                permissions.perm_users_edit = true; // L'admin doit toujours pouvoir modifier les utilisateurs
            }
            
            // Pour le rôle technicien, on s'assure qu'il garde certaines permissions minimales
            if (roleId === 'technicien') {
                permissions.perm_inventory_view = true; // Le technicien doit toujours pouvoir voir l'inventaire
            }
        }
        
        // Mettre à jour les permissions
        rolesData.roles[roleIndex].permissions = permissions;
        
        // Sauvegarder les données
        if (!saveRolesData(rolesData)) {
            return res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde des permissions' });
        }
        
        // Retourner le succès
        return res.status(200).json({ success: true });
    },
    
    // Supprimer un rôle
    deleteRole: (req, res) => {
        const { roleId } = req.params;
        
        // Récupération des données des rôles
        const rolesData = getRolesData();
        
        // Trouver le rôle à supprimer
        const roleIndex = rolesData.roles.findIndex(r => r.id === roleId);
        if (roleIndex === -1) {
            return res.status(404).json({ success: false, message: 'Rôle non trouvé' });
        }
        
        // Vérifier si c'est un rôle système
        if (rolesData.roles[roleIndex].isSystem) {
            return res.status(403).json({ success: false, message: 'Les rôles système ne peuvent pas être supprimés' });
        }
        
        // Récupérer les données des utilisateurs
        const usersData = getUsersData();
        
        // Mettre à jour les utilisateurs qui avaient ce rôle
        let usersUpdated = false;
        usersData.users.forEach(user => {
            if (user.role === roleId) {
                user.role = 'user'; // Réaffecter au rôle utilisateur par défaut
                user.updatedAt = new Date().toISOString();
                usersUpdated = true;
            }
        });
        
        // Sauvegarder les données des utilisateurs si nécessaire
        if (usersUpdated) {
            if (!saveUsersData(usersData)) {
                return res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour des utilisateurs' });
            }
        }
        
        // Supprimer le rôle
        rolesData.roles.splice(roleIndex, 1);
        
        // Sauvegarder les données des rôles
        if (!saveRolesData(rolesData)) {
            return res.status(500).json({ success: false, message: 'Erreur lors de la suppression du rôle' });
        }
        
        // Retourner le succès
        return res.status(200).json({ success: true });
    }
};

module.exports = userController; 