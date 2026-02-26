import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_MAIL_API_URL || 'http://localhost:3004/api/v1/mail'

export interface Email {
    id: string
    sender: string
    recipient: string
    subject: string
    body: string
    is_read: boolean
    is_archived: boolean
    is_deleted: boolean
    labels: string[]
    created_at: string
}

export type CreateEmail = {
    sender: string
    recipient: string
    subject: string
    body: string
    folder?: string
}

export type UpdateEmail = {
    is_read?: boolean
    is_archived?: boolean
    is_deleted?: boolean
    labels?: string[]
    snoozed_until?: string | null
    subject?: string
    body?: string
    recipient?: string
    folder?: string
}

export const mailApi = {
    list: async (): Promise<Email[]> => {
        const res = await axios.get(API_URL)
        return res.data
    },

    get: async (id: string): Promise<Email> => {
        const res = await axios.get(`${API_URL}/${id}`)
        return res.data
    },

    send: async (data: CreateEmail): Promise<Email> => {
        const res = await axios.post(API_URL, data)
        return res.data
    },

    update: async (id: string, data: UpdateEmail): Promise<Email> => {
        const res = await axios.patch(`${API_URL}/${id}`, data)
        return res.data
    }
}

export interface MailAccount {
    id: string
    user_id: string
    email_address: string
    provider: "gmail" | "outlook" | "custom"
    imap_server?: string
    imap_port?: number
    smtp_server?: string
    smtp_port?: number
}

export const accountApi = {
    list: async (): Promise<MailAccount[]> => {
        const res = await axios.get(`${API_URL}/accounts`)
        return res.data
    },

    create: async (data: Partial<MailAccount> & { app_password?: string }): Promise<MailAccount> => {
        const res = await axios.post(`${API_URL}/accounts`, data)
        return res.data
    }
}
