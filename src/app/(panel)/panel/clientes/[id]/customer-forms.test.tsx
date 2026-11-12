import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  DeleteCustomerState,
  NotesState,
} from "@/modulos/clientes/acciones/customers";
import { textos } from "@/ui/textos";
import { DeleteCustomer } from "./delete-customer";
import { NotesForm } from "./notes-form";

const t = textos.clientes;
const ID = "c0000000-0000-4000-8000-000000000001";

describe("NotesForm", () => {
  it("offers to save only once the notes change, and says when they were saved", async () => {
    const action = vi.fn(
      async (_: NotesState, formData: FormData): Promise<NotesState> => {
        expect(formData.get("customerId")).toBe(ID);
        expect(formData.get("notes")).toBe(
          "Prefiere a Andrés. Degradado bajo.",
        );
        return { status: "done", notice: "saved" };
      },
    );
    render(
      <NotesForm customerId={ID} notes="Prefiere a Andrés." action={action} />,
    );
    const notes = screen.getByRole("textbox", { name: t.ficha.notas.etiqueta });
    expect(notes).toHaveValue("Prefiere a Andrés.");
    expect(
      screen.queryByRole("button", { name: t.ficha.notas.guardar }),
    ).toBeNull();

    await userEvent.type(notes, " Degradado bajo.");
    await userEvent.click(
      screen.getByRole("button", { name: t.ficha.notas.guardar }),
    );

    await waitFor(() =>
      expect(screen.getByText(t.ficha.notas.guardadas)).toBeInTheDocument(),
    );
    expect(action).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: t.ficha.notas.guardar }),
    ).toBeNull();
  });

  it("shows what went wrong", async () => {
    render(
      <NotesForm
        customerId={ID}
        notes={null}
        action={async () => ({
          status: "failed",
          error: "unknown",
          values: { notes: "Algo" },
        })}
      />,
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: t.ficha.notas.etiqueta }),
      "Algo",
    );
    await userEvent.click(
      screen.getByRole("button", { name: t.ficha.notas.guardar }),
    );
    expect(
      await screen.findByText(t.ficha.notas.errores.unknown),
    ).toBeInTheDocument();
  });
});

describe("DeleteCustomer", () => {
  const sheetName = t.borrar.titulo("Diego Prada");

  it("asks before deleting, says what stays, and closes with Volver", async () => {
    const action = vi.fn(async (): Promise<DeleteCustomerState> => ({
      status: "idle",
    }));
    render(
      <DeleteCustomer customerId={ID} name="Diego Prada" action={action} />,
    );
    const opener = screen.getByRole("button", { name: t.borrar.boton });
    await userEvent.click(opener);

    const sheet = screen.getByRole("dialog", { name: sheetName });
    expect(within(sheet).getByText(t.borrar.cuerpo)).toBeInTheDocument();
    await userEvent.click(
      within(sheet).getByRole("button", { name: t.borrar.volver }),
    );
    expect(screen.queryByRole("dialog", { name: sheetName })).toBeNull();
    expect(action).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it("sends the customer and shows why it could not delete them", async () => {
    const action = vi.fn(
      async (
        _: DeleteCustomerState,
        formData: FormData,
      ): Promise<DeleteCustomerState> => {
        expect(formData.get("customerId")).toBe(ID);
        return {
          status: "failed",
          error: "has_upcoming_appointments",
          values: {},
        };
      },
    );
    render(
      <DeleteCustomer customerId={ID} name="Diego Prada" action={action} />,
    );
    await userEvent.click(screen.getByRole("button", { name: t.borrar.boton }));
    const sheet = screen.getByRole("dialog", { name: sheetName });
    await userEvent.click(
      within(sheet).getByRole("button", { name: t.borrar.confirmar }),
    );
    expect(
      await within(sheet).findByText(
        t.borrar.errores.has_upcoming_appointments,
      ),
    ).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(1);
  });
});
