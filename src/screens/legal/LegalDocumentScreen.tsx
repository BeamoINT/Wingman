/**
 * LegalDocumentScreen
 *
 * Generic screen for displaying legal documents with markdown-style content.
 */

import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLegalDocument, LEGAL_DOCUMENT_META } from '../../legal';
import type { LegalDocumentType, LegalSection } from '../../legal/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type LegalDocumentRouteProp = RouteProp<RootStackParamList, 'LegalDocument'>;

interface LegalDocumentScreenProps {
  documentType?: LegalDocumentType;
  showAcceptButton?: boolean;
  onAccept?: () => void;
}

function applyWingmanBranding(text: string): string {
  const protectedEmails: string[] = [];
  const withProtectedEmails = text.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    (email) => {
      const token = `__EMAIL_${protectedEmails.length}__`;
      protectedEmails.push(email);
      return token;
    }
  );

  const branded = withProtectedEmails
    .replace(/\bCOMPANIONS\b/g, 'WINGMEN')
    .replace(/\bCOMPANION\b/g, 'WINGMAN')
    .replace(/\bCompanions\b/g, 'Wingmen')
    .replace(/\bCompanion\b/g, 'Wingman')
    .replace(/\bcompanions\b/g, 'wingmen')
    .replace(/\bcompanion\b/g, 'wingman');

  return branded.replace(/__EMAIL_(\d+)__/g, (_, index) => {
    const original = protectedEmails[Number(index)];
    return typeof original === 'string' ? original : '';
  });
}

export const LegalDocumentScreen: React.FC<LegalDocumentScreenProps> = ({
  documentType: propDocumentType,
  showAcceptButton = false,
  onAccept,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<LegalDocumentRouteProp>();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);

  // Get document type from props or route params
  const documentType = propDocumentType || route.params?.documentType;

  if (!documentType) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Document not found</Text>
      </View>
    );
  }

  const document = getLegalDocument(documentType);
  const meta = LEGAL_DOCUMENT_META[documentType];

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleAccept = async () => {
    if (onAccept) {
      setIsLoading(true);
      await haptics.medium();
      try {
        await onAccept();
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderSection = (section: LegalSection, level: number = 0) => {
    return (
      <View key={section.id} style={[styles.section, level > 0 && styles.subsection]}>
        <Text style={[styles.sectionTitle, level > 0 && styles.subsectionTitle]}>
          {applyWingmanBranding(section.title)}
        </Text>
        <Text style={styles.sectionContent}>{applyWingmanBranding(section.content)}</Text>
        {section.subsections?.map((subsection) => renderSection(subsection, level + 1))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {applyWingmanBranding(document.shortTitle)}
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          showAcceptButton && { paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={true}
      >
        {/* Document Header */}
        <View style={styles.documentHeader}>
          <View style={styles.iconContainer}>
            <Ionicons
              name={meta.icon as any}
              size={32}
              color={colors.primary.blue}
            />
          </View>
          <Text style={styles.documentTitle}>{applyWingmanBranding(document.title)}</Text>
          <Text style={styles.documentMeta}>
            Last Updated: {document.lastUpdated} | Version {document.version}
          </Text>
        </View>

        {/* Document Content */}
        <View style={styles.content}>
          {document.sections.map((section) => renderSection(section))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            If you have questions about this document, please contact us at{' '}
            <Text style={styles.footerLink}>legal@beamollc.com</Text>
          </Text>
        </View>
      </ScrollView>

      {/* Accept Button */}
      {showAcceptButton && (
        <View
          style={[
            styles.acceptContainer,
            { paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <TouchableOpacity
            style={[styles.acceptButton, isLoading && styles.acceptButtonDisabled]}
            onPress={handleAccept}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.text.inverse}
                />
                <Text style={styles.acceptButtonText}>I Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  documentHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  documentTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  documentMeta: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  subsection: {
    marginLeft: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  subsectionTitle: {
    ...typography.presets.label,
    color: colors.text.secondary,
  },
  sectionContent: {
    ...typography.presets.body,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLink: {
    color: colors.primary.blue,
  },
  acceptContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.blue,
    paddingVertical: spacing.lg,
    borderRadius: spacing.radius.lg,
    gap: spacing.sm,
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    ...typography.presets.button,
    color: colors.text.inverse,
  },
});

export default LegalDocumentScreen;
