# Guide d'Utilisation - Outils DSI

Ce guide détaille les principales fonctionnalités de l'application Outils DSI et explique comment les utiliser.

## Sommaire

1. [Connexion et Authentification](#connexion-et-authentification)
2. [Tableau de Bord](#tableau-de-bord)
3. [Gestion de l'Inventaire](#gestion-de-linventaire)
4. [Gestion des Relances](#gestion-des-relances)
5. [Templates de Mail](#templates-de-mail)
6. [Gestion des Agences](#gestion-des-agences)
7. [Gestion des Utilisateurs](#gestion-des-utilisateurs)

## Connexion et Authentification

### Première connexion

1. Accédez à la page d'accueil à l'adresse `http://localhost:3000`
2. Entrez votre nom d'utilisateur dans le champ de connexion
3. Cliquez sur "Se connecter"
4. Un compte technicien DSI sera créé automatiquement

### Remarques importantes

- Les utilisateurs avec le rôle "Utilisateur (Employé)" ne peuvent pas se connecter à l'application
- Les techniciens DSI sont automatiquement associés à l'agence "Services Informatique"
- Seuls les administrateurs peuvent créer des comptes administrateur

## Tableau de Bord

Le tableau de bord propose une vue d'ensemble de l'application :

- Statistiques du matériel (disponible, emprunté, assigné)
- Accès rapide aux différentes fonctionnalités
- Pour les techniciens : statistiques des relances en attente et des agences
- Pour les administrateurs : statistiques des utilisateurs

## Gestion de l'Inventaire

### Consulter l'inventaire

1. Cliquez sur "Inventaire" dans le menu principal
2. Utilisez la barre de recherche pour filtrer les éléments
3. Cliquez sur un élément pour voir ses détails

### Ajouter un nouvel élément

1. Depuis la page d'inventaire, cliquez sur "Ajouter un élément"
2. Remplissez le formulaire avec les informations de l'élément
3. Cliquez sur "Enregistrer"

### Prêter du matériel

1. Depuis la page de détails d'un élément, cliquez sur "Prêter"
2. Sélectionnez l'utilisateur qui emprunte le matériel
3. Définissez la date prévue de retour
4. Cliquez sur "Confirmer"

### Marquer un retour

1. Depuis la page de détails d'un élément prêté, cliquez sur "Marquer comme retourné"
2. Confirmez l'action

## Gestion des Relances

### Voir les relances

1. Cliquez sur "Relances" dans le menu principal
2. Consultez la liste des relances planifiées
3. Utilisez la vue calendrier pour une visualisation temporelle

### Créer une relance

1. Depuis la page des relances, cliquez sur "Nouvelle Relance"
2. Sélectionnez le matériel concerné
3. Sélectionnez l'utilisateur destinataire
4. Choisissez un template de mail
5. Définissez la date de relance
6. Cliquez sur "Créer la relance"

### Envoyer un mail de relance

1. Depuis la liste des relances, cliquez sur l'icône d'enveloppe
2. Vérifiez l'aperçu du mail
3. Cliquez sur "Ouvrir dans Outlook"
4. Outlook s'ouvre avec le mail pré-rempli
5. Envoyez le mail depuis Outlook
6. Revenez dans l'application et cliquez sur "Confirmer l'envoi"

## Templates de Mail

### Créer un template

1. Cliquez sur "Templates" dans le menu principal
2. Cliquez sur "Nouveau Template"
3. Donnez un nom et un objet au template
4. Rédigez le contenu du mail
5. Utilisez les variables disponibles en cliquant dessus pour les insérer
6. Ajoutez des variables personnalisées si nécessaire
7. Cliquez sur "Créer le template"

### Variables disponibles

- `{MailUser}` : Nom de l'utilisateur destinataire
- `{Matériel}` : Nom de l'équipement concerné
- `{DateEmprunt}` : Date à laquelle le matériel a été emprunté
- `{DateRelance}` : Date de la relance
- `{Agence}` : Nom de l'agence de l'utilisateur

## Gestion des Agences

### Ajouter une agence

1. Cliquez sur "Agences" dans le menu principal
2. Cliquez sur "Nouvelle Agence"
3. Remplissez le formulaire avec les informations de l'agence
4. Cliquez sur "Enregistrer"

### Associer un utilisateur à une agence

1. Depuis la page de détails d'une agence, cliquez sur "Ajouter un utilisateur"
2. Sélectionnez l'utilisateur à associer
3. Cliquez sur "Associer"

## Gestion des Utilisateurs

*Note : Cette section est principalement destinée aux administrateurs.*

### Créer un utilisateur

1. Cliquez sur "Utilisateurs" dans le menu principal
2. Cliquez sur "Nouvel Utilisateur"
3. Remplissez le formulaire avec les informations de l'utilisateur
4. Sélectionnez le rôle approprié
5. Associez l'utilisateur à une agence si nécessaire
6. Cliquez sur "Enregistrer"

### Modifier un utilisateur

1. Depuis la liste des utilisateurs, cliquez sur l'icône d'édition
2. Modifiez les informations de l'utilisateur
3. Cliquez sur "Enregistrer les modifications"

### Supprimer un utilisateur

1. Depuis la page d'édition d'un utilisateur, cliquez sur "Supprimer l'utilisateur"
2. Confirmez la suppression

## Conseils et astuces

- **Filtrage** : Utilisez la barre de recherche présente dans la plupart des listes pour filtrer rapidement les éléments
- **Relances groupées** : Utilisez la vue calendrier pour identifier les relances à traiter en même temps
- **Personnalisation des templates** : Créez des templates spécifiques pour chaque type de matériel ou situation
- **Statistiques** : Consultez régulièrement le tableau de bord pour suivre l'état global du matériel 