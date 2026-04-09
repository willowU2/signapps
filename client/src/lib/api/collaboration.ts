/**
 * Collaboration API client — boards, mind maps, kanban.
 *
 * All endpoints route through the gateway at /api/v1/collaboration/*.
 */

import { getClient, ServiceName } from "./factory";

const client = () => getClient(ServiceName.IDENTITY);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Board {
  id: string;
  title: string;
  board_type: string | null;
  data: Record<string, unknown>;
  owner_id: string;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBoardPayload {
  title: string;
  board_type?: string;
  data?: Record<string, unknown>;
}

export interface UpdateBoardPayload {
  title?: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** List all boards for the current user. */
export async function listBoards(): Promise<Board[]> {
  const { data } = await client().get<Board[]>("/collaboration/boards");
  return data;
}

/** Create a new board. */
export async function createBoard(payload: CreateBoardPayload): Promise<Board> {
  const { data } = await client().post<Board>("/collaboration/boards", payload);
  return data;
}

/** Get a single board by ID. */
export async function getBoard(id: string): Promise<Board> {
  const { data } = await client().get<Board>(`/collaboration/boards/${id}`);
  return data;
}

/** Update a board. */
export async function updateBoard(
  id: string,
  payload: UpdateBoardPayload,
): Promise<Board> {
  const { data } = await client().put<Board>(
    `/collaboration/boards/${id}`,
    payload,
  );
  return data;
}

/** Delete a board. */
export async function deleteBoard(id: string): Promise<void> {
  await client().delete(`/collaboration/boards/${id}`);
}

export const collaborationApi = {
  listBoards,
  createBoard,
  getBoard,
  updateBoard,
  deleteBoard,
};
