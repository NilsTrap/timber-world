import type { ProjectPersona } from "./personas";

export type ProjectCreateRole = "buyer" | "trader";

export interface ProjectCapabilities {
  canCreateProject: boolean;
  canWriteFiles: boolean;
  createRoles: ProjectCreateRole[];
}
/** Rights and role flags are separate inputs on purpose: flags choose which
 * party slot to bind, while effective access rights grant the action. */
export function evaluateProjectCapabilities(input: {
  isPlatformAdmin: boolean;
  hasDealCreate: boolean;
  organisationId: string | null;
  personas: readonly ProjectPersona[];
}): ProjectCapabilities {
  const canWriteFiles = input.isPlatformAdmin || input.hasDealCreate;
  const createRoles: ProjectCreateRole[] = [];
  if (input.personas.includes("buyer")) createRoles.push("buyer");
  if (input.personas.includes("trader")) createRoles.push("trader");

  // A platform admin without a current organisation creates from the platform's
  // default trader entity (the same default used by createDeal).
  if (input.isPlatformAdmin && createRoles.length === 0) createRoles.push("trader");

  return {
    canWriteFiles,
    canCreateProject:
      canWriteFiles &&
      (input.isPlatformAdmin || (!!input.organisationId && createRoles.length > 0)),
    createRoles,
  };
}
