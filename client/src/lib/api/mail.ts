import { mailApiClient } from './core';

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
    smtp_server?: string;
    smtp_port?: number;
    app_password?: string;
}

export interface UpdateAccountRequest {
    display_name?: string;
    imap_server?: string;
    imap_port?: number;
    smtp_server?: string;
    smtp_port?: number;
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
        mailApiClient.get<MailAccount[]>('/mail/accounts'),

    getAccount: (id: string) =>
        mailApiClient.get<MailAccount>(`/mail/accounts/${id}`),

    createAccount: (data: CreateAccountRequest) =>
        mailApiClient.post<MailAccount>('/mail/accounts', data),

    updateAccount: (id: string, data: UpdateAccountRequest) =>
        mailApiClient.patch<MailAccount>(`/mail/accounts/${id}`, data),

    deleteAccount: (id: string) =>
        mailApiClient.delete(`/mail/accounts/${id}`),

    syncAccount: (id: string) =>
        mailApiClient.post<{ status: string }>(`/mail/accounts/${id}/sync`),

    testAccount: (id: string) =>
        mailApiClient.post<TestResult>(`/mail/accounts/${id}/test`),

    // ========================================================================
    // Folders
    // ========================================================================

    listFolders: (accountId?: string) =>
        mailApiClient.get<MailFolder[]>('/mail/folders', {
            params: accountId ? { account_id: accountId } : undefined
        }),

    getFolder: (id: string) =>
        mailApiClient.get<MailFolder>(`/mail/folders/${id}`),

    // ========================================================================
    // Emails
    // ========================================================================

    listEmails: (params?: EmailQuery) =>
        mailApiClient.get<Email[]>('/mail/emails', { params }),

    getEmail: (id: string) =>
        mailApiClient.get<Email>(`/mail/emails/${id}`),

    sendEmail: (data: SendEmailRequest) =>
        mailApiClient.post<Email>('/mail/emails', data),

    updateEmail: (id: string, data: UpdateEmailRequest) =>
        mailApiClient.patch<Email>(`/mail/emails/${id}`, data),

    deleteEmail: (id: string) =>
        mailApiClient.delete(`/mail/emails/${id}`),

    listAttachments: (emailId: string) =>
        mailApiClient.get<Attachment[]>(`/mail/emails/${emailId}/attachments`),

    // ========================================================================
    // Labels
    // ========================================================================

    listLabels: (accountId?: string) =>
        mailApiClient.get<MailLabel[]>('/mail/labels', {
            params: accountId ? { account_id: accountId } : undefined
        }),

    createLabel: (data: CreateLabelRequest) =>
        mailApiClient.post<MailLabel>('/mail/labels', data),

    updateLabel: (id: string, data: UpdateLabelRequest) =>
        mailApiClient.patch<MailLabel>(`/mail/labels/${id}`, data),

    deleteLabel: (id: string) =>
        mailApiClient.delete(`/mail/labels/${id}`),

    // ========================================================================
    // Search & Stats
    // ========================================================================

    searchEmails: (params: SearchQuery) =>
        mailApiClient.get<Email[]>('/mail/search', { params }),

    getStats: () =>
        mailApiClient.get<MailStats>('/mail/stats'),
};
