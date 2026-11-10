import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookingLinkCard } from "./booking-link-card";
import { textos } from "./textos";

const t = textos.ui.linkReservas;

describe("BookingLinkCard", () => {
  it("shows the link without the protocol, 18 px and breaking anywhere", () => {
    render(<BookingLinkCard slug="barberia-la-esquina" name="La Esquina" />);
    const link = screen.getByText("yapoin.com/barberia-la-esquina");
    expect(link.tagName).toBe("STRONG");
    expect(link).toHaveClass("text-lg", "break-all");
  });

  it("copies and shares, side by side", () => {
    render(<BookingLinkCard slug="barberia-la-esquina" name="La Esquina" />);
    const copy = screen.getByRole("button", { name: t.copiar });
    const share = screen.getByRole("button", { name: t.compartir });
    expect(copy).toHaveClass("border-line");
    expect(share).toHaveClass("border-line");
    expect(copy.closest(".grid")).toBe(share.closest(".grid"));
  });

  it("makes copying the main action where the screen asks (D-62)", () => {
    render(
      <BookingLinkCard
        slug="barberia-la-esquina"
        name="La Esquina"
        copyVariant="primary"
      />,
    );
    expect(screen.getByRole("button", { name: t.copiar })).toHaveClass(
      "bg-brand",
    );
    expect(screen.getByRole("button", { name: t.compartir })).toHaveClass(
      "border-line",
    );
  });

  it("names the link when given a label (D-14) and has none otherwise", () => {
    const { container, unmount } = render(
      <BookingLinkCard
        slug="barberia-la-esquina"
        name="La Esquina"
        label="Link de reservas"
      />,
    );
    expect(screen.getByText("Link de reservas")).toHaveClass("text-help");
    expect(container.firstElementChild).toHaveClass("gap-2");
    unmount();

    const second = render(
      <BookingLinkCard slug="barberia-la-esquina" name="La Esquina" />,
    );
    expect(screen.queryByText("Link de reservas")).not.toBeInTheDocument();
    expect(second.container.firstElementChild).toHaveClass("gap-2.5");
  });
});
