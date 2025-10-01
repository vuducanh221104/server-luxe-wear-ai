# Cursor Rules

Thư mục này chứa các Cursor Rules giúp AI assistant hiểu và làm việc tốt hơn với codebase.

## 📋 Available Rules

### 1. **technical-design-document.mdc**

**Purpose**: Template và hướng dẫn viết Technical Design Document (TDD)

**When to use**:

- Khi thiết kế feature mới
- Khi thay đổi lớn về system architecture
- Khi cần document technical decisions

**How to invoke**:

```
"Help me write a TDD for [feature name]"
"Create a technical design document for [system]"
```

### 2. **backend-development.mdc**

**Purpose**: Guidelines cho backend development với TypeScript, Express, Supabase

**Auto-applies to**:

- Tất cả files `.ts` trong `src/`

**Covers**:

- TypeScript best practices
- API design patterns
- Security guidelines
- Database patterns
- Error handling
- Logging & testing

### 3. **ai-integration.mdc**

**Purpose**: Guidelines cho AI & vector search integration

**Auto-applies to**:

- `src/services/ai.service.ts`
- `src/services/knowledge.service.ts`
- `src/integrations/gemini.api.ts`
- `src/config/ai.ts`
- `src/config/pinecone.ts`

**Covers**:

- Google Gemini AI best practices
- Pinecone vector database patterns
- RAG (Retrieval Augmented Generation)
- Performance optimization
- Cost optimization

### 4. **coding-standards.mdc** ⭐ NEW

**Purpose**: Coding standards và conventions cho toàn bộ project

**Auto-applies to**:

- `src/**/*.ts`
- `tests/**/*.ts`

**Covers**:

- TypeScript standards & type safety
- Code formatting (Prettier style)
- Naming conventions (files, variables, functions, classes)
- File organization & import order
- Comments & documentation (JSDoc)
- Error handling patterns
- Testing standards
- Git commit messages & PR guidelines
- Code review checklist

## 🚀 How to Use

### Automatic Application

Rules with `globs` or `alwaysApply: true` sẽ tự động được apply khi bạn làm việc với files phù hợp.

### Manual Invocation

Rules với `description` có thể được gọi bằng cách:

1. Nhắc Cursor về rule: "Use the technical design document template"
2. Hoặc reference trực tiếp trong prompt

## 📝 Creating New Rules

Để tạo rule mới:

1. Tạo file `.mdc` trong `.cursor/rules/`
2. Thêm metadata vào frontmatter:

```markdown
---
alwaysApply: false          # Apply to mọi request?
description: "Description"  # Mô tả để AI fetch rule
globs: *.ts,*.tsx          # Pattern cho files
---

# Rule Content

Your guidelines here...
```

3. Sử dụng format `[filename](mdc:path/to/file)` để reference files

## 💡 Best Practices

### ✅ DO

- Tạo rules specific cho từng domain (API, database, AI, etc.)
- Sử dụng code examples trong rules
- Reference các files trong project
- Keep rules updated khi code changes

### ❌ DON'T

- Tạo rules quá generic hoặc quá dài
- Set `alwaysApply: true` cho mọi rules (làm chậm AI)
- Duplicate information giữa các rules
- Hardcode values có thể thay đổi

## 📚 Rule Hierarchy

```
Always Applied
    ↓
File-specific (globs)
    ↓
Manually Invoked (description)
```

## 🔄 Updating Rules

Khi update project structure hoặc conventions:

1. Update relevant rules
2. Update references đến files đã đổi tên
3. Test bằng cách hỏi Cursor về conventions

## 🎯 Examples

### Example 1: Get help with API design

```
"I want to create a new endpoint for user preferences.
Follow the backend development guidelines."
```

### Example 2: Write TDD

```
"Use the technical design document template to help me
design a notification system."
```

### Example 3: AI integration help

```
"I'm implementing RAG search. Show me the best practices
from the AI integration guide."
```

## 📖 References

- [Cursor Rules Documentation](https://docs.cursor.com/context/rules)
- Project: [README.md](mdc:README.md)
- Architecture: [STRUCTURE.md](mdc:STRUCTURE.md)
