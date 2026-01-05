// next/components/AnalyticsPageTracker.tsx

"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "../utility/analytics";
import { AnalyticsEvent, AnalyticsCategory } from "../utility/analytics-events";

export default function AnalyticsPageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      trackEvent({
        event: AnalyticsEvent.NAVIGATION,
        category: AnalyticsCategory.NAVIGATION,
        label: pathname,
        page_path: pathname,
        page_search: searchParams?.toString() || "",
      });
    }
  }, [pathname, searchParams]);

  return null;
}
