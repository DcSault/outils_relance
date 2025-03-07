/**
 * Utilitaires pour la gestion des mails
 */

/**
 * Remplace les variables dans un template de mail
 * @param {string} content - Le contenu du template
 * @param {Object} variables - Les variables à remplacer
 * @returns {string} - Le contenu avec les variables remplacées
 */
const replaceTemplateVariables = (content, variables) => {
    let result = content;
    
    // Remplacer chaque variable dans le contenu
    Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{${key}}`, 'g');
        result = result.replace(regex, variables[key]);
    });
    
    return result;
};

/**
 * Génère un lien mailto pour ouvrir Outlook avec un mail pré-rempli
 * @param {string} to - Adresse email du destinataire
 * @param {string} subject - Sujet du mail
 * @param {string} body - Corps du mail
 * @returns {string} - Lien mailto
 */
const generateMailtoLink = (to, subject, body) => {
    // Encoder les paramètres pour le lien mailto en utilisant UTF-8
    // Utilisation de encodeURIComponent qui préserve les caractères UTF-8
    const encodedSubject = encodeURIComponent(subject);
    
    // Pour le corps du message, on remplace les retours à la ligne par %0D%0A (CRLF)
    // qui est le standard pour les liens mailto
    // On supprime également les espaces au début du corps du mail
    const formattedBody = body.trimStart().replace(/\n/g, '\r\n');
    const encodedBody = encodeURIComponent(formattedBody);
    
    // Construire le lien mailto
    return `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
};

/**
 * Prépare un mail à partir d'un template et des données
 * @param {Object} template - Le template de mail
 * @param {Object} data - Les données pour le template
 * @param {string} recipientEmail - L'email du destinataire
 * @returns {Object} - Les informations du mail (lien, sujet, corps)
 */
const prepareMailFromTemplate = (template, data, recipientEmail) => {
    // Préparer les variables pour le template
    const variables = {
        MailUser: data.userName || '',
        Matériel: data.itemName || '',
        DateEmprunt: data.borrowDate ? new Date(data.borrowDate).toLocaleDateString('fr-FR') : '',
        DateRelance: data.reminderDate ? new Date(data.reminderDate).toLocaleDateString('fr-FR') : '',
        Agence: data.agencyName || '',
        ...data.customVariables // Variables personnalisées supplémentaires
    };
    
    // Remplacer les variables dans le sujet et le corps du mail
    const subject = replaceTemplateVariables(template.subject, variables);
    let body = replaceTemplateVariables(template.content, variables);
    
    // Supprimer les espaces au début du mail
    body = body.trimStart();
    
    // Générer le lien mailto
    const mailtoLink = generateMailtoLink(recipientEmail, subject, body);
    
    return {
        mailtoLink,
        subject,
        body,
        recipientEmail
    };
};

module.exports = {
    replaceTemplateVariables,
    generateMailtoLink,
    prepareMailFromTemplate
}; 