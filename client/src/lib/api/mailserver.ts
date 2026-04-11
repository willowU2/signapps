/**
 * Mailserver API — Org-aware mail infrastructure
 *
 * Endpoints under /mailserver, served by the Mail service (port 3012).
 * Manages naming rules, distribution lists, shared mailboxes, portal messages, and provisioning.
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.MAIL);

// ============================================================================
// Types — Naming Rules
// ============================================================================

export interface NamingRule {
  id: string;
  tenant_id: string;
  rule_name: string;
  description?: string;
  template: string;
  priority: number;
  enabled: boolean;
  reserved_words: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateNamingRuleRequest {
  rule_name: string;
  description?: string;
  template: string;
  priority?: number;
  reserved_words?: string[];
}

export interface UpdateNamingRuleRequest {
  rule_name?: string;
  description?: string;
  template?: string;
  priority?: number;
  enabled?: boolean;
  reserved_words?: string[];
}

// ============================================================================
// Types — Distribution Lists
// ============================================================================

export interface DistributionList {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  description?: string;
  owner_id: string;
  is_org_wide: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDistListRequest {
  email: string;
  display_name: string;
  description?: string;
  is_org_wide?: boolean;
}

export interface UpdateDistListRequest {
  display_name?: string;
  description?: string;
  is_org_wide?: boolean;
}

export interface DistListMember {
  id: string;
  dist_list_id: string;
  member_email: string;
  member_type: "user" | "group" | "contact";
  added_at: string;
}

export interface AddDistListMemberRequest {
  member_email: string;
  member_type: "user" | "group" | "contact";
}

// ============================================================================
// Types — Shared Mailboxes
// ============================================================================

export interface SharedMailbox {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  description?: string;
  owner_id: string;
  mailbox_type: "shared" | "equipment" | "room";
  capacity?: number;
  location?: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSharedMailboxRequest {
  email: string;
  display_name: string;
  description?: string;
  mailbox_type: "shared" | "equipment" | "room";
  capacity?: number;
  location?: string;
}

export interface UpdateSharedMailboxRequest {
  display_name?: string;
  description?: string;
  capacity?: number;
  location?: string;
}

export interface SharedMailboxMember {
  id: string;
  mailbox_id: string;
  member_email: string;
  permission_level: "owner" | "editor" | "reviewer" | "viewer";
  added_at: string;
}

export interface AddSharedMailboxMemberRequest {
  member_email: string;
  permission_level: "owner" | "editor" | "reviewer" | "viewer";
}

// ============================================================================
// Types — Portal Messages
// ============================================================================

export interface PortalMessage {
  id: string;
  tenant_id: string;
  from_email: string;
  from_name?: string;
  recipient_email: string;
  subject: string;
  body: string;
  thread_id: string;
  is_read: boolean;
  created_at: string;
  updated_at?: string;
}

export interface SendPortalMessageRequest {
  recipient_email: string;
  subject: string;
  body: string;
  thread_id?: string;
}

export interface MarkMessageReadRequest {
  is_read: boolean;
}

export interface MessageThread {
  id: string;
  tenant_id: string;
  subject: string;
  participant_count: number;
  last_message_at: string;
  unread_count: number;
  created_at: string;
}

export interface AddressPreview {
  address: string;
  type: "user" | "group" | "contact" | "external";
  display_name?: string;
  valid: boolean;
}

// ============================================================================
// Types — Provisioning
// ============================================================================

export interface ProvisioningRequest {
  items: ProvisioningItem[];
  dry_run?: boolean;
}

export interface ProvisioningItem {
  action: "create" | "update" | "delete";
  resource_type: "dist_list" | "shared_mailbox";
  data: Record<string, unknown>;
}

export interface ProvisioningPreview {
  items: ProvisioningPreviewItem[];
  total_changes: number;
  estimated_duration_ms: number;
}

export interface ProvisioningPreviewItem {
  action: "create" | "update" | "delete";
  resource_type: "dist_list" | "shared_mailbox";
  resource_email: string;
  changes: string[];
  success: boolean;
  message?: string;
}

export interface ProvisioningResult {
  job_id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  items_processed: number;
  items_total: number;
  errors: ProvisioningError[];
  completed_at?: string;
}

export interface ProvisioningError {
  item_index: number;
  resource_email?: string;
  error_message: string;
}

// ============================================================================
// API
// ============================================================================

export const namingRulesApi = {
  /** List all naming rules for the tenant */
  list: () => client.get<NamingRule[]>("/mailserver/naming-rules"),

  /** Create a new naming rule */
  create: (data: CreateNamingRuleRequest) =>
    client.post<NamingRule>("/mailserver/naming-rules", data),

  /** Update a naming rule */
  update: (id: string, data: UpdateNamingRuleRequest) =>
    client.put<NamingRule>(`/mailserver/naming-rules/${id}`, data),

  /** Delete a naming rule */
  delete: (id: string) => client.delete(`/mailserver/naming-rules/${id}`),

  /** Resolve an address against naming rules */
  resolve: (prefix: string) =>
    client.post<AddressPreview>("/mailserver/naming-rules/resolve", {
      prefix,
    }),
};

export const distListsApi = {
  /** List all distribution lists for the tenant */
  list: () => client.get<DistributionList[]>("/mailserver/dist-lists"),

  /** Create a new distribution list */
  create: (data: CreateDistListRequest) =>
    client.post<DistributionList>("/mailserver/dist-lists", data),

  /** Get all members of a distribution list */
  getMembers: (id: string) =>
    client.get<DistListMember[]>(`/mailserver/dist-lists/${id}/members`),

  /** Update a distribution list */
  update: (id: string, data: UpdateDistListRequest) =>
    client.put<DistributionList>(`/mailserver/dist-lists/${id}`, data),

  /** Delete a distribution list */
  delete: (id: string) => client.delete(`/mailserver/dist-lists/${id}`),

  /** Add a member to a distribution list */
  addMember: (id: string, data: AddDistListMemberRequest) =>
    client.post<DistListMember>(`/mailserver/dist-lists/${id}/members`, data),

  /** Remove a member from a distribution list */
  removeMember: (id: string, memberId: string) =>
    client.delete(`/mailserver/dist-lists/${id}/members/${memberId}`),
};

export const sharedMailboxesApi = {
  /** List all shared mailboxes for the tenant */
  list: () => client.get<SharedMailbox[]>("/mailserver/shared-mailboxes"),

  /** Create a new shared mailbox */
  create: (data: CreateSharedMailboxRequest) =>
    client.post<SharedMailbox>("/mailserver/shared-mailboxes", data),

  /** Get details of a specific shared mailbox */
  get: (id: string) =>
    client.get<SharedMailbox>(`/mailserver/shared-mailboxes/${id}`),

  /** Update a shared mailbox */
  update: (id: string, data: UpdateSharedMailboxRequest) =>
    client.put<SharedMailbox>(`/mailserver/shared-mailboxes/${id}`, data),

  /** Delete a shared mailbox */
  delete: (id: string) => client.delete(`/mailserver/shared-mailboxes/${id}`),

  /** Add a member to a shared mailbox */
  addMember: (id: string, data: AddSharedMailboxMemberRequest) =>
    client.post<SharedMailboxMember>(
      `/mailserver/shared-mailboxes/${id}/members`,
      data,
    ),

  /** Remove a member from a shared mailbox */
  removeMember: (id: string, memberId: string) =>
    client.delete(`/mailserver/shared-mailboxes/${id}/members/${memberId}`),
};

export const portalMessagesApi = {
  /** List portal messages for the current user */
  list: () => client.get<PortalMessage[]>("/mailserver/portal-messages"),

  /** Send a portal message */
  send: (data: SendPortalMessageRequest) =>
    client.post<PortalMessage>("/mailserver/portal-messages", data),

  /** Get a specific portal message */
  get: (id: string) =>
    client.get<PortalMessage>(`/mailserver/portal-messages/${id}`),

  /** Mark a message as read/unread */
  markRead: (id: string, data: MarkMessageReadRequest) =>
    client.put<PortalMessage>(`/mailserver/portal-messages/${id}/read`, data),

  /** Get a message thread */
  getThread: (threadId: string) =>
    client.get<MessageThread>(
      `/mailserver/portal-messages/threads/${threadId}`,
    ),

  /** Get unread message count */
  unreadCount: () =>
    client.get<{ count: number }>("/mailserver/portal-messages/unread-count"),
};

export const provisioningApi = {
  /** Provision mailserver resources (create/update/delete) */
  provision: (data: ProvisioningRequest) =>
    client.post<ProvisioningResult>("/mailserver/provisioning", data),

  /** Preview provisioning changes without applying them */
  preview: (data: ProvisioningRequest) =>
    client.post<ProvisioningPreview>("/mailserver/provisioning/preview", data),

  /** Bulk provision from CSV or structured data */
  bulk: (data: { items: ProvisioningItem[] }) =>
    client.post<ProvisioningResult>("/mailserver/provisioning/bulk", data),
};
