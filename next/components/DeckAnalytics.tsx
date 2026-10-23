// next/components/DeckAnalytics.tsx

"use client";

import { useEffect, useRef } from "react";
import { getGAClientId, setGAParams } from "../utility/analytics";
import { claritySet, clarityIdentify } from "../utility/clarity";
import { useDeckAnalytics, DeckDescriptor } from "../utility/useDeckAnalytics";

const CLIENT_ID_TIMEOUT_MS = 2000;

export default function DeckAnalytics({ token, title, client, type, role }: DeckDescriptor) {
  const { trackDeckView } = useDeckAnalytics({ token, title, client, type, role });
  const viewSentRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setGAParams({ viewer_role: role });

    const tags: [string, string][] = [
      ["deck_token", token],
      ["deck_title", title],
      ["deck_client", client],
      ["deck_type", type],
      ["viewer_role", role],
    ];

    tags.forEach(([key, value]) => {
      if (value) {
        claritySet(key, value);
      }
    });

    getGAClientId((clientId) => {
      clarityIdentify(clientId, clientId);

      if (!viewSentRef.current) {
        viewSentRef.current = true;
        trackDeckView(clientId);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      }
    });

    timeoutRef.current = setTimeout(() => {
      if (!viewSentRef.current) {
        viewSentRef.current = true;
        trackDeckView();
      }
    }, CLIENT_ID_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [token, title, client, type, role, trackDeckView]);

  return null;
}
