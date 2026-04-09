/**
 * Help API — FAQ et tickets de support
 *
 * Endpoints sous /help, servis par le service Identity (port 3001).
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.IDENTITY);

// ============================================================================
// Types
// ============================================================================

export interface FaqItem {
  id: string;
  tenant_id: string;
  category: string;
  question: string;
  answer: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  tenant_id: string;
  user_id: string;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface CreateTicketRequest {
  subject: string;
  description: string;
  category: string;
  priority?: TicketPriority;
}

// ============================================================================
// API
// ============================================================================

export const helpApi = {
  /** Liste les articles FAQ, optionnellement filtres par categorie */
  listFaq: (category?: string) =>
    client.get<FaqItem[]>("/help/faq", {
      params: category ? { category } : undefined,
    }),

  /** Recupere un article FAQ par son ID */
  getFaq: (id: string) => client.get<FaqItem>(`/help/faq/${id}`),

  /** Cree un nouveau ticket de support */
  createTicket: (data: CreateTicketRequest) =>
    client.post<SupportTicket>("/help/tickets", data),

  /** Liste les tickets de l'utilisateur courant */
  listTickets: () => client.get<SupportTicket[]>("/help/tickets"),
};
