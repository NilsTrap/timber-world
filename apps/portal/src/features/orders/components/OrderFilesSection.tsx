"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Upload, Download, Trash2, FileText, Loader2, Eye, ImageIcon, ArrowRight, Eraser } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@timber/ui";
import { getOrderFiles } from "../actions/getOrderFiles";
import { uploadOrderFile } from "../actions/uploadOrderFile";
import { deleteOrderFile } from "../actions/deleteOrderFile";
import { getOrderFileUrl } from "../actions/getOrderFileUrl";
import { setOrderFileThumbnail } from "../actions/setOrderFileThumbnail";
import { copyOrderFile } from "../actions/copyOrderFile";
import type { OrderFile, OrderFileCategory } from "../types";

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

function isPdf(file: OrderFile): boolean {
  return file.mimeType === "application/pdf" || file.fileName.toLowerCase().endsWith(".pdf");
}

interface FileCategorySectionProps {
  orderId: string;
  category: OrderFileCategory;
  label: string;
  files: OrderFile[];
  onRefresh: () => void;
  onPreviewPdf: (file: OrderFile) => void;
  /** Show thumbnail toggle on PDF files */
  showThumbnailToggle?: boolean;
  /** Target category for copy button (e.g. "production") */
  copyToCategory?: OrderFileCategory;
}

function FileCategorySection({ orderId, category, label, files, onRefresh, onPreviewPdf, showThumbnailToggle, copyToCategory }: FileCategorySectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [togglingThumbnailId, setTogglingThumbnailId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [strippingId, setStrippingId] = useState<string | null>(null);

  const handleToggleThumbnail = useCallback(async (file: OrderFile) => {
    setTogglingThumbnailId(file.id);
    const result = await setOrderFileThumbnail(file.id, !file.isThumbnail);
    if (result.success) {
      onRefresh();
    } else {
      toast.error("Failed to update thumbnail");
    }
    setTogglingThumbnailId(null);
  }, [onRefresh]);

  const handleCopy = useCallback(async (file: OrderFile, stripLogo?: boolean) => {
    if (!copyToCategory) return;
    if (stripLogo) {
      setStrippingId(file.id);
    } else {
      setCopyingId(file.id);
    }
    const result = await copyOrderFile(file.id, copyToCategory, stripLogo);
    if (result.success) {
      const note = stripLogo ? " (logo removed)" : "";
      toast.success(`Copied "${file.fileName}" to ${copyToCategory}${note}`);
      onRefresh();
    } else {
      toast.error(`Failed to copy: ${result.error}`);
    }
    if (stripLogo) {
      setStrippingId(null);
    } else {
      setCopyingId(null);
    }
  }, [copyToCategory, onRefresh]);

  const handleUpload = useCallback(async (fileList: FileList) => {
    setUploading(true);
    let successCount = 0;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file) continue;
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadOrderFile(orderId, category, formData);
      if (result.success) {
        successCount++;
      } else {
        toast.error(`Failed to upload ${file.name}: ${result.error}`);
      }
    }
    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} file${successCount > 1 ? "s" : ""}`);
      onRefresh();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [orderId, category, onRefresh]);

  const handleDownload = useCallback(async (file: OrderFile) => {
    setDownloadingId(file.id);
    const result = await getOrderFileUrl(file.id);
    if (result.success) {
      const a = document.createElement("a");
      a.href = result.data;
      a.download = file.fileName;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      toast.error(`Failed to download: ${result.error}`);
    }
    setDownloadingId(null);
  }, []);

  const handleDelete = useCallback(async (file: OrderFile) => {
    const result = await deleteOrderFile(file.id);
    if (result.success) {
      toast.success(`Deleted ${file.fileName}`);
      onRefresh();
    } else {
      toast.error(`Failed to delete: ${result.error}`);
    }
  }, [onRefresh]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {label} ({files.length})
        </h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleUpload(e.target.files);
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </Button>
        </div>
      </div>

      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No files uploaded yet.</p>
      ) : (
        <div className="rounded-md border divide-y">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div
                className={`flex-1 min-w-0 ${isPdf(file) ? "cursor-pointer hover:text-foreground/80" : ""}`}
                onClick={isPdf(file) ? () => onPreviewPdf(file) : undefined}
              >
                <p className="truncate font-medium">{file.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.fileSizeBytes)}
                  {file.uploadedByName && <> · {file.uploadedByName}</>}
                  {" · "}{formatDate(file.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {showThumbnailToggle && isPdf(file) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleToggleThumbnail(file)}
                    disabled={togglingThumbnailId === file.id}
                    title={file.isThumbnail ? "Remove as thumbnail" : "Set as thumbnail"}
                  >
                    {togglingThumbnailId === file.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <ImageIcon className={`h-3.5 w-3.5 ${file.isThumbnail ? "text-green-600 fill-green-600" : ""}`} />}
                  </Button>
                )}
                {copyToCategory && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleCopy(file)}
                    disabled={copyingId === file.id || strippingId === file.id}
                    title={`Copy to ${copyToCategory === "production" ? "Workshop" : copyToCategory}`}
                  >
                    {copyingId === file.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <ArrowRight className="h-3.5 w-3.5" />}
                  </Button>
                )}
                {copyToCategory && isPdf(file) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 p-0 px-1 gap-0.5"
                    onClick={() => handleCopy(file, true)}
                    disabled={strippingId === file.id || copyingId === file.id}
                    title={`Copy to ${copyToCategory === "production" ? "Workshop" : copyToCategory} without logo`}
                  >
                    {strippingId === file.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <><Eraser className="h-3.5 w-3.5" /><ArrowRight className="h-3 w-3" /></>}
                  </Button>
                )}
                {isPdf(file) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => onPreviewPdf(file)}
                    title="Preview PDF"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleDownload(file)}
                  disabled={downloadingId === file.id}
                  title="Download"
                >
                  {downloadingId === file.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleDelete(file)}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface OrderFilesSectionProps {
  orderId: string;
  showCustomer: boolean;
  showProduction: boolean;
  onFilesChanged?: () => void;
}

export function OrderFilesSection({ orderId, showCustomer, showProduction, onFilesChanged }: OrderFilesSectionProps) {
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<OrderFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadFiles = useCallback(async () => {
    const result = await getOrderFiles(orderId);
    if (result.success) {
      setFiles(result.data);
    }
    setLoading(false);
    onFilesChanged?.();
  }, [orderId, onFilesChanged]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handlePreviewPdf = useCallback(async (file: OrderFile) => {
    setPreviewFile(file);
    setPreviewLoading(true);
    setPreviewUrl(null);
    const result = await getOrderFileUrl(file.id);
    if (result.success) {
      setPreviewUrl(result.data);
    } else {
      toast.error(`Failed to load preview: ${result.error}`);
      setPreviewFile(null);
    }
    setPreviewLoading(false);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewFile(null);
    setPreviewUrl(null);
  }, []);

  if (!showCustomer && !showProduction) return null;

  const customerFiles = files.filter((f) => f.category === "customer");
  const productionFiles = files.filter((f) => f.category === "production");

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Files</h2>
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading files...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Files</h2>
      <div className={showCustomer && showProduction ? "grid grid-cols-2 gap-4" : ""}>
        {showCustomer && (
          <div className="rounded-lg border bg-card p-4">
            <FileCategorySection
              orderId={orderId}
              category="customer"
              label="Customer Files"
              files={customerFiles}
              onRefresh={loadFiles}
              onPreviewPdf={handlePreviewPdf}
              showThumbnailToggle={!showProduction}
              copyToCategory={showProduction ? "production" : undefined}
            />
          </div>
        )}
        {showProduction && (
          <div className="rounded-lg border bg-card p-4">
            <FileCategorySection
              orderId={orderId}
              category="production"
              label="Workshop Files"
              files={productionFiles}
              onRefresh={loadFiles}
              onPreviewPdf={handlePreviewPdf}
              showThumbnailToggle={showCustomer}
            />
          </div>
        )}
      </div>

      {/* PDF Preview Dialog */}
      <Dialog open={previewFile !== null} onOpenChange={(open) => { if (!open) handleClosePreview(); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">
              {previewFile?.fileName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading PDF...</span>
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-md border"
                title={previewFile?.fileName ?? "PDF Preview"}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
