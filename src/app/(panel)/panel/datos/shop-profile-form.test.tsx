import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COVER_COMPRESSION } from "@/lib/imagenes/compress";
import type { ImageUploadTicket } from "@/lib/imagenes/keys";
import type { ShopProfileState } from "@/modulos/barberias/acciones/shop-profile";
import { FreshOnReturn } from "@/ui/fresh-on-return";
import { textos } from "@/ui/textos";
import { ShopProfileForm, type EditableShopProfile } from "./shop-profile-form";

const t = textos.datos;

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

const SHOP = "aaaaaaaa-0000-4000-8000-000000000000";
const LOGO_KEY = `${SHOP}/logo/11111111-1111-4111-8111-111111111111.webp`;
const COVER_KEY = `${SHOP}/cover/22222222-2222-4222-8222-222222222222.webp`;

const idle = async (): Promise<ShopProfileState> => ({ status: "idle" });

const saved: EditableShopProfile = {
  name: "Barbería La Esquina",
  address: "Cra. 15 # 82-40",
  locality: "Chapinero, Bogotá",
  whatsappPhone: "300 123 4567",
  location: null,
  logoUrl: null,
  coverUrl: null,
};

function renderForm({
  action = idle,
  profile = saved,
  requestUpload = vi.fn<
    (kind: "logo" | "cover", mime: string) => Promise<ImageUploadTicket>
  >(async (kind) => ({
    ok: true,
    path: kind === "logo" ? LOGO_KEY : COVER_KEY,
    token: "firma",
  })),
  discardUpload = vi.fn<
    (kind: "logo" | "cover", path: string) => Promise<void>
  >(async () => {}),
  removeImage = vi.fn(async () => ({ ok: true }) as const),
}: {
  action?: (
    previous: ShopProfileState,
    formData: FormData,
  ) => Promise<ShopProfileState>;
  profile?: EditableShopProfile;
  requestUpload?: (
    kind: "logo" | "cover",
    mime: string,
  ) => Promise<ImageUploadTicket>;
  discardUpload?: (kind: "logo" | "cover", path: string) => Promise<void>;
  removeImage?: (
    kind: "logo" | "cover",
  ) => Promise<{ ok: true } | { ok: false }>;
} = {}) {
  render(
    <ShopProfileForm
      action={action}
      saved={profile}
      requestUpload={requestUpload}
      discardUpload={discardUpload}
      removeImage={removeImage}
    />,
  );
  return { requestUpload, discardUpload, removeImage };
}

const hidden = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
const picture = new File(["png"], "logo.png", { type: "image/png" });

type Geolocation = Pick<globalThis.Geolocation, "getCurrentPosition">;
function stubGeolocation(geolocation: Geolocation | undefined) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: geolocation,
  });
}

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
  stubGeolocation(undefined);
});

describe("ShopProfileForm", () => {
  it("shows the saved data, as the design does", () => {
    renderForm();
    expect(
      screen.getByRole("heading", { level: 1, name: t.titulo }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: textos.ui.volver }),
    ).toHaveAttribute("href", "/panel/mas");
    expect(screen.getByRole("textbox", { name: t.campos.nombre })).toHaveValue(
      "Barbería La Esquina",
    );
    expect(
      screen.getByRole("textbox", { name: t.campos.direccion }),
    ).toHaveValue("Cra. 15 # 82-40");
    expect(screen.getByRole("textbox", { name: t.campos.barrio })).toHaveValue(
      "Chapinero, Bogotá",
    );
    const whatsapp = screen.getByRole("textbox", { name: t.campos.whatsapp });
    expect(whatsapp).toHaveValue("300 123 4567");
    expect(whatsapp).toHaveAttribute("type", "tel");
    expect(whatsapp).toHaveAccessibleDescription(t.ayudas.whatsapp);
    // No logo yet: the initials, without "Barbería".
    expect(screen.getByRole("img", { name: t.logo.sinLogo })).toHaveTextContent(
      "LE",
    );
    expect(screen.getByLabelText(t.logo.agregar)).toHaveAttribute(
      "type",
      "file",
    );
    expect(screen.getByLabelText(t.portada.agregar)).toHaveAttribute(
      "type",
      "file",
    );
    expect(
      screen.queryByRole("button", { name: t.logo.quitar }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: t.ubicacion.usar }),
    ).toBeInTheDocument();
    expect(hidden("location")).toHaveValue("");
    expect(screen.getByRole("button", { name: t.guardar })).toBeEnabled();
  });

  it("uploads a logo at 400 px into the logo folder", async () => {
    const user = userEvent.setup();
    const { requestUpload, discardUpload, removeImage } = renderForm();
    await user.upload(screen.getByLabelText(t.logo.agregar), picture);

    await waitFor(() => expect(hidden("logoPath")).toHaveValue(LOGO_KEY));
    // The default size of compressPhoto, as a barber's photo.
    expect(compressPhoto).toHaveBeenCalledWith(picture);
    expect(requestUpload).toHaveBeenCalledWith("logo", "image/webp");
    expect(screen.getByRole("status")).toHaveTextContent(t.logo.lista);
    expect(screen.getByRole("img", { name: t.logo.actual })).toHaveAttribute(
      "src",
      "blob:vista-previa",
    );
    expect(hidden("coverPath")).toHaveValue("");

    // A pending logo is dropped, and only the upload leaves the bucket:
    // the saved logo stays.
    await user.click(screen.getByRole("button", { name: t.logo.quitar }));
    expect(hidden("logoPath")).toHaveValue("");
    expect(discardUpload).toHaveBeenCalledExactlyOnceWith("logo", LOGO_KEY);
    expect(removeImage).not.toHaveBeenCalled();
  });

  it("says so when the barbershop reached its image quota", async () => {
    const user = userEvent.setup();
    renderForm({
      requestUpload: async () => ({ ok: false, error: "photo_quota" }),
    });
    await user.upload(screen.getByLabelText(t.portada.agregar), picture);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.portada.errores.photo_quota,
    );
    expect(uploadToSignedImageUrl).not.toHaveBeenCalled();
    expect(hidden("coverPath")).toHaveValue("");
  });

  it("uploads the cover at 1200 px into the cover folder", async () => {
    const user = userEvent.setup();
    const { requestUpload } = renderForm();
    await user.upload(screen.getByLabelText(t.portada.agregar), picture);

    await waitFor(() => expect(hidden("coverPath")).toHaveValue(COVER_KEY));
    expect(compressPhoto).toHaveBeenCalledWith(picture, COVER_COMPRESSION);
    expect(requestUpload).toHaveBeenCalledWith("cover", "image/webp");
    expect(screen.getByRole("status")).toHaveTextContent(t.portada.lista);
    expect(screen.getByLabelText(t.portada.cambiar)).toBeInTheDocument();
    expect(hidden("logoPath")).toHaveValue("");
  });

  it("holds Guardar while an image uploads", async () => {
    const user = userEvent.setup();
    let finish: (stored: boolean) => void = () => {};
    uploadToSignedImageUrl.mockReturnValue(
      new Promise<boolean>((resolve) => (finish = resolve)),
    );
    renderForm();
    await user.upload(screen.getByLabelText(t.portada.agregar), picture);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: t.guardar })).toBeDisabled(),
    );
    expect(screen.getByText(t.portada.subiendo)).toBeInTheDocument();
    await act(async () => finish(true));
    expect(screen.getByRole("button", { name: t.guardar })).toBeEnabled();
  });

  it("refuses a cover still over 256 KB", async () => {
    const user = userEvent.setup();
    compressPhoto.mockResolvedValue({
      blob: new Blob([new Uint8Array(256 * 1024 + 1)], { type: "image/jpeg" }),
      mime: "image/jpeg",
    });
    const { requestUpload } = renderForm();
    await user.upload(screen.getByLabelText(t.portada.agregar), picture);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.portada.errores.photo_too_big,
    );
    expect(requestUpload).not.toHaveBeenCalled();
  });

  it("removes a saved logo and a saved cover right away", async () => {
    const user = userEvent.setup();
    const { removeImage } = renderForm({
      profile: {
        ...saved,
        logoUrl: "https://fotos/logo.webp",
        coverUrl: "https://fotos/portada.webp",
      },
    });
    expect(screen.getByRole("img", { name: t.logo.actual })).toHaveAttribute(
      "src",
      "https://fotos/logo.webp",
    );
    expect(screen.getByLabelText(t.logo.cambiar)).toBeInTheDocument();
    expect(screen.getByLabelText(t.portada.cambiar)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.logo.quitar }));
    await user.click(screen.getByRole("button", { name: t.portada.quitar }));
    expect(removeImage).toHaveBeenCalledWith("logo");
    expect(removeImage).toHaveBeenCalledWith("cover");
  });

  it("says when a saved image could not be removed", async () => {
    const user = userEvent.setup();
    renderForm({
      profile: { ...saved, coverUrl: "https://fotos/portada.webp" },
      removeImage: vi.fn(async () => ({ ok: false }) as const),
    });
    await user.click(screen.getByRole("button", { name: t.portada.quitar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.portada.falloQuitar,
    );
  });

  it("marks the location from the phone and links it to the map", async () => {
    const user = userEvent.setup();
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>(
      (success) =>
        success({
          coords: { latitude: 4.66712345, longitude: -74.0545 },
        } as GeolocationPosition),
    );
    stubGeolocation({ getCurrentPosition });
    renderForm();
    await user.click(screen.getByRole("button", { name: t.ubicacion.usar }));

    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true }),
    );
    expect(hidden("location")).toHaveValue("4.667123,-74.054500");
    expect(screen.getByText(t.ubicacion.marcada)).toBeInTheDocument();
    const map = screen.getByRole("link", { name: t.ubicacion.verNuevaPestana });
    expect(map).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=4.667123%2C-74.054500",
    );
    expect(map).toHaveAttribute("target", "_blank");
    expect(map).toHaveAttribute("rel", "noopener noreferrer");

    await user.click(screen.getByRole("button", { name: t.ubicacion.quitar }));
    expect(hidden("location")).toHaveValue("");
    expect(
      screen.queryByRole("link", { name: t.ubicacion.verNuevaPestana }),
    ).not.toBeInTheDocument();
  });

  it("shows a saved location as saved", () => {
    renderForm({
      profile: { ...saved, location: { latitude: 4.6371, longitude: -74.065 } },
    });
    expect(hidden("location")).toHaveValue("4.637100,-74.065000");
    expect(screen.getByText(t.ubicacion.guardada)).toBeInTheDocument();
  });

  it("explains a denied permission and keeps what there was", async () => {
    const user = userEvent.setup();
    stubGeolocation({
      getCurrentPosition: (_success, failure) =>
        failure?.({
          code: 1,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
          message: "denied",
        } as GeolocationPositionError),
    });
    renderForm({
      profile: { ...saved, location: { latitude: 4.6371, longitude: -74.065 } },
    });
    await user.click(screen.getByRole("button", { name: t.ubicacion.usar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.ubicacion.errores.denied,
    );
    expect(hidden("location")).toHaveValue("4.637100,-74.065000");
  });

  it("explains a position the phone could not find", async () => {
    const user = userEvent.setup();
    stubGeolocation({
      getCurrentPosition: (_success, failure) =>
        failure?.({
          code: 3,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
          message: "timeout",
        } as GeolocationPositionError),
    });
    renderForm();
    await user.click(screen.getByRole("button", { name: t.ubicacion.usar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.ubicacion.errores.unavailable,
    );
  });

  it("explains a browser without location", async () => {
    const user = userEvent.setup();
    stubGeolocation(undefined);
    renderForm();
    await user.click(screen.getByRole("button", { name: t.ubicacion.usar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.ubicacion.errores.unsupported,
    );
  });

  it("shows the errors of the server by field and keeps what was typed", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<ShopProfileState> => ({
      status: "invalid",
      fieldErrors: {
        name: "barbershop_name_required",
        whatsappPhone: "phone_invalid",
      },
      values: { name: "", whatsappPhone: "601 234", address: "Calle 1" },
    }));
    renderForm({ action });
    await user.clear(screen.getByRole("textbox", { name: t.campos.nombre }));
    await user.click(screen.getByRole("button", { name: t.guardar }));

    const name = await screen.findByRole("textbox", { name: t.campos.nombre });
    await waitFor(() =>
      expect(name).toHaveAccessibleDescription(
        t.errores.barbershop_name_required,
      ),
    );
    expect(
      screen.getByRole("textbox", { name: t.campos.whatsapp }),
    ).toHaveAccessibleDescription(t.errores.phone_invalid);
    expect(
      screen.getByRole("textbox", { name: t.campos.whatsapp }),
    ).toHaveValue("601 234");
    expect(
      screen.getByRole("textbox", { name: t.campos.direccion }),
    ).toHaveValue("Calle 1");
  });

  it("drops a pending image the server refused", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<ShopProfileState> => ({
      status: "failed",
      error: "image_invalid",
      values: { logoPath: "" },
    }));
    renderForm({ action });
    await user.upload(screen.getByLabelText(t.logo.agregar), picture);
    await waitFor(() => expect(hidden("logoPath")).toHaveValue(LOGO_KEY));
    await user.click(screen.getByRole("button", { name: t.guardar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.image_invalid,
    );
    expect(hidden("logoPath")).toHaveValue("");
  });
});

// Next.js keeps a page it leaves mounted and hidden (Activity) and shows the
// same instance again on coming back; the page wraps the form in
// FreshOnReturn, as D-60 does.
describe("ShopProfileForm, hidden and shown again", () => {
  function inActivity(mode: "visible" | "hidden") {
    return (
      <Activity mode={mode}>
        <FreshOnReturn>
          <ShopProfileForm
            action={idle}
            saved={saved}
            requestUpload={async () => ({
              ok: true,
              path: LOGO_KEY,
              token: "firma",
            })}
            discardUpload={async () => {}}
            removeImage={async () => ({ ok: true })}
          />
        </FreshOnReturn>
      </Activity>
    );
  }

  it("starts again from what is saved, without the draft or the upload", async () => {
    const user = userEvent.setup();
    const { rerender } = render(inActivity("visible"));
    const name = screen.getByRole("textbox", { name: t.campos.nombre });
    await user.clear(name);
    await user.type(name, "Borrador");
    await user.upload(screen.getByLabelText(t.logo.agregar), picture);
    await waitFor(() => expect(hidden("logoPath")).toHaveValue(LOGO_KEY));

    rerender(inActivity("hidden"));

    // Coming back is a later navigation, never the same task.

    await act(async () => {});
    rerender(inActivity("visible"));

    expect(screen.getByRole("textbox", { name: t.campos.nombre })).toHaveValue(
      "Barbería La Esquina",
    );
    expect(hidden("logoPath")).toHaveValue("");
  });
});
