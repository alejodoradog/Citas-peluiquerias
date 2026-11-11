import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  BookingLinkState,
  SlugCheck,
} from "@/modulos/barberias/acciones/booking-link";
import { textos } from "@/ui/textos";
import { BookingLinkForm } from "./booking-link-form";

const t = textos.link;

const idle = async (): Promise<BookingLinkState> => ({ status: "idle" });

// The lookup the server would do: la-esquina is the barbershop's own,
// el-parche belongs to another one.
async function lookup(input: string): Promise<SlugCheck> {
  const slug = input.trim().toLowerCase().replace(/\s+/g, "-");
  if (slug.length < 3) return { status: "refused", error: "slug_invalid" };
  if (slug === "la-esquina") return { status: "refused", error: "slug_same" };
  if (slug === "el-parche") return { status: "taken", slug };
  return { status: "available", slug };
}

function renderForm({
  action = idle,
  check = lookup,
  changed = false,
}: {
  action?: (
    previous: BookingLinkState,
    formData: FormData,
  ) => Promise<BookingLinkState>;
  check?: (input: string) => Promise<SlugCheck>;
  changed?: boolean;
} = {}) {
  render(
    <BookingLinkForm
      action={action}
      check={check}
      current="la-esquina"
      changed={changed}
    />,
  );
  return {
    field: screen.getByRole("textbox", { name: t.nuevo }),
    button: screen.getByRole("button", { name: t.cambiar }),
  };
}

async function retype(field: HTMLElement, value: string) {
  const user = userEvent.setup();
  await user.clear(field);
  await user.type(field, value);
  return user;
}

describe("BookingLinkForm", () => {
  it("shows the current link, the new one to type and that the old one keeps working", () => {
    const { field, button } = renderForm();
    expect(
      screen.getByRole("heading", { level: 1, name: t.titulo }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.actual)).toBeInTheDocument();
    expect(screen.getByText("yapoin.com/la-esquina")).toBeInTheDocument();
    expect(screen.getByText("yapoin.com/")).toBeInTheDocument();
    expect(field).toHaveValue("la-esquina");
    expect(screen.getByText(t.aviso)).toBeInTheDocument();
    expect(screen.getByText(t.avisoDetalle)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: textos.ui.volver }),
    ).toHaveAttribute("href", "/panel/mas");
    // Nothing new typed yet.
    expect(button).toBeDisabled();
  });

  it("says a free link is available and lets the owner change to it", async () => {
    const { field, button } = renderForm();
    await retype(field, "laesquina");
    expect(await screen.findByText(t.disponible)).toBeInTheDocument();
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(field).toHaveAccessibleDescription(t.disponible);
    expect(button).toBeEnabled();
  });

  it("says which link it will be when what was typed changes", async () => {
    const { field } = renderForm();
    await retype(field, "La Esquina Norte");
    expect(
      await screen.findByText(t.disponibleComo("yapoin.com/la-esquina-norte")),
    ).toBeInTheDocument();
  });

  it("says a link of another barbershop is in use", async () => {
    const { field, button } = renderForm();
    await retype(field, "el-parche");
    expect(await screen.findByText(t.errores.slug_taken)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(button).toBeDisabled();
  });

  it("says what is wrong with a link that cannot be one", async () => {
    const { field, button } = renderForm();
    await retype(field, "jl");
    expect(await screen.findByText(t.errores.slug_invalid)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(button).toBeDisabled();
  });

  it("says when it is the link the barbershop already has", async () => {
    const { field, button } = renderForm();
    await retype(field, "la-esquina");
    expect(await screen.findByText(t.errores.slug_same)).toBeInTheDocument();
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(button).toBeDisabled();
  });

  it("looks the link up once the owner stops typing, and keeps only the last answer", async () => {
    const check = vi.fn(lookup);
    const { field } = renderForm({ check });
    await retype(field, "nueva");
    expect(await screen.findByText(t.disponible)).toBeInTheDocument();
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith("nueva");
  });

  it("lets the owner try when the lookup fails: the server checks again", async () => {
    const { field, button } = renderForm({
      check: async () => {
        throw new Error("offline");
      },
    });
    await retype(field, "nueva");
    expect(await screen.findByText(t.sinRevisar)).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("sends what was typed and shows the server's refusal under the field", async () => {
    let sent: FormData | null = null;
    const { field } = renderForm({
      action: async (_previous, formData) => {
        sent = formData;
        return {
          status: "invalid",
          fieldErrors: { slug: "slug_taken" },
          values: { slug: "nueva" },
        };
      },
    });
    const user = await retype(field, "nueva");
    await screen.findByText(t.disponible);
    await user.click(screen.getByRole("button", { name: t.cambiar }));
    expect(await screen.findByText(t.errores.slug_taken)).toBeInTheDocument();
    expect(sent!.get("slug")).toBe("nueva");
    expect(screen.getByRole("textbox", { name: t.nuevo })).toHaveValue("nueva");
    expect(screen.getByRole("button", { name: t.cambiar })).toBeDisabled();
  });

  it("shows the limit of changes for the whole form", async () => {
    const { field } = renderForm({
      action: async () => ({
        status: "failed",
        error: "slug_change_limit",
        values: { slug: "nueva" },
      }),
    });
    const user = await retype(field, "nueva");
    await screen.findByText(t.disponible);
    await user.click(screen.getByRole("button", { name: t.cambiar }));
    expect(
      await screen.findByText(t.errores.slug_change_limit),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.cambiar })).toBeDisabled();
  });

  it("says the link changed and offers to share the new one", () => {
    renderForm({ changed: true });
    expect(
      screen.getByText(t.cambiado("yapoin.com/la-esquina")),
    ).toBeInTheDocument();
    expect(screen.getByText(t.cambiadoDetalle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.compartir })).toHaveAttribute(
      "href",
      "/panel/compartir",
    );
  });
});
