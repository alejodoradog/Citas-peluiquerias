import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LegalBack } from "./legal-back";

const address = vi.hoisted(() => ({ search: "", back: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: address.back }),
  useSearchParams: () => new URLSearchParams(address.search),
}));

// jsdom does not navigate: a link that is followed is only told apart by
// whether its click was prevented.
function follow(name: string): boolean {
  let followed = false;
  // On the document: after the link's own handler has had its say.
  const stay = (event: Event) => {
    followed = !event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener("click", stay);
  fireEvent.click(screen.getByRole("link", { name }));
  document.removeEventListener("click", stay);
  return followed;
}

describe("LegalBack", () => {
  const length = vi.spyOn(window.history, "length", "get");
  beforeEach(() => {
    address.search = "";
    address.back.mockClear();
    length.mockReturnValue(3);
  });
  afterEach(() => {
    length.mockReset();
  });

  it("leads home when the text was opened by its own address", () => {
    render(<LegalBack />);
    const link = screen.getByRole("link", { name: "Volver al inicio" });
    expect(link).toHaveAttribute("href", "/");
    expect(follow("Volver al inicio")).toBe(true);
    expect(address.back).not.toHaveBeenCalled();
  });

  it("goes back to the form the text was opened from", () => {
    address.search = "volver=1";
    render(<LegalBack />);
    expect(follow("Volver")).toBe(false);
    expect(address.back).toHaveBeenCalledTimes(1);
  });

  it("leads home when there is nowhere to go back to", () => {
    address.search = "volver=1";
    length.mockReturnValue(1);
    render(<LegalBack />);
    expect(screen.getByRole("link", { name: "Volver" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(follow("Volver")).toBe(true);
    expect(address.back).not.toHaveBeenCalled();
  });
});
