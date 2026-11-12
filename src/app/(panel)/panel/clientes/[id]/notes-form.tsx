"use client";

import { useState } from "react";
import type { NotesState } from "@/modulos/clientes/acciones/customers";
import { MAX_NOTES_LENGTH } from "@/modulos/clientes/dominio/customers";
import { FieldFrame, useFieldDescription } from "@/ui/field";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";

const t = textos.clientes.ficha.notas;

type NotesAction = (
  previous: NotesState,
  formData: FormData,
) => Promise<NotesState>;

// The notes of D-41 ("Prefiere a Andrés. Degradado bajo."), only for the
// barbershop. "Guardar notas" appears once they change, and says when they
// were saved.
export function NotesForm({
  customerId,
  notes,
  action,
}: {
  customerId: string;
  notes: string | null;
  action: NotesAction;
}) {
  const form = useFormAction(action, t.errores);
  const [saved, setSaved] = useState(notes ?? "");
  const [value, setValue] = useState(form.value("notes") ?? notes ?? "");
  const [lastState, setLastState] = useState(form.state);
  // A save that worked makes what was typed the saved notes.
  if (lastState !== form.state) {
    setLastState(form.state);
    if (form.state.status === "done") setSaved(value);
  }
  const error = form.fieldError("notes");
  const { id, helpId, errorId, showHelp, describedBy } = useFieldDescription(
    undefined,
    error,
  );
  const changed = value !== saved;

  return (
    <ActionForm form={form} className="flex flex-col gap-2.5">
      <input type="hidden" name="customerId" value={customerId} />
      <FieldFrame
        id={id}
        label={t.etiqueta}
        error={error}
        helpId={helpId}
        errorId={errorId}
        showHelp={showHelp}
      >
        <textarea
          id={id}
          name="notes"
          rows={2}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={MAX_NOTES_LENGTH}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="rounded-field border-line-strong text-ink focus-visible:border-brand aria-invalid:border-danger w-full resize-none border bg-white px-3.5 py-3 text-base aria-invalid:border-2"
        />
      </FieldFrame>
      {form.formError ? <Notice tone="danger" title={form.formError} /> : null}
      {form.notice === "saved" && !changed ? (
        <Notice tone="success" title={t.guardadas} />
      ) : null}
      {changed ? (
        <SubmitButton variant="secondary" pendingText={t.guardando}>
          {t.guardar}
        </SubmitButton>
      ) : null}
    </ActionForm>
  );
}
