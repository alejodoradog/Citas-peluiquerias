import { signOut } from "@/modulos/cuentas/acciones/account";
import { Button, type ButtonVariant } from "./button";
import { textos } from "./textos";

export function SignOutButton({
  variant = "compact",
}: {
  variant?: ButtonVariant;
}) {
  return (
    <form action={signOut}>
      <Button type="submit" variant={variant}>
        {textos.cuentas.salir}
      </Button>
    </form>
  );
}
