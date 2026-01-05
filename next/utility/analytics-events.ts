// next/utility/analytics-events.ts

export enum AnalyticsEvent {
  BUTTON_CLICK = "button_click",
  LINK_CLICK = "link_click",
  FORM_SUBMIT = "form_submit",
  NAVIGATION = "navigation",
  SOCIAL_LINK = "social_link_click",
  MENU_TOGGLE = "menu_toggle",
  VIDEO_PLAY = "video_play",
  // I will add more as needed
}

export enum AnalyticsCategory {
  ENGAGEMENT = "engagement",
  NAVIGATION = "navigation",
  CONVERSION = "conversion",
  SOCIAL = "social",
}

export interface AnalyticsEventParams {
  event: AnalyticsEvent;
  category?: AnalyticsCategory;
  label?: string;
  value?: number;
  [key: string]: any;
}
