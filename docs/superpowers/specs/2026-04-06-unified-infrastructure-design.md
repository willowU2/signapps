# Infrastructure Unifiee Domain-Centric — Design Specification

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Registre de domaines unifie, CA interne, DHCP, NTP, profils de deploiement, UI enrichie

---

## 1. Objectif

Unifier la gestion des domaines AD, DNS, mail, certificats, DHCP, NTP, PXE et deploiement logiciel/OS autour d'une seule entite pivot : le **domaine**. Creer un domaine provisionne automatiquement tous les sous-systemes sans duplication.

## 2. Decisions architecturales

| Decision | Choix |
|----------|-------|
| Modele | Domain-Centric — le domaine orchestre tout |
| Certificats | Hybride intelligent — ACME (public) / CA interne (prive) |
| DHCP + NTP | Dans signapps-securelink (avec DNS) |
| Deploiement | Profils combinant OS + logiciels + GPO + OU cible |
| UI | Pages AD enrichies (global) + onglets org-structure (contextuel) |
| Migration | Vues SQL pour backward compatibility |

## 3. Domain Registry — source de verite unique

### Table `infrastructure.domains`

Remplace `ad_domains` + `mailserver.domains` :

```sql
CREATE SCHEMA IF NOT EXISTS infrastructure;

CREATE TABLE infrastructure.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id),
    dns_name TEXT NOT NULL,
    netbios_name TEXT,
    domain_type TEXT DEFAULT 'full'
        CHECK (domain_type IN ('full', 'dns_only', 'mail_only', 'internal')),
    -- Feature flags
    ad_enabled BOOLEAN DEFAULT false,
    mail_enabled BOOLEAN DEFAULT false,
    dhcp_enabled BOOLEAN DEFAULT false,
    pxe_enabled BOOLEAN DEFAULT false,
    ntp_enabled BOOLEAN DEFAULT true,
    -- AD
    domain_sid TEXT,
    realm TEXT,
    forest_root BOOLEAN DEFAULT false,
    domain_function_level INT DEFAULT 7,
    tree_id UUID,
    -- Certificates
    cert_mode TEXT DEFAULT 'auto'
        CHECK (cert_mode IN ('auto', 'acme', 'internal_ca', 'manual', 'none')),
    ca_certificate TEXT,
    ca_private_key_encrypted BYTEA,
    -- Mail
    dkim_private_key TEXT,
    dkim_selector VARCHAR(63) DEFAULT 'signapps',
    spf_record TEXT,
    dmarc_policy VARCHAR(10) DEFAULT 'none',
    -- Config
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, dns_name)
);

CREATE INDEX idx_infra_domains_tenant ON infrastructure.domains(tenant_id);
CREATE INDEX idx_infra_domains_dns ON infrastructure.domains(dns_name);
```

### Backward-compatible views

```sql
CREATE OR REPLACE VIEW ad_domains AS
SELECT id, tenant_id, tree_id, dns_name, netbios_name, domain_sid,
       realm, forest_root, domain_function_level, config,
       1 AS schema_version, created_at, updated_at
FROM infrastructure.domains WHERE ad_enabled = true;
```

## 4. Certificate Management

### Table `infrastructure.certificates`

```sql
CREATE TABLE infrastructure.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    issuer TEXT NOT NULL,
    cert_type TEXT NOT NULL
        CHECK (cert_type IN ('root_ca', 'intermediate_ca', 'server', 'client', 'wildcard')),
    certificate TEXT NOT NULL,
    private_key_encrypted BYTEA,
    not_before TIMESTAMPTZ NOT NULL,
    not_after TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN DEFAULT true,
    san TEXT[] DEFAULT '{}',
    serial_number TEXT,
    fingerprint_sha256 TEXT,
    status TEXT DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'revoked', 'pending')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_certs_domain ON infrastructure.certificates(domain_id);
CREATE INDEX idx_certs_expiry ON infrastructure.certificates(not_after) WHERE status = 'active';
```

### Auto-provisioning logic

```
is_public_domain(dns_name):
  → ends with .com, .fr, .net, .org, .io, .dev, etc.

is_internal_domain(dns_name):
  → ends with .local, .corp, .internal, .lan, .home, .test
  → OR is RFC 1918 reverse zone

create_domain(dns_name):
  if is_public_domain(dns_name):
    cert_mode = 'acme'
    → Create DNS-01 challenge via securelink
    → Obtain Let's Encrypt cert
    → Auto-renew at J-30
  else:
    cert_mode = 'internal_ca'
    → Generate RSA 4096 CA root
    → Issue server cert for DC (LDAPS, HTTPS)
    → Issue wildcard *.{dns_name}
    → Distribute CA via GPO auto-enrollment
```

## 5. DHCP Service (in signapps-securelink)

### Tables

```sql
CREATE TABLE infrastructure.dhcp_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    site_id UUID REFERENCES core.sites(id),
    name TEXT NOT NULL,
    subnet TEXT NOT NULL,
    range_start TEXT NOT NULL,
    range_end TEXT NOT NULL,
    gateway TEXT,
    dns_servers TEXT[] DEFAULT '{}',
    ntp_servers TEXT[] DEFAULT '{}',
    domain_name TEXT,
    lease_duration_hours INT DEFAULT 8,
    pxe_server TEXT,
    pxe_bootfile TEXT,
    options JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE infrastructure.dhcp_leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_id UUID NOT NULL REFERENCES infrastructure.dhcp_scopes(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    mac_address TEXT NOT NULL,
    hostname TEXT,
    computer_id UUID,
    lease_start TIMESTAMPTZ NOT NULL,
    lease_end TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(scope_id, ip_address)
);

CREATE INDEX idx_leases_scope ON infrastructure.dhcp_leases(scope_id);
CREATE INDEX idx_leases_mac ON infrastructure.dhcp_leases(mac_address);
CREATE INDEX idx_leases_active ON infrastructure.dhcp_leases(lease_end) WHERE is_active = true;

CREATE TABLE infrastructure.dhcp_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_id UUID NOT NULL REFERENCES infrastructure.dhcp_scopes(id) ON DELETE CASCADE,
    mac_address TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    hostname TEXT,
    description TEXT,
    computer_id UUID,
    UNIQUE(scope_id, mac_address)
);
```

### DHCP ↔ DNS integration

Quand un bail est accorde :
1. `dhcp_leases` INSERT
2. DNS dynamic update : A record `{hostname}.{domain}` → `{ip_address}`
3. DNS reverse : PTR record `{reverse_ip}.in-addr.arpa` → `{hostname}.{domain}`
4. Si la machine a un `computer_id` (compte AD), mettre a jour `lastLogon`

### DHCP ↔ PXE integration

Options DHCP pour PXE :
- Option 66 (Next Server) : IP du serveur PXE
- Option 67 (Bootfile) : `pxe_bootfile` du scope
- Option 43 (Vendor-specific) : pour iPXE chainloading

### NTP integration

- Option 42 (NTP Servers) : IP du serveur NTP (securelink)
- Le serveur NTP ecoute UDP 123 dans signapps-securelink
- Synchro upstream configurable dans `infrastructure.domains.config.ntp`

## 6. NTP Service (in signapps-securelink)

### Ports

- UDP 123 — NTP server

### Configuration

Stockee dans `infrastructure.domains.config`:

```json
{
  "ntp": {
    "enabled": true,
    "upstream": ["pool.ntp.org", "time.google.com"],
    "stratum": 3,
    "restrict_subnet": "192.168.0.0/16",
    "max_drift_ms": 500
  }
}
```

### Integration Kerberos

Le DC verifie la synchro NTP avant d'accepter les tickets :
- `DC_MAX_CLOCK_SKEW` (default 300s) compare avec le timestamp NTP
- Si le client est hors tolerance, le KDC retourne `KRB_AP_ERR_SKEW`

## 7. Profils de deploiement

### Tables

```sql
CREATE TABLE infrastructure.deploy_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES infrastructure.domains(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    -- OS
    os_type TEXT CHECK (os_type IN ('windows', 'linux', 'macos', 'custom')),
    os_version TEXT,
    os_image_url TEXT,
    os_config JSONB DEFAULT '{}',
    -- Packages
    packages JSONB DEFAULT '[]',
    -- Post-install
    target_ou TEXT,
    gpo_ids UUID[] DEFAULT '{}',
    post_install_scripts TEXT[] DEFAULT '{}',
    -- PXE
    pxe_boot_image TEXT,
    pxe_menu_label TEXT,
    -- Network
    dhcp_scope_id UUID REFERENCES infrastructure.dhcp_scopes(id),
    vlan_id INT,
    -- Meta
    is_default BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE infrastructure.deploy_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES infrastructure.deploy_profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL
        CHECK (target_type IN ('org_node', 'group', 'mac_address', 'ip_range')),
    target_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(profile_id, target_type, target_id)
);

CREATE TABLE infrastructure.deploy_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES infrastructure.deploy_profiles(id),
    computer_id UUID,
    mac_address TEXT,
    hostname TEXT,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'booting', 'installing', 'configuring', 'completed', 'failed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    log TEXT
);
```

## 8. Flux de provisionnement automatique

```
Creer domaine "corp.local" (domain_type = 'full')
  │
  ├─ AD: SID, realm, krbtgt keys, admin keys
  ├─ DNS: zone + SRV records
  ├─ Certs: CA root + DC cert + wildcard
  ├─ Mail: DKIM + SPF + DMARC
  ├─ DHCP: scope 192.168.1.0/24 par defaut
  ├─ NTP: upstream pool.ntp.org
  └─ Deploy: profil "Standard" par defaut

Creer domaine "example.com" (domain_type = 'full')
  │
  ├─ AD: SID, realm, krbtgt keys
  ├─ DNS: zone + SRV records
  ├─ Certs: ACME Let's Encrypt (DNS-01)
  ├─ Mail: DKIM + SPF + DMARC
  ├─ DHCP: optionnel (si dhcp_enabled)
  ├─ NTP: optionnel (si ntp_enabled)
  └─ Deploy: profil "Standard" par defaut
```

## 9. UI

### Pages AD enrichies (global)

| Sous-page | Route | Contenu |
|-----------|-------|---------|
| Dashboard | `/admin/active-directory` | Stats, DC status, cert expiration alerts |
| Domaines | `/admin/active-directory/domains` | CRUD domaines unifies (AD+DNS+Mail+DHCP) |
| DNS | `/admin/active-directory/dns` | Zones + records |
| Certificats | `/admin/active-directory/certificates` | CA, certs emis, renouvellement, revocation |
| DHCP | `/admin/active-directory/dhcp` | Scopes, baux actifs, reservations, stats |
| Deploiement | `/admin/active-directory/deployment` | Profils, images OS, packages, historique |
| Kerberos | `/admin/active-directory/kerberos` | Principals, rotation cles |
| Ordinateurs | `/admin/active-directory/computers` | Enrichi : bail DHCP, cert machine, profil |
| GPO | `/admin/active-directory/gpo` | Enrichi : deploy policies, cert enrollment |
| Securite | `/admin/active-directory/security` | Audit, NTP sync status, cert health |

### Onglets org-structure (contextuel)

| Type noeud | Onglets ajoutes |
|------------|-----------------|
| Racine | Certificats CA, DHCP global, NTP config |
| Site | DHCP scope du site, NTP stratum |
| Departement | Profils deploiement assignes |
| Computer | Bail DHCP, Certificat machine, Profil applique, NTP sync |

## 10. Services impactes

| Service | Modification |
|---------|-------------|
| signapps-dc | Lit `infrastructure.domains` au lieu de `ad_domains` |
| signapps-securelink | +DHCP (port 67/68) +NTP (port 123) |
| signapps-mail | Lit `infrastructure.domains` au lieu de `mailserver.domains` |
| signapps-proxy | Lit certificats depuis `infrastructure.certificates` |
| signapps-pxe | Lit profils depuis `infrastructure.deploy_profiles` |
| signapps-workforce | Handlers AD utilisent le domain registry unifie |
| Frontend | 3 nouvelles pages + onglets enrichis |

## 11. Migrations

- Migration 218: `CREATE SCHEMA infrastructure` + tables domains, certificates
- Migration 219: tables DHCP (scopes, leases, reservations)
- Migration 220: tables deploy (profiles, assignments, history)
- Migration 221: vues backward-compatible (`ad_domains`, `mailserver.domains`)
- Migration 222: migration des donnees existantes vers infrastructure.domains
