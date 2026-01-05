

// next/utility/useAnalytics.ts

'use client'

import { useCallback } from 'react'
import { trackEvent, trackButtonClick, trackLinkClick, trackSocialClick } from '../utility/analytics'
import { AnalyticsEventParams } from '../utility/analytics-events'

export const useAnalytics = () => {
  const track = useCallback((params: AnalyticsEventParams) => {
    trackEvent(params)
  }, [])

  const trackButton = useCallback((label: string, additionalParams?: Record<string, any>) => {
    trackButtonClick(label, additionalParams)
  }, [])

  const trackLink = useCallback((label: string, href: string) => {
    trackLinkClick(label, href)
  }, [])

  const trackSocial = useCallback((platform: string) => {
    trackSocialClick(platform)
  }, [])

  return {
    track,
    trackButton,
    trackLink,
    trackSocial,
  }
}