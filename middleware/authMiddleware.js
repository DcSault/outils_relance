/**
 * Middleware d'authentification et d'autorisation
 */

const fs = require('fs');
const path = require('path');

// Chemin vers le fichier des rôles
const rolesFilePath = path.join(__dirname, '../data/roles.json');

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

// Fonction pour vérifier si un utilisateur a une permission spécifique
const hasPermission = (user, permissionKey) => {
    // Si l'utilisateur est admin, il a toutes les permissions
    if (user.role === 'admin') return true;
    
    // Récupérer les données des rôles
    const rolesData = getRolesData();
    
    // Trouver le rôle de l'utilisateur
    const userRole = rolesData.roles.find(r => r.id === user.role);
    
    // Si le rôle n'existe pas, l'utilisateur n'a pas la permission
    if (!userRole) return false;
    
    // Vérifier si le rôle a la permission demandée
    return userRole.permissions && userRole.permissions[permissionKey] === true;
};

// Middleware pour vérifier si l'utilisateur est connecté
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.session.error = 'Vous devez être connecté pour accéder à cette page';
    res.redirect('/');
};

// Middleware pour vérifier si l'utilisateur est un technicien (membre de la DSI)
const isTechnicien = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'technicien' || req.session.user.role === 'admin' || hasPermission(req.session.user, 'perm_inventory_view'))) {
        return next();
    }
    req.session.error = 'Vous n\'avez pas les droits nécessaires pour accéder à cette page';
    res.redirect('/dashboard');
};

// Middleware pour vérifier si l'utilisateur est un administrateur
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.session.error = 'Vous n\'avez pas les droits nécessaires pour accéder à cette page';
    res.redirect('/dashboard');
};

// Middleware pour vérifier si l'utilisateur a une permission spécifique
const hasPermissionMiddleware = (permissionKey) => {
    return (req, res, next) => {
        if (req.session.user && hasPermission(req.session.user, permissionKey)) {
            return next();
        }
        req.session.error = 'Vous n\'avez pas les droits nécessaires pour accéder à cette page';
        res.redirect('/dashboard');
    };
};

// Middleware pour vérifier si l'utilisateur est le propriétaire de la ressource ou un admin
const isOwnerOrAdmin = (resourceUserId) => {
    return (req, res, next) => {
        if (req.session.user && (req.session.user.id === resourceUserId || req.session.user.role === 'admin')) {
            return next();
        }
        req.session.error = 'Vous n\'avez pas les droits nécessaires pour accéder à cette ressource';
        res.redirect('/dashboard');
    };
};

module.exports = {
    isAuthenticated,
    isTechnicien,
    isAdmin,
    hasPermission,
    hasPermissionMiddleware,
    isOwnerOrAdmin
}; 