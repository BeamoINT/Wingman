/**
 * Legal Documents Index
 * Export all legal documents and types for the Wingman app
 *
 * NOTE: Background check disclosure has been removed from the platform.
 */

// Types
export * from './types';

// Legal Documents
export { TERMS_OF_SERVICE } from './termsOfService';
export { PRIVACY_POLICY } from './privacyPolicy';
export { COMMUNITY_GUIDELINES } from './communityGuidelines';
export { COOKIE_POLICY } from './cookiePolicy';
export { ACCEPTABLE_USE_POLICY } from './acceptableUsePolicy';
export { REFUND_POLICY } from './refundPolicy';
export { SAFETY_DISCLAIMER } from './safetyDisclaimer';
export { COPYRIGHT_POLICY } from './copyrightPolicy';
export { CALIFORNIA_PRIVACY_NOTICE } from './californiaPrivacyNotice';
export { ELECTRONIC_SIGNATURE_CONSENT } from './electronicSignatureConsent';
export { COMPANION_AGREEMENT } from './companionAgreement';

// Import all documents for the collection
import { TERMS_OF_SERVICE } from './termsOfService';
import { PRIVACY_POLICY } from './privacyPolicy';
import { COMMUNITY_GUIDELINES } from './communityGuidelines';
import { COOKIE_POLICY } from './cookiePolicy';
import { ACCEPTABLE_USE_POLICY } from './acceptableUsePolicy';
import { REFUND_POLICY } from './refundPolicy';
import { SAFETY_DISCLAIMER } from './safetyDisclaimer';
import { COPYRIGHT_POLICY } from './copyrightPolicy';
import { CALIFORNIA_PRIVACY_NOTICE } from './californiaPrivacyNotice';
import { ELECTRONIC_SIGNATURE_CONSENT } from './electronicSignatureConsent';
import { COMPANION_AGREEMENT } from './companionAgreement';
import type { LegalDocument, LegalDocumentType } from './types';

/**
 * Collection of all legal documents
 */
export const LEGAL_DOCUMENTS: Record<LegalDocumentType, LegalDocument> = {
  'terms-of-service': TERMS_OF_SERVICE,
  'privacy-policy': PRIVACY_POLICY,
  'community-guidelines': COMMUNITY_GUIDELINES,
  'cookie-policy': COOKIE_POLICY,
  'acceptable-use': ACCEPTABLE_USE_POLICY,
  'refund-policy': REFUND_POLICY,
  'safety-disclaimer': SAFETY_DISCLAIMER,
  'copyright-policy': COPYRIGHT_POLICY,
  'california-privacy': CALIFORNIA_PRIVACY_NOTICE,
  'electronic-signature': ELECTRONIC_SIGNATURE_CONSENT,
  'companion-agreement': COMPANION_AGREEMENT,
};

/**
 * Get a legal document by type
 */
export function getLegalDocument(type: LegalDocumentType): LegalDocument {
  return LEGAL_DOCUMENTS[type];
}

/**
 * Get all legal documents as an array
 */
export function getAllLegalDocuments(): LegalDocument[] {
  return Object.values(LEGAL_DOCUMENTS);
}

/**
 * Legal documents that require explicit consent during signup
 */
export const CONSENT_REQUIRED_DOCUMENTS: LegalDocumentType[] = [
  'terms-of-service',
  'privacy-policy',
];

/**
 * Get legal documents for display in settings
 */
export function getSettingsLegalDocuments(): LegalDocument[] {
  return [
    TERMS_OF_SERVICE,
    PRIVACY_POLICY,
    COMMUNITY_GUIDELINES,
    REFUND_POLICY,
    SAFETY_DISCLAIMER,
    COOKIE_POLICY,
    ACCEPTABLE_USE_POLICY,
    COPYRIGHT_POLICY,
    CALIFORNIA_PRIVACY_NOTICE,
    ELECTRONIC_SIGNATURE_CONSENT,
  ];
}

/**
 * Get companion-specific legal documents
 */
export function getCompanionLegalDocuments(): LegalDocument[] {
  return [
    COMPANION_AGREEMENT,
    TERMS_OF_SERVICE,
    PRIVACY_POLICY,
  ];
}
