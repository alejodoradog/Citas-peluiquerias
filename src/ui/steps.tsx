import { cx } from "./cx";
import { textos } from "./textos";

// Progress bars of a multi-step flow (D-02, D-10 to D-14). The bars are
// decorative; screen readers hear "Paso 1 de 3", unless a visible subtitle
// already says it (announce={false}, the top bar of D-10).
export function Steps({
  current,
  total,
  announce = true,
}: {
  current: number;
  total: number;
  announce?: boolean;
}) {
  return (
    <div>
      {announce ? (
        <p className="sr-only">{textos.ui.paso(current, total)}</p>
      ) : null}
      <div
        aria-hidden="true"
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, index) => (
          <div
            key={index}
            className={cx(
              "h-1 rounded-sm",
              index < current ? "bg-brand" : "bg-line",
            )}
          />
        ))}
      </div>
    </div>
  );
}
