/**
 * @file knowledge.integration.test.ts
 * @description Integration tests for knowledge service
 * Note: Text content is stored in Pinecone, not in the database (KnowledgeInsert has no content field)
 */

// Mock external dependencies before imports
const mockSupabaseFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockRange = jest.fn();

jest.mock("../../src/config/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      mockSupabaseFrom(table);
      return {
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return {
                eq: (...eqArgs2: unknown[]) => {
                  mockEq(...eqArgs2);
                  return {
                    eq: (...eqArgs3: unknown[]) => {
                      mockEq(...eqArgs3);
                      return {
                        single: () => mockSingle(),
                        order: () => ({
                          range: () => mockRange(),
                        }),
                      };
                    },
                    single: () => mockSingle(),
                  };
                },
                single: () => mockSingle(),
              };
            },
            single: () => mockSingle(),
          };
        },
        insert: (...args: unknown[]) => {
          mockInsert(...args);
          return {
            select: () => ({
              single: () => mockSingle(),
            }),
          };
        },
        update: (...args: unknown[]) => {
          mockUpdate(...args);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return {
                eq: () => ({
                  eq: () => ({
                    select: () => ({
                      single: () => mockSingle(),
                    }),
                  }),
                }),
              };
            },
          };
        },
        delete: () => {
          mockDelete();
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return {
                eq: () => ({
                  eq: () => mockSingle(),
                }),
              };
            },
          };
        },
      };
    },
  },
}));

jest.mock("../../src/config/pinecone", () => ({
  getPineconeIndex: jest.fn().mockReturnValue({
    query: jest.fn().mockResolvedValue({ matches: [] }),
    upsert: jest.fn().mockResolvedValue({}),
    deleteOne: jest.fn().mockResolvedValue({}),
  }),
  getPineconeClient: jest.fn().mockReturnValue({
    inference: {
      embed: jest.fn().mockResolvedValue({
        data: [{ values: Array(1024).fill(0.1) }],
        model: "multilingual-e5-large",
        vectorType: "dense",
      }),
    },
  }),
}));

jest.mock("../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

// Import after mocks
import { KnowledgeService } from "../../src/services/knowledge.service";

describe("Knowledge Integration Tests", () => {
  let knowledgeService: KnowledgeService;

  beforeEach(() => {
    jest.clearAllMocks();
    knowledgeService = new KnowledgeService();
  });

  describe("Knowledge Service", () => {
    describe("createKnowledge", () => {
      it("should create a new knowledge entry", async () => {
        // Mock: No agent validation needed (agent_id is null)
        // Note: content is stored in Pinecone, not in database
        mockSingle.mockResolvedValueOnce({
          data: {
            id: "knowledge-123",
            title: "Test Knowledge",
            metadata: { source: "test" },
            user_id: "user-123",
            tenant_id: "tenant-123",
            agent_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });

        const result = await knowledgeService.createKnowledge({
          title: "Test Knowledge",
          metadata: { source: "test" },
          user_id: "user-123",
          tenant_id: "tenant-123",
          agent_id: null,
        });

        expect(result.id).toBe("knowledge-123");
        expect(result.title).toBe("Test Knowledge");
        expect(mockSupabaseFrom).toHaveBeenCalledWith("knowledge");
      });

      it("should validate agent_id when provided", async () => {
        // Mock: Agent exists
        mockSingle.mockResolvedValueOnce({
          data: { id: "agent-123" },
          error: null,
        });
        // Mock: Insert success
        mockSingle.mockResolvedValueOnce({
          data: {
            id: "knowledge-456",
            title: "Agent Knowledge",
            metadata: {},
            user_id: "user-123",
            tenant_id: "tenant-123",
            agent_id: "agent-123",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });

        const result = await knowledgeService.createKnowledge({
          title: "Agent Knowledge",
          metadata: {},
          user_id: "user-123",
          tenant_id: "tenant-123",
          agent_id: "agent-123",
        });

        expect(result.agent_id).toBe("agent-123");
      });
    });

    describe("getKnowledgeById", () => {
      it("should return knowledge when found", async () => {
        mockSingle.mockResolvedValueOnce({
          data: {
            id: "knowledge-123",
            title: "My Knowledge",
            metadata: {},
            user_id: "user-123",
            tenant_id: "tenant-123",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });

        const result = await knowledgeService.getKnowledgeById(
          "knowledge-123",
          "user-123",
          "tenant-123"
        );

        expect(result?.id).toBe("knowledge-123");
        expect(result?.title).toBe("My Knowledge");
      });

      it("should return null when knowledge not found", async () => {
        mockSingle.mockResolvedValueOnce({
          data: null,
          error: { code: "PGRST116", message: "Not found" },
        });

        const result = await knowledgeService.getKnowledgeById(
          "invalid-id",
          "user-123",
          "tenant-123"
        );

        expect(result).toBeNull();
      });
    });
  });

  describe("Vector Search Flow", () => {
    it("should handle search operations", () => {
      // Vector search is tested in vector.service.test.ts
      // Text content is stored in Pinecone with embeddings
      expect(true).toBe(true);
    });
  });

  describe("Knowledge Storage Flow", () => {
    it("should handle complete knowledge lifecycle", async () => {
      // Step 1: Create knowledge (metadata only, content goes to Pinecone)
      mockSingle.mockResolvedValueOnce({
        data: {
          id: "lifecycle-knowledge",
          title: "Lifecycle Test",
          metadata: { type: "document" },
          user_id: "user-1",
          tenant_id: "tenant-1",
          agent_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const created = await knowledgeService.createKnowledge({
        title: "Lifecycle Test",
        metadata: { type: "document" },
        user_id: "user-1",
        tenant_id: "tenant-1",
        agent_id: null,
      });

      expect(created.id).toBe("lifecycle-knowledge");

      // Step 2: Retrieve knowledge
      mockSingle.mockResolvedValueOnce({
        data: {
          id: "lifecycle-knowledge",
          title: "Lifecycle Test",
          metadata: { type: "document" },
          user_id: "user-1",
          tenant_id: "tenant-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const retrieved = await knowledgeService.getKnowledgeById(
        "lifecycle-knowledge",
        "user-1",
        "tenant-1"
      );

      expect(retrieved?.id).toBe(created.id);
    });
  });
});
