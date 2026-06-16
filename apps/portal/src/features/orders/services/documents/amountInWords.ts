/**
 * Integer-and-decimals → English words, currency-aware. Used on invoices/specs.
 * Pure and testable. Handles 0 .. 999,999,999.99.
 */
const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const CURRENCY_WORDS: Record<string, { major: string; minor: string }> = {
  EUR: { major: "euro", minor: "cents" },
  GBP: { major: "pounds", minor: "pence" },
  USD: { major: "dollars", minor: "cents" },
};

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${ONES[hundreds] ?? ""} hundred`);
  if (rest > 0) {
    if (rest < 20) parts.push(ONES[rest] ?? "");
    else {
      const t = Math.floor(rest / 10);
      const o = rest % 10;
      parts.push(o > 0 ? `${TENS[t] ?? ""}-${ONES[o] ?? ""}` : (TENS[t] ?? ""));
    }
  }
  return parts.join(" ");
}

export function integerToWords(n: number): string {
  if (n === 0) return "zero";
  const groups = ["", " thousand", " million", " billion"];
  const parts: string[] = [];
  let g = 0;
  let remaining = Math.floor(n);
  while (remaining > 0 && g < groups.length) {
    const chunk = remaining % 1000;
    if (chunk > 0) parts.unshift(`${threeDigitsToWords(chunk)}${groups[g] ?? ""}`);
    remaining = Math.floor(remaining / 1000);
    g++;
  }
  return parts.join(" ");
}

/** Render a cents amount as words for a currency, e.g. "one thousand two hundred euro and 50 cents". */
export function amountInWords(cents: number, currency: string): string {
  const safe = Math.max(0, Math.round(cents));
  const major = Math.floor(safe / 100);
  const minor = safe % 100;
  const words = CURRENCY_WORDS[currency] ?? { major: currency.toLowerCase(), minor: "cents" };
  const majorWords = integerToWords(major);
  const head = `${majorWords} ${words.major}`;
  const cap = head.charAt(0).toUpperCase() + head.slice(1);
  return `${cap} and ${String(minor).padStart(2, "0")} ${words.minor}`;
}
