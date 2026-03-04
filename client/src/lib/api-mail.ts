import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_MAIL_API_URL || 'http://localhost:3012/api/v1/mail'

// Create axios instance with auth
const mailClient = axios.create({
    baseURL: API_URL,
})

// Add auth interceptor
mailClient.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
    }
    return config
})

// ============================================================================
// Types
// ============================================================================

export interface MailAccount {
    id: string
    user_id: string
    email_address: string
    display_name?: string
    provider: string // 'gmail' | 'outlook' | 'custom'
    // IMAP settings
    imap_server?: string
    imap_port?: number
    imap_use_tls?: boolean
    // SMTP settings
    smtp_server?: string
    smtp_port?: number
    smtp_use_tls?: boolean
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

// ============================================================================
// Account API
// ============================================================================

export interface CreateAccountRequest {
    email_address: string
    display_name?: string
    provider: string
    imap_server?: string
    imap_port?: number
    smtp_server?: string
    smtp_port?: number
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
        const res = await mailClient.get('/accounts')
        return res.data
    },

    get: async (id: string): Promise<MailAccount> => {
        const res = await mailClient.get(`/accounts/${id}`)
        return res.data
    },

    create: async (data: CreateAccountRequest): Promise<MailAccount> => {
        const res = await mailClient.post('/accounts', data)
        return res.data
    },

    update: async (id: string, data: UpdateAccountRequest): Promise<MailAccount> => {
        const res = await mailClient.patch(`/accounts/${id}`, data)
        return res.data
    },

    delete: async (id: string): Promise<void> => {
        await mailClient.delete(`/accounts/${id}`)
    },

    sync: async (id: string): Promise<{ status: string }> => {
        const res = await mailClient.post(`/accounts/${id}/sync`)
        return res.data
    },

    test: async (id: string): Promise<{ imap_ok: boolean; smtp_ok: boolean; imap_error?: string; smtp_error?: string }> => {
        const res = await mailClient.post(`/accounts/${id}/test`)
        return res.data
    },
}

// ============================================================================
// Folder API
// ============================================================================

export const folderApi = {
    list: async (accountId?: string): Promise<MailFolder[]> => {
        const params = accountId ? { account_id: accountId } : {}
        const res = await mailClient.get('/folders', { params })
        return res.data
    },

    get: async (id: string): Promise<MailFolder> => {
        const res = await mailClient.get(`/folders/${id}`)
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
        const res = await mailClient.get('/emails', { params: query })
        return res.data
    },

    get: async (id: string): Promise<Email> => {
        const res = await mailClient.get(`/emails/${id}`)
        return res.data
    },

    send: async (data: SendEmailRequest): Promise<Email> => {
        const res = await mailClient.post('/emails', data)
        return res.data
    },

    update: async (id: string, data: UpdateEmailRequest): Promise<Email> => {
        const res = await mailClient.patch(`/emails/${id}`, data)
        return res.data
    },

    delete: async (id: string): Promise<void> => {
        await mailClient.delete(`/emails/${id}`)
    },

    getAttachments: async (id: string): Promise<Attachment[]> => {
        const res = await mailClient.get(`/emails/${id}/attachments`)
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
        const res = await mailClient.get('/labels', { params })
        return res.data
    },

    create: async (data: CreateLabelRequest): Promise<MailLabel> => {
        const res = await mailClient.post('/labels', data)
        return res.data
    },

    update: async (id: string, data: UpdateLabelRequest): Promise<MailLabel> => {
        const res = await mailClient.patch(`/labels/${id}`, data)
        return res.data
    },

    delete: async (id: string): Promise<void> => {
        await mailClient.delete(`/labels/${id}`)
    },
}

// ============================================================================
// Search & Stats API
// ============================================================================

export interface SearchQuery {
    q: string
    account_id?: string
    limit?: number
}

export const searchApi = {
    search: async (query: SearchQuery): Promise<Email[]> => {
        const res = await mailClient.get('/search', { params: query })
        return res.data
    },
}

export const statsApi = {
    get: async (): Promise<MailStats> => {
        const res = await mailClient.get('/stats')
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
