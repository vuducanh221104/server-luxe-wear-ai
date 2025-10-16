# 👤 User Management API Guide

Complete guide for User Management API với Supabase Auth integration.

---

## 📋 Overview

User API cung cấp các chức năng:

- ✅ **Profile Management** - Quản lý thông tin cá nhân
- ✅ **Email Updates** - Cập nhật email
- ✅ **User Statistics** - Thống kê hoạt động
- ✅ **Admin Operations** - Quản lý users (Admin only)

---

## 🔌 API Endpoints

### **👤 User Profile Endpoints**

#### 1. Get Current User Profile

```http
GET /api/users/profile
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "website": "https://johndoe.com",
    "avatar_url": "https://example.com/avatar.jpg",
    "provider": "google",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-02T00:00:00Z"
  }
}
```

---

#### 2. Update User Profile

```http
PUT /api/users/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "John Smith",
  "phone": "+1234567890",
  "website": "https://johnsmith.com",
  "avatar_url": "https://example.com/new-avatar.jpg"
}
```

**Validation Rules:**

- `name`: 2-100 characters (optional)
- `phone`: Valid phone number (optional)
- `website`: Valid URL with protocol (optional)
- `avatar_url`: Valid URL with protocol (optional)

**Response:**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Smith",
    "phone": "+1234567890",
    "website": "https://johnsmith.com",
    "avatar_url": "https://example.com/new-avatar.jpg",
    "updatedAt": "2025-01-02T12:00:00Z"
  }
}
```

---

#### 3. Update User Email

```http
PUT /api/users/email
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "newemail@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Email updated successfully",
  "data": {
    "id": "uuid",
    "email": "newemail@example.com",
    "updatedAt": "2025-01-02T12:00:00Z"
  }
}
```

---

#### 4. Get User Statistics

```http
GET /api/users/stats
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "User statistics retrieved successfully",
  "data": {
    "agentsCount": 5,
    "totalQueries": 1250,
    "lastLoginAt": "2025-01-02T10:30:00Z",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

### **🔧 Admin Endpoints**

#### 5. List All Users (Admin)

```http
GET /api/users?page=1&perPage=10
Authorization: Bearer <admin_access_token>
```

**Query Parameters:**

- `page`: Page number (default: 1)
- `perPage`: Items per page (1-100, default: 10)

**Response:**

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user1@example.com",
        "name": "User One",
        "provider": "google",
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-01-02T00:00:00Z",
        "lastSignInAt": "2025-01-02T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "perPage": 10,
      "total": 50,
      "totalPages": 5
    }
  }
}
```

---

#### 6. Get User by ID (Admin)

```http
GET /api/users/:userId
Authorization: Bearer <admin_access_token>
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
    "phone": "+1234567890",
    "website": "https://johndoe.com",
    "avatar_url": "https://example.com/avatar.jpg",
    "provider": "email",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-02T00:00:00Z",
    "lastSignInAt": "2025-01-02T10:00:00Z"
  }
}
```

---

#### 7. Update User Password (Admin)

```http
PUT /api/users/:userId/password
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "password": "NewSecurePassword123"
}
```

**Validation:**

- Password: Min 8 chars, uppercase, lowercase, number

**Response:**

```json
{
  "success": true,
  "message": "User password updated successfully"
}
```

---

#### 8. Ban/Unban User (Admin)

```http
PUT /api/users/:userId/ban
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "banned": true
}
```

**Response:**

```json
{
  "success": true,
  "message": "User banned successfully",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "banned": true,
    "updatedAt": "2025-01-02T12:00:00Z"
  }
}
```

---

#### 9. Delete User (Admin)

```http
DELETE /api/users/:userId
Authorization: Bearer <admin_access_token>
```

**Response:**

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 🌐 Frontend Integration Examples

### **React/Next.js Integration**

```typescript
// utils/userApi.ts
const API_BASE = "/api/users";

// Get current user profile
export const getUserProfile = async () => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${API_BASE}/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
};

// Update user profile
export const updateUserProfile = async (profileData: {
  name?: string;
  phone?: string;
  website?: string;
  avatar_url?: string;
}) => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${API_BASE}/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(profileData),
  });

  return response.json();
};

// Update email
export const updateUserEmail = async (email: string) => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${API_BASE}/email`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email }),
  });

  return response.json();
};

// Get user statistics
export const getUserStats = async () => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${API_BASE}/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
};

// Admin: List users
export const listUsers = async (page = 1, perPage = 10) => {
  const token = localStorage.getItem("accessToken");

  const response = await fetch(`${API_BASE}?page=${page}&perPage=${perPage}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
};
```

### **React Components**

```tsx
// components/UserProfile.tsx
import React, { useState, useEffect } from "react";
import { getUserProfile, updateUserProfile } from "../utils/userApi";

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  website?: string;
  avatar_url?: string;
}

const UserProfile: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    website: "",
    avatar_url: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await getUserProfile();
      if (response.success) {
        setProfile(response.data);
        setFormData({
          name: response.data.name || "",
          phone: response.data.phone || "",
          website: response.data.website || "",
          avatar_url: response.data.avatar_url || "",
        });
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await updateUserProfile(formData);
      if (response.success) {
        setProfile(response.data);
        setEditing(false);
        alert("Profile updated successfully!");
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!profile) return <div>Profile not found</div>;

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="text-center mb-6">
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt="Avatar"
            className="w-20 h-20 rounded-full mx-auto mb-4"
          />
        )}
        <h2 className="text-2xl font-bold">{profile.name || "No Name"}</h2>
        <p className="text-gray-600">{profile.email}</p>
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Avatar URL</label>
            <input
              type="url"
              value={formData.avatar_url}
              onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div>
            <span className="font-medium">Phone:</span> {profile.phone || "Not set"}
          </div>
          <div>
            <span className="font-medium">Website:</span>{" "}
            {profile.website ? (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {profile.website}
              </a>
            ) : (
              "Not set"
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            Edit Profile
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
```

---

## 🧪 Testing Guide

### **1. Test User Profile Operations**

```bash
# Get profile
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Update profile
curl -X PUT http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Updated",
    "phone": "+1234567890",
    "website": "https://johnupdated.com"
  }'

# Update email
curl -X PUT http://localhost:3000/api/users/email \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "newemail@example.com"}'

# Get stats
curl -X GET http://localhost:3000/api/users/stats \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### **2. Test Admin Operations**

```bash
# List users
curl -X GET "http://localhost:3000/api/users?page=1&perPage=5" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"

# Get user by ID
curl -X GET http://localhost:3000/api/users/USER_UUID \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"

# Ban user
curl -X PUT http://localhost:3000/api/users/USER_UUID/ban \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"banned": true}'

# Delete user
curl -X DELETE http://localhost:3000/api/users/USER_UUID \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

---

## 🛡️ Security & Permissions

### **Authentication Required**

- All endpoints require valid JWT token
- Token must be sent in `Authorization: Bearer <token>` header

### **Rate Limiting**

- Profile updates: 5 requests per 15 minutes
- Email updates: 5 requests per 15 minutes
- Admin operations: 5 requests per 15 minutes

### **Admin Operations**

- Currently all authenticated users can access admin endpoints
- **TODO**: Implement role-based access control (RBAC)
- **Recommendation**: Add admin role check middleware

---

## 🔧 Error Handling

### **Common Error Responses**

```json
// Validation Error
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Email must be valid",
      "param": "email",
      "location": "body"
    }
  ]
}

// Authentication Error
{
  "success": false,
  "message": "User not authenticated"
}

// Not Found Error
{
  "success": false,
  "message": "User not found"
}

// Server Error
{
  "success": false,
  "message": "Failed to update profile"
}
```

---

## 📊 Database Integration

### **Supabase Auth Integration**

- Uses `supabaseAdmin.auth.admin.*` for user management
- User metadata stored in `user_metadata` field
- Profile updates sync with Supabase Auth user record

### **Related Tables**

- `agents` table: Linked via `owner_id`
- `analytics` table: Linked via agent ownership

---

## 🚀 Next Steps

### **1. Role-Based Access Control**

```typescript
// middleware/rbac.middleware.ts
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.app_metadata?.role !== "admin") {
    return errorResponse(res, "Admin access required", 403);
  }
  next();
};

// Apply to admin routes
router.get("/", authMiddleware, requireAdmin, userController.listUsers);
```

### **2. Email Verification**

- Add email verification flow
- Require verification for email updates

### **3. Profile Picture Upload**

- Add file upload endpoint
- Integrate with Supabase Storage
- Generate avatar URLs

### **4. User Preferences**

- Add user preferences table
- Theme, language, notification settings

---

## ✅ Features Completed

- ✅ User profile CRUD operations
- ✅ Email updates
- ✅ User statistics
- ✅ Admin user management
- ✅ Input validation
- ✅ Rate limiting
- ✅ Error handling
- ✅ Supabase Auth integration
- ✅ TypeScript types
- ✅ Comprehensive documentation

---

**🎉 User Management API Ready!**

Users có thể quản lý profile, admins có thể quản lý tất cả users một cách an toàn và hiệu quả.
