import { describe, it, expect } from "vitest";
import { initiateSTKPush, parseCallback, generateMockCallback } from "./mpesa";

describe("M-Pesa STK Push Integration", () => {
  describe("initiateSTKPush", () => {
    it("should successfully initiate STK Push with valid phone and amount", async () => {
      const response = await initiateSTKPush({
        phoneNumber: "254712345678",
        amount: 5000,
        accountReference: "INV-123",
        transactionDesc: "Rent payment",
      });

      expect(response.success).toBe(true);
      expect(response.responseCode).toBe("0");
      expect(response.checkoutRequestId).toBeDefined();
      expect(response.customerMessage).toContain("STK Push sent");
    });

    it("should reject invalid phone number format", async () => {
      const response = await initiateSTKPush({
        phoneNumber: "712345678", // Missing country code
        amount: 5000,
        accountReference: "INV-123",
        transactionDesc: "Rent payment",
      });

      expect(response.success).toBe(false);
      expect(response.responseCode).toBe("400");
      expect(response.responseDescription).toContain("Invalid phone number");
    });

    it("should reject amount below minimum", async () => {
      const response = await initiateSTKPush({
        phoneNumber: "254712345678",
        amount: 0,
        accountReference: "INV-123",
        transactionDesc: "Rent payment",
      });

      expect(response.success).toBe(false);
      expect(response.responseCode).toBe("400");
      expect(response.responseDescription).toContain("between 1 and 150,000");
    });

    it("should reject amount above maximum", async () => {
      const response = await initiateSTKPush({
        phoneNumber: "254712345678",
        amount: 200000,
        accountReference: "INV-123",
        transactionDesc: "Rent payment",
      });

      expect(response.success).toBe(false);
      expect(response.responseCode).toBe("400");
      expect(response.responseDescription).toContain("between 1 and 150,000");
    });
  });

  describe("parseCallback", () => {
    it("should parse successful payment callback", () => {
      const callback = generateMockCallback("checkout-123", true, 5000, "254712345678");
      const result = parseCallback(callback);

      expect(result.success).toBe(true);
      expect(result.resultCode).toBe(0);
      expect(result.mpesaReceiptNumber).toBe("PF2QQZ7IKV");
      expect(result.amount).toBe(5000);
      expect(result.phoneNumber).toBe("254712345678");
    });

    it("should parse failed payment callback", () => {
      const callback = generateMockCallback("checkout-123", false);
      const result = parseCallback(callback);

      expect(result.success).toBe(false);
      expect(result.resultCode).toBe(1);
      expect(result.resultDesc).toContain("cancelled");
    });

    it("should include transaction date in successful callback", () => {
      const callback = generateMockCallback("checkout-123", true);
      const result = parseCallback(callback);

      expect(result.transactionDate).toBeDefined();
      expect(result.transactionDate).not.toBe("");
    });
  });

  describe("generateMockCallback", () => {
    it("should generate valid successful callback structure", () => {
      const callback = generateMockCallback("checkout-123", true, 10000);

      expect(callback.Body.stkCallback.CheckoutRequestID).toBe("checkout-123");
      expect(callback.Body.stkCallback.ResultCode).toBe(0);
      expect(callback.Body.stkCallback.CallbackMetadata).toBeDefined();
      expect(callback.Body.stkCallback.CallbackMetadata?.Item.length).toBeGreaterThan(0);
    });

    it("should generate valid failed callback structure", () => {
      const callback = generateMockCallback("checkout-123", false);

      expect(callback.Body.stkCallback.CheckoutRequestID).toBe("checkout-123");
      expect(callback.Body.stkCallback.ResultCode).toBe(1);
      expect(callback.Body.stkCallback.CallbackMetadata).toBeUndefined();
    });

    it("should include all required metadata fields in successful callback", () => {
      const callback = generateMockCallback("checkout-123", true, 15000, "254798765432");
      const metadata = callback.Body.stkCallback.CallbackMetadata?.Item || [];
      const metadataNames = metadata.map((item) => item.Name);

      expect(metadataNames).toContain("Amount");
      expect(metadataNames).toContain("MpesaReceiptNumber");
      expect(metadataNames).toContain("TransactionDate");
      expect(metadataNames).toContain("PhoneNumber");
    });
  });
});
