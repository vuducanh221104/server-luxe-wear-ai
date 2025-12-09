/**
 * @file tenant.service.test.ts
 * @description Unit tests for tenant service
 */

// Track database results
let dbResults: { data: unknown; error: unknown; count?: number } = { data: null, error: null };

jest.mock("../../../src/config/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => Promise.resolve(dbResults)),
    })),
  },
}));

jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

// Import after mocks
import { TenantService } from "../../../src/services/tenant.service";

describe("TenantService", () => {
  let tenantService: TenantService;

  const mockTenant = {
    id: "tenant-123",
    name: "Test Tenant",
    plan: "free",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tenantService = new TenantService();
    dbResults = { data: null, error: null };
  });

  describe("getTenantById", () => {
    it("should return tenant when found", async () => {
      dbResults = { data: mockTenant, error: null };

      const result = await tenantService.getTenantById("tenant-123");

      expect(result).toEqual(mockTenant);
    });

    it("should return null when tenant not found", async () => {
      dbResults = { data: null, error: { code: "PGRST116", message: "Not found" } };

      const result = await tenantService.getTenantById("invalid-id");

      expect(result).toBeNull();
    });

    it("should throw error for other database errors", async () => {
      dbResults = { data: null, error: { code: "OTHER", message: "Database error" } };

      await expect(tenantService.getTenantById("tenant-123")).rejects.toThrow(
        "Failed to get tenant: Database error"
      );
    });
  });

  describe("updateTenant", () => {
    it("should update tenant successfully", async () => {
      const updatedTenant = { ...mockTenant, name: "Updated Tenant" };
      dbResults = { data: updatedTenant, error: null };

      const result = await tenantService.updateTenant("tenant-123", { name: "Updated Tenant" });

      expect(result.name).toBe("Updated Tenant");
    });

    it("should throw error when tenant not found", async () => {
      dbResults = { data: null, error: { code: "PGRST116", message: "Not found" } };

      await expect(tenantService.updateTenant("invalid-id", { name: "Test" })).rejects.toThrow(
        "Tenant not found"
      );
    });

    it("should throw error when update fails", async () => {
      dbResults = { data: null, error: { code: "OTHER", message: "Update failed" } };

      await expect(tenantService.updateTenant("tenant-123", { name: "Test" })).rejects.toThrow(
        "Failed to update tenant: Update failed"
      );
    });
  });

  describe("deleteTenant", () => {
    it("should delete tenant successfully", async () => {
      dbResults = { data: null, error: null };

      await expect(tenantService.deleteTenant("tenant-123")).resolves.toBeUndefined();
    });
  });

  describe("listTenants", () => {
    it("should return empty list when no tenants", async () => {
      dbResults = { data: [], error: null, count: 0 };

      const result = await tenantService.listTenants(1, 10);

      expect(result.tenants).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(10);
    });
  });
});
