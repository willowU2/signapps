"use client";

import Link from "next/link";
import {
  Calendar,
  FileText,
  Mail,
  Users,
  FolderOpen,
  MessageSquare,
  Video,
  CheckSquare,
} from "lucide-react";

interface CrossLink {
  module: string;
  icon: React.ElementType;
  label: string;
  href: string;
  count?: number;
}

export function CrossLinks({ links }: { links: CrossLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          <link.icon className="h-3 w-3" />
          {link.label}
          {link.count !== undefined && (
            <span className="rounded bg-muted px-1 text-[10px]">
              {link.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

export type { CrossLink };

export const crossLinkHelpers = {
  toCalendarEvent: (eventId: string, title: string): CrossLink => ({
    module: "calendar",
    icon: Calendar,
    label: title,
    href: `/cal?event=${eventId}`,
  }),
  toContact: (contactId: string, name: string): CrossLink => ({
    module: "contacts",
    icon: Users,
    label: name,
    href: `/contacts?edit=${contactId}`,
  }),
  toDriveFile: (nodeId: string, name: string): CrossLink => ({
    module: "drive",
    icon: FolderOpen,
    label: name,
    href: `/drive?file=${nodeId}`,
  }),
  toDoc: (docId: string, title: string): CrossLink => ({
    module: "docs",
    icon: FileText,
    label: title,
    href: `/docs/editor/${docId}`,
  }),
  toMail: (threadId: string, subject: string): CrossLink => ({
    module: "mail",
    icon: Mail,
    label: subject,
    href: `/mail?thread=${threadId}`,
  }),
  toMeeting: (roomId: string, name: string): CrossLink => ({
    module: "meet",
    icon: Video,
    label: name,
    href: `/meet?room=${roomId}`,
  }),
  toTask: (taskId: string, title: string): CrossLink => ({
    module: "tasks",
    icon: CheckSquare,
    label: title,
    href: `/tasks?task=${taskId}`,
  }),
  toChat: (channelId: string, name: string): CrossLink => ({
    module: "chat",
    icon: MessageSquare,
    label: name,
    href: `/chat/${channelId}`,
  }),
};
