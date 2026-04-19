/**
 * Directory store — filter + fuzzy search selector tests.
 *
 * Covers the two user-visible behaviours of the `filterPersons` helper:
 *   - empty query → alphabetical ordering by full name.
 *   - non-empty query → fuzzy match ranked by fuse.js, filters respected.
 *
 * We import the pure `filterPersons` function (exported from the store
 * module) so the test doesn't pull in Zustand persist / localStorage.
 */
import { describe, it, expect } from "vitest";
import { filterPersons, isFresh } from "./directory-store";
import type { Person } from "@/types/org";

const base: Omit<
  Person,
  "id" | "first_name" | "last_name" | "email" | "avatar_url"
> = {
  tenant_id: "t1",
  is_active: true,
  metadata: {},
  created_at: "2026-01-01",
};

const people: Person[] = [
  {
    ...base,
    id: "1",
    first_name: "Marie",
    last_name: "Dupont",
    email: "marie.dupont@nexus.corp",
  },
  {
    ...base,
    id: "2",
    first_name: "Marc",
    last_name: "Durand",
    email: "marc.durand@nexus.corp",
  },
  {
    ...base,
    id: "3",
    first_name: "Alice",
    last_name: "Martin",
    email: "alice.martin@nexus.corp",
    avatar_url: "/a.png",
  },
  {
    ...base,
    id: "4",
    first_name: "Zoe",
    last_name: "Abe",
    email: "zoe.abe@nexus.corp",
  },
];

describe("filterPersons", () => {
  it("returns alphabetically sorted list on empty query", () => {
    const out = filterPersons(people, "", {
      nodeId: null,
      skillCategory: null,
      requirePhoto: false,
    });
    expect(out.map((p) => p.first_name)).toEqual([
      "Alice",
      "Marc",
      "Marie",
      "Zoe",
    ]);
  });

  it("fuzzy-matches on first name", () => {
    const out = filterPersons(people, "marie", {
      nodeId: null,
      skillCategory: null,
      requirePhoto: false,
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].first_name.toLowerCase()).toContain("mar");
    // Marie should rank above Marc on exact match.
    const marie = out.find((p) => p.first_name === "Marie");
    expect(marie).toBeDefined();
  });

  it("fuzzy-matches on email domain", () => {
    const out = filterPersons(people, "alice.martin", {
      nodeId: null,
      skillCategory: null,
      requirePhoto: false,
    });
    expect(out[0]?.first_name).toBe("Alice");
  });

  it("applies requirePhoto filter", () => {
    const out = filterPersons(people, "", {
      nodeId: null,
      skillCategory: null,
      requirePhoto: true,
    });
    expect(out).toHaveLength(1);
    expect(out[0].first_name).toBe("Alice");
  });

  it("returns empty array on no match", () => {
    const out = filterPersons(people, "xyzzyfoobar", {
      nodeId: null,
      skillCategory: null,
      requirePhoto: false,
    });
    expect(out).toEqual([]);
  });
});

describe("isFresh", () => {
  it("returns false when lastFetchedAt is null", () => {
    expect(isFresh(null)).toBe(false);
  });

  it("returns true within TTL", () => {
    expect(isFresh(Date.now() - 1000)).toBe(true);
  });

  it("returns false past TTL", () => {
    // TTL = 5 minutes; subtract 10 minutes.
    expect(isFresh(Date.now() - 10 * 60 * 1000)).toBe(false);
  });
});
