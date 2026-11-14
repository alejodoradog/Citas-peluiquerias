import {
  formatBogotaDate,
  formatBogotaDayMonth,
  startOfBogotaDay,
  type BogotaDate,
} from "@/lib/fechas/fechas";
import { formatPesos } from "@/lib/dinero/pesos";
import {
  loadSubscriptionNotice,
  type PayInfo,
} from "@/modulos/suscripciones/datos/notice";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";

const t = textos.suscripcion;

function day(date: BogotaDate): string {
  return formatBogotaDayMonth(startOfBogotaDay(date));
}

// "Paga $X por llave Bre-B … o Nequi … y envía el comprobante a …", or the
// promise to send the data while the founder has not set it (decision S2).
function payLine({ priceCop, breB, nequi, email }: PayInfo): string {
  if (priceCop === null) return t.pago.sinValor;
  const options = [
    breB ? t.pago.opcionBreB(breB) : null,
    nequi ? t.pago.opcionNequi(nequi) : null,
  ].filter((option): option is string => option !== null);
  return options.length > 0 && email
    ? t.pago.con(formatPesos(priceCop), options.join(t.pago.o), email)
    : t.pago.sinDatos(formatPesos(priceCop));
}

// The subscription of the active sede on top of the agenda (task 5.5): the
// trial, D-70 (expiring), D-71 (grace) or D-72 (paused).
export async function SubscriptionNotice({
  barbershopId,
  today,
}: {
  barbershopId: string;
  today: BogotaDate;
}) {
  const subscription = await loadSubscriptionNotice(barbershopId, today);
  if (!subscription) return null;
  const { notice, pay } = subscription;
  switch (notice.kind) {
    // As task 1.5 showed it.
    case "trial":
      return (
        <Notice
          tone="info"
          title={textos.panel.prueba(
            formatBogotaDate(startOfBogotaDay(notice.until)),
          )}
        />
      );
    case "expiring":
      return (
        <Notice
          tone="warning"
          title={(notice.trial ? t.vencePrueba : t.venceMes)(day(notice.on))}
        >
          {payLine(pay)}
        </Notice>
      );
    case "grace":
      return (
        <Notice tone="danger" title={t.vencida(day(notice.expiredOn))}>
          {`${t.reservasHasta(day(notice.bookingsUntil))} ${payLine(pay)}`}
        </Notice>
      );
    case "paused":
      return (
        <Notice tone="neutral" title={t.pausada}>
          {`${notice.firstPayment ? t.pausadaPrimerPago : t.pausadaDetalle} ${payLine(pay)}`}
        </Notice>
      );
  }
}
