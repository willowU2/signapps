/**
 * Tenant Configuration Types
 *
 * Defines the schema for tenant-specific settings, branding, and feature toggles.
 */

// ============================================================================
// Branding Types
// ============================================================================

export interface TenantLogo {
  /** Primary logo URL (displayed in header) */
  primary: string;
  /** Secondary logo URL (displayed in footer, login) */
  secondary?: string;
  /** Favicon URL */
  favicon?: string;
  /** Logo for dark mode */
  primaryDark?: string;
  secondaryDark?: string;
}

export interface TenantColors {
  /** Primary brand color (buttons, links, accents) */
  primary: string;
  /** Primary color for dark mode */
  primaryDark?: string;
  /** Secondary accent color */
  secondary?: string;
  /** Background color override */
  background?: string;
  /** Sidebar background color */
  sidebarBackground?: string;
  /** Header background color */
  headerBackground?: string;
}

export interface TenantTypography {
  /** Primary font family */
  fontFamily?: string;
  /** Heading font family */
  headingFontFamily?: string;
  /** Base font size (px) */
  baseFontSize?: number;
}

export interface TenantBranding {
  /** Tenant display name */
  name: string;
  /** Short tagline */
  tagline?: string;
  /** Logo configuration */
  logo: TenantLogo;
  /** Color scheme */
  colors: TenantColors;
  /** Typography settings */
  typography?: TenantTypography;
  /** Custom CSS to inject */
  customCss?: string;
}

// ============================================================================
// Feature Toggles
// ============================================================================

export interface TenantFeatureToggles {
  // Core modules
  storage: boolean;
  calendar: boolean;
  tasks: boolean;
  mail: boolean;
  chat: boolean;
  docs: boolean;
  meet: boolean;

  // Advanced modules
  containers: boolean;
  vpn: boolean;
  monitoring: boolean;
  ai: boolean;

  // Features
  dashboardCustomization: boolean;
  viewsSystem: boolean;
  commandBar: boolean;
  darkMode: boolean;
  multiLanguage: boolean;

  // Admin features
  userManagement: boolean;
  roleManagement: boolean;
  auditLog: boolean;
  apiAccess: boolean;

  // Integrations
  ldapAuth: boolean;
  samlAuth: boolean;
  webhooks: boolean;
  apiKeys: boolean;
}

export type FeatureToggleKey = keyof TenantFeatureToggles;

export const DEFAULT_FEATURE_TOGGLES: TenantFeatureToggles = {
  // Core - enabled by default
  storage: true,
  calendar: true,
  tasks: true,
  mail: true,
  chat: true,
  docs: true,
  meet: true,

  // Advanced - disabled by default
  containers: false,
  vpn: false,
  monitoring: false,
  ai: false,

  // Features - enabled by default
  dashboardCustomization: true,
  viewsSystem: true,
  commandBar: true,
  darkMode: true,
  multiLanguage: true,

  // Admin - enabled by default
  userManagement: true,
  roleManagement: true,
  auditLog: true,
  apiAccess: false,

  // Integrations - disabled by default
  ldapAuth: false,
  samlAuth: false,
  webhooks: false,
  apiKeys: false,
};

// ============================================================================
// Custom Domain
// ============================================================================

export interface TenantDomain {
  /** Domain name (e.g., "app.company.com") */
  domain: string;
  /** Whether the domain is verified */
  verified: boolean;
  /** SSL certificate status */
  sslStatus: "pending" | "active" | "expired" | "error";
  /** Verification token */
  verificationToken?: string;
  /** When the domain was added */
  createdAt: string;
  /** When SSL was last renewed */
  sslRenewedAt?: string;
}

// ============================================================================
// Email Templates
// ============================================================================

export type EmailTemplateType =
  | "welcome"
  | "password_reset"
  | "email_verification"
  | "invitation"
  | "notification"
  | "task_assigned"
  | "event_reminder"
  | "share_notification";

export interface EmailTemplate {
  /** Template type */
  type: EmailTemplateType;
  /** Email subject (supports variables) */
  subject: string;
  /** HTML body (supports variables) */
  bodyHtml: string;
  /** Plain text body (supports variables) */
  bodyText: string;
  /** Whether this is the default or custom */
  isCustom: boolean;
  /** Last updated */
  updatedAt?: string;
}

export interface EmailSettings {
  /** From name */
  fromName: string;
  /** From email address */
  fromEmail: string;
  /** Reply-to email */
  replyToEmail?: string;
  /** Email footer text */
  footerText?: string;
  /** Custom templates */
  templates: Partial<Record<EmailTemplateType, EmailTemplate>>;
}

// ============================================================================
// Localization
// ============================================================================

export type SupportedLocale = "fr" | "en" | "es" | "de" | "it" | "pt";

export interface LocalizationSettings {
  /** Default locale */
  defaultLocale: SupportedLocale;
  /** Enabled locales */
  enabledLocales: SupportedLocale[];
  /** Timezone */
  timezone: string;
  /** Date format */
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  /** Time format */
  timeFormat: "12h" | "24h";
  /** First day of week (0 = Sunday, 1 = Monday) */
  firstDayOfWeek: 0 | 1;
}

// ============================================================================
// Security Settings
// ============================================================================

export interface SecuritySettings {
  /** Require MFA for all users */
  requireMfa: boolean;
  /** Allowed MFA methods */
  allowedMfaMethods: ("totp" | "sms" | "email")[];
  /** Password policy */
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number; // days, 0 = no expiry
  };
  /** Session settings */
  session: {
    maxDuration: number; // hours
    idleTimeout: number; // minutes
    allowMultipleSessions: boolean;
  };
  /** IP whitelist (empty = all allowed) */
  ipWhitelist: string[];
}

// ============================================================================
// Storage Quotas
// ============================================================================

export interface StorageQuotas {
  /** Total storage per user (bytes, 0 = unlimited) */
  perUser: number;
  /** Total storage for tenant (bytes, 0 = unlimited) */
  total: number;
  /** Max file size (bytes) */
  maxFileSize: number;
  /** Allowed file types (empty = all) */
  allowedFileTypes: string[];
  /** Blocked file types */
  blockedFileTypes: string[];
}

// ============================================================================
// Complete Tenant Configuration
// ============================================================================

export interface TenantConfig {
  /** Tenant ID */
  id: string;
  /** Tenant slug (used in URLs) */
  slug: string;
  /** Branding settings */
  branding: TenantBranding;
  /** Feature toggles */
  features: TenantFeatureToggles;
  /** Custom domains */
  domains: TenantDomain[];
  /** Email settings */
  email: EmailSettings;
  /** Localization */
  localization: LocalizationSettings;
  /** Security settings */
  security: SecuritySettings;
  /** Storage quotas */
  storage: StorageQuotas;
  /** Created timestamp */
  createdAt: string;
  /** Last updated */
  updatedAt: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_TENANT_CONFIG: Omit<
  TenantConfig,
  "id" | "slug" | "createdAt" | "updatedAt"
> = {
  branding: {
    name: "SignApps",
    tagline: "Your Digital Workspace",
    logo: {
      primary: "/logo.svg",
      favicon: "/favicon.ico",
    },
    colors: {
      primary: "#6366f1", // Indigo
    },
  },
  features: DEFAULT_FEATURE_TOGGLES,
  domains: [],
  email: {
    fromName: "SignApps",
    fromEmail: "noreply@signapps.io",
    templates: {},
  },
  localization: {
    defaultLocale: "fr",
    enabledLocales: ["fr", "en"],
    timezone: "Europe/Paris",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
    firstDayOfWeek: 1,
  },
  security: {
    requireMfa: false,
    allowedMfaMethods: ["totp", "email"],
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
      maxAge: 0,
    },
    session: {
      maxDuration: 24,
      idleTimeout: 30,
      allowMultipleSessions: true,
    },
    ipWhitelist: [],
  },
  storage: {
    perUser: 5 * 1024 * 1024 * 1024, // 5GB
    total: 0, // unlimited
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedFileTypes: [],
    blockedFileTypes: [".exe", ".bat", ".cmd", ".sh", ".ps1"],
  },
};

// ============================================================================
// Utility Types
// ============================================================================

export type TenantConfigSection = keyof Omit<
  TenantConfig,
  "id" | "slug" | "createdAt" | "updatedAt"
>;

export interface TenantConfigUpdate {
  section: TenantConfigSection;
  data: Partial<TenantConfig[TenantConfigSection]>;
}
