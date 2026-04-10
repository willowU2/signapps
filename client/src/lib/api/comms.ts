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
// Types — Newsletter
// ============================================================================

export interface NewsletterSection {
  id: string;
  type: "heading" | "text" | "highlight" | "link";
  content: string;
  url?: string;
}

export interface Newsletter {
  id: string;
  subject: string;
  sections: NewsletterSection[];
  status: "draft" | "sent";
  createdAt: string;
  sentAt?: string;
  recipients: number;
}

export interface CreateNewsletterRequest {
  subject: string;
  sections: NewsletterSection[];
}

// ============================================================================
// Types — News Feed
// ============================================================================

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  author: string;
  authorInitials: string;
  date: string;
  category: string;
  reactions: Record<string, number>;
  userReaction: string | null;
  comments: number;
  image?: string;
}

export interface CreateNewsItemRequest {
  title: string;
  content: string;
  category: string;
}

// ============================================================================
// Types — Digital Signage
// ============================================================================

export type SlideType = "text" | "announcement" | "image" | "metrics";

export interface Slide {
  id: string;
  type: SlideType;
  title: string;
  content: string;
  duration: number;
  bgColor: string;
  textColor: string;
  active: boolean;
  order: number;
}

export interface CreateSlideRequest {
  type: SlideType;
  title: string;
  content: string;
  duration: number;
  bgColor: string;
  textColor: string;
}

// ============================================================================
// Types — Mention Notifications
// ============================================================================

export type NotifSource = "announcement" | "document" | "poll" | "news";

export interface MentionNotification {
  id: string;
  from: string;
  fromInitials: string;
  message: string;
  context: string;
  source: NotifSource;
  sourceTitle: string;
  createdAt: string;
  read: boolean;
}

// ============================================================================
// Types — Suggestions
// ============================================================================

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  upvotes: number;
  downvotes: number;
  userVote: "up" | "down" | null;
  date: string;
  status: "pending" | "reviewing" | "accepted" | "rejected";
}

export interface CreateSuggestionRequest {
  title: string;
  description: string;
  category: string;
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

  // ── Newsletter ──────────────────────────────────────────
  /** Liste les newsletters */
  listNewsletters: () =>
    client.get<Newsletter[]>("/comms/newsletters").then((r) => r.data),

  /** Cree une newsletter (brouillon) */
  createNewsletter: (data: CreateNewsletterRequest) =>
    client.post<Newsletter>("/comms/newsletters", data).then((r) => r.data),

  /** Met a jour une newsletter */
  updateNewsletter: (id: string, data: Partial<CreateNewsletterRequest>) =>
    client
      .put<Newsletter>(`/comms/newsletters/${id}`, data)
      .then((r) => r.data),

  /** Envoie une newsletter */
  sendNewsletter: (id: string) =>
    client
      .post<Newsletter>(`/comms/newsletters/${id}/send`)
      .then((r) => r.data),

  // ── News Feed ───────────────────────────────────────────
  /** Liste les articles du fil d'actualite */
  listNews: () =>
    client.get<NewsItem[]>("/comms/news-feed").then((r) => r.data),

  /** Publie un article */
  createNews: (data: CreateNewsItemRequest) =>
    client.post<NewsItem>("/comms/news-feed", data).then((r) => r.data),

  /** React a un article */
  reactToNews: (id: string, emoji: string) =>
    client.post(`/comms/news-feed/${id}/react`, { emoji }),

  // ── Digital Signage ─────────────────────────────────────
  /** Liste les slides */
  listSlides: () =>
    client.get<Slide[]>("/comms/digital-signage").then((r) => r.data),

  /** Cree un slide */
  createSlide: (data: CreateSlideRequest) =>
    client.post<Slide>("/comms/digital-signage", data).then((r) => r.data),

  /** Supprime un slide */
  deleteSlide: (id: string) => client.delete(`/comms/digital-signage/${id}`),

  /** Met a jour l'ordre des slides */
  reorderSlides: (ids: string[]) =>
    client.put("/comms/digital-signage/reorder", { ids }),

  // ── Mention Notifications ───────────────────────────────
  /** Liste les mentions */
  listMentions: () =>
    client.get<MentionNotification[]>("/comms/mentions").then((r) => r.data),

  /** Marque une mention comme lue */
  markMentionRead: (id: string) => client.post(`/comms/mentions/${id}/read`),

  /** Marque toutes les mentions comme lues */
  markAllMentionsRead: () => client.post("/comms/mentions/read-all"),

  /** Supprime une mention */
  deleteMention: (id: string) => client.delete(`/comms/mentions/${id}`),

  /** Supprime toutes les mentions */
  clearAllMentions: () => client.delete("/comms/mentions"),

  // ── Suggestions ─────────────────────────────────────────
  /** Liste les suggestions */
  listSuggestions: () =>
    client.get<Suggestion[]>("/comms/suggestions").then((r) => r.data),

  /** Soumet une suggestion anonyme */
  createSuggestion: (data: CreateSuggestionRequest) =>
    client.post<Suggestion>("/comms/suggestions", data).then((r) => r.data),

  /** Vote pour une suggestion */
  voteSuggestion: (id: string, direction: "up" | "down") =>
    client.post(`/comms/suggestions/${id}/vote`, { direction }),
};
