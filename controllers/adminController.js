const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const https = require('https');
const winston = require('winston');
const crypto = require('crypto');
const forge = require('node-forge');

// Chemin vers les fichiers de données
const configFilePath = path.join(__dirname, '../data/config.json');
const sslDir = path.join(__dirname, '../ssl');
const logsDir = path.join(__dirname, '../logs');

// Référence aux loggers
const serverLogger = winston.loggers.get('server') || winston.createLogger();
const appLogger = winston.loggers.get('app') || winston.createLogger();

// Fonction utilitaire pour lire les données de configuration
const getConfigData = () => {
    try {
        if (!fs.existsSync(configFilePath)) {
            // Créer le fichier s'il n'existe pas avec une configuration par défaut
            const defaultConfig = {
                auth: {
                    methods: {
                        local: {
                            enabled: true
                        },
                        discord: {
                            enabled: false,
                            clientId: '',
                            clientSecret: '',
                            redirectUri: ''
                        },
                        azure: {
                            enabled: false,
                            clientId: '',
                            clientSecret: '',
                            tenantId: '',
                            redirectUri: ''
                        },
                        github: {
                            enabled: false,
                            clientId: '',
                            clientSecret: '',
                            redirectUri: ''
                        },
                        okta: {
                            enabled: false,
                            clientId: '',
                            clientSecret: '',
                            domain: '',
                            redirectUri: ''
                        }
                    }
                },
                domain: {
                    useCustomDomain: false,
                    domainName: '',
                    useSSL: false,
                    sslCertPath: '',
                    sslKeyPath: '',
                    sslMethod: 'manual', // 'manual' ou 'letsencrypt'
                    letsencryptEmail: '',
                    port: 3000
                }
            };
            
            // Créer le répertoire SSL s'il n'existe pas
            if (!fs.existsSync(sslDir)) {
                fs.mkdirSync(sslDir, { recursive: true });
            }
            
            fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        const data = fs.readFileSync(configFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors de la lecture du fichier config.json:', error);
        return {
            auth: { methods: { local: { enabled: true } } },
            domain: { useCustomDomain: false, port: 3000, sslMethod: 'manual' }
        };
    }
};

// Fonction utilitaire pour écrire les données de configuration
const saveConfigData = (data) => {
    try {
        console.log('Tentative d\'écriture dans le fichier config.json:', configFilePath);
        serverLogger.info(`Tentative d'écriture dans le fichier config.json: ${configFilePath}`);
        
        // S'assurer que le port est un nombre entier avant l'écriture
        if (data.domain && data.domain.port !== undefined) {
            // Convertir explicitement en nombre entier
            const portValue = parseInt(data.domain.port);
            
            // Vérifier si la conversion a réussi
            if (!isNaN(portValue)) {
                data.domain.port = portValue;
                serverLogger.info(`Port sauvegardé: ${data.domain.port} (type: ${typeof data.domain.port})`);
            } else {
                serverLogger.warn(`Port invalide: ${data.domain.port}, utilisation de la valeur par défaut 3000`);
                data.domain.port = 3000;
            }
        } else if (data.domain) {
            serverLogger.warn('Port non défini, utilisation de la valeur par défaut 3000');
            data.domain.port = 3000;
        }
        
        console.log('Données à écrire:', JSON.stringify(data, null, 2));
        
        // Vérifier si le répertoire data existe
        const dataDir = path.dirname(configFilePath);
        if (!fs.existsSync(dataDir)) {
            console.log('Création du répertoire data:', dataDir);
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Vérifier les permissions du fichier
        if (fs.existsSync(configFilePath)) {
            try {
                const stats = fs.statSync(configFilePath);
                console.log('Permissions du fichier:', stats.mode.toString(8));
            } catch (err) {
                console.error('Erreur lors de la vérification des permissions:', err);
            }
        }
        
        // Écrire les données dans le fichier
        fs.writeFileSync(configFilePath, JSON.stringify(data, null, 2));
        console.log('Écriture réussie dans le fichier config.json');
        
        // Vérifier que les données ont été correctement écrites
        try {
            const verifyData = JSON.parse(fs.readFileSync(configFilePath, { encoding: 'utf8', flag: 'r' }));
            
            // Vérifier spécifiquement le port
            if (verifyData.domain && data.domain && verifyData.domain.port !== data.domain.port) {
                serverLogger.warn(`Incohérence détectée après sauvegarde: port écrit=${data.domain.port}, port lu=${verifyData.domain.port}`);
                
                // Réessayer l'écriture
                fs.writeFileSync(configFilePath, JSON.stringify(data, null, 2));
                serverLogger.info('Tentative de réécriture effectuée');
                
                // Vérifier à nouveau
                const reVerifyData = JSON.parse(fs.readFileSync(configFilePath, { encoding: 'utf8', flag: 'r' }));
                if (reVerifyData.domain && reVerifyData.domain.port !== data.domain.port) {
                    serverLogger.error(`Échec persistant de la sauvegarde du port: ${data.domain.port} vs ${reVerifyData.domain.port}`);
                    return false;
                }
            }
            
            serverLogger.info('Vérification de la sauvegarde réussie');
            return true;
        } catch (verifyError) {
            serverLogger.error(`Erreur lors de la vérification de la sauvegarde: ${verifyError.message}`);
            return false;
        }
    } catch (error) {
        console.error('Erreur détaillée lors de l\'écriture du fichier config.json:', error);
        serverLogger.error(`Erreur lors de la sauvegarde de la configuration: ${error.message}`);
        return false;
    }
};

// Fonction pour générer un certificat auto-signé avec Node.js
const generateSelfSignedCertificate = (commonName, organization) => {
    try {
        console.log(`Génération d'un certificat auto-signé pour ${commonName} avec Node.js`);
        serverLogger.info(`Génération d'un certificat auto-signé pour ${commonName} avec Node.js`);
        
        // Créer le répertoire SSL s'il n'existe pas
        if (!fs.existsSync(sslDir)) {
            fs.mkdirSync(sslDir, { recursive: true });
        }
        
        // Définir les noms de fichiers
        const certFileName = `${commonName}.crt`;
        const keyFileName = `${commonName}.key`;
        
        // Définir les chemins complets
        const certPath = path.join(sslDir, certFileName);
        const keyPath = path.join(sslDir, keyFileName);
        
        // Générer une paire de clés RSA
        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 4096,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        
        // Créer un certificat auto-signé avec node-forge
        const pki = forge.pki;
        
        try {
            // Convertir la clé privée PEM en objet clé forge
            const privateKeyForge = pki.privateKeyFromPem(privateKey);
            
            // Créer un certificat
            const cert = pki.createCertificate();
            cert.publicKey = pki.publicKeyFromPem(publicKey);
            
            // Définir les attributs du certificat
            cert.serialNumber = '01';
            cert.validity.notBefore = new Date();
            cert.validity.notAfter = new Date();
            cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
            
            // Définir les attributs du sujet et de l'émetteur
            const attrs = [{
                name: 'commonName',
                value: commonName
            }, {
                name: 'organizationName',
                value: organization
            }];
            
            cert.setSubject(attrs);
            cert.setIssuer(attrs);
            
            // Auto-signer le certificat
            cert.sign(privateKeyForge);
            
            // Convertir en PEM
            const certPem = pki.certificateToPem(cert);
            
            // Écrire les fichiers
            fs.writeFileSync(keyPath, privateKey);
            fs.writeFileSync(certPath, certPem);
            
            console.log(`Certificat auto-signé généré avec succès: ${certPath}, ${keyPath}`);
            serverLogger.info(`Certificat auto-signé généré avec succès: ${certPath}, ${keyPath}`);
            
            // Retourner les chemins relatifs pour la configuration
            return { 
                success: true, 
                certPath: `ssl/${certFileName}`, 
                keyPath: `ssl/${keyFileName}` 
            };
        } catch (forgeError) {
            console.error(`Erreur lors de la génération du certificat avec forge: ${forgeError.message}`);
            serverLogger.error(`Erreur lors de la génération du certificat avec forge: ${forgeError.message}`);
            return { success: false, error: forgeError.message };
        }
    } catch (error) {
        console.error(`Erreur lors de la génération du certificat auto-signé: ${error.message}`);
        serverLogger.error(`Erreur lors de la génération du certificat auto-signé: ${error.message}`);
        return { success: false, error: error.message };
    }
};

// Contrôleur pour l'administration
const adminController = {
    // Afficher le tableau de bord d'administration
    showAdminDashboard: (req, res) => {
        try {
            // Journaliser l'accès au tableau de bord
            appLogger.info(`Accès au tableau de bord d'administration par ${req.session.user.username}`);
            
            // Récupérer les données de configuration pour obtenir le port
            const configData = getConfigData();
            
            // Récupérer le port depuis différentes sources pour s'assurer de la cohérence
            const configPort = parseInt(configData.domain.port) || 3000;
            const globalPort = global.PORT || 3000;
            
            // Utiliser le port du fichier de configuration comme référence
            const port = configPort;
            
            // Vérifier la cohérence des ports
            if (configPort !== globalPort) {
                serverLogger.warn(`Incohérence détectée dans les ports pour le tableau de bord: configPort=${configPort}, globalPort=${globalPort}`);
            }
            
            // Journaliser le port utilisé pour le tableau de bord
            serverLogger.info(`Port utilisé pour le tableau de bord: ${port}`);
            
            // Déterminer l'état du SSL
            const sslStatus = configData.domain.useSSL && 
                              configData.domain.sslCertPath && 
                              configData.domain.sslKeyPath && 
                              fs.existsSync(configData.domain.sslCertPath) && 
                              fs.existsSync(configData.domain.sslKeyPath) ? 'Configuré' : 'Non configuré';
            
            res.render('admin/dashboard', {
                title: 'Administration',
                user: req.session.user,
                systemInfo: {
                    port: port,
                    ssl: sslStatus,
                    environment: process.env.NODE_ENV || 'Production',
                    version: '1.0.0'
                }
            });
        } catch (error) {
            serverLogger.error(`Erreur lors de l'affichage du tableau de bord d'administration: ${error.message}`);
            req.session.error = 'Erreur lors de l\'affichage du tableau de bord d\'administration';
            res.redirect('/dashboard');
        }
    },
    
    // Afficher la page de configuration de l'authentification
    showAuthConfig: (req, res) => {
        try {
            const configData = getConfigData();
            
            // Journaliser l'accès à la configuration d'authentification
            appLogger.info(`Accès à la configuration d'authentification par ${req.session.user.username}`);
            
            res.render('admin/auth-config', {
                title: 'Configuration de l\'authentification',
                user: req.session.user,
                config: configData,
                configSection: 'auth'
            });
        } catch (error) {
            serverLogger.error(`Erreur lors de l'affichage de la configuration d'authentification: ${error.message}`);
            req.session.error = 'Erreur lors de l\'affichage de la configuration d\'authentification';
            res.redirect('/admin/dashboard');
        }
    },
    
    // Mettre à jour la configuration de l'authentification
    updateAuthConfig: (req, res) => {
        try {
            const { method } = req.params;
            const configData = getConfigData();
            
            // Journaliser la mise à jour de la configuration d'authentification
            appLogger.info(`Mise à jour de la configuration d'authentification "${method}" par ${req.session.user.username}`);
            appLogger.info(`État actuel de la méthode ${method}: ${JSON.stringify(configData.auth.methods[method])}`);
            appLogger.info(`Données reçues du formulaire: ${JSON.stringify(req.body)}`);
            
            // Vérifier si la méthode existe
            if (!configData.auth.methods[method]) {
                req.session.error = `Méthode d'authentification "${method}" non reconnue`;
                return res.redirect('/admin/auth-config');
            }
            
            // Mettre à jour la configuration en fonction de la méthode
            switch (method) {
                case 'local':
                    configData.auth.methods.local.enabled = req.body.enabled === 'on';
                    configData.auth.methods.local.name = 'local';
                    break;
                    
                case 'discord':
                    configData.auth.methods.discord.enabled = req.body.enabled === 'on';
                    configData.auth.methods.discord.clientId = req.body.clientId || '';
                    configData.auth.methods.discord.clientSecret = req.body.clientSecret || '';
                    configData.auth.methods.discord.redirectUri = req.body.redirectUri || '';
                    configData.auth.methods.discord.name = 'discord';
                    break;
                    
                case 'azure':
                    configData.auth.methods.azure.enabled = req.body.enabled === 'on';
                    configData.auth.methods.azure.clientId = req.body.clientId || '';
                    configData.auth.methods.azure.clientSecret = req.body.clientSecret || '';
                    configData.auth.methods.azure.tenantId = req.body.tenantId || '';
                    configData.auth.methods.azure.redirectUri = req.body.redirectUri || '';
                    configData.auth.methods.azure.name = 'azure';
                    break;
                    
                case 'github':
                    configData.auth.methods.github.enabled = req.body.enabled === 'on';
                    configData.auth.methods.github.clientId = req.body.clientId || '';
                    configData.auth.methods.github.clientSecret = req.body.clientSecret || '';
                    configData.auth.methods.github.redirectUri = req.body.redirectUri || '';
                    configData.auth.methods.github.name = 'github';
                    break;
                    
                case 'okta':
                    configData.auth.methods.okta.enabled = req.body.enabled === 'on';
                    configData.auth.methods.okta.clientId = req.body.clientId || '';
                    configData.auth.methods.okta.clientSecret = req.body.clientSecret || '';
                    configData.auth.methods.okta.domain = req.body.domain || '';
                    configData.auth.methods.okta.redirectUri = req.body.redirectUri || '';
                    configData.auth.methods.okta.name = 'okta';
                    break;
                    
                default:
                    req.session.error = `Méthode d'authentification "${method}" non prise en charge`;
                    return res.redirect('/admin/auth-config');
            }
            
            // Journaliser la nouvelle configuration
            appLogger.info(`Nouvelle configuration pour ${method}: ${JSON.stringify(configData.auth.methods[method])}`);
            
            // Sauvegarder les modifications
            if (!saveConfigData(configData)) {
                req.session.error = 'Erreur lors de la sauvegarde de la configuration';
                return res.redirect('/admin/auth-config');
            }
            
            // Mettre à jour la configuration globale
            config = configData;
            
            // Vérifier que la configuration globale a été mise à jour
            appLogger.info(`Configuration globale mise à jour pour ${method}: ${JSON.stringify(config.auth.methods[method])}`);
            
            req.session.success = `Configuration de l'authentification "${method}" mise à jour avec succès`;
            res.redirect('/admin/auth-config');
        } catch (error) {
            serverLogger.error(`Erreur lors de la mise à jour de la configuration d'authentification: ${error.message}`);
            req.session.error = 'Erreur lors de la mise à jour de la configuration';
            res.redirect('/admin/auth-config');
        }
    },
    
    // Afficher la page de configuration du domaine
    showDomainConfig: (req, res) => {
        try {
            // Récupérer les données de configuration
            const configData = getConfigData();
            
            // S'assurer que les nouveaux champs existent
            if (!configData.domain.accessMode) {
                configData.domain.accessMode = configData.domain.useCustomDomain ? 'domain' : 'localhost';
            }
            
            if (!configData.domain.securityMode) {
                if (configData.domain.useSSL) {
                    configData.domain.securityMode = configData.domain.sslMethod || 'manual';
                } else {
                    configData.domain.securityMode = 'none';
                }
            }
            
            // Lister les certificats SSL disponibles dans le répertoire SSL
            let availableCerts = [];
            try {
                if (!fs.existsSync(sslDir)) {
                    fs.mkdirSync(sslDir, { recursive: true });
                }
                const files = fs.readdirSync(sslDir);
                availableCerts = files.filter(file => file.endsWith('.crt') || file.endsWith('.pem'));
            } catch (error) {
                console.error('Erreur lors de la lecture du répertoire SSL:', error);
                serverLogger.error(`Erreur lors de la lecture du répertoire SSL: ${error.message}`);
            }
            
            // Lister les clés privées SSL disponibles dans le répertoire SSL
            let availableKeys = [];
            try {
                if (fs.existsSync(sslDir)) {
                    const files = fs.readdirSync(sslDir);
                    availableKeys = files.filter(file => file.endsWith('.key'));
                }
            } catch (error) {
                console.error('Erreur lors de la lecture du répertoire SSL pour les clés:', error);
                serverLogger.error(`Erreur lors de la lecture du répertoire SSL pour les clés: ${error.message}`);
            }
            
            // Déterminer le statut du serveur
            const isHttps = configData.domain.useSSL && configData.domain.sslCertPath && configData.domain.sslKeyPath;
            const sslConfigured = configData.domain.sslCertPath && configData.domain.sslKeyPath;
            const domainConfigured = configData.domain.useCustomDomain && configData.domain.domainName;
            
            // Récupérer le port actuel du serveur
            let currentPort = configData.domain.port;
            
            // Si le serveur est en cours d'exécution, utiliser son port
            if (global.currentPort) {
                currentPort = global.currentPort;
                console.log(`Utilisation du port global: ${currentPort}`);
            } else if (global.server && global.server.address()) {
                currentPort = global.server.address().port;
                console.log(`Utilisation du port du serveur: ${currentPort}`);
            } else {
                console.log(`Utilisation du port de la configuration: ${currentPort}`);
            }
            
            // Journaliser pour le débogage
            console.log('Statut du serveur:', { isHttps, sslConfigured, domainConfigured, port: currentPort });
            serverLogger.info(`État du serveur pour l'affichage: Port=${currentPort}, HTTPS=${isHttps}, SSL=${sslConfigured}, Domaine=${domainConfigured}`);
            
            // Rendre la vue avec les données nécessaires
            res.render('admin/domain-config', {
                title: 'Configuration du Domaine',
                config: configData,
                availableCerts,
                availableKeys,
                sslDir: 'ssl', // Utiliser un chemin relatif pour le répertoire SSL
                serverStatus: {
                    isHttps,
                    sslConfigured,
                    domainConfigured,
                    port: currentPort
                }
            });
        } catch (error) {
            console.error('Erreur lors de l\'affichage de la page de configuration du domaine:', error);
            serverLogger.error(`Erreur lors de l'affichage de la page de configuration du domaine: ${error.message}`);
            req.session.error = 'Erreur lors du chargement de la page de configuration du domaine';
            res.redirect('/admin/dashboard');
        }
    },
    
    // Mettre à jour la configuration du domaine
    updateDomainConfig: (req, res) => {
        try {
            console.log('Données reçues du formulaire:', req.body);
            serverLogger.info(`Données reçues du formulaire: ${JSON.stringify(req.body)}`);
            
            // Récupérer la valeur du port depuis le formulaire
            const port = parseInt(req.body.port, 10);
            
            // Vérifier si le port est valide
            if (isNaN(port) || port <= 0 || port > 65535) {
                req.session.error = 'Le port doit être un nombre entre 1 et 65535';
                return res.redirect('/admin/domain-config');
            }
            
            // Récupérer les données de configuration actuelles
            const configData = getConfigData();
            
            // Vérifier si le port a changé
            const portChanged = configData.domain.port !== port;
            
            // Récupérer les autres valeurs du formulaire
            const useCustomDomain = req.body.accessMode === 'domain';
            const domainName = req.body.domainName || '';
            const accessMode = req.body.accessMode || 'localhost';
            const securityMode = req.body.securityMode || 'none';
            
            // Vérifier si le mode de sécurité a changé
            const securityModeChanged = configData.domain.securityMode !== securityMode;
            
            // Mettre à jour la configuration
            configData.domain.port = port;
            configData.domain.useCustomDomain = useCustomDomain;
            configData.domain.domainName = domainName;
            configData.domain.accessMode = accessMode;
            configData.domain.securityMode = securityMode;
            
            // Mettre à jour les paramètres SSL en fonction du mode de sécurité
            if (securityMode === 'none') {
                configData.domain.useSSL = false;
                configData.domain.sslMethod = '';
                configData.domain.sslCertPath = '';
                configData.domain.sslKeyPath = '';
                console.log('Mode de sécurité: aucun - SSL désactivé');
                serverLogger.info('Mode de sécurité: aucun - SSL désactivé');
            } else {
                configData.domain.useSSL = true;
                
                if (securityMode === 'manual') {
                    configData.domain.sslMethod = 'manual';
                    
                    // Utiliser les chemins relatifs pour les certificats SSL
                    if (req.body.sslCertPath) {
                        const certPath = req.body.sslCertPath;
                        configData.domain.sslCertPath = certPath.startsWith('/') || certPath.includes(':') 
                            ? path.relative(__dirname, certPath).replace(/\\/g, '/') 
                            : certPath;
                    }
                    
                    if (req.body.sslKeyPath) {
                        const keyPath = req.body.sslKeyPath;
                        configData.domain.sslKeyPath = keyPath.startsWith('/') || keyPath.includes(':') 
                            ? path.relative(__dirname, keyPath).replace(/\\/g, '/') 
                            : keyPath;
                    }
                    
                    console.log('Mode de sécurité: manuel - Chemins mis à jour');
                    serverLogger.info('Mode de sécurité: manuel - Chemins mis à jour');
                } else if (securityMode === 'letsencrypt') {
                    configData.domain.sslMethod = 'letsencrypt';
                    configData.domain.letsencryptEmail = req.body.letsencryptEmail || '';
                    console.log('Mode de sécurité: letsencrypt - Email mis à jour');
                    serverLogger.info('Mode de sécurité: letsencrypt - Email mis à jour');
                } else if (securityMode === 'selfSigned') {
                    configData.domain.sslMethod = 'selfSigned';
                    configData.domain.selfSignedCommonName = req.body.selfSignedCommonName || '';
                    configData.domain.selfSignedOrganization = req.body.selfSignedOrganization || '';
                    console.log('Mode de sécurité: selfSigned - Informations mises à jour');
                    serverLogger.info('Mode de sécurité: selfSigned - Informations mises à jour');
                }
            }
            
            // Journaliser la configuration mise à jour
            console.log('Configuration à sauvegarder (après modification):', configData);
            serverLogger.info(`Configuration à sauvegarder: ${JSON.stringify(configData)}`);
            
            // Sauvegarder la configuration
            saveConfigData(configData);
            
            // Générer un certificat auto-signé si nécessaire
            if (securityMode === 'selfSigned' && (!configData.domain.sslCertPath || !configData.domain.sslKeyPath || securityModeChanged)) {
                const commonName = configData.domain.selfSignedCommonName || 'localhost';
                const organization = configData.domain.selfSignedOrganization || 'Sault';
                
                try {
                    // Générer le certificat
                    const { certPath, keyPath } = generateSelfSignedCertificate(commonName, organization);
                    
                    // Mettre à jour les chemins dans la configuration
                    configData.domain.sslCertPath = certPath;
                    configData.domain.sslKeyPath = keyPath;
                    
                    // Sauvegarder la configuration mise à jour
                    saveConfigData(configData);
                    
                    console.log(`Certificat auto-signé généré: ${certPath}, ${keyPath}`);
                    serverLogger.info(`Certificat auto-signé généré: ${certPath}, ${keyPath}`);
                } catch (error) {
                    console.error('Erreur lors de la génération du certificat auto-signé:', error);
                    serverLogger.error(`Erreur lors de la génération du certificat auto-signé: ${error.message}`);
                    req.session.error = 'Erreur lors de la génération du certificat auto-signé';
                }
            }
            
            // Ajouter un message de succès à la session
            req.session.success = 'Configuration du domaine mise à jour avec succès';
            
            // Redémarrer le serveur si nécessaire
            if (portChanged || securityModeChanged) {
                console.log('Redémarrage du serveur pour appliquer les changements');
                serverLogger.info('Redémarrage du serveur pour appliquer les changements');
                
                // Rediriger vers la page de configuration du domaine
                res.redirect('/admin/domain-config');
                
                // Redémarrer le serveur après un court délai pour permettre à la réponse d'être envoyée
                setTimeout(() => {
                    try {
                        global.restartServer();
                        console.log('Fonction de redémarrage exécutée avec succès');
                        serverLogger.info('Fonction de redémarrage exécutée avec succès');
                    } catch (error) {
                        console.error('Erreur lors de l\'exécution de la fonction de redémarrage:', error);
                        serverLogger.error(`Erreur lors de l'exécution de la fonction de redémarrage: ${error.message}`);
                    }
                }, 1000);
            } else {
                // Rediriger vers la page de configuration du domaine
                res.redirect('/admin/domain-config');
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour de la configuration du domaine:', error);
            serverLogger.error(`Erreur lors de la mise à jour de la configuration du domaine: ${error.message}`);
            req.session.error = 'Erreur lors de la mise à jour de la configuration du domaine';
            res.redirect('/admin/domain-config');
        }
    },
    
    // Générer un certificat SSL auto-signé via AJAX
    generateSslCert: (req, res) => {
        try {
            console.log('Génération d\'un certificat SSL auto-signé via AJAX');
            serverLogger.info('Génération d\'un certificat SSL auto-signé via AJAX');
            
            // Récupérer les paramètres
            const { commonName, organization } = req.body;
            
            // Valider les paramètres
            if (!commonName) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Le nom commun (CN) est requis' 
                });
            }
            
            // Générer le certificat
            const result = generateSelfSignedCertificate(commonName, organization || 'Sault');
            
            if (result.success) {
                // Mettre à jour la configuration
                const configData = getConfigData();
                configData.domain.sslCertPath = result.certPath;
                configData.domain.sslKeyPath = result.keyPath;
                saveConfigData(configData);
                
                // Renvoyer les chemins des fichiers générés
                return res.json({
                    success: true,
                    certPath: result.certPath,
                    keyPath: result.keyPath
                });
            } else {
                return res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('Erreur lors de la génération du certificat SSL:', error);
            serverLogger.error(`Erreur lors de la génération du certificat SSL: ${error.message}`);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },
    
    // Télécharger un certificat SSL
    uploadSslCert: (req, res) => {
        try {
            // Vérifier si un fichier a été téléchargé
            if (!req.files || !req.files.sslCert) {
                req.session.error = "Aucun fichier n'a été téléchargé";
                return res.redirect('/admin/domain-config');
            }
            
            // Récupérer le fichier téléchargé
            const sslCert = req.files.sslCert;
            
            // Vérifier le type de fichier
            if (!sslCert.name.endsWith('.crt') && !sslCert.name.endsWith('.pem')) {
                req.session.error = "Le fichier doit être un certificat SSL (.crt ou .pem)";
                return res.redirect('/admin/domain-config');
            }
            
            // Créer le répertoire SSL s'il n'existe pas
            if (!fs.existsSync(sslDir)) {
                fs.mkdirSync(sslDir, { recursive: true });
            }
            
            // Définir le chemin de destination (toujours relatif)
            const destPath = path.join(sslDir, sslCert.name);
            const relativePath = `ssl/${sslCert.name}`;
            
            // Déplacer le fichier
            sslCert.mv(destPath, (err) => {
                if (err) {
                    console.error('Erreur lors du téléchargement du certificat SSL:', err);
                    serverLogger.error(`Erreur lors du téléchargement du certificat SSL: ${err.message}`);
                    req.session.error = "Erreur lors du téléchargement du certificat SSL";
                    return res.redirect('/admin/domain-config');
                }
                
                // Mettre à jour la configuration
                const configData = getConfigData();
                configData.domain.sslCertPath = relativePath;
                saveConfigData(configData);
                
                // Journaliser le succès
                console.log(`Certificat SSL téléchargé avec succès: ${relativePath}`);
                serverLogger.info(`Certificat SSL téléchargé avec succès: ${relativePath}`);
                
                req.session.success = "Certificat SSL téléchargé avec succès";
                res.redirect('/admin/domain-config');
            });
        } catch (error) {
            console.error('Erreur lors du téléchargement du certificat SSL:', error);
            serverLogger.error(`Erreur lors du téléchargement du certificat SSL: ${error.message}`);
            req.session.error = "Erreur lors du téléchargement du certificat SSL";
            res.redirect('/admin/domain-config');
        }
    },
    
    // Télécharger une clé privée SSL
    uploadSslKey: (req, res) => {
        try {
            // Vérifier si un fichier a été téléchargé
            if (!req.files || !req.files.sslKey) {
                req.session.error = "Aucun fichier n'a été téléchargé";
                return res.redirect('/admin/domain-config');
            }
            
            // Récupérer le fichier téléchargé
            const sslKey = req.files.sslKey;
            
            // Vérifier le type de fichier
            if (!sslKey.name.endsWith('.key')) {
                req.session.error = "Le fichier doit être une clé privée SSL (.key)";
                return res.redirect('/admin/domain-config');
            }
            
            // Créer le répertoire SSL s'il n'existe pas
            if (!fs.existsSync(sslDir)) {
                fs.mkdirSync(sslDir, { recursive: true });
            }
            
            // Définir le chemin de destination (toujours relatif)
            const destPath = path.join(sslDir, sslKey.name);
            const relativePath = `ssl/${sslKey.name}`;
            
            // Déplacer le fichier
            sslKey.mv(destPath, (err) => {
                if (err) {
                    console.error('Erreur lors du téléchargement de la clé privée SSL:', err);
                    serverLogger.error(`Erreur lors du téléchargement de la clé privée SSL: ${err.message}`);
                    req.session.error = "Erreur lors du téléchargement de la clé privée SSL";
                    return res.redirect('/admin/domain-config');
                }
                
                // Mettre à jour la configuration
                const configData = getConfigData();
                configData.domain.sslKeyPath = relativePath;
                saveConfigData(configData);
                
                // Journaliser le succès
                console.log(`Clé privée SSL téléchargée avec succès: ${relativePath}`);
                serverLogger.info(`Clé privée SSL téléchargée avec succès: ${relativePath}`);
                
                req.session.success = "Clé privée SSL téléchargée avec succès";
                res.redirect('/admin/domain-config');
            });
        } catch (error) {
            console.error('Erreur lors du téléchargement de la clé privée SSL:', error);
            serverLogger.error(`Erreur lors du téléchargement de la clé privée SSL: ${error.message}`);
            req.session.error = "Erreur lors du téléchargement de la clé privée SSL";
            res.redirect('/admin/domain-config');
        }
    },
    
    // Tester la configuration SSL
    testSSLConfig: (req, res) => {
        try {
            const configData = getConfigData();
            
            if (!configData.domain.useSSL || !configData.domain.sslCertPath || !configData.domain.sslKeyPath) {
                req.session.error = 'Configuration SSL incomplète';
                return res.redirect('/admin/domain-config');
            }
            
            // Vérifier si les fichiers existent
            if (!fs.existsSync(configData.domain.sslCertPath) || !fs.existsSync(configData.domain.sslKeyPath)) {
                req.session.error = 'Certificat ou clé privée introuvable';
                return res.redirect('/admin/domain-config');
            }
            
            // Tenter de créer un serveur HTTPS avec les certificats
            try {
                const options = {
                    cert: fs.readFileSync(configData.domain.sslCertPath),
                    key: fs.readFileSync(configData.domain.sslKeyPath)
                };
                
                // Créer un serveur temporaire pour tester
                const server = https.createServer(options, (req, res) => {
                    res.writeHead(200);
                    res.end('Test SSL réussi');
                });
                
                // Écouter sur un port aléatoire
                const testPort = 8443;
                server.listen(testPort, () => {
                    console.log(`Serveur de test SSL démarré sur le port ${testPort}`);
                    
                    // Fermer le serveur après 1 seconde
                    setTimeout(() => {
                        server.close(() => {
                            console.log('Serveur de test SSL arrêté');
                            req.session.success = 'Test SSL réussi! La configuration est valide.';
                            res.redirect('/admin/domain-config');
                        });
                    }, 1000);
                });
                
                server.on('error', (err) => {
                    console.error('Erreur lors du test SSL:', err);
                    req.session.error = `Erreur lors du test SSL: ${err.message}`;
                    res.redirect('/admin/domain-config');
                });
            } catch (err) {
                console.error('Erreur lors du chargement des certificats:', err);
                req.session.error = `Erreur lors du chargement des certificats: ${err.message}`;
                res.redirect('/admin/domain-config');
            }
        } catch (error) {
            console.error('Erreur lors du test de la configuration SSL:', error);
            req.session.error = 'Erreur lors du test de la configuration SSL';
            res.redirect('/admin/domain-config');
        }
    },
    
    // Redémarrer le serveur
    restartServer: (req, res) => {
        try {
            console.log('Demande de redémarrage du serveur par', req.session.user ? req.session.user.username : 'utilisateur inconnu');
            serverLogger.info(`Demande de redémarrage du serveur par ${req.session.user ? req.session.user.username : 'utilisateur inconnu'}`);
            
            // Vérifier si la fonction de redémarrage est disponible
            if (typeof global.restartServer === 'function') {
                console.log('Fonction de redémarrage trouvée, exécution...');
                serverLogger.info('Fonction de redémarrage trouvée, exécution...');
                
                // Ajouter un message de succès à la session
                req.session.success = 'Serveur en cours de redémarrage...';
                
                // Rediriger vers le tableau de bord
                res.redirect('/admin/dashboard');
                
                // Redémarrer le serveur après un court délai pour permettre à la réponse d'être envoyée
                setTimeout(() => {
                    try {
                        global.restartServer();
                        console.log('Fonction de redémarrage exécutée avec succès');
                        serverLogger.info('Fonction de redémarrage exécutée avec succès');
                    } catch (error) {
                        console.error('Erreur lors de l\'exécution de la fonction de redémarrage:', error);
                        serverLogger.error(`Erreur lors de l'exécution de la fonction de redémarrage: ${error.message}`);
                    }
                }, 1000);
            } else {
                console.log('Aucun serveur en cours d\'exécution à redémarrer');
                serverLogger.info('Aucun serveur en cours d\'exécution à redémarrer');
                console.log('Aucun serveur en cours d\'exécution à redémarrer');
                
                // Démarrer un nouveau serveur
                if (typeof global.startServer === 'function') {
                    console.log('Fonction de démarrage trouvée, exécution...');
                    serverLogger.info('Fonction de démarrage trouvée, exécution...');
                    
                    // Ajouter un message de succès à la session
                    req.session.success = 'Nouveau serveur en cours de démarrage...';
                    
                    // Rediriger vers le tableau de bord
                    res.redirect('/admin/dashboard');
                    
                    // Démarrer le serveur après un court délai pour permettre à la réponse d'être envoyée
                    setTimeout(() => {
                        try {
                            global.startServer();
                            console.log('Fonction de démarrage exécutée avec succès');
                            serverLogger.info('Fonction de démarrage exécutée avec succès');
                        } catch (error) {
                            console.error('Erreur lors de l\'exécution de la fonction de démarrage:', error);
                            serverLogger.error(`Erreur lors de l'exécution de la fonction de démarrage: ${error.message}`);
                        }
                    }, 1000);
                } else {
                    console.error('Fonction de démarrage non disponible');
                    serverLogger.error('Fonction de démarrage non disponible');
                    req.session.error = 'Impossible de redémarrer le serveur';
                    res.redirect('/admin/dashboard');
                }
            }
        } catch (error) {
            console.error('Erreur lors du redémarrage du serveur:', error);
            serverLogger.error(`Erreur lors du redémarrage du serveur: ${error.message}`);
            req.session.error = 'Erreur lors du redémarrage du serveur';
            res.redirect('/admin/dashboard');
        }
    },
    
    // Générer un certificat auto-signé manuellement
    generateCertificate: (req, res) => {
        try {
            // Récupérer les données de configuration
            const configData = getConfigData();
            
            // Vérifier si le mode de sécurité est bien "selfSigned"
            if (configData.domain.securityMode !== 'selfSigned') {
                req.session.error = 'Cette action n\'est disponible que pour le mode de sécurité "Certificat auto-signé"';
                return res.redirect('/admin/domain-config');
            }
            
            // Créer le répertoire SSL s'il n'existe pas
            if (!fs.existsSync(sslDir)) {
                fs.mkdirSync(sslDir, { recursive: true });
            }
            
            const commonName = configData.domain.selfSignedCommonName || 'localhost';
            const organization = configData.domain.selfSignedOrganization || 'Outils DSI';
            
            // Générer un certificat auto-signé avec des chemins relatifs
            const certFileName = `${commonName}.crt`;
            const keyFileName = `${commonName}.key`;
            const certPath = path.join(sslDir, certFileName);
            const keyPath = path.join(sslDir, keyFileName);
            
            // Générer une paire de clés RSA
            const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 4096,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            });
            
            // Créer un certificat auto-signé avec node-forge
            const pki = forge.pki;
            
            try {
                // Convertir la clé privée PEM en objet clé forge
                const privateKeyForge = pki.privateKeyFromPem(privateKey);
                
                // Créer un certificat
                const cert = pki.createCertificate();
                cert.publicKey = pki.publicKeyFromPem(publicKey);
                
                // Définir les attributs du certificat
                cert.serialNumber = '01';
                cert.validity.notBefore = new Date();
                cert.validity.notAfter = new Date();
                cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
                
                // Définir les attributs du sujet et de l'émetteur
                const attrs = [{
                    name: 'commonName',
                    value: commonName
                }, {
                    name: 'organizationName',
                    value: organization
                }];
                
                cert.setSubject(attrs);
                cert.setIssuer(attrs);
                
                // Auto-signer le certificat
                cert.sign(privateKeyForge);
                
                // Convertir en PEM
                const certPem = pki.certificateToPem(cert);
                
                // Écrire les fichiers
                fs.writeFileSync(keyPath, privateKey);
                fs.writeFileSync(certPath, certPem);
                
                // Mettre à jour la configuration avec des chemins relatifs
                configData.domain.sslCertPath = `ssl/${certFileName}`;
                configData.domain.sslKeyPath = `ssl/${keyFileName}`;
                saveConfigData(configData);
                
                console.log(`Certificat auto-signé généré avec succès: ${certPath}, ${keyPath}`);
                serverLogger.info(`Certificat auto-signé généré avec succès: ${certPath}, ${keyPath}`);
                
                req.session.success = 'Certificat auto-signé généré avec succès';
                res.redirect('/admin/domain-config');
            } catch (error) {
                console.error('Erreur lors de la génération du certificat auto-signé:', error);
                serverLogger.error(`Erreur lors de la génération du certificat auto-signé: ${error.message}`);
                req.session.error = 'Erreur lors de la génération du certificat auto-signé';
                res.redirect('/admin/domain-config');
            }
        } catch (error) {
            console.error('Erreur lors de la génération du certificat auto-signé:', error);
            serverLogger.error(`Erreur lors de la génération du certificat auto-signé: ${error.message}`);
            req.session.error = 'Erreur lors de la génération du certificat auto-signé';
            res.redirect('/admin/domain-config');
        }
    },
    
    // Afficher la page des logs
    showLogs: (req, res) => {
        try {
            // Vérifier si le répertoire des logs existe
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
            
            // Récupérer le type de log à afficher (server ou application)
            const logType = req.query.type || 'application';
            
            // Lister tous les fichiers de logs
            const allLogFiles = fs.readdirSync(logsDir)
                .filter(file => file.endsWith('.log'))
                .sort((a, b) => {
                    // Trier par date de modification (le plus récent en premier)
                    return fs.statSync(path.join(logsDir, b)).mtime.getTime() - 
                           fs.statSync(path.join(logsDir, a)).mtime.getTime();
                });
            
            // Filtrer les fichiers selon le type
            const logFiles = allLogFiles.filter(file => {
                if (logType === 'server') {
                    return file.startsWith('server');
                } else {
                    return file.startsWith('application');
                }
            });
            
            // Récupérer les statistiques de chaque fichier
            const logFilesStats = {};
            logFiles.forEach(file => {
                logFilesStats[file] = fs.statSync(path.join(logsDir, file));
            });
            
            // Récupérer le fichier de log sélectionné ou le plus récent
            const selectedLogFile = req.query.file || (logFiles.length > 0 ? logFiles[0] : null);
            
            // Lire le contenu du fichier de log sélectionné
            let logContent = '';
            let logStats = null;
            
            if (selectedLogFile && fs.existsSync(path.join(logsDir, selectedLogFile))) {
                const logFilePath = path.join(logsDir, selectedLogFile);
                logContent = fs.readFileSync(logFilePath, 'utf8');
                
                // Limiter le contenu aux 1000 dernières lignes pour éviter de surcharger la page
                const lines = logContent.split('\n');
                if (lines.length > 1000) {
                    logContent = lines.slice(lines.length - 1000).join('\n');
                    logContent = `... (${lines.length - 1000} lignes précédentes masquées) ...\n\n` + logContent;
                }
                
                // Obtenir les statistiques du fichier
                logStats = fs.statSync(logFilePath);
            }
            
            // Analyser le contenu pour obtenir des statistiques
            const logAnalytics = {
                totalLines: logContent ? logContent.split('\n').length : 0,
                errorCount: logContent ? (logContent.match(/\[ERROR\]/g) || []).length : 0,
                warningCount: logContent ? (logContent.match(/\[WARN\]/g) || []).length : 0,
                infoCount: logContent ? (logContent.match(/\[INFO\]/g) || []).length : 0,
                serverCount: logContent ? (logContent.match(/\[SERVER\]/g) || []).length : 0,
                appCount: logContent ? (logContent.match(/\[APP\]/g) || []).length : 0
            };
            
            // Enregistrer l'action dans les logs
            appLogger.info(`Consultation des logs ${logType} par ${req.session.user.username}`);
            
            res.render('admin/logs', {
                title: 'Gestion des Logs',
                user: req.session.user,
                logType,
                logFiles,
                logFilesStats,
                selectedLogFile,
                logContent,
                logStats,
                logAnalytics,
                logsDir
            });
        } catch (error) {
            serverLogger.error(`Erreur lors de l'affichage des logs: ${error.message}`);
            req.session.error = 'Erreur lors de l\'affichage des logs';
            res.redirect('/admin/dashboard');
        }
    },
    
    // Télécharger un fichier de log
    downloadLog: (req, res) => {
        try {
            const { file } = req.params;
            
            // Vérifier si le fichier existe
            const logFilePath = path.join(logsDir, file);
            if (!fs.existsSync(logFilePath)) {
                req.session.error = 'Fichier de log introuvable';
                return res.redirect('/admin/logs');
            }
            
            // Enregistrer l'action dans les logs
            appLogger.info(`Téléchargement du fichier de log ${file} par ${req.session.user.username}`);
            
            // Envoyer le fichier
            res.download(logFilePath);
        } catch (error) {
            serverLogger.error(`Erreur lors du téléchargement du log: ${error.message}`);
            req.session.error = 'Erreur lors du téléchargement du fichier de log';
            res.redirect('/admin/logs');
        }
    },
    
    // Supprimer un fichier de log
    deleteLog: (req, res) => {
        try {
            const { file } = req.params;
            
            // Vérifier si le fichier existe
            const logFilePath = path.join(logsDir, file);
            if (!fs.existsSync(logFilePath)) {
                req.session.error = 'Fichier de log introuvable';
                return res.redirect('/admin/logs');
            }
            
            // Enregistrer l'action dans les logs
            appLogger.warn(`Suppression du fichier de log ${file} par ${req.session.user.username}`);
            
            // Supprimer le fichier
            fs.unlinkSync(logFilePath);
            
            req.session.success = `Fichier de log ${file} supprimé avec succès`;
            res.redirect('/admin/logs');
        } catch (error) {
            serverLogger.error(`Erreur lors de la suppression du log: ${error.message}`);
            req.session.error = 'Erreur lors de la suppression du fichier de log';
            res.redirect('/admin/logs');
        }
    },
    
    // Vider tous les logs
    clearAllLogs: (req, res) => {
        try {
            // Vérifier si le répertoire des logs existe
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
                req.session.info = 'Aucun fichier de log à supprimer';
                return res.redirect('/admin/logs');
            }
            
            // Récupérer le type de log à supprimer
            const logType = req.query.type || 'all';
            
            // Lister tous les fichiers de logs
            const allLogFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
            
            // Filtrer les fichiers selon le type
            const logFiles = allLogFiles.filter(file => {
                if (logType === 'server') {
                    return file.startsWith('server');
                } else if (logType === 'application') {
                    return file.startsWith('application');
                } else {
                    return true; // Tous les fichiers
                }
            });
            
            // Enregistrer l'action dans les logs
            appLogger.warn(`Suppression de tous les fichiers de logs de type ${logType} (${logFiles.length} fichiers) par ${req.session.user.username}`);
            
            // Supprimer tous les fichiers
            let deletedCount = 0;
            logFiles.forEach(file => {
                try {
                    fs.unlinkSync(path.join(logsDir, file));
                    deletedCount++;
                } catch (err) {
                    serverLogger.error(`Erreur lors de la suppression du fichier ${file}: ${err.message}`);
                }
            });
            
            req.session.success = `${deletedCount} fichiers de logs supprimés avec succès`;
            res.redirect('/admin/logs' + (req.query.type ? `?type=${req.query.type}` : ''));
        } catch (error) {
            serverLogger.error(`Erreur lors de la suppression de tous les logs: ${error.message}`);
            req.session.error = 'Erreur lors de la suppression des fichiers de logs';
            res.redirect('/admin/logs');
        }
    },
    
    // Exporter toutes les données
    exportAllData: (req, res) => {
        try {
            // Vérifier si un mot de passe a été fourni
            const password = req.query.password || '';
            const shouldEncrypt = req.query.encrypt === 'true';
            
            // Journaliser l'action
            appLogger.info(`Exportation de toutes les données par ${req.session.user.username} (chiffrement: ${shouldEncrypt ? 'Oui' : 'Non'})`);
            serverLogger.info(`Exportation de toutes les données par ${req.session.user.username} (chiffrement: ${shouldEncrypt ? 'Oui' : 'Non'})`);
            
            // Chemin vers le répertoire de données
            const dataDir = path.join(__dirname, '../data');
            
            // Liste des fichiers à exporter (exclure les fichiers temporaires ou sensibles)
            const filesToExport = [
                'agencies.json',
                'archived_reminders.json',
                'inventory.json',
                'reminders.json',
                'roles.json',
                'templates.json',
                'users.json'
            ];
            
            // Créer un objet pour stocker toutes les données
            const allData = {
                exportDate: new Date().toISOString(),
                exportedBy: req.session.user.username,
                version: '1.0',
                encrypted: shouldEncrypt,
                data: {}
            };
            
            // Lire chaque fichier et ajouter son contenu à l'objet de données
            filesToExport.forEach(file => {
                try {
                    const filePath = path.join(dataDir, file);
                    if (fs.existsSync(filePath)) {
                        const fileContent = fs.readFileSync(filePath, 'utf8');
                        const jsonData = JSON.parse(fileContent);
                        // Extraire le nom de la collection à partir du nom du fichier (sans l'extension .json)
                        const collectionName = file.replace('.json', '');
                        allData.data[collectionName] = jsonData;
                    }
                } catch (error) {
                    serverLogger.error(`Erreur lors de la lecture du fichier ${file}: ${error.message}`);
                }
            });
            
            // Définir les en-têtes pour le téléchargement
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=outils_dsi_export_${new Date().toISOString().replace(/:/g, '-')}.json`);
            
            // Si le chiffrement est demandé et qu'un mot de passe est fourni, chiffrer les données
            if (shouldEncrypt && password) {
                try {
                    // Convertir les données en chaîne JSON
                    const jsonData = JSON.stringify(allData);
                    
                    // Générer un sel aléatoire
                    const salt = crypto.randomBytes(16);
                    
                    // Dériver une clé à partir du mot de passe et du sel
                    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
                    
                    // Générer un vecteur d'initialisation aléatoire
                    const iv = crypto.randomBytes(16);
                    
                    // Créer un chiffreur
                    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
                    
                    // Chiffrer les données
                    let encrypted = cipher.update(jsonData, 'utf8', 'base64');
                    encrypted += cipher.final('base64');
                    
                    // Obtenir le tag d'authentification
                    const authTag = cipher.getAuthTag();
                    
                    // Créer l'objet de données chiffrées
                    const encryptedData = {
                        encrypted: true,
                        salt: salt.toString('base64'),
                        iv: iv.toString('base64'),
                        authTag: authTag.toString('base64'),
                        data: encrypted,
                        algorithm: 'aes-256-gcm',
                        keyDerivation: 'pbkdf2',
                        iterations: 100000,
                        exportDate: new Date().toISOString()
                    };
                    
                    // Envoyer les données chiffrées
                    res.json(encryptedData);
                    
                    // Journaliser le succès
                    appLogger.info(`Exportation des données chiffrées réussie pour ${req.session.user.username}`);
                } catch (error) {
                    serverLogger.error(`Erreur lors du chiffrement des données: ${error.message}`);
                    req.session.error = "Erreur lors du chiffrement des données";
                    return res.redirect('/admin/dashboard');
                }
            } else {
                // Envoyer les données non chiffrées
                res.json(allData);
                
                // Journaliser le succès
                appLogger.info(`Exportation des données réussie pour ${req.session.user.username}`);
            }
        } catch (error) {
            serverLogger.error(`Erreur lors de l'exportation des données: ${error.message}`);
            req.session.error = "Erreur lors de l'exportation des données";
            res.redirect('/admin/dashboard');
        }
    },
    
    // Exporter la configuration
    exportConfig: (req, res) => {
        try {
            // Vérifier si un mot de passe a été fourni
            const password = req.query.password || '';
            
            // Journaliser l'action
            appLogger.info(`Exportation de la configuration par ${req.session.user.username}`);
            serverLogger.info(`Exportation de la configuration par ${req.session.user.username}`);
            
            // Chemin vers le fichier de configuration
            const configPath = path.join(__dirname, '../data/config.json');
            
            // Lire le fichier de configuration
            const configData = getConfigData();
            
            // Créer un objet pour stocker la configuration
            const configExport = {
                exportDate: new Date().toISOString(),
                exportedBy: req.session.user.username,
                version: '1.0',
                encrypted: true,
                config: configData
            };
            
            // Définir les en-têtes pour le téléchargement
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=outils_dsi_config_${new Date().toISOString().replace(/:/g, '-')}.json`);
            
            // La configuration contient des données sensibles, donc elle doit toujours être chiffrée
            if (password) {
                try {
                    // Convertir les données en chaîne JSON
                    const jsonData = JSON.stringify(configExport);
                    
                    // Générer un sel aléatoire
                    const salt = crypto.randomBytes(16);
                    
                    // Dériver une clé à partir du mot de passe et du sel
                    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
                    
                    // Générer un vecteur d'initialisation aléatoire
                    const iv = crypto.randomBytes(16);
                    
                    // Créer un chiffreur
                    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
                    
                    // Chiffrer les données
                    let encrypted = cipher.update(jsonData, 'utf8', 'base64');
                    encrypted += cipher.final('base64');
                    
                    // Obtenir le tag d'authentification
                    const authTag = cipher.getAuthTag();
                    
                    // Créer l'objet de données chiffrées
                    const encryptedData = {
                        encrypted: true,
                        salt: salt.toString('base64'),
                        iv: iv.toString('base64'),
                        authTag: authTag.toString('base64'),
                        data: encrypted,
                        algorithm: 'aes-256-gcm',
                        keyDerivation: 'pbkdf2',
                        iterations: 100000,
                        exportDate: new Date().toISOString()
                    };
                    
                    // Envoyer les données chiffrées
                    res.json(encryptedData);
                    
                    // Journaliser le succès
                    appLogger.info(`Exportation de la configuration chiffrée réussie pour ${req.session.user.username}`);
                } catch (error) {
                    serverLogger.error(`Erreur lors du chiffrement de la configuration: ${error.message}`);
                    req.session.error = "Erreur lors du chiffrement de la configuration";
                    return res.redirect('/admin/dashboard');
                }
            } else {
                // Si aucun mot de passe n'est fourni, rediriger vers la page d'exportation avec un message d'erreur
                req.session.error = "Un mot de passe est requis pour exporter la configuration";
                return res.redirect('/admin/export-options');
            }
        } catch (error) {
            serverLogger.error(`Erreur lors de l'exportation de la configuration: ${error.message}`);
            req.session.error = "Erreur lors de l'exportation de la configuration";
            res.redirect('/admin/dashboard');
        }
    },
    
    // Afficher la page d'options d'exportation
    showExportOptions: (req, res) => {
        try {
            res.render('admin/export-options', {
                title: 'Options d\'exportation',
                user: req.session.user
            });
        } catch (error) {
            serverLogger.error(`Erreur lors de l'affichage des options d'exportation: ${error.message}`);
            req.session.error = "Erreur lors de l'affichage des options d'exportation";
            res.redirect('/admin/dashboard');
        }
    },
    
    // Afficher la page d'importation des données
    showImportData: (req, res) => {
        try {
            res.render('admin/import-data', {
                title: 'Importer des données',
                user: req.session.user
            });
        } catch (error) {
            serverLogger.error(`Erreur lors de l'affichage de la page d'importation: ${error.message}`);
            req.session.error = "Erreur lors de l'affichage de la page d'importation";
            res.redirect('/admin/dashboard');
        }
    },
    
    // Importer toutes les données
    importAllData: (req, res) => {
        try {
            // Vérifier si un fichier a été téléchargé
            if (!req.files || !req.files.importFile) {
                req.session.error = "Aucun fichier n'a été téléchargé";
                return res.redirect('/admin/import-data');
            }
            
            // Journaliser l'action
            appLogger.info(`Importation de données par ${req.session.user.username}`);
            serverLogger.info(`Importation de données par ${req.session.user.username}`);
            
            // Récupérer le fichier téléchargé
            const importFile = req.files.importFile;
            
            // Vérifier le type de fichier
            if (importFile.mimetype !== 'application/json') {
                req.session.error = "Le fichier doit être au format JSON";
                return res.redirect('/admin/import-data');
            }
            
            // Récupérer le mot de passe si fourni
            const password = req.body.password || '';
            
            // Parser le contenu JSON
            let importData;
            try {
                const fileContent = importFile.data.toString();
                const jsonContent = JSON.parse(fileContent);
                
                // Vérifier si les données sont chiffrées
                if (jsonContent.encrypted === true) {
                    // Si les données sont chiffrées mais qu'aucun mot de passe n'est fourni
                    if (!password) {
                        req.session.error = "Ce fichier est chiffré. Veuillez fournir un mot de passe.";
                        return res.redirect('/admin/import-data');
                    }
                    
                    // Déchiffrer les données
                    try {
                        // Récupérer les paramètres de chiffrement
                        const salt = Buffer.from(jsonContent.salt, 'base64');
                        const iv = Buffer.from(jsonContent.iv, 'base64');
                        const authTag = Buffer.from(jsonContent.authTag, 'base64');
                        const encryptedData = jsonContent.data;
                        
                        // Dériver la clé à partir du mot de passe et du sel
                        const key = crypto.pbkdf2Sync(password, salt, jsonContent.iterations || 100000, 32, 'sha512');
                        
                        // Créer un déchiffreur
                        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                        decipher.setAuthTag(authTag);
                        
                        // Déchiffrer les données
                        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
                        decrypted += decipher.final('utf8');
                        
                        // Parser les données déchiffrées
                        importData = JSON.parse(decrypted);
                    } catch (error) {
                        serverLogger.error(`Erreur lors du déchiffrement des données: ${error.message}`);
                        req.session.error = "Erreur lors du déchiffrement des données. Le mot de passe est peut-être incorrect.";
                        return res.redirect('/admin/import-data');
                    }
                } else {
                    // Si les données ne sont pas chiffrées
                    importData = jsonContent;
                }
                
                // Vérifier si c'est un fichier de configuration
                if (importData.config) {
                    req.session.error = "Ce fichier contient une configuration. Veuillez utiliser la fonction d'importation de configuration.";
                    return res.redirect('/admin/import-data');
                }
                
                // Vérifier la structure du fichier d'importation
                if (!importData.data || typeof importData.data !== 'object') {
                    req.session.error = "Le fichier d'importation a une structure invalide";
                    return res.redirect('/admin/import-data');
                }
            } catch (error) {
                req.session.error = "Le fichier JSON est invalide";
                return res.redirect('/admin/import-data');
            }
            
            // Chemin vers le répertoire de données
            const dataDir = path.join(__dirname, '../data');
            
            // Créer un répertoire de sauvegarde
            const backupDir = path.join(__dirname, '../data/backup', new Date().toISOString().replace(/:/g, '-'));
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            // Sauvegarder les fichiers existants
            const filesToImport = Object.keys(importData.data).map(key => `${key}.json`);
            filesToImport.forEach(file => {
                try {
                    const filePath = path.join(dataDir, file);
                    if (fs.existsSync(filePath)) {
                        const backupPath = path.join(backupDir, file);
                        fs.copyFileSync(filePath, backupPath);
                    }
                } catch (error) {
                    serverLogger.error(`Erreur lors de la sauvegarde du fichier ${file}: ${error.message}`);
                }
            });
            
            // Importer les données
            let importedFiles = 0;
            Object.entries(importData.data).forEach(([key, value]) => {
                try {
                    const filePath = path.join(dataDir, `${key}.json`);
                    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
                    importedFiles++;
                } catch (error) {
                    serverLogger.error(`Erreur lors de l'importation du fichier ${key}.json: ${error.message}`);
                }
            });
            
            // Journaliser le succès
            appLogger.info(`Importation réussie de ${importedFiles} fichiers par ${req.session.user.username}`);
            serverLogger.info(`Importation réussie de ${importedFiles} fichiers par ${req.session.user.username}`);
            
            req.session.success = `Importation réussie de ${importedFiles} fichiers. Une sauvegarde a été créée.`;
            res.redirect('/admin/dashboard');
        } catch (error) {
            serverLogger.error(`Erreur lors de l'importation des données: ${error.message}`);
            req.session.error = "Erreur lors de l'importation des données";
            res.redirect('/admin/import-data');
        }
    },
    
    // Importer la configuration
    importConfig: (req, res) => {
        try {
            // Vérifier si un fichier a été téléchargé
            if (!req.files || !req.files.importFile) {
                req.session.error = "Aucun fichier n'a été téléchargé";
                return res.redirect('/admin/import-data');
            }
            
            // Journaliser l'action
            appLogger.info(`Importation de la configuration par ${req.session.user.username}`);
            serverLogger.info(`Importation de la configuration par ${req.session.user.username}`);
            
            // Récupérer le fichier téléchargé
            const importFile = req.files.importFile;
            
            // Vérifier le type de fichier
            if (importFile.mimetype !== 'application/json') {
                req.session.error = "Le fichier doit être au format JSON";
                return res.redirect('/admin/import-data');
            }
            
            // Récupérer le mot de passe si fourni
            const password = req.body.password || '';
            
            // Parser le contenu JSON
            let importData;
            try {
                const fileContent = importFile.data.toString();
                const jsonContent = JSON.parse(fileContent);
                
                // Vérifier si les données sont chiffrées
                if (jsonContent.encrypted === true) {
                    // Si les données sont chiffrées mais qu'aucun mot de passe n'est fourni
                    if (!password) {
                        req.session.error = "Ce fichier est chiffré. Veuillez fournir un mot de passe.";
                        return res.redirect('/admin/import-data');
                    }
                    
                    // Déchiffrer les données
                    try {
                        // Récupérer les paramètres de chiffrement
                        const salt = Buffer.from(jsonContent.salt, 'base64');
                        const iv = Buffer.from(jsonContent.iv, 'base64');
                        const authTag = Buffer.from(jsonContent.authTag, 'base64');
                        const encryptedData = jsonContent.data;
                        
                        // Dériver la clé à partir du mot de passe et du sel
                        const key = crypto.pbkdf2Sync(password, salt, jsonContent.iterations || 100000, 32, 'sha512');
                        
                        // Créer un déchiffreur
                        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                        decipher.setAuthTag(authTag);
                        
                        // Déchiffrer les données
                        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
                        decrypted += decipher.final('utf8');
                        
                        // Parser les données déchiffrées
                        importData = JSON.parse(decrypted);
                    } catch (error) {
                        serverLogger.error(`Erreur lors du déchiffrement de la configuration: ${error.message}`);
                        req.session.error = "Erreur lors du déchiffrement de la configuration. Le mot de passe est peut-être incorrect.";
                        return res.redirect('/admin/import-data');
                    }
                } else {
                    // Si les données ne sont pas chiffrées
                    importData = jsonContent;
                }
                
                // Vérifier si c'est un fichier de configuration
                if (!importData.config) {
                    req.session.error = "Ce fichier ne contient pas de configuration valide.";
                    return res.redirect('/admin/import-data');
                }
            } catch (error) {
                req.session.error = "Le fichier JSON est invalide";
                return res.redirect('/admin/import-data');
            }
            
            // Chemin vers le fichier de configuration
            const configPath = path.join(__dirname, '../data/config.json');
            
            // Créer un répertoire de sauvegarde
            const backupDir = path.join(__dirname, '../data/backup', new Date().toISOString().replace(/:/g, '-'));
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            // Sauvegarder la configuration existante
            if (fs.existsSync(configPath)) {
                const backupPath = path.join(backupDir, 'config.json');
                fs.copyFileSync(configPath, backupPath);
            }
            
            // Importer la configuration
            fs.writeFileSync(configPath, JSON.stringify(importData.config, null, 2));
            
            // Journaliser le succès
            appLogger.info(`Importation de la configuration réussie par ${req.session.user.username}`);
            serverLogger.info(`Importation de la configuration réussie par ${req.session.user.username}`);
            
            req.session.success = "Importation de la configuration réussie. Une sauvegarde a été créée. Le serveur doit être redémarré pour appliquer les changements.";
            res.redirect('/admin/dashboard');
        } catch (error) {
            serverLogger.error(`Erreur lors de l'importation de la configuration: ${error.message}`);
            req.session.error = "Erreur lors de l'importation de la configuration";
            res.redirect('/admin/import-data');
        }
    }
};

module.exports = adminController; 