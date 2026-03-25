export const fr = {
  // Navigation
  'nav.dashboard': 'Tableau de bord',
  'nav.docs': 'Documents',
  'nav.sheets': 'Tableurs',
  'nav.slides': 'Présentations',
  'nav.forms': 'Formulaires',
  'nav.mail': 'Messagerie',
  'nav.calendar': 'Calendrier',
  'nav.tasks': 'Tâches',
  'nav.contacts': 'Contacts',
  'nav.drive': 'Drive',
  'nav.chat': 'Chat',
  'nav.meet': 'Visio',
  'nav.settings': 'Paramètres',
  'nav.admin': 'Administration',

  // Actions
  'action.save': 'Enregistrer',
  'action.cancel': 'Annuler',
  'action.delete': 'Supprimer',
  'action.edit': 'Modifier',
  'action.create': 'Créer',
  'action.search': 'Rechercher',
  'action.export': 'Exporter',
  'action.import': 'Importer',
  'action.refresh': 'Rafraîchir',
  'action.close': 'Fermer',
  'action.confirm': 'Confirmer',
  'action.back': 'Retour',
  'action.next': 'Suivant',
  'action.previous': 'Précédent',
  'action.submit': 'Soumettre',
  'action.download': 'Télécharger',
  'action.upload': 'Importer un fichier',
  'action.copy': 'Copier',
  'action.share': 'Partager',
  'action.rename': 'Renommer',
  'action.archive': 'Archiver',
  'action.restore': 'Restaurer',
  'action.select_all': 'Tout sélectionner',
  'action.deselect_all': 'Tout désélectionner',

  // Forms
  'form.required': 'Obligatoire',
  'form.optional': 'Facultatif',
  'form.name': 'Nom',
  'form.email': 'Email',
  'form.password': 'Mot de passe',
  'form.phone': 'Téléphone',
  'form.company': 'Entreprise',
  'form.description': 'Description',
  'form.title': 'Titre',
  'form.tags': 'Tags',

  // Status
  'status.loading': 'Chargement...',
  'status.saving': 'Enregistrement...',
  'status.error': 'Une erreur est survenue',
  'status.success': 'Opération réussie',
  'status.empty': 'Aucun élément',
  'status.no_results': 'Aucun résultat',
  'status.offline': 'Hors ligne',
  'status.online': 'En ligne',

  // Time
  'time.today': "Aujourd'hui",
  'time.yesterday': 'Hier',
  'time.this_week': 'Cette semaine',
  'time.this_month': 'Ce mois',
  'time.just_now': "À l'instant",
  'time.minutes_ago': 'il y a {n} min',
  'time.hours_ago': 'il y a {n}h',

  // Confirmation
  'confirm.delete': 'Êtes-vous sûr de vouloir supprimer cet élément ?',
  'confirm.unsaved': 'Des modifications non enregistrées seront perdues. Continuer ?',
  'confirm.logout': 'Êtes-vous sûr de vouloir vous déconnecter ?',

  // Modules
  'mail.compose': 'Nouveau message',
  'mail.reply': 'Répondre',
  'mail.forward': 'Transférer',
  'mail.inbox': 'Boîte de réception',
  'mail.sent': 'Envoyés',
  'mail.drafts': 'Brouillons',
  'mail.trash': 'Corbeille',

  'calendar.new_event': 'Nouvel événement',
  'calendar.today': "Aujourd'hui",

  'tasks.new_task': 'Nouvelle tâche',
  'tasks.completed': 'Terminée',
  'tasks.in_progress': 'En cours',
  'tasks.todo': 'À faire',

  'drive.upload': 'Importer des fichiers',
  'drive.new_folder': 'Nouveau dossier',
  'drive.empty_folder': 'Ce dossier est vide',
} as const;

export type TranslationKey = keyof typeof fr;
