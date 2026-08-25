/**
 * K3/Q2 · Client-facing DTOs for the "Add person" flow.
 *
 * Plain types-only module (NO "use server", NO runtime code) so it can be
 * imported by BOTH the server actions and the client dialog. A "use server"
 * file may not `export type`/`export interface` (it breaks every server action
 * on the route at runtime — the type-export trap), so these live here instead.
 */

/** How the current caller may add people to a given organisation. */
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
  /** Recommended by the organisation's Buyer/Trader/Manufacturer persona. */
  recommended: boolean;
}

/** Dialog bootstrap. The inherited role is informational; the server assigns it. */
export interface AddPersonContext {
  mode: AddPersonMode;
  orgName: string | null;
  /** Retained for DTO compatibility. Company-user onboarding never exposes it. */
  groups: AddPersonGroupOption[];
  /** Single role preset inherited from the target company. */
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
  status: "created" | "invited" | "active";
  isActive: boolean;
  membershipActive: boolean;
}
