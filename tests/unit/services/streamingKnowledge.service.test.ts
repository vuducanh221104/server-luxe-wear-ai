/**
 * @file streamingKnowledge.service.test.ts
 * @description Unit tests for StreamingKnowledgeService
 */

import { StreamingKnowledgeService } from "../../../src/services/streamingKnowledge.service";
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

jest.mock("uuid", () => ({
  v4: () => "mock-session-id",
}));

jest.mock("../../../src/utils/streamingFileProcessor", () => ({
  processMultipleStreamingFiles: jest.fn(),
}));

jest.mock("../../../src/services/vector.service", () => ({
  batchStoreKnowledge: jest.fn(),
}));

jest.mock("../../../src/services/storage.service", () => ({
  storageService: {
    uploadKnowledgeFile: jest.fn(),
  },
}));

describe("StreamingKnowledgeService", () => {
  let streamingKnowledgeService: StreamingKnowledgeService;

  const mockFile = {
    id: "file-1",
    buffer: Buffer.from("test content"),
    originalname: "test.txt",
    mimetype: "text/plain",
    size: 12,
    fieldname: "file",
    encoding: "utf-8",
  };

  beforeEach(() => {
    streamingKnowledgeService = new StreamingKnowledgeService();
    jest.clearAllMocks();
  });

  describe("processStreamingUpload", () => {
    it("should process streaming upload successfully", async () => {
      const {
        processMultipleStreamingFiles,
      } = require("../../../src/utils/streamingFileProcessor");
      const { storageService } = require("../../../src/services/storage.service");
      const { batchStoreKnowledge } = require("../../../src/services/vector.service");

      // Mock agent validation
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
            select: jest.fn().mockResolvedValue({
              data: [{ id: "knowledge-1", title: "Test", created_at: new Date().toISOString() }],
              error: null,
            }),
          }),
        };
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      // Mock file processing
      processMultipleStreamingFiles.mockResolvedValue([
        {
          fileId: "file-1",
          status: "completed",
          entries: [
            {
              id: "entry-1",
              content: "test content",
              metadata: {},
            },
          ],
        },
      ]);

      // Mock storage upload
      storageService.uploadKnowledgeFile.mockResolvedValue("https://storage.example.com/file.txt");

      // Mock vector storage
      batchStoreKnowledge.mockResolvedValue(undefined);

      const result = await streamingKnowledgeService.processStreamingUpload({
        files: [mockFile],
        userId: "user-1",
        tenantId: "tenant-1",
        agentId: "agent-1",
      });

      expect(result.sessionId).toBe("mock-session-id");
      expect(result.filesProcessed).toBe(1);
      expect(processMultipleStreamingFiles).toHaveBeenCalled();
    });

    it("should handle file processing errors", async () => {
      const {
        processMultipleStreamingFiles,
      } = require("../../../src/utils/streamingFileProcessor");

      // Mock agent validation
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: "agent-1" }, error: null }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      // Mock file processing with error
      processMultipleStreamingFiles.mockResolvedValue([
        {
          fileId: "file-1",
          status: "error",
          error: "Processing failed",
          entries: [],
        },
      ]);

      const result = await streamingKnowledgeService.processStreamingUpload({
        files: [mockFile],
        userId: "user-1",
        tenantId: "tenant-1",
      });

      expect(result.filesFailed).toBe(1);
      expect(result.filesProcessed).toBe(0);
    });

    it("should set agentId to null when agent not found", async () => {
      const {
        processMultipleStreamingFiles,
      } = require("../../../src/utils/streamingFileProcessor");
      const { storageService } = require("../../../src/services/storage.service");
      const { batchStoreKnowledge } = require("../../../src/services/vector.service");

      // Mock agent validation - not found
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
            select: jest.fn().mockResolvedValue({
              data: [{ id: "knowledge-1", title: "Test", created_at: new Date().toISOString() }],
              error: null,
            }),
          }),
        };
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      processMultipleStreamingFiles.mockResolvedValue([
        {
          fileId: "file-1",
          status: "completed",
          entries: [{ id: "entry-1", content: "test", metadata: {} }],
        },
      ]);

      storageService.uploadKnowledgeFile.mockResolvedValue("https://storage.example.com/file.txt");
      batchStoreKnowledge.mockResolvedValue(undefined);

      const result = await streamingKnowledgeService.processStreamingUpload({
        files: [mockFile],
        userId: "user-1",
        tenantId: "tenant-1",
        agentId: "invalid-agent",
      });

      expect(result.success).toBeDefined();
    });

    it("should process multiple files", async () => {
      const {
        processMultipleStreamingFiles,
      } = require("../../../src/utils/streamingFileProcessor");
      const { storageService } = require("../../../src/services/storage.service");
      const { batchStoreKnowledge } = require("../../../src/services/vector.service");

      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [{ id: "knowledge-1", title: "Test", created_at: new Date().toISOString() }],
            error: null,
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      processMultipleStreamingFiles.mockResolvedValue([
        {
          fileId: "file-1",
          status: "completed",
          entries: [{ id: "entry-1", content: "test 1", metadata: {} }],
        },
        {
          fileId: "file-2",
          status: "completed",
          entries: [{ id: "entry-2", content: "test 2", metadata: {} }],
        },
      ]);

      storageService.uploadKnowledgeFile.mockResolvedValue("https://storage.example.com/file.txt");
      batchStoreKnowledge.mockResolvedValue(undefined);

      const result = await streamingKnowledgeService.processStreamingUpload({
        files: [mockFile, { ...mockFile, id: "file-2", originalname: "test2.txt" }],
        userId: "user-1",
        tenantId: "tenant-1",
      });

      expect(result.filesProcessed).toBe(2);
    });

    it("should use custom chunk size and overlap", async () => {
      const {
        processMultipleStreamingFiles,
      } = require("../../../src/utils/streamingFileProcessor");
      const { storageService } = require("../../../src/services/storage.service");
      const { batchStoreKnowledge } = require("../../../src/services/vector.service");

      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [{ id: "knowledge-1", title: "Test", created_at: new Date().toISOString() }],
            error: null,
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      processMultipleStreamingFiles.mockResolvedValue([
        {
          fileId: "file-1",
          status: "completed",
          entries: [{ id: "entry-1", content: "test", metadata: {} }],
        },
      ]);

      storageService.uploadKnowledgeFile.mockResolvedValue("https://storage.example.com/file.txt");
      batchStoreKnowledge.mockResolvedValue(undefined);

      await streamingKnowledgeService.processStreamingUpload({
        files: [mockFile],
        userId: "user-1",
        tenantId: "tenant-1",
        chunkSize: 10000,
        overlap: 500,
      });

      expect(processMultipleStreamingFiles).toHaveBeenCalledWith(
        expect.any(Array),
        "user-1",
        null,
        10000,
        500
      );
    });

    it("should handle storage upload failure gracefully", async () => {
      const {
        processMultipleStreamingFiles,
      } = require("../../../src/utils/streamingFileProcessor");
      const { storageService } = require("../../../src/services/storage.service");

      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      processMultipleStreamingFiles.mockResolvedValue([
        {
          fileId: "file-1",
          status: "completed",
          entries: [{ id: "entry-1", content: "test", metadata: {} }],
        },
      ]);

      storageService.uploadKnowledgeFile.mockRejectedValue(new Error("Storage error"));

      const result = await streamingKnowledgeService.processStreamingUpload({
        files: [mockFile],
        userId: "user-1",
        tenantId: "tenant-1",
      });

      // Should handle the error and continue
      expect(result.sessionId).toBe("mock-session-id");
    });
  });
});
