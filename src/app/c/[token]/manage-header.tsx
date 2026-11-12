import Link from "next/link";
import { ChevronLeftIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";

// The top of C-09, C-11 and C-13 (the barbershop) and of C-10 (back to the
// appointment, with what is being moved).
export function ManageHeader({
  name,
  locality,
  backHref,
}: {
  name: string;
  locality: string | null;
  backHref?: string;
}) {
  return (
    <header className="mx-auto flex min-h-14 w-full max-w-md items-center gap-1 px-3 pt-2.5 pb-1.5">
      {backHref ? (
        <Link
          href={backHref}
          aria-label={textos.reservas.gestionar.reprogramar.volver}
          className="text-ink flex size-11 shrink-0 items-center justify-center rounded-full no-underline"
        >
          <ChevronLeftIcon size={22} />
        </Link>
      ) : (
        <span className="w-2" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-base font-bold">{name}</p>
        {locality ? <p className="text-muted text-xs">{locality}</p> : null}
      </div>
    </header>
  );
}
