/**
 * Companies API — Gestion des entreprises et affiliations
 *
 * Endpoints sous /companies et /persons, servis par le service Identity (port 3001).
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.IDENTITY);

// ============================================================================
// Types — Company
// ============================================================================

export interface Company {
  id: string;
  tenant_id: string;
  name: string;
  company_type: "internal" | "client" | "supplier" | "partner";
  legal_name?: string;
  siren?: string;
  siret?: string;
  vat_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  website?: string;
  logo_url?: string;
  industry?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Types — Person-Company Affiliation
// ============================================================================

export interface PersonCompany {
  id: string;
  person_id: string;
  company_id: string;
  role_in_company: string;
  job_title?: string;
  department?: string;
  is_primary?: boolean;
  start_date?: string;
  end_date?: string;
  portal_access?: boolean;
  portal_modules?: string[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Types — Login Context
// ============================================================================

export interface LoginContextDisplay {
  id: string;
  context_type: "employee" | "client" | "supplier" | "partner";
  company_id: string;
  company_name: string;
  company_logo?: string;
  role_in_company: string;
  job_title?: string;
  label: string;
  icon?: string;
  color?: string;
  last_used_at?: string;
}

// ============================================================================
// Types — Requests
// ============================================================================

export interface CreateCompanyRequest {
  name: string;
  company_type: string;
  legal_name?: string;
  siren?: string;
  city?: string;
  country?: string;
  website?: string;
  industry?: string;
}

export interface CreateAffiliationRequest {
  person_id: string;
  company_id: string;
  role_in_company: string;
  job_title?: string;
  department?: string;
  is_primary?: boolean;
  portal_access?: boolean;
  portal_modules?: string[];
}

// ============================================================================
// API — Companies
// ============================================================================

export const companiesApi = {
  /** Liste les entreprises, optionnellement filtrées par type */
  list: (type?: string) =>
    client.get<Company[]>("/companies", { params: type ? { type } : {} }),

  /** Crée une nouvelle entreprise */
  create: (data: CreateCompanyRequest) =>
    client.post<Company>("/companies", data),

  /** Récupère une entreprise par son identifiant */
  get: (id: string) => client.get<Company>(`/companies/${id}`),

  /** Met à jour une entreprise */
  update: (id: string, data: Partial<Company>) =>
    client.put<Company>(`/companies/${id}`, data),

  /** Désactive une entreprise */
  deactivate: (id: string) => client.delete(`/companies/${id}`),

  /** Liste les personnes affiliées à une entreprise */
  listPersons: (companyId: string) =>
    client.get<PersonCompany[]>(`/companies/${companyId}/persons`),

  /** Ajoute une personne à une entreprise */
  addPerson: (companyId: string, data: CreateAffiliationRequest) =>
    client.post<PersonCompany>(`/companies/${companyId}/persons`, data),

  /** Retire une personne d'une entreprise */
  removePerson: (companyId: string, personId: string) =>
    client.delete(`/companies/${companyId}/persons/${personId}`),

  /** Liste les entreprises d'une personne */
  listPersonCompanies: (personId: string) =>
    client.get<PersonCompany[]>(`/persons/${personId}/companies`),

  /** Met à jour une affiliation personne-entreprise */
  updateAffiliation: (id: string, data: Partial<PersonCompany>) =>
    client.put<PersonCompany>(`/person-companies/${id}`, data),
};

// ============================================================================
// API — Login Context
// ============================================================================

export const contextApi = {
  /** Liste les contextes de connexion disponibles pour l'utilisateur courant */
  list: () => client.get<LoginContextDisplay[]>("/auth/contexts"),

  /** Sélectionne un contexte de connexion (première sélection) */
  select: (contextId: string) =>
    client.post<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>("/auth/select-context", { context_id: contextId }),

  /** Bascule vers un autre contexte de connexion */
  switch: (contextId: string) =>
    client.post<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>("/auth/switch-context", { context_id: contextId }),

  /** Récupère le contexte de connexion actif */
  current: () => client.get("/auth/current-context"),
};
