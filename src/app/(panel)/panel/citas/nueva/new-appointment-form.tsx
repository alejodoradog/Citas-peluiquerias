"use client";

import { useEffect, useState } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import {
  formatShortWallClock,
  formatWallClock,
  toBogotaTime,
} from "@/lib/fechas/fechas";
import { blockHref, routes } from "@/lib/routes";
import {
  createOwnerAppointment,
  searchCustomers,
} from "@/modulos/agenda/acciones/owner-appointment";
import type { CustomerMatch } from "@/modulos/agenda/datos/owner-appointment";
import type { DayAvailability } from "@/modulos/agenda/dominio/availability";
import { ownerSlotDays } from "@/modulos/agenda/dominio/owner-slots";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { cx } from "@/ui/cx";
import { Field, fieldControlClasses } from "@/ui/field";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { ChevronRightIcon, LockIcon, PlusIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { SelectField } from "@/ui/select-field";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";
import { TopBar, TopBarAction } from "@/ui/top-bar";
import { dayTitle } from "../../agenda-labels";
import { barbersFor, type BookingPayload } from "../booking-payload";
import { SlotChooser } from "../slot-chooser";

const t = textos.agenda.nueva;
const SEARCH_DELAY_MS = 300;

// The free times of a barber for the chosen services; none while the
// services do not make a valid length.
function freeDays(
  booking: BookingPayload,
  barberId: string | undefined,
  minutes: number,
): DayAvailability[] {
  const barber = booking.barbers.find((b) => b.id === barberId);
  if (!barber || minutes < 5 || minutes > 480 || minutes % 5 !== 0) return [];
  return ownerSlotDays({
    now: booking.now,
    barber,
    durationMinutes: minutes,
    shopHours: booking.shopHours,
    holidayOpenings: booking.holidayOpenings,
    appointments: booking.appointments,
    blocks: booking.blocks,
  });
}

// D-38: the customer (one found by name, email or phone, or a new one with
// only the name and an optional email), the services, the barber (those who
// do them all) and a free time of that barber. The day and time live in a
// sheet ("Día y hora"), as the design opens them from one button.
export function NewAppointmentForm({
  booking,
  customer: initialCustomer,
  defaults,
}: {
  booking: BookingPayload;
  customer: CustomerMatch | null;
  defaults: { barbero: string; dia: string; hora: string };
}) {
  const form = useFormAction(createOwnerAppointment, textos.agenda.rechazos);
  const [customer, setCustomer] = useState(initialCustomer);
  const [name, setName] = useState(form.value("nombre") ?? "");
  const [email, setEmail] = useState(form.value("correo") ?? "");
  const [matches, setMatches] = useState<CustomerMatch[]>([]);
  // The name the owner chose to create, so its list closes.
  const [creating, setCreating] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [barber, setBarber] = useState(defaults.barbero);
  const [slot, setSlot] = useState({ dia: defaults.dia, hora: defaults.hora });
  const [picking, setPicking] = useState(false);

  // The customers that match what the owner types, a moment after they stop.
  const query = customer ? "" : name.trim();
  useEffect(() => {
    if (query.length < 2) return;
    let current = true;
    const timer = setTimeout(() => {
      void searchCustomers(query).then((found) => {
        if (current) setMatches(found);
      });
    }, SEARCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);
  const showList = query.length >= 2 && creating !== query;

  const services = booking.services.filter((s) => serviceIds.includes(s.id));
  const minutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const price = services.reduce((sum, s) => sum + s.priceCop, 0);
  const barbers = barbersFor(booking, serviceIds);
  const chosenBarber = barbers.find((b) => b.id === barber) ?? barbers[0];
  const days = freeDays(booking, chosenBarber?.id, minutes);
  const chosenSlot = days
    .find((day) => day.date === slot.dia)
    ?.slots.find((s) => toBogotaTime(s.start) === slot.hora);
  const noEmail = customer ? customer.email === null : email.trim() === "";

  const close = { href: routes.panel, label: textos.ui.cerrar };
  const block = blockHref({
    barbero: chosenBarber?.id,
    dia: slot.dia || undefined,
    desde: slot.hora || undefined,
  });

  return (
    <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
      <input type="hidden" name="cliente" value={customer?.id ?? ""} />
      <input type="hidden" name="dia" value={chosenSlot ? slot.dia : ""} />
      <input type="hidden" name="hora" value={chosenSlot ? slot.hora : ""} />
      <FlowShell
        header={
          <TopBar
            title={t.titulo}
            titleAs="h1"
            close={close}
            action={
              <TopBarAction
                href={block}
                label={textos.agenda.bloquear.titulo}
                icon={<LockIcon size={20} />}
              />
            }
          />
        }
        actions={
          <>
            <SubmitButton
              pendingText={t.enviando}
              disabled={!chosenSlot || serviceIds.length === 0}
            >
              {t.crearCita}
            </SubmitButton>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-body text-muted">
                {t.total(serviceIds.length, minutes)}
              </span>
              <strong className="text-[1.0625rem] whitespace-nowrap">
                {formatPesos(price)}
              </strong>
            </div>
          </>
        }
      >
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}

        <h2 className="text-muted text-sm font-semibold">{t.cliente}</h2>
        {customer ? (
          <div className="rounded-card border-line flex items-center gap-3 border bg-white px-3.5 py-2.5">
            <Avatar name={customer.name} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body font-semibold break-words">
                {customer.name}
              </span>
              <span className="text-help text-muted">
                {t.visitas(customer.email, customer.visits)}
              </span>
            </span>
            <Button
              variant="text"
              size="sm"
              block={false}
              onClick={() => {
                setCustomer(null);
                setName("");
                setMatches([]);
              }}
            >
              {t.cambiar}
            </Button>
          </div>
        ) : (
          <>
            <Field
              label={t.buscar}
              name="nombre"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={form.fieldError("nombre")}
            />
            {showList ? (
              <ul
                aria-label={t.resultados}
                className="rounded-card border-line flex flex-col overflow-hidden border bg-white"
              >
                {matches.map((match) => (
                  <li key={match.id} className="border-neutral-soft border-b">
                    <button
                      type="button"
                      onClick={() => setCustomer(match)}
                      className="text-ink flex min-h-13 w-full items-center gap-3 px-3.5 py-2.5 text-left"
                    >
                      <Avatar name={match.name} size="sm" />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-body font-semibold">
                          {match.name}
                        </span>
                        <span className="text-help text-muted">
                          {t.visitas(match.email, match.visits)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => setCreating(query)}
                    className="text-ink flex min-h-13 w-full items-center gap-3 px-3.5 py-2.5 text-left"
                  >
                    <span className="text-brand flex">
                      <PlusIcon size={20} />
                    </span>
                    <span className="text-body font-semibold">
                      {t.crear(query)}
                    </span>
                  </button>
                </li>
              </ul>
            ) : null}
            <Field
              label={t.correo}
              name="correo"
              type="email"
              autoComplete="off"
              optional
              placeholder="nombre@correo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={form.fieldError("correo")}
            />
          </>
        )}
        {noEmail ? (
          <Notice tone="info" title={t.sinCorreo.titulo}>
            {t.sinCorreo.cuerpo}
          </Notice>
        ) : null}

        <fieldset className="flex flex-col">
          <legend className="text-muted mb-3.5 text-sm font-semibold">
            {t.servicios}
          </legend>
          <div className="rounded-card border-line flex flex-col border bg-white px-4 py-2">
            {booking.services.map((service) => (
              <Checkbox
                key={service.id}
                name="servicios"
                value={service.id}
                label={service.name}
                description={textos.agenda.servicios.detalle(
                  service.durationMinutes,
                  formatPesos(service.priceCop),
                )}
                checked={serviceIds.includes(service.id)}
                onChange={(event) =>
                  setServiceIds((current) =>
                    event.target.checked
                      ? [...current, service.id]
                      : current.filter((id) => id !== service.id),
                  )
                }
              />
            ))}
          </div>
        </fieldset>

        {barbers.length > 0 ? (
          <SelectField
            label={t.barbero}
            name="barbero"
            value={chosenBarber?.id ?? ""}
            error={form.fieldError("barbero")}
            onChange={(event) => setBarber(event.target.value)}
            options={barbers.map((b) => ({ value: b.id, label: b.name }))}
          />
        ) : (
          <Notice tone="warning" title={t.sinBarbero} />
        )}

        <div className="flex flex-col gap-1.5">
          <span id="dia-hora" className="text-label">
            {t.diaHora}
          </span>
          <button
            type="button"
            aria-labelledby="dia-hora dia-hora-valor"
            disabled={!chosenBarber || serviceIds.length === 0}
            onClick={() => setPicking(true)}
            className={cx(
              fieldControlClasses,
              "flex items-center justify-between px-3.5 text-left disabled:opacity-60",
            )}
          >
            <span id="dia-hora-valor">
              {chosenSlot
                ? t.horaElegida(
                    dayTitle(slot.dia, booking.today),
                    formatWallClock(toBogotaTime(chosenSlot.start)),
                    formatShortWallClock(toBogotaTime(chosenSlot.end)),
                  )
                : t.elegirHora}
            </span>
            <span className="text-muted flex rotate-90">
              <ChevronRightIcon size={18} />
            </span>
          </button>
          {chosenBarber ? (
            <span className="text-help text-muted">
              {t.soloLibres(chosenBarber.name)}
            </span>
          ) : null}
          {form.fieldError("hora") ? (
            <span className="text-danger text-help">
              {form.fieldError("hora")}
            </span>
          ) : null}
        </div>
      </FlowShell>

      <Sheet open={picking} onClose={() => setPicking(false)} title={t.diaHora}>
        {picking ? (
          <>
            <SlotChooser
              days={days}
              today={booking.today}
              minutes={minutes}
              dia={slot.dia}
              hora={slot.hora}
              named={false}
              onChange={(dia, hora) => setSlot({ dia, hora })}
            />
            <Button onClick={() => setPicking(false)}>{t.listo}</Button>
          </>
        ) : null}
      </Sheet>
    </ActionForm>
  );
}
