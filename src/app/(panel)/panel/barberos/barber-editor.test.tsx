import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BarberState } from "@/modulos/barberias/acciones/barbers";
import { textos } from "@/ui/textos";
import { BarberEditor, type EditableBarber } from "./barber-editor";

const t = textos.barberos;

vi.mock("@/lib/imagenes/compress", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/imagenes/compress")>()),
  compressPhoto: async () => ({
    blob: new Blob(["webp"], { type: "image/webp" }),
    mime: "image/webp",
  }),
}));
vi.mock("@/lib/imagenes/upload", () => ({
  uploadToSignedImageUrl: async () => true,
}));

const CORTE = "00000000-0000-0000-0000-00000000000a";
const BARBA = "00000000-0000-0000-0000-00000000000b";
const services = [
  { id: CORTE, name: "Corte" },
  { id: BARBA, name: "Barba" },
];
const KEY =
  "aaaaaaaa-0000-4000-8000-000000000000/barbers/11111111-1111-4111-8111-111111111111.webp";

const kevin: EditableBarber = {
  id: "00000000-0000-0000-0000-000000000001",
  displayName: "Kevin",
  email: "kevin@correo.com",
  emailNotifications: true,
  photoUrl: null,
  serviceIds: [BARBA],
  active: true,
  isOwner: false,
  linkActive: true,
  inactiveSince: null,
};

const requestUpload = async () =>
  ({ ok: true, path: KEY, token: "firma" }) as const;

// A fake Server Action that echoes the form like the real one.
function answer(
  build: (values: Record<string, string>) => BarberState,
): (previous: BarberState, formData: FormData) => Promise<BarberState> {
  return async (_previous, formData) =>
    build({
      displayName: String(formData.get("displayName")),
      email: String(formData.get("email")),
      emailNotifications:
        formData.get("emailNotifications") === "on" ? "on" : "",
      serviceIds: formData.getAll("serviceIds").join(","),
      photoPath: String(formData.get("photoPath") ?? ""),
    });
}

const hiddenPath = () =>
  document.querySelector<HTMLInputElement>('input[name="photoPath"]')!;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:vista-previa");
  URL.revokeObjectURL = vi.fn();
});

describe("BarberEditor", () => {
  it("starts a new barber with every service and the barbershop's hours", async () => {
    const user = userEvent.setup();
    render(
      <BarberEditor
        action={answer(() => ({ status: "idle" }))}
        barber={null}
        services={services}
        hoursSummary={t.horarioBarberia}
        requestUpload={requestUpload}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: t.nuevo }),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Corte" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Barba" })).toBeChecked();
    expect(screen.getByText(t.horarioBarberia)).toBeInTheDocument();
    expect(screen.getByText(t.linkNuevo)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Desactivar/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: textos.ui.cerrar }),
    ).toHaveAttribute("href", "/panel/barberos");

    // Email notices need an email first.
    const notices = screen.getByRole("switch", { name: t.avisos });
    expect(notices).toBeDisabled();
    expect(notices).toHaveAccessibleDescription(t.avisosSinCorreo);
    await user.type(screen.getByLabelText(/Correo/), "kevin@correo.com");
    expect(notices).toBeEnabled();
    expect(notices).toHaveAccessibleDescription(t.avisosAyuda);
  });

  it("shows a saved barber, with their link and services", () => {
    render(
      <BarberEditor
        action={answer(() => ({ status: "idle" }))}
        barber={kevin}
        services={services}
        hoursSummary="Lun a sáb 9:00 a. m. – 6:00 p. m."
        requestUpload={requestUpload}
        setActive={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Kevin" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(t.campos.nombre)).toHaveValue("Kevin");
    expect(screen.getByLabelText(/Correo/)).toHaveValue("kevin@correo.com");
    expect(screen.getByRole("switch", { name: t.avisos })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Corte" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Barba" })).toBeChecked();
    expect(screen.getByText(t.linkActivoChip)).toBeInTheDocument();
    expect(
      screen.getByText("Lun a sáb 9:00 a. m. – 6:00 p. m."),
    ).toBeInTheDocument();
  });

  it("asks before deactivating, and says the link keeps working", async () => {
    const user = userEvent.setup();
    const setActive = vi.fn(async () => ({ ok: true }) as const);
    render(
      <BarberEditor
        action={answer(() => ({ status: "idle" }))}
        barber={kevin}
        services={services}
        hoursSummary={t.horarioBarberia}
        requestUpload={requestUpload}
        setActive={setActive}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: t.desactivar("Kevin") }),
    );
    const sheet = screen.getByRole("dialog", {
      name: t.confirmar.titulo("Kevin"),
    });
    expect(sheet).toHaveTextContent(t.confirmar.cuerpo);
    expect(t.confirmar.cuerpo).toMatch(/citas ya tomadas se conservan/);
    expect(t.confirmar.cuerpo).not.toMatch(/deja de funcionar/);
    expect(setActive).not.toHaveBeenCalled();

    await user.click(
      within(sheet).getByRole("button", { name: t.confirmar.si("Kevin") }),
    );
    expect(setActive).toHaveBeenCalledWith(kevin.id, false);
  });

  it("shows why deactivating failed, inside the sheet", async () => {
    const user = userEvent.setup();
    render(
      <BarberEditor
        action={answer(() => ({ status: "idle" }))}
        barber={kevin}
        services={services}
        hoursSummary={t.horarioBarberia}
        requestUpload={requestUpload}
        setActive={async () => ({ ok: false, error: "unknown" })}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: t.desactivar("Kevin") }),
    );
    const sheet = screen.getByRole("dialog");
    await user.click(
      within(sheet).getByRole("button", { name: t.confirmar.si("Kevin") }),
    );
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      t.errores.unknown,
    );
  });

  it("brings an inactive barber back with one tap", async () => {
    const user = userEvent.setup();
    const setActive = vi.fn(async () => ({ ok: true }) as const);
    render(
      <BarberEditor
        action={answer(() => ({ status: "idle" }))}
        barber={{ ...kevin, active: false, inactiveSince: "2 de noviembre" }}
        services={services}
        hoursSummary={t.horarioBarberia}
        requestUpload={requestUpload}
        setActive={setActive}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      t.inactivoAviso("2 de noviembre"),
    );
    expect(
      screen.queryByRole("button", { name: t.desactivar("Kevin") }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: t.reactivar("Kevin") }),
    );
    expect(setActive).toHaveBeenCalledWith(kevin.id, true);
  });

  it("never offers to deactivate the owner", () => {
    render(
      <BarberEditor
        action={answer(() => ({ status: "idle" }))}
        barber={{ ...kevin, displayName: "Mario", isOwner: true }}
        services={services}
        hoursSummary={t.horarioBarberia}
        requestUpload={requestUpload}
        setActive={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: t.desactivar("Mario") }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(t.linkDueno)).toBeInTheDocument();
  });

  it("focuses the email when the notices have nowhere to go", async () => {
    const user = userEvent.setup();
    render(
      <BarberEditor
        action={answer((values) => ({
          status: "invalid",
          fieldErrors: { email: "notifications_need_email" },
          values,
        }))}
        barber={kevin}
        services={services}
        hoursSummary={t.horarioBarberia}
        requestUpload={requestUpload}
      />,
    );
    await user.clear(screen.getByLabelText(/Correo/));
    // Already on: it stays usable so the owner can turn it off.
    expect(screen.getByRole("switch", { name: t.avisos })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: t.guardar }));

    const email = await screen.findByLabelText(/Correo/);
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(email).toHaveAccessibleDescription(
      t.errores.notifications_need_email,
    );
    await waitFor(() => expect(email).toHaveFocus());
  });

  it("explains a missing service next to the checkboxes", async () => {
    const user = userEvent.setup();
    render(
      <BarberEditor
        action={answer((values) => ({
          status: "invalid",
          fieldErrors: { serviceIds: "barber_services_required" },
          values,
        }))}
        barber={null}
        services={services}
        hoursSummary={t.horarioBarberia}
        requestUpload={requestUpload}
      />,
    );
    await user.click(screen.getByRole("checkbox", { name: "Corte" }));
    await user.click(screen.getByRole("checkbox", { name: "Barba" }));
    await user.click(screen.getByRole("button", { name: t.guardar }));
    const corte = await screen.findByRole("checkbox", { name: "Corte" });
    await waitFor(() =>
      expect(corte).toHaveAccessibleDescription(
        t.errores.barber_services_required,
      ),
    );
    expect(corte).not.toBeChecked();
    await waitFor(() => expect(corte).toHaveFocus());
  });

  it("keeps an uploaded photo across an error, and drops one the server refused", async () => {
    const user = userEvent.setup();
    let refuse = false;
    render(
      <BarberEditor
        action={answer((values) =>
          refuse
            ? {
                status: "failed",
                error: "photo_invalid",
                values: { ...values, photoPath: "" },
              }
            : {
                status: "invalid",
                fieldErrors: { displayName: "barber_name_required" },
                values,
              },
        )}
        barber={null}
        services={services}
        hoursSummary={t.horarioBarberia}
        requestUpload={requestUpload}
      />,
    );
    await user.upload(
      screen.getByLabelText(t.foto.agregar),
      new File(["png"], "kevin.png", { type: "image/png" }),
    );
    await waitFor(() => expect(hiddenPath()).toHaveValue(KEY));

    await user.click(screen.getByRole("button", { name: t.guardar }));
    expect(
      await screen.findByText(t.errores.barber_name_required),
    ).toBeInTheDocument();
    expect(hiddenPath()).toHaveValue(KEY);

    refuse = true;
    await user.type(screen.getByLabelText(t.campos.nombre), "Kevin");
    await user.click(screen.getByRole("button", { name: t.guardar }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.photo_invalid,
    );
    expect(hiddenPath()).toHaveValue("");
  });
});
