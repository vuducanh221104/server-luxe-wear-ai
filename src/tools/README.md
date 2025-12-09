# Function Calling Tools

## Overview

Function Calling Tools enable AI agents to execute actions and retrieve information dynamically during conversations. The AI can intelligently decide when to use tools based on user requests.

## Architecture

```
src/tools/
├── types/                  # TypeScript type definitions
│   ├── function.calling.types.ts
│   ├── shared.types.ts
│   └── index.ts
├── tools/                  # Tool implementations
│   ├── knowledge.tools.ts   # Knowledge base tools
│   └── index.ts
├── registry/               # Tool registry
│   └── tool.registry.ts     # Manages tool registration
├── executor/               # Tool executor
│   └── tool.executor.ts     # Executes tools with permissions
├── services/               # Orchestration services
│   └── function.calling.service.ts
├── config/                 # Configuration
│   └── mcp.config.ts
├── shared/                 # Shared utilities
│   └── utils.ts
└── index.ts                # Main exports
```

## Available Tools

### Knowledge Tools

#### 1. `search_knowledge`

Search the knowledge base using semantic search.

**Parameters:**

- `query` (string, required): Search query
- `limit` (number, optional): Max results (default: 5, max: 10)

**Example:**

```typescript
{
  query: "áo khoác mùa đông",
  limit: 5
}
```

**Response:**

```typescript
{
  success: true,
  data: {
    results: [
      {
        rank: 1,
        content: "...",
        title: "Áo khoác mùa đông 2024",
        score: 0.95,
        source: "knowledge_base"
      }
    ],
    total_results: 5,
    query: "áo khoác mùa đông"
  }
}
```

#### 2. `get_knowledge_by_id`

Get specific knowledge entry by ID.

**Parameters:**

- `knowledge_id` (string, required): UUID of knowledge entry

#### 3. `list_agent_knowledge`

List all knowledge entries for an agent.

**Parameters:**

- `limit` (number, optional): Results per page (default: 10, max: 50)
- `page` (number, optional): Page number (default: 1)

## Usage

### Basic Integration

```typescript
import { defaultAIService } from "./services/ai.service";
import type { ToolExecutionContext } from "./tools";

// Setup execution context
const context: ToolExecutionContext = {
  agentId: "agent-123",
  userId: "user-456",
  tenantId: "tenant-789",
};

// Generate response with tools
const result = await defaultAIService.generateResponseWithTools(
  "Tìm thông tin về áo khoác",
  context,
  "You are a fashion consultant",
  ["search_knowledge"] // Tools to enable
);

console.log(result.response);
console.log(`Tools called: ${result.toolsCalled}`);
console.log(`Execution time: ${result.executionTime}ms`);
```

### Using Function Calling Service Directly

```typescript
import { functionCallingService } from "./tools";

const result = await functionCallingService.chatWithTools(
  "Search for product information",
  context,
  "You are a helpful assistant",
  ["search_knowledge", "list_agent_knowledge"],
  5 // Max iterations
);
```

### API Endpoint Integration

```typescript
// In your route handler
import { defaultAIService } from "../services/ai.service";

router.post("/chat/with-tools", async (req, res) => {
  const { message, agentId, enabledTools } = req.body;
  const userId = req.user.id;
  const tenantId = req.user.tenantId;

  const context = {
    agentId,
    userId,
    tenantId,
  };

  const result = await defaultAIService.generateResponseWithTools(
    message,
    context,
    undefined, // Use default system prompt
    enabledTools
  );

  res.json({
    response: result.response,
    toolsCalled: result.toolsCalled,
    executionTime: result.executionTime,
    toolResults: result.toolResults,
  });
});
```

## Creating Custom Tools

### 1. Define Tool Schema

```typescript
import { z } from "zod";
import { MCPTool, ToolCategory, ToolPermission } from "../types";

const CheckOrderStatusArgsSchema = z.object({
  order_id: z.string().describe("Order ID to check"),
});

export const checkOrderStatusTool: MCPTool = {
  name: "check_order_status",
  description: "Check the status of an order",
  category: ToolCategory.BUSINESS,
  permission: ToolPermission.AUTHENTICATED,
  enabled: true,
  schema: CheckOrderStatusArgsSchema,

  async handler(args, context) {
    const { order_id } = CheckOrderStatusArgsSchema.parse(args);

    // Your logic here
    const order = await getOrderFromDatabase(order_id, context.tenantId);

    return {
      success: true,
      data: {
        order_id,
        status: order.status,
        estimated_delivery: order.delivery_date,
      },
      metadata: {
        executionTime: Date.now() - startTime,
        source: "order_database",
      },
    };
  },
};
```

### 2. Register Tool

Add your tool to `src/tools/tools/index.ts`:

```typescript
import { checkOrderStatusTool } from "./order.tools";

export const allFunctionCallingTools: MCPTool[] = [...knowledgeTools, checkOrderStatusTool];
```

## Tool Categories

- **KNOWLEDGE**: Knowledge base operations
- **BUSINESS**: Business logic (orders, inventory, etc.)
- **ACTIONS**: External actions (emails, webhooks)
- **INTEGRATION**: Third-party integrations

## Permission Levels

- **PUBLIC**: Anyone can use
- **AUTHENTICATED**: Requires user authentication
- **ADMIN**: Admin only
- **CUSTOM**: Custom permission logic

## Best Practices

### 1. Descriptive Names

```typescript
// ✅ Good
name: "search_knowledge";
description: "Search the knowledge base using semantic search";

// ❌ Bad
name: "search";
description: "Search";
```

### 2. Error Handling

```typescript
// ✅ Good
return {
  success: false,
  error: "Knowledge base not initialized",
  metadata: { executionTime },
};

// ❌ Bad
throw new Error("Not found");
```

### 3. Logging

```typescript
logger.info("Tool executed", {
  toolName: "search_knowledge",
  agentId: context.agentId,
  executionTime: 150,
  success: true,
});
```

### 4. Permission Checks

Always check permissions before executing sensitive operations.

## Testing

### Unit Tests

```bash
npm test -- tests/unit/tools/
```

### Integration Tests

```bash
npm test -- tests/integration/tools/
```

### Example Test

```typescript
describe("search_knowledge tool", () => {
  it("should return relevant results", async () => {
    const result = await searchKnowledgeTool.handler({ query: "test", limit: 5 }, testContext);

    expect(result.success).toBe(true);
    expect(result.data.results).toHaveLength(5);
  });
});
```

## Configuration

Configure function calling in `src/tools/config/mcp.config.ts`:

```typescript
export const MCPConfig = {
  functionCalling: {
    maxIterations: 5,
    defaultTemperature: 0.7,
    fallbackEnabled: true,
  },
};
```

## Monitoring

Monitor tool usage through logs:

```typescript
logger.info("Tool execution completed", {
  toolName: "search_knowledge",
  success: true,
  executionTime: 150,
  agentId: "agent-123",
});
```

## Troubleshooting

### Tool Not Found

- Ensure tool is registered in `allFunctionCallingTools`
- Check tool name matches exactly

### Permission Denied

- Verify user context has required permissions
- Check tool permission level

### Execution Timeout

- Increase timeout in `mcp.config.ts`
- Optimize tool handler logic

## Examples

See `tests/integration/tools/` for real-world usage examples.

## Contributing

When adding new tools:

1. Create tool implementation in `src/tools/tools/`
2. Define Zod schema for arguments
3. Implement handler function
4. Register in `allFunctionCallingTools`
5. Write unit and integration tests
6. Update this README

---

**Built with ❤️ for Luxe Wear AI Platform**
