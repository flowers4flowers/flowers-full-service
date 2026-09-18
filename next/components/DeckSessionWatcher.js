// next/components/DeckSessionWatcher.js

"use client";

import { useEffect } from "react";

const POLL_INTERVAL_MS = 30000;

export default function DeckSessionWatcher({ token, children }) {
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/portal/${token}/session-status`);

        if (!res.ok) {
          return;
        }

        const data = await res.json();

        if (data.valid === false) {
          window.location.reload();
        }
      } catch {
        // Network failure is not evidence of an invalid session; retry next tick.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [token]);

  return children;
}
