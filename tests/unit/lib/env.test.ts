import { resetEnvCache } from "@/lib/config/env";
import { ConfigurationError } from "@/lib/errors";

describe("env configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetEnvCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetEnvCache();
  });

  it("throws ConfigurationError when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    const { env } = require("@/lib/config/env");
    expect(() => env()).toThrow(ConfigurationError);
    expect(() => env()).toThrow("DATABASE_URL");
  });

  it("reads DATABASE_URL when set", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
    const { env } = require("@/lib/config/env");
    expect(env().database.url).toBe("postgresql://test:test@localhost/test");
  });

  it("defaults AI provider to gemini when not set", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
    delete process.env.AI_DEFAULT_PROVIDER;
    const { env } = require("@/lib/config/env");
    expect(env().ai.defaultProvider).toBe("gemini");
  });

  it("correctly reports production environment", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
    const { env } = require("@/lib/config/env");
    expect(env().isProduction).toBe(true);
    expect(env().isDevelopment).toBe(false);
  });
});
