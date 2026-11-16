import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { textos } from "@/ui/textos";

// The lists of "Mi agenda" (B-01, B-02), by the professional's session: the
// only entry since the private link went with task 7.6c. Their forms carry
// nothing that says who asks (no token, no barber, no barbershop), and their
// links stay under /mi-agenda.
const markMyAppointment = vi.fn();
const removeMyBlock = vi.fn();
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

describe("DayList", () => {
  it("by the session, nothing in its forms says who asks", () => {
    const { container } = render(
      <DayList date="2026-11-07" items={items} />,
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
  it("opens the days under /mi-agenda", () => {
    render(
      <WeekList
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
