// Jest configuration for TypeScript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/types/**",
    "!src/shared/**", // Exclude shared folder from coverage (TypeScript syntax issues with Babel)
    "!src/tools/types/**",
    "!src/tools/tools/**",
    "!src/tools/shared/**",
  ],
  coverageDirectory: "coverage",
  verbose: true,
  testTimeout: 30000, // 30 seconds timeout for API tests
  setupFilesAfterEnv: ["<rootDir>/tests/helpers/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Disable localStorage to avoid SecurityError
  testEnvironmentOptions: {
    customExportConditions: ["node", "node-addons"],
  },
  // Test patterns for different test types
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
      preset: "ts-jest",
      testEnvironment: "node",
      setupFilesAfterEnv: ["<rootDir>/tests/helpers/setup.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      preset: "ts-jest",
      testEnvironment: "node",
      setupFilesAfterEnv: ["<rootDir>/tests/helpers/setup.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
    {
      displayName: "api",
      testMatch: ["<rootDir>/tests/*.api.test.ts"],
      preset: "ts-jest",
      testEnvironment: "node",
      setupFilesAfterEnv: ["<rootDir>/tests/helpers/setup.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
  ],
};
