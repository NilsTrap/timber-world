import {
  Box,
  DraftingCompass,
  File,
  FileArchive,
  FileCode2,
  FileCog,
  FileImage,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { classifyProjectFile, type ProjectFileKind } from "../filePaths";
import { PROJECT_FILE_TYPE_LABELS } from "./previewCopy";

interface ProjectFilePresentation {
  kind: ProjectFileKind;
  labelKey: ProjectFileKind;
  Icon: LucideIcon;
  className: string;
}

const FILE_PRESENTATIONS: Record<ProjectFileKind, ProjectFilePresentation> = {
  pdf: { kind: "pdf", labelKey: "pdf", Icon: FileText, className: "text-red-600" },
  image: { kind: "image", labelKey: "image", Icon: FileImage, className: "text-violet-600" },
  html: { kind: "html", labelKey: "html", Icon: FileCode2, className: "text-orange-600" },
  dxf: { kind: "dxf", labelKey: "dxf", Icon: DraftingCompass, className: "text-sky-600" },
  step: { kind: "step", labelKey: "step", Icon: Box, className: "text-blue-600" },
  nc1: { kind: "nc1", labelKey: "nc1", Icon: FileCog, className: "text-slate-600" },
  document: { kind: "document", labelKey: "document", Icon: FileText, className: "text-indigo-600" },
  spreadsheet: { kind: "spreadsheet", labelKey: "spreadsheet", Icon: FileSpreadsheet, className: "text-emerald-600" },
  archive: { kind: "archive", labelKey: "archive", Icon: FileArchive, className: "text-amber-600" },
  code: { kind: "code", labelKey: "code", Icon: FileCode2, className: "text-fuchsia-600" },
  unknown: { kind: "unknown", labelKey: "unknown", Icon: File, className: "text-muted-foreground" },
};

export function getProjectFilePresentation(fileName: string, mimeType: string | null): ProjectFilePresentation {
  return FILE_PRESENTATIONS[classifyProjectFile(fileName, mimeType)];
}

export function ProjectFileTypeIcon({
  fileName,
  mimeType,
  className = "h-4 w-4",
}: {
  fileName: string;
  mimeType: string | null;
  className?: string;
}) {
  const presentation = getProjectFilePresentation(fileName, mimeType);
  const label = PROJECT_FILE_TYPE_LABELS[presentation.labelKey];
  return (
    <span className="inline-flex shrink-0" role="img" aria-label={`${label} file`} title={label}>
      <presentation.Icon className={`${className} ${presentation.className}`} aria-hidden="true" />
    </span>
  );
}
