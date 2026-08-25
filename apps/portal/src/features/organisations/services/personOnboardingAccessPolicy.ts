export function canOnboardCompanyPerson(input: {
  platformAdmin: boolean;
  hasInviteRight: boolean;
  callerOrgId: string | null;
  callerIsTrader: boolean;
  targetOrgId: string;
  targetIsCustomer: boolean;
  targetIsTrader: boolean;
  directlyAssigned: boolean;
}): boolean {
  if (input.platformAdmin) return true;
  if (!input.callerOrgId || !input.callerIsTrader || !input.hasInviteRight) return false;
  if (input.callerOrgId === input.targetOrgId) return input.targetIsTrader;
  return input.targetIsCustomer && input.directlyAssigned;
}
