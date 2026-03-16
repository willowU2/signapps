/**
 * Hook for real-time comment synchronization via Yjs
 *
 * This hook synchronizes comments between multiple users using Yjs CRDT.
 * Comments are stored in a Y.Map structure keyed by comment ID.
 */

import { useEffect, useCallback, useState } from 'react';
import * as Y from 'yjs';
import type { CommentData, CommentReply } from '@/components/docs/extensions/comment';

interface UseYjsCommentsOptions {
  ydoc: Y.Doc | null;
  documentId: string;
  onCommentsChange?: (comments: CommentData[]) => void;
}

interface UseYjsCommentsReturn {
  comments: CommentData[];
  addComment: (commentId: string, author: string, authorId: string, content: string) => void;
  updateComment: (commentId: string, content: string) => void;
  deleteComment: (commentId: string) => void;
  resolveComment: (commentId: string) => void;
  reopenComment: (commentId: string) => void;
  addReply: (commentId: string, author: string, authorId: string, content: string) => void;
  deleteReply: (commentId: string, replyId: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export function useYjsComments({
  ydoc,
  documentId,
  onCommentsChange,
}: UseYjsCommentsOptions): UseYjsCommentsReturn {
  const [comments, setComments] = useState<CommentData[]>([]);

  // Get or create the shared comments map
  const getCommentsMap = useCallback((): Y.Map<CommentData> | null => {
    if (!ydoc) return null;
    return ydoc.getMap<CommentData>(`comments-${documentId}`);
  }, [ydoc, documentId]);

  // Sync local state from Y.Map
  const syncFromYjs = useCallback(() => {
    const commentsMap = getCommentsMap();
    if (!commentsMap) return;

    const commentsArray = Array.from(commentsMap.values());
    // Sort by creation date
    commentsArray.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    setComments(commentsArray);
    onCommentsChange?.(commentsArray);
  }, [getCommentsMap, onCommentsChange]);

  // Set up Yjs observer
  useEffect(() => {
    const commentsMap = getCommentsMap();
    if (!commentsMap) return;

    // Initial sync
    syncFromYjs();

    // Listen for changes
    const observer = () => {
      syncFromYjs();
    };

    commentsMap.observe(observer);

    return () => {
      commentsMap.unobserve(observer);
    };
  }, [getCommentsMap, syncFromYjs]);

  // Add a new comment
  const addComment = useCallback(
    (commentId: string, author: string, authorId: string, content: string) => {
      const commentsMap = getCommentsMap();
      if (!commentsMap) return;

      const newComment: CommentData = {
        id: commentId,
        author,
        authorId,
        content,
        createdAt: new Date().toISOString(),
        resolved: false,
        replies: [],
      };

      // Use Yjs transaction for atomic update
      ydoc?.transact(() => {
        commentsMap.set(commentId, newComment);
      });
    },
    [ydoc, getCommentsMap]
  );

  // Update comment content
  const updateComment = useCallback(
    (commentId: string, content: string) => {
      const commentsMap = getCommentsMap();
      if (!commentsMap) return;

      const existing = commentsMap.get(commentId);
      if (!existing) return;

      ydoc?.transact(() => {
        commentsMap.set(commentId, { ...existing, content });
      });
    },
    [ydoc, getCommentsMap]
  );

  // Delete a comment
  const deleteComment = useCallback(
    (commentId: string) => {
      const commentsMap = getCommentsMap();
      if (!commentsMap) return;

      ydoc?.transact(() => {
        commentsMap.delete(commentId);
      });
    },
    [ydoc, getCommentsMap]
  );

  // Resolve a comment
  const resolveComment = useCallback(
    (commentId: string) => {
      const commentsMap = getCommentsMap();
      if (!commentsMap) return;

      const existing = commentsMap.get(commentId);
      if (!existing) return;

      ydoc?.transact(() => {
        commentsMap.set(commentId, { ...existing, resolved: true });
      });
    },
    [ydoc, getCommentsMap]
  );

  // Reopen a comment
  const reopenComment = useCallback(
    (commentId: string) => {
      const commentsMap = getCommentsMap();
      if (!commentsMap) return;

      const existing = commentsMap.get(commentId);
      if (!existing) return;

      ydoc?.transact(() => {
        commentsMap.set(commentId, { ...existing, resolved: false });
      });
    },
    [ydoc, getCommentsMap]
  );

  // Add a reply to a comment
  const addReply = useCallback(
    (commentId: string, author: string, authorId: string, content: string) => {
      const commentsMap = getCommentsMap();
      if (!commentsMap) return;

      const existing = commentsMap.get(commentId);
      if (!existing) return;

      const newReply: CommentReply = {
        id: generateId(),
        author,
        authorId,
        content,
        createdAt: new Date().toISOString(),
      };

      ydoc?.transact(() => {
        commentsMap.set(commentId, {
          ...existing,
          replies: [...existing.replies, newReply],
        });
      });
    },
    [ydoc, getCommentsMap]
  );

  // Delete a reply
  const deleteReply = useCallback(
    (commentId: string, replyId: string) => {
      const commentsMap = getCommentsMap();
      if (!commentsMap) return;

      const existing = commentsMap.get(commentId);
      if (!existing) return;

      ydoc?.transact(() => {
        commentsMap.set(commentId, {
          ...existing,
          replies: existing.replies.filter((r) => r.id !== replyId),
        });
      });
    },
    [ydoc, getCommentsMap]
  );

  return {
    comments,
    addComment,
    updateComment,
    deleteComment,
    resolveComment,
    reopenComment,
    addReply,
    deleteReply,
  };
}

export default useYjsComments;
