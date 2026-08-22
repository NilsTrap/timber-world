import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth/getSession";

export const ADMIN_DENIED = { success: false, error: "Permission denied", code: "FORBIDDEN" } as const;

/** Pure policy seam used by every onboarding mutation and its executable tests. */
export function hasPlatformOnboardingAuthority(
  session: Pick<SessionUser, "isPlatformAdmin"> | null | undefined,
): boolean {
  return session?.isPlatformAdmin === true;
}

/** Exact onboarding authority: an active portal_users row with the platform flag. */
export async function requirePlatformAdmin(): Promise<
  | { ok: true; session: SessionUser }
  | { ok: false }
> {
  const session = await getSession();
  return hasPlatformOnboardingAuthority(session) ? { ok: true, session: session! } : { ok: false };
}
