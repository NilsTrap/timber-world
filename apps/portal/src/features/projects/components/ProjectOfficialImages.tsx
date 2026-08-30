"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@timber/ui";
import { toast } from "sonner";
import type { ProjectFileMeta } from "../types";
import { uploadProjectBrowserFile } from "./projectUploadClient";
import { checkProjectOfficialImageSlot, completeProjectOfficialImage, removeProjectOfficialImage, setProjectOfficialImagePrimary } from "../actions/projectOfficialImageActions";
import { deleteProjectFileAction } from "../actions/projectFileActions";

type Props = { projectId: string; initialFiles: ProjectFileMeta[]; canManage: boolean; canRemove: boolean };

export function ProjectOfficialImages({ projectId, initialFiles, canManage, canRemove }: Props) {
  const router = useRouter();
  const [files, setFiles] = useState(initialFiles);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(() => initialFiles.some((file) => file.officialImagePosition));
  const [preview, setPreview] = useState<ProjectFileMeta | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ProjectFileMeta | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const localBlobUrls = useRef(new Set<string>());
  const images = files.filter((file) => file.officialImagePosition).sort((a, b) => (a.officialImagePosition ?? 0) - (b.officialImagePosition ?? 0));

  useEffect(() => {
    for (const url of localBlobUrls.current) URL.revokeObjectURL(url);
    localBlobUrls.current.clear();
    setFiles(initialFiles);
    setPreview(null);
    setRemoveTarget(null);
  }, [initialFiles]);

  useEffect(() => () => {
    for (const url of localBlobUrls.current) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    if (images.length === 0) setOpen(false);
  }, [images.length]);

  async function upload(selected: FileList | null) {
    if (!selected?.length || !canManage) return;
    const remaining = 3 - images.length;
    if (selected.length > remaining) return toast.error(`You can add ${remaining} more official image${remaining === 1 ? "" : "s"}`);
    setBusy(true);
    let uploadedId: string | null = null;
    try {
      for (const file of Array.from(selected)) {
        if (!file.type.startsWith("image/")) throw new Error("Official project files must be images");
        const slot = await checkProjectOfficialImageSlot(projectId);
        if (!slot.success) throw new Error(slot.error);
        const uploaded = await uploadProjectBrowserFile(projectId, file, `Official images/${crypto.randomUUID()}-${file.name}`, () => {});
        uploadedId = uploaded.id;
        const marked = await completeProjectOfficialImage(projectId, uploaded.id);
        if (!marked.success) throw new Error(marked.error);
        uploadedId = null;
        const previewUrl = URL.createObjectURL(file);
        localBlobUrls.current.add(previewUrl);
        setFiles((current) => [...current, { ...uploaded, officialImagePosition: marked.data.position, previewUrl }]);
        router.refresh();
      }
      toast.success("Official image uploaded");
    } catch (error) {
      if (uploadedId) {
        const cleanup = await deleteProjectFileAction(uploadedId);
        if (!cleanup.success) toast.error("The image could not be assigned or removed. Delete the uploaded image before retrying.");
        else toast.error(error instanceof Error ? error.message : "Could not upload image");
      } else toast.error(error instanceof Error ? error.message : "Could not upload image");
    } finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  async function remove() {
    if (!removeTarget || !canRemove) return;
    const file = removeTarget;
    setBusy(true);
    try {
      const result = await removeProjectOfficialImage(projectId, file.id);
      if (!result.success) return toast.error(result.error);
      setFiles((current) => {
        const remaining = current.filter((entry) => entry.officialImagePosition && entry.id !== file.id).sort((a, b) => (a.officialImagePosition ?? 0) - (b.officialImagePosition ?? 0));
        const positions = new Map(remaining.map((entry, index) => [entry.id, index + 1]));
        return current.map((entry) => entry.id === file.id ? { ...entry, officialImagePosition: null } : positions.has(entry.id) ? { ...entry, officialImagePosition: positions.get(entry.id) } : entry);
      });
      setRemoveTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove project image");
    } finally { setBusy(false); }
  }

  async function makePrimary(file: ProjectFileMeta) {
    if (!canManage || file.officialImagePosition === 1) return;
    setBusy(true);
    try {
      const result = await setProjectOfficialImagePrimary(projectId, file.id);
      if (!result.success) return toast.error(result.error);
      setFiles((current) => {
        const reordered = [...current.filter((entry) => entry.id === file.id), ...current.filter((entry) => entry.officialImagePosition && entry.id !== file.id).sort((a, b) => (a.officialImagePosition ?? 0) - (b.officialImagePosition ?? 0))];
        const positions = new Map(reordered.map((entry, index) => [entry.id, index + 1]));
        return current.map((entry) => positions.has(entry.id) ? { ...entry, officialImagePosition: positions.get(entry.id) } : entry);
      });
      toast.success("Default project image updated"); router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change the default image");
    } finally { setBusy(false); }
  }

  const uploadControl = canManage ? <><input ref={input} className="hidden" type="file" accept="image/*" multiple onChange={(event) => void upload(event.target.files)} /><Button type="button" size="sm" disabled={busy || images.length >= 3} onClick={() => input.current?.click()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload images</Button></> : null;
  const gallery = <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[0, 1, 2].map((slot) => {
          const file = images[slot]; const isDefault = file?.officialImagePosition === 1;
          return <div key={slot} className="group relative flex h-48 flex-col items-center justify-center overflow-hidden rounded-lg border bg-muted/30">{file ? <>
            <button type="button" className="relative min-h-0 w-full flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:h-full sm:flex-none" aria-label={`Preview project image ${slot + 1}`} onClick={() => setPreview(file)}>{file.previewUrl ? <Image src={file.previewUrl} alt={`Project image ${slot + 1}`} fill unoptimized className="object-contain" /> : <ImageIcon className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/40" />}</button>
            {canManage || canRemove ? <div className="flex w-full shrink-0 items-center justify-between gap-2 border-t bg-background p-2 transition-opacity sm:pointer-events-none sm:absolute sm:inset-x-0 sm:bottom-0 sm:w-auto sm:border-t-0 sm:bg-background/90 sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100">{canManage ? <Button type="button" size="sm" variant={isDefault ? "secondary" : "ghost"} disabled={busy || isDefault} aria-label={isDefault ? "Default project image" : `Make project image ${slot + 1} default`} className="text-xs" onClick={(event) => { event.stopPropagation(); void makePrimary(file); }}>{isDefault ? <><Check className="mr-1 h-3.5 w-3.5" />Default</> : "Make default"}</Button> : <span />}{canRemove ? <Button type="button" size="icon" variant="ghost" disabled={busy} aria-label={`Remove project image ${slot + 1}`} onClick={(event) => { event.stopPropagation(); setRemoveTarget(file); }}><Trash2 className="h-4 w-4" /></Button> : null}</div> : null}
          </> : <ImageIcon className="h-6 w-6 text-muted-foreground/40" />}</div>;
        })}</div>;

  return <>
    {images.length > 0 ? <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">Images</p>{uploadControl}</div>{gallery}</section> : <section className="overflow-hidden rounded-lg border bg-card"><button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left" aria-expanded={open} aria-controls="project-images-content" onClick={() => setOpen((current) => !current)}><span><span className="block text-xl font-semibold">Images</span><span className="block text-sm text-muted-foreground">No images uploaded</span></span>{open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}</button>{open ? <div id="project-images-content" className="space-y-3 border-t p-4"><div className="flex justify-end">{uploadControl}</div>{gallery}</div> : null}</section>}
    <Dialog open={preview !== null} onOpenChange={(nextOpen) => !nextOpen && setPreview(null)}><DialogContent className="max-w-[90vw] sm:max-w-5xl"><DialogHeader><DialogTitle>Project image {preview?.officialImagePosition}</DialogTitle><DialogDescription>Large project image preview</DialogDescription></DialogHeader><div className="relative h-[75vh] bg-muted/30">{preview?.previewUrl ? <Image src={preview.previewUrl} alt={`Project image ${preview.officialImagePosition} preview`} fill unoptimized className="object-contain" /> : <ImageIcon className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/40" />}</div></DialogContent></Dialog>
    <AlertDialog open={removeTarget !== null} onOpenChange={(nextOpen) => !nextOpen && !busy && setRemoveTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove project image {removeTarget?.officialImagePosition}?</AlertDialogTitle><AlertDialogDescription>This removes its project-image designation. The underlying file remains in project files.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => void remove()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Remove image</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
