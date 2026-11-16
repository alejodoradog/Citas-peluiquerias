import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageUploadTicket } from "@/modulos/barberias/acciones/barbers";
import { textos } from "@/ui/textos";
import { PhotoField, type PendingPhoto } from "./photo-field";

const t = textos.barberos.foto;

const compressPhoto = vi.fn();
const uploadToSignedImageUrl = vi.fn();

vi.mock("@/lib/imagenes/compress", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/imagenes/compress")>()),
  compressPhoto: (...args: unknown[]) => compressPhoto(...args),
}));
vi.mock("@/lib/imagenes/upload", () => ({
  uploadToSignedImageUrl: (...args: unknown[]) =>
    uploadToSignedImageUrl(...args),
}));

const KEY =
  "aaaaaaaa-0000-4000-8000-000000000000/barbers/11111111-1111-4111-8111-111111111111.webp";
const OTHER_KEY =
  "aaaaaaaa-0000-4000-8000-000000000000/barbers/22222222-2222-4222-8222-222222222222.webp";

const discardUpload = vi.fn<(kind: "barbers", path: string) => Promise<void>>(
  async () => {},
);

function Harness({
  requestUpload,
  savedUrl = null,
  removeSaved,
}: {
  requestUpload: (kind: "barbers", mime: string) => Promise<ImageUploadTicket>;
  savedUrl?: string | null;
  removeSaved?: () => Promise<boolean>;
}) {
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  return (
    <form aria-label="foto">
      <PhotoField
        name="photoPath"
        personName="Kevin"
        savedUrl={savedUrl}
        pending={pending}
        onPendingChange={setPending}
        onUploadingChange={() => {}}
        requestUpload={requestUpload}
        discardUpload={discardUpload}
        removeSaved={removeSaved}
      />
    </form>
  );
}

const photo = new File(["png"], "kevin.png", { type: "image/png" });
const hiddenPath = () =>
  document.querySelector<HTMLInputElement>('input[name="photoPath"]')!;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:vista-previa");
  URL.revokeObjectURL = vi.fn();
  compressPhoto.mockResolvedValue({
    blob: new Blob(["webp"], { type: "image/webp" }),
    mime: "image/webp",
  });
  uploadToSignedImageUrl.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PhotoField", () => {
  it("offers to add a photo, with the initials meanwhile", () => {
    render(<Harness requestUpload={vi.fn()} />);
    expect(screen.getByLabelText(t.agregar)).toHaveAttribute("type", "file");
    expect(screen.getByText("KE")).toBeInTheDocument();
    expect(screen.getByText(t.ayuda)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t.quitar }),
    ).not.toBeInTheDocument();
    expect(hiddenPath()).toHaveValue("");
  });

  it("shrinks, uploads and keeps the key for the form", async () => {
    const user = userEvent.setup();
    const requestUpload = vi.fn(async () => ({
      ok: true as const,
      path: KEY,
      token: "firma",
    }));
    render(<Harness requestUpload={requestUpload} />);
    await user.upload(screen.getByLabelText(t.agregar), photo);

    await waitFor(() => expect(hiddenPath()).toHaveValue(KEY));
    expect(compressPhoto).toHaveBeenCalledWith(photo);
    expect(requestUpload).toHaveBeenCalledWith("barbers", "image/webp");
    expect(uploadToSignedImageUrl).toHaveBeenCalledWith(
      KEY,
      "firma",
      expect.any(Blob),
      "image/webp",
    );
    expect(screen.getByRole("status")).toHaveTextContent(t.lista);
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "blob:vista-previa",
    );
    expect(screen.getByLabelText(t.cambiar)).toBeInTheDocument();

    expect(discardUpload).not.toHaveBeenCalled();

    // "Quitar foto" drops a photo that is not saved yet, and the bucket
    // drops it too.
    await user.click(screen.getByRole("button", { name: t.quitar }));
    expect(hiddenPath()).toHaveValue("");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:vista-previa");
    expect(discardUpload).toHaveBeenCalledExactlyOnceWith("barbers", KEY);
  });

  it("discards the photo not saved yet when another one is chosen", async () => {
    const user = userEvent.setup();
    const requestUpload = vi
      .fn<(kind: "barbers", mime: string) => Promise<ImageUploadTicket>>()
      .mockResolvedValueOnce({ ok: true, path: KEY, token: "firma" })
      .mockResolvedValueOnce({ ok: true, path: OTHER_KEY, token: "firma" });
    render(<Harness requestUpload={requestUpload} />);
    await user.upload(screen.getByLabelText(t.agregar), photo);
    await waitFor(() => expect(hiddenPath()).toHaveValue(KEY));

    await user.upload(screen.getByLabelText(t.cambiar), photo);
    await waitFor(() => expect(hiddenPath()).toHaveValue(OTHER_KEY));
    expect(discardUpload).toHaveBeenCalledExactlyOnceWith("barbers", KEY);
  });

  it("keeps the photo not saved yet when the new one fails", async () => {
    const user = userEvent.setup();
    const requestUpload = vi
      .fn<(kind: "barbers", mime: string) => Promise<ImageUploadTicket>>()
      .mockResolvedValueOnce({ ok: true, path: KEY, token: "firma" })
      .mockResolvedValueOnce({ ok: false, error: "photo_upload_failed" });
    render(<Harness requestUpload={requestUpload} />);
    await user.upload(screen.getByLabelText(t.agregar), photo);
    await waitFor(() => expect(hiddenPath()).toHaveValue(KEY));

    await user.upload(screen.getByLabelText(t.cambiar), photo);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.photo_upload_failed,
    );
    expect(hiddenPath()).toHaveValue(KEY);
    expect(discardUpload).not.toHaveBeenCalled();
  });

  it("refuses a file that is not an image", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const requestUpload = vi.fn();
    render(<Harness requestUpload={requestUpload} />);
    await user.upload(
      screen.getByLabelText(t.agregar),
      new File(["%PDF"], "cedula.pdf", { type: "application/pdf" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.photo_not_image,
    );
    expect(requestUpload).not.toHaveBeenCalled();
  });

  it("explains a photo the browser cannot open", async () => {
    const user = userEvent.setup();
    compressPhoto.mockRejectedValue(new Error("decode"));
    render(<Harness requestUpload={vi.fn()} />);
    await user.upload(screen.getByLabelText(t.agregar), photo);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.photo_unreadable,
    );
  });

  it("refuses a photo still over 256 KB", async () => {
    const user = userEvent.setup();
    compressPhoto.mockResolvedValue({
      blob: new Blob([new Uint8Array(256 * 1024 + 1)], { type: "image/jpeg" }),
      mime: "image/jpeg",
    });
    const requestUpload = vi.fn();
    render(<Harness requestUpload={requestUpload} />);
    await user.upload(screen.getByLabelText(t.agregar), photo);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.photo_too_big,
    );
    expect(requestUpload).not.toHaveBeenCalled();
  });

  it("explains a failed upload and keeps nothing", async () => {
    const user = userEvent.setup();
    uploadToSignedImageUrl.mockResolvedValue(false);
    render(
      <Harness
        requestUpload={async () => ({ ok: true, path: KEY, token: "firma" })}
      />,
    );
    await user.upload(screen.getByLabelText(t.agregar), photo);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.photo_upload_failed,
    );
    expect(hiddenPath()).toHaveValue("");
  });

  it("explains when the server gives no upload URL", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        requestUpload={async () => ({
          ok: false,
          error: "photo_upload_failed",
        })}
      />,
    );
    await user.upload(screen.getByLabelText(t.agregar), photo);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.photo_upload_failed,
    );
    expect(uploadToSignedImageUrl).not.toHaveBeenCalled();
  });

  it("says so when the barbershop reached its image quota", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        requestUpload={async () => ({ ok: false, error: "photo_quota" })}
      />,
    );
    await user.upload(screen.getByLabelText(t.agregar), photo);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.photo_quota,
    );
    expect(uploadToSignedImageUrl).not.toHaveBeenCalled();
  });

  it("deletes a saved photo right away, and says when it could not", async () => {
    const user = userEvent.setup();
    const removeSaved = vi.fn(async () => false);
    render(
      <Harness
        requestUpload={vi.fn()}
        savedUrl="https://fotos/kevin.webp"
        removeSaved={removeSaved}
      />,
    );
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "https://fotos/kevin.webp",
    );
    await user.click(screen.getByRole("button", { name: t.quitar }));
    expect(removeSaved).toHaveBeenCalledOnce();
    expect(await screen.findByRole("alert")).toHaveTextContent(t.falloQuitar);
  });
});
