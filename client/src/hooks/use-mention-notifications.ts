"use client";

import { useEffect, useCallback, useRef } from "react";
import { useNotificationStore } from "@/stores/notification-store";
import { SCHEDULER_URL } from "@/lib/api/core";
import type { Editor } from "@tiptap/core";

/**
 * Listens for @mention insertions in a TipTap editor and pushes
 * in-app notifications for each mentioned user.
 *
 * Usage:
 *   const editor = useEditor({ ... });
 *   useMentionNotifications(editor, currentUser);
 */

export interface MentionNotificationUser {
  id: string;
  name: string;
  username: string;
}

export interface UseMentionNotificationsOptions {
  /** The TipTap editor instance (may be null while loading) */
  editor: Editor | null;
  /** The current authenticated user performing the mention */
  currentUser: MentionNotificationUser | null;
  /** Document title shown in the notification */
  documentTitle?: string;
  /** Document ID for deep-linking */
  documentId?: string;
}

/**
 * Hook that watches for mention node insertions in the editor
 * and creates in-app notifications for the mentioned users.
 */
export function useMentionNotifications({
  editor,
  currentUser,
  documentTitle = "un document",
  documentId,
}: UseMentionNotificationsOptions) {
  const pushNotification = useNotificationStore((s) => s.pushSSENotification);
  const processedRef = useRef<Set<string>>(new Set());

  const scanForNewMentions = useCallback(() => {
    if (!editor || !currentUser) return;

    const { doc } = editor.state;
    const currentMentionIds = new Set<string>();

    doc.descendants((node) => {
      if (node.type.name === "mention" && node.attrs.id) {
        const mentionKey = `${node.attrs.id}-${doc.content.size}`;
        currentMentionIds.add(node.attrs.id);

        // Only notify for mentions we haven't processed yet
        if (
          !processedRef.current.has(mentionKey) &&
          node.attrs.id !== currentUser.id
        ) {
          processedRef.current.add(mentionKey);

          pushNotification({
            id: `mention-${node.attrs.id}-${Date.now()}`,
            title: "Nouvelle mention",
            description: `${currentUser.name} vous a mentionne dans "${documentTitle}"`,
            type: "user",
            status: "info",
          });

          // Also send to backend (fire-and-forget)
          sendMentionNotificationToBackend({
            mentionedUserId: node.attrs.id,
            mentionedByUserId: currentUser.id,
            mentionedByName: currentUser.name,
            documentId: documentId ?? "",
            documentTitle,
          });
        }
      }
    });
  }, [editor, currentUser, documentTitle, documentId, pushNotification]);

  // Listen to editor transactions
  useEffect(() => {
    if (!editor) return;

    const handler = () => {
      scanForNewMentions();
    };

    editor.on("transaction", handler);
    return () => {
      editor.off("transaction", handler);
    };
  }, [editor, scanForNewMentions]);

  // Reset processed mentions when document changes
  useEffect(() => {
    processedRef.current.clear();
  }, [documentId]);
}

/**
 * Fire-and-forget backend notification for a mention.
 * Falls back silently if the endpoint is unavailable.
 */
async function sendMentionNotificationToBackend(payload: {
  mentionedUserId: string;
  mentionedByUserId: string;
  mentionedByName: string;
  documentId: string;
  documentTitle: string;
}) {
  try {
    const baseUrl = SCHEDULER_URL;
    await fetch(`${baseUrl}/notifications/mention`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_user_id: payload.mentionedUserId,
        notification_type: "mention",
        channel: "in_app",
        payload: {
          mentioned_by: payload.mentionedByName,
          mentioned_by_id: payload.mentionedByUserId,
          document_id: payload.documentId,
          document_title: payload.documentTitle,
        },
      }),
    });
  } catch {
    // Silently fail — in-app notification was already pushed
  }
}

export default useMentionNotifications;
