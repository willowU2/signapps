export interface MailAttachment {
  id: string;
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  mime_type?: string;
}

export interface Mail {
  id: string;
  name: string;
  email: string;
  subject: string;
  text: string;
  body_html?: string;
  date: string;
  read: boolean;
  labels: string[];
  folder:
    | "inbox"
    | "sent"
    | "drafts"
    | "trash"
    | "junk"
    | "archive"
    | "spam"
    | "important";
  account_id?: string;
  message_id?: string;
  thread_id?: string;
  in_reply_to?: string;
  is_sent?: boolean;
  priority?: number;
  attachments?: MailAttachment[];
  is_starred?: boolean;
  is_important?: boolean;
}

export type MailFolder =
  | "inbox"
  | "sent"
  | "drafts"
  | "trash"
  | "junk"
  | "archive"
  | "spam"
  | "important";
