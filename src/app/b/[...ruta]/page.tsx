import type { Metadata } from "next";
import { routes } from "@/lib/routes";
import { BrandHeader } from "@/ui/brand";
import { ButtonLink } from "@/ui/button";
import { LinkIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";

const t = textos.barbero.linkViejo;

// An old address of the private link of a professional (/b/<token>, task
// 4.4), gone with task 7.6c (decision 0010, point 8): whatever comes after
// /b/, the page says the same and sends to the sign-in. It never reads the
// address nor asks the database, so nothing can be learned from it. The old
// token stays out of any Referer and any cache (next.config.ts).
export const metadata: Metadata = {
  title: t.titulo,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function OldBarberLinkPage() {
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
        <ButtonLink href={routes.signIn} size="md" block>
          {t.ingresar}
        </ButtonLink>
        <p className="text-help text-muted">{t.sinCuenta}</p>
      </main>
    </div>
  );
}
