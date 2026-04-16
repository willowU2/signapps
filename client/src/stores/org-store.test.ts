/**
 * Org store — regression tests for Phase A + Phase C fixes.
 *
 * Phase A (commit af5fd555):
 *   - Removed `selectedNode` from persist `partialize` to avoid
 *     cross-tree stale state on reload.
 *   - `fetchTrees` classifies `tree_type` by node_type prefix
 *     (clients/suppliers/internal).
 *
 * Phase C (commit 0424a1dd):
 *   - Tightened the raw API array type and dropped inline `as string`
 *     casts.
 *
 * These tests exercise `fetchTrees` against a mocked `orgApi.trees.list()`
 * and verify the tree-type classification + parent_id-null filtering
 * (only root nodes become OrgTree entries).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock orgApi before importing the store
vi.mock("@/lib/api/org", () => ({
  orgApi: {
    trees: {
      list: vi.fn(),
    },
  },
}));

import { useOrgStore } from "./org-store";
import { orgApi } from "@/lib/api/org";

describe("org-store fetchTrees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOrgStore.setState({
      trees: [],
      treesLoading: false,
      treesError: null,
    });
  });

  it("extracts root nodes (parent_id = null) as OrgTree entries", async () => {
    const nodes = [
      {
        id: "root-1",
        parent_id: null,
        tenant_id: "tenant-1",
        node_type: "department",
        name: "HQ",
        children: [],
        depth: 0,
        employee_count: 100,
      },
      {
        id: "child-1",
        parent_id: "root-1",
        tenant_id: "tenant-1",
        node_type: "team",
        name: "Engineering",
        children: [],
        depth: 1,
        employee_count: 25,
      },
      {
        id: "root-2",
        parent_id: null,
        tenant_id: "tenant-1",
        node_type: "department",
        name: "Subsidiary",
        children: [],
        depth: 0,
        employee_count: 50,
      },
    ];
    (orgApi.trees.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: nodes,
    });

    await useOrgStore.getState().fetchTrees();

    const trees = useOrgStore.getState().trees;
    expect(trees).toHaveLength(2);
    expect(trees.map((t) => t.id).sort()).toEqual(["root-1", "root-2"]);
  });

  it("classifies tree_type 'clients' when node_type starts with 'client'", async () => {
    (orgApi.trees.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: "r1",
          parent_id: null,
          tenant_id: "t",
          node_type: "client_org",
          name: "Clients",
        },
      ],
    });
    await useOrgStore.getState().fetchTrees();
    expect(useOrgStore.getState().trees[0]?.tree_type).toBe("clients");
  });

  it("classifies tree_type 'suppliers' when node_type starts with 'supplier'", async () => {
    (orgApi.trees.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: "r1",
          parent_id: null,
          tenant_id: "t",
          node_type: "supplier_network",
          name: "Suppliers",
        },
      ],
    });
    await useOrgStore.getState().fetchTrees();
    expect(useOrgStore.getState().trees[0]?.tree_type).toBe("suppliers");
  });

  it("classifies tree_type 'internal' for anything else", async () => {
    (orgApi.trees.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: "r1",
          parent_id: null,
          tenant_id: "t",
          node_type: "department",
          name: "HQ",
        },
      ],
    });
    await useOrgStore.getState().fetchTrees();
    expect(useOrgStore.getState().trees[0]?.tree_type).toBe("internal");
  });

  it("sets treesError on API failure", async () => {
    (orgApi.trees.list as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down"),
    );
    await useOrgStore.getState().fetchTrees();
    expect(useOrgStore.getState().treesError).toContain("network down");
    expect(useOrgStore.getState().treesLoading).toBe(false);
  });
});
