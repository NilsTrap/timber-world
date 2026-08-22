/**
 * K3/Q2 · Client-facing DTOs for the "Add person" flow.
 *
 * Plain types-only module (NO "use server", NO runtime code) so it can be
 * imported by BOTH the server actions and the client dialog. A "use server"
 * file may not `export type`/`export interface` (it breaks every server action
 * on the route at runtime — the type-export trap), so these live here instead.
 */

/** How the current caller may add people to a given organisation.
 *  - admin:  unrestricted — full access-group picker, any org.
 *  - scoped: book-scoped non-admin (salesperson/purchasing) — the access group
 *            is FORCED server-side (no picker) and only eligible orgs are offered.
 *  - forbidden: the caller may not add people to this org. */
export type AddPersonMode = "admin" | "scoped" | "forbidden";

/** An access group the admin may pick in the inline group step. */
export interface AddPersonGroupOption {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  effectiveModules: string[];
  unavailableModules: string[];
  disabled: boolean;
}

/** Dialog bootstrap: who the caller is for THIS org + the group choices.
 *  The client uses this only to render — the server re-derives and enforces
 *  everything on the actual create/add call (the client is never the wall). */
export interface AddPersonContext {
  mode: AddPersonMode;
  orgName: string | null;
  /** admin mode only: the assignable access groups for the inline picker. */
  groups: AddPersonGroupOption[];
  /** scoped mode only: the single group the server WILL force (shown read-only). */
  forcedGroupId: string | null;
  forcedGroupName: string | null;
}

/** A candidate existing platform user for the typeahead "add existing" branch. */
export interface AddablePerson {
  id: string;
  email: string;
  name: string;
  /** Already an active member of the target org — the UI disables "Add". */
  alreadyMember: boolean;
}
