# Outils DSI

Application de gestion du matériel informatique, des relances et de l'inventaire pour les DSI.

## Fonctionnalités

- **Gestion d'inventaire** : Suivez tout votre matériel informatique
- **Gestion des agences** : Organisez votre inventaire par agence
- **Système de relances** : Gérez les relances pour le matériel emprunté
- **Gestion des utilisateurs** : Administration des techniciens et administrateurs
- **Templates personnalisables** : Créez des modèles pour vos communications
- **Authentification multiple** : Connexion locale ou via des services externes (Discord, GitHub, Azure, Okta)
- **Configuration SSL** : Support HTTPS avec certificats auto-signés ou Let's Encrypt
- **Exportation/Importation** : Sauvegarde et restauration des données avec chiffrement

## Prérequis

- Node.js 18 ou supérieur
- npm ou yarn
- Accès réseau pour les services d'authentification externes (optionnel)

## Installation

### Installation manuelle

1. Clonez le dépôt :
   ```bash
   git clone https://github.com/DcSault/outils_relance.git
   cd outils_relance
   ```

2. Installez les dépendances :
   ```bash
   npm install
   ```

3. Créez les répertoires nécessaires :
   ```bash
   mkdir -p data ssl logs temp
   ```

4. Démarrez l'application :
   ```bash
   npm start
   ```

5. Accédez à l'application dans votre navigateur :
   ```
   http://localhost:3005
   ```

### Installation avec Docker

1. Clonez le dépôt :
   ```bash
   git clone https://github.com/DcSault/outils_relance.git
   cd outils_relance
   ```

2. Lancez l'application avec Docker Compose :
   ```bash
   docker-compose up -d
   ```

3. Accédez à l'application dans votre navigateur :
   ```
   http://localhost:3005
   ```

## Configuration

### Configuration de l'authentification

L'application supporte plusieurs méthodes d'authentification :

- **Locale** : Authentification par nom d'utilisateur uniquement
- **Discord** : Connexion via Discord OAuth2
- **GitHub** : Connexion via GitHub OAuth2
- **Azure** : Connexion via Microsoft Azure AD
- **Okta** : Connexion via Okta

Pour configurer ces méthodes, connectez-vous en tant qu'administrateur et accédez à :
```
Administration > Configuration de l'authentification
```

### Configuration du domaine et SSL

Pour configurer le domaine et le SSL :

1. Connectez-vous en tant qu'administrateur
2. Accédez à `Administration > Configuration du domaine`
3. Choisissez les options appropriées :
   - Mode d'accès : localhost ou domaine personnalisé
   - Mode de sécurité : aucun, certificat auto-signé, certificat manuel ou Let's Encrypt

## Sauvegarde et restauration

### Exportation des données

1. Connectez-vous en tant qu'administrateur
2. Accédez à `Administration > Options d'exportation`
3. Choisissez entre :
   - Exporter les données (avec ou sans chiffrement)
   - Exporter la configuration (toujours chiffrée)

### Importation des données

1. Connectez-vous en tant qu'administrateur
2. Accédez à `Administration > Importer des données`
3. Sélectionnez l'onglet approprié :
   - Importer des données
   - Importer la configuration
4. Sélectionnez le fichier et entrez le mot de passe si nécessaire

## Structure des fichiers

- `app.js` : Point d'entrée de l'application
- `controllers/` : Logique métier de l'application
- `routes/` : Définition des routes de l'API
- `views/` : Templates EJS pour le rendu des pages
- `public/` : Fichiers statiques (CSS, JavaScript, images)
- `data/` : Stockage des données JSON
- `ssl/` : Certificats SSL
- `logs/` : Journaux de l'application
- `middleware/` : Middleware Express

## Développement

### Scripts disponibles

- `npm start` : Démarre l'application
- `npm run dev` : Démarre l'application en mode développement avec nodemon

## Déploiement en production

Pour un déploiement en production, nous recommandons :

1. Utiliser Docker avec notre fichier `docker-compose.yml`
2. Configurer un nom de domaine personnalisé
3. Activer HTTPS avec Let's Encrypt ou un certificat valide
4. Mettre en place des sauvegardes régulières des données

## Licence

Ce projet est sous licence [MIT](LICENSE).

## Contact

Pour toute question ou suggestion, veuillez contacter l'équipe de développement. 