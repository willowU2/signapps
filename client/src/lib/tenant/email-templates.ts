/**
 * Email Templates
 *
 * Default email templates and variable substitution utilities.
 */

import type { EmailTemplate, EmailTemplateType, TenantBranding } from "./types";

// ============================================================================
// Template Variables
// ============================================================================

export interface TemplateVariables {
  // User variables
  userName?: string;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;

  // Tenant variables
  tenantName?: string;
  tenantLogo?: string;
  tenantUrl?: string;

  // Action variables
  actionUrl?: string;
  actionLabel?: string;
  resetToken?: string;
  verificationToken?: string;
  inviteCode?: string;

  // Content variables
  title?: string;
  message?: string;
  taskName?: string;
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  fileName?: string;
  sharedBy?: string;

  // System variables
  currentYear?: number;
  expiresIn?: string;
}

/**
 * Replace template variables in a string
 */
export function interpolateTemplate(
  template: string,
  variables: TemplateVariables,
): string {
  let result = template;

  // Replace all variables
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    result = result.replace(regex, String(value ?? ""));
  });

  // Add current year if not provided
  if (!variables.currentYear) {
    result = result.replace(
      /\{\{\s*currentYear\s*\}\}/g,
      String(new Date().getFullYear()),
    );
  }

  return result;
}

// ============================================================================
// Default Templates
// ============================================================================

const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; background-color: #f3f4f6; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 32px; }
  .logo { text-align: center; margin-bottom: 24px; }
  .logo img { max-height: 40px; }
  h1 { color: #111827; font-size: 24px; margin: 0 0 16px; }
  p { margin: 0 0 16px; }
  .button { display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; }
  .button:hover { background: #4f46e5; }
  .footer { text-align: center; margin-top: 32px; font-size: 14px; color: #6b7280; }
  .muted { color: #9ca3af; font-size: 13px; }
`;

export const DEFAULT_TEMPLATES: Record<EmailTemplateType, EmailTemplate> = {
  welcome: {
    type: "welcome",
    subject: "Bienvenue sur {{tenantName}}",
    bodyHtml: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">
      <img src="{{tenantLogo}}" alt="{{tenantName}}" />
    </div>
    <h1>Bienvenue, {{userFirstName}} !</h1>
    <p>Votre compte sur <strong>{{tenantName}}</strong> a été créé avec succès.</p>
    <p>Vous pouvez maintenant vous connecter et commencer à utiliser tous nos services.</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="{{actionUrl}}" class="button">Accéder à mon compte</a>
    </p>
    <p class="muted">Si vous n'avez pas créé ce compte, vous pouvez ignorer cet email.</p>
  </div>
  <div class="footer">
    <p>© {{currentYear}} {{tenantName}}. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>`,
    bodyText: `Bienvenue sur {{tenantName}}, {{userFirstName}} !

Votre compte a été créé avec succès.

Accédez à votre compte : {{actionUrl}}

© {{currentYear}} {{tenantName}}`,
    isCustom: false,
  },

  password_reset: {
    type: "password_reset",
    subject: "Réinitialisation de votre mot de passe",
    bodyHtml: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">
      <img src="{{tenantLogo}}" alt="{{tenantName}}" />
    </div>
    <h1>Réinitialisation du mot de passe</h1>
    <p>Bonjour {{userFirstName}},</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="{{actionUrl}}" class="button">Réinitialiser mon mot de passe</a>
    </p>
    <p class="muted">Ce lien expirera dans {{expiresIn}}.</p>
    <p class="muted">Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
  </div>
  <div class="footer">
    <p>© {{currentYear}} {{tenantName}}. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>`,
    bodyText: `Réinitialisation du mot de passe

Bonjour {{userFirstName}},

Cliquez sur ce lien pour réinitialiser votre mot de passe : {{actionUrl}}

Ce lien expirera dans {{expiresIn}}.

© {{currentYear}} {{tenantName}}`,
    isCustom: false,
  },

  email_verification: {
    type: "email_verification",
    subject: "Vérifiez votre adresse email",
    bodyHtml: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">
      <img src="{{tenantLogo}}" alt="{{tenantName}}" />
    </div>
    <h1>Vérification de votre email</h1>
    <p>Bonjour {{userFirstName}},</p>
    <p>Veuillez cliquer sur le bouton ci-dessous pour vérifier votre adresse email.</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="{{actionUrl}}" class="button">Vérifier mon email</a>
    </p>
    <p class="muted">Ce lien expirera dans {{expiresIn}}.</p>
  </div>
  <div class="footer">
    <p>© {{currentYear}} {{tenantName}}. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>`,
    bodyText: `Vérification de votre email

Bonjour {{userFirstName}},

Cliquez sur ce lien pour vérifier votre email : {{actionUrl}}

Ce lien expirera dans {{expiresIn}}.

© {{currentYear}} {{tenantName}}`,
    isCustom: false,
  },

  invitation: {
    type: "invitation",
    subject: "Vous êtes invité(e) à rejoindre {{tenantName}}",
    bodyHtml: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">
      <img src="{{tenantLogo}}" alt="{{tenantName}}" />
    </div>
    <h1>Vous êtes invité(e) !</h1>
    <p>Bonjour,</p>
    <p><strong>{{sharedBy}}</strong> vous invite à rejoindre <strong>{{tenantName}}</strong>.</p>
    <p>Cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte.</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="{{actionUrl}}" class="button">Accepter l'invitation</a>
    </p>
    <p class="muted">Cette invitation expirera dans {{expiresIn}}.</p>
  </div>
  <div class="footer">
    <p>© {{currentYear}} {{tenantName}}. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>`,
    bodyText: `Vous êtes invité(e) à rejoindre {{tenantName}}

{{sharedBy}} vous invite à rejoindre {{tenantName}}.

Acceptez l'invitation : {{actionUrl}}

Cette invitation expirera dans {{expiresIn}}.

© {{currentYear}} {{tenantName}}`,
    isCustom: false,
  },

  notification: {
    type: "notification",
    subject: "{{title}}",
    bodyHtml: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">
      <img src="{{tenantLogo}}" alt="{{tenantName}}" />
    </div>
    <h1>{{title}}</h1>
    <p>{{message}}</p>
    {{#if actionUrl}}
    <p style="text-align: center; margin: 32px 0;">
      <a href="{{actionUrl}}" class="button">{{actionLabel}}</a>
    </p>
    {{/if}}
  </div>
  <div class="footer">
    <p>© {{currentYear}} {{tenantName}}. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>`,
    bodyText: `{{title}}

{{message}}

{{actionUrl}}

© {{currentYear}} {{tenantName}}`,
    isCustom: false,
  },

  task_assigned: {
    type: "task_assigned",
    subject: "Nouvelle tâche assignée : {{taskName}}",
    bodyHtml: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">
      <img src="{{tenantLogo}}" alt="{{tenantName}}" />
    </div>
    <h1>Nouvelle tâche assignée</h1>
    <p>Bonjour {{userFirstName}},</p>
    <p><strong>{{sharedBy}}</strong> vous a assigné une nouvelle tâche :</p>
    <p style="background: #f3f4f6; padding: 16px; border-radius: 6px; font-weight: 500;">
      {{taskName}}
    </p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="{{actionUrl}}" class="button">Voir la tâche</a>
    </p>
  </div>
  <div class="footer">
    <p>© {{currentYear}} {{tenantName}}. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>`,
    bodyText: `Nouvelle tâche assignée

Bonjour {{userFirstName}},

{{sharedBy}} vous a assigné une nouvelle tâche : {{taskName}}

Voir la tâche : {{actionUrl}}

© {{currentYear}} {{tenantName}}`,
    isCustom: false,
  },

  event_reminder: {
    type: "event_reminder",
    subject: "Rappel : {{eventName}} - {{eventDate}}",
    bodyHtml: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">
      <img src="{{tenantLogo}}" alt="{{tenantName}}" />
    </div>
    <h1>Rappel d'événement</h1>
    <p>Bonjour {{userFirstName}},</p>
    <p>Ceci est un rappel pour l'événement suivant :</p>
    <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <p style="margin: 0; font-weight: 500; font-size: 18px;">{{eventName}}</p>
      <p style="margin: 8px 0 0; color: #6b7280;">📅 {{eventDate}} à {{eventTime}}</p>
    </div>
    <p style="text-align: center; margin: 32px 0;">
      <a href="{{actionUrl}}" class="button">Voir l'événement</a>
    </p>
  </div>
  <div class="footer">
    <p>© {{currentYear}} {{tenantName}}. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>`,
    bodyText: `Rappel d'événement

Bonjour {{userFirstName}},

Rappel pour : {{eventName}}
Date : {{eventDate}} à {{eventTime}}

Voir l'événement : {{actionUrl}}

© {{currentYear}} {{tenantName}}`,
    isCustom: false,
  },

  share_notification: {
    type: "share_notification",
    subject: "{{sharedBy}} a partagé {{fileName}} avec vous",
    bodyHtml: `
<!DOCTYPE html>
<html>
<head><style>${baseStyles}</style></head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">
      <img src="{{tenantLogo}}" alt="{{tenantName}}" />
    </div>
    <h1>Nouveau partage</h1>
    <p>Bonjour {{userFirstName}},</p>
    <p><strong>{{sharedBy}}</strong> a partagé un fichier avec vous :</p>
    <p style="background: #f3f4f6; padding: 16px; border-radius: 6px; font-weight: 500;">
      📄 {{fileName}}
    </p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="{{actionUrl}}" class="button">Ouvrir le fichier</a>
    </p>
  </div>
  <div class="footer">
    <p>© {{currentYear}} {{tenantName}}. Tous droits réservés.</p>
  </div>
</div>
</body>
</html>`,
    bodyText: `Nouveau partage

Bonjour {{userFirstName}},

{{sharedBy}} a partagé un fichier avec vous : {{fileName}}

Ouvrir le fichier : {{actionUrl}}

© {{currentYear}} {{tenantName}}`,
    isCustom: false,
  },
};

// ============================================================================
// Template Builder
// ============================================================================

export function buildEmail(
  templateType: EmailTemplateType,
  variables: TemplateVariables,
  customTemplate?: EmailTemplate,
  branding?: TenantBranding,
): { subject: string; html: string; text: string } {
  const template = customTemplate || DEFAULT_TEMPLATES[templateType];

  // Add branding variables
  const allVariables: TemplateVariables = {
    ...variables,
    tenantName: branding?.name || variables.tenantName || "SignApps",
    tenantLogo: branding?.logo.primary || variables.tenantLogo || "/logo.svg",
    currentYear: new Date().getFullYear(),
  };

  return {
    subject: interpolateTemplate(template.subject, allVariables),
    html: interpolateTemplate(template.bodyHtml, allVariables),
    text: interpolateTemplate(template.bodyText, allVariables),
  };
}

// ============================================================================
// Template Preview
// ============================================================================

export function getTemplatePreview(
  templateType: EmailTemplateType,
  branding?: TenantBranding,
): { subject: string; html: string; text: string } {
  const sampleVariables: TemplateVariables = {
    userName: "John Doe",
    userEmail: "john.doe@example.com",
    userFirstName: "John",
    userLastName: "Doe",
    tenantName: branding?.name || "SignApps",
    tenantLogo: branding?.logo.primary || "/logo.svg",
    tenantUrl: "https://app.signapps.io",
    actionUrl: "https://app.signapps.io/action",
    actionLabel: "Voir",
    title: "Notification de test",
    message: "Ceci est un message de test pour prévisualiser le template.",
    taskName: "Réviser le document marketing",
    eventName: "Réunion d'équipe",
    eventDate: "15 mars 2026",
    eventTime: "14:00",
    fileName: "rapport-Q1.pdf",
    sharedBy: "Marie Martin",
    expiresIn: "24 heures",
    currentYear: new Date().getFullYear(),
  };

  return buildEmail(templateType, sampleVariables, undefined, branding);
}
