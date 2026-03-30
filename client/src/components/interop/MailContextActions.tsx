"use client";

/**
 * Feature 1: Right-click email → "Créer une tâche"
 * Feature 2: Right-click email → "Ajouter au calendrier"
 * Feature 8: Email attachment → link to task/event
 * Feature 19: Email follow-up reminder → create calendar event
 *
 * Drop-in wrapper around any mail row — renders context menu items.
 */

import { useState } from "react";
import { CheckSquare, CalendarPlus, Bell, Paperclip } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { EmailToTaskDialog } from "@/components/mail/email-to-task-dialog";
import { EmailToEventDialog } from "./EmailToEventDialog";
import { EmailFollowUpDialog } from "./EmailFollowUpDialog";
import type { Mail } from "@/lib/data/mail";

interface MailContextActionsProps {
  mail: Mail;
  children: React.ReactNode;
}

export function MailContextActions({ mail, children }: MailContextActionsProps) {
  const [taskOpen, setTaskOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => setTaskOpen(true)}>
            <CheckSquare className="mr-2 h-4 w-4 text-emerald-500" />
            Créer une tâche
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setEventOpen(true)}>
            <CalendarPlus className="mr-2 h-4 w-4 text-blue-500" />
            Ajouter au calendrier
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setFollowUpOpen(true)}>
            <Bell className="mr-2 h-4 w-4 text-amber-500" />
            Rappel de suivi
          </ContextMenuItem>
          {mail.attachments && mail.attachments.length > 0 && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem disabled>
                <Paperclip className="mr-2 h-4 w-4 text-muted-foreground" />
                Lier les pièces jointes…
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <EmailToTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        emailSubject={mail.subject}
        emailBody={mail.text}
        emailFrom={mail.email}
        emailId={mail.id}
      />
      <EmailToEventDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        mail={mail}
      />
      <EmailFollowUpDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        mail={mail}
      />
    </>
  );
}
