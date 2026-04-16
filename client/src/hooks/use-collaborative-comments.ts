/**
 * Hook combining Yjs real-time sync with UI state management for comments
 *
 * This hook integrates:
 * - useYjsComments: Real-time CRDT sync across users
 * - useCommentsStore: Local UI state (sidebar, active comment)
 */

import { useCallback, useEffect, useState } from "react";
import * as Y from "yjs";
import { useYjsComments } from "./use-yjs-comments";
import { useCommentsStore } from "@/stores/comments-store";
import { useAuthStore } from "@/lib/store";
import type { CommentData } from "@/components/docs/extensions/comment";
import type { Editor } from "@tiptap/react";

interface UseCollaborativeCommentsOptions {
  ydoc: Y.Doc | null;
  documentId: string;
  editor: Editor | null;
}

interface UseCollaborativeCommentsReturn {
  // Data
  comments: CommentData[];
  activeCommentId: string | null;

  // UI State
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Comment Operations
  addComment: (content: string) => void;
  updateComment: (commentId: string, content: string) => void;
  deleteComment: (commentId: string) => void;
  resolveComment: (commentId: string) => void;
  reopenComment: (commentId: string) => void;

  // Reply Operations
  addReply: (commentId: string, content: string) => void;
  deleteReply: (commentId: string, replyId: string) => void;

  // Navigation
  setActiveComment: (commentId: string | null) => void;
  goToComment: (commentId: string) => void;
}

/**
 * Generate a unique ID for comments
 */
const generateCommentId = () =>
  `comment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export function useCollaborativeComments({
  ydoc,
  documentId,
  editor,
}: UseCollaborativeCommentsOptions): UseCollaborativeCommentsReturn {
  const { user } = useAuthStore();

  // Yjs sync for real-time collaboration
  const yjsComments = useYjsComments({
    ydoc,
    documentId,
  });

  // Local UI state from Zustand store
  const {
    activeCommentId,
    sidebarOpen,
    setActiveComment,
    toggleSidebar,
    setSidebarOpen,
  } = useCommentsStore();

  // Track pending comment ID when adding from selection
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);

  /**
   * Add a new comment based on current editor selection
   */
  const addComment = useCallback(
    (content: string) => {
      if (!editor || !user) return;

      const { from, to } = editor.state.selection;

      // Require text selection for comments
      if (from === to) {
        console.warn("Cannot add comment without text selection");
        return;
      }

      const commentId = generateCommentId();

      // Add mark to selected text
      editor.chain().focus().setComment(commentId).run();

      // Add comment data to Yjs
      yjsComments.addComment(
        commentId,
        user.username || "Anonyme",
        user.id || "unknown",
        content,
      );

      // Open sidebar and focus on new comment
      setSidebarOpen(true);
      setActiveComment(commentId);
    },
    [editor, user, yjsComments, setSidebarOpen, setActiveComment],
  );

  /**
   * Update comment content
   */
  const updateComment = useCallback(
    (commentId: string, content: string) => {
      yjsComments.updateComment(commentId, content);
    },
    [yjsComments],
  );

  /**
   * Delete a comment (removes mark from editor and data from Yjs)
   */
  const deleteComment = useCallback(
    (commentId: string) => {
      if (!editor) return;

      // Remove comment mark from editor
      editor.chain().focus().unsetComment(commentId).run();

      // Remove from Yjs
      yjsComments.deleteComment(commentId);

      // Clear active if this was active
      if (activeCommentId === commentId) {
        setActiveComment(null);
      }
    },
    [editor, yjsComments, activeCommentId, setActiveComment],
  );

  /**
   * Resolve a comment
   */
  const resolveComment = useCallback(
    (commentId: string) => {
      if (!editor) return;

      // Update mark to show resolved state
      editor.chain().focus().resolveComment(commentId).run();

      // Update in Yjs
      yjsComments.resolveComment(commentId);
    },
    [editor, yjsComments],
  );

  /**
   * Reopen a resolved comment
   */
  const reopenComment = useCallback(
    (commentId: string) => {
      yjsComments.reopenComment(commentId);
    },
    [yjsComments],
  );

  /**
   * Add a reply to a comment
   */
  const addReply = useCallback(
    (commentId: string, content: string) => {
      if (!user) return;

      yjsComments.addReply(
        commentId,
        user.username || "Anonyme",
        user.id || "unknown",
        content,
      );
    },
    [user, yjsComments],
  );

  /**
   * Delete a reply from a comment
   */
  const deleteReply = useCallback(
    (commentId: string, replyId: string) => {
      yjsComments.deleteReply(commentId, replyId);
    },
    [yjsComments],
  );

  /**
   * Navigate to a comment in the editor
   */
  const goToComment = useCallback(
    (commentId: string) => {
      if (!editor) return;

      setActiveComment(commentId);

      // Find the comment mark position in the document
      const { doc } = editor.state;
      let foundPos: number | null = null;

      doc.descendants((node, pos) => {
        if (foundPos !== null) return false;

        node.marks.forEach((mark) => {
          if (
            mark.type.name === "comment" &&
            mark.attrs.commentId === commentId
          ) {
            foundPos = pos;
          }
        });

        return true;
      });

      if (foundPos !== null) {
        editor.commands.setTextSelection(foundPos);
        editor.commands.scrollIntoView();
      }
    },
    [editor, setActiveComment],
  );

  // Listen for active comment changes in editor (from clicking on commented text)
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const { selection } = editor.state;
      const marks = selection.$from.marks();

      const commentMark = marks.find((mark) => mark.type.name === "comment");

      if (commentMark) {
        setActiveComment(commentMark.attrs.commentId);
      }
    };

    editor.on("selectionUpdate", handleSelectionUpdate);

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor, setActiveComment]);

  return {
    // Data from Yjs
    comments: yjsComments.comments,
    activeCommentId,

    // UI State
    sidebarOpen,
    toggleSidebar,
    setSidebarOpen,

    // Comment Operations
    addComment,
    updateComment,
    deleteComment,
    resolveComment,
    reopenComment,

    // Reply Operations
    addReply,
    deleteReply,

    // Navigation
    setActiveComment,
    goToComment,
  };
}
