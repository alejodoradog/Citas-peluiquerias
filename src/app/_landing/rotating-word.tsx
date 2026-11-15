"use client";

import { useEffect, useState } from "react";

// The business of the landing's title, turning every 2.6 s. Screen readers
// hear the whole title from the h1, never this word.
export function RotatingWord({ words }: { words: readonly string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % words.length),
      2600,
    );
    return () => clearInterval(timer);
  }, [words.length]);

  return (
    <span className="yl-word text-brand">
      {words.map((word, i) => (
        <span key={word} className={i === index ? "yl-on" : undefined}>
          {word}
        </span>
      ))}
    </span>
  );
}
