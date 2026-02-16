import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
  const [selectedAvatarUri, setSelectedAvatarUri] = useState<string | null>(null);
  const [attestedPhotoMatch, setAttestedPhotoMatch] = useState(user?.profilePhotoIdMatchAttested === true);
  const [isSaving, setIsSaving] = useState(false);

  const activeAvatarUri = useMemo(
    () => selectedAvatarUri || user?.avatar || null,
    [selectedAvatarUri, user?.avatar],
  );

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handlePickPhoto = async () => {
    await haptics.light();

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow photo access so you can upload a profile picture.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setSelectedAvatarUri(result.assets[0].uri);
      setAttestedPhotoMatch(false);
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
      Alert.alert('Missing Information', 'Please enter your first and last name.');
      return;
    }

    if (!trimmedCity || !trimmedCountry) {
      Alert.alert('Missing Location', 'Please select your city and country.');
      return;
    }

    if (!hasAvatar) {
      Alert.alert(
        'Profile Photo Required',
        'Please upload a profile photo before saving profile verification settings.',
      );
      return;
    }

    if (!attestedPhotoMatch) {
      Alert.alert(
        'Photo-ID Confirmation Required',
        'You must confirm your profile photo clearly matches your government photo ID before booking.',
      );
      return;
    }

    setIsSaving(true);

    try {
      if (selectedAvatarUri) {
        const { error: avatarError } = await uploadProfileAvatar(selectedAvatarUri);
        if (avatarError) {
          Alert.alert('Profile Photo', avatarError.message || 'Unable to upload profile photo right now.');
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
        profile_photo_id_match_attested: true,
        profile_photo_id_match_attested_at: new Date().toISOString(),
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
        message="Your profile photo must clearly match your government photo ID before you can finalize any booking."
        variant="info"
      />

      <View style={styles.section}>
        <SectionHeader title="Profile Photo" subtitle="Use a clear face photo that matches your ID" />
        <Card variant="outlined" style={styles.photoCard}>
          <TouchableOpacity style={styles.photoPreview} onPress={handlePickPhoto} activeOpacity={0.9}>
            {activeAvatarUri ? (
              <Image source={{ uri: activeAvatarUri }} style={styles.photoImage} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={26} color={tokens.colors.text.tertiary} />
                <Text style={styles.photoPlaceholderText}>Upload profile photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <Button
            title={activeAvatarUri ? 'Change Photo' : 'Upload Photo'}
            onPress={handlePickPhoto}
            variant="outline"
            size="small"
          />

          <TouchableOpacity style={styles.attestationRow} onPress={handleToggleAttestation} activeOpacity={0.8}>
            <Ionicons
              name={attestedPhotoMatch ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={attestedPhotoMatch ? tokens.colors.accent.primary : tokens.colors.text.tertiary}
            />
            <Text style={styles.attestationText}>
              I confirm this profile photo clearly matches my government photo ID.
            </Text>
          </TouchableOpacity>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Basic Details" subtitle="Keep your account details current" />
        <Card variant="outlined" style={styles.formCard}>
          <Input
            label="First Name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
          <Input
            label="Last Name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
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
  photoPreview: {
    width: 112,
    height: 112,
    borderRadius: spacing.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level2,
    alignSelf: 'flex-start',
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
  },
  photoPlaceholderText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
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
});
