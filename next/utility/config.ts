/**
 * Application configuration
 * 
 * excludedParticipants: Email domains and addresses to exclude from deal participants
 * - domains: Must include '@' symbol (e.g., '@fullservice.art')
 * - emails: Full email addresses (e.g., 'noreply@example.com')
 */

export const config = {
  excludedParticipants: {
    domains: [
      '@fullservice.art'
    ],
    emails: [
      // Individual emails can be added here
      // Example: 'noreply@example.com'
    ]
  }
};