import assert from "node:assert/strict";
import { manualPasswordResetAuditMetadata, passwordPayloadSchema, setManualPassword, type PasswordResetAdmin, type PasswordResetQuery } from "../manualPasswordReset";
import { generateTemporaryPassword, generateTemporaryPasswordWithRandomValues } from "../../../../lib/utils/generatePassword";

type Row = Record<string, unknown>;

class Query implements PasswordResetQuery {
  private filters: Array<[string, unknown]> = [];
  private exclusions: Array<[string, unknown]> = [];
  private nullFilters: string[] = [];
  private rowLimit: number | null = null;
  private changes: Row | null = null;
  constructor(private rows: Row[], private resolvedError: unknown = null, private updateError: unknown = null) {}
  select(_columns: string) { return this; }
  update(values: Row) { this.changes = values; return this; }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
  neq(column: string, value: unknown) { this.exclusions.push([column, value]); return this; }
  is(column: string, value: null) { if (value === null) this.nullFilters.push(column); return this; }
  limit(count: number) { this.rowLimit = count; return this; }
  private execute() {
    let rows = this.rows.filter((row) => this.filters.every(([key, value]) => row[key] === value)
      && this.exclusions.every(([key, value]) => row[key] !== value)
      && this.nullFilters.every((key) => row[key] === null));
    if (this.rowLimit !== null) rows = rows.slice(0, this.rowLimit);
    if (this.changes) rows.forEach((row) => Object.assign(row, this.changes));
    return { data: rows[0] ?? null, error: this.changes && this.updateError ? this.updateError : this.resolvedError };
  }
  async maybeSingle() { return this.execute(); }
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function fixture(options?: { membership?: boolean; activeMembership?: boolean; otherMembership?: boolean; authId?: string | null; providerFails?: boolean; createFails?: boolean; linkFails?: boolean; platformAdmin?: boolean; status?: string; queryFails?: boolean; resolvedQueryError?: boolean; providerThrows?: boolean }) {
  const passwordCalls: Array<{ id: string; password: string; emailConfirm: true }> = [];
  const createCalls: string[] = [];
  const deleteCalls: string[] = [];
  const portalUsers: Row[] = [{ id: "user-a", email: "person@example.test", name: "Person", role: "user", auth_user_id: options?.authId === undefined ? "auth-a" : options.authId, is_active: true, status: options?.status ?? "active", is_platform_admin: options?.platformAdmin ?? false }];
  const memberships: Row[] = options?.membership === false ? [] : [{
    id: "membership-a", user_id: "user-a", organization_id: "org-a", is_active: options?.activeMembership !== false,
  }];
  if (options?.otherMembership) memberships.push({ id: "membership-b", user_id: "user-a", organization_id: "org-b", is_active: true });
  const admin: PasswordResetAdmin = {
    from(table) {
      if (options?.queryFails) throw new Error("database detail");
      const error = options?.resolvedQueryError ? new Error("resolved database detail") : null;
      const updateError = options?.linkFails && table === "portal_users" ? new Error("link detail") : null;
      return new Query(table === "portal_users" ? portalUsers : memberships, error, updateError);
    },
    auth: { admin: {
      async createUser({ email }: { email: string }) {
        createCalls.push(email);
        return options?.createFails
          ? { data: { user: null }, error: new Error("provider detail") }
          : { data: { user: { id: "auth-created" } }, error: null };
      },
      async deleteUser(id: string) { deleteCalls.push(id); return { error: null }; },
      async updateUserById(id, { password, email_confirm }) {
      passwordCalls.push({ id, password, emailConfirm: email_confirm });
      if (options?.providerThrows) throw new Error("provider thrown detail");
      return { error: options?.providerFails ? new Error("provider detail") : null };
      },
    } },
  };
  return { admin, passwordCalls, createCalls, deleteCalls, portalUsers };
}

let passed = 0;
async function test(name: string, run: () => Promise<void>) {
  await run();
  passed++;
  console.log(`✓ ${name}`);
}

async function main() {
await test("rejects short and mismatched password payloads", async () => {
  assert.equal(passwordPayloadSchema.safeParse({ password: "short", confirmation: "short" }).success, false);
  assert.equal(passwordPayloadSchema.safeParse({ password: "Secret123", confirmation: "Different123" }).success, false);
  assert.equal(passwordPayloadSchema.safeParse({ password: "Secret123", confirmation: "Secret123" }).success, true);
});

await test("generates policy-compliant passwords and keeps secrets out of audit metadata", async () => {
  for (let index = 0; index < 50; index++) {
    const generated = generateTemporaryPassword(12);
    assert.ok(generated.length >= 12);
    assert.match(generated, /[A-Z]/);
    assert.match(generated, /[a-z]/);
    assert.match(generated, /[0-9]/);
    assert.equal(JSON.stringify(manualPasswordResetAuditMetadata).includes(generated), false);
  }
  assert.deepEqual(manualPasswordResetAuditMetadata, { method: "manual" });
  const originalMathRandom = Math.random;
  Math.random = () => { throw new Error("Math.random must not be used"); };
  try {
    assert.equal(generateTemporaryPassword(12).length, 12);
    let next = 0;
    const deterministic = generateTemporaryPasswordWithRandomValues(12, (bytes) => {
      bytes[0] = next++ % 240;
      return bytes;
    });
    assert.equal(deterministic.length, 12);
    assert.match(deterministic, /[A-Z]/);
    assert.match(deterministic, /[a-z]/);
    assert.match(deterministic, /[0-9]/);
  } finally {
    Math.random = originalMathRandom;
  }
});

await test("rejects malformed generator lengths without weakening the minimum", async () => {
  assert.equal(generateTemporaryPassword(3).length, 12);
  for (const length of [Number.NaN, Number.POSITIVE_INFINITY, 12.5, 257]) {
    assert.throws(() => generateTemporaryPassword(length), RangeError);
  }
});

await test("updates the exact auth identity for an active exact membership", async () => {
  const state = fixture();
  const result = await setManualPassword(state.admin, "user-a", "org-a", "Secret123", true);
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(state.passwordCalls, [{ id: "auth-a", password: "Secret123", emailConfirm: true }]);
  assert.equal(typeof state.portalUsers[0]?.updated_at, "string");
  assert.equal(JSON.stringify(result).includes("Secret123"), false);
  assert.equal(JSON.stringify(result).includes("auth-a"), false);
});

await test("activates an invited user when an administrator assigns a password", async () => {
  const state = fixture({ status: "invited" });
  const result = await setManualPassword(state.admin, "user-a", "org-a", "Secret123", true);
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(state.passwordCalls, [{ id: "auth-a", password: "Secret123", emailConfirm: true }]);
  assert.equal(state.portalUsers[0]?.status, "active");
  assert.equal(typeof state.portalUsers[0]?.updated_at, "string");
  assert.equal(JSON.stringify(result).includes("Secret123"), false);
  assert.equal(JSON.stringify(result).includes("auth-a"), false);
});

await test("denies missing, inactive, and wrong-company memberships before auth mutation", async () => {
  for (const [state, organisationId] of [
    [fixture({ membership: false }), "org-a"],
    [fixture({ activeMembership: false }), "org-a"],
    [fixture(), "org-other"],
  ] as const) {
    const result = await setManualPassword(state.admin, "user-a", organisationId, "Secret123", false);
    assert.deepEqual(result, { ok: false, code: "DENIED" });
    assert.equal(state.passwordCalls.length, 0);
  }
});

await test("provisions and links credentials when a new user receives a manual password", async () => {
  const state = fixture({ authId: null, status: "created" });
  const result = await setManualPassword(state.admin, "user-a", "org-a", "Secret123", false);
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(state.createCalls, ["person@example.test"]);
  assert.equal(state.portalUsers[0]?.auth_user_id, "auth-created");
  assert.equal(state.portalUsers[0]?.status, "active");
  assert.equal(JSON.stringify(result).includes("Secret123"), false);
});

await test("rolls back a newly provisioned auth identity when portal linking fails", async () => {
  const state = fixture({ authId: null, status: "created", linkFails: true });
  assert.deepEqual(await setManualPassword(state.admin, "user-a", "org-a", "Secret123", true), { ok: false, code: "RESET_FAILED" });
  assert.deepEqual(state.deleteCalls, ["auth-created"]);
});

await test("reports provider failure generically and does not update the portal record", async () => {
  const state = fixture({ providerFails: true });
  const result = await setManualPassword(state.admin, "user-a", "org-a", "Secret123", false);
  assert.deepEqual(result, { ok: false, code: "RESET_FAILED" });
  assert.equal(state.portalUsers[0]?.updated_at, undefined);
  assert.equal(JSON.stringify(result).includes("provider detail"), false);
});

await test("requires an eligible status and blocks platform-admin targets from traders", async () => {
  for (const state of [fixture({ status: "disabled" }), fixture({ platformAdmin: true })]) {
    const result = await setManualPassword(state.admin, "user-a", "org-a", "Secret123", false);
    assert.deepEqual(result, { ok: false, code: "DENIED" });
    assert.equal(state.passwordCalls.length, 0);
  }
  const adminState = fixture({ platformAdmin: true });
  assert.deepEqual(await setManualPassword(adminState.admin, "user-a", "org-a", "Secret123", true), { ok: true });
});

await test("blocks multi-organisation targets from traders but allows platform admins", async () => {
  const traderState = fixture({ otherMembership: true });
  assert.deepEqual(await setManualPassword(traderState.admin, "user-a", "org-a", "Secret123", false), { ok: false, code: "DENIED" });
  assert.equal(traderState.passwordCalls.length, 0);
  const adminState = fixture({ otherMembership: true });
  assert.deepEqual(await setManualPassword(adminState.admin, "user-a", "org-a", "Secret123", true), { ok: true });
});

await test("maps thrown database and provider failures to generic RESET_FAILED", async () => {
  for (const state of [fixture({ queryFails: true }), fixture({ resolvedQueryError: true }), fixture({ providerThrows: true })]) {
    const result = await setManualPassword(state.admin, "user-a", "org-a", "Secret123", true);
    assert.deepEqual(result, { ok: false, code: "RESET_FAILED" });
    assert.equal(JSON.stringify(result).includes("detail"), false);
  }
});

console.log(`manualPasswordReset.test.ts: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
