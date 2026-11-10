import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, ButtonLink, buttonClasses } from "./button";
import { TextLink } from "./text-link";

describe("Button", () => {
  it("is a plain button unless it says otherwise", () => {
    render(<Button>Reservar cita</Button>);
    expect(
      screen.getByRole("button", { name: "Reservar cita" }),
    ).toHaveAttribute("type", "button");
  });

  it("does not act while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Guardar
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it.each(["primary", "secondary", "danger", "dangerSolid", "text"] as const)(
    "draws the %s variant of F-01",
    (variant) => {
      render(<Button variant={variant}>Acción</Button>);
      expect(screen.getByRole("button", { name: "Acción" })).toHaveClass(
        "rounded-button",
      );
    },
  );

  it("never draws a touch target under 44 px", () => {
    expect(buttonClasses({ size: "lg" })).toContain("min-h-13.5");
    expect(buttonClasses({ size: "md" })).toContain("min-h-11.5");
    expect(buttonClasses({ size: "sm" })).toContain("min-h-11");
  });

  it("is full width unless asked not to be", () => {
    expect(buttonClasses()).toContain("w-full");
    expect(buttonClasses({ block: false })).not.toContain("w-full");
  });
});

describe("ButtonLink", () => {
  it("is a link styled as a button", () => {
    render(
      <ButtonLink href="/registro" variant="secondary">
        Crear cuenta
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "Crear cuenta" });
    expect(link).toHaveAttribute("href", "/registro");
    expect(link).toHaveClass("border-line");
  });
});

describe("TextLink", () => {
  it("is a 44 px tall target when it stands alone", () => {
    render(
      <TextLink href="/ingresar" standalone>
        Volver a ingresar
      </TextLink>,
    );
    expect(screen.getByRole("link", { name: "Volver a ingresar" })).toHaveClass(
      "min-h-11",
    );
  });

  it("flows with the text inside a sentence", () => {
    render(<TextLink href="/ingresar">Ingresa</TextLink>);
    expect(screen.getByRole("link", { name: "Ingresa" })).not.toHaveClass(
      "min-h-11",
    );
  });
});
