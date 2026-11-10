"use client";

import { useRef, useState } from "react";
import { formatPesos } from "@/lib/dinero/pesos";
import { routes } from "@/lib/routes";
import { offeredServices } from "@/modulos/barberias/dominio/setup";
import { Button, ButtonLink } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { FlowShell } from "@/ui/flow-shell";
import { EditIcon, PlusIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { Steps } from "@/ui/steps";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";
import { ServiceSheet } from "./service-sheet";
import { useSetupDraft } from "./setup-draft";

const t = textos.asistente.servicios;

export function ServicesStep() {
  const { draft, dispatch } = useSetupDraft();
  // null: closed; "new": adding one; otherwise the key being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const noneOffered = offeredServices(draft).length === 0;
  const service = draft.services.find((s) => s.key === editing);

  function open(key: string, from: HTMLElement) {
    opener.current = from;
    setEditing(key);
  }

  return (
    <FlowShell
      header={<TopBar title={t.barra} subtitle={t.paso} />}
      actions={
        <>
          {noneOffered ? (
            <Button disabled>{t.continuar}</Button>
          ) : (
            <ButtonLink href={routes.setupTeam}>{t.continuar}</ButtonLink>
          )}
          <p className="text-help text-muted text-center leading-[1.45]">
            {t.pie}
          </p>
        </>
      }
    >
      <Steps current={2} total={3} announce={false} />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title">{t.titulo}</h1>
        <p className="text-body text-muted">{t.bajada}</p>
      </div>
      <ul className="rounded-card border-line flex flex-col overflow-hidden border bg-white">
        {draft.services.map((item) => (
          <li
            key={item.key}
            className="border-neutral-soft flex items-center gap-1 border-b py-1 pr-2 pl-2 last:border-b-0"
          >
            <Checkbox
              label={t.ofrecer(item.name)}
              hideLabel
              size="lg"
              checked={item.offered}
              onChange={() =>
                dispatch({ type: "toggle_service", key: item.key })
              }
            />
            <button
              type="button"
              aria-label={t.editar(item.name)}
              onClick={(event) => open(item.key, event.currentTarget)}
              className="flex min-h-13 flex-1 items-center justify-between gap-3 rounded-lg px-2 text-left"
            >
              <span className="flex flex-col">
                <span className="text-body font-bold">{item.name}</span>
                <span className="text-help text-muted">
                  {t.duracion(item.durationMinutes)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <strong className="text-body">
                  {formatPesos(item.priceCop)}
                </strong>
                <span className="text-muted flex">
                  <EditIcon size={16} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        size="md"
        onClick={(event) => open("new", event.currentTarget)}
      >
        <PlusIcon size={18} />
        {t.agregar}
      </Button>
      {noneOffered ? <Notice tone="warning" title={t.ninguno} /> : null}
      <ServiceSheet
        open={editing !== null}
        service={editing === "new" ? null : (service ?? null)}
        takenNames={draft.services
          .filter((s) => s.key !== editing)
          .map((s) => s.name)}
        onClose={() => {
          setEditing(null);
          opener.current?.focus();
        }}
        onSave={(saved) => {
          dispatch({ type: "save_service", service: saved });
          setEditing(null);
          opener.current?.focus();
        }}
        onRemove={(key) => {
          dispatch({ type: "remove_service", key });
          setEditing(null);
        }}
      />
    </FlowShell>
  );
}
