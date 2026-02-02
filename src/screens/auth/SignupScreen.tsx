import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Image,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, ProgressBar, SelectableChip } from '../../components';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { haptics } from '../../utils/haptics';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList, CompanionSpecialty, Gender } from '../../types';

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 7;

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

const INTERESTS: { label: string; value: CompanionSpecialty; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Social Events', value: 'social-events', icon: 'people' },
  { label: 'Dining', value: 'dining', icon: 'restaurant' },
  { label: 'Nightlife', value: 'nightlife', icon: 'wine' },
  { label: 'Movies', value: 'movies', icon: 'film' },
  { label: 'Concerts', value: 'concerts', icon: 'musical-notes' },
  { label: 'Sports', value: 'sports', icon: 'football' },
  { label: 'Outdoor Activities', value: 'outdoor-activities', icon: 'leaf' },
  { label: 'Shopping', value: 'shopping', icon: 'bag' },
  { label: 'Travel', value: 'travel', icon: 'airplane' },
  { label: 'Coffee & Chat', value: 'coffee-chat', icon: 'cafe' },
  { label: 'Workout Buddy', value: 'workout-buddy', icon: 'fitness' },
  { label: 'Professional Networking', value: 'professional-networking', icon: 'briefcase' },
  { label: 'Emotional Support', value: 'emotional-support', icon: 'heart' },
];

const GENDERS: { label: string; value: Gender }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Non-binary', value: 'non-binary' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer-not-to-say' },
];

const LOOKING_FOR = [
  'Casual hangouts',
  'Event companion',
  'Travel buddy',
  'Fitness partner',
  'Professional networking',
  'New friendships',
  'Cultural experiences',
  'Adventure activities',
];

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
  'Hindi',
  'Other',
];

export const SignupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const {
    signupData,
    updateSignupData,
    signUp,
    signupConsents,
    updateSignupConsents,
    validateSignupConsents,
  } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Use AuthContext consent state
  const confirmedAge = signupConsents.ageConfirmed;
  const agreedToTerms = signupConsents.termsAccepted;
  const agreedToPrivacy = signupConsents.privacyAccepted;
  const optedInMarketing = signupConsents.marketingOptIn;

  // Helper functions to update consents via AuthContext
  const setConfirmedAge = (value: boolean) => updateSignupConsents({ ageConfirmed: value });
  const setAgreedToTerms = (value: boolean) => updateSignupConsents({ termsAccepted: value });
  const setAgreedToPrivacy = (value: boolean) => updateSignupConsents({ privacyAccepted: value });
  const setOptedInMarketing = (value: boolean) => updateSignupConsents({ marketingOptIn: value });

  const handleBack = async () => {
    await haptics.light();
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError('');
    } else {
      navigation.goBack();
    }
  };

  const validateStep = (): boolean => {
    setError('');

    switch (currentStep) {
      case 1: // Account
        if (!signupData.email.trim()) {
          setError('Please enter your email');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupData.email)) {
          setError('Please enter a valid email');
          return false;
        }
        if (!signupData.password || signupData.password.length < 6) {
          setError('Password must be at least 6 characters');
          return false;
        }
        if (signupData.password !== confirmPassword) {
          setError('Passwords do not match');
          return false;
        }
        if (!confirmedAge) {
          setError('You must be 18 or older to use this service');
          return false;
        }
        if (!agreedToTerms) {
          setError('Please agree to the Terms of Service');
          return false;
        }
        if (!agreedToPrivacy) {
          setError('Please agree to the Privacy Policy');
          return false;
        }
        return true;

      case 2: // Personal
        if (!signupData.firstName.trim()) {
          setError('Please enter your first name');
          return false;
        }
        if (!signupData.lastName.trim()) {
          setError('Please enter your last name');
          return false;
        }
        return true;

      case 3: // Location
        if (!signupData.city.trim()) {
          setError('Please enter your city');
          return false;
        }
        if (!signupData.country.trim()) {
          setError('Please enter your country');
          return false;
        }
        return true;

      case 4: // Interests
        if (signupData.interests.length < 3) {
          setError('Please select at least 3 interests');
          return false;
        }
        return true;

      case 5: // About
        return true; // Optional step

      case 6: // Photo
        return true; // Optional step

      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!validateStep()) {
      await haptics.warning();
      return;
    }

    await haptics.medium();

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      // SECURITY: Final validation of all consents before completing signup
      const consentValidation = validateSignupConsents();
      if (!consentValidation.valid) {
        await haptics.error();
        setError(consentValidation.errors[0] || 'Please accept all required agreements');
        // Navigate back to step 1 where consents are collected
        setCurrentStep(1);
        return;
      }

      // Complete signup with Supabase
      const result = await signUp();
      if (!result.success) {
        await haptics.error();
        setError(result.error || 'Signup failed. Please try again.');
        setCurrentStep(1);
        return;
      }

      await haptics.success();

      // Navigate to email verification if needed, otherwise to tutorial
      if (result.needsVerification) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'VerifyEmail' }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Tutorial' }],
        });
      }
    }
  };

  const toggleInterest = (interest: CompanionSpecialty) => {
    const current = signupData.interests;
    if (current.includes(interest)) {
      updateSignupData({ interests: current.filter(i => i !== interest) });
    } else {
      updateSignupData({ interests: [...current, interest] });
    }
  };

  const toggleLookingFor = (item: string) => {
    const current = signupData.lookingFor;
    if (current.includes(item)) {
      updateSignupData({ lookingFor: current.filter(i => i !== item) });
    } else {
      updateSignupData({ lookingFor: [...current, item] });
    }
  };

  const toggleLanguage = (lang: string) => {
    const current = signupData.languages;
    if (current.includes(lang)) {
      updateSignupData({ languages: current.filter(l => l !== lang) });
    } else {
      updateSignupData({ languages: [...current, lang] });
    }
  };

  const handlePhotoUpload = async () => {
    await haptics.medium();

    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photos to add a profile picture.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      updateSignupData({ avatar: result.assets[0].uri });
      await haptics.success();
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View key="step-1" style={styles.stepContent}>
            <Text style={styles.stepTitle}>Create your account</Text>
            <Text style={styles.stepSubtitle}>Enter your email and password to get started</Text>

            <Input
              label="Email"
              placeholder="Enter your email"
              value={signupData.email}
              onChangeText={(text) => updateSignupData({ email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon="mail-outline"
            />

            <Input
              label="Password"
              placeholder="Create a password"
              value={signupData.password}
              onChangeText={(text) => updateSignupData({ password: text })}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              leftIcon="lock-closed-outline"
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPassword(!showPassword)}
              hint="At least 6 characters"
            />

            <Input
              label="Confirm Password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              leftIcon="lock-closed-outline"
            />

            {/* Age Confirmation */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setConfirmedAge(!confirmedAge)}
            >
              <View style={[styles.checkbox, confirmedAge && styles.checkboxChecked]}>
                {confirmedAge && (
                  <Ionicons name="checkmark" size={14} color={colors.primary.black} />
                )}
              </View>
              <Text style={styles.termsText}>
                I confirm that I am at least 18 years of age
              </Text>
            </TouchableOpacity>

            {/* Terms of Service */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
            >
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && (
                  <Ionicons name="checkmark" size={14} color={colors.primary.black} />
                )}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text
                  style={styles.termsLink}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('LegalDocument', { documentType: 'terms-of-service' });
                  }}
                >
                  Terms of Service
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Privacy Policy */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAgreedToPrivacy(!agreedToPrivacy)}
            >
              <View style={[styles.checkbox, agreedToPrivacy && styles.checkboxChecked]}>
                {agreedToPrivacy && (
                  <Ionicons name="checkmark" size={14} color={colors.primary.black} />
                )}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text
                  style={styles.termsLink}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('LegalDocument', { documentType: 'privacy-policy' });
                  }}
                >
                  Privacy Policy
                </Text>
                {' '}and consent to the processing of my personal data
              </Text>
            </TouchableOpacity>

            {/* Marketing Opt-in (Optional) */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setOptedInMarketing(!optedInMarketing)}
            >
              <View style={[styles.checkbox, optedInMarketing && styles.checkboxChecked]}>
                {optedInMarketing && (
                  <Ionicons name="checkmark" size={14} color={colors.primary.black} />
                )}
              </View>
              <Text style={styles.termsText}>
                I'd like to receive promotional emails and updates (optional)
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View key="step-2" style={styles.stepContent}>
            <Text style={styles.stepTitle}>Tell us about yourself</Text>
            <Text style={styles.stepSubtitle}>We'd love to know more about you</Text>

            <Input
              label="First Name"
              placeholder="Enter your first name"
              value={signupData.firstName}
              onChangeText={(text) => updateSignupData({ firstName: text })}
              autoCapitalize="words"
              leftIcon="person-outline"
            />

            <Input
              label="Last Name"
              placeholder="Enter your last name"
              value={signupData.lastName}
              onChangeText={(text) => updateSignupData({ lastName: text })}
              autoCapitalize="words"
              leftIcon="person-outline"
            />

            <Input
              label="Date of Birth"
              placeholder="MM/DD/YYYY"
              value={signupData.dateOfBirth}
              onChangeText={(text) => updateSignupData({ dateOfBirth: text })}
              keyboardType="numbers-and-punctuation"
              leftIcon="calendar-outline"
            />

            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.chipsContainer}>
              {GENDERS.map((gender) => (
                <SelectableChip
                  key={gender.value}
                  label={gender.label}
                  selected={signupData.gender === gender.value}
                  onPress={() => updateSignupData({ gender: gender.value })}
                />
              ))}
            </View>

            <Input
              label="Phone Number (Optional)"
              placeholder="Enter your phone number"
              value={signupData.phone}
              onChangeText={(text) => updateSignupData({ phone: text })}
              keyboardType="phone-pad"
              leftIcon="call-outline"
            />
          </View>
        );

      case 3:
        return (
          <View key="step-3" style={styles.stepContent}>
            <Text style={styles.stepTitle}>Where are you located?</Text>
            <Text style={styles.stepSubtitle}>Help us find companions near you</Text>

            <Input
              label="City"
              placeholder="Enter your city"
              value={signupData.city}
              onChangeText={(text) => updateSignupData({ city: text })}
              autoCapitalize="words"
              leftIcon="location-outline"
            />

            <Input
              label="State/Region (Optional)"
              placeholder="Enter your state or region"
              value={signupData.state}
              onChangeText={(text) => updateSignupData({ state: text })}
              autoCapitalize="words"
              leftIcon="map-outline"
            />

            <Input
              label="Country"
              placeholder="Enter your country"
              value={signupData.country}
              onChangeText={(text) => updateSignupData({ country: text })}
              autoCapitalize="words"
              leftIcon="globe-outline"
            />
          </View>
        );

      case 4:
        return (
          <View key="step-4" style={styles.stepContent}>
            <Text style={styles.stepTitle}>What are you interested in?</Text>
            <Text style={styles.stepSubtitle}>Select at least 3 activities you enjoy</Text>

            <View style={styles.interestsGrid}>
              {INTERESTS.map((interest) => (
                <SelectableChip
                  key={interest.value}
                  label={interest.label}
                  icon={interest.icon}
                  selected={signupData.interests.includes(interest.value)}
                  onPress={() => toggleInterest(interest.value)}
                />
              ))}
            </View>

            <Text style={styles.selectionCount}>
              {signupData.interests.length} selected (minimum 3)
            </Text>
          </View>
        );

      case 5:
        return (
          <View key="step-5" style={styles.stepContent}>
            <Text style={styles.stepTitle}>Tell us more about you</Text>
            <Text style={styles.stepSubtitle}>Help others get to know you better</Text>

            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Write a short bio about yourself..."
              placeholderTextColor={colors.text.muted}
              value={signupData.bio}
              onChangeText={(text) => updateSignupData({ bio: text })}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>What are you looking for?</Text>
            <View style={styles.chipsContainer}>
              {LOOKING_FOR.map((item) => (
                <SelectableChip
                  key={item}
                  label={item}
                  selected={signupData.lookingFor.includes(item)}
                  onPress={() => toggleLookingFor(item)}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Languages you speak</Text>
            <View style={styles.chipsContainer}>
              {LANGUAGES.map((lang) => (
                <SelectableChip
                  key={lang}
                  label={lang}
                  selected={signupData.languages.includes(lang)}
                  onPress={() => toggleLanguage(lang)}
                />
              ))}
            </View>
          </View>
        );

      case 6:
        return (
          <View key="step-6" style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add a profile photo</Text>
            <Text style={styles.stepSubtitle}>Help others recognize you</Text>

            <TouchableOpacity style={styles.photoUpload} onPress={handlePhotoUpload}>
              {signupData.avatar ? (
                <Image
                  source={{ uri: signupData.avatar }}
                  style={styles.photoImage}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera" size={48} color={colors.text.tertiary} />
                  <Text style={styles.photoText}>Tap to add photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {signupData.avatar && (
              <TouchableOpacity onPress={handlePhotoUpload} style={styles.changePhotoButton}>
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.photoHint}>
              You can skip this step and add a photo later
            </Text>
          </View>
        );

      case 7:
        return (
          <View key="step-7" style={styles.stepContent}>
            <View style={styles.completeContainer}>
              <LinearGradient
                colors={colors.gradients.premium}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.completeIcon}
              >
                <Ionicons name="checkmark" size={48} color={colors.primary.black} />
              </LinearGradient>

              <Text style={styles.completeTitle}>You're all set!</Text>
              <Text style={styles.completeSubtitle}>
                Welcome to Wingman, {signupData.firstName}! Let's show you around.
              </Text>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Your Profile</Text>
                <View style={styles.summaryRow}>
                  <Ionicons name="person" size={16} color={colors.primary.blue} />
                  <Text style={styles.summaryText}>
                    {signupData.firstName} {signupData.lastName}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="location" size={16} color={colors.primary.blue} />
                  <Text style={styles.summaryText}>
                    {signupData.city}, {signupData.country}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="heart" size={16} color={colors.primary.blue} />
                  <Text style={styles.summaryText}>
                    {signupData.interests.length} interests selected
                  </Text>
                </View>
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderStepContent()}

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.status.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          title={currentStep === TOTAL_STEPS ? 'Start Exploring' : 'Continue'}
          onPress={handleNext}
          variant="primary"
          size="large"
          fullWidth
        />
        {currentStep === 6 && (
          <TouchableOpacity style={styles.skipButton} onPress={handleNext}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

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
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  progressContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenPadding,
  },
  stepContent: {
    // Removed flex: 1 to prevent touch issues
  },
  stepTitle: {
    ...typography.presets.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  dividerText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginHorizontal: spacing.md,
  },
  fieldLabel: {
    ...typography.presets.label,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectionCount: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  termsText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    flex: 1,
    fontSize: 14,
  },
  termsLink: {
    color: colors.primary.blue,
  },
  textArea: {
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    ...typography.presets.body,
    color: colors.text.primary,
    height: 120,
  },
  photoUpload: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  photoPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.background.tertiary,
    borderWidth: 2,
    borderColor: colors.border.medium,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  photoHint: {
    ...typography.presets.caption,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  photoImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: colors.primary.blue,
  },
  changePhotoButton: {
    marginTop: spacing.md,
  },
  changePhotoText: {
    ...typography.presets.body,
    color: colors.primary.blue,
  },
  completeContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  completeIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  completeTitle: {
    ...typography.presets.h1,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  completeSubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
  },
  summaryCard: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    padding: spacing.lg,
    width: '100%',
  },
  summaryTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.errorLight,
    padding: spacing.md,
    borderRadius: spacing.radius.md,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.presets.caption,
    color: colors.status.error,
    marginLeft: spacing.sm,
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipText: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
});
