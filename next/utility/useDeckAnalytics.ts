// next/utility/useDeckAnalytics.ts

"use client";

import { useCallback, useMemo } from "react";
import { trackEvent } from "../utility/analytics";
import { clarityEvent } from "../utility/clarity";
import { AnalyticsEvent, AnalyticsCategory } from "../utility/analytics-events";

export interface DeckDescriptor {
  token: string;
  title: string;
  client: string;
  type: string;
  role: string;
}

export const useDeckAnalytics = ({ token, title, client, type, role }: DeckDescriptor) => {
  const baseParams = useMemo(
    () => ({
      deck_token: token,
      deck_title: title,
      deck_client: client,
      deck_type: type,
      viewer_role: role,
    }),
    [token, title, client, type, role]
  );

  const send = useCallback(
    (event: AnalyticsEvent, params?: Record<string, any>) => {
      trackEvent({
        event,
        category: AnalyticsCategory.PORTAL,
        label: title,
        ...baseParams,
        ...params,
      });
      clarityEvent(event);
    },
    [baseParams, title]
  );

  const trackGateView = useCallback(() => {
    send(AnalyticsEvent.DECK_GATE_VIEW);
  }, [send]);

  const trackUnlock = useCallback(
    (result: string, attemptRole?: string) => {
      send(AnalyticsEvent.DECK_UNLOCK, {
        unlock_result: result,
        ...(attemptRole ? { viewer_role: attemptRole } : {}),
      });
    },
    [send]
  );

  const trackDeckView = useCallback(
    (visitorId?: string) => {
      send(AnalyticsEvent.DECK_VIEW, visitorId ? { visitor_id: visitorId } : undefined);
    },
    [send]
  );

  const trackPageView = useCallback(
    (pageNumber: number, pageCount: number, navSource: string) => {
      send(AnalyticsEvent.DECK_PAGE_VIEW, {
        page_number: pageNumber,
        page_count: pageCount,
        nav_source: navSource,
      });
    },
    [send]
  );

  const trackComplete = useCallback(
    (pageCount: number) => {
      send(AnalyticsEvent.DECK_COMPLETE, { page_count: pageCount });
    },
    [send]
  );

  const trackMenuOpen = useCallback(() => {
    send(AnalyticsEvent.DECK_MENU_OPEN);
  }, [send]);

  return {
    trackGateView,
    trackUnlock,
    trackDeckView,
    trackPageView,
    trackComplete,
    trackMenuOpen,
  };
};
