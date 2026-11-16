"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cx } from "@/ui/cx";
import { BOOKING_STORY, CHARACTERS } from "./home-scenes";

// Every scene lasts this long, the word of the title turning with it.
const SCENE_MS = 3800;

// The home page's title and its scenes (approved by the partner, 2026-11-15).
// One word of the title turns with each kind of business while its character
// acts below; the booking story closes the round. Screen readers hear the
// whole title once, never the turning word. The children (the line under the
// title) sit between the title and the scenes.
export function HomeHero({
  title,
  start,
  end,
  words,
  children,
}: {
  // What screen readers hear.
  title: string;
  // "A tu" … "le llegan las citas solas", around the word that turns.
  start: string;
  end: string;
  // One word per scene: the characters, in order, then the booking story.
  words: readonly string[];
  children?: ReactNode;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % words.length),
      SCENE_MS,
    );
    return () => clearInterval(timer);
  }, [words.length]);

  return (
    <>
      <h1 className="text-[1.75rem] leading-[1.12] font-bold text-balance">
        <span className="sr-only">{title}</span>
        <span aria-hidden="true">
          {start}{" "}
          <span className="yp-word">
            {words.map((word, i) => (
              <span key={word} className={i === index ? "yp-on" : undefined}>
                {word}
              </span>
            ))}
          </span>
          <br />
          {end}
        </span>
      </h1>
      {children}
      {/* The scenes take the free height, so the buttons sit at the foot. */}
      <div className="flex flex-1 items-center">
        <div className="yp-scenes" aria-hidden="true">
          {CHARACTERS.map((markup, i) => (
            <div key={i} className={cx("yp-scene", i === index && "yp-on")}>
              <svg
                className="yp-flat"
                viewBox="0 0 120 120"
                // Static markup of this module, never from user input.
                dangerouslySetInnerHTML={{ __html: markup }}
              />
            </div>
          ))}
          <div
            className={cx("yp-scene", index === CHARACTERS.length && "yp-on")}
          >
            <svg
              className="yp-story"
              viewBox="0 0 300 132"
              dangerouslySetInnerHTML={{ __html: BOOKING_STORY }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
