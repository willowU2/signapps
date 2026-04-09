/**
 * Comms API — Annonces et sondages internes
 *
 * Endpoints sous /comms, servis par le service Identity (port 3001).
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.IDENTITY);

// ============================================================================
// Types — Announcements
// ============================================================================

export interface Announcement {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  author_id: string;
  is_read: boolean;
  is_acknowledged: boolean;
  requires_acknowledgement: boolean;
  published_at: string;
  expires_at?: string;
  created_at: string;
}

export type AnnouncementPriority = "low" | "normal" | "high" | "urgent";

export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  priority?: AnnouncementPriority;
  requires_acknowledgement?: boolean;
  expires_at?: string;
}

// ============================================================================
// Types — Polls
// ============================================================================

export interface Poll {
  id: string;
  tenant_id: string;
  question: string;
  options: PollOption[];
  author_id: string;
  is_anonymous: boolean;
  multiple_choice: boolean;
  closes_at?: string;
  created_at: string;
}

export interface PollOption {
  id: string;
  label: string;
  vote_count: number;
}

export interface CreatePollRequest {
  question: string;
  options: string[];
  is_anonymous?: boolean;
  multiple_choice?: boolean;
  closes_at?: string;
}

export interface PollResults {
  poll_id: string;
  total_votes: number;
  options: PollOption[];
}

// ============================================================================
// API
// ============================================================================

export const commsApi = {
  // ── Announcements ─────────────────────────────────────
  /** Liste les annonces */
  listAnnouncements: () => client.get<Announcement[]>("/comms/announcements"),

  /** Cree une nouvelle annonce */
  createAnnouncement: (data: CreateAnnouncementRequest) =>
    client.post<Announcement>("/comms/announcements", data),

  /** Marque une annonce comme lue */
  markRead: (id: string) => client.post(`/comms/announcements/${id}/read`),

  /** Accuse reception d'une annonce */
  acknowledge: (id: string) =>
    client.post(`/comms/announcements/${id}/acknowledge`),

  // ── Polls ─────────────────────────────────────────────
  /** Liste les sondages */
  listPolls: () => client.get<Poll[]>("/comms/polls"),

  /** Cree un nouveau sondage */
  createPoll: (data: CreatePollRequest) =>
    client.post<Poll>("/comms/polls", data),

  /** Vote pour une option d'un sondage */
  vote: (pollId: string, optionId: string) =>
    client.post(`/comms/polls/${pollId}/vote`, { option_id: optionId }),

  /** Recupere les resultats d'un sondage */
  getResults: (pollId: string) =>
    client.get<PollResults>(`/comms/polls/${pollId}/results`),
};
