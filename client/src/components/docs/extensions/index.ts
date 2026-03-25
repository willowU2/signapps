// Tiptap extensions for SignApps Docs
export { FontSize } from './font-size';
export { Comment, commentPluginKey } from './comment';
export type { CommentData, CommentReply, CommentOptions } from './comment';
export { Mention, MentionPluginKey } from './mention';
export type { MentionOptions, MentionUser } from './mention';
export { TrackChanges, Insertion, Deletion, trackChangesPluginKey } from './track-changes';
export type { TrackChange, ChangeType, TrackChangesOptions } from './track-changes';

// Sprint 1: Foundation Polish
export { TrailingNode } from './trailing-node';
export type { TrailingNodeOptions } from './trailing-node';

// Sprint 2: Collaboration Polish
export { CollaborationCursor, collaborationCursorPluginKey } from './collaboration-cursor';
export type { CollaborationCursorOptions, CollaborationCursorUser } from './collaboration-cursor';
export { UniqueID, uniqueIDPluginKey } from './unique-id';
export type { UniqueIDOptions } from './unique-id';
export { FileHandler, fileHandlerPluginKey, fileToDataURL, insertImageFromFile } from './file-handler';
export type { FileHandlerOptions, FileHandlerError } from './file-handler';

// Sprint 3: Professional Formatting
export { LineHeight } from './line-height';
export type { LineHeightOptions } from './line-height';
export { Indent } from './indent';
export type { IndentOptions } from './indent';
export { PageBreak } from './page-break';
export { BackgroundColor } from './background-color';
export type { BackgroundColorOptions } from './background-color';

// Sprint 4: Advanced Content
export { TableOfContents } from './table-of-contents';
export type { TocItem } from './table-of-contents';
export { Footnote } from './footnote';

// Sprint 5: Cross-App Embeds
export { EmbedSheet } from './embed-sheet';
export type { EmbedSheetOptions } from './embed-sheet';
