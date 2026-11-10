import Link from "next/link";
import { PlusIcon } from "./icons";

// Floating button of the owner's agenda (D-30), 24 px above the bottom bar.
// It only has an icon, so its name comes from the label.
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="bg-brand shadow-fab hover:bg-brand-strong fixed right-4.5 bottom-23 flex size-14.5 items-center justify-center rounded-full text-white"
    >
      <PlusIcon size={26} />
    </Link>
  );
}
