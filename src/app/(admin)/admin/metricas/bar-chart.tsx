"use client";

import { useState } from "react";
import { cx } from "@/ui/cx";
import { textos } from "@/ui/textos";

const t = textos.plataforma.metricas;

export type Bar = {
  key: string;
  // The bar's height, from 0 to 1 of the tallest (chartBars).
  share: number;
  // Under the bar ("9 nov"); empty to leave room.
  tick: string;
  // In the table and the reading ("Semana del 9 nov").
  period: string;
  // "8 registros", "$345.000".
  value: string;
};

// One series as bars from zero (task 7.12), in the brand color. Pointing at a
// bar, or touching it, reads its value above the chart; the last one is read
// first. The same numbers are a table: hidden from sight while the chart
// shows, always there for screen readers, and in sight with "Ver tabla".
export function BarChart({
  title,
  subtitle,
  periodHead,
  valueHead,
  bars,
}: {
  title: string;
  subtitle: string;
  periodHead: string;
  valueHead: string;
  bars: Bar[];
}) {
  const [active, setActive] = useState(bars.length - 1);
  const [asTable, setAsTable] = useState(false);
  const shown = bars[active];

  return (
    <section
      aria-label={title}
      className="border-line flex min-w-0 flex-col gap-3 rounded-2xl border bg-white p-4 lg:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-base font-bold lg:text-lg">{title}</h2>
          <p className="text-muted text-[13px]">{subtitle}</p>
        </div>
        <button
          type="button"
          aria-pressed={asTable}
          onClick={() => setAsTable(!asTable)}
          className="border-line text-ink min-h-11 rounded-xl border bg-white px-3.5 text-[13px] font-semibold"
        >
          {asTable ? t.verGrafico : t.verTabla}
        </button>
      </div>

      {asTable ? null : (
        <div aria-hidden="true" className="flex flex-col gap-1.5">
          <p className="min-h-5.5 text-[15px]">
            {shown ? (
              <>
                <b className="tabular-nums">{shown.value}</b>{" "}
                <span className="text-muted">· {shown.period}</span>
              </>
            ) : null}
          </p>
          <div
            className="border-line-strong flex h-48 items-end gap-0.5 border-b bg-[linear-gradient(var(--color-neutral-soft)_1px,transparent_1px)] bg-[length:100%_48px]"
            onPointerLeave={() => setActive(bars.length - 1)}
          >
            {bars.map((bar, i) => (
              <div
                key={bar.key}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
                className="flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center"
              >
                <span
                  className={cx(
                    "block w-[72%] max-w-10 rounded-t",
                    i === active ? "bg-brand-strong" : "bg-brand",
                  )}
                  style={{
                    height: `${bar.share * 100}%`,
                    minHeight: bar.share > 0 ? 3 : 0,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="text-muted flex gap-0.5 text-[11px]">
            {bars.map((bar) => (
              <span
                key={bar.key}
                className="min-w-0 flex-1 overflow-hidden text-center whitespace-nowrap"
              >
                {bar.tick}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        className={
          asTable ? "border-neutral-soft rounded-xl border" : "sr-only"
        }
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-muted text-left">
              <th scope="col" className="px-3 py-2 font-semibold">
                {periodHead}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                {valueHead}
              </th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.key} className="border-neutral-soft border-t">
                <td className="px-3 py-2">{bar.period}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {bar.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
