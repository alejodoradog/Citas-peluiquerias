import { signOut } from "@/modulos/cuentas/acciones/account";
import { Button, type ButtonVariant } from "./button";
import { LogOutIcon } from "./icons";
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
        <button
          type="submit"
          className="text-ink text-body flex min-h-13 w-full items-center gap-3 px-4 py-3.5 text-left font-semibold focus-visible:-outline-offset-2"
        >
          <LogOutIcon />
          {textos.cuentas.salir}
        </button>
      ) : (
        <Button type="submit" variant={variant} size="sm" block={false}>
          {textos.cuentas.salir}
        </Button>
      )}
    </form>
  );
}
