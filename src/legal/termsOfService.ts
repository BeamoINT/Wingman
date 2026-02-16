/**
 * Terms of Service
 * Comprehensive terms and conditions for Wingman app by Beamo LLC
 */

import type { LegalDocument } from './types';
import { COMPANY_INFO } from './types';

export const TERMS_OF_SERVICE: LegalDocument = {
  id: 'terms-of-service',
  title: 'Terms of Service',
  shortTitle: 'Terms',
  lastUpdated: '2026-02-01',
  version: '1.0',
  effectiveDate: '2026-02-01',
  sections: [
    {
      id: 'introduction',
      title: '1. Introduction and Acceptance',
      content: `Welcome to ${COMPANY_INFO.appName} ("App", "Service", "Platform"), a companion booking platform operated by ${COMPANY_INFO.name} ("Company", "we", "us", "our"). These Terms of Service ("Terms") govern your access to and use of our mobile application, website, and related services.

By creating an account, accessing, or using ${COMPANY_INFO.appName}, you agree to be bound by these Terms, our Privacy Policy, Community Guidelines, and all other policies referenced herein. If you do not agree to these Terms, you may not access or use our Service.

We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms in the App or by email. Your continued use of the Service after such modifications constitutes your acceptance of the updated Terms.`,
    },
    {
      id: 'eligibility',
      title: '2. Eligibility Requirements',
      content: `To use ${COMPANY_INFO.appName}, you must:

a) Be at least 18 years of age or the age of legal majority in your jurisdiction, whichever is greater;

b) Have the legal capacity to enter into a binding contract;

c) Not be prohibited from using the Service under applicable laws;

d) Not have been previously banned or removed from our Platform;

e) Provide accurate, current, and complete information during registration;

f) Maintain the security of your account credentials.

By using our Service, you represent and warrant that you meet all eligibility requirements. We reserve the right to verify your age and identity at any time and to suspend or terminate accounts that do not meet these requirements.`,
    },
    {
      id: 'account-registration',
      title: '3. Account Registration and Security',
      content: `3.1 Account Creation

To access certain features of ${COMPANY_INFO.appName}, you must create an account by providing accurate information including your legal name, email address, and other requested details. You agree to:

- Provide truthful, accurate, and complete information;
- Update your information promptly if it changes;
- Maintain the confidentiality of your login credentials;
- Immediately notify us of any unauthorized access to your account;
- Accept responsibility for all activities under your account.

3.2 Verification

We may require identity verification, phone verification, and email verification to use certain features. You consent to these verification processes and agree to provide accurate information for verification purposes.

3.3 Account Security

You are solely responsible for maintaining the security of your account. You agree not to share your password or allow others to access your account. We are not liable for any loss or damage arising from unauthorized access to your account due to your failure to maintain security.`,
    },
    {
      id: 'service-description',
      title: '4. Description of Service',
      content: `4.1 Platform Overview

${COMPANY_INFO.appName} is a technology platform that connects users ("Clients") seeking companionship services with independent service providers ("Companions") offering such services. We provide the technological infrastructure to facilitate these connections but do not employ Companions or provide companionship services directly.

4.2 Nature of Service

Our Service is strictly a PLATONIC COMPANIONSHIP service. ${COMPANY_INFO.appName} is designed for:

- Social event attendance;
- Dining companionship;
- Professional networking support;
- Travel companionship;
- Friendship and social activities;
- Emotional support and conversation;
- Safety companionship.

The Service explicitly DOES NOT facilitate, promote, or allow:

- Romantic or dating services;
- Sexual services of any kind;
- Escort services involving intimate activities;
- Any illegal activities.

Any use of our Platform for prohibited purposes will result in immediate account termination and may be reported to law enforcement.

4.3 Independent Contractors

Companions are independent contractors, not employees of ${COMPANY_INFO.name}. We do not control or direct the manner in which Companions provide their services. Companions set their own rates, availability, and service parameters within our Platform guidelines.`,
    },
    {
      id: 'user-obligations',
      title: '5. User Obligations and Conduct',
      content: `5.1 General Conduct

All users agree to:

- Treat all users with respect and dignity;
- Comply with all applicable laws and regulations;
- Honor confirmed bookings or provide timely cancellations;
- Communicate honestly and transparently;
- Report any safety concerns or policy violations;
- Follow our Community Guidelines.

5.2 Prohibited Conduct

Users are prohibited from:

- Providing false or misleading information;
- Impersonating another person or entity;
- Harassing, threatening, or abusing other users;
- Engaging in discriminatory behavior;
- Soliciting or providing illegal services;
- Circumventing the Platform for payments or bookings;
- Using the Service for any illegal purpose;
- Posting inappropriate or offensive content;
- Attempting to access other users' accounts;
- Reverse engineering or hacking the Platform;
- Using automated systems to access the Service;
- Collecting user data without authorization;
- Violating intellectual property rights.

5.3 Client Obligations

Clients specifically agree to:

- Arrive on time for scheduled bookings;
- Treat Companions with respect;
- Pay all applicable fees through the Platform;
- Provide accurate booking details;
- Cancel bookings within the designated timeframe;
- Not request services outside our Platform guidelines.

5.4 Companion Obligations

Companions specifically agree to:

- Provide accurate profile information;
- Maintain professional conduct at all times;
- Arrive on time for confirmed bookings;
- Provide services as described in their profile;
- Comply with all applicable laws and regulations;
- Maintain appropriate verification status;
- Not solicit tips or off-platform payments.`,
    },
    {
      id: 'bookings-payments',
      title: '6. Bookings and Payments',
      content: `6.1 Booking Process

Bookings are made through the Platform by selecting a Companion, choosing a date, time, duration, and activity type. Bookings are subject to Companion acceptance and availability.

6.2 Payment Terms

All payments must be made through the Platform. We charge:

- Companion's hourly rate as listed;
- A service fee of 10% of the booking total;
- Any applicable taxes.

Payment is processed at the time of booking confirmation. We use secure third-party payment processors and do not store complete payment card information.

6.3 Companion Compensation

Companions receive their listed rate minus our platform fee. Payment is processed within 3-5 business days after booking completion.

6.4 Currency

All prices are displayed and charged in United States Dollars (USD) unless otherwise specified.

6.5 Receipts

Electronic receipts are provided for all transactions and available in your account history.`,
    },
    {
      id: 'cancellations-refunds',
      title: '7. Cancellations and Refunds',
      content: `7.1 Client Cancellations

- Cancellations made 24+ hours before booking: Full refund minus a $5 processing fee;
- Cancellations made 12-24 hours before booking: 50% refund;
- Cancellations made less than 12 hours before booking: No refund;
- No-shows: No refund and potential account suspension.

7.2 Companion Cancellations

If a Companion cancels a confirmed booking, Clients receive a full refund. Companions who repeatedly cancel may face account restrictions or termination.

7.3 Dispute Resolution

If you are dissatisfied with a booking, you may file a dispute within 48 hours of booking completion. We will review disputes and may issue partial or full refunds at our discretion based on the circumstances.

7.4 Chargebacks

Initiating a chargeback without first attempting to resolve the issue through our dispute process may result in account suspension. Fraudulent chargebacks may result in permanent ban and legal action.

7.5 Subscription Refunds

Subscription fees are generally non-refundable. However, if you cancel within 48 hours of your initial subscription purchase, you may request a refund.

7.6 Gift Cards

Gift cards are non-refundable and non-transferable for cash. Unused gift card balances do not expire.`,
    },
    {
      id: 'subscriptions',
      title: '8. Subscription Services',
      content: `8.1 Subscription Tiers

We offer the following subscription plans:

- Free: Core Wingman booking features;
- Pro ($10.00/month): Full Friends access, including matching requests, friend chat, feed, groups, and events.

8.2 Billing

Pro subscriptions are billed monthly on a recurring basis until cancelled. You authorize us to charge your payment method on file for all subscription fees.

8.3 Automatic Renewal

Subscriptions automatically renew unless cancelled before the renewal date. You may cancel at any time through your account settings.

8.4 Price Changes

We may change subscription prices with 30 days notice. Price changes take effect at your next billing cycle after the notice period.

8.5 Trial Periods

We may offer free trial periods. If you do not cancel before the trial ends, you will be charged the full subscription price.`,
    },
    {
      id: 'verification',
      title: '9. Verification',
      content: `9.1 Verification Levels

We offer various verification levels including:

- Email verification;
- Phone verification;
- ID verification (government-issued identification).

All users must complete required verification before booking activity.

9.2 Verification Process

To verify your identity, you may be required to:

- Provide a valid government-issued ID;
- Complete a selfie verification;
- Confirm your phone number via SMS;
- Verify your email address.

9.3 Verification Benefits

Verified users receive:

- Verification badges displayed on their profile;
- Increased visibility in search results;
- Access to enhanced platform features;
- Higher trust levels with other users.

9.4 Verification Limitations

Verification confirms identity but does not guarantee safety or good conduct. Users should always exercise personal judgment and take appropriate safety precautions when meeting others.

9.5 Maintaining Verification

Your verification status may be reviewed periodically. We reserve the right to request re-verification or revoke verification status if we believe information is inaccurate or outdated.`,
    },
    {
      id: 'safety',
      title: '10. Safety and Emergency Features',
      content: `10.1 Safety Features

We provide safety features including:

- Emergency contact designation;
- Safety check-ins during bookings;
- Location sharing (optional);
- Emergency SOS functionality.

10.2 Limitations

THESE SAFETY FEATURES ARE SUPPLEMENTARY AND DO NOT REPLACE EMERGENCY SERVICES. In case of emergency, always contact local emergency services (911 in the United States) first.

10.3 User Responsibility

While we strive to create a safe platform, users are ultimately responsible for their own safety. We recommend:

- Meeting in public places initially;
- Informing friends or family of your whereabouts;
- Trusting your instincts;
- Using the in-app safety features;
- Reporting any safety concerns immediately.

10.4 No Guarantee

We do not guarantee the identity, conduct, or safety of any user. Verification reduces but does not eliminate risk.`,
    },
    {
      id: 'intellectual-property',
      title: '11. Intellectual Property',
      content: `11.1 Our Intellectual Property

The ${COMPANY_INFO.appName} name, logo, trademarks, software, content, and all related intellectual property are owned by ${COMPANY_INFO.name} or our licensors. You may not use, copy, modify, or distribute our intellectual property without our prior written consent.

11.2 User Content License

By posting content on our Platform (including profile information, photos, reviews, and messages), you grant us a non-exclusive, worldwide, royalty-free, sublicensable license to use, display, reproduce, modify, and distribute such content in connection with operating and promoting the Service.

11.3 User Content Ownership

You retain ownership of your content, but you are responsible for ensuring you have the right to post it and that it does not violate these Terms or any laws.

11.4 Copyright Complaints

If you believe your copyrighted work has been infringed on our Platform, please contact us at ${COMPANY_INFO.email} with a detailed DMCA notice.`,
    },
    {
      id: 'disclaimers',
      title: '12. Disclaimers',
      content: `12.1 Service Provided "As Is"

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

12.2 No Warranty of Results

We do not warrant that:

- The Service will meet your requirements;
- The Service will be uninterrupted, timely, secure, or error-free;
- The results obtained from using the Service will be accurate or reliable;
- Any errors in the Service will be corrected.

12.3 Third-Party Services

We are not responsible for third-party services, including payment processors, identity verification providers, or any services provided by Companions.

12.4 User Conduct

We are not responsible for the conduct of any user, whether online or offline. We do not screen users (beyond verification processes) and do not control their actions.`,
    },
    {
      id: 'off-platform-disclaimer',
      title: '13. Off-Platform Activities Disclaimer',
      content: `IMPORTANT: PLEASE READ THIS SECTION CAREFULLY

13.1 SCOPE OF OUR SERVICE

${COMPANY_INFO.appName} is a technology platform that facilitates connections between users. OUR SERVICE IS LIMITED TO:

- Providing the technology platform and application;
- Facilitating initial connections between Clients and Companions;
- Processing payments for bookings made through the Platform;
- Providing in-app communication tools;
- Offering optional safety features within the application.

13.2 OFF-PLATFORM ACTIVITIES - COMPLETE DISCLAIMER

${COMPANY_INFO.name.toUpperCase()} HAS NO RESPONSIBILITY, LIABILITY, OR INVOLVEMENT IN ANY ACTIVITIES, INTERACTIONS, COMMUNICATIONS, OR EVENTS THAT OCCUR OUTSIDE OF THE ${COMPANY_INFO.appName.toUpperCase()} APPLICATION.

This includes, but is not limited to:

- In-person meetings between users;
- Phone calls, text messages, or communications outside the app;
- Activities during bookings;
- Travel to or from meeting locations;
- Any physical locations where users meet;
- Any interactions that occur after users have connected through our Platform;
- Any continuation of relationships outside the Platform;
- Social media interactions between users;
- Any off-platform payments or transactions;
- Any events, incidents, or circumstances occurring in the physical world.

13.3 NO CONTROL OVER REAL-WORLD INTERACTIONS

${COMPANY_INFO.name} DOES NOT AND CANNOT:

- Control, monitor, or supervise in-person meetings;
- Verify real-time user behavior or conduct;
- Ensure user safety during off-platform activities;
- Guarantee that users will behave as represented;
- Monitor or control what happens at meeting locations;
- Provide security or protection during bookings;
- Intervene in real-world situations;
- Verify the condition or safety of meeting locations;
- Control transportation to or from meetings;
- Ensure compliance with booking terms during meetings.

13.4 USER ACKNOWLEDGMENT

BY USING ${COMPANY_INFO.appName.toUpperCase()}, YOU EXPRESSLY ACKNOWLEDGE AND AGREE THAT:

a) All in-person meetings and interactions are entirely AT YOUR OWN RISK;

b) ${COMPANY_INFO.name} is not a party to any meeting, transaction, or interaction that occurs outside the application;

c) ${COMPANY_INFO.name} has no duty to protect you during off-platform activities;

d) You are solely responsible for your own safety, decisions, and conduct when meeting other users;

e) You release ${COMPANY_INFO.name} from any and all claims arising from off-platform activities;

f) Verification does not guarantee safety or good conduct during meetings;

g) You will not hold ${COMPANY_INFO.name} responsible for the actions of other users;

h) Meeting locations, activities, and circumstances are entirely outside our control;

i) You assume all risks associated with meeting strangers in person.

13.5 SERVICES PROVIDED BY COMPANIONS

Companionship services are provided directly by independent Companions, NOT by ${COMPANY_INFO.name}. We are not responsible for:

- The quality of companionship services;
- Companion behavior during bookings;
- Any injuries, damages, or losses during bookings;
- Disputes between Clients and Companions;
- Companion punctuality or reliability;
- Any representations made by Companions;
- The suitability of Companions for any purpose.

13.6 THIRD-PARTY LOCATIONS

Meetings typically occur at third-party locations (restaurants, venues, public places, etc.). ${COMPANY_INFO.name} has no relationship with, control over, or responsibility for:

- Safety or security at meeting locations;
- Conditions at meeting locations;
- Actions of third parties at meeting locations;
- Any incidents occurring at meeting locations;
- Food, beverages, or services at meeting locations;
- Accessibility of meeting locations.

13.7 WAIVER AND RELEASE

YOU HEREBY WAIVE, RELEASE, AND FOREVER DISCHARGE ${COMPANY_INFO.name.toUpperCase()}, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AFFILIATES, SUCCESSORS, AND ASSIGNS FROM ANY AND ALL CLAIMS, DEMANDS, DAMAGES, LOSSES, COSTS, EXPENSES, AND LIABILITY OF ANY KIND ARISING FROM OR RELATED TO:

- Any off-platform activities, meetings, or interactions;
- Any harm, injury, or damages occurring during in-person meetings;
- Any conduct of other users, whether on or off the Platform;
- Any failure of safety features to prevent harm;
- Any reliance on user profiles, verifications, or representations;
- Any events occurring at meeting locations;
- Any transportation to or from meetings;
- Any activities that occur after initial connection through the Platform.

13.8 SURVIVAL

This off-platform activities disclaimer and the waivers contained herein shall survive the termination of these Terms and your use of the Service indefinitely.`,
    },
    {
      id: 'limitation-of-liability',
      title: '14. Limitation of Liability',
      content: `13.1 Limitation

TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${COMPANY_INFO.name.toUpperCase()} SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:

(a) Your access to or use of or inability to access or use the Service;
(b) Any conduct or content of any third party on the Service;
(c) Any content obtained from the Service;
(d) Unauthorized access, use, or alteration of your transmissions or content;
(e) Personal injury or property damage resulting from your use of the Service.

13.2 Cap on Liability

IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS EXCEED THE GREATER OF (A) THE AMOUNT YOU HAVE PAID US IN THE 12 MONTHS PRIOR TO THE CLAIM, OR (B) ONE HUNDRED DOLLARS ($100).

13.3 Jurisdictional Limitations

Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability for incidental or consequential damages. In such jurisdictions, our liability shall be limited to the maximum extent permitted by law.`,
    },
    {
      id: 'indemnification',
      title: '15. Indemnification',
      content: `You agree to indemnify, defend, and hold harmless ${COMPANY_INFO.name}, its officers, directors, employees, agents, licensors, and suppliers from and against all claims, losses, expenses, damages, and costs, including reasonable attorneys' fees, resulting from:

a) Your violation of these Terms;
b) Your violation of any rights of a third party;
c) Your use of the Service;
d) Content you submit, post, or transmit through the Service;
e) Your violation of any applicable laws or regulations;
f) Any interaction or transaction between you and any other user of the Service.

This indemnification obligation will survive the termination of these Terms and your use of the Service.`,
    },
    {
      id: 'dispute-resolution',
      title: '16. Dispute Resolution',
      content: `15.1 Informal Resolution

Before filing any formal legal action, you agree to first contact us at ${COMPANY_INFO.email} to attempt to resolve any dispute informally. We will attempt to resolve disputes within 30 days.

15.2 Binding Arbitration

If we cannot resolve a dispute informally, you agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Service shall be resolved by BINDING ARBITRATION administered by the American Arbitration Association ("AAA") in accordance with its Commercial Arbitration Rules.

15.3 Arbitration Procedures

- Arbitration will be conducted in ${COMPANY_INFO.state}, ${COMPANY_INFO.country}, unless otherwise agreed;
- The arbitrator shall apply ${COMPANY_INFO.state} law;
- The arbitrator's decision shall be final and binding;
- Either party may seek enforcement in any court of competent jurisdiction.

15.4 Class Action Waiver

YOU AND ${COMPANY_INFO.name.toUpperCase()} AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.

15.5 Exceptions

This arbitration agreement does not apply to:

- Claims for injunctive or equitable relief;
- Claims regarding intellectual property rights;
- Small claims court actions where applicable.`,
    },
    {
      id: 'governing-law',
      title: '17. Governing Law',
      content: `These Terms shall be governed by and construed in accordance with the laws of the State of ${COMPANY_INFO.state}, ${COMPANY_INFO.country}, without regard to its conflict of law provisions.

Any legal action or proceeding not subject to arbitration shall be brought exclusively in the state or federal courts located in ${COMPANY_INFO.state}, and you consent to the personal jurisdiction of such courts.`,
    },
    {
      id: 'termination',
      title: '18. Termination',
      content: `17.1 Termination by You

You may terminate your account at any time through your account settings or by contacting us at ${COMPANY_INFO.supportEmail}. Upon termination:

- Your access to the Service will be immediately revoked;
- Any pending bookings will be cancelled;
- Companion balances will be paid out within 30 days;
- Active subscriptions will not be refunded for the current billing period.

17.2 Termination by Us

We may suspend or terminate your account at any time for any reason, including but not limited to:

- Violation of these Terms;
- Fraudulent, abusive, or illegal activity;
- Extended inactivity;
- Request by law enforcement or government agencies;
- Discontinuation of the Service.

17.3 Effect of Termination

Upon termination:

- Your right to use the Service immediately ceases;
- All licenses granted to you terminate;
- We may delete your account and data in accordance with our Privacy Policy;
- Provisions that should survive termination (including but not limited to indemnification, limitation of liability, and dispute resolution) shall survive.`,
    },
    {
      id: 'general-provisions',
      title: '19. General Provisions',
      content: `18.1 Entire Agreement

These Terms, together with the Privacy Policy and other policies referenced herein, constitute the entire agreement between you and ${COMPANY_INFO.name} regarding the Service.

18.2 Waiver

Our failure to enforce any right or provision of these Terms shall not be deemed a waiver of such right or provision.

18.3 Severability

If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

18.4 Assignment

You may not assign your rights under these Terms without our prior written consent. We may assign our rights to any affiliate or successor.

18.5 No Third-Party Beneficiaries

These Terms do not create any third-party beneficiary rights.

18.6 Force Majeure

We shall not be liable for any failure or delay in performing our obligations due to circumstances beyond our reasonable control, including natural disasters, war, terrorism, strikes, or government actions.

18.7 Headings

The section headings are for convenience only and do not affect the interpretation of these Terms.`,
    },
    {
      id: 'contact',
      title: '20. Contact Information',
      content: `If you have any questions about these Terms, please contact us:

${COMPANY_INFO.name}
${COMPANY_INFO.address}

Email: ${COMPANY_INFO.email}
Support: ${COMPANY_INFO.supportEmail}
Website: ${COMPANY_INFO.website}

For legal notices, please send correspondence to the address above with "Legal Department" in the address line.`,
    },
  ],
};
