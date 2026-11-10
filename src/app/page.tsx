import { routes } from "@/lib/routes";
import { ActionBar } from "@/ui/action-bar";
import { BrandHeader } from "@/ui/brand";
import { ButtonLink } from "@/ui/button";
import { CircleCheckIcon } from "@/ui/icons";
import { textos } from "@/ui/textos";

const t = textos.inicio;

// D-01. The design's agenda screenshot waits until the agenda exists (phase 4).
export default function Home() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col">
      <main className="flex flex-col gap-5.5 px-5 pt-10 pb-7.5">
        <BrandHeader large />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-display">{t.titulo}</h1>
          <p className="text-body text-muted">{t.bajada}</p>
        </div>
        <ul className="flex flex-col gap-2.5">
          {t.beneficios.map((beneficio) => (
            <li key={beneficio} className="text-body flex items-start gap-2.5">
              <span className="text-brand flex">
                <CircleCheckIcon />
              </span>
              {beneficio}
            </li>
          ))}
        </ul>
      </main>
      <ActionBar>
        <ButtonLink href={routes.signUp}>{t.crearCuenta}</ButtonLink>
        <ButtonLink href={routes.signIn} variant="secondary">
          {t.ingresar}
        </ButtonLink>
        <p className="text-help text-muted text-center">{t.nota}</p>
      </ActionBar>
    </div>
  );
}
