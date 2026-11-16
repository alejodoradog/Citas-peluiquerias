import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { textos } from "@/ui/textos";

// The screens of "Mi agenda" serve two entries (task 7.6b): the private link
// (/b/<token>, until task 7.6c) and the professional's session
// (/mi-agenda). By the link the forms carry the token; by the session they
// carry nothing that says who asks, and their links stay under /mi-agenda.
const markAppointment = vi.fn();
const markMyAppointment = vi.fn();
const removeBlock = vi.fn();
const removeMyBlock = vi.fn();
vi.mock("@/modulos/agenda/acciones/barber", () => ({
  markAppointment,
  removeBlock,
  createBlock: vi.fn(),
}));
vi.mock("@/modulos/agenda/acciones/my-agenda", () => ({
  markMyAppointment,
  removeMyBlock,
  createMyBlock: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const { DayList } = await import("./day-list");
const { WeekList } = await import("./week-list");
const { agendaHref, appointmentHref, blockHref } = await import("./entry");

const TOKEN = "a".repeat(43);
const LINK = { kind: "link", token: TOKEN } as const;
const SESSION = { kind: "session" } as const;
const APPOINTMENT = "a0000000-0000-4000-8000-000000000001";
const BLOCK = "b0000000-0000-4000-8000-000000000001";

const start = new Date("2026-11-07T14:00:00Z");
const end = new Date("2026-11-07T14:30:00Z");
const items = [
  {
    kind: "appointment",
    id: APPOINTMENT,
    start,
    end,
    markable: true,
    look: "confirmed",
    appointment: {
      id: APPOINTMENT,
      customerName: "Felipe R.",
      serviceNames: ["Corte"],
    },
  },
  {
    kind: "block",
    id: BLOCK,
    start: new Date("2026-11-07T18:00:00Z"),
    end: new Date("2026-11-07T19:00:00Z"),
    removable: true,
    block: { id: BLOCK, own: true, reason: "Almuerzo" },
  },
] as never;

function hiddenFields(form: HTMLFormElement) {
  return Object.fromEntries(
    [...form.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].map(
      (input) => [input.name, input.value],
    ),
  );
}

describe("the links of each entry", () => {
  it("stay under /b/<token> by the link and under /mi-agenda by the session", () => {
    expect(agendaHref(LINK, { vista: "semana" })).toBe(
      `/b/${TOKEN}?vista=semana`,
    );
    expect(agendaHref(SESSION, { dia: "2026-11-08" })).toBe(
      "/mi-agenda?dia=2026-11-08",
    );
    expect(appointmentHref(LINK, APPOINTMENT)).toBe(
      `/b/${TOKEN}/citas/${APPOINTMENT}`,
    );
    expect(appointmentHref(SESSION, APPOINTMENT)).toBe(
      `/mi-agenda/citas/${APPOINTMENT}`,
    );
    expect(blockHref(LINK)).toBe(`/b/${TOKEN}/bloquear`);
    expect(blockHref(SESSION)).toBe("/mi-agenda/bloquear");
  });
});

describe("DayList", () => {
  it("by the link, its forms carry the token and its links the link", () => {
    const { container } = render(
      <DayList entry={LINK} date="2026-11-07" items={items} />,
    );
    expect(
      screen.getByRole("link", { name: /Felipe R\./ }).getAttribute("href"),
    ).toBe(`/b/${TOKEN}/citas/${APPOINTMENT}`);
    const forms = [...container.querySelectorAll("form")];
    expect(forms).toHaveLength(2);
    for (const form of forms) expect(hiddenFields(form).token).toBe(TOKEN);
  });

  it("by the session, nothing in its forms says who asks", () => {
    const { container } = render(
      <DayList entry={SESSION} date="2026-11-07" items={items} />,
    );
    expect(
      screen.getByRole("link", { name: /Felipe R\./ }).getAttribute("href"),
    ).toBe(`/mi-agenda/citas/${APPOINTMENT}`);
    const forms = [...container.querySelectorAll("form")];
    expect(forms).toHaveLength(2);
    const [mark, remove] = forms.map(hiddenFields);
    expect(mark).toEqual({ cita: APPOINTMENT, volver: "2026-11-07" });
    expect(remove).toEqual({ bloqueo: BLOCK, volver: "2026-11-07" });
    expect(
      within(container).getByRole("button", {
        name: textos.barbero.marcar.atendidaDe("Felipe R."),
      }),
    ).toBeTruthy();
  });
});

describe("WeekList", () => {
  it("opens the days under its own entry", () => {
    render(
      <WeekList
        entry={SESSION}
        days={
          [
            {
              date: "2026-11-09",
              hours: { start: "09:00", end: "18:00" },
              count: 2,
            },
          ] as never
        }
        canOpen={() => true}
        previous={null}
        next="2026-11-16"
      />,
    );
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/mi-agenda\?/);
    }
  });
});
