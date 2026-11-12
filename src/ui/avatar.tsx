import { cx } from "./cx";

// Initials of a barber for the avatar (D-12, D-53): the first letter of the
// first two words ("Mario Gómez" → "MG"), or the first two letters of a
// single word ("Kevin" → "KE"), in capitals. Accented letters stay as they
// are; extra spaces do not count.
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [first, second] = words;
  if (!first) return "";
  const letters = second
    ? [...first].slice(0, 1).concat([...second].slice(0, 1))
    : [...first].slice(0, 2);
  return letters.join("").toLocaleUpperCase("es-CO");
}

// The kind of business a name may start with; the logo placeholder of D-57
// skips it ("Barbería La Esquina" → "LE").
const BUSINESS_WORDS = new Set([
  "barbería",
  "barberia",
  "barbershop",
  "peluquería",
  "peluqueria",
]);

// Initials of a barbershop, for the logo while there is none.
export function shopInitialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [first, ...rest] = words;
  const skip =
    first !== undefined &&
    rest.length > 0 &&
    BUSINESS_WORDS.has(first.toLocaleLowerCase("es-CO"));
  return initialsOf((skip ? rest : words).join(" "));
}

const sizes = {
  // The barbers of the agenda (D-30, D-31).
  sm: "size-7 text-xs",
  md: "size-11 text-sm",
  lg: "size-16 text-[1.3125rem]",
} as const;

// Round avatar of a barber: the photo, or the initials on the brand's soft
// color. Always decorative: the name is written next to it.
export function Avatar({
  name,
  size,
  photoUrl,
}: {
  name: string;
  size: keyof typeof sizes;
  photoUrl?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "bg-brand-soft text-brand-strong flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
        sizes[size],
      )}
    >
      {photoUrl ? (
        // A small photo from storage; next/image would need every storage
        // host configured and adds nothing at 64 px.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="size-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
