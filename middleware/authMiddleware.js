/**
 * Middleware d'authentification et d'autorisation
 */

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
    if (req.session.user && (req.session.user.role === 'technicien' || req.session.user.role === 'admin')) {
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
    isOwnerOrAdmin
}; 