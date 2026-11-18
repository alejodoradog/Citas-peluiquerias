import { listBarbers } from "@/modulos/barberias/datos/barbers";
import { readAccountStates } from "@/modulos/cuentas/datos/professional-access";
import { InvitationsNotice, type TeamInvitation } from "./invitations-notice";

// Task 8.17: reads from the database (RLS, the owner's own establishment)
// who has an invitation pending and who has an email but no invitation. If
// the database cannot answer, the screen shows nothing rather than failing.
export async function SetupInvitations({
  barbershopId,
}: {
  barbershopId: string;
}) {
  let team: TeamInvitation[];
  try {
    const [barbers, states] = await Promise.all([
      listBarbers(barbershopId),
      readAccountStates(barbershopId),
    ]);
    team = barbers.flatMap((barber) => {
      const email = (barber.email ?? "").trim();
      const state = states.get(barber.id)?.state;
      // The owner who attends and the inactive ones are never invited.
      if (barber.is_owner || !barber.active || email === "" || !state) {
        return [];
      }
      return [{ id: barber.id, name: barber.display_name, email, state }];
    });
  } catch {
    return null;
  }
  return <InvitationsNotice team={team} />;
}
