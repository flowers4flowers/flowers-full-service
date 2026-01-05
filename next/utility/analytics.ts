// next/utility/analytics.ts

import { sendGAEvent } from "@next/third-parties/google";
import {
  AnalyticsEvent,
  AnalyticsCategory,
  AnalyticsEventParams,
} from "./analytics-events";

export const trackEvent = ({
  event,
  category,
  label,
  value,
  ...rest
}: AnalyticsEventParams) => {
  if (typeof window === "undefined") return;

  try {
    sendGAEvent("event", event, {
      event_category: category,
      event_label: label,
      value,
      ...rest,
    });
  } catch (error) {
    console.error("Analytics tracking error:", error);
  }
};

// Convenience functions for common events
export const trackButtonClick = (
  label: string,
  additionalParams?: Record<string, any>
) => {
  trackEvent({
    event: AnalyticsEvent.BUTTON_CLICK,
    category: AnalyticsCategory.ENGAGEMENT,
    label,
    ...additionalParams,
  });
};

export const trackLinkClick = (label: string, href: string, additionalParams?: Record<string, any>) => {
  trackEvent({
    event: AnalyticsEvent.LINK_CLICK,
    category: AnalyticsCategory.NAVIGATION,
    label,
    destination: href,
    ...additionalParams,
  });
};

export const trackSocialClick = (platform: string) => {
  trackEvent({
    event: AnalyticsEvent.SOCIAL_LINK,
    category: AnalyticsCategory.SOCIAL,
    label: platform,
  });
};

export const trackVideoPlay = (
  label: string,
  additionalParams?: Record<string, any>
) => {
  trackEvent({
    event: AnalyticsEvent.VIDEO_PLAY,
    category: AnalyticsCategory.ENGAGEMENT,
    label,
    ...additionalParams,
  });
};
