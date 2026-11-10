import type { Metadata } from "next";
import { Suspense } from "react";
import {
  displayBookingUrl,
  posterFileName,
  publicBookingUrl,
  qrFileName,
} from "@/lib/sitio";
import { countActiveBarbers } from "@/modulos/barberias/datos/setup";
import { BookingLinkCard } from "@/ui/booking-link-card";
import { Card } from "@/ui/card";
import { CopyButton } from "@/ui/copy-button";
import { Notice } from "@/ui/notice";
import { PosterDownloadButton } from "@/ui/poster-download-button";
import { QrCode, qrMatrix } from "@/ui/qr-code";
import { QrDownloadButton } from "@/ui/qr-download-button";
import { LoadingState } from "@/ui/states";
import { TabShell } from "@/ui/tab-shell";
import { textos } from "@/ui/textos";
import { requireReadyOwner } from "../ready-owner";

const t = textos.compartir;

export const metadata: Metadata = { title: t.titulo };

// D-62: the barbershop's booking link, ready for Instagram, a WhatsApp status
// and the mirror: copy or share it, its QR and a printable poster, and a
// message to paste. The public page behind the link arrives with task 3.2.
export default function SharePage() {
  return (
    <TabShell title={t.titulo} subtitle={t.subtitulo}>
      <Suspense fallback={<LoadingState label={t.cargando} />}>
        <Share />
      </Suspense>
    </TabShell>
  );
}

async function Share() {
  const { barbershop } = await requireReadyOwner();
  const hasBarbers = (await countActiveBarbers(barbershop.id)) > 0;
  const url = publicBookingUrl(barbershop.slug);
  const matrix = qrMatrix(url);
  const message = t.mensaje(
    barbershop.name,
    displayBookingUrl(barbershop.slug),
  );

  return (
    <>
      <p className="text-body text-muted">{t.bajada}</p>
      {/* Without barbers nobody can book yet (P4 of task 2.5). */}
      {hasBarbers ? null : (
        <Notice tone="warning" title={textos.asistente.listo.sinBarberos} />
      )}
      <BookingLinkCard
        slug={barbershop.slug}
        name={barbershop.name}
        copyVariant="primary"
      />
      <Card>
        <div className="bg-paper rounded-button flex flex-col items-center gap-2.5 p-4 text-center">
          <QrCode
            value={url}
            label={textos.ui.qr.etiqueta}
            size={200}
            bordered={false}
          />
          <strong className="text-base">{t.qrTitulo}</strong>
          <span className="text-help text-muted break-words">
            {barbershop.name}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <QrDownloadButton
            matrix={matrix}
            fileName={qrFileName(barbershop.slug)}
            label={t.descargarQr}
          />
          <PosterDownloadButton
            matrix={matrix}
            caption={t.qrTitulo}
            name={barbershop.name}
            fileName={posterFileName(barbershop.slug)}
            label={t.afiche}
          />
        </div>
      </Card>
      <Card className="gap-2.5">
        <h2 className="text-body font-bold">{t.texto.titulo}</h2>
        <p className="text-body bg-paper rounded-field p-3">{message}</p>
        <CopyButton
          text={message}
          label={t.texto.copiar}
          copiedLabel={t.texto.copiado}
        />
      </Card>
    </>
  );
}
