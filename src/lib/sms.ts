/**
 * Core SMS utility library for Property Ledger.
 * Phone formatting, GSM segment calculation, and template interpolation
 * conform to Kenyan mobile number conventions and Africa's Talking SMS rules.
 */

export interface SmsSegmentInfo {
  chars: number;
  segments: number;
  charsLeftInSegment: number;
}

export type SmsMessageType =
  | "rent_reminder"
  | "payment_receipt"
  | "estate_broadcast"
  | "custom"
  | "overdue_notice";

export type SmsStatus = "pending" | "sent" | "delivered" | "failed";

/** Standard Kenyan SMS templates. Placeholders use double-brace syntax. */
export const TEMPLATE_RENT_DUE =
  "Dear {{tenant_name}}, your rent of KES {{amount_due}} for Unit {{unit_number}} is due on {{due_date}}. Pay via Paybill {{paybill}}, Acc {{account_number}}. Thank you.";

export const TEMPLATE_OVERDUE =
  "URGENT: Dear {{tenant_name}}, your rent of KES {{amount_due}} for Unit {{unit_number}} is past due. Please settle immediately via Paybill {{paybill}} Acc {{account_number}}.";

export const TEMPLATE_ESTATE_BROADCAST =
  "Notice to {{property_name}} residents: {{custom_message}} - Management.";

/** All available template keys. */
export const SMS_TEMPLATES: Record<string, string> = {
  rent_reminder: TEMPLATE_RENT_DUE,
  overdue_notice: TEMPLATE_OVERDUE,
  estate_broadcast: TEMPLATE_ESTATE_BROADCAST,
};

// ─── Phone Formatting ──────────────────────────────────────────

const MOBILE_PREFIXES = new Set(["7", "1"]); // Kenya mobile prefixes (Safaricom/Airtel)

/**
 * Normalises a Kenyan phone number to E.164 format (+254…).
 * Rejects landlines (02…) and numbers that don't match mobile patterns.
 */
export function sanitizeKenyanPhone(phone: string): string | null {
  if (!phone || typeof phone !== "string") return null;

  const digits = phone.replace(/\D/g, "");
  // Kenyan mobile: 9–10 digits locally (07XX/01XX XXX XXX), 12 with country code (+254)
  if (!digits || digits.length < 9 || digits.length > 12) return null;

  let e164: string;
  if (digits.startsWith("0")) {
    // Local format: strip leading 0, prepend +254
    // After stripping 0, must be 9 digits → total with +254 = 12
    if (digits.length !== 10) return null;
    e164 = "+254" + digits.slice(1);
  } else if (digits.startsWith("254")) {
    // Already E.164 without leading +
    if (digits.length !== 12) return null;
    e164 = "+" + digits;
  } else if (digits.startsWith("+254")) {
    if (digits.length !== 13) return null;
    e164 = digits;
  } else if (digits.startsWith("7") || digits.startsWith("1")) {
    // Bare mobile: 9 or 10 digits accepted (Kenyan mobile without leading zero)
    e164 = "+254" + digits;
  } else {
    // Landline or other prefix
    return null;
  }

  // Validate mobile prefix after adding country code (+254X…)
  if (!MOBILE_PREFIXES.has(e164.charAt(4))) return null;

  return e164;
}

// ─── Segment Calculation ───────────────────────────────────────

/**
 * Calculates GSM-7 SMS segmentation info.
 * - Single-segment limit: 160 characters
 * - Multi-segment limit per segment: 153 characters (UCS-2 fallback kicks in earlier)
 * Returns char count, total segments needed, and remaining chars in the last segment.
 */
export function calculateSmsSegments(text: string): SmsSegmentInfo {
  if (!text) {
    return { chars: 0, segments: 0, charsLeftInSegment: 0 };
  }

  const len = text.length;

  // UTF-16 length approximates GSM-7 / UCS-2 byte count for common chars
  if (len <= 160) {
    return { chars: len, segments: 1, charsLeftInSegment: 160 - len };
  }

  const remaining = len - 160;
  const extraSegments = Math.ceil(remaining / 153);
  const totalSegments = 1 + extraSegments;
  const usedInLast = remaining % 153 === 0 ? 153 : remaining % 153;
  const charsLeft = 153 - usedInLast;

  return { chars: len, segments: totalSegments, charsLeftInSegment: charsLeft };
}

// ─── Template Interpolation ────────────────────────────────────

/**
 * Replaces {{placeholder}} tokens in a template with values from data.
 * Unknown placeholders are left untouched. Missing values render as empty strings.
 */
export function interpolateSmsTemplate(
  template: string,
  data: Record<string, string | number>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const val = data[key];
    // Both undefined (missing key) and explicit undefined render as empty string
    return val !== undefined ? String(val) : "";
  });
}

// ─── Pre-built Message Builders ────────────────────────────────

export interface SmsRecipient {
  phone: string;
  name: string;
  tenantId?: number;
  propertyId?: number;
}

export interface SmsSendPayload {
  landlordId: number;
  recipients: SmsRecipient[];
  message: string;
  messageType: SmsMessageType;
}

export interface SmsLogEntry {
  id: number;
  landlord_id: number;
  tenant_id: number | null;
  property_id: number | null;
  recipient_name: string;
  recipient_phone: string;
  message_type: SmsMessageType;
  message_body: string;
  segments_count: number;
  status: SmsStatus;
  provider_message_id: string | null;
  cost_kes: number;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export function buildRentReminderMessage(data: {
  tenantName: string;
  unitNumber: string;
  propertyName: string;
  amountDue: number;
  dueDate: string;
  paybill: string;
  accountNumber: string;
}): string {
  return interpolateSmsTemplate(TEMPLATE_RENT_DUE, {
    tenant_name: data.tenantName,
    unit_number: data.unitNumber,
    property_name: data.propertyName,
    amount_due: data.amountDue.toLocaleString("en-KE"),
    due_date: data.dueDate,
    paybill: data.paybill,
    account_number: data.accountNumber,
  });
}

export function buildOverdueMessage(data: {
  tenantName: string;
  unitNumber: string;
  amountDue: number;
  paybill: string;
  accountNumber: string;
}): string {
  return interpolateSmsTemplate(TEMPLATE_OVERDUE, {
    tenant_name: data.tenantName,
    unit_number: data.unitNumber,
    amount_due: data.amountDue.toLocaleString("en-KE"),
    paybill: data.paybill,
    account_number: data.accountNumber,
  });
}

export function buildEstateBroadcast(data: {
  propertyName: string;
  customMessage: string;
}): string {
  return interpolateSmsTemplate(TEMPLATE_ESTATE_BROADCAST, {
    property_name: data.propertyName,
    custom_message: data.customMessage,
  });
}
