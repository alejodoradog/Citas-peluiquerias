import "server-only";
import { publicImageUrl } from "@/lib/imagenes/keys";
import type { OwnerBarbershop } from "@/modulos/cuentas/datos/access";
import type { SwitcherBarbershop } from "./barbershop-switcher";

// The owner's sedes as the switcher shows them, with the public URL of each
// logo (task 2.6).
export function switcherBarbershops(
  barbershops: readonly OwnerBarbershop[],
): SwitcherBarbershop[] {
  return barbershops.map((barbershop) => ({
    id: barbershop.id,
    name: barbershop.name,
    slug: barbershop.slug,
    logoUrl: barbershop.logoPath ? publicImageUrl(barbershop.logoPath) : null,
  }));
}
