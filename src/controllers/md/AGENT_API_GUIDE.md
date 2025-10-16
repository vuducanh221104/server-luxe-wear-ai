# 🤖 Agent Management API Guide

Complete guide for AI Agent Management API với Supabase integration.

---

## 📋 Overview

Agent API cung cấp các chức năng:

- ✅ **Agent CRUD** - Tạo, đọc, cập nhật, xóa agents
- ✅ **Agent Configuration** - Quản lý cấu hình AI (model, temperature, prompts)
- ✅ **Agent Statistics** - Thống kê usage và performance
- ✅ **Agent Search** - Tìm kiếm agents theo tên/mô tả

---

## 🔌 API Endpoints

### **🤖 Agent Management Endpoints**

#### 1. Create Agent

```http
POST /api/agents
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Fashion Assistant",
  "description": "AI assistant for fashion recommendations",
  "config": {
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 1000,
    "systemPrompt": "You are a helpful fashion assistant.",
    "instructions": "Always be polite and provide detailed recommendations.",
    "tools": ["web_search", "image_analysis"]
  }
}
```

**Validation Rules:**

- `name`: 3-100 characters, alphanumeric + spaces/hyphens/underscores (required)
- `description`: Max 500 characters (optional)
- `config.temperature`: 0-2 (optional)
- `config.maxTokens`: 1-4096 (optional)
- `config.systemPrompt`: Max 2000 characters (optional)
- `config.instructions`: Max 1000 characters (optional)

**Response:**

```json
{
  "success": true,
  "message": "Agent created successfully",
  "data": {
    "id": "uuid",
    "name": "Fashion Assistant",
    "description": "AI assistant for fashion recommendations",
    "config": {
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 1000,
      "systemPrompt": "You are a helpful fashion assistant.",
      "instructions": "Always be polite and provide detailed recommendations.",
      "tools": ["web_search", "image_analysis"]
    },
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z"
  }
}
```

---

#### 2. List User's Agents

```http
GET /api/agents?page=1&perPage=10
Authorization: Bearer <access_token>
```

**Query Parameters:**

- `page`: Page number (default: 1)
- `perPage`: Items per page (1-50, default: 10)

**Response:**

```json
{
  "success": true,
  "message": "Agents retrieved successfully",
  "data": {
    "agents": [
      {
        "id": "uuid",
        "name": "Fashion Assistant",
        "description": "AI assistant for fashion recommendations",
        "config": {
          "model": "gpt-4",
          "temperature": 0.7
        },
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "perPage": 10,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

#### 3. Get Agent by ID

```http
GET /api/agents/:agentId
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Agent retrieved successfully",
  "data": {
    "id": "uuid",
    "name": "Fashion Assistant",
    "description": "AI assistant for fashion recommendations",
    "config": {
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 1000,
      "systemPrompt": "You are a helpful fashion assistant.",
      "instructions": "Always be polite and provide detailed recommendations.",
      "tools": ["web_search", "image_analysis"]
    },
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-02T00:00:00Z"
  }
}
```

---

#### 4. Update Agent

```http
PUT /api/agents/:agentId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Updated Fashion Assistant",
  "description": "Enhanced AI assistant for fashion recommendations",
  "config": {
    "temperature": 0.8,
    "systemPrompt": "You are an expert fashion consultant."
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Agent updated successfully",
  "data": {
    "id": "uuid",
    "name": "Updated Fashion Assistant",
    "description": "Enhanced AI assistant for fashion recommendations",
    "config": {
      "model": "gpt-4",
      "temperature": 0.8,
      "maxTokens": 1000,
      "systemPrompt": "You are an expert fashion consultant.",
      "instructions": "Always be polite and provide detailed recommendations.",
      "tools": ["web_search", "image_analysis"]
    },
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-02T12:00:00Z"
  }
}
```

---

#### 5. Delete Agent

```http
DELETE /api/agents/:agentId
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Agent deleted successfully"
}
```

---

#### 6. Search Agents

```http
GET /api/agents/search?q=fashion&limit=5
Authorization: Bearer <access_token>
```

**Query Parameters:**

- `q`: Search term (2-100 characters, required)
- `limit`: Max results (1-20, default: 10)

**Response:**

```json
{
  "success": true,
  "message": "Agents search completed",
  "data": {
    "agents": [
      {
        "id": "uuid",
        "name": "Fashion Assistant",
        "description": "AI assistant for fashion recommendations",
        "config": {
          "model": "gpt-4",
          "temperature": 0.7
        },
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-01-01T00:00:00Z"
      }
    ],
    "count": 1
  }
}
```

---

#### 7. Get Agent Statistics

```http
GET /api/agents/:agentId/stats
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Agent statistics retrieved successfully",
  "data": {
    "totalQueries": 1250,
    "totalKnowledge": 15,
    "totalWebhooks": 3,
    "createdAt": "2025-01-01T00:00:00Z",
    "lastUsedAt": "2025-01-02T10:30:00Z"
  }
}
```

---

## 🌐 Frontend Integration Examples

### **React/Next.js Integration**

```typescript
// utils/agentApi.ts
const API_BASE = "/api/agents";

// Create agent
export const createAgent = async (agentData: {
  name: string;
  description?: string;
  config?: any;
}) => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(agentData),
  });

  return response.json();
};

// List agents
export const listAgents = async (page = 1, perPage = 10) => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${API_BASE}?page=${page}&perPage=${perPage}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
};

// Get agent by ID
export const getAgent = async (agentId: string) => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${API_BASE}/${agentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
};

// Update agent
export const updateAgent = async (
  agentId: string,
  updateData: {
    name?: string;
    description?: string;
    config?: any;
  }
) => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${API_BASE}/${agentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updateData),
  });

  return response.json();
};

// Delete agent
export const deleteAgent = async (agentId: string) => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${API_BASE}/${agentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
};

// Search agents
export const searchAgents = async (query: string, limit = 10) => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
};

// Get agent stats
export const getAgentStats = async (agentId: string) => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${API_BASE}/${agentId}/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
};
```

### **React Components**

```tsx
// components/AgentList.tsx
import React, { useState, useEffect } from "react";
import { listAgents, deleteAgent } from "../utils/agentApi";

interface Agent {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

const AgentList: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadAgents();
  }, [page]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await listAgents(page, 10);

      if (response.success) {
        setAgents(response.data.agents);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to load agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;

    try {
      const response = await deleteAgent(agentId);

      if (response.success) {
        setAgents(agents.filter((agent) => agent.id !== agentId));
        alert("Agent deleted successfully!");
      }
    } catch (error) {
      console.error("Failed to delete agent:", error);
      alert("Failed to delete agent");
    }
  };

  if (loading) return <div>Loading agents...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">My Agents</h2>

      {agents.length === 0 ? (
        <p className="text-gray-500">No agents found. Create your first agent!</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div key={agent.id} className="border rounded-lg p-4 shadow-sm">
              <h3 className="font-semibold text-lg">{agent.name}</h3>
              {agent.description && (
                <p className="text-gray-600 text-sm mt-1">{agent.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Created: {new Date(agent.createdAt).toLocaleDateString()}
              </p>

              <div className="flex space-x-2 mt-3">
                <button
                  onClick={() => (window.location.href = `/agents/${agent.id}`)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  View
                </button>
                <button
                  onClick={() => (window.location.href = `/agents/${agent.id}/edit`)}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(agent.id)}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2 mt-6">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AgentList;
```

```tsx
// components/CreateAgentForm.tsx
import React, { useState } from "react";
import { createAgent } from "../utils/agentApi";

const CreateAgentForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    config: {
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: "",
      instructions: "",
    },
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await createAgent(formData);

      if (response.success) {
        alert("Agent created successfully!");
        window.location.href = "/agents";
      } else {
        alert("Failed to create agent: " + response.message);
      }
    } catch (error) {
      console.error("Failed to create agent:", error);
      alert("Failed to create agent");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Create New Agent</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700">Name *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          placeholder="Fashion Assistant"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          rows={3}
          placeholder="AI assistant for fashion recommendations"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Model</label>
          <select
            value={formData.config.model}
            onChange={(e) =>
              setFormData({
                ...formData,
                config: { ...formData.config, model: e.target.value },
              })
            }
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="claude-3">Claude 3</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Temperature</label>
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={formData.config.temperature}
            onChange={(e) =>
              setFormData({
                ...formData,
                config: { ...formData.config, temperature: parseFloat(e.target.value) },
              })
            }
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">System Prompt</label>
        <textarea
          value={formData.config.systemPrompt}
          onChange={(e) =>
            setFormData({
              ...formData,
              config: { ...formData.config, systemPrompt: e.target.value },
            })
          }
          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          rows={4}
          placeholder="You are a helpful fashion assistant..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Instructions</label>
        <textarea
          value={formData.config.instructions}
          onChange={(e) =>
            setFormData({
              ...formData,
              config: { ...formData.config, instructions: e.target.value },
            })
          }
          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
          rows={3}
          placeholder="Always be polite and provide detailed recommendations..."
        />
      </div>

      <div className="flex space-x-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Agent"}
        </button>
        <button
          type="button"
          onClick={() => (window.location.href = "/agents")}
          className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default CreateAgentForm;
```

---

## 🧪 Testing Guide

### **1. Test Agent CRUD Operations**

```bash
# Create agent
curl -X POST http://localhost:3000/api/agents \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "description": "Test description",
    "config": {
      "model": "gpt-4",
      "temperature": 0.7,
      "systemPrompt": "You are a helpful assistant."
    }
  }'

# List agents
curl -X GET "http://localhost:3000/api/agents?page=1&perPage=5" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get agent
curl -X GET http://localhost:3000/api/agents/AGENT_UUID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Update agent
curl -X PUT http://localhost:3000/api/agents/AGENT_UUID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Agent",
    "config": {
      "temperature": 0.8
    }
  }'

# Delete agent
curl -X DELETE http://localhost:3000/api/agents/AGENT_UUID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### **2. Test Search and Stats**

```bash
# Search agents
curl -X GET "http://localhost:3000/api/agents/search?q=fashion&limit=5" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get agent stats
curl -X GET http://localhost:3000/api/agents/AGENT_UUID/stats \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🛡️ Security & Permissions

### **Authentication Required**

- All endpoints require valid JWT token
- Users can only access their own agents (RLS enforced)

### **Rate Limiting**

- Create/Update/Delete operations: 10 requests per 15 minutes
- Read operations: No rate limiting

### **Validation**

- Agent names must be unique per user
- Configuration values are validated
- All inputs are sanitized

---

## 📊 Database Integration

### **Supabase Integration**

- Uses `agents` table with RLS policies
- Automatic `owner_id` assignment
- Cascade delete for related data (knowledge, analytics, webhooks)

### **Related Tables**

- `knowledge` - Agent's knowledge base
- `analytics` - Usage statistics
- `webhooks` - Integration endpoints

---

## 🚀 Next Steps

### **1. Add Chat Functionality**

```typescript
// POST /api/agents/:agentId/chat
export const chatWithAgent = async (agentId: string, message: string) => {
  // Implementation for AI chat
};
```

### **2. Agent Templates**

```typescript
// Predefined agent configurations
const templates = {
  fashion: { model: "gpt-4", systemPrompt: "Fashion expert..." },
  support: { model: "gpt-3.5-turbo", systemPrompt: "Customer support..." },
};
```

### **3. Agent Sharing**

```typescript
// Share agents with other users
export const shareAgent = async (agentId: string, userEmail: string) => {
  // Implementation for agent sharing
};
```

---

## ✅ Features Completed

- ✅ Agent CRUD operations
- ✅ Agent configuration management
- ✅ User ownership and RLS
- ✅ Pagination and search
- ✅ Statistics tracking
- ✅ Input validation
- ✅ Rate limiting
- ✅ Error handling
- ✅ TypeScript types
- ✅ Comprehensive documentation

---

**🎉 Agent Management API Ready!**

Users có thể tạo và quản lý AI agents với cấu hình linh hoạt, theo dõi thống kê usage, và tìm kiếm agents một cách dễ dàng và an toàn.
