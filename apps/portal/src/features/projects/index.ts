/** Timber Projects — public surface of the feature module. */
export { isTimberProjectsEnabled } from "./config";
export { evaluateProjectsGate, PROJECTS_MODULE } from "./gate";
export type { ProjectsGateInput, ProjectsGateDecision } from "./gate";
export {
  PERSONA_LABEL,
  PERSONA_SHORT_LABEL,
  PERSONA_ORDER,
  personasForOrg,
  personaSummary,
  orgRoleFlagsFromRow,
} from "./personas";
export type { ProjectPersona, OrgRoleFlags } from "./personas";
export { listProjects } from "./actions/getProjects";
export { getProject } from "./actions/getProject";
export { ProjectsListView } from "./components/ProjectsListView";
export { ProjectDetailView } from "./components/ProjectDetailView";
export type {
  ProjectDetail,
  ProjectFileCounts,
  ProjectFileMeta,
  ProjectLine,
  ProjectListItem,
  ProjectPartyRef,
  ProjectTerms,
  ProjectsViewer,
} from "./types";
