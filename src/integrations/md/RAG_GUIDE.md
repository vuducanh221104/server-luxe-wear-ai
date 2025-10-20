# RAG (Retrieval Augmented Generation) Guide

Hướng dẫn sử dụng Pinecone + Google Gemini AI để tạo chatbot thông minh với knowledge base.

## 📋 Tổng quan

**RAG** là pattern kết hợp:

- **Retrieval**: Tìm kiếm thông tin từ Pinecone vector database
- **Augmented**: Bổ sung context vào prompt
- **Generation**: Gemini AI generate response dựa trên context

## 🔄 Workflow

```
User Question
     ↓
1. Convert to Vector (Gemini Embedding)
     ↓
2. Search Pinecone (Vector Similarity)
     ↓
3. Get Relevant Knowledge
     ↓
4. Build Context
     ↓
5. Gemini Generate Response (with Context)
     ↓
AI Response
```

## 📁 Files Structure

```
src/
├── config/
│   ├── ai.ts              # Gemini AI configuration
│   └── pinecone.ts        # Pinecone configuration
├── utils/
│   └── vectorizer.ts      # RAG implementation
└── examples/
    └── rag-example.ts     # Usage examples
```

## 🚀 Quick Start

### 1. **Store Knowledge** (Lưu thông tin vào Pinecone)

```typescript
import { storeKnowledge } from "./services/vectorizer.service";

await storeKnowledge("unique-id-1", "Oversized blazers are trending in 2024.", {
  userId: "user-123",
  category: "fashion-trends",
});
```

### 2. **Search Knowledge** (Tìm kiếm thông tin)

```typescript
import { searchKnowledge } from "./services/vectorizer.service";

const results = await searchKnowledge(
  "What is trending in fashion?",
  "user-123",
  5 // top 5 results
);
```

### 3. **Chat with RAG** (Chat với AI + Knowledge)

```typescript
import { chatWithRAG } from "./services/vectorizer.service";

const response = await chatWithRAG(
  "What should I wear today?",
  "user-123",
  "You are a fashion expert."
);

console.log(response);
```

## 🛠️ Available Functions

### **AI Functions** (`src/config/ai.ts`)

| Function                                     | Description            | Usage              |
| -------------------------------------------- | ---------------------- | ------------------ |
| `generateEmbedding(text)`                    | Convert text to vector | Vectorization      |
| `generateResponse(message, context, prompt)` | Generate AI response   | Text generation    |
| `countTokens(text)`                          | Count tokens           | Context management |
| `generateStreamingResponse()`                | Stream response        | Real-time chat     |

### **RAG Functions** (`src/utils/vectorizer.ts`)

| Function                                | Description        | Usage              |
| --------------------------------------- | ------------------ | ------------------ |
| `searchKnowledge(query, userId, topK)`  | Search Pinecone    | Find relevant info |
| `chatWithRAG(message, userId, prompt)`  | Complete RAG flow  | AI chat            |
| `storeKnowledge(id, content, metadata)` | Store single entry | Add knowledge      |
| `batchStoreKnowledge(entries)`          | Store multiple     | Bulk import        |
| `deleteKnowledge(id)`                   | Delete entry       | Remove knowledge   |
| `chunkText(text, maxLength)`            | Split large text   | Text preprocessing |

## 💡 Usage Examples

### Example 1: Simple Chat

```typescript
import { chatWithRAG } from "./services/vectorizer.service";

const response = await chatWithRAG("Recommend a summer outfit", "user-123");

console.log(response);
```

### Example 2: Store & Search

```typescript
import { storeKnowledge, searchKnowledge } from "./services/vectorizer.service";

// Store knowledge
await storeKnowledge("fashion-tip-1", "Linen is perfect for summer because it's breathable.", {
  season: "summer",
  userId: "user-123",
});

// Search
const results = await searchKnowledge("What fabric for summer?", "user-123");

results.forEach((r) => {
  console.log(`Score: ${r.score} - ${r.metadata.content}`);
});
```

### Example 3: Batch Import

```typescript
import { batchStoreKnowledge } from "./services/vectorizer.service";

const fashionTips = [
  {
    id: "tip-1",
    content: "White sneakers go with everything.",
    metadata: { category: "shoes" },
  },
  {
    id: "tip-2",
    content: "Denim jackets are timeless.",
    metadata: { category: "outerwear" },
  },
];

await batchStoreKnowledge(fashionTips);
```

### Example 4: Custom System Prompt

```typescript
import { chatWithRAG } from "./services/vectorizer.service";

const response = await chatWithRAG(
  "What to wear for a job interview?",
  "user-123",
  `You are a professional stylist specializing in business attire.
   Provide formal and professional outfit recommendations.
   Always consider the company culture.`
);
```

## 🎯 Best Practices

### 1. **Chunk Large Texts**

```typescript
import { chunkText, batchStoreKnowledge } from "./services/vectorizer.service";

const longArticle = "...very long fashion article...";
const chunks = chunkText(longArticle, 1000);

const entries = chunks.map((chunk, i) => ({
  id: `article-chunk-${i}`,
  content: chunk,
  metadata: { source: "fashion-magazine" },
}));

await batchStoreKnowledge(entries);
```

### 2. **Filter by User**

```typescript
// Store with userId
await storeKnowledge("id-1", "content", {
  userId: "user-123",
});

// Search only user's knowledge
const results = await searchKnowledge(
  "query",
  "user-123" // Filter by this user
);
```

### 3. **Check Similarity Score**

```typescript
const results = await searchKnowledge("query", userId);

// Only use high-quality matches
const relevant = results.filter((r) => r.score > 0.7);

if (relevant.length === 0) {
  console.log("No relevant knowledge found");
}
```

### 4. **Handle Context Size**

```typescript
import { buildContext } from "./services/vectorizer.service";

const results = await searchKnowledge("query", userId, 10);

// Build context with token limit
const context = await buildContext(
  results,
  30000 // Max 30k tokens
);
```

## 🔧 Controller Integration

Sử dụng trong controller:

```typescript
// src/controllers/agent.controller.ts
import { Request, Response } from "express";
import { chatWithRAG } from "../services/vectorizer.service";

export const chat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message } = req.body;
    const userId = req.user?.id;

    const response = await chatWithRAG(message, userId, "You are a helpful fashion assistant.");

    res.status(200).json({
      success: true,
      data: { message: response },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Chat failed",
    });
  }
};
```

## 📊 Performance Tips

1. **Batch Operations**: Use `batchStoreKnowledge()` for multiple entries
2. **Cache Embeddings**: Reuse vectors when possible
3. **Limit topK**: Don't fetch too many results (5-10 is usually enough)
4. **Filter Early**: Use userId filter to reduce search space
5. **Monitor Tokens**: Use `countTokens()` to manage context size

## 🐛 Troubleshooting

### "No results found"

- Check if knowledge is stored: `await searchKnowledge("*", userId)`
- Lower similarity threshold (< 0.7)
- Check userId filter

### "Context too large"

- Reduce `topK` parameter
- Use `buildContext()` with smaller `maxTokens`
- Chunk large texts before storing

### "Embedding failed"

- Check `GEMINI_API_KEY` in `.env`
- Verify API quota
- Check text length (max ~10k characters)

## 📖 API Reference

See full documentation:

- **AI Config**: [src/config/ai.ts](src/config/ai.ts)
- **Vectorizer**: [src/utils/vectorizer.ts](src/utils/vectorizer.ts)
- **Examples**: [src/examples/rag-example.ts](src/examples/rag-example.ts)

## 🎓 Learn More

- [Google Gemini AI Docs](https://ai.google.dev/docs)
- [Pinecone Docs](https://docs.pinecone.io/)
- [RAG Pattern Explained](https://www.pinecone.io/learn/retrieval-augmented-generation/)
