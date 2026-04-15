/**
 * Office Collaboration Components
 *
 * Components for document collaboration features including
 * comments, track changes, and notifications.
 */

// Sidebars
export {
  CommentsSidebar,
  type Comment,
  type CommentReply,
} from "../comments-sidebar";
export {
  TrackChangesSidebar,
  type TrackChange,
  type ChangeType,
} from "../track-changes-sidebar";

// Notifications
export {
  officeNotifications,
  commentNotifications,
  trackChangesNotifications,
  collaborationNotifications,
  exportNotifications,
} from "../change-notifications";
