/**
 * Country calling codes
 */
const COUNTRY_CODES: Record<string, string> = {
  UK: "+44",
  GB: "+44",
  SE: "+46",
  NO: "+47",
  DK: "+45",
  FI: "+358",
  NL: "+31",
  BE: "+32",
  IE: "+353",
  DE: "+49",
};

/**
 * Format phone number to international format
 * Removes leading 0 and adds country code
 *
 * Examples:
 *   formatPhoneInternational("01onal234567", "UK") → "+44 1onal234567"
 *   formatPhoneInternational("020 7946 0958", "UK") → "+44 20 7946 0958"
 *   formatPhoneInternational("+44 1234 567890", "UK") → "+44 1234 567890" (unchanged)
 *   formatPhoneInternational("08-123 456 78", "SE") → "+46 8-123 456 78"
 */
export function formatPhoneInternational(phone: string | null | undefined, country: string): string | null {
  if (!phone) return null;

  // Clean the phone number (remove extra spaces)
  let cleaned = phone.trim().replace(/\s+/g, " ");

  // If already has international format (starts with +), return as-is
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // Get country code
  const countryCode = COUNTRY_CODES[country.toUpperCase()];
  if (!countryCode) {
    // Unknown country, return original
    return cleaned;
  }

  // Remove leading 0 (local calling prefix)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // Format with country code
  return `${countryCode} ${cleaned}`;
}
