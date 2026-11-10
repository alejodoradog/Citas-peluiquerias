import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QrCode, qrMatrix, qrPath } from "./qr-code";

const LINK = "https://yapoin.co/barberia-la-esquina";

describe("qrMatrix", () => {
  it("is square, with a quiet zone of 4 light modules", () => {
    const matrix = qrMatrix(LINK);
    const size = matrix.length;
    // Version 1 is 21 modules; every version adds 4. Plus 4 on each side.
    expect((size - 8 - 21) % 4).toBe(0);
    for (const row of matrix) expect(row).toHaveLength(size);
    for (let i = 0; i < 4; i++) {
      expect(matrix[i]!.every((dark) => !dark)).toBe(true);
      expect(matrix[size - 1 - i]!.every((dark) => !dark)).toBe(true);
      expect(matrix.every((row) => !row[i] && !row[size - 1 - i])).toBe(true);
    }
    // The top-left finder pattern starts right after the quiet zone.
    expect(matrix[4]![4]).toBe(true);
  });

  it("gives the same code for the same text", () => {
    expect(qrMatrix(LINK)).toEqual(qrMatrix(LINK));
    expect(qrMatrix(LINK)).not.toEqual(qrMatrix(`${LINK}-2`));
  });
});

describe("qrPath", () => {
  it("draws one rectangle per run of dark modules", () => {
    expect(
      qrPath([
        [false, true, true],
        [true, false, true],
      ]),
    ).toBe("M1 0h2v1h-2zM0 1h1v1h-1zM2 1h1v1h-1z");
  });
});

describe("QrCode", () => {
  it("is one image named by its label, drawn as a single path", () => {
    const { container } = render(
      <QrCode value={LINK} label="Código QR del link de reservas" />,
    );
    const image = screen.getByRole("img", {
      name: "Código QR del link de reservas",
    });
    expect(image).toHaveAttribute("width", "168");
    expect(container.querySelectorAll("path")).toHaveLength(1);
    const size = qrMatrix(LINK).length;
    expect(image).toHaveAttribute("viewBox", `0 0 ${size} ${size}`);
    expect(image).toHaveClass("bg-white", "border-line", "rounded-[0.75rem]");
  });

  it("drops the border inside a grey block (D-62)", () => {
    render(<QrCode value={LINK} label="QR" size={200} bordered={false} />);
    const image = screen.getByRole("img", { name: "QR" });
    expect(image).not.toHaveClass("border");
    expect(image).not.toHaveClass("border-line");
    expect(image).toHaveClass("bg-white", "rounded-[0.75rem]");
  });

  it("takes another size", () => {
    render(<QrCode value={LINK} label="QR" size={200} />);
    expect(screen.getByRole("img", { name: "QR" })).toHaveAttribute(
      "height",
      "200",
    );
  });
});
