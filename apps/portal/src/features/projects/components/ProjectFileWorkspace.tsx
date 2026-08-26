"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  Folder,
  FolderInput,
  FolderPlus,
  FolderOpen,
  Info,
  Loader2,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  SectionHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@timber/ui";
import { formatDateTime } from "@/lib/utils";
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
import { approveCleanProjectFileAction, cleanProjectFilesAction, getCleanProjectFileUrlAction, shareProjectFileAction, shareProjectFilesAction, unshareProjectFileAction, unshareProjectFilesAction } from "../actions/projectFileCleanupActions";
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
  canManageCleanup,
}: {
  projectId: string;
  initialFiles: ProjectFileMeta[];
  initialFolders: ProjectFolderMeta[];
  canWrite: boolean;
  canManageCleanup: boolean;
}) {
  const [files, setFiles] = useState(initialFiles);
  const [folders, setFolders] = useState(initialFolders);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadActivity, setUploadActivity] = useState(0);
  const [uploadInteractionActive, setUploadInteractionActive] = useState(false);
  const [fileInfo, setFileInfo] = useState<ProjectFileMeta | null>(null);
  const [preview, setPreview] = useState<ProjectPreviewSource | null>(null);
  const [previewRefreshError, setPreviewRefreshError] = useState<string | null>(null);
  const [cleanPreviewFile, setCleanPreviewFile] = useState<ProjectFileMeta | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
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
  const hasActiveUploads = pending.some((item) => item.status === "uploading") || uploadInteractionActive;

  useEffect(() => {
    if (!uploadOpen || hasActiveUploads) return;
    const timeout = window.setTimeout(() => setUploadOpen(false), 10_000);
    return () => window.clearTimeout(timeout);
  }, [hasActiveUploads, uploadActivity, uploadOpen]);

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
    const result = file.sharedInbound ? await getCleanProjectFileUrlAction(file.id) : await getProjectFileUrlAction(file.id, "preview");
    if (requestId !== previewRequestRef.current) return;
    if (!result.success) { setMessage(result.error); return; }
    if (file.sharedInbound) setCleanPreviewFile(file);
    setPreview({ fileId: file.id, url: result.data.url, fileName: result.data.fileName, mimeType: result.data.mimeType });
  };

  const refreshPreview = async () => {
    if (!preview) return;
    const fileId = preview.fileId;
    const requestId = previewRequestRef.current;
    setPreviewRefreshError(null);
    const result = cleanPreviewFile ? await getCleanProjectFileUrlAction(fileId) : await getProjectFileUrlAction(fileId, "preview");
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
    const result = file.sharedInbound ? await getCleanProjectFileUrlAction(file.id) : await getProjectFileUrlAction(file.id, "download");
    if (!result.success) { setMessage(result.error); return; }
    const anchor = document.createElement("a");
    anchor.href = result.data.url;
    anchor.download = result.data.fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const cleanSelected = async () => {
    setCleanupBusy(true);
    try {
      const result = await cleanProjectFilesAction([...selectedFileIds]);
      if (!result.success) return setMessage(result.error);
      const updates = new Map(result.data.map((item) => [item.fileId, item]));
      setFiles((current) => current.map((file) => { const item = updates.get(file.id); return item ? { ...file, cleanFileId: item.cleanFileId, cleanupStatus: item.cleanupStatus, cleanupFindingsCount: item.findingsCount, shared: false } : file; }));
      setSelectedFileIds((current) => new Set([...current].filter((id) => !updates.has(id))));
      setMessage(`${result.data.length} cleaned file(s) ready for review.`);
    } catch {
      setMessage("Cleanup failed. Please try again.");
    } finally {
      setCleanupBusy(false);
    }
  };

  const openCleanPreview = async (file: ProjectFileMeta) => {
    if (!file.cleanFileId) return;
    const result = await getCleanProjectFileUrlAction(file.cleanFileId);
    if (!result.success) return setMessage(result.error);
    setCleanPreviewFile(file);
    setPreview({ fileId: file.cleanFileId, url: result.data.url, fileName: `Clean · ${result.data.fileName}`, mimeType: result.data.mimeType });
  };

  const approveClean = async () => {
    if (!cleanPreviewFile?.cleanFileId) return;
    const result = await approveCleanProjectFileAction(cleanPreviewFile.cleanFileId);
    if (!result.success) return setMessage(result.error);
    setFiles((current) => current.map((file) => file.id === cleanPreviewFile.id ? { ...file, cleanupStatus: "approved" } : file));
    setCleanPreviewFile((current) => current ? { ...current, cleanupStatus: "approved" } : current);
    setMessage("Cleaned file approved.");
  };

  const toggleShared = async (file: ProjectFileMeta, checked: boolean) => {
    if (!file.cleanFileId) return;
    const result = checked ? await shareProjectFileAction(file.cleanFileId) : await unshareProjectFileAction(file.cleanFileId);
    if (!result.success) return setMessage(result.error);
    setFiles((current) => current.map((row) => row.id === file.id ? { ...row, shared: checked } : row));
  };

  const shareSelected = async () => {
    const selected = files.filter((file) => selectedFileIds.has(file.id));
    if (selected.some((file) => file.cleanupStatus !== "approved" || !file.cleanFileId)) return setMessage("Preview and approve every selected cleaned file first.");
    const result = await shareProjectFilesAction(selected.map((file) => file.cleanFileId!));
    if (!result.success) return setMessage(result.error);
    setFiles((current) => current.map((file) => selectedFileIds.has(file.id) ? { ...file, shared: true } : file));
    setMessage(`${selected.length} file(s) shared with the next party.`);
  };
  const unshareSelected = async () => {
    const selected = files.filter((file) => selectedFileIds.has(file.id) && file.cleanFileId && file.shared);
    if (!selected.length) return setMessage("Select files that are currently shared.");
    const result = await unshareProjectFilesAction(selected.map((file) => file.cleanFileId!)); if (!result.success) return setMessage(result.error);
    setFiles((current) => current.map((file) => selectedFileIds.has(file.id) ? { ...file, shared: false } : file)); setMessage(`${selected.length} file(s) unshared.`);
  };

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Files"
        subtitle={`${initialFiles.length} file(s) on this project`}
        action={canWrite ? (
          <Button
            type="button"
            size="sm"
            variant={uploadOpen ? "secondary" : "outline"}
            aria-expanded={uploadOpen}
            aria-controls="project-file-upload-surface"
            onClick={() => {
              setUploadOpen((open) => !open);
              setUploadActivity((activity) => activity + 1);
            }}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {uploadOpen ? "Close upload" : "Upload files"}
          </Button>
        ) : undefined}
      />
      {canWrite && uploadOpen ? (
        <div
          id="project-file-upload-surface"
          onPointerDown={() => setUploadActivity((activity) => activity + 1)}
          onKeyDown={() => setUploadActivity((activity) => activity + 1)}
          onDragEnter={() => setUploadActivity((activity) => activity + 1)}
        >
          <ProjectDropSurface onFiles={addFiles} onError={setMessage} onActivityChange={setUploadInteractionActive} />
        </div>
      ) : null}
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
          {canManageCleanup ? <><Button type="button" size="sm" variant="outline" disabled={selectedFileIds.size === 0 || cleanupBusy} onClick={cleanSelected}>
            {cleanupBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />} Clean selected
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={selectedFileIds.size === 0} onClick={shareSelected}>
            <ShieldCheck className="mr-1.5 h-4 w-4" /> Share with next party
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={selectedFileIds.size === 0} onClick={unshareSelected}>Unshare selected</Button></> : null}
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
              <TableHeader><TableRow><TableHead className="w-10"><span className="sr-only">Select</span></TableHead><TableHead>Name</TableHead><TableHead>Clean</TableHead><TableHead>Shared</TableHead><TableHead>Size</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{visibleFiles.map((file) => <WorkspaceRow key={file.id} file={file} selected={selectedFileIds.has(file.id)} onSelected={(checked) => setSelectedFileIds((current) => { const next = new Set(current); if (checked) next.add(file.id); else next.delete(file.id); return next; })} canWrite={canWrite} onInfo={setFileInfo} onPreview={openPreview} onCleanPreview={openCleanPreview} onShared={toggleShared} onDownload={download} onRename={renameFile} onDelete={deleteFile} />)}</TableBody>
            </Table>
          </div>
          <div className="rounded-lg border bg-card divide-y md:hidden">
            <MobileFolderRows nodes={tree} canWrite={canWrite} onRename={renameFolder} onMove={moveFolder} onDelete={deleteFolder} />
            {files.map((file) => (
              <div
                key={file.id}
                className={`flex items-center gap-3 p-3 ${isPreviewableProjectFile(file.fileName, file.mimeType) ? "cursor-pointer hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}`}
                onClick={isPreviewableProjectFile(file.fileName, file.mimeType) ? () => openPreview(file) : undefined}
              >
                {canWrite ? <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><Checkbox checked={selectedFileIds.has(file.id)} onCheckedChange={(checked) => setSelectedFileIds((current) => { const next = new Set(current); if (checked === true) next.add(file.id); else next.delete(file.id); return next; })} aria-label={`Select ${file.fileName}`} /></span> : null}
                {isPreviewableProjectFile(file.fileName, file.mimeType) ? (
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={(event) => { event.stopPropagation(); void openPreview(file); }}>
                    <ProjectFileTypeIcon fileName={file.fileName} mimeType={file.mimeType} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium" title={file.relativePath}>{file.relativePath}</span><span className="block text-xs text-muted-foreground">{formatBytes(file.fileSizeBytes)}</span></span>
                  </button>
                ) : <><ProjectFileTypeIcon fileName={file.fileName} mimeType={file.mimeType} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={file.relativePath}>{file.relativePath}</p><p className="text-xs text-muted-foreground">{formatBytes(file.fileSizeBytes)}</p></div></>}
                <div className="flex shrink-0 flex-col items-end gap-1 text-[11px]" onClick={(event) => event.stopPropagation()}>{file.cleanFileId ? <button type="button" className="flex items-center gap-1" onClick={() => void openCleanPreview(file)}><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />{file.cleanupStatus === "approved" ? "Approved" : "Review"}</button> : <span className="text-muted-foreground">Not cleaned</span>}<Checkbox aria-label={`Shared status for ${file.fileName}`} checked={file.sharedInbound || file.shared} disabled={file.sharedInbound || !canWrite || file.cleanupStatus !== "approved"} onCheckedChange={(checked) => void toggleShared(file, checked === true)} /></div>
                <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><FileActions file={file} canWrite={canWrite && !file.sharedInbound} onInfo={setFileInfo} onPreview={openPreview} onDownload={download} onRename={renameFile} onDelete={deleteFile} /></div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog open={!!fileInfo} onOpenChange={(open) => { if (!open) setFileInfo(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File information</DialogTitle>
            <DialogDescription>Available metadata for this project file.</DialogDescription>
          </DialogHeader>
          {fileInfo ? <FileMetadata file={fileInfo} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) { previewRequestRef.current++; setPreview(null); setCleanPreviewFile(null); setPreviewRefreshError(null); } }}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader><DialogTitle>{preview?.fileName}</DialogTitle><DialogDescription>{PROJECT_PREVIEW_COPY.description}</DialogDescription></DialogHeader>
          {preview ? <ProjectFilePreview source={preview} onRetry={refreshPreview} refreshError={previewRefreshError} /> : null}
          {cleanPreviewFile?.cleanupStatus === "needs_review" ? <Button type="button" onClick={approveClean}><ShieldCheck className="mr-1.5 h-4 w-4" /> Approve cleaned file</Button> : null}
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

function WorkspaceRow({ file, selected, onSelected, canWrite, onInfo, onPreview, onCleanPreview, onShared, onDownload, onRename, onDelete }: { file: ProjectFileMeta; selected: boolean; onSelected: (checked: boolean) => void; canWrite: boolean; onInfo: (file: ProjectFileMeta) => void; onPreview: (file: ProjectFileMeta) => void; onCleanPreview: (file: ProjectFileMeta) => void; onShared: (file: ProjectFileMeta, checked: boolean) => void; onDownload: (file: ProjectFileMeta) => void; onRename: (file: ProjectFileMeta) => void; onDelete: (file: ProjectFileMeta) => void }) {
  const previewable = isPreviewableProjectFile(file.fileName, file.mimeType);
  return <TableRow className={previewable ? "cursor-pointer" : undefined} onClick={previewable ? () => onPreview(file) : undefined}><TableCell><span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{canWrite && !file.sharedInbound ? <Checkbox checked={selected} onCheckedChange={(checked) => onSelected(checked === true)} aria-label={`Select ${file.fileName}`} /> : null}</span></TableCell><TableCell>{previewable ? <button type="button" className="flex w-full min-w-0 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={(event) => { event.stopPropagation(); onPreview(file); }}><ProjectFileTypeIcon fileName={file.fileName} mimeType={file.mimeType} /><span className="min-w-0 flex-1 truncate font-medium whitespace-nowrap" title={file.fileName}>{file.fileName}</span></button> : <span className="flex min-w-0 items-center gap-2"><ProjectFileTypeIcon fileName={file.fileName} mimeType={file.mimeType} /><span className="min-w-0 flex-1 truncate font-medium whitespace-nowrap" title={file.fileName}>{file.fileName}</span></span>}</TableCell><TableCell onClick={(event) => event.stopPropagation()}>{file.cleanFileId ? <Button type="button" size="sm" variant="ghost" onClick={() => onCleanPreview(file)}><ShieldCheck className={`mr-1 h-4 w-4 ${file.cleanupStatus === "approved" ? "text-emerald-600" : "text-amber-600"}`} />{file.cleanupStatus === "approved" ? "Approved" : "Review"}</Button> : <span className="text-muted-foreground">—</span>}</TableCell><TableCell onClick={(event) => event.stopPropagation()}><Checkbox aria-label={`Shared status for ${file.fileName}`} checked={file.sharedInbound || file.shared} disabled={file.sharedInbound || !canWrite || file.cleanupStatus !== "approved"} onCheckedChange={(checked) => onShared(file, checked === true)} /></TableCell><TableCell>{formatBytes(file.fileSizeBytes)}</TableCell><TableCell className="capitalize">{file.lifecycleStatus}</TableCell><TableCell><div className="flex justify-end" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><FileActions file={file} canWrite={canWrite && !file.sharedInbound} onInfo={onInfo} onPreview={onPreview} onDownload={onDownload} onRename={onRename} onDelete={onDelete} /></div></TableCell></TableRow>;
}

function FileActions({ file, canWrite, onInfo, onPreview, onDownload, onRename, onDelete }: { file: ProjectFileMeta; canWrite: boolean; onInfo: (file: ProjectFileMeta) => void; onPreview: (file: ProjectFileMeta) => void; onDownload: (file: ProjectFileMeta) => void; onRename: (file: ProjectFileMeta) => void; onDelete: (file: ProjectFileMeta) => void }) {
  const previewable = isPreviewableProjectFile(file.fileName, file.mimeType);
  return <div className="flex items-center"><Button type="button" variant="ghost" size="icon" aria-label={`Information for ${file.fileName}`} onClick={() => onInfo(file)}><Info className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" disabled={!previewable} aria-label={previewable ? `Preview ${file.fileName}` : `Preview unavailable for ${file.fileName}`} onClick={() => onPreview(file)}><Eye className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Download ${file.fileName}`} onClick={() => onDownload(file)}><Download className="h-4 w-4" /></Button>{canWrite ? <><Button type="button" variant="ghost" size="icon" aria-label={`Rename ${file.fileName}`} onClick={() => onRename(file)}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${file.fileName}`} onClick={() => onDelete(file)}><Trash2 className="h-4 w-4" /></Button></> : null}</div>;
}

function FileMetadata({ file }: { file: ProjectFileMeta }) {
  const folder = file.relativePath.includes("/") ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/")) : "Project root";
  const fields = [
    ["Name", file.fileName],
    ["Folder", folder],
    ["Path", file.relativePath],
    ["Type", file.mimeType ?? "Unknown"],
    ["Size", formatBytes(file.fileSizeBytes)],
    ["Status", file.lifecycleStatus],
    ["Uploaded", formatDateTime(file.createdAt)],
  ] as const;

  return (
    <dl className="divide-y rounded-md border text-sm">
      {fields.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-3 py-2 sm:grid-cols-[6rem_minmax(0,1fr)]">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className={`min-w-0 break-words ${label === "Status" ? "capitalize" : ""}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
