"use client";

import { useId, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { ImagePlus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/misc";

export type PhotoItem = { key: string; url: string; file?: File };

/** Shrinks a phone photo to ~150 KB WebP before upload, so listings load fast on 3G. */
export async function compressPhoto(file: File): Promise<File> {
  const out = await imageCompression(file, {
    maxSizeMB: 0.15,
    maxWidthOrHeight: 1280,
    fileType: "image/webp",
    initialQuality: 0.8,
    useWebWorker: false,
  });
  return new File([out], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
}

/** Up to `max` photos: add from camera or gallery, preview, remove. The parent uploads on save. */
export function PhotoUploader({
  items,
  onChange,
  max = 4,
  disabled,
  className,
}: {
  items: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
  max?: number;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const room = Math.max(0, max - items.length);
      const picked = Array.from(files).slice(0, room);
      const compressed = await Promise.all(picked.map((f) => compressPhoto(f).catch(() => f)));
      onChange([
        ...items,
        ...compressed.map((file) => ({ key: `${file.name}-${crypto.randomUUID()}`, url: URL.createObjectURL(file), file })),
      ]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {items.map((p, i) => (
        <div key={p.key} className="relative aspect-[4/3] max-w-full overflow-hidden rounded-md bg-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer */}
          <img src={p.url} alt="" className="size-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(items.filter((x) => x.key !== p.key))}
            disabled={disabled}
            className="absolute top-1.5 right-1.5 flex size-10 items-center justify-center rounded-full bg-surface/90 text-ink shadow-card hover:bg-surface"
            aria-label={t("produce.removePhoto", { n: i + 1 })}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ))}
      {items.length < max ? (
        <label
          htmlFor={inputId}
          className={cn(
            "flex aspect-[4/3] max-w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border-strong bg-surface text-center text-small font-semibold text-ink hover:bg-sunken",
            "has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus",
            (disabled || busy) && "pointer-events-none opacity-60",
          )}
        >
          {busy ? <Spinner /> : <ImagePlus className="size-7 text-ink-muted" aria-hidden />}
          {t("produce.addPhoto")}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={disabled || busy}
            onChange={(e) => void addFiles(e.target.files)}
          />
        </label>
      ) : null}
    </div>
  );
}
