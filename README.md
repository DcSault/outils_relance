# Outils DSI - Gestion de Matériel et Relances

Application web pour la gestion du matériel informatique, des relances et de l'inventaire, destinée aux DSI travaillant avec plusieurs agences.

## 📋 Présentation

**Outils DSI** est une application permettant aux services informatiques de :
- Gérer l'inventaire du matériel informatique
- Suivre les prêts de matériel
- Envoyer des relances automatisées
- Gérer les agences et les utilisateurs
- Centraliser le suivi SAV

Développée en Node.js, l'application utilise un stockage léger en fichiers JSON sans nécessiter de base de données complexe.

## 🛠️ Technologies utilisées

- **Backend**: Node.js, Express
- **Frontend**: HTML, CSS, JavaScript, Bootstrap 5
- **Stockage**: Fichiers JSON
- **Templating**: EJS

## 🚀 Installation

### Prérequis

- Node.js (v14 ou supérieur)
- npm (v6 ou supérieur)

### Installation

1. Clonez le dépôt :
```
git clone [URL_DU_REPOS]
cd Outils_Relance
```

2. Installez les dépendances :
```
npm install
```

3. Lancez l'application :
```
npm start
```

4. Accédez à l'application via votre navigateur à l'adresse :
```
http://localhost:3000
```

## 👤 Utilisateurs et Rôles

L'application gère trois types d'utilisateurs :

1. **Administrateur** : Accès complet à toutes les fonctionnalités
2. **Technicien DSI** : Gestion du matériel, des relances et des templates
3. **Utilisateur (Employé)** : Ne peut pas se connecter à l'application (utilisé uniquement comme référence)

Les techniciens sont automatiquement associés à l'agence "Services Informatique" s'ils n'ont pas d'agence spécifiée.

## 📱 Fonctionnalités principales

### Authentification simplifiée
- Connexion par simple saisie du nom d'utilisateur
- Création automatique du compte à la première connexion (rôle technicien par défaut)

### Gestion des agences
- Création, modification et suppression d'agences
- Association utilisateurs/agences

### Gestion de l'inventaire
- Ajout, modification et suppression de matériel
- Suivi des emprunts et retours
- États possibles: disponible, prêté, en SAV, introuvable

### Système de templates de mail
- Création et modification de templates personnalisables
- Support de variables: {MailUser}, {Matériel}, {DateRelance}, etc.
- Interface d'édition simple

### Système de relances
- Calendrier des relances programmées
- Envoi de mails via Outlook
- Confirmation d'envoi pour le suivi

### Tableau de bord
- Vue d'ensemble du matériel
- Statistiques d'utilisation
- Accès rapide aux fonctionnalités principales

## 📁 Structure du projet

```
Outils_Relance/
├── app.js                   # Point d'entrée de l'application
├── package.json             # Dépendances du projet
├── controllers/             # Logique métier
├── data/                    # Stockage des données JSON
├── middleware/              # Middleware d'authentification et autorisation
├── models/                  # Fonctions d'accès aux données
├── public/                  # Fichiers statiques (CSS, JS, images)
├── routes/                  # Définition des routes
├── utils/                   # Utilitaires (mailUtils, etc.)
└── views/                   # Templates EJS
    ├── agencies/            # Vues pour la gestion des agences
    ├── inventory/           # Vues pour la gestion de l'inventaire
    ├── partials/            # Éléments réutilisables (header, footer)
    ├── reminders/           # Vues pour la gestion des relances
    ├── templates/           # Vues pour la gestion des templates
    └── users/               # Vues pour la gestion des utilisateurs
```

## 📧 Envoi de mails

L'application permet d'envoyer des mails de relance via Outlook:

1. Sélectionnez une relance en attente
2. Cliquez sur l'icône "Envoyer un mail"
3. Prévisualisez le mail avec les variables remplacées
4. Cliquez sur "Ouvrir dans Outlook" pour créer le mail
5. Confirmez l'envoi pour marquer la relance comme traitée

## 🔒 Gestion des droits

- Les **techniciens** peuvent gérer le matériel et les relances
- Les **administrateurs** ont accès à toutes les fonctionnalités
- Les fonctionnalités sensibles (suppression, etc.) sont réservées aux administrateurs

## 🛠️ Personnalisation

Vous pouvez personnaliser l'application en modifiant:
- Les templates de mail dans l'interface
- Les styles CSS dans le dossier `public/css`
- Les fonctionnalités JavaScript dans le dossier `public/js`

## 📝 Remarques

- L'application utilise un stockage en fichiers JSON, ce qui la rend légère mais peut limiter les performances avec de grands volumes de données
- Les mails sont ouverts dans Outlook mais ne sont pas envoyés automatiquement
- L'authentification est simplifiée et ne comporte pas de mot de passe

## 📄 Licence

Ce projet est distribué sous licence [Licence]. 