/**
 * Q5.2 · Fire-and-forget platform action audit.
 *
 * This is a PLAIN server module (NOT "use server") so it can be imported both by
 * server actions (the human write path) and by the MCP route handler (the service
 * write path) without the server-action serialization constraints.
 *
 * Human-vs-service tagging:
 *  - a service actorOverride (isServiceAgent=true, e.g. the MCP SERVICE_ACTOR
 *    "oscar-agent") → actor_type='service';
 *  - otherwise the actor is derived from getSession() → actor_type='human',
 *    actor_user_id = the portal user id, actor_label = the user's name/email.
 *
 * Contract: this NEVER throws and NEVER blocks the caller — every failure is
 * swallowed after a console.error. It must be called AFTER the audited mutation
 * has already succeeded, so a logging failure can't affect the mutation.
 *
 * SECURITY: never pass secrets (passwords, tokens) in metadata — the password
 * set/reset actions audit the EVENT only.
 */
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import type { AuditLogInput, AuditServiceActor } from "./types";

export async function logAudit(
  input: AuditLogInput,
  actorOverride?: AuditServiceActor | null,
): Promise<void> {
  try {
    // 1. Resolve the actor. A service override wins; else derive the human.
    let actorType: "human" | "service";
    let actorUserId: string | null = null;
    let actorLabel: string | null = null;

    if (actorOverride?.isServiceAgent) {
      actorType = "service";
      actorUserId = actorOverride.portalUserId ?? null;
      actorLabel = actorOverride.label ?? "service";
    } else {
      actorType = "human";
      const session = await getSession();
      actorUserId = session?.portalUserId ?? null;
      actorLabel = session?.name || session?.email || null;
    }

    // 2. IP + User-Agent from the request headers (same approach as logLoginEvent).
    //    Own try/catch — headers() throws outside a request scope.
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      const forwardedFor = h.get("x-forwarded-for");
      ip = forwardedFor
        ? forwardedFor.split(",")[0]?.trim() ?? null
        : h.get("x-real-ip") ?? null;
      userAgent = h.get("user-agent") ?? null;
    } catch {
      /* no request scope available — leave IP/UA null */
    }

    // 3. Insert via the service-role admin client (bypasses RLS; SELECT is
    //    platform-admin only).
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("action_audit_log").insert({
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      organisation_id: input.organisationId ?? null,
      actor_type: actorType,
      actor_user_id: actorUserId,
      actor_label: actorLabel,
      metadata: input.metadata ?? null,
      ip,
      user_agent: userAgent,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
