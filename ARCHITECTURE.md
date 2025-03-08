# Architecture du Projet Outils Relance

## Vue d'ensemble

Outils Relance est une application web conçue pour la gestion du matériel informatique, des relances et de l'inventaire pour les services informatiques. L'application suit une architecture MVC (Modèle-Vue-Contrôleur) basée sur Node.js et Express.js, avec un stockage de données en JSON.

## Structure du Projet

```
Outils_Relance/
├── app.js                  # Point d'entrée de l'application
├── controllers/            # Logique métier et traitement des requêtes
├── data/                   # Fichiers JSON pour le stockage des données
├── middleware/             # Middleware pour l'authentification et l'autorisation
├── public/                 # Ressources statiques (CSS, JS, images)
├── routes/                 # Définition des routes de l'application
├── utils/                  # Utilitaires et fonctions d'aide
└── views/                  # Templates EJS pour le rendu des pages
```

## Composants Principaux

### 1. Modèle de Données

Le projet utilise des fichiers JSON comme base de données légère. Les principaux modèles de données sont :

- **users.json** : Stocke les informations des utilisateurs (identifiants, rôles, agences)
- **agencies.json** : Contient les informations sur les agences
- **inventory.json** : Stocke les données de l'inventaire du matériel
- **reminders.json** : Gère les relances envoyées aux utilisateurs
- **templates.json** : Contient les modèles d'emails pour les relances
- **roles.json** : Définit les rôles et leurs permissions

### 2. Contrôleurs

Les contrôleurs gèrent la logique métier et le traitement des requêtes :

- **userController.js** : Gestion des utilisateurs et des rôles
- **agencyController.js** : Gestion des agences
- **inventoryController.js** : Gestion de l'inventaire du matériel
- **reminderController.js** : Gestion des relances et des emails
- **authController.js** : Gestion de l'authentification

### 3. Vues

Les vues sont construites avec EJS (Embedded JavaScript) et organisées par fonctionnalité :

- **views/users/** : Pages liées à la gestion des utilisateurs
- **views/agencies/** : Pages liées à la gestion des agences
- **views/inventory/** : Pages liées à la gestion de l'inventaire
- **views/reminders/** : Pages liées à la gestion des relances
- **views/partials/** : Composants réutilisables (header, footer, etc.)

### 4. Routes

Les routes définissent les points d'entrée de l'API et sont organisées par domaine fonctionnel :

- **userRoutes.js** : Routes pour la gestion des utilisateurs
- **agencyRoutes.js** : Routes pour la gestion des agences
- **inventoryRoutes.js** : Routes pour la gestion de l'inventaire
- **reminderRoutes.js** : Routes pour la gestion des relances
- **authRoutes.js** : Routes pour l'authentification

### 5. Middleware

Les middleware assurent diverses fonctions transversales :

- **authMiddleware.js** : Gestion de l'authentification et des autorisations
- **sessionMiddleware.js** : Gestion des sessions utilisateur
- **errorMiddleware.js** : Gestion des erreurs

## Flux de Données

1. **Authentification** :
   - L'utilisateur se connecte via le formulaire de login
   - Le contrôleur d'authentification vérifie les identifiants
   - Une session est créée pour l'utilisateur authentifié

2. **Gestion de l'Inventaire** :
   - Les utilisateurs peuvent consulter, ajouter, modifier et supprimer des éléments
   - Le contrôleur d'inventaire gère les opérations CRUD sur les données
   - Les éléments peuvent être prêtés, attribués ou marqués comme en réparation

3. **Système de Relances** :
   - Les techniciens créent des relances pour les utilisateurs ayant emprunté du matériel
   - Les relances utilisent des modèles d'emails personnalisables
   - Les emails sont préparés et peuvent être envoyés via Outlook

4. **Gestion des Droits** :
   - Trois rôles principaux : Administrateur, Technicien DSI, Utilisateur
   - Les permissions sont définies par rôle et peuvent être personnalisées
   - Le middleware d'authentification vérifie les permissions pour chaque action

## Choix Techniques

### Backend
- **Node.js** : Environnement d'exécution JavaScript côté serveur
- **Express.js** : Framework web pour Node.js
- **EJS** : Moteur de templates pour le rendu des vues
- **JSON** : Format de stockage des données (alternative légère à une base de données)

### Frontend
- **Bootstrap 5** : Framework CSS pour l'interface utilisateur
- **Font Awesome** : Bibliothèque d'icônes
- **JavaScript** : Interactivité côté client
- **CSS personnalisé** : Styles spécifiques à l'application

### Sécurité
- **express-session** : Gestion des sessions utilisateur
- **Middleware d'authentification** : Contrôle d'accès basé sur les rôles
- **Validation des entrées** : Vérification des données soumises par les utilisateurs

## Particularités Architecturales

### Stockage JSON
L'application utilise des fichiers JSON comme alternative légère à une base de données relationnelle. Cette approche a été choisie pour :
- Simplicité de déploiement (pas de SGBD à installer)
- Facilité de sauvegarde et de restauration
- Adéquation avec les besoins de l'application (volume de données modéré)

### Gestion des Rôles et Permissions
Le système de gestion des droits est flexible et permet :
- La définition de rôles système (Admin, Technicien, Utilisateur)
- La création de rôles personnalisés avec des permissions spécifiques
- L'attribution granulaire de permissions par fonctionnalité

### Historique des Actions
L'application maintient un historique détaillé des actions :
- Suivi des modifications sur les éléments d'inventaire
- Historique des prêts et retours de matériel
- Suivi des réparations et interventions

## Évolutivité et Maintenance

### Points d'extension
- **Nouveaux modules** : Ajout facile de nouvelles fonctionnalités via de nouveaux contrôleurs et routes
- **Personnalisation des templates** : Modification des modèles d'emails sans toucher au code
- **Rôles personnalisés** : Création de nouveaux rôles avec des permissions spécifiques

### Considérations pour le futur
- Migration vers une base de données relationnelle pour de grands volumes de données
- Implémentation d'une API REST complète pour l'intégration avec d'autres systèmes
- Ajout de fonctionnalités de reporting et d'analyse 