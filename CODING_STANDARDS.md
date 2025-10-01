# Coding Standards Quick Reference

> 📖 **Full Documentation**: See [.cursor/rules/coding-standards.mdc](.cursor/rules/coding-standards.mdc)

## 🎯 Quick Rules

### TypeScript
```typescript
// ✅ DO
interface User {
  id: string;
  email: string;
}

const getUser = async (id: string): Promise<User | null> => {
  // implementation
};

// ❌ DON'T
const getUser = async (id: any) => {
  // avoid any
};
```

### Naming Conventions
```typescript
// Variables & Functions: camelCase
const userName = "John";
const getUserById = async () => {};

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const API_BASE_URL = "https://api.example.com";

// Interfaces & Types: PascalCase
interface User {}
type UserRole = "admin" | "user";

// Files: kebab-case
user.service.ts
auth.controller.ts
```

### File Structure
```
src/
  config/
    database.ts
  controllers/
    user.controller.ts
  services/
    user.service.ts
  utils/
    response.ts
```

### Import Order
```typescript
// 1. Node built-ins
import path from "path";

// 2. External dependencies
import express from "express";

// 3. Internal - config
import { supabaseAdmin } from "@/config/supabase";

// 4. Internal - services
import userService from "@/services/user.service";

// 5. Internal - utils
import { successResponse } from "@/utils/response";

// 6. Types
import type { User } from "@/types";
```

### Error Handling
```typescript
// ✅ DO: Specific error handling
try {
  const result = await operation();
  return result;
} catch (error) {
  if (error instanceof ValidationError) {
    return errorResponse(res, error.message, 400);
  }
  logger.error("Operation failed", error);
  throw error;
}

// ❌ DON'T: Swallow errors
catch (error) {
  // Silent error = bug!
}
```

### Git Commits
```bash
# Format: <type>(<scope>): <subject>

feat(auth): add password reset functionality
fix(agent): resolve null pointer in chat endpoint
docs(api): update authentication documentation
refactor(services): extract common database logic
```

## 🛠️ Tools Setup

### Install Dependencies
```bash
npm install
```

### Run Linting
```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
```

### Run Formatting
```bash
npm run format        # Format all files
npm run format:check  # Check formatting
```

### Type Checking
```bash
npm run type-check    # TypeScript type check
```

### Pre-commit Checklist
```bash
npm run format        # Format code
npm run lint:fix      # Fix linting issues
npm run type-check    # Check types
npm run build         # Ensure it compiles
npm test              # Run tests
```

## 📝 Code Review Checklist

### Before Submitting PR
- [ ] Code follows naming conventions
- [ ] All tests pass (`npm test`)
- [ ] No TypeScript errors (`npm run build`)
- [ ] No linter errors (`npm run lint`)
- [ ] Code formatted (`npm run format`)
- [ ] Complex logic is commented
- [ ] Error handling is comprehensive

### For Reviewers
- [ ] Code is readable and maintainable
- [ ] Logic is sound and efficient
- [ ] Edge cases are handled
- [ ] Tests are comprehensive
- [ ] No security vulnerabilities
- [ ] Performance implications understood

## 🎨 VSCode Setup

### Recommended Extensions
Install these extensions for the best development experience:
- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier** (`esbenp.prettier-vscode`)
- **TypeScript** (`ms-vscode.vscode-typescript-next`)
- **Jest** (`orta.vscode-jest`)
- **Error Lens** (`usernamehw.errorlens`)

VSCode will prompt you to install these when you open the project.

### Auto-format on Save
The project is configured to auto-format code on save using Prettier.

## 🚀 Quick Commands

```bash
# Development
npm run dev           # Start dev server
npm run build         # Build for production
npm start             # Run production build

# Code Quality
npm run lint          # Check linting
npm run lint:fix      # Fix linting issues
npm run format        # Format code
npm run type-check    # Check types

# Testing
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## 📚 Related Documentation

- [Full Coding Standards](.cursor/rules/coding-standards.mdc)
- [Backend Development Guidelines](.cursor/rules/backend-development.mdc)
- [AI Integration Guidelines](.cursor/rules/ai-integration.mdc)
- [Technical Design Document Template](.cursor/rules/technical-design-document.mdc)
- [Project Structure](STRUCTURE.md)
- [README](README.md)

---

**Remember**: Consistent code is easier to read, maintain, and debug! 🎯

