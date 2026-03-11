import { storageApiClient } from './core';

export interface DriveNode {
  id: string;
  parent_id: string | null;
  name: string;
  node_type: 'folder' | 'file' | 'document' | 'spreadsheet';
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
  node_type: 'folder' | 'file' | 'document' | 'spreadsheet';
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
    const response = await storageApiClient.get<DriveNode[]>(url);
    return response.data;
  },

  // Create a new node (folder or shortcut to document/file)
  createNode: async (data: CreateDriveNodeRequest) => {
    const response = await storageApiClient.post<DriveNode>('/drive/nodes', data);
    return response.data;
  },

  // Rename or Move node
  updateNode: async (id: string, data: UpdateDriveNodeRequest) => {
    const response = await storageApiClient.put<DriveNode>(`/drive/nodes/${id}`, data);
    return response.data;
  },

  // Delete node (soft delete)
  deleteNode: async (id: string) => {
    await storageApiClient.delete(`/drive/nodes/${id}`);
  },
};

