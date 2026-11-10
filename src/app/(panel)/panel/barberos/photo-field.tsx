"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { compressPhoto, isImageFile } from "@/lib/imagenes/compress";
import {
  IMAGE_MAX_BYTES,
  type ImageUploadErrorCode,
} from "@/lib/imagenes/keys";
import { uploadToSignedImageUrl } from "@/lib/imagenes/upload";
import type { ImageUploadTicket } from "@/modulos/barberias/acciones/barbers";
import { Avatar } from "@/ui/avatar";
import { Button, buttonClasses } from "@/ui/button";
import { cx } from "@/ui/cx";
import { ImageIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";

const t = textos.barberos.foto;

// A photo uploaded in this visit, not saved yet: its key travels with the
// form (photoPath) and the preview is the compressed file itself.
export type PendingPhoto = { path: string; previewUrl: string };

// The photo of D-54. Choosing a file shrinks it in the browser, asks the
// server for a signed URL and uploads it (decision 0007); "Guardar" then
// saves the key. "Quitar foto" drops a photo not saved yet, or deletes the
// saved one right away (removeSaved).
export function PhotoField({
  name,
  personName,
  savedUrl,
  pending,
  onPendingChange,
  onUploadingChange,
  requestUpload,
  removeSaved,
}: {
  name: string;
  // For the initials while there is no photo.
  personName: string;
  savedUrl: string | null;
  pending: PendingPhoto | null;
  onPendingChange: (photo: PendingPhoto | null) => void;
  onUploadingChange: (uploading: boolean) => void;
  requestUpload: (kind: "barbers", mime: string) => Promise<ImageUploadTicket>;
  removeSaved?: () => Promise<boolean>;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<ImageUploadErrorCode | "remove" | null>(
    null,
  );
  const [removing, startRemoving] = useTransition();
  const shownUrl = pending?.previewUrl ?? savedUrl;
  const busy = uploading || removing;

  function replacePending(photo: PendingPhoto | null) {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    onPendingChange(photo);
  }

  async function upload(file: File): Promise<ImageUploadErrorCode | null> {
    if (!isImageFile(file)) return "photo_not_image";
    let compressed: Awaited<ReturnType<typeof compressPhoto>>;
    try {
      compressed = await compressPhoto(file);
    } catch {
      return "photo_unreadable";
    }
    if (compressed.blob.size > IMAGE_MAX_BYTES) return "photo_too_big";

    const ticket = await requestUpload("barbers", compressed.mime).catch(
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

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={pending?.path ?? ""} />
      <div className="flex flex-wrap items-center gap-3.5">
        <Avatar name={personName} size="lg" photoUrl={shownUrl ?? undefined} />
        <label
          className={cx(
            buttonClasses({ variant: "secondary", size: "sm", block: false }),
            "has-[:focus-visible]:outline-brand-strong cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
          )}
        >
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={choose}
          />
          <ImageIcon size={18} />
          {shownUrl ? t.cambiar : t.agregar}
        </label>
        {shownUrl && (pending || removeSaved) ? (
          <Button
            variant="text"
            size="sm"
            block={false}
            disabled={busy}
            onClick={remove}
          >
            {removing ? t.quitando : t.quitar}
          </Button>
        ) : null}
      </div>
      {uploading ? <Notice tone="info" title={t.subiendo} /> : null}
      {error ? (
        <Notice
          tone="danger"
          title={error === "remove" ? t.falloQuitar : t.errores[error]}
        />
      ) : null}
      {pending && !uploading && !error ? (
        <Notice tone="success" title={t.lista} />
      ) : null}
      {!shownUrl && !error && !uploading ? (
        <p className="text-help text-muted">{t.ayuda}</p>
      ) : null}
    </div>
  );
}
