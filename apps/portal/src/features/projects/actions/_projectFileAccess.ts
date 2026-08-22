import { isValidUUID } from "../../orders/types";
import type { ProjectsActor } from "../access";
import type { locateProjectFile } from "../services/projectFiles";
import type { AllowedProjectsActor, VisibleProjectResult } from "./_projectAuthorization";

type LocatedProjectFile = NonNullable<Awaited<ReturnType<typeof locateProjectFile>>>;

export interface ProjectFileAccessDependencies {
  resolveActor: () => Promise<ProjectsActor>;
  locateFile: typeof locateProjectFile;
  requireProject: (projectId: string, write: boolean) => Promise<VisibleProjectResult>;
}

export type ProjectFileAccessResult =
  | { ok: true; actor: AllowedProjectsActor; file: LocatedProjectFile }
  | { ok: false; error: "File unavailable"; code: "NOT_FOUND" };

const FILE_UNAVAILABLE: ProjectFileAccessResult = {
  ok: false,
  error: "File unavailable",
  code: "NOT_FOUND",
};

/**
 * Resolve a pasted file ID through its owning project. File existence never
 * grants access: the current actor must also pass the production project guard
 * for that exact bilateral leg and requested read/write mode.
 */
export async function authoriseProjectFileWith(
  fileId: string,
  write: boolean,
  dependencies: ProjectFileAccessDependencies,
): Promise<ProjectFileAccessResult> {
  if (!isValidUUID(fileId)) return FILE_UNAVAILABLE;
  const actor = await dependencies.resolveActor();
  if (!actor.ok) return FILE_UNAVAILABLE;
  const file = await dependencies.locateFile(actor.db, fileId);
  if (!file) return FILE_UNAVAILABLE;
  const access = await dependencies.requireProject(file.order_id, write);
  if (!access.ok) return FILE_UNAVAILABLE;
  return { ok: true, actor: access.actor, file };
}
