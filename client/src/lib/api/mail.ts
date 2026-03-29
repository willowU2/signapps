/**
 * Mail API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from './factory';

// Get the mail service client (cached)
const mailClient = getClient(ServiceName.MAIL);

// ============================================================================
// Types
// ============================================================================

export interface MailAccount {
    id: string;
    user_id: string;
    email_address: string;
    display_name?: string;
    provider: string;
    imap_server?: string;
    imap_port?: number;
    imap_use_tls?: boolean;
    smtp_server?: string;
    smtp_port?: number;
    smtp_use_tls?: boolean;
    oauth_expires_at?: string;
    status?: string;
    last_sync_at?: string;
    last_error?: string;
    sync_interval_minutes?: number;
    signature_html?: string;
    signature_text?: string;
    created_at?: string;
    updated_at?: string;
}

export interface CreateAccountRequest {
    email_address: string;
    display_name?: string;
    provider: string;
    imap_server?: string;
    imap_port?: number;
    imap_use_tls?: boolean;
    smtp_server?: string;
    smtp_port?: number;
    smtp_use_tls?: boolean;
    app_password?: string;
}

export interface UpdateAccountRequest {
    display_name?: string;
    imap_server?: string;
    imap_port?: number;
    imap_use_tls?: boolean;
    smtp_server?: string;
    smtp_port?: number;
    smtp_use_tls?: boolean;
    app_password?: string;
    signature_html?: string;
    signature_text?: string;
    sync_interval_minutes?: number;
    status?: string;
}

export interface MailFolder {
    id: string;
    account_id: string;
    name: string;
    folder_type: string;
    imap_path?: string;
    unread_count?: number;
    total_count?: number;
    parent_id?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Email {
    id: string;
    account_id: string;
    folder_id?: string;
    message_id?: string;
    in_reply_to?: string;
    thread_id?: string;
    imap_uid?: number;
    sender: string;
    sender_name?: string;
    recipient: string;
    cc?: string;
    bcc?: string;
    reply_to?: string;
    subject?: string;
    body_text?: string;
    body_html?: string;
    snippet?: string;
    is_read?: boolean;
    is_starred?: boolean;
    is_important?: boolean;
    is_draft?: boolean;
    is_sent?: boolean;
    is_archived?: boolean;
    is_deleted?: boolean;
    labels?: string[];
    snoozed_until?: string;
    scheduled_send_at?: string;
    received_at?: string;
    sent_at?: string;
    size_bytes?: number;
    has_attachments?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface SendEmailRequest {
    account_id: string;
    recipient: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body_text?: string;
    body_html?: string;
    in_reply_to?: string;
    is_draft?: boolean;
    scheduled_send_at?: string;
    metadata?: string;
}

export interface UpdateEmailRequest {
    is_read?: boolean;
    is_starred?: boolean;
    is_important?: boolean;
    is_archived?: boolean;
    is_deleted?: boolean;
    labels?: string[];
    folder_id?: string;
    snoozed_until?: string;
    subject?: string;
    body_text?: string;
    body_html?: string;
}

export interface Attachment {
    id: string;
    email_id: string;
    filename: string;
    mime_type?: string;
    size_bytes?: number;
    content_id?: string;
    is_inline?: boolean;
    storage_bucket?: string;
    storage_key?: string;
    created_at?: string;
}

export interface MailLabel {
    id: string;
    account_id: string;
    name: string;
    color?: string;
    created_at?: string;
}

export interface CreateLabelRequest {
    account_id: string;
    name: string;
    color?: string;
}

export interface UpdateLabelRequest {
    name?: string;
    color?: string;
}

export interface MailStats {
    total_accounts: number;
    total_emails: number;
    unread_count: number;
    starred_count: number;
    draft_count: number;
}

export interface TestResult {
    imap_ok: boolean;
    smtp_ok: boolean;
    imap_error?: string;
    smtp_error?: string;
}

export interface EmailQuery {
    account_id?: string;
    folder_id?: string;
    folder_type?: string;
    is_read?: boolean;
    is_starred?: boolean;
    label?: string;
    limit?: number;
    offset?: number;
}

export interface SearchQuery {
    q: string;
    account_id?: string;
    limit?: number;
}

// ============================================================================
// Mail API
// ============================================================================

export const mailApi = {
    // ========================================================================
    // Accounts
    // ========================================================================

    listAccounts: () =>
        mailClient.get<MailAccount[]>('/mail/accounts'),

    getAccount: (id: string) =>
        mailClient.get<MailAccount>(`/mail/accounts/${id}`),

    createAccount: (data: CreateAccountRequest) =>
        mailClient.post<MailAccount>('/mail/accounts', data),

    updateAccount: (id: string, data: UpdateAccountRequest) =>
        mailClient.patch<MailAccount>(`/mail/accounts/${id}`, data),

    deleteAccount: (id: string) =>
        mailClient.delete(`/mail/accounts/${id}`),

    syncAccount: (id: string) =>
        mailClient.post<{ status: string }>(`/mail/accounts/${id}/sync`),

    testAccount: (id: string) =>
        mailClient.post<TestResult>(`/mail/accounts/${id}/test`),

    // ========================================================================
    // Folders
    // ========================================================================

    listFolders: (accountId?: string) =>
        mailClient.get<MailFolder[]>('/mail/folders', {
            params: accountId ? { account_id: accountId } : undefined
        }),

    getFolder: (id: string) =>
        mailClient.get<MailFolder>(`/mail/folders/${id}`),

    // ========================================================================
    // Emails
    // ========================================================================

    listEmails: (params?: EmailQuery) =>
        mailClient.get<Email[]>('/mail/emails', { params }),

    getEmail: (id: string) =>
        mailClient.get<Email>(`/mail/emails/${id}`),

    sendEmail: (data: SendEmailRequest) =>
        mailClient.post<Email>('/mail/emails', data),

    updateEmail: (id: string, data: UpdateEmailRequest) =>
        mailClient.patch<Email>(`/mail/emails/${id}`, data),

    deleteEmail: (id: string) =>
        mailClient.delete(`/mail/emails/${id}`),

    listAttachments: (emailId: string) =>
        mailClient.get<Attachment[]>(`/mail/emails/${emailId}/attachments`),

    // ========================================================================
    // Labels
    // ========================================================================

    listLabels: (accountId?: string) =>
        mailClient.get<MailLabel[]>('/mail/labels', {
            params: accountId ? { account_id: accountId } : undefined
        }),

    createLabel: (data: CreateLabelRequest) =>
        mailClient.post<MailLabel>('/mail/labels', data),

    updateLabel: (id: string, data: UpdateLabelRequest) =>
        mailClient.patch<MailLabel>(`/mail/labels/${id}`, data),

    deleteLabel: (id: string) =>
        mailClient.delete(`/mail/labels/${id}`),

    // ========================================================================
    // Search & Stats
    // ========================================================================

    searchEmails: (params: SearchQuery) =>
        mailClient.get<Email[]>('/mail/search', { params }),

    getStats: () =>
        mailClient.get<MailStats>('/mail/stats'),

    // ========================================================================
    // Templates — AQ-EMTPL: GET/POST /api/v1/mail/templates
    // ========================================================================

    listTemplates: (params?: { limit?: number; offset?: number }) =>
        mailClient.get<MailTemplate[]>('/mail/templates', { params }),

    createTemplate: (data: CreateMailTemplateRequest) =>
        mailClient.post<MailTemplate>('/mail/templates', data),

    getTemplate: (id: string) =>
        mailClient.get<MailTemplate>(`/mail/templates/${id}`),

    updateTemplate: (id: string, data: Partial<CreateMailTemplateRequest>) =>
        mailClient.put<MailTemplate>(`/mail/templates/${id}`, data),

    deleteTemplate: (id: string) =>
        mailClient.delete(`/mail/templates/${id}`),
};

// ============================================================================
// Mail Template types — aligned with Rust EmailTemplate
// ============================================================================

export interface MailTemplate {
    id: string;
    account_id: string;
    name: string;
    subject: string;
    body_html: string;
    variables: unknown; // JSON array of variable name strings, e.g. ["prenom","entreprise"]
    created_at: string;
    updated_at: string;
}

export interface CreateMailTemplateRequest {
    account_id: string;
    name: string;
    subject?: string;
    body_html?: string;
    variables?: unknown;
}

// ============================================================================
// Spam API — /api/v1/mail/spam/*
// ============================================================================

export interface SpamClassifyRequest {
    account_id: string;
    subject?: string;
    body?: string;
}

export interface SpamClassifyResponse {
    is_spam: boolean;
    confidence: number;
    spam_probability: number;
    ham_probability: number;
}

export interface SpamTrainRequest {
    account_id: string;
    email_id: string;
    is_spam: boolean;
}

export const mailSpamApi = {
    classify: (data: SpamClassifyRequest) =>
        mailClient.post<SpamClassifyResponse>('/mail/spam/classify', data),
    train: (data: SpamTrainRequest) =>
        mailClient.post('/mail/spam/train', data),
    getSettings: (accountId: string) =>
        mailClient.get(`/mail/spam/settings/${accountId}`),
    updateSettings: (accountId: string, data: { enabled?: boolean; threshold?: number }) =>
        mailClient.patch(`/mail/spam/settings/${accountId}`, data),
};
