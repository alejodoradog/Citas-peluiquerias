import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SwitchBarbershopResult } from "@/modulos/cuentas/acciones/active-barbershop";
import { textos } from "@/ui/textos";
import {
  BarbershopSwitcher,
  WizardBarbershopSwitch,
  type SwitcherBarbershop,
} from "./barbershop-switcher";

const t = textos.sedes;

const norte: SwitcherBarbershop = {
  id: "aaaaaaaa-0000-4000-8000-000000000000",
  name: "Barbería El Parche",
  slug: "barberia-el-parche",
  logoUrl: null,
};
const sur: SwitcherBarbershop = {
  id: "bbbbbbbb-0000-4000-8000-000000000000",
  name: "El Parche Sur",
  slug: "el-parche-sur",
  logoUrl: "https://example.com/logo.webp",
};

function setup(
  barbershops: SwitcherBarbershop[],
  result: SwitchBarbershopResult | Error = "switched",
) {
  const switchTo = vi.fn<(id: string) => Promise<SwitchBarbershopResult>>(
    async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  );
  const goTo = vi.fn();
  render(
    <BarbershopSwitcher
      barbershops={barbershops}
      activeId={norte.id}
      switchTo={switchTo}
      goTo={goTo}
    />,
  );
  return { switchTo, goTo };
}

const sheet = () => screen.getByRole("dialog", { name: t.hoja.titulo });

describe("BarbershopSwitcher", () => {
  it("with one sede, shows it and offers a new one instead of a change", () => {
    setup([norte]);
    const card = screen.getByRole("region", { name: t.activa });
    expect(within(card).getByText(norte.name)).toBeInTheDocument();
    expect(
      within(card).getByText("yapoin.com/barberia-el-parche"),
    ).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: t.nueva })).toHaveAttribute(
      "href",
      "/panel/sedes/nueva",
    );
    expect(
      screen.queryByRole("button", { name: t.cambiarEtiqueta }),
    ).not.toBeInTheDocument();
  });

  it("with two sedes, lists both in Tus sedes with the active one checked", async () => {
    setup([norte, sur]);
    const card = screen.getByRole("region", { name: t.activa });
    // The card names the active sede only; the closed sheet lists both.
    expect(
      within(card).getByText(norte.name, { selector: "p" }),
    ).toBeInTheDocument();
    expect(
      within(card).queryByText(sur.name, { selector: "p" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: t.hoja.titulo }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: t.cambiarEtiqueta }),
    );
    const rows = within(sheet()).getAllByRole("button", {
      name: /yapoin\.com\//,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName(
      `${norte.name} yapoin.com/${norte.slug} ${t.hoja.actual}`,
    );
    expect(rows[0]).toHaveAttribute("aria-current", "true");
    expect(rows[1]).toHaveAccessibleName(`${sur.name} yapoin.com/${sur.slug}`);
    expect(rows[1]).not.toHaveAttribute("aria-current");
    expect(
      within(sheet()).getByRole("link", { name: t.nueva }),
    ).toHaveAttribute("href", "/panel/sedes/nueva");
  });

  it("switches through the server and then loads the panel in full", async () => {
    const { switchTo, goTo } = setup([norte, sur]);
    await userEvent.click(
      screen.getByRole("button", { name: t.cambiarEtiqueta }),
    );
    await userEvent.click(
      within(sheet()).getByRole("button", { name: new RegExp(sur.name) }),
    );
    expect(switchTo).toHaveBeenCalledWith(sur.id);
    expect(goTo).toHaveBeenCalledWith("/panel");
  });

  it("closes without asking the server when the active sede is picked", async () => {
    const { switchTo, goTo } = setup([norte, sur]);
    await userEvent.click(
      screen.getByRole("button", { name: t.cambiarEtiqueta }),
    );
    await userEvent.click(
      within(sheet()).getByRole("button", { name: new RegExp(norte.name) }),
    );
    expect(switchTo).not.toHaveBeenCalled();
    expect(goTo).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: t.hoja.titulo }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["refuses", "refused" as const],
    ["cannot be reached", new Error("network")],
  ])(
    "stays on the sede and says so when the server %s",
    async (_case, result) => {
      const { goTo } = setup([norte, sur], result);
      await userEvent.click(
        screen.getByRole("button", { name: t.cambiarEtiqueta }),
      );
      const other = within(sheet()).getByRole("button", {
        name: new RegExp(sur.name),
      });
      await userEvent.click(other);
      expect(goTo).not.toHaveBeenCalled();
      expect(within(sheet()).getByRole("alert")).toHaveTextContent(
        t.hoja.fallo,
      );
      expect(other).toBeEnabled();
    },
  );
});

describe("WizardBarbershopSwitch", () => {
  it("is not there with a single sede", () => {
    render(
      <WizardBarbershopSwitch
        barbershops={[norte]}
        activeId={norte.id}
        switchTo={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens Tus sedes with several sedes", async () => {
    const goTo = vi.fn();
    const switchTo = vi.fn(async () => "switched" as const);
    render(
      <WizardBarbershopSwitch
        barbershops={[norte, sur]}
        activeId={sur.id}
        switchTo={switchTo}
        goTo={goTo}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: t.cambiarEtiqueta }),
    );
    await userEvent.click(
      within(sheet()).getByRole("button", { name: new RegExp(norte.name) }),
    );
    expect(switchTo).toHaveBeenCalledWith(norte.id);
    expect(goTo).toHaveBeenCalledWith("/panel");
  });
});
