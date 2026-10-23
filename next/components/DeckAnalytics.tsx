// next/components/DeckAnalytics.tsx

"use client";

import { useEffect, useRef } from "react";
import { getGAClientId } from "../utility/analytics";
import { claritySet, clarityIdentify } from "../utility/clarity";
import { useDeckAnalytics, DeckDescriptor } from "../utility/useDeckAnalytics";

const CLIENT_ID_TIMEOUT_MS = 2000;

export default function DeckAnalytics({ token, title, client, type }: DeckDescriptor) {
  const { trackDeckView } = useDeckAnalytics({ token, title, client, type });
  const viewSentRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tags: [string, string][] = [
      ["deck_token", token],
      ["deck_title", title],
      ["deck_client", client],
      ["deck_type", type],
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
  }, [token, title, client, type, trackDeckView]);

  return null;
}
