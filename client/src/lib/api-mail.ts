import { getClient, ServiceName } from '@/lib/api/factory'

// Get mail client using factory with HttpOnly cookies
const mailClient = getClient(ServiceName.MAIL)

// ============================================================================
// Types
// ============================================================================

export interface MailAccount {
    id: string
    user_id: string
    email_address: string
    display_name?: string
    provider: MailProvider
    // IMAP settings
    imap_server?: string
    imap_port?: number
    imap_use_tls?: boolean
    // SMTP settings
    smtp_server?: string
    smtp_port?: number
    smtp_use_tls?: boolean
    // OAuth (token fields are redacted server-side but has_oauth_token can be inferred)
    has_oauth_token?: boolean
    oauth_expires_at?: string
    // Sync status
    status?: string
    last_sync_at?: string
    last_error?: string
    sync_interval_minutes?: number
    // Signature
    signature_html?: string
    signature_text?: string
    created_at?: string
    updated_at?: string
}

export interface MailFolder {
    id: string
    account_id: string
    name: string
    folder_type: string // 'inbox' | 'sent' | 'drafts' | 'trash' | 'junk' | 'archive' | 'custom'
    imap_path?: string
    unread_count?: number
    total_count?: number
    parent_id?: string
    created_at?: string
    updated_at?: string
}

export interface Email {
    id: string
    account_id: string
    folder_id?: string
    message_id?: string
    in_reply_to?: string
    thread_id?: string
    imap_uid?: number
    sender: string
    sender_name?: string
    recipient: string
    cc?: string
    bcc?: string
    reply_to?: string
    subject?: string
    body_text?: string
    body_html?: string
    snippet?: string
    is_read?: boolean
    is_starred?: boolean
    is_important?: boolean
    is_draft?: boolean
    is_sent?: boolean
    is_archived?: boolean
    is_deleted?: boolean
    labels?: string[]
    snoozed_until?: string
    scheduled_send_at?: string
    received_at?: string
    sent_at?: string
    size_bytes?: number
    has_attachments?: boolean
    created_at?: string
    updated_at?: string
}

export interface Attachment {
    id: string
    email_id: string
    filename: string
    mime_type?: string
    size_bytes?: number
    content_id?: string
    is_inline?: boolean
    storage_bucket?: string
    storage_key?: string
    created_at?: string
}

export interface MailLabel {
    id: string
    account_id: string
    name: string
    color?: string
    created_at?: string
}

export interface MailStats {
    total_accounts: number
    total_emails: number
    unread_count: number
    starred_count: number
    draft_count: number
}

export type MailProvider = 'gmail' | 'outlook' | 'custom' | 'local' | 'google' | 'microsoft'

export interface MailAlias {
    id: string
    account_id: string
    alias_email: string
    display_name: string
    is_default: boolean
    is_verified: boolean
    created_at?: string
    updated_at?: string
}

export interface MailDelegation {
    id: string
    account_id: string
    delegate_user_id: string
    permissions: string
    granted_by: string
    expires_at?: string
    created_at?: string
    updated_at?: string
}

export interface RecurringEmail {
    id: string
    account_id: string
    user_id: string
    recipient: string
    cc?: string
    bcc?: string
    subject: string
    body_text?: string
    body_html?: string
    cron_expr: string
    is_active: boolean
    last_sent_at?: string
    next_send_at?: string
    created_at?: string
    updated_at?: string
}

export interface TrackingRecord {
    id: string
    email_id: string
    tracking_id: string
    opened_at?: string
    ip_address?: string
    user_agent?: string
    open_count: number
    created_at?: string
}

export interface TrackingStats {
    total_tracked: number
    total_opened: number
    open_rate: number
    unique_opens: number
}

export interface CategorizeResult {
    email_id: string
    category: string
    confidence: number
    label_applied?: string
}

export interface CategorizeSettings {
    account_id: string
    enabled: boolean
    categories: string[]
    auto_apply: boolean
}

// ============================================================================
// Account API
// ============================================================================

export interface CreateAccountRequest {
    email_address: string
    display_name?: string
    provider: MailProvider
    imap_server?: string
    imap_port?: number
    imap_use_tls?: boolean
    smtp_server?: string
    smtp_port?: number
    smtp_use_tls?: boolean
    app_password?: string
}

export interface UpdateAccountRequest {
    display_name?: string
    imap_server?: string
    imap_port?: number
    smtp_server?: string
    smtp_port?: number
    app_password?: string
    signature_html?: string
    signature_text?: string
    sync_interval_minutes?: number
    status?: string
}

export const accountApi = {
    list: async (): Promise<MailAccount[]> => {
        const res = await mailClient.get('/mail/accounts')
        return res.data
    },

    get: async (id: string): Promise<MailAccount> => {
        const res = await mailClient.get(`/mail/accounts/${id}`)
        return res.data
    },

    create: async (data: CreateAccountRequest): Promise<MailAccount> => {
        const res = await mailClient.post('/mail/accounts', data)
        return res.data
    },

    update: async (id: string, data: UpdateAccountRequest): Promise<MailAccount> => {
        const res = await mailClient.patch(`/mail/accounts/${id}`, data)
        return res.data
    },

    delete: async (id: string): Promise<void> => {
        await mailClient.delete(`/mail/accounts/${id}`)
    },

    sync: async (id: string): Promise<{ status: string }> => {
        const res = await mailClient.post(`/mail/accounts/${id}/sync`)
        return res.data
    },

    test: async (id: string): Promise<{ imap_ok: boolean; smtp_ok: boolean; imap_error?: string; smtp_error?: string }> => {
        const res = await mailClient.post(`/mail/accounts/${id}/test`)
        return res.data
    },

    // OAuth: get the Google authorization URL
    getGoogleOAuthUrl: async (): Promise<{ url: string }> => {
        const res = await mailClient.get('/mail/oauth/google/login')
        return res.data
    },

    // OAuth: exchange code for token and link to account
    exchangeGoogleOAuthCode: async (code: string, user_id: string): Promise<MailAccount> => {
        const res = await mailClient.post('/mail/oauth/google/callback', { code, user_id })
        return res.data
    },

    // OAuth config management
    getOAuthConfig: async (platform: string): Promise<{ platform: string; client_id: string; configured: boolean }> => {
        const res = await mailClient.get(`/mail/oauth/config/${platform}`)
        return res.data
    },

    saveOAuthConfig: async (platform: string, client_id: string, client_secret: string): Promise<void> => {
        await mailClient.post(`/mail/oauth/config/${platform}`, { platform, client_id, client_secret })
    },

    // IDEA-261: Email aliases
    listAliases: async (accountId: string): Promise<MailAlias[]> => {
        const res = await mailClient.get(`/mail/accounts/${accountId}/aliases`)
        return res.data
    },
    createAlias: async (accountId: string, data: { alias_email: string; display_name: string }): Promise<MailAlias> => {
        const res = await mailClient.post(`/mail/accounts/${accountId}/aliases`, data)
        return res.data
    },
    updateAlias: async (accountId: string, aliasId: string, data: Partial<{ alias_email: string; display_name: string }>): Promise<MailAlias> => {
        const res = await mailClient.patch(`/mail/accounts/${accountId}/aliases/${aliasId}`, data)
        return res.data
    },
    deleteAlias: async (accountId: string, aliasId: string): Promise<void> => {
        await mailClient.delete(`/mail/accounts/${accountId}/aliases/${aliasId}`)
    },
    setDefaultAlias: async (accountId: string, aliasId: string): Promise<MailAlias> => {
        const res = await mailClient.post(`/mail/accounts/${accountId}/aliases/${aliasId}/set-default`)
        return res.data
    },

    // IDEA-264: Delegation
    listDelegations: async (accountId: string): Promise<MailDelegation[]> => {
        const res = await mailClient.get(`/mail/accounts/${accountId}/delegations`)
        return res.data
    },
    createDelegation: async (accountId: string, data: object): Promise<MailDelegation> => {
        const res = await mailClient.post(`/mail/accounts/${accountId}/delegations`, data)
        return res.data
    },
    revokeDelegation: async (accountId: string, delegationId: string): Promise<void> => {
        await mailClient.delete(`/mail/accounts/${accountId}/delegations/${delegationId}`)
    },
}

// ============================================================================
// Folder API
// ============================================================================

export const folderApi = {
    list: async (accountId?: string): Promise<MailFolder[]> => {
        const params = accountId ? { account_id: accountId } : {}
        const res = await mailClient.get('/mail/folders', { params })
        return res.data
    },

    get: async (id: string): Promise<MailFolder> => {
        const res = await mailClient.get(`/mail/folders/${id}`)
        return res.data
    },
}

// ============================================================================
// Email API
// ============================================================================

export interface EmailQuery {
    account_id?: string
    folder_id?: string
    folder_type?: string
    is_read?: boolean
    is_starred?: boolean
    label?: string
    limit?: number
    offset?: number
}

export interface SendEmailRequest {
    account_id: string
    recipient: string
    cc?: string
    bcc?: string
    subject: string
    body_text?: string
    body_html?: string
    in_reply_to?: string
    is_draft?: boolean
    scheduled_send_at?: string
    metadata?: string
}

export interface UpdateEmailRequest {
    is_read?: boolean
    is_starred?: boolean
    is_important?: boolean
    is_archived?: boolean
    is_deleted?: boolean
    labels?: string[]
    folder_id?: string
    snoozed_until?: string | null
    subject?: string
    body_text?: string
    body_html?: string
}

export const mailApi = {
    list: async (query?: EmailQuery): Promise<Email[]> => {
        const res = await mailClient.get('/mail/emails', { params: query })
        return res.data
    },

    get: async (id: string): Promise<Email> => {
        const res = await mailClient.get(`/mail/emails/${id}`)
        return res.data
    },

    send: async (data: SendEmailRequest): Promise<Email> => {
        const res = await mailClient.post('/mail/emails', data)
        return res.data
    },

    update: async (id: string, data: UpdateEmailRequest): Promise<Email> => {
        const res = await mailClient.patch(`/mail/emails/${id}`, data)
        return res.data
    },

    delete: async (id: string): Promise<void> => {
        await mailClient.delete(`/mail/emails/${id}`)
    },

    getAttachments: async (id: string): Promise<Attachment[]> => {
        const res = await mailClient.get(`/mail/emails/${id}/attachments`)
        return res.data
    },

    // IDEA-263: Recurring emails
    createRecurring: async (data: object): Promise<RecurringEmail> => {
        const res = await mailClient.post('/mail/emails/recurring', data)
        return res.data
    },
    updateRecurring: async (id: string, data: object): Promise<RecurringEmail> => {
        const res = await mailClient.patch(`/mail/emails/recurring/${id}`, data)
        return res.data
    },
    deleteRecurring: async (id: string): Promise<void> => {
        await mailClient.delete(`/mail/emails/recurring/${id}`)
    },

    // IDEA-265: Read tracking
    getTrackingRecords: async (params: object): Promise<TrackingRecord[]> => {
        const res = await mailClient.get('/mail/emails/tracking', { params })
        return res.data
    },
    getTrackingStats: async (params: object): Promise<TrackingStats> => {
        const res = await mailClient.get('/mail/emails/tracking/stats', { params })
        return res.data
    },

    // IDEA-266: AI categorization
    categorizeInbox: async (data: object): Promise<CategorizeResult[]> => {
        const res = await mailClient.post('/mail/emails/categorize', data)
        return res.data
    },
    saveCategorizeSettings: async (data: object): Promise<CategorizeSettings> => {
        const res = await mailClient.put('/mail/emails/categorize/settings', data)
        return res.data
    },
}

// ============================================================================
// Label API
// ============================================================================

export interface CreateLabelRequest {
    account_id: string
    name: string
    color?: string
}

export interface UpdateLabelRequest {
    name?: string
    color?: string
}

export const labelApi = {
    list: async (accountId?: string): Promise<MailLabel[]> => {
        const params = accountId ? { account_id: accountId } : {}
        const res = await mailClient.get('/mail/labels', { params })
        return res.data
    },

    create: async (data: CreateLabelRequest): Promise<MailLabel> => {
        const res = await mailClient.post('/mail/labels', data)
        return res.data
    },

    update: async (id: string, data: UpdateLabelRequest): Promise<MailLabel> => {
        const res = await mailClient.patch(`/mail/labels/${id}`, data)
        return res.data
    },

    delete: async (id: string): Promise<void> => {
        await mailClient.delete(`/mail/labels/${id}`)
    },
}

// ============================================================================
// Search & Stats API
// ============================================================================

export interface SearchQuery {
    q: string
    account_id?: string
    limit?: number
    from?: string
    to?: string
    has_attachments?: boolean
    is_read?: boolean
    after?: string
}

export const searchApi = {
    search: async (query: SearchQuery): Promise<Email[]> => {
        const res = await mailClient.get('/mail/search', { params: query })
        return res.data
    },
}

export const statsApi = {
    get: async (): Promise<MailStats> => {
        const res = await mailClient.get('/mail/stats')
        return res.data
    },
}

// ============================================================================
// Spam Filter API
// ============================================================================

export interface ClassifyRequest {
    account_id: string
    subject?: string
    body?: string
}

export interface ClassifyResponse {
    is_spam: boolean
    confidence: number
    spam_probability: number
    ham_probability: number
}

export interface TrainRequest {
    account_id: string
    email_id: string
    is_spam: boolean
}

export interface TrainResponse {
    status: string
    words_updated: number
}

export interface SpamSettings {
    id: string
    account_id: string
    enabled: boolean
    threshold: number
    total_spam: number
    total_ham: number
    created_at: string
    updated_at: string
}

export interface SpamStatsResponse {
    enabled: boolean
    threshold: number
    total_spam: number
    total_ham: number
    total_classified: number
    vocabulary_size: number
}

export interface UpdateSpamSettingsRequest {
    enabled?: boolean
    threshold?: number
}

export const spamApi = {
    classify: async (data: ClassifyRequest): Promise<ClassifyResponse> => {
        const res = await mailClient.post('/mail/spam/classify', data)
        return res.data
    },

    train: async (data: TrainRequest): Promise<TrainResponse> => {
        const res = await mailClient.post('/mail/spam/train', data)
        return res.data
    },

    getSettings: async (accountId: string): Promise<SpamStatsResponse> => {
        const res = await mailClient.get(`/mail/spam/settings/${accountId}`)
        return res.data
    },

    updateSettings: async (accountId: string, data: UpdateSpamSettingsRequest): Promise<SpamSettings> => {
        const res = await mailClient.patch(`/mail/spam/settings/${accountId}`, data)
        return res.data
    },
}

// ============================================================================
// Helper types for UI
// ============================================================================

export type MailFolderType = 'inbox' | 'sent' | 'drafts' | 'trash' | 'junk' | 'archive'

export interface UIMail {
    id: string
    name: string
    email: string
    subject: string
    text: string
    date: string
    read: boolean
    labels: string[]
    folder: MailFolderType
}

// Convert API Email to UI Mail format
export function emailToUIMail(email: Email): UIMail {
    return {
        id: email.id,
        name: email.sender_name || email.sender.split('@')[0],
        email: email.sender,
        subject: email.subject || '(No subject)',
        text: email.body_text || email.snippet || '',
        date: email.received_at || email.created_at || new Date().toISOString(),
        read: email.is_read || false,
        labels: email.labels || [],
        folder: 'inbox', // Will be determined by folder_type
    }
}

