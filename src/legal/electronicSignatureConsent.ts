/**
 * Electronic Signature Consent
 * E-SIGN Act compliance for Wingman by Beamo LLC
 */

import type { LegalDocument } from './types';
import { COMPANY_INFO } from './types';

export const ELECTRONIC_SIGNATURE_CONSENT: LegalDocument = {
  id: 'electronic-signature' as any,
  title: 'Electronic Signature Consent',
  shortTitle: 'E-Signature',
  lastUpdated: '2026-02-01',
  version: '1.0',
  effectiveDate: '2026-02-01',
  sections: [
    {
      id: 'introduction',
      title: '1. Introduction',
      content: `This Electronic Signature Consent ("Consent") describes the terms under which ${COMPANY_INFO.name} ("Company", "we", "us") may use electronic signatures and deliver documents to you electronically when you use the ${COMPANY_INFO.appName} application and services.

By using our Service and agreeing to this Consent, you agree to conduct business with us electronically, including signing agreements and receiving documents in electronic form.

This Consent is provided pursuant to the Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and applicable state laws.`,
    },
    {
      id: 'scope',
      title: '2. Scope of Consent',
      content: `Your consent to electronic signatures and delivery covers:

2.1 DOCUMENTS COVERED
- Terms of Service
- Privacy Policy
- Booking Agreements
- Refund Authorizations
- Account Updates and Notices
- Payment Authorizations
- Subscription Agreements
- Any other agreements or disclosures related to your use of our Service

2.2 COMMUNICATIONS COVERED
- Legal notices
- Policy updates
- Account notifications
- Transaction confirmations
- Marketing communications (with your consent)
- Dispute resolutions`,
    },
    {
      id: 'electronic-signatures',
      title: '3. Electronic Signatures',
      content: `3.1 WHAT CONSTITUTES AN ELECTRONIC SIGNATURE
The following actions constitute your electronic signature:
- Checking a consent checkbox
- Clicking "I Agree," "Accept," "Submit," or similar buttons
- Typing your name in a signature field
- Using touch or stylus to draw a signature
- Completing an action that indicates agreement (e.g., proceeding after viewing terms)

3.2 LEGAL EFFECT
Your electronic signature has the same legal force and effect as a handwritten signature. By providing an electronic signature, you:
- Agree to be bound by the terms of the document
- Confirm that you have read and understood the document
- Affirm that the information you provided is accurate

3.3 RECORD RETENTION
We maintain records of your electronic signatures and the documents you signed. You may request copies of these records at any time.`,
    },
    {
      id: 'electronic-delivery',
      title: '4. Electronic Delivery',
      content: `4.1 HOW WE DELIVER DOCUMENTS
We may deliver documents to you electronically through:
- In-app notifications and displays
- Push notifications
- Email to your registered email address
- SMS text messages (for urgent matters)
- Our website
- Download links

4.2 ACCESSING DOCUMENTS
To access electronic documents, you need:
- A compatible device (smartphone, tablet, or computer)
- Internet access
- A current web browser or our mobile app
- The ability to view PDF files (for certain documents)
- An active email account

4.3 DOCUMENT FORMATS
Documents may be provided in:
- HTML/web page format (in-app)
- PDF format (for download)
- Plain text format (for email)`,
    },
    {
      id: 'hardware-software',
      title: '5. Hardware and Software Requirements',
      content: `To receive and access electronic documents, you need:

5.1 MINIMUM REQUIREMENTS
- Device: Smartphone, tablet, or computer with internet capability
- Operating System: iOS 13.0+, Android 8.0+, or current desktop OS
- App Version: Current version of ${COMPANY_INFO.appName}
- Browser: Safari, Chrome, Firefox, or Edge (latest 2 versions)
- Email: Active email account capable of receiving attachments
- Storage: Sufficient space to download and save documents

5.2 PDF VIEWING
For PDF documents:
- Adobe Acrobat Reader (free) or compatible PDF viewer
- Ability to print documents (recommended but not required)

5.3 UPDATES
We may update these requirements from time to time. We will notify you of significant changes.`,
    },
    {
      id: 'paper-copies',
      title: '6. Requesting Paper Copies',
      content: `6.1 YOUR RIGHT TO PAPER COPIES
You have the right to receive paper copies of documents that we provide electronically. To request a paper copy:
- Email: ${COMPANY_INFO.supportEmail}
- Subject: "Paper Copy Request"
- Include: Your name, account email, and the document(s) you need

6.2 FEES
We may charge a reasonable fee for paper copies:
- First request per document: Free
- Additional copies: $5 per document
- Expedited delivery: Additional shipping costs

6.3 TIMING
Paper copies will be mailed within 10 business days of your request.

6.4 EFFECT ON ELECTRONIC CONSENT
Requesting a paper copy does not withdraw your electronic consent. You will continue to receive documents electronically unless you withdraw consent.`,
    },
    {
      id: 'withdrawing-consent',
      title: '7. Withdrawing Your Consent',
      content: `7.1 HOW TO WITHDRAW
You may withdraw your consent to electronic signatures and delivery at any time by:
- Email: ${COMPANY_INFO.supportEmail}
- Subject: "Withdraw Electronic Consent"
- In-App: Settings > Privacy > Electronic Communications

7.2 EFFECT OF WITHDRAWAL
If you withdraw consent:
- We will send future required documents by mail
- You may not be able to use certain features of the Service
- Some features requiring electronic agreements may become unavailable
- Your account may be limited until paper agreements are signed and returned

7.3 NO FEE FOR WITHDRAWAL
We do not charge a fee for withdrawing consent.

7.4 TRANSACTIONS IN PROGRESS
Withdrawal does not affect the validity of electronic signatures or transactions completed before withdrawal.`,
    },
    {
      id: 'updating-information',
      title: '8. Updating Your Contact Information',
      content: `8.1 YOUR RESPONSIBILITY
You are responsible for maintaining current contact information in your account, including:
- Email address
- Phone number
- Mailing address

8.2 HOW TO UPDATE
Update your information through:
- In-App: Profile > Edit Profile
- Email: ${COMPANY_INFO.supportEmail}

8.3 CONSEQUENCES OF OUTDATED INFORMATION
If your contact information is outdated:
- You may miss important notices
- Documents delivered to your old address are considered delivered
- We are not responsible for non-receipt due to outdated information`,
    },
    {
      id: 'legal-effect',
      title: '9. Legal Effect and Validity',
      content: `9.1 BINDING AGREEMENT
Documents signed electronically and delivered electronically are:
- Legally binding
- Enforceable as if signed on paper
- Admissible in legal proceedings
- Valid under the E-SIGN Act and applicable state laws

9.2 COPIES AND ORIGINALS
Electronic copies and originals have the same legal effect. We maintain the original electronic record.

9.3 DISPUTE OF SIGNATURE
If you believe an electronic signature was made without your authorization:
- Contact us immediately at ${COMPANY_INFO.supportEmail}
- We will investigate the matter
- You remain bound by signatures made with your credentials unless proven unauthorized`,
    },
    {
      id: 'consent-confirmation',
      title: '10. Confirming Your Consent',
      content: `BY USING ${COMPANY_INFO.appName.toUpperCase()}, YOU CONFIRM THAT:

a) You have read and understand this Electronic Signature Consent;

b) You agree to use electronic signatures and receive documents electronically;

c) You have the required hardware and software to access electronic documents;

d) You can access and retain electronic documents;

e) You understand how to withdraw your consent;

f) You understand the legal effect of electronic signatures;

g) Your consent is freely given and not obtained through fraud or coercion.

If you do not agree to this Consent, please contact us to discuss alternatives.`,
    },
    {
      id: 'contact',
      title: '11. Contact Information',
      content: `For questions about electronic signatures and delivery:

${COMPANY_INFO.name}
${COMPANY_INFO.address}

Email: ${COMPANY_INFO.supportEmail}
Privacy Email: ${COMPANY_INFO.privacyEmail}
Website: ${COMPANY_INFO.website}`,
    },
  ],
};
