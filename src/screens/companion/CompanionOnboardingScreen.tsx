/**
 * Companion Onboarding Screen
 *
 * 7-step wizard for becoming a companion:
 * 1. Welcome / Overview
 * 2. Requirements Check
 * 3. ID Document Upload
 * 4. Selfie Verification
 * 5. Profile Setup
 * 6. Companion Agreement
 * 7. Review & Submit
 */

import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert,
    KeyboardAvoidingView,
    Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ProgressBar } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useRequirements } from '../../context/RequirementsContext';
import { useTheme } from '../../context/ThemeContext';
import { useVerification } from '../../context/VerificationContext';
import { AgreementStep } from './onboarding/AgreementStep';
import { IdStep } from './onboarding/IdStep';
import { PrerequisitesStep } from './onboarding/PrerequisitesStep';
import { ProfileStep } from './onboarding/ProfileStep';
import { ReviewStep } from './onboarding/ReviewStep';
import { SelfieStep } from './onboarding/SelfieStep';
import { WelcomeStep } from './onboarding/WelcomeStep';
import {
    createCompanionApplication, getCompanionApplication, submitCompanionApplication, updateCompanionApplication, uploadGalleryPhoto, uploadIdDocument,
    uploadSelfie
} from '../../services/api/companionApplicationApi';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type {
    CompanionOnboardingData, CompanionSpecialty, IdDocumentType, RootStackParamList
} from '../../types';
import { defaultCompanionOnboardingData } from '../../types';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CompanionOnboarding'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'CompanionOnboarding'>;

const TOTAL_STEPS = 7;
const HOURLY_RATE_MIN = 15;
const HOURLY_RATE_MAX = 200;

const SPECIALTIES: { label: string; value: CompanionSpecialty; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Social Events', value: 'social-events', icon: 'people' },
  { label: 'Dining', value: 'dining', icon: 'restaurant' },
  { label: 'Nightlife', value: 'nightlife', icon: 'wine' },
  { label: 'Movies', value: 'movies', icon: 'film' },
  { label: 'Concerts', value: 'concerts', icon: 'musical-notes' },
  { label: 'Sports', value: 'sports', icon: 'football' },
  { label: 'Outdoor', value: 'outdoor-activities', icon: 'leaf' },
  { label: 'Shopping', value: 'shopping', icon: 'bag' },
  { label: 'Travel', value: 'travel', icon: 'airplane' },
  { label: 'Coffee & Chat', value: 'coffee-chat', icon: 'cafe' },
  { label: 'Workout', value: 'workout-buddy', icon: 'fitness' },
  { label: 'Networking', value: 'professional-networking', icon: 'briefcase' },
  { label: 'Emotional Support', value: 'emotional-support', icon: 'heart' },
  { label: 'Safety', value: 'safety-companion', icon: 'shield' },
];

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi',
];

const ID_TYPES: { label: string; value: IdDocumentType; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Driver's License", value: 'drivers_license', icon: 'car' },
  { label: 'Passport', value: 'passport', icon: 'airplane' },
  { label: 'National ID', value: 'national_id', icon: 'card' },
];

export const CompanionOnboardingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors, spacing } = tokens;
  const { user } = useAuth();
  const { phoneVerified } = useVerification();
  const { checkCompanionRequirements, acceptCompanionAgreement } = useRequirements();

  const [currentStep, setCurrentStep] = useState(route.params?.resumeStep ?? 1);
  const [data, setData] = useState<CompanionOnboardingData>(defaultCompanionOnboardingData);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  // Load existing draft on mount
  useEffect(() => {
    (async () => {
      const { application } = await getCompanionApplication();
      if (application && application.status === 'draft') {
        setApplicationId(application.id);
        setData({
          idDocumentUri: '',
          idDocumentType: application.idDocumentType || 'drivers_license',
          selfieUri: '',
          specialties: application.specialties as CompanionSpecialty[],
          hourlyRate: application.hourlyRate || 25,
          about: application.about || '',
          languages: application.languages || [],
          gallery: [],
        });
        if (application.companionAgreementAccepted) {
          setAgreementAccepted(true);
        }
      }
    })();
  }, []);

  const handleBack = async () => {
    await haptics.light();
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError('');
    } else {
      navigation.goBack();
    }
  };

  const handleNext = async () => {
    await haptics.medium();
    setError('');

    if (!validateCurrentStep()) return;

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 2: {
        const reqs = checkCompanionRequirements();
        const baseMet = reqs.isAuthenticated.met && reqs.emailVerified.met &&
          phoneVerified && reqs.profileComplete.met;
        if (!baseMet) {
          setError('Please complete all prerequisites before continuing');
          return false;
        }
        return true;
      }
      case 3:
        if (!data.idDocumentUri) {
          setError('Please upload your ID document');
          return false;
        }
        return true;
      case 4:
        if (!data.selfieUri) {
          setError('Please take a selfie for verification');
          return false;
        }
        return true;
      case 5:
        if (data.specialties.length < 2) {
          setError('Please select at least 2 specialties');
          return false;
        }
        if (data.hourlyRate < HOURLY_RATE_MIN || data.hourlyRate > HOURLY_RATE_MAX) {
          setError(`Hourly rate must be between $${HOURLY_RATE_MIN} and $${HOURLY_RATE_MAX}`);
          return false;
        }
        if (data.about.length < 50) {
          setError('About section must be at least 50 characters');
          return false;
        }
        if (data.languages.length === 0) {
          setError('Please select at least one language');
          return false;
        }
        return true;
      case 6:
        if (!agreementAccepted) {
          setError('Please accept the Wingman Service Agreement');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  // ===========================================
  // Image Handlers
  // ===========================================

  const pickImage = async (source: 'camera' | 'library', forField: 'id' | 'selfie' | 'gallery') => {
    let permission;
    if (source === 'camera') {
      permission = await ImagePicker.requestCameraPermissionsAsync();
    } else {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    if (permission.status !== 'granted') {
      Alert.alert('Permission Required', `Please allow ${source === 'camera' ? 'camera' : 'photo library'} access.`);
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: forField !== 'id',
      quality: 0.85,
    };

    if (source === 'camera' && forField === 'selfie') {
      (options as any).cameraType = ImagePicker.CameraType.front;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      await haptics.success();

      if (forField === 'id') {
        setData(prev => ({ ...prev, idDocumentUri: uri }));
      } else if (forField === 'selfie') {
        setData(prev => ({ ...prev, selfieUri: uri }));
      } else {
        setData(prev => ({ ...prev, gallery: [...prev.gallery, uri] }));
      }
    }
  };

  const removeGalleryPhoto = (index: number) => {
    setData(prev => ({
      ...prev,
      gallery: prev.gallery.filter((_, i) => i !== index),
    }));
  };

  const toggleSpecialty = (value: CompanionSpecialty) => {
    setData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(value)
        ? prev.specialties.filter(s => s !== value)
        : [...prev.specialties, value],
    }));
  };

  const toggleLanguage = (lang: string) => {
    setData(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang],
    }));
  };

  // ===========================================
  // Submit
  // ===========================================

  const handleSubmit = async () => {
    await haptics.heavy();
    if (!validateCurrentStep()) return;
    if (!user) return;

    setIsSubmitting(true);
    setError('');

    try {
      // 1. Create application if needed
      let appId = applicationId;
      if (!appId) {
        const { application, error: createErr } = await createCompanionApplication();
        if (createErr || !application) {
          throw new Error(createErr?.message || 'Failed to create application');
        }
        appId = application.id;
        setApplicationId(appId);
      }

      // 2. Upload ID document
      const { url: idDocUrl, error: idErr } = await uploadIdDocument(user.id, data.idDocumentUri);
      if (idErr || !idDocUrl) throw new Error('Failed to upload ID document. Please try again.');

      // 3. Upload selfie
      const { url: selfieUrl, error: selfieErr } = await uploadSelfie(user.id, data.selfieUri);
      if (selfieErr || !selfieUrl) throw new Error('Failed to upload selfie. Please try again.');

      // 4. Upload gallery photos
      const galleryUrls: string[] = [];
      for (let i = 0; i < data.gallery.length; i++) {
        const { url } = await uploadGalleryPhoto(user.id, data.gallery[i], i);
        if (url) galleryUrls.push(url);
      }

      // 5. Update application with all data
      const { error: updateErr } = await updateCompanionApplication(appId, {
        id_document_url: idDocUrl,
        id_document_type: data.idDocumentType,
        selfie_url: selfieUrl,
        specialties: data.specialties,
        hourly_rate: data.hourlyRate,
        about: data.about,
        languages: data.languages,
        gallery: galleryUrls,
        companion_agreement_accepted: true,
        companion_agreement_accepted_at: new Date().toISOString(),
      });
      if (updateErr) throw new Error('Failed to save application. Please try again.');

      // 6. Submit for review
      const { error: submitErr } = await submitCompanionApplication(appId);
      if (submitErr) throw new Error('Failed to submit application. Please try again.');

      // 7. Accept agreement in context
      await acceptCompanionAgreement();

      await haptics.celebration();

      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }, { name: 'CompanionApplicationStatus' }],
      });
    } catch (err) {
      await haptics.error();
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===========================================
  // Step Renderers
  // ===========================================

  const renderWelcomeStep = () => (
    <View style={styles.stepContainer}>
      <WelcomeStep />
    </View>
  );

  const renderRequirementsStep = () => {
    const reqs = checkCompanionRequirements();
    const prerequisites = [
      {
        label: 'Email Verified',
        met: reqs.emailVerified.met,
        icon: 'mail' as const,
        onComplete: () => navigation.navigate('Verification'),
      },
      {
        label: 'Phone Verified',
        met: phoneVerified,
        icon: 'call' as const,
        onComplete: () => navigation.navigate('Verification'),
      },
      {
        label: 'Profile Complete',
        met: reqs.profileComplete.met,
        icon: 'person' as const,
        onComplete: () => navigation.navigate('EditProfile'),
      },
    ];

    const upcomingSteps = [
      { label: 'Upload Government ID', icon: 'card' as const },
      { label: 'Selfie Verification', icon: 'camera' as const },
      { label: 'Set Up Wingman Profile', icon: 'create' as const },
      { label: 'Accept Wingman Agreement', icon: 'document-text' as const },
    ];

    return (
      <View style={styles.stepContainer}>
        <PrerequisitesStep prerequisites={prerequisites} upcomingSteps={upcomingSteps} />
      </View>
    );
  };

  const renderIdVerificationStep = () => (
    <View style={styles.stepContainer}>
      <IdStep
        idTypes={ID_TYPES}
        selectedType={data.idDocumentType}
        idDocumentUri={data.idDocumentUri}
        onSelectType={(idDocumentType) => setData((prev) => ({ ...prev, idDocumentType }))}
        onRemove={() => setData((prev) => ({ ...prev, idDocumentUri: '' }))}
        onPickCamera={() => {
          void pickImage('camera', 'id');
        }}
        onPickLibrary={() => {
          void pickImage('library', 'id');
        }}
      />
    </View>
  );

  const renderSelfieStep = () => (
    <View style={styles.stepContainer}>
      <SelfieStep
        selfieUri={data.selfieUri}
        onCapture={() => {
          void pickImage('camera', 'selfie');
        }}
        onRemove={() => setData((prev) => ({ ...prev, selfieUri: '' }))}
      />
    </View>
  );

  const renderProfileSetupStep = () => (
    <View style={styles.stepContainer}>
      <ProfileStep
        specialties={SPECIALTIES}
        languages={LANGUAGES}
        selectedSpecialties={data.specialties}
        hourlyRate={data.hourlyRate}
        about={data.about}
        selectedLanguages={data.languages}
        gallery={data.gallery}
        minRate={HOURLY_RATE_MIN}
        maxRate={HOURLY_RATE_MAX}
        onToggleSpecialty={toggleSpecialty}
        onHourlyRateChange={(hourlyRate) => setData((prev) => ({ ...prev, hourlyRate }))}
        onAboutChange={(about) => setData((prev) => ({ ...prev, about }))}
        onToggleLanguage={toggleLanguage}
        onAddGallery={() => {
          void pickImage('library', 'gallery');
        }}
        onRemoveGallery={removeGalleryPhoto}
      />
    </View>
  );

  const renderAgreementStep = () => (
    <View style={styles.stepContainer}>
      <AgreementStep
        accepted={agreementAccepted}
        onToggleAccepted={() => {
          void haptics.selection();
          setAgreementAccepted((previous) => !previous);
        }}
      />
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.stepContainer}>
      <ReviewStep data={data} idTypes={ID_TYPES} />
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderWelcomeStep();
      case 2: return renderRequirementsStep();
      case 3: return renderIdVerificationStep();
      case 4: return renderSelfieStep();
      case 5: return renderProfileSetupStep();
      case 6: return renderAgreementStep();
      case 7: return renderReviewStep();
      default: return null;
    }
  };

  const getButtonTitle = () => {
    if (currentStep === TOTAL_STEPS) return isSubmitting ? 'Submitting...' : 'Submit Application';
    return 'Continue';
  };

  const isNextDisabled = () => {
    if (isSubmitting) return true;
    switch (currentStep) {
      case 2: {
        const reqs = checkCompanionRequirements();
        return !(reqs.isAuthenticated.met && reqs.emailVerified.met &&
          phoneVerified && reqs.profileComplete.met);
      }
      case 3: return !data.idDocumentUri;
      case 4: return !data.selfieUri;
      case 5: return data.specialties.length < 2 || data.hourlyRate < HOURLY_RATE_MIN ||
        data.about.length < 50 || data.languages.length === 0;
      case 6: return !agreementAccepted;
      default: return false;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.progressWrapper}>
          <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepContent()}

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.status.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title={getButtonTitle()}
          onPress={currentStep === TOTAL_STEPS ? handleSubmit : handleNext}
          variant="primary"
          fullWidth
          disabled={isNextDisabled()}
          loading={isSubmitting}
          icon={currentStep === TOTAL_STEPS ? 'paper-plane' : 'arrow-forward'}
          iconPosition="right"
        />
      </View>

      {isSubmitting && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.primary.blue} />
          <Text style={styles.overlayText}>Uploading documents and submitting...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

// ===========================================
// Styles
// ===========================================

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrapper: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 120,
  },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },

  // Step containers
  stepContainer: {
    paddingTop: spacing.md,
  },
  stepTitle: {
    ...typography.presets.h2,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  stepDescription: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },

  // Welcome
  welcomeBanner: {
    borderRadius: spacing.radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  welcomeTitle: {
    ...typography.presets.h2,
    color: colors.primary.darkBlack,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    ...typography.presets.body,
    color: colors.primary.darkBlack,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  infoSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  howItWorksItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  howItWorksIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  howItWorksContent: {
    flex: 1,
  },
  howItWorksTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold as any,
  },
  howItWorksDesc: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  earningsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
  },
  earningsTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold as any,
  },
  earningsDesc: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
    marginTop: 4,
    lineHeight: 18,
  },

  // Requirements
  allMetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.successLight,
    padding: spacing.md,
    borderRadius: spacing.radius.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  allMetText: {
    ...typography.presets.body,
    color: colors.status.success,
    fontWeight: typography.weights.semibold as any,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  requirementIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  requirementLabel: {
    ...typography.presets.body,
    color: colors.text.secondary,
    flex: 1,
  },
  requirementLabelMet: {
    color: colors.text.primary,
  },
  requirementAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary.blueSoft,
    borderRadius: spacing.radius.md,
  },
  requirementActionText: {
    ...typography.presets.caption,
    color: colors.primary.blue,
    fontWeight: typography.weights.semibold as any,
  },

  // ID & Selfie
  fieldLabel: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold as any,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  fieldHint: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  uploadOptions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  uploadOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
    gap: spacing.sm,
  },
  uploadOptionText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: spacing.radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.background.card,
  },
  idPreview: {
    width: '100%',
    height: 220,
    borderRadius: spacing.radius.xl,
  },
  selfiePreview: {
    width: '100%',
    height: 300,
    borderRadius: spacing.radius.xl,
  },
  retakeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.background.primary,
    borderRadius: 16,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.status.infoLight,
    borderRadius: spacing.radius.lg,
  },
  tipText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },

  // Selfie
  selfieCapture: {
    borderRadius: spacing.radius.xl,
    overflow: 'hidden',
  },
  selfiePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.massive,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
    gap: spacing.md,
  },
  selfiePlaceholderText: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  guidelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  guidelineText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },

  // Profile
  rateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.lg,
  },
  ratePrefix: {
    ...typography.presets.h3,
    color: colors.primary.blue,
    marginRight: spacing.xs,
  },
  rateInput: {
    ...typography.presets.h3,
    color: colors.text.primary,
    flex: 1,
    paddingVertical: spacing.md,
  },
  rateSuffix: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  textArea: {
    ...typography.presets.body,
    color: colors.text.primary,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.lg,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  galleryItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: spacing.radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  galleryRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.background.primary,
    borderRadius: 12,
  },
  galleryAdd: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Agreement
  agreementCard: {
    maxHeight: 350,
    overflow: 'hidden',
  },
  agreementScroll: {
    padding: spacing.lg,
  },
  agreementHeading: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  agreementSection: {
    marginBottom: spacing.lg,
  },
  agreementSectionTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold as any,
    marginBottom: spacing.xs,
  },
  agreementText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  checkboxLabel: {
    ...typography.presets.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 22,
  },

  // Review
  summaryCard: {
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  summaryLabel: {
    ...typography.presets.body,
    color: colors.text.secondary,
    flex: 1,
  },
  summaryValue: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium as any,
  },
  reviewNote: {
    padding: spacing.lg,
  },
  reviewNoteText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },

  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.errorLight,
    padding: spacing.md,
    borderRadius: spacing.radius.lg,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.presets.bodySmall,
    color: colors.status.error,
    flex: 1,
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  overlayText: {
    ...typography.presets.body,
    color: colors.text.primary,
  },
});
