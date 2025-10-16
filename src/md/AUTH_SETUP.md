# 🔐 Authentication System Setup Complete

Hệ thống authentication sử dụng Supabase Auth đã được thiết lập hoàn chỉnh.

---

## 📁 Files Created/Updated

### ✅ **Core Files**

1. **`src/utils/response.ts`** - Response utilities
2. **`src/validators/auth.validator.ts`** - Input validation schemas
3. **`src/services/auth.service.ts`** - Supabase Auth service layer
4. **`src/controllers/auth.controller.ts`** - HTTP request handlers
5. **`src/middlewares/auth.middleware.ts`** - JWT verification middleware
6. **`src/routes/auth.routes.ts`** - Authentication routes
7. **`src/types/database.ts`** - TypeScript types from database

---

## 🔌 API Endpoints

### **Public Endpoints** (No auth required)

#### 1. Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe" // optional
}
```

**Response:**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "v1.xxx..."
  }
}
```

---

#### 2. Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "v1.xxx..."
  }
}
```

---

#### 3. Refresh Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "v1.xxx..."
}
```

**Response:**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "user": {...},
    "accessToken": "new_token...",
    "refreshToken": "new_refresh_token..."
  }
}
```

---

#### 4. Forgot Password

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "If the email exists, a password reset link has been sent"
}
```

---

#### 5. Reset Password

```http
POST /api/auth/reset-password
Authorization: Bearer <access_token_from_reset_link>
Content-Type: application/json

{
  "password": "NewSecurePass123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Password reset successful"
}
```

---

### **Protected Endpoints** (Auth required)

#### 6. Get Current User

```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

#### 7. Logout

```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

## 🛡️ Security Features

### ✅ Implemented

- ✅ **Rate Limiting**: 5 attempts per 15 minutes for login/register
- ✅ **JWT Tokens**: Supabase-issued JWTs
- ✅ **Password Validation**: Min 8 chars, uppercase, lowercase, number
- ✅ **Email Enumeration Protection**: Same response for existing/non-existing emails
- ✅ **Row Level Security (RLS)**: Enabled on all database tables
- ✅ **Token Refresh**: Automatic token refresh mechanism

### 🔐 RLS Policies Created

- **Agents**: Users can only CRUD their own agents
- **Knowledge**: Users can only CRUD knowledge for their agents
- **Analytics**: Anyone can INSERT (for tracking), users can view their agents' analytics
- **Webhooks**: Users can only CRUD webhooks for their agents

---

## 🧪 Testing Guide

### 1. Start Server

```bash
npm run dev
```

### 2. Test Registration

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234",
    "name": "Test User"
  }'
```

### 3. Test Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234"
  }'
```

### 4. Test Protected Route

```bash
# Save token from login response
TOKEN="your_access_token_here"

curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔧 Using Auth Middleware

### Protect Any Route

```typescript
import { authMiddleware } from "../middlewares/auth.middleware";

// Protected route - requires valid JWT
router.get("/protected", authMiddleware, (req, res) => {
  // req.user is available here
  const userId = req.user.id;
  const email = req.user.email;

  res.json({ userId, email });
});
```

### Optional Auth

```typescript
import { optionalAuthMiddleware } from "../middlewares/auth.middleware";

// Optional auth - works with or without token
router.get("/public", optionalAuthMiddleware, (req, res) => {
  if (req.user) {
    // User is authenticated
    return res.json({ message: "Hello " + req.user.email });
  }
  // User is not authenticated
  res.json({ message: "Hello guest" });
});
```

---

## 📊 Database Schema

### Tables Created

1. **agents** - AI agents owned by users
2. **knowledge** - Knowledge base for agents
3. **analytics** - User interaction analytics
4. **webhooks** - Webhook configurations

### TypeScript Types Available

```typescript
import { Tables, TablesInsert, TablesUpdate } from "./types/database";

// Use in your code
type Agent = Tables<"agents">;
type AgentInsert = TablesInsert<"agents">;
type AgentUpdate = TablesUpdate<"agents">;
```

---

## 🚀 Next Steps

### 1. **Frontend Integration**

```typescript
// Example: React/Next.js
const login = async (email: string, password: string) => {
  const res = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (data.success) {
    localStorage.setItem("accessToken", data.data.accessToken);
    localStorage.setItem("refreshToken", data.data.refreshToken);
  }
};

// Add token to requests
const fetchProtected = async () => {
  const token = localStorage.getItem("accessToken");

  const res = await fetch("http://localhost:3000/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};
```

### 2. **Create Agent Service**

```typescript
// src/services/agent.service.ts
import { supabaseAdmin } from "../config/supabase";
import { TablesInsert } from "../types/database";

export const createAgent = async (userId: string, data: TablesInsert<"agents">) => {
  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .insert({
      ...data,
      owner_id: userId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return agent;
};
```

### 3. **Add Email Notifications**

Configure Supabase email templates in dashboard.

### 4. **Add OAuth Providers**

Supabase supports Google, GitHub, etc. Update service to handle OAuth.

---

## 📝 Environment Variables Required

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Frontend (for password reset redirect)
FRONTEND_URL=http://localhost:3000

# Server
PORT=3000
NODE_ENV=development
```

---

## ✅ Completed Checklist

- ✅ Database tables created with RLS
- ✅ Authentication service with Supabase
- ✅ Controllers for all auth endpoints
- ✅ JWT verification middleware
- ✅ Input validation schemas
- ✅ Rate limiting for auth endpoints
- ✅ TypeScript types generated
- ✅ Error handling and logging
- ✅ Security best practices implemented

---

## 📚 Related Documentation

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Project Coding Standards](./CODING_STANDARDS.md)
- [Backend Development Guide](./.cursor/rules/backend-development.mdc)
- [RAG Guide](./RAG_GUIDE.md)

---

## 🐛 Troubleshooting

### "Invalid JWT" Error

- Check if token is expired
- Use refresh token endpoint
- Verify SUPABASE_ANON_KEY is correct

### "No authorization header"

- Ensure you're sending `Authorization: Bearer <token>`
- Check token is not empty

### RLS Policy Violation

- User trying to access data they don't own
- Check `owner_id` matches authenticated user

---

**🎉 System Ready to Use!**
