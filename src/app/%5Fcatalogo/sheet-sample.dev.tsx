"use client";

import { useState } from "react";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { SelectField } from "@/ui/select-field";
import { Sheet } from "@/ui/sheet";

// The catalog page is a server component; the sheet needs state to open.
// Its sample copy is test data, not interface text.
export function SheetSample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        Abrir hoja inferior
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Editar servicio">
        <Field
          label="Nombre del servicio"
          name="hoja-nombre"
          defaultValue="Barba"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Precio de la hoja"
            name="hoja-precio"
            prefix="$"
            inputMode="numeric"
            defaultValue="15.000"
          />
          <SelectField
            label="Duración de la hoja"
            name="hoja-duracion"
            defaultValue="20"
            options={[
              { value: "15", label: "15 min" },
              { value: "20", label: "20 min" },
              { value: "25", label: "25 min" },
            ]}
          />
        </div>
        <Button onClick={() => setOpen(false)}>Guardar</Button>
      </Sheet>
    </>
  );
}
