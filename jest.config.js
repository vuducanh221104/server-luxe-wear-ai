// Jest configuration for TypeScript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/types/**"],
  coverageDirectory: "coverage",
  verbose: true,
  testTimeout: 30000, // 30 seconds timeout for API tests
  setupFilesAfterEnv: ["<rootDir>/tests/helpers/setup.ts"],
  moduleNameMapping: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Test patterns for different test types
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
    },
    {
      displayName: "api",
      testMatch: ["<rootDir>/tests/*.api.test.ts"],
    },
  ],
};
