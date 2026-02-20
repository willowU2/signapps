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
}

export type UpdateEmail = {
    is_read?: boolean
    is_archived?: boolean
    is_deleted?: boolean
    labels?: string[]
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
