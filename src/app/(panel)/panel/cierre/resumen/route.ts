import { now, toBogotaDate } from "@/lib/fechas/fechas";
import { loadDayClose } from "@/modulos/cierre/datos/day-close";
import {
  closeCsv,
  dayClose,
  parseCloseDay,
} from "@/modulos/cierre/dominio/day-close";
import { requireOwner } from "@/modulos/cuentas/guards";
import { textos } from "@/ui/textos";

const t = textos.cierre.csv;

// "Descargar resumen" of D-64 (task 4.6, decision C3): the day close of the
// active barbershop as a CSV, for the owner only. Never cached.
export async function GET(request: Request): Promise<Response> {
  const { barbershop } = await requireOwner();
  const date = parseCloseDay(
    new URL(request.url).searchParams.get("dia") ?? undefined,
    toBogotaDate(now()),
  );
  const close = dayClose(await loadDayClose(barbershop.id, date));
  return new Response(
    closeCsv(close, { heading: t.encabezado, totals: t.total }),
    {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${t.archivo(date)}"`,
        "cache-control": "private, no-store",
      },
    },
  );
}
