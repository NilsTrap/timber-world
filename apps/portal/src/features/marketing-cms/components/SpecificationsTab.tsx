"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Upload,
  Download,
  Trash2,
  FileText,
  Loader2,
  Plus,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ImageIcon,
} from "lucide-react";
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@timber/ui";
import { getSpecifications } from "../actions/getSpecifications";
import type { Specification, SpecificationFile } from "../actions/getSpecifications";
import {
  createSpecification,
  updateSpecification,
  deleteSpecification,
  uploadSpecificationFile,
  deleteSpecificationFile,
} from "../actions/manageSpecifications";

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(file: SpecificationFile): boolean {
  return file.mimeType.startsWith("image/");
}

function isPdf(file: SpecificationFile): boolean {
  return file.mimeType === "application/pdf";
}

interface SpecCardProps {
  spec: Specification;
  onRefresh: () => void;
}

function SpecCard({ spec, onRefresh }: SpecCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(spec.title);
  const [description, setDescription] = useState(spec.description || "");
  const [editingDescription, setEditingDescription] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleActive = useCallback(async () => {
    const result = await updateSpecification(spec.id, { isActive: !spec.isActive });
    if (result.success) {
      toast.success(spec.isActive ? "Hidden from website" : "Visible on website");
      onRefresh();
    } else {
      toast.error(result.error);
    }
  }, [spec.id, spec.isActive, onRefresh]);

  const handleSaveTitle = useCallback(async () => {
    if (!title.trim()) return;
    const result = await updateSpecification(spec.id, { title: title.trim() });
    if (result.success) {
      setEditingTitle(false);
      onRefresh();
    } else {
      toast.error(result.error);
    }
  }, [spec.id, title, onRefresh]);

  const handleSaveDescription = useCallback(async () => {
    const result = await updateSpecification(spec.id, { description: description.trim() });
    if (result.success) {
      setEditingDescription(false);
      onRefresh();
    } else {
      toast.error(result.error);
    }
  }, [spec.id, description, onRefresh]);

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete "${spec.title}" and all its files?`)) return;
    const result = await deleteSpecification(spec.id);
    if (result.success) {
      toast.success("Specification deleted");
      onRefresh();
    } else {
      toast.error(result.error);
    }
  }, [spec.id, spec.title, onRefresh]);

  const handleUpload = useCallback(async (fileList: FileList) => {
    setUploading(true);
    let successCount = 0;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file) continue;
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadSpecificationFile(spec.id, formData);
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
  }, [spec.id, onRefresh]);

  const handleDeleteFile = useCallback(async (file: SpecificationFile) => {
    const result = await deleteSpecificationFile(file.id);
    if (result.success) {
      toast.success(`Deleted ${file.originalName}`);
      onRefresh();
    } else {
      toast.error(result.error);
    }
  }, [onRefresh]);

  const handleDownload = useCallback((file: SpecificationFile) => {
    if (!file.publicUrl) return;
    const a = document.createElement("a");
    a.href = file.publicUrl;
    a.download = file.originalName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handlePreview = useCallback((file: SpecificationFile) => {
    if (file.publicUrl) {
      setPreviewUrl(file.publicUrl);
      setPreviewName(file.originalName);
    }
  }, []);

  return (
    <>
      <div className={`rounded-lg border bg-card shadow-sm ${!spec.isActive ? "opacity-60" : ""}`}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {editingTitle ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-7 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") { setEditingTitle(false); setTitle(spec.title); }
                }}
              />
              <Button size="sm" variant="outline" className="h-7" onClick={handleSaveTitle}>Save</Button>
            </div>
          ) : (
            <h3
              className="font-medium flex-1 cursor-pointer hover:text-foreground/80"
              onClick={() => setEditingTitle(true)}
            >
              {spec.title}
            </h3>
          )}

          <span className="text-xs text-muted-foreground">
            {spec.files.length} file{spec.files.length !== 1 ? "s" : ""}
          </span>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleToggleActive}
            title={spec.isActive ? "Hide from website" : "Show on website"}
          >
            {spec.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleDelete}
            title="Delete specification"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="px-4 py-3 space-y-3">
            {/* Description */}
            {editingDescription ? (
              <div className="flex items-center gap-2">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="h-7 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveDescription();
                    if (e.key === "Escape") { setEditingDescription(false); setDescription(spec.description || ""); }
                  }}
                />
                <Button size="sm" variant="outline" className="h-7" onClick={handleSaveDescription}>Save</Button>
              </div>
            ) : (
              <p
                className="text-sm text-muted-foreground cursor-pointer hover:text-foreground/80"
                onClick={() => setEditingDescription(true)}
              >
                {spec.description || "Click to add description..."}
              </p>
            )}

            {/* Upload button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
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
                Upload Files
              </Button>
            </div>

            {/* Files list */}
            {spec.files.length > 0 && (
              <div className="rounded-md border divide-y">
                {spec.files.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    {isImage(file) ? (
                      <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{file.originalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.fileSizeBytes)}
                        {isPdf(file) ? " · PDF" : isImage(file) ? " · Image" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(isPdf(file) || isImage(file)) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handlePreview(file)}
                          title="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleDownload(file)}
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleDeleteFile(file)}
                        title="Delete file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewUrl !== null} onOpenChange={(open) => { if (!open) { setPreviewUrl(null); setPreviewName(""); } }}>
        <DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-[90vw] max-h-[90vh] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{previewName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            {previewUrl && (
              previewUrl.match(/\.(jpe?g|png|webp|svg)$/i) || previewName.match(/\.(jpe?g|png|webp|svg)$/i) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={previewName} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={previewUrl} className="w-full h-full rounded-md border" title={previewName} />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * SpecificationsTab
 *
 * Admin interface for managing product specifications.
 * Each specification group can have multiple downloadable files (PDFs, images).
 */
export function SpecificationsTab() {
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const loadSpecs = useCallback(async () => {
    const result = await getSpecifications();
    if (result.success) {
      setSpecs(result.data);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSpecs();
  }, [loadSpecs]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const result = await createSpecification(newTitle.trim());
    if (result.success) {
      toast.success("Specification created");
      setNewTitle("");
      setShowCreate(false);
      loadSpecs();
    } else {
      toast.error(result.error);
    }
    setCreating(false);
  }, [newTitle, loadSpecs]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading specifications...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage product specifications visible on the marketing website.
          Upload PDFs and images for each product group.
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add Specification
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Specification</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Title (e.g., Oak Panels)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Specifications list */}
      {specs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No specifications yet. Click &ldquo;Add Specification&rdquo; to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {specs.map((spec) => (
            <SpecCard key={spec.id} spec={spec} onRefresh={loadSpecs} />
          ))}
        </div>
      )}
    </div>
  );
}
