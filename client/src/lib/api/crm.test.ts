/**
 * CRM mappers — regression tests for Phase C typing + Phase A fixes.
 *
 * Coverage focus:
 * 1. Phase C (commit 46df815a): ApiDeal / ApiLead interfaces added,
 *    mapper signatures tightened. These tests lock in the backend →
 *    frontend field mapping (snake_case → camelCase, enum defaults).
 * 2. Regression against mapping drift — if anyone changes the mapper
 *    without updating the test, the test catches it.
 *
 * The mapper functions are internal (`mapDeal` / `mapLead`), so we
 * exercise them through the exported `dealsApi.get` / `leadsApi.get`
 * with a mocked HTTP client that returns the ApiDeal shape.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the client factory before importing the API module
vi.mock("./factory", () => ({
  ServiceName: {
    CONTACTS: "CONTACTS",
    IDENTITY: "IDENTITY",
    STORAGE: "STORAGE",
  },
  getClient: vi.fn(),
}));

import { dealsApi, leadsApi } from "./crm";
import { getClient } from "./factory";

describe("crm.ts mappers", () => {
  let mockClient: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn(),
    };
    (getClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);
  });

  describe("mapDeal (via dealsApi.get)", () => {
    it("maps snake_case backend fields to camelCase Deal", async () => {
      const apiDeal = {
        id: "deal-1",
        title: "Big opportunity",
        contact_name: "Acme Corp",
        contact_id: "contact-1",
        contact_email: "ceo@acme.com",
        amount: 50000,
        probability: 75,
        stage: "negotiation",
        close_date: "2026-06-01",
        owner_id: "user-1",
        created_at: "2026-04-16T00:00:00Z",
        updated_at: "2026-04-16T12:00:00Z",
      };
      mockClient.get.mockResolvedValue({ data: apiDeal });

      const deal = await dealsApi.get("deal-1");

      expect(deal).toEqual({
        id: "deal-1",
        title: "Big opportunity",
        company: "Acme Corp",
        contactId: "contact-1",
        contactEmail: "ceo@acme.com",
        value: 50000,
        probability: 75,
        stage: "negotiation",
        closeDate: "2026-06-01",
        assignedTo: "user-1",
        tags: [],
        createdAt: "2026-04-16T00:00:00Z",
        updatedAt: "2026-04-16T12:00:00Z",
      });
    });

    it("applies defaults when backend fields are null", async () => {
      const apiDeal = {
        id: "deal-2",
        title: "Minimal deal",
        owner_id: "user-1",
        created_at: "2026-04-16T00:00:00Z",
        updated_at: "2026-04-16T00:00:00Z",
        // All optional fields null
        contact_name: null,
        amount: null,
        probability: null,
        stage: null,
      };
      mockClient.get.mockResolvedValue({ data: apiDeal });

      const deal = await dealsApi.get("deal-2");

      // Defaults per mapDeal:
      expect(deal?.company).toBe(""); // contact_name ?? ""
      expect(deal?.value).toBe(0); // amount ?? 0
      expect(deal?.probability).toBe(10); // probability ?? 10
      expect(deal?.stage).toBe("prospect"); // stage ?? "prospect"
    });

    it("returns undefined on API error (silent fallback)", async () => {
      mockClient.get.mockRejectedValue(new Error("404"));
      const deal = await dealsApi.get("nonexistent");
      expect(deal).toBeUndefined();
    });
  });

  describe("mapLead (via leadsApi.get)", () => {
    it("maps snake_case backend fields to camelCase Lead", async () => {
      const apiLead = {
        id: "lead-1",
        name: "Jane Prospect",
        email: "jane@example.com",
        phone: "+1-555-0100",
        company: "Prospect Co",
        source: "website",
        status: "qualified",
        score: 85,
        owner_id: "user-1",
        tenant_id: "tenant-1",
        notes: "Interested in Enterprise",
        created_at: "2026-04-10T00:00:00Z",
        updated_at: "2026-04-16T00:00:00Z",
      };
      mockClient.get.mockResolvedValue({ data: apiLead });

      const lead = await leadsApi.get("lead-1");

      expect(lead).toEqual({
        id: "lead-1",
        name: "Jane Prospect",
        email: "jane@example.com",
        phone: "+1-555-0100",
        company: "Prospect Co",
        source: "website",
        status: "qualified",
        score: 85,
        ownerId: "user-1",
        tenantId: "tenant-1",
        notes: "Interested in Enterprise",
        createdAt: "2026-04-10T00:00:00Z",
        updatedAt: "2026-04-16T00:00:00Z",
      });
    });

    it("uses 'new' as default status and 0 as default score", async () => {
      const apiLead = {
        id: "lead-2",
        name: "Anonymous",
        owner_id: "user-1",
        created_at: "2026-04-16T00:00:00Z",
        updated_at: "2026-04-16T00:00:00Z",
        // status / score missing
      };
      mockClient.get.mockResolvedValue({ data: apiLead });

      const lead = await leadsApi.get("lead-2");

      expect(lead?.status).toBe("new");
      expect(lead?.score).toBe(0);
    });
  });
});
