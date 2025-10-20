# Cấu trúc dự án chi tiết

## 📁 Folders & Files

### `/src` - Source code chính

#### `/config` - Cấu hình

- `env.ts` - Environment variables
- `supabase.ts` - Supabase client & admin
- `pinecone.ts` - Pinecone vector database
- `ai.ts` - Google Gemini AI models
- `logger.ts` - Winston logger configuration

#### `/routes` - API Routes

Định nghĩa các endpoints cho từng resource.

#### `/controllers` - Controllers

Xử lý request/response, gọi services, return data.

#### `/services` - Business Logic

- `supabase.service.ts` - Service chung gọi Supabase API
- `agent.service.ts` - Logic xử lý AI agents
- `knowledge.service.ts` - Quản lý knowledge base & vectorization

#### `/middlewares` - Middlewares

- `auth.middleware.ts` - Xác thực JWT token
- `error.middleware.ts` - Xử lý errors
- `logger.middleware.ts` - Log requests/responses
- `rateLimiter.middleware.ts` - Rate limiting (chống spam)
- `security.middleware.ts` - Security headers (Helmet, CORS)
- `validation.middleware.ts` - Validate input data

#### `/validators` - Validation Schemas

Định nghĩa schemas để validate input cho từng resource.

#### `/jobs` - Background Jobs & Cron

- `index.ts` - Job scheduler setup
- `email.job.ts` - Gửi email notifications
- `reindex.job.ts` - Reindex Pinecone vectors
- `cleanup.job.ts` - Cleanup old data

#### `/workers` - Background Workers

- `queue.worker.ts` - Process background queue tasks

#### `/utils` - Utilities

- `response.ts` - Format response helpers
- `vectorizer.ts` - Text vectorization utilities

#### `/integrations` - External APIs

- `gemini.api.ts` - Google Gemini API integration
- `webhook.api.ts` - Webhook handlers

#### `/types` - TypeScript Types

Type definitions cho toàn bộ project.

#### `/scripts` - Scripts

- `import-knowledge.ts` - Import knowledge từ files/JSON

---

### `/tests` - Tests

#### `/unit` - Unit Tests

Test từng function/method riêng lẻ.

#### `/integration` - Integration Tests

Test tích hợp giữa các components.

#### `/e2e` - End-to-End Tests

Test toàn bộ flow từ đầu đến cuối.

#### `/helpers` - Test Helpers

- `setup.ts` - Test setup & teardown
- `mocks.ts` - Mock data

---

## 🔄 Data Flow

```
Client Request
    ↓
Security Middleware (Helmet, CORS)
    ↓
Rate Limiter
    ↓
Logger Middleware
    ↓
Auth Middleware (nếu cần)
    ↓
Validation Middleware
    ↓
Route Handler
    ↓
Controller
    ↓
Service (Business Logic)
    ↓
    ├─> Supabase (Database)
    ├─> Pinecone (Vector DB)
    └─> Gemini AI (AI Processing)
    ↓
Response Formatter
    ↓
Client Response
```

---

## 🎯 Best Practices

### Controllers

- Nhận request, validate, gọi services
- Không chứa business logic
- Chỉ handle HTTP layer

### Services

- Chứa toàn bộ business logic
- Không biết gì về HTTP (req/res)
- Có thể được reuse ở nhiều nơi

### Middlewares

- Xử lý trước khi vào controller
- Có thể chain nhiều middlewares
- Early return nếu có lỗi

### Validation

- Validate ở middleware trước khi vào controller
- Sử dụng express-validator
- Return clear error messages

### Error Handling

- Throw errors ở services
- Catch ở error middleware
- Log errors với Winston
- Return user-friendly messages

---

## 🧪 Testing Strategy

### Unit Tests

- Test từng function riêng lẻ
- Mock tất cả dependencies
- Fast & isolated

### Integration Tests

- Test tích hợp giữa các layers
- Có thể dùng test database
- Slower nhưng more realistic

### E2E Tests

- Test toàn bộ API flows
- Gần với production nhất
- Slowest nhưng most confident
