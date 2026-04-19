/**
 * Tests for the pure selectors backing the UnassignedPeoplePanel.
 *
 * We deliberately test the filtering logic and not the DOM — there is
 * no dead code path inside the component that would be worth a DOM
 * harness. Keeping the math testable is what matters: a regression
 * here would silently mark assigned people as free to drop again.
 */
import { describe, expect, it } from "vitest";
import {
  collectAssignedPersonIds,
  computeUnassignedPersons,
} from "./unassigned-people-panel";
import type { Person } from "@/types/org";

function mkPerson(overrides: Partial<Person> & { id: string }): Person {
  return {
    id: overrides.id,
    tenant_id: overrides.tenant_id ?? "t1",
    first_name: overrides.first_name ?? "First",
    last_name: overrides.last_name ?? "Last",
    email: overrides.email,
    is_active: overrides.is_active ?? true,
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
  };
}

describe("collectAssignedPersonIds", () => {
  it("returns empty set for empty map", () => {
    expect(collectAssignedPersonIds({})).toEqual(new Set());
  });

  it("deduplicates person ids across nodes", () => {
    const set = collectAssignedPersonIds({
      "node-a": [{ personId: "p1" }, { personId: "p2" }],
      "node-b": [{ personId: "p1" }, { personId: "p3" }],
    });
    expect(set).toEqual(new Set(["p1", "p2", "p3"]));
  });

  it("ignores nodes with empty assignment arrays", () => {
    const set = collectAssignedPersonIds({
      "node-a": [],
      "node-b": [{ personId: "p9" }],
    });
    expect(set).toEqual(new Set(["p9"]));
  });
});

describe("computeUnassignedPersons", () => {
  const alice = mkPerson({ id: "p1", first_name: "Alice" });
  const bob = mkPerson({ id: "p2", first_name: "Bob" });
  const carla = mkPerson({ id: "p3", first_name: "Carla" });
  const dormant = mkPerson({
    id: "p4",
    first_name: "Dormant",
    is_active: false,
  });

  it("returns every active person when no one is assigned", () => {
    const result = computeUnassignedPersons([alice, bob, carla], new Set());
    expect(result.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("filters out persons present in the assigned set", () => {
    const result = computeUnassignedPersons(
      [alice, bob, carla],
      new Set(["p2"]),
    );
    expect(result.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("filters out deactivated persons even if they have no assignment", () => {
    const result = computeUnassignedPersons(
      [alice, bob, dormant],
      new Set(["p2"]),
    );
    expect(result.map((p) => p.id)).toEqual(["p1"]);
  });

  it("returns [] when everyone is assigned", () => {
    const result = computeUnassignedPersons(
      [alice, bob, carla],
      new Set(["p1", "p2", "p3"]),
    );
    expect(result).toEqual([]);
  });

  it("composes cleanly with collectAssignedPersonIds", () => {
    const assignments = {
      "node-a": [{ personId: "p1" }],
      "node-b": [{ personId: "p3" }],
    };
    const result = computeUnassignedPersons(
      [alice, bob, carla],
      collectAssignedPersonIds(assignments),
    );
    expect(result.map((p) => p.id)).toEqual(["p2"]);
  });
});
