/**
 * Universal Blocks System - Adapters
 *
 * Adapters pour convertir les entités existantes en UniversalBlocks.
 */

import type {
  UniversalBlock,
  BlockAdapter,
  BlockPermissions,
  BlockMetadata,
  LinkedBlock,
} from "./types";

// ============================================================================
// Entity Types (from existing codebase)
// ============================================================================

export interface UserEntity {
  id: string;
  username: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  role: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
  groups?: string[];
}

export interface FileEntity {
  id: string;
  name: string;
  key: string;
  bucket: string;
  size: number;
  content_type: string;
  owner_id?: string;
  owner_name?: string;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
  thumbnail_url?: string;
  is_folder?: boolean;
  parent_id?: string;
}

export interface TaskEntity {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date?: string;
  assignee_id?: string;
  assignee_name?: string;
  project_id?: string;
  project_name?: string;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
  attachments?: string[];
}

export interface EventEntity {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  all_day?: boolean;
  location?: string;
  calendar_id?: string;
  organizer_id?: string;
  organizer_name?: string;
  attendees?: string[];
  recurrence?: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentEntity {
  id: string;
  title: string;
  content?: string;
  type: "document" | "spreadsheet" | "presentation";
  owner_id?: string;
  owner_name?: string;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
  collaborators?: string[];
  thumbnail_url?: string;
}

export interface ContainerEntity {
  id: string;
  name: string;
  image: string;
  status: "running" | "stopped" | "paused" | "created" | "restarting";
  ports?: string[];
  created_at?: string;
  started_at?: string;
}

// ============================================================================
// Default Permissions
// ============================================================================

const defaultPermissions: BlockPermissions = {
  canView: true,
  canEdit: false,
  canDelete: false,
  canShare: false,
  canLink: true,
};

// ============================================================================
// User Adapter
// ============================================================================

export const userAdapter: BlockAdapter<UserEntity> = {
  toBlock(user: UserEntity): UniversalBlock {
    return {
      id: user.id,
      type: "user",
      title: user.display_name || user.username,
      subtitle: user.email,
      description: `Role: ${user.role}`,
      icon: "User",
      avatarUrl: user.avatar_url,
      color: getRoleColor(user.role),
      permissions: {
        ...defaultPermissions,
        canEdit: false, // Users can't edit other users
      },
      linkedBlocks: user.groups?.map((groupId) => ({
        blockId: groupId,
        blockType: "group" as const,
        linkType: "reference" as const,
      })),
      metadata: {
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        status: user.status,
        role: user.role,
        lastLogin: user.last_login,
      },
      original: user,
    };
  },

  getSearchableText(user: UserEntity): string {
    return [
      user.username,
      user.display_name,
      user.email,
      user.role,
    ]
      .filter(Boolean)
      .join(" ");
  },

  getSortValue(user: UserEntity, field: string): unknown {
    switch (field) {
      case "name":
        return user.display_name || user.username;
      case "email":
        return user.email;
      case "role":
        return user.role;
      case "createdAt":
        return user.created_at;
      default:
        return user[field as keyof UserEntity];
    }
  },
};

// ============================================================================
// File Adapter
// ============================================================================

export const fileAdapter: BlockAdapter<FileEntity> = {
  toBlock(file: FileEntity): UniversalBlock {
    const isFolder = file.is_folder ?? false;
    return {
      id: file.id,
      type: isFolder ? "folder" : "file",
      title: file.name,
      subtitle: isFolder ? undefined : formatFileSize(file.size),
      description: file.content_type,
      icon: isFolder ? "Folder" : getFileIcon(file.content_type),
      thumbnailUrl: file.thumbnail_url,
      color: getFileColor(file.content_type),
      permissions: {
        ...defaultPermissions,
        canEdit: true,
        canDelete: true,
        canShare: true,
      },
      metadata: {
        createdAt: file.created_at,
        updatedAt: file.updated_at,
        ownerId: file.owner_id,
        ownerName: file.owner_name,
        size: file.size,
        mimeType: file.content_type,
        tags: file.tags,
        bucket: file.bucket,
        key: file.key,
        parentId: file.parent_id,
      },
      original: file,
    };
  },

  getSearchableText(file: FileEntity): string {
    return [file.name, file.content_type, ...(file.tags || [])]
      .filter(Boolean)
      .join(" ");
  },

  getSortValue(file: FileEntity, field: string): unknown {
    switch (field) {
      case "name":
        return file.name;
      case "size":
        return file.size;
      case "type":
        return file.content_type;
      case "createdAt":
        return file.created_at;
      case "updatedAt":
        return file.updated_at;
      default:
        return file[field as keyof FileEntity];
    }
  },
};

// ============================================================================
// Task Adapter
// ============================================================================

export const taskAdapter: BlockAdapter<TaskEntity> = {
  toBlock(task: TaskEntity): UniversalBlock {
    const linkedBlocks: LinkedBlock[] = [];

    if (task.assignee_id) {
      linkedBlocks.push({
        blockId: task.assignee_id,
        blockType: "user",
        linkType: "assignee",
      });
    }

    if (task.attachments) {
      task.attachments.forEach((fileId) => {
        linkedBlocks.push({
          blockId: fileId,
          blockType: "file",
          linkType: "attachment",
        });
      });
    }

    return {
      id: task.id,
      type: "task",
      title: task.title,
      subtitle: task.assignee_name
        ? `Assigné à ${task.assignee_name}`
        : undefined,
      description: task.description,
      icon: getTaskIcon(task.status),
      color: getPriorityColor(task.priority),
      permissions: {
        ...defaultPermissions,
        canEdit: true,
        canDelete: true,
      },
      linkedBlocks,
      metadata: {
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        status: task.status,
        priority: task.priority,
        dueDate: task.due_date,
        tags: task.tags,
        projectId: task.project_id,
        projectName: task.project_name,
      },
      original: task,
    };
  },

  getSearchableText(task: TaskEntity): string {
    return [
      task.title,
      task.description,
      task.status,
      task.priority,
      task.assignee_name,
      task.project_name,
      ...(task.tags || []),
    ]
      .filter(Boolean)
      .join(" ");
  },

  getSortValue(task: TaskEntity, field: string): unknown {
    switch (field) {
      case "title":
        return task.title;
      case "status":
        return getStatusOrder(task.status);
      case "priority":
        return getPriorityOrder(task.priority);
      case "dueDate":
        return task.due_date;
      case "createdAt":
        return task.created_at;
      default:
        return task[field as keyof TaskEntity];
    }
  },
};

// ============================================================================
// Event Adapter
// ============================================================================

export const eventAdapter: BlockAdapter<EventEntity> = {
  toBlock(event: EventEntity): UniversalBlock {
    const linkedBlocks: LinkedBlock[] = [];

    if (event.organizer_id) {
      linkedBlocks.push({
        blockId: event.organizer_id,
        blockType: "user",
        linkType: "owner",
      });
    }

    if (event.attendees) {
      event.attendees.forEach((userId) => {
        linkedBlocks.push({
          blockId: userId,
          blockType: "user",
          linkType: "reference",
        });
      });
    }

    return {
      id: event.id,
      type: "event",
      title: event.title,
      subtitle: formatEventTime(event.start_time, event.end_time, event.all_day),
      description: event.description,
      icon: "Calendar",
      color: event.color || "#3b82f6",
      permissions: {
        ...defaultPermissions,
        canEdit: true,
        canDelete: true,
      },
      linkedBlocks,
      metadata: {
        createdAt: event.created_at,
        updatedAt: event.updated_at,
        startDate: event.start_time,
        endDate: event.end_time,
        location: event.location,
        allDay: event.all_day,
        calendarId: event.calendar_id,
        recurrence: event.recurrence,
      },
      original: event,
    };
  },

  getSearchableText(event: EventEntity): string {
    return [
      event.title,
      event.description,
      event.location,
      event.organizer_name,
    ]
      .filter(Boolean)
      .join(" ");
  },

  getSortValue(event: EventEntity, field: string): unknown {
    switch (field) {
      case "title":
        return event.title;
      case "startDate":
        return event.start_time;
      case "endDate":
        return event.end_time;
      default:
        return event[field as keyof EventEntity];
    }
  },
};

// ============================================================================
// Document Adapter
// ============================================================================

export const documentAdapter: BlockAdapter<DocumentEntity> = {
  toBlock(doc: DocumentEntity): UniversalBlock {
    const linkedBlocks: LinkedBlock[] = [];

    if (doc.owner_id) {
      linkedBlocks.push({
        blockId: doc.owner_id,
        blockType: "user",
        linkType: "owner",
      });
    }

    if (doc.collaborators) {
      doc.collaborators.forEach((userId) => {
        linkedBlocks.push({
          blockId: userId,
          blockType: "user",
          linkType: "reference",
        });
      });
    }

    return {
      id: doc.id,
      type: "document",
      title: doc.title,
      subtitle: doc.owner_name ? `Par ${doc.owner_name}` : undefined,
      icon: getDocumentIcon(doc.type),
      thumbnailUrl: doc.thumbnail_url,
      color: getDocumentColor(doc.type),
      permissions: {
        ...defaultPermissions,
        canEdit: true,
        canDelete: true,
        canShare: true,
      },
      linkedBlocks,
      metadata: {
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
        ownerId: doc.owner_id,
        ownerName: doc.owner_name,
        tags: doc.tags,
        documentType: doc.type,
      },
      original: doc,
    };
  },

  getSearchableText(doc: DocumentEntity): string {
    return [doc.title, doc.content, ...(doc.tags || [])]
      .filter(Boolean)
      .join(" ");
  },

  getSortValue(doc: DocumentEntity, field: string): unknown {
    switch (field) {
      case "title":
        return doc.title;
      case "type":
        return doc.type;
      case "createdAt":
        return doc.created_at;
      case "updatedAt":
        return doc.updated_at;
      default:
        return doc[field as keyof DocumentEntity];
    }
  },
};

// ============================================================================
// Container Adapter
// ============================================================================

export const containerAdapter: BlockAdapter<ContainerEntity> = {
  toBlock(container: ContainerEntity): UniversalBlock {
    return {
      id: container.id,
      type: "container",
      title: container.name,
      subtitle: container.image,
      description: container.ports?.join(", "),
      icon: getContainerIcon(container.status),
      color: getContainerStatusColor(container.status),
      permissions: {
        ...defaultPermissions,
        canEdit: true,
        canDelete: true,
      },
      metadata: {
        createdAt: container.created_at,
        status: container.status,
        image: container.image,
        ports: container.ports,
        startedAt: container.started_at,
      },
      original: container,
    };
  },

  getSearchableText(container: ContainerEntity): string {
    return [container.name, container.image, container.status]
      .filter(Boolean)
      .join(" ");
  },

  getSortValue(container: ContainerEntity, field: string): unknown {
    switch (field) {
      case "name":
        return container.name;
      case "status":
        return container.status;
      case "createdAt":
        return container.created_at;
      default:
        return container[field as keyof ContainerEntity];
    }
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    super_admin: "#ef4444",
    admin: "#f97316",
    manager: "#eab308",
    user: "#3b82f6",
    guest: "#6b7280",
  };
  return colors[role] || "#6b7280";
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Music";
  if (mimeType === "application/pdf") return "FileText";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Table";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "Presentation";
  if (mimeType.includes("document") || mimeType.includes("word")) return "FileText";
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "Archive";
  if (mimeType.includes("text/")) return "FileCode";
  return "File";
}

function getFileColor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "#ec4899";
  if (mimeType.startsWith("video/")) return "#8b5cf6";
  if (mimeType.startsWith("audio/")) return "#06b6d4";
  if (mimeType === "application/pdf") return "#ef4444";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "#22c55e";
  if (mimeType.includes("presentation")) return "#f97316";
  if (mimeType.includes("document") || mimeType.includes("word")) return "#3b82f6";
  return "#6b7280";
}

function getTaskIcon(status: string): string {
  switch (status) {
    case "done":
      return "CheckCircle2";
    case "in_progress":
      return "Clock";
    case "cancelled":
      return "XCircle";
    default:
      return "Circle";
  }
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    urgent: "#ef4444",
    high: "#f97316",
    medium: "#eab308",
    low: "#22c55e",
  };
  return colors[priority] || "#6b7280";
}

function getStatusOrder(status: string): number {
  const order: Record<string, number> = {
    in_progress: 0,
    todo: 1,
    done: 2,
    cancelled: 3,
  };
  return order[status] ?? 99;
}

function getPriorityOrder(priority: string): number {
  const order: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return order[priority] ?? 99;
}

function formatEventTime(start: string, end?: string, allDay?: boolean): string {
  if (allDay) return "Toute la journée";

  const startDate = new Date(start);
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };

  if (end) {
    const endDate = new Date(end);
    return `${startDate.toLocaleTimeString("fr-FR", options)} - ${endDate.toLocaleTimeString("fr-FR", options)}`;
  }

  return startDate.toLocaleTimeString("fr-FR", options);
}

function getDocumentIcon(type: string): string {
  switch (type) {
    case "spreadsheet":
      return "Table";
    case "presentation":
      return "Presentation";
    default:
      return "FileText";
  }
}

function getDocumentColor(type: string): string {
  switch (type) {
    case "spreadsheet":
      return "#22c55e";
    case "presentation":
      return "#f97316";
    default:
      return "#3b82f6";
  }
}

function getContainerIcon(status: string): string {
  switch (status) {
    case "running":
      return "Play";
    case "paused":
      return "Pause";
    case "stopped":
      return "Square";
    case "restarting":
      return "RefreshCw";
    default:
      return "Box";
  }
}

function getContainerStatusColor(status: string): string {
  switch (status) {
    case "running":
      return "#22c55e";
    case "paused":
      return "#eab308";
    case "stopped":
      return "#6b7280";
    case "restarting":
      return "#3b82f6";
    default:
      return "#6b7280";
  }
}
