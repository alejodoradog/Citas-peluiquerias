import "server-only";
import {
  toSaveInviteNotice,
  type SaveInviteNotice,
} from "../dominio/professional-access";
import { inviteProfessional } from "./professional-access";

// Tasks 8.16 and 8.17: once a professional is saved (one by one in their
// form, or all together at the end of the setup wizard), the invitation goes
// out by the same action as "Invitar" (owner, barber of the shop by RLS,
// invite_barber in the database, the service key only on what it answers).
// Not an exposed action: the callers decide whom to invite. However it ends,
// the professional stays saved; the answer says how it went and nothing
// here throws.
export async function inviteAfterSaving(
  barberId: string,
): Promise<SaveInviteNotice> {
  try {
    const result = await inviteProfessional(barberId);
    return result.ok ? "sent" : toSaveInviteNotice(result.error);
  } catch {
    return "unknown";
  }
}
