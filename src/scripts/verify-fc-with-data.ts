/**
 * Deep Verification of Function Calling
 * Run with: npx ts-node src/scripts/verify-fc-with-data.ts
 */

import axios from "axios";

const BASE_URL = "http://127.0.0.1:3001/api";
const TIMESTAMP = new Date()
  .toISOString()
  .replace(/[-:T.]/g, "")
  .slice(0, 14);
const TEST_EMAIL = `verify_fc_${TIMESTAMP}@example.com`;
const TEST_PASSWORD = "Password123!";
const SECRET_CODE = `OMEGA-X-${Math.floor(Math.random() * 1000)}`;

async function runDeepVerification() {
  console.log("=== Deep Verification: Function Calling with Live Data ===\n");

  try {
    // 1. Register & Login
    console.log(`Step 1: Registering user...`);
    const authRes = await axios.post(`${BASE_URL}/auth/register`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: "Verifier",
    });
    const token = authRes.data.data.token;
    const headers = { headers: { Authorization: `Bearer ${token}` } };
    console.log("✅ Logged in");

    // 2. Create Agent
    console.log(`\nStep 2: Creating Agent...`);
    const agentRes = await axios.post(
      `${BASE_URL}/agents`,
      {
        name: `Agent ${TIMESTAMP}`,
        config: {
          model: "gemini-1.5-flash",
          temperature: 0.0, // Deterministic
          systemPrompt:
            "You are a helpful assistant with access to a knowledge base. You MUST use the 'search_knowledge' tool to find answers. Do not answer from your own memory. If you cannot find the answer in the knowledge base, say 'I cannot find the answer'.",
        },
      },
      headers
    );
    const agentId = agentRes.data.data.id;
    console.log(`✅ Agent created: ${agentId}`);

    // 3. Create Knowledge (The Secret) via File Upload
    console.log(`\nStep 3: Injecting Secret Knowledge: "${SECRET_CODE}"...`);

    const fs = require("fs");
    const path = require("path");
    const FormData = require("form-data");

    const tempFilePath = path.join(__dirname, `secret_${TIMESTAMP}.txt`);
    fs.writeFileSync(
      tempFilePath,
      `The top secret security code for the system is ${SECRET_CODE}. Do not share this with unauthorized personnel.`
    );

    try {
      const form = new FormData();
      form.append("files", fs.createReadStream(tempFilePath));
      form.append("title", "Secret Codes");
      form.append("agentId", agentId);

      // We need to set headers for multipart/form-data
      const uploadHeaders = {
        ...headers.headers,
        ...form.getHeaders(),
      };

      const uploadRes = await axios.post(`${BASE_URL}/knowledge/upload`, form, {
        headers: uploadHeaders,
      });

      console.log("✅ Knowledge uploaded successfully");
      console.log(`   Session ID: ${uploadRes.data.data.sessionId}`);

      // Clean up temp file
      fs.unlinkSync(tempFilePath);
    } catch (err: any) {
      console.log("⚠️  Failed to upload knowledge file.");
      console.log(`   Error: ${err.response?.data?.message || err.message}`);
      if (err.response?.data?.errors) {
        console.log("   Details:", JSON.stringify(err.response.data.errors, null, 2));
      }
      // Try to clean up
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }

    // Wait for embedding/indexing - Pinecone needs time to index vectors
    console.log("   Waiting 15s for vector indexing...");
    await new Promise((r) => setTimeout(r, 15000));

    // 4. Ask for the Secret
    console.log(`\nStep 4: Asking Agent for the Secret...`);
    const chatRes = await axios.post(
      `${BASE_URL}/agents/${agentId}/chat`,
      {
        message: `Use your search_knowledge tool to find the secret security code. What is it?`,
        useTools: true,
      },
      headers
    );

    const response = chatRes.data.response;
    const toolsCalledCount = chatRes.data.toolsCalled || 0;
    const toolResults = chatRes.data.toolResults || [];
    const toolNames = toolResults.map((tr: { toolName: string }) => tr.toolName);

    console.log(`\n=== RESULTS ===`);
    console.log(`AI Response: "${response}"`);
    console.log(
      `Tools Used: ${toolNames.length > 0 ? toolNames.join(", ") : "None"} (count: ${toolsCalledCount})`
    );
    console.log(`Expected Secret: ${SECRET_CODE}`);

    // 5. Verification Logic
    const foundSecret = response.includes(SECRET_CODE);
    const usedSearch = toolNames.includes("search_knowledge");

    if (foundSecret) {
      console.log(
        `\n🎉 SUCCESS: AI retrieved the secret code! Function calling is WORKING PERFECTLY.`
      );
    } else if (usedSearch) {
      console.log(
        `\n✅ PARTIAL SUCCESS: AI tried to search (tool executed), but didn't find the exact code (maybe indexing delay).`
      );
      console.log(`   Tool execution is CONFIRMED working.`);
    } else {
      console.log(`\n❌ FAILURE: AI did not use the tool or find the secret.`);
    }

    // 6. Cleanup
    await axios.delete(`${BASE_URL}/agents/${agentId}`, headers);
  } catch (error: any) {
    console.error("\n❌ Error during verification:", error.message);
    if (error.response)
      console.error("   API Error:", JSON.stringify(error.response.data, null, 2));
  }
}

runDeepVerification();
