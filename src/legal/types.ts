/**
 * Legal Document Types
 * Type definitions for all legal documents in the Wingman app.
 *
 * NOTE: Background check disclosure has been removed from the platform.
 */

export type LegalDocumentType =
  | 'terms-of-service'
  | 'privacy-policy'
  | 'community-guidelines'
  | 'cookie-policy'
  | 'acceptable-use'
  | 'refund-policy'
  | 'safety-disclaimer'
  | 'copyright-policy'
  | 'california-privacy'
  | 'electronic-signature'
  | 'companion-agreement';

export interface LegalSection {
  id: string;
  title: string;
  content: string;
  subsections?: LegalSection[];
}

export interface LegalDocument {
  id: LegalDocumentType;
  title: string;
  shortTitle: string;
  lastUpdated: string;
  version: string;
  effectiveDate: string;
  sections: LegalSection[];
}

export interface LegalDocumentMeta {
  id: LegalDocumentType;
  title: string;
  shortTitle: string;
  icon: string;
  description: string;
  requiresConsent: boolean;
}

export const LEGAL_DOCUMENT_META: Record<LegalDocumentType, LegalDocumentMeta> = {
  'terms-of-service': {
    id: 'terms-of-service',
    title: 'Terms of Service',
    shortTitle: 'Terms',
    icon: 'document-text',
    description: 'Our terms and conditions for using Wingman',
    requiresConsent: true,
  },
  'privacy-policy': {
    id: 'privacy-policy',
    title: 'Privacy Policy',
    shortTitle: 'Privacy',
    icon: 'shield-checkmark',
    description: 'How we collect, use, and protect your data',
    requiresConsent: true,
  },
  'community-guidelines': {
    id: 'community-guidelines',
    title: 'Community Guidelines',
    shortTitle: 'Guidelines',
    icon: 'people',
    description: 'Standards for our community',
    requiresConsent: false,
  },
  'cookie-policy': {
    id: 'cookie-policy',
    title: 'Cookie Policy',
    shortTitle: 'Cookies',
    icon: 'analytics',
    description: 'How we use cookies and tracking',
    requiresConsent: false,
  },
  'acceptable-use': {
    id: 'acceptable-use',
    title: 'Acceptable Use Policy',
    shortTitle: 'Acceptable Use',
    icon: 'checkmark-circle',
    description: 'Permitted and prohibited uses of our service',
    requiresConsent: false,
  },
  'refund-policy': {
    id: 'refund-policy',
    title: 'Refund Policy',
    shortTitle: 'Refunds',
    icon: 'card',
    description: 'Our refund and cancellation policies',
    requiresConsent: false,
  },
  'safety-disclaimer': {
    id: 'safety-disclaimer',
    title: 'Safety Disclaimer',
    shortTitle: 'Safety',
    icon: 'warning',
    description: 'Important safety information',
    requiresConsent: false,
  },
  'copyright-policy': {
    id: 'copyright-policy',
    title: 'DMCA & Copyright Policy',
    shortTitle: 'Copyright',
    icon: 'copy',
    description: 'Copyright and DMCA takedown procedures',
    requiresConsent: false,
  },
  'california-privacy': {
    id: 'california-privacy',
    title: 'California Privacy Notice',
    shortTitle: 'CA Privacy',
    icon: 'location',
    description: 'CCPA/CPRA privacy rights for California residents',
    requiresConsent: false,
  },
  'electronic-signature': {
    id: 'electronic-signature',
    title: 'Electronic Signature Consent',
    shortTitle: 'E-Signature',
    icon: 'create',
    description: 'E-SIGN Act consent for electronic agreements',
    requiresConsent: true,
  },
  'companion-agreement': {
    id: 'companion-agreement',
    title: 'Wingman Service Agreement',
    shortTitle: 'Wingman Terms',
    icon: 'briefcase',
    description: 'Terms for wingmen providing services on Wingman',
    requiresConsent: true,
  },
};

export const COMPANY_INFO = {
  name: 'Beamo LLC',
  appName: 'Wingman',
  email: 'legal@beamollc.com',
  supportEmail: 'support@beamollc.com',
  privacyEmail: 'privacy@beamollc.com',
  address: '251 Little Falls Drive, Wilmington, DE 19808',
  state: 'Delaware',
  country: 'United States',
  website: 'https://wingmanapp.com',
} as const;
