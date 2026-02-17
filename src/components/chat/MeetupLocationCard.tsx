import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supportsNativeGoogleMaps } from '../../config/runtime';
import { useTheme } from '../../context/ThemeContext';
import type { MeetupLocationProposal } from '../../types';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';

type MapModule = {
  MapView: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
};

function loadNativeMapModule(): MapModule | null {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const maps = require('react-native-maps');
    return {
      MapView: maps.default,
      Marker: maps.Marker,
    };
  } catch {
    return null;
  }
}

const STATUS_LABELS: Record<MeetupLocationProposal['status'], string> = {
  pending: 'Pending response',
  accepted: 'Accepted meetup',
  declined: 'Declined',
  countered: 'Countered',
  withdrawn: 'Withdrawn',
};

interface MeetupLocationCardProps {
  proposal: MeetupLocationProposal;
  isCurrentUserProposer: boolean;
  isBusy?: boolean;
  onOpenMaps?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onSuggestAlternative?: () => void;
}

export const MeetupLocationCard: React.FC<MeetupLocationCardProps> = ({
  proposal,
  isCurrentUserProposer,
  isBusy = false,
  onOpenMaps,
  onAccept,
  onDecline,
  onSuggestAlternative,
}) => {
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;

  const mapModule = useMemo(loadNativeMapModule, []);
  const hasCoordinates = typeof proposal.latitude === 'number' && typeof proposal.longitude === 'number';
  const canRenderMap = supportsNativeGoogleMaps && !!mapModule && hasCoordinates;

  const MapViewComponent = mapModule?.MapView;
  const MarkerComponent = mapModule?.Marker;

  const showResponseActions = (
    proposal.status === 'pending'
    && !isCurrentUserProposer
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Ionicons name="location" size={14} color={colors.accent.primary} />
          <Text style={styles.title}>Meetup Proposal</Text>
        </View>
        <Text style={styles.statusText}>{STATUS_LABELS[proposal.status]}</Text>
      </View>

      <Text style={styles.placeName}>{proposal.placeName}</Text>
      {proposal.placeAddress ? <Text style={styles.placeAddress}>{proposal.placeAddress}</Text> : null}

      {canRenderMap && MapViewComponent && MarkerComponent ? (
        <View style={styles.mapWrap}>
          <MapViewComponent
            style={styles.map}
            pointerEvents="none"
            initialRegion={{
              latitude: proposal.latitude as number,
              longitude: proposal.longitude as number,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            region={{
              latitude: proposal.latitude as number,
              longitude: proposal.longitude as number,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsCompass={false}
            toolbarEnabled={false}
            zoomEnabled={false}
            scrollEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            <MarkerComponent
              coordinate={{
                latitude: proposal.latitude as number,
                longitude: proposal.longitude as number,
              }}
              pinColor={colors.accent.primary}
            />
          </MapViewComponent>
        </View>
      ) : (
        <View style={styles.mapFallback}>
          <Ionicons name="map-outline" size={16} color={colors.text.secondary} />
          <Text style={styles.mapFallbackText}>Map preview unavailable in this runtime</Text>
        </View>
      )}

      {proposal.note ? <Text style={styles.noteText}>{proposal.note}</Text> : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onOpenMaps}
          disabled={!onOpenMaps || isBusy}
        >
          <Ionicons name="navigate-outline" size={14} color={colors.text.secondary} />
          <Text style={styles.actionText}>Open in Google Maps</Text>
        </TouchableOpacity>

        {showResponseActions ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={onAccept}
              disabled={!onAccept || isBusy}
            >
              <Ionicons name="checkmark" size={14} color={colors.text.onAccent} />
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={onDecline}
              disabled={!onDecline || isBusy}
            >
              <Ionicons name="close" size={14} color={colors.status.error} />
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.counterButton]}
              onPress={onSuggestAlternative}
              disabled={!onSuggestAlternative || isBusy}
            >
              <Ionicons name="swap-horizontal-outline" size={14} color={colors.text.secondary} />
              <Text style={styles.actionText}>Suggest Alternative</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  statusText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  placeName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  placeAddress: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  mapWrap: {
    borderRadius: spacing.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    height: 140,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapFallback: {
    minHeight: 48,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level2,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mapFallbackText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  noteText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionButton: {
    minHeight: 34,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level2,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  acceptButton: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  acceptText: {
    ...typography.presets.caption,
    color: colors.text.onAccent,
  },
  declineButton: {
    backgroundColor: colors.surface.level1,
    borderColor: colors.status.error,
  },
  declineText: {
    ...typography.presets.caption,
    color: colors.status.error,
  },
  counterButton: {
    backgroundColor: colors.surface.level1,
  },
});
