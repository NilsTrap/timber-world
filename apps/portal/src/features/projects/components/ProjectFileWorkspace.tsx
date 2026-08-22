"use client";

import { useMemo, useState } from "react";
import {
  Download,
  Eye,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  Button,
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
  deleteProjectFileAction,
  deleteProjectFolderAction,
  getProjectFileUrlAction,
  renameProjectFileAction,
  renameProjectFolderAction,
} from "../actions/projectFileActions";
import {
  buildProjectTree,
  isPreviewableProjectMimeType,
  normaliseProjectName,
  pathFromBrowserFile,
  projectPathKey,
  replacePathPrefix,
  type ProjectTreeNode,
} from "../filePaths";
import type { ProjectFileMeta } from "../types";
import { ProjectDropSurface } from "./ProjectDropSurface";
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
  canWrite,
}: {
  projectId: string;
  initialFiles: ProjectFileMeta[];
  canWrite: boolean;
}) {
  const [files, setFiles] = useState(initialFiles);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const tree = useMemo(() => buildProjectTree(files), [files]);
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
      setPending((current) => current.filter((row) => row.id !== item.id));
    } catch (error) {
      setPending((current) => current.map((row) => row.id === item.id ? { ...row, status: "failed", error: (error as Error).message } : row));
    }
  };

  const addFiles = (incoming: File[]) => {
    const occupied = new Set([...files.map((file) => file.relativePath), ...pending.map((file) => file.relativePath)].map(projectPathKey));
    const next: PendingUpload[] = [];
    const errors: string[] = [];
    for (const file of incoming) {
      const path = pathFromBrowserFile(file as File & { path?: string });
      if (!path.ok) { errors.push(`${file.name}: ${path.error}`); continue; }
      if (occupied.has(projectPathKey(path.path))) { errors.push(`${path.path}: duplicate path`); continue; }
      occupied.add(projectPathKey(path.path));
      next.push({ id: crypto.randomUUID(), file, relativePath: path.path, progress: 0, status: "uploading" });
    }
    setPending((current) => [...current, ...next]);
    setMessage(errors.length ? errors.slice(0, 3).join(" · ") : null);
    next.forEach((item) => void uploadOne(item));
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
    setSelectedFolder((current) => current ? replacePathPrefix(current, folderPath, target) : null);
  };

  const deleteFile = async (file: ProjectFileMeta) => {
    if (!window.confirm(`Delete “${file.fileName}”? This cannot be undone.`)) return;
    const result = await deleteProjectFileAction(file.id);
    if (!result.success) { setMessage(result.error); return; }
    setFiles((current) => current.filter((row) => row.id !== file.id));
  };

  const deleteFolder = async (folderPath: string) => {
    const count = files.filter((file) => file.relativePath.startsWith(`${folderPath}/`)).length;
    if (!window.confirm(`Delete “${folderPath}” and ${count} file(s)? This cannot be undone.`)) return;
    const result = await deleteProjectFolderAction(projectId, folderPath);
    if (!result.success) { setMessage(result.error); return; }
    setFiles((current) => current.filter((file) => !file.relativePath.startsWith(`${folderPath}/`)));
    if (selectedFolder?.startsWith(folderPath)) setSelectedFolder(null);
  };

  const openPreview = async (file: ProjectFileMeta) => {
    const result = await getProjectFileUrlAction(file.id, "preview");
    if (!result.success) { setMessage(result.error); return; }
    setPreview({ url: result.data.url, name: result.data.fileName });
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
      {pending.length > 0 ? (
        <div className="rounded-lg border bg-card divide-y">
          {pending.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3">
              {item.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <File className="h-4 w-4 text-destructive" />}
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

      {files.length === 0 && pending.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">No files in this workspace.</div>
      ) : files.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="hidden rounded-lg border bg-card p-2 md:block">
            <button type="button" className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${selectedFolder == null ? "bg-muted font-medium" : "hover:bg-muted/60"}`} onClick={() => setSelectedFolder(null)}>
              <FolderOpen className="h-4 w-4 text-amber-600" /> All files
            </button>
            <TreeNodes nodes={tree} selected={selectedFolder} onSelect={setSelectedFolder} canWrite={canWrite} onRename={renameFolder} onDelete={deleteFolder} />
          </div>
          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
            <Table dense>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Folder</TableHead><TableHead>Size</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{visibleFiles.map((file) => <WorkspaceRow key={file.id} file={file} canWrite={canWrite} onPreview={openPreview} onDownload={download} onRename={renameFile} onDelete={deleteFile} />)}</TableBody>
            </Table>
          </div>
          <div className="rounded-lg border bg-card divide-y md:hidden">
            <MobileFolderRows nodes={tree} canWrite={canWrite} onRename={renameFolder} onDelete={deleteFolder} />
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 p-3">
                <FileTypeIcon file={file} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={file.relativePath}>{file.relativePath}</p><p className="text-xs text-muted-foreground">{formatBytes(file.fileSizeBytes)}</p></div>
                <FileActions file={file} canWrite={canWrite} onPreview={openPreview} onDownload={download} onRename={renameFile} onDelete={deleteFile} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{preview?.name}</DialogTitle><DialogDescription>Preview link expires shortly.</DialogDescription></DialogHeader>
          {preview ? <iframe src={preview.url} title={`Preview ${preview.name}`} sandbox="" referrerPolicy="no-referrer" className="h-[70vh] w-full rounded border bg-white" /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MobileFolderRows({ nodes, canWrite, onRename, onDelete, depth = 0 }: { nodes: ProjectTreeNode[]; canWrite: boolean; onRename: (path: string) => void; onDelete: (path: string) => void; depth?: number }) {
  return <>{nodes.filter((node) => node.kind === "folder").map((node) => <div key={node.path}><div className="flex min-h-12 items-center gap-2 p-2" style={{ paddingLeft: `${8 + depth * 12}px` }}><Folder className="h-4 w-4 shrink-0 text-amber-600" /><p className="min-w-0 flex-1 truncate text-sm font-medium" title={node.path}>{node.name}</p>{canWrite ? <div className="flex shrink-0"><Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Rename folder ${node.path}`} onClick={() => onRename(node.path)}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Delete folder ${node.path}`} onClick={() => onDelete(node.path)}><Trash2 className="h-4 w-4" /></Button></div> : null}</div><MobileFolderRows nodes={node.children} canWrite={canWrite} onRename={onRename} onDelete={onDelete} depth={depth + 1} /></div>)}</>;
}

function TreeNodes({ nodes, selected, onSelect, canWrite, onRename, onDelete, depth = 0 }: { nodes: ProjectTreeNode[]; selected: string | null; onSelect: (path: string) => void; canWrite: boolean; onRename: (path: string) => void; onDelete: (path: string) => void; depth?: number }) {
  return <>{nodes.filter((node) => node.kind === "folder").map((node) => <div key={node.path}><div className={`group flex items-center rounded ${selected === node.path ? "bg-muted" : "hover:bg-muted/60"}`} style={{ paddingLeft: `${depth * 12}px` }}><button type="button" className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm" onClick={() => onSelect(node.path)}><Folder className="h-4 w-4 shrink-0 text-amber-600" /><span className="truncate" title={node.name}>{node.name}</span></button>{canWrite ? <><Button type="button" variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Rename ${node.name}`} onClick={() => onRename(node.path)}><Pencil className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${node.name}`} onClick={() => onDelete(node.path)}><Trash2 className="h-3.5 w-3.5" /></Button></> : null}</div><TreeNodes nodes={node.children} selected={selected} onSelect={onSelect} canWrite={canWrite} onRename={onRename} onDelete={onDelete} depth={depth + 1} /></div>)}</>;
}

function WorkspaceRow({ file, canWrite, onPreview, onDownload, onRename, onDelete }: { file: ProjectFileMeta; canWrite: boolean; onPreview: (file: ProjectFileMeta) => void; onDownload: (file: ProjectFileMeta) => void; onRename: (file: ProjectFileMeta) => void; onDelete: (file: ProjectFileMeta) => void }) {
  const parent = file.relativePath.includes("/") ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/")) : "—";
  return <TableRow><TableCell><span className="flex min-w-0 items-center gap-2"><FileTypeIcon file={file} /><span className="max-w-[18rem] truncate font-medium" title={file.fileName}>{file.fileName}</span></span></TableCell><TableCell className="max-w-[14rem] truncate" title={parent}>{parent}</TableCell><TableCell>{formatBytes(file.fileSizeBytes)}</TableCell><TableCell className="capitalize">{file.lifecycleStatus}</TableCell><TableCell><div className="flex justify-end"><FileActions file={file} canWrite={canWrite} onPreview={onPreview} onDownload={onDownload} onRename={onRename} onDelete={onDelete} /></div></TableCell></TableRow>;
}

function FileActions({ file, canWrite, onPreview, onDownload, onRename, onDelete }: { file: ProjectFileMeta; canWrite: boolean; onPreview: (file: ProjectFileMeta) => void; onDownload: (file: ProjectFileMeta) => void; onRename: (file: ProjectFileMeta) => void; onDelete: (file: ProjectFileMeta) => void }) {
  return <div className="flex items-center"><Button type="button" variant="ghost" size="icon" disabled={!isPreviewableProjectMimeType(file.mimeType)} aria-label={isPreviewableProjectMimeType(file.mimeType) ? `Preview ${file.fileName}` : `Preview unavailable for ${file.fileName}`} onClick={() => onPreview(file)}><Eye className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Download ${file.fileName}`} onClick={() => onDownload(file)}><Download className="h-4 w-4" /></Button>{canWrite ? <><Button type="button" variant="ghost" size="icon" aria-label={`Rename ${file.fileName}`} onClick={() => onRename(file)}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${file.fileName}`} onClick={() => onDelete(file)}><Trash2 className="h-4 w-4" /></Button></> : null}</div>;
}

function FileTypeIcon({ file }: { file: ProjectFileMeta }) {
  const name = file.fileName.toLowerCase();
  const cls = "h-4 w-4 shrink-0 text-muted-foreground";
  if (file.mimeType?.startsWith("image/")) return <FileImage className={cls} />;
  if (file.mimeType === "application/pdf" || /\.(docx?|txt|rtf)$/.test(name)) return <FileText className={cls} />;
  if (/\.(xlsx?|csv|ods)$/.test(name)) return <FileSpreadsheet className={cls} />;
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return <FileArchive className={cls} />;
  if (/\.(json|xml|html?|css|js|ts|tsx)$/.test(name)) return <FileCode2 className={cls} />;
  return <File className={cls} />;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
