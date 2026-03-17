/**
 * Tenant Configuration Module
 *
 * Provides tenant-specific settings, branding, feature toggles, and customization.
 */

// Types
export type {
  TenantLogo,
  TenantColors,
  TenantTypography,
  TenantBranding,
  TenantFeatureToggles,
  FeatureToggleKey,
  TenantDomain,
  EmailTemplateType,
  EmailTemplate,
  EmailSettings,
  SupportedLocale,
  LocalizationSettings,
  SecuritySettings,
  StorageQuotas,
  TenantConfig,
  TenantConfigSection,
  TenantConfigUpdate,
} from "./types";

export { DEFAULT_FEATURE_TOGGLES, DEFAULT_TENANT_CONFIG } from "./types";

// Context & Hooks
export {
  TenantProvider,
  useTenant,
  useTenantConfig,
  useTenantBranding,
  useTenantFeatures,
  useFeatureEnabled,
  FeatureGate,
  MultiFeatureGate,
} from "./context";

// Branding Components
export {
  BrandingStyles,
  TenantLogo,
  TenantFavicon,
  TenantTitle,
  BrandingProvider,
} from "./branding";

// Email Templates
export type { TemplateVariables } from "./email-templates";
export {
  interpolateTemplate,
  DEFAULT_TEMPLATES,
  buildEmail,
  getTemplatePreview,
} from "./email-templates";

// Admin Settings Components
export {
  BrandingSettings,
  FeatureTogglesSettings,
  LocalizationSettings,
  SecuritySettings,
  TenantSettingsPage,
} from "./admin-settings";
