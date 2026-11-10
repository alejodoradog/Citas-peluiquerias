import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SelectField } from "./select-field";

const options = [
  { value: "30", label: "30 min" },
  { value: "40", label: "40 min" },
  { value: "45", label: "45 min" },
];

describe("SelectField", () => {
  it("is a native select named by its label and described by its help", () => {
    render(
      <SelectField
        label="Duración"
        name="duration"
        options={options}
        defaultValue="40"
        help="De 5 a 240 minutos."
      />,
    );
    const select = screen.getByRole("combobox", { name: "Duración" });
    expect(select).toHaveAttribute("name", "duration");
    expect(select).toHaveValue("40");
    expect(select).toHaveAccessibleDescription("De 5 a 240 minutos.");
    expect(select).not.toHaveAttribute("aria-invalid");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("changes with the user's choice and sends it with the form", async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <SelectField label="Duración" name="duration" options={options} />
      </form>,
    );
    await user.selectOptions(screen.getByLabelText("Duración"), "45");
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(data.get("duration")).toBe("45");
  });

  it("swaps the help for the error and marks the field invalid", () => {
    render(
      <SelectField
        label="Duración"
        name="duration"
        options={options}
        help="De 5 a 240 minutos."
        error="Elige una duración."
      />,
    );
    const select = screen.getByLabelText("Duración");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Elige una duración.");
    expect(screen.queryByText("De 5 a 240 minutos.")).not.toBeInTheDocument();
  });

  it("looks like a text field, with 16 px text and a decorative chevron", () => {
    const { container } = render(
      <SelectField label="Duración" name="duration" options={options} />,
    );
    const select = screen.getByLabelText("Duración");
    expect(select).toHaveClass("text-base", "h-12.5", "rounded-field");
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });
});
