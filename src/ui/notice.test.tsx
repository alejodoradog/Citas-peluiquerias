import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Notice } from "./notice";

describe("Notice", () => {
  it("announces a danger notice at once", () => {
    render(
      <Notice tone="danger" title="El correo o la contraseña no coinciden." />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El correo o la contraseña no coinciden.",
    );
  });

  it.each(["info", "success", "warning"] as const)(
    "lets a %s notice wait its turn",
    (tone) => {
      render(<Notice tone={tone} title="Listo" />);
      expect(screen.getByRole("status")).toHaveTextContent("Listo");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("shows the detail and the action under the title", () => {
    render(
      <Notice
        tone="warning"
        title="Tu prueba gratis vence en 3 días"
        action={<a href="/pagar">Ver cómo pagar</a>}
      >
        Paga para seguir recibiendo reservas.
      </Notice>,
    );
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Paga para seguir recibiendo reservas.");
    expect(
      screen.getByRole("link", { name: "Ver cómo pagar" }),
    ).toBeInTheDocument();
  });

  it("never names itself with the icon", () => {
    const { container } = render(<Notice tone="info" title="Aviso" />);
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });
});
