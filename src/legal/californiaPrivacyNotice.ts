/**
 * California Privacy Notice (CCPA/CPRA)
 * California-specific privacy rights for Wingman by Beamo LLC
 */

import type { LegalDocument } from './types';
import { COMPANY_INFO } from './types';

export const CALIFORNIA_PRIVACY_NOTICE: LegalDocument = {
  id: 'california-privacy' as any,
  title: 'California Privacy Notice',
  shortTitle: 'CA Privacy',
  lastUpdated: '2026-02-01',
  version: '1.0',
  effectiveDate: '2026-02-01',
  sections: [
    {
      id: 'introduction',
      title: '1. Introduction',
      content: `This California Privacy Notice ("Notice") supplements the ${COMPANY_INFO.appName} Privacy Policy and applies solely to residents of California ("consumers" or "you"). This Notice is provided pursuant to the California Consumer Privacy Act of 2018 (CCPA) as amended by the California Privacy Rights Act of 2020 (CPRA).

This Notice describes the categories of personal information we collect, the purposes for which we use that information, and your rights under California law.

If you are a California resident, you have specific rights regarding your personal information as described below.`,
    },
    {
      id: 'information-collected',
      title: '2. Information We Collect',
      content: `We have collected the following categories of personal information from consumers within the last twelve (12) months:

CATEGORY A: IDENTIFIERS
- Examples: Real name, email address, phone number, account name, IP address, device identifiers
- Collected: Yes
- Source: Directly from you; Automatically from your device
- Purpose: Account creation, communication, service delivery, security

CATEGORY B: PERSONAL INFORMATION (Cal. Civ. Code § 1798.80(e))
- Examples: Name, address, phone number, financial information (for payments)
- Collected: Yes
- Source: Directly from you; Payment processors
- Purpose: Service delivery, payments, legal compliance

CATEGORY C: PROTECTED CLASSIFICATION CHARACTERISTICS
- Examples: Age, gender (optional)
- Collected: Yes
- Source: Directly from you
- Purpose: Age verification, personalization (optional)

CATEGORY D: COMMERCIAL INFORMATION
- Examples: Booking history, purchase history, subscription information
- Collected: Yes
- Source: Your transactions on our platform
- Purpose: Service delivery, customer support, analytics

CATEGORY E: BIOMETRIC INFORMATION
- Examples: Facial recognition data (for ID verification only)
- Collected: Yes (if you use ID verification)
- Source: Directly from you during verification
- Purpose: Identity verification only; deleted after verification

CATEGORY F: INTERNET/NETWORK ACTIVITY
- Examples: Browsing history on our app, search history, interaction data
- Collected: Yes
- Source: Automatically collected
- Purpose: Service improvement, personalization, security

CATEGORY G: GEOLOCATION DATA
- Examples: City, state, country; precise location (when enabled)
- Collected: Yes
- Source: Directly from you; Your device (with permission)
- Purpose: Connecting you with nearby companions, safety features

CATEGORY H: SENSORY DATA
- Examples: Photos you upload
- Collected: Yes
- Source: Directly from you
- Purpose: Profile display, ID verification

CATEGORY I: PROFESSIONAL/EMPLOYMENT INFORMATION
- Examples: Companion service information
- Collected: Yes (for Companions)
- Source: Directly from you
- Purpose: Platform operation

CATEGORY J: EDUCATION INFORMATION
- Examples: Not collected
- Collected: No
- Source: N/A
- Purpose: N/A

CATEGORY K: INFERENCES
- Examples: Preferences, characteristics based on collected information
- Collected: Yes
- Source: Derived from other categories
- Purpose: Personalization, matching

CATEGORY L: SENSITIVE PERSONAL INFORMATION
- Examples: Government ID numbers (for identity verification), precise geolocation
- Collected: Yes (with specific consent)
- Source: Directly from you
- Purpose: Identity verification, safety features`,
    },
    {
      id: 'use-of-information',
      title: '3. Use of Personal Information',
      content: `We use the personal information we collect for the following business and commercial purposes:

3.1 BUSINESS PURPOSES
- Providing our services (bookings, messaging, payments)
- Account creation and maintenance
- Customer support
- Security and fraud prevention
- Legal compliance
- Debugging and error correction
- Quality assurance

3.2 COMMERCIAL PURPOSES
- Marketing and advertising our services
- Analytics and service improvement
- Personalization of user experience

3.3 SPECIFIC USES BY CATEGORY
We use each category of personal information for the purposes indicated in Section 2 above.`,
    },
    {
      id: 'disclosure',
      title: '4. Disclosure of Personal Information',
      content: `In the preceding twelve (12) months, we have disclosed the following categories of personal information for a business purpose:

DISCLOSED FOR BUSINESS PURPOSE:
- Category A (Identifiers): To service providers for analytics, security
- Category B (Personal Information): To payment processors
- Category D (Commercial Information): To service providers for analytics
- Category F (Internet Activity): To analytics providers
- Category G (Geolocation): To map service providers
- Category L (Sensitive): To identity verification services

CATEGORIES OF THIRD PARTIES:
- Service providers (analytics, cloud hosting, payment processing)
- Identity verification providers
- Legal authorities (when required by law)

SALE OF PERSONAL INFORMATION:
We DO NOT sell personal information to third parties. We have not sold personal information in the preceding twelve (12) months.

SHARING FOR CROSS-CONTEXT BEHAVIORAL ADVERTISING:
We DO NOT share personal information for cross-context behavioral advertising.`,
    },
    {
      id: 'your-rights',
      title: '5. Your California Privacy Rights',
      content: `As a California resident, you have the following rights:

5.1 RIGHT TO KNOW
You have the right to request that we disclose:
- The categories of personal information we collected
- The categories of sources of that information
- Our business purpose for collecting or selling that information
- The categories of third parties with whom we share that information
- The specific pieces of personal information we collected about you

5.2 RIGHT TO DELETE
You have the right to request deletion of your personal information, subject to certain exceptions (such as legal compliance requirements).

5.3 RIGHT TO CORRECT
You have the right to request correction of inaccurate personal information.

5.4 RIGHT TO OPT-OUT OF SALE/SHARING
You have the right to opt-out of the sale of your personal information or sharing for cross-context behavioral advertising. Note: We do not sell or share your information for these purposes.

5.5 RIGHT TO LIMIT USE OF SENSITIVE PERSONAL INFORMATION
You have the right to limit our use of sensitive personal information to purposes necessary to provide our services.

5.6 RIGHT TO NON-DISCRIMINATION
We will not discriminate against you for exercising your privacy rights. You will not receive:
- Denial of services
- Different prices or rates
- Different quality of service
- Suggestions of discriminatory treatment

5.7 RIGHT TO AUTHORIZED AGENTS
You may designate an authorized agent to make requests on your behalf. We may require verification of the agent's authority.`,
    },
    {
      id: 'exercising-rights',
      title: '6. Exercising Your Rights',
      content: `To exercise your California privacy rights, you may:

6.1 SUBMIT A REQUEST
- Email: ${COMPANY_INFO.privacyEmail}
- In-App: Settings > Privacy > California Privacy Rights
- Mail: ${COMPANY_INFO.address}

6.2 VERIFICATION
To protect your privacy, we must verify your identity before responding to your request. We may require:
- Confirmation of your email address
- Account login verification
- Additional information to confirm your identity

6.3 RESPONSE TIMING
We will respond to your request within 45 days. If we need more time (up to 90 days total), we will notify you.

6.4 INFORMATION PROVIDED
For requests to know, we will provide information covering the 12-month period preceding your request.

6.5 NO FEE
We do not charge a fee for processing your request unless it is excessive or repetitive.`,
    },
    {
      id: 'sensitive-information',
      title: '7. Sensitive Personal Information',
      content: `We collect the following categories of sensitive personal information:

7.1 GOVERNMENT IDENTIFIERS
- Driver's license or state ID (for identity verification)

7.2 PRECISE GEOLOCATION
- Your exact location (only when you enable location sharing)

7.3 HOW WE USE SENSITIVE INFORMATION
We use sensitive personal information only for:
- Identity verification
- Safety features (with your consent)
- Legal compliance

7.4 YOUR RIGHT TO LIMIT
You may limit our use of sensitive personal information by:
- Disabling location sharing
- Contacting us to request limitation

We do not use sensitive personal information for purposes beyond those necessary to provide our services.`,
    },
    {
      id: 'minors',
      title: '8. California Minors',
      content: `8.1 AGE REQUIREMENT
Our Service is intended for users 18 years of age and older. We do not knowingly collect personal information from anyone under 18.

8.2 REMOVAL RIGHTS FOR MINORS
If you are under 18 and have posted content on our Service that you wish to remove, please contact us at ${COMPANY_INFO.privacyEmail}. Note that removal may not ensure complete erasure if the content has been shared by others.

8.3 "SHINE THE LIGHT" LAW
California Civil Code Section 1798.83 permits California residents to request information about disclosure of personal information to third parties for direct marketing purposes. We do not share personal information for third-party direct marketing.`,
    },
    {
      id: 'do-not-track',
      title: '9. Do Not Track Signals',
      content: `California Business & Professions Code Section 22575 requires disclosure about how we respond to "Do Not Track" browser signals.

CURRENT RESPONSE:
Our Service does not currently respond to "Do Not Track" signals from web browsers. However, you can control tracking through:
- App privacy settings
- Device-level privacy settings
- Opting out of analytics

TRACKING PRACTICES:
We do not track users across third-party websites for advertising purposes. Our tracking is limited to improving our own Service.`,
    },
    {
      id: 'retention',
      title: '10. Data Retention',
      content: `We retain personal information as follows:

- Account Information: Duration of account plus 3 years
- Transaction Records: 7 years (legal requirement)
- Communications: 2 years
- Verification Data: 30 days (images), 1 year (status)
- Usage Data: 90 days

After retention periods, data is deleted or anonymized.`,
    },
    {
      id: 'changes',
      title: '11. Changes to This Notice',
      content: `We may update this California Privacy Notice from time to time. We will notify you of material changes by:
- Posting the updated notice in the app
- Sending an email notification
- Displaying a notice in the app

Please review this notice periodically for any changes.`,
    },
    {
      id: 'contact',
      title: '12. Contact Us',
      content: `If you have questions about this California Privacy Notice or want to exercise your rights:

${COMPANY_INFO.name}
${COMPANY_INFO.address}

Privacy Email: ${COMPANY_INFO.privacyEmail}
General Email: ${COMPANY_INFO.email}
Phone: Available upon request

For fastest response, please include "California Privacy Request" in your subject line.`,
    },
  ],
};
