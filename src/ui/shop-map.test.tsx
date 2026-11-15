import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShopMap } from "./shop-map";
import { textos } from "./textos";

// MapLibre needs WebGL, which jsdom has not: a stand-in records what the
// component asks of it.
const maps: { options: Record<string, unknown>; removed: boolean }[] = [];
const markers: { element: HTMLElement; anchor: string; at: unknown }[] = [];
const setWorkerUrl = vi.fn();
vi.mock("maplibre-gl", () => ({
  setWorkerUrl,
  Map: class {
    record: { options: Record<string, unknown>; removed: boolean };
    constructor(options: Record<string, unknown>) {
      this.record = { options, removed: false };
      maps.push(this.record);
    }
    once(_event: string, handler: () => void) {
      handler();
    }
    remove() {
      this.record.removed = true;
    }
  },
  Marker: class {
    record: { element: HTMLElement; anchor: string; at: unknown };
    constructor({ element, anchor }: { element: HTMLElement; anchor: string }) {
      this.record = { element, anchor, at: null };
      markers.push(this.record);
    }
    setLngLat(at: unknown) {
      this.record.at = at;
      return this;
    }
    addTo() {
      return this;
    }
  },
}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

// The map draws when it scrolls into view.
let seen: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
class FakeObserver {
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    seen = callback;
  }
  observe() {}
  disconnect() {}
}

const location = { latitude: 4.667123, longitude: -74.0545 };
const t = textos.mapa;

function userAgent(value: string, touchPoints = 0) {
  Object.defineProperty(navigator, "userAgent", { value, configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: touchPoints,
    configurable: true,
  });
}

beforeEach(() => {
  maps.length = 0;
  markers.length = 0;
  seen = null;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  userAgent("Mozilla/5.0 (X11; Linux x86_64) jsdom");
});

describe("ShopMap", () => {
  it("draws a still map once it is in view, with the initials on the pin", async () => {
    const { unmount } = render(
      <ShopMap location={location} name="La Barbería del Barrio" />,
    );
    expect(maps).toHaveLength(0);
    seen?.([{ isIntersecting: true }]);
    await waitFor(() => expect(maps).toHaveLength(1));
    expect(setWorkerUrl).toHaveBeenCalledWith(
      "/maplibre/maplibre-gl-worker.mjs",
    );
    expect(maps[0]!.options).toMatchObject({
      style: "https://tiles.openfreemap.org/styles/bright",
      center: [-74.0545, 4.667123],
      interactive: false,
    });
    expect(markers[0]!.anchor).toBe("bottom");
    expect(markers[0]!.at).toEqual([-74.0545, 4.667123]);
    expect(markers[0]!.element.textContent).toBe("LB");
    unmount();
    expect(maps[0]!.removed).toBe(true);
  });

  it("puts the logo on the pin when there is one", async () => {
    render(
      <ShopMap
        location={location}
        name="La Esquina"
        logoUrl="https://example.com/logo.webp"
      />,
    );
    seen?.([{ isIntersecting: true }]);
    await waitFor(() => expect(markers).toHaveLength(1));
    expect(markers[0]!.element.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.com/logo.webp",
    );
  });

  it("offers Apple Maps, Google Maps and Waze on an iPhone", async () => {
    const user = userEvent.setup();
    userAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)");
    render(<ShopMap location={location} name="La Esquina" />);
    await user.click(
      screen.getByRole("button", { name: t.abrir("La Esquina") }),
    );
    expect(screen.getByRole("link", { name: t.apple })).toHaveAttribute(
      "href",
      "https://maps.apple.com/?ll=4.667123,-74.054500&q=La%20Esquina",
    );
    expect(screen.getByRole("link", { name: t.google })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: t.waze }));
  });

  it("treats an iPad that says Macintosh as an iPhone", async () => {
    const user = userEvent.setup();
    userAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5);
    render(<ShopMap location={location} name="La Esquina" />);
    await user.click(
      screen.getByRole("button", { name: t.abrir("La Esquina") }),
    );
    expect(screen.getByRole("link", { name: t.waze })).toBeInTheDocument();
  });

  it("opens Google Maps in another tab on a computer", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<ShopMap location={location} name="La Esquina" />);
    await user.click(
      screen.getByRole("button", { name: t.abrir("La Esquina") }),
    );
    expect(open).toHaveBeenCalledWith(
      "https://www.google.com/maps/search/?api=1&query=4.667123%2C-74.054500",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("stays a placeholder without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<ShopMap location={location} name="La Esquina" />);
    expect(seen).toBeNull();
    expect(maps).toHaveLength(0);
  });
});
