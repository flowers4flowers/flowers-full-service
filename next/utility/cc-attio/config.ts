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
      '@flowersfullservice.art'
    ],
    emails: [
      'd1951a2f382d550d96f0e0a294dafbee@inbound.postmarkapp.com'
    ]
  }
};