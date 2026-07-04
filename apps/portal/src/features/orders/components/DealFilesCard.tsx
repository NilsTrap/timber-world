"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Upload, Download, Trash2, FileText, Loader2, Paperclip } from "lucide-react";
import {
  Button,
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@timber/ui";
import { getOrderFiles } from "../actions/getOrderFiles";
import { uploadOrderFile } from "../actions/uploadOrderFile";
import { deleteOrderFile } from "../actions/deleteOrderFile";
import { getOrderFileUrl } from "../actions/getOrderFileUrl";
import type { OrderFile } from "../types";

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/**
 * N2 (a) · Free-form file attachments on a deal. Restores the file section the
 * legacy Order tab lost when that tab was removed — reuses the order_files table +
 * private 'orders' bucket under a dedicated 'deal' category. Same visibility walls
 * as the rest of the deal (server actions require an authenticated session; the
 * deal itself is RLS-gated to who may see the order).
 */
export function DealFilesCard({ orderId }: { orderId: string }) {
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<OrderFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await getOrderFiles(orderId, "deal");
    if (res.success) setFiles(res.data);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = useCallback(async (fileList: FileList) => {
    setUploading(true);
    let ok = 0;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file) continue;
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadOrderFile(orderId, "deal", fd);
      if (res.success) ok++;
      else toast.error(`Failed to upload ${file.name}: ${res.error}`);
    }
    if (ok > 0) { toast.success(`Uploaded ${ok} file${ok > 1 ? "s" : ""}`); await load(); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [orderId, load]);

  const handleDownload = useCallback(async (file: OrderFile) => {
    setDownloadingId(file.id);
    const res = await getOrderFileUrl(file.id);
    if (res.success) {
      const a = document.createElement("a");
      a.href = res.data; a.download = file.fileName; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } else {
      toast.error(`Failed to download: ${res.error}`);
    }
    setDownloadingId(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!fileToDelete) return;
    setDeleting(true);
    const res = await deleteOrderFile(fileToDelete.id);
    setDeleting(false);
    setFileToDelete(null);
    if (res.success) { toast.success(`Deleted ${fileToDelete.fileName}`); await load(); }
    else toast.error(`Failed to delete: ${res.error}`);
  }, [fileToDelete, load]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          Attachments
          <span className="text-muted-foreground font-normal">({files.length})</span>
        </h3>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleUpload(e.target.files); }}
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload file
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading files…
        </div>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No files attached. Upload external documents (POs, drawings, emails…) here.</p>
      ) : (
        <div className="rounded-md border divide-y">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{file.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.fileSizeBytes)}
                  {file.uploadedByName && <> · {file.uploadedByName}</>}
                  {" · "}{formatDate(file.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => handleDownload(file)} disabled={downloadingId === file.id} title="Download"
                >
                  {downloadingId === file.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => setFileToDelete(file)} title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!fileToDelete} onOpenChange={(o) => { if (!o) setFileToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              {fileToDelete ? `"${fileToDelete.fileName}"` : ""} will be permanently removed from the deal. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
