/**
 * Central registry of all SignApps applications.
 * Used by dashboard, right sidebar, and pinned sidebar for consistent data.
 */

export interface AppEntry {
  id: string;
  href: string;
  icon: string; // lucide icon name
  label: string;
  description: string;
  category: string;
  color: string;
}

export const APP_REGISTRY: AppEntry[] = [
  // Productivité
  { id: 'docs',      href: '/docs',       icon: 'FileText',      label: 'Docs',        description: 'Traitement de texte collaboratif',  category: 'Productivité',    color: 'text-blue-500' },
  { id: 'sheets',    href: '/sheets',     icon: 'Sheet',         label: 'Sheets',      description: 'Tableurs et analyses de données',    category: 'Productivité',    color: 'text-green-500' },
  { id: 'slides',    href: '/slides',     icon: 'Presentation',  label: 'Slides',      description: 'Présentations et diaporamas',        category: 'Productivité',    color: 'text-yellow-500' },
  { id: 'design',    href: '/design',     icon: 'Palette',       label: 'Design',      description: 'Création graphique et maquettes',   category: 'Productivité',    color: 'text-purple-500' },
  { id: 'keep',      href: '/keep',       icon: 'StickyNote',    label: 'Keep',        description: 'Notes rapides et mémos',             category: 'Productivité',    color: 'text-yellow-400' },
  { id: 'forms',     href: '/forms',      icon: 'ClipboardList', label: 'Forms',       description: 'Formulaires et sondages',            category: 'Productivité',    color: 'text-violet-500' },

  // Communication
  { id: 'mail',      href: '/mail',       icon: 'Mail',          label: 'Mail',        description: 'Messagerie et emails',               category: 'Communication',   color: 'text-blue-500' },
  { id: 'chat',      href: '/chat',       icon: 'MessageSquare', label: 'Chat',        description: 'Messagerie instantanée en équipe',   category: 'Communication',   color: 'text-primary' },
  { id: 'meet',      href: '/meet',       icon: 'Video',         label: 'Meet',        description: 'Visioconférences et réunions',        category: 'Communication',   color: 'text-green-500' },
  { id: 'social',    href: '/social',     icon: 'Users2',        label: 'Social',      description: 'Réseau social interne',              category: 'Communication',   color: 'text-pink-500' },

  // Organisation
  { id: 'calendar',  href: '/cal',        icon: 'Calendar',      label: 'Calendar',    description: 'Agenda et gestion du temps',         category: 'Organisation',    color: 'text-blue-500' },
  { id: 'tasks',     href: '/tasks',      icon: 'CheckSquare',   label: 'Tasks',       description: 'Tâches et suivi de projets',         category: 'Organisation',    color: 'text-green-500' },
  { id: 'projects',  href: '/projects',   icon: 'KanbanSquare',  label: 'Projects',    description: 'Gestion de projets Kanban',          category: 'Organisation',    color: 'text-orange-500' },
  { id: 'resources', href: '/resources',  icon: 'Package',       label: 'Resources',   description: 'Ressources et équipements',          category: 'Organisation',    color: 'text-amber-500' },
  { id: 'contacts',  href: '/contacts',   icon: 'ContactRound',  label: 'Contacts',    description: 'Répertoire et annuaire',             category: 'Organisation',    color: 'text-indigo-500' },

  // Business
  { id: 'crm',         href: '/crm',        icon: 'TrendingUp',  label: 'CRM',         description: 'Gestion des clients et prospects',   category: 'Business',        color: 'text-red-500' },
  { id: 'billing',     href: '/billing',    icon: 'CreditCard',  label: 'Billing',     description: 'Facturation et abonnements',         category: 'Business',        color: 'text-emerald-500' },
  { id: 'accounting',  href: '/accounting', icon: 'Calculator',  label: 'Accounting',  description: 'Comptabilité et finances',           category: 'Business',        color: 'text-teal-500' },
  { id: 'analytics',   href: '/analytics',  icon: 'BarChart3',   label: 'Analytics',   description: 'Tableaux de bord et métriques',      category: 'Business',        color: 'text-cyan-500' },
  { id: 'workforce',   href: '/workforce',  icon: 'Briefcase',   label: 'Workforce',   description: 'RH et gestion des équipes',          category: 'Business',        color: 'text-rose-500' },

  // Infrastructure
  { id: 'drive',       href: '/storage',    icon: 'HardDrive',   label: 'Drive',       description: 'Stockage et partage de fichiers',    category: 'Infrastructure',  color: 'text-slate-500' },
  { id: 'containers',  href: '/containers', icon: 'Container',   label: 'Containers',  description: 'Orchestration de conteneurs',        category: 'Infrastructure',  color: 'text-red-500' },
  { id: 'vpn',         href: '/vpn',        icon: 'Shield',      label: 'VPN',         description: 'Réseau privé virtuel sécurisé',      category: 'Infrastructure',  color: 'text-green-600' },
  { id: 'monitoring',  href: '/monitoring', icon: 'Activity',    label: 'Monitoring',  description: 'Supervision des services',           category: 'Infrastructure',  color: 'text-yellow-500' },
  { id: 'media',       href: '/media',      icon: 'Mic',         label: 'Media',       description: 'Audio, vidéo et médias',             category: 'Infrastructure',  color: 'text-purple-500' },
  { id: 'routes',      href: '/routes',     icon: 'Network',     label: 'Routes',      description: 'Proxy et routage réseau',            category: 'Infrastructure',  color: 'text-blue-500' },

  // Administration
  { id: 'users',       href: '/users',      icon: 'Users',       label: 'Users',       description: 'Gestion des utilisateurs',           category: 'Administration',  color: 'text-orange-500' },
  { id: 'settings',    href: '/settings',   icon: 'Settings',    label: 'Settings',    description: 'Configuration de l\'instance',       category: 'Administration',  color: 'text-slate-500' },
  { id: 'backups',     href: '/backups',    icon: 'Archive',     label: 'Backups',     description: 'Sauvegardes automatiques',           category: 'Administration',  color: 'text-slate-400' },
  { id: 'scheduler',   href: '/scheduler',  icon: 'Clock',       label: 'Scheduler',   description: 'T\u00e2ches planifi\u00e9es et cron jobs',     category: 'Administration',  color: 'text-amber-500' },
  { id: 'workflows',   href: '/admin/workflows', icon: 'Zap',    label: 'Workflows',   description: 'R\u00e8gles d\'automatisation',        category: 'Administration',  color: 'text-amber-400' },

  // Avancé
  { id: 'office',      href: '/office',     icon: 'FileBox',     label: 'Office',      description: 'Conversion de documents Office',     category: 'Avancé',          color: 'text-blue-600' },
  { id: 'ai',          href: '/ai',         icon: 'Brain',       label: 'Intelligence', description: 'IA et automatisation',              category: 'Avancé',          color: 'text-violet-500' },
  { id: 'bookmarks',   href: '/bookmarks',  icon: 'Star',        label: 'Favoris',     description: 'Liens et ressources sauvegardés',    category: 'Avancé',          color: 'text-yellow-500' },
  { id: 'apps',        href: '/apps',       icon: 'Store',       label: 'App Store',   description: 'Extensions et intégrations',         category: 'Avancé',          color: 'text-indigo-500' },
];

export const APP_CATEGORIES = [
  'Productivité',
  'Communication',
  'Organisation',
  'Business',
  'Infrastructure',
  'Administration',
  'Avancé',
] as const;

export type AppCategory = typeof APP_CATEGORIES[number];

export function getAppsByCategory(category: string): AppEntry[] {
  return APP_REGISTRY.filter((app) => app.category === category);
}

export function findAppByHref(href: string): AppEntry | undefined {
  return APP_REGISTRY.find((app) => app.href === href);
}
