/**
 * Gestion des notifications pour l'application Outils DSI
 */

document.addEventListener('DOMContentLoaded', function() {
    // Éléments du DOM
    const notificationBadge = document.querySelector('.notification-badge');
    const notificationsList = document.getElementById('notificationsList');
    const markAllAsReadBtn = document.getElementById('markAllAsRead');
    const notificationsButton = document.getElementById('notificationsButton');
    
    // Intervalle de rafraîchissement des notifications (en millisecondes)
    const refreshInterval = 15000; // 15 secondes au lieu de 60 secondes
    
    // Fonction pour charger les notifications non lues
    function loadNotifications() {
        fetch('/notifications/unread', {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            credentials: 'same-origin'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erreur réseau: ' + response.status);
                }
                return response.json();
            })
            .then(notifications => {
                // Mettre à jour le badge
                if (notifications.length > 0) {
                    notificationBadge.textContent = notifications.length;
                    notificationBadge.style.display = 'inline-block';
                    notificationBadge.classList.add('has-notifications');
                } else {
                    notificationBadge.style.display = 'none';
                    notificationBadge.classList.remove('has-notifications');
                }
                
                // Mettre à jour la liste des notifications
                updateNotificationsList(notifications);
            })
            .catch(error => {
                console.error('Erreur lors du chargement des notifications:', error);
                notificationsList.innerHTML = `
                    <div class="text-center p-3 text-danger">
                        <i class="fas fa-exclamation-circle mb-2"></i>
                        <p class="mb-0">Erreur lors du chargement des notifications.</p>
                    </div>
                `;
            });
    }
    
    // Fonction pour mettre à jour la liste des notifications
    function updateNotificationsList(notifications) {
        if (notifications.length === 0) {
            notificationsList.innerHTML = `
                <div class="text-center p-3 text-muted">
                    <i class="fas fa-check-circle mb-2"></i>
                    <p class="mb-0">Aucune notification non lue.</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        notifications.forEach(notification => {
            let iconClass = 'fas fa-info-circle text-info';
            let bgClass = 'bg-light';
            
            // Définir l'icône et la couleur en fonction du type et du niveau
            if (notification.type === 'reminder_needed') {
                if (notification.reminderLevel === 'urgent') {
                    iconClass = 'fas fa-exclamation-triangle text-danger';
                    bgClass = 'bg-danger bg-opacity-10';
                } else if (notification.reminderLevel === 'second') {
                    iconClass = 'fas fa-exclamation-circle text-warning';
                    bgClass = 'bg-warning bg-opacity-10';
                } else {
                    iconClass = 'fas fa-info-circle text-info';
                    bgClass = 'bg-info bg-opacity-10';
                }
            }
            
            // Formater la date
            const date = new Date(notification.createdAt);
            const formattedDate = date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            html += `
                <div class="notification-item p-2 border-bottom ${bgClass}" data-id="${notification.id}">
                    <div class="d-flex">
                        <div class="me-2">
                            <i class="${iconClass} fa-lg"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <p class="mb-1"><strong>${notification.message}</strong></p>
                                <button type="button" class="btn btn-sm text-danger delete-notification" data-id="${notification.id}">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                            <div class="d-flex justify-content-between align-items-center">
                                <small class="text-muted">${formattedDate}</small>
                                <div>
                                    ${notification.type === 'reminder_needed' ? `
                                        <a href="/reminders/from-item/${notification.itemId}" class="btn btn-sm btn-warning">
                                            <i class="fas fa-bell me-1"></i>Créer une relance
                                        </a>
                                    ` : ''}
                                    <button type="button" class="btn btn-sm btn-outline-secondary mark-as-read" data-id="${notification.id}">
                                        <i class="fas fa-check me-1"></i>Lu
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        notificationsList.innerHTML = html;
        
        // Ajouter les écouteurs d'événements pour les boutons
        attachEventListeners();
    }
    
    // Fonction pour attacher les écouteurs d'événements aux boutons
    function attachEventListeners() {
        // Boutons "Marquer comme lu"
        document.querySelectorAll('.mark-as-read').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const notificationId = this.getAttribute('data-id');
                markAsRead(notificationId);
            });
        });
        
        // Boutons de suppression
        document.querySelectorAll('.delete-notification').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const notificationId = this.getAttribute('data-id');
                deleteNotification(notificationId);
            });
        });
    }
    
    // Fonction pour marquer une notification comme lue
    function markAsRead(id) {
        // Afficher un indicateur visuel immédiat
        const notificationItem = document.querySelector(`.notification-item[data-id="${id}"]`);
        if (notificationItem) {
            notificationItem.style.opacity = '0.5';
        }
        
        fetch(`/notifications/mark-as-read/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur réseau: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Recharger les notifications
                loadNotifications();
            } else {
                console.error('Erreur lors du marquage de la notification comme lue:', data.error);
                // Restaurer l'opacité en cas d'erreur
                if (notificationItem) {
                    notificationItem.style.opacity = '1';
                }
            }
        })
        .catch(error => {
            console.error('Erreur lors du marquage de la notification comme lue:', error);
            // Restaurer l'opacité en cas d'erreur
            if (notificationItem) {
                notificationItem.style.opacity = '1';
            }
        });
    }
    
    // Fonction pour supprimer une notification
    function deleteNotification(id) {
        // Afficher un indicateur visuel immédiat
        const notificationItem = document.querySelector(`.notification-item[data-id="${id}"]`);
        if (notificationItem) {
            notificationItem.style.opacity = '0.5';
        }
        
        fetch(`/notifications/delete/${id}`, {
            method: 'DELETE',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur réseau: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Recharger les notifications
                loadNotifications();
            } else {
                console.error('Erreur lors de la suppression de la notification:', data.error);
                // Restaurer l'opacité en cas d'erreur
                if (notificationItem) {
                    notificationItem.style.opacity = '1';
                }
            }
        })
        .catch(error => {
            console.error('Erreur lors de la suppression de la notification:', error);
            // Restaurer l'opacité en cas d'erreur
            if (notificationItem) {
                notificationItem.style.opacity = '1';
            }
        });
    }
    
    // Fonction pour marquer toutes les notifications comme lues
    function markAllAsRead() {
        // Afficher un indicateur visuel immédiat
        const notificationItems = document.querySelectorAll('.notification-item');
        notificationItems.forEach(item => {
            item.style.opacity = '0.5';
        });
        
        fetch('/notifications/mark-all-as-read', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erreur réseau: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Recharger les notifications
                loadNotifications();
            } else {
                console.error('Erreur lors du marquage de toutes les notifications comme lues:', data.error);
                // Restaurer l'opacité en cas d'erreur
                notificationItems.forEach(item => {
                    item.style.opacity = '1';
                });
            }
        })
        .catch(error => {
            console.error('Erreur lors du marquage de toutes les notifications comme lues:', error);
            // Restaurer l'opacité en cas d'erreur
            notificationItems.forEach(item => {
                item.style.opacity = '1';
            });
        });
    }
    
    // Ajouter l'écouteur d'événement pour le bouton "Tout marquer comme lu"
    if (markAllAsReadBtn) {
        markAllAsReadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            markAllAsRead();
        });
    }
    
    // Ajouter un écouteur d'événement pour le bouton de notifications
    if (notificationsButton) {
        notificationsButton.addEventListener('click', function() {
            // Charger les notifications à chaque ouverture du menu
            loadNotifications();
        });
    }
    
    // Charger les notifications au chargement de la page
    if (notificationsList) {
        loadNotifications();
        
        // Rafraîchir les notifications à intervalles réguliers
        setInterval(loadNotifications, refreshInterval);
    }
}); 