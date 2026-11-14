import { routes } from "@/lib/routes";
import { AuthHeading, AuthShell } from "./auth-shell";
import { TextLink } from "./text-link";
import { textos } from "./textos";

type LegalDocument = "terminos" | "privacidad";

// The terms of use and the data policy (task 6.5), linked from the sign-up
// (D-02), the booking (C-06) and the barbershop's page. One column that reads
// well on a phone: the title, the date it holds from, and each section.
export function LegalPage({ document }: { document: LegalDocument }) {
  const legal = textos.legal;
  const doc = legal[document];
  return (
    <AuthShell>
      <AuthHeading title={doc.titulo} intro={legal.vigencia(legal.fecha)} />
      <p className="text-body">{doc.intro}</p>
      {doc.secciones.map((section) => (
        <section key={section.titulo} className="flex flex-col gap-2">
          <h2 className="text-section">{section.titulo}</h2>
          {section.parrafos.map((paragraph) => (
            <p key={paragraph} className="text-body">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <TextLink href={routes.home} standalone>
        {legal.volver}
      </TextLink>
    </AuthShell>
  );
}
