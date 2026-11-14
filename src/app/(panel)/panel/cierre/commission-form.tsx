"use client";

import { useRef } from "react";
import { setCommission } from "@/modulos/cierre/acciones/day-close";
import { COMMISSION_OPTIONS } from "@/modulos/cierre/dominio/day-close";
import { buttonClasses } from "@/ui/button";
import { SelectField } from "@/ui/select-field";
import { textos } from "@/ui/textos";

const t = textos.cierre;

// "Comisión de los barberos" (D-64, decision C1): picking a percentage saves
// it at once. Without JavaScript, a button saves it.
export function CommissionForm({
  date,
  percent,
}: {
  date: string;
  percent: number;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={setCommission} className="flex flex-col gap-2">
      <input type="hidden" name="dia" value={date} />
      <SelectField
        key={percent}
        label={t.comision}
        name="comision"
        defaultValue={String(percent)}
        onChange={() => form.current?.requestSubmit()}
        options={COMMISSION_OPTIONS.map((value) => ({
          value: String(value),
          label: t.porcentaje(value),
        }))}
      />
      <noscript>
        <button
          type="submit"
          className={buttonClasses({ variant: "secondary", size: "md" })}
        >
          {t.guardarComision}
        </button>
      </noscript>
    </form>
  );
}
