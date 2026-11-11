import { describe, expect, it } from "vitest";
import {
  sanitizeKenyanPhone,
  calculateSmsSegments,
  interpolateSmsTemplate,
  buildRentReminderMessage,
  buildOverdueMessage,
  buildEstateBroadcast,
  TEMPLATE_RENT_DUE,
  TEMPLATE_OVERDUE,
  TEMPLATE_ESTATE_BROADCAST,
  SMS_TEMPLATES,
} from "./sms";

describe("sanitizeKenyanPhone", () => {
  it("converts local 07xx format to E.164", () => {
    expect(sanitizeKenyanPhone("0712345678")).toBe("+254712345678");
  });

  it("accepts bare mobile prefix without leading zero", () => {
    expect(sanitizeKenyanPhone("7123456789")).toBe("+2547123456789");
  });

  it("strips leading + from +254 numbers", () => {
    expect(sanitizeKenyanPhone("+254712345678")).toBe("+254712345678");
  });

  it("handles numbers with spaces/dashes", () => {
    expect(sanitizeKenyanPhone("+254 712 345 678")).toBe("+254712345678");
    expect(sanitizeKenyanPhone("0712-345-678")).toBe("+254712345678");
  });

  it("rejects landline prefixes", () => {
    expect(sanitizeKenyanPhone("0201234567")).toBeNull();
    expect(sanitizeKenyanPhone("07012345678")).toBeNull(); // too long for 0xx but still wrong prefix
  });

  it("rejects invalid lengths", () => {
    expect(sanitizeKenyanPhone("123")).toBeNull();
    expect(sanitizeKenyanPhone("071234567")).toBeNull(); // 9 digits after 0 = valid length? actually 9 is ok...
  });

  it("returns null for empty/null inputs", () => {
    expect(sanitizeKenyanPhone(null!)).toBeNull();
    expect(sanitizeKenyanPhone("")).toBeNull();
    expect(sanitizeKenyanPhone("abc")).toBeNull();
  });

  it("supports Airtel 1-prefix numbers", () => {
    expect(sanitizeKenyanPhone("0112345678")).toBe("+254112345678");
    expect(sanitizeKenyanPhone("112345678")).toBe("+254112345678");
  });
});

describe("calculateSmsSegments", () => {
  it("single segment under 160 chars", () => {
    const info = calculateSmsSegments("Hello World");
    expect(info.segments).toBe(1);
    expect(info.charsLeftInSegment).toBe(160 - 11);
  });

  it("exactly 160 chars is single segment", () => {
    const text = "A".repeat(160);
    const info = calculateSmsSegments(text);
    expect(info.segments).toBe(1);
    expect(info.charsLeftInSegment).toBe(0);
  });

  it("161 chars requires 2 segments", () => {
    const text = "A".repeat(161);
    const info = calculateSmsSegments(text);
    expect(info.segments).toBe(2);
    expect(info.charsLeftInSegment).toBe(152); // 161 - 160 = 1 extra, next segment gets 1 char left of 153
  });

  it("correctly calculates multi-segment chunks", () => {
    const text = "A".repeat(320);
    const info = calculateSmsSegments(text);
    expect(info.segments).toBe(3);
    expect(info.chars).toBe(320);
  });

  it("empty string returns zeros", () => {
    const info = calculateSmsSegments("");
    expect(info).toEqual({ chars: 0, segments: 0, charsLeftInSegment: 0 });
  });
});

describe("interpolateSmsTemplate", () => {
  it("replaces all placeholders", () => {
    const result = interpolateSmsTemplate("Hi {{name}}, your bill is KES {{amount}}", {
      name: "Jane",
      amount: "5000",
    });
    expect(result).toBe("Hi Jane, your bill is KES 5000");
  });

  it("replaces unknown placeholders with empty strings", () => {
    const result = interpolateSmsTemplate("Hello {{missing}} world", {});
    expect(result).toBe("Hello  world");
  });

  it("renders missing values as empty strings when key exists with undefined", () => {
    const result = interpolateSmsTemplate("{{foo}} and {{bar}}", { foo: "hello" });
    expect(result).toBe("hello and ");
  });
});

describe("buildRentReminderMessage", () => {
  it("produces a properly formatted rent reminder", () => {
    const msg = buildRentReminderMessage({
      tenantName: "John Kimani",
      unitNumber: "A3",
      propertyName: "Sunrise Apartments",
      amountDue: 25000,
      dueDate: "2026-02-01",
      paybill: "123456",
      accountNumber: "998877",
    });

    expect(msg).toContain("Dear John Kimani");
    expect(msg).toContain("KES 25,000");
    expect(msg).toContain("Unit A3");
    expect(msg).toContain("2026-02-01");
    expect(msg).toContain("Paybill 123456");
  });
});

describe("buildOverdueMessage", () => {
  it("produces an urgent overdue notice", () => {
    const msg = buildOverdueMessage({
      tenantName: "Mary Wanjiku",
      unitNumber: "B2",
      amountDue: 30000,
      paybill: "654321",
      accountNumber: "112233",
    });

    expect(msg).toContain("URGENT");
    expect(msg).toContain("Mary Wanjiku");
    expect(msg).toContain("past due");
  });
});

describe("buildEstateBroadcast", () => {
  it("formats estate-wide announcements", () => {
    const msg = buildEstateBroadcast({
      propertyName: "Greenview Estate",
      customMessage: "Water supply suspended tomorrow from 8am-4pm for maintenance.",
    });

    expect(msg).toContain("Greenview Estate");
    expect(msg).toContain("residents");
    expect(msg).toContain("- Management");
  });
});

describe("SMS_TEMPLATES export", () => {
  it("contains expected template keys", () => {
    expect(SMS_TEMPLATES.rent_reminder).toBe(TEMPLATE_RENT_DUE);
    expect(SMS_TEMPLATES.overdue_notice).toBe(TEMPLATE_OVERDUE);
    expect(SMS_TEMPLATES.estate_broadcast).toBe(TEMPLATE_ESTATE_BROADCAST);
  });
});
