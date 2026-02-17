import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Card,
  Header,
  InlineBanner,
  Input,
  LocationPicker,
  ScreenScaffold,
  SectionHeader,
} from '../components';
import { countries } from '../data/countries';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  updateProfile,
  uploadProfileAvatar,
} from '../services/api/profiles';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { LocationData } from '../types/location';
import type { RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const resolveCountryCode = (countryName?: string): string => {
  if (!countryName) return 'US';
  const match = countries.find(
    (country) => country.name.toLowerCase() === countryName.toLowerCase()
  );
  return match?.code || 'US';
};

export const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, refreshUserProfile } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState<LocationData>({
    city: user?.location?.city || '',
    state: user?.location?.state || undefined,
    country: user?.location?.country || 'United States',
    countryCode: resolveCountryCode(user?.location?.country),
  });
  const [selectedAvatarAsset, setSelectedAvatarAsset] = useState<{
    uri: string;
    width?: number;
    height?: number;
    fileSizeBytes?: number;
  } | null>(null);
  const [attestedPhotoMatch, setAttestedPhotoMatch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activeAvatarUri = useMemo(
    () => selectedAvatarAsset?.uri || user?.avatar || null,
    [selectedAvatarAsset?.uri, user?.avatar],
  );
  const savedMetroAreaLabel = useMemo(() => {
    const metroAreaName = user?.location?.metroAreaName?.trim();
    if (metroAreaName) {
      return metroAreaName;
    }

    const fallbackParts = [user?.location?.city, user?.location?.state]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0);

    if (fallbackParts.length > 0) {
      return fallbackParts.join(', ');
    }

    return 'Your metro area will appear here after you save your location.';
  }, [user?.location?.city, user?.location?.metroAreaName, user?.location?.state]);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handlePickPhoto = async () => {
    await haptics.light();

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access so you can take your profile photo in real time.',
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const asset = result.assets[0];
        let normalizedUri = asset.uri;
        let normalizedSize = typeof asset.fileSize === 'number' ? asset.fileSize : undefined;

        // Persist camera captures as a stable JPEG file so remote rendering is reliable across sessions.
        if (typeof asset.base64 === 'string' && asset.base64.length > 0 && FileSystem.cacheDirectory) {
          const normalizedPath = `${FileSystem.cacheDirectory}profile-avatar-${Date.now()}.jpg`;
          await FileSystem.writeAsStringAsync(normalizedPath, asset.base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          normalizedUri = normalizedPath;

          const fileInfo = await FileSystem.getInfoAsync(normalizedPath);
          if (fileInfo.exists && typeof fileInfo.size === 'number') {
            normalizedSize = fileInfo.size;
          }
        }

        setSelectedAvatarAsset({
          uri: normalizedUri,
          width: typeof asset.width === 'number' ? asset.width : undefined,
          height: typeof asset.height === 'number' ? asset.height : undefined,
          fileSizeBytes: normalizedSize,
        });
        setAttestedPhotoMatch(false);
      }
    } catch (error) {
      console.error('Error taking profile photo:', error);
      Alert.alert('Profile Photo', 'Unable to open the camera right now. Please try again.');
    }
  };

  const handleToggleAttestation = async () => {
    await haptics.selection();
    setAttestedPhotoMatch((previous) => !previous);
  };

  const handleSave = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedCity = location.city.trim();
    const trimmedCountry = location.country.trim();
    const hasAvatar = Boolean(activeAvatarUri);

    if (!trimmedFirst || !trimmedLast) {
      Alert.alert(
        'Missing Legal Name',
        'Please enter your legal first and last name exactly as shown on your government photo ID.',
      );
      return;
    }

    if (!trimmedCity || !trimmedCountry) {
      Alert.alert('Missing Location', 'Please select your city and country.');
      return;
    }

    if (!hasAvatar) {
      Alert.alert(
        'Profile Photo Required',
        'Please take a profile photo with your camera before saving profile verification settings.',
      );
      return;
    }

    if (!attestedPhotoMatch) {
      Alert.alert(
        'Photo Acknowledgment Required',
        'Please confirm the photo clearly shows your face. Stripe Identity still performs the final live ID and selfie match.',
      );
      return;
    }

    const changingLegalName = (
      trimmedFirst !== (user?.firstName || '').trim()
      || trimmedLast !== (user?.lastName || '').trim()
    );

    if (changingLegalName && user?.idVerificationStatus === 'verified') {
      Alert.alert(
        'ID Verification Will Reset',
        'Changing your legal name will require a new ID verification before your next booking.',
      );
    }

    setIsSaving(true);

    try {
      if (selectedAvatarAsset) {
        const { error: avatarError } = await uploadProfileAvatar(
          selectedAvatarAsset.uri,
          {
            width: selectedAvatarAsset.width,
            height: selectedAvatarAsset.height,
            fileSizeBytes: selectedAvatarAsset.fileSizeBytes,
          },
        );
        if (avatarError) {
          Alert.alert('Profile Photo', avatarError.message || 'Unable to save your profile photo right now.');
          return;
        }
      }

      const { error } = await updateProfile({
        first_name: trimmedFirst,
        last_name: trimmedLast,
        phone: phone.trim() || null,
        date_of_birth: dateOfBirth.trim() || null,
        bio: bio.trim() || null,
        city: trimmedCity,
        state: location.state?.trim() || null,
        country: trimmedCountry,
      });

      if (error) {
        Alert.alert('Profile Update', error.message || 'Unable to save profile changes right now.');
        return;
      }

      await refreshUserProfile();
      await haptics.success();
      navigation.goBack();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Profile Update', 'Unable to save profile changes right now.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenScaffold scrollable contentContainerStyle={styles.content}>
      <Header title="Edit Profile" showBack onBackPress={handleBackPress} transparent />

      <InlineBanner
        title="Booking safety requirement"
        message="Your legal first and last name must exactly match your government photo ID character-for-character. This name is used during Stripe Identity verification, and mismatches will fail verification."
        variant="info"
      />

      <View style={styles.section}>
        <SectionHeader title="Profile Photo" subtitle="Use a clear face photo that matches your ID" />
        <Card variant="outlined" style={styles.photoCard}>
          <View style={styles.photoControlsWrap}>
            <TouchableOpacity style={styles.photoPreview} onPress={handlePickPhoto} activeOpacity={0.9}>
              {activeAvatarUri ? (
                <Image source={{ uri: activeAvatarUri }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <View style={styles.photoPlaceholderIconWrap}>
                    <Ionicons name="camera-outline" size={28} color={tokens.colors.primary.blue} />
                  </View>
                  <Text style={styles.photoPlaceholderTitle}>Take profile photo</Text>
                  <Text style={styles.photoPlaceholderSubtitle}>Camera capture only</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.photoButtonWrap}>
              <Button
                title={activeAvatarUri ? 'Retake Photo' : 'Take Photo'}
                onPress={handlePickPhoto}
                variant="outline"
                size="small"
                style={styles.photoButton}
              />
            </View>

            <TouchableOpacity style={styles.attestationRow} onPress={handleToggleAttestation} activeOpacity={0.8}>
              <Ionicons
                name={attestedPhotoMatch ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={attestedPhotoMatch ? tokens.colors.accent.primary : tokens.colors.text.tertiary}
              />
              <Text style={styles.attestationText}>
                I confirm this profile photo clearly shows my face. I understand Stripe performs the final government ID + live selfie identity check.
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Legal Details" subtitle="Must match your government photo ID exactly" />
        <Card variant="outlined" style={styles.formCard}>
          <Input
            label="First Name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            placeholder="Legal first name on your photo ID"
          />
          <Input
            label="Last Name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            placeholder="Legal last name on your photo ID"
          />
          <Input
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="(555) 555-5555"
          />
          <Input
            label="Date of Birth"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="YYYY-MM-DD"
          />
          <Input
            label="Bio"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
            placeholder="Write a short bio"
            style={styles.bioInput}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Location" subtitle="Used for profile and matching context" />
        <Card variant="outlined" style={styles.locationCard}>
          <LocationPicker
            value={location}
            onChange={setLocation}
          />
          <View style={styles.metroSummaryRow}>
            <Ionicons name="business-outline" size={18} color={tokens.colors.text.tertiary} />
            <View style={styles.metroSummaryContent}>
              <Text style={styles.metroSummaryLabel}>Saved Metro Area</Text>
              <Text style={styles.metroSummaryValue}>{savedMetroAreaLabel}</Text>
            </View>
          </View>
        </Card>
      </View>

      <Button
        title={isSaving ? 'Saving…' : 'Save Profile'}
        onPress={handleSave}
        loading={isSaving}
        disabled={isSaving}
        variant="primary"
        size="large"
      />
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    gap: spacing.sm,
  },
  photoCard: {
    gap: spacing.md,
  },
  photoControlsWrap: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  photoPreview: {
    width: 136,
    height: 136,
    borderRadius: spacing.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level2,
    alignSelf: 'center',
  },
  photoButtonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  photoButton: {
    alignSelf: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  photoPlaceholderIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.blueSoft,
  },
  photoPlaceholderTitle: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
    textAlign: 'center',
  },
  photoPlaceholderSubtitle: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  attestationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    padding: spacing.md,
    width: '100%',
  },
  attestationText: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
    flex: 1,
    lineHeight: 20,
  },
  formCard: {
    paddingBottom: 0,
  },
  bioInput: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  locationCard: {
    paddingBottom: 0,
  },
  metroSummaryRow: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.surface.level1,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  metroSummaryContent: {
    flex: 1,
    gap: spacing.xxs,
  },
  metroSummaryLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metroSummaryValue: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
  },
});
