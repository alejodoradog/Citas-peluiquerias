import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { textos } from "@/ui/textos";
import { AgendaHeader, placeHref, type AgendaPlace } from "./agenda-header";

const t = textos.agenda;
const TODAY = "2026-11-07";
const MARIO = "11111111-1111-4111-8111-111111111111";

const place = (fields: Partial<AgendaPlace> = {}): AgendaPlace => ({
  view: "dia",
  date: TODAY,
  today: TODAY,
  barberId: null,
  ...fields,
});

describe("placeHref", () => {
  it("leaves out what is the default: today, by day, everyone", () => {
    expect(placeHref(place())).toBe("/panel");
    expect(placeHref(place({ date: "2026-11-09" }), { date: TODAY })).toBe(
      "/panel",
    );
  });

  it("keeps the rest of the place when one thing changes", () => {
    const week = place({ view: "semana", date: "2026-11-09", barberId: MARIO });
    expect(placeHref(week, { date: "2026-11-16" })).toBe(
      `/panel?vista=semana&dia=2026-11-16&barbero=${MARIO}`,
    );
    expect(placeHref(week, { view: "dia" })).toBe(
      `/panel?dia=2026-11-09&barbero=${MARIO}`,
    );
    expect(placeHref(week, { barberId: null })).toBe(
      "/panel?vista=semana&dia=2026-11-09",
    );
  });
});

describe("AgendaHeader", () => {
  function renderHeader(at: AgendaPlace) {
    render(
      <AgendaHeader
        shopName="Barbería La Esquina"
        title="Hoy, sábado 7 de nov"
        place={at}
        previous="2026-11-06"
        next="2026-11-08"
        showToday={at.date !== at.today}
        barbers={[{ id: MARIO, name: "Mario" }]}
        summary="14 citas"
      />,
    );
  }

  it("names the day, its arrows, the view and the barber filter", () => {
    renderHeader(place());
    expect(
      screen.getByRole("heading", { level: 1, name: "Hoy, sábado 7 de nov" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.anterior.dia })).toHaveAttribute(
      "href",
      "/panel?dia=2026-11-06",
    );
    expect(screen.getByRole("link", { name: t.siguiente.dia })).toHaveAttribute(
      "href",
      "/panel?dia=2026-11-08",
    );
    expect(screen.queryByRole("link", { name: t.irAHoy })).toBeNull();
    expect(screen.getByRole("link", { name: t.vistas.dia })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: t.vistas.semana })).toHaveAttribute(
      "href",
      "/panel?vista=semana",
    );
    expect(
      screen.getByText(`${t.barberos.etiqueta}:`, { exact: false }),
    ).toBeInTheDocument();
  });

  it("offers today and names the week's arrows in the week view", () => {
    renderHeader(place({ view: "semana", date: "2026-11-14" }));
    expect(screen.getByRole("link", { name: t.irAHoy })).toHaveAttribute(
      "href",
      "/panel?vista=semana",
    );
    expect(
      screen.getByRole("link", { name: t.anterior.semana }),
    ).toBeInTheDocument();
  });
});
