const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configuration du moteur de template EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour parser les requêtes
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configuration des fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Configuration de la session
app.use(session({
  secret: 'outils_relance_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 heures
}));

// Middleware pour vérifier si les dossiers de données existent
const dataDir = path.join(__dirname, 'data');
const requiredDataFiles = ['users.json', 'agencies.json', 'inventory.json', 'templates.json', 'reminders.json', 'notifications.json'];

// Création du dossier data s'il n'existe pas
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Création des fichiers JSON s'ils n'existent pas
requiredDataFiles.forEach(file => {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) {
    const defaultData = file === 'users.json' ? { users: [] } :
                       file === 'agencies.json' ? { agencies: [] } :
                       file === 'inventory.json' ? { items: [] } :
                       file === 'templates.json' ? { templates: [] } :
                       file === 'reminders.json' ? { reminders: [] } :
                       file === 'notifications.json' ? { notifications: [] } : {};
    
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    console.log(`Fichier ${file} créé avec succès.`);
  }
});

// Middleware pour rendre les messages de session disponibles dans les vues
app.use((req, res, next) => {
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  req.session.success = null;
  req.session.error = null;
  next();
});

// Importation des routes
const agencyRoutes = require('./routes/agencyRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const templateRoutes = require('./routes/templateRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

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

// Routes
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'Outils de Gestion DSI',
    user: req.session.user || null
  });
});

// Route d'authentification
app.post('/login', (req, res) => {
  const { username } = req.body;
  
  if (!username || username.trim() === '') {
    return res.status(400).send('Nom d\'utilisateur requis');
  }
  
  // Lecture du fichier users.json
  const usersPath = path.join(dataDir, 'users.json');
  const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  
  // Lecture du fichier agencies.json pour obtenir l'ID de l'agence Services Informatique
  const agenciesPath = path.join(dataDir, 'agencies.json');
  const agenciesData = JSON.parse(fs.readFileSync(agenciesPath, 'utf8'));
  
  // Recherche de l'agence Services Informatique
  const itServiceAgency = agenciesData.agencies.find(a => a.name === 'Services Informatique');
  const itServiceAgencyId = itServiceAgency ? itServiceAgency.id : null;
  
  // Recherche de l'utilisateur
  let user = usersData.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  // Si l'utilisateur n'existe pas, on le crée
  if (!user) {
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
  
  res.redirect('/dashboard');
});

// Route de déconnexion
app.get('/logout', (req, res) => {
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

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
}); 