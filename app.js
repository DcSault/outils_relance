const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const winston = require('winston');
const { format } = winston;
const DailyRotateFile = require('winston-daily-rotate-file');
const passport = require('passport');
const fileUpload = require('express-fileupload');

// Configuration du système de logs
const logDir = path.join(__dirname, 'logs');

// Créer le répertoire de logs s'il n'existe pas
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Format personnalisé pour les logs
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]${info.category ? ' [' + info.category + ']' : ''}: ${info.message}`)
);

// Configuration des transports pour les logs serveur
const serverFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'server-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
  auditFile: path.join(logDir, '.server-audit.json')
});

const serverErrorFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'server-error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
  auditFile: path.join(logDir, '.server-error-audit.json')
});

// Configuration des transports pour les logs d'application
const appFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
  handleExceptions: true,
  auditFile: path.join(logDir, '.application-audit.json')
});

const appErrorFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'application-error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
  handleExceptions: true,
  auditFile: path.join(logDir, '.application-error-audit.json')
});

// S'assurer que les transports sont prêts avant de créer les loggers
appFileTransport.on('new', (filename) => {
  console.log(`Nouveau fichier de log d'application créé: ${filename}`);
});

appErrorFileTransport.on('new', (filename) => {
  console.log(`Nouveau fichier de log d'erreur d'application créé: ${filename}`);
});

// Création des loggers
const serverLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { category: 'SERVER' },
  transports: [
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        logFormat
      )
    }),
    serverFileTransport,
    serverErrorFileTransport
  ],
  exitOnError: false
});

const appLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { category: 'APP' },
  transports: [
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        logFormat
      )
    }),
    appFileTransport,
    appErrorFileTransport
  ],
  exitOnError: false
});

// Rendre les loggers disponibles globalement
winston.loggers.add('server', serverLogger);
winston.loggers.add('app', appLogger);
winston.loggers.add('default', serverLogger); // Pour la compatibilité avec le code existant

// Exporter les loggers pour les utiliser dans d'autres fichiers
global.serverLogger = serverLogger;
global.appLogger = appLogger;

// Fonction pour charger la configuration
const loadConfig = () => {
  const configPath = path.join(__dirname, 'data/config.json');
  if (fs.existsSync(configPath)) {
    try {
      // Lire le fichier de configuration sans utiliser de cache
      const fileContent = fs.readFileSync(configPath, { encoding: 'utf8', flag: 'r' });
      serverLogger.info(`Contenu du fichier config.json: ${fileContent}`);
      
      const configData = JSON.parse(fileContent);
      
      // Vérifier que le port est correctement défini
      if (configData.domain && configData.domain.port !== undefined) {
        // Convertir explicitement en nombre entier
        const portValue = parseInt(configData.domain.port);
        
        // Vérifier si la conversion a réussi
        if (!isNaN(portValue)) {
          configData.domain.port = portValue;
          serverLogger.info(`Port chargé depuis la configuration: ${configData.domain.port} (type: ${typeof configData.domain.port})`);
        } else {
          serverLogger.warn(`Valeur de port invalide dans config.json: ${configData.domain.port}, utilisation de la valeur par défaut 3000`);
          configData.domain.port = 3000;
        }
      } else if (configData.domain) {
        serverLogger.warn('Port non défini dans la configuration, utilisation du port par défaut 3000');
        configData.domain.port = 3000;
      }
      
      return configData;
    } catch (error) {
      serverLogger.error(`Erreur lors de la lecture du fichier config.json: ${error.message}`);
    }
  }
  return {
    auth: { methods: { local: { enabled: true, name: 'local' } } },
    domain: { useCustomDomain: false, port: 3000, sslMethod: 'manual' }
  };
};

// Charger la configuration
let config = loadConfig();

// Initialisation de l'application Express
const app = express();

// Lire le port depuis la configuration
let PORT = 3005; // Port par défaut explicite
try {
  // Lire directement le fichier de configuration
  const configPath = path.join(__dirname, 'data/config.json');
  if (fs.existsSync(configPath)) {
    const fileContent = fs.readFileSync(configPath, { encoding: 'utf8', flag: 'r' });
    const configData = JSON.parse(fileContent);
    
    // Extraire le port de la configuration
    if (configData.domain && configData.domain.port !== undefined) {
      const portValue = parseInt(configData.domain.port);
      if (!isNaN(portValue) && portValue > 0 && portValue < 65536) {
        PORT = portValue;
        serverLogger.info(`Port lu depuis la configuration: ${PORT} (type: ${typeof PORT})`);
        console.log(`Port lu depuis la configuration: ${PORT} (type: ${typeof PORT})`);
      } else {
        serverLogger.warn(`Port invalide dans la configuration: ${configData.domain.port}, utilisation du port par défaut ${PORT}`);
        console.log(`Port invalide dans la configuration: ${configData.domain.port}, utilisation du port par défaut ${PORT}`);
      }
    } else {
      serverLogger.warn(`Port non défini dans la configuration, utilisation du port par défaut ${PORT}`);
      console.log(`Port non défini dans la configuration, utilisation du port par défaut ${PORT}`);
    }
  } else {
    serverLogger.warn(`Fichier de configuration non trouvé, utilisation du port par défaut ${PORT}`);
    console.log(`Fichier de configuration non trouvé, utilisation du port par défaut ${PORT}`);
  }
} catch (error) {
  serverLogger.error(`Erreur lors de la lecture de la configuration: ${error.message}, utilisation du port par défaut ${PORT}`);
  console.error(`Erreur lors de la lecture de la configuration: ${error.message}, utilisation du port par défaut ${PORT}`);
}

// Mettre à jour la configuration en mémoire
if (config.domain) {
  config.domain.port = PORT;
}

// Rendre le port disponible globalement
global.PORT = PORT;

// Journaliser le port configuré
serverLogger.info(`Port configuré: ${PORT} (type: ${typeof PORT})`);
console.log(`Port configuré: ${PORT} (type: ${typeof PORT})`);

// Configuration du moteur de template EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour parser les requêtes
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware pour gérer les téléchargements de fichiers
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // Limite de 50 Mo
    abortOnLimit: true,
    responseOnLimit: "Le fichier est trop volumineux (limite: 50 Mo)",
    useTempFiles: true,
    tempFileDir: path.join(__dirname, 'temp'),
    createParentPath: true
}));

// Configuration des fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Configuration de la session
app.use(session({
  secret: 'outils_relance_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 heures
}));

// Initialisation de Passport.js
app.use(passport.initialize());
app.use(passport.session());

// Configuration des stratégies d'authentification
require('./config/passport')();

// Middleware pour rendre l'utilisateur disponible dans les templates
app.use((req, res, next) => {
  res.locals.user = req.isAuthenticated() ? req.user : req.session.user || null;
  next();
});

// Middleware pour les logs d'application
app.use((req, res, next) => {
  // Exclure les requêtes pour les fichiers statiques et les assets
  if (!req.path.startsWith('/public') && !req.path.includes('.') && !req.path.includes('/favicon.ico')) {
    const appLogger = winston.loggers.get('app');
    const user = req.session.user ? `${req.session.user.username} (${req.session.user.role})` : 'Anonyme';
    
    // Déterminer le module en fonction du chemin
    let module = 'Général';
    if (req.path.startsWith('/admin')) module = 'Administration';
    else if (req.path.startsWith('/inventory')) module = 'Inventaire';
    else if (req.path.startsWith('/users')) module = 'Utilisateurs';
    else if (req.path.startsWith('/agencies')) module = 'Agences';
    else if (req.path.startsWith('/templates')) module = 'Modèles';
    else if (req.path.startsWith('/reminders')) module = 'Relances';
    else if (req.path.startsWith('/notifications')) module = 'Notifications';
    else if (req.path === '/dashboard') module = 'Tableau de bord';
    else if (req.path === '/login' || req.path === '/logout' || req.path === '/') module = 'Authentification';
    
    // Déterminer l'action en fonction de la méthode HTTP et du chemin
    let action = 'Consultation';
    if (req.method === 'POST') {
      if (req.path.includes('/create') || req.path.includes('/add')) action = 'Création';
      else if (req.path.includes('/edit') || req.path.includes('/update')) action = 'Modification';
      else if (req.path.includes('/delete')) action = 'Suppression';
      else if (req.path === '/login') action = 'Connexion';
      else if (req.path.includes('/restart')) action = 'Redémarrage';
      else action = 'Action';
    } else if (req.method === 'GET') {
      if (req.path === '/logout') action = 'Déconnexion';
      else if (req.path.includes('/details')) action = 'Consultation détaillée';
    }
    
    // Enregistrer les détails de la requête
    const logData = {
      method: req.method,
      path: req.path,
      module: module,
      action: action,
      user: user,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      params: req.params,
      query: req.query
    };
    
    // Pour les requêtes POST, enregistrer également les données du formulaire (sauf les mots de passe)
    if (req.method === 'POST' && req.body) {
      const sanitizedBody = { ...req.body };
      // Supprimer les champs sensibles
      if (sanitizedBody.password) sanitizedBody.password = '********';
      if (sanitizedBody.passwordConfirm) sanitizedBody.passwordConfirm = '********';
      if (sanitizedBody.currentPassword) sanitizedBody.currentPassword = '********';
      if (sanitizedBody.newPassword) sanitizedBody.newPassword = '********';
      
      logData.body = sanitizedBody;
    }
    
    // Enregistrer la requête
    appLogger.info(`[${module}] ${action}: ${req.method} ${req.path} - Utilisateur: ${user} - IP: ${req.ip}`, { details: logData });
    
    // Capturer également la réponse
    const originalSend = res.send;
    res.send = function(body) {
      // Enregistrer le statut de la réponse
      appLogger.info(`Réponse [${res.statusCode}] pour ${req.path} - Module: ${module} - Action: ${action} - Utilisateur: ${user}`);
      
      // Appeler la fonction d'origine
      originalSend.apply(res, arguments);
    };
  }
  next();
});

// Middleware pour vérifier si les dossiers de données existent
const dataDir = path.join(__dirname, 'data');
const requiredDataFiles = ['users.json', 'agencies.json', 'inventory.json', 'templates.json', 'reminders.json', 'notifications.json', 'config.json'];

// Création du dossier data s'il n'existe pas
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Création des fichiers JSON s'ils n'existent pas
requiredDataFiles.forEach(file => {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) {
    let defaultData;
    
    switch (file) {
      case 'users.json':
        defaultData = { users: [] };
        break;
      case 'agencies.json':
        defaultData = { agencies: [] };
        break;
      case 'inventory.json':
        defaultData = { items: [] };
        break;
      case 'templates.json':
        defaultData = { templates: [] };
        break;
      case 'reminders.json':
        defaultData = { reminders: [] };
        break;
      case 'notifications.json':
        defaultData = { notifications: [] };
        break;
      case 'config.json':
        defaultData = {
          auth: {
            methods: {
              local: { enabled: true, name: 'local' },
              discord: { enabled: false, clientId: '', clientSecret: '', redirectUri: '', name: 'discord' },
              azure: { enabled: false, clientId: '', clientSecret: '', tenantId: '', redirectUri: '', name: 'azure' },
              github: { enabled: false, clientId: '', clientSecret: '', redirectUri: '', name: 'github' },
              okta: { enabled: false, clientId: '', clientSecret: '', domain: '', redirectUri: '', name: 'okta' }
            }
          },
          domain: {
            useCustomDomain: false,
            domainName: '',
            useSSL: false,
            sslCertPath: '',
            sslKeyPath: '',
            sslMethod: 'manual',
            letsencryptEmail: '',
            port: 3000
          }
        };
        break;
      default:
        defaultData = {};
    }
    
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    serverLogger.info(`Fichier ${file} créé avec succès.`);
  }
});

// Middleware pour rendre les messages de session disponibles dans les vues
app.use((req, res, next) => {
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  res.locals.warning = req.session.warning;
  res.locals.info = req.session.info;
  res.locals.portChanged = req.session.portChanged;
  
  req.session.success = null;
  req.session.error = null;
  req.session.warning = null;
  req.session.info = null;
  
  // Ne pas effacer portChanged immédiatement pour permettre l'affichage après redirection
  if (req.path !== '/admin/domain-config') {
    req.session.portChanged = null;
  }
  
  next();
});

// Middleware pour déboguer la configuration
app.use((req, res, next) => {
  // Journaliser la configuration d'authentification pour le débogage
  if (config && config.auth && config.auth.methods) {
    const authMethods = {
      discord: config.auth.methods.discord && config.auth.methods.discord.enabled,
      github: config.auth.methods.github && config.auth.methods.github.enabled,
      azure: config.auth.methods.azure && config.auth.methods.azure.enabled,
      okta: config.auth.methods.okta && config.auth.methods.okta.enabled
    };
    
    serverLogger.info(`Configuration d'authentification: ${JSON.stringify(authMethods)}`);
  }
  next();
});

// Importation des routes
const agencyRoutes = require('./routes/agencyRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const templateRoutes = require('./routes/templateRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');

// Importation du contrôleur de notifications
const notificationController = require('./controllers/notificationController');

// Middleware pour générer les notifications à chaque requête pour les utilisateurs authentifiés
app.use((req, res, next) => {
  if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'technicien')) {
    // Générer les notifications pour les relances nécessaires
    notificationController.generateReminderNotifications();
  }
  next();
});

// Utilisation des routes
app.use('/agencies', agencyRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/templates', templateRoutes);
app.use('/reminders', reminderRoutes);
app.use('/users', userRoutes);
app.use('/notifications', notificationRoutes);
app.use('/admin', adminRoutes);
app.use('/auth', authRoutes);

// Routes
app.get('/', (req, res) => {
  // Recharger la configuration depuis le fichier pour s'assurer qu'elle est à jour
  try {
    const configPath = path.join(__dirname, 'data/config.json');
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, { encoding: 'utf8', flag: 'r' });
      const freshConfig = JSON.parse(fileContent);
      
      // Mettre à jour la configuration globale
      config = freshConfig;
      
      console.log('Configuration rechargée depuis le fichier pour la page d\'accueil');
      console.log('Méthodes d\'authentification dans la configuration:', {
        discord: config.auth.methods.discord && config.auth.methods.discord.enabled,
        github: config.auth.methods.github && config.auth.methods.github.enabled,
        azure: config.auth.methods.azure && config.auth.methods.azure.enabled,
        okta: config.auth.methods.okta && config.auth.methods.okta.enabled
      });
    }
  } catch (error) {
    console.error('Erreur lors du rechargement de la configuration:', error);
  }
  
  // Journaliser la configuration avant de la passer à la vue
  if (config && config.auth && config.auth.methods) {
    serverLogger.info(`Configuration passée à la vue: ${JSON.stringify({
      discord: config.auth.methods.discord && config.auth.methods.discord.enabled,
      github: config.auth.methods.github && config.auth.methods.github.enabled,
      azure: config.auth.methods.azure && config.auth.methods.azure.enabled,
      okta: config.auth.methods.okta && config.auth.methods.okta.enabled
    })}`);
    
    console.log('Configuration passée à la vue:', {
      discord: config.auth.methods.discord && config.auth.methods.discord.enabled,
      github: config.auth.methods.github && config.auth.methods.github.enabled,
      azure: config.auth.methods.azure && config.auth.methods.azure.enabled,
      okta: config.auth.methods.okta && config.auth.methods.okta.enabled
    });
  }
  
  res.render('index', { 
    title: 'Outils de Gestion DSI',
    user: req.session.user || null,
    config: config
  });
});

// Route de connexion
app.post('/login', (req, res) => {
  const { username } = req.body;
  
  // Vérifier si l'authentification locale est activée
  const configData = loadConfig();
  if (!configData.auth.methods.local || !configData.auth.methods.local.enabled) {
    appLogger.warn(`Tentative de connexion locale alors que la méthode est désactivée - IP: ${req.ip}`);
    req.session.error = "L'authentification locale n'est pas activée. Veuillez utiliser une autre méthode d'authentification.";
    return res.redirect('/');
  }
  
  // Vérifier si le nom d'utilisateur est fourni
  if (!username || username.trim() === '') {
    appLogger.warn(`Tentative de connexion échouée: nom d'utilisateur vide - IP: ${req.ip}`);
    req.session.error = 'Le nom d\'utilisateur est requis';
    return res.redirect('/');
  }
  
  // Charger les données des utilisateurs
  const usersPath = path.join(__dirname, 'data/users.json');
  let usersData = { users: [] };
  
  if (fs.existsSync(usersPath)) {
    try {
      usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    } catch (error) {
      serverLogger.error(`Erreur lors de la lecture du fichier users.json: ${error.message}`);
      req.session.error = 'Erreur lors de la lecture des données utilisateurs';
      return res.redirect('/');
    }
  }
  
  // Charger les données des agences
  const agenciesPath = path.join(__dirname, 'data/agencies.json');
  let agenciesData = { agencies: [] };
  
  if (fs.existsSync(agenciesPath)) {
    try {
      agenciesData = JSON.parse(fs.readFileSync(agenciesPath, 'utf8'));
    } catch (error) {
      serverLogger.error(`Erreur lors de la lecture du fichier agencies.json: ${error.message}`);
    }
  }
  
  // Trouver l'agence Services Informatique
  const itServiceAgencyId = agenciesData.agencies.find(a => a.name === 'Services Informatique')?.id;
  
  // Rechercher l'utilisateur
  let user = usersData.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  // Si l'utilisateur n'existe pas et que c'est la première connexion, créer un compte admin
  if (!user && usersData.users.length === 0) {
    appLogger.warn(`Première connexion détectée. Création d'un compte administrateur pour "${username}"`);
    
    user = {
      id: uuidv4(),
      username: username,
      role: 'admin', // Le premier utilisateur est administrateur
      agency: itServiceAgencyId, // Association automatique à l'agence Services Informatique
      email: '',
      phone: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    usersData.users.push(user);
    fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
  } else if (!user && username.toLowerCase() === 'admin') {
    // Si l'utilisateur est 'admin' et qu'il n'existe pas, le créer
    appLogger.warn(`Création d'un compte administrateur pour "admin"`);
    
    user = {
      id: uuidv4(),
      username: 'admin',
      role: 'admin',
      agency: itServiceAgencyId,
      email: '',
      phone: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    usersData.users.push(user);
    fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
  } else if (!user) {
    // Si l'utilisateur n'existe pas, créer un compte technicien
    appLogger.info(`Création d'un compte technicien pour "${username}"`);
    
    user = {
      id: uuidv4(),
      username: username,
      role: 'technicien', // Par défaut, tous les nouveaux utilisateurs sont des techniciens
      agency: itServiceAgencyId, // Association automatique à l'agence Services Informatique
      email: '',
      phone: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    usersData.users.push(user);
    fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
  }
  
  // Vérifier si l'utilisateur a le rôle "user" (employé)
  if (user.role === 'user') {
    appLogger.warn(`Tentative de connexion refusée pour l'utilisateur "${username}" (rôle: user)`);
    req.session.error = 'Les employés ne peuvent pas se connecter à l\'application. Veuillez contacter votre administrateur.';
    return res.redirect('/');
  }
  
  // Si l'utilisateur est un technicien sans agence, on l'associe à l'agence Services Informatique
  if (user.role === 'technicien' && !user.agency && itServiceAgencyId) {
    user.agency = itServiceAgencyId;
    user.updatedAt = new Date().toISOString();
    
    // Mise à jour de l'utilisateur dans le fichier
    const userIndex = usersData.users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      usersData.users[userIndex] = user;
      fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
    }
  }
  
  // Stockage de l'utilisateur dans la session
  req.session.user = user;
  
  // Journaliser la connexion
  appLogger.info(`Connexion réussie pour l'utilisateur "${username}" (rôle: ${user.role}) - IP: ${req.ip}`);
  
  res.redirect('/dashboard');
});

// Route de déconnexion
app.get('/logout', (req, res) => {
  // Journaliser la déconnexion si l'utilisateur était connecté
  if (req.session.user) {
    appLogger.info(`Déconnexion de l'utilisateur "${req.session.user.username}" (rôle: ${req.session.user.role}) - IP: ${req.ip}`);
  }
  
  req.session.destroy();
  res.redirect('/');
});

// Route du tableau de bord
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  
  // Récupération des statistiques
  const inventoryPath = path.join(dataDir, 'inventory.json');
  const agenciesPath = path.join(dataDir, 'agencies.json');
  const remindersPath = path.join(dataDir, 'reminders.json');
  const usersPath = path.join(dataDir, 'users.json');
  
  const inventoryData = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const agenciesData = JSON.parse(fs.readFileSync(agenciesPath, 'utf8'));
  const remindersData = JSON.parse(fs.readFileSync(remindersPath, 'utf8'));
  const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  
  // Statistiques de base pour tous les utilisateurs
  const stats = {
    itemsInStock: inventoryData.items.filter(item => item.status === 'available').length,
    itemsBorrowed: inventoryData.items.filter(item => item.status === 'borrowed').length,
    itemsAssigned: inventoryData.items.filter(item => item.status === 'assigned').length
  };
  
  // Statistiques supplémentaires pour les techniciens et administrateurs
  if (req.session.user.role === 'technicien' || req.session.user.role === 'admin') {
    stats.pendingReminders = remindersData.reminders.filter(reminder => reminder.status === 'pending').length;
    stats.activeAgencies = agenciesData.agencies.length;
  }
  
  // Statistiques supplémentaires pour les administrateurs uniquement
  if (req.session.user.role === 'admin') {
    stats.totalUsers = usersData.users.length;
    stats.technicienUsers = usersData.users.filter(user => user.role === 'technicien').length;
    stats.regularUsers = usersData.users.filter(user => user.role === 'user').length;
  }
  
  res.render('dashboard', {
    title: 'Tableau de Bord',
    user: req.session.user,
    stats: stats,
    isTechnicien: req.session.user.role === 'technicien' || req.session.user.role === 'admin',
    isAdmin: req.session.user.role === 'admin'
  });
});

// Route du profil utilisateur
app.get('/profile', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  
  // Lecture du fichier agencies.json pour obtenir l'agence de l'utilisateur
  const agenciesPath = path.join(dataDir, 'agencies.json');
  const agenciesData = JSON.parse(fs.readFileSync(agenciesPath, 'utf8'));
  
  const userAgency = agenciesData.agencies.find(a => a.id === req.session.user.agency);
  
  res.render('profile', {
    title: 'Profil Utilisateur',
    user: req.session.user,
    agency: userAgency || null
  });
});

// Middleware pour les erreurs 404
app.use((req, res, next) => {
  const user = req.session.user ? `${req.session.user.username} (${req.session.user.role})` : 'Anonyme';
  serverLogger.warn(`404 - Page non trouvée: ${req.path} - Utilisateur: ${user} - IP: ${req.ip}`);
  
  res.status(404).render('error', {
    title: 'Page non trouvée',
    user: req.session.user,
    error: {
      status: 404,
      message: 'La page que vous recherchez n\'existe pas.'
    }
  });
});

// Middleware pour les erreurs 500
app.use((err, req, res, next) => {
  const user = req.session.user ? `${req.session.user.username} (${req.session.user.role})` : 'Anonyme';
  serverLogger.error(`500 - Erreur serveur: ${err.message} - Utilisateur: ${user} - IP: ${req.ip}`, { stack: err.stack });
  
  res.status(500).render('error', {
    title: 'Erreur serveur',
    user: req.session.user,
    error: {
      status: 500,
      message: 'Une erreur est survenue sur le serveur.',
      stack: process.env.NODE_ENV === 'development' ? err.stack : null
    }
  });
});

// Démarrage du serveur
let server;

// Fonction pour démarrer le serveur
const startServer = () => {
    try {
        // Récupérer le port depuis la configuration
        const configData = loadConfig();
        const PORT = configData.domain.port || 3000;
        
        // Journaliser le port utilisé
        serverLogger.info(`Port lu directement depuis le fichier config.json: ${PORT}`);
        console.log(`Port lu directement depuis le fichier config.json: ${PORT}`);
        
        // Journaliser le démarrage du serveur
        serverLogger.info(`Démarrage du serveur sur le port: ${PORT}`);
        console.log(`Démarrage du serveur sur le port: ${PORT}`);
        
        let newServer;
        
        // Vérifier si SSL est activé
        if (configData.domain && configData.domain.useSSL === true && configData.domain.sslCertPath && configData.domain.sslKeyPath) {
            try {
                // S'assurer que les chemins sont relatifs
                const sslCertPath = path.isAbsolute(configData.domain.sslCertPath) 
                    ? path.relative(__dirname, configData.domain.sslCertPath) 
                    : configData.domain.sslCertPath;
                
                const sslKeyPath = path.isAbsolute(configData.domain.sslKeyPath) 
                    ? path.relative(__dirname, configData.domain.sslKeyPath) 
                    : configData.domain.sslKeyPath;
                
                // Convertir les chemins relatifs en chemins absolus pour la lecture des fichiers
                const absoluteSslCertPath = path.join(__dirname, sslCertPath);
                const absoluteSslKeyPath = path.join(__dirname, sslKeyPath);
                
                // Vérifier si les fichiers de certificat existent
                if (fs.existsSync(absoluteSslCertPath) && fs.existsSync(absoluteSslKeyPath)) {
                    const options = {
                        cert: fs.readFileSync(absoluteSslCertPath),
                        key: fs.readFileSync(absoluteSslKeyPath)
                    };
                    
                    // Journaliser les chemins utilisés
                    serverLogger.info(`Utilisation du certificat SSL: ${absoluteSslCertPath}`);
                    serverLogger.info(`Utilisation de la clé privée SSL: ${absoluteSslKeyPath}`);
                    console.log(`Utilisation du certificat SSL: ${absoluteSslCertPath}`);
                    console.log(`Utilisation de la clé privée SSL: ${absoluteSslKeyPath}`);
                    
                    // Créer un serveur HTTPS
                    newServer = https.createServer(options, app);
                    newServer.listen(PORT, () => {
                        serverLogger.info(`Serveur HTTPS démarré sur https://${configData.domain.useCustomDomain ? configData.domain.domainName : 'localhost'}:${PORT}`);
                        console.log(`Serveur HTTPS démarré sur https://${configData.domain.useCustomDomain ? configData.domain.domainName : 'localhost'}:${PORT}`);
                        
                        // Exposer le port actuel globalement
                        global.currentPort = PORT;
                    });
                } else {
                    serverLogger.error(`Certificat SSL ou clé privée introuvable. Certificat: ${absoluteSslCertPath}, Clé: ${absoluteSslKeyPath}`);
                    console.error(`Certificat SSL ou clé privée introuvable. Certificat: ${absoluteSslCertPath}, Clé: ${absoluteSslKeyPath}`);
                    serverLogger.error('Démarrage en mode HTTP.');
                    console.error('Démarrage en mode HTTP.');
                    newServer = app.listen(PORT, () => {
                        serverLogger.info(`Serveur HTTP démarré sur http://localhost:${PORT}`);
                        console.log(`Serveur HTTP démarré sur http://localhost:${PORT}`);
                        
                        // Exposer le port actuel globalement
                        global.currentPort = PORT;
                    });
                }
            } catch (error) {
                serverLogger.error(`Erreur lors du démarrage du serveur HTTPS: ${error.message}`);
                console.error(`Erreur lors du démarrage du serveur HTTPS: ${error.message}`);
                serverLogger.info('Démarrage en mode HTTP...');
                console.log('Démarrage en mode HTTP...');
                newServer = app.listen(PORT, () => {
                    serverLogger.info(`Serveur HTTP démarré sur http://localhost:${PORT}`);
                    console.log(`Serveur HTTP démarré sur http://localhost:${PORT}`);
                    
                    // Exposer le port actuel globalement
                    global.currentPort = PORT;
                });
            }
        } else {
            // Démarrer en mode HTTP
            serverLogger.info('Mode SSL désactivé, démarrage en HTTP');
            console.log('Mode SSL désactivé, démarrage en HTTP');
            newServer = app.listen(PORT, () => {
                serverLogger.info(`Serveur HTTP démarré sur http://localhost:${PORT}`);
                console.log(`Serveur HTTP démarré sur http://localhost:${PORT}`);
                
                // Exposer le port actuel globalement
                global.currentPort = PORT;
            });
        }
        
        // Exposer l'instance du serveur globalement
        global.server = newServer;
        
        return newServer;
    } catch (error) {
        serverLogger.error(`Erreur lors du démarrage du serveur: ${error.message}`);
        console.error(`Erreur lors du démarrage du serveur: ${error.message}`);
        return null;
    }
};

// Fonction pour redémarrer le serveur
global.restartServer = () => {
  if (server) {
    serverLogger.info('Arrêt du serveur en cours...');
    console.log('Arrêt du serveur en cours...');
    server.close(() => {
      serverLogger.info('Serveur arrêté. Redémarrage...');
      console.log('Serveur arrêté. Redémarrage...');
      
      try {
        // Lire directement le fichier de configuration pour obtenir la valeur la plus récente du port
        const configPath = path.join(__dirname, 'data/config.json');
        
        // Vérifier si le fichier existe
        if (!fs.existsSync(configPath)) {
          serverLogger.error(`Fichier de configuration non trouvé: ${configPath}`);
          console.error(`Fichier de configuration non trouvé: ${configPath}`);
          return;
        }
        
        // Lire le contenu du fichier
        const fileContent = fs.readFileSync(configPath, { encoding: 'utf8', flag: 'r' });
        serverLogger.info(`Contenu du fichier config.json: ${fileContent}`);
        console.log(`Contenu du fichier config.json: ${fileContent}`);
        
        // Parser le contenu JSON
        const configFileData = JSON.parse(fileContent);
        
        // Extraire le port de la configuration
        let portFromFile = 3005; // Valeur par défaut
        if (configFileData.domain && configFileData.domain.port !== undefined) {
          const portValue = parseInt(configFileData.domain.port);
          if (!isNaN(portValue) && portValue > 0 && portValue < 65536) {
            portFromFile = portValue;
            serverLogger.info(`Port lu depuis la configuration lors du redémarrage: ${portFromFile}`);
            console.log(`Port lu depuis la configuration lors du redémarrage: ${portFromFile}`);
          } else {
            serverLogger.warn(`Port invalide dans la configuration: ${configFileData.domain.port}, utilisation du port par défaut ${portFromFile}`);
            console.log(`Port invalide dans la configuration: ${configFileData.domain.port}, utilisation du port par défaut ${portFromFile}`);
          }
        } else {
          serverLogger.warn(`Port non défini dans la configuration, utilisation du port par défaut ${portFromFile}`);
          console.log(`Port non défini dans la configuration, utilisation du port par défaut ${portFromFile}`);
        }
        
        // Mettre à jour la configuration globale
        config = configFileData;
        
        // Redémarrer le serveur avec le nouveau port
        server = startServer();
        
        // Exposer la fonction de redémarrage globalement
        global.restartServer = restartServer;
        global.startServer = startServer;
        
      } catch (error) {
        serverLogger.error(`Erreur lors du redémarrage du serveur: ${error.message}`);
        console.error(`Erreur lors du redémarrage du serveur: ${error.message}`);
      }
    });
  } else {
    serverLogger.warn('Aucun serveur en cours d\'exécution à redémarrer');
    console.warn('Aucun serveur en cours d\'exécution à redémarrer');
    server = startServer();
    
    // Exposer la fonction de redémarrage globalement
    global.restartServer = restartServer;
    global.startServer = startServer;
  }
};

// Exposer les fonctions globalement
global.restartServer = global.restartServer || restartServer;
global.startServer = global.startServer || startServer;

// Démarrer le serveur
server = startServer(); 