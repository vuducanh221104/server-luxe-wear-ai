# Server Luxe Wear AI

Backend server cho ứng dụng Luxe Wear AI - AI-powered fashion assistant với Supabase, Pinecone và Google Gemini.

## 🏗️ Cấu trúc dự án

```
├─ src/
│  ├─ app.ts                      # Express app configuration
│  ├─ server.ts                   # Server entry point
│  │
│  ├─ config/                     # Configuration files
│  │  ├─ env.ts                   # Environment variables
│  │  ├─ supabase.ts              # Supabase client setup
│  │  ├─ pinecone.ts              # Pinecone vector database setup
│  │  ├─ ai.ts                    # Google Gemini AI configuration
│  │  └─ logger.ts                # Winston logger config
│  │
│  ├─ routes/                     # API routes
│  │  ├─ index.ts                 # Main router
│  │  ├─ auth.router.ts           # Authentication routes
│  │  ├─ user.router.ts           # User management routes
│  │  ├─ agent.router.ts          # AI agent routes
│  │  ├─ knowledge.router.ts      # Knowledge base routes
│  │  ├─ analytics.router.ts      # Analytics routes
│  │  ├─ tenant.router.ts         # Tenant management routes
│  │  ├─ public.router.ts         # Public routes
│  │  └─ webhook.router.ts        # Webhook routes
│  │
│  ├─ controllers/                # Request handlers
│  │  ├─ auth.controller.ts       # Authentication controller
│  │  ├─ user.controller.ts       # User management controller
│  │  ├─ agent.controller.ts      # AI agent controller
│  │  ├─ knowledge.controller.ts  # Knowledge base controller
│  │  ├─ analytics.controller.ts  # Analytics controller
│  │  ├─ tenant.controller.ts     # Tenant management controller
│  │  ├─ public.controller.ts     # Public controller
│  │  └─ webhook.controller.ts    # Webhook controller
│  │
│  ├─ services/                   # Business logic layer
│  │  ├─ auth.service.ts          # Authentication service
│  │  ├─ user.service.ts          # User management service
│  │  ├─ agent.service.ts         # AI agent service
│  │  ├─ knowledge.service.ts     # Knowledge management service
│  │  ├─ ai.service.ts            # AI generation service
│  │  ├─ supabase.service.ts      # Supabase API service
│  │  ├─ storage.service.ts       # File storage service
│  │  ├─ tenant.service.ts        # Tenant management service
│  │  └─ webhook.service.ts       # Webhook service
│  │
│  ├─ middlewares/                # Express middlewares
│  │  ├─ auth.middleware.ts       # JWT authentication
│  │  ├─ admin.middleware.ts      # Admin authorization
│  │  ├─ tenant.middleware.ts     # Tenant context
│  │  ├─ apiKey.middleware.ts     # API key authentication
│  │  ├─ avatar.middleware.ts     # Avatar upload handling
│  │  ├─ error.middleware.ts      # Error handling
│  │  ├─ logger.middleware.ts     # Request logging
│  │  ├─ rateLimiter.middleware.ts # Rate limiting (anti-DDoS)
│  │  ├─ security.middleware.ts   # Security (Helmet, CORS)
│  │  ├─ upload.middleware.ts     # File upload handling
│  │  └─ validation.middleware.ts # Input validation
│  │
│  ├─ validators/                 # Validation schemas
│  │  ├─ auth.validator.ts        # Authentication validation
│  │  ├─ user.validator.ts        # User validation
│  │  ├─ agent.validator.ts       # Agent validation
│  │  ├─ knowledge.validator.ts   # Knowledge validation
│  │  ├─ tenant.validator.ts      # Tenant validation
│  │  ├─ public.validator.ts      # Public API validation
│  │  └─ webhook.validator.ts     # Webhook validation
│  │
│  ├─ jobs/                       # Background jobs & Cron
│  │  ├─ index.ts                 # Job scheduler
│  │  ├─ email.job.ts             # Email notifications
│  │  ├─ reindex.job.ts           # Pinecone reindexing
│  │  └─ cleanup.job.ts           # Data cleanup
│  │
│  ├─ workers/                    # Background workers
│  │  └─ queue.worker.ts          # Queue processor
│  │
│  ├─ utils/                      # Utility functions
│  │  ├─ response.ts              # Response helpers
│  │  ├─ vectorizer.ts            # Vector operations
│  │  ├─ fileProcessor.ts         # File processing
│  │  ├─ apiKey.ts                # API key utilities
│  │  ├─ cache.ts                 # Caching utilities
│  │  ├─ database.ts              # Database utilities
│  │  ├─ errorHandler.ts          # Error handling utilities
│  │  └─ unhandledRejectionHandler.ts # Unhandled rejection handler
│  │
│  ├─ integrations/               # External API integrations
│  │  ├─ gemini.api.ts            # Google Gemini API
│  │  └─ webhook.api.ts           # Webhook integrations
│  │
│  ├─ types/                      # TypeScript type definitions
│  │  ├─ index.ts                 # Main type exports
│  │  ├─ auth.ts                  # Authentication types
│  │  ├─ user.ts                  # User types
│  │  ├─ agent.ts                 # Agent types
│  │  ├─ knowledge.ts             # Knowledge types
│  │  ├─ tenant.ts                # Tenant types
│  │  ├─ webhook.ts               # Webhook types
│  │  ├─ ai.ts                    # AI types
│  │  ├─ gemini.ts                # Gemini API types
│  │  └─ database.ts              # Database types
│  │
│  └─ scripts/                    # Utility scripts
│     └─ import-knowledge.ts      # Knowledge import script
│
├─ tests/                         # Tests
│  ├─ unit/                       # Unit tests
│  │  ├─ controllers/             # Controller tests
│  │  │  ├─ auth.controller.test.ts
│  │  │  ├─ user.controller.test.ts
│  │  │  ├─ agent.controller.test.ts
│  │  │  └─ knowledge.controller.test.ts
│  │  └─ services/                # Service tests
│  │     ├─ auth.service.test.ts
│  │     ├─ agent.service.test.ts
│  │     └─ knowledge.service.test.ts
│  │
│  ├─ integration/                # Integration tests
│  │  ├─ auth.integration.test.ts
│  │  ├─ agent.integration.test.ts
│  │  └─ knowledge.integration.test.ts
│  │
│  ├─ e2e/                        # End-to-end tests
│  │  └─ api.e2e.test.ts
│  │
│  └─ helpers/                    # Test utilities
│     ├─ setup.ts
│     └─ mocks.ts
│
├─ dist/                          # Compiled JavaScript (generated)
├─ logs/                          # Application logs
├─ coverage/                      # Test coverage reports
├─ package.json                   # Dependencies
├─ package-lock.json              # Lock file
├─ tsconfig.json                  # TypeScript configuration
├─ jest.config.js                 # Jest test configuration
├─ nodemon.json                   # Nodemon configuration
├─ .env                          # Environment variables
└─ .gitignore                    # Git ignore rules
```

## 🚀 Cài đặt

### 1. Clone repository

```bash
git clone <repository-url>
cd server-luxe-wear-ai
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Cấu hình environment variables

Tạo file `.env` trong thư mục gốc với nội dung sau:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_ENVIRONMENT=your_pinecone_environment_here
PINECONE_INDEX_NAME=your_pinecone_index_name_here

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Redis Configuration (for Bull queue)
REDIS_URL=redis://localhost:6379

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,docx,txt,md
```

### 4. Build project

```bash
npm run build
```

### 5. Chạy server

**Development mode:**

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

Server sẽ chạy tại `http://localhost:3001`

## 📡 API Endpoints

### Authentication

- `POST /api/auth/register` - Đăng ký user mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Quên mật khẩu
- `POST /api/auth/reset-password` - Reset mật khẩu
- `POST /api/auth/verify-email` - Xác thực email
- `POST /api/auth/resend-verification` - Gửi lại email xác thực

### Users

- `GET /api/users/profile` - Lấy thông tin profile
- `PUT /api/users/profile` - Cập nhật profile
- `POST /api/users/avatar` - Upload avatar
- `GET /api/users` - Lấy danh sách users (Admin)
- `GET /api/users/:id` - Lấy thông tin user theo ID (Admin)
- `DELETE /api/users/:id` - Xóa user (Admin)

### Agents

- `POST /api/agents` - Tạo AI agent mới
- `GET /api/agents` - Lấy danh sách agents
- `GET /api/agents/:id` - Lấy thông tin agent
- `PUT /api/agents/:id` - Cập nhật agent
- `DELETE /api/agents/:id` - Xóa agent
- `POST /api/agents/:id/chat` - Chat với agent
- `GET /api/agents/:id/conversations` - Lấy lịch sử chat
- `POST /api/agents/:id/regenerate` - Regenerate response

### Knowledge Base

- `POST /api/knowledge` - Tạo knowledge mới (manual)
- `GET /api/knowledge` - Lấy danh sách knowledge của user
- `GET /api/knowledge/:id` - Lấy knowledge theo ID
- `PUT /api/knowledge/:id` - Cập nhật knowledge
- `DELETE /api/knowledge/:id` - Xóa knowledge
- `POST /api/knowledge/search` - Tìm kiếm knowledge (vector search)
- `POST /api/knowledge/upload` - Upload single file → auto create knowledge
- `POST /api/knowledge/upload/batch` - Upload multiple files → auto create knowledge

### Admin Routes

- `GET /api/knowledge/admin/all` - Lấy tất cả knowledge (Admin)
- `GET /api/knowledge/admin/stats` - Thống kê knowledge (Admin)
- `DELETE /api/knowledge/admin/:id` - Force delete knowledge (Admin)

### Analytics

- `GET /api/analytics/dashboard` - Dashboard analytics
- `GET /api/analytics/agents/:id/stats` - Agent statistics
- `GET /api/analytics/conversations` - Conversation analytics
- `GET /api/analytics/knowledge/usage` - Knowledge usage stats

### Public Routes

- `GET /api/public/health` - Health check
- `GET /api/public/status` - System status

### Webhooks

- `POST /api/webhooks/supabase` - Supabase webhook
- `POST /api/webhooks/pinecone` - Pinecone webhook

## 🎯 Knowledge Management Flow

### File Upload → Knowledge Creation

1. **Upload File**: User upload file qua API
2. **File Processing**: Tự động extract text từ file (PDF, DOCX, TXT, etc.)
3. **Text Chunking**: Chia text thành các chunks nhỏ (default: 1000 chars)
4. **Knowledge Creation**: Mỗi chunk → 1 knowledge entry
5. **Vector Storage**: Store embeddings trong Pinecone
6. **Database Storage**: Store metadata trong Supabase

### Configuration Options

```typescript
// File upload parameters
{
  chunkSize: 1000,        // Kích thước mỗi chunk
  overlap: 100,           // Overlap giữa các chunks
  agentId: "agent-123",   // Gán cho agent cụ thể
  title: "Custom Title"   // Override tên file
}
```

## 🛠️ Scripts

### Development

```bash
npm run dev          # Chạy development server
npm run build        # Build project
npm run start        # Chạy production server
npm run lint         # Lint code
npm run lint:fix     # Fix linting errors
```

### Testing

```bash
npm test             # Chạy tất cả tests
npm run test:watch   # Chạy tests với watch mode
npm run test:coverage # Chạy tests với coverage report
```

### Import Knowledge

Import knowledge từ thư mục:

```bash
npm run import:knowledge <directory> <userId>
```

Import knowledge từ JSON file:

```bash
npm run import:knowledge <jsonFile.json> <userId>
```

## 🔧 Tech Stack

- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL)
- **Vector Database:** Pinecone (1536 dimensions)
- **AI:** Google Gemini (gemini-embedding-001, gemini-1.5-flash)
- **Authentication:** Supabase Auth + JWT
- **Logger:** Winston
- **Queue:** Bull (Redis)
- **Validation:** express-validator
- **Testing:** Jest + Supertest
- **Security:** Helmet, CORS, Rate Limiting
- **File Upload:** Multer
- **Environment:** Node.js v18+

## 🏛️ Architecture Patterns

### Clean Architecture

- **Controllers**: Handle HTTP requests, validation, response formatting
- **Services**: Business logic, database operations, external API calls
- **Middlewares**: Cross-cutting concerns (auth, logging, rate limiting)
- **Validators**: Input validation schemas
- **Utils**: Reusable helper functions

### Separation of Concerns

- **HTTP Layer**: Controllers chỉ handle HTTP concerns
- **Business Layer**: Services handle business logic
- **Data Layer**: Database operations và external integrations
- **Infrastructure Layer**: Configuration, logging, monitoring

## 📝 Database Schema

### Knowledge Table

```sql
CREATE TABLE knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  agent_id UUID REFERENCES agents(id),
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Vector Storage (Pinecone)

- **Dimensions**: 1536 (Google Gemini gemini-embedding-001 with Matryoshka scaling)
- **Matryoshka Scaling**: Support 1536, 768, 512, 256 dimensions
- **Index**: luxe-wear-knowledge
- **Metadata**: userId, title, agentId, fileName, chunkIndex, etc.

### Matryoshka Scaling Benefits

- **Default**: 1536 dimensions for optimal cost/performance balance
- **Cost Optimization**: 50% cost reduction vs 3072 dimensions
- **Speed Improvement**: Faster processing than full dimensions
- **Flexibility**: Choose dimension based on use case
- **Compatibility**: Maintain compatibility with existing systems

## ✨ Features

### Security & Performance

- ✅ Rate limiting để chống spam và DDoS
- ✅ Helmet security headers
- ✅ CORS configuration
- ✅ Input validation với express-validator
- ✅ Request/Response logging với Winston
- ✅ JWT authentication với refresh tokens
- ✅ Admin role-based access control

### File Processing

- ✅ Multi-format support (PDF, DOCX, TXT, MD)
- ✅ Automatic text extraction
- ✅ Intelligent text chunking
- ✅ Vector embedding generation
- ✅ Batch file upload (max 5 files)

### AI Integration

- ✅ Google Gemini integration
- ✅ **Matryoshka scaling support** - Default 1536 dimensions (50% cost reduction)
- ✅ Vector similarity search
- ✅ RAG (Retrieval Augmented Generation)
- ✅ Context-aware responses
- ✅ Token management và cost optimization

### Background Jobs

- ✅ Cron jobs cho task định kỳ (email, cleanup, reindex)
- ✅ Queue worker cho async processing
- ✅ Email notifications
- ✅ Pinecone vector database reindexing
- ✅ Data cleanup và maintenance

### Testing

- ✅ Unit tests cho controllers & services
- ✅ Integration tests cho API endpoints
- ✅ E2E tests cho full flow
- ✅ Test helpers & mocks
- ✅ Jest configuration cho TypeScript
- ✅ Coverage reporting

## 🚨 Error Handling

### Custom Error Classes

- `ValidationError` - Input validation errors
- `NotFoundError` - Resource not found
- `UnauthorizedError` - Authentication errors
- `ForbiddenError` - Authorization errors

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📊 Monitoring & Logging

### Log Levels

- **ERROR**: System errors, exceptions
- **WARN**: Warning conditions
- **INFO**: General information
- **DEBUG**: Detailed debug information

### Log Files

- `logs/combined-YYYY-MM-DD.log` - All logs
- `logs/error-YYYY-MM-DD.log` - Error logs only

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📄 License

ISC

---

**Lưu ý**: Đảm bảo đã setup đầy đủ Supabase project, Pinecone index, và Google Gemini API key trước khi chạy ứng dụng.
