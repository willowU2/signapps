import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CommentData,
  CommentReply,
} from "@/components/docs/extensions/comment";

interface CommentsState {
  comments: Record<string, CommentData[]>; // documentId -> comments
  activeCommentId: string | null;
  sidebarOpen: boolean;
}

interface CommentsActions {
  // Comment CRUD
  addComment: (
    documentId: string,
    commentId: string,
    author: string,
    authorId: string,
    content: string,
  ) => void;
  updateComment: (
    documentId: string,
    commentId: string,
    content: string,
  ) => void;
  deleteComment: (documentId: string, commentId: string) => void;
  resolveComment: (documentId: string, commentId: string) => void;
  reopenComment: (documentId: string, commentId: string) => void;

  // Replies
  addReply: (
    documentId: string,
    commentId: string,
    author: string,
    authorId: string,
    content: string,
  ) => void;
  deleteReply: (documentId: string, commentId: string, replyId: string) => void;

  // UI State
  setActiveComment: (commentId: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Getters
  getComments: (documentId: string) => CommentData[];
  getComment: (
    documentId: string,
    commentId: string,
  ) => CommentData | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useCommentsStore = create<CommentsState & CommentsActions>()(
  persist(
    (set, get) => ({
      comments: {},
      activeCommentId: null,
      sidebarOpen: false,

      addComment: (documentId, commentId, author, authorId, content) => {
        set((state) => {
          const docComments = state.comments[documentId] || [];
          const newComment: CommentData = {
            id: commentId,
            author,
            authorId,
            content,
            createdAt: new Date().toISOString(),
            resolved: false,
            replies: [],
          };

          return {
            comments: {
              ...state.comments,
              [documentId]: [...docComments, newComment],
            },
          };
        });
      },

      updateComment: (documentId, commentId, content) => {
        set((state) => {
          const docComments = state.comments[documentId] || [];
          return {
            comments: {
              ...state.comments,
              [documentId]: docComments.map((c) =>
                c.id === commentId ? { ...c, content } : c,
              ),
            },
          };
        });
      },

      deleteComment: (documentId, commentId) => {
        set((state) => {
          const docComments = state.comments[documentId] || [];
          return {
            comments: {
              ...state.comments,
              [documentId]: docComments.filter((c) => c.id !== commentId),
            },
            activeCommentId:
              state.activeCommentId === commentId
                ? null
                : state.activeCommentId,
          };
        });
      },

      resolveComment: (documentId, commentId) => {
        set((state) => {
          const docComments = state.comments[documentId] || [];
          return {
            comments: {
              ...state.comments,
              [documentId]: docComments.map((c) =>
                c.id === commentId ? { ...c, resolved: true } : c,
              ),
            },
          };
        });
      },

      reopenComment: (documentId, commentId) => {
        set((state) => {
          const docComments = state.comments[documentId] || [];
          return {
            comments: {
              ...state.comments,
              [documentId]: docComments.map((c) =>
                c.id === commentId ? { ...c, resolved: false } : c,
              ),
            },
          };
        });
      },

      addReply: (documentId, commentId, author, authorId, content) => {
        set((state) => {
          const docComments = state.comments[documentId] || [];
          const newReply: CommentReply = {
            id: generateId(),
            author,
            authorId,
            content,
            createdAt: new Date().toISOString(),
          };

          return {
            comments: {
              ...state.comments,
              [documentId]: docComments.map((c) =>
                c.id === commentId
                  ? { ...c, replies: [...c.replies, newReply] }
                  : c,
              ),
            },
          };
        });
      },

      deleteReply: (documentId, commentId, replyId) => {
        set((state) => {
          const docComments = state.comments[documentId] || [];
          return {
            comments: {
              ...state.comments,
              [documentId]: docComments.map((c) =>
                c.id === commentId
                  ? {
                      ...c,
                      replies: c.replies.filter((r) => r.id !== replyId),
                    }
                  : c,
              ),
            },
          };
        });
      },

      setActiveComment: (commentId) => {
        set({ activeCommentId: commentId });
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open });
      },

      getComments: (documentId) => {
        return get().comments[documentId] || [];
      },

      getComment: (documentId, commentId) => {
        const docComments = get().comments[documentId] || [];
        return docComments.find((c) => c.id === commentId);
      },
    }),
    {
      name: "signapps-comments-storage",
      partialize: (state) => ({
        comments: state.comments,
      }),
    },
  ),
);
