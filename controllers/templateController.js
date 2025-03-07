const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Chemin vers le fichier de données des templates
const templatesFilePath = path.join(__dirname, '../data/templates.json');

// Fonction utilitaire pour lire les données des templates
const getTemplatesData = () => {
    try {
        const data = fs.readFileSync(templatesFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors de la lecture du fichier templates.json:', error);
        return { templates: [] };
    }
};

// Fonction utilitaire pour écrire les données des templates
const saveTemplatesData = (data) => {
    try {
        fs.writeFileSync(templatesFilePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'écriture du fichier templates.json:', error);
        return false;
    }
};

// Contrôleur pour les templates
const templateController = {
    // Afficher tous les templates
    getAllTemplates: (req, res) => {
        const templatesData = getTemplatesData();
        
        res.render('templates/index', {
            title: 'Gestion des Templates',
            templates: templatesData.templates,
            user: req.session.user
        });
    },
    
    // Afficher le formulaire de création d'un template
    showCreateForm: (req, res) => {
        res.render('templates/create', {
            title: 'Créer un Template',
            user: req.session.user
        });
    },
    
    // Créer un nouveau template
    createTemplate: (req, res) => {
        const { name, subject, content, variables } = req.body;
        
        // Validation de base
        if (!name || name.trim() === '' || !subject || subject.trim() === '' || !content || content.trim() === '') {
            return res.render('templates/create', {
                title: 'Créer un Template',
                error: 'Le nom, le sujet et le contenu du template sont requis',
                formData: req.body,
                user: req.session.user
            });
        }
        
        // Création du nouveau template
        const newTemplate = {
            id: uuidv4(),
            name: name.trim(),
            subject: subject.trim(),
            content: content.trimStart().trim(),
            variables: variables ? variables.split(',').map(v => v.trim()).filter(v => v) : [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Ajout du template à la liste
        const templatesData = getTemplatesData();
        templatesData.templates.push(newTemplate);
        
        // Sauvegarde des données
        if (!saveTemplatesData(templatesData)) {
            return res.render('templates/create', {
                title: 'Créer un Template',
                error: 'Erreur lors de la sauvegarde du template',
                formData: req.body,
                user: req.session.user
            });
        }
        
        // Redirection avec message de succès
        req.session.success = 'Template créé avec succès';
        res.redirect('/templates');
    },
    
    // Afficher le formulaire de modification d'un template
    showEditForm: (req, res) => {
        const { id } = req.params;
        const templatesData = getTemplatesData();
        const template = templatesData.templates.find(t => t.id === id);
        
        if (!template) {
            req.session.error = 'Template non trouvé';
            return res.redirect('/templates');
        }
        
        res.render('templates/edit', {
            title: 'Modifier le Template',
            template,
            user: req.session.user
        });
    },
    
    // Mettre à jour un template
    updateTemplate: (req, res) => {
        const { id } = req.params;
        const { name, subject, content, variables } = req.body;
        
        // Validation de base
        if (!name || name.trim() === '' || !subject || subject.trim() === '' || !content || content.trim() === '') {
            req.session.error = 'Le nom, le sujet et le contenu du template sont requis';
            return res.redirect(`/templates/edit/${id}`);
        }
        
        // Récupération des données
        const templatesData = getTemplatesData();
        const templateIndex = templatesData.templates.findIndex(t => t.id === id);
        
        if (templateIndex === -1) {
            req.session.error = 'Template non trouvé';
            return res.redirect('/templates');
        }
        
        // Mise à jour du template
        templatesData.templates[templateIndex] = {
            ...templatesData.templates[templateIndex],
            name: name.trim(),
            subject: subject.trim(),
            content: content.trimStart().trim(),
            variables: variables ? variables.split(',').map(v => v.trim()).filter(v => v) : [],
            updatedAt: new Date().toISOString()
        };
        
        // Sauvegarde des données
        if (!saveTemplatesData(templatesData)) {
            req.session.error = 'Erreur lors de la sauvegarde du template';
            return res.redirect(`/templates/edit/${id}`);
        }
        
        // Redirection avec message de succès
        req.session.success = 'Template mis à jour avec succès';
        res.redirect('/templates');
    },
    
    // Supprimer un template
    deleteTemplate: (req, res) => {
        const { id } = req.params;
        
        // Récupération des données
        const templatesData = getTemplatesData();
        const templateIndex = templatesData.templates.findIndex(t => t.id === id);
        
        if (templateIndex === -1) {
            req.session.error = 'Template non trouvé';
            return res.redirect('/templates');
        }
        
        // Suppression du template
        templatesData.templates.splice(templateIndex, 1);
        
        // Sauvegarde des données
        if (!saveTemplatesData(templatesData)) {
            req.session.error = 'Erreur lors de la suppression du template';
            return res.redirect('/templates');
        }
        
        // Redirection avec message de succès
        req.session.success = 'Template supprimé avec succès';
        res.redirect('/templates');
    },
    
    // Afficher les détails d'un template
    showTemplateDetails: (req, res) => {
        const { id } = req.params;
        const templatesData = getTemplatesData();
        const template = templatesData.templates.find(t => t.id === id);
        
        if (!template) {
            req.session.error = 'Template non trouvé';
            return res.redirect('/templates');
        }
        
        res.render('templates/details', {
            title: 'Détails du Template',
            template,
            user: req.session.user
        });
    }
};

module.exports = templateController; 