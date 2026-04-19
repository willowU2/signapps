// =============================================================================
// Tab categories, visibility config, and node type configuration
// =============================================================================

export interface TabDef {
  id: string;
  label: string;
  category: "organisation" | "groupes_politiques" | "infrastructure";
}

export const ALL_TABS: TabDef[] = [
  // Organisation
  { id: "details", label: "Details", category: "organisation" },
  { id: "people", label: "Personnes", category: "organisation" },
  { id: "positions", label: "Postes", category: "organisation" },
  { id: "governance", label: "Gouvernance", category: "organisation" },
  // SO2 — gouvernance enrichie
  { id: "raci", label: "RACI", category: "organisation" },
  { id: "decisions", label: "Décisions", category: "organisation" },
  // Groupes & Politiques
  { id: "groups", label: "Groupes", category: "groupes_politiques" },
  { id: "sites", label: "Sites", category: "groupes_politiques" },
  { id: "policies", label: "Policies", category: "groupes_politiques" },
  { id: "gpo", label: "GPO", category: "groupes_politiques" },
  // Infrastructure
  { id: "computers", label: "Ordinateurs", category: "infrastructure" },
  { id: "kerberos", label: "Kerberos", category: "infrastructure" },
  { id: "dns", label: "DNS", category: "infrastructure" },
  { id: "certificates", label: "Certificats", category: "infrastructure" },
  { id: "dhcp", label: "DHCP", category: "infrastructure" },
  { id: "ntp", label: "NTP", category: "infrastructure" },
  { id: "deployment", label: "Deploiement", category: "infrastructure" },
  { id: "audit", label: "Audit", category: "infrastructure" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  organisation: "Organisation",
  groupes_politiques: "Groupes & Politiques",
  infrastructure: "Infrastructure",
};

export const DEFAULT_TAB_VISIBILITY: Record<string, string[]> = {
  group: [
    "details",
    "people",
    "positions",
    "governance",
    "groups",
    "sites",
    "policies",
    "gpo",
    "computers",
    "kerberos",
    "dns",
    "certificates",
    "dhcp",
    "ntp",
    "deployment",
    "audit",
  ],
  subsidiary: [
    "details",
    "people",
    "positions",
    "governance",
    "groups",
    "sites",
    "policies",
    "gpo",
    "computers",
    "kerberos",
    "dhcp",
    "ntp",
    "audit",
  ],
  bu: [
    "details",
    "people",
    "positions",
    "governance",
    "groups",
    "sites",
    "policies",
    "gpo",
    "computers",
    "deployment",
    "audit",
  ],
  department: [
    "details",
    "people",
    "positions",
    "governance",
    "groups",
    "sites",
    "policies",
    "gpo",
    "computers",
    "deployment",
    "audit",
  ],
  service: [
    "details",
    "people",
    "positions",
    "groups",
    "policies",
    "gpo",
    "computers",
    "audit",
  ],
  team: [
    "details",
    "people",
    "positions",
    "groups",
    "gpo",
    "computers",
    "audit",
  ],
  position: ["details", "people", "audit"],
  computer: [
    "details",
    "kerberos",
    "dns",
    "certificates",
    "dhcp",
    "ntp",
    "deployment",
    "audit",
  ],
};

/** Get visible tabs for a node type, with optional override from schema.visible_tabs */
export function getVisibleTabs(
  nodeType: string,
  schema?: Record<string, unknown>,
  extras?: { axisType?: string; hasBoard?: boolean },
): TabDef[] {
  // Check for override in schema.visible_tabs
  const override = schema?.visible_tabs as Record<string, string[]> | undefined;
  const ids: string[] = override
    ? [
        ...(override.organisation || []),
        ...(override.groupes_politiques || []),
        ...(override.infrastructure || []),
      ]
    : (DEFAULT_TAB_VISIBILITY[nodeType] ??
      DEFAULT_TAB_VISIBILITY["department"]);

  // SO2 — conditional tabs: RACI on project focus nodes, Décisions on
  // any node that already has a board attached.
  const withExtras = [...ids];
  if (extras?.axisType === "project" && !withExtras.includes("raci")) {
    withExtras.push("raci");
  }
  if (extras?.hasBoard && !withExtras.includes("decisions")) {
    withExtras.push("decisions");
  }
  return ALL_TABS.filter((t) => withExtras.includes(t.id));
}

// =============================================================================
// Node type configuration
// =============================================================================

export interface NodeTypeConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const INTERNAL_NODE_TYPES: Record<string, NodeTypeConfig> = {
  group: {
    label: "Groupe",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30",
    border: "border-red-300 dark:border-red-700",
  },
  subsidiary: {
    label: "Filiale",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    border: "border-orange-300 dark:border-orange-700",
  },
  bu: {
    label: "BU",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    border: "border-yellow-300 dark:border-yellow-700",
  },
  department: {
    label: "Departement",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    border: "border-blue-300 dark:border-blue-700",
  },
  service: {
    label: "Service",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/30",
    border: "border-green-300 dark:border-green-700",
  },
  team: {
    label: "Equipe",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    border: "border-purple-300 dark:border-purple-700",
  },
  position: {
    label: "Poste",
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-100 dark:bg-pink-900/30",
    border: "border-pink-300 dark:border-pink-700",
  },
};

export const CLIENT_NODE_TYPES: Record<string, NodeTypeConfig> = {
  client_group: {
    label: "Groupe client",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-900/30",
    border: "border-slate-300 dark:border-slate-700",
  },
  client_company: {
    label: "Societe",
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    border: "border-cyan-300 dark:border-cyan-700",
  },
  client_department: {
    label: "Departement",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-100 dark:bg-sky-900/30",
    border: "border-sky-300 dark:border-sky-700",
  },
};

export const SUPPLIER_NODE_TYPES: Record<string, NodeTypeConfig> = {
  supplier_group: {
    label: "Groupe fournisseur",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-900/30",
    border: "border-rose-300 dark:border-rose-700",
  },
  supplier_company: {
    label: "Societe",
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-100 dark:bg-pink-900/30",
    border: "border-pink-300 dark:border-pink-700",
  },
  supplier_department: {
    label: "Departement",
    color: "text-fuchsia-600 dark:text-fuchsia-400",
    bg: "bg-fuchsia-100 dark:bg-fuchsia-900/30",
    border: "border-fuchsia-300 dark:border-fuchsia-700",
  },
};

export function getNodeTypeConfig(type: string): NodeTypeConfig {
  return (
    INTERNAL_NODE_TYPES[type] ??
    CLIENT_NODE_TYPES[type] ??
    SUPPLIER_NODE_TYPES[type] ?? {
      label: type,
      color: "text-muted-foreground",
      bg: "bg-muted",
      border: "border-border",
    }
  );
}

export function getNodeTypesByTreeType(
  treeType: string,
): Record<string, NodeTypeConfig> {
  if (treeType === "clients") return CLIENT_NODE_TYPES;
  if (treeType === "suppliers") return SUPPLIER_NODE_TYPES;
  return INTERNAL_NODE_TYPES;
}

// =============================================================================
// Board role labels
// =============================================================================

export const BOARD_ROLE_LABELS: Record<string, string> = {
  president: "President",
  vice_president: "Vice-president",
  member: "Membre",
  treasurer: "Tresorier",
  secretary: "Secretaire",
};

export const BOARD_ROLE_SUGGESTIONS = [
  "president",
  "vice_president",
  "member",
  "treasurer",
  "secretary",
];
