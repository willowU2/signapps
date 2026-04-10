/**
 * LMS API — Learning Management System
 *
 * Endpoints sous /lms, servis par le service Identity (port 3001).
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.IDENTITY);

// ============================================================================
// Types — Discussions
// ============================================================================

export interface LmsComment {
  id: string;
  author: string;
  initials: string;
  content: string;
  likes: number;
  liked: boolean;
  created_at: string;
  replies: LmsComment[];
  is_pinned: boolean;
}

export interface LessonThread {
  id: string;
  course_title: string;
  lesson_title: string;
  lesson_number: number;
  comments: LmsComment[];
}

export interface CreateCommentRequest {
  content: string;
}

// ============================================================================
// API
// ============================================================================

export const lmsApi = {
  /** Liste les fils de discussion */
  listDiscussions: () => client.get<LessonThread[]>("/lms/discussions"),

  /** Ajoute un commentaire a un fil de discussion */
  createComment: (threadId: string, data: CreateCommentRequest) =>
    client.post<LmsComment>(`/lms/discussions/${threadId}/comments`, data),

  /** Repond a un commentaire */
  replyToComment: (
    threadId: string,
    commentId: string,
    data: CreateCommentRequest,
  ) =>
    client.post<LmsComment>(
      `/lms/discussions/${threadId}/comments/${commentId}/replies`,
      data,
    ),

  /** Toggle like sur un commentaire */
  toggleLike: (threadId: string, commentId: string) =>
    client.post(`/lms/discussions/${threadId}/comments/${commentId}/like`),
};
