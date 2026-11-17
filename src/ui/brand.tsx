import { CombMark } from "./brand-mark";
import { cx } from "./cx";
import { textos } from "./textos";

// The brand: Yapoin's comb (the official logo, task 7.9) over the name, as
// plain text like the design. Large on the home page (D-01, where the logo
// and the name are two blocks 22 px apart), regular and 8 px apart
// everywhere else.
export function BrandHeader({ large = false }: { large?: boolean }) {
  return (
    <div className={cx("flex flex-col", large ? "gap-5.5" : "gap-2")}>
      <CombMark
        className={cx("text-brand", large ? "h-11 w-13" : "h-8 w-9.5")}
      />
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
