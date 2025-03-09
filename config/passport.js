const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const AzureStrategy = require('passport-azure-ad').OIDCStrategy;
const OAuth2Strategy = require('passport-oauth2').Strategy;
const fs = require('fs');
const path = require('path');
const winston = require('winston');

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

// Fonction pour trouver ou créer un utilisateur
const findOrCreateUser = (profile, provider) => {
    const usersData = getUsersData();
    
    // Chercher un utilisateur existant avec cet ID de fournisseur
    let user = usersData.users.find(u => 
        u.providerIds && u.providerIds[provider] === profile.id
    );
    
    if (!user) {
        // Créer un nouvel utilisateur
        const username = profile.username || profile.displayName || `${provider}_${profile.id}`;
        
        // Vérifier si le nom d'utilisateur existe déjà
        const existingUser = usersData.users.find(u => u.username === username);
        
        if (existingUser) {
            // Ajouter l'ID du fournisseur à l'utilisateur existant
            existingUser.providerIds = existingUser.providerIds || {};
            existingUser.providerIds[provider] = profile.id;
            user = existingUser;
        } else {
            // Créer un nouvel utilisateur
            user = {
                id: Date.now().toString(),
                username: username,
                role: 'technicien', // Par défaut, les utilisateurs externes sont des techniciens
                createdAt: new Date().toISOString(),
                providerIds: {
                    [provider]: profile.id
                }
            };
            
            // Ajouter l'utilisateur à la liste
            usersData.users.push(user);
        }
        
        // Sauvegarder les modifications
        saveUsersData(usersData);
    }
    
    return user;
};

module.exports = () => {
    // Sérialisation et désérialisation de l'utilisateur
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });
    
    passport.deserializeUser((id, done) => {
        const usersData = getUsersData();
        const user = usersData.users.find(u => u.id === id);
        done(null, user || null);
    });
    
    // Configuration des stratégies d'authentification
    const config = getConfigData();
    
    // Discord
    if (config.auth.methods.discord && config.auth.methods.discord.enabled) {
        const discordConfig = {
            clientID: config.auth.methods.discord.clientId,
            clientSecret: config.auth.methods.discord.clientSecret,
            callbackURL: config.auth.methods.discord.redirectUri,
            scope: ['identify', 'email']
        };
        
        // Journaliser la configuration pour le débogage
        serverLogger.info(`Configuration Discord: ${JSON.stringify({
            clientID: discordConfig.clientID,
            callbackURL: discordConfig.callbackURL,
            scope: discordConfig.scope
        })}`);
        
        passport.use(new DiscordStrategy(discordConfig, (accessToken, refreshToken, profile, done) => {
            try {
                appLogger.info(`Authentification Discord réussie pour l'utilisateur ${profile.username}`);
                const user = findOrCreateUser(profile, 'discord');
                return done(null, user);
            } catch (error) {
                appLogger.error(`Erreur lors de l'authentification Discord: ${error.message}`);
                return done(error, null);
            }
        }));
    }
    
    // GitHub
    if (config.auth.methods.github && config.auth.methods.github.enabled) {
        // Vérifier que les informations nécessaires sont présentes
        if (config.auth.methods.github.clientId && 
            config.auth.methods.github.clientSecret && 
            config.auth.methods.github.redirectUri) {
            
            passport.use(new GitHubStrategy({
                clientID: config.auth.methods.github.clientId,
                clientSecret: config.auth.methods.github.clientSecret,
                callbackURL: config.auth.methods.github.redirectUri
            }, (accessToken, refreshToken, profile, done) => {
                try {
                    appLogger.info(`Authentification GitHub réussie pour l'utilisateur ${profile.username}`);
                    const user = findOrCreateUser(profile, 'github');
                    return done(null, user);
                } catch (error) {
                    appLogger.error(`Erreur lors de l'authentification GitHub: ${error.message}`);
                    return done(error, null);
                }
            }));
        } else {
            serverLogger.warn("GitHub est activé mais les informations d'identification sont incomplètes. La stratégie d'authentification GitHub n'a pas été initialisée.");
            console.warn("GitHub est activé mais les informations d'identification sont incomplètes. La stratégie d'authentification GitHub n'a pas été initialisée.");
        }
    }
    
    // Azure AD
    if (config.auth.methods.azure && config.auth.methods.azure.enabled) {
        // Vérifier que les informations nécessaires sont présentes
        if (config.auth.methods.azure.clientId && 
            config.auth.methods.azure.clientSecret && 
            config.auth.methods.azure.tenantId && 
            config.auth.methods.azure.redirectUri) {
            
            passport.use(new AzureStrategy({
                identityMetadata: `https://login.microsoftonline.com/${config.auth.methods.azure.tenantId}/v2.0/.well-known/openid-configuration`,
                clientID: config.auth.methods.azure.clientId,
                responseType: 'code id_token',
                responseMode: 'form_post',
                redirectUrl: config.auth.methods.azure.redirectUri,
                allowHttpForRedirectUrl: true,
                clientSecret: config.auth.methods.azure.clientSecret,
                validateIssuer: true,
                issuer: `https://login.microsoftonline.com/${config.auth.methods.azure.tenantId}/v2.0`,
                passReqToCallback: false,
                scope: ['profile', 'email', 'openid']
            }, (iss, sub, profile, accessToken, refreshToken, done) => {
                try {
                    appLogger.info(`Authentification Azure réussie pour l'utilisateur ${profile.displayName}`);
                    const user = findOrCreateUser(profile, 'azure');
                    return done(null, user);
                } catch (error) {
                    appLogger.error(`Erreur lors de l'authentification Azure: ${error.message}`);
                    return done(error, null);
                }
            }));
        } else {
            serverLogger.warn("Azure AD est activé mais les informations d'identification sont incomplètes. La stratégie d'authentification Azure n'a pas été initialisée.");
            console.warn("Azure AD est activé mais les informations d'identification sont incomplètes. La stratégie d'authentification Azure n'a pas été initialisée.");
        }
    }
    
    // Okta (utilisant OAuth2Strategy générique)
    if (config.auth.methods.okta && config.auth.methods.okta.enabled) {
        // Vérifier que les informations nécessaires sont présentes
        if (config.auth.methods.okta.clientId && 
            config.auth.methods.okta.clientSecret && 
            config.auth.methods.okta.domain && 
            config.auth.methods.okta.redirectUri) {
            
            passport.use('okta', new OAuth2Strategy({
                authorizationURL: `https://${config.auth.methods.okta.domain}/oauth2/v1/authorize`,
                tokenURL: `https://${config.auth.methods.okta.domain}/oauth2/v1/token`,
                clientID: config.auth.methods.okta.clientId,
                clientSecret: config.auth.methods.okta.clientSecret,
                callbackURL: config.auth.methods.okta.redirectUri,
                scope: ['openid', 'profile', 'email']
            }, (accessToken, refreshToken, params, profile, done) => {
                try {
                    // Récupérer les informations de l'utilisateur à partir du token
                    const userInfoURL = `https://${config.auth.methods.okta.domain}/oauth2/v1/userinfo`;
                    fetch(userInfoURL, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    })
                    .then(response => response.json())
                    .then(userInfo => {
                        appLogger.info(`Authentification Okta réussie pour l'utilisateur ${userInfo.preferred_username || userInfo.email}`);
                        
                        // Créer un profil à partir des informations utilisateur
                        const profile = {
                            id: userInfo.sub,
                            username: userInfo.preferred_username || userInfo.email,
                            displayName: userInfo.name,
                            emails: userInfo.email ? [{ value: userInfo.email }] : []
                        };
                        
                        const user = findOrCreateUser(profile, 'okta');
                        return done(null, user);
                    })
                    .catch(error => {
                        appLogger.error(`Erreur lors de la récupération des informations utilisateur Okta: ${error.message}`);
                        return done(error, null);
                    });
                } catch (error) {
                    appLogger.error(`Erreur lors de l'authentification Okta: ${error.message}`);
                    return done(error, null);
                }
            }));
        } else {
            serverLogger.warn("Okta est activé mais les informations d'identification sont incomplètes. La stratégie d'authentification Okta n'a pas été initialisée.");
            console.warn("Okta est activé mais les informations d'identification sont incomplètes. La stratégie d'authentification Okta n'a pas été initialisée.");
        }
    }
}; 