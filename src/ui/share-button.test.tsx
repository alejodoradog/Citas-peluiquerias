import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareButton } from "./share-button";
import { textos } from "./textos";

const props = {
  url: "https://yapoin.co/barberia-la-esquina",
  title: "Barbería La Esquina",
  text: "Reserva tu cita aquí",
  label: "Compartir",
};

function stub(name: "share" | "clipboard", value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

afterEach(() => {
  stub("share", undefined);
  vi.restoreAllMocks();
});

describe("ShareButton", () => {
  it("opens the phone's share sheet when there is one", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    stub("share", share);
    render(<ShareButton {...props} />);
    await user.click(screen.getByRole("button", { name: "Compartir" }));
    expect(share).toHaveBeenCalledWith({
      url: props.url,
      title: props.title,
      text: props.text,
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says nothing when the user cancels the share sheet", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub(
      "share",
      vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError")),
    );
    render(<ShareButton {...props} />);
    stub("clipboard", { writeText });
    await user.click(screen.getByRole("button", { name: "Compartir" }));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("copies the link where there is no share sheet", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    render(<ShareButton {...props} />);
    stub("clipboard", { writeText });
    await user.click(screen.getByRole("button", { name: "Compartir" }));
    expect(writeText).toHaveBeenCalledWith(props.url);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        textos.ui.compartir.copiado,
      ),
    );
  });

  it("copies the link when sharing fails for another reason", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub(
      "share",
      vi.fn().mockRejectedValue(new DOMException("no", "NotAllowedError")),
    );
    render(<ShareButton {...props} />);
    stub("clipboard", { writeText });
    await user.click(screen.getByRole("button", { name: "Compartir" }));
    expect(writeText).toHaveBeenCalledWith(props.url);
  });
});
