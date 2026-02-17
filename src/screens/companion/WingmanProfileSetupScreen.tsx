import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Header, InlineBanner, ScreenScaffold } from '../../components';
import { WingmanProfileForm } from '../../components/companion/WingmanProfileForm';
import type { WingmanProfileFormErrors } from '../../components/companion/WingmanProfileForm';
import { useTheme } from '../../context/ThemeContext';
import { trackEvent } from '../../services/monitoring/events';
import { upsertWingmanProfile } from '../../services/api/wingmanOnboardingApi';
import { uploadGalleryPhoto } from '../../services/api/companionApplicationApi';
import { supabase } from '../../services/supabase';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { RootStackParamList, WingmanProfileSetupPayload } from '../../types';
import { haptics } from '../../utils/haptics';
import { hasWingmanProfileErrors, validateWingmanProfile } from './wingmanProfileValidation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRoute = RouteProp<RootStackParamList, 'WingmanProfileSetup'>;

const defaultPayload: WingmanProfileSetupPayload = {
  specialties: [],
  hourlyRate: 25,
  about: '',
  languages: [],
  gallery: [],
  isAvailable: true,
};

export const WingmanProfileSetupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [payload, setPayload] = useState<WingmanProfileSetupPayload>(defaultPayload);
  const [errors, setErrors] = useState<WingmanProfileFormErrors>({});

  const loadExistingProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('companions')
        .select('specialties,hourly_rate,about,languages,gallery,is_available')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Unable to load existing wingman profile:', error);
        setIsLoading(false);
        return;
      }

      if (data && typeof data === 'object') {
        const row = data as Record<string, unknown>;
        const parsedRate = Number(row.hourly_rate);
        setPayload({
          specialties: Array.isArray(row.specialties) ? row.specialties as WingmanProfileSetupPayload['specialties'] : [],
          hourlyRate: Number.isFinite(parsedRate) ? parsedRate : 25,
          about: typeof row.about === 'string' ? row.about : '',
          languages: Array.isArray(row.languages) ? row.languages as string[] : [],
          gallery: Array.isArray(row.gallery) ? row.gallery as string[] : [],
          isAvailable: row.is_available !== false,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExistingProfile();
  }, [loadExistingProfile]);

  useEffect(() => {
    trackEvent('wingman_onboarding_step_viewed', {
      step: route.params?.source === 'onboarding' ? 3 : 0,
      source: route.params?.source || 'dashboard',
    });
  }, [route.params?.source]);

  const handleAddGalleryPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo library access to add gallery photos.');
      trackEvent('wingman_profile_setup_save_fail', { reason: 'gallery_permission_denied' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    await haptics.selection();
    setPayload((previous) => ({
      ...previous,
      gallery: [...previous.gallery, result.assets[0].uri].slice(0, 6),
    }));
  };

  const handleSave = async () => {
    const nextErrors = validateWingmanProfile(payload);
    setErrors(nextErrors);

    if (hasWingmanProfileErrors(nextErrors)) {
      await haptics.error();
      trackEvent('wingman_profile_setup_save_fail', { reason: 'validation_failed' });
      return;
    }

    setIsSaving(true);
    await haptics.medium();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setIsSaving(false);
      await haptics.error();
      Alert.alert('Unable to save profile', 'Sign in again and retry.');
      return;
    }

    const resolvedGallery: string[] = [];
    for (let index = 0; index < payload.gallery.length; index += 1) {
      const uri = payload.gallery[index];
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        resolvedGallery.push(uri);
        continue;
      }

      const { url, error: uploadError } = await uploadGalleryPhoto(user.id, uri, index);
      if (uploadError || !url) {
        setIsSaving(false);
        await haptics.error();
        trackEvent('wingman_profile_setup_save_fail', {
          reason: 'gallery_upload_failed',
          message: uploadError?.message || 'unknown',
        });
        Alert.alert('Unable to save profile', 'Gallery upload failed. Please retry.');
        return;
      }

      resolvedGallery.push(url);
    }

    const { companion, error } = await upsertWingmanProfile({
      ...payload,
      gallery: resolvedGallery,
    });

    if (error || !companion) {
      setIsSaving(false);
      await haptics.error();
      trackEvent('wingman_profile_setup_save_fail', { reason: 'rpc_failed', message: error?.message || '' });
      Alert.alert('Unable to save profile', error?.message || 'Please try again.');
      return;
    }

    setIsSaving(false);
    await haptics.success();
    trackEvent('wingman_profile_setup_save_success', { source: route.params?.source || 'dashboard' });
    if (route.params?.source === 'onboarding') {
      trackEvent('wingman_onboarding_step_completed', { step: 3 });
    }

    Alert.alert('Profile saved', 'Your wingman profile is now live and bookable.', [
      {
        text: 'Continue',
        onPress: () => {
          if (route.params?.source === 'onboarding') {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }, { name: 'CompanionDashboard' }],
            });
            return;
          }

          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <ScreenScaffold hideHorizontalPadding withBottomPadding={false}>
      <Header
        title={route.params?.source === 'onboarding' ? 'Step 3 of 3' : 'Wingman Profile'}
        showBack
        onBackPress={() => navigation.goBack()}
        transparent
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <InlineBanner
          title={route.params?.source === 'onboarding' ? 'Set up your Wingman profile' : 'Edit your wingman profile'}
          message="Your profile is published immediately after save when ID verification and agreement requirements are complete."
          variant="info"
        />

        {isLoading ? (
          <Text style={styles.loadingText}>Loading profile…</Text>
        ) : (
          <WingmanProfileForm
            value={payload}
            errors={errors}
            onChange={setPayload}
            onAddGalleryPhoto={handleAddGalleryPhoto}
            onRemoveGalleryPhoto={(index) => {
              setPayload((previous) => ({
                ...previous,
                gallery: previous.gallery.filter((_, photoIndex) => photoIndex !== index),
              }));
            }}
            disabled={isSaving}
          />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: tokens.spacing.md }]}> 
        <Button
          title={isSaving ? 'Saving…' : route.params?.source === 'onboarding' ? 'Complete Setup' : 'Save Changes'}
          onPress={handleSave}
          loading={isSaving}
          disabled={isSaving || isLoading}
          fullWidth
          variant="primary"
          icon={route.params?.source === 'onboarding' ? 'checkmark-circle' : 'save'}
          iconPosition="left"
        />
      </View>
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  loadingText: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
  },
});
