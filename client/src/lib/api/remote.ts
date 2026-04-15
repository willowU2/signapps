/**
 * Remote API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, getServiceBaseUrl, ServiceName } from "./factory";

// Get the remote service client (cached)
const remoteClient = getClient(ServiceName.REMOTE);
const REMOTE_URL = getServiceBaseUrl(ServiceName.REMOTE);

// ============================================================================
// Types
// ============================================================================

export interface RemoteConnection {
  id: string;
  hardware_id?: string;
  name: string;
  protocol: "rdp" | "vnc" | "ssh" | "telnet";
  hostname: string;
  port: number;
  username?: string;
  parameters?: Record<string, unknown>;
  recording_enabled?: boolean;
  recording_path?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateConnectionRequest {
  hardware_id?: string;
  name: string;
  protocol: "rdp" | "vnc" | "ssh" | "telnet";
  hostname: string;
  port: number;
  username?: string;
  password?: string;
  private_key?: string;
  parameters?: Record<string, unknown>;
}

export interface UpdateConnectionRequest {
  name?: string;
  protocol?: "rdp" | "vnc" | "ssh" | "telnet";
  hostname?: string;
  port?: number;
  username?: string;
  password?: string;
  private_key?: string;
  parameters?: Record<string, unknown>;
  recording_enabled?: boolean;
}

// ============================================================================
// Remote API
// ============================================================================

export const remoteApi = {
  // List all remote connections
  listConnections: () =>
    remoteClient.get<RemoteConnection[]>("/remote/connections"),

  // Get a single connection
  getConnection: (id: string) =>
    remoteClient.get<RemoteConnection>(`/remote/connections/${id}`),

  // Create a new connection
  createConnection: (data: CreateConnectionRequest) =>
    remoteClient.post<RemoteConnection>("/remote/connections", data),

  // Update a connection
  updateConnection: (id: string, data: UpdateConnectionRequest) =>
    remoteClient.put<RemoteConnection>(`/remote/connections/${id}`, data),

  // Delete a connection
  deleteConnection: (id: string) =>
    remoteClient.delete(`/remote/connections/${id}`),

  // Get WebSocket URL for remote connection (Guacamole protocol)
  getWebSocketUrl: (connectionId: string): string => {
    const wsBaseUrl = REMOTE_URL.replace(/^http/, "ws");
    return `${wsBaseUrl}/remote/ws/${connectionId}`;
  },
};
