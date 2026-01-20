/**
 * Set a cookie with the given name, value, and options.
 * This is wrapped in a function to satisfy React Compiler's immutability rules.
 */
export function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document !== "undefined") {
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
  }
}

/**
 * Get a cookie value by name.
 */
export function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split("=");
    if (cookieName === name) {
      return cookieValue;
    }
  }
  return undefined;
}
