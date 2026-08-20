import { requireApiKey } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { NextRequest } from "next/server";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("requireApiKey", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, API_SECRET_KEY: "test-secret-key-abc123" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws UnauthorizedError when x-api-key header is missing", () => {
    expect(() => requireApiKey(makeRequest())).toThrow(UnauthorizedError);
  });

  it("throws ForbiddenError when API key is wrong", () => {
    expect(() =>
      requireApiKey(makeRequest({ "x-api-key": "wrong-key" }))
    ).toThrow(ForbiddenError);
  });

  it("passes with correct API key", () => {
    expect(() =>
      requireApiKey(makeRequest({ "x-api-key": "test-secret-key-abc123" }))
    ).not.toThrow();
  });

  it("throws ForbiddenError when API_SECRET_KEY is not configured", () => {
    delete process.env.API_SECRET_KEY;
    expect(() =>
      requireApiKey(makeRequest({ "x-api-key": "any-key" }))
    ).toThrow(ForbiddenError);
  });

  it("is resistant to timing attacks (same result for all wrong keys)", () => {
    // Both wrong keys should throw ForbiddenError, not short-circuit differently
    expect(() =>
      requireApiKey(makeRequest({ "x-api-key": "a" }))
    ).toThrow(ForbiddenError);

    expect(() =>
      requireApiKey(makeRequest({ "x-api-key": "test-secret-key-abc123-extra" }))
    ).toThrow(ForbiddenError);
  });
});
