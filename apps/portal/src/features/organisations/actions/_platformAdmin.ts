import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth/getSession";

export const ADMIN_DENIED = { success: false, error: "Permission denied", code: "FORBIDDEN" } as const;

/** Exact onboarding authority: an active portal_users row with the platform flag. */
export async function requirePlatformAdmin(): Promise<
  | { ok: true; session: SessionUser }
  | { ok: false }
> {
  const session = await getSession();
  return session?.isPlatformAdmin === true ? { ok: true, session } : { ok: false };
}
