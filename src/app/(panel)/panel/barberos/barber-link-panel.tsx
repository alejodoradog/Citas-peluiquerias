"use client";

import { useEffect, useRef, useState } from "react";
import { routes } from "@/lib/routes";
import type {
  BarberLinkCommandResult,
  IssueBarberLinkResult,
} from "@/modulos/barberias/acciones/barber-links";
import type { BarberLinkErrorCode } from "@/modulos/barberias/dominio/barber-link";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { CopyButton, CopyFeedback, useCopy } from "@/ui/copy-button";
import { FlowShell } from "@/ui/flow-shell";
import { CopyIcon, LinkIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { ShareButton } from "@/ui/share-button";
import { Sheet } from "@/ui/sheet";
import { textos } from "@/ui/textos";
import { TopBar } from "@/ui/top-bar";

const t = textos.barberos.link;

export type LinkBarber = {
  id: string;
  displayName: string;
  active: boolean;
  // The owner's own barber never reaches this screen.
  state: "unsent" | "active" | "off";
  // "3 de noviembre", when the link working now was issued.
  sentOn: string | null;
};

// D-56, a barber's private link. The server never renders a link: it keeps
// only its hash. A new one exists only in this component's state, from the
// answer to the owner's tap until they leave the screen, so "Copiar otra vez"
// and "Compartir" reuse it instead of making another.
export function BarberLinkPanel({
  barber,
  issueLink,
  turnOffLink,
}: {
  barber: LinkBarber;
  issueLink: (barberId: string) => Promise<IssueBarberLinkResult>;
  turnOffLink: (barberId: string) => Promise<BarberLinkCommandResult>;
}) {
  const { result: copied, copyFrom } = useCopy();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<BarberLinkErrorCode | null>(null);
  const [confirming, setConfirming] = useState<"new" | "off" | null>(null);

  // Whether the screen is on show. Next.js keeps a page left by a Link
  // mounted and hidden, cleaning up its effects; the browser may freeze the
  // whole page and bring it back with Back (bfcache). Either way the link is
  // dropped, and one that arrives while hidden is never kept, so nobody finds
  // it on coming back. A reload never brings it either: the server has none.
  const visible = useRef(false);
  useEffect(() => {
    visible.current = true;
    const forget = () => setUrl(null);
    const onPageHide = () => {
      visible.current = false;
      forget();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      visible.current = true;
      if (event.persisted) forget();
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      visible.current = false;
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      forget();
    };
  }, []);

  // The clipboard is handed the link during the tap itself (Safari copies
  // nothing after an await), while the server makes it.
  function issue() {
    setError(null);
    setBusy(true);
    const made = issueLink(barber.id).then(
      (answer) => {
        if (answer.ok) return answer.url;
        setError(answer.error);
        return null;
      },
      () => {
        setError("unknown");
        return null;
      },
    );
    void copyFrom(made);
    void made.then((link) => {
      setBusy(false);
      // On failure a confirmation stays open, with the error inside it.
      if (!link) return;
      if (visible.current) setUrl(link);
      setConfirming(null);
    });
  }

  async function turnOff() {
    setError(null);
    setBusy(true);
    const answer = await turnOffLink(barber.id).catch(
      () => ({ ok: false, error: "unknown" }) as const,
    );
    setBusy(false);
    if (!answer.ok) {
      setError(answer.error);
      return;
    }
    setUrl(null);
    setConfirming(null);
  }

  const working = barber.state === "active" || url !== null;
  const errorNotice = error ? (
    <Notice tone="danger" title={t.errores[error]} />
  ) : null;

  return (
    <>
      <FlowShell
        header={
          <TopBar
            title={t.titulo(barber.displayName)}
            titleAs="h1"
            back={{
              href: routes.panelBarberEdit(barber.id),
              label: textos.ui.volver,
            }}
          />
        }
      >
        <Card>
          <span className="text-brand flex">
            <LinkIcon size={28} />
          </span>
          <p className="text-body leading-[1.45]">
            {barber.active
              ? t.alcance(barber.displayName)
              : t.alcanceInactivo(barber.displayName)}
          </p>
          <p className="text-help text-muted">
            {barber.state === "active" && barber.sentOn
              ? textos.barberos.linkEnviado(barber.sentOn)
              : barber.state === "unsent"
                ? textos.barberos.linkSinEnviarAyuda
                : t.estadoDesactivado}
          </p>
        </Card>
        {!barber.active ? (
          <Notice tone="info" title={t.inactivo.titulo}>
            {t.inactivo.cuerpo}
          </Notice>
        ) : null}
        {barber.state === "off" && url === null ? (
          <Notice
            tone="warning"
            title={t.desactivado.titulo(barber.displayName)}
          >
            {t.desactivado.cuerpo}
          </Notice>
        ) : (
          <Notice tone="warning" title={t.reemplaza.titulo}>
            {t.reemplaza.cuerpo}
          </Notice>
        )}
        {confirming === null ? errorNotice : null}

        {url !== null ? (
          <Card>
            <strong className="text-label">{t.nuevo.titulo}</strong>
            <p className="text-help text-ink">
              {t.nuevo.cuerpo(barber.displayName)}
            </p>
            <p className="flex flex-col gap-1">
              <span className="text-label text-muted">{t.nuevo.etiqueta}</span>
              <span className="rounded-field bg-paper text-body text-ink px-3 py-2 break-all select-all">
                {url}
              </span>
            </p>
            <CopyFeedback
              result={copied}
              copiedLabel={t.nuevo.copiado}
              text={url}
            />
            <CopyButton
              text={url}
              label={t.nuevo.copiarOtraVez}
              copiedLabel={t.nuevo.copiado}
            />
            <ShareButton
              url={url}
              title={t.nuevo.compartirTitulo}
              text={t.nuevo.compartirTexto(barber.displayName)}
              label={t.nuevo.compartir}
            />
          </Card>
        ) : barber.state === "off" ? (
          <Button disabled={busy} onClick={issue}>
            {busy ? t.creando : t.crearNuevo}
          </Button>
        ) : (
          <Button
            disabled={busy}
            onClick={() => {
              if (barber.state === "active") {
                setError(null);
                setConfirming("new");
              } else {
                issue();
              }
            }}
          >
            <CopyIcon size={18} />
            {busy ? t.creando : t.copiarNuevo}
          </Button>
        )}

        {working ? (
          <div className="border-line flex flex-col gap-2 border-t pt-3.5">
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                setError(null);
                setConfirming("off");
              }}
            >
              {t.desactivar}
            </Button>
            <p className="text-help text-muted leading-[1.45]">
              {t.desactivarAyuda(barber.displayName)}
            </p>
          </div>
        ) : null}
      </FlowShell>

      <Sheet
        open={confirming === "new"}
        onClose={() => setConfirming(null)}
        title={t.confirmarNuevo.titulo}
      >
        <p className="text-body leading-[1.45]">
          {t.confirmarNuevo.cuerpo(barber.displayName)}
        </p>
        {confirming === "new" ? errorNotice : null}
        <Button disabled={busy} onClick={issue}>
          {busy ? t.creando : t.confirmarNuevo.si}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => setConfirming(null)}
        >
          {t.confirmarNuevo.no}
        </Button>
      </Sheet>
      <Sheet
        open={confirming === "off"}
        onClose={() => setConfirming(null)}
        title={t.confirmarDesactivar.titulo(barber.displayName)}
      >
        <p className="text-body leading-[1.45]">
          {t.confirmarDesactivar.cuerpo(barber.displayName)}
        </p>
        {confirming === "off" ? errorNotice : null}
        <Button
          variant="dangerSolid"
          disabled={busy}
          onClick={() => void turnOff()}
        >
          {busy ? t.confirmarDesactivar.desactivando : t.confirmarDesactivar.si}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => setConfirming(null)}
        >
          {t.confirmarDesactivar.no}
        </Button>
      </Sheet>
    </>
  );
}
