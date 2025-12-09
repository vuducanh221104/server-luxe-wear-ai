/**
 * @file knowledge.service.test.ts
 * @description Unit tests for KnowledgeService
 */

import { KnowledgeService } from "../../../src/services/knowledge.service";
import { supabaseAdmin } from "../../../src/config/supabase";

// Mock dependencies
jest.mock("../../../src/config/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

jest.mock("../../../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../../src/services/vector.service", () => ({
  deleteKnowledge: jest.fn(),
}));

jest.mock("../../../src/services/storage.service", () => ({
  storageService: {
    deleteKnowledgeFile: jest.fn(),
  },
}));

describe("KnowledgeService", () => {
  let knowledgeService: KnowledgeService;

  const mockKnowledge = {
    id: "knowledge-1",
    title: "Test Knowledge",
    user_id: "user-1",
    tenant_id: "tenant-1",
    agent_id: "agent-1",
    metadata: { description: "Test description" },
    file_url: null,
    file_size: 1000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    knowledgeService = new KnowledgeService();
    jest.clearAllMocks();
  });

  describe("createKnowledge", () => {
    it("should create knowledge entry successfully", async () => {
      const mockFrom = jest.fn((table: string) => {
        if (table === "agents") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: { id: "agent-1" }, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockKnowledge, error: null }),
            }),
          }),
        };
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await knowledgeService.createKnowledge({
        title: "Test Knowledge",
        user_id: "user-1",
        tenant_id: "tenant-1",
        agent_id: "agent-1",
      });

      expect(result).toEqual(mockKnowledge);
    });

    it("should set agent_id to null if agent not found", async () => {
      const mockFrom = jest.fn((table: string) => {
        if (table === "agents") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
                }),
              }),
            }),
          };
        }
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...mockKnowledge, agent_id: null },
                error: null,
              }),
            }),
          }),
        };
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await knowledgeService.createKnowledge({
        title: "Test Knowledge",
        user_id: "user-1",
        tenant_id: "tenant-1",
        agent_id: "invalid-agent",
      });

      expect(result.agent_id).toBeNull();
    });

    it("should throw error on database failure", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "Database error" },
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      await expect(
        knowledgeService.createKnowledge({
          title: "Test",
          user_id: "user-1",
          tenant_id: "tenant-1",
        })
      ).rejects.toThrow("Failed to create knowledge entry");
    });
  });

  describe("getKnowledgeById", () => {
    it("should return knowledge when found", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockKnowledge, error: null }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await knowledgeService.getKnowledgeById("knowledge-1", "user-1", "tenant-1");

      expect(result).toEqual(mockKnowledge);
    });

    it("should return null when not found", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: "PGRST116" },
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await knowledgeService.getKnowledgeById("knowledge-1", "user-1", "tenant-1");

      expect(result).toBeNull();
    });
  });

  describe("listKnowledge", () => {
    it("should return paginated knowledge list", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: [mockKnowledge],
                  error: null,
                  count: 1,
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await knowledgeService.listKnowledge("user-1", "tenant-1", {
        page: 1,
        limit: 10,
      });

      expect(result.knowledge).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it("should filter by agent when provided", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  range: jest.fn().mockResolvedValue({
                    data: [mockKnowledge],
                    error: null,
                    count: 1,
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await knowledgeService.listKnowledge("user-1", "tenant-1", {
        page: 1,
        limit: 10,
        agentId: "agent-1",
      });

      expect(result.knowledge).toBeDefined();
    });
  });

  describe("updateKnowledge", () => {
    it("should update knowledge successfully", async () => {
      const updatedKnowledge = { ...mockKnowledge, title: "Updated Title" };
      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: updatedKnowledge, error: null }),
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await knowledgeService.updateKnowledge(
        "knowledge-1",
        { title: "Updated Title" },
        "user-1",
        "tenant-1"
      );

      expect(result.title).toBe("Updated Title");
    });

    it("should throw error when knowledge not found", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      await expect(
        knowledgeService.updateKnowledge("knowledge-1", { title: "Updated" }, "user-1", "tenant-1")
      ).rejects.toThrow("Knowledge entry not found");
    });
  });

  describe("deleteKnowledge", () => {
    it("should delete knowledge successfully", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockKnowledge, error: null }),
              }),
            }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      await expect(
        knowledgeService.deleteKnowledge("knowledge-1", "user-1", "tenant-1")
      ).resolves.toBeUndefined();
    });

    it("should throw error when knowledge not found", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      await expect(
        knowledgeService.deleteKnowledge("knowledge-1", "user-1", "tenant-1")
      ).rejects.toThrow("Knowledge entry not found");
    });
  });

  describe("searchKnowledge", () => {
    it("should search knowledge by query", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              or: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [mockKnowledge],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await knowledgeService.searchKnowledge("test", "user-1", "tenant-1");

      expect(result).toHaveLength(1);
    });

    it("should return empty array when no results", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              or: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await knowledgeService.searchKnowledge("nonexistent", "user-1", "tenant-1");

      expect(result).toHaveLength(0);
    });
  });

  describe("getKnowledgeStats", () => {
    it("should return knowledge statistics", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                { id: "1", agent_id: "agent-1", file_size: 1000 },
                { id: "2", agent_id: "agent-1", file_size: 2000 },
                { id: "3", agent_id: null, file_size: 500 },
              ],
              error: null,
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await knowledgeService.getKnowledgeStats("user-1", "tenant-1");

      expect(result.totalEntries).toBe(3);
      expect(result.totalSize).toBe(3500);
      expect(result.entriesByAgent["agent-1"]).toBe(2);
      expect(result.entriesByAgent["unassigned"]).toBe(1);
    });
  });

  describe("getUserKnowledge", () => {
    it("should call listKnowledge with correct parameters", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: [mockKnowledge],
                  error: null,
                  count: 1,
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await knowledgeService.getUserKnowledge("user-1", "tenant-1", {
        page: 1,
        limit: 10,
      });

      expect(result.knowledge).toHaveLength(1);
    });
  });

  describe("getAllKnowledge", () => {
    it("should return all knowledge entries (admin)", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            range: jest.fn().mockResolvedValue({
              data: [mockKnowledge],
              error: null,
              count: 1,
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await knowledgeService.getAllKnowledge({ page: 1, limit: 10 });

      expect(result.knowledge).toHaveLength(1);
    });
  });
});
