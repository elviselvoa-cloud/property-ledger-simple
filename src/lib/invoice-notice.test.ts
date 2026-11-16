import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("converts local 07xx numbers to 254 format with + prefix", () => {
    expect(normalizePhone("0712345678")).toBe("+254712345678");
  });

  it("keeps international +254 numbers intact", () => {
    expect(normalizePhone("+254712345678")).toBe("+254712345678");
  });