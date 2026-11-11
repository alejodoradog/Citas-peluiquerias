import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeleteBarbershopState } from "@/modulos/barberias/acciones/barbershops";
import { textos } from "@/ui/textos";
import { DeleteBarbershop } from "./delete-barbershop";

const t = textos.sedes.eliminar;
const SUR = "bbbbbbbb-0000-4000-8000-000000000000";

type Action = (
  previous: DeleteBarbershopState,
  formData: FormData,
) => Promise<DeleteBarbershopState>;

function setup(action: Action = async () => ({ status: "idle" })) {
  const goTo = vi.fn();
  const spy = vi.fn(action);
  render(
    <DeleteBarbershop
      barbershopId={SUR}
      name="El Parche Sur"
      action={spy}
      goTo={goTo}
    />,
  );
  return { goTo, action: spy };
}

const sheet = () => screen.getByRole("dialog", { name: t.titulo });

async function openSheet() {
  await userEvent.click(screen.getByRole("button", { name: t.boton }));
  return sheet();
}

afterEach(() => {
  window.sessionStorage.clear();
});

describe("DeleteBarbershop", () => {
  it("is a danger button that opens the sheet, rendered only once open", async () => {
    setup();
    expect(
      screen.queryByRole("dialog", { name: t.titulo }),
    ).not.toBeInTheDocument();
    const dialog = await openSheet();
    expect(dialog).toHaveTextContent(t.bajada("El Parche Sur"));
    expect(dialog).toHaveTextContent(t.link);
    // Outside any form of the page: the screen around it is one form.
    expect(dialog.closest("form")).toBeNull();
  });

  it("keeps Eliminar off until the sede's name is written", async () => {
    setup();
    const dialog = await openSheet();
    const confirm = within(dialog).getByRole("button", { name: t.confirmar });
    expect(confirm).toBeDisabled();
    const field = within(dialog).getByRole("textbox", { name: t.campo });
    await userEvent.type(field, "El Parche");
    expect(confirm).toBeDisabled();
    await userEvent.type(field, " sur");
    expect(confirm).toBeEnabled();
  });

  it("sends the name and the sede it showed, then loads the agenda in full with the notice", async () => {
    const { action, goTo } = setup(async (_previous, data) => {
      expect(data.get("barbershopId")).toBe(SUR);
      expect(data.get("confirmName")).toBe("El Parche Sur");
      return { status: "done", notice: "deleted" };
    });
    const dialog = await openSheet();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: t.campo }),
      "El Parche Sur",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: t.confirmar }),
    );
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/panel"));
    expect(action).toHaveBeenCalledTimes(1);
    expect(goTo).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem("yapoin:sede-eliminada")).toBe(
      "El Parche Sur",
    );
  });

  it("says why the database refused and stays", async () => {
    const { goTo } = setup(async () => ({
      status: "failed",
      error: "has_upcoming_appointments",
      values: { confirmName: "El Parche Sur" },
    }));
    const dialog = await openSheet();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: t.campo }),
      "El Parche Sur",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: t.confirmar }),
    );
    expect(await within(sheet()).findByRole("alert")).toHaveTextContent(
      t.errores.has_upcoming_appointments,
    );
    expect(goTo).not.toHaveBeenCalled();
  });

  it("closes with Cancelar and gives focus back to its button", async () => {
    setup();
    const dialog = await openSheet();
    await userEvent.click(
      within(dialog).getByRole("button", { name: t.cancelar }),
    );
    expect(
      screen.queryByRole("dialog", { name: t.titulo }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.boton })).toHaveFocus();
  });
});
