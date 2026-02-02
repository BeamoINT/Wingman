/**
 * Companion Service Agreement
 * Agreement for Companions (service providers) on Wingman by Beamo LLC
 */

import type { LegalDocument } from './types';
import { COMPANY_INFO } from './types';

export const COMPANION_AGREEMENT: LegalDocument = {
  id: 'companion-agreement' as any,
  title: 'Companion Service Agreement',
  shortTitle: 'Companion Terms',
  lastUpdated: '2026-02-01',
  version: '1.0',
  effectiveDate: '2026-02-01',
  sections: [
    {
      id: 'introduction',
      title: '1. Introduction',
      content: `This Companion Service Agreement ("Agreement") is a legally binding contract between you ("Companion", "you", "your") and ${COMPANY_INFO.name} ("Company", "we", "us", "our") governing your use of the ${COMPANY_INFO.appName} platform as a service provider.

By registering as a Companion on ${COMPANY_INFO.appName}, you agree to be bound by this Agreement, our Terms of Service, Privacy Policy, Community Guidelines, and all other applicable policies.

This Agreement supplements and does not replace our general Terms of Service. In case of conflict, this Agreement takes precedence for Companion-specific matters.`,
    },
    {
      id: 'independent-contractor',
      title: '2. Independent Contractor Status',
      content: `2.1 INDEPENDENT CONTRACTOR RELATIONSHIP
You are an independent contractor and NOT an employee, partner, agent, or joint venturer of ${COMPANY_INFO.name}. This Agreement does not create an employment relationship.

2.2 WHAT THIS MEANS
As an independent contractor:
- You control how and when you provide services
- You are responsible for your own taxes and benefits
- You are not entitled to employee benefits
- You may work for other platforms or businesses
- You set your own rates (subject to platform guidelines)
- You determine your own availability

2.3 NO EMPLOYEE BENEFITS
You are not entitled to:
- Health insurance
- Retirement benefits
- Workers' compensation
- Unemployment insurance
- Paid time off
- Any other employee benefits

2.4 TAX OBLIGATIONS
You are solely responsible for:
- Paying all applicable taxes (federal, state, local)
- Filing required tax returns
- Self-employment taxes
- Obtaining any required business licenses
- Compliance with tax laws in your jurisdiction

We may issue tax forms (such as 1099-NEC) as required by law.`,
    },
    {
      id: 'services',
      title: '3. Services and Conduct',
      content: `3.1 PERMITTED SERVICES
${COMPANY_INFO.appName} is a PLATONIC COMPANIONSHIP platform. You may provide:
- Social event companionship
- Dining companionship
- Entertainment companionship (movies, concerts, etc.)
- Professional networking support
- Travel companionship
- Emotional support and friendly conversation
- Fitness/workout companionship
- Safety companionship

3.2 STRICTLY PROHIBITED SERVICES
You may NOT provide or offer:
- Sexual or intimate services of any kind
- Romantic or dating services
- Escort services involving intimate activities
- Any illegal services
- Services that violate our Community Guidelines

VIOLATION OF THESE RESTRICTIONS WILL RESULT IN IMMEDIATE TERMINATION AND MAY BE REPORTED TO LAW ENFORCEMENT.

3.3 PROFESSIONAL STANDARDS
You must:
- Maintain professional boundaries at all times
- Treat all Clients with respect
- Arrive on time for confirmed bookings
- Provide services as described in your profile
- Dress appropriately for the occasion
- Remain sober and alert during bookings
- Maintain confidentiality about Clients`,
    },
    {
      id: 'booking-obligations',
      title: '4. Booking Obligations',
      content: `4.1 ACCEPTING BOOKINGS
When you accept a booking, you agree to:
- Provide the service at the agreed time and location
- Communicate promptly with the Client
- Fulfill all terms of the booking

4.2 CANCELLATION POLICY
- Avoid cancellations whenever possible
- Cancel at least 12 hours in advance when necessary
- Provide a valid reason for cancellation
- Repeated cancellations may result in account restrictions

4.3 NO-SHOWS
Failing to appear for a confirmed booking without proper cancellation will result in:
- First offense: Warning
- Second offense: 24-hour suspension
- Third offense: 7-day suspension
- Continued violations: Permanent removal

4.4 BOOKING DISPUTES
If a dispute arises:
- Remain professional
- Document the situation
- Report the issue through the app
- Cooperate with our investigation`,
    },
    {
      id: 'payments',
      title: '5. Payments and Compensation',
      content: `5.1 RATE SETTING
You set your own hourly rate, subject to:
- Minimum rate of $25/hour
- Maximum rate of $500/hour
- Rates must be clearly displayed on your profile

5.2 PLATFORM FEE
${COMPANY_INFO.name} charges a platform fee on each completed booking:
- Standard rate: 10% of booking total
- You receive 90% of the booking amount paid by Clients
- This fee covers platform operation, payment processing, support, and insurance

5.3 PAYMENT SCHEDULE
- Payments are released 24-48 hours after booking completion
- Payments are made to your designated payment method
- Minimum withdrawal: $25
- Direct deposit: 1-3 business days
- Instant transfer (if available): Same day (additional fee may apply)

5.4 PAYMENT HOLDS
Payments may be held if:
- A dispute is filed
- Suspicious activity is detected
- Your account is under review
- Required tax information is not on file

5.5 TAXES
All compensation is reported to tax authorities as required. You will receive applicable tax forms by January 31 for the prior tax year.`,
    },
    {
      id: 'profile-requirements',
      title: '6. Profile Requirements',
      content: `6.1 REQUIRED INFORMATION
Your profile must include:
- Real, accurate name
- Recent, clear photos of yourself
- Accurate description of services offered
- Honest representation of skills and experience
- Current availability

6.2 PROHIBITED CONTENT
Your profile may NOT include:
- Sexually suggestive photos or content
- False or misleading information
- Contact information to circumvent the platform
- Offers for prohibited services
- Discriminatory statements
- Content that violates our Community Guidelines

6.3 PHOTOS
- Use clear, recent photos showing your face
- No nudity or sexually suggestive images
- No photos of other people (unless consented)
- No edited photos that misrepresent your appearance

6.4 PROFILE REVIEW
We reserve the right to:
- Review and approve your profile
- Request changes to your profile
- Remove content that violates policies
- Suspend profiles pending review`,
    },
    {
      id: 'verification',
      title: '7. Verification Requirements',
      content: `7.1 REQUIRED VERIFICATIONS
Companions must complete:
- Email verification
- Phone verification
- ID verification (government-issued ID)

7.2 VERIFICATION BENEFITS
Higher verification levels provide:
- Increased visibility in search results
- Trust badges on your profile
- Access to premium features
- Higher booking potential

7.3 MAINTAINING VERIFICATION
- Keep your verification current
- Update documents as required
- Report any changes to your identity documents
- Re-verify as requested`,
    },
    {
      id: 'safety',
      title: '8. Safety and Security',
      content: `8.1 SAFETY GUIDELINES
For your safety:
- Meet Clients in public places initially
- Inform someone you trust of your whereabouts
- Use the in-app safety features
- Trust your instincts
- Leave any situation that feels unsafe

8.2 REPORTING REQUIREMENTS
You must report:
- Any safety concerns
- Inappropriate Client behavior
- Requests for prohibited services
- Any illegal activity

8.3 EMERGENCY SITUATIONS
In an emergency:
1. Call 911 or local emergency services
2. Get to a safe location
3. Use the app's SOS feature
4. Report the incident to us

8.4 INSURANCE
You are responsible for:
- Your own health insurance
- Liability insurance (recommended)
- Any other insurance you deem necessary

${COMPANY_INFO.name} is not liable for injuries or damages occurring during bookings.`,
    },
    {
      id: 'confidentiality',
      title: '9. Confidentiality',
      content: `9.1 CLIENT CONFIDENTIALITY
You must maintain confidentiality regarding:
- Client identities
- Client personal information
- Details of bookings
- Any private information shared

9.2 SOCIAL MEDIA
You may NOT:
- Post about specific Clients without consent
- Share Client photos without consent
- Identify Clients in any public forum
- Discuss Client details online

9.3 EXCEPTIONS
Confidentiality does not apply to:
- Reports to law enforcement
- Legal proceedings
- Reports of safety concerns to ${COMPANY_INFO.name}`,
    },
    {
      id: 'intellectual-property',
      title: '10. Intellectual Property',
      content: `10.1 YOUR CONTENT
You retain ownership of content you create (photos, profile text, etc.). By posting, you grant us a license as described in our Terms of Service.

10.2 OUR INTELLECTUAL PROPERTY
${COMPANY_INFO.appName}, logos, and related marks are our property. You may not use them without permission.

10.3 RESTRICTIONS
You may NOT:
- Claim affiliation with ${COMPANY_INFO.name} as an employee
- Use our branding in personal marketing
- Create materials that imply endorsement`,
    },
    {
      id: 'termination',
      title: '11. Termination',
      content: `11.1 TERMINATION BY YOU
You may terminate this Agreement by:
- Deactivating your Companion account
- Contacting support to close your account
- Ceasing to use the platform

11.2 TERMINATION BY US
We may terminate this Agreement:
- For violation of policies
- For illegal activity
- For safety concerns
- At our discretion with notice

11.3 EFFECT OF TERMINATION
Upon termination:
- Complete any pending bookings or cancel appropriately
- Outstanding payments will be processed
- Your profile will be deactivated
- Certain obligations survive (confidentiality, indemnification)

11.4 PENDING PAYMENTS
After termination, remaining balance will be paid out within 30 days, less any amounts owed to us or held for disputes.`,
    },
    {
      id: 'off-platform-activities',
      title: '12. Off-Platform Activities Disclaimer',
      content: `CRITICAL DISCLAIMER FOR COMPANIONS - PLEASE READ CAREFULLY

12.1 PLATFORM ROLE
${COMPANY_INFO.name} provides ONLY the technology platform that facilitates initial connections between you and Clients. Our involvement is LIMITED to:
- The digital application and its features
- Processing bookings and payments
- In-app messaging and communication
- Optional safety features within the app

12.2 OFF-PLATFORM - NO COMPANY INVOLVEMENT
${COMPANY_INFO.name.toUpperCase()} HAS NO RESPONSIBILITY, LIABILITY, OR INVOLVEMENT IN:
- Your in-person meetings with Clients
- The services you provide during bookings
- Your conduct during off-platform interactions
- Any incidents, injuries, or events during bookings
- Locations where you meet Clients
- Transportation to or from bookings
- Any activities outside the application
- Any harm you may experience or cause

12.3 YOU ARE SOLELY RESPONSIBLE
As an independent contractor, YOU are fully and solely responsible for:
- Your own safety during bookings
- Your conduct and behavior
- The services you choose to provide
- Any harm resulting from your actions
- Any incidents during bookings
- Your interactions with Clients off-platform
- Compliance with all applicable laws
- Your personal and liability insurance

12.4 NO EMPLOYMENT OR AGENCY
Because you are NOT an employee or agent of ${COMPANY_INFO.name}:
- We do not supervise your work
- We do not control how you provide services
- We are not responsible for your actions
- We are not liable for incidents during your bookings
- You cannot represent that we are responsible for your conduct

12.5 WAIVER AND RELEASE
YOU HEREBY WAIVE AND RELEASE ${COMPANY_INFO.name.toUpperCase()} FROM ALL CLAIMS ARISING FROM:
- Your off-platform activities and bookings
- Any harm you experience during bookings
- Any actions of Clients
- Any incidents at meeting locations
- Any events occurring outside the application`,
    },
    {
      id: 'liability',
      title: '13. Limitation of Liability',
      content: `13.1 YOUR LIABILITY
You are solely responsible for:
- Your conduct during bookings
- Services you provide
- Your compliance with laws
- Any harm caused by your actions
- Your tax obligations
- All off-platform activities and interactions
- Your own safety and wellbeing

13.2 OUR LIABILITY
${COMPANY_INFO.name} is NOT liable for:
- Actions of Clients or other users
- Injuries during bookings
- Lost income or opportunities
- Damages arising from your use of the platform
- ANY off-platform activities, meetings, or interactions
- Any harm occurring during in-person bookings
- Any events at meeting locations
- Any incidents involving Clients

13.3 INDEMNIFICATION
You agree to indemnify and hold harmless ${COMPANY_INFO.name} against any and all claims arising from:
- Your services and conduct
- Your violation of this Agreement
- Your violation of laws
- Your interactions with Clients
- All off-platform activities and meetings
- Any harm caused during your bookings
- Any claims by Clients against you`,
    },
    {
      id: 'disputes',
      title: '14. Dispute Resolution',
      content: `13.1 INTERNAL RESOLUTION
We will attempt to resolve disputes informally first. Contact us at ${COMPANY_INFO.supportEmail}.

13.2 ARBITRATION
Disputes not resolved informally will be resolved through binding arbitration as described in our Terms of Service.

13.3 CLASS ACTION WAIVER
You waive the right to participate in class actions against ${COMPANY_INFO.name}.`,
    },
    {
      id: 'acknowledgment',
      title: '15. Acknowledgment',
      content: `BY REGISTERING AS A COMPANION, YOU ACKNOWLEDGE THAT:

a) You have read and understand this Agreement;
b) You are at least 18 years of age;
c) You are an independent contractor, not an employee;
d) You are solely responsible for your tax obligations;
e) You will comply with all applicable laws;
f) You will follow all platform policies;
g) You understand the services permitted and prohibited;
h) You accept the compensation structure and fees;
i) You will maintain professional standards;
j) You understand the consequences of violations;
k) ${COMPANY_INFO.name} has NO responsibility for off-platform activities;
l) You are solely responsible for your safety during bookings;
m) You waive all claims against ${COMPANY_INFO.name} for off-platform incidents;
n) You understand that meetings with Clients are entirely at your own risk.`,
    },
    {
      id: 'contact',
      title: '16. Contact Information',
      content: `For questions about this Agreement or Companion policies:

${COMPANY_INFO.name}
${COMPANY_INFO.address}

Companion Support: companions@beamollc.com
General Support: ${COMPANY_INFO.supportEmail}
Legal: ${COMPANY_INFO.email}
Website: ${COMPANY_INFO.website}`,
    },
  ],
};
