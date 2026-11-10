import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as icons from "./icons";

describe("icons", () => {
  it.each(Object.entries(icons))("%s is decorative", (_, Icon) => {
    const { container } = render(<Icon size={18} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "18");
    expect(svg.querySelectorAll("path, rect, circle").length).toBeGreaterThan(
      0,
    );
  });

  it("includes the icons of the setup and sharing screens", () => {
    for (const name of [
      "ChevronLeftIcon",
      "CloseIcon",
      "CopyIcon",
      "DownloadIcon",
      "EditIcon",
      "ImageIcon",
    ]) {
      expect(icons).toHaveProperty(name);
    }
  });
});
