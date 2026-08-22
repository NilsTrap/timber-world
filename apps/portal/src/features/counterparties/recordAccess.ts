import type { CounterpartyBook } from "./types";
import {
  canAccessCounterpartyRecord,
  isOrganisationInBook,
  isOrganisationSelfInBook,
  isValidCounterpartyId,
  type CounterpartyAccessMode,
  type OrganisationBookFacts,
} from "./policy";

export interface AllowedCounterpartyBookAccess {
  ok: true;
  callerOrgId: string | null;
  mode: CounterpartyAccessMode;
  canManage: boolean;
}

export interface DeniedCounterpartyBookAccess {
  ok: false;
  error: string;
  code: string;
}

export type CounterpartyTarget = OrganisationBookFacts & { id: string };

export interface CounterpartyRecordAccessDependencies<
  TAccess extends AllowedCounterpartyBookAccess = AllowedCounterpartyBookAccess,
> {
  resolveBookAccess: (
    book: CounterpartyBook,
  ) => Promise<TAccess | DeniedCounterpartyBookAccess>;
  loadOrganisation: (organisationId: string) => Promise<CounterpartyTarget | null>;
  hasTradingPartnerLink: (
    callerOrgId: string | null,
    targetOrgId: string,
  ) => Promise<boolean>;
}

export type CounterpartyRecordAccessResult<TAccess extends AllowedCounterpartyBookAccess> =
  | (TAccess & { target: CounterpartyTarget })
  | DeniedCounterpartyBookAccess;

const NOT_FOUND: DeniedCounterpartyBookAccess = {
  ok: false,
  error: "Not found",
  code: "NOT_FOUND",
};

/**
 * Exact-book, exact-record production wall with injected fact loaders.
 *
 * Tests provide organisation/link facts only. ID validation, book membership,
 * self/manage rules and the fail-closed response remain production logic.
 */
export async function requireCounterpartyRecordAccessWith<
  TAccess extends AllowedCounterpartyBookAccess,
>(
  book: CounterpartyBook,
  organisationId: string,
  intent: "read" | "manage",
  dependencies: CounterpartyRecordAccessDependencies<TAccess>,
): Promise<CounterpartyRecordAccessResult<TAccess>> {
  if (!isValidCounterpartyId(organisationId)) return NOT_FOUND;

  const access = await dependencies.resolveBookAccess(book);
  if (!access.ok) return access;
  if (intent === "manage" && !access.canManage) return NOT_FOUND;

  const target = await dependencies.loadOrganisation(organisationId);
  if (
    !target ||
    !(
      isOrganisationInBook(target, book) ||
      (access.mode === "self" && isOrganisationSelfInBook(target, book))
    )
  ) {
    return NOT_FOUND;
  }

  const linked =
    access.mode === "manager"
      ? await dependencies.hasTradingPartnerLink(access.callerOrgId, organisationId)
      : false;
  if (
    !canAccessCounterpartyRecord({
      mode: access.mode,
      callerOrgId: access.callerOrgId,
      targetOrgId: organisationId,
      linked,
      intent,
    })
  ) {
    return NOT_FOUND;
  }

  return { ...access, target };
}
