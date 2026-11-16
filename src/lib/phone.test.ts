import { describe, expect, it } from "vitest";
import { normalizeKenyanPhone, formatDisplayPhone } from "./phone";

describe("normalizeKenyanPhone", () => {
  describe("valid inputs", () => {
    it("handles +254 prefix format", () => {
      expect(normalizeKenyanPhone("+254712345678")).toBe("+254712345678");
      expect(normalizeKenyanPhone("+254712345678")).toBe("+254712345678");
    });

    it("handles 254 prefix format", () => {
      expect(normalizeKenyanPhone("254712345678")).toBe("+254712345678");
    });

    it("handles 07 prefix (Safaricom/ Telkom)", () => {
      expect(normalizeKenyanPhone("0712345678")).toBe("+254712345678");
      expect(normalizeKenyanPhone("0712345678")).toBe("+254712345678");
    });

    it("handles 01 prefix (Safaricom)", () => {
      expect(normalizeKenyanPhone("0112345678")).toBe("+254112345678");
      expect(normalizeKenyanPhone("0102345678")).toBe("+254102345678");
    });
  });

  describe("formatting variations", () => {
    it("removes spaces", () => {
      expect(normalizeKenyanPhone("+254 712 345 678")).toBe("+254712345678");
      expect(normalizeKenyanPhone("071 234 5678")).toBe("+254712345678");
    });

    it("removes dashes", () => {
      expect(normalizeKenyanPhone("+254-712-345-678")).toBe("+254712345678");
    });

    it("removes parentheses", () => {
      expect(normalizeKenyanPhone("(+254) 712345678")).toBe("+254712345678");
    });
  });

  describe("invalid inputs", () => {
    it("returns null for empty string", () => {
      expect(normalizeKenyanPhone("")).toBeNull();
    });

    it("returns null for null input", () => {
      expect(normalizeKenyanPhone(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(normalizeKenyanPhone(undefined)).toBeNull();
    });

    it("returns null for non-Kenyan numbers", () => {
      expect(normalizeKenyanPhone("+14155551234")).toBeNull();
      expect(normalizeKenyanPhone("+255712345678")).toBeNull(); // Tanzania
      expect(normalizeKenyanPhone("0812345678")).toBeNull(); // Not a valid Kenyan mobile prefix
    });
  });
});

describe("formatDisplayPhone", () => {
  it("formats normalized number with + prefix spaces", () => {
    expect(formatDisplayPhone("254712345678")).toBe("+25 47 123 45678");
  });

  it("returns null for null input", () => {
    expect(formatDisplayPhone(null)).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(formatDisplayPhone("12345")).toBeNull();
  });
});