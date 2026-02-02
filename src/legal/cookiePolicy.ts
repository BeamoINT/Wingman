/**
 * Cookie Policy
 * Cookie and tracking disclosure for Wingman app by Beamo LLC
 */

import type { LegalDocument } from './types';
import { COMPANY_INFO } from './types';

export const COOKIE_POLICY: LegalDocument = {
  id: 'cookie-policy',
  title: 'Cookie Policy',
  shortTitle: 'Cookies',
  lastUpdated: '2026-02-01',
  version: '1.0',
  effectiveDate: '2026-02-01',
  sections: [
    {
      id: 'introduction',
      title: '1. Introduction',
      content: `This Cookie Policy explains how ${COMPANY_INFO.name} ("Company", "we", "us", "our") uses cookies and similar tracking technologies when you use the ${COMPANY_INFO.appName} mobile application and related services (collectively, the "Service").

By using our Service, you consent to the use of cookies and similar technologies as described in this policy. If you do not agree with this policy, please disable cookies through your device settings or refrain from using our Service.`,
    },
    {
      id: 'what-are-cookies',
      title: '2. What Are Cookies and Similar Technologies?',
      content: `2.1 COOKIES
Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites and apps work more efficiently and to provide information to the owners.

2.2 MOBILE IDENTIFIERS
Mobile applications may use device identifiers (such as IDFA on iOS or Advertising ID on Android) instead of cookies to provide similar functionality.

2.3 LOCAL STORAGE
Local storage technologies (such as AsyncStorage in mobile apps) store data locally on your device and function similarly to cookies.

2.4 SESSION STORAGE
Session storage temporarily stores data that is deleted when you close the app or browser.

2.5 PIXELS AND BEACONS
These are small invisible graphics that may be used in emails or on websites to track user interactions.`,
    },
    {
      id: 'how-we-use',
      title: '3. How We Use Cookies and Similar Technologies',
      content: `We use cookies and similar technologies for the following purposes:

3.1 ESSENTIAL/NECESSARY
These are required for the basic functionality of our Service:
- Authentication and session management
- Remembering your login status
- Security features
- Load balancing

Purpose: Contract performance
Legal Basis: Necessary for Service operation

3.2 PREFERENCES/FUNCTIONALITY
These remember your settings and preferences:
- Language preferences
- Theme settings (dark mode, etc.)
- Accessibility preferences
- Notification settings

Purpose: Personalization
Legal Basis: Legitimate interests / Consent

3.3 ANALYTICS/PERFORMANCE
These help us understand how users interact with our Service:
- App usage patterns
- Feature popularity
- Performance monitoring
- Error tracking

Purpose: Service improvement
Legal Basis: Legitimate interests / Consent

3.4 ADVERTISING/MARKETING (Limited Use)
We may use limited tracking for:
- Measuring effectiveness of our own marketing
- Attribution of app installs

Purpose: Marketing
Legal Basis: Consent

Note: We do not sell your data to third-party advertisers or display third-party ads in the app.`,
    },
    {
      id: 'specific-technologies',
      title: '4. Specific Technologies We Use',
      content: `4.1 MOBILE APPLICATION

a) AsyncStorage
- Purpose: Store user preferences and session data
- Type: Persistent local storage
- Duration: Until cleared by user or app

b) SecureStore
- Purpose: Store sensitive data like authentication tokens
- Type: Encrypted local storage
- Duration: Until logout or app deletion

c) Device Identifiers
- Purpose: Analytics and app functionality
- Type: Device-level identifier
- Duration: Persistent until reset by user

4.2 ANALYTICS SERVICES

We may use the following analytics services:
- Expo Analytics (app performance and usage)
- Custom analytics (for service improvement)

These services collect:
- App version and device information
- Usage patterns and interactions
- Crash reports and errors
- Session duration

4.3 AUTHENTICATION SERVICES

Supabase Authentication:
- Purpose: User authentication and session management
- Data: Session tokens, refresh tokens
- Duration: Session-based (configurable)`,
    },
    {
      id: 'third-party',
      title: '5. Third-Party Cookies and Technologies',
      content: `5.1 THIRD-PARTY SERVICE PROVIDERS
We use third-party services that may use their own cookies or tracking technologies:

a) Supabase (Authentication & Database)
- Purpose: User authentication, data storage
- Privacy Policy: https://supabase.com/privacy

b) Payment Processors
- Purpose: Payment processing
- Their cookies are subject to their privacy policies

5.2 THIRD-PARTY LINKS
Our Service may contain links to third-party websites. We are not responsible for their cookie practices.

5.3 SOCIAL MEDIA
If we integrate social media features in the future, those platforms may use their own cookies subject to their privacy policies.`,
    },
    {
      id: 'your-choices',
      title: '6. Your Choices and How to Manage Cookies',
      content: `6.1 IN-APP SETTINGS
You can manage certain tracking preferences through:
- App Settings > Privacy
- Notification preferences
- Location sharing settings

6.2 DEVICE SETTINGS

iOS:
- Settings > Privacy & Security > Tracking (limit ad tracking)
- Settings > Safari > Privacy & Security (for web views)
- Settings > Privacy & Security > Analytics & Improvements

Android:
- Settings > Privacy > Ads (opt out of personalization)
- Settings > Google > Ads (reset advertising ID)
- Settings > Apps > [App Name] > Permissions

6.3 ANALYTICS OPT-OUT
You may opt out of analytics collection through app settings where available.

6.4 EFFECTS OF DISABLING
Disabling certain technologies may:
- Prevent you from using some features
- Require you to log in more frequently
- Affect app performance
- Limit personalization

6.5 ESSENTIAL TECHNOLOGIES
Some technologies are essential for the app to function and cannot be disabled without making the Service unavailable.`,
    },
    {
      id: 'data-retention',
      title: '7. Data Retention',
      content: `7.1 LOCAL DATA
Data stored locally on your device:
- Preferences: Retained until you clear app data or uninstall
- Session data: Cleared on logout
- Cache: Cleared periodically or manually

7.2 SERVER-SIDE DATA
Analytics and usage data:
- Aggregated analytics: May be retained indefinitely
- Individual session data: Typically 90 days
- Error logs: Typically 30 days

7.3 CLEARING YOUR DATA
You can clear locally stored data by:
- Using the "Clear Data" option in app settings
- Uninstalling and reinstalling the app
- Clearing app data through device settings`,
    },
    {
      id: 'updates',
      title: '8. Updates to This Policy',
      content: `We may update this Cookie Policy from time to time to reflect:
- Changes in our practices
- New technologies
- Legal requirements

We will notify you of material changes by:
- Posting the updated policy in the app
- Updating the "Last Updated" date
- Sending a notification where appropriate

Your continued use of the Service after changes constitutes acceptance of the updated policy.`,
    },
    {
      id: 'contact',
      title: '9. Contact Us',
      content: `If you have questions about this Cookie Policy or our use of cookies and similar technologies, please contact us:

${COMPANY_INFO.name}
${COMPANY_INFO.address}

Privacy Email: ${COMPANY_INFO.privacyEmail}
General Email: ${COMPANY_INFO.email}
Support: ${COMPANY_INFO.supportEmail}
Website: ${COMPANY_INFO.website}`,
    },
  ],
};
