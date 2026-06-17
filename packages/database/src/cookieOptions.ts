/**
 * Embed-safe auth-cookie options.
 *
 * The portal is embedded as a cross-site iframe inside Oscar's "Custom App"
 * panel (oscar.ideajetlab.com → timber-portal). A default `SameSite=Lax` auth
 * cookie is NOT sent on the cross-site middleware/server request, so the user
 * "logs in" client-side but the next server render sees no session and bounces
 * back to /login. The cookie must be `SameSite=None; Secure; Partitioned`
 * (Partitioned/CHIPS is required by current Chrome's third-party-cookie blocking).
 *
 * Applied only in deployed (production/HTTPS) builds — `SameSite=None` requires
 * `Secure`, which a local `next dev` over http can't satisfy, so dev keeps the
 * defaults and standalone first-party use is unaffected by the change.
 */
import type { CookieOptions } from '@supabase/ssr'

const EMBEDDABLE = process.env.NODE_ENV === 'production'

/** Wrap per-cookie options from a Supabase `setAll` so the auth cookie embeds. */
export function embedSafeCookieOptions(options: CookieOptions): CookieOptions {
  if (!EMBEDDABLE) return options
  return { ...options, sameSite: 'none', secure: true, partitioned: true }
}

/** cookieOptions for the browser client (createBrowserClient); undefined in dev. */
export const browserCookieOptions: CookieOptions | undefined = EMBEDDABLE
  ? { sameSite: 'none', secure: true, partitioned: true }
  : undefined
