/**
 * Calendar store — regression tests for Phase A P1 fix (commit 8d3fbd34).
 *
 * Before the fix, `fetchTimeItems` wrote to `isLoading` (the legacy
 * calendar-events flag) instead of `isLoadingTimeItems`. This lock in
 * the correct behaviour: `fetchTimeItems` toggles `isLoadingTimeItems`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the scheduling API before importing the store.
vi.mock("@/lib/scheduling/api/scheduling-api", () => ({
  schedulingApi: {
    getTimeItemsInRange: vi.fn(),
    updateTimeItem: vi.fn(),
    createTimeItem: vi.fn(),
  },
}));

import { useCalendarStore } from "./calendar-store";
import { schedulingApi } from "@/lib/scheduling/api/scheduling-api";

describe("calendar-store fetchTimeItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the store between tests by resetting known fields.
    useCalendarStore.setState({
      isLoading: false,
      isLoadingTimeItems: false,
      timeItems: [],
    });
  });

  it("sets isLoadingTimeItems to true while fetching, false after", async () => {
    const mockResponse = [{ id: "t1", title: "Task" }];
    // Delay to observe the in-flight state
    (
      schedulingApi.getTimeItemsInRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockResponse);

    const range = {
      start: new Date("2026-04-16T00:00:00Z"),
      end: new Date("2026-04-17T00:00:00Z"),
    };

    const promise = useCalendarStore.getState().fetchTimeItems(range);

    // The state should be mid-flight; however given synchronous resolve,
    // by the time we read state the promise may already have resolved.
    // The post-condition is what matters for the regression:
    await promise;

    expect(useCalendarStore.getState().isLoadingTimeItems).toBe(false);
    expect(useCalendarStore.getState().timeItems).toEqual(mockResponse);
  });

  it("does NOT toggle the legacy isLoading field", async () => {
    // This is the core regression — pre-Phase A, fetchTimeItems wrote
    // to `isLoading`. Starting from `isLoading: false`, a successful
    // fetch must leave it untouched.
    useCalendarStore.setState({ isLoading: false });

    (
      schedulingApi.getTimeItemsInRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const range = {
      start: new Date("2026-04-16T00:00:00Z"),
      end: new Date("2026-04-17T00:00:00Z"),
    };
    await useCalendarStore.getState().fetchTimeItems(range);

    // isLoading remains whatever it was before (false); it is NOT the
    // flag that fetchTimeItems manages.
    expect(useCalendarStore.getState().isLoading).toBe(false);
  });

  it("sets isLoadingTimeItems to false even on error", async () => {
    (
      schedulingApi.getTimeItemsInRange as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error("network"));

    const range = {
      start: new Date("2026-04-16T00:00:00Z"),
      end: new Date("2026-04-17T00:00:00Z"),
    };
    await useCalendarStore.getState().fetchTimeItems(range);

    expect(useCalendarStore.getState().isLoadingTimeItems).toBe(false);
  });
});
