"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LIVE_REFRESH_MS } from "@/modulos/agenda/dominio/live-agenda";

// Task 4.5: the agenda of today asks the server again every minute while the
// tab is visible, and right away when the owner comes back to it (decision
// 0007, point 13). router.refresh() renders the server part again and keeps
// what the browser holds: an open sheet, the scroll, the focus. It draws
// nothing.
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => {
        if (document.visibilityState === "visible") router.refresh();
      }, LIVE_REFRESH_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      // The next one a whole minute after this one.
      start();
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}
