import {
  AppError,
  ErrorCode,
  ValidationError,
  NotFoundError,
  TenantIsolationError,
  isAppError,
  toAppError,
} from "@/lib/errors";

describe("AppError", () => {
  it("creates an error with correct properties", () => {
    const err = new AppError(ErrorCode.NOT_FOUND, "Resource not found", 404);
    expect(err.code).toBe(ErrorCode.NOT_FOUND);
    expect(err.message).toBe("Resource not found");
    expect(err.httpStatus).toBe(404);
    expect(err.name).toBe("AppError");
  });

  it("toSafeJSON does not expose internal details", () => {
    const err = new AppError(
      ErrorCode.INTERNAL_ERROR,
      "User-safe message",
      500,
      { detail: "internal secret detail" }
    );
    const json = err.toSafeJSON();
    expect(json.error.message).toBe("User-safe message");
    expect(JSON.stringify(json)).not.toContain("internal secret detail");
  });
});

describe("ValidationError", () => {
  it("includes field errors in safe JSON", () => {
    const err = new ValidationError("Validation failed", {
      phone: "Invalid phone number",
    });
    const json = err.toSafeJSON();
    expect(json.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(json.error.fields?.phone).toBe("Invalid phone number");
  });
});

describe("NotFoundError", () => {
  it("produces a 404 status", () => {
    const err = new NotFoundError("Appointment", "abc-123");
    expect(err.httpStatus).toBe(404);
    expect(err.message).toContain("abc-123");
  });
});

describe("TenantIsolationError", () => {
  it("produces 403 and does not reveal cross-tenant info in safe JSON", () => {
    const err = new TenantIsolationError();
    expect(err.httpStatus).toBe(403);
    const json = err.toSafeJSON();
    expect(json.error.message).toBe("Access denied");
    expect(JSON.stringify(json)).not.toContain("cross-tenant");
  });
});

describe("isAppError", () => {
  it("returns true for AppError instances", () => {
    expect(isAppError(new AppError(ErrorCode.NOT_FOUND, "test", 404))).toBe(true);
  });

  it("returns false for plain errors", () => {
    expect(isAppError(new Error("oops"))).toBe(false);
  });

  it("returns false for non-errors", () => {
    expect(isAppError("string")).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("toAppError", () => {
  it("passes AppError through unchanged", () => {
    const original = new NotFoundError("Business");
    const result = toAppError(original);
    expect(result).toBe(original);
  });

  it("wraps plain Error into AppError", () => {
    const plain = new Error("Something blew up");
    const result = toAppError(plain);
    expect(isAppError(result)).toBe(true);
    expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(result.detail).toBe("Something blew up");
  });

  it("wraps string throws into AppError", () => {
    const result = toAppError("some string error");
    expect(isAppError(result)).toBe(true);
    expect(result.httpStatus).toBe(500);
  });
});
