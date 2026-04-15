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
  {
    id: "docs",
    href: "/docs",
    icon: "FileText",
    label: "Docs",
    description: "Traitement de texte collaboratif",
    category: "Productivité",
    color: "text-blue-500",
  },
  {
    id: "sheets",
    href: "/sheets",
    icon: "Sheet",
    label: "Sheets",
    description: "Tableurs et analyses de données",
    category: "Productivité",
    color: "text-green-500",
  },
  {
    id: "slides",
    href: "/slides",
    icon: "Presentation",
    label: "Slides",
    description: "Présentations et diaporamas",
    category: "Productivité",
    color: "text-yellow-500",
  },
  {
    id: "design",
    href: "/design",
    icon: "Palette",
    label: "Design",
    description: "Création graphique et maquettes",
    category: "Productivité",
    color: "text-purple-500",
  },
  {
    id: "keep",
    href: "/keep",
    icon: "StickyNote",
    label: "Keep",
    description: "Notes rapides et mémos",
    category: "Productivité",
    color: "text-yellow-400",
  },
  {
    id: "forms",
    href: "/forms",
    icon: "ClipboardList",
    label: "Forms",
    description: "Formulaires et sondages",
    category: "Productivité",
    color: "text-violet-500",
  },

  // Communication
  {
    id: "mail",
    href: "/mail",
    icon: "Mail",
    label: "Mail",
    description: "Messagerie et emails",
    category: "Communication",
    color: "text-blue-500",
  },
  {
    id: "chat",
    href: "/chat",
    icon: "MessageSquare",
    label: "Chat",
    description: "Messagerie instantanée en équipe",
    category: "Communication",
    color: "text-primary",
  },
  {
    id: "meet",
    href: "/meet",
    icon: "Video",
    label: "Meet",
    description: "Visioconférences et réunions",
    category: "Communication",
    color: "text-green-500",
  },
  {
    id: "social",
    href: "/social",
    icon: "Users2",
    label: "Social",
    description: "Réseau social interne",
    category: "Communication",
    color: "text-pink-500",
  },

  // Organisation
  {
    id: "calendar",
    href: "/cal",
    icon: "Calendar",
    label: "Calendar",
    description: "Agenda et gestion du temps",
    category: "Organisation",
    color: "text-blue-500",
  },
  {
    id: "tasks",
    href: "/tasks",
    icon: "CheckSquare",
    label: "Tasks",
    description: "Tâches et suivi de projets",
    category: "Organisation",
    color: "text-green-500",
  },
  {
    id: "projects",
    href: "/projects",
    icon: "KanbanSquare",
    label: "Projects",
    description: "Gestion de projets Kanban",
    category: "Organisation",
    color: "text-orange-500",
  },
  {
    id: "resources",
    href: "/resources",
    icon: "Package",
    label: "Resources",
    description: "Ressources et équipements",
    category: "Organisation",
    color: "text-amber-500",
  },
  {
    id: "contacts",
    href: "/contacts",
    icon: "ContactRound",
    label: "Contacts",
    description: "Répertoire et annuaire",
    category: "Organisation",
    color: "text-indigo-500",
  },

  // Business
  {
    id: "crm",
    href: "/crm",
    icon: "TrendingUp",
    label: "CRM",
    description: "Gestion des clients et prospects",
    category: "Business",
    color: "text-red-500",
  },
  {
    id: "billing",
    href: "/billing",
    icon: "CreditCard",
    label: "Billing",
    description: "Facturation et abonnements",
    category: "Business",
    color: "text-emerald-500",
  },
  {
    id: "accounting",
    href: "/accounting",
    icon: "Calculator",
    label: "Accounting",
    description: "Comptabilité et finances",
    category: "Business",
    color: "text-teal-500",
  },
  {
    id: "analytics",
    href: "/analytics",
    icon: "BarChart3",
    label: "Analytics",
    description: "Tableaux de bord et métriques",
    category: "Business",
    color: "text-cyan-500",
  },
  {
    id: "workforce",
    href: "/workforce",
    icon: "Briefcase",
    label: "Workforce",
    description: "RH et gestion des équipes",
    category: "Business",
    color: "text-rose-500",
  },

  // Infrastructure
  {
    id: "drive",
    href: "/storage",
    icon: "HardDrive",
    label: "Drive",
    description: "Stockage et partage de fichiers",
    category: "Infrastructure",
    color: "text-slate-500",
  },
  {
    id: "containers",
    href: "/containers",
    icon: "Container",
    label: "Containers",
    description: "Orchestration de conteneurs",
    category: "Infrastructure",
    color: "text-red-500",
  },
  {
    id: "vpn",
    href: "/vpn",
    icon: "Shield",
    label: "VPN",
    description: "Réseau privé virtuel sécurisé",
    category: "Infrastructure",
    color: "text-green-600",
  },
  {
    id: "monitoring",
    href: "/monitoring",
    icon: "Activity",
    label: "Monitoring",
    description: "Supervision des services",
    category: "Infrastructure",
    color: "text-yellow-500",
  },
  {
    id: "media",
    href: "/media",
    icon: "Mic",
    label: "Media",
    description: "Audio, vidéo et médias",
    category: "Infrastructure",
    color: "text-purple-500",
  },
  {
    id: "routes",
    href: "/routes",
    icon: "Network",
    label: "Routes",
    description: "Proxy et routage réseau",
    category: "Infrastructure",
    color: "text-blue-500",
  },
  {
    id: "it-assets",
    href: "/admin/it-assets",
    icon: "Monitor",
    label: "IT Assets",
    description: "Gestion du parc informatique",
    category: "Infrastructure",
    color: "text-cyan-500",
  },
  {
    id: "pxe",
    href: "/pxe",
    icon: "Server",
    label: "PXE Deploy",
    description: "Déploiement réseau PXE",
    category: "Infrastructure",
    color: "text-orange-600",
  },
  {
    id: "remote",
    href: "/remote",
    icon: "MonitorSmartphone",
    label: "Remote",
    description: "Accès distant et assistance",
    category: "Infrastructure",
    color: "text-indigo-500",
  },
  {
    id: "mail-server",
    href: "/admin/mail-server",
    icon: "ServerCog",
    label: "Serveur Mail",
    description: "Serveur mail interne SMTP/IMAP",
    category: "Infrastructure",
    color: "text-red-400",
  },

  // Administration
  {
    id: "users",
    href: "/admin/users",
    icon: "Users",
    label: "Utilisateurs",
    description: "Gestion des comptes utilisateurs",
    category: "Administration",
    color: "text-orange-500",
  },
  {
    id: "settings",
    href: "/settings",
    icon: "Settings",
    label: "Paramètres",
    description: "Configuration de l'instance",
    category: "Administration",
    color: "text-slate-500",
  },
  {
    id: "backups",
    href: "/admin/backups",
    icon: "Archive",
    label: "Sauvegardes",
    description: "Sauvegardes automatiques",
    category: "Administration",
    color: "text-slate-400",
  },
  {
    id: "scheduler",
    href: "/scheduler",
    icon: "Clock",
    label: "Planificateur",
    description: "Tâches planifiées et cron jobs",
    category: "Administration",
    color: "text-amber-500",
  },
  {
    id: "workflows",
    href: "/admin/workflows",
    icon: "Zap",
    label: "Workflows",
    description: "Règles d'automatisation",
    category: "Administration",
    color: "text-amber-400",
  },
  {
    id: "roles",
    href: "/admin/roles",
    icon: "ShieldCheck",
    label: "Rôles",
    description: "Rôles et permissions RBAC",
    category: "Administration",
    color: "text-emerald-500",
  },
  {
    id: "audit",
    href: "/admin/drive-audit",
    icon: "Eye",
    label: "Audit Drive",
    description: "Audit et traçabilité fichiers",
    category: "Administration",
    color: "text-yellow-600",
  },
  {
    id: "org-structure",
    href: "/admin/org-structure",
    icon: "Building2",
    label: "Structure org",
    description: "Organigramme et départements",
    category: "Administration",
    color: "text-blue-400",
  },
  {
    id: "persons",
    href: "/admin/persons",
    icon: "UserSearch",
    label: "Personnes",
    description: "Annuaire des collaborateurs",
    category: "Administration",
    color: "text-pink-500",
  },
  {
    id: "sites",
    href: "/admin/sites",
    icon: "MapPin",
    label: "Sites",
    description: "Gestion des sites et locaux",
    category: "Administration",
    color: "text-green-500",
  },
  {
    id: "api-docs",
    href: "/admin/api-docs",
    icon: "Code2",
    label: "API Docs",
    description: "Documentation des API REST",
    category: "Administration",
    color: "text-gray-500",
  },
  {
    id: "entity-hub",
    href: "/admin/entity-hub",
    icon: "Boxes",
    label: "Hub entités",
    description: "Vue unifiée des entités",
    category: "Administration",
    color: "text-violet-500",
  },
  {
    id: "deploy",
    href: "/admin/deploy",
    icon: "Rocket",
    label: "Déploiement",
    description: "Environnements, versions, feature flags et maintenance",
    category: "Administration",
    color: "text-sky-500",
  },

  // Productivité — Wiki
  {
    id: "wiki",
    href: "/wiki",
    icon: "BookOpen",
    label: "Wiki",
    description: "Base de connaissances interne",
    category: "Productivité",
    color: "text-amber-600",
  },

  // Productivité — extras
  {
    id: "whiteboard",
    href: "/whiteboard",
    icon: "PenTool",
    label: "Tableau blanc",
    description: "Dessin et brainstorming visuel",
    category: "Productivité",
    color: "text-pink-400",
  },
  {
    id: "vault",
    href: "/vault",
    icon: "Lock",
    label: "Coffre-fort",
    description: "Stockage sécurisé de secrets",
    category: "Productivité",
    color: "text-slate-600",
  },
  {
    id: "signatures",
    href: "/signatures",
    icon: "FileSignature",
    label: "Signatures électroniques",
    description: "Créez et gérez vos enveloppes de signature",
    category: "Productivité",
    color: "text-indigo-500",
  },
  {
    id: "webhooks",
    href: "/admin/webhooks",
    icon: "Webhook",
    label: "Webhooks",
    description: "Gestion des webhooks sortants",
    category: "Administration",
    color: "text-orange-500",
  },
  {
    id: "compliance",
    href: "/compliance",
    icon: "ClipboardCheck",
    label: "Conformité",
    description: "RGPD, audit, rétention des données",
    category: "Administration",
    color: "text-blue-500",
  },

  // Avancé
  {
    id: "office",
    href: "/office",
    icon: "FileBox",
    label: "Office",
    description: "Conversion de documents Office",
    category: "Avancé",
    color: "text-blue-600",
  },
  {
    id: "ai",
    href: "/ai",
    icon: "Brain",
    label: "Intelligence",
    description: "IA et automatisation",
    category: "Avancé",
    color: "text-violet-500",
  },
  {
    id: "bookmarks",
    href: "/bookmarks",
    icon: "Star",
    label: "Favoris",
    description: "Liens et ressources sauvegardés",
    category: "Avancé",
    color: "text-yellow-500",
  },
  {
    id: "apps",
    href: "/apps",
    icon: "Store",
    label: "App Store",
    description: "Extensions et intégrations",
    category: "Avancé",
    color: "text-indigo-500",
  },
];

export const APP_CATEGORIES = [
  "Productivité",
  "Communication",
  "Organisation",
  "Business",
  "Infrastructure",
  "Administration",
  "Avancé",
] as const;

export type AppCategory = (typeof APP_CATEGORIES)[number];

export function getAppsByCategory(category: string): AppEntry[] {
  return APP_REGISTRY.filter((app) => app.category === category);
}

export function findAppByHref(href: string): AppEntry | undefined {
  return APP_REGISTRY.find((app) => app.href === href);
}

// ---------------------------------------------------------------------------
// Dynamic app discovery — fetches from gateway, falls back to static registry
// ---------------------------------------------------------------------------

const CACHE_KEY = "signapps_app_registry";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface DiscoverResponse {
  apps: Array<{
    id: string;
    label: string;
    description: string;
    icon: string;
    category: string;
    color: string;
    href: string;
    port: number;
    status: string;
  }>;
  categories: string[];
}

/**
 * Fetch the app registry from the gateway's discovery endpoint.
 * Results are cached in localStorage with a 5-minute TTL.
 * Falls back to the static APP_REGISTRY if the gateway is unreachable.
 */
export async function fetchAppRegistry(): Promise<AppEntry[]> {
  // Check localStorage cache first
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { apps, timestamp } = JSON.parse(cached) as {
          apps: AppEntry[];
          timestamp: number;
        };
        if (Date.now() - timestamp < CACHE_TTL_MS) {
          // Deduplicate cached apps to fix existing corrupted caches
          return Array.from(new Map(apps.map((a) => [a.href, a])).values());
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  try {
    const res = await fetch("http://localhost:3099/api/v1/apps/discover", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return APP_REGISTRY;

    const data: DiscoverResponse = await res.json();
    const rawApps: AppEntry[] = data.apps.map((a) => ({
      id: a.id,
      href: a.href,
      icon: a.icon,
      label: a.label,
      description: a.description,
      category: a.category,
      color: a.color,
    }));

    // Deduplicate apps by href to prevent React key collision errors
    const apps = Array.from(new Map(rawApps.map((a) => [a.href, a])).values());

    // Cache the result
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ apps, timestamp: Date.now() }),
        );
      } catch {
        // Ignore quota errors
      }
    }

    return apps;
  } catch {
    // Fallback to static registry on error
    return APP_REGISTRY;
  }
}

/**
 * Invalidate the cached app registry so the next call to fetchAppRegistry()
 * will query the gateway again.
 */
export function invalidateAppRegistryCache(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CACHE_KEY);
  }
}
