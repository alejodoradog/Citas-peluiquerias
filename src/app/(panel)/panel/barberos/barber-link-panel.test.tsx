import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  BarberLinkCommandResult,
  IssueBarberLinkResult,
} from "@/modulos/barberias/acciones/barber-links";
import { textos } from "@/ui/textos";
import { BarberLinkPanel, type LinkBarber } from "./barber-link-panel";

const t = textos.barberos.link;
const URL_1 = `https://yapoin.com/b/${"A".repeat(43)}`;

const kevin: LinkBarber = {
  id: "00000000-0000-0000-0000-000000000001",
  displayName: "Kevin",
  active: true,
  state: "active",
  sentOn: "3 de noviembre",
};

// user-event installs its own clipboard on setup, so the stand-in is put
// back right after it (see setup).
let clipboard: { writeText: (text: string) => Promise<void> } | null = null;
function installClipboard() {
  if (!clipboard) return;
  Object.defineProperty(navigator, "clipboard", {
    value: clipboard,
    configurable: true,
  });
}
function stubClipboard(writeText = vi.fn().mockResolvedValue(undefined)) {
  clipboard = { writeText };
  installClipboard();
  return writeText;
}

function setup(
  barber: LinkBarber,
  issueLink = vi.fn(async (): Promise<IssueBarberLinkResult> => ({
    ok: true,
    url: URL_1,
  })),
  turnOffLink = vi.fn(async (): Promise<BarberLinkCommandResult> => ({
    ok: true,
  })),
) {
  const user = userEvent.setup();
  installClipboard();
  const view = render(
    <BarberLinkPanel
      barber={barber}
      issueLink={issueLink}
      turnOffLink={turnOffLink}
    />,
  );
  return { user, issueLink, turnOffLink, ...view };
}

describe("BarberLinkPanel", () => {
  it("explains what the link opens and that a new one replaces the old", () => {
    setup(kevin);
    expect(
      screen.getByRole("heading", { level: 1, name: t.titulo("Kevin") }),
    ).toBeInTheDocument();
    expect(screen.getByText(t.alcance("Kevin"))).toBeInTheDocument();
    expect(screen.getByText(t.reemplaza.titulo)).toBeInTheDocument();
    expect(screen.getByText("Enviado el 3 de noviembre")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: textos.ui.volver }),
    ).toHaveAttribute("href", `/panel/barberos/${kevin.id}`);
  });

  it("has no email button until emails arrive (task 5.2)", () => {
    setup(kevin);
    expect(screen.queryByRole("button", { name: /^Enviar/ })).toBeNull();
  });

  it("copies the first link without asking, and shows it only now", async () => {
    const writeText = stubClipboard();
    const { user, issueLink } = setup({
      ...kevin,
      state: "unsent",
      sentOn: null,
    });
    expect(screen.queryByRole("button", { name: t.desactivar })).toBeNull();
    expect(screen.getByText(textos.barberos.linkSinEnviarAyuda)).toBeVisible();

    await user.click(screen.getByRole("button", { name: t.copiarNuevo }));
    expect(issueLink).toHaveBeenCalledWith(kevin.id);
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(URL_1));
    expect(await screen.findByText(URL_1)).toBeInTheDocument();
    expect(screen.getByText(t.nuevo.titulo)).toBeInTheDocument();
    expect(screen.getByText(t.nuevo.copiado)).toBeInTheDocument();
  });

  it("asks before replacing a link that works", async () => {
    stubClipboard();
    const { user, issueLink } = setup(kevin);
    await user.click(screen.getByRole("button", { name: t.copiarNuevo }));
    expect(issueLink).not.toHaveBeenCalled();
    const sheet = screen.getByRole("dialog", {
      name: t.confirmarNuevo.titulo,
    });
    expect(sheet).toHaveTextContent(t.confirmarNuevo.cuerpo("Kevin"));

    await user.click(
      within(sheet).getByRole("button", { name: t.confirmarNuevo.no }),
    );
    expect(issueLink).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: t.copiarNuevo }));
    await user.click(
      within(
        screen.getByRole("dialog", { name: t.confirmarNuevo.titulo }),
      ).getByRole("button", { name: t.confirmarNuevo.si }),
    );
    expect(issueLink).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(URL_1)).toBeInTheDocument();
  });

  it("copies again and shares without making another link", async () => {
    const writeText = stubClipboard();
    const { user, issueLink } = setup({
      ...kevin,
      state: "unsent",
      sentOn: null,
    });
    await user.click(screen.getByRole("button", { name: t.copiarNuevo }));
    await screen.findByText(URL_1);

    await user.click(
      screen.getByRole("button", { name: t.nuevo.copiarOtraVez }),
    );
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
    });
    await user.click(screen.getByRole("button", { name: t.nuevo.compartir }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: URL_1 }));
    expect(writeText).toHaveBeenLastCalledWith(URL_1);
    expect(issueLink).toHaveBeenCalledTimes(1);
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  });

  it("leaves the link to select by hand when the clipboard refuses", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    const { user } = setup({ ...kevin, state: "unsent", sentOn: null });
    await user.click(screen.getByRole("button", { name: t.copiarNuevo }));
    await waitFor(() =>
      expect(screen.getByText(textos.ui.copiar.fallo)).toBeInTheDocument(),
    );
    const shown = screen.getAllByText(URL_1);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown[0]).toHaveClass("select-all");
  });

  it("shows why a link could not be made, and no link", async () => {
    stubClipboard();
    const { user } = setup(
      { ...kevin, state: "unsent", sentOn: null },
      vi.fn(async (): Promise<IssueBarberLinkResult> => ({
        ok: false,
        error: "unknown",
      })),
    );
    await user.click(screen.getByRole("button", { name: t.copiarNuevo }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errores.unknown,
    );
    expect(screen.queryByText(t.nuevo.titulo)).toBeNull();
    expect(screen.queryByText(textos.ui.copiar.fallo)).toBeNull();
  });

  it("asks before turning the link off", async () => {
    const { user, turnOffLink } = setup(kevin);
    await user.click(screen.getByRole("button", { name: t.desactivar }));
    const sheet = screen.getByRole("dialog", {
      name: t.confirmarDesactivar.titulo("Kevin"),
    });
    expect(turnOffLink).not.toHaveBeenCalled();
    await user.click(
      within(sheet).getByRole("button", { name: t.confirmarDesactivar.si }),
    );
    expect(turnOffLink).toHaveBeenCalledWith(kevin.id);
  });

  it("offers only a new link once it is off", async () => {
    stubClipboard();
    const { user, issueLink } = setup({ ...kevin, state: "off" });
    expect(screen.getByText(t.desactivado.titulo("Kevin"))).toBeVisible();
    expect(screen.queryByRole("button", { name: t.desactivar })).toBeNull();
    expect(screen.queryByRole("button", { name: t.copiarNuevo })).toBeNull();
    await user.click(screen.getByRole("button", { name: t.crearNuevo }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(issueLink).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(URL_1)).toBeInTheDocument();
  });

  it("tells that an inactive barber only serves what they had", () => {
    setup({ ...kevin, active: false });
    expect(screen.getByText(t.inactivo.titulo)).toBeVisible();
    // No new blocks for an inactive barber (spec): the scope says so.
    expect(screen.getByText(t.alcanceInactivo("Kevin"))).toBeVisible();
    expect(screen.queryByText(t.alcance("Kevin"))).toBeNull();
  });

  it("keeps the confirmation open with the error when the new link fails", async () => {
    stubClipboard();
    const { user } = setup(
      kevin,
      vi.fn(async (): Promise<IssueBarberLinkResult> => ({
        ok: false,
        error: "unknown",
      })),
    );
    await user.click(screen.getByRole("button", { name: t.copiarNuevo }));
    const sheet = screen.getByRole("dialog", {
      name: t.confirmarNuevo.titulo,
    });
    await user.click(
      within(sheet).getByRole("button", { name: t.confirmarNuevo.si }),
    );
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      t.errores.unknown,
    );
    expect(
      screen.getByRole("dialog", { name: t.confirmarNuevo.titulo }),
    ).toBeInTheDocument();
    expect(screen.queryByText(t.nuevo.titulo)).toBeNull();
  });

  // Next.js keeps a page left by a Link mounted and hidden (<Activity>): the
  // link must not wait there for whoever comes back.
  it("forgets the link when the screen is hidden", async () => {
    stubClipboard();
    const user = userEvent.setup();
    installClipboard();
    const barber: LinkBarber = { ...kevin, state: "unsent", sentOn: null };
    const panel = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <BarberLinkPanel
          barber={barber}
          issueLink={async () => ({ ok: true, url: URL_1 })}
          turnOffLink={async () => ({ ok: true })}
        />
      </Activity>
    );
    const { rerender, container } = render(panel("visible"));
    await user.click(screen.getByRole("button", { name: t.copiarNuevo }));
    await screen.findByText(URL_1);
    rerender(panel("hidden"));
    await waitFor(() => expect(container).not.toHaveTextContent(URL_1));
    rerender(panel("visible"));
    expect(container).not.toHaveTextContent(URL_1);
    expect(screen.getByRole("button", { name: t.copiarNuevo })).toBeVisible();
  });

  it("does not keep a link that arrives while the screen is hidden", async () => {
    stubClipboard();
    const user = userEvent.setup();
    installClipboard();
    let answer: (result: IssueBarberLinkResult) => void = () => {};
    const issueLink = () =>
      new Promise<IssueBarberLinkResult>((resolve) => (answer = resolve));
    const barber: LinkBarber = { ...kevin, state: "unsent", sentOn: null };
    const panel = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <BarberLinkPanel
          barber={barber}
          issueLink={issueLink}
          turnOffLink={async () => ({ ok: true })}
        />
      </Activity>
    );
    const { rerender, container } = render(panel("visible"));
    await user.click(screen.getByRole("button", { name: t.copiarNuevo }));
    rerender(panel("hidden"));
    await act(async () => answer({ ok: true, url: URL_1 }));
    rerender(panel("visible"));
    await act(async () => {});
    expect(container).not.toHaveTextContent(URL_1);
    expect(screen.getByRole("button", { name: t.copiarNuevo })).toBeEnabled();
  });

  // The browser can freeze the page and bring it back with Back (bfcache).
  it.each([
    ["leaving the page", "pagehide", false],
    ["coming back from the browser's cache", "pageshow", true],
  ])("forgets the link when %s", async (_when, type, persisted) => {
    stubClipboard();
    const { user, container } = setup({
      ...kevin,
      state: "unsent",
      sentOn: null,
    });
    await user.click(screen.getByRole("button", { name: t.copiarNuevo }));
    await screen.findByText(URL_1);
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event(type), { persisted }) as Event,
      );
    });
    expect(container).not.toHaveTextContent(URL_1);
  });
});
