import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton, useCopy } from "./copy-button";
import { textos } from "./textos";

const LINK = "yapoin.co/barberia-la-esquina";

// user-event installs its own clipboard on setup; replace it afterwards.
function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CopyButton", () => {
  it("is a secondary button named by its label", () => {
    render(<CopyButton text={LINK} label="Copiar" copiedLabel="Copiado" />);
    const button = screen.getByRole("button", { name: "Copiar" });
    expect(button).toHaveClass("border-line", "min-h-11.5");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("copies the text and says so", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<CopyButton text={LINK} label="Copiar" copiedLabel="Copiado" />);
    await user.click(screen.getByRole("button", { name: "Copiar" }));
    expect(writeText).toHaveBeenCalledWith(LINK);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Copiado"),
    );
  });

  it("shows the text to copy by hand when the browser refuses", async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    render(<CopyButton text={LINK} label="Copiar" copiedLabel="Copiado" />);
    await user.click(screen.getByRole("button", { name: "Copiar" }));
    const status = screen.getByRole("status");
    await waitFor(() =>
      expect(status).toHaveTextContent(textos.ui.copiar.fallo),
    );
    expect(status).toHaveTextContent(LINK);
    expect(status).not.toHaveTextContent("Copiado");
  });

  it("falls back the same way without a clipboard", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    render(<CopyButton text={LINK} label="Copiar" copiedLabel="Copiado" />);
    await user.click(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        textos.ui.copiar.fallo,
      ),
    );
  });

  it("can be the screen's main action", () => {
    render(
      <CopyButton
        text={LINK}
        label="Copiar"
        copiedLabel="Copiado"
        variant="primary"
      />,
    );
    expect(screen.getByRole("button", { name: "Copiar" })).toHaveClass(
      "bg-brand",
    );
  });
});

// Safari copies only during the tap: for text that comes from the server,
// the clipboard gets a promise of it at once (ClipboardItem).
describe("useCopy().copyFrom", () => {
  class FakeClipboardItem {
    constructor(readonly items: Record<string, Promise<Blob>>) {}
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hands the clipboard a promise of the text in the same tap", async () => {
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    const written: FakeClipboardItem[] = [];
    const write = vi.fn(async (items: FakeClipboardItem[]) => {
      written.push(...items);
      await items[0]!.items["text/plain"];
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { write, writeText: vi.fn() },
      configurable: true,
    });
    let resolve: (text: string) => void = () => {};
    const text = new Promise<string | null>((r) => (resolve = r));
    const { result } = renderHook(() => useCopy());
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = result.current.copyFrom(text);
    });
    // Called before the text exists.
    expect(write).toHaveBeenCalledTimes(1);
    resolve(LINK);
    await act(() => done);
    const blob = await written[0]!.items["text/plain"]!;
    expect(await blob.text()).toBe(LINK);
    expect(result.current.result).toBe("copied");
  });

  it("falls back to writing the text once it arrives", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const { result } = renderHook(() => useCopy());
    await act(() => result.current.copyFrom(Promise.resolve(LINK)));
    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(result.current.result).toBe("copied");
  });

  it("says nothing when there is no text to copy", async () => {
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    const write = vi.fn(async (items: FakeClipboardItem[]) => {
      await items[0]!.items["text/plain"];
    });
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: { write, writeText },
      configurable: true,
    });
    const { result } = renderHook(() => useCopy());
    await act(() => result.current.copyFrom(Promise.resolve(null)));
    expect(writeText).not.toHaveBeenCalled();
    expect(result.current.result).toBe("idle");
  });

  it("asks to copy by hand when every way fails", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    const { result } = renderHook(() => useCopy());
    await act(() => result.current.copyFrom(Promise.resolve(LINK)));
    expect(result.current.result).toBe("failed");
  });
});
