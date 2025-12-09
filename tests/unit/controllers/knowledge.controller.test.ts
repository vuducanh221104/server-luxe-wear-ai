/**
 * @file knowledge.controller.test.ts
 * @description Unit tests for KnowledgeController
 */

import { Request, Response } from "express";
import { KnowledgeController } from "../../../src/controllers/knowledge.controller";
import { knowledgeService } from "../../../src/services/knowledge.service";
import { validationResult } from "express-validator";

// Mock dependencies
jest.mock("../../../src/services/knowledge.service", () => ({
  knowledgeService: {
    createKnowledge: jest.fn(),
    getKnowledgeById: jest.fn(),
    getUserKnowledge: jest.fn(),
    updateKnowledge: jest.fn(),
    deleteKnowledge: jest.fn(),
    searchKnowledge: jest.fn(),
  },
}));

jest.mock("../../../src/services/streamingKnowledge.service", () => ({
  streamingKnowledgeService: {
    uploadKnowledgeFile: jest.fn(),
  },
}));

jest.mock("express-validator", () => ({
  validationResult: jest.fn(),
}));

jest.mock("../../../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("uuid", () => ({
  v4: () => "mock-uuid-1234",
}));

describe("KnowledgeController", () => {
  let knowledgeController: KnowledgeController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    role: "member" as const,
    password_hash: "hashed_password",
    avatar_url: null,
    phone: null,
    website: null,
    preferences: {},
    last_login: null,
    is_active: true,
    email_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockTenant = {
    id: "tenant-1",
    name: "Test Tenant",
    plan: "free" as const,
    status: "active" as const,
    role: "member" as const,
  };

  const mockKnowledge = {
    id: "knowledge-1",
    title: "Test Knowledge",
    metadata: { category: "test" },
    agent_id: "agent-1",
    tenant_id: "tenant-1",
    user_id: "user-1",
    file_url: "https://storage.example.com/file.pdf",
    file_type: "application/pdf",
    file_size: 1024,
    file_name: "file.pdf",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    knowledgeController = new KnowledgeController();
    jest.clearAllMocks();

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockReq = {
      user: mockUser,
      tenant: mockTenant,
      body: {},
      params: {},
      query: {},
      ip: "127.0.0.1",
    };

    (validationResult as unknown as jest.Mock).mockReturnValue({
      isEmpty: () => true,
      array: () => [],
    });
  });

  describe("createKnowledge", () => {
    it("should create knowledge successfully", async () => {
      mockReq.body = {
        title: "New Knowledge",
        metadata: { category: "test" },
        agentId: "agent-1",
      };
      (knowledgeService.createKnowledge as jest.Mock).mockResolvedValue(mockKnowledge);

      await knowledgeController.createKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Knowledge entry created successfully",
        })
      );
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;

      await knowledgeController.createKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;

      await knowledgeController.createKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when validation fails", async () => {
      (validationResult as unknown as jest.Mock).mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "Title is required" }],
      });

      await knowledgeController.createKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("getUserKnowledge", () => {
    it("should return user knowledge successfully", async () => {
      mockReq.query = { page: "1", perPage: "10" };
      const mockResult = {
        knowledge: [mockKnowledge],
        pagination: { page: 1, perPage: 10, total: 1, totalPages: 1 },
      };
      (knowledgeService.getUserKnowledge as jest.Mock).mockResolvedValue(mockResult);

      await knowledgeController.getUserKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;

      await knowledgeController.getUserKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;

      await knowledgeController.getUserKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("getKnowledgeById", () => {
    it("should return knowledge by ID successfully", async () => {
      mockReq.params = { knowledgeId: "knowledge-1" };
      (knowledgeService.getKnowledgeById as jest.Mock).mockResolvedValue(mockKnowledge);

      await knowledgeController.getKnowledgeById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { knowledgeId: "knowledge-1" };

      await knowledgeController.getKnowledgeById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;
      mockReq.params = { knowledgeId: "knowledge-1" };

      await knowledgeController.getKnowledgeById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when knowledge not found", async () => {
      mockReq.params = { knowledgeId: "invalid-id" };
      (knowledgeService.getKnowledgeById as jest.Mock).mockResolvedValue(null);

      await knowledgeController.getKnowledgeById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe("updateKnowledge", () => {
    it("should update knowledge successfully", async () => {
      mockReq.params = { knowledgeId: "knowledge-1" };
      mockReq.body = { title: "Updated Knowledge" };
      (knowledgeService.getKnowledgeById as jest.Mock).mockResolvedValue(mockKnowledge);
      (knowledgeService.updateKnowledge as jest.Mock).mockResolvedValue({
        ...mockKnowledge,
        title: "Updated Knowledge",
      });

      await knowledgeController.updateKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { knowledgeId: "knowledge-1" };

      await knowledgeController.updateKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;
      mockReq.params = { knowledgeId: "knowledge-1" };

      await knowledgeController.updateKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("deleteKnowledge", () => {
    it("should delete knowledge successfully", async () => {
      mockReq.params = { knowledgeId: "knowledge-1" };
      (knowledgeService.getKnowledgeById as jest.Mock).mockResolvedValue(mockKnowledge);
      (knowledgeService.deleteKnowledge as jest.Mock).mockResolvedValue(undefined);

      await knowledgeController.deleteKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { knowledgeId: "knowledge-1" };

      await knowledgeController.deleteKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;
      mockReq.params = { knowledgeId: "knowledge-1" };

      await knowledgeController.deleteKnowledge(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("searchKnowledgeBase", () => {
    it("should search knowledge successfully", async () => {
      mockReq.query = { query: "test query", agentId: "agent-1" };
      const mockSearchResult = {
        results: [
          {
            id: "knowledge-1",
            title: "Test Knowledge",
            score: 0.95,
          },
        ],
      };
      (knowledgeService.searchKnowledge as jest.Mock).mockResolvedValue(mockSearchResult);

      await knowledgeController.searchKnowledgeBase(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;

      await knowledgeController.searchKnowledgeBase(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;

      await knowledgeController.searchKnowledgeBase(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
