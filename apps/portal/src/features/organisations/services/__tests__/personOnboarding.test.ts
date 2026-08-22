import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder-service-role-key";

type User = {
  id: string;
  email: string;
  name: string;
  role: "user";
  organisation_id: string;
  auth_user_id: string | null;
  is_active: boolean;
  status: "created" | "invited" | "active";
  invited_at: string | null;
  invited_by: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};
type Membership = { user_id: string; organization_id: string; is_active: boolean; is_primary: boolean };

class Query {
  private filters: Array<[string, unknown]> = [];
  private nullFilters: string[] = [];
  private updateValues: Record<string, unknown> | null = null;

  constructor(private readonly db: OnboardingMemoryDb, private readonly table: string) {}
  select(_columns?: string) { return this; }
  update(values: Record<string, unknown>) { this.updateValues = values; return this; }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
  is(column: string, value: unknown) { if (value === null) this.nullFilters.push(column); return this; }

  private matches(row: Record<string, unknown>): boolean {
    return this.filters.every(([column, value]) => row[column] === value)
      && this.nullFilters.every((column) => row[column] === null);
  }

  private rows(): Array<Record<string, unknown>> {
    if (this.table === "portal_users") return [...this.db.users.values()];
    if (this.table === "organization_memberships") return this.db.memberships;
    if (this.table === "organisations") return [...this.db.organisations.values()];
    throw new Error(`Unexpected table ${this.table}`);
  }

  private execute(): { data: Record<string, unknown>[]; error: null } {
    const matched = this.rows().filter((row) => this.matches(row));
    if (this.updateValues) Object.assign(matched[0] ?? {}, this.updateValues);
    return { data: matched, error: null };
  }

  async maybeSingle() {
    const result = this.execute();
    return { data: result.data[0] ?? null, error: null };
  }

  then<TResult1 = { data: Record<string, unknown>[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Record<string, unknown>[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class OnboardingMemoryDb {
  users = new Map<string, User>();
  memberships: Membership[] = [];
  assignments = new Map<string, Set<string>>();
  organisations = new Map([
    ["org-a", { id: "org-a", name: "Customer A", is_active: true }],
    ["org-b", { id: "org-b", name: "Trader B", is_active: true }],
  ]);
  allowedGroups = new Map([
    ["org-a", new Set(["customer-group"])],
    ["org-b", new Set(["trader-group"])],
  ]);
  private nextUser = 1;
  private userLocks = new Map<string, Promise<void>>();

  from(table: string) { return new Query(this, table); }

  private async withUserLock<T>(userId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.userLocks.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.userLocks.set(userId, previous.then(() => current));
    await previous;
    try { return await operation(); } finally { release(); }
  }

  async rpc(name: string, args: Record<string, unknown>) {
    const userId = String(args.p_user_id ?? "");
    return this.withUserLock(userId || `create-${this.nextUser}`, async () => {
      if (name === "admin_create_portal_user") {
        if (!this.organisations.has(String(args.p_organization_id))) return denied("ONBOARDING_DENIED");
        if ([...this.users.values()].some((user) => user.email === args.p_email)) return denied("duplicate key");
        const id = `user-${this.nextUser++}`;
        const now = new Date().toISOString();
        this.users.set(id, {
          id,
          email: String(args.p_email),
          name: String(args.p_name),
          role: "user",
          organisation_id: String(args.p_organization_id),
          auth_user_id: null,
          is_active: true,
          status: "created",
          invited_at: null,
          invited_by: args.p_invited_by ? String(args.p_invited_by) : null,
          last_login_at: null,
          created_at: now,
          updated_at: now,
        });
        this.memberships.push({ user_id: id, organization_id: String(args.p_organization_id), is_active: true, is_primary: true });
        return { data: id, error: null };
      }

      const user = this.users.get(userId);
      const orgId = String(args.p_organization_id);
      const membership = this.memberships.find((row) => row.user_id === userId && row.organization_id === orgId);
      if (!user) return denied("ONBOARDING_DENIED");

      if (name === "admin_upsert_user_membership") {
        if (!this.organisations.has(orgId)) return denied("ONBOARDING_DENIED");
        if (membership?.is_active) return denied("ALREADY_MEMBER");
        if (membership) Object.assign(membership, { is_active: true, is_primary: false });
        else this.memberships.push({ user_id: userId, organization_id: orgId, is_active: true, is_primary: false });
        this.assignments.delete(`${userId}:${orgId}`);
        const hasPrimary = this.memberships.some((row) => row.user_id === userId && row.is_active && row.is_primary);
        if (args.p_make_primary === true || !hasPrimary) this.makePrimary(user, orgId);
        return { data: null, error: null };
      }

      if (!membership) return denied("ONBOARDING_DENIED");
      if (name === "admin_set_primary_membership") {
        if (!membership.is_active) return denied("ONBOARDING_DENIED");
        this.makePrimary(user, orgId);
        return { data: null, error: null };
      }
      if (name === "admin_set_membership_active") {
        if (args.p_is_active === true) {
          membership.is_active = true;
          membership.is_primary = false;
          this.assignments.delete(`${userId}:${orgId}`);
          if (!this.memberships.some((row) => row.user_id === userId && row.is_active && row.is_primary)) this.makePrimary(user, orgId);
          return { data: null, error: null };
        }
        const activeCount = this.memberships.filter((row) => row.user_id === userId && row.is_active).length;
        if (membership.is_primary || activeCount <= 1) return denied("PRIMARY_OR_ONLY_MEMBERSHIP");
        membership.is_active = false;
        membership.is_primary = false;
        this.assignments.delete(`${userId}:${orgId}`);
        return { data: null, error: null };
      }
      if (name === "admin_set_membership_groups") {
        if (!membership.is_active) return denied("ONBOARDING_DENIED");
        const requested = [...new Set(args.p_group_ids as string[])];
        if (requested.some((groupId) => !this.allowedGroups.get(orgId)?.has(groupId))) return denied("ACCESS_ABOVE_ORG_CEILING");
        this.assignments.set(`${userId}:${orgId}`, new Set(requested));
        return { data: requested.length, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    });
  }

  private makePrimary(user: User, orgId: string) {
    for (const row of this.memberships) if (row.user_id === user.id) row.is_primary = row.organization_id === orgId && row.is_active;
    user.organisation_id = orgId;
  }
}

function denied(message: string) { return { data: null, error: { message } }; }

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
}

async function main() {
  const onboarding = await import("../personOnboarding");
  const { sendPasswordlessInvite } = await import("../passwordlessInvite");
  const { isPlatformAdmin } = await import("@/lib/auth/getSession");
  const { isValidUUID } = await import("../../types");

  await test("only the platform-admin flag authorizes onboarding mutations", () => {
    assert.equal(isPlatformAdmin({ isPlatformAdmin: true } as never), true);
    assert.equal(isPlatformAdmin({ isPlatformAdmin: false } as never), false);
    assert.equal(isPlatformAdmin(null), false);
  });

  await test("malformed pasted identifiers fail the mutation validation primitive", () => {
    assert.equal(isValidUUID("not-a-user-id"), false);
    assert.equal(isValidUUID("' OR true --"), false);
    assert.equal(isValidUUID("00000000-0000-4000-8000-000000000001"), true);
  });

  await test("derives every persona and preserves multi-role organisations", () => {
    assert.deepEqual(onboarding.derivePersonas({ isCustomer: true }), ["Customer"]);
    assert.deepEqual(onboarding.derivePersonas({ isTrader: true }), ["Trader"]);
    for (const flags of [{ isManufacturer: true }, { isSupplier: true }, { isProducer: true }]) {
      assert.deepEqual(onboarding.derivePersonas(flags), ["Manufacturer/Supplier"]);
    }
    assert.deepEqual(
      onboarding.derivePersonas({ isCustomer: true, isTrader: true, isSupplier: true }),
      ["Customer", "Trader", "Manufacturer/Supplier"],
    );
  });

  await test("caps effective access at each organisation's module ceiling", () => {
    const grants = ["orders.view", "inventory.view", "counterparties.clients"];
    assert.deepEqual(onboarding.effectiveModuleIntersection(["orders.view"], grants), ["orders.view"]);
    assert.deepEqual(onboarding.effectiveModuleIntersection(["counterparties.clients"], grants), ["counterparties.clients"]);
  });

  const db = new OnboardingMemoryDb();
  const created = await onboarding.createPersonWithPrimaryMembership(db, {
    email: "person@example.test", name: "Person", organisationId: "org-a", invitedBy: "admin",
  });
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("create failed");
  const userId = created.userId;

  await test("create provisions one active primary membership", () => {
    const rows = db.memberships.filter((row) => row.user_id === userId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.is_active, true);
    assert.equal(rows[0]?.is_primary, true);
  });

  await test("attach adds a second organisation without leaking its groups", async () => {
    assert.deepEqual(await onboarding.setMembershipGroups(db, userId, "org-a", ["customer-group"]), { ok: true, count: 1 });
    assert.deepEqual(await onboarding.attachPersonMembership(db, {
      userId, organisationId: "org-b", makePrimary: false, invitedBy: "admin",
    }), { ok: true });
    assert.deepEqual(await onboarding.setMembershipGroups(db, userId, "org-b", ["trader-group"]), { ok: true, count: 1 });
    assert.deepEqual([...db.assignments.get(`${userId}:org-a`)!], ["customer-group"]);
    assert.deepEqual([...db.assignments.get(`${userId}:org-b`)!], ["trader-group"]);
  });

  await test("concurrent primary changes still leave exactly one synchronized primary", async () => {
    await Promise.all([
      onboarding.setPrimaryMembership(db, userId, "org-a"),
      onboarding.setPrimaryMembership(db, userId, "org-b"),
      onboarding.setPrimaryMembership(db, userId, "org-a"),
    ]);
    const primary = db.memberships.filter((row) => row.user_id === userId && row.is_active && row.is_primary);
    assert.equal(primary.length, 1);
    assert.equal(db.users.get(userId)?.organisation_id, primary[0]?.organization_id);
  });

  await test("deactivate refuses primary, isolates revocation, and reactivation restores no access", async () => {
    await onboarding.setPrimaryMembership(db, userId, "org-b");
    assert.deepEqual(await onboarding.setMembershipActive(db, userId, "org-b", false), { ok: false, code: "PRIMARY_OR_ONLY_MEMBERSHIP" });
    assert.deepEqual(await onboarding.setMembershipActive(db, userId, "org-a", false), { ok: true });
    assert.equal(db.assignments.has(`${userId}:org-a`), false);
    assert.deepEqual([...db.assignments.get(`${userId}:org-b`)!], ["trader-group"]);
    assert.deepEqual(await onboarding.setMembershipActive(db, userId, "org-a", true), { ok: true });
    assert.equal(db.assignments.has(`${userId}:org-a`), false);
  });

  await test("rejects group access above the target organisation ceiling", async () => {
    assert.deepEqual(await onboarding.setMembershipGroups(db, userId, "org-a", ["trader-group"]), {
      ok: false, code: "ACCESS_ABOVE_ORG_CEILING",
    });
  });

  await test("send and resend use passwordless auth without exposing a secret", async () => {
    let inviteCalls = 0;
    let resendCalls = 0;
    const authAdmin = {
      auth: {
        admin: { inviteUserByEmail: async () => { inviteCalls++; return { data: { user: { id: "auth-1" } }, error: null }; } },
        resend: async () => { resendCalls++; return { error: null }; },
      },
    };
    const sent = await sendPasswordlessInvite(db, authAdmin, userId, "org-a", "admin");
    const resent = await sendPasswordlessInvite(db, authAdmin, userId, "org-a", "admin");
    assert.deepEqual(sent, { ok: true, email: "person@example.test", mode: "sent" });
    assert.deepEqual(resent, { ok: true, email: "person@example.test", mode: "resent" });
    assert.equal(inviteCalls, 1);
    assert.equal(resendCalls, 1);
    assert.doesNotMatch(JSON.stringify([sent, resent]), /token|password|action[_-]?link|auth-1/i);
  });

  await test("mail failure is retryable and does not change membership", async () => {
    const user = db.users.get(userId)!;
    user.auth_user_id = null;
    user.status = "created";
    const membershipsBefore = structuredClone(db.memberships);
    const failingAuth = { auth: { admin: { inviteUserByEmail: async () => ({ data: null, error: { message: "mail unavailable" } }) } } };
    assert.deepEqual(await sendPasswordlessInvite(db, failingAuth, userId, "org-a", "admin"), { ok: false, code: "MAIL_FAILED" });
    assert.deepEqual(db.memberships, membershipsBefore);
    assert.equal(user.auth_user_id, null);
    assert.equal(user.status, "created");
  });

  await test("inactive account and wrong-organisation invite attempts are denied", async () => {
    assert.equal((await onboarding.setPersonAccountActive(db, userId, false)).ok, true);
    let authCalled = false;
    const authAdmin = { auth: { admin: { inviteUserByEmail: async () => { authCalled = true; return { data: null, error: null }; } } } };
    assert.deepEqual(await sendPasswordlessInvite(db, authAdmin, userId, "org-a", "admin"), { ok: false, code: "ONBOARDING_DENIED" });
    assert.deepEqual(await sendPasswordlessInvite(db, authAdmin, userId, "missing-org", "admin"), { ok: false, code: "ONBOARDING_DENIED" });
    assert.equal(authCalled, false);
  });

  console.log(`\n${passed} executable onboarding behavior tests passed.`);
}

void main();
