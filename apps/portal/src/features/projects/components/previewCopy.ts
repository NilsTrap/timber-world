import type { ProjectFileKind } from "../filePaths";

export const PROJECT_PREVIEW_COPY = {
  description: "Interactive preview from a temporary, access-controlled link.",
  prepareHtml: "Preparing HTML preview…",
  loadDxf: "Loading DXF viewer…",
  loadStep: "Loading STEP viewer…",
  unavailable: "Preview is unavailable for this file type.",
  viewerError: "The preview viewer could not be loaded.",
  refresh: "Refresh preview",
  retryFresh: "Retry with a fresh link",
  nativeLoading: "Loading preview…",
  nativeError: "Unable to load this preview.",
  htmlSanitizing: "Preparing safe HTML report…",
  htmlError: "Unable to display this HTML report.",
  htmlAria: "Safe HTML report",
  dxfParsing: "Parsing DXF drawing…",
  dxfError: "Unable to display this DXF drawing.",
  fitDrawing: "Fit drawing",
  layers: "Layers:",
  dxfAria: "Interactive DXF drawing",
  stepTriangulating: "Triangulating STEP model…",
  stepError: "Unable to display this STEP model.",
  fitModel: "Fit model",
  stepAria: "Interactive STEP model",
  visualReference: "Visual reference only",
} as const;

export const PROJECT_FILE_TYPE_LABELS: Record<ProjectFileKind, string> = {
  pdf: "PDF", image: "Image", html: "HTML report", dxf: "DXF drawing", step: "STEP model",
  nc1: "NC1 machine file", document: "Document", spreadsheet: "Spreadsheet", archive: "Archive",
  code: "Code", unknown: "File",
};
