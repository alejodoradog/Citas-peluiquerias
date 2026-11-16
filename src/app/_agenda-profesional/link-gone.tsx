import { BrandHeader } from "@/ui/brand";
import { LinkIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";

const t = textos.barbero.vencido;

// B-05: the link was deactivated or replaced, or never was one. The
// database says nothing more, so neither does this screen.
export function BarberLinkGone() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="px-5 pt-5">
        <BrandHeader />
      </div>
      <main className="flex flex-col gap-4 px-5 py-15">
        <span className="text-muted pb-5">
          <LinkIcon size={24} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title">{t.titulo}</h1>
          <p className="text-body text-muted">{t.detalle}</p>
        </div>
      </main>
    </div>
  );
}
