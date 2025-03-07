/**
 * Fichier JavaScript principal pour l'application Outils DSI
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialisation des tooltips Bootstrap
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialisation des popovers Bootstrap
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Fermeture automatique des alertes après 5 secondes
    setTimeout(function() {
        var alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
        alerts.forEach(function(alert) {
            var bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        });
    }, 5000);

    // Gestion des confirmations de suppression
    document.querySelectorAll('.confirm-delete').forEach(function(button) {
        button.addEventListener('click', function(e) {
            if (!confirm('Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible.')) {
                e.preventDefault();
            }
        });
    });

    // Gestion des filtres de tableau
    const tableFilter = document.getElementById('tableFilter');
    if (tableFilter) {
        tableFilter.addEventListener('keyup', function() {
            const searchText = this.value.toLowerCase();
            const tableRows = document.querySelectorAll('.filterable-table tbody tr');
            
            tableRows.forEach(function(row) {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchText) ? '' : 'none';
            });
        });
    }

    // Gestion des sélecteurs de tags
    const tagContainers = document.querySelectorAll('.tag-container');
    tagContainers.forEach(function(container) {
        const input = container.querySelector('.tag-input');
        const tagList = container.querySelector('.tag-list');
        const hiddenInput = container.querySelector('.tag-hidden-input');
        
        if (input && tagList && hiddenInput) {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const tagText = this.value.trim();
                    if (tagText) {
                        addTag(tagText, tagList, hiddenInput);
                        this.value = '';
                    }
                }
            });
            
            // Initialiser les tags existants
            if (hiddenInput.value) {
                const tags = hiddenInput.value.split(',');
                tags.forEach(function(tag) {
                    if (tag.trim()) {
                        addTag(tag.trim(), tagList, hiddenInput);
                    }
                });
            }
        }
    });

    // Fonction pour ajouter un tag
    function addTag(text, tagList, hiddenInput) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = text;
        
        const removeBtn = document.createElement('i');
        removeBtn.className = 'fas fa-times ms-1';
        removeBtn.style.cursor = 'pointer';
        removeBtn.addEventListener('click', function() {
            tag.remove();
            updateHiddenInput(tagList, hiddenInput);
        });
        
        tag.appendChild(removeBtn);
        tagList.appendChild(tag);
        updateHiddenInput(tagList, hiddenInput);
    }

    // Fonction pour mettre à jour l'input caché avec les tags
    function updateHiddenInput(tagList, hiddenInput) {
        const tags = [];
        tagList.querySelectorAll('.tag').forEach(function(tag) {
            tags.push(tag.textContent.replace('×', '').trim());
        });
        hiddenInput.value = tags.join(',');
    }

    // Gestion de l'éditeur de template simple
    const templateEditor = document.getElementById('templateEditor');
    if (templateEditor) {
        const previewBtn = document.getElementById('previewTemplate');
        const previewContainer = document.getElementById('templatePreview');
        
        if (previewBtn && previewContainer) {
            previewBtn.addEventListener('click', function() {
                previewContainer.innerHTML = templateEditor.value;
            });
        }
        
        // Insertion des variables dans le template
        const variableButtons = document.querySelectorAll('.template-variable');
        variableButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                const variable = this.dataset.variable;
                insertAtCursor(templateEditor, variable);
            });
        });
    }

    // Fonction pour insérer du texte à la position du curseur
    function insertAtCursor(field, text) {
        if (field.selectionStart || field.selectionStart === 0) {
            const startPos = field.selectionStart;
            const endPos = field.selectionEnd;
            field.value = field.value.substring(0, startPos) + text + field.value.substring(endPos, field.value.length);
            field.selectionStart = startPos + text.length;
            field.selectionEnd = startPos + text.length;
        } else {
            field.value += text;
        }
        field.focus();
    }

    // Gestion du calendrier des relances
    const calendarContainer = document.getElementById('reminderCalendar');
    if (calendarContainer) {
        // Ici, vous pourriez initialiser un calendrier JavaScript
        // comme FullCalendar ou créer votre propre implémentation
        console.log('Calendrier des relances initialisé');
    }

    // Gestion des formulaires dynamiques
    const addFieldButton = document.getElementById('addCustomField');
    const customFieldsContainer = document.getElementById('customFields');
    
    if (addFieldButton && customFieldsContainer) {
        let fieldCount = customFieldsContainer.querySelectorAll('.custom-field').length;
        
        addFieldButton.addEventListener('click', function() {
            const fieldRow = document.createElement('div');
            fieldRow.className = 'row custom-field mb-3';
            fieldRow.innerHTML = `
                <div class="col-5">
                    <input type="text" class="form-control" name="customFields[${fieldCount}][name]" placeholder="Nom du champ" required>
                </div>
                <div class="col-5">
                    <input type="text" class="form-control" name="customFields[${fieldCount}][value]" placeholder="Valeur" required>
                </div>
                <div class="col-2">
                    <button type="button" class="btn btn-danger remove-field">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            customFieldsContainer.appendChild(fieldRow);
            
            // Ajouter l'événement de suppression
            fieldRow.querySelector('.remove-field').addEventListener('click', function() {
                fieldRow.remove();
            });
            
            fieldCount++;
        });
        
        // Gestion des champs existants
        customFieldsContainer.querySelectorAll('.remove-field').forEach(function(button) {
            button.addEventListener('click', function() {
                this.closest('.custom-field').remove();
            });
        });
    }
}); 