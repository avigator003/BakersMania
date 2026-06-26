"use client";

import { Image as ImageIcon, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function PhotoPicker({
  label,
  value,
  onChange,
  accept = "image/*,.pdf"
}: {
  label: string;
  value?: string;
  onChange: (fileName: string) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isImage, setIsImage] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFile(file?: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (!file) {
      setPreviewUrl("");
      setIsImage(false);
      onChange("");
      return;
    }

    const nextPreview = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    setPreviewUrl(nextPreview);
    setIsImage(Boolean(nextPreview));
    onChange(file.name);
  }

  function clearFile() {
    if (inputRef.current) inputRef.current.value = "";
    handleFile(undefined);
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="grid gap-3 rounded-md border border-line bg-panel2 p-3">
        <button
          className="focus-ring flex min-h-36 items-center justify-center overflow-hidden rounded-md border border-dashed border-line bg-panel text-sm font-semibold text-muted"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          {previewUrl && isImage ? (
            <img alt={`${label} preview`} className="h-36 w-full object-contain" src={previewUrl} />
          ) : value ? (
            <span className="grid justify-items-center gap-2 px-3 text-center">
              <ImageIcon size={28} />
              <span className="break-all">{value}</span>
            </span>
          ) : (
            <span className="grid justify-items-center gap-2">
              <Upload size={28} />
              <span>Select photo</span>
            </span>
          )}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input
            accept={accept}
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
            ref={inputRef}
            type="file"
          />
          <button className="focus-ring rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold" onClick={() => inputRef.current?.click()} type="button">
            Choose file
          </button>
          {value ? (
            <button className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-muted" onClick={clearFile} type="button">
              <X size={14} />
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
