import { maskSensitive, normalizePhone, normalizeEmail } from "@/lib/utils/id";

describe("maskSensitive", () => {
  it("masks middle of a long string", () => {
    expect(maskSensitive("+12145551234")).toBe("+12***34");
  });

  it("fully masks a very short string", () => {
    expect(maskSensitive("abc")).toBe("***");
  });
});

describe("normalizePhone", () => {
  it("adds +1 to 10-digit US numbers", () => {
    expect(normalizePhone("2145551234")).toBe("+12145551234");
  });

  it("handles formatted US number", () => {
    expect(normalizePhone("(214) 555-1234")).toBe("+12145551234");
  });

  it("handles +1 prefix", () => {
    expect(normalizePhone("+1 214 555 1234")).toBe("+12145551234");
  });

  it("returns null for clearly invalid number", () => {
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  HELLO@EXAMPLE.COM  ")).toBe("hello@example.com");
  });
});
