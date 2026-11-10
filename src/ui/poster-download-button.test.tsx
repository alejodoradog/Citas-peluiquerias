import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PosterDownloadButton } from "./poster-download-button";
import { textos } from "./textos";

const matrix = [
  [false, true],
  [true, false],
];

// jsdom has no canvas: fake the 2D context (text 10 px per character) and
// the PNG export.
function fakeCanvas(blob: Blob | null) {
  const context = {
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    rect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
  };
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
const fontLoads: string[] = [];

beforeEach(() => {
  downloads.length = 0;
  fontLoads.length = 0;
  document.body.style.fontFamily = '"Bricolage Grotesque", sans-serif';
  Object.defineProperty(document, "fonts", {
    value: {
      load: vi.fn(async (font: string) => {
        fontLoads.push(font);
        return [];
      }),
    },
    configurable: true,
  });
  URL.createObjectURL = vi.fn(() => "blob:afiche");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(`${this.download} ${this.href}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.style.fontFamily = "";
  delete (document as { fonts?: unknown }).fonts;
});

// Stands in for the browser's Image: it "loads" a 400 × 300 logo, or fails.
function fakeImage(outcome: "load" | "error") {
  class FakeImage {
    crossOrigin = "";
    naturalWidth = 400;
    naturalHeight = 300;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_url: string) {
      queueMicrotask(() =>
        outcome === "load" ? this.onload?.() : this.onerror?.(),
      );
    }
  }
  vi.stubGlobal("Image", FakeImage);
}

const LOGO_URL =
  "https://example.supabase.co/storage/v1/object/public/images/a/logo/b.webp";

function renderButton(
  name = "Barbería La Esquina",
  logoUrl: string | null = null,
) {
  render(
    <PosterDownloadButton
      matrix={matrix}
      name={name}
      link="yapoin.com/barberia-la-esquina"
      logoUrl={logoUrl}
      caption="Reserva tu cita aquí"
      fileName="afiche-yapoin-barberia-la-esquina.png"
      label="Afiche"
    />,
  );
  return screen.getByRole("button", { name: "Afiche" });
}

describe("PosterDownloadButton", () => {
  it("draws a letter page at 150 dpi and downloads it as PNG", async () => {
    const user = userEvent.setup();
    const { context, sizes, toBlob } = fakeCanvas(new Blob(["png"]));
    await user.click(renderButton());

    await waitFor(() =>
      expect(downloads).toEqual([
        "afiche-yapoin-barberia-la-esquina.png blob:afiche",
      ]),
    );
    expect(sizes).toEqual([[1275, 1650]]);
    // The whole page in the brand color first, then the rest on top.
    expect(context.fillRect).toHaveBeenNthCalledWith(1, 0, 0, 1275, 1650);
    const texts = context.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual([
      "Barbería La Esquina",
      "Reserva tu cita aquí",
      "yapoin.com/barberia-la-esquina",
      "Abre la cámara de tu celular y apunta al código",
      "Yapoin",
    ]);
    // Without a logo there is no image to draw.
    expect(context.drawImage).not.toHaveBeenCalled();
    expect(toBlob).toHaveBeenCalledOnce();
    expect(document.querySelector("a[download]")).toBeNull();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("waits for the screen's font before writing with it", async () => {
    const user = userEvent.setup();
    const { context } = fakeCanvas(new Blob(["png"]));
    await user.click(renderButton());
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(fontLoads.length).toBeGreaterThan(0);
    for (const font of fontLoads) expect(font).toContain("Bricolage Grotesque");
    expect(context.font).toContain("Bricolage Grotesque");
  });

  it("wraps a long name over two lines at most", async () => {
    const user = userEvent.setup();
    const { context } = fakeCanvas(new Blob(["png"]));
    // 10 px per character: wider than the 975 px between the margins.
    const name = Array.from({ length: 30 }, () => "Barbería").join(" ");
    await user.click(renderButton(name));
    await waitFor(() => expect(downloads).toHaveLength(1));
    const texts = context.fillText.mock.calls.map((call) => call[0]);
    const lines = texts.slice(0, texts.indexOf("Reserva tu cita aquí"));
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith("…")).toBe(true);
    for (const line of lines) expect(line.length * 10).toBeLessThanOrEqual(975);
  });

  it("draws the barbershop's logo, cropped square, when it has one", async () => {
    const user = userEvent.setup();
    fakeImage("load");
    const { context } = fakeCanvas(new Blob(["png"]));
    await user.click(renderButton(undefined, LOGO_URL));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(context.drawImage).toHaveBeenCalledOnce();
    // The centered 300 × 300 square of the 400 × 300 logo.
    expect(context.drawImage.mock.calls[0]!.slice(1, 5)).toEqual([
      50, 0, 300, 300,
    ]);
  });

  it("goes without the logo when it does not load", async () => {
    const user = userEvent.setup();
    fakeImage("error");
    const { context } = fakeCanvas(new Blob(["png"]));
    await user.click(renderButton(undefined, LOGO_URL));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(context.drawImage).not.toHaveBeenCalled();
  });

  it("goes without the logo when the browser will not export it", async () => {
    const user = userEvent.setup();
    fakeImage("load");
    const { toBlob } = fakeCanvas(new Blob(["png"]));
    toBlob.mockImplementationOnce(() => {
      throw new DOMException(
        "Tainted canvases may not be exported.",
        "SecurityError",
      );
    });
    await user.click(renderButton(undefined, LOGO_URL));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(toBlob).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("still draws when the browser cannot load fonts", async () => {
    const user = userEvent.setup();
    delete (document as { fonts?: unknown }).fonts;
    fakeCanvas(new Blob(["png"]));
    await user.click(renderButton());
    await waitFor(() => expect(downloads).toHaveLength(1));
  });

  it("says so when the browser cannot make the image", async () => {
    const user = userEvent.setup();
    fakeCanvas(null);
    await user.click(renderButton());
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        textos.compartir.falloAfiche,
      ),
    );
    expect(downloads).toEqual([]);
  });
});
