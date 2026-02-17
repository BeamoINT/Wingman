import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Header, InlineBanner, ScreenScaffold } from '../components';
import { supportsNativeGoogleMaps } from '../config/runtime';
import { useAuth } from '../context/AuthContext';
import { useLiveLocation } from '../context/LiveLocationContext';
import { useTheme } from '../context/ThemeContext';
import { getDirections } from '../services/api/directionsApi';
import {
  listLiveLocationPoints,
  subscribeToLiveLocationPoints,
} from '../services/api/liveLocationApi';
import { trackEvent } from '../services/monitoring/events';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type {
  DirectionsLocationInput,
  DirectionsRoute,
  DirectionsTravelMode,
  LiveLocationPoint,
  RootStackParamList,
} from '../types';
import { decodePolyline } from '../utils/polyline';
import { haptics } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Directions'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type MapModule = {
  MapView: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
  Polyline: React.ComponentType<any>;
  PROVIDER_GOOGLE?: any;
};

const DEFAULT_LAT_DELTA = 0.04;
const DEFAULT_LNG_DELTA = 0.04;

const TRAVEL_MODES: Array<{ value: DirectionsTravelMode; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'driving', label: 'Drive', icon: 'car-outline' },
  { value: 'walking', label: 'Walk', icon: 'walk-outline' },
  { value: 'bicycling', label: 'Bike', icon: 'bicycle-outline' },
  { value: 'transit', label: 'Transit', icon: 'train-outline' },
];

function loadNativeMapModule(): MapModule | null {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const maps = require('react-native-maps');
    return {
      MapView: maps.default,
      Marker: maps.Marker,
      Polyline: maps.Polyline,
      PROVIDER_GOOGLE: maps.PROVIDER_GOOGLE,
    };
  } catch {
    return null;
  }
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.344;

  if (miles >= 1) {
    return `${miles.toFixed(1)} mi`;
  }

  const feet = Math.max(Math.round(meters * 3.28084), 50);
  return `${feet} ft`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 min';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }

  return `${Math.max(minutes, 1)} min`;
}

function formatUpdatedAt(value: string): string {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    return 'just now';
  }

  const diffSeconds = Math.max(Math.floor((Date.now() - parsed) / 1_000), 0);

  if (diffSeconds < 60) {
    return 'just now';
  }

  if (diffSeconds < 3600) {
    return `${Math.floor(diffSeconds / 60)}m ago`;
  }

  return `${Math.floor(diffSeconds / 3600)}h ago`;
}

function locationFromRouteParams(route: Props['route']): DirectionsLocationInput {
  return {
    latitude: typeof route.params.destinationLatitude === 'number' ? route.params.destinationLatitude : undefined,
    longitude: typeof route.params.destinationLongitude === 'number' ? route.params.destinationLongitude : undefined,
    placeId: route.params.destinationPlaceId,
    address: route.params.destinationAddress || route.params.destinationName,
  };
}

function locationHasCoordinates(value: DirectionsLocationInput | null | undefined): value is {
  latitude: number;
  longitude: number;
} {
  return !!value
    && typeof value.latitude === 'number'
    && typeof value.longitude === 'number';
}

export const DirectionsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props['route']>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;
  const { user } = useAuth();
  const {
    isSharing,
    startShare,
    stopShare,
    getRemainingSeconds,
  } = useLiveLocation();

  const mapModule = useMemo(loadNativeMapModule, []);
  const destinationInput = useMemo(() => locationFromRouteParams(route), [route]);
  const destinationLabel = route.params.destinationName || 'Meetup location';
  const conversationId = route.params.conversationId;

  const [mode, setMode] = useState<DirectionsTravelMode>('driving');
  const [origin, setOrigin] = useState<DirectionsLocationInput | null>(null);
  const [originError, setOriginError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [routes, setRoutes] = useState<DirectionsRoute[]>([]);
  const [recommendedRouteId, setRecommendedRouteId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isDirectionsLoading, setIsDirectionsLoading] = useState(false);
  const [directionsError, setDirectionsError] = useState<string | null>(null);

  const [livePoints, setLivePoints] = useState<LiveLocationPoint[]>([]);
  const [livePointsError, setLivePointsError] = useState<string | null>(null);
  const [isLivePointsLoading, setIsLivePointsLoading] = useState(false);

  const canUseNativeMap = supportsNativeGoogleMaps && !!mapModule;
  const shareEnabled = !!conversationId;
  const sharingThisConversation = conversationId ? isSharing(conversationId) : false;

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) {
      return null;
    }
    return routes.find((entry) => entry.id === selectedRouteId) || null;
  }, [routes, selectedRouteId]);

  const liveParticipants = useMemo(() => {
    if (!sharingThisConversation) {
      return [] as LiveLocationPoint[];
    }
    return livePoints.filter((point) => point.expiresAt && new Date(point.expiresAt).getTime() > Date.now());
  }, [livePoints, sharingThisConversation]);

  const mapRegion = useMemo(() => {
    const fallbackDestination = locationHasCoordinates(destinationInput)
      ? destinationInput
      : null;

    if (selectedRoute?.legs?.length) {
      const firstLeg = selectedRoute.legs[0];
      const startLat = firstLeg.startLocation?.latitude;
      const startLng = firstLeg.startLocation?.longitude;
      const endLat = firstLeg.endLocation?.latitude;
      const endLng = firstLeg.endLocation?.longitude;

      if (
        typeof startLat === 'number'
        && typeof startLng === 'number'
        && typeof endLat === 'number'
        && typeof endLng === 'number'
      ) {
        const latitude = (startLat + endLat) / 2;
        const longitude = (startLng + endLng) / 2;

        return {
          latitude,
          longitude,
          latitudeDelta: Math.max(Math.abs(startLat - endLat) * 1.7, DEFAULT_LAT_DELTA),
          longitudeDelta: Math.max(Math.abs(startLng - endLng) * 1.7, DEFAULT_LNG_DELTA),
        };
      }
    }

    if (locationHasCoordinates(origin) && fallbackDestination) {
      return {
        latitude: (origin.latitude + fallbackDestination.latitude) / 2,
        longitude: (origin.longitude + fallbackDestination.longitude) / 2,
        latitudeDelta: Math.max(Math.abs(origin.latitude - fallbackDestination.latitude) * 1.8, DEFAULT_LAT_DELTA),
        longitudeDelta: Math.max(Math.abs(origin.longitude - fallbackDestination.longitude) * 1.8, DEFAULT_LNG_DELTA),
      };
    }

    if (locationHasCoordinates(origin)) {
      return {
        latitude: origin.latitude,
        longitude: origin.longitude,
        latitudeDelta: DEFAULT_LAT_DELTA,
        longitudeDelta: DEFAULT_LNG_DELTA,
      };
    }

    if (fallbackDestination) {
      return {
        latitude: fallbackDestination.latitude,
        longitude: fallbackDestination.longitude,
        latitudeDelta: DEFAULT_LAT_DELTA,
        longitudeDelta: DEFAULT_LNG_DELTA,
      };
    }

    return null;
  }, [destinationInput, origin, selectedRoute]);

  const handleBack = useCallback(async () => {
    await haptics.light();
    navigation.goBack();
  }, [navigation]);

  const requestOrigin = useCallback(async () => {
    setIsLocating(true);
    setOriginError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setOriginError('Location access is required to calculate in-app directions from your current position.');
        trackEvent('directions_request_fail', { reason: 'location_permission_denied' });
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setOrigin({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch (error) {
      console.error('Unable to retrieve origin location', error);
      setOriginError('Unable to read your current location. Check device location settings and try again.');
      trackEvent('directions_request_fail', { reason: 'location_fetch_failed' });
    } finally {
      setIsLocating(false);
    }
  }, []);

  const fetchDirections = useCallback(async () => {
    const hasDestination = (
      locationHasCoordinates(destinationInput)
      || !!destinationInput.placeId
      || !!destinationInput.address
    );

    if (!origin || !hasDestination) {
      return;
    }

    setIsDirectionsLoading(true);
    setDirectionsError(null);

    const { directions, error } = await getDirections({
      origin,
      destination: destinationInput,
      mode,
      alternatives: true,
    });

    setIsDirectionsLoading(false);

    if (error || !directions) {
      setRoutes([]);
      setRecommendedRouteId(null);
      setSelectedRouteId(null);
      setDirectionsError(error || 'Unable to fetch route options right now.');
      trackEvent('directions_request_fail', {
        mode,
        reason: 'api_error',
      });
      return;
    }

    setRoutes(directions.routes);
    setRecommendedRouteId(directions.recommendedRouteId || null);

    const initialSelection = directions.recommendedRouteId
      || directions.routes[0]?.id
      || null;

    setSelectedRouteId(initialSelection);

    trackEvent('directions_request_success', {
      mode,
      routeCount: directions.routes.length,
      hasRecommended: !!directions.recommendedRouteId,
    });
  }, [destinationInput, mode, origin]);

  useEffect(() => {
    void requestOrigin();
  }, [requestOrigin]);

  useEffect(() => {
    void fetchDirections();
  }, [fetchDirections]);

  useEffect(() => {
    if (!conversationId || !sharingThisConversation) {
      setLivePoints([]);
      setLivePointsError(null);
      setIsLivePointsLoading(false);
      return () => {};
    }

    setIsLivePointsLoading(true);

    void listLiveLocationPoints(conversationId).then(({ points, error }) => {
      if (error) {
        setLivePointsError(error.message);
      } else {
        setLivePoints(points);
      }
      setIsLivePointsLoading(false);
    });

    const unsubscribe = subscribeToLiveLocationPoints(
      conversationId,
      (points) => {
        setLivePoints(points);
        setLivePointsError(null);
      },
      (error) => {
        setLivePointsError(error.message);
      },
    );

    return unsubscribe;
  }, [conversationId, sharingThisConversation]);

  const handleSelectRoute = useCallback((routeId: string) => {
    setSelectedRouteId(routeId);

    const selected = routes.find((entry) => entry.id === routeId);
    if (!selected) {
      return;
    }

    trackEvent('directions_route_selected', {
      mode,
      selectedRecommended: routeId === recommendedRouteId,
      distanceMeters: selected.distanceMeters,
    });
  }, [mode, recommendedRouteId, routes]);

  const handleToggleSharing = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    if (sharingThisConversation) {
      const result = await stopShare(conversationId);
      if (!result.success) {
        Alert.alert('Unable to Stop Sharing', result.error || 'Please try again.');
        return;
      }
      await haptics.success();
      setLivePoints([]);
      return;
    }

    const result = await startShare(conversationId, 120);
    if (!result.success) {
      Alert.alert('Unable to Share Location', result.error || 'Please try again.');
      return;
    }

    await haptics.success();
  }, [conversationId, sharingThisConversation, startShare, stopShare]);

  const mapRoutes = useMemo(() => routes.map((entry) => ({
    ...entry,
    coordinates: decodePolyline(entry.polyline),
  })), [routes]);

  const MapViewComponent = mapModule?.MapView;
  const MarkerComponent = mapModule?.Marker;
  const PolylineComponent = mapModule?.Polyline;
  const googleProvider = mapModule?.PROVIDER_GOOGLE;

  return (
    <ScreenScaffold scrollable={false} withBottomPadding={false} hideHorizontalPadding style={styles.container}>
      <Header
        showBack
        onBackPress={handleBack}
        title="Directions"
        subtitle={destinationLabel}
      />

      <View style={styles.content}>
        {originError ? (
          <InlineBanner
            title="Location permission required"
            message={originError}
            variant="warning"
          />
        ) : null}

        {directionsError ? (
          <InlineBanner
            title="Route unavailable"
            message={directionsError}
            variant="error"
          />
        ) : null}

        {!canUseNativeMap ? (
          <InlineBanner
            title="Map fallback mode"
            message="Native map rendering is unavailable in this runtime. Route options still work fully in-app."
            variant="info"
          />
        ) : null}

        <View style={styles.modeRow}>
          {TRAVEL_MODES.map((entry) => {
            const selected = entry.value === mode;
            return (
              <TouchableOpacity
                key={entry.value}
                style={[styles.modeChip, selected && styles.modeChipSelected]}
                onPress={() => setMode(entry.value)}
              >
                <Ionicons
                  name={entry.icon}
                  size={14}
                  color={selected ? colors.text.onAccent : colors.text.secondary}
                />
                <Text style={[styles.modeChipText, selected && styles.modeChipTextSelected]}>{entry.label}</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => {
              void requestOrigin();
            }}
            disabled={isLocating || isDirectionsLoading}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={colors.text.secondary} />
            ) : (
              <Ionicons name="locate-outline" size={16} color={colors.text.secondary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.mapCard}>
          {mapRegion && MapViewComponent && MarkerComponent && PolylineComponent && canUseNativeMap ? (
            <MapViewComponent
              style={styles.map}
              initialRegion={mapRegion}
              region={mapRegion}
              provider={googleProvider}
              showsCompass={false}
              showsUserLocation={false}
              toolbarEnabled={false}
            >
              {locationHasCoordinates(origin) ? (
                <MarkerComponent
                  coordinate={{ latitude: origin.latitude, longitude: origin.longitude }}
                  title="Your location"
                  pinColor={colors.primary.blue}
                />
              ) : null}

              {locationHasCoordinates(destinationInput) ? (
                <MarkerComponent
                  coordinate={{ latitude: destinationInput.latitude, longitude: destinationInput.longitude }}
                  title={destinationLabel}
                  pinColor={colors.accent.primary}
                />
              ) : null}

              {mapRoutes.map((routeEntry) => {
                const selected = routeEntry.id === selectedRouteId;
                const recommended = routeEntry.id === recommendedRouteId;

                return (
                  <PolylineComponent
                    key={routeEntry.id}
                    coordinates={routeEntry.coordinates}
                    strokeWidth={selected ? 5 : 3}
                    strokeColor={selected
                      ? colors.accent.primary
                      : recommended
                        ? colors.primary.blue
                        : colors.border.subtle}
                  />
                );
              })}

              {liveParticipants.map((point) => {
                const isCurrentUser = point.userId === user?.id;
                return (
                  <MarkerComponent
                    key={`live-${point.userId}`}
                    coordinate={{ latitude: point.latitude, longitude: point.longitude }}
                    title={isCurrentUser ? 'You (sharing)' : 'Shared location'}
                    description={`Updated ${formatUpdatedAt(point.capturedAt)}`}
                    pinColor={isCurrentUser ? colors.status.success : colors.primary.blue}
                  />
                );
              })}
            </MapViewComponent>
          ) : (
            <View style={styles.mapFallback}>
              {isDirectionsLoading ? (
                <ActivityIndicator size="small" color={colors.accent.primary} />
              ) : (
                <Ionicons name="map-outline" size={18} color={colors.text.secondary} />
              )}
              <Text style={styles.mapFallbackText}>
                {isDirectionsLoading ? 'Calculating routes...' : 'Map rendering unavailable in this runtime'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Route options</Text>
          <Text style={styles.sectionSubtitle}>{routes.length > 1 ? 'Recommended route is auto-selected.' : 'Single route available.'}</Text>
        </View>

        {isDirectionsLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent.primary} />
            <Text style={styles.loadingText}>Loading route alternatives...</Text>
          </View>
        ) : null}

        <FlatList
          data={routes}
          horizontal
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.routeListContent}
          renderItem={({ item }) => {
            const selected = item.id === selectedRouteId;
            const recommended = item.id === recommendedRouteId;
            const etaSeconds = item.durationInTrafficSeconds ?? item.durationSeconds;

            return (
              <TouchableOpacity
                style={[styles.routeCard, selected && styles.routeCardSelected]}
                onPress={() => handleSelectRoute(item.id)}
              >
                <View style={styles.routeHeaderRow}>
                  <Text style={[styles.routeTitle, selected && styles.routeTitleSelected]} numberOfLines={1}>
                    {item.summary || 'Route option'}
                  </Text>
                  {recommended ? (
                    <View style={styles.recommendedBadge}>
                      <Ionicons name="star" size={10} color={colors.text.onAccent} />
                      <Text style={styles.recommendedBadgeText}>Best</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.routeMeta}>
                  {formatDuration(etaSeconds)} • {formatDistance(item.distanceMeters)}
                </Text>

                {item.durationInTrafficSeconds && item.durationInTrafficSeconds !== item.durationSeconds ? (
                  <Text style={styles.routeSecondaryMeta}>
                    With traffic: {formatDuration(item.durationInTrafficSeconds)}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={(
            !isDirectionsLoading ? (
              <View style={styles.emptyRouteState}>
                <Ionicons name="navigate-outline" size={16} color={colors.text.secondary} />
                <Text style={styles.emptyRouteText}>No route options yet.</Text>
              </View>
            ) : null
          )}
        />

        <View style={styles.liveCard}>
          <View style={styles.liveHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Live location sharing</Text>
              <Text style={styles.sectionSubtitle}>
                {shareEnabled
                  ? 'Opt in to share your live location for this meetup conversation.'
                  : 'Live sharing is available from chat-linked meetup directions.'}
              </Text>
            </View>

            {shareEnabled ? (
              <TouchableOpacity
                style={[styles.shareButton, sharingThisConversation && styles.shareButtonActive]}
                onPress={() => {
                  void handleToggleSharing();
                }}
              >
                <Ionicons
                  name={sharingThisConversation ? 'radio' : 'radio-outline'}
                  size={14}
                  color={sharingThisConversation ? colors.text.onAccent : colors.text.secondary}
                />
                <Text style={[styles.shareButtonText, sharingThisConversation && styles.shareButtonTextActive]}>
                  {sharingThisConversation ? 'Stop' : 'Share'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {!shareEnabled ? (
            <Text style={styles.liveBodyText}>Open directions from a meetup chat card to enable live sharing controls.</Text>
          ) : null}

          {shareEnabled && !sharingThisConversation ? (
            <Text style={styles.liveBodyText}>Share your location to see other participants who also opted in.</Text>
          ) : null}

          {shareEnabled && sharingThisConversation ? (
            <>
              <Text style={styles.liveBodyText}>
                Sharing is active. {getRemainingSeconds(conversationId || '') != null
                  ? `${formatDuration((getRemainingSeconds(conversationId || '') || 0))} remaining.`
                  : ''}
              </Text>

              {isLivePointsLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.accent.primary} />
                  <Text style={styles.loadingText}>Syncing shared locations...</Text>
                </View>
              ) : null}

              {livePointsError ? (
                <InlineBanner
                  title="Live location temporarily unavailable"
                  message={livePointsError}
                  variant="warning"
                />
              ) : null}

              {!isLivePointsLoading && liveParticipants.length === 0 ? (
                <Text style={styles.liveBodyText}>No one else is sharing yet. You are visible to others who opt in.</Text>
              ) : null}

              {liveParticipants.map((point) => {
                const isCurrentUser = point.userId === user?.id;
                return (
                  <View key={`participant-${point.userId}`} style={styles.liveParticipantRow}>
                    <View style={styles.liveParticipantDot} />
                    <Text style={styles.liveParticipantText}>
                      {isCurrentUser ? 'You' : 'Participant'} • updated {formatUpdatedAt(point.capturedAt)}
                    </Text>
                  </View>
                );
              })}
            </>
          ) : null}
        </View>
      </View>
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modeChip: {
    minHeight: 34,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modeChipSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primary,
  },
  modeChipText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  modeChipTextSelected: {
    color: colors.text.onAccent,
  },
  refreshButton: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCard: {
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
    minHeight: 220,
    backgroundColor: colors.surface.level1,
  },
  map: {
    width: '100%',
    height: 220,
  },
  mapFallback: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  mapFallbackText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  sectionHeader: {
    gap: spacing.xxs,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  sectionSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  loadingText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  routeListContent: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  routeCard: {
    width: 220,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  routeCardSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.surface.level2,
  },
  routeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  routeTitle: {
    ...typography.presets.caption,
    color: colors.text.primary,
    flex: 1,
  },
  routeTitleSelected: {
    color: colors.accent.primary,
  },
  recommendedBadge: {
    minHeight: 20,
    borderRadius: spacing.radius.full,
    backgroundColor: colors.accent.primary,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  recommendedBadgeText: {
    ...typography.presets.caption,
    color: colors.text.onAccent,
  },
  routeMeta: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
  },
  routeSecondaryMeta: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  emptyRouteState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  emptyRouteText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  liveCard: {
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  liveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shareButton: {
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
  shareButtonActive: {
    borderColor: colors.status.success,
    backgroundColor: colors.status.success,
  },
  shareButtonText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  shareButtonTextActive: {
    color: colors.text.onAccent,
  },
  liveBodyText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  liveParticipantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveParticipantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },
  liveParticipantText: {
    ...typography.presets.caption,
    color: colors.text.primary,
  },
});
