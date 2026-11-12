"use client";

import { createBlock } from "@/modulos/agenda/acciones/barber";
import { BLOCK_REASONS } from "@/modulos/agenda/dominio/barber-agenda";
import { cx } from "@/ui/cx";
import { FlowShell } from "@/ui/flow-shell";
import { ActionForm, SubmitButton, useFormAction } from "@/ui/form";
import { Notice } from "@/ui/notice";
import { SelectField, type SelectOption } from "@/ui/select-field";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";

const t = textos.barbero.bloquear;

// B-04: the day, from and until (quarter hours) and the reason. The form
// wraps the whole screen so "Bloquear" can sit in the bottom bar.
export function BlockForm({
  token,
  close,
  days,
  times,
  defaults,
}: {
  token: string;
  close: { href: string; label: string };
  days: SelectOption[];
  times: SelectOption[];
  defaults: { dia: string; desde: string; hasta: string };
}) {
  const form = useFormAction(createBlock, textos.barbero.errores);
  const reasonError = form.fieldError("motivo");
  const chosenReason = form.value("motivo");
  // React resets the form after each submit, to what its fields had when
  // they mounted. Remounting them with what was sent keeps the barber's
  // choice after a refusal.
  const sent = ["dia", "desde", "hasta", "motivo"]
    .map((field) => form.value(field as "dia") ?? "")
    .join("|");

  return (
    <ActionForm form={form} className="flex min-h-full flex-1 flex-col">
      <input type="hidden" name="token" value={token} />
      <FlowShell
        key={sent}
        header={<TopBar title={t.titulo} titleAs="h1" close={close} />}
        actions={
          <SubmitButton pendingText={t.enviando}>{t.enviar}</SubmitButton>
        }
      >
        {form.formError ? (
          <Notice tone="danger" title={form.formError} />
        ) : null}
        <SelectField
          label={t.dia}
          name="dia"
          options={days}
          defaultValue={form.value("dia") ?? defaults.dia}
          error={form.fieldError("dia")}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label={t.desde}
            name="desde"
            options={times}
            defaultValue={form.value("desde") ?? defaults.desde}
            error={form.fieldError("desde")}
          />
          <SelectField
            label={t.hasta}
            name="hasta"
            options={times}
            defaultValue={form.value("hasta") ?? defaults.hasta}
            error={form.fieldError("hasta")}
          />
        </div>
        <fieldset
          className="flex flex-col gap-2"
          aria-describedby={reasonError ? "motivo-error" : undefined}
        >
          <legend className="text-muted mb-2 text-sm font-semibold">
            {t.motivo}
          </legend>
          <div className="flex flex-wrap gap-2">
            {BLOCK_REASONS.map((reason) => (
              <label
                key={reason}
                className={cx(
                  "border-line text-ink flex min-h-11 cursor-pointer items-center rounded-full border bg-white px-4 text-sm font-semibold",
                  "has-checked:border-brand has-checked:bg-brand-soft has-checked:border-2 has-checked:px-3.75",
                  "has-focus-visible:outline-brand has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
                )}
              >
                <input
                  type="radio"
                  name="motivo"
                  value={reason}
                  defaultChecked={chosenReason === reason}
                  className="sr-only"
                />
                {t.motivos[reason]}
              </label>
            ))}
          </div>
          {reasonError ? (
            <p id="motivo-error" className="text-danger text-help">
              {reasonError}
            </p>
          ) : null}
        </fieldset>
        <p className="text-muted text-[13px]">{t.aviso}</p>
      </FlowShell>
    </ActionForm>
  );
}
