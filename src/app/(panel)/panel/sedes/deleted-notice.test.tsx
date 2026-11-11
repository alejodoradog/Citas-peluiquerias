import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { textos } from "@/ui/textos";
import {
  DeletedBarbershopNotice,
  rememberDeletedBarbershop,
} from "./deleted-notice";

afterEach(() => {
  window.sessionStorage.clear();
});

describe("DeletedBarbershopNotice", () => {
  it("says which sede was deleted, once", async () => {
    rememberDeletedBarbershop("El Parche Sur");
    const { unmount } = render(<DeletedBarbershopNotice />);
    expect(
      await screen.findByText(textos.sedes.eliminada("El Parche Sur")),
    ).toBeInTheDocument();
    expect(textos.sedes.eliminada("El Parche Sur")).toBe(
      "Eliminamos la sede El Parche Sur",
    );
    unmount();
    render(<DeletedBarbershopNotice />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps saying it under Strict Mode, which runs the effect twice", async () => {
    rememberDeletedBarbershop("El Parche Sur");
    render(
      <StrictMode>
        <DeletedBarbershopNotice />
      </StrictMode>,
    );
    expect(
      await screen.findByText(textos.sedes.eliminada("El Parche Sur")),
    ).toBeInTheDocument();
  });

  it("shows nothing without a deletion", () => {
    render(<DeletedBarbershopNotice />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
