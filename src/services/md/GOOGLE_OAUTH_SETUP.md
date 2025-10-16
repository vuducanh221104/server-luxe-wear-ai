# 🔐 Google OAuth Setup Guide

Hướng dẫn thiết lập Google OAuth với Supabase cho project.

---

## 📋 Bước 1: Cấu hình Google Cloud Console

### 1.1 Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project hiện có
3. Enable **Google+ API** và **OAuth2 API**

### 1.2 Tạo OAuth 2.0 Credentials

1. Vào **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client IDs**
3. Chọn **Application type**: Web application
4. Thêm **Authorized redirect URIs**:
   ```
   https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback
   ```
5. Lưu **Client ID** và **Client Secret**

---

## 📋 Bước 2: Cấu hình Supabase

### 2.1 Enable Google Provider

1. Vào [Supabase Dashboard](https://supabase.com/dashboard)
2. Chọn project → **Authentication** → **Providers**
3. Enable **Google**
4. Nhập:
   - **Client ID**: từ Google Cloud Console
   - **Client Secret**: từ Google Cloud Console
5. **Save**

### 2.2 Cấu hình Site URL

1. Vào **Authentication** → **URL Configuration**
2. Set **Site URL**: `http://localhost:3000` (development)
3. Thêm **Redirect URLs**:
   ```
   http://localhost:3000/auth/callback
   https://yourdomain.com/auth/callback
   ```

---

## 🔌 API Endpoints

### **1. Get Google OAuth URL**

```http
GET /api/auth/oauth/google?redirectTo=http://localhost:3000/auth/callback
```

**Response:**

```json
{
  "success": true,
  "message": "OAuth URL generated successfully",
  "data": {
    "url": "https://accounts.google.com/oauth/authorize?..."
  }
}
```

### **2. Handle OAuth Callback**

```http
POST /api/auth/oauth/callback
Content-Type: application/json

{
  "code": "authorization_code_from_google"
}
```

**Response:**

```json
{
  "success": true,
  "message": "OAuth authentication successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@gmail.com",
      "name": "John Doe",
      "avatar": "https://lh3.googleusercontent.com/...",
      "provider": "google"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "v1.xxx..."
  }
}
```

---

## 🌐 Frontend Integration

### **React/Next.js Example**

```typescript
// utils/auth.ts
export const loginWithGoogle = async () => {
  try {
    // 1. Get Google OAuth URL
    const response = await fetch('/api/auth/oauth/google?redirectTo=' +
      encodeURIComponent(window.location.origin + '/auth/callback'));

    const data = await response.json();

    if (data.success) {
      // 2. Redirect to Google
      window.location.href = data.data.url;
    }
  } catch (error) {
    console.error('Google login failed:', error);
  }
};

// pages/auth/callback.tsx (Next.js)
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const { code } = router.query;

      if (code) {
        try {
          // 3. Exchange code for tokens
          const response = await fetch('/api/auth/oauth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });

          const data = await response.json();

          if (data.success) {
            // 4. Save tokens
            localStorage.setItem('accessToken', data.data.accessToken);
            localStorage.setItem('refreshToken', data.data.refreshToken);

            // 5. Redirect to dashboard
            router.push('/dashboard');
          }
        } catch (error) {
          console.error('OAuth callback failed:', error);
          router.push('/login?error=oauth_failed');
        }
      }
    };

    handleCallback();
  }, [router.query]);

  return <div>Processing authentication...</div>;
}
```

### **React Component Example**

```tsx
// components/GoogleLoginButton.tsx
import React from "react";

const GoogleLoginButton: React.FC = () => {
  const handleGoogleLogin = async () => {
    try {
      const response = await fetch("/api/auth/oauth/google");
      const data = await response.json();

      if (data.success) {
        window.location.href = data.data.url;
      }
    } catch (error) {
      console.error("Google login failed:", error);
    }
  };

  return (
    <button
      onClick={handleGoogleLogin}
      className="flex items-center justify-center w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
    >
      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
        {/* Google Icon SVG */}
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Continue with Google
    </button>
  );
};

export default GoogleLoginButton;
```

---

## 🧪 Testing

### **1. Test OAuth URL Generation**

```bash
curl -X GET "http://localhost:3000/api/auth/oauth/google?redirectTo=http://localhost:3000/auth/callback"
```

### **2. Test Complete Flow**

1. Click "Login with Google" button
2. Redirect to Google → Login → Authorize
3. Redirect back to `/auth/callback?code=...`
4. Frontend calls `/api/auth/oauth/callback` with code
5. Receive tokens and user data

---

## 🔧 Environment Variables

```env
# Frontend URL for redirects
FRONTEND_URL=http://localhost:3000

# Supabase (already configured)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

---

## 🛡️ Security Notes

### ✅ **Best Practices**

- ✅ Always validate `redirectTo` parameter
- ✅ Use HTTPS in production
- ✅ Validate authorization codes
- ✅ Set proper CORS policies
- ✅ Use secure cookies for tokens

### ⚠️ **Important**

- **Never expose Client Secret** in frontend
- **Validate redirect URLs** to prevent open redirects
- **Use state parameter** to prevent CSRF attacks
- **Set token expiration** appropriately

---

## 🐛 Troubleshooting

### **"Invalid OAuth provider"**

- Check provider name in URL (must be exactly "google")
- Ensure Google is enabled in Supabase dashboard

### **"Authorization code is required"**

- Check if code parameter is being sent in POST body
- Verify callback URL is correct

### **"OAuth authentication failed"**

- Check Google Cloud Console credentials
- Verify redirect URIs match exactly
- Check Supabase provider configuration

### **CORS Errors**

- Add your domain to Supabase allowed origins
- Check CORS configuration in your app

---

## 📚 Additional Providers

Cùng cách setup cho các providers khác:

```typescript
// GitHub
GET / api / auth / oauth / github;

// Facebook
GET / api / auth / oauth / facebook;

// Twitter
GET / api / auth / oauth / twitter;
```

---

## ✅ Completed Features

- ✅ Google OAuth URL generation
- ✅ OAuth callback handling
- ✅ Token exchange
- ✅ User profile extraction
- ✅ Error handling
- ✅ Logging
- ✅ TypeScript types

---

**🎉 Google OAuth Setup Complete!**

Bây giờ users có thể đăng nhập bằng Google account một cách dễ dàng và an toàn.
