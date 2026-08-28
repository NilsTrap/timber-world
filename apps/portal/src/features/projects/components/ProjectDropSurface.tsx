"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, FolderUp, Upload } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Button } from "@timber/ui";
import { MAX_PROJECT_FILE_BYTES } from "../filePaths";

export function ProjectDropSurface({
  disabled,
  onFiles,
  onArchive,
  onError,
  onActivityChange,
}: {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  onArchive?: (file: File) => void;
  onError: (message: string) => void;
  onActivityChange?: (active: boolean) => void;
}) {
  const folderInput = useRef<HTMLInputElement | null>(null);
  const archiveInput = useRef<HTMLInputElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    disabled,
    noClick: true,
    noKeyboard: true,
    maxSize: MAX_PROJECT_FILE_BYTES,
    onDropAccepted: (files) => {
      setPickerOpen(false);
      onFiles(files);
    },
    onDropRejected: (rejections) => {
      setPickerOpen(false);
      const tooLarge = rejections.some((rejection) =>
        rejection.errors.some((error) => error.code === "file-too-large"),
      );
      onError(tooLarge ? "Files must be 100 MB or smaller." : "Some files could not be added.");
    },
  });

  useEffect(() => {
    onActivityChange?.(isDragActive || pickerOpen);
    return () => onActivityChange?.(false);
  }, [isDragActive, onActivityChange, pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleFocus = () => window.setTimeout(() => setPickerOpen(false), 0);
    window.addEventListener("focus", handleFocus, { once: true });
    return () => window.removeEventListener("focus", handleFocus);
  }, [pickerOpen]);

  return (
    <div
      {...getRootProps()}
      className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <input {...getInputProps()} />
      <input
        ref={(node) => {
          folderInput.current = node;
          node?.setAttribute("webkitdirectory", "");
          node?.setAttribute("directory", "");
        }}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          setPickerOpen(false);
          onFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={archiveInput}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(event) => {
          setPickerOpen(false);
          const file = event.currentTarget.files?.[0];
          if (file) onArchive?.(file);
          event.currentTarget.value = "";
        }}
      />
      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">
        {isDragActive ? "Drop files and folders here" : "Drop files and folders here"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Relative folders are kept · 100 MB per file</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button type="button" size="sm" disabled={disabled} onClick={() => { setPickerOpen(true); open(); }}>
          <Upload className="mr-1.5 h-4 w-4" /> Choose files
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => { setPickerOpen(true); folderInput.current?.click(); }}
        >
          <FolderUp className="mr-1.5 h-4 w-4" /> Choose folder
        </Button>
        {onArchive ? <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => { setPickerOpen(true); archiveInput.current?.click(); }}
        >
          <Archive className="mr-1.5 h-4 w-4" /> Upload archive
        </Button> : null}
      </div>
    </div>
  );
}
