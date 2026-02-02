/**
 * Acceptable Use Policy
 * Permitted and prohibited uses of Wingman by Beamo LLC
 */

import type { LegalDocument } from './types';
import { COMPANY_INFO } from './types';

export const ACCEPTABLE_USE_POLICY: LegalDocument = {
  id: 'acceptable-use',
  title: 'Acceptable Use Policy',
  shortTitle: 'Acceptable Use',
  lastUpdated: '2026-02-01',
  version: '1.0',
  effectiveDate: '2026-02-01',
  sections: [
    {
      id: 'introduction',
      title: '1. Introduction',
      content: `This Acceptable Use Policy ("AUP") governs your use of the ${COMPANY_INFO.appName} mobile application and related services (the "Service") provided by ${COMPANY_INFO.name} ("Company", "we", "us", "our").

This AUP is incorporated into and forms part of our Terms of Service. By using the Service, you agree to comply with this AUP. Violation of this AUP may result in suspension or termination of your account and may be reported to law enforcement where appropriate.`,
    },
    {
      id: 'permitted-uses',
      title: '2. Permitted Uses',
      content: `The Service is intended for the following lawful purposes:

2.1 FOR CLIENTS
- Finding and booking Companions for platonic social activities
- Communicating with Companions about bookings
- Attending social events with a Companion
- Dining, entertainment, and recreational activities
- Professional networking with Companion support
- Travel companionship
- Emotional support and friendly conversation

2.2 FOR COMPANIONS
- Offering platonic companionship services
- Managing your availability and bookings
- Communicating with potential and current Clients
- Receiving payment for legitimate services
- Building your professional profile

2.3 GENERAL PERMITTED ACTIVITIES
- Creating and maintaining an accurate profile
- Using safety and verification features
- Providing honest reviews and feedback
- Reporting violations and safety concerns
- Contacting customer support`,
    },
    {
      id: 'prohibited-uses',
      title: '3. Prohibited Uses',
      content: `You may NOT use the Service for any of the following purposes:

3.1 ILLEGAL ACTIVITIES
- Any activity that violates local, state, federal, or international law
- Prostitution, escort services involving sexual activity, or sex work
- Drug trafficking or illegal substance distribution
- Money laundering or financial crimes
- Human trafficking or exploitation
- Stalking, harassment, or intimidation
- Theft, fraud, or deception
- Unlicensed professional services requiring licensure

3.2 HARMFUL ACTIVITIES
- Threatening, harassing, or bullying other users
- Discriminating against users based on protected characteristics
- Exposing others to dangerous situations
- Deliberately spreading illness or disease
- Physical violence or threats of violence
- Psychological manipulation or abuse
- Sharing others' personal information without consent (doxxing)
- Recording or photographing others without consent

3.3 PLATFORM ABUSE
- Creating multiple accounts
- Creating fake or misleading profiles
- Impersonating another person or entity
- Using bots or automated systems
- Circumventing security measures
- Attempting to hack or exploit vulnerabilities
- Interfering with platform operations
- Scraping or data mining
- Spamming or unsolicited commercial messages

3.4 CONTENT VIOLATIONS
- Posting sexually explicit content
- Posting violent or graphic content
- Posting content that promotes hate or discrimination
- Posting misleading or fraudulent content
- Violating intellectual property rights
- Posting content involving minors inappropriately

3.5 FINANCIAL ABUSE
- Circumventing the payment system
- Requesting off-platform payments
- Fraudulent refund requests
- Using stolen payment methods
- Price manipulation or bid rigging
- Soliciting tips beyond agreed compensation`,
    },
    {
      id: 'specific-prohibitions',
      title: '4. Specific Prohibitions',
      content: `The following activities are specifically prohibited:

4.1 ROMANTIC OR SEXUAL SOLICITATION
${COMPANY_INFO.appName} is strictly a platonic companionship service. The following are prohibited:
- Soliciting or offering sexual services
- Soliciting or offering romantic relationships
- Using the platform for dating purposes
- Any form of sexual harassment
- Inappropriate physical contact
- Sending sexually suggestive messages

4.2 BOOKING VIOLATIONS
- No-shows without proper cancellation
- Repeated last-minute cancellations
- Booking under false pretenses
- Booking for prohibited activities
- Transferring bookings to third parties

4.3 IDENTITY AND VERIFICATION FRAUD
- Using fake identification documents
- Misrepresenting verification status
- Using someone else's identity
- Creating accounts for banned users

4.4 COMMERCIAL EXPLOITATION
- Using the platform to recruit for other services
- Advertising unrelated businesses
- Recruiting Companions to other platforms
- Multi-level marketing or pyramid schemes
- Soliciting investments`,
    },
    {
      id: 'system-security',
      title: '5. System Security',
      content: `You agree not to:

5.1 UNAUTHORIZED ACCESS
- Access the Service through unauthorized means
- Attempt to access other users' accounts
- Use credentials you are not authorized to use
- Bypass authentication or security measures
- Access non-public areas of our systems

5.2 INTERFERENCE
- Interfere with the proper functioning of the Service
- Overload our infrastructure
- Introduce viruses, malware, or harmful code
- Conduct denial-of-service attacks
- Disrupt other users' experience

5.3 DATA EXTRACTION
- Scrape, mine, or harvest data from the Service
- Use automated tools to collect information
- Copy significant portions of our database
- Extract user data for unauthorized purposes

5.4 REVERSE ENGINEERING
- Decompile, disassemble, or reverse engineer the app
- Attempt to derive source code
- Create derivative works
- Circumvent technological protection measures`,
    },
    {
      id: 'content-standards',
      title: '6. Content Standards',
      content: `All content you submit to the Service must:

6.1 TRUTHFULNESS
- Be accurate and not misleading
- Represent yourself honestly
- Not misrepresent your qualifications
- Not make false claims about services

6.2 APPROPRIATENESS
- Be suitable for a general audience
- Not be sexually explicit
- Not be gratuitously violent
- Not promote illegal activities

6.3 RESPECT
- Not defame, harass, or threaten others
- Not discriminate or promote hatred
- Not invade others' privacy
- Not violate others' rights

6.4 OWNERSHIP
- Be content you have the right to share
- Not violate copyrights or trademarks
- Not infringe on intellectual property
- Not misappropriate trade secrets`,
    },
    {
      id: 'enforcement',
      title: '7. Enforcement',
      content: `7.1 MONITORING
We may monitor use of the Service for compliance with this AUP. However, we do not undertake to monitor all content or activities.

7.2 INVESTIGATION
We may investigate suspected violations of this AUP. During investigation, we may:
- Suspend your access to the Service
- Request additional information
- Preserve relevant evidence
- Cooperate with law enforcement

7.3 ACTIONS WE MAY TAKE
If we determine you have violated this AUP, we may:
- Issue a warning
- Remove offending content
- Suspend your account temporarily
- Terminate your account permanently
- Report illegal activities to law enforcement
- Pursue legal remedies

7.4 NO REFUNDS
If your account is terminated for AUP violations:
- You will not receive a refund for any fees paid
- Any outstanding payments to you may be withheld
- You may be responsible for damages

7.5 APPEALS
You may appeal enforcement actions by contacting ${COMPANY_INFO.supportEmail}. Appeals will be reviewed by a different team member.`,
    },
    {
      id: 'reporting',
      title: '8. Reporting Violations',
      content: `If you become aware of any violation of this AUP, please report it immediately:

8.1 IN-APP REPORTING
- Use the report button on profiles, messages, or bookings
- Provide as much detail as possible
- Include evidence if available

8.2 EMAIL REPORTING
- Send reports to ${COMPANY_INFO.supportEmail}
- Include your account information
- Describe the violation in detail
- Attach any relevant evidence

8.3 EMERGENCY SITUATIONS
- For immediate safety concerns, contact local emergency services (911)
- Then report to us for platform action

8.4 CONFIDENTIALITY
We will keep your identity confidential to the extent possible. We may be required to disclose information in legal proceedings.`,
    },
    {
      id: 'updates',
      title: '9. Updates to This Policy',
      content: `We may update this AUP from time to time. We will notify you of material changes by:
- Posting the updated policy in the app
- Sending an email notification
- Displaying a notice in the app

Your continued use of the Service after changes are posted constitutes acceptance of the updated AUP.

Last Updated: February 1, 2026`,
    },
    {
      id: 'contact',
      title: '10. Contact Information',
      content: `For questions about this Acceptable Use Policy:

${COMPANY_INFO.name}
${COMPANY_INFO.address}

Email: ${COMPANY_INFO.email}
Support: ${COMPANY_INFO.supportEmail}
Website: ${COMPANY_INFO.website}`,
    },
  ],
};
