/**
 * @file agent.controller.test.ts
 * @description Unit tests for AgentController
 */

import { Request, Response } from "express";
import { AgentController } from "../../../src/controllers/agent.controller";
import { agentService } from "../../../src/services/agent.service";
import { validationResult } from "express-validator";

// Mock dependencies
jest.mock("../../../src/services/agent.service", () => ({
  agentService: {
    createAgent: jest.fn(),
    getAgentById: jest.fn(),
    listUserAgents: jest.fn(),
    updateAgent: jest.fn(),
    deleteAgent: jest.fn(),
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

jest.mock("../../../src/config/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

describe("AgentController", () => {
  let agentController: AgentController;
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

  const mockAgent = {
    id: "agent-1",
    name: "Test Agent",
    description: "A test agent",
    config: { model: "gemini-pro" },
    owner_id: "user-1",
    tenant_id: "tenant-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    agentController = new AgentController();
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

  describe("createAgent", () => {
    it("should create agent successfully", async () => {
      mockReq.body = {
        name: "New Agent",
        description: "Agent description",
        config: { model: "gemini-pro" },
      };
      (agentService.createAgent as jest.Mock).mockResolvedValue(mockAgent);

      await agentController.createAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Agent created successfully",
        })
      );
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;

      await agentController.createAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;

      await agentController.createAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when validation fails", async () => {
      (validationResult as unknown as jest.Mock).mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "Name is required" }],
      });

      await agentController.createAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("getAgent", () => {
    it("should return agent successfully", async () => {
      mockReq.params = { agentId: "agent-1" };
      (agentService.getAgentById as jest.Mock).mockResolvedValue(mockAgent);

      await agentController.getAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Agent retrieved successfully",
        })
      );
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { agentId: "agent-1" };

      await agentController.getAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;
      mockReq.params = { agentId: "agent-1" };

      await agentController.getAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("listAgents", () => {
    it("should list agents successfully", async () => {
      mockReq.query = { page: "1", perPage: "10" };
      const mockList = {
        agents: [mockAgent],
        pagination: { page: 1, perPage: 10, total: 1, totalPages: 1 },
      };
      (agentService.listUserAgents as jest.Mock).mockResolvedValue(mockList);

      await agentController.listAgents(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;

      await agentController.listAgents(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;

      await agentController.listAgents(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("updateAgent", () => {
    it("should update agent successfully", async () => {
      mockReq.params = { agentId: "agent-1" };
      mockReq.body = { name: "Updated Agent" };
      (agentService.updateAgent as jest.Mock).mockResolvedValue({
        ...mockAgent,
        name: "Updated Agent",
      });

      await agentController.updateAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Agent updated successfully",
        })
      );
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { agentId: "agent-1" };

      await agentController.updateAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;
      mockReq.params = { agentId: "agent-1" };

      await agentController.updateAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("deleteAgent", () => {
    it("should delete agent successfully", async () => {
      mockReq.params = { agentId: "agent-1" };
      (agentService.deleteAgent as jest.Mock).mockResolvedValue(undefined);

      await agentController.deleteAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Agent deleted successfully",
        })
      );
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { agentId: "agent-1" };

      await agentController.deleteAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;
      mockReq.params = { agentId: "agent-1" };

      await agentController.deleteAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
