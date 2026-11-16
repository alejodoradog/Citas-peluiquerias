import { BrandHeader } from "@/ui/brand";
import { LockIcon } from "@/ui/icons";
import { SignOutButton } from "@/ui/sign-out-button";
import { textos } from "@/ui/textos";

const t = textos.miAgenda.sinAcceso;

// "Mi agenda" by the session (task 7.6b) when the session is no longer of a
// professional: the owner took the access away between the guard and the
// reading. As B-05, the screen says no more than the database does.
export function AccessGone() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="px-5 pt-5">
        <BrandHeader />
      </div>
      <main className="flex flex-col gap-4 px-5 py-15">
        <span className="text-muted pb-5">
          <LockIcon size={24} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title">{t.titulo}</h1>
          <p className="text-body text-muted">{t.detalle}</p>
        </div>
        <SignOutButton />
      </main>
    </div>
  );
}
