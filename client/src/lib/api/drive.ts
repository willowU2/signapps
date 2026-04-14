/**
 * Drive API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, getServiceBaseUrl, ServiceName } from "./factory";
import { storageApi } from "./storage";

// Get the storage service client (cached)
const storageClient = getClient(ServiceName.STORAGE);
const STORAGE_URL = getServiceBaseUrl(ServiceName.STORAGE);

export interface DriveNode {
  id: string;
  parent_id: string | null;
  name: string;
  node_type: "folder" | "file" | "document" | "spreadsheet" | "presentation";
  target_id: string | null;
  owner_id: string;
  size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  access_role?: string;
}

export interface CreateDriveNodeRequest {
  parent_id: string | null;
  name: string;
  node_type: "folder" | "file" | "document" | "spreadsheet" | "presentation";
  target_id: string | null;
  size?: number | null;
  mime_type?: string | null;
}

export interface UpdateDriveNodeRequest {
  name?: string;
  parent_id?: string | null;
}

export const driveApi = {
  // List root nodes or nodes in a folder
  listNodes: async (parentId?: string | null) => {
    const url = parentId
      ? `/drive/nodes/${parentId}/children`
      : "/drive/nodes/root";
    const response = await storageClient.get<DriveNode[]>(url);
    return response.data;
  },

  // Create a new node (folder or shortcut to document/file)
  createNode: async (data: CreateDriveNodeRequest) => {
    const response = await storageClient.post<DriveNode>("/drive/nodes", data);
    return response.data;
  },

  // Rename or Move node
  updateNode: async (id: string, data: UpdateDriveNodeRequest) => {
    const response = await storageClient.put<DriveNode>(
      `/drive/nodes/${id}`,
      data,
    );
    return response.data;
  },

  // Delete node (soft delete)
  deleteNode: async (id: string) => {
    await storageClient.delete(`/drive/nodes/${id}`);
  },

  // Download a file by its Drive node ID.
  // Returns the file as a Blob using the dedicated /drive/nodes/:id/download endpoint.
  downloadNode: async (id: string): Promise<Blob> => {
    const response = await storageClient.get<Blob>(
      `/drive/nodes/${id}/download`,
      {
        responseType: "blob",
      },
    );
    return response.data;
  },

  // Direct download URL for a drive node (can be used in <a href>).
  downloadNodeUrl: (id: string): string => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;
    return `${STORAGE_URL}/api/v1/drive/nodes/${id}/download${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  },

  // Upload a file into the drive (optionally under a parent folder).
  // Uses storageApi.uploadFile('drive', file) then creates a drive node pointing to
  // the uploaded object so the file appears in the drive tree.
  uploadFile: async (
    file: File,
    parentId: string | null,
    onProgress?: (percent: number) => void,
  ) => {
    // Step 1: upload the binary to the 'drive' bucket
    const uploadRes = await storageApi.uploadFile("drive", file, onProgress);
    const uploaded = Array.isArray(uploadRes.data)
      ? uploadRes.data[0]
      : uploadRes.data;
    // Step 2: create a drive node entry for the uploaded file
    // Use file.name as display name (not the storage key which may be a UUID path)
    const nodeRes = await storageClient.post<DriveNode>("/drive/nodes", {
      parent_id: parentId,
      name: file.name,
      node_type: "file",
      target_id: uploaded?.id ?? null,
      size: file.size,
      mime_type: file.type || null,
    });
    return nodeRes.data;
  },

  // Find a drive node by its target_id (e.g. to delete a document from its editor).
  // Lists root nodes and returns the first node whose target_id matches.
  // Returns null if not found.
  findNodeByTargetId: async (targetId: string): Promise<DriveNode | null> => {
    const response = await storageClient.get<DriveNode[]>("/drive/nodes/root");
    const nodes: DriveNode[] = response.data;
    return nodes.find((n) => n.target_id === targetId) ?? null;
  },

  // Create a public share link for a drive node. Resolves the underlying
  // storage bucket/key on the backend and returns a tokenised URL.
  createShareLink: async (
    id: string,
    options: CreateNodeShareOptions = {},
  ): Promise<NodeShareLink> => {
    const response = await storageClient.post<NodeShareLink>(
      `/drive/nodes/${id}/share`,
      options,
    );
    return response.data;
  },
};

export interface CreateNodeShareOptions {
  expires_in_hours?: number | null;
  password?: string | null;
  max_downloads?: number | null;
  access_type?: "view" | "download" | "edit";
}

export interface NodeShareLink {
  id: string;
  token: string;
  url: string;
  expires_at: string | null;
}
