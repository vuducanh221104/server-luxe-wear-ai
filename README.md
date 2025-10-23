# Server Luxe Wear AI

Backend server cho ứng dụng Luxe Wear AI - AI-powered fashion assistant với Supabase, Pinecone và Google Gemini.

**🎯 Enterprise-grade AI platform** với RAG (Retrieval Augmented Generation), vector search, multi-tenancy, và Model Context Protocol (MCP) support.

## 🏗️ Cấu trúc dự án

```
├─ src/
│  ├─ app.ts                           # Express app configuration
│  ├─ server.ts                        # Server entry point
│  │
│  ├─ config/                          # Configuration files
│  │  ├─ env.ts                        # Environment variables
│  │  ├─ supabase.ts                   # Supabase client setup
│  │  ├─ pinecone.ts                   # Pinecone vector database
│  │  ├─ ai.ts                         # Google Gemini AI configuration
│  │  ├─ passport.ts                   # OAuth authentication
│  │  └─ logger.ts                     # Winston logger config
│  │
│  ├─ routes/                          # API routes (REST)
│  │  ├─ index.ts                      # Main router
│  │  ├─ auth.router.ts                # Authentication routes
│  │  ├─ user.router.ts                # User management routes
│  │  ├─ agent.router.ts               # AI agent routes
│  │  ├─ knowledge.router.ts           # Knowledge base routes
│  │  ├─ analytics.router.ts           # Analytics routes
│  │  ├─ tenant.router.ts              # Multi-tenant management
│  │  ├─ public.router.ts              # Public API routes
│  │  └─ webhook.router.ts             # Webhook integrations
│  │
│  ├─ controllers/                     # Request handlers
│  │  ├─ auth.controller.ts            # Authentication controller
│  │  ├─ oauth.controller.ts           # OAuth (Google, GitHub) controller
│  │  ├─ user.controller.ts            # User management controller
│  │  ├─ agent.controller.ts           # AI agent controller
│  │  ├─ knowledge.controller.ts       # Knowledge base controller
│  │  ├─ analytics.controller.ts       # Analytics controller
│  │  ├─ tenant.controller.ts          # Tenant management controller
│  │  ├─ public.controller.ts          # Public controller
│  │  └─ webhook.controller.ts         # Webhook controller
│  │
│  ├─ services/                        # Business logic layer
│  │  ├─ auth.service.ts               # Authentication service
│  │  ├─ user.service.ts               # User management service
│  │  ├─ agent.service.ts              # AI agent service
│  │  ├─ knowledge.service.ts          # Knowledge database operations
│  │  ├─ ai.service.ts                 # 🔥 AI service (Gemini integration)
│  │  ├─ rag.service.ts                # 🔥 RAG service (context-aware AI)
│  │  ├─ vector.service.ts             # 🔥 Vector operations (Pinecone)
│  │  ├─ embedding.service.ts          # 🔥 Text embeddings (multilingual-e5-large)
│  │  ├─ streamingKnowledge.service.ts # 🔥 Streaming file processing
│  │  ├─ analytics.service.ts          # Analytics & metrics
│  │  ├─ storage.service.ts            # File storage (Supabase Storage)
│  │  ├─ tenant.service.ts             # Multi-tenancy service
│  │  ├─ token.service.ts              # JWT token management
│  │  └─ webhook.service.ts            # Webhook service
│  │
│  ├─ middlewares/                     # Express middlewares
│  │  ├─ auth.middleware.ts            # JWT authentication
│  │  ├─ tenant.middleware.ts          # Tenant context injection
│  │  ├─ avatarUpload.middleware.ts    # Avatar upload handling
│  │  ├─ streamingUpload.middleware.ts # Streaming file upload
│  │  ├─ error.middleware.ts           # Global error handling
│  │  ├─ logger.middleware.ts          # Request/Response logging
│  │  ├─ rateLimiter.middleware.ts     # Rate limiting (anti-DDoS)
│  │  └─ validation.middleware.ts      # Input validation
│  │
│  ├─ validators/                      # Express-validator schemas
│  │  ├─ auth.validator.ts             # Authentication validation
│  │  ├─ user.validator.ts             # User validation
│  │  ├─ agent.validator.ts            # Agent validation
│  │  ├─ knowledge.validator.ts        # Knowledge validation
│  │  ├─ tenant.validator.ts           # Tenant validation
│  │  ├─ public.validator.ts           # Public API validation
│  │  └─ webhook.validator.ts          # Webhook validation
│  │
│  ├─ jobs/                            # Background jobs & Cron
│  │  ├─ index.ts                      # Job scheduler
│  │  ├─ email.job.ts                  # Email notifications
│  │  ├─ reindex.job.ts                # Pinecone reindexing
│  │  ├─ tokenCleanup.job.ts           # Expired token cleanup
│  │  └─ cleanup.job.ts                # Data cleanup
│  │
│  ├─ workers/                         # Background workers
│  │  └─ queue.worker.ts               # Bull queue processor
│  │
│  ├─ utils/                           # Utility functions
│  │  ├─ response.ts                   # Response formatters
│  │  ├─ streamingFileProcessor.ts     # PDF, DOCX text extraction
│  │  ├─ apiKey.ts                     # API key utilities
│  │  ├─ cache.ts                      # 🔥 Advanced caching (embeddings, AI responses)
│  │  ├─ database.ts                   # Database utilities
│  │  ├─ errorHandler.ts               # Error handling utilities
│  │  ├─ webhookSignature.ts           # Webhook signature verification
│  │  └─ unhandledRejectionHandler.ts  # Global error handler
│  │
│  ├─ integrations/                    # External API integrations
│  │  ├─ gemini.api.ts                 # Google Gemini API wrapper
│  │  └─ webhook.api.ts                # Webhook integrations
│  │
│  ├─ types/                           # TypeScript type definitions
│  │  ├─ index.ts                      # Main type exports
│  │  ├─ auth.ts                       # Authentication types
│  │  ├─ user.ts                       # User types
│  │  ├─ agent.ts                      # Agent types
│  │  ├─ knowledge.ts                  # Knowledge types
│  │  ├─ tenant.ts                     # Tenant types
│  │  ├─ webhook.ts                    # Webhook types
│  │  ├─ ai.ts                         # AI service types
│  │  ├─ gemini.ts                     # Gemini API types
│  │  ├─ upload.ts                     # File upload types
│  │  ├─ token.ts                      # Token types
│  │  └─ database.ts                   # Supabase database types
│  │
│  ├─ scripts/                         # Utility scripts
│  │  ├─ importKnowledge.ts            # Bulk knowledge import
│  │  └─ listAllVectors.ts             # Pinecone vector listing
│  │
│  └─ mcp/                             # 🚀 Model Context Protocol (MCP)
│     ├─ index.ts                      # MCP entry point
│     ├─ servers/                      # MCP server implementations
│     ├─ tools/                        # MCP tool definitions
│     ├─ resources/                    # MCP resources
│     ├─ prompts/                      # MCP prompt templates
│     ├─ shared/                       # Shared MCP utilities
│     └─ config/                       # MCP configuration
│
├─ tests/                              # Tests
│  ├─ unit/                            # Unit tests
│  │  ├─ controllers/                  # Controller tests
│  │  └─ services/                     # Service tests
│  ├─ integration/                     # Integration tests
│  ├─ e2e/                             # End-to-end tests
│  └─ helpers/                         # Test utilities
│
├─ dist/                               # Compiled JavaScript (generated)
├─ logs/                               # Application logs (daily rotation)
├─ coverage/                           # Test coverage reports
├─ node_modules/                       # Dependencies
├─ package.json                        # Dependencies & scripts
├─ package-lock.json                   # Lock file
├─ tsconfig.json                       # TypeScript configuration
├─ jest.config.js                      # Jest test configuration
├─ nodemon.json                        # Nodemon configuration
├─ .env                                # Environment variables
├─ .env.example                        # Environment template
└─ .gitignore                          # Git ignore rules
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

### 🔐 Authentication & OAuth

#### Standard Authentication

- `POST /api/auth/register` - Đăng ký user mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Quên mật khẩu
- `POST /api/auth/reset-password` - Reset mật khẩu
- `POST /api/auth/verify-email` - Xác thực email
- `POST /api/auth/resend-verification` - Gửi lại email xác thực

#### OAuth Integration

- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/github` - GitHub OAuth login
- `GET /api/auth/github/callback` - GitHub OAuth callback

### 👤 Users

- `GET /api/users/profile` - Lấy thông tin profile
- `PUT /api/users/profile` - Cập nhật profile
- `POST /api/users/avatar` - Upload avatar (multipart/form-data)
- `GET /api/users` - Lấy danh sách users (Admin only)
- `GET /api/users/:id` - Lấy thông tin user theo ID (Admin only)
- `DELETE /api/users/:id` - Xóa user (Admin only)

### 🤖 AI Agents

#### Agent Management

- `POST /api/agents` - Tạo AI agent mới
- `GET /api/agents` - Lấy danh sách agents
- `GET /api/agents/search` - Tìm kiếm agents
- `GET /api/agents/:id` - Lấy thông tin agent
- `PUT /api/agents/:id` - Cập nhật agent
- `DELETE /api/agents/:id` - Xóa agent
- `POST /api/agents/:id/regenerate-key` - Regenerate API key

#### Agent Interaction

- `POST /api/agents/:id/chat` - Chat với agent (RAG-powered)
- `POST /api/agents/:id/chat/stream` - Streaming chat response
- `GET /api/agents/:id/conversations` - Lấy lịch sử chat
- `POST /api/agents/:id/regenerate` - Regenerate response
- `GET /api/agents/:id/stats` - Agent statistics

#### Agent Configuration

- `PUT /api/agents/:id/public` - Toggle public status
- `PUT /api/agents/:id/origins` - Update allowed origins (CORS)

### 📚 Knowledge Base

#### Knowledge Management

- `POST /api/knowledge` - Tạo knowledge mới (manual)
- `GET /api/knowledge` - Lấy danh sách knowledge
- `GET /api/knowledge/:id` - Lấy knowledge theo ID
- `PUT /api/knowledge/:id` - Cập nhật knowledge
- `DELETE /api/knowledge/:id` - Xóa knowledge

#### Knowledge Search

- `POST /api/knowledge/search` - Semantic search (vector similarity)
- `POST /api/knowledge/search/text` - Full-text search

#### File Upload & Processing

- `POST /api/knowledge/upload` - Upload single file (PDF, DOCX, TXT, MD)
- `POST /api/knowledge/upload/batch` - Upload multiple files (max 5)
- `POST /api/knowledge/upload/stream` - Streaming upload for large files

#### Admin Knowledge Routes

- `GET /api/knowledge/admin/all` - Lấy tất cả knowledge (Admin)
- `GET /api/knowledge/admin/stats` - Thống kê knowledge (Admin)
- `DELETE /api/knowledge/admin/:id` - Force delete knowledge (Admin)

### 🏢 Tenants (Multi-tenancy)

- `POST /api/tenants` - Tạo tenant mới (Admin)
- `GET /api/tenants` - Lấy danh sách tenants
- `GET /api/tenants/:id` - Lấy thông tin tenant
- `PUT /api/tenants/:id` - Cập nhật tenant
- `DELETE /api/tenants/:id` - Xóa tenant (Admin)
- `GET /api/tenants/:id/stats` - Tenant statistics
- `GET /api/tenants/:id/members` - Tenant members
- `POST /api/tenants/:id/invite` - Mời member vào tenant

### 📊 Analytics

- `GET /api/analytics/dashboard` - Dashboard overview
- `GET /api/analytics/agents/:id/stats` - Agent-specific stats
- `GET /api/analytics/conversations` - Conversation analytics
- `GET /api/analytics/knowledge/usage` - Knowledge usage stats
- `GET /api/analytics/costs` - AI cost breakdown
- `GET /api/analytics/popular-queries` - Most searched queries

### 🌐 Public Routes

- `GET /api/public/health` - Health check
- `GET /api/public/status` - System status
- `GET /api/public/agents/:apiKey/chat` - Public agent chat (API key required)

### 🔔 Webhooks

- `POST /api/webhooks/supabase` - Supabase database webhooks
- `POST /api/webhooks/pinecone` - Pinecone vector database webhooks
- `POST /api/webhooks/stripe` - Stripe payment webhooks (if integrated)

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
npm run dev          # Chạy development server (hot reload)
npm run dev:clean    # Clean port 3001 và chạy dev server
npm run build        # Build TypeScript → JavaScript
npm run watch        # Watch mode for TypeScript compilation
npm run start        # Chạy production server
```

### Code Quality

```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors automatically
npm run format       # Format code với Prettier
npm run format:check # Check code formatting
npm run type-check   # TypeScript type checking (no emit)
```

### Testing

```bash
npm test                 # Chạy tất cả tests với coverage
npm run test:watch       # Watch mode for tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:auth        # Auth tests only
npm run test:ci          # CI mode (no watch, with coverage)
```

### Knowledge Management

```bash
# Import knowledge từ thư mục
npm run import:knowledge <directory> <userId>

# Import knowledge từ JSON file
npm run import:knowledge <jsonFile.json> <userId>
```

### MCP Servers (Model Context Protocol)

```bash
# Development mode (ts-node)
npm run mcp:dev:fashion    # Fashion AI MCP Server
npm run mcp:dev:knowledge  # Knowledge Search MCP Server
npm run mcp:dev:document   # Document Processing MCP Server
npm run mcp:dev:agent      # Agent Management MCP Server
npm run mcp:dev:analytics  # Analytics MCP Server

# Build MCP servers
npm run mcp:build          # Build all MCP servers
npm run mcp:build:watch    # Watch mode for MCP build

# Production mode
npm run mcp:start:fashion  # Start Fashion AI MCP Server
npm run mcp:start:all      # Start all MCP servers

# Testing MCP
npm run mcp:test           # Test MCP servers
npm run mcp:test:watch     # Watch mode for MCP tests
```

### API Testing (Manual)

```bash
npm run test:api       # Test API endpoints manually
npm run test:user-api  # Test user API endpoints
```

## 🔧 Tech Stack

### Core Technologies

- **Language:** TypeScript 5.3+ (Strict mode)
- **Runtime:** Node.js v18+
- **Framework:** Express.js 4.x
- **Database:** Supabase (PostgreSQL with RLS)
- **Vector Database:** Pinecone (1024 dimensions - multilingual-e5-large)
- **AI Engine:** Google Gemini 1.5 Flash

### AI & Vector Search

- **Embeddings:** Pinecone Inference API (multilingual-e5-large, 1024 dims)
- **RAG Engine:** Custom RAG implementation with context optimization
- **Vector Search:** Pinecone with metadata filtering
- **AI Response:** Google Gemini 1.5 Flash
- **Caching:** In-memory cache for embeddings & AI responses

### Authentication & Security

- **Authentication:** JWT + Supabase Auth
- **OAuth Providers:** Google, GitHub (via Passport.js)
- **Multi-tenancy:** Row-Level Security (RLS) + Tenant isolation
- **Security Headers:** Helmet.js
- **CORS:** Configurable origin whitelist
- **Rate Limiting:** Express Rate Limit (anti-DDoS)
- **Input Validation:** express-validator + Zod schemas

### File Processing

- **Upload Handler:** Multer (multipart/form-data)
- **Streaming Upload:** Busboy (for large files)
- **PDF Processing:** pdf-parse
- **DOCX Processing:** mammoth
- **Text Chunking:** Custom chunking algorithm with overlap

### Background Processing

- **Queue System:** Bull (Redis-based)
- **Job Scheduler:** node-cron
- **Workers:** Separate worker processes
- **Jobs:** Email, Cleanup, Token Cleanup, Reindexing

### Logging & Monitoring

- **Logger:** Winston 3.x
- **Log Rotation:** winston-daily-rotate-file
- **Log Levels:** ERROR, WARN, INFO, DEBUG
- **Request Logging:** Morgan + Winston

### Testing

- **Framework:** Jest 29.x
- **API Testing:** Supertest
- **Coverage:** Istanbul (via Jest)
- **Test Types:** Unit, Integration, E2E

### Developer Tools

- **Linting:** ESLint + TypeScript ESLint
- **Formatting:** Prettier
- **Type Checking:** TypeScript Compiler
- **Hot Reload:** Nodemon + ts-node

### Integration & Extensions

- **MCP Support:** Model Context Protocol SDK v1.20+
- **Schema Validation:** Zod 3.x (for MCP tools)
- **HTTP Client:** Axios
- **Webhooks:** Custom signature verification

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

### Embedding Model Details

- **Model**: Pinecone Inference API - multilingual-e5-large
- **Dimensions**: 1024 (optimized for multilingual support)
- **Language Support**: 100+ languages including English, Vietnamese, Chinese, etc.
- **Use Case**: Semantic search, RAG, similarity matching
- **Benefits**:
  - No quota limits (unlike Google Gemini embeddings)
  - Free tier available
  - Fast inference via Pinecone infrastructure
  - Excellent performance for fashion & e-commerce domain

## 🚀 Model Context Protocol (MCP) Architecture

### MCP Server Overview

Luxe Wear AI hỗ trợ **Model Context Protocol (MCP)** - một giao thức chuẩn để expose AI capabilities qua tools, resources, và prompts.

```
┌─────────────────────────────────────────────────────────┐
│         MCP Clients (Cursor, Claude Desktop, etc)        │
└─────────────────────────────────────────────────────────┘
                           │
                           │ Stdio/SSE/HTTP Transport
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Luxe Wear AI MCP Servers                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Tools Layer (41+ MCP Tools)                     │   │
│  │  - Fashion AI Chat, Search, Analyze              │   │
│  │  - Knowledge Search, Create, Update              │   │
│  │  - Document Processing, Text Extraction          │   │
│  │  - Agent Management, Stats                       │   │
│  │  - Analytics, Metrics, Costs                     │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Services Layer (Existing Services - No Change)  │   │
│  │  - RAG Service, Vector Service                   │   │
│  │  - AI Service, Embedding Service                 │   │
│  │  - Knowledge Service, Agent Service              │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Data Layer                                      │   │
│  │  - Supabase (PostgreSQL)                        │   │
│  │  - Pinecone (Vector DB)                         │   │
│  │  - Google Gemini AI                             │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Available MCP Servers

#### 1. **Fashion AI MCP Server** (`luxe-wear-fashion-ai`)

**6 tools** - AI-powered fashion assistance

- `fashion_ai_chat` - RAG-powered chat
- `fashion_ai_search` - Semantic search
- `fashion_ai_sentiment` - Sentiment analysis
- `fashion_ai_health` - Health check
- `fashion_ai_stats` - Usage statistics
- `fashion_ai_clear_cache` - Cache management

#### 2. **Knowledge Search MCP Server** (`luxe-wear-knowledge-search`)

**10 tools** - Knowledge base operations

- `knowledge_semantic_search` - Vector similarity search
- `knowledge_create` - Create knowledge entry
- `knowledge_get` - Retrieve knowledge
- `knowledge_list` - List all knowledge
- `knowledge_update` - Update knowledge
- `knowledge_delete` - Delete knowledge
- `knowledge_generate_embedding` - Generate text embeddings
- `knowledge_count_tokens` - Count tokens
- `knowledge_build_context` - Build optimized context
- `knowledge_batch_store` - Batch operations

#### 3. **Document Processing MCP Server** (`luxe-wear-document-processor`)

**6 tools** - File processing & extraction

- `document_extract_pdf` - Extract text from PDF
- `document_extract_docx` - Extract text from DOCX
- `document_chunk_text` - Intelligent text chunking
- `document_to_knowledge` - Convert file → knowledge
- `document_process_stream` - Streaming file processing
- `document_batch_process` - Batch file processing

#### 4. **Agent Management MCP Server** (`luxe-wear-agent-manager`)

**10 tools** - AI agent lifecycle management

- `agent_create` - Create new agent
- `agent_get` - Get agent details
- `agent_list` - List all agents
- `agent_update` - Update agent
- `agent_delete` - Delete agent
- `agent_stats` - Agent statistics
- `agent_search` - Search agents
- `agent_regenerate_key` - Regenerate API key
- `agent_toggle_public` - Toggle public status
- `agent_update_origins` - Update CORS origins

#### 5. **Analytics MCP Server** (`luxe-wear-analytics`)

**4 tools** - Metrics & insights

- `analytics_dashboard` - Dashboard overview
- `analytics_agent_stats` - Agent-specific metrics
- `analytics_conversations` - Conversation analytics
- `analytics_knowledge_usage` - Knowledge usage stats

### MCP Use Cases

**🎯 For Developers:**

- Integrate AI fashion assistant vào apps
- Automate knowledge base management
- Build custom AI workflows
- Rapid prototyping với MCP tools

**🎯 For AI Applications:**

- Cursor/Claude Desktop integration
- Custom AI agents với fashion expertise
- Automated content generation
- Research & analysis tools

**🎯 For Enterprises:**

- Multi-tenant AI platform
- Centralized knowledge management
- Analytics & reporting automation
- Cost optimization via intelligent caching

## ✨ Features

### 🤖 Advanced AI Capabilities

- ✅ **RAG (Retrieval Augmented Generation)** - Context-aware AI responses
- ✅ **Semantic Search** - Vector similarity search với Pinecone
- ✅ **Smart Caching** - Cache embeddings & AI responses để optimize performance
- ✅ **Context Optimization** - Token-aware context building (max 30K tokens)
- ✅ **Multi-language Embeddings** - Pinecone Inference (multilingual-e5-large, 1024 dims)
- ✅ **Streaming Responses** - Real-time AI response streaming
- ✅ **Cost Optimization** - Intelligent caching reduces AI API calls by 70%+

### 🔒 Security & Authentication

- ✅ **Multi-factor Auth** - JWT + Supabase Auth
- ✅ **OAuth Integration** - Google & GitHub login (via Passport.js)
- ✅ **Multi-tenancy** - Row-Level Security (RLS) với tenant isolation
- ✅ **Rate Limiting** - Protect against DDoS & spam (configurable per endpoint)
- ✅ **API Key Management** - Secure API key generation & rotation
- ✅ **Token Management** - Automatic token cleanup & refresh
- ✅ **Input Validation** - express-validator + Zod schemas
- ✅ **Security Headers** - Helmet.js với CSP, HSTS, etc.
- ✅ **CORS Protection** - Whitelist-based origin control

### 📁 File Processing & Knowledge Management

- ✅ **Multi-format Support** - PDF, DOCX, TXT, MD
- ✅ **Streaming Upload** - Handle large files (10MB+) efficiently
- ✅ **Smart Chunking** - Intelligent text chunking với overlap
- ✅ **Batch Processing** - Process multiple files in parallel
- ✅ **Auto-vectorization** - Automatic embedding generation
- ✅ **Metadata Extraction** - File metadata & custom tags
- ✅ **Knowledge Search** - Full-text + semantic search
- ✅ **Vector Storage** - Pinecone integration với metadata filtering

### 🏢 Multi-tenancy & Enterprise

- ✅ **Tenant Isolation** - Complete data isolation per tenant
- ✅ **Custom Plans** - Free, Pro, Enterprise plans
- ✅ **Resource Limits** - Per-tenant quotas & rate limiting
- ✅ **Analytics** - Per-tenant usage statistics
- ✅ **Billing Integration** - Ready for Stripe/payment integration
- ✅ **Team Management** - Multi-user per tenant
- ✅ **Role-based Access** - Admin, Member, Viewer roles

### 📊 Analytics & Monitoring

- ✅ **Dashboard Analytics** - Real-time metrics & insights
- ✅ **Usage Tracking** - API calls, tokens, storage usage
- ✅ **Cost Tracking** - AI API costs per tenant/user
- ✅ **Performance Metrics** - Response times, error rates
- ✅ **Conversation Analytics** - Chat history & patterns
- ✅ **Knowledge Analytics** - Popular queries, search patterns
- ✅ **Winston Logging** - Structured logging với daily rotation
- ✅ **Error Tracking** - Comprehensive error logging

### ⚙️ Background Processing

- ✅ **Job Scheduler** - Cron jobs cho recurring tasks
- ✅ **Queue System** - Bull (Redis-based) cho async jobs
- ✅ **Email Notifications** - Automated email sending
- ✅ **Token Cleanup** - Automatic expired token removal
- ✅ **Vector Reindexing** - Periodic Pinecone reindex
- ✅ **Data Cleanup** - Old data archival & deletion
- ✅ **Worker Processes** - Separate worker for job processing

### 🚀 Model Context Protocol (MCP) Support

- ✅ **MCP Server Architecture** - Expose AI capabilities via MCP
- ✅ **Fashion AI Tools** - Chat, search, analyze via MCP
- ✅ **Knowledge Search Tools** - Semantic search via MCP
- ✅ **Document Processing Tools** - File processing via MCP
- ✅ **Agent Management Tools** - Create & manage agents via MCP
- ✅ **Analytics Tools** - Get metrics & insights via MCP
- ✅ **Stdio Transport** - Standard input/output for MCP
- ✅ **Zod Validation** - Type-safe tool parameters

### 🧪 Testing & Quality

- ✅ **Unit Tests** - Controllers & services
- ✅ **Integration Tests** - API endpoints
- ✅ **E2E Tests** - Full user flows
- ✅ **Test Coverage** - >80% code coverage
- ✅ **Mock Data** - Comprehensive test helpers
- ✅ **CI/CD Ready** - Jest configuration cho GitHub Actions
- ✅ **Type Safety** - Full TypeScript coverage

### 🛠️ Developer Experience

- ✅ **TypeScript Strict Mode** - Maximum type safety
- ✅ **Hot Reload** - Instant development feedback
- ✅ **ESLint + Prettier** - Code quality & formatting
- ✅ **Auto-completion** - Full IntelliSense support
- ✅ **API Documentation** - Comprehensive guides (MD files)
- ✅ **Error Messages** - Clear & actionable error messages
- ✅ **Logging** - Detailed request/response logging

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

## 🌍 Environment Variables

### Required Variables

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_ENVIRONMENT=your_environment_here  # e.g., us-east-1-aws
PINECONE_INDEX_NAME=luxe-wear-knowledge

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_here_min_32_chars
JWT_EXPIRES_IN=7d
```

### Optional Variables

```env
# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# OAuth Configuration (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=/api/auth/google/callback

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=/api/auth/github/callback

# Redis Configuration (for Bull queue)
REDIS_URL=redis://localhost:6379

# File Upload Configuration
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_FILE_TYPES=pdf,docx,txt,md

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info  # error | warn | info | debug
```

## 🚀 Deployment

### Prerequisites

1. **Supabase Project**
   - Create project at [supabase.com](https://supabase.com)
   - Setup database tables (use provided schemas)
   - Configure Row Level Security (RLS) policies
   - Get API keys from Project Settings

2. **Pinecone Account**
   - Create account at [pinecone.io](https://pinecone.io)
   - Create index với dimension = 1024 (multilingual-e5-large)
   - Metric: cosine similarity
   - Get API key

3. **Google Gemini API**
   - Get API key from [ai.google.dev](https://ai.google.dev)
   - Enable Gemini 1.5 Flash model

### Deployment Options

#### Option 1: Railway / Render

```bash
# 1. Build project
npm run build

# 2. Set environment variables in platform dashboard

# 3. Deploy command
npm start
```

#### Option 2: Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

#### Option 3: VPS (Ubuntu/Debian)

```bash
# 1. Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install PM2
sudo npm install -g pm2

# 3. Clone và setup
git clone <repository-url>
cd server-luxe-wear-ai
npm install
npm run build

# 4. Start with PM2
pm2 start dist/server.js --name "luxe-wear-ai"
pm2 save
pm2 startup
```

### Production Checklist

- [ ] All environment variables configured
- [ ] Supabase RLS policies enabled
- [ ] Rate limiting configured appropriately
- [ ] CORS origins whitelisted
- [ ] Logging level set to `info` or `warn`
- [ ] SSL/TLS certificates configured
- [ ] Database backups scheduled
- [ ] Error monitoring setup (e.g., Sentry)
- [ ] Load balancer configured (if applicable)
- [ ] CDN for static assets (if applicable)

## 📚 Documentation

### API Documentation

- [User API Guide](src/controllers/md/USER_API_GUIDE.md)
- [Agent API Guide](src/controllers/md/AGENT_API_GUIDE.md)
- [Admin API Guide](src/controllers/md/ADMIN_API_GUIDE.md)

### Integration Guides

- [RAG Guide](src/integrations/md/RAG_GUIDE.md)
- [External Integration Guide](src/integrations/md/EXTERNAL_INTEGRATION_GUIDE.md)

### Architecture & Setup

- [Project Structure](src/md/STRUCTURE.md)
- [Authentication Setup](src/md/AUTH_SETUP.md)
- [Google OAuth Setup](src/services/md/GOOGLE_OAUTH_SETUP.md)

## 🎯 Best Practices

### Performance Optimization

1. **Use Caching Aggressively**

   ```typescript
   // Embeddings, AI responses, and search results are cached
   // Cache hit rate: ~70%+ in production
   ```

2. **Batch Operations**

   ```typescript
   // Use batch upload for multiple files
   // Use batch vector upsert for knowledge
   ```

3. **Optimize Context Window**
   ```typescript
   // Keep context under 30K tokens
   // Use token counting before AI calls
   ```

### Security Best Practices

1. **Always Validate Input**
   - Use express-validator for all endpoints
   - Sanitize user input before AI calls

2. **Implement Rate Limiting**
   - Protect expensive AI endpoints
   - Use different limits for different tiers

3. **Enable RLS in Supabase**
   - All tables should have RLS policies
   - Test policies thoroughly

4. **Rotate API Keys Regularly**
   - Agent API keys
   - External service keys

### Cost Optimization

1. **Cache AI Responses**
   - 70%+ reduction in AI API calls
   - Use smart cache invalidation

2. **Optimize Vector Storage**
   - Delete old/unused vectors
   - Use metadata filters effectively

3. **Monitor Usage**
   - Track AI token usage per tenant
   - Set up alerts for high usage

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Follow coding standards (see `.cursor/rules/`)
4. Write tests for new features
5. Ensure all tests pass (`npm test`)
6. Commit changes (`git commit -m 'Add some AmazingFeature'`)
7. Push to branch (`git push origin feature/AmazingFeature`)
8. Tạo Pull Request

### Coding Standards

- Follow TypeScript strict mode
- Use meaningful variable names
- Write comprehensive tests
- Document complex logic
- Keep functions small and focused
- See [Coding Standards](/.cursor/rules/coding-standards.mdc) for details

## 📄 License

ISC

## 🙏 Acknowledgments

- **Supabase** - Database & Authentication
- **Pinecone** - Vector Database
- **Google Gemini** - AI Model
- **Model Context Protocol** - MCP Standard

---

## 📞 Support

**Issues:** [GitHub Issues](https://github.com/your-repo/issues)
**Discussions:** [GitHub Discussions](https://github.com/your-repo/discussions)
**Email:** support@luxewear.ai (replace with actual email)

---

**⚠️ Important Notes:**

1. Đảm bảo đã setup đầy đủ Supabase project, Pinecone index, và Google Gemini API key
2. Cấu hình RLS policies trong Supabase để đảm bảo data security
3. Setup Redis nếu sử dụng Bull queue cho background jobs
4. Xem [Environment Variables](#-environment-variables) section để biết tất cả config options
5. Đọc [Documentation](#-documentation) để hiểu rõ hơn về API và architecture

**🚀 Quick Start:**

```bash
git clone <repo-url>
cd server-luxe-wear-ai
npm install
cp .env.example .env  # Edit with your credentials
npm run dev
```

**Built with ❤️ using TypeScript, Express.js, and cutting-edge AI technologies.**
