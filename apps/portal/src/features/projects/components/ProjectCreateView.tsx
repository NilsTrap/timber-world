"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, File, Folder, Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@timber/ui";
import { createProject, type CreatedProject } from "../actions/createProject";
import type { ProjectCreateRole } from "../capabilities";
import {
  MAX_PROJECT_FILE_BYTES,
  normaliseProjectName,
  pathFromBrowserFile,
  projectPathKey,
  replacePathPrefix,
} from "../filePaths";
import type { ProjectsViewer } from "../types";
import { ProjectDropSurface } from "./ProjectDropSurface";
import { uploadProjectBrowserFile } from "./projectUploadClient";

type UploadStatus = "staged" | "uploading" | "done" | "failed";
interface StagedFile {
  id: string;
  file: File;
  relativePath: string;
  status: UploadStatus;
  progress: number;
  error?: string;
}

export function ProjectCreateView({ viewer }: { viewer: ProjectsViewer }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<ProjectCreateRole>(viewer.createRoles[0] ?? "trader");
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [created, setCreated] = useState<CreatedProject | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const folders = useMemo(() => {
    const paths = new Set<string>();
    for (const item of files) {
      const parts = item.relativePath.split("/");
      for (let index = 1; index < parts.length; index++) paths.add(parts.slice(0, index).join("/"));
    }
    return [...paths].sort((a, b) => a.localeCompare(b));
  }, [files]);

  const addFiles = (incoming: File[]) => {
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
      additions.push({ id: crypto.randomUUID(), file, relativePath: path.path, status: "staged", progress: 0 });
    }
    setFiles((current) => [...current, ...additions]);
    setMessage(errors.length ? errors.slice(0, 3).join(" · ") : null);
  };

  const renameFile = (item: StagedFile) => {
    if (item.status === "uploading" || item.status === "done") return;
    const next = window.prompt("Rename file", item.relativePath.split("/").at(-1));
    if (next == null) return;
    const valid = normaliseProjectName(next);
    if (!valid) { setMessage("Enter a valid file name."); return; }
    const parent = item.relativePath.includes("/") ? item.relativePath.slice(0, item.relativePath.lastIndexOf("/")) : "";
    const target = parent ? `${parent}/${valid}` : valid;
    if (files.some((other) => other.id !== item.id && projectPathKey(other.relativePath) === projectPathKey(target))) {
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
    const nextPaths = files.map((item) => replacePathPrefix(item.relativePath, folder, target));
    if (new Set(nextPaths.map(projectPathKey)).size !== nextPaths.length) {
      setMessage("That folder name would create duplicate paths."); return;
    }
    setFiles((current) => current.map((item) => ({ ...item, relativePath: replacePathPrefix(item.relativePath, folder, target) })));
  };

  const removeFolder = (folder: string) => {
    if (!window.confirm(`Remove folder “${folder}” and all staged files inside it?`)) return;
    setFiles((current) => current.filter((item) => item.status === "done" || !item.relativePath.startsWith(`${folder}/`)));
  };

  const uploadOne = async (project: CreatedProject, item: StagedFile) => {
    setFiles((current) => current.map((row) => row.id === item.id ? { ...row, status: "uploading", progress: 1, error: undefined } : row));
    try {
      await uploadProjectBrowserFile(project.id, item.file, item.relativePath, (progress) => {
        setFiles((current) => current.map((row) => row.id === item.id ? { ...row, progress } : row));
      });
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
    for (const item of pending) if (!(await uploadOne(project, item))) failures += 1;
    setCreating(false);
    setMessage(failures ? `${failures} file(s) failed. The project and successful files are saved; retry below.` : "Project saved with all files.");
  };

  const complete = !!created && files.every((file) => file.status === "done");

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

      <ProjectDropSurface disabled={creating || complete} onFiles={addFiles} onError={setMessage} />

      {folders.length > 0 ? (
        <div className="rounded-lg border bg-card divide-y">
          {folders.map((folder) => (
            <div key={folder} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Folder className="h-4 w-4 text-amber-600" />
              <span className="min-w-0 flex-1 truncate" title={folder}>{folder}</span>
              <Button type="button" variant="ghost" size="icon" aria-label={`Rename ${folder}`} onClick={() => renameFolder(folder)}><Pencil className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${folder}`} onClick={() => removeFolder(folder)}><Trash2 className="h-4 w-4" /></Button>
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
              {item.status !== "done" && item.status !== "uploading" ? <Button type="button" variant="ghost" size="icon" aria-label="Rename file" onClick={() => renameFile(item)}><Pencil className="h-4 w-4" /></Button> : null}
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
