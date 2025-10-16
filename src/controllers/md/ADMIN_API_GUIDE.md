# 🛡️ Admin API Guide

Hướng dẫn sử dụng Admin API cho quản trị hệ thống AI Agent.

---

## 📋 Overview

Admin API cung cấp các chức năng quản trị hệ thống:

- ✅ **System Statistics** - Thống kê toàn hệ thống
- ✅ **Agent Management** - Quản lý tất cả agents trong hệ thống
- ✅ **User Management** - Xem agents của users cụ thể
- ✅ **Force Operations** - Thực hiện các thao tác bypass ownership

---

## 🔐 Authentication & Authorization

### **Requirements:**

1. **Valid JWT Token** - User phải đăng nhập
2. **Admin Role** - User phải có role `admin` hoặc `super_admin`

### **Role Structure:**

```json
{
  "user_metadata": {
    "role": "admin" // hoặc "super_admin"
  }
}
```

### **Admin Middleware:**

- `adminMiddleware`: Requires `admin` or `super_admin` role
- `superAdminMiddleware`: Requires `super_admin` role only

---

## 🔌 Admin Endpoints

### **1. System Statistics**

```http
GET /api/agents/admin/stats
Authorization: Bearer <admin_jwt_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalAgents": 150,
    "publicAgents": 45,
    "privateAgents": 105,
    "uniqueUsers": 32,
    "totalConversations": 2847,
    "recentAgents": 12,
    "averageAgentsPerUser": 4.69
  },
  "message": "System statistics retrieved successfully"
}
```

### **2. List All Agents**

```http
GET /api/agents/admin/all?page=1&perPage=20
Authorization: Bearer <admin_jwt_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": "agent-uuid-1",
        "name": "Fashion Assistant",
        "description": "AI for fashion recommendations",
        "isPublic": true,
        "hasApiKey": true,
        "owner": {
          "id": "user-uuid",
          "email": "user@example.com",
          "user_metadata": {}
        },
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 150,
      "totalPages": 8
    }
  },
  "message": "All agents retrieved successfully"
}
```

### **3. Force Delete Agent**

```http
DELETE /api/agents/admin/agent-uuid
Authorization: Bearer <admin_jwt_token>
```

**Response:**

```json
{
  "success": true,
  "data": null,
  "message": "Agent deleted successfully"
}
```

**⚠️ Warning:** This bypasses ownership checks and permanently deletes the agent!

### **4. Get User's Agents**

```http
GET /api/agents/admin/users/user-uuid/agents?page=1&perPage=10
Authorization: Bearer <admin_jwt_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "agents": [
      {
        "id": "agent-uuid",
        "name": "Customer Support Bot",
        "description": "Automated customer support",
        "isPublic": false,
        "hasApiKey": true,
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
  },
  "message": "User agents retrieved successfully"
}
```

---

## 🚨 Error Responses

### **Authentication Errors:**

```json
// No JWT token
{
  "success": false,
  "message": "Authentication required"
}

// Invalid token
{
  "success": false,
  "message": "Authentication failed"
}
```

### **Authorization Errors:**

```json
// Not admin
{
  "success": false,
  "message": "Admin privileges required"
}

// Not super admin (for super admin endpoints)
{
  "success": false,
  "message": "Super admin privileges required"
}
```

### **Validation Errors:**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "page",
      "message": "Page must be a positive integer"
    }
  ]
}
```

---

## 📊 Usage Examples

### **Dashboard Statistics**

```javascript
const getSystemStats = async () => {
  const response = await fetch("/api/agents/admin/stats", {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (data.success) {
    console.log("System Stats:", data.data);
    // Display in admin dashboard
  }
};
```

### **Agent Management**

```javascript
const getAllAgents = async (page = 1) => {
  const response = await fetch(`/api/agents/admin/all?page=${page}&perPage=20`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  const data = await response.json();
  return data.data;
};

const forceDeleteAgent = async (agentId) => {
  const confirmed = confirm("Are you sure? This action cannot be undone!");

  if (confirmed) {
    const response = await fetch(`/api/agents/admin/${agentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      alert("Agent deleted successfully");
      // Refresh agent list
    }
  }
};
```

### **User Investigation**

```javascript
const investigateUser = async (userId) => {
  const response = await fetch(`/api/agents/admin/users/${userId}/agents`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  const data = await response.json();

  if (data.success) {
    console.log(`User ${userId} has ${data.data.pagination.total} agents`);
    return data.data.agents;
  }
};
```

---

## 🔧 Admin Dashboard Integration

### **React Admin Panel Example**

```jsx
import { useState, useEffect } from "react";

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemStats();
    fetchAllAgents();
  }, []);

  const fetchSystemStats = async () => {
    try {
      const response = await fetch("/api/agents/admin/stats", {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchAllAgents = async () => {
    try {
      const response = await fetch("/api/agents/admin/all?perPage=50", {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      const data = await response.json();
      setAgents(data.data.agents);
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (window.confirm("Delete this agent permanently?")) {
      try {
        await fetch(`/api/agents/admin/${agentId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${getAdminToken()}` },
        });

        // Refresh list
        fetchAllAgents();
        fetchSystemStats();
      } catch (error) {
        alert("Failed to delete agent");
      }
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="admin-dashboard">
      {/* System Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Agents</h3>
          <p>{stats?.totalAgents}</p>
        </div>
        <div className="stat-card">
          <h3>Public Agents</h3>
          <p>{stats?.publicAgents}</p>
        </div>
        <div className="stat-card">
          <h3>Active Users</h3>
          <p>{stats?.uniqueUsers}</p>
        </div>
        <div className="stat-card">
          <h3>Total Conversations</h3>
          <p>{stats?.totalConversations}</p>
        </div>
      </div>

      {/* Agents Table */}
      <div className="agents-table">
        <h2>All Agents</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Owner</th>
              <th>Public</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td>{agent.name}</td>
                <td>{agent.owner?.email}</td>
                <td>{agent.isPublic ? "✅" : "❌"}</td>
                <td>{new Date(agent.createdAt).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => handleDeleteAgent(agent.id)} className="delete-btn">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

---

## 🛡️ Security Considerations

### **1. Role Management**

- Chỉ cấp admin role cho trusted users
- Sử dụng `super_admin` cho operations nguy hiểm
- Regularly audit admin activities

### **2. Logging & Monitoring**

- Tất cả admin actions đều được log
- Monitor unusual admin activity
- Set up alerts for sensitive operations

### **3. Rate Limiting**

- Admin endpoints có rate limiting
- Force delete operations có strict rate limits
- Monitor for abuse patterns

### **4. Audit Trail**

```javascript
// Example audit log entry
{
  "timestamp": "2025-01-01T12:00:00Z",
  "adminId": "admin-user-uuid",
  "adminEmail": "admin@company.com",
  "action": "FORCE_DELETE_AGENT",
  "targetAgentId": "agent-uuid",
  "targetAgentName": "Customer Bot",
  "originalOwner": "user-uuid",
  "success": true
}
```

---

## 🚀 Best Practices

### **1. Admin Operations**

- Always confirm destructive operations
- Provide clear feedback to admin users
- Implement undo functionality where possible
- Log all admin actions for audit

### **2. Error Handling**

```javascript
const adminApiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        Authorization: `Bearer ${getAdminToken()}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("Admin privileges required");
      }
      if (response.status === 401) {
        throw new Error("Authentication failed");
      }
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Admin API Error:", error);
    throw error;
  }
};
```

### **3. Pagination**

- Always implement pagination for large datasets
- Use reasonable default page sizes
- Provide total counts for UI

### **4. Real-time Updates**

```javascript
// WebSocket for real-time admin updates
const adminSocket = new WebSocket("wss://your-api.com/admin/ws");

adminSocket.onmessage = (event) => {
  const update = JSON.parse(event.data);

  switch (update.type) {
    case "AGENT_CREATED":
      // Update dashboard stats
      break;
    case "AGENT_DELETED":
      // Remove from list
      break;
    case "USER_REGISTERED":
      // Update user count
      break;
  }
};
```

---

## 📈 Monitoring & Analytics

### **Key Metrics to Track:**

- Total agents created/deleted per day
- Public vs private agent ratio
- Most active users (by agent count)
- Conversation volume trends
- API key usage patterns

### **Alerts to Set Up:**

- Unusual spike in agent deletions
- High number of failed admin requests
- Suspicious admin login patterns
- System resource usage alerts

---

**🔒 Remember: With great power comes great responsibility. Use admin privileges wisely!**
