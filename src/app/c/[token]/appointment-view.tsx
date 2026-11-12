"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { cancelAppointment } from "@/modulos/agenda/acciones/manage";
import { routes } from "@/lib/routes";
import { buttonClasses } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { CalendarIcon, CloseIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";
import { appointmentStorage } from "../../[slug]/appointment-storage";
import { OutsideLink } from "../../[slug]/booking-ui";
import { ManageHeader } from "./manage-header";

const t = textos.reservas.gestionar;
const c = textos.reservas.confirmada;

export type ManagedShop = {
  name: string;
  locality: string | null;
  slug: string;
  whatsapp: string | null;
  directions: string | null;
};

export type ManagedSummary = {
  startsAt: string;
  when: string;
  isToday: boolean;
  services: string;
  barber: string;
  place: string | null;
  price: string;
  calendar: string;
};

// C-09 "Tu cita", with C-11 (the sheet to cancel), C-12 (cancelled) and C-13
// (inside the policy's hours: only WhatsApp and directions).
export function AppointmentView({
  token,
  shop,
  appointment,
  customerName,
  noticeHours,
  changeable,
  canMove,
  changed,
  moveHref,
}: {
  token: string;
  shop: ManagedShop;
  appointment: ManagedSummary;
  customerName: string;
  noticeHours: number;
  changeable: boolean;
  canMove: boolean;
  changed: boolean;
  moveHref: string;
}) {
  const [asking, setAsking] = useState(false);
  const form = useFormAction(cancelAppointment, t.errores);
  const cancelled = form.state.status === "done";

  // This phone remembers the link, with the time it has now; a cancelled
  // one is no longer shown.
  const { startsAt } = appointment;
  useEffect(() => {
    if (cancelled) appointmentStorage.cancel(token);
    else appointmentStorage.remember({ token, slug: shop.slug, startsAt });
  }, [cancelled, token, shop.slug, startsAt]);

  if (cancelled) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pt-20 pb-6">
        <span className="bg-neutral-soft text-muted flex size-16 items-center justify-center rounded-full">
          <CloseIcon size={32} />
        </span>
        <div>
          <Chip tone="neutral">{t.cancelada.estado}</Chip>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title">{t.cancelada.titulo}</h1>
          <p className="text-body text-muted">{appointment.when}.</p>
        </div>
        <Link href={routes.booking(shop.slug)} className={buttonClasses()}>
          {t.cancelada.reservarOtra}
        </Link>
        {shop.whatsapp ? (
          <OutsideLink href={shop.whatsapp} size="lg">
            {t.escribir}
          </OutsideLink>
        ) : null}
      </main>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ManageHeader name={shop.name} locality={shop.locality} />
      <main className="mx-auto flex w-full max-w-md flex-col gap-3.5 px-5 pt-2.5 pb-6">
        {changed ? <Notice tone="success" title={t.cambiada} /> : null}
        <div>
          <Chip tone="brand">{t.confirmada}</Chip>
        </div>
        <h1 className="text-title">{t.titulo(customerName)}</h1>
        <dl className="border-line rounded-card flex flex-col gap-3.5 border bg-white p-4">
          <Item label={c.cuando}>
            {appointment.isToday ? t.hoy(appointment.when) : appointment.when}
          </Item>
          <Item label={c.servicios}>{appointment.services}</Item>
          <Item label={c.con}>{appointment.barber}</Item>
          {appointment.place ? (
            <Item label={c.donde}>{appointment.place}</Item>
          ) : null}
          <div className="flex items-center justify-between gap-3 text-[0.9375rem]">
            <dt className="text-muted">{c.pagas}</dt>
            <dd>
              <strong className="text-[1.0625rem]">{appointment.price}</strong>
            </dd>
          </div>
        </dl>

        {changeable ? (
          <>
            {canMove ? (
              <Link href={moveHref} className={buttonClasses()}>
                {t.cambiar}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setAsking(true)}
              className={buttonClasses({ variant: "danger" })}
            >
              {t.cancelar}
            </button>
            <a
              href={appointment.calendar}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: "text", size: "md" })}
            >
              <CalendarIcon size={18} />
              <span>{c.calendario}</span>
            </a>
            <p className="text-help text-muted">{t.plazo(noticeHours)}</p>
          </>
        ) : (
          <>
            <Notice tone="warning" title={t.fueraDePlazo.titulo}>
              {t.fueraDePlazo.detalle(noticeHours)}
            </Notice>
            {shop.whatsapp ? (
              <OutsideLink href={shop.whatsapp} size="lg" variant="primary">
                {t.escribir}
              </OutsideLink>
            ) : null}
            {shop.directions ? (
              <OutsideLink href={shop.directions} size="lg">
                {textos.reservas.perfil.comoLlegar}
              </OutsideLink>
            ) : null}
          </>
        )}
      </main>

      <Sheet
        open={asking}
        onClose={() => setAsking(false)}
        title={t.hoja.titulo}
      >
        <p className="text-body text-muted">
          {t.hoja.detalle(appointment.when, appointment.barber)}
        </p>
        <ActionForm form={form} className="flex flex-col gap-3.5">
          <input type="hidden" name="token" value={token} />
          {form.formError ? (
            <Notice tone="danger" title={form.formError} />
          ) : null}
          <SubmitButton pendingText={t.hoja.cancelando} variant="dangerSolid">
            {t.hoja.si}
          </SubmitButton>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className={buttonClasses({ variant: "secondary" })}
          >
            {t.hoja.no}
          </button>
        </ActionForm>
      </Sheet>
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-help text-muted">{label}</dt>
      <dd className="text-[0.9375rem] leading-[1.4] font-semibold">
        {children}
      </dd>
    </div>
  );
}
