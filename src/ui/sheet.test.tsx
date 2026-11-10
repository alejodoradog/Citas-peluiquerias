import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "./sheet";
import { textos } from "./textos";

function Demo({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Editar Corte
      </button>
      <Sheet
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Editar servicio"
      >
        <label>
          Nombre
          <input name="name" defaultValue="Corte" />
        </label>
      </Sheet>
    </>
  );
}

function dialog(): HTMLDialogElement {
  return document.querySelector("dialog")!;
}

describe("Sheet", () => {
  it("stays closed until it is opened", () => {
    render(<Demo />);
    expect(dialog()).not.toHaveAttribute("open");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens as a modal dialog named by its title", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByRole("button", { name: "Editar Corte" }));
    const sheet = screen.getByRole("dialog", { name: "Editar servicio" });
    expect(sheet).toHaveAttribute("open");
    expect(
      screen.getByRole("heading", { level: 2, name: "Editar servicio" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Corte");
  });

  it("closes with its 44 px button and gives focus back to the opener", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Demo onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Editar Corte" });
    await user.click(opener);
    const close = screen.getByRole("button", { name: textos.ui.cerrar });
    expect(close).toHaveClass("size-11");
    await user.click(close);
    expect(onClose).toHaveBeenCalledOnce();
    expect(dialog()).not.toHaveAttribute("open");
    expect(opener).toHaveFocus();
  });

  it("closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Demo onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Editar Corte" }));
    // Browsers turn Escape into a cancel event on a modal dialog.
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(dialog(), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
    expect(dialog()).not.toHaveAttribute("open");
  });

  it("closes with a tap on the backdrop, not inside the sheet", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Demo onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Editar Corte" }));
    await user.click(screen.getByLabelText("Nombre"));
    expect(onClose).not.toHaveBeenCalled();
    // A tap on the backdrop lands on the dialog element itself.
    fireEvent.click(dialog());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("tells the parent when the browser closes it on its own", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Demo onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Editar Corte" }));
    dialog().close();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("draws the handle as decoration", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByRole("button", { name: "Editar Corte" }));
    const handle = dialog().querySelector('[data-handle="true"]');
    expect(handle).toHaveAttribute("aria-hidden", "true");
    expect(dialog()).toHaveClass("rounded-t-[1.375rem]", "backdrop:bg-ink/45");
  });
});
