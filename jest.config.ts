import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
      testEnvironment: "node",
      transform: {
        "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "./tsconfig.test.json" }],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      testEnvironment: "node",
      transform: {
        "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "./tsconfig.test.json" }],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
    {
      displayName: "components",
      testMatch: ["<rootDir>/tests/components/**/*.test.tsx"],
      testEnvironment: "jsdom",
      transform: {
        "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "./tsconfig.test.json" }],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      setupFilesAfterEnv: ["@testing-library/jest-dom"],
    },
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/layout.tsx",
    "!src/app/page.tsx",
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};

export default createJestConfig(config);
