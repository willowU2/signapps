/**
 * Document Version History API
 *
 * API client for version history operations.
 */

import { getClient, ServiceName } from "@/lib/api/factory";

const api = getClient(ServiceName.OFFICE);
import type {
  DocumentVersion,
  VersionsResponse,
  VersionDiff,
  GetVersionsParams,
  CreateVersionRequest,
  RestoreVersionRequest,
  CompareVersionsRequest,
} from "./types";

const VERSIONS_BASE = "/api/v1/documents";

// ============================================================================
// Version History
// ============================================================================

/**
 * Get version history for a document
 */
export async function getVersions(
  params: GetVersionsParams,
): Promise<VersionsResponse> {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append("page", String(params.page));
  if (params.pageSize) queryParams.append("pageSize", String(params.pageSize));
  if (params.type && params.type !== "all")
    queryParams.append("type", params.type);
  if (params.starredOnly) queryParams.append("starredOnly", "true");
  if (params.fromDate) queryParams.append("fromDate", params.fromDate);
  if (params.toDate) queryParams.append("toDate", params.toDate);

  const response = await api.get<VersionsResponse>(
    `${VERSIONS_BASE}/${params.documentId}/versions?${queryParams.toString()}`,
  );
  return response.data;
}

/**
 * Get a specific version
 */
export async function getVersion(
  documentId: string,
  versionId: string,
): Promise<DocumentVersion> {
  const response = await api.get<DocumentVersion>(
    `${VERSIONS_BASE}/${documentId}/versions/${versionId}`,
  );
  return response.data;
}

/**
 * Get the current (latest) version
 */
export async function getCurrentVersion(
  documentId: string,
): Promise<DocumentVersion> {
  const response = await api.get<DocumentVersion>(
    `${VERSIONS_BASE}/${documentId}/versions/current`,
  );
  return response.data;
}

/**
 * Get version content (the actual document content at that point)
 */
export async function getVersionContent(
  documentId: string,
  versionId: string,
): Promise<{ content: Record<string, unknown> }> {
  const response = await api.get<{ content: Record<string, unknown> }>(
    `${VERSIONS_BASE}/${documentId}/versions/${versionId}/content`,
  );
  return response.data;
}

// ============================================================================
// Version Creation
// ============================================================================

/**
 * Create a manual version (snapshot)
 */
export async function createVersion(
  request: CreateVersionRequest,
): Promise<DocumentVersion> {
  const response = await api.post<DocumentVersion>(
    `${VERSIONS_BASE}/${request.documentId}/versions`,
    {
      label: request.label,
      description: request.description,
    },
  );
  return response.data;
}

/**
 * Update version metadata (label, description, starred)
 */
export async function updateVersion(
  documentId: string,
  versionId: string,
  data: { label?: string; description?: string; isStarred?: boolean },
): Promise<DocumentVersion> {
  const response = await api.patch<DocumentVersion>(
    `${VERSIONS_BASE}/${documentId}/versions/${versionId}`,
    data,
  );
  return response.data;
}

/**
 * Delete a version
 */
export async function deleteVersion(
  documentId: string,
  versionId: string,
): Promise<void> {
  await api.delete(`${VERSIONS_BASE}/${documentId}/versions/${versionId}`);
}

// ============================================================================
// Version Restoration
// ============================================================================

/**
 * Restore a document to a previous version
 */
export async function restoreVersion(
  request: RestoreVersionRequest,
): Promise<{ newVersion: DocumentVersion; backupVersion?: DocumentVersion }> {
  // Extract documentId from the version
  const versionResponse = await api.get<DocumentVersion>(
    `${VERSIONS_BASE}/versions/${request.versionId}`,
  );
  const documentId = versionResponse.data.documentId;

  const response = await api.post<{
    newVersion: DocumentVersion;
    backupVersion?: DocumentVersion;
  }>(`${VERSIONS_BASE}/${documentId}/versions/${request.versionId}/restore`, {
    createBackup: request.createBackup ?? true,
  });
  return response.data;
}

/**
 * Restore version by document ID and version ID
 */
export async function restoreDocumentVersion(
  documentId: string,
  versionId: string,
  createBackup = true,
): Promise<{ newVersion: DocumentVersion; backupVersion?: DocumentVersion }> {
  const response = await api.post<{
    newVersion: DocumentVersion;
    backupVersion?: DocumentVersion;
  }>(`${VERSIONS_BASE}/${documentId}/versions/${versionId}/restore`, {
    createBackup,
  });
  return response.data;
}

// ============================================================================
// Version Comparison
// ============================================================================

/**
 * Compare two versions and get diff
 */
export async function compareVersions(
  request: CompareVersionsRequest,
): Promise<VersionDiff> {
  const params = new URLSearchParams();
  params.append("sourceVersionId", request.sourceVersionId);
  params.append("targetVersionId", request.targetVersionId);
  if (request.format) params.append("format", request.format);
  if (request.contextLines)
    params.append("contextLines", String(request.contextLines));

  // Get documentId from source version
  const sourceVersion = await api.get<DocumentVersion>(
    `${VERSIONS_BASE}/versions/${request.sourceVersionId}`,
  );

  const response = await api.get<VersionDiff>(
    `${VERSIONS_BASE}/${sourceVersion.data.documentId}/versions/compare?${params.toString()}`,
  );
  return response.data;
}

/**
 * Compare with document ID
 */
export async function compareDocumentVersions(
  documentId: string,
  sourceVersionId: string,
  targetVersionId: string,
  options?: { format?: "unified" | "sideBySide"; contextLines?: number },
): Promise<VersionDiff> {
  const params = new URLSearchParams();
  params.append("sourceVersionId", sourceVersionId);
  params.append("targetVersionId", targetVersionId);
  if (options?.format) params.append("format", options.format);
  if (options?.contextLines)
    params.append("contextLines", String(options.contextLines));

  const response = await api.get<VersionDiff>(
    `${VERSIONS_BASE}/${documentId}/versions/compare?${params.toString()}`,
  );
  return response.data;
}

// ============================================================================
// Star/Pin Versions
// ============================================================================

/**
 * Star/pin a version
 */
export async function starVersion(
  documentId: string,
  versionId: string,
): Promise<void> {
  await api.post(`${VERSIONS_BASE}/${documentId}/versions/${versionId}/star`);
}

/**
 * Unstar/unpin a version
 */
export async function unstarVersion(
  documentId: string,
  versionId: string,
): Promise<void> {
  await api.delete(`${VERSIONS_BASE}/${documentId}/versions/${versionId}/star`);
}

/**
 * Get starred versions
 */
export async function getStarredVersions(
  documentId: string,
): Promise<DocumentVersion[]> {
  const response = await api.get<DocumentVersion[]>(
    `${VERSIONS_BASE}/${documentId}/versions/starred`,
  );
  return response.data;
}

// ============================================================================
// Version Preview
// ============================================================================

/**
 * Generate or get preview thumbnail for a version
 */
export async function getVersionThumbnail(
  documentId: string,
  versionId: string,
): Promise<{ thumbnailUrl: string }> {
  const response = await api.get<{ thumbnailUrl: string }>(
    `${VERSIONS_BASE}/${documentId}/versions/${versionId}/thumbnail`,
  );
  return response.data;
}

// ============================================================================
// Export All
// ============================================================================

export const versionsApi = {
  // History
  getVersions,
  getVersion,
  getCurrentVersion,
  getVersionContent,
  // Create/Update/Delete
  createVersion,
  updateVersion,
  deleteVersion,
  // Restore
  restoreVersion,
  restoreDocumentVersion,
  // Compare
  compareVersions,
  compareDocumentVersions,
  // Star
  starVersion,
  unstarVersion,
  getStarredVersions,
  // Preview
  getVersionThumbnail,
};

export default versionsApi;
