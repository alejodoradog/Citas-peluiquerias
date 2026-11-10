"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { isImageFile } from "@/lib/imagenes/compress";
import {
  IMAGE_MAX_BYTES,
  type ImageKind,
  type ImageMime,
  type ImageUploadErrorCode,
  type ImageUploadTicket,
} from "@/lib/imagenes/keys";
import { uploadToSignedImageUrl } from "@/lib/imagenes/upload";
import { Notice } from "@/ui/notice";

// An image uploaded in this visit, not saved yet: its key travels with the
// form and the preview is the compressed file itself.
export type PendingImage = { path: string; previewUrl: string };

// A <label> that wraps a visually hidden file input: it draws the input's
// focus ring and its disabled state, so the keyboard reaches the picker.
export const filePickerClasses =
  "has-[:focus-visible]:outline-brand-strong cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2";

export type ImageUploadError = ImageUploadErrorCode | "remove";

// The copy of one image picker (a barber's photo, the logo, the cover).
export type ImageTexts = {
  quitando: string;
  subiendo: string;
  lista: string;
  falloQuitar: string;
  errores: Record<ImageUploadErrorCode, string>;
};

// The upload of an image of the panel (decision 0007). Choosing a file
// shrinks it in the browser, asks the server for a signed URL in the folder
// of `kind` and uploads it; the form's "Guardar" then saves the key, and its
// action checks it again. remove() drops an image not saved yet, or deletes
// the saved one right away (removeSaved).
export function useImageUpload<Kind extends ImageKind>({
  kind,
  compress,
  requestUpload,
  pending,
  onPendingChange,
  onUploadingChange,
  removeSaved,
}: {
  kind: Kind;
  compress: (file: File) => Promise<{ blob: Blob; mime: ImageMime }>;
  requestUpload: (kind: Kind, mime: string) => Promise<ImageUploadTicket>;
  pending: PendingImage | null;
  onPendingChange: (image: PendingImage | null) => void;
  onUploadingChange: (uploading: boolean) => void;
  removeSaved?: () => Promise<boolean>;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<ImageUploadError | null>(null);
  const [removing, startRemoving] = useTransition();

  function replacePending(image: PendingImage | null) {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    onPendingChange(image);
  }

  async function upload(file: File): Promise<ImageUploadErrorCode | null> {
    if (!isImageFile(file)) return "photo_not_image";
    let compressed: Awaited<ReturnType<typeof compress>>;
    try {
      compressed = await compress(file);
    } catch {
      return "photo_unreadable";
    }
    if (compressed.blob.size > IMAGE_MAX_BYTES) return "photo_too_big";

    const ticket = await requestUpload(kind, compressed.mime).catch(
      () => ({ ok: false }) as const,
    );
    if (!ticket.ok) return "photo_upload_failed";
    const stored = await uploadToSignedImageUrl(
      ticket.path,
      ticket.token,
      compressed.blob,
      compressed.mime,
    );
    if (!stored) return "photo_upload_failed";
    replacePending({
      path: ticket.path,
      previewUrl: URL.createObjectURL(compressed.blob),
    });
    return null;
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // The same file can be chosen again after an error.
    input.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    onUploadingChange(true);
    try {
      setError(await upload(file));
    } finally {
      setUploading(false);
      onUploadingChange(false);
    }
  }

  function remove() {
    setError(null);
    if (pending) {
      replacePending(null);
      return;
    }
    if (!removeSaved) return;
    startRemoving(async () => {
      if (!(await removeSaved())) setError("remove");
    });
  }

  return {
    uploading,
    removing,
    busy: uploading || removing,
    error,
    choose,
    remove,
  };
}

// What the picker says under the image: uploading, what went wrong, or that
// the new image waits for "Guardar".
export function ImageUploadNotices({
  texts,
  uploading,
  error,
  ready,
}: {
  texts: ImageTexts;
  uploading: boolean;
  error: ImageUploadError | null;
  ready: boolean;
}) {
  return (
    <>
      {uploading ? <Notice tone="info" title={texts.subiendo} /> : null}
      {error ? (
        <Notice
          tone="danger"
          title={error === "remove" ? texts.falloQuitar : texts.errores[error]}
        />
      ) : null}
      {ready && !uploading && !error ? (
        <Notice tone="success" title={texts.lista} />
      ) : null}
    </>
  );
}
