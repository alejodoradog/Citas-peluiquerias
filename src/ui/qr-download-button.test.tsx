import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QrDownloadButton } from "./qr-download-button";
import { textos } from "./textos";

const matrix = [
  [false, true],
  [true, false],
];

// jsdom has no canvas: fake the 2D context and the PNG export.
function fakeCanvas(blob: Blob | null) {
  const context = { fillStyle: "", fillRect: vi.fn() };
  const sizes: Array<[number, number]> = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      sizes.push([this.width, this.height]);
      return context as unknown as CanvasRenderingContext2D;
    } as never,
  );
  const toBlob = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback, type) => {
      expect(type).toBe("image/png");
      callback(blob);
    });
  return { context, sizes, toBlob };
}

const downloads: string[] = [];

beforeEach(() => {
  downloads.length = 0;
  URL.createObjectURL = vi.fn(() => "blob:qr");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(`${this.download} ${this.href}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QrDownloadButton", () => {
  it("draws the code on a 1024 px canvas and downloads it as PNG", async () => {
    const user = userEvent.setup();
    const { context, sizes, toBlob } = fakeCanvas(new Blob(["png"]));
    render(
      <QrDownloadButton
        matrix={matrix}
        fileName="qr-barberia-la-esquina.png"
        label="Descargar QR para imprimir"
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Descargar QR para imprimir" }),
    );
    expect(sizes).toEqual([[1024, 1024]]);
    // White background first, then the two dark modules.
    expect(context.fillRect).toHaveBeenNthCalledWith(1, 0, 0, 1024, 1024);
    expect(context.fillRect).toHaveBeenCalledTimes(3);
    expect(toBlob).toHaveBeenCalledOnce();
    expect(downloads).toEqual(["qr-barberia-la-esquina.png blob:qr"]);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says so when the browser cannot make the image", async () => {
    const user = userEvent.setup();
    fakeCanvas(null);
    render(
      <QrDownloadButton matrix={matrix} fileName="qr.png" label="Descargar" />,
    );
    await user.click(screen.getByRole("button", { name: "Descargar" }));
    expect(downloads).toEqual([]);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        textos.ui.qr.falloDescarga,
      ),
    );
  });
});
