import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./copy-button";
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
