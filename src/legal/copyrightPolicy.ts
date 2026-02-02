/**
 * DMCA & Copyright Policy
 * Copyright and intellectual property policy for Wingman by Beamo LLC
 */

import type { LegalDocument } from './types';
import { COMPANY_INFO } from './types';

export const COPYRIGHT_POLICY: LegalDocument = {
  id: 'copyright-policy' as any,
  title: 'DMCA & Copyright Policy',
  shortTitle: 'Copyright',
  lastUpdated: '2026-02-01',
  version: '1.0',
  effectiveDate: '2026-02-01',
  sections: [
    {
      id: 'introduction',
      title: '1. Introduction',
      content: `${COMPANY_INFO.name} ("Company", "we", "us", "our") respects the intellectual property rights of others and expects users of the ${COMPANY_INFO.appName} application and services (the "Service") to do the same.

This policy outlines our procedures for responding to claims of copyright infringement in accordance with the Digital Millennium Copyright Act of 1998 ("DMCA") and other applicable intellectual property laws.`,
    },
    {
      id: 'reporting-infringement',
      title: '2. Reporting Copyright Infringement',
      content: `If you believe that content on our Service infringes your copyright, please submit a DMCA takedown notice containing the following information:

2.1 REQUIRED INFORMATION
Your notice must include:

a) A physical or electronic signature of the copyright owner or a person authorized to act on their behalf;

b) Identification of the copyrighted work claimed to have been infringed (or, if multiple works, a representative list);

c) Identification of the material that is claimed to be infringing, including its location on our Service (e.g., URL or description sufficient to locate it);

d) Your contact information, including name, address, telephone number, and email address;

e) A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law;

f) A statement, made under penalty of perjury, that the information in the notification is accurate and that you are authorized to act on behalf of the copyright owner.

2.2 HOW TO SUBMIT
Send your DMCA notice to:

${COMPANY_INFO.name}
DMCA Agent
${COMPANY_INFO.address}
Email: dmca@beamollc.com

Please use "DMCA Notice" as the subject line.`,
    },
    {
      id: 'our-response',
      title: '3. Our Response to Valid Notices',
      content: `Upon receiving a valid DMCA notice, we will:

3.1 REMOVAL OF CONTENT
- Remove or disable access to the allegedly infringing material
- Take reasonable steps to notify the user who posted the content

3.2 NOTIFICATION TO USER
We will forward a copy of the complaint to the user who posted the content, including your contact information unless you specify otherwise.

3.3 TIMING
We aim to process DMCA notices within 5-10 business days of receipt. Complex cases may take longer.

3.4 DOCUMENTATION
We maintain records of all DMCA notices received and actions taken.`,
    },
    {
      id: 'counter-notification',
      title: '4. Counter-Notification',
      content: `If you believe your content was removed in error, you may submit a counter-notification.

4.1 REQUIRED INFORMATION
Your counter-notification must include:

a) Your physical or electronic signature;

b) Identification of the material that was removed and its location before removal;

c) A statement under penalty of perjury that you have a good faith belief the material was removed by mistake or misidentification;

d) Your name, address, and telephone number;

e) A statement that you consent to the jurisdiction of the federal district court for your address (or for ${COMPANY_INFO.state} if outside the US);

f) A statement that you will accept service of process from the person who filed the original notice.

4.2 OUR RESPONSE
Upon receiving a valid counter-notification, we will:
- Forward it to the original complainant
- Wait 10-14 business days for the complainant to file a court action
- Restore the content if no court action is filed

4.3 WHERE TO SEND
Send counter-notifications to the same address as DMCA notices.`,
    },
    {
      id: 'repeat-infringers',
      title: '5. Repeat Infringer Policy',
      content: `${COMPANY_INFO.name} has a policy of terminating, in appropriate circumstances, the accounts of users who are repeat infringers.

5.1 WHAT CONSTITUTES A REPEAT INFRINGER
A user may be considered a repeat infringer if they have:
- Received two or more valid DMCA notices
- Had content removed multiple times for infringement
- Engaged in a pattern of infringing behavior

5.2 CONSEQUENCES
Repeat infringers may face:
- Account suspension
- Permanent account termination
- Legal action

5.3 DISCRETION
We reserve the right to terminate any account at any time for any reason, including but not limited to copyright infringement.`,
    },
    {
      id: 'false-claims',
      title: '6. Misrepresentation Warning',
      content: `WARNING: Filing a false DMCA notice or counter-notification has legal consequences.

Under Section 512(f) of the DMCA, any person who knowingly materially misrepresents that material is infringing, or that material was removed or disabled by mistake, may be liable for damages, including costs and attorneys' fees.

Before filing a DMCA notice, please carefully consider whether the use of the material constitutes fair use or is otherwise authorized.

Before filing a counter-notification, please ensure you have a good faith belief that the material was removed in error.`,
    },
    {
      id: 'user-content',
      title: '7. User-Generated Content',
      content: `7.1 YOUR RESPONSIBILITIES
When you upload content to ${COMPANY_INFO.appName}, you represent and warrant that:
- You own the content or have the right to use it
- The content does not infringe any third party's rights
- You have obtained any necessary permissions or licenses

7.2 TYPES OF PROTECTED CONTENT
Copyright protection applies to:
- Profile photos and images
- Gallery photos
- Written content (bios, reviews, messages)
- Any other creative works

7.3 LICENSE TO US
By posting content, you grant us a license as described in our Terms of Service. This license does not transfer ownership of your content to us.`,
    },
    {
      id: 'trademark',
      title: '8. Trademark Policy',
      content: `8.1 OUR TRADEMARKS
The ${COMPANY_INFO.appName} name, logo, and related marks are trademarks of ${COMPANY_INFO.name}. You may not use our trademarks without our prior written consent.

8.2 THIRD-PARTY TRADEMARKS
If you believe your trademark is being infringed on our Service, please contact us with:
- Your trademark registration information
- Evidence of the infringing use
- Your contact information

8.3 REPORTING
Send trademark concerns to: legal@beamollc.com`,
    },
    {
      id: 'fair-use',
      title: '9. Fair Use',
      content: `We recognize that not all uses of copyrighted material constitute infringement. Fair use is a legal doctrine that permits limited use of copyrighted material without permission.

Factors considered in fair use analysis include:
- The purpose and character of the use
- The nature of the copyrighted work
- The amount used relative to the whole
- The effect on the market for the original work

We encourage copyright owners to consider fair use before submitting DMCA notices.`,
    },
    {
      id: 'contact',
      title: '10. Contact Information',
      content: `For copyright-related inquiries:

DMCA Agent:
${COMPANY_INFO.name}
${COMPANY_INFO.address}

Email: dmca@beamollc.com
General Legal: ${COMPANY_INFO.email}

For fastest response, please email with "DMCA" or "Copyright" in the subject line.`,
    },
  ],
};
