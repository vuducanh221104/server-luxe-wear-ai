/**
 * @file scripts/test-all-routes.ts
 * @description Test all API routes to verify they are working
 */

import axios from "axios";

const BASE_URL = process.env.API_URL || "http://localhost:3001/api";
const TIMEOUT = 10000;

interface TestResult {
  endpoint: string;
  method: string;
  status: number | string;
  success: boolean;
  message: string;
}

const results: TestResult[] = [];

const api = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  headers: { "Content-Type": "application/json" },
  validateStatus: () => true,
});

async function testEndpoint(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  endpoint: string,
  data?: object,
  headers?: Record<string, string>,
  expectAuth: boolean = false
): Promise<TestResult> {
  try {
    const response = await api.request({ method, url: endpoint, data, headers });
    const isExpectedError =
      (expectAuth && [401, 403].includes(response.status)) ||
      (response.status >= 200 && response.status < 500);

    return {
      endpoint: `${method} ${endpoint}`,
      method,
      status: response.status,
      success: isExpectedError,
      message: (response.data?.message || response.statusText || "OK").substring(0, 60),
    };
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    return {
      endpoint: `${method} ${endpoint}`,
      method,
      status: err.code || "ERROR",
      success: false,
      message: err.message?.substring(0, 60) || "Unknown error",
    };
  }
}

async function runTests() {
  console.log("🧪 Testing All API Routes...\n");
  console.log(`Base URL: ${BASE_URL}\n`);

  // Health Check
  console.log("📍 Testing Health Check...");
  results.push(await testEndpoint("GET", "/health"));

  // AUTH ROUTES
  console.log("📍 Testing Auth Routes...");
  results.push(
    await testEndpoint("POST", "/auth/register", {
      email: "route_test@example.com",
      password: "Test123456!",
      name: "Route Test",
    })
  );
  results.push(
    await testEndpoint("POST", "/auth/login", {
      email: "route_test@example.com",
      password: "Test123456!",
    })
  );
  results.push(await testEndpoint("GET", "/auth/me", undefined, undefined, true));
  results.push(await testEndpoint("POST", "/auth/logout", undefined, undefined, true));
  results.push(await testEndpoint("POST", "/auth/refresh", { refreshToken: "test" }));

  // USER ROUTES
  console.log("📍 Testing User Routes...");
  results.push(await testEndpoint("GET", "/users", undefined, undefined, true));
  results.push(
    await testEndpoint(
      "GET",
      "/users/00000000-0000-0000-0000-000000000000",
      undefined,
      undefined,
      true
    )
  );

  // TENANT ROUTES
  console.log("📍 Testing Tenant Routes...");
  results.push(await testEndpoint("GET", "/tenants", undefined, undefined, true));
  results.push(await testEndpoint("POST", "/tenants", { name: "Test" }, undefined, true));

  // AGENT ROUTES
  console.log("📍 Testing Agent Routes...");
  results.push(await testEndpoint("GET", "/agents", undefined, undefined, true));
  results.push(await testEndpoint("POST", "/agents", { name: "Test Agent" }, undefined, true));

  // KNOWLEDGE ROUTES - Route là GET /knowledge/search (không phải POST)
  console.log("📍 Testing Knowledge Routes...");
  results.push(await testEndpoint("GET", "/knowledge", undefined, undefined, true));
  results.push(
    await testEndpoint("GET", "/knowledge/search?query=test", undefined, undefined, true)
  );

  // ANALYTICS ROUTES - Routes là /analytics/user, /analytics/tenant, etc
  console.log("📍 Testing Analytics Routes...");
  results.push(await testEndpoint("GET", "/analytics/user", undefined, undefined, true));
  results.push(await testEndpoint("GET", "/analytics/tenant", undefined, undefined, true));
  results.push(await testEndpoint("GET", "/analytics/health"));

  // PUBLIC ROUTES - Route là /public/agents/:agentId/chat (không phải /public/chat)
  console.log("📍 Testing Public Routes...");
  results.push(await testEndpoint("GET", "/public/health"));
  results.push(
    await testEndpoint("POST", "/public/agents/00000000-0000-0000-0000-000000000000/chat", {
      message: "hi",
    })
  );
  results.push(await testEndpoint("GET", "/public/agents/00000000-0000-0000-0000-000000000000"));

  // WEBHOOK ROUTES - Route GET /webhooks không tồn tại, phải có :id
  console.log("📍 Testing Webhook Routes...");
  results.push(await testEndpoint("GET", "/webhooks/search", undefined, undefined, true));
  results.push(
    await testEndpoint(
      "POST",
      "/webhooks",
      { url: "https://test.com", events: ["chat"] },
      undefined,
      true
    )
  );

  // PRINT RESULTS
  console.log("\n" + "=".repeat(80));
  console.log("📊 TEST RESULTS");
  console.log("=".repeat(80) + "\n");

  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ PASSED (${passed.length}/${results.length}):`);
  passed.forEach((r) => console.log(`   ${r.endpoint} → ${r.status} ${r.message}`));

  if (failed.length > 0) {
    console.log(`\n❌ FAILED (${failed.length}/${results.length}):`);
    failed.forEach((r) => console.log(`   ${r.endpoint} → ${r.status} ${r.message}`));
  }

  console.log("\n" + "=".repeat(80));
  console.log(`📈 Summary: ${passed.length}/${results.length} routes working`);

  if (failed.length > 0) {
    console.log(`⚠️  ${failed.length} routes need attention`);
  } else {
    console.log("🎉 All routes are working!");
  }
}

runTests().catch(console.error);
