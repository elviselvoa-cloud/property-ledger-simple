/**
 * Unified Kenyan phone number normalizer for Property Ledger.
 * Converts local/international formats to a consistent 254... format.
 *
 * Supported formats:
 * - "0712345678" → "254712345678" (local 9-digit)
 * - "0701234567" → null (rejected - landline prefix 070)
 * - "+254712345678" → "254712345678" (international 12-digit)
 * - "712345678" → "254712345678" (bare 9-digit)
 * - "7123456789" → "2547123456789" (bare 10-digit, Airtel extended)
 */

export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Reject if original has more than 12 significant digits
  if (digits.length > 12) return null;

  // If already starts with 254
  if (digits.startsWith("254")) {
    if (digits.length === 12) return digits; // +254 + 9 digits = correct
    if (digits.length === 13) return digits; // +254 + 10 digits = valid longer format
    if (digits.length < 12) return null; // Too short
    return digits.slice(0, 12); // Truncate extra digits
  }

  // Keep track of whether we had a leading zero
  const hadLeadingZero = digits.startsWith("0");

  // Strip leading 0 if present
  if (hadLeadingZero) digits = digits.slice(1);

  // Must start with Kenyan mobile prefix (7 for Safaricom, 1 for Airtel)
  if (!digits.startsWith("7") && !digits.startsWith("1")) return null;

  // Validate length based on whether there was a leading zero
  if (hadLeadingZero) {
    // Original had leading 0: after stripping, should have exactly 9 digits
    // e.g., "0712345678" → "712345678" (9 digits)
    //       "0701234567" → "701234567" (rejected - 701 prefix is landline)
    //       "07012345678" → "7012345678" (10 digits, but original was 11 digits)
    if (digits.length !== 9) return null;
  } else {
    // No leading zero: accept 9 or 10 digits
    // 9 digits = standard mobile
    // 10 digits = longer format (some Airtel numbers)
    if (digits.length < 9 || digits.length > 10) return null;
  }

  return `254${digits}`;
}

/**
 * Returns an E.164 formatted version (+254...) for SMS providers.
 * This is the format expected by Africa's Talking, Twilio, etc.
 */
export function sanitizeKenyanPhone(raw?: string | null): string | null {
  const result = normalizePhone(raw);
  if (!result) return null;
  return `+${result}`;
}