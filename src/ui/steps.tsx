import { cx } from "./cx";
import { textos } from "./textos";

// Progress bars of a multi-step flow (D-02, D-10 to D-14). The bars are
// decorative; screen readers hear "Paso 1 de 3".
export function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div>
      <p className="sr-only">{textos.ui.paso(current, total)}</p>
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
