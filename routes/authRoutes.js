const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const passport = require('passport');

// Référence aux loggers
const serverLogger = winston.loggers.get('server') || winston.createLogger();
const appLogger = winston.loggers.get('app') || winston.createLogger();

// Chemin vers les fichiers de données
const configFilePath = path.join(__dirname, '../data/config.json');
const usersFilePath = path.join(__dirname, '../data/users.json');

// Fonction utilitaire pour lire les données de configuration
const getConfigData = () => {
    try {
        if (fs.existsSync(configFilePath)) {
            return JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
        }
    } catch (error) {
        serverLogger.error(`Erreur lors de la lecture du fichier config.json: ${error.message}`);
    }
    return { auth: { methods: { local: { enabled: true } } } };
};

// Fonction utilitaire pour lire les données utilisateurs
const getUsersData = () => {
    try {
        if (fs.existsSync(usersFilePath)) {
            return JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        }
    } catch (error) {
        serverLogger.error(`Erreur lors de la lecture du fichier users.json: ${error.message}`);
    }
    return { users: [] };
};

// Fonction utilitaire pour sauvegarder les données utilisateurs
const saveUsersData = (usersData) => {
    try {
        fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2));
        return true;
    } catch (error) {
        serverLogger.error(`Erreur lors de la sauvegarde du fichier users.json: ${error.message}`);
        return false;
    }
};

// Middleware pour vérifier si l'authentification est activée
const checkAuthEnabled = (provider) => {
    return (req, res, next) => {
        const config = getConfigData();
        
        if (!config.auth.methods[provider] || !config.auth.methods[provider].enabled) {
            appLogger.warn(`Tentative d'authentification ${provider} alors que la méthode est désactivée - IP: ${req.ip}`);
            req.session.error = `L'authentification ${provider} n'est pas activée.`;
            return res.redirect('/');
        }
        
        next();
    };
};

// Middleware pour vérifier si la stratégie d'authentification est disponible
const checkStrategyAvailable = (strategyName) => {
    return (req, res, next) => {
        if (!passport._strategies[strategyName]) {
            appLogger.warn(`Tentative d'utilisation de la stratégie ${strategyName} qui n'est pas initialisée - IP: ${req.ip}`);
            req.session.error = `L'authentification ${strategyName} n'est pas correctement configurée. Veuillez contacter l'administrateur.`;
            return res.redirect('/');
        }
        next();
    };
};

// Route pour Discord
router.get('/discord', (req, res, next) => {
    const config = getConfigData();
    
    // Vérifier si l'authentification Discord est activée
    if (!config.auth.methods.discord || !config.auth.methods.discord.enabled) {
        appLogger.warn(`Tentative d'authentification Discord alors que la méthode est désactivée - IP: ${req.ip}`);
        req.session.error = "L'authentification Discord n'est pas activée.";
        return res.redirect('/');
    }
    
    // Vérifier si la stratégie est disponible
    if (!passport._strategies['discord']) {
        appLogger.warn(`Tentative d'utilisation de la stratégie Discord qui n'est pas initialisée - IP: ${req.ip}`);
        req.session.error = "L'authentification Discord n'est pas correctement configurée. Veuillez contacter l'administrateur.";
        return res.redirect('/');
    }
    
    // Journaliser la tentative d'authentification
    appLogger.info(`Tentative d'authentification Discord - IP: ${req.ip} - Redirect URI: ${config.auth.methods.discord.redirectUri}`);
    
    // Passer à l'authentification
    passport.authenticate('discord', (err, user, info) => {
        if (err) {
            appLogger.error(`Erreur lors de l'authentification Discord: ${err.message}`);
            req.session.error = `Erreur d'authentification Discord: ${err.message}`;
            return res.redirect('/');
        }
        next();
    })(req, res, next);
}, passport.authenticate('discord'));

// Callback pour Discord
router.get('/discord/callback', checkStrategyAvailable('discord'), (req, res, next) => {
    appLogger.info(`Callback Discord reçu - URL: ${req.originalUrl}`);
    
    passport.authenticate('discord', (err, user, info) => {
        if (err) {
            appLogger.error(`Erreur lors du callback Discord: ${err.message}`);
            req.session.error = `Erreur d'authentification Discord: ${err.message}`;
            return res.redirect('/');
        }
        
        if (!user) {
            appLogger.warn(`Authentification Discord échouée - Info: ${JSON.stringify(info)}`);
            req.session.error = "L'authentification Discord a échoué.";
            return res.redirect('/');
        }
        
        req.logIn(user, (err) => {
            if (err) {
                appLogger.error(`Erreur lors de la connexion de l'utilisateur Discord: ${err.message}`);
                req.session.error = "Erreur lors de la connexion.";
                return res.redirect('/');
            }
            
            // Authentification réussie
            appLogger.info(`Authentification Discord réussie pour l'utilisateur ${user.username}`);
            req.session.user = user;
            res.redirect('/dashboard');
        });
    })(req, res, next);
});

// Route pour GitHub
router.get('/github', (req, res, next) => {
    const config = getConfigData();
    
    // Vérifier si l'authentification GitHub est activée
    if (!config.auth.methods.github || !config.auth.methods.github.enabled) {
        appLogger.warn(`Tentative d'authentification GitHub alors que la méthode est désactivée - IP: ${req.ip}`);
        req.session.error = "L'authentification GitHub n'est pas activée.";
        return res.redirect('/');
    }
    
    // Vérifier si la stratégie est disponible
    if (!passport._strategies['github']) {
        appLogger.warn(`Tentative d'utilisation de la stratégie GitHub qui n'est pas initialisée - IP: ${req.ip}`);
        req.session.error = "L'authentification GitHub n'est pas correctement configurée. Veuillez contacter l'administrateur.";
        return res.redirect('/');
    }
    
    // Journaliser la tentative d'authentification
    appLogger.info(`Tentative d'authentification GitHub - IP: ${req.ip} - Redirect URI: ${config.auth.methods.github.redirectUri}`);
    
    // Passer à l'authentification
    passport.authenticate('github', (err, user, info) => {
        if (err) {
            appLogger.error(`Erreur lors de l'authentification GitHub: ${err.message}`);
            req.session.error = `Erreur d'authentification GitHub: ${err.message}`;
            return res.redirect('/');
        }
        next();
    })(req, res, next);
}, passport.authenticate('github'));

// Callback pour GitHub
router.get('/github/callback', checkStrategyAvailable('github'), (req, res, next) => {
    appLogger.info(`Callback GitHub reçu - URL: ${req.originalUrl}`);
    
    passport.authenticate('github', (err, user, info) => {
        if (err) {
            appLogger.error(`Erreur lors du callback GitHub: ${err.message}`);
            req.session.error = `Erreur d'authentification GitHub: ${err.message}`;
            return res.redirect('/');
        }
        
        if (!user) {
            appLogger.warn(`Authentification GitHub échouée - Info: ${JSON.stringify(info)}`);
            req.session.error = "L'authentification GitHub a échoué.";
            return res.redirect('/');
        }
        
        req.logIn(user, (err) => {
            if (err) {
                appLogger.error(`Erreur lors de la connexion de l'utilisateur GitHub: ${err.message}`);
                req.session.error = "Erreur lors de la connexion.";
                return res.redirect('/');
            }
            
            // Authentification réussie
            appLogger.info(`Authentification GitHub réussie pour l'utilisateur ${user.username}`);
            req.session.user = user;
            res.redirect('/dashboard');
        });
    })(req, res, next);
});

// Route pour Azure
router.get('/azure', (req, res, next) => {
    const config = getConfigData();
    
    // Vérifier si l'authentification Azure est activée
    if (!config.auth.methods.azure || !config.auth.methods.azure.enabled) {
        appLogger.warn(`Tentative d'authentification Azure alors que la méthode est désactivée - IP: ${req.ip}`);
        req.session.error = "L'authentification Azure n'est pas activée.";
        return res.redirect('/');
    }
    
    // Vérifier si la stratégie est disponible
    if (!passport._strategies['azuread-openidconnect']) {
        appLogger.warn(`Tentative d'utilisation de la stratégie Azure qui n'est pas initialisée - IP: ${req.ip}`);
        req.session.error = "L'authentification Azure n'est pas correctement configurée. Veuillez contacter l'administrateur.";
        return res.redirect('/');
    }
    
    // Journaliser la tentative d'authentification
    appLogger.info(`Tentative d'authentification Azure - IP: ${req.ip} - Redirect URI: ${config.auth.methods.azure.redirectUri}`);
    
    // Passer à l'authentification
    passport.authenticate('azuread-openidconnect', (err, user, info) => {
        if (err) {
            appLogger.error(`Erreur lors de l'authentification Azure: ${err.message}`);
            req.session.error = `Erreur d'authentification Azure: ${err.message}`;
            return res.redirect('/');
        }
        next();
    })(req, res, next);
}, passport.authenticate('azuread-openidconnect'));

// Callback pour Azure
router.post('/azure/callback', checkStrategyAvailable('azuread-openidconnect'), (req, res, next) => {
    appLogger.info(`Callback Azure reçu - URL: ${req.originalUrl}`);
    
    passport.authenticate('azuread-openidconnect', (err, user, info) => {
        if (err) {
            appLogger.error(`Erreur lors du callback Azure: ${err.message}`);
            req.session.error = `Erreur d'authentification Azure: ${err.message}`;
            return res.redirect('/');
        }
        
        if (!user) {
            appLogger.warn(`Authentification Azure échouée - Info: ${JSON.stringify(info)}`);
            req.session.error = "L'authentification Azure a échoué.";
            return res.redirect('/');
        }
        
        req.logIn(user, (err) => {
            if (err) {
                appLogger.error(`Erreur lors de la connexion de l'utilisateur Azure: ${err.message}`);
                req.session.error = "Erreur lors de la connexion.";
                return res.redirect('/');
            }
            
            // Authentification réussie
            appLogger.info(`Authentification Azure réussie pour l'utilisateur ${user.username}`);
            req.session.user = user;
            res.redirect('/dashboard');
        });
    })(req, res, next);
});

// Route pour Okta
router.get('/okta', (req, res, next) => {
    const config = getConfigData();
    
    // Vérifier si l'authentification Okta est activée
    if (!config.auth.methods.okta || !config.auth.methods.okta.enabled) {
        appLogger.warn(`Tentative d'authentification Okta alors que la méthode est désactivée - IP: ${req.ip}`);
        req.session.error = "L'authentification Okta n'est pas activée.";
        return res.redirect('/');
    }
    
    // Vérifier si la stratégie est disponible
    if (!passport._strategies['okta']) {
        appLogger.warn(`Tentative d'utilisation de la stratégie Okta qui n'est pas initialisée - IP: ${req.ip}`);
        req.session.error = "L'authentification Okta n'est pas correctement configurée. Veuillez contacter l'administrateur.";
        return res.redirect('/');
    }
    
    // Journaliser la tentative d'authentification
    appLogger.info(`Tentative d'authentification Okta - IP: ${req.ip} - Redirect URI: ${config.auth.methods.okta.redirectUri}`);
    
    // Passer à l'authentification
    passport.authenticate('okta', (err, user, info) => {
        if (err) {
            appLogger.error(`Erreur lors de l'authentification Okta: ${err.message}`);
            req.session.error = `Erreur d'authentification Okta: ${err.message}`;
            return res.redirect('/');
        }
        next();
    })(req, res, next);
}, passport.authenticate('okta'));

// Callback pour Okta
router.get('/okta/callback', checkStrategyAvailable('okta'), (req, res, next) => {
    appLogger.info(`Callback Okta reçu - URL: ${req.originalUrl}`);
    
    passport.authenticate('okta', (err, user, info) => {
        if (err) {
            appLogger.error(`Erreur lors du callback Okta: ${err.message}`);
            req.session.error = `Erreur d'authentification Okta: ${err.message}`;
            return res.redirect('/');
        }
        
        if (!user) {
            appLogger.warn(`Authentification Okta échouée - Info: ${JSON.stringify(info)}`);
            req.session.error = "L'authentification Okta a échoué.";
            return res.redirect('/');
        }
        
        req.logIn(user, (err) => {
            if (err) {
                appLogger.error(`Erreur lors de la connexion de l'utilisateur Okta: ${err.message}`);
                req.session.error = "Erreur lors de la connexion.";
                return res.redirect('/');
            }
            
            // Authentification réussie
            appLogger.info(`Authentification Okta réussie pour l'utilisateur ${user.username}`);
            req.session.user = user;
            res.redirect('/dashboard');
        });
    })(req, res, next);
});

module.exports = router; 