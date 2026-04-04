# SignApps Domain Controller — Design Specification

**Date:** 2026-04-04
**Status:** Approved
**Scope:** New service `signapps-dc` + 4 crates (`ad-core`, `ldap-server`, `kerberos-kdc`, `dns-server`) + DNS extension in `signapps-securelink`

---

## 1. Objectif

Transformer `signapps-identity` en Domain Controller Active Directory complet, intégré dans l'écosystème signapps-platform. Le DC permet aux postes Windows/Linux de joindre un domaine, s'authentifier via Kerberos, résoudre les objets via LDAP, et appliquer des GPO — le tout alimenté par les tables PostgreSQL existantes.

## 2. Décisions architecturales

| Décision | Choix | Justification |
|----------|-------|---------------|
| Intégration | Dans signapps-platform, pas un repo séparé | Réutilise DB, crates, middleware existants |
| Déploiement | Un seul service `signapps-dc` (modèle Samba) | Cohésion domaine, un binaire à déployer |
| Base de données | Réutiliser les tables org-structure existantes | ~85% des concepts AD déjà modélisés |
| Protocole LDAP | Serveur complet RFC 4511, ASN.1/BER | Wire-compatible avec clients Windows natifs |
| Kerberos | KDC complet avec S4U2Self/Proxy, FAST, PKINIT | Jonction domaine + SSO complet |
| DNS | Extension de signapps-securelink (existant) | Le serveur DNS existe déjà sur :53 |
| Code externe | Zéro — tout from scratch, patterns inspirés des RFCs | Propriété intellectuelle totale |
| Ordre d'implémentation | ad-core → ldap-server → kerberos-kdc → dns → dc → smb | Dépendances naturelles |

## 3. Workspace Layout

```
crates/
  signapps-ad-core/             # Fondation AD : schema, DN, SID, GUID, filter→SQL, DirectoryEntry
  │  src/
  │  ├── schema/                # objectClass registry, attributeSyntax, OID
  │  ├── dn.rs                  # DN parsing/building (RFC 4514)
  │  ├── sid.rs                 # SID generation/parsing (S-1-5-21-...)
  │  ├── guid.rs                # objectGUID (UUID mapping)
  │  ├── entry.rs               # DirectoryEntry : l'objet central AD
  │  ├── filter.rs              # Compilation filtre LDAP → SQL paramétré
  │  ├── uac.rs                 # userAccountControl bit flags
  │  ├── acl.rs                 # Contrôle d'accès (delegations + policies)
  │  └── lib.rs
  │
  signapps-ldap-server/         # Protocole LDAP RFC 4511
  │  src/
  │  ├── codec/
  │  │   ├── ber.rs             # Encoder/decoder BER from scratch
  │  │   └── ldap_msg.rs        # Types LdapMessage, operations
  │  ├── ops/
  │  │   ├── bind.rs            # Simple Bind + SASL framework (GSSAPI)
  │  │   ├── search.rs          # Search avec scopes + filtres + paged results
  │  │   ├── write.rs           # Add / Modify / Delete / ModifyDN
  │  │   ├── compare.rs         # Compare operation
  │  │   └── extended.rs        # StartTLS, whoami, password modify
  │  ├── session.rs             # État de connexion LDAP
  │  ├── listener.rs            # TCP/TLS acceptor (tokio + rustls)
  │  └── lib.rs
  │
  signapps-kerberos-kdc/        # KDC Kerberos complet
  │  src/
  │  ├── asn1/                  # Types ASN.1 Kerberos from scratch
  │  ├── crypto/
  │  │   ├── aes_cts.rs         # AES256-CTS-HMAC-SHA1-96 (RFC 3962)
  │  │   ├── rc4_hmac.rs        # RC4-HMAC / ARCFOUR (legacy compat)
  │  │   ├── key_derivation.rs  # PBKDF2, string-to-key
  │  │   └── checksum.rs        # HMAC-SHA1, MD5 (legacy)
  │  ├── pac.rs                 # Privilege Attribute Certificate (MS-PAC)
  │  ├── handlers/
  │  │   ├── as_req.rs          # Authentication Service (AS-REQ → AS-REP)
  │  │   ├── tgs_req.rs         # Ticket Granting Service (TGS-REQ → TGS-REP)
  │  │   ├── s4u.rs             # S4U2Self, S4U2Proxy (constrained delegation)
  │  │   └── kpasswd.rs         # Password change (port 464)
  │  ├── keytab.rs              # Gestion des clés (krbtgt, service keys)
  │  ├── listener.rs            # UDP + TCP listener
  │  └── lib.rs
  │
  signapps-dns-server/          # Types DNS + client pour securelink
  │  src/
  │  ├── zone.rs                # Zone model (SOA, records)
  │  ├── provision.rs           # Auto-provisioning SRV records AD
  │  ├── dynamic.rs             # Dynamic update client (RFC 2136)
  │  └── lib.rs
  │
services/
  signapps-dc/                  # Le binaire Domain Controller
  │  src/
  │  ├── main.rs                # Multi-listener : 88 + 389 + 636 + 464
  │  ├── config.rs              # DcConfig (domain, realm, ports, TLS)
  │  └── health.rs              # /health endpoint Axum (monitoring)
  │  Cargo.toml
```

## 4. Modèle de données

### 4.1 Tables existantes réutilisées

| Table | objectClass AD | Champs clés |
|-------|---------------|-------------|
| `workforce_org_nodes` + closure | organizationalUnit, container | `parent_id` (hiérarchie), `node_type`, `attributes JSONB` |
| `workforce_org_node_types` | objectClass definitions | `code`, `allowed_children`, `schema JSONB` |
| `identity.users` + `core.persons` | user, contact | `username` (sAMAccountName), `email` (mail), `password_hash` |
| `workforce_org_groups` | group (security, distribution) | `group_type`, `filter JSONB` (dynamic) |
| `workforce_org_group_members` | member attribute | `member_type` (person/group/node) |
| `workforce_org_memberof` | memberOf (computed) | Cache de membership avec trigger |
| `workforce_org_policies` + links | Group Policy Objects | `domain`, `priority`, `settings JSONB`, `is_enforced` |
| `workforce_org_delegations` | Delegation of Control | `scope_node_id`, `permissions JSONB`, `expires_at` |
| `core.sites` | AD sites | `site_type`, geo coordinates |
| `core.org_trees` | Forest / Domain | `tree_type`, `root_node_id` |
| `mailserver.domains` | DNS domain | `name`, DKIM, SPF, DMARC |

### 4.2 Nouvelles tables (migrations 213-215)

```sql
-- Migration 213: AD domain configuration & SID
CREATE TABLE ad_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES identity.tenants(id),
    tree_id UUID NOT NULL REFERENCES core.org_trees(id),
    dns_name TEXT NOT NULL,                                -- example.com
    netbios_name TEXT NOT NULL,                            -- EXAMPLE
    domain_sid TEXT NOT NULL,                              -- S-1-5-21-xxx-yyy-zzz
    realm TEXT NOT NULL,                                   -- EXAMPLE.COM
    forest_root BOOLEAN DEFAULT false,
    domain_function_level INT DEFAULT 7,                   -- Win2016
    schema_version INT DEFAULT 1,
    config JSONB DEFAULT '{}',                             -- require_tls, max_clock_skew, etc.
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, dns_name)
);

-- Migration 214: Kerberos principal keys
CREATE TABLE ad_principal_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES ad_domains(id) ON DELETE CASCADE,
    principal_name TEXT NOT NULL,                          -- user@REALM ou krbtgt/REALM
    principal_type TEXT NOT NULL
        CHECK (principal_type IN ('user','computer','service','krbtgt')),
    key_version INT NOT NULL DEFAULT 1,                   -- kvno
    enc_type INT NOT NULL,                                -- 17=AES128, 18=AES256, 23=RC4
    key_data BYTEA NOT NULL,                              -- Chiffré AES-256-GCM at rest
    salt TEXT,
    entity_id UUID,                                       -- Lien vers users.id ou org_nodes.id
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, principal_name, enc_type, key_version)
);
CREATE INDEX idx_principal_keys_lookup ON ad_principal_keys(domain_id, principal_name);
CREATE INDEX idx_principal_keys_entity ON ad_principal_keys(entity_id);

-- Migration 215: DNS zones & records (lié à securelink)
CREATE TABLE ad_dns_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES ad_domains(id) ON DELETE CASCADE,
    zone_name TEXT NOT NULL,
    zone_type TEXT DEFAULT 'primary'
        CHECK (zone_type IN ('primary','stub','forwarder')),
    soa_serial BIGINT DEFAULT 1,
    soa_refresh INT DEFAULT 900,
    soa_retry INT DEFAULT 600,
    soa_expire INT DEFAULT 86400,
    soa_minimum INT DEFAULT 3600,
    allow_dynamic_update BOOLEAN DEFAULT true,
    scavenge_interval_hours INT DEFAULT 168,               -- 7 jours
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(domain_id, zone_name)
);

CREATE TABLE ad_dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES ad_dns_zones(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                                    -- @ ou _ldap._tcp.dc._msdcs
    record_type TEXT NOT NULL
        CHECK (record_type IN ('A','AAAA','SRV','CNAME','PTR','NS','TXT','MX','SOA')),
    rdata JSONB NOT NULL,                                  -- {"ip":"10.0.0.1"} ou {"target":"dc","port":389,...}
    ttl INT DEFAULT 3600,
    is_static BOOLEAN DEFAULT false,
    timestamp TIMESTAMPTZ,                                 -- NULL=static, date=dynamic (pour scavenging)
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_dns_records_lookup ON ad_dns_records(zone_id, name, record_type);
CREATE INDEX idx_dns_records_scavenge ON ad_dns_records(timestamp) WHERE timestamp IS NOT NULL;
```

### 4.3 Mapping attributs LDAP → colonnes existantes

| Attribut AD | Table source | Colonne |
|---|---|---|
| sAMAccountName | identity.users | username |
| userPrincipalName | calculé | {username}@{domain} |
| mail | identity.users | email |
| givenName | core.persons | first_name |
| sn | core.persons | last_name |
| displayName | core.persons | first_name + last_name |
| department | identity.users | department |
| title | identity.users | job_title |
| telephoneNumber | identity.users | phone |
| memberOf | workforce_org_memberof | computed |
| objectGUID | table source | id (UUID) |
| objectSid | attributes JSONB | {"sid": "S-1-5-21-..."} |
| userAccountControl | attributes JSONB | {"uac": 512} |
| whenCreated | table source | created_at |
| whenChanged | table source | updated_at |
| homeDirectory, scriptPath, profilePath | attributes JSONB | extensible |
| unicodePwd | identity.users | password_hash (Argon2) + ad_principal_keys (NT hash chiffré) |

### 4.4 DN dynamique

Le Distinguished Name est calculé en temps réel depuis la closure table, jamais stocké :

```
resolve_dn(node_id, domain_suffix):
  1. SELECT ancestor.name, ancestor.node_type
     FROM workforce_org_closure c
     JOIN workforce_org_nodes ancestor ON ancestor.id = c.ancestor_id
     WHERE c.descendant_id = $node_id
     ORDER BY c.depth DESC
  2. Construire: OU=Backend,OU=Engineering,DC=example,DC=com
```

## 5. DirectoryEntry — l'objet central

```rust
pub struct DirectoryEntry {
    pub guid: Uuid,                              // objectGUID
    pub sid: SecurityIdentifier,                 // objectSid
    pub dn: DistinguishedName,                   // Calculé dynamiquement
    pub object_classes: Vec<String>,             // ["top","person","organizationalPerson","user"]
    pub attributes: HashMap<String, Vec<AttributeValue>>,
    pub uac: UserAccountControl,                 // Bit flags
    pub lifecycle: LifecycleState,               // live / recycled / tombstone
    pub created: DateTime<Utc>,
    pub modified: DateTime<Utc>,
}
```

Construit par `ad-core` en joignant les tables existantes. Les 3 serveurs (LDAP, KDC, DNS) n'accèdent jamais à la DB directement — ils passent par `ad-core`.

## 6. Serveur LDAP (RFC 4511)

### 6.1 Codec BER from scratch

Sous-ensemble ASN.1 suffisant pour LDAP :
- SEQUENCE, SET, OCTET STRING, INTEGER, BOOLEAN, ENUMERATED
- Context-tagged [0]-[n] pour les discriminants d'opérations LDAP

### 6.2 Opérations

| Opération | Handler | Tables touchées |
|---|---|---|
| BindRequest (simple) | `ops/bind.rs` | identity.users (password_hash Argon2) |
| BindRequest (SASL/GSSAPI) | `ops/bind.rs` → kerberos-kdc | Decrypt ticket Kerberos directement |
| SearchRequest | `ops/search.rs` → ad-core filter→SQL | workforce_org_nodes, identity.users, etc. |
| AddRequest | `ops/write.rs` → ad-core | INSERT dans la table appropriée |
| ModifyRequest | `ops/write.rs` → ad-core | UPDATE attributs |
| DeleteRequest | `ops/write.rs` → ad-core | lifecycle_state = 'tombstone' |
| ModifyDNRequest | `ops/write.rs` → ad-core | UPDATE parent_id + recalcul closure |
| CompareRequest | `ops/compare.rs` | Comparison d'attribut |
| ExtendedRequest | `ops/extended.rs` | StartTLS, whoami, password modify |

### 6.3 Search : compilation filtre → SQL

```
Filtre LDAP (ASN.1 structuré)
    ↓ ad-core::filter::compile()
SQL paramétré ($1, $2, ... — jamais de concaténation)
    ↓ sqlx::query_as()
Vec<DirectoryEntry>
    ↓ entry::to_ldap_attributes()
SearchResultEntry (BER encodé)
```

Scopes LDAP → closure table :
- baseObject : `WHERE id = $base_dn_id`
- singleLevel : `WHERE parent_id = $base_dn_id`
- wholeSubtree : `JOIN workforce_org_closure c ON c.ancestor_id = $base_dn_id`

### 6.4 Session state

```rust
pub struct LdapSession {
    pub id: Uuid,
    pub bound_dn: Option<DistinguishedName>,
    pub bound_user_id: Option<Uuid>,
    pub auth_method: AuthMethod,             // Simple, SASL/GSSAPI, SASL/EXTERNAL
    pub is_tls: bool,
    pub controls: Vec<LdapControl>,          // Paged results, sort, etc.
    pub remote_addr: SocketAddr,
    pub connected_at: Instant,
}
```

### 6.5 Ports

- `:389` — LDAP (avec StartTLS upgrade)
- `:636` — LDAPS (TLS obligatoire)

## 7. KDC Kerberos

### 7.1 Flux AS-REQ (obtenir un TGT)

1. Client envoie AS-REQ(principal=user@REALM)
2. KDC charge la clé user depuis `ad_principal_keys`
3. Vérifie PA-ENC-TIMESTAMP (decrypt avec user key, check ±5min)
4. Construit TGT : encrypt avec clé krbtgt, inclut PAC (groups, SIDs)
5. Retourne AS-REP(TGT + session key chiffrée avec clé user)

### 7.2 Flux TGS-REQ (obtenir un service ticket)

1. Client envoie TGS-REQ(TGT, SPN=ldap/dc.example.com)
2. KDC decrypt TGT avec clé krbtgt, valide expiry + PAC
3. Charge la clé service depuis `ad_principal_keys`
4. Construit service ticket : encrypt avec service key, copie PAC
5. Retourne TGS-REP(service ticket + new session key)

### 7.3 PAC (Privilege Attribute Certificate)

```rust
pub struct Pac {
    pub logon_info: KerbValidationInfo,      // SIDs, groups, domain info
    pub server_checksum: PacSignature,
    pub kdc_checksum: PacSignature,
    pub client_info: PacClientInfo,
    pub upn_dns_info: UpnDnsInfo,
}

pub struct KerbValidationInfo {
    pub effective_name: String,               // sAMAccountName
    pub full_name: String,                    // displayName
    pub user_id: u32,                         // RID
    pub primary_group_id: u32,                // 513 = Domain Users
    pub group_ids: Vec<GroupMembership>,       // SIDs relatifs
    pub logon_domain_id: SecurityIdentifier,  // Domain SID
    pub extra_sids: Vec<SidAndAttributes>,    // Universal groups, etc.
}
```

Construit depuis : `identity.users` + `core.persons` + `workforce_org_memberof` + `ad_domains`.

### 7.4 Crypto

| EncType | ID | Implémentation |
|---|---|---|
| AES256-CTS-HMAC-SHA1-96 | 18 | `aes` + `hmac` + `sha1` crates (primitives pures) |
| AES128-CTS-HMAC-SHA1-96 | 17 | idem |
| RC4-HMAC (ARCFOUR) | 23 | `rc4` crate — legacy compat, désactivé par défaut |

Tout assemblé from scratch — les crates fournissent les primitives crypto, on implémente CTS mode et les dérivations RFC 3962.

### 7.5 Extensions

- S4U2Self / S4U2Proxy (MS-SFU) — constrained delegation
- FAST (RFC 6113) — armored pre-authentication
- PKINIT (RFC 4556) — smart card auth
- kpasswd (RFC 3244) — port 464

### 7.6 Ports

- `:88/udp` + `:88/tcp` — KDC (AS-REQ, TGS-REQ)
- `:464/tcp` — kpasswd

## 8. DNS — Extension de signapps-securelink

### 8.1 Architecture

Le serveur DNS **reste dans signapps-securelink** (port 53). Le crate `signapps-dns-server` est un client/helper, pas un serveur.

```
signapps-dc (Domain Controller)
  └── Appelle l'API securelink pour provisionner les records AD

signapps-securelink (DNS :53) — existant, étendu avec :
  ├── Résolveur + cache + ad-block     (déjà là)
  ├── Records custom                   (déjà là)
  ├── [NEW] Zones autoritaires AD      (lecture depuis ad_dns_zones/records)
  ├── [NEW] Dynamic updates RFC 2136   (machines qui s'enregistrent)
  ├── [NEW] AXFR/IXFR                  (zone transfers)
  └── [NEW] Scavenging                 (nettoyage records dynamiques)
```

### 8.2 Auto-provisioning

À la création d'un domaine AD, provisionnement automatique :
- `_ldap._tcp.dc._msdcs.EXAMPLE.COM SRV 0 100 389 dc.example.com`
- `_kerberos._tcp.dc._msdcs.EXAMPLE.COM SRV 0 100 88 dc.example.com`
- `_gc._tcp.EXAMPLE.COM SRV 0 100 3268 dc.example.com`
- `_kpasswd._tcp.EXAMPLE.COM SRV 0 100 464 dc.example.com`
- `dc.example.com A {ip_du_serveur}`

### 8.3 Lien avec mailserver.domains

Un domaine mail `example.com` et un domaine AD `example.com` partagent la même entrée `mailserver.domains`. Le domaine AD ajoute ses records SRV/A via les tables `ad_dns_zones/records`, tandis que le mail conserve ses MX/SPF/DKIM/DMARC. Le DNS securelink sert les deux depuis les mêmes zones.

## 9. Flux domain join Windows (end-to-end)

### 13 étapes

| # | Protocole | Action | Module | Tables |
|---|---|---|---|---|
| 1 | DNS | SRV lookup `_ldap._tcp.dc._msdcs` | securelink | ad_dns_records |
| 2 | DNS | SRV lookup `_kerberos._tcp` | securelink | ad_dns_records |
| 3 | DNS | A record du DC | securelink | ad_dns_records |
| 4 | LDAP | Simple Bind (admin creds) | ldap-server/bind.rs | identity.users |
| 5 | LDAP | Search rootDSE | ldap-server/search.rs | virtuel (mémoire) |
| 6 | LDAP | Search domain object | ldap-server/search.rs | ad_domains |
| 7 | Kerberos | AS-REQ (admin TGT) | kerberos-kdc/as_req.rs | ad_principal_keys |
| 8 | Kerberos | TGS-REQ (ldap/ service ticket) | kerberos-kdc/tgs_req.rs | ad_principal_keys |
| 9 | LDAP | SASL/GSSAPI Bind | ldap-server/bind.rs → kdc | ticket validation |
| 10 | LDAP | Add computer account | ldap-server/write.rs | workforce_org_nodes |
| 11 | LDAP | Modify (SPN, UAC, pwd) | ldap-server/write.rs | ad_principal_keys, attributes |
| 12 | DNS | Dynamic update (A record) | securelink | ad_dns_records |
| 13 | Kerberos | AS-REQ (machine TGT) | kerberos-kdc/as_req.rs | ad_principal_keys |

## 10. Sécurité

### 10.1 Mitigations

| Vecteur | Mitigation |
|---|---|
| LDAP injection | Filtres ASN.1/BER typés + sqlx paramétré ($1, $2) |
| Kerberoasting | AES256 par défaut, RC4 désactivé sauf opt-in |
| AS-REP roasting | Pre-auth obligatoire (PA-ENC-TIMESTAMP) |
| Golden ticket | Clés krbtgt chiffrées AES-256-GCM at rest, rotation admin |
| Silver ticket | Rotation auto clés machine (30 jours) |
| LDAP anonymous | rootDSE seulement, zéro accès objets |
| Password spray | Rate limiting (signapps-cache existant) + account lockout policy |
| Replay attack | Clock skew ±5min + replay cache mémoire |
| TLS downgrade | StartTLS sur :389, TLS natif sur :636, option require_tls |
| DNS poisoning | TSIG sur dynamic updates, auth machine requise |

### 10.2 Stockage secrets

- `ad_principal_keys.key_data` : BYTEA chiffré AES-256-GCM, master key dérivée via HKDF(JWT_SECRET + domain_sid)
- `identity.users.password_hash` : Argon2id (existant)
- NT Hash (RC4-HMAC) : dérivé au changement de mot de passe, stocké chiffré dans ad_principal_keys
- Clé krbtgt : rotation recommandée tous les 180 jours

### 10.3 ACL LDAP

Chaque opération passe par `ad-core::acl::check_access()` qui résout :
1. Admin domaine → tout autorisé
2. Delegations (`workforce_org_delegations`) pour le scope du target
3. Policies de sécurité (`workforce_org_policies`, domain='security')
4. Default deny

## 11. Phases de livraison

### Phase 1 — `signapps-ad-core` (fondation)

Modules : dn.rs, sid.rs, guid.rs, uac.rs, schema/, filter.rs, entry.rs, acl.rs
Migrations : 213 (ad_domains), 214 (ad_principal_keys), 215 (ad_dns_zones/records)
Test : `cargo test -p signapps-ad-core`

### Phase 2 — `signapps-ldap-server` (protocole LDAP)

Modules : codec/ber.rs, codec/ldap_msg.rs, listener.rs, session.rs, ops/*
Test : `ldapsearch -H ldap://localhost:389 -D "CN=admin,DC=example,DC=com" -w password -b "DC=example,DC=com" "(objectClass=user)"`

### Phase 3 — `signapps-kerberos-kdc` (authentification)

Modules : asn1/, crypto/, pac.rs, handlers/*, keytab.rs, listener.rs
Test : `kinit admin@EXAMPLE.COM` + `kvno ldap/dc.example.com@EXAMPLE.COM`

### Phase 4 — `signapps-dns-server` (extension securelink)

Modules : zone.rs, provision.rs, dynamic.rs + extension securelink
Test : `nslookup -type=SRV _ldap._tcp.dc._msdcs.EXAMPLE.COM localhost`

### Phase 5 — `signapps-dc` (intégration + domain join)

Modules : main.rs, config.rs, health.rs + SASL/GSSAPI bridge
Test : `netdom join WORKSTATION /domain:EXAMPLE.COM /userd:admin /passwordd:*`

### Phase 6 — SMB/SYSVOL (GPO Windows)

Modules : signapps-smb-sysvol crate, SMB2/3 minimal (:445), SYSVOL/NETLOGON shares
Test : `gpupdate /force` sur un poste joint

## 12. Dépendances Rust (nouvelles)

| Crate | Usage | Raison |
|---|---|---|
| `tokio-rustls` | TLS pour LDAPS (:636) | Déjà pattern dans le projet |
| `aes` | Primitives AES | Kerberos AES-CTS + chiffrement at rest |
| `hmac` + `sha1` | HMAC-SHA1 | Kerberos checksums |
| `rc4` | RC4 stream cipher | Legacy NT hash / RC4-HMAC (opt-in) |
| `md4` | MD4 hash | NT hash derivation |
| `rand` | Random bytes | Session keys, nonces |
| `num-bigint` | (optionnel) | PKINIT / DH key exchange |

Toutes les crates sont des **primitives cryptographiques** — zéro code protocolaire externe. L'assemblage BER, LDAP, Kerberos, DNS est écrit from scratch.

## 13. Variables d'environnement

```bash
DC_DOMAIN=example.com                    # Domaine DNS
DC_REALM=EXAMPLE.COM                     # Realm Kerberos (uppercase)
DC_NETBIOS=EXAMPLE                       # Nom NetBIOS
DC_LDAP_PORT=389                         # Port LDAP
DC_LDAPS_PORT=636                        # Port LDAPS
DC_KDC_PORT=88                           # Port Kerberos
DC_KPASSWD_PORT=464                      # Port kpasswd
DC_TLS_CERT=/path/to/cert.pem           # Certificat TLS
DC_TLS_KEY=/path/to/key.pem             # Clé privée TLS
DC_REQUIRE_TLS=false                     # Forcer TLS sur LDAP
DC_MAX_CLOCK_SKEW=300                    # Tolérance Kerberos (secondes)
DATABASE_URL=postgres://...              # Partagé avec identity
```
