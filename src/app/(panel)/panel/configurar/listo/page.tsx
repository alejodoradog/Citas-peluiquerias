import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formatBogotaDayMonth, startOfBogotaDay } from "@/lib/fechas/fechas";
import { routes } from "@/lib/routes";
import { displayBookingUrl, publicBookingUrl } from "@/lib/sitio";
import {
  barbershopNeedsSetup,
  countActiveBarbers,
} from "@/modulos/barberias/datos/setup";
import { requireOwner } from "@/modulos/cuentas/guards";
import { ButtonLink } from "@/ui/button";
import { Card } from "@/ui/card";
import { CopyButton } from "@/ui/copy-button";
import { CheckIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { QrCode, qrMatrix } from "@/ui/qr-code";
import { QrDownloadButton } from "@/ui/qr-download-button";
import { ShareButton } from "@/ui/share-button";
import { LoadingState } from "@/ui/states";
import { textos } from "@/ui/textos";
import { ClearSetupDraft } from "./clear-setup-draft";

const t = textos.asistente.listo;

export const metadata: Metadata = { title: t.titulo };

// D-14: the end of the setup wizard, with the booking link ready to share.
export default function SetupDonePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pt-8.5 pb-6">
      <Suspense fallback={<LoadingState />}>
        <SetupDone />
      </Suspense>
    </main>
  );
}

async function SetupDone() {
  const { barbershop } = await requireOwner();
  if (await barbershopNeedsSetup(barbershop.id)) {
    redirect(routes.setup);
  }
  const hasBarbers = (await countActiveBarbers(barbershop.id)) > 0;
  const url = publicBookingUrl(barbershop.slug);
  const trialEnd = formatBogotaDayMonth(startOfBogotaDay(barbershop.expiresOn));

  return (
    <>
      <ClearSetupDraft />
      <span className="bg-success-soft text-success flex size-16 items-center justify-center rounded-full">
        <CheckIcon size={34} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title">
          {hasBarbers ? t.titulo : t.tituloSinBarberos}
        </h1>
        <p className="text-body text-muted">{t.prueba(trialEnd)}</p>
      </div>
      {hasBarbers ? null : <Notice tone="warning" title={t.sinBarberos} />}
      <Card className="gap-2">
        <span className="text-help text-muted">{t.link}</span>
        <strong className="text-lg break-all">
          {displayBookingUrl(barbershop.slug)}
        </strong>
        <div className="grid grid-cols-2 gap-2.5">
          <CopyButton text={url} label={t.copiar} copiedLabel={t.copiado} />
          <ShareButton
            url={url}
            title={barbershop.name}
            text={t.compartirTexto(barbershop.name)}
            label={t.compartir}
          />
        </div>
      </Card>
      <div className="self-center">
        <QrCode value={url} label={t.qr} />
      </div>
      <QrDownloadButton
        matrix={qrMatrix(url)}
        fileName={`qr-yapoin-${barbershop.slug}.png`}
        label={t.descargarQr}
      />
      <ButtonLink href={routes.panel}>{t.agenda}</ButtonLink>
    </>
  );
}
