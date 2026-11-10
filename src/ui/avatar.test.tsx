import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, initialsOf } from "./avatar";

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
