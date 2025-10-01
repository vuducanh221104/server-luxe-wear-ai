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
│  │  └─ logger.ts                # Winston/Pino logger config
│  │
│  ├─ routes/                     # API routes
│  │  ├─ user.routes.ts
│  │  ├─ auth.routes.ts
│  │  ├─ agent.routes.ts
│  │  ├─ knowledge.routes.ts
│  │  └─ analytics.routes.ts
│  │
│  ├─ controllers/                # Request handlers
│  │  ├─ user.controller.ts
│  │  ├─ auth.controller.ts
│  │  ├─ agent.controller.ts
│  │  ├─ knowledge.controller.ts
│  │  └─ analytics.controller.ts
│  │
│  ├─ services/                   # Business logic
│  │  ├─ supabase.service.ts      # Supabase API service
│  │  ├─ agent.service.ts         # AI agent service
│  │  ├─ knowledge.service.ts     # Knowledge management
│  │  └─ ai.service.ts            # AI generation
│  │
│  ├─ middlewares/                # Express middlewares
│  │  ├─ auth.middleware.ts       # JWT authentication
│  │  ├─ error.middleware.ts      # Error handling
│  │  ├─ logger.middleware.ts     # Request logging
│  │  ├─ rateLimiter.middleware.ts # Rate limiting (anti-DDoS)
│  │  ├─ security.middleware.ts   # Security (Helmet, CORS)
│  │  └─ validation.middleware.ts # Input validation
│  │
│  ├─ validators/                 # Validation schemas
│  │  ├─ auth.validator.ts
│  │  ├─ user.validator.ts
│  │  ├─ agent.validator.ts
│  │  └─ knowledge.validator.ts
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
│  │  ├─ response.ts
│  │  └─ vectorizer.ts
│  │
│  ├─ integrations/               # External API integrations
│  │  ├─ gemini.api.ts
│  │  └─ webhook.api.ts
│  │
│  ├─ types/                      # TypeScript type definitions
│  │  └─ index.ts
│  │
│  └─ scripts/                    # Utility scripts
│     └─ import-knowledge.ts
│
├─ tests/                         # Tests
│  ├─ unit/                       # Unit tests
│  │  ├─ controllers/
│  │  │  ├─ auth.controller.test.ts
│  │  │  ├─ user.controller.test.ts
│  │  │  └─ agent.controller.test.ts
│  │  └─ services/
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
├─ package.json                   # Dependencies
├─ tsconfig.json                  # TypeScript configuration
├─ jest.config.js                 # Jest test configuration
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
PORT=3000
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

Server sẽ chạy tại `http://localhost:3000`

## 📡 API Endpoints

### Authentication

- `POST /api/auth/register` - Đăng ký user mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Quên mật khẩu
- `POST /api/auth/reset-password` - Reset mật khẩu

### Users

- `GET /api/users/profile` - Lấy thông tin profile
- `PUT /api/users/profile` - Cập nhật profile
- `GET /api/users` - Lấy danh sách users
- `GET /api/users/:id` - Lấy thông tin user theo ID
- `DELETE /api/users/:id` - Xóa user

### Agents

- `POST /api/agents` - Tạo AI agent mới
- `GET /api/agents` - Lấy danh sách agents
- `GET /api/agents/:id` - Lấy thông tin agent
- `PUT /api/agents/:id` - Cập nhật agent
- `DELETE /api/agents/:id` - Xóa agent
- `POST /api/agents/:id/chat` - Chat với agent

### Knowledge Base

- `POST /api/knowledge` - Tạo knowledge mới
- `GET /api/knowledge` - Lấy danh sách knowledge
- `GET /api/knowledge/:id` - Lấy knowledge theo ID
- `PUT /api/knowledge/:id` - Cập nhật knowledge
- `DELETE /api/knowledge/:id` - Xóa knowledge
- `POST /api/knowledge/search` - Tìm kiếm knowledge
- `POST /api/knowledge/upload` - Upload knowledge

### Analytics

- `GET /api/analytics/dashboard` - Dashboard analytics
- `GET /api/analytics/agents/:id/stats` - Agent statistics
- `GET /api/analytics/conversations` - Conversation analytics
- `GET /api/analytics/knowledge/usage` - Knowledge usage stats

## 🛠️ Scripts

### Import Knowledge

Import knowledge từ thư mục:

```bash
npm run import:knowledge <directory> <userId>
```

Import knowledge từ JSON file:

```bash
npm run import:knowledge <jsonFile.json> <userId>
```

## 🧪 Testing

Chạy tests:

```bash
npm test
```

Chạy tests với watch mode:

```bash
npm run test:watch
```

## 🔧 Tech Stack

- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL)
- **Vector Database:** Pinecone
- **AI:** Google Gemini
- **Authentication:** Supabase Auth + JWT
- **Logger:** Winston
- **Queue:** Bull (Redis)
- **Validation:** express-validator
- **Testing:** Jest + Supertest
- **Security:** Helmet, CORS, Rate Limiting
- **Environment:** Node.js v18+

## 📝 Notes

- Đảm bảo đã tạo Supabase project và có các credentials cần thiết
- Tạo Pinecone index trước khi chạy ứng dụng
- Lấy API key từ Google AI Studio cho Gemini
- Cần setup các bảng trong Supabase database theo schema của project
- Cài đặt Redis nếu sử dụng Bull queue cho background jobs

## ✨ Features

### Security & Performance

- ✅ Rate limiting để chống spam và DDoS
- ✅ Helmet security headers
- ✅ CORS configuration
- ✅ Input validation với express-validator
- ✅ Request/Response logging với Winston

### Background Jobs

- ✅ Cron jobs cho task định kỳ (email, cleanup, reindex)
- ✅ Queue worker cho async processing
- ✅ Email notifications
- ✅ Pinecone vector database reindexing

### Testing

- ✅ Unit tests cho controllers & services
- ✅ Integration tests cho API endpoints
- ✅ E2E tests cho full flow
- ✅ Test helpers & mocks
- ✅ Jest configuration cho TypeScript

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📄 License

ISC
