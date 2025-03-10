const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin, checkSsoConfiguration } = require('../middleware/authMiddleware');

// Toutes les routes d'administration nécessitent d'être authentifié et d'avoir le rôle d'administrateur
router.use(isAuthenticated, isAdmin);

// Ajouter le middleware de vérification des configurations SSO
router.use(checkSsoConfiguration);

// Tableau de bord d'administration
router.get('/', adminController.showAdminDashboard);
router.get('/dashboard', adminController.showAdminDashboard);

// Configuration de l'authentification
router.get('/auth-config', adminController.showAuthConfig);
router.post('/auth-config/:method', adminController.updateAuthConfig);

// Configuration du domaine
router.get('/domain-config', adminController.showDomainConfig);
router.post('/domain-config', adminController.updateDomainConfig);

// Gestion des certificats SSL
router.post('/generate-ssl-cert', adminController.generateSslCert);
router.post('/upload-ssl-cert', adminController.uploadSslCert);
router.post('/upload-ssl-key', adminController.uploadSslKey);

// Redémarrage du serveur
router.post('/restart-server', adminController.restartServer);

// Génération manuelle d'un certificat auto-signé
router.post('/generate-certificate', adminController.generateCertificate);

// Gestion des logs
router.get('/logs', adminController.showLogs);
router.get('/logs/download/:file', adminController.downloadLog);
router.post('/logs/delete/:file', adminController.deleteLog);
router.post('/logs/clear-all', adminController.clearAllLogs);

// Exportation et importation des données
router.get('/export-data', adminController.exportAllData);
router.get('/export-options', adminController.showExportOptions);
router.get('/export-config', adminController.exportConfig);
router.get('/import-data', adminController.showImportData);
router.post('/import-data', adminController.importAllData);
router.post('/import-config', adminController.importConfig);

module.exports = router; 