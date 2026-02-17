import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
};

type TravelMode = "driving" | "walking" | "bicycling" | "transit";

type CoordinateInput = {
  latitude?: number;
  longitude?: number;
  placeId?: string;
  address?: string;
};

type DirectionsRequest = {
  origin?: CoordinateInput;
  destination?: CoordinateInput;
  mode?: TravelMode;
  alternatives?: boolean;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_COUNT = 30;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function toTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toMode(value: unknown): TravelMode {
  const normalized = toTrimmed(value).toLowerCase();
  if (normalized === "walking" || normalized === "bicycling" || normalized === "transit") {
    return normalized;
  }
  return "driving";
}

function getClientIdentifier(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for") || "";
  const firstIp = forwardedFor.split(",")[0]?.trim();
  if (firstIp) return `ip:${firstIp}`;

  const realIp = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "";
  if (realIp.trim()) return `ip:${realIp.trim()}`;

  const authHeader = req.headers.get("authorization") || "";
  return authHeader ? `auth:${authHeader.slice(-18)}` : "anon";
}

function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(clientId);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (existing.count >= RATE_LIMIT_COUNT) {
    return true;
  }

  existing.count += 1;
  rateLimitStore.set(clientId, existing);
  return false;
}

function extractAccessToken(req: Request, requestBody: Record<string, unknown>): string | null {
  const sessionTokenHeader = req.headers.get("x-session-token");
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const bearerMatch = authHeader?.trim().match(/^Bearer\s+(.+)$/i);

  const possibleTokens = [
    typeof sessionTokenHeader === "string" ? sessionTokenHeader.trim() : "",
    typeof requestBody.accessToken === "string" ? requestBody.accessToken.trim() : "",
    typeof bearerMatch?.[1] === "string" ? bearerMatch[1].trim() : "",
  ];

  return possibleTokens.find((candidate) => candidate && candidate.split(".").length === 3) || null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function validateCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function resolveLocationParam(input: CoordinateInput | undefined): { value: string | null; kind: "coords" | "place" | "address" | "none" } {
  if (!input || typeof input !== "object") {
    return { value: null, kind: "none" };
  }

  const lat = toFiniteNumber(input.latitude);
  const lng = toFiniteNumber(input.longitude);
  if (lat != null && lng != null && validateCoordinates(lat, lng)) {
    return { value: `${lat},${lng}`, kind: "coords" };
  }

  const placeId = toTrimmed(input.placeId);
  if (placeId) {
    return { value: `place_id:${placeId}`, kind: "place" };
  }

  const address = toTrimmed(input.address);
  if (address) {
    return { value: address, kind: "address" };
  }

  return { value: null, kind: "none" };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function toLegSummary(leg: Record<string, unknown>): Record<string, unknown> {
  const distance = (leg.distance || {}) as Record<string, unknown>;
  const duration = (leg.duration || {}) as Record<string, unknown>;
  const durationInTraffic = (leg.duration_in_traffic || {}) as Record<string, unknown>;
  const startLocation = (leg.start_location || {}) as Record<string, unknown>;
  const endLocation = (leg.end_location || {}) as Record<string, unknown>;

  return {
    startAddress: toTrimmed(leg.start_address),
    endAddress: toTrimmed(leg.end_address),
    distanceMeters: toFiniteNumber(distance.value) || 0,
    durationSeconds: toFiniteNumber(duration.value) || 0,
    durationInTrafficSeconds: toFiniteNumber(durationInTraffic.value),
    startLocation: {
      latitude: toFiniteNumber(startLocation.lat),
      longitude: toFiniteNumber(startLocation.lng),
    },
    endLocation: {
      latitude: toFiniteNumber(endLocation.lat),
      longitude: toFiniteNumber(endLocation.lng),
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const googleServerApiKey = Deno.env.get("GOOGLE_MAPS_SERVER_API_KEY") || Deno.env.get("GOOGLE_PLACES_API_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  if (!googleServerApiKey) {
    return jsonResponse({ error: "Server configuration error: missing Google Maps API key" }, 500);
  }

  try {
    const body = await req.json().catch(() => ({})) as DirectionsRequest & Record<string, unknown>;
    const token = extractAccessToken(req, body);

    if (!token) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user?.id) {
      return jsonResponse({ error: "Invalid authentication token" }, 401);
    }

    const clientId = getClientIdentifier(req);
    if (isRateLimited(clientId)) {
      return jsonResponse({
        error: "Too many requests. Please try again shortly.",
        code: "rate_limited",
      }, 429);
    }

    const mode = toMode(body.mode);
    const includeAlternatives = body.alternatives !== false;

    const origin = resolveLocationParam(body.origin);
    const destination = resolveLocationParam(body.destination);

    if (!origin.value) {
      return jsonResponse({ error: "Origin is required" }, 400);
    }

    if (!destination.value) {
      return jsonResponse({ error: "Destination is required" }, 400);
    }

    const params = new URLSearchParams({
      origin: origin.value,
      destination: destination.value,
      mode,
      alternatives: includeAlternatives ? "true" : "false",
      key: googleServerApiKey,
    });

    if (mode === "driving" || mode === "transit") {
      params.set("departure_time", "now");
    }

    const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`);
    const payload = await response.json() as Record<string, unknown>;

    const providerStatus = toTrimmed(payload.status);
    if (providerStatus !== "OK" && providerStatus !== "ZERO_RESULTS") {
      console.error("get-directions provider error", {
        status: providerStatus || "unknown",
        mode,
      });
      return jsonResponse({
        error: "Unable to fetch directions right now",
        status: providerStatus || "unknown",
      }, 502);
    }

    const routesRaw = Array.isArray(payload.routes) ? payload.routes : [];
    if (providerStatus === "ZERO_RESULTS" || routesRaw.length === 0) {
      return jsonResponse({
        routes: [],
        recommendedRouteId: null,
      });
    }

    const routes = routesRaw.map((route, index) => {
      const routeRecord = (route || {}) as Record<string, unknown>;
      const legsRaw = Array.isArray(routeRecord.legs) ? routeRecord.legs : [];
      const legs = legsRaw
        .filter((leg): leg is Record<string, unknown> => !!leg && typeof leg === "object")
        .map((leg) => toLegSummary(leg));

      const distanceMeters = legs.reduce((sum, leg) => sum + Number(leg.distanceMeters || 0), 0);
      const durationSeconds = legs.reduce((sum, leg) => sum + Number(leg.durationSeconds || 0), 0);

      const trafficDurations = legs
        .map((leg) => (typeof leg.durationInTrafficSeconds === "number" ? leg.durationInTrafficSeconds : null))
        .filter((value): value is number => value != null);
      const durationInTrafficSeconds = trafficDurations.length > 0
        ? trafficDurations.reduce((sum, value) => sum + value, 0)
        : null;

      const overviewPolyline = (routeRecord.overview_polyline || {}) as Record<string, unknown>;

      return {
        id: `route-${index}`,
        summary: toTrimmed(routeRecord.summary) || `Route ${index + 1}`,
        distanceMeters,
        durationSeconds,
        durationInTrafficSeconds,
        polyline: toTrimmed(overviewPolyline.points),
        warnings: toStringArray(routeRecord.warnings),
        legs,
      };
    });

    const ranked = [...routes].sort((a, b) => {
      const aPrimary = typeof a.durationInTrafficSeconds === "number" ? a.durationInTrafficSeconds : a.durationSeconds;
      const bPrimary = typeof b.durationInTrafficSeconds === "number" ? b.durationInTrafficSeconds : b.durationSeconds;
      if (aPrimary !== bPrimary) {
        return aPrimary - bPrimary;
      }
      return a.distanceMeters - b.distanceMeters;
    });

    const recommendedRouteId = ranked[0]?.id || null;

    return jsonResponse({
      routes,
      recommendedRouteId,
    });
  } catch (error) {
    console.error("get-directions internal error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
