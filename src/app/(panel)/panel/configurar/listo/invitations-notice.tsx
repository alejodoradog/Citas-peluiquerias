import Link from "next/link";
import { routes } from "@/lib/routes";
import { Notice } from "@/ui/notice";
import { textos } from "@/ui/textos";

const t = textos.asistente.listo.invitaciones;

export type TeamInvitation = {
  id: string;
  name: string;
  email: string;
  // "invited": the invitation is pending in the database; "none": it did not
  // go out. Anything else (they already have access) says nothing.
  state: "invited" | "none" | "active" | "revoked";
};

// Task 8.17: at the end of the wizard, how the invitations to the team went.
// What it shows is what the database has (who is "invited" and who is still
// "none"), read by the page, not anything carried in the address.
export function InvitationsNotice({ team }: { team: TeamInvitation[] }) {
  const sent = team.filter((member) => member.state === "invited");
  const failed = team.filter((member) => member.state === "none");
  if (sent.length === 0 && failed.length === 0) return null;
  const parts = sent.map((member) => `a ${member.name} (${member.email})`);
  const list =
    parts.length > 1
      ? `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`
      : (parts[0] ?? "");
  return (
    <div className="flex flex-col gap-2.5">
      {sent.length > 0 ? (
        <Notice tone="success" title={t.enviadas(list, sent.length > 1)} />
      ) : null}
      {failed.map((member) => (
        <Notice
          key={member.id}
          tone="warning"
          title={t.noSalio(member.name)}
          action={
            <Link href={routes.panelBarberEdit(member.id)}>
              {t.abrirFicha(member.name)}
            </Link>
          }
        >
          {t.invitalo}
        </Notice>
      ))}
    </div>
  );
}
