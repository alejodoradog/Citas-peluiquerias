import { cx } from "./cx";
import { textos } from "./textos";

// The brand: the teeth of a barber's comb over the name Yapoin, as plain text
// like the design. Large on the home page (D-01, where the comb and the name
// are two blocks 22 px apart), regular and 8 px apart everywhere else.
export function BrandHeader({ large = false }: { large?: boolean }) {
  return (
    <div className={cx("flex flex-col", large ? "gap-5.5" : "gap-2")}>
      <div aria-hidden="true" className={cx("comb", large ? "w-24" : "w-18")} />
      <p
        className={cx(
          "text-ink font-bold",
          large ? "text-[1.375rem]" : "text-section",
        )}
      >
        {textos.marca}
      </p>
    </div>
  );
}
