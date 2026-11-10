import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./checkbox";
import { Chip } from "./chip";
import { Switch } from "./switch";

describe("Switch", () => {
  it("is a switch named by its label and described by its detail", () => {
    render(
      <Switch
        label="Avisos por correo"
        description="Recibe cada nueva reserva."
        name="avisos"
      />,
    );
    const control = screen.getByRole("switch", { name: "Avisos por correo" });
    expect(control).toHaveAccessibleDescription("Recibe cada nueva reserva.");
    expect(control).not.toBeChecked();
  });

  it("turns on with a tap and with the space bar", async () => {
    const user = userEvent.setup();
    render(<Switch label="Avisos por correo" name="avisos" />);
    const control = screen.getByRole("switch", { name: "Avisos por correo" });
    await user.click(screen.getByText("Avisos por correo"));
    expect(control).toBeChecked();
    control.focus();
    await user.keyboard(" ");
    expect(control).not.toBeChecked();
  });

  it("sends its value with the form", () => {
    render(
      <form data-testid="form">
        <Switch label="Avisos" name="avisos" defaultChecked />
      </form>,
    );
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(data.get("avisos")).toBe("on");
  });

  it("does not change while disabled", async () => {
    render(<Switch label="Avisos" name="avisos" disabled />);
    await userEvent.click(screen.getByText("Avisos"));
    expect(screen.getByRole("switch", { name: "Avisos" })).not.toBeChecked();
  });
});

describe("Checkbox", () => {
  it("checks with a tap on its label and with the space bar", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Yo también corto" name="corto" />);
    const box = screen.getByRole("checkbox", { name: "Yo también corto" });
    await user.click(screen.getByText("Yo también corto"));
    expect(box).toBeChecked();
    box.focus();
    await user.keyboard(" ");
    expect(box).not.toBeChecked();
  });

  it("gives the whole row a 44 px touch target", () => {
    render(<Checkbox label="Yo también corto" name="corto" />);
    expect(screen.getByText("Yo también corto").closest("label")).toHaveClass(
      "min-h-11",
    );
  });
});

describe("Chip", () => {
  it("shows a state without being a control", () => {
    render(<Chip tone="success">Atendida</Chip>);
    const chip = screen.getByText("Atendida");
    expect(chip).not.toHaveAttribute("tabindex");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
