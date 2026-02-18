/**
 * Privacy Policy
 * GDPR and CCPA compliant privacy policy for Wingman app by Beamo LLC
 */

import type { LegalDocument } from './types';
import { COMPANY_INFO } from './types';

export const PRIVACY_POLICY: LegalDocument = {
  id: 'privacy-policy',
  title: 'Privacy Policy',
  shortTitle: 'Privacy',
  lastUpdated: '2026-02-01',
  version: '1.0',
  effectiveDate: '2026-02-01',
  sections: [
    {
      id: 'introduction',
      title: '1. Introduction',
      content: `${COMPANY_INFO.name} ("Company", "we", "us", "our") operates the ${COMPANY_INFO.appName} mobile application and related services (collectively, the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.

We are committed to protecting your privacy and ensuring you understand how your personal data is handled. This policy is designed to comply with the General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA), and other applicable privacy laws.

By using our Service, you consent to the data practices described in this policy. If you do not agree with our policies and practices, please do not use our Service.

DATA CONTROLLER INFORMATION:

${COMPANY_INFO.name}
${COMPANY_INFO.address}
Email: ${COMPANY_INFO.privacyEmail}`,
    },
    {
      id: 'information-we-collect',
      title: '2. Information We Collect',
      content: `We collect information in several ways when you use our Service:

2.1 INFORMATION YOU PROVIDE DIRECTLY

a) Account Information:
- Full legal name (first and last name)
- Email address
- Password (encrypted)
- Phone number (optional)
- Date of birth
- Gender (optional)
- Profile photo (optional)
- Bio/About section (optional)

b) Profile Information:
- Interests and preferences
- Languages spoken
- Companion specialties (for Companions)
- Hourly rates (for Companions)
- Availability schedule (for Companions)
- Gallery photos

c) Location Information:
- City, state, and country
- Precise location (latitude/longitude) when enabled
- Booking locations and venues

d) Verification Information:
- Government-issued ID for identity verification
- Selfie photos for ID matching
- Phone verification data
- Email verification data

e) Payment Information:
- Payment card details (processed by third-party providers)
- Billing address
- Transaction history

f) Communication Information:
- Messages sent through the platform
- Reviews and ratings
- Customer support communications
- Dispute and report submissions

g) Accessibility Information:
- Accessibility needs and preferences
- Accommodation requirements

h) Safety Audio Recording (Optional):
- Local safety audio recordings created on your device
- Stored only on your device in app-private storage
- Never uploaded to ${COMPANY_INFO.appName} servers
- Automatically deleted from your device after 7 days

2.2 INFORMATION COLLECTED AUTOMATICALLY

a) Device Information:
- Device type and model
- Operating system and version
- Unique device identifiers
- Mobile network information

b) Usage Information:
- App features used
- Time and duration of use
- Search queries
- Booking history
- Interaction patterns

c) Log Information:
- IP address
- Browser type
- Access times
- Pages viewed
- Referral URLs
- Crash reports and error logs

2.3 INFORMATION FROM THIRD PARTIES

a) Payment Processors:
- Transaction confirmation
- Payment verification status
- Fraud detection results

c) Identity Verification Services:
- ID document verification results
- Facial recognition matching results

d) Social Media (if connected):
- Basic profile information
- Profile photo (with your consent)`,
    },
    {
      id: 'legal-basis',
      title: '3. Legal Basis for Processing (GDPR)',
      content: `Under the GDPR, we process your personal data based on the following legal bases:

3.1 CONTRACT PERFORMANCE (Article 6(1)(b))
Processing necessary for the performance of our contract with you, including:
- Account creation and management
- Booking and payment processing
- Service delivery
- Customer support

3.2 LEGITIMATE INTERESTS (Article 6(1)(f))
Processing necessary for our legitimate interests, including:
- Platform security and fraud prevention
- Service improvement and development
- Analytics and performance monitoring
- Marketing communications (with opt-out option)

3.3 CONSENT (Article 6(1)(a))
Processing based on your explicit consent, including:
- Location tracking (when enabled)
- Marketing communications
- Sharing with third parties for promotional purposes

You may withdraw consent at any time without affecting the lawfulness of prior processing.

3.4 LEGAL OBLIGATION (Article 6(1)(c))
Processing necessary to comply with legal obligations, including:
- Tax and financial reporting
- Responding to lawful requests from authorities
- Complying with court orders
- Maintaining required records

3.5 VITAL INTERESTS (Article 6(1)(d))
Processing necessary to protect vital interests, including:
- Emergency safety situations
- Reporting imminent threats

3.6 SPECIAL CATEGORY DATA
For sensitive personal data (such as disability/accessibility information), we rely on:
- Your explicit consent
- Substantial public interest in ensuring accessibility`,
    },
    {
      id: 'how-we-use',
      title: '4. How We Use Your Information',
      content: `We use your information for the following purposes:

4.1 SERVICE PROVISION
- Create and manage your account
- Facilitate bookings between Clients and Companions
- Process payments and transactions
- Provide customer support
- Enable communication between users
- Display profiles and match preferences

4.2 TRUST AND SAFETY
- Verify user identities
- Detect and prevent fraud
- Enforce our Terms of Service
- Investigate policy violations
- Respond to safety concerns
- Protect users from harm

4.3 SERVICE IMPROVEMENT
- Analyze usage patterns
- Improve app features and functionality
- Develop new features
- Conduct research and analytics
- Optimize user experience
- Fix bugs and issues

4.4 COMMUNICATIONS
- Send booking confirmations and updates
- Provide customer support responses
- Send safety alerts and notifications
- Send marketing communications (with consent)
- Send account-related notifications
- Send legal notices and policy updates

4.5 LEGAL COMPLIANCE
- Comply with applicable laws
- Respond to legal requests
- Protect our legal rights
- Maintain required records
- Report suspected illegal activities

4.6 PERSONALIZATION
- Customize app experience
- Provide relevant recommendations
- Display relevant content
- Remember preferences`,
    },
    {
      id: 'data-sharing',
      title: '5. How We Share Your Information',
      content: `We share your information in the following circumstances:

5.1 WITH OTHER USERS
- Profile information visible to potential booking partners
- Reviews and ratings visible to other users
- Messages shared with conversation participants
- Verification badges and status
- Location (during active bookings, if enabled)

5.2 WITH SERVICE PROVIDERS
We share data with third-party service providers who assist us in operating our Service:

a) Supabase, Inc. (Database and Authentication)
- Account and usage data
- Stored on secure cloud infrastructure

c) Payment Processors
- Payment card information
- Billing details
- Transaction information

d) Cloud Hosting Providers
- All data stored on secure servers
- Located in United States

e) Analytics Providers
- Anonymized usage data
- Performance metrics

f) Customer Support Tools
- Support ticket information
- Communication history

g) Local Safety Audio Exception
- Safety audio recordings are not shared with us or any third party
- These recordings remain local to your device and are never uploaded by ${COMPANY_INFO.appName}

5.3 FOR LEGAL REASONS
We may disclose information:
- To comply with legal process or government requests
- To enforce our Terms of Service
- To protect our rights, privacy, safety, or property
- To protect users or the public from harm
- In connection with fraud investigation

5.4 BUSINESS TRANSFERS
If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any change in ownership or control.

5.5 WITH YOUR CONSENT
We may share your information for other purposes with your explicit consent.

5.6 AGGREGATED/ANONYMIZED DATA
We may share aggregated or de-identified information that cannot reasonably identify you.`,
    },
    {
      id: 'international-transfers',
      title: '6. International Data Transfers',
      content: `6.1 TRANSFER LOCATIONS
Your information may be transferred to and processed in countries other than your country of residence, including the United States, where our servers and service providers are located.

6.2 SAFEGUARDS FOR EU/EEA RESIDENTS
For transfers of personal data from the European Economic Area (EEA), United Kingdom, or Switzerland to countries not deemed adequate by the European Commission, we implement appropriate safeguards:

a) Standard Contractual Clauses (SCCs)
We use European Commission-approved Standard Contractual Clauses for data transfers to third parties.

b) Data Processing Agreements
We have data processing agreements with all service providers that include appropriate security and privacy obligations.

6.3 YOUR CHOICES
By using our Service, you consent to the transfer of your information to the United States and other countries. If you do not consent to such transfers, you should not use our Service.`,
    },
    {
      id: 'data-retention',
      title: '7. Data Retention',
      content: `We retain your information for as long as necessary to:

7.1 RETENTION PERIODS

a) Active Accounts
- Account information: Duration of account plus 3 years
- Profile information: Duration of account
- Messages: 2 years or until deletion request
- Booking history: 7 years (for tax/legal purposes)
- Payment records: 7 years (legal requirement)

b) Verification Data
- ID verification images: 30 days after verification
- Verification status: Duration of account

c) Safety and Security Data
- Safety reports: 7 years
- Fraud/abuse records: 7 years
- IP addresses and logs: 90 days

d) Deleted Accounts
- Basic records: 3 years (for legal compliance)
- All other data: Deleted within 30 days

7.2 EXCEPTIONS
We may retain information longer:
- When required by law
- For ongoing legal disputes
- For safety or fraud prevention
- With your consent

7.3 ANONYMIZATION
After retention periods expire, we may anonymize your data for statistical and analytical purposes.`,
    },
    {
      id: 'your-rights',
      title: '8. Your Privacy Rights',
      content: `Depending on your location, you may have the following rights regarding your personal data:

8.1 GDPR RIGHTS (EU/EEA/UK RESIDENTS)

a) Right of Access (Article 15)
You can request a copy of your personal data we hold.

b) Right to Rectification (Article 16)
You can request correction of inaccurate personal data.

c) Right to Erasure (Article 17)
You can request deletion of your personal data ("right to be forgotten").

d) Right to Restrict Processing (Article 18)
You can request we limit how we use your data.

e) Right to Data Portability (Article 20)
You can request your data in a machine-readable format.

f) Right to Object (Article 21)
You can object to processing based on legitimate interests or for marketing.

g) Right to Withdraw Consent (Article 7)
You can withdraw previously given consent at any time.

h) Right to Lodge a Complaint
You can file a complaint with your local supervisory authority.

8.2 CCPA RIGHTS (CALIFORNIA RESIDENTS)

a) Right to Know
You can request disclosure of personal information collected, used, and shared.

b) Right to Delete
You can request deletion of your personal information.

c) Right to Opt-Out
You can opt-out of the sale of personal information. Note: We do not sell personal information.

d) Right to Non-Discrimination
You will not be discriminated against for exercising your privacy rights.

8.3 EXERCISING YOUR RIGHTS
To exercise any of these rights, please contact us at:
Email: ${COMPANY_INFO.privacyEmail}

We will respond to requests within:
- GDPR: 30 days (extendable by 60 days for complex requests)
- CCPA: 45 days (extendable by 45 days for complex requests)

We may require identity verification before processing requests.`,
    },
    {
      id: 'security',
      title: '9. Data Security',
      content: `9.1 SECURITY MEASURES
We implement appropriate technical and organizational security measures to protect your personal data, including:

a) Technical Measures
- Encryption of data in transit (TLS/SSL)
- Encryption of data at rest
- Secure authentication systems
- Regular security testing
- Intrusion detection systems
- Firewalls and access controls
- Regular security audits

b) Organizational Measures
- Employee access controls
- Security training for staff
- Data protection policies
- Vendor security assessments
- Incident response procedures

9.2 BREACH NOTIFICATION
In the event of a data breach that poses a risk to your rights and freedoms, we will:
- Notify the relevant supervisory authority within 72 hours (GDPR requirement)
- Notify affected individuals without undue delay when required
- Document the breach and our response

9.3 YOUR ROLE
You can help protect your data by:
- Using a strong, unique password
- Not sharing your login credentials
- Enabling two-factor authentication when available
- Reporting suspicious activity
- Keeping your app updated`,
    },
    {
      id: 'cookies',
      title: '10. Cookies and Tracking',
      content: `10.1 WHAT WE USE
Our mobile app and website may use:
- Session storage for app functionality
- Local storage for preferences
- Analytics tools for usage tracking
- Device identifiers for app functionality

10.2 PURPOSE
These technologies are used for:
- Essential app functionality
- Remembering your preferences
- Analyzing app usage
- Improving our services

10.3 YOUR CHOICES
You can control these technologies through:
- App settings
- Device settings
- Opting out of analytics

For detailed information, please see our Cookie Policy.`,
    },
    {
      id: 'children',
      title: '11. Children\'s Privacy',
      content: `11.1 AGE REQUIREMENT
Our Service is not intended for anyone under the age of 18. We do not knowingly collect personal information from children under 18.

11.2 PARENTAL NOTIFICATION
If we learn that we have collected personal information from a child under 18, we will:
- Delete that information promptly
- Terminate the child's account
- Notify the parent or guardian if possible

11.3 REPORTING
If you believe a child under 18 is using our Service, please contact us immediately at ${COMPANY_INFO.privacyEmail}.`,
    },
    {
      id: 'third-party',
      title: '12. Third-Party Links and Services',
      content: `12.1 THIRD-PARTY LINKS
Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies.

12.2 SOCIAL MEDIA
If you connect social media accounts to our Service, we may receive information from those platforms according to your settings. Please review your social media privacy settings.

12.3 THIRD-PARTY SERVICES
We use third-party services that have their own privacy policies:
- Supabase (infrastructure): https://supabase.com/privacy

We encourage you to review these policies.`,
    },
    {
      id: 'do-not-track',
      title: '13. Do Not Track Signals',
      content: `Some browsers have a "Do Not Track" feature that signals to websites that you visit that you do not want to have your online activity tracked.

Currently, our Service does not respond to "Do Not Track" signals. However, you can control tracking through our app settings and by adjusting your device settings.

We do not track users across third-party websites for advertising purposes.`,
    },
    {
      id: 'updates',
      title: '14. Updates to This Policy',
      content: `14.1 CHANGES
We may update this Privacy Policy from time to time. We will notify you of material changes by:
- Posting the updated policy in the app
- Sending an email notification
- Displaying a notice in the app

14.2 EFFECTIVE DATE
The updated policy will be effective as of the "Last Updated" date shown at the top of this policy.

14.3 REVIEW
We encourage you to periodically review this policy to stay informed about how we protect your information.

14.4 ACCEPTANCE
Your continued use of the Service after policy changes constitutes acceptance of the updated policy.`,
    },
    {
      id: 'contact',
      title: '15. Contact Us',
      content: `If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

DATA PROTECTION CONTACT:
${COMPANY_INFO.name}
${COMPANY_INFO.address}

Privacy Email: ${COMPANY_INFO.privacyEmail}
General Email: ${COMPANY_INFO.email}
Support: ${COMPANY_INFO.supportEmail}

For EU/EEA residents, you have the right to lodge a complaint with your local supervisory authority if you believe your data protection rights have been violated.

We will respond to all inquiries within 30 days.`,
    },
  ],
};
