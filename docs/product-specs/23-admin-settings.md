# Module Admin + Settings — Spécification fonctionnelle

## Benchmark concurrentiel

| Outil | Forces distinctives à capturer |
|---|---|
| **Okta** | Leader IAM, SSO, MFA, lifecycle management, adaptive auth, API access management, workflows, governance |
| **Azure Active Directory / Entra ID** | Enterprise Microsoft, conditional access, identity protection, PIM (Privileged Identity Management), B2B, B2C |
| **Google Workspace Admin** | SSO, groups, device management, security center, DLP, audit logs, org units |
| **JumpCloud** | Cloud directory, SSO, device management, RADIUS, cloud LDAP, patch management |
| **OneLogin** | SSO, MFA, directory, adaptive authentication |
| **Auth0** | Developer-focused IAM, customizable, B2C + B2B, rules, hooks, extensions |
| **Keycloak** | Open source IAM, SAML/OIDC, social login, extensible |
| **Workday** | Security configuration enterprise |
| **FusionAuth** | Developer IAM, self-hosted option |
| **Supabase Auth** | Simple, developer-friendly, row-level security |
| **Clerk** | Modern auth UX, B2C focused, user management |
| **Hanko** | Passwordless auth, passkeys |

## Principes directeurs

1. **Centralisation** — un seul endroit pour gérer les utilisateurs, rôles, permissions, intégrations.
2. **Sécurité par défaut** — 2FA encouragé, sessions courtes, audit complet.
3. **Granularité fine** — permissions précises au niveau du module, de l'action, de l'instance.
4. **Self-service pour les users** — profil, préférences, devices gérables par l'utilisateur lui-même.
5. **Compliance-ready** — logs immuables, exports, rétention configurable pour RGPD/SOC 2/ISO 27001.
6. **Transparence** — l'utilisateur voit qui a accédé à ses données, peut exporter, supprimer.

---

## Catégorie 1 — Gestion des utilisateurs

### 1.1 Liste des utilisateurs
Vue complète de tous les users de l'organisation. Tri, filtres, recherche.

### 1.2 Fiche utilisateur
Par user : nom, email, photo, rôle, groupes, dernière connexion, statut (actif/suspendu/désactivé), permissions effectives.

### 1.3 Création manuelle d'un user
Formulaire : email, nom, rôle, groupes, envoi d'une invitation.

### 1.4 Invitation par email
Email avec lien magique pour finaliser le compte (définir mot de passe, activer 2FA).

### 1.5 Import CSV
Import bulk d'utilisateurs depuis CSV avec mapping des champs.

### 1.6 SCIM provisioning
Provisioning automatique depuis l'IdP (Okta, Azure AD, Google Workspace) via SCIM 2.0.

### 1.7 Lifecycle management
Workflow : Invited → Active → Suspended → Deactivated → Deleted. Chaque transition tracée.

### 1.8 Suspend user
Suspendre temporairement (vacances, problème). L'utilisateur ne peut plus se connecter mais les données sont conservées.

### 1.9 Deactivate user
Désactivation définitive. Accès révoqué mais les données sont conservées 30 jours.

### 1.10 Delete user
Suppression complète après le délai de rétention. Respect du droit à l'oubli (RGPD).

### 1.11 Transfer of ownership
Au départ d'un user, transfert automatique des ressources (docs, calendriers, deals) à un successeur.

### 1.12 Bulk actions
Actions multiples : activer, désactiver, assigner à un groupe, changer de rôle.

### 1.13 User search avancée
Recherche avec filtres : rôle, groupe, département, statut, dernière activité, 2FA activé.

### 1.14 Resend invitation
Renvoyer une invitation si l'user n'a pas finalisé son compte.

### 1.15 Force password reset
Forcer un user à changer son mot de passe à la prochaine connexion.

### 1.16 Force 2FA
Activer 2FA obligatoire pour un user ou un groupe.

### 1.17 Last seen
Date de dernière connexion visible. Détection des comptes dormants.

---

## Catégorie 2 — Rôles et permissions

### 2.1 Rôles pré-définis
- **Owner** : propriétaire de l'organisation, contrôle total
- **Admin** : gestion de l'org sauf suppression
- **Manager** : gestion d'une équipe/département
- **Member** : utilisateur standard
- **Guest** : accès limité à des ressources spécifiques
- **Viewer** : lecture seule

### 2.2 Rôles custom
Créer des rôles custom avec des permissions précises (ex: "Sales Manager", "HR Specialist", "Finance").

### 2.3 Permissions granulaires
Permissions par module et par action :
- Docs : can_create, can_edit, can_delete, can_share, can_export
- Sheets : idem
- Drive : idem
- CRM : can_view_deals, can_edit_contacts, can_access_reports
- Billing : can_create_invoices, can_approve_expenses
- Etc.

### 2.4 Permission par instance
Permissions au niveau d'une ressource spécifique (ex: accès à un espace wiki particulier).

### 2.5 Permission inheritance
Héritage des permissions : un user dans un groupe hérite des permissions du groupe.

### 2.6 Deny rules
En plus des allows, règles deny prioritaires (ex: "pas d'accès au vault personnel, même pour les admins").

### 2.7 Role assignment
Assigner un rôle à un user (multiple rôles possibles).

### 2.8 Permission viewer
Pour chaque user, voir ses permissions effectives (union de tous ses rôles et groupes).

### 2.9 Audit role changes
Log : qui a modifié le rôle de qui, quand, pourquoi.

### 2.10 Time-limited roles
Rôles temporaires (ex: admin temporaire pendant 24h). Révocation automatique.

### 2.11 Just-in-time access
Demande d'élévation de privilèges ponctuelle avec approbation. Activité restreinte dans le temps.

### 2.12 Privileged identity management
Gestion des accès privilégiés : qui peut quoi à quel moment, approbations, audit poussé.

---

## Catégorie 3 — Groupes et équipes

### 3.1 Création de groupes
Groupes pour organiser les users : `Engineering`, `Marketing`, `Board`. Hiérarchique possible.

### 3.2 Membership
Ajouter/retirer des users. Manuel ou basé sur des règles (ex: "département = Sales" → auto).

### 3.3 Group-based permissions
Assigner des permissions à un groupe → tous les membres héritent.

### 3.4 Dynamic groups
Groupes dynamiques basés sur des attributs : `country = France`, `role contains manager`. Mise à jour automatique.

### 3.5 Nested groups
Groupes imbriqués : `All Employees > Engineering > Backend Team`.

### 3.6 Group permissions
Permissions propres au groupe : qui peut voir le groupe, qui peut ajouter des membres, qui peut supprimer.

### 3.7 Org units
Unités organisationnelles (Google-style) pour structurer par département, localisation, filiale.

### 3.8 Group mentions
@groupname dans les docs/chat/mail pour mentionner tous les membres.

### 3.9 Group mailing lists
Adresse email de groupe (ex: `engineering@mydomain.com`) qui forward à tous les membres.

### 3.10 Cross-org groups
Pour les enterprises avec plusieurs orgs, groupes partagés entre organisations.

---

## Catégorie 4 — Authentification et SSO

### 4.1 Mot de passe + 2FA
Login classique. 2FA via : TOTP app, SMS, email, security key, WebAuthn/Passkey.

### 4.2 Magic link
Login sans mot de passe via lien envoyé par email. Pour réduire la fatigue de passwords.

### 4.3 Passkeys (WebAuthn)
Support des passkeys modernes : biométrie, hardware keys. Remplace les mots de passe.

### 4.4 SSO SAML 2.0
Configuration SSO avec IdP via SAML : Okta, Azure AD, Google Workspace, OneLogin, JumpCloud, ADFS.

### 4.5 SSO OIDC
Configuration OpenID Connect : OAuth2 compliant. Google, Microsoft, Auth0, Keycloak.

### 4.6 Social login
Login via Google, Microsoft, Apple, GitHub, LinkedIn. Pour les comptes personnels.

### 4.7 JIT provisioning
Just-in-time user creation : premier login via SSO crée automatiquement le compte.

### 4.8 SAML assertion mapping
Mapping des attributs SAML vers les champs SignApps (rôles, groupes, métadonnées).

### 4.9 Multi-factor auth (MFA)
Configuration du MFA obligatoire par groupe ou user. Méthodes autorisées configurables.

### 4.10 Adaptive authentication
Authentification adaptative : demander plus de facteurs selon le risque (IP inhabituelle, heure, device inconnu).

### 4.11 Session management
Durée des sessions, remember me, force logout à distance.

### 4.12 Device trust
Liste des devices connus. Approbation pour les nouveaux devices. Révocation possible.

### 4.13 Password policy
Règles : longueur, complexité, expiration, historique, rejet des passwords fuités.

### 4.14 Brute force protection
Limites de tentatives de login. Captcha après N échecs.

### 4.15 CAPTCHA
Protection anti-bot sur login et inscription.

### 4.16 Breach detection
Detection des credentials compromis via HaveIBeenPwned.

### 4.17 Account lockout
Verrouillage temporaire après N tentatives. Unlock automatique après X temps ou par admin.

---

## Catégorie 5 — Profil utilisateur (self-service)

### 5.1 Profile page
Page personnelle où l'utilisateur gère ses infos : nom, photo, email, téléphone, bio, job title, timezone, langue.

### 5.2 Photo de profil
Upload avec crop. Gravatar fallback.

### 5.3 Mot de passe
Changer son mot de passe. Validation avec l'ancien.

### 5.4 2FA management
Activer/désactiver 2FA. Backup codes. Ajouter/retirer des méthodes.

### 5.5 Sessions actives
Liste des sessions actives (devices, IPs, dernier accès). Révocation individuelle.

### 5.6 Devices connus
Liste des devices avec navigateurs/OS. Révocation possible.

### 5.7 Activity log personnel
Log des actions : logins, modifications, partages. Pour la transparence.

### 5.8 Notifications preferences
Gestion granulaire des notifications par module et par canal (email, push, in-app, digest).

### 5.9 Language et timezone
Préférences locales : langue de l'UI, timezone pour les dates, format de date/nombre.

### 5.10 Theme
Theme clair / sombre / automatique.

### 5.11 Email preferences
- Email de news
- Digest hebdomadaire
- Notifications par module
- Marketing (opt-in/out)

### 5.12 Privacy preferences
- Profil visible par qui ?
- Activity visible ?
- Recherche de contact autorisée ?

### 5.13 API tokens
Générer et gérer ses propres API tokens pour l'automation personnelle.

### 5.14 OAuth apps
Gérer les apps tierces connectées à son compte.

### 5.15 Export my data
Bouton RGPD : export de toutes les données personnelles en JSON/ZIP.

### 5.16 Delete my account
Suppression du compte. Workflow avec confirmation, transfert de propriété des ressources, délai de rétention.

---

## Catégorie 6 — Sécurité et compliance

### 6.1 Security dashboard
Vue centrale avec KPIs de sécurité :
- % d'users avec 2FA
- Sessions actives
- Échecs de login
- Devices non compliant
- Permissions à risque
- Alertes de sécurité

### 6.2 Audit logs
Log complet de toutes les actions :
- Authentification (login/logout)
- User management
- Permission changes
- Data access
- Data export
- Settings changes
- Integration activities

### 6.3 Retention policies
Durée de conservation des logs et données : configurable par type, minimum selon lois locales.

### 6.4 Export audit logs
Export CSV/JSON pour conformité. Intégration SIEM (Splunk, Datadog, Elastic).

### 6.5 Alert rules
Alertes sur les comportements suspects :
- Login depuis un pays inhabituel
- Trop de téléchargements
- Accès à données sensibles hors heures ouvrées
- Creation de comptes admin
- Désactivation de 2FA

### 6.6 Threat detection
Détection automatique des menaces : account takeover, insider threat, data exfiltration.

### 6.7 DLP (Data Loss Prevention)
Règles pour empêcher les fuites : bloquer export de données sensibles, restricts sharing, content scanning.

### 6.8 Data classification
Classification des documents : Public, Interne, Confidentiel, Secret. Règles automatiques appliquées.

### 6.9 Encryption keys management
Gestion des clés de chiffrement. Rotation, HSM, BYOK (Bring Your Own Key), KMS integration.

### 6.10 Data residency
Choix de la région de stockage pour respecter les lois locales (RGPD pour EU).

### 6.11 Legal hold
Placer des données sous séquestre pour litiges. Blocage des suppressions.

### 6.12 Compliance reports
Rapports pré-construits pour conformité : SOC 2, ISO 27001, HIPAA, PCI DSS, RGPD.

### 6.13 Penetration testing
Résultats des audits sécurité tiers disponibles pour les clients enterprise.

### 6.14 Vulnerability scan
Scan régulier des vulnérabilités dans les dépendances et configurations.

### 6.15 GDPR tools
- Data map (cartographie des données)
- Register of processing activities
- Data Protection Impact Assessment (DPIA)
- Subject access request workflow

---

## Catégorie 7 — Organisation et multi-tenancy

### 7.1 Organization settings
Paramètres globaux de l'organisation : nom, logo, custom domain, pays, timezone par défaut, langue.

### 7.2 Custom branding
Logo, couleurs, police pour la customisation de l'UI vue par les users.

### 7.3 Custom domain
Utiliser `signapps.mydomain.com` au lieu du domaine SignApps.

### 7.4 Multiple organizations
Un user peut appartenir à plusieurs orgs (freelance, consultant travaillant pour plusieurs clients).

### 7.5 Switch organization
Quick switcher entre orgs pour les users multi-org.

### 7.6 Organization lifecycle
Workflow : Created → Trial → Active → Suspended → Terminated.

### 7.7 Trial management
Période d'essai configurable. Conversion en payant ou fin automatique.

### 7.8 Subscription et facturation
Lien avec le module Billing interne pour gérer l'abonnement SignApps.

### 7.9 User quotas
Limite du nombre d'users selon le plan.

### 7.10 Storage quotas
Limite du stockage selon le plan. Alertes à l'approche.

### 7.11 Feature flags
Activer/désactiver des modules ou features pour certaines orgs ou users.

### 7.12 Multi-region deployment
Déploiement dans plusieurs régions géographiques pour la latence et compliance.

---

## Catégorie 8 — Intégrations et API

### 8.1 API tokens org-level
Gestion des API tokens au niveau de l'org avec permissions spécifiques.

### 8.2 OAuth apps
Apps tierces autorisées à accéder aux données de l'org (avec consentement).

### 8.3 Webhooks
Configuration des webhooks sortants pour les events.

### 8.4 Directory sync (LDAP/AD)
Sync bidirectionnelle avec Active Directory ou LDAP pour les users et groupes.

### 8.5 SSO configuration
Configuration SAML/OIDC avec les IdPs.

### 8.6 Integration marketplace
Catalogue des intégrations pré-construites (Slack, Zapier, Google Workspace, Microsoft 365, etc.).

### 8.7 Custom integrations
SDK pour développer des intégrations custom.

### 8.8 API rate limits
Limites d'API par org/plan. Configuration et monitoring.

### 8.9 API versioning
Support de plusieurs versions d'API avec dépréciation annoncée.

### 8.10 API documentation
Documentation interactive (Swagger/OpenAPI) pour l'API REST de SignApps.

---

## Catégorie 9 — Settings des modules

### 9.1 Mail settings
- Domain settings (SPF, DKIM, DMARC)
- Global filters
- Retention policies
- Features toggles

### 9.2 Calendar settings
- Working hours par défaut
- Jours fériés
- Location par défaut
- Meeting defaults

### 9.3 Drive settings
- Storage limits
- Sharing policies
- File type restrictions
- Retention

### 9.4 Chat settings
- Message retention
- File sharing
- Guest permissions
- Channels creation policy

### 9.5 Meet settings
- Recording policy
- Waiting room default
- E2E encryption option
- Attendance tracking

### 9.6 CRM settings
- Pipelines configuration
- Custom fields
- Automation rules
- Lead routing

### 9.7 Tasks settings
- Statuses custom
- Priorities
- Workflow automations
- Default views

### 9.8 Forms settings
- Captcha config
- Submissions retention
- Notification defaults

### 9.9 HR settings
- Leave types and rules
- Working time configuration
- Payroll provider
- Onboarding templates

### 9.10 Billing settings
- Invoice numbering
- Tax configuration
- Templates
- Payment methods

### 9.11 Helpdesk settings
- SLAs
- Business hours
- Routing rules
- Email parser

### 9.12 Workflows settings
- Execution limits
- Retry policies
- Connections management

### 9.13 AI settings
- Provider selection
- Model restrictions
- Token quotas
- Data privacy

### 9.14 Signatures settings
- Default signers
- Templates
- Audit retention

### 9.15 LMS settings
- Default language
- Certification templates
- Gamification rules

### 9.16 IT Assets settings
- Discovery schedule
- Asset types
- Custom fields

---

## Catégorie 10 — Analytics et reporting admin

### 10.1 Usage analytics
Qui utilise quoi, combien. Distribution par user, par équipe, par département, par module.

### 10.2 Activity dashboard
Actions récentes : logins, créations, partages. En temps réel.

### 10.3 Engagement metrics
Daily Active Users (DAU), Weekly Active Users (WAU), Monthly Active Users (MAU).

### 10.4 Feature adoption
Quel % des users utilisent chaque feature. Identifie les features peu adoptées.

### 10.5 Storage usage
Usage de stockage par user, par équipe, par type de fichier.

### 10.6 Cost analytics
Coût par user, par département, par feature (pour les orgs avec facturation interne).

### 10.7 Custom reports
Builder pour créer des rapports personnalisés.

### 10.8 Scheduled reports
Envoi automatique hebdo/mensuel par email aux admins.

### 10.9 Export formats
CSV, Excel, PDF pour tous les rapports.

### 10.10 Benchmarking
Comparaison avec des orgs similaires (anonymisé).

---

## Catégorie 11 — Dev tools et customisation

### 11.1 Feature flags
Activer/désactiver des features en bêta ou expérimentales par org ou user.

### 11.2 Workspace variables
Variables globales accessibles dans les workflows et intégrations.

### 11.3 Webhooks configuration
UI pour configurer les webhooks entrants/sortants.

### 11.4 Custom fields
Ajouter des champs custom à toutes les entités (user, contact, deal, task, etc.).

### 11.5 Scripting
Scripts custom (JavaScript/Python) pour étendre les workflows.

### 11.6 Plugins
Plugin system pour développer des extensions custom.

### 11.7 Theming
Custom CSS pour l'UI des users.

### 11.8 Email templates customization
Customiser les templates des emails transactionnels envoyés par SignApps.

### 11.9 White label
Option de marque blanche complète pour les resellers.

---

## Catégorie 12 — Notifications admin

### 12.1 Alert center
Vue centralisée des alertes pour l'admin : sécurité, performance, usage, facturation, incidents.

### 12.2 Real-time alerts
Notifications temps réel pour les events critiques (intrusion, fuite, outage).

### 12.3 Digest
Email quotidien ou hebdomadaire récapitulant les events importants.

### 12.4 Custom alert rules
Créer des règles custom : "Alerter si >100 fichiers téléchargés par un user en 1h".

### 12.5 Slack / Teams integration
Routing des alertes vers des channels Chat.

### 12.6 Escalation
Si une alerte n'est pas acknowledgée dans X temps, escalade au backup.

---

## Sources d'inspiration

### Aides utilisateur publiques
- **Okta Help** (help.okta.com) — SSO, MFA, lifecycle, governance.
- **Azure AD Docs** (docs.microsoft.com/azure/active-directory) — conditional access, PIM.
- **Google Workspace Admin Help** (support.google.com/a) — users, groups, security.
- **JumpCloud Support** (jumpcloud.com/support) — cloud directory, device management.
- **Auth0 Docs** (auth0.com/docs) — developer-friendly IAM.
- **Keycloak Docs** (keycloak.org/documentation) — open source IAM.
- **OWASP ASVS** (owasp.org/www-project-application-security-verification-standard) — sécurité des applications.
- **OWASP Top 10** (owasp.org/www-project-top-ten) — vulnérabilités web.
- **NIST Cybersecurity Framework** (nist.gov/cyberframework) — best practices sécurité.
- **CIS Benchmarks** (cisecurity.org) — configurations sécurisées.

### Projets open source permissifs
**Licences autorisées : MIT, Apache-2.0, BSD-2/3-Clause, ISC**
**Interdits : GPL-*, AGPL-*, LGPL-*, SSPL**

| Projet | Licence | Ce qu'on peut étudier |
|---|---|---|
| **Keycloak** (keycloak.org) | **Apache-2.0** | **À étudier**. Leader open source IAM. SAML, OIDC, social login. |
| **Authelia** (authelia.com) | **Apache-2.0** | Auth server léger, SSO, 2FA. |
| **Ory Kratos** (ory.sh/kratos) | **Apache-2.0** | Identity management moderne. Self-service UI. |
| **Ory Hydra** (ory.sh/hydra) | **Apache-2.0** | OAuth2/OIDC server. |
| **ZITADEL** (zitadel.com) | **Apache-2.0** | Cloud-native IAM en Go. Moderne, multi-tenant. |
| **Authentik** (goauthentik.io) | **MIT** | Identity provider Python. |
| **FreeIPA** | **GPL v3** | **INTERDIT**. Directory et auth Linux. |
| **LemonLDAP::NG** | **GPL v2** | **INTERDIT**. |
| **CAS (Apereo)** | **Apache-2.0** | Central Authentication Service. |
| **OpenLDAP** | **OpenLDAP Public License** (BSD-like) | Serveur LDAP libre. |
| **passport.js** (passportjs.org) | **MIT** | Library Node auth avec 500+ strategies. |
| **next-auth** (next-auth.js.org) | **ISC** | Auth pour Next.js. |
| **Clerk SDK** | **MIT** | Client SDKs. |
| **jose** (github.com/panva/jose) | **MIT** | JWT et JOSE en JS/TS. |
| **jsonwebtoken** (github.com/auth0/node-jsonwebtoken) | **MIT** | JWT library Node.js. |
| **bcrypt / argon2** | **MIT** | Password hashing. |
| **SimpleWebAuthn** (simplewebauthn.dev) | **MIT** | WebAuthn implementation. |
| **otplib** (github.com/yeojz/otplib) | **MIT** | TOTP/HOTP implementation. |
| **speakeasy** | **MIT** | Alternative TOTP. |
| **node-oidc-provider** | **MIT** | OIDC provider in Node.js. |
| **Casbin** (casbin.org) | **Apache-2.0** | RBAC/ABAC library multi-language. Excellent pour les permissions granulaires. |
| **OpenFGA** (openfga.dev) | **Apache-2.0** | Fine-grained authorization de Auth0. Inspiré de Google Zanzibar. |
| **Permify** (permify.co) | **Apache-2.0** | Alternative OpenFGA. |
| **Spicedb** (authzed.com/spicedb) | **Apache-2.0** | Permissions database moderne. |
| **PostgreSQL RLS** | PostgreSQL License | Row-Level Security pour les permissions DB. |

### Pattern d'implémentation recommandé
1. **Auth backend** : ZITADEL (Apache-2.0) ou Keycloak (Apache-2.0) pour l'IAM. Alternativement, custom avec `jose` (MIT) + `argon2` (MIT) pour les cas simples.
2. **SAML/OIDC** : Keycloak ou Ory Kratos (Apache-2.0) pour SSO externe.
3. **Permissions** : OpenFGA (Apache-2.0) ou Casbin (Apache-2.0) pour les autorisations granulaires.
4. **Password hashing** : Argon2id (MIT) recommandé, ou bcrypt en fallback.
5. **JWT** : jose (MIT) pour les JWT sécurisés.
6. **WebAuthn / Passkeys** : SimpleWebAuthn (MIT).
7. **TOTP** : otplib (MIT).
8. **CAPTCHA** : hCaptcha (service) ou reCAPTCHA.
9. **Breach detection** : HaveIBeenPwned API (K-anonymity).
10. **Audit logs** : append-only table en DB, ou service dédié (Datadog, Elastic).
11. **Session management** : Redis ou PostgreSQL pour le stockage. Cookies HTTP-only sécurisés.
12. **Device tracking** : fingerprinting éthique (IP + user-agent + geo). Stockage chiffré.
13. **SCIM** : implémentation SCIM 2.0 standard pour le provisioning externe.
14. **LDAP** : OpenLDAP ou client LDAP side (`ldapjs` MIT).

### Ce qu'il ne faut PAS faire
- **Pas de fork** de FreeIPA, LemonLDAP (GPL).
- **Pas de stockage de passwords en clair** nulle part.
- **Pas de MD5/SHA-1** pour le hashing.
- **Pas de JWT sans vérification de signature**.
- **Pas de CORS wildcard** sur les endpoints sensibles.
- **Respect strict RGPD** pour les PII.

---

## Assertions E2E clés (à tester)

- Création manuelle d'un user
- Import CSV de users
- Invitation par email et finalisation
- Login classique + 2FA
- Login SSO (SAML mock)
- Passkey / WebAuthn login
- Logout et révocation de session
- Changement de mot de passe
- Force 2FA par admin
- Création d'un rôle custom
- Assignation de rôle
- Permissions effectives calculées correctement
- Création d'un groupe et membership
- Dynamic group basé sur attribut
- Custom branding appliqué
- SCIM provisioning depuis IdP
- Audit logs visibles
- Export d'un user (RGPD)
- Suppression d'un compte
- Transfer of ownership au départ
- Sessions actives révocables
- API token créé et révocable
- Settings sauvegardés par module
- Dashboard admin avec KPIs
- Alert de sécurité déclenchée
- Restriction par feature flag
