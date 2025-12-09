# Code Organization Patterns Guide

## Tổng quan

Project này sử dụng các design patterns sau để đảm bảo code clean và dễ maintain:

## 1. Cấu trúc thư mục

```
src/
├── shared/                   # Shared modules dùng chung
│   ├── constants/           # Hằng số, magic numbers
│   ├── errors/              # Custom error classes
│   ├── base/                # Base classes (Service, Controller)
│   └── index.ts             # Central export
│
├── config/                   # Configuration files
├── controllers/              # HTTP request handlers
├── services/                 # Business logic layer
├── middlewares/              # Express middlewares
├── routes/                   # Route definitions
├── types/                    # TypeScript interfaces/types
├── utils/                    # Utility functions
├── validators/               # Request validators
└── integrations/             # External API integrations
```

## 2. Design Patterns sử dụng

### 2.1 Repository/Service Pattern

- **Controllers**: Xử lý HTTP request/response, validation
- **Services**: Business logic, data access
- **Separation of concerns**: Controller không chứa business logic

```typescript
// Controller - Chỉ xử lý HTTP
class AuthController extends BaseController {
  async login(req: Request, res: Response) {
    this.validateRequest(req);
    const user = await authService.login(req.body);
    return this.sendSuccess(res, user, "Login successful");
  }
}

// Service - Business logic
class AuthService extends BaseService {
  async login(data: LoginData) {
    return this.executeOperation(async () => {
      // Business logic here
    }, "login");
  }
}
```

### 2.2 Error Handling Pattern

Sử dụng custom error classes để xử lý lỗi nhất quán:

```typescript
import { ValidationError, NotFoundError, AuthenticationError } from "../shared";

// Throw specific errors
if (!user) throw new NotFoundError("User");
if (!isValid) throw new ValidationError("Invalid email format");
if (!token) throw new AuthenticationError();
```

### 2.3 Constants Pattern

Tất cả magic numbers/strings được tập trung:

```typescript
import { AUTH, PAGINATION, HTTP_STATUS, MESSAGES } from "../shared";

// Sử dụng
const hash = await bcrypt.hash(password, AUTH.SALT_ROUNDS);
const { page = PAGINATION.DEFAULT_PAGE } = query;
return res.status(HTTP_STATUS.CREATED).json(data);
```

## 3. Coding Conventions

### 3.1 File Naming

- Services: `*.service.ts`
- Controllers: `*.controller.ts`
- Types: `*.ts` (trong types/)
- Middlewares: `*.middleware.ts`

### 3.2 Class Structure

```typescript
export class ExampleService extends BaseService {
  // 1. Private properties
  private readonly config: Config;

  // 2. Constructor
  constructor() {
    super("ExampleService");
  }

  // 3. Public methods
  async publicMethod() {}

  // 4. Private methods
  private helperMethod() {}
}

// 5. Singleton export
export const exampleService = new ExampleService();
```

### 3.3 Error Handling

```typescript
// ✅ Good - Using custom errors
throw new NotFoundError("Agent");

// ❌ Bad - Generic error
throw new Error("Agent not found");
```

### 3.4 Logging

```typescript
// ✅ Good - Using BaseService methods
this.logInfo("Operation completed", { userId, duration });

// ❌ Bad - Direct console or generic logger
console.log("Operation completed");
```

## 4. Import Order Convention

```typescript
// 1. Node.js built-in modules
import path from "path";

// 2. External packages
import express from "express";
import { z } from "zod";

// 3. Shared modules
import { AUTH, ValidationError, BaseService } from "../shared";

// 4. Internal modules (config, services, etc.)
import logger from "../config/logger";
import { userService } from "../services/user.service";

// 5. Types
import type { User, AuthResponse } from "../types";
```

## 5. Response Format

Tất cả API responses theo format thống nhất:

```typescript
// Success
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}

// Error
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 6. Ví dụ Migration

### Trước (Old Pattern)

```typescript
export class UserService {
  async getUser(id: string) {
    try {
      const user = await db.query(...);
      if (!user) throw new Error("User not found");
      logger.info("User fetched", { id });
      return user;
    } catch (error) {
      logger.error("Failed to get user", { error });
      throw error;
    }
  }
}
```

### Sau (New Pattern)

```typescript
export class UserService extends BaseService {
  constructor() {
    super("UserService");
  }

  async getUser(id: string) {
    return this.executeOperation(async () => {
      const user = await db.query(...);
      if (!user) throw new NotFoundError("User");
      return user;
    }, "getUser", { userId: id });
  }
}
```

## 7. Testing Considerations

- Services có thể được test độc lập
- Controllers có thể mock services
- Custom errors giúp assert dễ dàng hơn

```typescript
// Test example
it("should throw NotFoundError when user not exists", async () => {
  await expect(userService.getUser("invalid-id")).rejects.toThrow(NotFoundError);
});
```
