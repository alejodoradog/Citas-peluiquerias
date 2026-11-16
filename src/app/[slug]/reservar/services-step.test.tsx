import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicProfile } from "@/modulos/agenda/datos/public-booking";
import { readBookingParams } from "@/modulos/agenda/dominio/booking-flow";
import { textos } from "@/ui/textos";

const router = vi.hoisted(() => ({
  // A navigation that has not arrived yet: the transition stays pending.
  push: vi.fn<(href: string) => Promise<void>>(
    () => new Promise<void>(() => undefined),
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const { ServicesStep } = await import("./services-step");
const t = textos.reservas;

const CORTE = "11111111-1111-4111-8111-111111111111";
const BARBA = "22222222-2222-4222-8222-222222222222";
const profile = {
  name: "Barbería La Esquina",
  slug: "la-esquina",
  services: [
    { id: CORTE, name: "Corte", durationMinutes: 30, priceCop: 25_000 },
    { id: BARBA, name: "Barba", durationMinutes: 20, priceCop: 15_000 },
  ],
} as unknown as PublicProfile;

afterEach(() => router.push.mockClear());

describe("ServicesStep", () => {
  it("moves on inside the app, not by loading the document again, and says so from the tap", async () => {
    const reloads: boolean[] = [];
    // After React's own handler: a submit nobody prevented would load the
    // whole document.
    const onSubmit = (event: Event) => reloads.push(!event.defaultPrevented);
    window.addEventListener("submit", onSubmit);
    render(
      <ServicesStep profile={profile} selection={readBookingParams({})} />,
    );
    // Chosen in another order than the list's: the URL keeps the list's.
    await userEvent.click(screen.getByRole("checkbox", { name: /Barba/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Corte/ }));
    const next = screen.getByRole("button", { name: t.continuar });
    await userEvent.click(next);

    expect(reloads).toEqual([false]);
    expect(router.push).toHaveBeenCalledWith(
      `/la-esquina/reservar?servicios=${CORTE}&servicios=${BARBA}`,
    );
    expect(next).toHaveAttribute("aria-busy", "true");
    expect(next).toHaveAttribute("aria-disabled", "true");

    // A second tap while it arrives does not navigate twice.
    await userEvent.click(next);
    expect(router.push).toHaveBeenCalledTimes(1);
    window.removeEventListener("submit", onSubmit);
  });

  it("keeps Continuar off until a service is chosen", () => {
    render(
      <ServicesStep profile={profile} selection={readBookingParams({})} />,
    );
    expect(screen.getByRole("button", { name: t.continuar })).toBeDisabled();
    expect(router.push).not.toHaveBeenCalled();
  });
  // Task 7.6b: the link a professional shares brings them already chosen.
  it("carries the professional the link chose on to the next step", async () => {
    const ANA = "33333333-3333-4333-8333-333333333333";
    const { container } = render(
      <ServicesStep
        profile={profile}
        selection={readBookingParams({ profesional: ANA })}
      />,
    );
    // Without JavaScript the form sends it too.
    expect(
      container.querySelector('input[type="hidden"][name="profesional"]'),
    ).toHaveAttribute("value", ANA);
    await userEvent.click(screen.getByRole("checkbox", { name: /Corte/ }));
    await userEvent.click(screen.getByRole("button", { name: t.continuar }));
    expect(router.push).toHaveBeenCalledWith(
      `/la-esquina/reservar?servicios=${CORTE}&profesional=${ANA}`,
    );
  });
});
