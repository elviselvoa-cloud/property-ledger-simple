/**
 * Normalize a Kenyan phone number to international format (2547...).
 * Handles formats like:
 * - +254712345678
 * - 254712345678
 * - 0712345678
 * - 0112345678 (Safaricom)
 * - 0712345678
 *
 * Also expose normalizePhone as alias for backwards compatibility
 */
export function normalizeKenyanPhone(input: string | null | undefined): string | null {
  if (!input) return null;

  // Remove all spaces, dashes, and common formatting
  const cleaned = input.trim().replace(/[\s\-()]/g, "");

  // Already in international format starting with 254 (return with + prefix for compat)
  if (/^254[17]\d{8}$/.test(cleaned)) {
    return "+" + cleaned;
  }

  // Starting with 07... (traditional Kenyan mobile format)
  if (/^0[17]\d{8}$/.test(cleaned)) {
    return "+254" + cleaned.slice(1);
  }

  // Starting with 01... (Safaricom prefix)
  if (/^01\d{9}$/.test(cleaned)) {
    return "+254" + cleaned.slice(1);
  }

  // Starting with 7 or 1 bare prefix (10 digits without leading 0)
  if (/^[17]\d{9}$/.test(cleaned)) {
    return "+254" + cleaned;
  }

  // Starting with +254
  if (/^\+254[17]\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  // Invalid format
  return null;
}

/**
 * Format a normalized Kenyan phone number for display.
 * Input must be in normalized format (254712345678)
 */
export function formatDisplayPhone(input: string | null | undefined): string | null {
  const normalized = normalizeKenyanPhone(input);
  if (!normalized) return null;

  // Format as +254 7XX XXX XXX
  return `${normalized.slice(0, 3)} ${normalized.slice(3, 5)} ${normalized.slice(5, 8)} ${normalized.slice(8)}`;
}

/**
 * Check if a phone number looks like it could be a tenant's WhatsApp number.
 * This helps filter out non-tenants when matching WhatsApp messages.
 */
export function isLikelyWhatsAppNumber(input: string | null | undefined): boolean {
  return normalizeKenyanPhone(input) !== null;
}

// Backwards compatibility aliases
export const normalizePhone = normalizeKenyanPhone;
export const sanitizeKenyanPhone = normalizeKenyanPhone;