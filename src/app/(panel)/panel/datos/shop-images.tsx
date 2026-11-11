"use client";

import { COVER_COMPRESSION, compressPhoto } from "@/lib/imagenes/compress";
import type { ImageUploadTicket } from "@/lib/imagenes/keys";
import { shopInitialsOf } from "@/ui/avatar";
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

const t = textos.datos;

type ShopImageProps = {
  savedUrl: string | null;
  pending: PendingImage | null;
  onPendingChange: (image: PendingImage | null) => void;
  onUploadingChange: (uploading: boolean) => void;
  requestUpload: (
    kind: "logo" | "cover",
    mime: string,
  ) => Promise<ImageUploadTicket>;
  discardUpload: (kind: "logo" | "cover", path: string) => Promise<void>;
  // Deletes the saved image right away; false when it could not.
  removeSaved: () => Promise<boolean>;
};

// The logo of D-57: a 72 px square with the barbershop's initials while
// there is none, shrunk to 400 px like a barber's photo. Its key travels with
// the form as logoPath.
export function LogoField({
  barbershopName,
  savedUrl,
  pending,
  onPendingChange,
  onUploadingChange,
  requestUpload,
  discardUpload,
  removeSaved,
}: ShopImageProps & { barbershopName: string }) {
  const upload = useImageUpload({
    kind: "logo",
    compress: (file) => compressPhoto(file),
    requestUpload,
    discardUpload,
    pending,
    onPendingChange,
    onUploadingChange,
    removeSaved: savedUrl ? removeSaved : undefined,
  });
  const shownUrl = pending?.previewUrl ?? savedUrl;

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="logoPath" value={pending?.path ?? ""} />
      <div className="flex flex-wrap items-center gap-3.5">
        {shownUrl ? (
          // A small image from storage; next/image would need every storage
          // host configured and adds nothing at 72 px.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shownUrl}
            alt={t.logo.actual}
            className="size-18 shrink-0 rounded-[1.125rem] bg-white object-cover"
          />
        ) : (
          <span
            role="img"
            aria-label={t.logo.sinLogo}
            className="bg-ink flex size-18 shrink-0 items-center justify-center rounded-[1.125rem] text-2xl font-bold text-white"
          >
            {shopInitialsOf(barbershopName)}
          </span>
        )}
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
            disabled={upload.busy}
            onChange={upload.choose}
          />
          <ImageIcon size={18} />
          {shownUrl ? t.logo.cambiar : t.logo.agregar}
        </label>
        {shownUrl ? (
          <Button
            variant="text"
            size="sm"
            block={false}
            disabled={upload.busy}
            onClick={upload.remove}
          >
            {upload.removing ? t.logo.quitando : t.logo.quitar}
          </Button>
        ) : null}
      </div>
      <ImageUploadNotices
        texts={t.logo}
        uploading={upload.uploading}
        error={upload.error}
        ready={pending !== null}
      />
    </div>
  );
}

// The cover of D-57: a 120 px banner the owner taps to change, shrunk to
// 1200 px within 100 KB where it can (COVER_COMPRESSION). Its key travels
// with the form as coverPath.
export function CoverField({
  savedUrl,
  pending,
  onPendingChange,
  onUploadingChange,
  requestUpload,
  discardUpload,
  removeSaved,
}: ShopImageProps) {
  const upload = useImageUpload({
    kind: "cover",
    compress: (file) => compressPhoto(file, COVER_COMPRESSION),
    requestUpload,
    discardUpload,
    pending,
    onPendingChange,
    onUploadingChange,
    removeSaved: savedUrl ? removeSaved : undefined,
  });
  const shownUrl = pending?.previewUrl ?? savedUrl;

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="coverPath" value={pending?.path ?? ""} />
      <label
        className={cx(
          "rounded-card text-help text-muted relative flex h-30 items-center justify-center gap-2 overflow-hidden font-semibold",
          !shownUrl && "image-placeholder",
          filePickerClasses,
        )}
      >
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={upload.busy}
          onChange={upload.choose}
        />
        {shownUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shownUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
        <span
          className={cx(
            "relative flex items-center gap-2",
            shownUrl && "text-ink rounded-full bg-white/90 px-3 py-1.5",
          )}
        >
          <ImageIcon size={18} />
          {shownUrl ? t.portada.cambiar : t.portada.agregar}
        </span>
      </label>
      {shownUrl ? (
        <Button
          variant="text"
          size="sm"
          block={false}
          className="self-start"
          disabled={upload.busy}
          onClick={upload.remove}
        >
          {upload.removing ? t.portada.quitando : t.portada.quitar}
        </Button>
      ) : null}
      <ImageUploadNotices
        texts={t.portada}
        uploading={upload.uploading}
        error={upload.error}
        ready={pending !== null}
      />
    </div>
  );
}
