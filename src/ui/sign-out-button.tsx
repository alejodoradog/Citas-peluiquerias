import { signOut } from "@/modulos/cuentas/acciones/account";
import { Button, type ButtonVariant } from "./button";
import { textos } from "./textos";

// Small secondary button in the header; a text action inside a notice.
export function SignOutButton({
  variant = "secondary",
}: {
  variant?: ButtonVariant;
}) {
  return (
    <form action={signOut}>
      <Button type="submit" variant={variant} size="sm" block={false}>
        {textos.cuentas.salir}
      </Button>
    </form>
  );
}
