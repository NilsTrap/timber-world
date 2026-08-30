"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, File, Folder, FolderPlus, Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@timber/ui";
import { createProject, type CreatedProject } from "../actions/createProject";
import { createProjectFolderAction } from "../actions/projectFileActions";
import type { ProjectCreateRole } from "../capabilities";
import {
  MAX_PROJECT_FILE_BYTES,
  normaliseProjectName,
  normaliseProjectPath,
  pathFromBrowserFile,
  projectPathKey,
  replacePathPrefix,
} from "../filePaths";
import type { ProjectsViewer } from "../types";
import { ProjectDropSurface } from "./ProjectDropSurface";
import { uploadProjectBrowserArchive, uploadProjectBrowserFile } from "./projectUploadClient";

type UploadStatus = "staged" | "uploading" | "done" | "failed";
interface StagedFile {
  id: string;
  file: File;
  relativePath: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  kind: "file" | "archive";
}

export function ProjectCreateView({ viewer }: { viewer: ProjectsViewer }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<ProjectCreateRole>(viewer.createRoles[0] ?? "trader");
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [manualFolders, setManualFolders] = useState<string[]>([]);
  const [createdFolderPaths, setCreatedFolderPaths] = useState<Set<string>>(new Set());
  const [created, setCreated] = useState<CreatedProject | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const folders = useMemo(() => {
    const paths = new Set<string>();
    manualFolders.forEach((path) => paths.add(path));
    for (const item of files) {
      const parts = item.relativePath.split("/");
      for (let index = 1; index < parts.length; index++) paths.add(parts.slice(0, index).join("/"));
    }
    return [...paths].sort((a, b) => a.localeCompare(b));
  }, [files, manualFolders]);

  const addFolder = () => {
    const value = window.prompt("New folder path", "New folder");
    if (value == null) return;
    const path = normaliseProjectPath(value.trim());
    if (!path.ok) { setMessage(path.error); return; }
    const additions = path.segments.map((_, index) => path.segments.slice(0, index + 1).join("/"));
    const fileKeys = new Set(files.map((item) => projectPathKey(item.relativePath)));
    const blocked = additions.find((folder) => fileKeys.has(projectPathKey(folder)));
    if (blocked) { setMessage(`${blocked}: a file already uses this path.`); return; }
    const occupied = new Set(folders.map(projectPathKey));
    setManualFolders((current) => [...current, ...additions.filter((folder) => !occupied.has(projectPathKey(folder)))]);
  };

  const addFiles = (incoming: File[]) => {
    const occupied = new Set(files.map((item) => projectPathKey(item.relativePath)));
    const folderKeys = new Set(manualFolders.map(projectPathKey));
    const existingFileKeys = new Set(occupied);
    const additions: StagedFile[] = [];
    const errors: string[] = [];
    for (const file of incoming) {
      const path = pathFromBrowserFile(file as File & { path?: string });
      if (!path.ok) { errors.push(`${file.name}: ${path.error}`); continue; }
      if (file.size > MAX_PROJECT_FILE_BYTES) { errors.push(`${path.path}: over 100 MB`); continue; }
      const key = projectPathKey(path.path);
      const ancestorKeys = path.segments.slice(0, -1).map((_, index) => projectPathKey(path.segments.slice(0, index + 1).join("/")));
      if (occupied.has(key) || folderKeys.has(key)) { errors.push(`${path.path}: duplicate path`); continue; }
      if (ancestorKeys.some((ancestor) => existingFileKeys.has(ancestor))) { errors.push(`${path.path}: a file blocks this folder path`); continue; }
      occupied.add(key);
      additions.push({ id: crypto.randomUUID(), file, relativePath: path.path, status: "staged", progress: 0, kind: "file" });
    }
    setFiles((current) => [...current, ...additions]);
    setMessage(errors.length ? errors.join(" · ") : null);
  };

  const addArchives = (incoming: File[]) => {
    const occupied = new Set(files.map((item) => projectPathKey(item.relativePath)));
    const additions: StagedFile[] = [];
    const errors: string[] = [];
    for (const file of incoming) {
      const path = pathFromBrowserFile(file as File & { path?: string });
      if (!path.ok) { errors.push(`${file.name}: ${path.error}`); continue; }
      if (file.size > MAX_PROJECT_FILE_BYTES) { errors.push(`${path.path}: over 100 MB`); continue; }
      const key = projectPathKey(path.path);
      if (occupied.has(key)) { errors.push(`${path.path}: duplicate path`); continue; }
      occupied.add(key);
      additions.push({ id: crypto.randomUUID(), file, relativePath: path.path, status: "staged", progress: 0, kind: "archive" });
    }
    setFiles((current) => [...current, ...additions]);
    setMessage(errors.length ? errors.join(" · ") : null);
  };

  const renameFile = (item: StagedFile) => {
    if (item.status === "uploading" || item.status === "done") return;
    const next = window.prompt("Rename file", item.relativePath.split("/").at(-1));
    if (next == null) return;
    const valid = normaliseProjectName(next);
    if (!valid) { setMessage("Enter a valid file name."); return; }
    const parent = item.relativePath.includes("/") ? item.relativePath.slice(0, item.relativePath.lastIndexOf("/")) : "";
    const target = parent ? `${parent}/${valid}` : valid;
    if (files.some((other) => other.id !== item.id && projectPathKey(other.relativePath) === projectPathKey(target))
      || manualFolders.some((folder) => projectPathKey(folder) === projectPathKey(target))) {
      setMessage("That name is already used in this folder."); return;
    }
    setFiles((current) => current.map((other) => other.id === item.id ? { ...other, relativePath: target } : other));
  };

  const renameFolder = (folder: string) => {
    if (files.some((item) => item.status === "uploading" || (item.status === "done" && item.relativePath.startsWith(`${folder}/`)))) return;
    const next = window.prompt("Rename folder", folder.split("/").at(-1));
    if (next == null) return;
    const valid = normaliseProjectName(next);
    if (!valid) { setMessage("Enter a valid folder name."); return; }
    const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
    const target = parent ? `${parent}/${valid}` : valid;
    if (files.some((item) => !item.relativePath.startsWith(`${folder}/`) && projectPathKey(item.relativePath) === projectPathKey(target))
      || folders.some((path) => path !== folder && !path.startsWith(`${folder}/`) && projectPathKey(path) === projectPathKey(target))) {
      setMessage("That folder name is already used."); return;
    }
    const nextPaths = files.map((item) => replacePathPrefix(item.relativePath, folder, target));
    if (new Set(nextPaths.map(projectPathKey)).size !== nextPaths.length) {
      setMessage("That folder name would create duplicate paths."); return;
    }
    setFiles((current) => current.map((item) => ({ ...item, relativePath: replacePathPrefix(item.relativePath, folder, target) })));
    setManualFolders((current) => current.map((path) => replacePathPrefix(path, folder, target)));
  };

  const removeFolder = (folder: string) => {
    if (!window.confirm(`Remove folder “${folder}” and all staged files inside it?`)) return;
    setFiles((current) => current.filter((item) => item.status === "done" || !item.relativePath.startsWith(`${folder}/`)));
    setManualFolders((current) => current.filter((path) => path !== folder && !path.startsWith(`${folder}/`)));
  };

  const uploadOne = async (project: CreatedProject, item: StagedFile) => {
    setFiles((current) => current.map((row) => row.id === item.id ? { ...row, status: "uploading", progress: 1, error: undefined } : row));
    try {
      const onProgress = (progress: number) => {
        setFiles((current) => current.map((row) => row.id === item.id ? { ...row, progress } : row));
      };
      const parent = item.relativePath.includes("/") ? item.relativePath.slice(0, item.relativePath.lastIndexOf("/")) : "";
      if (item.kind === "archive") await uploadProjectBrowserArchive(project.id, item.file, parent, onProgress);
      else await uploadProjectBrowserFile(project.id, item.file, item.relativePath, onProgress);
      setFiles((current) => current.map((row) => row.id === item.id ? { ...row, status: "done", progress: 100 } : row));
      return true;
    } catch (error) {
      setFiles((current) => current.map((row) => row.id === item.id ? { ...row, status: "failed", error: (error as Error).message } : row));
      return false;
    }
  };

  const submit = async () => {
    const projectName = name.normalize("NFC").trim();
    if (!projectName) { setMessage("Enter a project name."); return; }
    setMessage(null);
    setCreating(true);
    let project = created;
    if (!project) {
      const result = await createProject({ name: projectName, role, idempotencyKey });
      if (!result.success) { setMessage(result.error); setCreating(false); return; }
      project = result.data;
      setCreated(project);
    }
    const pending = files.filter((item) => item.status === "staged" || item.status === "failed");
    let failures = 0;
    for (const folderPath of manualFolders.filter((path) => !createdFolderPaths.has(projectPathKey(path))).sort((a, b) => a.split("/").length - b.split("/").length)) {
      const parent = folderPath.includes("/") ? folderPath.slice(0, folderPath.lastIndexOf("/")) : "";
      const name = folderPath.split("/").at(-1)!;
      const folderResult = await createProjectFolderAction(project.id, parent, name);
      if (folderResult.success || folderResult.code === "FOLDER_EXISTS") {
        setCreatedFolderPaths((current) => new Set(current).add(projectPathKey(folderPath)));
      } else failures += 1;
    }
    for (const item of pending) if (!(await uploadOne(project, item))) failures += 1;
    setCreating(false);
    setMessage(failures ? `${failures} item(s) failed. The project and successful items are saved; retry below.` : "Project saved with all files and folders.");
  };

  const complete = !!created
    && files.every((file) => file.status === "done")
    && manualFolders.every((path) => createdFolderPaths.has(projectPathKey(path)));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">New project</h1>
        <p className="text-muted-foreground">Name the project and add any files or folders.</p>
      </div>

      {viewer.createRoles.length > 1 ? (
        <div className="space-y-2">
          <Label>Create as</Label>
          <div className="flex gap-2">
            {viewer.createRoles.map((option) => (
              <Button key={option} type="button" size="sm" variant={role === option ? "default" : "outline"} onClick={() => setRole(option)} disabled={!!created}>
                {option === "buyer" ? "Buyer" : "Trader"}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="project-name">Project name</Label>
        <Input id="project-name" value={name} maxLength={255} disabled={!!created} onChange={(event) => setName(event.target.value)} placeholder="e.g. Oak stair components" />
      </div>

      <ProjectDropSurface disabled={creating || complete} onFiles={addFiles} onArchives={addArchives} onError={setMessage} />

      {!created ? <div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={addFolder}><FolderPlus className="mr-1.5 h-4 w-4" /> New folder</Button></div> : null}

      {folders.length > 0 ? (
        <div className="rounded-lg border bg-card divide-y">
          {folders.map((folder) => (
            <div key={folder} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Folder className="h-4 w-4 text-amber-600" />
              <span className="min-w-0 flex-1 truncate" title={folder}>{folder}</span>
              {!created ? <Button type="button" variant="ghost" size="icon" aria-label={`Rename ${folder}`} onClick={() => renameFolder(folder)}><Pencil className="h-4 w-4" /></Button> : null}
              {!created ? <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${folder}`} onClick={() => removeFolder(folder)}><Trash2 className="h-4 w-4" /></Button> : null}
            </div>
          ))}
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="rounded-lg border bg-card divide-y">
          {files.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3">
              {item.status === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : item.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <File className="h-4 w-4 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={item.relativePath}>{item.relativePath}</p>
                <p className={`text-xs ${item.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{item.error ?? `${formatBytes(item.file.size)} · ${item.status}`}</p>
                {item.status === "uploading" ? (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${item.progress}%` }} />
                  </div>
                ) : null}
              </div>
              {item.status === "failed" && created ? <Button type="button" variant="outline" size="sm" onClick={() => uploadOne(created, item)}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry</Button> : null}
              {item.kind === "file" && item.status !== "done" && item.status !== "uploading" ? <Button type="button" variant="ghost" size="icon" aria-label="Rename file" onClick={() => renameFile(item)}><Pencil className="h-4 w-4" /></Button> : null}
              {item.status !== "done" && item.status !== "uploading" ? <Button type="button" variant="ghost" size="icon" aria-label="Remove file" onClick={() => setFiles((current) => current.filter((row) => row.id !== item.id))}><Trash2 className="h-4 w-4" /></Button> : null}
            </div>
          ))}
        </div>
      ) : null}

      {message ? <p role="status" className={complete ? "text-sm text-emerald-700" : "text-sm text-muted-foreground"}>{message}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline"><Link href="/projects">Cancel</Link></Button>
        {complete && created ? <Button asChild><Link href={`/projects/${created.id}`}>Open {created.reference}</Link></Button> : <Button type="button" onClick={submit} disabled={creating || !name.trim()}>{creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : created ? "Retry failed files" : "Create project"}</Button>}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
