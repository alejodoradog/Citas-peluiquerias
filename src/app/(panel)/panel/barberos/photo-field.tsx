"use client";

import { compressPhoto } from "@/lib/imagenes/compress";
import type { ImageUploadTicket } from "@/lib/imagenes/keys";
import { Avatar } from "@/ui/avatar";
import { Button, buttonClasses } from "@/ui/button";
import { cx } from "@/ui/cx";
import { ImageIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";
import {
  ImageUploadNotices,
  filePickerClasses,
  useImageUpload,
  type PendingImage,
} from "../image-upload";

const t = textos.barberos.foto;

// A photo uploaded in this visit, not saved yet: its key travels with the
// form (photoPath) and the preview is the compressed file itself.
export type PendingPhoto = PendingImage;

// The photo of D-54, at 400 px. Choosing a file shrinks it in the browser,
// asks the server for a signed URL and uploads it (decision 0007); "Guardar"
// then saves the key. "Quitar foto" drops a photo not saved yet, or deletes
// the saved one right away (removeSaved).
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
  const { uploading, removing, busy, error, choose, remove } = useImageUpload({
    kind: "barbers",
    compress: (file) => compressPhoto(file),
    requestUpload,
    pending,
    onPendingChange,
    onUploadingChange,
    removeSaved,
  });
  const shownUrl = pending?.previewUrl ?? savedUrl;

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={pending?.path ?? ""} />
      <div className="flex flex-wrap items-center gap-3.5">
        <Avatar name={personName} size="lg" photoUrl={shownUrl ?? undefined} />
        <label
          className={cx(
            buttonClasses({ variant: "secondary", size: "sm", block: false }),
            filePickerClasses,
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
      <ImageUploadNotices
        texts={t}
        uploading={uploading}
        error={error}
        ready={pending !== null}
      />
      {!shownUrl && !error && !uploading ? (
        <p className="text-help text-muted">{t.ayuda}</p>
      ) : null}
    </div>
  );
}
