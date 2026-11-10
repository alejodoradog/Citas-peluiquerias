import Link from "next/link";
import { routes } from "@/lib/routes";
import { cx } from "./cx";
import { textos } from "./textos";

// The brand: the teeth of a barber's comb over the name Yapoin, which links
// home. Large on the home page (D-01), regular everywhere else.
export function BrandHeader({ large = false }: { large?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden="true" className={cx("comb", large ? "w-24" : "w-18")} />
      <Link
        href={routes.home}
        className={cx(
          "text-ink self-start font-bold no-underline",
          large ? "text-[1.375rem]" : "text-section",
        )}
      >
        {textos.marca}
      </Link>
    </div>
  );
}
