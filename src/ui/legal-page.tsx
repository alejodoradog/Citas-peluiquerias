import { routes } from "@/lib/routes";
import { AuthHeading, AuthShell } from "./auth-shell";
import { TextLink } from "./text-link";
import { textos } from "./textos";

// The terms and the data policy, linked from the sign-up form (D-02). Their
// text is task 6.5 (Ley 1581); until then the page says it is on its way.
export function LegalPage({ title }: { title: string }) {
  return (
    <AuthShell>
      <AuthHeading title={title} intro={textos.legal.enPreparacion} />
      <TextLink href={routes.home} standalone>
        {textos.legal.volver}
      </TextLink>
    </AuthShell>
  );
}
