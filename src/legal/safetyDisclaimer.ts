/**
 * Safety Disclaimer
 * Safety features disclaimer for Wingman by Beamo LLC
 */

import type { LegalDocument } from './types';
import { COMPANY_INFO } from './types';

export const SAFETY_DISCLAIMER: LegalDocument = {
  id: 'safety-disclaimer',
  title: 'Safety Disclaimer',
  shortTitle: 'Safety',
  lastUpdated: '2026-02-01',
  version: '1.0',
  effectiveDate: '2026-02-01',
  sections: [
    {
      id: 'important-notice',
      title: 'IMPORTANT SAFETY NOTICE',
      content: `PLEASE READ THIS SAFETY DISCLAIMER CAREFULLY

${COMPANY_INFO.appName} provides various safety features designed to enhance your security when using our platform. However, these features are SUPPLEMENTARY measures and have important limitations.

THIS IS NOT A SUBSTITUTE FOR PROFESSIONAL EMERGENCY SERVICES. IN CASE OF EMERGENCY, ALWAYS CONTACT LOCAL EMERGENCY SERVICES (911 IN THE UNITED STATES) FIRST.

By using the safety features of ${COMPANY_INFO.appName}, you acknowledge that you have read, understood, and agreed to this disclaimer.`,
    },
    {
      id: 'safety-features',
      title: '1. Safety Features Provided',
      content: `${COMPANY_INFO.appName} provides the following safety features:

1.1 EMERGENCY CONTACTS
- Designate trusted contacts to notify in emergencies
- Emergency contacts can be alerted through the app

1.2 SAFETY CHECK-INS
- Scheduled check-in reminders during bookings
- Option to mark yourself as safe or request assistance

1.3 LOCATION SHARING
- Share your live location with emergency contacts
- Time-limited live location during active safety sessions
- Emergency location data is automatically expired and not retained as permanent history

1.4 EMERGENCY SOS
- Quick-access emergency button
- Alerts emergency contacts with your location
- Misuse of SOS (false or prank alerts) can result in account restrictions or removal

1.5 VERIFICATION SYSTEMS
- ID verification
- Profile verification

1.6 REPORTING SYSTEMS
- Report safety concerns
- Block users
- Content moderation`,
    },
    {
      id: 'limitations',
      title: '2. Limitations of Safety Features',
      content: `PLEASE UNDERSTAND THESE IMPORTANT LIMITATIONS:

2.1 NOT EMERGENCY SERVICES
- ${COMPANY_INFO.appName} is NOT an emergency response service
- We do NOT dispatch emergency responders
- We CANNOT guarantee response times
- We CANNOT provide medical, police, or fire services

2.2 TECHNOLOGY LIMITATIONS
- Features require internet connectivity
- GPS accuracy varies by device and location
- Features may not work in all locations
- Service outages may occur
- Battery life affects availability

2.3 HUMAN LIMITATIONS
- Emergency contacts may not respond
- Check-in reminders can be missed
- Alerts are only as useful as the response they receive

2.4 NO GUARANTEE OF SAFETY
- Verification reduces but does not eliminate risk
- We cannot verify real-time user behavior
- We cannot predict future behavior
- We cannot prevent all dangerous situations

2.5 DEPENDENT ON USER ACTION
- Features must be enabled and configured
- You must share accurate location
- You must respond to check-ins
- You must report concerns promptly`,
    },
    {
      id: 'user-responsibility',
      title: '3. Your Responsibility for Your Safety',
      content: `YOU are primarily responsible for your own safety. We strongly recommend:

3.1 BEFORE MEETINGS
- Meet in public places, especially initially
- Inform someone you trust of your plans
- Verify the other person's identity through the app
- Review profiles and reviews carefully
- Trust your instincts

3.2 DURING MEETINGS
- Keep your phone charged and accessible
- Stay in public areas when possible
- Have your own transportation
- Don't consume excessive alcohol or substances
- Maintain awareness of your surroundings

3.3 GENERAL PRECAUTIONS
- Don't share personal addresses prematurely
- Don't share financial information
- Don't send money to other users
- Report suspicious behavior immediately
- Leave situations that make you uncomfortable

3.4 USING SAFETY FEATURES
- Set up emergency contacts
- Enable location sharing
- Respond to safety check-ins
- Use the SOS feature when needed
- Keep the app updated`,
    },
    {
      id: 'verification-limitations',
      title: '4. Verification Limitations',
      content: `4.1 IDENTITY VERIFICATION
While we verify user identities, please understand:
- Documents can be forged
- People can change after verification
- Verification confirms identity, not behavior
- Not all users are verified

4.2 REVIEWS AND RATINGS
- Reviews are subjective
- Not all experiences are reviewed
- Fake reviews may occasionally exist
- A good rating doesn't guarantee safety

4.4 VERIFICATION BADGES
Verification badges indicate:
- The user has passed certain checks
- The checks were accurate at the time performed
- They do NOT guarantee safety or good behavior`,
    },
    {
      id: 'emergency-procedures',
      title: '5. Emergency Procedures',
      content: `5.1 IF YOU ARE IN IMMEDIATE DANGER
1. CALL 911 (or local emergency number) FIRST
2. Get to a safe location
3. Then use the app's SOS feature if possible
4. Contact emergency contacts

5.2 IF YOU FEEL UNSAFE BUT NOT IN IMMEDIATE DANGER
1. Leave the situation if possible
2. Go to a public place
3. Contact your emergency contacts
4. Use the app's SOS feature
5. Report the incident through the app

5.3 IF YOU WITNESS CONCERNING BEHAVIOR
1. Remove yourself from the situation
2. Call 911 if criminal activity is occurring
3. Report through the app
4. Provide as much detail as possible

5.4 AFTER AN INCIDENT
1. Ensure you are safe
2. Seek medical attention if needed
3. File a police report if appropriate
4. Report to us through the app
5. Document what happened
6. Seek support services if needed`,
    },
    {
      id: 'off-platform-activities',
      title: '6. Off-Platform Activities - Complete Disclaimer',
      content: `THIS IS A CRITICAL SECTION - PLEASE READ CAREFULLY

6.1 PLATFORM LIMITATIONS
${COMPANY_INFO.appName} is a technology platform that exists ONLY within the digital application. Our involvement ENDS when users transition to real-world, in-person interactions.

6.2 OFF-PLATFORM ACTIVITIES - NO RESPONSIBILITY
${COMPANY_INFO.name.toUpperCase()} HAS ABSOLUTELY NO RESPONSIBILITY, LIABILITY, OR INVOLVEMENT IN:

- In-person meetings between users
- Any physical interactions or activities
- Events occurring at meeting locations (restaurants, venues, etc.)
- Transportation to or from meetings
- Any communications outside the app (calls, texts, emails)
- Any activities during bookings
- Any harm, injury, or incidents during off-platform activities
- The conduct of users when they are not using the app
- Anything that happens in the physical/real world

6.3 YOU ASSUME ALL RISK
When you meet another user in person, YOU ASSUME COMPLETE AND TOTAL RISK for:
- Your personal safety and security
- Your property and belongings
- Your transportation
- Your choice of meeting location
- Your interactions with the other user
- Any activities you engage in
- Any consequences of the meeting

6.4 WE CANNOT PROTECT YOU OFF-PLATFORM
${COMPANY_INFO.name} CANNOT:
- Monitor real-world meetings
- Protect you during in-person interactions
- Control the behavior of other users
- Guarantee anyone's conduct
- Intervene in real-world situations
- Provide security or protection
- Verify real-time safety
- Prevent harmful situations

6.5 WAIVER OF CLAIMS
BY USING ${COMPANY_INFO.appName.toUpperCase()}, YOU EXPRESSLY WAIVE AND RELEASE ${COMPANY_INFO.name.toUpperCase()} FROM ALL CLAIMS, DAMAGES, LOSSES, AND LIABILITY ARISING FROM:
- Any off-platform meeting or interaction
- Any harm occurring during in-person meetings
- Any actions of other users in the real world
- Any incidents at meeting locations
- Any events following connection through our platform`,
    },
    {
      id: 'liability-disclaimer',
      title: '7. Limitation of Liability',
      content: `7.1 NO WARRANTY
THE SAFETY FEATURES ARE PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. WE DO NOT WARRANT THAT:
- The features will be available at all times
- The features will prevent harm
- Location data will be accurate
- Emergency contacts will respond
- Any particular outcome will result

7.2 ASSUMPTION OF RISK
By using ${COMPANY_INFO.appName}, you acknowledge that:
- Meeting strangers involves inherent risks
- Safety features reduce but cannot eliminate risk
- You assume responsibility for your safety decisions
- You agree to take reasonable precautions

7.3 LIMITATION OF LIABILITY
TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${COMPANY_INFO.name.toUpperCase()} SHALL NOT BE LIABLE FOR:
- Personal injury or death
- Property damage or loss
- Emotional distress
- Any harm resulting from your use of the Service
- Any failure of safety features
- Actions of other users
- Any off-platform activities, meetings, or interactions
- Any events occurring outside the application

This limitation applies regardless of the cause, including negligence.

7.4 INDEMNIFICATION
You agree to hold ${COMPANY_INFO.name} harmless from any claims arising from:
- Your use of the Service
- Your interactions with other users
- Your reliance on safety features
- Any harm you experience while using the Service
- Any off-platform meetings or activities`,
    },
    {
      id: 'third-party-services',
      title: '8. Third-Party Services',
      content: `7.1 EMERGENCY SERVICES
${COMPANY_INFO.appName} does not control and is not responsible for:
- 911 or other emergency services
- Response times of emergency services
- Actions of emergency responders
- Accuracy of emergency location systems

7.2 COMMUNICATION SERVICES
We rely on third parties for:
- SMS and push notifications
- Phone and internet connectivity
- GPS and location services

We are not responsible for failures of these third-party services.`,
    },
    {
      id: 'resources',
      title: '9. Safety Resources',
      content: `If you have experienced harm, these resources may help:

EMERGENCY
- Emergency: 911
- Non-emergency police: Contact your local department

CRISIS SUPPORT
- National Domestic Violence Hotline: 1-800-799-7233
- RAINN Sexual Assault Hotline: 1-800-656-4673
- Crisis Text Line: Text HOME to 741741
- National Suicide Prevention: 988

REPORTING
- FBI Internet Crime Complaint Center: ic3.gov
- FTC Consumer Complaints: ftc.gov/complaint

${COMPANY_INFO.appName} SUPPORT
- In-app reporting for platform issues
- Email: ${COMPANY_INFO.supportEmail}

These resources are provided for information only. We are not affiliated with these organizations.`,
    },
    {
      id: 'updates',
      title: '10. Updates to This Disclaimer',
      content: `We may update this Safety Disclaimer from time to time. We will notify you of material changes through the app.

Your continued use of the safety features after changes constitutes acceptance of the updated disclaimer.

Last Updated: February 1, 2026`,
    },
    {
      id: 'contact',
      title: '11. Contact Us',
      content: `For questions about safety or this disclaimer:

${COMPANY_INFO.name}
${COMPANY_INFO.address}

Email: ${COMPANY_INFO.supportEmail}
Website: ${COMPANY_INFO.website}

For safety emergencies, always contact 911 first.`,
    },
  ],
};
