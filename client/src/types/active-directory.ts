// ── Domain ──

export interface AdDomain {
  id: string;
  tenant_id: string;
  tree_id: string;
  dns_name: string;
  netbios_name: string;
  domain_sid: string;
  realm: string;
  forest_root: boolean;
  domain_function_level: number;
  schema_version: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  domain_type?: string;
  ad_enabled?: boolean;
  mail_enabled?: boolean;
  dhcp_enabled?: boolean;
  pxe_enabled?: boolean;
  ntp_enabled?: boolean;
  cert_mode?: string;
  is_active?: boolean;
}

export interface CreateDomainRequest {
  dns_name: string;
  netbios_name?: string;
  domain_type?: string;
  ad_enabled?: boolean;
  mail_enabled?: boolean;
  dhcp_enabled?: boolean;
  pxe_enabled?: boolean;
  tree_id?: string;
  admin_user_id?: string;
  admin_password?: string;
}

export interface DomainCreationResult {
  domain_id: string;
  dns_name: string;
  realm: string;
  netbios_name: string;
  domain_sid: string;
}

// ── Principal Keys ──

export interface AdPrincipalKey {
  id: string;
  domain_id: string;
  principal_name: string;
  principal_type: "user" | "computer" | "service" | "krbtgt";
  key_version: number;
  enc_type: number;
  salt?: string;
  entity_id?: string;
  created_at: string;
}

export const ENC_TYPE_LABELS: Record<number, string> = {
  3: "DES-CBC-MD5",
  17: "AES128-CTS",
  18: "AES256-CTS",
  23: "RC4-HMAC",
};

// ── DNS ──

export interface AdDnsZone {
  id: string;
  domain_id: string;
  zone_name: string;
  zone_type: "primary" | "stub" | "forwarder";
  soa_serial: number;
  soa_refresh: number;
  soa_retry: number;
  soa_expire: number;
  soa_minimum: number;
  allow_dynamic_update: boolean;
  scavenge_interval_hours: number;
  created_at: string;
}

export interface AdDnsRecord {
  id: string;
  zone_id: string;
  name: string;
  record_type:
    | "A"
    | "AAAA"
    | "SRV"
    | "CNAME"
    | "PTR"
    | "NS"
    | "TXT"
    | "MX"
    | "SOA";
  rdata: Record<string, unknown>;
  ttl: number;
  is_static: boolean;
  timestamp?: string;
  created_at: string;
}

export interface CreateDnsRecordRequest {
  name: string;
  record_type: string;
  rdata: Record<string, unknown>;
  ttl?: number;
  is_static?: boolean;
}

// ── Computer Accounts ──

export interface ComputerAccount {
  id: string;
  name: string;
  dns_hostname?: string;
  os?: string;
  os_version?: string;
  last_logon?: string;
  created_at: string;
}

// ── DC Status ──

export interface DcStatus {
  service: string;
  status: string;
  version: string;
  domain?: string;
  realm?: string;
  ldap_port?: number;
  kdc_port?: number;
  uptime_seconds?: number;
  connections?: {
    ldap: number;
    kerberos: number;
  };
}

// ── GPO ──

export interface GroupPolicyObject {
  id: string;
  display_name: string;
  version: number;
  enabled: boolean;
  machine_enabled: boolean;
  user_enabled: boolean;
  linked_ous: string[];
}

// ── Certificates ──

export interface InfraCertificate {
  id: string;
  domain_id: string;
  subject: string;
  issuer: string;
  cert_type: "root_ca" | "intermediate_ca" | "server" | "client" | "wildcard";
  not_before: string;
  not_after: string;
  auto_renew: boolean;
  san: string[];
  fingerprint_sha256?: string;
  status: "active" | "expired" | "revoked" | "pending";
  created_at: string;
}

// ── DHCP ──

export interface DhcpScope {
  id: string;
  domain_id: string;
  site_id?: string;
  name: string;
  subnet: string;
  range_start: string;
  range_end: string;
  gateway?: string;
  dns_servers: string[];
  lease_duration_hours: number;
  is_active: boolean;
}

export interface DhcpLease {
  id: string;
  scope_id: string;
  ip_address: string;
  mac_address: string;
  hostname?: string;
  lease_start: string;
  lease_end: string;
  is_active: boolean;
}

// ── Deployment ──

export interface DeployProfile {
  id: string;
  domain_id: string;
  name: string;
  description?: string;
  os_type?: string;
  os_version?: string;
  packages: unknown[];
  target_ou?: string;
  is_default: boolean;
  sort_order: number;
}

export interface DeployHistory {
  id: string;
  profile_id: string;
  hostname?: string;
  status:
    | "pending"
    | "booting"
    | "installing"
    | "configuring"
    | "completed"
    | "failed";
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  created_at: string;
}
