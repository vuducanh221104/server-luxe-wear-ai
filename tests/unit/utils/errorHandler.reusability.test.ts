/**
 * @file errorHandler.reusability.test.ts
 * @description Tests demonstrating error handler utility reusability across different modules
 */

import {
  handleAsyncOperationStrict,
  handleAsyncOperationWithFallback,
  handleBatchOperations,
} from "../../../src/utils/errorHandler";

// Mock logger
jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe("Error Handler Utility Reusability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Reusability across different service types", () => {
    it("should work for user service operations", async () => {
      // Simulate user service operations
      const createUser = async (userData: { name: string; email: string }) => {
        if (!userData.email.includes("@")) {
          throw new Error("Invalid email format");
        }
        return { id: "1", ...userData };
      };

      const getUserById = async (id: string) => {
        if (id === "not-found") {
          throw new Error("User not found");
        }
        return { id, name: "John Doe" };
      };

      // Test successful operations
      const user = await handleAsyncOperationStrict(
        () => createUser({ name: "John", email: "john@example.com" }),
        "create user",
        { context: { service: "user" } }
      );

      expect(user).toEqual({ id: "1", name: "John", email: "john@example.com" });

      // Test fallback operation
      const foundUser = await handleAsyncOperationWithFallback(
        () => getUserById("not-found"),
        "get user",
        null,
        { context: { service: "user" } }
      );

      expect(foundUser).toBeNull();
    });

    it("should work for agent service operations", async () => {
      // Simulate agent service operations
      const createAgent = async (agentData: { name: string; prompt: string }) => {
        if (!agentData.name) {
          throw new Error("Agent name required");
        }
        return { id: "agent-1", ...agentData, status: "active" };
      };

      const updateAgent = async (id: string, updates: any) => {
        if (id === "not-found") {
          throw new Error("Agent not found");
        }
        return { id, ...updates, updatedAt: new Date() };
      };

      // Test successful operations
      const agent = await handleAsyncOperationStrict(
        () => createAgent({ name: "Test Agent", prompt: "You are helpful" }),
        "create agent",
        { context: { service: "agent" } }
      );

      expect(agent).toEqual({
        id: "agent-1",
        name: "Test Agent",
        prompt: "You are helpful",
        status: "active",
      });

      // Test error handling
      await expect(
        handleAsyncOperationStrict(
          () => updateAgent("not-found", { name: "Updated" }),
          "update agent",
          { context: { service: "agent" } }
        )
      ).rejects.toThrow("Failed to update agent");
    });

    it("should work for database operations", async () => {
      // Simulate database operations
      const query = async (sql: string) => {
        if (sql.includes("ERROR")) {
          throw new Error("Database connection failed");
        }
        return [{ id: 1, data: "result" }];
      };

      // Test successful query
      const result = await handleAsyncOperationStrict(
        () => query("SELECT * FROM users"),
        "execute query",
        { context: { service: "database" } }
      );

      expect(result).toEqual([{ id: 1, data: "result" }]);

      // Test batch operations
      const operations = [
        () => query("SELECT * FROM users"),
        () => query("SELECT * FROM agents"),
        () => query("SELECT * FROM orders"),
      ];

      const batchResults = await handleBatchOperations(operations, "batch query", {
        context: { service: "database" },
      });

      expect(batchResults).toHaveLength(3);
      expect(batchResults[0]).toEqual([{ id: 1, data: "result" }]);
    });

    it("should work for AI service operations", async () => {
      // Simulate AI service operations
      const generateEmbedding = async (text: string) => {
        if (!text.trim()) {
          throw new Error("Empty text provided");
        }
        return Array(768)
          .fill(0)
          .map(() => Math.random());
      };

      // Test successful operations
      const embedding = await handleAsyncOperationStrict(
        () => generateEmbedding("Hello world"),
        "generate embedding",
        { context: { service: "ai", textLength: 11 } }
      );

      expect(embedding).toHaveLength(768);
      expect(typeof embedding[0]).toBe("number");

      // Test fallback for token counting
      const tokenCount = await handleAsyncOperationWithFallback(
        async () => {
          if (Math.random() > 0.5) {
            throw new Error("API rate limit");
          }
          return 42;
        },
        "count tokens",
        0, // fallback to 0
        { context: { service: "ai" } }
      );

      expect(typeof tokenCount).toBe("number");
    });

    it("should work for file operations", async () => {
      // Simulate file operations
      const readFile = async (path: string) => {
        if (path === "not-found.txt") {
          throw new Error("File not found");
        }
        return "File content";
      };

      // Test successful read
      const content = await handleAsyncOperationStrict(() => readFile("valid.txt"), "read file", {
        context: { service: "file", path: "valid.txt" },
      });

      expect(content).toBe("File content");

      // Test fallback for missing file
      const fallbackContent = await handleAsyncOperationWithFallback(
        () => readFile("not-found.txt"),
        "read file",
        "default content",
        { context: { service: "file" } }
      );

      expect(fallbackContent).toBe("default content");
    });
  });

  describe("Consistent error handling across services", () => {
    it("should provide consistent error messages", async () => {
      const operations = [
        () => {
          throw new Error("Database error");
        },
        () => {
          throw new Error("API error");
        },
        () => {
          throw new Error("Network error");
        },
      ];

      const errorMessages = [];

      for (let i = 0; i < operations.length; i++) {
        try {
          await handleAsyncOperationStrict(operations[i], `operation ${i + 1}`);
        } catch (error) {
          errorMessages.push(error instanceof Error ? error.message : String(error));
        }
      }

      expect(errorMessages).toEqual([
        "Failed to operation 1",
        "Failed to operation 2",
        "Failed to operation 3",
      ]);
    });

    it("should provide consistent logging across services", async () => {
      const { error } = require("../../../src/config/logger");

      const services = ["user", "agent", "database", "ai", "file"];

      for (const service of services) {
        try {
          await handleAsyncOperationStrict(
            () => {
              throw new Error(`${service} specific error`);
            },
            `${service} operation`,
            { context: { service } }
          );
        } catch (error) {
          // Error will be logged by the utility
        }
      }

      expect(error).toHaveBeenCalledTimes(5);

      // Check that all calls include service context
      const calls = error.mock.calls;
      expect(calls[0][1]).toMatchObject({ service: "user" });
      expect(calls[1][1]).toMatchObject({ service: "agent" });
      expect(calls[2][1]).toMatchObject({ service: "database" });
      expect(calls[3][1]).toMatchObject({ service: "ai" });
      expect(calls[4][1]).toMatchObject({ service: "file" });
    });
  });

  describe("Performance benefits of reusability", () => {
    it("should handle multiple operations efficiently", async () => {
      const operations = Array.from({ length: 10 }, (_, i) => () => Promise.resolve(`Result ${i}`));

      const startTime = Date.now();
      const results = await handleBatchOperations(operations, "batch test");
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });

    it("should provide consistent performance across different operation types", async () => {
      const operationTypes = [
        { name: "database", fn: () => Promise.resolve("db result") },
        { name: "api", fn: () => Promise.resolve("api result") },
        { name: "file", fn: () => Promise.resolve("file result") },
        { name: "cache", fn: () => Promise.resolve("cache result") },
      ];

      const times = [];

      for (const { name, fn } of operationTypes) {
        const start = Date.now();
        await handleAsyncOperationStrict(fn, `${name} operation`);
        const end = Date.now();
        times.push(end - start);
      }

      // All operations should complete in similar time
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      expect(maxTime - minTime).toBeLessThan(50); // Within 50ms of each other
    });
  });
});
