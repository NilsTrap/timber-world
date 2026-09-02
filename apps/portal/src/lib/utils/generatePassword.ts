/**
 * Password Generation Utility
 *
 * Generates secure temporary passwords for user credential creation.
 * Used when sending login credentials to new portal users.
 */

/**
 * Characters to use in password generation.
 * Excludes ambiguous characters: 0, O, l, 1, I
 * to avoid confusion when users read/type the password.
 */
const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/**
 * Generate a temporary password.
 *
 * Generates a random password of specified length using mixed case
 * letters and numbers, excluding ambiguous characters.
 *
 * @param length Password length (default: 12, minimum: 12)
 * @returns Generated password string
 */
type FillRandomValues = (bytes: Uint8Array) => Uint8Array;

export function generateTemporaryPasswordWithRandomValues(
  length: number = 12,
  fillRandomValues: FillRandomValues,
): string {
  if (!Number.isFinite(length) || !Number.isInteger(length) || length > 256) {
    throw new RangeError("Password length must be a finite integer no greater than 256");
  }
  const minLength = 12;
  const actualLength = Math.max(length, minLength);
  const limit = Math.floor(256 / PASSWORD_CHARS.length) * PASSWORD_CHARS.length;
  const nextCharacter = () => {
    const bytes = new Uint8Array(1);
    do fillRandomValues(bytes); while (bytes[0]! >= limit);
    return PASSWORD_CHARS.charAt(bytes[0]! % PASSWORD_CHARS.length);
  };

  // Reserve one position for each required character class, then shuffle with
  // the same unbiased source so composition never depends on retry luck.
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const from = (characters: string) => {
    const limitForSet = Math.floor(256 / characters.length) * characters.length;
    const bytes = new Uint8Array(1);
    do fillRandomValues(bytes); while (bytes[0]! >= limitForSet);
    return characters.charAt(bytes[0]! % characters.length);
  };
  const characters = [from(uppercase), from(lowercase), from(numbers)];
  while (characters.length < actualLength) characters.push(nextCharacter());
  for (let index = characters.length - 1; index > 0; index--) {
    const bytes = new Uint8Array(1);
    const shuffleLimit = Math.floor(256 / (index + 1)) * (index + 1);
    do fillRandomValues(bytes); while (bytes[0]! >= shuffleLimit);
    const swapIndex = bytes[0]! % (index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex]!, characters[index]!];
  }
  return characters.join("");
}

export function generateTemporaryPassword(length: number = 12): string {
  return generateTemporaryPasswordWithRandomValues(length, (bytes) => crypto.getRandomValues(bytes));
}
