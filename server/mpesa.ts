/**
 * M-Pesa Sandbox Integration
 * Mock implementation of Safaricom Daraja API for development and testing
 * In production, replace with real Daraja API calls
 */

export interface MpesaSTKPushRequest {
  phoneNumber: string; // Customer phone number (254XXXXXXXXX format)
  amount: number; // Amount in KES
  accountReference: string; // Invoice ID or reference
  transactionDesc: string; // Transaction description
}

export interface MpesaSTKPushResponse {
  success: boolean;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface MpesaCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number; // 0 = success, non-zero = failure
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

/**
 * Simulate M-Pesa STK Push request
 * In production, this would call: POST https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest
 */
export async function initiateSTKPush(
  request: MpesaSTKPushRequest
): Promise<MpesaSTKPushResponse> {
  // Validate phone number format
  if (!request.phoneNumber.startsWith("254") || request.phoneNumber.length !== 12) {
    return {
      success: false,
      checkoutRequestId: "",
      responseCode: "400",
      responseDescription: "Invalid phone number format. Use 254XXXXXXXXX",
      customerMessage: "Invalid phone number",
    };
  }

  // Validate amount
  if (request.amount < 1 || request.amount > 150000) {
    return {
      success: false,
      checkoutRequestId: "",
      responseCode: "400",
      responseDescription: "Amount must be between 1 and 150,000 KES",
      customerMessage: "Invalid amount",
    };
  }

  // Generate mock checkout request ID (in production, this comes from Daraja)
  const checkoutRequestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Simulate successful STK Push initiation
  return {
    success: true,
    checkoutRequestId,
    responseCode: "0",
    responseDescription: "Success. Request accepted for processing",
    customerMessage: `STK Push sent to ${request.phoneNumber}. Enter your M-Pesa PIN to complete payment.`,
  };
}

/**
 * Parse M-Pesa callback payload
 * Extracts payment details from Daraja callback
 */
export function parseCallback(
  payload: MpesaCallbackPayload
): {
  success: boolean;
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  mpesaReceiptNumber?: string;
  amount?: number;
  phoneNumber?: string;
  transactionDate?: string;
} {
  const callback = payload.Body.stkCallback;
  const result = {
    success: callback.ResultCode === 0,
    checkoutRequestId: callback.CheckoutRequestID,
    resultCode: callback.ResultCode,
    resultDesc: callback.ResultDesc,
  };

  // Extract metadata if payment was successful
  if (callback.ResultCode === 0 && callback.CallbackMetadata) {
    const items = callback.CallbackMetadata.Item;
    const metadata: Record<string, string | number> = {};

    items.forEach((item) => {
      metadata[item.Name] = item.Value;
    });

    return {
      ...result,
      mpesaReceiptNumber: String(metadata.MpesaReceiptNumber),
      amount: Number(metadata.Amount),
      phoneNumber: String(metadata.PhoneNumber),
      transactionDate: String(metadata.TransactionDate),
    };
  }

  return result;
}

/**
 * Simulate M-Pesa callback for testing
 * Use this to test payment confirmation flow without real M-Pesa
 */
export function generateMockCallback(
  checkoutRequestId: string,
  success: boolean = true,
  amount: number = 1000,
  phoneNumber: string = "254712345678"
): MpesaCallbackPayload {
  if (success) {
    return {
      Body: {
        stkCallback: {
          MerchantRequestID: `merchant-${Date.now()}`,
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: "The service request has been processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: amount },
              { Name: "MpesaReceiptNumber", Value: `PF2QQZ7IKV` },
              { Name: "TransactionDate", Value: new Date().getTime() },
              { Name: "PhoneNumber", Value: phoneNumber },
            ],
          },
        },
      },
    };
  } else {
    return {
      Body: {
        stkCallback: {
          MerchantRequestID: `merchant-${Date.now()}`,
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 1,
          ResultDesc: "The user cancelled the operation.",
        },
      },
    };
  }
}
