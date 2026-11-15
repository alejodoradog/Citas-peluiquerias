import { signOut } from "@/modulos/cuentas/acciones/account";
import { buttonClasses, type ButtonVariant } from "./button";
import { LogOutIcon } from "./icons";
import { PendingButton } from "./pending-button";
import { textos } from "./textos";

// Small secondary button in the header; a text action inside a notice; or,
// with row, the last row of the "Tu cuenta" list (D-50), 52 px tall.
export function SignOutButton({
  variant = "secondary",
  row = false,
}: {
  variant?: ButtonVariant;
  row?: boolean;
}) {
  return (
    <form action={signOut}>
      {row ? (
        <PendingButton
          pendingText={textos.cuentas.saliendo}
          className="text-ink text-body flex min-h-13 w-full items-center gap-3 px-4 py-3.5 text-left font-semibold focus-visible:-outline-offset-2 disabled:opacity-70"
        >
          <LogOutIcon />
          {textos.cuentas.salir}
        </PendingButton>
      ) : (
        <PendingButton
          pendingText={textos.cuentas.saliendo}
          className={buttonClasses({ variant, size: "sm", block: false })}
        >
          {textos.cuentas.salir}
        </PendingButton>
      )}
    </form>
  );
}
