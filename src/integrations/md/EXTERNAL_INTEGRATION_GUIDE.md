# 🌐 External Website Integration Guide

Hướng dẫn tích hợp AI Agent vào website bên ngoài sử dụng API key authentication.

---

## 📋 Tổng quan

Sau khi triển khai, người dùng có thể:

1. ✅ **Tạo AI Agent** với API key tự động
2. ✅ **Bật chế độ Public** cho agent
3. ✅ **Sử dụng từ website khác** với API key
4. ✅ **Kiểm soát CORS** qua allowed origins
5. ✅ **Chat trực tiếp** từ external domain

---

## 🔑 API Key Authentication Flow

### **1. Tạo Agent với API Key**

```http
POST /api/agents
Authorization: Bearer <user_jwt_token>
Content-Type: application/json

{
  "name": "Fashion Assistant",
  "description": "AI assistant for fashion recommendations",
  "isPublic": false,
  "allowedOrigins": ["https://mystore.com", "https://www.mystore.com"],
  "config": {
    "model": "gpt-4",
    "temperature": 0.7,
    "systemPrompt": "You are a helpful fashion assistant."
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "agent-uuid",
    "name": "Fashion Assistant",
    "apiKey": "ak_1234567890abcdef1234567890abcdef",
    "isPublic": false,
    "allowedOrigins": ["https://mystore.com"]
  }
}
```

### **2. Bật chế độ Public**

```http
PATCH /api/agents/{agentId}/public
Authorization: Bearer <user_jwt_token>
Content-Type: application/json

{
  "isPublic": true,
  "allowedOrigins": ["https://mystore.com", "*.mystore.com"]
}
```

### **3. Sử dụng từ Website Khác**

```javascript
// Từ https://mystore.com
const chatWithAgent = async (message) => {
  const response = await fetch("https://your-api.com/api/public/agents/agent-uuid/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "ak_1234567890abcdef1234567890abcdef",
    },
    body: JSON.stringify({
      message: "What should I wear today?",
      context: "User is looking for casual outfit",
    }),
  });

  const result = await response.json();
  return result.data.response;
};
```

---

## 🔌 Public API Endpoints

### **Chat với Agent**

```http
POST /api/public/agents/:agentId/chat
X-API-Key: ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "message": "Hello, I need fashion advice",
  "context": "Optional context for better responses"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "response": "I'd be happy to help with fashion advice! What's the occasion?",
    "agent": {
      "id": "agent-uuid",
      "name": "Fashion Assistant",
      "description": "AI assistant for fashion recommendations"
    },
    "timestamp": "2025-01-01T12:00:00Z"
  }
}
```

### **Lấy thông tin Agent**

```http
GET /api/public/agents/:agentId
X-API-Key: ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "agent-uuid",
    "name": "Fashion Assistant",
    "description": "AI assistant for fashion recommendations",
    "config": {
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 1000
    }
  }
}
```

---

## 🛡️ Security & CORS

### **API Key Format**

- Format: `ak_` + 32 hex characters
- Example: `ak_1234567890abcdef1234567890abcdef`
- Unique per agent
- Can be regenerated

### **Allowed Origins**

```javascript
// Exact match
"https://mystore.com";

// Wildcard subdomain
"*.mystore.com";

// Allow all (not recommended for production)
"*";
```

### **Rate Limiting**

- **Public endpoints**: 100 requests per 15 minutes per IP
- **Chat endpoints**: 10 requests per minute per API key

---

## 💻 Frontend Integration Examples

### **React/Next.js**

```jsx
import { useState } from "react";

const ChatWidget = ({ agentId, apiKey }) => {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChat = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/agents/${agentId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      setResponse(data.data.response);
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-widget">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask me anything..."
      />
      <button onClick={handleChat} disabled={loading}>
        {loading ? "Thinking..." : "Send"}
      </button>
      {response && <div className="response">{response}</div>}
    </div>
  );
};

export default ChatWidget;
```

### **Vanilla JavaScript**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>AI Chat Widget</title>
  </head>
  <body>
    <div id="chat-widget">
      <input type="text" id="message-input" placeholder="Ask me anything..." />
      <button onclick="sendMessage()">Send</button>
      <div id="response"></div>
    </div>

    <script>
      const AGENT_ID = "your-agent-id";
      const API_KEY = "ak_your_api_key_here";
      const API_BASE = "https://your-api.com";

      async function sendMessage() {
        const input = document.getElementById("message-input");
        const responseDiv = document.getElementById("response");

        if (!input.value.trim()) return;

        try {
          const response = await fetch(`${API_BASE}/api/public/agents/${AGENT_ID}/chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": API_KEY,
            },
            body: JSON.stringify({
              message: input.value,
            }),
          });

          const data = await response.json();

          if (data.success) {
            responseDiv.innerHTML = `<p><strong>AI:</strong> ${data.data.response}</p>`;
          } else {
            responseDiv.innerHTML = `<p style="color: red;">Error: ${data.message}</p>`;
          }

          input.value = "";
        } catch (error) {
          responseDiv.innerHTML = `<p style="color: red;">Network error: ${error.message}</p>`;
        }
      }

      // Allow Enter key to send message
      document.getElementById("message-input").addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          sendMessage();
        }
      });
    </script>
  </body>
</html>
```

### **WordPress Plugin**

```php
<?php
// wp-content/plugins/ai-chat-widget/ai-chat-widget.php

function ai_chat_widget_shortcode($atts) {
    $atts = shortcode_atts([
        'agent_id' => '',
        'api_key' => '',
        'placeholder' => 'Ask me anything...'
    ], $atts);

    if (empty($atts['agent_id']) || empty($atts['api_key'])) {
        return '<p>Error: Agent ID and API Key are required.</p>';
    }

    ob_start();
    ?>
    <div class="ai-chat-widget" data-agent-id="<?php echo esc_attr($atts['agent_id']); ?>" data-api-key="<?php echo esc_attr($atts['api_key']); ?>">
        <input type="text" placeholder="<?php echo esc_attr($atts['placeholder']); ?>" class="ai-chat-input">
        <button class="ai-chat-send">Send</button>
        <div class="ai-chat-response"></div>
    </div>

    <script>
    document.addEventListener('DOMContentLoaded', function() {
        const widget = document.querySelector('.ai-chat-widget');
        const input = widget.querySelector('.ai-chat-input');
        const button = widget.querySelector('.ai-chat-send');
        const response = widget.querySelector('.ai-chat-response');

        const agentId = widget.dataset.agentId;
        const apiKey = widget.dataset.apiKey;

        button.addEventListener('click', async function() {
            const message = input.value.trim();
            if (!message) return;

            button.textContent = 'Thinking...';
            button.disabled = true;

            try {
                const res = await fetch(`https://your-api.com/api/public/agents/${agentId}/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': apiKey
                    },
                    body: JSON.stringify({ message })
                });

                const data = await res.json();

                if (data.success) {
                    response.innerHTML = `<p><strong>AI:</strong> ${data.data.response}</p>`;
                } else {
                    response.innerHTML = `<p style="color: red;">Error: ${data.message}</p>`;
                }

                input.value = '';
            } catch (error) {
                response.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
            } finally {
                button.textContent = 'Send';
                button.disabled = false;
            }
        });
    });
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('ai_chat', 'ai_chat_widget_shortcode');

// Usage: [ai_chat agent_id="your-agent-id" api_key="ak_your_api_key"]
?>
```

---

## 🔧 Management Endpoints (Private)

### **Regenerate API Key**

```http
POST /api/agents/:agentId/regenerate-key
Authorization: Bearer <user_jwt_token>
```

### **Toggle Public Status**

```http
PATCH /api/agents/:agentId/public
Authorization: Bearer <user_jwt_token>
Content-Type: application/json

{
  "isPublic": true,
  "allowedOrigins": ["https://newdomain.com"]
}
```

---

## 🚨 Error Handling

### **Common Errors**

```json
// Invalid API Key
{
  "success": false,
  "message": "Invalid API key or agent not found"
}

// Origin not allowed
{
  "success": false,
  "message": "Origin not allowed for this agent"
}

// Rate limit exceeded
{
  "success": false,
  "message": "Too many requests. Please try again later."
}

// Agent not public
{
  "success": false,
  "message": "Agent not found or not accessible"
}
```

### **Error Handling in Frontend**

```javascript
const handleApiError = (error, data) => {
  if (error.status === 401) {
    console.error("Invalid API key");
    return "Authentication failed. Please check your API key.";
  }

  if (error.status === 403) {
    console.error("Origin not allowed");
    return "Access denied from this domain.";
  }

  if (error.status === 429) {
    console.error("Rate limit exceeded");
    return "Too many requests. Please wait a moment.";
  }

  return data?.message || "An unexpected error occurred.";
};
```

---

## 🎯 Best Practices

### **Security**

1. ✅ **Store API keys securely** - Use environment variables
2. ✅ **Restrict origins** - Don't use wildcard (\*) in production
3. ✅ **Rotate keys regularly** - Regenerate API keys periodically
4. ✅ **Monitor usage** - Check analytics for unusual activity

### **Performance**

1. ✅ **Cache responses** - Cache non-sensitive responses client-side
2. ✅ **Debounce requests** - Avoid rapid-fire API calls
3. ✅ **Handle timeouts** - Set reasonable timeout values
4. ✅ **Optimize messages** - Keep messages concise for faster responses

### **User Experience**

1. ✅ **Loading states** - Show loading indicators during API calls
2. ✅ **Error messages** - Provide helpful error messages
3. ✅ **Fallback content** - Have fallback when API is unavailable
4. ✅ **Progressive enhancement** - Ensure basic functionality without JS

---

## 📊 Analytics & Monitoring

All public agent interactions are logged in the analytics table:

```sql
SELECT
  agent_id,
  COUNT(*) as total_requests,
  AVG(LENGTH(response)) as avg_response_length,
  DATE(created_at) as date
FROM analytics
WHERE agent_id = 'your-agent-id'
GROUP BY agent_id, DATE(created_at)
ORDER BY date DESC;
```

---

## 🚀 Next Steps

1. **Test Integration** - Use the provided examples to test your integration
2. **Monitor Usage** - Check analytics dashboard for usage patterns
3. **Optimize Performance** - Implement caching and error handling
4. **Scale Up** - Consider rate limiting and load balancing for high traffic

---

## 🆘 Troubleshooting

### **CORS Issues**

- Ensure your domain is in `allowedOrigins`
- Check browser console for CORS errors
- Verify API key is correct

### **Authentication Failures**

- Confirm API key format: `ak_` + 32 hex chars
- Ensure agent is set to public
- Check API key hasn't been regenerated

### **Rate Limiting**

- Implement exponential backoff
- Cache responses when possible
- Consider upgrading plan for higher limits

---

**🎉 Congratulations! Your AI agent is now ready for external website integration!**
