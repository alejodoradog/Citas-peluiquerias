import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, initialsOf, shopInitialsOf } from "./avatar";

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Mario Gómez")).toBe("MG");
    expect(initialsOf("ana maría rojas")).toBe("AM");
  });

  it("takes the first two letters of a single word", () => {
    expect(initialsOf("Kevin")).toBe("KE");
    expect(initialsOf("andrés")).toBe("AN");
  });

  it("ignores extra spaces and keeps accented letters", () => {
    expect(initialsOf("  Óscar   Ñañez ")).toBe("ÓÑ");
  });

  it("handles one letter and an empty name", () => {
    expect(initialsOf("J")).toBe("J");
    expect(initialsOf("   ")).toBe("");
  });
});

describe("shopInitialsOf", () => {
  it("skips the word that says what the business is (D-57: LE)", () => {
    expect(shopInitialsOf("Barbería La Esquina")).toBe("LE");
    expect(shopInitialsOf("barberia el parche")).toBe("EP");
    expect(shopInitialsOf("Peluquería Mónica")).toBe("MÓ");
  });

  it("keeps the word when it is the whole name", () => {
    expect(shopInitialsOf("Barbería")).toBe("BA");
  });

  it("works like a person's initials otherwise", () => {
    expect(shopInitialsOf("Don José Barber Shop")).toBe("DJ");
  });
});

describe("Avatar", () => {
  it("shows the initials in a 44 px circle, hidden from screen readers", () => {
    const { container } = render(<Avatar name="Mario Gómez" size="md" />);
    const avatar = container.firstElementChild!;
    expect(avatar).toHaveTextContent("MG");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar).toHaveClass("size-11", "bg-brand-soft", "text-brand-strong");
  });

  it("is 64 px in its large size", () => {
    const { container } = render(<Avatar name="Kevin" size="lg" />);
    expect(container.firstElementChild).toHaveClass("size-16");
  });

  it("shows the photo instead of the initials", () => {
    const { container } = render(
      <Avatar name="Kevin" size="md" photoUrl="https://example.com/k.jpg" />,
    );
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://example.com/k.jpg");
    expect(img).toHaveAttribute("alt", "");
    expect(container.firstElementChild).not.toHaveTextContent("KE");
  });
});
