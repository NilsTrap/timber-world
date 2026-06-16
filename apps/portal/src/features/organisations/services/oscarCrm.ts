/**
 * Oscar CRM client — write-through mirror of a Timber organisation into the Oscar
 * CRM (dedicated instance at timber.agentwave.app). Timber owns the operational
 * org row + company card; Oscar owns the rich CRM. We push name + company card,
 * store the returned `crm_org_id`, and keep `crm_synced_at` current.
 *
 * CONFIG-GATED: no-ops (returns { skipped: true }) until OSCAR_CRM_URL +
 * OSCAR_CRM_TOKEN are set — so org create/edit works unchanged before the Oscar
 * instance exposes its CRM MCP. The exact tool names / payload shape are
 * PROVISIONAL pending the Oscar dev agent's contract (bus flag
 * nils-timber__oscar-crm-mcp-requirements); only orgToCrmPayload + the gating
 * are load-bearing today and unit-tested.
 *
 * Server-only (uses a service token). Never import into client components.
 */

export interface OrgCardForCrm {
  /** Timber org id — sent as an external ref so Oscar can dedupe/back-link. */
  timberOrgId: string;
  code: string;
  name: string;
  legalAddress: string | null;
  vatNumber: string | null;
  registrationNumber: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankSwiftCode: string | null;
  isCustomer: boolean;
  isManufacturer: boolean;
  isProducer: boolean;
}

export type CrmResult<T> =
  | { success: true; skipped: true } // CRM disabled — caller proceeds unchanged
  | { success: true; skipped: false; data: T }
  | { success: false; error: string };

/** True when the Oscar CRM endpoint + token are configured (env-gated). */
export function isCrmEnabled(): boolean {
  return !!(process.env.OSCAR_CRM_URL && process.env.OSCAR_CRM_TOKEN);
}

/**
 * Pure: map a Timber org/company-card to the CRM create/update payload. Kept
 * pure (no env/IO) so it unit-tests; the field names track the agreed contract.
 */
export function orgToCrmPayload(org: OrgCardForCrm): Record<string, unknown> {
  return {
    name: org.name,
    code: org.code,
    legal_address: org.legalAddress,
    vat_number: org.vatNumber,
    registration_number: org.registrationNumber,
    country: org.country,
    phone: org.phone,
    email: org.email,
    website: org.website,
    bank_name: org.bankName,
    bank_account_number: org.bankAccountNumber,
    bank_swift_code: org.bankSwiftCode,
    roles: [
      org.isCustomer ? "customer" : null,
      org.isManufacturer ? "manufacturer" : null,
      org.isProducer ? "producer" : null,
    ].filter(Boolean),
    // Back-reference for dedupe/idempotency on the Oscar side.
    external_ref: { system: "timber", org_id: org.timberOrgId, code: org.code },
  };
}

// ── JSON-RPC over HTTP to the Oscar CRM MCP (only runs when enabled) ──────────
let rpcId = 0;
async function callOscarCrm(tool: string, args: Record<string, unknown>): Promise<unknown> {
  const url = process.env.OSCAR_CRM_URL as string;
  const token = process.env.OSCAR_CRM_TOKEN as string;
  const businessId = process.env.OSCAR_BUSINESS_ID; // optional (dedicated instance may not need it)
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(businessId ? { "X-Business-Id": businessId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name: tool, arguments: args } }),
  });
  if (!res.ok) throw new Error(`Oscar CRM ${tool} HTTP ${res.status}`);
  const json = (await res.json()) as { error?: { message?: string }; result?: { content?: { text?: string }[]; isError?: boolean } };
  if (json.error) throw new Error(json.error.message || `Oscar CRM ${tool} error`);
  const text = json.result?.content?.[0]?.text;
  if (json.result?.isError) throw new Error(text || `Oscar CRM ${tool} returned an error`);
  return text ? JSON.parse(text) : null;
}

/** Create or update the CRM org. Returns the crm_org_id. No-op (skipped) when disabled. */
export async function crmUpsertOrganization(org: OrgCardForCrm, crmOrgId: string | null): Promise<CrmResult<{ crmOrgId: string }>> {
  if (!isCrmEnabled()) return { success: true, skipped: true };
  try {
    const payload = orgToCrmPayload(org);
    const result = crmOrgId
      ? ((await callOscarCrm("crm_update_organization", { id: crmOrgId, ...payload })) as { id?: string } | null)
      : ((await callOscarCrm("crm_create_organization", payload)) as { id?: string } | null);
    const id = result?.id ?? crmOrgId;
    if (!id) return { success: false, error: "Oscar CRM did not return an organization id" };
    return { success: true, skipped: false, data: { crmOrgId: String(id) } };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/** List CRM organizations (for the import-from-CRM picker). No-op when disabled. */
export async function crmListOrganizations(query?: string, limit = 50): Promise<CrmResult<unknown[]>> {
  if (!isCrmEnabled()) return { success: true, skipped: true };
  try {
    const data = (await callOscarCrm("crm_list_organizations", { query: query ?? undefined, limit })) as unknown[] | null;
    return { success: true, skipped: false, data: data ?? [] };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/** Fetch one CRM organization by its crm id. No-op when disabled. */
export async function crmGetOrganization(crmOrgId: string): Promise<CrmResult<unknown>> {
  if (!isCrmEnabled()) return { success: true, skipped: true };
  try {
    const data = await callOscarCrm("crm_get_organization", { id: crmOrgId });
    return { success: true, skipped: false, data };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Best-effort write-through after a Timber org create/edit: mirror to the CRM and
 * persist crm_org_id + crm_synced_at. NEVER throws — a CRM hiccup (or it being
 * disabled) must not fail the Timber org operation; the org just stays unsynced.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function crmSyncOrg(db: any, org: OrgCardForCrm & { crmOrgId: string | null }): Promise<void> {
  const res = await crmUpsertOrganization(org, org.crmOrgId);
  if (!res.success) {
    console.warn(`[oscarCrm] sync failed for org ${org.timberOrgId}: ${res.error}`);
    return;
  }
  if (res.skipped) return; // CRM disabled — nothing to persist
  try {
    await db
      .from("organisations")
      .update({ crm_org_id: res.data.crmOrgId, crm_synced_at: new Date().toISOString() })
      .eq("id", org.timberOrgId);
  } catch (e) {
    console.warn(`[oscarCrm] stored CRM id update failed for org ${org.timberOrgId}: ${(e as Error).message}`);
  }
}
