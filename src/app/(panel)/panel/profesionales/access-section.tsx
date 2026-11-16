"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AccessResult } from "@/modulos/cuentas/acciones/professional-access";
import {
  accessActions,
  type AccessRefusal,
} from "@/modulos/cuentas/dominio/professional-access";
import { Button } from "@/ui/button";
import { Chip, type ChipTone } from "@/ui/chip";
import { Notice } from "@/ui/notice";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";

const t = textos.barberos.acceso;

// What the card shows, decided on the server (accessView) with its dates
// already written in Bogotá.
export type AccessCard =
  | { kind: "no_email" }
  | { kind: "inactive" }
  | { kind: "not_invited" }
  | { kind: "invited"; until: string }
  | { kind: "expired" }
  | { kind: "active" }
  | { kind: "revoked" };

const CHIPS: Record<AccessCard["kind"], { tone: ChipTone; label: string }> = {
  no_email: { tone: "neutral", label: t.chips.sinCorreo },
  inactive: { tone: "neutral", label: t.chips.inactivo },
  not_invited: { tone: "warning", label: t.chips.sinInvitar },
  invited: { tone: "brand", label: t.chips.invitado },
  expired: { tone: "warning", label: t.chips.vencida },
  active: { tone: "success", label: t.chips.conAcceso },
  revoked: { tone: "neutral", label: t.chips.quitado },
};

function detailOf(card: AccessCard): string {
  switch (card.kind) {
    case "no_email":
      return t.detalle.sinCorreo;
    case "inactive":
      return t.detalle.inactivo;
    case "not_invited":
      return t.detalle.sinInvitar;
    case "invited":
      return t.detalle.invitado(card.until);
    case "expired":
      return t.detalle.vencida;
    case "active":
      return t.detalle.conAcceso;
    case "revoked":
      return t.detalle.quitado;
  }
}

// "Acceso a su agenda" in D-54 (task 7.6b, decision 0010): whether the
// professional can sign in to "Mi agenda", and the buttons to invite them,
// send the invitation again or take the access away (with a confirmation).
// The invitation goes to the email saved in the card: with unsaved changes
// to it, the owner saves first.
export function AccessSection({
  barberId,
  barberName,
  card,
  emailChanged,
  invite,
  revoke,
}: {
  barberId: string;
  barberName: string;
  card: AccessCard;
  emailChanged: boolean;
  invite: (barberId: string) => Promise<AccessResult>;
  revoke: (barberId: string) => Promise<AccessResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<AccessRefusal | null>(null);
  const [sent, setSent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [working, startWorking] = useTransition();
  const actions = accessActions(card.kind);
  const chip = CHIPS[card.kind];

  function run(
    action: (barberId: string) => Promise<AccessResult>,
    after: () => void,
  ) {
    setError(null);
    setSent(false);
    startWorking(async () => {
      const result = await action(barberId);
      if (result.ok) {
        after();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <section
      aria-labelledby="acceso-titulo"
      className="rounded-card border-line flex flex-col gap-3 border bg-white px-4 py-3.5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="acceso-titulo" className="text-body font-bold">
          {t.titulo}
        </h2>
        <Chip tone={chip.tone}>{chip.label}</Chip>
      </div>
      <p className="text-help text-muted leading-[1.45]">{detailOf(card)}</p>
      {sent ? <Notice tone="success" title={t.enviada} /> : null}
      {error && !confirming ? (
        <Notice tone="danger" title={t.errores[error]} />
      ) : null}
      {actions.invite ? (
        emailChanged ? (
          <p className="text-help text-warning">{t.guardaPrimero}</p>
        ) : (
          <Button
            variant={actions.invite === "invite" ? "primary" : "secondary"}
            size="md"
            disabled={working}
            onClick={() => run(invite, () => setSent(true))}
          >
            {working
              ? t.enviando
              : actions.invite === "invite"
                ? t.invitar
                : t.reenviar}
          </Button>
        )
      ) : null}
      {actions.revoke ? (
        <Button
          variant="danger"
          size="md"
          disabled={working}
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          {t.quitar}
        </Button>
      ) : null}
      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t.confirmar.titulo(barberName)}
      >
        <p className="text-body leading-[1.45]">{t.confirmar.cuerpo}</p>
        {error ? <Notice tone="danger" title={t.errores[error]} /> : null}
        <Button
          variant="dangerSolid"
          disabled={working}
          onClick={() => run(revoke, () => setConfirming(false))}
        >
          {working ? t.confirmar.quitando : t.confirmar.si}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => setConfirming(false)}
        >
          {t.confirmar.no}
        </Button>
      </Sheet>
    </section>
  );
}
