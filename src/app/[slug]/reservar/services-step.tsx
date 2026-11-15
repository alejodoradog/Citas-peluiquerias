"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { routes } from "@/lib/routes";
import type { PublicProfile } from "@/modulos/agenda/datos/public-booking";
import { MAX_SERVICES_PER_BOOKING } from "@/modulos/agenda/dominio/booking";
import {
  bookingQuery,
  type BookingSelection,
} from "@/modulos/agenda/dominio/booking-flow";
import { buttonClasses } from "@/ui/button";
import { cx } from "@/ui/cx";
import { CheckIcon } from "@/ui/icons";
import { EmptyState } from "@/ui/states";
import { textos } from "@/ui/textos";
import {
  DisabledContinue,
  StepHeader,
  StepTitle,
  SummaryBar,
} from "../booking-ui";

const t = textos.reservas;

// C-02: one or more services (up to 5). The choice goes to the URL, so the
// barber step and "atrás" read it from there. A GET form that, once the page
// runs, moves on inside the app instead of loading the whole document again,
// and says so from the tap while the barber step arrives.
export function ServicesStep({
  profile,
  selection,
}: {
  profile: PublicProfile;
  selection: BookingSelection;
}) {
  const [chosen, setChosen] = useState<string[]>(
    selection.serviceIds.filter((id) =>
      profile.services.some((service) => service.id === id),
    ),
  );
  const picked = profile.services.filter((s) => chosen.includes(s.id));
  const minutes = picked.reduce((sum, s) => sum + s.durationMinutes, 0);
  const price = picked.reduce((sum, s) => sum + s.priceCop, 0);
  const tooMany = chosen.length > MAX_SERVICES_PER_BOOKING;
  const router = useRouter();
  const [leaving, startLeaving] = useTransition();

  function toggle(id: string, on: boolean) {
    setChosen((current) =>
      on ? [...current, id] : current.filter((other) => other !== id),
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (leaving || chosen.length === 0 || tooMany) return;
    // In the order of the list, as the form itself would send them.
    const href =
      routes.bookingFlow(profile.slug) +
      bookingQuery({ serviceIds: picked.map((service) => service.id) });
    // Pending until the barber step is on screen.
    startLeaving(() => router.push(href));
  }

  return (
    <form
      method="get"
      action={routes.bookingFlow(profile.slug)}
      onSubmit={onSubmit}
      className="flex min-h-full flex-1 flex-col"
    >
      <StepHeader
        shopName={profile.name}
        backHref={routes.booking(profile.slug)}
        step={1}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-2.5 px-5 pt-3.5 pb-4">
        <StepTitle title={t.servicios.titulo} intro={t.servicios.bajada} />
        {profile.services.length === 0 ? (
          <EmptyState title={t.servicios.vacio} />
        ) : (
          <fieldset className="flex flex-col gap-2.5">
            <legend className="sr-only">{t.servicios.titulo}</legend>
            {profile.services.map((service) => {
              const on = chosen.includes(service.id);
              return (
                <label
                  key={service.id}
                  className={cx(
                    "flex min-h-16 cursor-pointer items-center gap-3.5 rounded-[14px] px-4 py-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
                    on
                      ? "border-brand border-2 bg-[#f8fcfc]"
                      : "border-line border bg-white",
                  )}
                >
                  <input
                    type="checkbox"
                    name="servicios"
                    value={service.id}
                    checked={on}
                    onChange={(event) =>
                      toggle(service.id, event.target.checked)
                    }
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cx(
                      "flex size-6.5 shrink-0 items-center justify-center rounded-lg",
                      on ? "bg-brand text-white" : "border-line border-2",
                    )}
                  >
                    {on ? <CheckIcon size={16} /> : null}
                  </span>
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="text-base font-bold">{service.name}</span>
                    <span className="text-help text-muted">
                      {t.minutos(service.durationMinutes)}
                    </span>
                  </span>
                  <strong className="text-base">
                    {formatPesos(service.priceCop)}
                  </strong>
                </label>
              );
            })}
          </fieldset>
        )}
        {tooMany ? (
          <p role="alert" className="text-help text-danger">
            {t.servicios.maximo}
          </p>
        ) : null}
      </main>
      <SummaryBar
        summary={
          chosen.length === 0
            ? t.servicios.ninguno
            : t.servicios.resumen(chosen.length, minutes)
        }
        priceCop={chosen.length === 0 ? null : price}
      >
        {chosen.length === 0 || tooMany ? (
          <DisabledContinue />
        ) : (
          <button
            type="submit"
            aria-disabled={leaving || undefined}
            aria-busy={leaving || undefined}
            className={cx(
              buttonClasses(),
              // The pulse of a tapped link (globals.css, tap-pending).
              leaving &&
                "animate-[tap-pending_0.9s_ease-in-out_infinite] cursor-progress motion-reduce:animate-none motion-reduce:opacity-70",
            )}
          >
            {t.continuar}
          </button>
        )}
      </SummaryBar>
    </form>
  );
}
