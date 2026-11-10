import type { ReactNode } from "react";
import { cx } from "./cx";
import { CircleCheckIcon, ClockIcon, InfoIcon, WarningIcon } from "./icons";

export type NoticeTone = "info" | "success" | "warning" | "danger";

const tones: Record<
  NoticeTone,
  { box: string; accent: string; icon: ReactNode }
> = {
  info: {
    box: "bg-brand-soft",
    accent: "text-brand-strong",
    icon: <InfoIcon />,
  },
  success: {
    box: "bg-success-soft",
    accent: "text-success",
    icon: <CircleCheckIcon />,
  },
  warning: {
    box: "bg-warning-soft",
    accent: "text-warning",
    icon: <ClockIcon />,
  },
  danger: {
    box: "bg-danger-soft",
    accent: "text-danger",
    icon: <WarningIcon />,
  },
};

// Notice of F-01: a tinted box with an icon, a bold title in the tone's color,
// an optional line of detail and an optional action. A danger notice is
// announced at once (role alert); the others wait their turn (role status).
export function Notice({
  tone,
  title,
  children,
  action,
  icon,
}: {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  const style = tones[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx(
        "rounded-button flex items-start gap-2.5 px-3.5 py-3",
        style.box,
      )}
    >
      <span className={cx("flex pt-px", style.accent)}>
        {icon ?? style.icon}
      </span>
      <div className="flex flex-col gap-1">
        <strong className={cx("text-label font-bold", style.accent)}>
          {title}
        </strong>
        {children ? (
          <span className="text-help text-ink">{children}</span>
        ) : null}
        {action ? (
          <span className={cx("text-label font-bold", style.accent)}>
            {action}
          </span>
        ) : null}
      </div>
    </div>
  );
}
