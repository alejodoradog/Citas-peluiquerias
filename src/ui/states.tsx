import type { ReactNode } from "react";
import { cx } from "./cx";
import { WarningIcon } from "./icons";
import { textos } from "./textos";

const box =
  "rounded-card border-line flex flex-col items-center gap-2.5 border bg-white p-6 text-center";

// Empty state of F-01: icon, short title, one sentence and one action.
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={box}>
      {icon ? <span className="text-muted flex">{icon}</span> : null}
      <strong className="text-base font-bold">{title}</strong>
      {children ? (
        <p className="text-muted text-sm leading-[1.45]">{children}</p>
      ) : null}
      {action ? <div className="w-full">{action}</div> : null}
    </div>
  );
}

// Loading state of F-01: grey blocks, never a full-screen spinner. Screen
// readers hear the label instead.
export function LoadingState({
  label = textos.ui.cargando,
}: {
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" className={cx(box, "items-stretch")}>
      <span className="sr-only">{label}</span>
      {["w-3/5", "w-[90%]", "w-3/4"].map((width) => (
        <div
          key={width}
          aria-hidden="true"
          className={cx(
            "bg-neutral-soft h-3.5 animate-pulse rounded-[7px] motion-reduce:animate-none",
            width,
          )}
        />
      ))}
    </div>
  );
}

// Error state of F-01, announced at once.
export function ErrorState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className={box}>
      <span className="text-danger flex">
        <WarningIcon size={32} />
      </span>
      <strong className="text-base font-bold">{title}</strong>
      {children ? (
        <p className="text-muted text-sm leading-[1.45]">{children}</p>
      ) : null}
      {action ? <div className="w-full">{action}</div> : null}
    </div>
  );
}
