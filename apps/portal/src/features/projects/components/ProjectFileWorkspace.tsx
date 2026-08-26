"use client";

import { useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  Folder,
  FolderInput,
  FolderPlus,
  FolderOpen,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import {
  createProjectFolderAction,
  deleteProjectFileAction,
  deleteProjectFilesAction,
  deleteProjectFolderAction,
  getProjectFileUrlAction,
  moveProjectFileAction,
  moveProjectFolderAction,
  renameProjectFileAction,
  renameProjectFolderAction,
} from "../actions/projectFileActions";
import {
  buildProjectTree,
  isPreviewableProjectFile,
  normaliseProjectName,
  pathFromBrowserFile,
  projectPathKey,
  replacePathPrefix,
  type ProjectTreeNode,
} from "../filePaths";
import type { ProjectFileMeta, ProjectFolderMeta } from "../types";
import { ProjectDropSurface } from "./ProjectDropSurface";
import { ProjectFilePreview, type ProjectPreviewSource } from "./ProjectFilePreview";
import { ProjectFileTypeIcon } from "./projectFileTypes";
import { PROJECT_PREVIEW_COPY } from "./previewCopy";
import { uploadProjectBrowserFile } from "./projectUploadClient";

interface PendingUpload {
  id: string;
  file: File;
  relativePath: string;
  progress: number;
  status: "uploading" | "failed";
  error?: string;
}

export function ProjectFileWorkspace({
  projectId,
  initialFiles,
  initialFolders,
  canWrite,
}: {
  projectId: string;
  initialFiles: ProjectFileMeta[];
  initialFolders: ProjectFolderMeta[];
  canWrite: boolean;
}) {
  const [files, setFiles] = useState(initialFiles);
  const [folders, setFolders] = useState(initialFolders);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProjectPreviewSource | null>(null);
  const [previewRefreshError, setPreviewRefreshError] = useState<string | null>(null);
  const previewRequestRef = useRef(0);
  const tree = useMemo(() => buildProjectTree(files, folders), [files, folders]);
  const folderPaths = useMemo(() => {
    const paths = new Set(folders.map((folder) => folder.relativePath));
    for (const file of files) {
      const segments = file.relativePath.split("/");
      for (let index = 1; index < segments.length; index++) paths.add(segments.slice(0, index).join("/"));
    }
    return [...paths].sort((a, b) => a.localeCompare(b));
  }, [files, folders]);
  const visibleFiles = useMemo(
    () =>
      selectedFolder == null
        ? files
        : files.filter((file) => {
            const parent = file.relativePath.includes("/") ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/")) : "";
            return parent === selectedFolder;
          }),
    [files, selectedFolder],
  );

  const uploadOne = async (item: PendingUpload) => {
    setPending((current) => current.map((row) => row.id === item.id ? { ...row, status: "uploading", progress: 1, error: undefined } : row));
    try {
      const saved = await uploadProjectBrowserFile(projectId, item.file, item.relativePath, (progress) => {
        setPending((current) => current.map((row) => row.id === item.id ? { ...row, progress } : row));
      });
      setFiles((current) => [...current.filter((file) => file.id !== saved.id), saved]);
      const parts = saved.relativePath.split("/");
      const uploadedFolders = parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"));
      setFolders((current) => {
        const occupied = new Set(current.map((folder) => projectPathKey(folder.relativePath)));
        return [...current, ...uploadedFolders.filter((path) => !occupied.has(projectPathKey(path))).map((relativePath) => ({ id: `upload:${relativePath}`, relativePath, createdAt: new Date().toISOString() }))];
      });
      setPending((current) => current.filter((row) => row.id !== item.id));
    } catch (error) {
      setPending((current) => current.map((row) => row.id === item.id ? { ...row, status: "failed", error: (error as Error).message } : row));
    }
  };

  const addFiles = (incoming: File[]) => {
    const fileKeys = new Set([...files.map((file) => file.relativePath), ...pending.map((file) => file.relativePath)].map(projectPathKey));
    const folderKeys = new Set(folderPaths.map(projectPathKey));
    const occupied = new Set(fileKeys);
    const next: PendingUpload[] = [];
    const errors: string[] = [];
    for (const file of incoming) {
      const path = pathFromBrowserFile(file as File & { path?: string });
      if (!path.ok) { errors.push(`${file.name}: ${path.error}`); continue; }
      const key = projectPathKey(path.path);
      const ancestorKeys = path.segments.slice(0, -1).map((_, index) => projectPathKey(path.segments.slice(0, index + 1).join("/")));
      if (occupied.has(key) || folderKeys.has(key)) { errors.push(`${path.path}: duplicate path`); continue; }
      if (ancestorKeys.some((ancestor) => fileKeys.has(ancestor))) { errors.push(`${path.path}: a file blocks this folder path`); continue; }
      occupied.add(projectPathKey(path.path));
      next.push({ id: crypto.randomUUID(), file, relativePath: path.path, progress: 0, status: "uploading" });
    }
    setPending((current) => [...current, ...next]);
    setMessage(errors.length ? errors.join(" · ") : null);
    let cursor = 0;
    const worker = async () => {
      while (cursor < next.length) {
        const item = next[cursor++];
        if (item) await uploadOne(item);
      }
    };
    void Promise.all(Array.from({ length: Math.min(3, next.length) }, () => worker()));
  };

  const createFolder = async () => {
    const value = window.prompt("New folder name", "New folder");
    if (value == null) return;
    const name = normaliseProjectName(value);
    if (!name) { setMessage("Enter a valid folder name."); return; }
    const result = await createProjectFolderAction(projectId, selectedFolder ?? "", name);
    if (!result.success) { setMessage(result.error); return; }
    setFolders((current) => [...current.filter((folder) => folder.id !== result.data.id), result.data]);
    setSelectedFolder(result.data.relativePath);
    setMessage("Folder created.");
  };

  const moveSelectedFiles = async () => {
    if (selectedFileIds.size === 0) return;
    const value = window.prompt(`Move ${selectedFileIds.size} selected file(s) to folder. Leave blank for Project root.\nAvailable: ${folderPaths.join(", ")}`, selectedFolder ?? "");
    if (value == null) return;
    const target = value.trim();
    if (target && !folderPaths.some((path) => projectPathKey(path) === projectPathKey(target))) {
      setMessage("Choose an existing folder."); return;
    }
    const selected = files.filter((file) => selectedFileIds.has(file.id));
    const results = await Promise.all(selected.map((file) => moveProjectFileAction(file.id, target)));
    const failures: string[] = [];
    const replacements = new Map<string, ProjectFileMeta>();
    results.forEach((result, index) => {
      const file = selected[index]!;
      if (result.success) replacements.set(file.id, result.data);
      else failures.push(`${file.fileName}: ${result.error}`);
    });
    setFiles((current) => current.map((file) => replacements.get(file.id) ?? file));
    setSelectedFileIds(new Set());
    setMessage(failures.length ? failures.join(" · ") : `${selected.length} file(s) moved.`);
  };

  const deleteSelectedFiles = async () => {
    if (selectedFileIds.size === 0 || !window.confirm(`Delete ${selectedFileIds.size} selected file(s)? This cannot be undone.`)) return;
    const ids = [...selectedFileIds];
    const deleted = new Set<string>();
    for (let index = 0; index < ids.length; index += 200) {
      const chunk = ids.slice(index, index + 200);
      const result = await deleteProjectFilesAction(chunk);
      if (!result.success) { setMessage(`${deleted.size} deleted; ${chunk.length} failed: ${result.error}`); break; }
      chunk.forEach((id) => deleted.add(id));
    }
    setFiles((current) => current.filter((file) => !deleted.has(file.id)));
    setSelectedFileIds((current) => new Set([...current].filter((id) => !deleted.has(id))));
    if (deleted.size === ids.length) setMessage(`${deleted.size} file(s) deleted.`);
  };

  const renameFile = async (file: ProjectFileMeta) => {
    const value = window.prompt("Rename file", file.fileName);
    if (value == null) return;
    const name = normaliseProjectName(value);
    if (!name) { setMessage("Enter a valid file name."); return; }
    const result = await renameProjectFileAction(file.id, name);
    if (!result.success) { setMessage(result.error); return; }
    setFiles((current) => current.map((row) => row.id === file.id ? result.data : row));
  };

  const renameFolder = async (folderPath: string) => {
    const value = window.prompt("Rename folder", folderPath.split("/").at(-1));
    if (value == null) return;
    const name = normaliseProjectName(value);
    if (!name) { setMessage("Enter a valid folder name."); return; }
    const parent = folderPath.includes("/") ? folderPath.slice(0, folderPath.lastIndexOf("/")) : "";
    const target = parent ? `${parent}/${name}` : name;
    const result = await renameProjectFolderAction(projectId, folderPath, name);
    if (!result.success) { setMessage(result.error); return; }
    setFiles((current) => current.map((file) => ({ ...file, relativePath: replacePathPrefix(file.relativePath, folderPath, target) })));
    setFolders((current) => current.map((folder) => ({ ...folder, relativePath: replacePathPrefix(folder.relativePath, folderPath, target) })));
    setSelectedFolder((current) => current ? replacePathPrefix(current, folderPath, target) : null);
  };

  const moveFolder = async (folderPath: string) => {
    const choices = folderPaths.filter((path) => path !== folderPath && !path.startsWith(`${folderPath}/`));
    const value = window.prompt(`Move “${folderPath}” into folder. Leave blank for Project root.\nAvailable: ${choices.join(", ")}`, "");
    if (value == null) return;
    const targetParent = value.trim();
    if (targetParent && !choices.some((path) => projectPathKey(path) === projectPathKey(targetParent))) {
      setMessage("Choose an existing folder outside this folder."); return;
    }
    const result = await moveProjectFolderAction(projectId, folderPath, targetParent);
    if (!result.success) { setMessage(result.error); return; }
    const target = result.data.targetPath;
    setFiles((current) => current.map((file) => ({ ...file, relativePath: replacePathPrefix(file.relativePath, folderPath, target) })));
    setFolders((current) => current.map((folder) => ({ ...folder, relativePath: replacePathPrefix(folder.relativePath, folderPath, target) })));
    setSelectedFolder((current) => current ? replacePathPrefix(current, folderPath, target) : null);
    setMessage("Folder moved.");
  };

  const deleteFile = async (file: ProjectFileMeta) => {
    if (!window.confirm(`Delete “${file.fileName}”? This cannot be undone.`)) return;
    const result = await deleteProjectFileAction(file.id);
    if (!result.success) { setMessage(result.error); return; }
    setFiles((current) => current.filter((row) => row.id !== file.id));
    setSelectedFileIds((current) => { const next = new Set(current); next.delete(file.id); return next; });
  };

  const deleteFolder = async (folderPath: string) => {
    const descendants = files.filter((file) => projectPathKey(file.relativePath).startsWith(`${projectPathKey(folderPath)}/`));
    if (!window.confirm(`Delete “${folderPath}” and ${descendants.length} file(s)? This cannot be undone.`)) return;
    const result = await deleteProjectFolderAction(projectId, folderPath, descendants.map((file) => file.id));
    if (!result.success) { setMessage(result.error); return; }
    setFiles((current) => current.filter((file) => !file.relativePath.startsWith(`${folderPath}/`)));
    setFolders((current) => current.filter((folder) => folder.relativePath !== folderPath && !folder.relativePath.startsWith(`${folderPath}/`)));
    setSelectedFileIds((current) => new Set([...current].filter((id) => !files.some((file) => file.id === id && file.relativePath.startsWith(`${folderPath}/`)))));
    if (selectedFolder === folderPath || selectedFolder?.startsWith(`${folderPath}/`)) setSelectedFolder(null);
  };

  const openPreview = async (file: ProjectFileMeta) => {
    const requestId = ++previewRequestRef.current;
    setPreviewRefreshError(null);
    const result = await getProjectFileUrlAction(file.id, "preview");
    if (requestId !== previewRequestRef.current) return;
    if (!result.success) { setMessage(result.error); return; }
    setPreview({ fileId: file.id, url: result.data.url, fileName: result.data.fileName, mimeType: result.data.mimeType });
  };

  const refreshPreview = async () => {
    if (!preview) return;
    const fileId = preview.fileId;
    const requestId = previewRequestRef.current;
    setPreviewRefreshError(null);
    const result = await getProjectFileUrlAction(fileId, "preview");
    if (requestId !== previewRequestRef.current) return;
    if (!result.success) {
      setPreviewRefreshError(result.error);
      return;
    }
    setPreview((current) => {
      if (current?.fileId !== fileId) return current;
      return { ...current, url: result.data.url, fileName: result.data.fileName, mimeType: result.data.mimeType };
    });
  };

  const download = async (file: ProjectFileMeta) => {
    const result = await getProjectFileUrlAction(file.id, "download");
    if (!result.success) { setMessage(result.error); return; }
    const anchor = document.createElement("a");
    anchor.href = result.data.url;
    anchor.download = result.data.fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <div className="space-y-3">
      {canWrite ? <ProjectDropSurface onFiles={addFiles} onError={setMessage} /> : null}
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
          <Button type="button" size="sm" variant="outline" onClick={createFolder}>
            <FolderPlus className="mr-1.5 h-4 w-4" /> New folder
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={selectedFileIds.size === 0} onClick={moveSelectedFiles}>
            <FolderInput className="mr-1.5 h-4 w-4" /> Move selected
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={selectedFileIds.size === 0} onClick={deleteSelectedFiles}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete selected
          </Button>
          {files.length > 0 ? (
            <label className="ml-auto flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedFileIds.size === files.length ? true : selectedFileIds.size > 0 ? "indeterminate" : false}
                onCheckedChange={(checked) => setSelectedFileIds(checked === true ? new Set(files.map((file) => file.id)) : new Set())}
              />
              Select all
            </label>
          ) : null}
        </div>
      ) : null}
      {pending.length > 0 ? (
        <div className="rounded-lg border bg-card divide-y">
          {pending.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3">
              {item.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <ProjectFileTypeIcon fileName={item.file.name} mimeType={item.file.type || null} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={item.relativePath}>{item.relativePath}</p>
                {item.status === "uploading" ? (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${item.progress}%` }} />
                  </div>
                ) : <p className="text-xs text-destructive">{item.error}</p>}
              </div>
              {item.status === "failed" ? <Button type="button" size="sm" variant="outline" onClick={() => uploadOne(item)}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry</Button> : null}
              {item.status === "failed" ? <Button type="button" size="icon" variant="ghost" aria-label="Remove failed upload" onClick={() => setPending((current) => current.filter((row) => row.id !== item.id))}><Trash2 className="h-4 w-4" /></Button> : null}
            </div>
          ))}
        </div>
      ) : null}
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}

      {files.length === 0 && folders.length === 0 && pending.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">No files in this workspace.</div>
      ) : files.length > 0 || folders.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="hidden rounded-lg border bg-card p-2 md:block">
            <button type="button" className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${selectedFolder == null ? "bg-muted font-medium" : "hover:bg-muted/60"}`} onClick={() => setSelectedFolder(null)}>
              <FolderOpen className="h-4 w-4 text-amber-600" /> All files
            </button>
            <TreeNodes nodes={tree} selected={selectedFolder} onSelect={setSelectedFolder} canWrite={canWrite} onRename={renameFolder} onMove={moveFolder} onDelete={deleteFolder} />
          </div>
          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
            <Table dense>
              <TableHeader><TableRow><TableHead className="w-10"><span className="sr-only">Select</span></TableHead><TableHead>Name</TableHead><TableHead>Folder</TableHead><TableHead>Size</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{visibleFiles.map((file) => <WorkspaceRow key={file.id} file={file} selected={selectedFileIds.has(file.id)} onSelected={(checked) => setSelectedFileIds((current) => { const next = new Set(current); if (checked) next.add(file.id); else next.delete(file.id); return next; })} canWrite={canWrite} onPreview={openPreview} onDownload={download} onRename={renameFile} onDelete={deleteFile} />)}</TableBody>
            </Table>
          </div>
          <div className="rounded-lg border bg-card divide-y md:hidden">
            <MobileFolderRows nodes={tree} canWrite={canWrite} onRename={renameFolder} onMove={moveFolder} onDelete={deleteFolder} />
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 p-3">
                {canWrite ? <Checkbox checked={selectedFileIds.has(file.id)} onCheckedChange={(checked) => setSelectedFileIds((current) => { const next = new Set(current); if (checked === true) next.add(file.id); else next.delete(file.id); return next; })} aria-label={`Select ${file.fileName}`} /> : null}
                <ProjectFileTypeIcon fileName={file.fileName} mimeType={file.mimeType} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={file.relativePath}>{file.relativePath}</p><p className="text-xs text-muted-foreground">{formatBytes(file.fileSizeBytes)}</p></div>
                <FileActions file={file} canWrite={canWrite} onPreview={openPreview} onDownload={download} onRename={renameFile} onDelete={deleteFile} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) { previewRequestRef.current++; setPreview(null); setPreviewRefreshError(null); } }}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader><DialogTitle>{preview?.fileName}</DialogTitle><DialogDescription>{PROJECT_PREVIEW_COPY.description}</DialogDescription></DialogHeader>
          {preview ? <ProjectFilePreview source={preview} onRetry={refreshPreview} refreshError={previewRefreshError} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MobileFolderRows({ nodes, canWrite, onRename, onMove, onDelete, depth = 0 }: { nodes: ProjectTreeNode[]; canWrite: boolean; onRename: (path: string) => void; onMove: (path: string) => void; onDelete: (path: string) => void; depth?: number }) {
  return <>{nodes.filter((node) => node.kind === "folder").map((node) => <div key={node.path}><div className="flex min-h-12 items-center gap-2 p-2" style={{ paddingLeft: `${8 + depth * 12}px` }}><Folder className="h-4 w-4 shrink-0 text-amber-600" /><p className="min-w-0 flex-1 truncate text-sm font-medium" title={node.path}>{node.name}</p>{canWrite ? <div className="flex shrink-0"><Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Rename folder ${node.path}`} onClick={() => onRename(node.path)}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Move folder ${node.path}`} onClick={() => onMove(node.path)}><FolderInput className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Delete folder ${node.path}`} onClick={() => onDelete(node.path)}><Trash2 className="h-4 w-4" /></Button></div> : null}</div><MobileFolderRows nodes={node.children} canWrite={canWrite} onRename={onRename} onMove={onMove} onDelete={onDelete} depth={depth + 1} /></div>)}</>;
}

function TreeNodes({ nodes, selected, onSelect, canWrite, onRename, onMove, onDelete, depth = 0 }: { nodes: ProjectTreeNode[]; selected: string | null; onSelect: (path: string) => void; canWrite: boolean; onRename: (path: string) => void; onMove: (path: string) => void; onDelete: (path: string) => void; depth?: number }) {
  return <>{nodes.filter((node) => node.kind === "folder").map((node) => <div key={node.path}><div className={`group flex items-center rounded ${selected === node.path ? "bg-muted" : "hover:bg-muted/60"}`} style={{ paddingLeft: `${depth * 12}px` }}><button type="button" className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm" onClick={() => onSelect(node.path)}><Folder className="h-4 w-4 shrink-0 text-amber-600" /><span className="truncate" title={node.name}>{node.name}</span></button>{canWrite ? <><Button type="button" variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Rename ${node.name}`} onClick={() => onRename(node.path)}><Pencil className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Move ${node.name}`} onClick={() => onMove(node.path)}><FolderInput className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${node.name}`} onClick={() => onDelete(node.path)}><Trash2 className="h-3.5 w-3.5" /></Button></> : null}</div><TreeNodes nodes={node.children} selected={selected} onSelect={onSelect} canWrite={canWrite} onRename={onRename} onMove={onMove} onDelete={onDelete} depth={depth + 1} /></div>)}</>;
}

function WorkspaceRow({ file, selected, onSelected, canWrite, onPreview, onDownload, onRename, onDelete }: { file: ProjectFileMeta; selected: boolean; onSelected: (checked: boolean) => void; canWrite: boolean; onPreview: (file: ProjectFileMeta) => void; onDownload: (file: ProjectFileMeta) => void; onRename: (file: ProjectFileMeta) => void; onDelete: (file: ProjectFileMeta) => void }) {
  const parent = file.relativePath.includes("/") ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/")) : "—";
  return <TableRow><TableCell>{canWrite ? <Checkbox checked={selected} onCheckedChange={(checked) => onSelected(checked === true)} aria-label={`Select ${file.fileName}`} /> : null}</TableCell><TableCell><span className="flex min-w-0 items-center gap-2"><ProjectFileTypeIcon fileName={file.fileName} mimeType={file.mimeType} /><span className="max-w-[18rem] truncate font-medium whitespace-nowrap" title={file.fileName}>{file.fileName}</span></span></TableCell><TableCell className="max-w-[14rem] truncate" title={parent}>{parent}</TableCell><TableCell>{formatBytes(file.fileSizeBytes)}</TableCell><TableCell className="capitalize">{file.lifecycleStatus}</TableCell><TableCell><div className="flex justify-end"><FileActions file={file} canWrite={canWrite} onPreview={onPreview} onDownload={onDownload} onRename={onRename} onDelete={onDelete} /></div></TableCell></TableRow>;
}

function FileActions({ file, canWrite, onPreview, onDownload, onRename, onDelete }: { file: ProjectFileMeta; canWrite: boolean; onPreview: (file: ProjectFileMeta) => void; onDownload: (file: ProjectFileMeta) => void; onRename: (file: ProjectFileMeta) => void; onDelete: (file: ProjectFileMeta) => void }) {
  const previewable = isPreviewableProjectFile(file.fileName, file.mimeType);
  return <div className="flex items-center"><Button type="button" variant="ghost" size="icon" disabled={!previewable} aria-label={previewable ? `Preview ${file.fileName}` : `Preview unavailable for ${file.fileName}`} onClick={() => onPreview(file)}><Eye className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Download ${file.fileName}`} onClick={() => onDownload(file)}><Download className="h-4 w-4" /></Button>{canWrite ? <><Button type="button" variant="ghost" size="icon" aria-label={`Rename ${file.fileName}`} onClick={() => onRename(file)}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${file.fileName}`} onClick={() => onDelete(file)}><Trash2 className="h-4 w-4" /></Button></> : null}</div>;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
