import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field";

describe("Field", () => {
  it("is named by its label and described by its help", () => {
    render(<Field label="Correo" name="email" help="Aquí te llega todo." />);
    const input = screen.getByLabelText("Correo");
    expect(input).toHaveAttribute("name", "email");
    expect(input).toHaveAccessibleDescription("Aquí te llega todo.");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("swaps the help for the error and marks the field invalid", () => {
    render(
      <Field
        label="Correo"
        name="email"
        help="Aquí te llega todo."
        error="Revisa el correo."
      />,
    );
    const input = screen.getByLabelText("Correo");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Revisa el correo.");
    expect(screen.queryByText("Aquí te llega todo.")).not.toBeInTheDocument();
  });

  it("says when the field is optional", () => {
    render(<Field label="Celular" name="phone" optional />);
    expect(screen.getByLabelText("Celular (opcional)")).toBeInTheDocument();
  });

  it("uses 16 px text so phones do not zoom in", () => {
    render(<Field label="Correo" name="email" />);
    expect(screen.getByLabelText("Correo")).toHaveClass("text-base");
  });
});
