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
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert,
    Image,
    KeyboardAvoidingView,
    Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, ProgressBar, SelectableChip } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useRequirements } from '../../context/RequirementsContext';
import { useVerification } from '../../context/VerificationContext';
import {
    createCompanionApplication, getCompanionApplication, submitCompanionApplication, updateCompanionApplication, uploadGalleryPhoto, uploadIdDocument,
    uploadSelfie
} from '../../services/api/companionApplicationApi';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
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
      <LinearGradient
        colors={colors.gradients.premium}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.welcomeBanner}
      >
        <Ionicons name="people" size={40} color={colors.primary.darkBlack} />
        <Text style={styles.welcomeTitle}>Become a Wingman</Text>
        <Text style={styles.welcomeSubtitle}>
          Earn money by being a great friend. Set your own hours, choose your activities, and get paid for spending time with others.
        </Text>
      </LinearGradient>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        {[
          { icon: 'shield-checkmark' as const, title: 'Verify Your Identity', desc: 'Upload your ID and take a selfie for safety' },
          { icon: 'person' as const, title: 'Set Up Your Profile', desc: 'Choose specialties, set your rate, and tell clients about yourself' },
          { icon: 'document-text' as const, title: 'Accept Agreement', desc: 'Review and accept the Wingman Service Agreement' },
          { icon: 'checkmark-circle' as const, title: 'Get Approved', desc: 'Our team reviews applications within 1-3 business days' },
        ].map((item, i) => (
          <View key={i} style={styles.howItWorksItem}>
            <View style={styles.howItWorksIcon}>
              <Ionicons name={item.icon} size={20} color={colors.primary.blue} />
            </View>
            <View style={styles.howItWorksContent}>
              <Text style={styles.howItWorksTitle}>{item.title}</Text>
              <Text style={styles.howItWorksDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <Card variant="outlined" style={styles.earningsCard}>
        <Ionicons name="cash-outline" size={24} color={colors.primary.blue} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.earningsTitle}>Earning Potential</Text>
          <Text style={styles.earningsDesc}>
            Wingmen earn $15-200/hour depending on specialty and experience. You keep 90% of every booking.
          </Text>
        </View>
      </Card>
    </View>
  );

  const renderRequirementsStep = () => {
    const reqs = checkCompanionRequirements();
    const prerequisites = [
      { label: 'Email Verified', met: reqs.emailVerified.met, icon: 'mail' as const, nav: 'Verification' as const },
      { label: 'Phone Verified', met: phoneVerified, icon: 'call' as const, nav: 'Verification' as const },
      { label: 'Profile Complete', met: reqs.profileComplete.met, icon: 'person' as const, nav: 'EditProfile' as const },
    ];

    const upcomingSteps = [
      { label: 'Upload Government ID', icon: 'card' as const },
      { label: 'Selfie Verification', icon: 'camera' as const },
      { label: 'Set Up Wingman Profile', icon: 'create' as const },
      { label: 'Accept Wingman Agreement', icon: 'document-text' as const },
    ];

    const allPrereqsMet = prerequisites.every(r => r.met);

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Prerequisites</Text>
        <Text style={styles.stepDescription}>
          Complete these before starting your Wingman application.
        </Text>

        {allPrereqsMet && (
          <View style={styles.allMetBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
            <Text style={styles.allMetText}>All prerequisites met</Text>
          </View>
        )}

        {prerequisites.map((req, i) => (
          <View key={i} style={styles.requirementRow}>
            <View style={[styles.requirementIcon, { backgroundColor: req.met ? colors.status.successLight : colors.background.tertiary }]}>
              <Ionicons name={req.icon} size={18} color={req.met ? colors.status.success : colors.text.tertiary} />
            </View>
            <Text style={[styles.requirementLabel, req.met && styles.requirementLabelMet]}>{req.label}</Text>
            {req.met ? (
              <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
            ) : (
              <TouchableOpacity
                onPress={() => navigation.navigate(req.nav as any)}
                style={styles.requirementAction}
              >
                <Text style={styles.requirementActionText}>Complete</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <Text style={[styles.stepTitle, { marginTop: spacing.xl, fontSize: 16 }]}>
          What You'll Complete
        </Text>
        <Text style={[styles.stepDescription, { marginBottom: spacing.md }]}>
          The following steps are part of this application process.
        </Text>

        {upcomingSteps.map((step, i) => (
          <View key={i} style={styles.requirementRow}>
            <View style={[styles.requirementIcon, { backgroundColor: colors.background.tertiary }]}>
              <Ionicons name={step.icon} size={18} color={colors.text.secondary} />
            </View>
            <Text style={styles.requirementLabel}>{step.label}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.text.tertiary} />
          </View>
        ))}
      </View>
    );
  };

  const renderIdVerificationStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>ID Verification</Text>
      <Text style={styles.stepDescription}>
        Upload a clear photo of your government-issued ID. This helps keep our community safe and trusted.
      </Text>

      <Text style={styles.fieldLabel}>Document Type</Text>
      <View style={styles.chipsRow}>
        {ID_TYPES.map((type) => (
          <SelectableChip
            key={type.value}
            label={type.label}
            icon={type.icon}
            selected={data.idDocumentType === type.value}
            onPress={() => setData(prev => ({ ...prev, idDocumentType: type.value }))}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Upload Document</Text>

      {data.idDocumentUri ? (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: data.idDocumentUri }} style={styles.idPreview} resizeMode="contain" />
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={() => setData(prev => ({ ...prev, idDocumentUri: '' }))}
          >
            <Ionicons name="close-circle" size={24} color={colors.status.error} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.uploadOptions}>
          <TouchableOpacity
            style={styles.uploadOption}
            onPress={() => pickImage('camera', 'id')}
          >
            <Ionicons name="camera" size={32} color={colors.primary.blue} />
            <Text style={styles.uploadOptionText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.uploadOption}
            onPress={() => pickImage('library', 'id')}
          >
            <Ionicons name="images" size={32} color={colors.primary.blue} />
            <Text style={styles.uploadOptionText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tipCard}>
        <Ionicons name="information-circle" size={18} color={colors.primary.blue} />
        <Text style={styles.tipText}>
          Make sure all text on the document is clearly legible. Avoid glare and shadows.
        </Text>
      </View>
    </View>
  );

  const renderSelfieStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Selfie Verification</Text>
      <Text style={styles.stepDescription}>
        Take a clear selfie. Your face will be compared against the photo on your ID to verify your identity.
      </Text>

      {data.selfieUri ? (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: data.selfieUri }} style={styles.selfiePreview} />
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={() => setData(prev => ({ ...prev, selfieUri: '' }))}
          >
            <Ionicons name="close-circle" size={24} color={colors.status.error} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.selfieCapture}
          onPress={() => pickImage('camera', 'selfie')}
        >
          <View style={styles.selfiePlaceholder}>
            <Ionicons name="camera" size={48} color={colors.primary.blue} />
            <Text style={styles.selfiePlaceholderText}>Tap to Take Selfie</Text>
          </View>
        </TouchableOpacity>
      )}

      <Text style={styles.fieldLabel}>Guidelines</Text>
      {[
        'Good lighting — face should be clearly visible',
        'Look directly at the camera',
        'No sunglasses, hats, or face coverings',
        'Neutral expression, similar to your ID photo',
      ].map((guideline, i) => (
        <View key={i} style={styles.guidelineRow}>
          <Ionicons name="checkmark" size={16} color={colors.status.success} />
          <Text style={styles.guidelineText}>{guideline}</Text>
        </View>
      ))}
    </View>
  );

  const renderProfileSetupStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Profile Setup</Text>
      <Text style={styles.stepDescription}>
        Set up your Wingman profile. This is what clients will see when browsing.
      </Text>

      {/* Specialties */}
      <Text style={styles.fieldLabel}>Specialties (select at least 2)</Text>
      <View style={styles.chipsWrap}>
        {SPECIALTIES.map((s) => (
          <SelectableChip
            key={s.value}
            label={s.label}
            icon={s.icon}
            selected={data.specialties.includes(s.value)}
            onPress={() => toggleSpecialty(s.value)}
          />
        ))}
      </View>

      {/* Hourly Rate */}
      <Text style={styles.fieldLabel}>Hourly Rate</Text>
      <View style={styles.rateInputRow}>
        <Text style={styles.ratePrefix}>$</Text>
        <TextInput
          style={styles.rateInput}
          value={data.hourlyRate > 0 ? data.hourlyRate.toString() : ''}
          onChangeText={(text) => {
            const rate = parseInt(text, 10);
            setData(prev => ({ ...prev, hourlyRate: isNaN(rate) ? 0 : rate }));
          }}
          keyboardType="numeric"
          maxLength={3}
          placeholder="25"
          placeholderTextColor={colors.text.muted}
        />
        <Text style={styles.rateSuffix}>/ hour</Text>
      </View>
      <Text style={styles.fieldHint}>Min ${HOURLY_RATE_MIN} — Max ${HOURLY_RATE_MAX}. You keep 90% of each booking.</Text>

      {/* About */}
      <Text style={styles.fieldLabel}>About You</Text>
      <TextInput
        style={styles.textArea}
        value={data.about}
        onChangeText={(text) => setData(prev => ({ ...prev, about: text }))}
        placeholder="Tell potential clients about yourself, your experience, and what makes you a great wingman..."
        placeholderTextColor={colors.text.muted}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        maxLength={500}
      />
      <Text style={styles.charCount}>{data.about.length}/500</Text>

      {/* Languages */}
      <Text style={styles.fieldLabel}>Languages</Text>
      <View style={styles.chipsWrap}>
        {LANGUAGES.map((lang) => (
          <SelectableChip
            key={lang}
            label={lang}
            selected={data.languages.includes(lang)}
            onPress={() => toggleLanguage(lang)}
          />
        ))}
      </View>

      {/* Gallery */}
      <Text style={styles.fieldLabel}>Gallery Photos (optional, up to 6)</Text>
      <View style={styles.galleryGrid}>
        {data.gallery.map((uri, i) => (
          <View key={i} style={styles.galleryItem}>
            <Image source={{ uri }} style={styles.galleryImage} />
            <TouchableOpacity style={styles.galleryRemove} onPress={() => removeGalleryPhoto(i)}>
              <Ionicons name="close-circle" size={22} color={colors.status.error} />
            </TouchableOpacity>
          </View>
        ))}
        {data.gallery.length < 6 && (
          <TouchableOpacity
            style={styles.galleryAdd}
            onPress={() => pickImage('library', 'gallery')}
          >
            <Ionicons name="add" size={28} color={colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderAgreementStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Wingman Agreement</Text>
      <Text style={styles.stepDescription}>
        Please review and accept the Wingman Service Agreement to continue.
      </Text>

      <Card variant="outlined" style={styles.agreementCard}>
        <ScrollView style={styles.agreementScroll} nestedScrollEnabled>
          <Text style={styles.agreementHeading}>Wingman Service Agreement</Text>
          <Text style={styles.agreementText}>
            By accepting this agreement, you acknowledge and agree to the following terms as a Wingman on the Wingman platform:
          </Text>

          {[
            {
              title: '1. Service Standards',
              body: 'You agree to provide professional, respectful wingman services. You will arrive on time, dress appropriately for the activity, and maintain a positive and friendly demeanor throughout each booking.',
            },
            {
              title: '2. Safety & Conduct',
              body: 'You must adhere to all community guidelines and safety protocols. Illegal activity, harassment, discrimination, or any inappropriate behavior is strictly prohibited and will result in immediate removal from the platform.',
            },
            {
              title: '3. Identity Verification',
              body: 'You confirm that all identification documents and photos submitted are authentic and belong to you. Providing false or fraudulent documents will result in permanent removal and may be reported to authorities.',
            },
            {
              title: '4. Payment Terms',
              body: 'You will receive 90% of each booking total. The remaining 10% is retained by Wingman as a platform service fee. Payments are processed according to the platform payment schedule.',
            },
            {
              title: '5. Cancellation Policy',
              body: 'Cancellations must be made at least 24 hours before the scheduled booking. Repeated late cancellations or no-shows may result in penalties or account suspension.',
            },
            {
              title: '6. Privacy & Data',
              body: 'Your personal information, ID documents, and verification selfie are stored securely and will only be used for identity verification and platform safety purposes. Your information will never be shared with other users.',
            },
            {
              title: '7. Account Termination',
              body: 'Wingman reserves the right to suspend or terminate your wingman account at any time for violations of this agreement, community guidelines, or applicable laws.',
            },
          ].map((section, i) => (
            <View key={i} style={styles.agreementSection}>
              <Text style={styles.agreementSectionTitle}>{section.title}</Text>
              <Text style={styles.agreementText}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </Card>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={async () => {
          await haptics.selection();
          setAgreementAccepted(!agreementAccepted);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, agreementAccepted && styles.checkboxChecked]}>
          {agreementAccepted && <Ionicons name="checkmark" size={14} color={colors.primary.darkBlack} />}
        </View>
        <Text style={styles.checkboxLabel}>
          I have read, understood, and agree to the Wingman Service Agreement
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Review & Submit</Text>
      <Text style={styles.stepDescription}>
        Review your application before submitting. You can go back to make changes.
      </Text>

      <Card variant="gradient" style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Application Summary</Text>

        <View style={styles.summaryRow}>
          <Ionicons name="card" size={18} color={colors.primary.blue} />
          <Text style={styles.summaryLabel}>ID Document</Text>
          <Text style={styles.summaryValue}>
            {ID_TYPES.find(t => t.value === data.idDocumentType)?.label}
          </Text>
          <Ionicons name="checkmark-circle" size={18} color={colors.status.success} />
        </View>

        <View style={styles.summaryRow}>
          <Ionicons name="camera" size={18} color={colors.primary.blue} />
          <Text style={styles.summaryLabel}>Selfie</Text>
          <Text style={styles.summaryValue}>Captured</Text>
          <Ionicons name="checkmark-circle" size={18} color={colors.status.success} />
        </View>

        <View style={styles.summaryRow}>
          <Ionicons name="star" size={18} color={colors.primary.blue} />
          <Text style={styles.summaryLabel}>Specialties</Text>
          <Text style={styles.summaryValue}>{data.specialties.length} selected</Text>
        </View>

        <View style={styles.summaryRow}>
          <Ionicons name="cash" size={18} color={colors.primary.blue} />
          <Text style={styles.summaryLabel}>Rate</Text>
          <Text style={styles.summaryValue}>${data.hourlyRate}/hr</Text>
        </View>

        <View style={styles.summaryRow}>
          <Ionicons name="language" size={18} color={colors.primary.blue} />
          <Text style={styles.summaryLabel}>Languages</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>{data.languages.join(', ')}</Text>
        </View>

        {data.gallery.length > 0 && (
          <View style={styles.summaryRow}>
            <Ionicons name="images" size={18} color={colors.primary.blue} />
            <Text style={styles.summaryLabel}>Gallery</Text>
            <Text style={styles.summaryValue}>{data.gallery.length} photos</Text>
          </View>
        )}

        <View style={styles.summaryRow}>
          <Ionicons name="document-text" size={18} color={colors.primary.blue} />
          <Text style={styles.summaryLabel}>Agreement</Text>
          <Text style={styles.summaryValue}>Accepted</Text>
          <Ionicons name="checkmark-circle" size={18} color={colors.status.success} />
        </View>
      </Card>

      <Card variant="outlined" style={styles.reviewNote}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <Ionicons name="information-circle" size={20} color={colors.primary.blue} />
          <Text style={styles.reviewNoteText}>
            Your application will be reviewed by our team. This usually takes 1-3 business days. We'll notify you once a decision has been made.
          </Text>
        </View>
      </Card>
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

const styles = StyleSheet.create({
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
