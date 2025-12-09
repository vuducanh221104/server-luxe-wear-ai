/**
 * @file agent.integration.test.ts
 * @description Integration tests for agent service and controller
 */

// Mock external dependencies before imports
const mockSupabaseFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();

jest.mock("../../src/config/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      mockSupabaseFrom(table);
      return {
        select: (...args: any[]) => {
          mockSelect(...args);
          return {
            eq: (...eqArgs: any[]) => {
              mockEq(...eqArgs);
              return {
                eq: (...eqArgs2: any[]) => {
                  mockEq(...eqArgs2);
                  return {
                    eq: (...eqArgs3: any[]) => {
                      mockEq(...eqArgs3);
                      return {
                        single: () => mockSingle(),
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
        insert: (...args: any[]) => {
          mockInsert(...args);
          return {
            select: () => ({
              single: () => mockSingle(),
            }),
          };
        },
        update: (...args: any[]) => {
          mockUpdate(...args);
          return {
            eq: (...eqArgs: any[]) => {
              mockEq(...eqArgs);
              return {
                eq: () => ({
                  select: () => ({
                    single: () => mockSingle(),
                  }),
                }),
              };
            },
          };
        },
        delete: () => {
          mockDelete();
          return {
            eq: (...eqArgs: any[]) => {
              mockEq(...eqArgs);
              return {
                eq: () => mockSingle(),
              };
            },
          };
        },
      };
    },
  },
}));

jest.mock("../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../src/utils/apiKey", () => ({
  generateApiKey: jest.fn().mockReturnValue("test-api-key-12345"),
}));

// Import after mocks
import { AgentService } from "../../src/services/agent.service";

describe("Agent Integration Tests", () => {
  let agentService: AgentService;

  beforeEach(() => {
    jest.clearAllMocks();
    agentService = new AgentService();
  });

  describe("Agent Service", () => {
    describe("createAgent", () => {
      it("should create a new agent successfully", async () => {
        // Mock: No existing agent with same name
        mockSingle.mockResolvedValueOnce({ data: null, error: null });
        // Mock: Insert success
        mockSingle.mockResolvedValueOnce({
          data: {
            id: "agent-123",
            name: "Test Agent",
            description: "A test agent",
            owner_id: "user-123",
            tenant_id: "tenant-123",
            api_key: "test-api-key-12345",
            system_prompt: "You are helpful",
            is_public: false,
          },
          error: null,
        });

        const result = await agentService.createAgent(
          "user-123",
          {
            name: "Test Agent",
            description: "A test agent",
            systemPrompt: "You are helpful",
            isPublic: false,
          },
          "tenant-123"
        );

        expect(result.id).toBe("agent-123");
        expect(result.name).toBe("Test Agent");
        expect(mockSupabaseFrom).toHaveBeenCalledWith("agents");
      });

      it("should throw error if agent name already exists", async () => {
        // Mock: Existing agent found
        mockSingle.mockResolvedValueOnce({
          data: { id: "existing-agent" },
          error: null,
        });

        await expect(
          agentService.createAgent(
            "user-123",
            {
              name: "Existing Agent",
              description: "Description",
              systemPrompt: "Prompt",
            },
            "tenant-123"
          )
        ).rejects.toThrow("Agent name already exists");
      });
    });

    describe("getAgentById", () => {
      it("should return agent when found and user owns it", async () => {
        mockSingle.mockResolvedValueOnce({
          data: {
            id: "agent-123",
            name: "My Agent",
            owner_id: "user-123",
            tenant_id: "tenant-123",
          },
          error: null,
        });

        const result = await agentService.getAgentById("agent-123", "user-123", "tenant-123");

        expect(result.id).toBe("agent-123");
        expect(result.name).toBe("My Agent");
      });

      it("should throw error when agent not found", async () => {
        mockSingle.mockResolvedValueOnce({
          data: null,
          error: { message: "Not found" },
        });

        await expect(
          agentService.getAgentById("invalid-id", "user-123", "tenant-123")
        ).rejects.toThrow("Agent not found");
      });

      it("should throw access denied when user doesn't own agent", async () => {
        mockSingle.mockResolvedValueOnce({
          data: {
            id: "agent-123",
            name: "Other Agent",
            owner_id: "other-user",
            tenant_id: "tenant-123",
          },
          error: null,
        });

        await expect(
          agentService.getAgentById("agent-123", "user-123", "tenant-123")
        ).rejects.toThrow("Access denied");
      });
    });
  });

  describe("Agent Flow", () => {
    it("should handle complete agent lifecycle", async () => {
      // This test simulates creating and retrieving an agent

      // Step 1: Create agent
      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // No duplicate
      mockSingle.mockResolvedValueOnce({
        data: {
          id: "new-agent",
          name: "Lifecycle Agent",
          owner_id: "user-1",
          tenant_id: "tenant-1",
        },
        error: null,
      });

      const created = await agentService.createAgent(
        "user-1",
        {
          name: "Lifecycle Agent",
          description: "Test",
          systemPrompt: "Prompt",
        },
        "tenant-1"
      );

      expect(created.id).toBe("new-agent");

      // Step 2: Retrieve agent
      mockSingle.mockResolvedValueOnce({
        data: {
          id: "new-agent",
          name: "Lifecycle Agent",
          owner_id: "user-1",
          tenant_id: "tenant-1",
        },
        error: null,
      });

      const retrieved = await agentService.getAgentById("new-agent", "user-1", "tenant-1");

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe("Lifecycle Agent");
    });
  });
});
