/**
 * Drive API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from './factory';
import { storageApi } from './storage';

// Get the storage service client (cached)
const storageClient = getClient(ServiceName.STORAGE);

export interface DriveNode {
  id: string;
  parent_id: string | null;
  name: string;
  node_type: 'folder' | 'file' | 'document' | 'spreadsheet' | 'presentation';
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
  node_type: 'folder' | 'file' | 'document' | 'spreadsheet' | 'presentation';
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
    const url = parentId ? `/drive/nodes/${parentId}/children` : '/drive/nodes/root';
    const response = await storageClient.get<DriveNode[]>(url);
    return response.data;
  },

  // Create a new node (folder or shortcut to document/file)
  createNode: async (data: CreateDriveNodeRequest) => {
    const response = await storageClient.post<DriveNode>('/drive/nodes', data);
    return response.data;
  },

  // Rename or Move node
  updateNode: async (id: string, data: UpdateDriveNodeRequest) => {
    const response = await storageClient.put<DriveNode>(`/drive/nodes/${id}`, data);
    return response.data;
  },

  // Delete node (soft delete)
  deleteNode: async (id: string) => {
    await storageClient.delete(`/drive/nodes/${id}`);
  },

  // Upload a file into the drive (optionally under a parent folder).
  // Uses storageApi.uploadFile('drive', file) then creates a drive node pointing to
  // the uploaded object so the file appears in the drive tree.
  uploadFile: async (file: File, parentId: string | null) => {
    // Step 1: upload the binary to the 'drive' bucket
    const uploadRes = await storageApi.uploadFile('drive', file);
    const uploaded = Array.isArray(uploadRes.data) ? uploadRes.data[0] : uploadRes.data;
    // Step 2: create a drive node entry for the uploaded file
    const nodeRes = await storageClient.post<DriveNode>('/drive/nodes', {
      parent_id: parentId,
      name: file.name,
      node_type: 'file',
      target_id: uploaded?.id ?? null,
      size: file.size,
      mime_type: file.type || null,
    });
    return nodeRes.data;
  },
};

