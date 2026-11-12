"use client";

import { useFormStatus } from "react-dom";
import { markAppointment } from "@/modulos/agenda/acciones/barber";
import { buttonClasses } from "@/ui/button";
import { cx } from "@/ui/cx";
import { CheckIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";

const t = textos.barbero.marcar;

// "Atendida" and "No asistió" of one appointment (B-01, B-03). One form, so
// it works before the page's JavaScript arrives; the button pressed sends
// its status. back: the day of B-01, or "cita" for B-03.
export function MarkButtons({
  token,
  appointmentId,
  customerName,
  back,
  size = "card",
}: {
  token: string;
  appointmentId: string;
  customerName: string;
  back: string;
  // card: the small pair inside a card of B-01; bar: the bottom bar of B-03.
  size?: "card" | "bar";
}) {
  return (
    <form
      action={markAppointment}
      className={cx(
        "grid grid-cols-2",
        size === "card" ? "mt-1.5 gap-2" : "gap-2.5",
      )}
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="cita" value={appointmentId} />
      <input type="hidden" name="volver" value={back} />
      <Buttons customerName={customerName} size={size} />
    </form>
  );
}

function Buttons({
  customerName,
  size,
}: {
  customerName: string;
  size: "card" | "bar";
}) {
  const { pending } = useFormStatus();
  const small =
    "flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] text-sm font-bold disabled:opacity-70";
  return (
    <>
      <button
        type="submit"
        name="estado"
        value="attended"
        disabled={pending}
        aria-label={t.atendidaDe(customerName)}
        className={
          size === "card"
            ? cx(small, "bg-success-soft text-success")
            : buttonClasses({ block: true })
        }
      >
        <CheckIcon size={16} />
        {pending ? t.guardando : t.atendida}
      </button>
      <button
        type="submit"
        name="estado"
        value="no_show"
        disabled={pending}
        aria-label={t.noAsistioDe(customerName)}
        className={
          size === "card"
            ? cx(small, "border-line text-danger border bg-white")
            : buttonClasses({ variant: "secondary", block: true })
        }
      >
        {t.noAsistio}
      </button>
    </>
  );
}
