import type { SaveInviteNotice } from "@/modulos/cuentas/dominio/professional-access";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";

const t = textos.barberos.acceso;

// Task 8.16: after saving a professional, how their invitation went. The
// address carries only a code of a closed list; the email is read from the
// database by the page. "Sent" is only said while the database does have an
// invitation pending for them, so a made-up address does not claim it.
export function InvitationNotice({
  notice,
  name,
  email,
  pending,
}: {
  notice: SaveInviteNotice;
  name: string;
  email: string | null;
  pending: boolean;
}) {
  if (notice === "sent") {
    const to = (email ?? "").trim();
    return pending && to !== "" ? (
      <Notice tone="success" title={t.alGuardar.enviada(to)} />
    ) : null;
  }
  return (
    <Notice tone="warning" title={t.alGuardar.noSalio(name)}>
      {t.errores[notice]}
    </Notice>
  );
}
