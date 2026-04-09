---
name: admin-settings-debug
description: Use when debugging the Admin & Settings module. Spec at docs/product-specs/23-admin-settings.md. Covers user management, RBAC, LDAP/AD integration, SSO (SAML/OIDC), organization settings, security policies, audit logs, backup/restore. Backend via signapps-identity (port 3001) for auth and signapps-gateway (port 3099) for orchestration.
---

# Admin & Settings — Debug Skill

## Source of truth
**`docs/product-specs/23-admin-settings.md`**

## Code map
- **Backend auth**: `services/signapps-identity/` — port **3001** (users, roles, LDAP, MFA, JWT)
- **Backend gateway**: `services/signapps-gateway/` — port **3099**
- **Frontend**: `client/src/app/admin/` or `client/src/app/settings/`, components `admin/` or `settings/`

## Key journeys
1. Create user → assign role → user can login
2. Configure LDAP/AD connector → sync users
3. Enable SSO (SAML) → test redirect flow
4. Set security policies (password rules, MFA, session timeout)
5. View audit logs → export
6. Backup database → restore from backup

## Common bug patterns (anticipated)
1. **JWT token not blacklisted on password change** — check signapps-cache
2. **LDAP sync creates duplicates** — match on email, not just username
3. **Role permission matrix inconsistent** — RBAC table vs middleware check
4. **SSO redirect loop** — callback URL mismatch
5. **MFA TOTP drift** — allow ±1 window for time skew

## Dependencies
- **Keycloak** or **ZITADEL** (Apache-2.0) ✅ for IAM
- **jsonwebtoken** (MIT) for JWT ✅
- **speakeasy** or **otplib** (MIT) for TOTP ✅

## Historique
- **2026-04-09** : Skill créé (skeleton).
