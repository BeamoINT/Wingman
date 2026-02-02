/**
 * Community Guidelines
 * Standards for the Wingman community by Beamo LLC
 */

import type { LegalDocument } from './types';
import { COMPANY_INFO } from './types';

export const COMMUNITY_GUIDELINES: LegalDocument = {
  id: 'community-guidelines',
  title: 'Community Guidelines',
  shortTitle: 'Guidelines',
  lastUpdated: '2026-02-01',
  version: '1.0',
  effectiveDate: '2026-02-01',
  sections: [
    {
      id: 'introduction',
      title: '1. Our Community Values',
      content: `${COMPANY_INFO.appName} is built on the foundation of creating meaningful, platonic connections in a safe and respectful environment. These Community Guidelines outline the standards we expect from all members of our community.

Our core values:
- RESPECT: Treat everyone with dignity and courtesy
- SAFETY: Prioritize your safety and the safety of others
- HONESTY: Be truthful in all interactions
- INCLUSIVITY: Welcome diversity and reject discrimination
- PROFESSIONALISM: Maintain appropriate boundaries

These guidelines apply to all users, including Clients, Companions, and any other participants on our platform.`,
    },
    {
      id: 'respectful-behavior',
      title: '2. Respectful Behavior',
      content: `2.1 TREAT OTHERS WITH RESPECT
- Be courteous and professional in all interactions
- Listen actively and engage thoughtfully
- Respect others' time, boundaries, and preferences
- Use appropriate language and tone

2.2 COMMUNICATION STANDARDS
- Be clear and honest in your communications
- Respond to messages in a timely manner
- Avoid aggressive, passive-aggressive, or manipulative language
- Keep conversations on-platform until a booking is confirmed

2.3 FEEDBACK AND REVIEWS
- Provide honest, fair, and constructive feedback
- Base reviews on actual experiences
- Avoid personal attacks or defamatory statements
- Do not offer incentives for positive reviews or threaten negative reviews`,
    },
    {
      id: 'anti-discrimination',
      title: '3. Anti-Discrimination Policy',
      content: `${COMPANY_INFO.appName} is committed to providing an inclusive platform free from discrimination.

3.1 PROTECTED CHARACTERISTICS
You may not discriminate against any user based on:
- Race, ethnicity, or national origin
- Color
- Religion or belief
- Sex or gender
- Gender identity or expression
- Sexual orientation
- Age
- Disability or medical condition
- Genetic information
- Marital or family status
- Veteran or military status
- Citizenship or immigration status
- Any other protected characteristic under applicable law

3.2 WHAT CONSTITUTES DISCRIMINATION
Discrimination includes but is not limited to:
- Refusing service based on protected characteristics
- Making derogatory comments about protected groups
- Using slurs or hate speech
- Providing inferior service based on protected characteristics
- Harassment based on protected characteristics

3.3 COMPANION PREFERENCES
While Companions may set general preferences (such as activity types or availability), preferences that effectively discriminate against protected groups are prohibited.

3.4 ACCESSIBILITY
We support users with accessibility needs and expect Companions to make reasonable accommodations when possible.`,
    },
    {
      id: 'safety-guidelines',
      title: '4. Safety Guidelines',
      content: `4.1 PERSONAL SAFETY
- Meet in public places, especially for first-time bookings
- Inform someone you trust about your whereabouts
- Use the in-app safety features (emergency contacts, check-ins)
- Trust your instincts - if something feels wrong, leave
- Do not share personal information (home address, financial info) prematurely

4.2 BOOKING SAFETY
- Keep all booking arrangements on the platform
- Do not share login credentials
- Report suspicious activity immediately
- Verify companion/client identity through the app
- Use verified payment methods only

4.3 PHYSICAL SAFETY
- Never engage in activities that make you feel unsafe
- Respect physical boundaries at all times
- Report any physical threats or harm immediately
- Contact emergency services (911) if in immediate danger

4.4 REPORTING SAFETY CONCERNS
- Use the in-app reporting feature for safety concerns
- Contact support at ${COMPANY_INFO.supportEmail}
- For emergencies, contact local emergency services first`,
    },
    {
      id: 'content-standards',
      title: '5. Content Standards',
      content: `5.1 PROFILE CONTENT
Your profile must:
- Use a clear, recent photo of yourself
- Provide accurate information about yourself
- Not contain explicit, suggestive, or inappropriate images
- Not include contact information that bypasses the platform
- Not contain advertisements for external services

5.2 MESSAGES AND COMMUNICATIONS
Messages must not contain:
- Sexually explicit content or solicitations
- Threats or harassment
- Spam or commercial solicitations
- Requests for off-platform payment
- Personal contact information until booking is confirmed
- Content that violates these guidelines

5.3 REVIEWS
Reviews must:
- Be based on actual booking experiences
- Be honest and fair
- Focus on the experience, not personal attacks
- Not contain explicit content
- Not be exchanged for compensation

5.4 PROHIBITED CONTENT
The following content is strictly prohibited:
- Child exploitation material (immediate account termination and law enforcement referral)
- Non-consensual intimate images
- Violent or graphic content
- Hate speech or symbols
- Misinformation that could cause harm
- Impersonation of others
- Intellectual property violations`,
    },
    {
      id: 'prohibited-activities',
      title: '6. Prohibited Activities',
      content: `The following activities are strictly prohibited on ${COMPANY_INFO.appName}:

6.1 ILLEGAL ACTIVITIES
- Any illegal activity under local, state, or federal law
- Drug use, sale, or distribution
- Prostitution or sexual services
- Human trafficking
- Money laundering
- Fraud or theft

6.2 PLATFORM ABUSE
- Creating fake accounts or profiles
- Using automated systems or bots
- Circumventing platform payments
- Manipulating reviews or ratings
- Data scraping or unauthorized access
- Impersonating ${COMPANY_INFO.appName} staff
- Interfering with platform operations

6.3 HARMFUL BEHAVIOR
- Harassment, stalking, or bullying
- Threats of violence
- Doxxing (sharing private information)
- Extortion or blackmail
- Deliberate exposure to illness
- Intoxication that impairs judgment or safety

6.4 FINANCIAL MISCONDUCT
- Requesting payment outside the platform
- Charging for services not rendered
- Fraudulent refund claims
- Using stolen payment methods

6.5 SERVICE VIOLATIONS
- No-shows without proper cancellation
- Repeated last-minute cancellations
- Misrepresenting services or qualifications
- Recording others without consent`,
    },
    {
      id: 'reporting',
      title: '7. Reporting Violations',
      content: `7.1 HOW TO REPORT
If you witness or experience a violation of these guidelines:

a) In-App Reporting
- Tap the report button on any profile, message, or booking
- Select the type of violation
- Provide details about the incident
- Submit any relevant evidence (screenshots, etc.)

b) Email Reporting
- Send details to ${COMPANY_INFO.supportEmail}
- Include: your account info, the other party's info, description of the incident, any evidence

c) Emergency Situations
- Contact local emergency services (911) immediately
- Then report the incident to us

7.2 WHAT HAPPENS WHEN YOU REPORT
- All reports are reviewed by our Trust & Safety team
- We investigate reports thoroughly and fairly
- Both parties may be contacted for additional information
- We take appropriate action based on our findings
- The reporter's identity is kept confidential where possible

7.3 FALSE REPORTS
Making false or malicious reports is itself a violation of these guidelines and may result in account action.`,
    },
    {
      id: 'enforcement',
      title: '8. Enforcement and Consequences',
      content: `8.1 ENFORCEMENT ACTIONS
Violations of these guidelines may result in:

a) Warning
- First-time or minor violations
- Educational communication about policies
- Documented in account history

b) Temporary Suspension
- Repeated violations
- Moderate policy breaches
- Pending investigation of serious claims
- Duration varies based on severity

c) Permanent Ban
- Severe violations
- Repeated violations after warnings
- Illegal activity
- Activity threatening user safety

d) Legal Action
- Criminal referral for illegal activities
- Civil action for damages
- Cooperation with law enforcement

8.2 APPEALS
If you believe enforcement action was taken in error:
- Contact ${COMPANY_INFO.supportEmail} within 14 days
- Provide your account information
- Explain why you believe the action was incorrect
- Include any relevant evidence
- Appeals are reviewed by a different team member

8.3 REINSTATEMENT
Permanently banned accounts are generally not reinstated. Temporary suspensions automatically lift after the specified period, unless extended based on new information.`,
    },
    {
      id: 'companion-standards',
      title: '9. Additional Standards for Companions',
      content: `Companions have additional responsibilities as service providers:

9.1 PROFESSIONALISM
- Maintain professional boundaries at all times
- Dress appropriately for booked activities
- Arrive on time and prepared
- Communicate clearly about services offered
- Handle disputes professionally

9.2 ACCURACY
- Ensure profile information is accurate and current
- Only list services you can actually provide
- Keep availability calendar up to date
- Accurately represent your qualifications

9.3 BOUNDARIES
- Maintain strictly platonic interactions
- Do not pursue romantic relationships with clients
- Do not engage in intimate or sexual activities
- Respect client boundaries
- Set and maintain your own boundaries

9.4 CONFIDENTIALITY
- Protect client privacy
- Do not share client information
- Do not discuss clients publicly
- Maintain discretion about bookings`,
    },
    {
      id: 'updates',
      title: '10. Updates to Guidelines',
      content: `We may update these Community Guidelines from time to time. We will notify users of significant changes through the app or by email.

Your continued use of ${COMPANY_INFO.appName} after changes are posted constitutes acceptance of the updated guidelines.

Last Updated: February 1, 2026

For questions about these guidelines, contact:
${COMPANY_INFO.supportEmail}`,
    },
  ],
};
