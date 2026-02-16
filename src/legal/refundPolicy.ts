/**
 * Refund Policy
 * Refund and cancellation policies for Wingman by Beamo LLC
 */

import type { LegalDocument } from './types';
import { COMPANY_INFO } from './types';

export const REFUND_POLICY: LegalDocument = {
  id: 'refund-policy',
  title: 'Refund Policy',
  shortTitle: 'Refunds',
  lastUpdated: '2026-02-01',
  version: '1.0',
  effectiveDate: '2026-02-01',
  sections: [
    {
      id: 'overview',
      title: '1. Overview',
      content: `This Refund Policy explains when and how you can receive refunds for services purchased through ${COMPANY_INFO.appName}. This policy applies to all bookings, subscriptions, and purchases made through our platform.

We strive to be fair to both Clients and Companions while maintaining a reliable and trustworthy marketplace. Please read this policy carefully before making purchases.`,
    },
    {
      id: 'booking-cancellations',
      title: '2. Booking Cancellations',
      content: `2.1 CLIENT CANCELLATION TIERS

a) More than 24 hours before booking:
- Refund: 100% minus $5 processing fee
- Credit back to original payment method
- Processing time: 5-10 business days

b) 12-24 hours before booking:
- Refund: 50% of booking total
- The remaining 50% is paid to the Companion as a cancellation fee
- Processing time: 5-10 business days

c) Less than 12 hours before booking:
- Refund: No refund
- Full amount is paid to the Companion
- This protects Companions who have reserved their time

d) No-show (failure to appear):
- Refund: No refund
- Full amount is paid to the Companion
- Repeated no-shows may result in account suspension

2.2 HOW TO CANCEL
- Navigate to "My Bookings" in the app
- Select the booking you wish to cancel
- Tap "Cancel Booking"
- Confirm your cancellation
- Refund will be processed automatically based on timing

2.3 CANCELLATION CONFIRMATION
You will receive an email confirmation of your cancellation and any applicable refund amount.`,
    },
    {
      id: 'companion-cancellations',
      title: '3. Companion Cancellations',
      content: `3.1 WHEN A COMPANION CANCELS
If a Companion cancels a confirmed booking, the Client receives:
- Full refund of the booking amount (100%)
- Service fee refunded
- Refund processed within 5-10 business days

3.2 COMPANION CONSEQUENCES
Companions who cancel bookings may face:
- First cancellation: Warning
- Second cancellation (within 30 days): 24-hour suspension
- Third cancellation (within 30 days): 7-day suspension
- Continued pattern: Permanent account removal

3.3 EMERGENCY EXCEPTIONS
Companions may cancel without penalty for documented emergencies:
- Medical emergencies
- Family emergencies
- Natural disasters
- Other circumstances beyond their control

Documentation may be required to waive penalties.`,
    },
    {
      id: 'disputes-issues',
      title: '4. Disputes and Service Issues',
      content: `4.1 FILING A DISPUTE
If you are dissatisfied with a completed booking, you may file a dispute within 48 hours of the booking end time. To file a dispute:
- Go to "My Bookings" > Select the booking
- Tap "Report an Issue"
- Select the issue type
- Provide a detailed description
- Submit any supporting evidence

4.2 DISPUTE CATEGORIES
a) No-Show by Companion
- If a Companion fails to appear: Full refund

b) Early Departure
- If a Companion leaves significantly early without cause: Partial refund based on time not provided

c) Service Not as Described
- If the service significantly differs from the profile/agreement: Case-by-case review, potential partial or full refund

d) Safety Concerns
- If you felt unsafe during the booking: Priority review, potential full refund, and investigation

e) Companion Behavior Issues
- Rude, unprofessional, or inappropriate behavior: Case-by-case review

4.3 DISPUTE RESOLUTION PROCESS
1. You submit a dispute with details and evidence
2. We contact the Companion for their response
3. Our Trust & Safety team reviews all information
4. A decision is made within 5-7 business days
5. Both parties are notified of the outcome
6. Refunds (if applicable) are processed

4.4 DISPUTE DECISIONS
Disputes may result in:
- Full refund to Client
- Partial refund to Client
- No refund (dispute not substantiated)
- Credits for future bookings
- Account action against either party`,
    },
    {
      id: 'subscriptions',
      title: '5. Subscription Refunds',
      content: `5.1 SUBSCRIPTION TIERS
We offer one subscription entitlement with two billing options:
- Pro Monthly: $10.00/month
- Pro Yearly: $99.00/year

5.2 INITIAL SUBSCRIPTION REFUND
If you cancel within 48 hours of your FIRST subscription purchase, you may request a full refund. To request:
- Contact ${COMPANY_INFO.supportEmail}
- Include your account email
- Request must be made within 48 hours of purchase

5.3 RENEWAL REFUNDS
Subscription renewals are generally non-refundable. However, we may consider refunds for:
- Technical errors causing duplicate charges
- Unauthorized renewals (with documentation)
- Significant service outages during the billing period

5.4 CANCELLATION
You may cancel your subscription at any time:
- Go to Settings > Subscription
- Tap "Cancel Subscription"
- Your subscription remains active until the end of the current billing period
- No partial refunds for unused time

5.5 PLAN CHANGES
If we introduce additional plans in the future, any upgrade or downgrade terms will be disclosed at that time.`,
    },
    {
      id: 'gift-cards',
      title: '6. Gift Cards',
      content: `6.1 GENERAL POLICY
Gift cards are non-refundable and cannot be exchanged for cash.

6.2 UNUSED GIFT CARDS
- Gift card balances do not expire
- Unused balances remain on your account
- Balances cannot be transferred between accounts

6.3 PURCHASED GIFT CARDS
If you purchase a gift card and it has NOT been redeemed:
- You may cancel within 24 hours of purchase
- Contact ${COMPANY_INFO.supportEmail}
- Refund will be issued to original payment method

If the gift card HAS been redeemed:
- No refund is available
- The recipient has the balance on their account

6.4 RECEIVED GIFT CARDS
Gift cards you receive:
- Are added to your account balance
- Can be used for any booking or subscription
- Cannot be converted to cash
- Cannot be transferred to another user`,
    },
    {
      id: 'processing',
      title: '7. Refund Processing',
      content: `8.1 PROCESSING TIME
Refunds are processed within:
- Credit/Debit Cards: 5-10 business days
- Bank Accounts: 7-14 business days
- Gift Card Credits: Immediate

Note: Your bank or card issuer may take additional time to reflect the refund.

8.2 REFUND METHOD
Refunds are issued to the original payment method. We cannot:
- Refund to a different payment method
- Issue cash refunds
- Issue refunds via wire transfer

8.3 CURRENCY
All refunds are issued in USD. Exchange rate fluctuations are not compensated.

8.4 PARTIAL REFUNDS
Partial refunds may be issued for:
- Service issues affecting part of a booking
- Disputes resolved with compromise
- Early Companion departure

Partial refund amounts are determined at our discretion based on the circumstances.`,
    },
    {
      id: 'non-refundable',
      title: '8. Non-Refundable Items',
      content: `The following are generally not eligible for refunds:

9.1 SERVICE FEES
- Platform service fees are non-refundable except in cases of Companion cancellation or full booking refund

9.2 TIPS
- Tips are non-refundable once sent

9.3 COMPLETED SERVICES
- Services that were provided as described

9.4 POLICY VIOLATIONS
- Accounts terminated for policy violations
- Bookings cancelled due to user misconduct

9.5 OUTSIDE POLICY CLAIMS
- Disputes filed more than 48 hours after booking completion
- Claims not properly documented`,
    },
    {
      id: 'contact',
      title: '9. Contact Us',
      content: `For refund requests or questions about this policy:

${COMPANY_INFO.name}
${COMPANY_INFO.address}

Email: ${COMPANY_INFO.supportEmail}
Website: ${COMPANY_INFO.website}

When contacting us about a refund:
- Include your account email
- Provide the booking or transaction ID
- Describe the issue clearly
- Attach any relevant evidence

We aim to respond to all refund inquiries within 2 business days.`,
    },
  ],
};
